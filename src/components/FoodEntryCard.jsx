import React, { useState } from 'react';
import { Plus, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const FoodEntryCard = ({ foodData, onAddToMeal }) => {
  const [selectedServing, setSelectedServing] = useState(foodData.longCovidServings?.[1] || foodData.longCovidServings?.[0]);
  const [showDetails, setShowDetails] = useState(false);
  const [showNutrients, setShowNutrients] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  // Calculate scaling factor based on selected serving
  const getServingWeight = (servingAmount) => {
    // Parse amount string like "240ml (8 fl oz)" or "120g"
    const match = servingAmount.match(/(\d+)(ml|g)/i);
    return match ? parseFloat(match[1]) : 100;
  };

  const scaleFactor = selectedServing ? getServingWeight(selectedServing.amount) / 100 : 1;

  const scaleNutrient = (nutrient) => {
    if (!nutrient || typeof nutrient.value !== 'number') return null;
    return {
      ...nutrient,
      value: (nutrient.value * scaleFactor).toFixed(2)
    };
  };

  // Get relevance color
  const getRelevanceColor = (level) => {
    const colors = {
      'very_high': 'text-green-700 bg-green-50',
      'high': 'text-green-600 bg-green-50',
      'moderate': 'text-yellow-600 bg-yellow-50',
      'low': 'text-gray-500 bg-gray-50',
      'very_low': 'text-gray-400 bg-gray-50',
      'negative': 'text-red-600 bg-red-50'
    };
    return colors[level] || 'text-gray-500 bg-gray-50';
  };

  // Get compound level badge
  const getCompoundBadge = (level) => {
    const badges = {
      'very_high': { text: 'Very High', color: 'bg-green-600' },
      'high': { text: 'High', color: 'bg-green-500' },
      'moderate': { text: 'Moderate', color: 'bg-yellow-500' },
      'low': { text: 'Low', color: 'bg-gray-400' },
      'very_low': { text: 'Very Low', color: 'bg-gray-300' }
    };
    return badges[level] || { text: level, color: 'bg-gray-300' };
  };

  const handleAddToMeal = () => {
    const weight = customAmount || getServingWeight(selectedServing.amount);
    onAddToMeal({
      ...foodData,
      selectedServing: selectedServing,
      servingWeight: weight,
      scaleFactor: weight / 100
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{foodData.name}</h2>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded">
              {foodData.category}
            </span>
            {foodData.properties?.fodmap === 'high' && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded">
                High FODMAP
              </span>
            )}
            {foodData.properties?.safeForMCAS && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded">
                MCAS Safe
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-800">
            {scaleNutrient(foodData.nutrients.per100g.calories)?.value}
          </div>
          <div className="text-sm text-gray-500">kcal</div>
        </div>
      </div>

      {/* Serving Selection */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Serving Size:
        </label>
        <div className="space-y-2">
          {foodData.longCovidServings?.map((serving, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedServing(serving)}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedServing === serving
                  ? 'border-blue-500 bg-blue-100'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-800">{serving.name}</div>
                  <div className="text-lg text-blue-600">{serving.amount}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Best time:</span> {serving.timing}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 italic">{serving.reason}</div>
                </div>
                {selectedServing === serving && (
                  <CheckCircle className="text-blue-500" size={20} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="mt-3">
          <label className="text-sm text-gray-600 block mb-1">
            Or enter custom amount (g/ml):
          </label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="e.g., 150"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Macronutrients - Scaled */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Protein</div>
          <div className="text-xl font-bold text-gray-800">
            {scaleNutrient(foodData.nutrients.per100g.protein)?.value}g
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Carbs</div>
          <div className="text-xl font-bold text-gray-800">
            {scaleNutrient(foodData.nutrients.per100g.carbs)?.value}g
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Fat</div>
          <div className="text-xl font-bold text-gray-800">
            {scaleNutrient(foodData.nutrients.per100g.fat)?.value}g
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Fiber</div>
          <div className="text-xl font-bold text-gray-800">
            {scaleNutrient(foodData.nutrients.per100g.fiber)?.value}g
          </div>
        </div>
      </div>

      {/* Long COVID Benefits */}
      {foodData.longCovidBenefits && foodData.longCovidBenefits.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-800">Long COVID Benefits</h3>
          </div>
          <ul className="space-y-2">
            {foodData.longCovidBenefits.map((benefit, idx) => (
              <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-green-400">
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Long COVID Cautions */}
      {foodData.longCovidCautions && foodData.longCovidCautions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-orange-600" size={20} />
            <h3 className="font-semibold text-gray-800">Cautions</h3>
          </div>
          <ul className="space-y-2">
            {foodData.longCovidCautions.map((caution, idx) => (
              <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-orange-400">
                {caution}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Functional Compounds */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-blue-600 font-semibold mb-2 hover:text-blue-700"
      >
        {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        Functional Compounds & Long COVID Relevance
      </button>

      {showDetails && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          {/* Functional Compounds */}
          <h4 className="font-semibold text-gray-700 mb-2">Functional Compounds:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {Object.entries(foodData.functionalCompounds || {}).map(([compound, level]) => {
              const badge = getCompoundBadge(level);
              return (
                <div key={compound} className="text-sm">
                  <span className="text-gray-600 capitalize">
                    {compound.replace(/_/g, ' ')}:
                  </span>
                  <span className={`ml-1 px-2 py-0.5 rounded text-white ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Long COVID Relevance */}
          <h4 className="font-semibold text-gray-700 mb-2">Long COVID Relevance:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(foodData.longCovidRelevance || {}).map(([aspect, level]) => (
              <div key={aspect} className={`text-sm px-2 py-1 rounded ${getRelevanceColor(level)}`}>
                <span className="capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Nutrient Profile */}
      <button
        onClick={() => setShowNutrients(!showNutrients)}
        className="flex items-center gap-2 text-blue-600 font-semibold mb-2 hover:text-blue-700"
      >
        {showNutrients ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        Complete Nutrient Profile
      </button>

      {showNutrients && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-3 italic">
            All values calculated for selected serving size. Base data is per 100g/ml.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {Object.entries(foodData.nutrients.per100g).map(([nutrient, data]) => {
              if (typeof data !== 'object' || !data.value) return null;
              const scaled = scaleNutrient(data);
              return (
                <div key={nutrient} className="flex justify-between">
                  <span className="text-gray-600 capitalize">
                    {nutrient.replace(/_/g, ' ')}:
                  </span>
                  <span className="font-medium">
                    {scaled.value} {scaled.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata */}
      {foodData.fndds_metadata && (
        <div className="text-xs text-gray-500 mb-4">
          Source: {foodData.fndds_metadata.source} | 
          Category: {foodData.fndds_metadata.wweia_category} |
          Imported: {new Date(foodData.fndds_metadata.import_date).toLocaleDateString()}
        </div>
      )}

      {/* Add to Meal Button */}
      <button
        onClick={handleAddToMeal}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        <Plus size={20} />
        Add to Meal
      </button>
    </div>
  );
};

export default FoodEntryCard;
