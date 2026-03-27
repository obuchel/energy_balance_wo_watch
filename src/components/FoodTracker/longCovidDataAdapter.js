/**
 * Long COVID Food Data Adapter
 * 
 * This file provides utilities to:
 * 1. Transform new comprehensive Long COVID data format to existing app format
 * 2. Scale nutrients from per100g to specific serving sizes
 * 3. Handle longCovidServings data
 */

/**
 * Parse serving amount string (e.g., "240ml (8 oz)" or "120g")
 * @param {string} amountString - The serving amount string
 * @returns {object} - { weight: number, unit: string }
 */
export const parseServingAmount = (amountString) => {
  if (!amountString) return { weight: 100, unit: 'g' };
  
  const match = amountString.match(/(\d+)(ml|g|oz)/i);
  if (match) {
    return {
      weight: parseFloat(match[1]),
      unit: match[2].toLowerCase()
    };
  }
  return { weight: 100, unit: 'g' };
};

/**
 * Scale a single nutrient value from per100g to specific serving
 * @param {object} nutrient - The nutrient object with value and unit
 * @param {number} servingWeight - The serving weight in grams/ml
 * @returns {object} - Scaled nutrient object
 */
export const scaleNutrient = (nutrient, servingWeight) => {
  if (!nutrient || typeof nutrient.value !== 'number') {
    return null;
  }
  
  const scaleFactor = servingWeight / 100;
  return {
    ...nutrient,
    value: nutrient.value * scaleFactor
  };
};

/**
 * Scale all nutrients from per100g to specific serving
 * @param {object} nutrientsPer100g - Object containing all nutrients per 100g
 * @param {number} servingWeight - The serving weight in grams/ml
 * @returns {object} - Scaled nutrients object
 */
export const scaleAllNutrients = (nutrientsPer100g, servingWeight) => {
  if (!nutrientsPer100g || typeof servingWeight !== 'number') {
    return {};
  }
  
  const scaleFactor = servingWeight / 100;
  const scaledNutrients = {};
  
  Object.entries(nutrientsPer100g).forEach(([key, nutrient]) => {
    if (nutrient && typeof nutrient.value === 'number') {
      scaledNutrients[key] = {
        ...nutrient,
        value: nutrient.value * scaleFactor
      };
    }
  });
  
  return scaledNutrients;
};

/**
 * Convert new Long COVID data format to legacy format for backward compatibility
 * @param {object} newFormatFood - Food in new comprehensive format
 * @returns {object} - Food in legacy format
 */
export const convertToLegacyFormat = (newFormatFood) => {
  if (!newFormatFood) return null;
  
  const nutrients = newFormatFood.nutrients?.per100g || {};
  
  // Create legacy nutritional_metrics structure
  const nutritional_metrics = {
    nutrients_per_100g: nutrients,
    serving_options: {}
  };
  
  // Convert longCovidServings to legacy serving_options if available
  if (newFormatFood.longCovidServings && newFormatFood.longCovidServings.length > 0) {
    newFormatFood.longCovidServings.forEach((serving, index) => {
      const { weight, unit } = parseServingAmount(serving.amount);
      nutritional_metrics.serving_options[`option_${index + 1}`] = {
        weight: weight,
        unit: unit,
        description: serving.name
      };
    });
  }
  
  return {
    ...newFormatFood,
    nutritional_metrics,
    // Preserve new format fields
    longCovidServings: newFormatFood.longCovidServings,
    longCovidBenefits: newFormatFood.longCovidBenefits,
    longCovidCautions: newFormatFood.longCovidCautions,
    longCovidRelevance: newFormatFood.longCovidRelevance,
    functionalCompounds: newFormatFood.functionalCompounds,
    properties: newFormatFood.properties
  };
};

/**
 * Extract macronutrients for a specific serving
 * @param {object} foodData - Food data in new format
 * @param {number} servingWeight - Serving weight in g/ml
 * @returns {object} - Scaled macronutrients
 */
export const getMacrosForServing = (foodData, servingWeight) => {
  const nutrients = foodData.nutrients?.per100g || {};
  const scaleFactor = servingWeight / 100;
  
  return {
    calories: (nutrients.calories?.value || 0) * scaleFactor,
    protein: (nutrients.protein?.value || 0) * scaleFactor,
    carbs: (nutrients.carbs?.value || 0) * scaleFactor,
    fat: (nutrients.fat?.value || 0) * scaleFactor,
    fiber: (nutrients.fiber?.value || 0) * scaleFactor,
    sugars: (nutrients.sugars?.value || 0) * scaleFactor
  };
};

/**
 * Extract key micronutrients for a specific serving
 * @param {object} foodData - Food data in new format
 * @param {number} servingWeight - Serving weight in g/ml
 * @returns {object} - Scaled micronutrients
 */
export const getMicronutrientsForServing = (foodData, servingWeight) => {
  const nutrients = foodData.nutrients?.per100g || {};
  const scaledNutrients = scaleAllNutrients(nutrients, servingWeight);

  //console.log(scaledNutrients);
  
  // Extract key micronutrients
  const micronutrients = {};
  const micronutrientKeys = [
    'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc',
    'copper', 'selenium', 'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e',
    'vitamin_k', 'thiamin', 'riboflavin', 'niacin', 'vitamin_b6', 'folate',
    'vitamin_b12', 'choline'
  ];
  
  micronutrientKeys.forEach(key => {
    if (scaledNutrients[key]) {
      micronutrients[key] = scaledNutrients[key];
    }
  });
  
  return micronutrients;
};

