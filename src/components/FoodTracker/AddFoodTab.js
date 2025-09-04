import React from 'react';

// ServingSuggestions component - WITHOUT common portions
const ServingSuggestions = ({ selectedMeal, onServingSelect, currentServing, currentUnit = 'g' }) => {
  if (!selectedMeal || !selectedMeal.nutritional_metrics) return null;

  const { serving_options } = selectedMeal.nutritional_metrics; // REMOVED: common_portions
  
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

  const getUnitIcon = (unit) => {
    switch(unit) {
      case 'ml': return '🥤';
      case 'g': return '⚖️';
      case 'oz': return '🥛';
      default: return '📏';
    }
  };

  return (
    <div className="serving-suggestions">
      <h4>📏 Serving Size Suggestions</h4>
      
      {serving_options && Object.keys(serving_options).length > 0 && (
        <div className="serving-category">
          <h5>Standard Serving Options</h5>
          <div className="serving-buttons">
            {Object.entries(serving_options).map(([key, option]) => {
              const selected = isSelected(option.weight, option.unit || 'g');
              
              return (
                <button
                  key={`standard-${key}-${option.weight}-${option.unit || 'g'}`}
                  className={`serving-button ${selected ? 'selected' : ''}`}
                  onClick={() => handleServingClick(option.weight, option.description, option.unit || 'g')}
                  title={option.description}
                  data-unit={option.unit || 'g'}
                  data-selected={selected}
                >
                  <span className="serving-icon">{getUnitIcon(option.unit || 'g')}</span>
                  <span className="serving-weight">
                    {option.weight}{option.unit || 'g'}
                  </span>
                  <span className="serving-description">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="serving-note">
        <small>💡 Click any suggestion to automatically set the serving size and update nutrition values</small>
        <small>⚡ Liquid measurements (ml) are converted to equivalent weights for accurate nutrition calculation</small>
        {currentServing && currentUnit && (
          <div className="current-selection">
            <small><strong>Current:</strong> {currentServing}{currentUnit}</small>
          </div>
        )}
      </div>
    </div>
  );
};

// Long COVID Food Information Component
const LongCovidFoodInfo = ({ foodName, mealData }) => {
  if (mealData && (mealData.longCovidRelevance || mealData.longCovidBenefits || mealData.longCovidCautions)) {
    const covidRelevance = mealData.longCovidRelevance || {};
    const benefits = mealData.longCovidBenefits || [];
    const cautions = mealData.longCovidCautions || [];
    const functionalCompounds = mealData.functionalCompounds || {};

    let category = 'neutral';
    if (benefits.length > cautions.length) category = 'beneficial';
    if (cautions.length > benefits.length) category = 'caution';

    const antiInflammatoryLevel = covidRelevance.antiInflammatory || 'unknown';

    return (
      <div className={`long-covid-food-info ${category}`}>
        <div className="food-info-header">
          <span className={`category-icon ${category}`}>
            {category === 'beneficial' ? '✅' : 
             category === 'caution' ? '⚠️' : 'ℹ️'}
          </span>
          <strong>Database Analysis: {foodName}</strong>
        </div>
        
        <div className="inflammatory-level">
          <h5>🔥 Anti-Inflammatory Level</h5>
          <div className={`level-indicator level-${antiInflammatoryLevel}`}>
            <span className="level-value"> {antiInflammatoryLevel.toUpperCase()}</span>
            <span className="level-description">
              {antiInflammatoryLevel === 'high' ? 'Excellent for reducing inflammation' :
               antiInflammatoryLevel === 'moderate' ? 'Moderately helpful for inflammation' :
               antiInflammatoryLevel === 'low' ? 'Limited anti-inflammatory effects' :
               antiInflammatoryLevel === 'neutral' ? 'No significant inflammatory impact' : 'Not assessed'}
            </span>
          </div>
        </div>

        {Object.keys(functionalCompounds).length > 0 && (
          <div className="functional-compounds">
            <h5>🧬 Functional Compounds</h5>
            <div className="compounds-grid">
              {Object.entries(functionalCompounds).map(([compound, level]) => (
                <div key={compound} className="compound-item">
                  <span className="compound-name">{compound.replace(/_/g, ' ')}</span>
                  <span className={`compound-level level-${level}`}> {level}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {benefits.length > 0 && (
          <div className="benefits-list">
            <h5>✨ Benefits for Long COVID Recovery</h5>
            <ul>
              {benefits.map((benefit, i) => (
                <li key={i}>{benefit}</li>
              ))}
            </ul>
          </div>
        )}
        
        {cautions.length > 0 && (
          <div className="cautions-list">
            <h5>⚠️ Important Considerations</h5>
            <ul>
              {cautions.map((caution, i) => (
                <li key={i}>{caution}</li>
              ))}
            </ul>
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

// Long COVID Side Panel Component
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
        
        <div className="nutrition-categories">
          <div className="category-section beneficial">
            <h4>✅ Quick Anti-Inflammatory Guide</h4>
            <p>Focus on omega-3 rich fish, berries, leafy greens, and anti-inflammatory spices.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="long-covid-side-panel">
      <h3>🦠 Long COVID Nutrition Guide</h3>

      <div className="nutrition-categories">
        <div className="category-section beneficial">
          <h4>✅ Anti-Inflammatory Foods</h4>
          <ul>
            <li><strong>Fatty Fish:</strong> Salmon, mackerel, sardines (omega-3s)</li>
            <li><strong>Berries:</strong> Blueberries, strawberries (antioxidants)</li>
            <li><strong>Leafy Greens:</strong> Spinach, kale (vitamins, minerals)</li>
            <li><strong>Nuts:</strong> Walnuts, almonds (healthy fats)</li>
            <li><strong>Turmeric:</strong> Contains curcumin (anti-inflammatory)</li>
            <li><strong>Ginger:</strong> Natural anti-inflammatory</li>
            <li><strong>Green Tea:</strong> Polyphenols reduce inflammation</li>
          </ul>
        </div>

        <div className="category-section neutral">
          <h4>ℹ️ Recommended Foods</h4>
          <ul>
            <li><strong>Whole Grains:</strong> Oats, quinoa, brown rice</li>
            <li><strong>Lean Proteins:</strong> Chicken, turkey, legumes</li>
            <li><strong>Citrus Fruits:</strong> High in vitamin C</li>
            <li><strong>Olive Oil:</strong> Monounsaturated fats</li>
            <li><strong>Garlic & Onions:</strong> Immune support</li>
          </ul>
        </div>

        <div className="category-section caution">
          <h4>⚠️ Foods to Limit</h4>
          <ul>
            <li><strong>Processed Foods:</strong> High in inflammation-promoting ingredients</li>
            <li><strong>Refined Sugars:</strong> Can worsen inflammation</li>
            <li><strong>Red/Processed Meat:</strong> May increase inflammatory markers</li>
            <li><strong>Trans Fats:</strong> Found in margarine, processed foods</li>
            <li><strong>Refined Carbs:</strong> White bread, pastries</li>
            <li><strong>Fried Foods:</strong> High in inflammatory compounds</li>
          </ul>
        </div>
      </div>

      <div className="additional-tips">
        <h4>💡 General Tips</h4>
        <ul>
          <li>Stay well hydrated (8+ glasses water daily)</li>
          <li>Consider vitamin D supplementation</li>
          <li>Eat regular, smaller meals to maintain energy</li>
          <li>Focus on nutrient-dense, whole foods</li>
          <li>Limit alcohol and caffeine if they worsen symptoms</li>
        </ul>
      </div>
    </div>
  );
};

// Main AddFoodTab component
const AddFoodTab = ({
  // Search and meal selection
  search,
  setSearch,
  suggestions,
  setSuggestions,
  selectedMeal,
  setSelectedMeal,
  searchFocused,
  setSearchFocused,
  renderSearchInput,
  handleSelectMeal,
  clearSearch,
  
  // Form fields and state
  fields,
  setFields,
  mealType,
  setMealType,
  time,
  setTime,
  date,
  setDate,
  longCovidAdjust,
  setLongCovidAdjust,
  
  // Edit mode
  editingEntry,
  handleCancelEdit,
  
  // Form handlers
  handleFieldChange,
  handleServingSelection,
  handleTimeChange,
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
  MicronutrientRadarChart
}) => {
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

        {/* Long COVID Checkbox */}
        <div className="form-group long-covid-checkbox-group">
          <label className="long-covid-checkbox-label">
            <input 
              type="checkbox" 
              checked={longCovidAdjust} 
              onChange={e => setLongCovidAdjust(e.target.checked)} 
              className="long-covid-checkbox"
            /> 
            <span className="checkbox-text">
              I have Long COVID - Show food recommendations and adjustments
            </span>
          </label>
          {longCovidAdjust && (
            <div className="long-covid-info-banner">
              <p>🔬 <strong>Long COVID Mode:</strong> Food recommendations will be adjusted to focus on anti-inflammatory options that may help manage symptoms and support recovery.</p>
            </div>
          )}
        </div>

        {renderSearchInput()}

        {/* Nutrition fields with serving suggestions */}
        {selectedMeal && (
          <ServingSuggestions 
            selectedMeal={selectedMeal}
            onServingSelect={handleServingSelection}
            currentServing={fields.serving}
            currentUnit={fields.servingUnit || 'g'}
          />
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
          <div className="form-group">
            <input 
              name="serving" 
              value={fields.serving || ''} 
              onChange={handleFieldChange}
              type="number"
              step="1"
              className="serving-input"
              placeholder=" "
            />
            <label>Serving (g)</label>
          </div>
        </div>

        {/* Meal details */}
        <div className="form-row">
          <div className="form-group">
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

        {/* Calories field */}
        <div className="form-group">
          <input 
            name="calories" 
            value={fields.calories || ''} 
            onChange={handleFieldChange} 
            type="number"
            step="1"
            placeholder=" "
          />
          <label>Calories</label>
        </div>

        <div className="form-group">
          <button 
            className={`submit-button ${editingEntry ? 'update-mode' : ''}`}
            onClick={handleLogFood}
            disabled={loading || !fields.name}
          >
            {loading ? 
              (editingEntry ? 'Updating...' : 'Logging...') : 
              (editingEntry ? 'Update Food' : 'Log Food')
            }
          </button>
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>

      <div className="food-form-right">
        {longCovidAdjust && (
          <LongCovidSidePanel 
            selectedFood={fields.name} 
            selectedMeal={selectedMeal}
            foodLog={foodLog}
            isSearching={search.length >= 2 && !selectedMeal}
            searchTerm={search}
          />
        )}

        {/* Micronutrient Radar Chart */}
        {selectedMeal && fields.micronutrients && Object.keys(fields.micronutrients).length > 0 && (
          <MicronutrientRadarChart 
            micronutrients={fields.micronutrients}
            selectedMeal={selectedMeal}
          />
        )}

        {!longCovidAdjust && (
          <div className="general-nutrition-info">
            <h3>📊 Nutrition Tips</h3>
            <p>Enable Long COVID mode above to get personalized food recommendations and anti-inflammatory guidance.</p>
            {pyodideStatus === 'ready' && (
              <div className="ai-tip">
                <p>💡 <strong>AI Tip:</strong> The search above uses machine learning to find the most relevant foods for your queries!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddFoodTab;