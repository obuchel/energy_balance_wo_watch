import React, { useState } from 'react';
import FoodEntryCard from './FoodEntryCard';
import { Trash2, Save, Calendar, Info, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';

const MealEntryInterface = ({ foodDatabase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [mealItems, setMealItems] = useState([]);
  const [mealName, setMealName] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [showLegend, setShowLegend] = useState(true);
  const [hoveredIndicator, setHoveredIndicator] = useState(null);

  // Visual Equivalent Display Component
  const VisualEquivalentDisplay = ({ equivalent, size = 'normal' }) => {
    if (!equivalent) return null;

    const sizeClasses = size === 'large' 
      ? 'p-4 text-base' 
      : 'p-2 text-xs';

    return (
      <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 ${sizeClasses}`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📏</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
              <span>Visual Serving Guide</span>
            </div>
            <div className="text-blue-800 leading-relaxed">{equivalent}</div>
          </div>
        </div>
      </div>
    );
  };

  // Common visual equivalents reference
  const commonVisualEquivalents = {
    'deck of cards': '100g of meat/fish = size of a deck of cards',
    'tennis ball': '1 medium fruit = size of a tennis ball',
    'baseball': '1 cup = size of a baseball',
    'fist': '1 cup cooked pasta/rice = size of your fist',
    'palm': 'Palm-sized portion = about 85-100g protein',
    'thumb': '1 tablespoon = size of your thumb tip',
    'golf ball': '2 tablespoons = size of a golf ball'
  };

  // Filter foods based on search
  const filteredFoods = foodDatabase.filter(food =>
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToMeal = (foodData) => {
    const { scaleFactor, servingWeight, selectedServing } = foodData;
    
    // Calculate all scaled nutrients
    const scaledNutrients = {};
    Object.entries(foodData.nutrients.per100g).forEach(([key, nutrient]) => {
      if (nutrient && typeof nutrient.value === 'number') {
        scaledNutrients[key] = {
          value: nutrient.value * scaleFactor,
          unit: nutrient.unit
        };
      }
    });

    const mealItem = {
      id: Date.now(),
      name: foodData.name,
      servingName: selectedServing.name,
      servingAmount: selectedServing.amount,
      servingWeight: servingWeight,
      nutrients: scaledNutrients,
      properties: foodData.properties,
      longCovidBenefits: foodData.longCovidBenefits || [],
      longCovidCautions: foodData.longCovidCautions || [],
      visualEquivalent: foodData.visualEquivalent || selectedServing.visualEquivalent || null,
      timestamp: new Date().toISOString()
    };

    setMealItems([...mealItems, mealItem]);
    setSelectedFood(null);
  };

  const removeItem = (id) => {
    setMealItems(mealItems.filter(item => item.id !== id));
  };

  // Calculate meal totals
  const calculateTotals = () => {
    const totals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    };

    mealItems.forEach(item => {
      totals.calories += item.nutrients.calories?.value || 0;
      totals.protein += item.nutrients.protein?.value || 0;
      totals.carbs += item.nutrients.carbs?.value || 0;
      totals.fat += item.nutrients.fat?.value || 0;
      totals.fiber += item.nutrients.fiber?.value || 0;
    });

    return totals;
  };

  const saveMeal = () => {
    const meal = {
      name: mealName || 'Unnamed Meal',
      time: mealTime || new Date().toISOString(),
      items: mealItems,
      totals: calculateTotals(),
      created: new Date().toISOString()
    };

    console.log('Saving meal:', meal);
    // Here you would save to your database/backend
    alert(`Meal "${meal.name}" saved successfully!`);
  };

  const totals = calculateTotals();

  // Property badge component with tooltip
  const PropertyBadge = ({ type, label, explanation, color }) => {
    return (
      <div 
        className="relative inline-block"
        onMouseEnter={() => setHoveredIndicator(type)}
        onMouseLeave={() => setHoveredIndicator(null)}
      >
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${color} cursor-help transition-all hover:scale-105`}>
          {label}
        </span>
        {hoveredIndicator === type && (
          <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
            <div className="font-semibold mb-1">{label}</div>
            <div>{explanation}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get property badges for a food
  const getFoodBadges = (food) => {
    const badges = [];
    
    if (food.properties?.fodmap === 'high') {
      badges.push(
        <PropertyBadge
          key="fodmap"
          type="fodmap-high"
          label="High FODMAP"
          explanation="High in fermentable carbohydrates that may cause digestive discomfort in sensitive individuals. Consider limiting if you have IBS or digestive issues."
          color="bg-orange-100 text-orange-700 border border-orange-200"
        />
      );
    } else if (food.properties?.fodmap === 'low') {
      badges.push(
        <PropertyBadge
          key="fodmap"
          type="fodmap-low"
          label="Low FODMAP"
          explanation="Low in fermentable carbohydrates - generally well-tolerated by those with digestive sensitivities."
          color="bg-green-100 text-green-700 border border-green-200"
        />
      );
    }

    if (food.properties?.safeForMCAS) {
      badges.push(
        <PropertyBadge
          key="mcas"
          type="mcas-safe"
          label="MCAS Safe"
          explanation="Low histamine and generally safe for Mast Cell Activation Syndrome. Less likely to trigger mast cell reactions."
          color="bg-blue-100 text-blue-700 border border-blue-200"
        />
      );
    }

    if (food.properties?.histamine === 'high') {
      badges.push(
        <PropertyBadge
          key="histamine"
          type="histamine-high"
          label="High Histamine"
          explanation="Contains high levels of histamine or triggers histamine release. May cause reactions in those with histamine intolerance."
          color="bg-red-100 text-red-700 border border-red-200"
        />
      );
    }

    if (food.properties?.antiInflammatory) {
      badges.push(
        <PropertyBadge
          key="antiinflam"
          type="anti-inflammatory"
          label="Anti-Inflammatory"
          explanation="Contains compounds that help reduce inflammation in the body. Beneficial for Long COVID recovery."
          color="bg-purple-100 text-purple-700 border border-purple-200"
        />
      );
    }

    return badges;
  };

  // Get Long COVID indicator with explanation
  const getLongCovidIndicator = (food) => {
    if (!food.longCovidBenefits || food.longCovidBenefits.length === 0) {
      if (food.longCovidCautions && food.longCovidCautions.length > 0) {
        return (
          <div 
            className="relative inline-block"
            onMouseEnter={() => setHoveredIndicator('lc-caution')}
            onMouseLeave={() => setHoveredIndicator(null)}
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-md cursor-help">
              <AlertCircle size={14} className="text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">Use Caution</span>
            </div>
            {hoveredIndicator === 'lc-caution' && (
              <div className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                <div className="font-semibold mb-1">Long COVID Caution</div>
                <ul className="list-disc list-inside space-y-1">
                  {food.longCovidCautions.map((caution, idx) => (
                    <li key={idx}>{caution}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
      return null;
    }

    return (
      <div 
        className="relative inline-block"
        onMouseEnter={() => setHoveredIndicator('lc-benefit')}
        onMouseLeave={() => setHoveredIndicator(null)}
      >
        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md cursor-help">
          <CheckCircle size={14} className="text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">Long COVID Friendly</span>
        </div>
        {hoveredIndicator === 'lc-benefit' && (
          <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
            <div className="font-semibold mb-2">Long COVID Benefits:</div>
            <ul className="list-disc list-inside space-y-1">
              {food.longCovidBenefits.slice(0, 3).map((benefit, idx) => (
                <li key={idx}>{benefit}</li>
              ))}
            </ul>
            {food.longCovidCautions && food.longCovidCautions.length > 0 && (
              <>
                <div className="font-semibold mt-2 mb-1 text-yellow-300">Cautions:</div>
                <ul className="list-disc list-inside space-y-1 text-yellow-100">
                  {food.longCovidCautions.map((caution, idx) => (
                    <li key={idx}>{caution}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with title and legend toggle */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            🍽️ Long COVID Meal Planner
          </h1>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <HelpCircle size={18} />
            <span className="font-medium">{showLegend ? 'Hide' : 'Show'} Legend</span>
          </button>
        </div>

        {/* Legend Panel */}
        {showLegend && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-500">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Info size={20} className="text-blue-600" />
              Understanding Food Indicators
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Digestive Health */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
                  Digestive Health
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium whitespace-nowrap">
                      High FODMAP
                    </span>
                    <p className="text-sm text-gray-600">
                      May cause bloating/gas in sensitive individuals
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium whitespace-nowrap">
                      Low FODMAP
                    </span>
                    <p className="text-sm text-gray-600">
                      Well-tolerated by most digestive systems
                    </p>
                  </div>
                </div>
              </div>

              {/* Histamine & Inflammation */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
                  Histamine & Inflammation
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium whitespace-nowrap">
                      MCAS Safe
                    </span>
                    <p className="text-sm text-gray-600">
                      Low histamine, safe for mast cell issues
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-medium whitespace-nowrap">
                      Anti-Inflammatory
                    </span>
                    <p className="text-sm text-gray-600">
                      Helps reduce inflammation in the body
                    </p>
                  </div>
                </div>
              </div>

              {/* Long COVID Indicators */}
              <div className="md:col-span-2 border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
                  Long COVID Indicators
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md whitespace-nowrap">
                      <CheckCircle size={14} className="text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Long COVID Friendly</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Contains nutrients beneficial for recovery
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-md whitespace-nowrap">
                      <AlertCircle size={14} className="text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700">Use Caution</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      May trigger symptoms in some Long COVID cases
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Serving Guides */}
              <div className="md:col-span-2 border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
                  📏 Visual Serving Guides
                </h3>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-3">
                  <p className="text-sm text-gray-700 mb-3">
                    Use these everyday objects to estimate portion sizes without a scale:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">🎴</span>
                      <div>
                        <span className="font-semibold text-gray-800">Deck of Cards</span>
                        <p className="text-xs text-gray-600">= 100g meat/fish/poultry</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">🤛</span>
                      <div>
                        <span className="font-semibold text-gray-800">Your Fist</span>
                        <p className="text-xs text-gray-600">= 1 cup pasta/rice/vegetables</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">🖐️</span>
                      <div>
                        <span className="font-semibold text-gray-800">Your Palm</span>
                        <p className="text-xs text-gray-600">= 85-100g protein portion</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">⚾</span>
                      <div>
                        <span className="font-semibold text-gray-800">Baseball</span>
                        <p className="text-xs text-gray-600">= 1 cup or medium fruit</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">👍</span>
                      <div>
                        <span className="font-semibold text-gray-800">Your Thumb</span>
                        <p className="text-xs text-gray-600">= 1 tablespoon (fats/oils)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-lg">🎾</span>
                      <div>
                        <span className="font-semibold text-gray-800">Tennis Ball</span>
                        <p className="text-xs text-gray-600">= Medium fruit/½ cup</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">💡 Pro Tip:</span> Hover over any badge for detailed explanations. 
                Foods with multiple badges offer different health considerations.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Food Search & Selection */}
          <div className="lg:col-span-2">
            {!selectedFood ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Search Foods</h2>
                  <div className="text-sm text-gray-500">
                    {filteredFoods.length} {filteredFoods.length === 1 ? 'food' : 'foods'} found
                  </div>
                </div>
                
                <input
                  type="text"
                  placeholder="Search for foods... (e.g., 'chicken', 'broccoli', 'rice')"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:border-blue-500 focus:outline-none transition-colors"
                />

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredFoods.length === 0 && searchTerm && (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg mb-2">No foods found</p>
                      <p className="text-sm">Try a different search term</p>
                    </div>
                  )}
                  
                  {filteredFoods.map((food, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedFood(food)}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                            {food.name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{food.category}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-gray-800 text-lg">
                            {food.nutrients.per100g.calories.value} kcal
                          </div>
                          <div className="text-xs text-gray-500">per 100g</div>
                        </div>
                      </div>
                      
                      {/* Macro preview */}
                      <div className="flex gap-4 text-xs text-gray-600 mb-3 pb-3 border-b border-gray-100">
                        <span>P: {food.nutrients.per100g.protein?.value || 0}g</span>
                        <span>C: {food.nutrients.per100g.carbs?.value || 0}g</span>
                        <span>F: {food.nutrients.per100g.fat?.value || 0}g</span>
                        {food.nutrients.per100g.fiber && (
                          <span>Fiber: {food.nutrients.per100g.fiber.value}g</span>
                        )}
                      </div>

                      {/* Visual Equivalent */}
                      {food.visualEquivalent && (
                        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-lg">📏</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Visual Portion Guide:</div>
                              <div className="text-sm text-blue-800 leading-relaxed">{food.visualEquivalent}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Serving Options with Visual Equivalents */}
                      {food.servings && food.servings.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recommended Servings:</h3>
                          <div className="space-y-2">
                            {food.servings.map((serving, idx) => (
                              <div 
                                key={idx}
                                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                              >
                                <div className="font-medium text-gray-800 mb-1">{serving.name}</div>
                                <div className="text-sm text-gray-600 mb-2">{serving.amount}</div>
                                
                                {/* Visual Equivalent for this serving */}
                                {serving.visualEquivalent && (
                                  <div className="mb-2 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                                    <div className="flex items-start gap-2">
                                      <span className="text-base mt-0.5">📏</span>
                                      <div className="flex-1">
                                        <div className="text-xs font-medium text-blue-900">Visual Guide:</div>
                                        <div className="text-xs text-blue-700 mt-0.5">{serving.visualEquivalent}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Reason for this serving */}
                                {serving.reason && (
                                  <div className="text-xs text-gray-600 italic mb-2">
                                    <span className="font-medium">Why:</span> {serving.reason}
                                  </div>
                                )}
                                  {/* Reason for this serving */}
                                  {serving.visualEquivalent && (
                                  <div className="text-xs text-gray-600 italic mb-2">
                                    <span className="font-medium">Size:</span> {serving.visualEquivalent}
                                  </div>
                                )}
                                {/* Timing suggestion */}
                                {serving.timing && (
                                  <div className="text-xs text-purple-700 flex items-center gap-1">
                                    <span>⏰</span>
                                    <span className="font-medium">Best timing:</span> {serving.timing}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Property indicators */}
                      <div className="flex flex-wrap gap-2">
                        {getFoodBadges(food)}
                        {getLongCovidIndicator(food)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelectedFood(null)}
                  className="mb-4 text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 transition-colors"
                >
                  ← Back to Search
                </button>
                <FoodEntryCard
                  foodData={selectedFood}
                  onAddToMeal={handleAddToMeal}
                />
              </div>
            )}
          </div>

          {/* Right Column - Current Meal */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>Current Meal</span>
                {mealItems.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">
                    ({mealItems.length} {mealItems.length === 1 ? 'item' : 'items'})
                  </span>
                )}
              </h2>

              {/* Meal Details */}
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Breakfast, Lunch, Snack"
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-gray-500" />
                    <input
                      type="datetime-local"
                      value={mealTime}
                      onChange={(e) => setMealTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Meal Items */}
              {mealItems.length === 0 ? (
                <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-4xl mb-3">🍽️</div>
                  <p className="font-medium">No items added yet</p>
                  <p className="text-sm mt-2">Search and add foods to build your meal</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-2">
                    {mealItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {item.servingAmount}
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-semibold">{item.nutrients.calories?.value.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Protein:</span>
                            <span className="font-semibold">{item.nutrients.protein?.value.toFixed(1)}g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Carbs:</span>
                            <span className="font-semibold">{item.nutrients.carbs?.value.toFixed(1)}g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fat:</span>
                            <span className="font-semibold">{item.nutrients.fat?.value.toFixed(1)}g</span>
                          </div>
                        </div>

                        {/* Long COVID info for meal item */}
                        {item.longCovidBenefits && item.longCovidBenefits.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle size={12} />
                              <span>Benefits for Long COVID</span>
                            </div>
                          </div>
                        )}

                        {/* Visual Equivalent in meal item */}
                        {item.visualEquivalent && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border-l-4 border-blue-400">
                              <div className="flex items-start gap-2">
                                <span className="text-base mt-0.5">📏</span>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-blue-900">Portion Size:</div>
                                  <div className="text-xs text-blue-700 mt-0.5 leading-relaxed">{item.visualEquivalent}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Meal Totals */}
                  <div className="border-t-2 border-gray-300 pt-4 mb-4">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span>Meal Totals</span>
                      <span className="text-xs text-gray-500 font-normal">(all items combined)</span>
                    </h3>
                    <div className="space-y-2 bg-gradient-to-br from-blue-50 to-green-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <span className="text-gray-700 font-medium">Calories</span>
                        <span className="font-bold text-xl text-gray-900">{totals.calories.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Protein</span>
                        <span className="font-semibold text-gray-800">{totals.protein.toFixed(1)}g</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Carbohydrates</span>
                        <span className="font-semibold text-gray-800">{totals.carbs.toFixed(1)}g</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Fat</span>
                        <span className="font-semibold text-gray-800">{totals.fat.toFixed(1)}g</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Fiber</span>
                        <span className="font-semibold text-gray-800">{totals.fiber.toFixed(1)}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveMeal}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <Save size={20} />
                    Save Meal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealEntryInterface;