/**
 * Format nutrient value for display
 * @param {number} value - The nutrient value
 * @param {string} unit - The unit
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted string
 */
export const formatNutrientValue = (value, unit, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  
  const formatted = value < 1 && value > 0 ? value.toFixed(decimals + 1) : value.toFixed(decimals);
  return `${formatted} ${unit}`;
};

/**
 * Get all Long COVID servings with parsed weights
 * @param {object} foodData - Food data in new format
 * @returns {array} - Array of serving objects with parsed weights
 */
export const getParsedLongCovidServings = (foodData) => {
  const servings = foodData.longCovidServings || [];
  
  return servings.map((serving, index) => {
    const { weight, unit } = parseServingAmount(serving.amount);
    return {
      ...serving,
      parsedWeight: weight,
      parsedUnit: unit,
      index
    };
  });
};

/**
 * Calculate daily value percentage for micronutrient
 * @param {string} nutrientKey - The nutrient key
 * @param {number} value - The nutrient value
 * @param {string} unit - The unit
 * @returns {number|null} - Percentage of daily value, or null if DV not defined
 */
export const calculateDailyValuePercentage = (nutrientKey, value, unit) => {
  // Daily Values (DVs) for adults - simplified version
  const dailyValues = {
    // Vitamins
    'vitamin_a': { value: 900, unit: 'mcg_RAE' },
    'vitamin_c': { value: 90, unit: 'mg' },
    'vitamin_d': { value: 20, unit: 'mcg' },
    'vitamin_e': { value: 15, unit: 'mg' },
    'vitamin_k': { value: 120, unit: 'mcg' },
    'thiamin': { value: 1.2, unit: 'mg' },
    'riboflavin': { value: 1.3, unit: 'mg' },
    'niacin': { value: 16, unit: 'mg' },
    'vitamin_b6': { value: 1.7, unit: 'mg' },
    'folate': { value: 400, unit: 'mcg' },
    'vitamin_b12': { value: 2.4, unit: 'mcg' },
    'choline': { value: 550, unit: 'mg' },
    
    // Minerals
    'calcium': { value: 1300, unit: 'mg' },
    'iron': { value: 18, unit: 'mg' },
    'magnesium': { value: 420, unit: 'mg' },
    'phosphorus': { value: 1250, unit: 'mg' },
    'potassium': { value: 4700, unit: 'mg' },
    'sodium': { value: 2300, unit: 'mg' },
    'zinc': { value: 11, unit: 'mg' },
    'copper': { value: 0.9, unit: 'mg' },
    'selenium': { value: 55, unit: 'mcg' }
   // 'manganese': { value: 2.3, unit: 'mg' },
  };
  
  const dv = dailyValues[nutrientKey];
  if (!dv || dv.unit !== unit) {
    return null;
  }
  
  return (value / dv.value) * 100;
};

/**
 * Get food property badges for display
 * @param {object} properties - Food properties object
 * @returns {array} - Array of badge objects
 */
export const getFoodPropertyBadges = (properties) => {
  if (!properties) return [];
  
  const badges = [];
  
  if (properties.fodmap) {
    badges.push({
      key: 'fodmap',
      text: properties.fodmap === 'high' ? 'High FODMAP' : 'Low FODMAP',
      type: properties.fodmap === 'high' ? 'warning' : 'success',
      icon: properties.fodmap === 'high' ? '⚠️' : '✓'
    });
  }
  
  if (properties.histamine === 'low') {
    badges.push({
      key: 'histamine',
      text: 'Low Histamine',
      type: 'info',
      icon: '✓'
    });
  }
  
  if (properties.safeForMCAS) {
    badges.push({
      key: 'mcas',
      text: 'MCAS Safe',
      type: 'success',
      icon: '✓'
    });
  }
  
  if (properties.dairyFree) {
    badges.push({
      key: 'dairy',
      text: 'Dairy Free',
      type: 'info',
      icon: '🌱'
    });
  }
  
  if (properties.glutenFree) {
    badges.push({
      key: 'gluten',
      text: 'Gluten Free',
      type: 'info',
      icon: '🌾'
    });
  }
  
  if (properties.nightshade) {
    badges.push({
      key: 'nightshade',
      text: 'Nightshade',
      type: 'warning',
      icon: '🌶️'
    });
  }
  
  return badges;
};

/**
 * Check if food data is in new comprehensive format
 * @param {object} foodData - Food data object
 * @returns {boolean} - True if new format
 */
export const isNewFormat = (foodData) => {
  return !!(
    foodData &&
    foodData.nutrients &&
    foodData.nutrients.per100g &&
    (foodData.longCovidServings || foodData.longCovidBenefits || foodData.longCovidRelevance)
  );
};

/**
 * Ensure food data is in a compatible format for the app
 * @param {object} foodData - Food data in any format
 * @returns {object} - Food data in compatible format
 */
export const ensureCompatibleFormat = (foodData) => {
  if (isNewFormat(foodData)) {
    return convertToLegacyFormat(foodData);
  }
  return foodData;
};
const longCovidDataAdapter = {

  parseServingAmount,
  scaleNutrient,
  scaleAllNutrients,
  convertToLegacyFormat,
  getMacrosForServing,
  getMicronutrientsForServing,
  formatNutrientValue,
  getParsedLongCovidServings,
  calculateDailyValuePercentage,
  getFoodPropertyBadges,
  isNewFormat,
  ensureCompatibleFormat
};
export default longCovidDataAdapter;