import React, { useState } from 'react';
import { collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../firebase-config';
import './FoodManager.css';

function FoodEditor({ food, onUpdate, onBack }) {
  const [editedFood, setEditedFood] = useState(food);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // FNDDS Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [searching, setSearching] = useState(false);

  // Get FNDDS nutrients from metadata (if available)
  const fnddsNutrients = food.fndds_metadata?.fndds_nutrients || {};

  const handleInputChange = (field, value) => {
    setEditedFood(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleNutrientChange = (nutrientName, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setEditedFood(prev => ({
      ...prev,
      nutrients: {
        ...prev.nutrients,
        per100g: {
          ...prev.nutrients.per100g,
          [nutrientName]: {
            ...prev.nutrients.per100g[nutrientName],
            value: numValue
          }
        }
      }
    }));
    setHasChanges(true);
  };

  const applyFNDDSValue = (nutrientName) => {
    const fnddsValue = fnddsNutrients[nutrientName];
    if (!fnddsValue) return;

    handleNutrientChange(nutrientName, fnddsValue.value);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await onUpdate(food.id, {
        name: editedFood.name,
        category: editedFood.category,
        nutrients: editedFood.nutrients,
        fndds_metadata: editedFood.fndds_metadata
      });

      if (success) {
        setHasChanges(false);
        alert('Changes saved successfully!');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // FNDDS Search Functions - Query Firebase directly
  const handleSearchFNDDS = () => {
    setSearchTerm(food.name); // Pre-fill with current food name
    setShowSearchModal(true);
    performSearch(food.name);
  };

  const performSearch = async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    
    try {
      const searchLower = term.toLowerCase();
      
      // Query Firebase fndds_foods collection
      // Using range query for partial matching
      const fnddsRef = collection(db, 'fndds_foods');
      const q = query(
        fnddsRef,
        where('name_lower', '>=', searchLower),
        where('name_lower', '<=', searchLower + '\uf8ff'),
        firestoreLimit(100)
      );
      
      const querySnapshot = await getDocs(q);
      
      const results = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push({
          name: data.name,
          food_code: data.food_code,
          wweia_category: data.wweia_category,
          nutrients: data.nutrients || {}
        });
      });
      
      console.log(`Found ${results.length} results for "${term}"`);
      setSearchResults(results);
      
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed: ' + error.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  const handleApplyNewMatch = () => {
    if (!selectedMatch) {
      alert('Please select a match first');
      return;
    }

    const confirm = window.confirm(
      `Replace current match with:\n\n` +
      `"${selectedMatch.name}"\n` +
      `(Food Code: ${selectedMatch.food_code})\n\n` +
      `This will update the FNDDS metadata and nutrient recommendations.`
    );

    if (!confirm) return;

    // Update FNDDS metadata with new match
    const newMetadata = {
      matched_food: selectedMatch.name,
      food_code: selectedMatch.food_code,
      wweia_category: selectedMatch.wweia_category,
      match_score: 1.0, // Manual match = perfect score
      updated: false, // Not yet applied
      fndds_nutrients: selectedMatch.nutrients,
      manual_match: true,
      manual_match_date: new Date().toISOString()
    };

    setEditedFood(prev => ({
      ...prev,
      fndds_metadata: newMetadata
    }));

    setHasChanges(true);
    setShowSearchModal(false);
    setSelectedMatch(null);
    
    alert('Match updated! Click "Save Changes" to apply to Firebase.');
  };

  const nutrients = editedFood.nutrients?.per100g || {};

  const nutrientGroups = {
    macronutrients: [
      'calories', 'protein', 'carbs', 'fiber', 'fat', 
      'saturated_fat', 'monounsaturated_fat', 'polyunsaturated_fat', 'cholesterol'
    ],
    minerals: [
      'sodium', 'potassium', 'calcium', 'iron', 'magnesium',
      'phosphorus', 'zinc', 'copper', 'selenium'
    ],
    vitamins: [
      'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
      'thiamin', 'riboflavin', 'niacin', 'vitamin_b6', 'vitamin_b12',
      'folate', 'choline'
    ],
    other: ['beta_carotene', 'lycopene', 'lutein_zeaxanthin']
  };

  const renderNutrientGroup = (groupName, nutrientList) => {
    const groupNutrients = nutrientList.filter(n => nutrients[n]);
    if (groupNutrients.length === 0) return null;

    return (
      <div key={groupName} className="nutrient-group">
        <h4>{groupName.toUpperCase()}</h4>
        <div className="nutrient-grid">
          {groupNutrients.map(nutrientName => {
            const nutrient = nutrients[nutrientName];
            const fnddsValue = fnddsNutrients[nutrientName];
            const isDifferent = fnddsValue && Math.abs(fnddsValue.value - nutrient.value) > 0.01;

            return (
              <div key={nutrientName} className="nutrient-input-group">
                <label>
                  {nutrientName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  {isDifferent && <span className="diff-indicator">⚠️</span>}
                </label>
                <div className="nutrient-input-row">
                  <input
                    type="number"
                    step="0.01"
                    value={nutrient.value}
                    onChange={(e) => handleNutrientChange(nutrientName, e.target.value)}
                  />
                  <span className="unit">{nutrient.unit}</span>
                  {fnddsValue && isDifferent && (
                    <button
                      className="btn-use-fndds"
                      onClick={() => applyFNDDSValue(nutrientName)}
                      title={`Use FNDDS value: ${fnddsValue.value}`}
                    >
                      Use FNDDS
                    </button>
                  )}
                </div>
                {fnddsValue && isDifferent && (
                  <div className="fndds-suggestion">
                    FNDDS: {fnddsValue.value} {fnddsValue.unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <button onClick={onBack} className="btn-back">← Back to List</button>
        <h2>Editing: {food.name}</h2>
        {hasChanges && <span className="unsaved-indicator">● Unsaved changes</span>}
      </div>

      {/* FNDDS Match Info */}
      {editedFood.fndds_metadata && (
        <div className="fndds-match-box">
          <div className="match-header">
            <h3>FNDDS Match Information</h3>
            <button 
              className="btn-change-match"
              onClick={handleSearchFNDDS}
            >
              🔍 Change Match
            </button>
          </div>
          <div className="match-info-grid">
            <div className="match-info-item">
              <strong>Matched Food:</strong>
              <span>{editedFood.fndds_metadata.matched_food}</span>
            </div>
            <div className="match-info-item">
              <strong>Food Code:</strong>
              <span>{editedFood.fndds_metadata.food_code}</span>
            </div>
            <div className="match-info-item">
              <strong>Match Score:</strong>
              <span className={`match-badge ${
                editedFood.fndds_metadata.match_score >= 0.9 ? 'excellent' :
                editedFood.fndds_metadata.match_score >= 0.8 ? 'good' :
                editedFood.fndds_metadata.match_score >= 0.7 ? 'fair' : 'poor'
              }`}>
                {(editedFood.fndds_metadata.match_score * 100).toFixed(1)}%
                {editedFood.fndds_metadata.manual_match && ' (Manual)'}
              </span>
            </div>
            <div className="match-info-item">
              <strong>Category:</strong>
              <span>{editedFood.fndds_metadata.wweia_category || 'N/A'}</span>
            </div>
            <div className="match-info-item">
              <strong>Updated:</strong>
              <span className={editedFood.fndds_metadata.updated ? 'text-success' : 'text-muted'}>
                {editedFood.fndds_metadata.updated ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="editor-section">
        <h3>Basic Information</h3>
        <div className="basic-info-grid">
          <div className="input-group">
            <label>Food Name</label>
            <input
              type="text"
              value={editedFood.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Category</label>
            <input
              type="text"
              value={editedFood.category || ''}
              onChange={(e) => handleInputChange('category', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Nutrients */}
      <div className="editor-section">
        <h3>Nutrients (per 100g)</h3>
        {Object.entries(nutrientGroups).map(([groupName, nutrientList]) =>
          renderNutrientGroup(groupName, nutrientList)
        )}
      </div>

      {/* Save/Cancel Buttons */}
      <div className="editor-actions">
        <button
          onClick={handleSave}
          className="btn-save"
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onBack}
          className="btn-cancel"
          disabled={saving}
        >
          Cancel
        </button>
      </div>

      {/* FNDDS Search Modal */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Search FNDDS Database</h2>
              <button className="modal-close" onClick={() => setShowSearchModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search for food (e.g., 'almond milk', 'chicken', 'rice')..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      performSearch(searchTerm);
                    }
                  }}
                  autoFocus
                />
                <button 
                  onClick={() => performSearch(searchTerm)}
                  disabled={searching}
                >
                  {searching ? '⏳ Searching...' : '🔍 Search'}
                </button>
              </div>

              <div className="search-results">
                {searching && <p className="searching-message">Searching Firebase...</p>}
                
                {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                  <p className="no-results">No results found. Try different keywords.</p>
                )}
                
                {!searching && searchResults.length > 0 && (
                  <>
                    <p className="results-count">Found {searchResults.length} results</p>
                    <div className="results-list">
                      {searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          className={`result-item ${selectedMatch === result ? 'selected' : ''}`}
                          onClick={() => handleSelectMatch(result)}
                        >
                          <div className="result-name">{result.name}</div>
                          <div className="result-details">
                            <span>Code: {result.food_code}</span>
                            {result.wweia_category && (
                              <span> | {result.wweia_category}</span>
                            )}
                          </div>
                          {selectedMatch === result && (
                            <div className="result-selected-indicator">✓ Selected</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleApplyNewMatch}
                className="btn-apply-match"
                disabled={!selectedMatch}
              >
                Apply This Match
              </button>
              <button onClick={() => setShowSearchModal(false)} className="btn-modal-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FoodEditor;