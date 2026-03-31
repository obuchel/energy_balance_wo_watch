import React from 'react';

// Conversion utilities
const GRAMS_PER_OUNCE = 28.3495;

const convertWeight = {
  ozToG: (oz) => oz * GRAMS_PER_OUNCE,
  gToOz: (g) => g / GRAMS_PER_OUNCE,
};

// ServingSuggestions component - UPDATED with unit system support
const ServingSuggestions = ({ selectedMeal, onServingSelect, currentServing, currentUnit = 'g', userUnitSystem = 'metric' }) => {
  if (!selectedMeal) return null;

  // Use longCovidServings from the new data format
  const longCovidServings = selectedMeal.longCovidServings || [];
  
  // If no Long COVID servings, fall back to old format for backward compatibility
  const legacyServingOptions = selectedMeal.nutritional_metrics?.serving_options;
  
  const isSelected = (weight, unit = 'g') => {
    const weightMatch = parseFloat(currentServing) === parseFloat(weight);
    const unitMatch = (currentUnit || 'g') === (unit || 'g');
    return weightMatch && unitMatch;
  };

  const handleServingClick = (weight, description, unit = 'g') => {
    console.log('Serving button clicked:', { weight, description, unit });
    if (onServingSelect && typeof onServingSelect === 'function') {
      onServingSelect(weight, description, unit);
    } else {
      console.error('onServingSelect is not a function:', onServingSelect);
    }
  };

  // Parse serving amount from longCovidServings format (e.g., "240ml (8 oz)" or "120g")
  const parseServingAmount = (amountString) => {
    const match = amountString.match(/(\d+)(ml|g)/i);
    if (match) {
      return {
        weight: parseFloat(match[1]),
        unit: match[2].toLowerCase()
      };
    }
    return { weight: 100, unit: 'g' };
  };

  // Convert serving to currently selected unit for display
  // Use currentUnit (what's in the dropdown) instead of userUnitSystem
  const convertServingForDisplay = (weight, unit) => {
    // If currently viewing in oz and the serving is in grams, convert it
    if (currentUnit === 'oz' && unit === 'g') {
      const oz = convertWeight.gToOz(weight);
      return {
        weight: Math.round(oz * 10) / 10,
        unit: 'oz',
        originalWeight: weight,
        originalUnit: unit
      };
    }
    // If currently viewing in grams and the serving is in oz, convert it
    if (currentUnit === 'g' && unit === 'oz') {
      const g = convertWeight.ozToG(weight);
      return {
        weight: Math.round(g),
        unit: 'g',
        originalWeight: weight,
        originalUnit: unit
      };
    }
    // Otherwise keep as-is
    return {
      weight,
      unit,
      originalWeight: weight,
      originalUnit: unit
    };
  };

  const getUnitIcon = (unit) => {
    switch(unit) {
      case 'ml': return '🥤';
      case 'g': return '⚖️';
      case 'oz': return '🥛';
      default: return '📏';
    }
  };

  const getTimingIcon = (timing) => {
    if (timing.includes('breakfast')) return '🌅';
    if (timing.includes('lunch')) return '☀️';
    if (timing.includes('dinner')) return '🌙';
    if (timing.includes('snack')) return '🍎';
    if (timing.includes('post') || timing.includes('activity')) return '💪';
    return '🕐';
  };

  return (
    <div className="serving-suggestions">
      <h4>📏 Long COVID Serving Recommendations</h4>
      
      {/* Long COVID Servings - Primary */}
      {longCovidServings.length > 0 && (
        <div className="serving-category long-covid-servings">
          <div className="serving-note info">
            <small>💡 These servings are specifically optimized for Long COVID recovery based on digestive tolerance and nutritional needs</small>
            <small>⚖️ All nutritional values are calculated per 100g/ml and automatically scaled to your selected serving</small>
          </div>
          
          <div className="serving-buttons long-covid">
            {longCovidServings.map((serving, index) => {
              const parsed = parseServingAmount(serving.amount);
              const displayed = convertServingForDisplay(parsed.weight, parsed.unit);
              const selected = isSelected(displayed.weight, displayed.unit);
              
              return (
                <button
                  key={`longcovid-${index}`}
                  className={`serving-button long-covid ${selected ? 'selected' : ''}`}
                  onClick={() => handleServingClick(displayed.weight, serving.name, displayed.unit)}
                  title={serving.reason}
                  data-unit={displayed.unit}
                  data-selected={selected}
                >
                  <div className="serving-header">
                    <span className="serving-icon">{getUnitIcon(displayed.unit)}</span>
                    <span className="serving-weight">
                      {displayed.weight}{displayed.unit}
                    </span>
                    {displayed.unit !== displayed.originalUnit && (
                      <span className="serving-conversion">
                        ({displayed.originalWeight}{displayed.originalUnit})
                      </span>
                    )}
                  </div>
                  <div className="serving-details">
                    <span className="serving-name">{serving.name}</span>
                    <div className="serving-timing">
                      <span className="timing-icon">{getTimingIcon(serving.timing)}</span>
                      <span className="timing-text">{serving.timing}</span>
                    </div>
                    <p className="serving-reason">{serving.reason}</p>
                    <p className="serving-visualEquivalent">{serving.visualEquivalent}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Legacy serving options for backward compatibility */}
      {!longCovidServings.length && legacyServingOptions && Object.keys(legacyServingOptions).length > 0 && (
        <div className="serving-category standard-servings">
          <small className="category-label">Standard Servings</small>
          <div className="serving-buttons standard">
            {Object.entries(legacyServingOptions).map(([key, option]) => {
              const displayed = convertServingForDisplay(option.weight, option.unit);
              const selected = isSelected(displayed.weight, displayed.unit);
              
              return (
                <button
                  key={key}
                  className={`serving-button standard ${selected ? 'selected' : ''}`}
                  onClick={() => handleServingClick(displayed.weight, option.description, displayed.unit)}
                  title={option.description}
                  data-unit={displayed.unit}
                  data-selected={selected}
                >
                  <div className="serving-header">
                    <span className="serving-icon">{getUnitIcon(displayed.unit)}</span>
                    <span className="serving-weight">
                      {displayed.weight}{displayed.unit}
                    </span>
                    {displayed.unit !== displayed.originalUnit && (
                      <span className="serving-conversion">
                        ({displayed.originalWeight}{displayed.originalUnit})
                      </span>
                    )}
                  </div>
                  <div className="serving-details">
                    <span className="serving-name">{option.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// LongCovidFoodInfo component remains unchanged from original
const LongCovidFoodInfo = ({ foodName, mealData }) => {
  if (!mealData) {
    return (
      <div className="no-food-info">
        <p>Select a food to see its Long COVID nutrition information</p>
      </div>
    );
  }

  const benefits = mealData.longCovidBenefits || [];
  const cautions = mealData.longCovidCautions || [];
  const covidRelevance = mealData.longCovidRelevance || {};
  const properties = mealData.properties || {};
  const functionalCompounds = mealData.functionalCompounds || {};

  if (benefits.length > 0 || cautions.length > 0 || Object.keys(covidRelevance).length > 0) {
    const antiInflammatoryLevel = covidRelevance.antiInflammatory || 'unknown';
    
    const getRelevanceBadge = (level) => {
      switch(level) {
        case 'very-high':
        case 'high':
          return { text: 'High', class: 'high', icon: '🟢' };
        case 'moderate':
          return { text: 'Moderate', class: 'moderate', icon: '🟡' };
        case 'low':
          return { text: 'Low', class: 'low', icon: '🟠' };
        case 'very-low':
        case 'negative':
          return { text: 'Caution', class: 'negative', icon: '🔴' };
        default:
          return { text: 'Unknown', class: 'unknown', icon: 'ℹ️' };
      }
    };

    return (
      <div className="long-covid-food-info">
        <h4>{foodName}</h4>
        
        {/* Properties Tags */}
        {Object.keys(properties).length > 0 && (
          <div className="properties-section">
            <div className="property-tags">
              {properties.fodmap && (
                <span className={`property-tag fodmap ${properties.fodmap === 'low' ? 'low-fodmap' : 'high-fodmap'}`}>
                  {properties.fodmap === 'low' ? '✓ Low FODMAP' : '⚠️ High FODMAP'}
                </span>
              )}
              {properties.histamine === 'low' && (
                <span className="property-tag histamine-low">✓ Low Histamine</span>
              )}
              {properties.safeForMCAS && (
                <span className="property-tag mcas-safe">✓ MCAS Safe</span>
              )}
              {properties.dairyFree && (
                <span className="property-tag dairy-free">🌱 Dairy Free</span>
              )}
              {properties.glutenFree && (
                <span className="property-tag gluten-free">🌾 Gluten Free</span>
              )}
            </div>
          </div>
        )}
        
        {/* Key Long COVID Relevance Metrics */}
        <div className="covid-relevance-grid">
          <div className="relevance-item">
            <b>🔥 Anti-Inflammatory</b>
             <span className={`level-indicator level-${antiInflammatoryLevel}`}>
              <span className="level-value"> {getRelevanceBadge(antiInflammatoryLevel).text}</span>
            </span>
          </div>
          
          {covidRelevance.energyImpact && (
            <div className="relevance-item">
              <b>⚡ Energy Impact</b>
              <span className={`level-indicator level-${covidRelevance.energyImpact}`}>
                <span className="level-value"> {getRelevanceBadge(covidRelevance.energyImpact).text}</span>
              </span>
            </div>
          )}
          
          {covidRelevance.mitochondrialSupport && (
            <div className="relevance-item">
              <b>🔋 Mitochondrial Support</b>
              <span className={`level-indicator level-${covidRelevance.mitochondrialSupport}`}>
                <span className="level-value"> {getRelevanceBadge(covidRelevance.mitochondrialSupport).text}</span>
              </span>
            </div>
          )}
          
          {covidRelevance.immuneModulating && (
            <div className="relevance-item">
              <b>🛡️ Immune Support</b>
              <span className={`level-indicator level-${covidRelevance.immuneModulating}`}>
                <span className="level-value"> {getRelevanceBadge(covidRelevance.immuneModulating).text}</span>
              </span>
            </div>
          )}
        </div>

        {/* Functional Compounds */}
        {Object.keys(functionalCompounds).length > 0 && (
          <div className="functional-compounds">
            <b>🧬 Functional Compounds</b>
            <ul className="compounds-grid">
           
              {Object.entries(functionalCompounds).map(([compound, level]) => {
                const badge = getRelevanceBadge(level);
                return (
                  <li key={compound} className="compounds-item">
                    <span className="compound-name">{compound.replace(/_/g, ' ')}</span>
                    <span className={`compound-level level-${badge.class}`}> {badge.text}</span>
                  </li>
                );
              })}
            </ul>
            
          </div>
        )}
        
        {/* Benefits */}
        {benefits.length > 0 && (
          <div className="benefits-list">
            <b>✨ Benefits for Long COVID Recovery</b>
            <ul>
              {benefits.map((benefit, i) => (
                <li key={i}>{benefit}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Cautions */}
        {cautions.length > 0 && (
          <div className="cautions-list">
            <b>⚠️ Important Considerations</b>
            <ul>
              {cautions.map((caution, i) => (
                <li key={i}>{caution}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Data Source Note */}
        {mealData.fndds_metadata && (
          <div className="data-source">
            
             <div><small> 📊 Source: {mealData.fndds_metadata.source} </small></div>
             <div><small>Category: {mealData.fndds_metadata.wweia_category}</small></div>
            
            {mealData.ai_metadata_assessment && (
              <small className="ai-assessment">
                🤖 AI Assessment: {mealData.ai_metadata_assessment.overall} confidence
              </small>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="no-food-info">
      <div className="no-data-icon">📊</div>
      <h4>No Long COVID Data Available</h4>
      <p>This food doesn't have specific Long COVID information in our database yet.</p>
      <p>Consider general anti-inflammatory principles:</p>
      <ul className="general-tips">
        <li>Choose whole, unprocessed versions when possible</li>
        <li>Pay attention to how it affects your symptoms</li>
        <li>Consider portion sizes and frequency</li>
        <li>Pair with known anti-inflammatory foods</li>
      </ul>
    </div>
  );
};

// Long COVID Side Panel Component - unchanged
const LongCovidSidePanel = ({ selectedFood, selectedMeal, foodLog = [], isSearching = false, searchTerm = '' }) => {
  if (selectedFood && selectedMeal) {
    return (
      <div className="long-covid-side-panel">
        <h3>🦠 Long COVID Nutrition Guide</h3>
        <div className="selected-food-analysis">
          <LongCovidFoodInfo foodName={selectedFood} mealData={selectedMeal} />
          
          <div className="back-to-guide">
            <p className="guide-hint">
              <em>Clear selection to see the full nutrition guide</em>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSearching && searchTerm.length >= 2) {
    return (
      <div className="long-covid-side-panel">
        <h3>🦠 Long COVID Nutrition Guide</h3>
        
        <div className="search-status">
          <p className="search-hint">
            <em>Searching for "{searchTerm}"... Select a food above to see its specific analysis.</em>
          </p>
        </div>
        
  
      </div>
    );
  }

  return (
    <div className="long-covid-side-panel">
      <h3>🦠 Long COVID Nutrition Guide</h3>
      <div className="guide-empty-state">
        <div className="guide-empty-icon">🔍</div>
        <p>Search for a food above to see its Long COVID analysis.</p>
        <p>Each food record includes:</p>
        <ul>
          <li>✅ / ⚠️ MCAS &amp; histamine rating</li>
          <li>🔥 Anti-inflammatory level</li>
          <li>⚡ Energy &amp; mitochondrial impact</li>
          <li>🧬 Functional compounds</li>
          <li>📋 Long COVID–specific cautions</li>
        </ul>
      </div>
    </div>
  );
};

// Main AddFoodTab Component - UPDATED with unit system support
const AddFoodTab = ({
  // Search props
  search,
  setSearch,
  suggestions,
  selectedMeal,
  fields,
  mealType,
  setMealType,
  time,
  date,
  setDate,
  
  // Rendering functions
  renderSearchInput,
  
  // Edit mode
  editingEntry,
  handleCancelEdit,
  
  // Form handlers
  handleFieldChange,
  handleServingSelection,
  handleTimeChange,
  handleUnitChange, // NEW
  convertTo24Hour,
  handleLogFood,
  
  // Status and messages
  loading,
  success,
  error,
  
  // Constants
  mealTypes,
  pyodideStatus,
  
  // Other props
  foodLog,
  MicronutrientRadarChart,
  userProfile // NEW - to get unit preference
}) => {
  // Determine user's preferred unit system
  const userUnitSystem = userProfile?.unitSystem || 'metric';
  const servingUnit = fields.servingUnit || (userUnitSystem === 'imperial' ? 'oz' : 'g');
  
  return (
    <div className="food-form-section">
      <div className="food-form-left">
        {/* Edit Mode Indicator */}
        {editingEntry && (
          <div className="edit-mode-banner">
            <div className="edit-indicator">
              <span className="edit-icon">✏️</span>
              <span className="edit-text">
                <strong>Editing:</strong> {editingEntry.name}
              </span>
            </div>
            <button 
              className="cancel-edit-btn"
              onClick={handleCancelEdit}
              type="button"
            >
              Cancel Edit
            </button>
          </div>
        )}

        {/* Long COVID Info Banner */}
        <div className="long-covid-info-banner">
          <span className="banner-icon">🩺</span>
          <span className="banner-text">All recommendations are tailored for Long COVID recovery based on your profile.</span>
        </div>

        {renderSearchInput()}

        {/* Nutrition fields with serving suggestions */}
        {selectedMeal && (
          <>
            <ServingSuggestions 
              selectedMeal={selectedMeal}
              onServingSelect={handleServingSelection}
              currentServing={fields.serving}
              currentUnit={servingUnit}
              userUnitSystem={userUnitSystem}
            />
            
            {/* Note about per 100g calculation */}
            <div className="nutrition-calculation-note">
              <small>
                📊 <strong>Note:</strong> All values below are automatically calculated from the per 100g/ml base data and scaled to your selected serving size.
              </small>
            </div>
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <input 
              name="protein" 
              value={fields.protein || ''} 
              onChange={handleFieldChange} 
              type="number"
              step="0.1"
              placeholder=" "
              readOnly={selectedMeal}
            />
            <label>Protein (g)</label>
          </div>
          <div className="form-group">
            <input 
              name="carbs" 
              value={fields.carbs || ''} 
              onChange={handleFieldChange} 
              type="number"
              step="0.1"
              placeholder=" "
              readOnly={selectedMeal}
            />
            <label>Carbs (g)</label>
          </div>
          <div className="form-group">
            <input 
              name="fat" 
              value={fields.fat || ''} 
              onChange={handleFieldChange} 
              type="number"
              step="0.1"
              placeholder=" "
              readOnly={selectedMeal}
            />
            <label>Fat (g)</label>
          </div>
          
          {/* UPDATED: Serving input with unit selector */}
          <div className="form-group serving-with-unit">
            <div className="serving-input-group">
              <input 
                name="serving" 
                value={fields.serving || ''} 
                onChange={handleFieldChange}
                type="number"
                step={servingUnit === 'oz' ? '0.1' : '1'}
                className="serving-input"
                placeholder=" "
              />
              <select
                name="servingUnit"
                value={servingUnit}
                onChange={handleUnitChange}
                className="unit-selector"
              >
                <option value="g">g</option>
                <option value="oz">oz</option>
              </select>
            </div>
            <label>Serving</label>
          </div>
        </div>

        {/* Meal details */}
        <div className="form-row">
          <div className="form-group meal-type-group">
            <label htmlFor="meal-type">Meal Type</label>
            <select 
              id="meal-type" 
              value={mealType} 
              onChange={e => setMealType(e.target.value)}
            >
              {mealTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <input 
              type="time" 
              value={convertTo24Hour(time)} 
              onChange={handleTimeChange}
              placeholder=" "
            />
            <label>Time</label>
          </div>
          <div className="form-group">
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              placeholder=" "
            />
            <label>Date</label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <input 
              name="calories" 
              value={fields.calories || ''} 
              onChange={handleFieldChange}
              type="number"
              step="1"
              placeholder=" "
              readOnly={selectedMeal}
            />
            <label>Calories</label>
          </div>
        </div>

        {/* Micronutrient radar chart */}
        {selectedMeal && fields.micronutrients && (
          <div className="micronutrient-display">
            <MicronutrientRadarChart 
              micronutrients={fields.micronutrients}
              selectedMeal={selectedMeal}
            />
          </div>
        )}

        {/* Submit button */}
        <button 
          onClick={handleLogFood} 
          disabled={loading}
          className="log-food-button"
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              {editingEntry ? 'Updating Entry...' : 'Logging Food...'}
            </>
          ) : (
            <>
              {editingEntry ? '✅ Update Entry' : '✅ Log Food'}
            </>
          )}
        </button>

        {/* Status messages */}
        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}
        
        {/* Pyodide status */}
        {pyodideStatus && (
          <div className="pyodide-status">
            {pyodideStatus}
          </div>
        )}
      </div>

      {/* Long COVID side panel */}
      <div className="long-covid-panel-container">
        <LongCovidSidePanel
          selectedFood={search}
          selectedMeal={selectedMeal}
          foodLog={foodLog}
          isSearching={search.length >= 2}
          searchTerm={search}
        />
      </div>
      
      <style jsx>{`
        /* Long COVID info banner */
        .long-covid-info-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
          border: 1px solid rgba(102, 126, 234, 0.2);
          border-radius: 10px;
          font-size: 14px;
          color: #4a5568;
          margin-bottom: 16px;
          line-height: 1.4;
        }
        
        .long-covid-info-banner .banner-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .long-covid-info-banner .banner-text {
          flex: 1;
        }
        
        /* Serving with unit styles */
        .serving-with-unit {
          position: relative;
          min-width: 160px;
          flex: 1;
        }
        
        .serving-input-group {
          display: flex;
          gap: 0.25rem;
          align-items: stretch;
          width: 100%;
        }
        
        .serving-input {
          flex: 1;
          min-width: 0;
          padding: 0.75rem 1rem;
          border: 2px solid var(--gray-300, #d1d5db);
          border-radius: var(--border-radius-lg, 12px);
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }
        
        .serving-input:focus {
          outline: none;
          border-color: var(--primary-color, #3b82f6);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        
        .serving-input:hover {
          border-color: var(--gray-400, #9ca3af);
        }
        
        .unit-selector {
          width: 60px;
          padding: 0.75rem 0.5rem;
          border: 2px solid var(--gray-300);
          border-radius: var(--border-radius-lg);
          font-size: 0.875rem;
          background: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          transition: var(--transition);
        }
        
        .unit-selector:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        
        .unit-selector:hover {
          border-color: var(--primary-color);
        }
        
        /* Serving conversion hint */
        .serving-conversion {
          font-size: 0.75rem;
          color: var(--gray-500);
          margin-left: 0.25rem;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .serving-input-group {
            flex-direction: row;
          }
          
          .unit-selector {
            width: 55px;
          }
          
          .serving-input {
            min-width: 80px;
          }
        }
        
        @media (max-width: 1024px) {
          .serving-with-unit {
            min-width: 140px;
          }
        }

        /* ── MCAS / POTS additions in LC Nutrition Guide ── */
        .mcas-notice {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-left: 4px solid #f97316;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #431407;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .mcas-flag {
          font-size: 11.5px;
          font-weight: 600;
          color: #b45309;
          background: #fef3c7;
          border-radius: 4px;
          padding: 1px 5px;
          margin-left: 4px;
          white-space: nowrap;
        }
        .pots-section h4 { color: #0f766e; }
        .pots-section { border-left-color: #14b8a6 !important; }
        .mcas-caution-section h4 { color: #b45309; }
        .mcas-caution-section { border-left-color: #f97316 !important; background: #fffbeb; }
        .mcas-caution-section ul li { margin-bottom: 6px; font-size: 13px; }

        /* Empty state when no food selected */
        .guide-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px 16px;
          color: #6b7280;
        }
        .guide-empty-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }
        .guide-empty-state p {
          margin: 0 0 8px 0;
          font-size: 14px;
          line-height: 1.5;
        }
        .guide-empty-state ul {
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
          text-align: left;
        }
        .guide-empty-state ul li {
          font-size: 13px;
          padding: 3px 0;
          color: #4b5563;
        }
      `}</style>
    </div>
  );
};

export default AddFoodTab;
export { ServingSuggestions, LongCovidFoodInfo, LongCovidSidePanel, convertWeight, GRAMS_PER_OUNCE };