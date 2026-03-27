import React, { useState, useMemo } from 'react';
import './FoodManager.css';

function FNDDSComparison({ food, onBack, onUpdate }) {
  const [selectedNutrients, setSelectedNutrients] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Get FNDDS nutrients from metadata (stored by push script)
  // ✅ CORRECT (with arrow function):
const fnddsNutrients = useMemo(() => food.fndds_metadata?.fndds_nutrients || {}, [food.fndds_metadata]);
  const hasComparisonData = Object.keys(fnddsNutrients).length > 0;

  const compareNutrients = useMemo(() => {
    const firebaseNutrients = food.nutrients?.per100g || {};
    
    // Get all unique nutrient names
    const allNutrients = new Set([
      ...Object.keys(firebaseNutrients),
      ...Object.keys(fnddsNutrients)
    ]);

    const comparisons = [];
    
    allNutrients.forEach(nutrientName => {
      const firebaseValue = firebaseNutrients[nutrientName];
      const fnddsValue = fnddsNutrients[nutrientName];
      
      if (!firebaseValue && !fnddsValue) return;

      const fbVal = firebaseValue?.value || 0;
      const fnddsVal = fnddsValue?.value || 0;
      const difference = fnddsVal - fbVal;
      const percentDiff = fbVal !== 0 ? (difference / fbVal) * 100 : 0;
      
      comparisons.push({
        name: nutrientName,
        firebase: firebaseValue,
        fndds: fnddsValue,
        difference,
        percentDiff,
        isDifferent: Math.abs(difference) > 0.01,
        onlyInFndds: !firebaseValue && fnddsValue,
        onlyInFirebase: firebaseValue && !fnddsValue
      });
    });

    // Sort by significance of difference
    comparisons.sort((a, b) => {
      if (a.onlyInFndds !== b.onlyInFndds) return a.onlyInFndds ? -1 : 1;
      if (a.onlyInFirebase !== b.onlyInFirebase) return a.onlyInFirebase ? -1 : 1;
      return Math.abs(b.difference) - Math.abs(a.difference);
    });

    return comparisons;
  }, [food, fnddsNutrients]);

  const stats = useMemo(() => {
    const different = compareNutrients.filter(c => c.isDifferent).length;
    const onlyInFndds = compareNutrients.filter(c => c.onlyInFndds).length;
    const onlyInFirebase = compareNutrients.filter(c => c.onlyInFirebase).length;
    const identical = compareNutrients.length - different - onlyInFndds - onlyInFirebase;

    return { different, onlyInFndds, onlyInFirebase, identical, total: compareNutrients.length };
  }, [compareNutrients]);

  const formatNutrient = (nutrient) => {
    if (!nutrient) return '—';
    return `${nutrient.value} ${nutrient.unit}`;
  };

  const getDifferenceColor = (percentDiff) => {
    const abs = Math.abs(percentDiff);
    if (abs < 5) return 'diff-minor';
    if (abs < 20) return 'diff-moderate';
    return 'diff-major';
  };

  // Selection handlers
  const toggleNutrient = (nutrientName) => {
    const newSelected = new Set(selectedNutrients);
    if (newSelected.has(nutrientName)) {
      newSelected.delete(nutrientName);
    } else {
      newSelected.add(nutrientName);
    }
    setSelectedNutrients(newSelected);
  };

  const selectAllDifferent = () => {
    const differentNutrients = compareNutrients
      .filter(c => (c.isDifferent || c.onlyInFndds) && c.fndds)
      .map(c => c.name);
    setSelectedNutrients(new Set(differentNutrients));
  };

  const clearSelection = () => {
    setSelectedNutrients(new Set());
  };

  const handleAcceptSelected = async () => {
    if (selectedNutrients.size === 0) {
      alert('Please select nutrients to accept');
      return;
    }

    const count = selectedNutrients.size;
    const confirm = window.confirm(
      `Accept ${count} FNDDS value${count > 1 ? 's' : ''}?\n\n` +
      `This will update the selected nutrients in Firebase with FNDDS values.`
    );

    if (!confirm) return;

    await applyChanges(selectedNutrients);
  };

  const handleAcceptAll = async () => {
    const changedNutrients = compareNutrients
      .filter(c => (c.isDifferent || c.onlyInFndds) && c.fndds)
      .map(c => c.name);

    if (changedNutrients.length === 0) {
      alert('No differences to accept');
      return;
    }

    const confirm = window.confirm(
      `Accept ALL ${changedNutrients.length} FNDDS values?\n\n` +
      `This will update ALL different nutrients in Firebase with FNDDS values.\n` +
      `This action cannot be undone.`
    );

    if (!confirm) return;

    await applyChanges(new Set(changedNutrients));
  };

  const applyChanges = async (nutrientsToUpdate) => {
    setSaving(true);
    try {
      // Build updated nutrients object
      const updatedNutrients = { ...food.nutrients };
      if (!updatedNutrients.per100g) {
        updatedNutrients.per100g = {};
      }

      nutrientsToUpdate.forEach(nutrientName => {
        const comp = compareNutrients.find(c => c.name === nutrientName);
        if (comp && comp.fndds) {
          updatedNutrients.per100g[nutrientName] = {
            value: comp.fndds.value,
            unit: comp.fndds.unit
          };
        }
      });

      // Update FNDDS metadata to mark as updated
      const updatedMetadata = {
        ...food.fndds_metadata,
        updated: true,
        last_manual_update: new Date().toISOString()
      };

      // Call onUpdate (which should update Firebase)
      const success = await onUpdate(food.id, {
        nutrients: updatedNutrients,
        fndds_metadata: updatedMetadata
      });

      if (success) {
        alert(`Successfully updated ${nutrientsToUpdate.size} nutrients!`);
        clearSelection();
        setTimeout(() => onBack(), 1000);
      }
    } catch (error) {
      console.error('Error applying changes:', error);
      alert('Failed to update nutrients: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // If no FNDDS metadata at all
  if (!food.fndds_metadata) {
    return (
      <div className="comparison-container">
        <div className="comparison-header">
          <button onClick={onBack} className="btn-back">← Back</button>
          <h2>FNDDS Comparison: {food.name}</h2>
        </div>
        <div className="no-data-message">
          <p>This meal has no FNDDS match information.</p>
          <p>Run the FNDDS update script to match this meal with USDA data.</p>
        </div>
      </div>
    );
  }

  // If metadata exists but no comparison data
  if (!hasComparisonData) {
    return (
      <div className="comparison-container">
        <div className="comparison-header">
          <button onClick={onBack} className="btn-back">← Back</button>
          <h2>FNDDS Comparison: {food.name}</h2>
        </div>
        <div className="no-data-message">
          <p>FNDDS comparison data not stored in metadata yet.</p>
          <p>Re-run the push script with the updated version to store FNDDS values for comparison.</p>
          <p><strong>Matched to:</strong> {food.fndds_metadata.matched_food}</p>
          <p><strong>Match Score:</strong> {(food.fndds_metadata.match_score * 100).toFixed(1)}%</p>
        </div>
      </div>
    );
  }

  const hasChanges = compareNutrients.some(c => (c.isDifferent || c.onlyInFndds) && c.fndds);

  return (
    <div className="comparison-container">
      <div className="comparison-header">
        <button onClick={onBack} className="btn-back">← Back to List</button>
        <div className="comparison-title">
          <h2>Compare & Accept: {food.name}</h2>
        </div>
      </div>

      {/* Match Info */}
      {food.fndds_metadata && (
        <div className="match-info-box">
          <h3>FNDDS Match Information</h3>
          <div className="match-details">
            <div className="match-detail-item">
              <strong>Matched to:</strong> {food.fndds_metadata.matched_food}
            </div>
            <div className="match-detail-item">
              <strong>Food Code:</strong> {food.fndds_metadata.food_code}
            </div>
            <div className="match-detail-item">
              <strong>Match Score:</strong> 
              <span className={`match-badge ${
                food.fndds_metadata.match_score >= 0.9 ? 'excellent' :
                food.fndds_metadata.match_score >= 0.8 ? 'good' :
                food.fndds_metadata.match_score >= 0.7 ? 'fair' : 'poor'
              }`}>
                {(food.fndds_metadata.match_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="match-detail-item">
              <strong>WWEIA Category:</strong> {food.fndds_metadata.wweia_category || 'N/A'}
            </div>
            <div className="match-detail-item">
              <strong>Values Updated:</strong> 
              <span className={food.fndds_metadata.updated ? 'text-success' : 'text-muted'}>
                {food.fndds_metadata.updated ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            {food.fndds_metadata.comparison_date && (
              <div className="match-detail-item">
                <strong>Comparison Date:</strong> {food.fndds_metadata.comparison_date}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      <div className="comparison-stats">
        <div className="stat-box">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Nutrients</div>
        </div>
        <div className="stat-box stat-identical">
          <div className="stat-number">{stats.identical}</div>
          <div className="stat-label">Identical</div>
        </div>
        <div className="stat-box stat-different">
          <div className="stat-number">{stats.different}</div>
          <div className="stat-label">Different Values</div>
        </div>
        <div className="stat-box stat-fndds-only">
          <div className="stat-number">{stats.onlyInFndds}</div>
          <div className="stat-label">Only in FNDDS</div>
        </div>
        <div className="stat-box stat-firebase-only">
          <div className="stat-number">{stats.onlyInFirebase}</div>
          <div className="stat-label">Only in Current</div>
        </div>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="comparison-actions">
          <div className="selection-actions">
            <button 
              onClick={selectAllDifferent}
              className="btn-select-all"
              disabled={saving}
            >
              ✓ Select All Different
            </button>
            <button 
              onClick={clearSelection}
              className="btn-clear-selection"
              disabled={saving || selectedNutrients.size === 0}
            >
              ✗ Clear Selection
            </button>
            <span className="selection-count">
              {selectedNutrients.size} selected
            </span>
          </div>
          <div className="apply-actions">
            <button 
              onClick={handleAcceptSelected}
              className="btn-accept-selected"
              disabled={saving || selectedNutrients.size === 0}
            >
              {saving ? 'Applying...' : `✓ Accept Selected (${selectedNutrients.size})`}
            </button>
            <button 
              onClick={handleAcceptAll}
              className="btn-accept-all"
              disabled={saving}
            >
              {saving ? 'Applying...' : '✓ Accept All Different'}
            </button>
          </div>
        </div>
      )}

      {!hasChanges && (
        <div className="no-changes-message">
          <p>✓ All values are identical - no changes to accept!</p>
        </div>
      )}

      {/* Comparison Table */}
      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={selectedNutrients.size === compareNutrients.filter(c => (c.isDifferent || c.onlyInFndds) && c.fndds).length && selectedNutrients.size > 0}
                  onChange={(e) => e.target.checked ? selectAllDifferent() : clearSelection()}
                  disabled={saving}
                />
              </th>
              <th>Nutrient</th>
              <th>Current Value</th>
              <th>FNDDS Recommendation</th>
              <th>Difference</th>
              <th>% Change</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {compareNutrients.map((comp, idx) => {
              const canSelect = (comp.isDifferent || comp.onlyInFndds) && comp.fndds;
              return (
                <tr 
                  key={comp.name} 
                  className={`comparison-row ${
                    comp.onlyInFndds ? 'only-fndds' : 
                    comp.onlyInFirebase ? 'only-firebase' :
                    comp.isDifferent ? 'has-difference' : ''
                  } ${selectedNutrients.has(comp.name) ? 'selected' : ''}`}
                  onClick={() => canSelect && toggleNutrient(comp.name)}
                  style={{ cursor: canSelect ? 'pointer' : 'default' }}
                >
                  <td>
                    {canSelect && (
                      <input 
                        type="checkbox" 
                        checked={selectedNutrients.has(comp.name)}
                        onChange={() => toggleNutrient(comp.name)}
                        disabled={saving}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </td>
                  <td className="nutrient-name">
                    {comp.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="value-cell firebase-value">
                    {formatNutrient(comp.firebase)}
                  </td>
                  <td className="value-cell fndds-value">
                    {formatNutrient(comp.fndds)}
                  </td>
                  <td className={`difference-cell ${getDifferenceColor(comp.percentDiff)}`}>
                    {comp.isDifferent ? (
                      <>
                        {comp.difference > 0 ? '+' : ''}
                        {comp.difference.toFixed(2)} {comp.fndds?.unit || ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`percent-cell ${getDifferenceColor(comp.percentDiff)}`}>
                    {comp.isDifferent && comp.firebase?.value ? (
                      <>
                        {comp.percentDiff > 0 ? '+' : ''}
                        {comp.percentDiff.toFixed(1)}%
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="status-cell">
                    {comp.onlyInFndds && <span className="badge badge-blue">New in FNDDS</span>}
                    {comp.onlyInFirebase && <span className="badge badge-gray">Not in FNDDS</span>}
                    {!comp.onlyInFndds && !comp.onlyInFirebase && (
                      comp.isDifferent ? 
                        <span className="badge badge-orange">Different</span> :
                        <span className="badge badge-green">Same</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="comparison-legend">
        <h4>Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color only-fndds"></span>
            <span>Only in FNDDS (new nutrient data available)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color only-firebase"></span>
            <span>Only in current data (not in FNDDS)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color has-difference"></span>
            <span>Different values between current and FNDDS</span>
          </div>
          <div className="legend-item">
            <span className="legend-color diff-minor"></span>
            <span>Minor difference (&lt;5%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color diff-moderate"></span>
            <span>Moderate difference (5-20%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color diff-major"></span>
            <span>Major difference (&gt;20%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FNDDSComparison;