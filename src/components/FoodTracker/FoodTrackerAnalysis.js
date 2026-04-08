import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MicronutrientChart.css';
import './FoodTrackerAnalysis.css';

// Import enhanced efficiency functions
import { 
  calculateFoodEfficiency
} from './enhanced-efficiency-functions';

// FIXED: Use ONLY named imports for D3
import { 
  select, 
  scaleBand, 
  scaleLinear, 
  axisBottom, 
  axisLeft, 
  axisRight,
  max,
  sum,
  group,
  line,
  curveMonotoneX
} from 'd3';

// FIXED: Utility functions to handle dates without timezone issues
const parseDate = (dateString) => {
  const parts = dateString.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const formatDateForComparison = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameOrAfter = (dateString1, dateString2) => {
  const date1 = parseDate(dateString1);
  const date2 = parseDate(dateString2);
  return date1 >= date2;
};


// FIXED: Enhanced nutrient key mapping function
function normalizeNutrientKey(key) {
  const keyMappings = {
    // B-vitamins
    'b1': 'vitamin_b1',
    'B1': 'vitamin_b1',
    'thiamine': 'vitamin_b1',
    'thiamin': 'vitamin_b1',
    
    'b2': 'vitamin_b2',
    'B2': 'vitamin_b2',
    'riboflavin': 'vitamin_b2',
    
    'b3': 'vitamin_b3',
    'B3': 'vitamin_b3',
    'niacin': 'vitamin_b3',
    
    'b6': 'vitamin_b6',
    'B6': 'vitamin_b6',
    'pyridoxine': 'vitamin_b6',
    
    'b12': 'vitamin_b12',
    'B12': 'vitamin_b12',
    'cobalamin': 'vitamin_b12',
    
    // Other vitamins
    'vit_a': 'vitamin_a',
    'vitA': 'vitamin_a',
    'retinol': 'vitamin_a',
    
    'vit_c': 'vitamin_c',
    'vitC': 'vitamin_c',
    'ascorbic_acid': 'vitamin_c',
    
    'vit_d': 'vitamin_d',
    'vitD': 'vitamin_d',
    'cholecalciferol': 'vitamin_d',
    
    'vit_e': 'vitamin_e',
    'vitE': 'vitamin_e',
    'tocopherol': 'vitamin_e',
    
    'vit_k': 'vitamin_k',
    'vitK': 'vitamin_k',
    
    'folic_acid': 'folate',
    'folicAcid': 'folate',
    
    // Minerals - normalize to lowercase
    'Iron': 'iron',
    'Calcium': 'calcium',
    'Magnesium': 'magnesium',
    'Zinc': 'zinc',
    'Selenium': 'selenium',
    'Copper': 'copper',
    'Potassium': 'potassium',
    'Phosphorus': 'phosphorus'
   // 'Manganese': 'manganese'
  };
  
  // First try direct mapping
  if (keyMappings[key]) {
    return keyMappings[key];
  }
  
  // Convert to lowercase and try again
  const lowerKey = key.toLowerCase();
  if (keyMappings[lowerKey]) {
    return keyMappings[lowerKey];
  }
  
  // Return normalized version (lowercase with underscores)
  return lowerKey.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// FIXED: Enhanced ensureCompleteNutrientData function with better unit handling
function ensureCompleteNutrientData(intakeData, baseRDAData) {
  console.log('=== FIXED ensureCompleteNutrientData ===');
  console.log('Input intakeData:', intakeData);
  
  const completeIntakeData = {};

  // Iterate over all nutrients defined in baseRDAData
  for (const nutrientKey in baseRDAData) {
    if (!baseRDAData.hasOwnProperty(nutrientKey)) continue;
    
    const rdaInfo = baseRDAData[nutrientKey];
    
    if (!rdaInfo || rdaInfo.value === undefined || !rdaInfo.unit) {
      console.warn(`Invalid RDA data for ${nutrientKey}:`, rdaInfo);
      continue;
    }

    // Check if this nutrient exists in the user's intake data
    if (intakeData && intakeData[nutrientKey] !== undefined) {
      const intakeValue = intakeData[nutrientKey];

      // Case 1: Already proper object format { value: X, unit: Y }
      if (typeof intakeValue === 'object' && intakeValue !== null && 
          intakeValue.value !== undefined && intakeValue.unit !== undefined) {
        
        let finalValue = parseFloat(intakeValue.value) || 0;
        let finalUnit = intakeValue.unit;
        
        // FIXED: Handle unit conversions more carefully
        if (finalUnit !== rdaInfo.unit) {
          // Convert common unit mismatches
          if (finalUnit === 'mcg' && rdaInfo.unit === 'mg') {
            finalValue = finalValue / 1000;
            finalUnit = 'mg';
          } else if (finalUnit === 'mg' && rdaInfo.unit === 'mcg') {
            finalValue = finalValue * 1000;
            finalUnit = 'mcg';
          } else if (finalUnit === 'g' && rdaInfo.unit === 'mg') {
            finalValue = finalValue * 1000;
            finalUnit = 'mg';
          }
          // ADD THIS: IU to mcg conversion for vitamin A
          else if (finalUnit === 'IU' && nutrientKey === 'vitamin_a' && rdaInfo.unit === 'mcg') {
            finalValue = finalValue * 0.3; // 1 IU ≈ 0.3 mcg RAE for vitamin A
            finalUnit = 'mcg';
          }
          // ADD THIS: IU to mcg conversion for vitamin D  
          else if (finalUnit === 'IU' && nutrientKey === 'vitamin_d' && rdaInfo.unit === 'mcg') {
            finalValue = finalValue * 0.025; // 1 IU = 0.025 mcg for vitamin D
            finalUnit = 'mcg';
          }
          
          console.log(`Converted ${nutrientKey}: ${intakeValue.value} ${intakeValue.unit} → ${finalValue} ${finalUnit}`);
        }
        
        completeIntakeData[nutrientKey] = {
          value: finalValue,
          unit: finalUnit
        };
      }
      // Case 2: Just a number (assume RDA unit)
      else if (typeof intakeValue === 'number') {
        completeIntakeData[nutrientKey] = {
          value: intakeValue,
          unit: rdaInfo.unit
        };
      }
      // Case 3: String number
      else if (typeof intakeValue === 'string') {
        const numValue = parseFloat(intakeValue) || 0;
        completeIntakeData[nutrientKey] = {
          value: numValue,
          unit: rdaInfo.unit
        };
      }
      // Case 4: Unexpected format
      else {
        console.warn(`Unexpected intake format for ${nutrientKey}:`, intakeValue);
        completeIntakeData[nutrientKey] = {
          value: 0,
          unit: rdaInfo.unit
        };
      }
    } else {
      // Nutrient not found in intake data
      completeIntakeData[nutrientKey] = {
        value: 0,
        unit: rdaInfo.unit
      };
    }
  }
  
  console.log('Output completeIntakeData:', completeIntakeData);
  console.log('=== END FIXED ensureCompleteNutrientData ===\n');
  
  return completeIntakeData;
}

// FIXED: Updated baseRDAData with more nutrients including potassium
const baseRDAData10 = {
  vitamin_a: {
    value: 900,
    unit: 'mcg',
    femaleAdjust: 0.78,
    description: "Supports vision, immune function, and cell growth"
  },
  vitamin_c: {
    value: 90,
    unit: 'mg',
    femaleAdjust: 0.83,
    description: "Antioxidant that supports immune function and collagen production"
  },
  vitamin_d: {
    value: 15,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Crucial for calcium absorption and bone health"
  },
  vitamin_e: {
    value: 15,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Antioxidant that protects cells from damage"
  },
  vitamin_k: {
    value: 120,
    unit: 'mcg',
    femaleAdjust: 0.75,
    description: "Essential for blood clotting and bone health"
  },
  vitamin_b6: {
    value: 1.3,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Important for metabolism and brain development"
  },
  vitamin_b12: {
    value: 2.4,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Essential for nerve function and blood cell formation"
  },
  folate: {
    value: 400,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Critical for cell division and DNA synthesis"
  },
  iron: {
    value: 8,
    unit: 'mg',
    femaleAdjust: 2.25,
    description: "Essential for oxygen transport in the blood"
  },
  calcium: {
    value: 1000,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Critical for bone health and muscle function"
  },
  magnesium: {
    value: 420,
    unit: 'mg',
    femaleAdjust: 0.76,
    description: "Involved in over 300 biochemical reactions in the body"
  },
  zinc: {
    value: 11,
    unit: 'mg',
    femaleAdjust: 0.73,
    description: "Important for immune function and wound healing"
  },
  selenium: {
    value: 55,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Antioxidant that helps protect cells from damage"
  },
  copper: {
    value: 0.9,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Important for red blood cell formation and nerve function"
  },
  potassium: {
    value: 3500,
    unit: 'mg',
    femaleAdjust: 0.86,
    description: "Essential for heart function and blood pressure regulation"
  },
  phosphorus: {
    value: 700,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Important for bone and teeth formation and energy storage"
  },
  vitamin_b1: {
    value: 1.2,
    unit: 'mg',
    femaleAdjust: 0.92,
    description: "Essential for energy metabolism"
  },
  vitamin_b2: {
    value: 1.3,
    unit: 'mg',
    femaleAdjust: 0.85,
    description: "Important for energy production and cell function"
  },
  vitamin_b3: {
    value: 16,
    unit: 'mg',
    femaleAdjust: 0.875,
    description: "Helps convert food into energy"
  }//,
 /* manganese: {
    value: 2.3,
    unit: 'mg',
    femaleAdjust: 0.78,
    description: "Important for bone development and wound healing"
  }*/
};

// MacronutrientChart component
function MacronutrientChart({ userData, userIntake = {} }) {
  const chartRef = useRef(null);
  const [personalizedRDA, setPersonalizedRDA] = useState(null);

  const calculatePersonalizedRDA = useCallback((userData) => {
    const calculateBMI = (weight, height) => {
      if (!weight || !height) return null;
      return weight / Math.pow(height / 100, 2);
    };
    
    const calculateTDEE = (userData) => {
      const { age, gender, weight, height, activity_level } = userData;
      
      if (!age || !weight || !height) {
        return 2000;
      }
      
      let bmr;
      if (gender === 'female') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
      } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
      }
      
      const activityFactors = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'very': 1.725,
        'extreme': 1.9
      };
      
      const activityMultiplier = activityFactors[activity_level] || 1.375;
      let tdee = bmr * activityMultiplier;
      
      const bmi = calculateBMI(weight, height);
      if (bmi) {
        if (bmi < 18.5) {
          tdee *= 1.1;
        } else if (bmi > 30) {
          tdee *= 0.9;
        }
      }
      
      return Math.round(tdee);
    };
    
    const calculateMacroDistribution = (totalCalories, userData) => {
      if (!totalCalories) return null;
      
      let proteinPct = 0.25;
      let carbsPct = 0.45;
      let fatPct = 0.30;
      
      const bmi = calculateBMI(userData.weight, userData.height);
      if (bmi && bmi < 18.5) {
        fatPct = 0.35;
        carbsPct = 0.45;
        proteinPct = 0.20;
      }
      
      if (bmi && bmi > 30) {
        proteinPct = 0.35;
        carbsPct = 0.35;
        fatPct = 0.30;
      }
      
      if (userData.age > 65) {
        proteinPct = Math.min(proteinPct + 0.05, 0.40);
        const remaining = 1.0 - proteinPct;
        carbsPct = remaining * (carbsPct / (carbsPct + fatPct));
        fatPct = remaining * (fatPct / (carbsPct + fatPct));
      }
      
      return {
        protein: proteinPct,
        carbs: carbsPct,
        fat: fatPct
      };
    };

    const totalCalories = calculateTDEE(userData);
    const macroDistribution = calculateMacroDistribution(totalCalories, userData);
    
    const protein = (totalCalories * macroDistribution.protein / 4).toFixed(1);
    const carbs = (totalCalories * macroDistribution.carbs / 4).toFixed(1);
    const fat = (totalCalories * macroDistribution.fat / 9).toFixed(1);
    
    return {
      protein: { value: parseFloat(protein) },
      carbs:   { value: parseFloat(carbs)   },
      fat:     { value: parseFloat(fat)     },
      calories:{ value: totalCalories       }
    };
  }, []);

  useEffect(() => {
    if (userData) {
      const rda = calculatePersonalizedRDA(userData);
      setPersonalizedRDA(rda);
    }
  }, [userData, calculatePersonalizedRDA]);

  useEffect(() => {
    if (!chartRef.current || !personalizedRDA || !userIntake) return;
    
    try {
      select(chartRef.current).selectAll("*").remove();
  
      const margin = { top: 40, right: 180, bottom: 60, left: 70 };
      const width = 700 - margin.left - margin.right;
      const height = 350 - margin.top - margin.bottom;
      
      const svg = select(chartRef.current)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
      const macros = ['protein', 'carbs', 'fat'];
      const data = [
        { name: "Current Intake", ...userIntake },
        { name: "Recommended", 
          protein: personalizedRDA.protein.value,
          carbs: personalizedRDA.carbs.value,
          fat: personalizedRDA.fat.value
        }
      ];
      
      const colors = {
        protein: "#22c55e",
        carbs: "#3b82f6",
        fat: "#f59e0b"
      };
      
      const x = scaleBand()
        .domain(data.map(d => d.name))
        .range([0, width])
        .padding(0.3);
      
      const maxValue = max(data, d => {
        return d.protein + d.carbs + d.fat;
      });
      
      const y = scaleLinear()
        .domain([0, maxValue * 1.1])
        .range([height, 0]);
      
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(axisBottom(x))
        .selectAll("text")
        .attr("font-size", "12px")
        .attr("font-weight", d => d === "Recommended" ? "bold" : "normal");
      
      svg.append("g")
        .call(axisLeft(y).ticks(5))
        .selectAll("text")
        .attr("font-size", "12px");
      
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("font-size", "14px")
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .text("Grams");
      
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text(`Macronutrient Analysis — ${formattedDate}`);
      
      data.forEach(d => {
        let y0 = 0;
        d.stackedData = macros.map(nutrient => {
          return {
            nutrient,
            y0,
            y1: y0 += (d[nutrient] || 0)
          };
        });
      });
      
      const tooltip = select("body")
        .append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "4px")
        .style("padding", "8px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
        .style("z-index", 100);
      
      const groups = svg.selectAll(".bar-group")
        .data(data)
        .join("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${x(d.name)},0)`);
      
      groups.selectAll("rect")
        .data(d => d.stackedData)
        .join("rect")
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.y1))
        .attr("height", d => y(d.y0) - y(d.y1))
        .attr("fill", d => colors[d.nutrient])
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          const parentData = select(this.parentNode).datum();
          const amount = parentData[d.nutrient].toFixed(1);
          const percentage = ((parentData[d.nutrient] / (parentData.protein + parentData.carbs + parentData.fat)) * 100).toFixed(1);
          
          const caloriesPerGram = d.nutrient === 'fat' ? 9 : 4;
          const calories = (parentData[d.nutrient] * caloriesPerGram).toFixed(0);
          
          tooltip
            .style("opacity", 1)
            .html(`
              <div style="font-weight:bold;text-transform:capitalize;color:${colors[d.nutrient]}">${d.nutrient}</div>
              <div style="margin:4px 0">
                <b>Amount:</b> ${amount}g
                <br><b>Percentage:</b> ${percentage}%
                <br><b>Calories:</b> ${calories} kcal
              </div>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
            
          select(this)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);
        })
        .on("mouseout", function() {
          tooltip.style("opacity", 0);
          select(this)
            .attr("stroke", "white")
            .attr("stroke-width", 1);
        });
      
      const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + 20}, 0)`);
      
      macros.forEach((nutrient, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 25})`);
          
        legendRow.append("rect")
          .attr("width", 15)
          .attr("height", 15)
          .attr("fill", colors[nutrient]);
          
        legendRow.append("text")
          .attr("x", 24)
          .attr("y", 12)
          .attr("text-anchor", "start")
          .style("text-transform", "capitalize")
          .style("font-size", "14px")
          .text(nutrient);
      });
      
      const calculateCalories = (data) => {
        return (data.protein * 4 + data.carbs * 4 + data.fat * 9).toFixed(0);
      };
      
      const calorieInfo = svg.append("g")
        .attr("class", "calorie-info")
        .attr("transform", `translate(${width + 20}, ${macros.length * 25 + 20})`);
        
      calorieInfo.append("text")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text("Total Calories:");
        
      calorieInfo.append("text")
        .attr("y", 25)
        .attr("font-size", "14px")
        .text(`Intake: ${calculateCalories(userIntake)} kcal`);
        
      calorieInfo.append("text")
        .attr("y", 50)
        .attr("font-size", "14px")
        .text(`Recommended: ${personalizedRDA.calories.value.toFixed(0)} kcal`);
      
      return () => {
        select(".d3-tooltip").remove();
      };
    } catch (error) {
      console.error('Error rendering MacronutrientChart:', error);
    }
  }, [chartRef, personalizedRDA, userIntake, userData]);

  return (
    <div className="w-full">
      <div 
        ref={chartRef} 
        className="macro-chart mx-auto overflow-visible"
        style={{ minHeight: "350px" }}
      ></div>
    </div>
  );
}

// BulletChart component
const BulletChart = ({ data, maxPercent }) => {
  const actualWidth = Math.min(100, (data.rawValue / data.rda) * 100);
  const displayPercentage = Math.round((data.rawValue / data.rda) * 100);
  const optimalWidth = Math.min(100, 100);

  const getColor = (percent) => {
    if (percent >= 100) return "#4CAF50";
    if (percent >= 70) return "#8BC34A";
    if (percent >= 50) return "#FFC107";
    if (percent >= 30) return "#FF9800";
    return "#F44336";
  };

  const barColor = getColor(actualWidth);

  return (
    <div className="bullet-chart">
      <div className="bullet-chart-header">
        <div className="bullet-chart-title">
          <span className="nutrient-name">{data.name}</span>
          {data.isAdjusted && (
            <span className="adjusted-badge">
              Adjusted
            </span>
          )}
        </div>
        <div className="bullet-chart-values">
          {data.rawValue.toFixed(2)} / {data.rda} {data.unit}
          <span className="bullet-chart-percentage" style={{ color: barColor }}>
            ({displayPercentage}%)
          </span>
        </div>
      </div>
      
      <div className="bullet-chart-track">
        <div 
          className="threshold-marker"
          style={{ left: '70%' }}
        ></div>
        
        <div 
          className="actual-value-bar"
          style={{ 
            width: `${actualWidth}%`, 
            backgroundColor: barColor 
          }}
        ></div>
        
        <div 
          className="target-line"
          style={{ left: `${optimalWidth}%` }}
        ></div>
      </div>
    </div>
  );
};

// FIXED: Complete MicronutrientChart component
function MicronutrientChart({ data, userData }) {
  const [userInfo, setUserInfo] = useState(userData || {});
  const [chartData, setChartData] = useState([]);
  const [allChartData, setAllChartData] = useState([]);
  const [nutrientIntake] = useState(data && Object.keys(data).length > 0 ? ensureCompleteNutrientData(data, baseRDAData10) : {});
  const [, setPersonalizedRDA] = useState({});
  const [displayMode, setDisplayMode] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Sync local userInfo when parent passes new userData (e.g., after COVID toggle)
  useEffect(() => {
    if (userData) {
      setUserInfo(userData);
    }
  }, [userData]);


  const processNutrientData = useCallback((intakeData, rdaData) => {
    console.log('=== FIXED processNutrientData ===');
    console.log('Processing', Object.keys(rdaData).length, 'nutrients');
    
    const processedNutrients = [];

    for (const nutrientKey in rdaData) {
      if (!rdaData.hasOwnProperty(nutrientKey)) continue;
      
      const rdaInfo = rdaData[nutrientKey];
      
      if (!rdaInfo || rdaInfo.value === undefined || !rdaInfo.unit) {
        console.warn(`Skipping ${nutrientKey}: Invalid RDA info`, rdaInfo);
        continue;
      }

      const intakeDetails = intakeData[nutrientKey];
      let intakeValue = 0;
      
      if (intakeDetails && typeof intakeDetails === 'object' && intakeDetails.value !== undefined) {
        intakeValue = parseFloat(intakeDetails.value) || 0;
      }
      console.log("intakeValue", intakeValue);
      const percentOfRDA = rdaInfo.value > 0 ? (intakeValue / rdaInfo.value) * 100 : 0;
      
      if (percentOfRDA > 10000) {
        console.warn(`Extremely high percentage for ${nutrientKey}: ${percentOfRDA}% - possible unit error`);
      }
      
      const formattedName = nutrientKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const category = nutrientKey.includes('vitamin') ? 'vitamins' : 'minerals';

      const processedNutrient = {
        key: nutrientKey,
        name: formattedName,
        value: parseFloat(percentOfRDA.toFixed(10)),
        rawValue: intakeValue,
        unit: rdaInfo.unit,
        rda: rdaInfo.value,
        rdaUnit: rdaInfo.unit,
        isAdjustedRDA: rdaInfo.isAdjusted || false,
        percentOfRDA: parseFloat(percentOfRDA.toFixed(10)),
        category: category,
      };
      
      console.log(`${formattedName}: ${intakeValue}${rdaInfo.unit} / ${rdaInfo.value}${rdaInfo.unit} = ${percentOfRDA.toFixed(1)}%`);
      
      processedNutrients.push(processedNutrient);
    }

    const sortedNutrients = processedNutrients.sort((a, b) => a.percentOfRDA - b.percentOfRDA);
    
    console.log('=== PROCESSING SUMMARY ===');
    console.log('Total nutrients processed:', sortedNutrients.length);
    console.log('Deficient (<70%):', sortedNutrients.filter(n => n.value < 70).length);
    console.log('Optimal (≥100%):', sortedNutrients.filter(n => n.value >= 100).length);
    
    return sortedNutrients;
  }, []);

  const applyFilters = useCallback((dataToFilter) => {
    let filteredData = [...dataToFilter];

    if (selectedCategory !== 'all') {
      filteredData = filteredData.filter(item => item.category === selectedCategory);
    }
    
    if (displayMode === 'deficient') {
      filteredData = filteredData.filter(item => item.value < 70);
      filteredData.sort((a, b) => a.value - b.value);
    } else if (displayMode === 'optimal') {
      filteredData = filteredData.filter(item => item.value >= 100);
      filteredData.sort((a, b) => b.value - a.value);
    } else {
      filteredData.sort((a, b) => a.value - b.value);
    }

    setChartData(filteredData);
  }, [displayMode, selectedCategory]);

  const calculatePersonalizedRDA = useCallback((baseRDAData_, userData) => {
    if (!baseRDAData_ || Object.keys(baseRDAData_).length === 0) {
      console.error('baseRDAData_ is empty or invalid!');
      return {};
    }

    const personalRDA = JSON.parse(JSON.stringify(baseRDAData_));

    Object.keys(personalRDA).forEach(nutrient => {
      if (!personalRDA[nutrient] || typeof personalRDA[nutrient].value !== 'number') {
        console.error(`Invalid data structure for ${nutrient}`);
        personalRDA[nutrient] = { value: 0, unit: personalRDA[nutrient]?.unit || 'mg', isAdjusted: false };
        return;
      }

      let adjustedValue = personalRDA[nutrient].value;

      if (userData?.gender && userData.gender.toLowerCase() === 'female') {
        const femaleAdjust = personalRDA[nutrient].femaleAdjust || 1.0;
        adjustedValue *= femaleAdjust;
      }

      if (userData?.age) {
        let ageMultiplier = 1.0;
        if (userData.age >= 70) {
          if (nutrient === 'vitamin_d') ageMultiplier = 1.2;
          if (nutrient === 'vitamin_b12') ageMultiplier = 1.1;
          if (nutrient === 'calcium') ageMultiplier = 1.15;
        } else if (userData.age >= 50) {
          if (nutrient === 'vitamin_d') ageMultiplier = 1.1;
          if (nutrient === 'vitamin_b12') ageMultiplier = 1.05;
        } else if (userData.age <= 18) {
          if (nutrient === 'calcium') ageMultiplier = 1.15;
          if (nutrient === 'iron') ageMultiplier = 1.1;
        }

        if (ageMultiplier !== 1.0) {
          adjustedValue *= ageMultiplier;
        }
      }

      if (isNaN(adjustedValue) || !isFinite(adjustedValue) || adjustedValue <= 0) {
        console.error(`Invalid final value for ${nutrient}: ${adjustedValue}, resetting to base`);
        adjustedValue = personalRDA[nutrient].value;
      }

      const roundedValue = Math.round(adjustedValue * 10) / 10;

      personalRDA[nutrient] = {
        ...personalRDA[nutrient],
        value: roundedValue,
        isAdjusted: roundedValue !== baseRDAData_[nutrient].value
      };
    });

    return personalRDA;
  }, []);

  const getNutrientStatus = (percentValue) => {
    if (percentValue >= 100) return { label: "Optimal", color: "#4CAF50" };
    if (percentValue >= 70) return { label: "Good", color: "#8BC34A" };
    if (percentValue >= 50) return { label: "Moderate", color: "#FFC107" };
    if (percentValue >= 30) return { label: "Low", color: "#FF9800" };
    return { label: "Very Low", color: "#F44336" };
  };

  const getNutrientInfo = (nutrientName) => {
    const nutrientInfoMap = {};
    for (const key in baseRDAData10) {
        nutrientInfoMap[key.replace(/_/g, ' ')] = baseRDAData10[key].description;
    }

    const exactMatch = nutrientInfoMap[nutrientName.toLowerCase()];
    if (exactMatch) return exactMatch;

    for (const key in nutrientInfoMap) {
      if (nutrientName.toLowerCase().includes(key)) {
        return nutrientInfoMap[key];
      }
    }
    return '';
  };

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      try {
        const calculatedRDA = calculatePersonalizedRDA(baseRDAData10, userInfo);

        if (!calculatedRDA || Object.keys(calculatedRDA).length === 0) {
          console.error('Failed to calculate RDA values');
          setIsLoading(false);
          return;
        }

        setPersonalizedRDA(calculatedRDA);

        const processedAllData = processNutrientData(nutrientIntake, calculatedRDA);
        
        setAllChartData(processedAllData);
        applyFilters(processedAllData);

      } catch (error) {
        console.error('Error in MicronutrientChart useEffect:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [userInfo, nutrientIntake, calculatePersonalizedRDA, processNutrientData, applyFilters]);

  useEffect(() => {
    if (allChartData.length > 0) {
      applyFilters(allChartData);
    }
  }, [displayMode, selectedCategory, allChartData, applyFilters]);

  const getCovidSeverityClass = (severity) => {
    switch(severity?.toLowerCase()) {
      case 'mild': return 'covid-severity-mild';
      case 'moderate': return 'covid-severity-moderate';
      case 'severe': return 'covid-severity-severe';
      case 'very severe': return 'covid-severity-very-severe';
      default: return 'covid-severity-unknown';
    }
  };

  const getCurrentCovidSeverity = () => {
    const severity = userInfo.covid_severity || userInfo.longCovidSeverity;
    if (!severity || severity === null || severity === 'None') return 'None';
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const changeDisplayMode = (mode) => {
    setDisplayMode(mode);
  };

  const changeCategory = (category) => {
    setSelectedCategory(category);
  };

  const getFilterDescription = () => {
    const displayPart = displayMode === 'deficient' ? "below 70% RDA" : displayMode === 'optimal' ? "at 100%+ RDA" : "";
    const categoryPart = selectedCategory === 'vitamins' ? "vitamins" : selectedCategory === 'minerals' ? "minerals" : "nutrients";

    let description = categoryPart;
    if (displayPart) {
        description += ` ${displayPart}`;
    }
    return description.trim();
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p className="loading-text">Loading personalized micronutrient data...</p>
        </div>
      </div>
    );
  }

  const deficientCount = allChartData.filter(item => item.value < 70).length;

  if ((!data || Object.keys(data).length === 0) && (!userData || Object.keys(userData).length === 0)) {
    return (
      <div className="micronutrient-chart-container">
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Micronutrient Status</h2>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">No Data Available</h3>
            <p className="empty-state-description">
              Please set up your profile and log some meals to see your personalized micronutrient analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0 || allChartData.length === 0) {
    return (
      <div className="micronutrient-chart-container">
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Micronutrient Status</h2>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">No Micronutrient Data Available</h3>
            <p className="empty-state-description">
              Once you log some meals, we'll analyze your nutrient intake and show your personalized micronutrient status here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="micronutrient-chart-container">
      <div className="chart-card">
        <div className="chart-header">
          <h2 className="chart-title">Micronutrient Status</h2>

          <div className="display-mode-buttons">
            <button
              onClick={() => changeDisplayMode('all')}
              className={`mode-button ${displayMode === 'all' ? 'mode-button-active' : ''}`}
            >
              All ({allChartData.length})
            </button>
            <button
              onClick={() => changeDisplayMode('deficient')}
              className={`mode-button ${displayMode === 'deficient' ? 'mode-button-deficient' : ''}`}
            >
              Deficient ({deficientCount})
            </button>
            <button
              onClick={() => changeDisplayMode('optimal')}
              className={`mode-button ${displayMode === 'optimal' ? 'mode-button-optimal' : ''}`}
            >
              Optimal ({allChartData.filter(item => item.percentOfRDA >= 100).length})
            </button>
          </div>
        </div>

        <div className="category-filter">
          <button
            onClick={() => changeCategory('all')}
            className={`category-button ${selectedCategory === 'all' ? 'category-button-active' : ''}`}
          >
            All Nutrients
          </button>
          <button
            onClick={() => changeCategory('vitamins')}
            className={`category-button ${selectedCategory === 'vitamins' ? 'category-button-active' : ''}`}
          >
            Vitamins
          </button>
          <button
            onClick={() => changeCategory('minerals')}
            className={`category-button ${selectedCategory === 'minerals' ? 'category-button-active' : ''}`}
          >
            Minerals
          </button>
        </div>

        {deficientCount > 0 && (
          <div className="deficiency-alert">
            <p className="deficiency-message">
              {deficientCount} {deficientCount === 1 ? 'nutrient is' : 'nutrients are'} below recommended levels.
            </p>
          </div>
        )}

        {userInfo.covid_severity && getCurrentCovidSeverity() !== 'None' && (
          <div className={`covid-alert ${getCovidSeverityClass(userInfo.covid_severity)}`}>
            <p className="covid-title">Long COVID Condition - {getCurrentCovidSeverity()} Severity</p>
            <p className="covid-description">Recommended values have been adjusted for immune system support</p>
          </div>
        )}

        <div className="chart-content">
          {chartData.length === 0 && allChartData.length > 0 ? (
            <div className="no-filter-results">
              <div className="no-results-icon">🎯</div>
              <h3 className="no-results-title">Great news!</h3>
              <p className="no-results-message">
                You don't have any {getFilterDescription()} to display.
                {displayMode === 'deficient' && " This means your nutrient levels are doing well in this category!"}
                {displayMode === 'optimal' && " Try logging more diverse meals to reach optimal levels."}
              </p>
              <p className="no-results-suggestion">
                Try selecting "All" to see your complete nutrient profile.
              </p>
            </div>
          ) : (
            chartData.map((nutrient) => (
              <BulletChart
                key={nutrient.key}
                data={nutrient}
                maxPercent={150}
                getNutrientStatus={getNutrientStatus}
                getNutrientInfo={getNutrientInfo}
              />
            ))
          )}
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color legend-optimal"></div>
            <span className="legend-text">≥ 100% (Optimal)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-good"></div>
            <span className="legend-text">70-99% (Good)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-moderate"></div>
            <span className="legend-text">50-69% (Moderate)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-low"></div>
            <span className="legend-text">30-49% (Low)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-very-low"></div>
            <span className="legend-text">0-29% (Very Low)</span>
          </div>
          <div className="legend-item">
            <div className="legend-target"></div>
            <span className="legend-text">Target (100% RDA)</span>
          </div>
          <div className="legend-item">
            <div className="legend-threshold"></div>
            <span className="legend-text">Deficiency Threshold (70%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// FIXED: Enhanced getChartData function with better nutrient key mapping
function getChartData(foodLog, userProfile) {
  if (!foodLog || !Array.isArray(foodLog)) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  if (foodLog.length === 0) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  const today = formatDateForComparison(new Date());
  const todayEntries = foodLog.filter(e => e.date === today);
  
  console.log('=== FIXED getChartData DEBUG ===');
  
  if (todayEntries.length === 0) {
    return { macroSums: {}, microSums: {}, efficiencyData: foodLog };
  }

  const macroSums = todayEntries.reduce((acc, e) => {
    const protein = parseFloat(e.protein) || 0;
    const carbs = parseFloat(e.carbs) || 0;
    const fat = parseFloat(e.fat) || 0;
    const calories = parseFloat(e.calories) || 0;
    
    acc.protein = (acc.protein || 0) + protein;
    acc.carbs = (acc.carbs || 0) + carbs;
    acc.fat = (acc.fat || 0) + fat;
    acc.calories = (acc.calories || 0) + calories;
    
    console.log(`Entry: ${e.name} - P:${protein}g C:${carbs}g F:${fat}g Cal:${calories}`);
    return acc;
  }, {});
  
  const microSums = {};
  
  todayEntries.forEach((entry, entryIndex) => {
    console.log(`\n--- Processing Entry ${entryIndex}: ${entry.name} ---`);
    
    if (!entry.micronutrients) {
      console.log(`No micronutrients data for ${entry.name}`);
      return;
    }
    
    Object.entries(entry.micronutrients).forEach(([originalKey, nutrientValue]) => {
      // FIXED: Skip macro nutrients
      const macroNutrients = ['protein', 'carbs', 'fat', 'calories', 'name', 'unit'];
      if (macroNutrients.includes(originalKey.toLowerCase())) {
        return;
      }
      
      // FIXED: Normalize the nutrient key using our mapping function
      const nutrientKey = normalizeNutrientKey(originalKey);
      console.log(`Mapping: "${originalKey}" → "${nutrientKey}"`);
      
      let valueToAdd = 0;
      let unit = 'mg';
      
      // FIXED: Handle different value formats including "1.7 mg" strings
      if (typeof nutrientValue === 'object' && nutrientValue !== null) {
        if (nutrientValue.value !== undefined) {
          valueToAdd = parseFloat(nutrientValue.value) || 0;
          unit = nutrientValue.unit || 'mg';
        } else {
          console.warn(`Object format not recognized for ${originalKey}:`, nutrientValue);
          return;
        }
      } else if (typeof nutrientValue === 'number') {
        valueToAdd = nutrientValue;
      } else if (typeof nutrientValue === 'string') {
        // FIXED: Parse strings like "1.7 mg" or "121.0 mg"
        const match = nutrientValue.match(/^([\d.]+)\s*(\w+)?/);
        if (match) {
          valueToAdd = parseFloat(match[1]) || 0;
          unit = match[2] || 'mg';
        } else {
          valueToAdd = parseFloat(nutrientValue) || 0;
        }
      } else {
        console.warn(`Unrecognized value format for ${originalKey}:`, nutrientValue);
        return;
      }
      
      // FIXED: Handle unit conversions for specific nutrients
      if (nutrientKey === 'zinc' || nutrientKey === 'selenium' || nutrientKey === 'copper') {
        if (unit === 'mcg' || unit === 'μg') {
          if (nutrientKey === 'zinc' || nutrientKey === 'copper') {
            valueToAdd = valueToAdd / 1000;
            unit = 'mg';
            console.log(`Converted ${nutrientKey} from mcg to mg: ${valueToAdd}`);
          }
        }
      }
      
      // FIXED: Sanity check for unreasonable values
      const reasonableMaxValues = {
        'zinc': 50,
        'selenium': 400,
        'copper': 10,
        'iron': 100,
        'vitamin_c': 2000,
        'vitamin_d': 100,
        'vitamin_e': 50,
        'vitamin_b6': 20,
        'vitamin_b12': 100,
        'calcium': 3000,
        'magnesium': 1000,
        'potassium': 10000
      };
      
      const maxValue = reasonableMaxValues[nutrientKey] || 10000;
      if (valueToAdd < 0 || valueToAdd > maxValue) {
        console.warn(`Suspicious ${nutrientKey} value: ${valueToAdd} ${unit} (max expected: ${maxValue}) - using cautiously`);
        valueToAdd = Math.min(Math.max(valueToAdd, 0), maxValue);
      }
      
      // FIXED: Accumulate the values
      if (!microSums[nutrientKey]) {
        microSums[nutrientKey] = { value: 0, unit: unit };
      }
      
      microSums[nutrientKey].value += valueToAdd;
      
      console.log(`${nutrientKey}: +${valueToAdd} ${unit} → Total: ${microSums[nutrientKey].value} ${unit}`);
    });
  });
  
  console.log('\n=== FINAL SUMS ===');
  console.log('Macros:', macroSums);
  console.log('Micros:', microSums);
  
  // FIXED: Validate final micronutrient totals
  Object.entries(microSums).forEach(([nutrient, data]) => {
    const warningThresholds = {
      'zinc': 100,
      'selenium': 1000,
      'copper': 50,
      'iron': 200,
      'vitamin_c': 5000,
    };
    
    const threshold = warningThresholds[nutrient] || 1000;
    if (data.value > threshold) {
      console.warn(`Unusually high ${nutrient}: ${data.value} ${data.unit} (threshold: ${threshold})`);
    }
  });
  
  console.log('=== END FIXED DEBUG ===\n');
  
  return { 
    macroSums, 
    microSums, 
    efficiencyData: foodLog 
  };
}

// Updated EfficiencyChart - FIXED to use named imports
function EfficiencyChart({ data, userData, foodDatabase }) {
  const chartRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneWeekAgoString = formatDateForComparison(oneWeekAgo);
    
    const lastWeekData = data.filter(meal => {
      try {
        return isSameOrAfter(meal.date, oneWeekAgoString);
      } catch (err) {
        console.warn('Error parsing date:', meal.date);
        return false;
      }
    });
    
    const updatedData = lastWeekData.map((meal, index) => {
      try {
        console.log(`Calculating efficiency for ${meal.name} using enhanced function`);
        const efficiency = calculateFoodEfficiency(meal, userData);
        
        const finalEfficiency = (efficiency && efficiency > 0) ? efficiency : (meal.efficiency || meal.metabolicEfficiency || 80);
        
        console.log(`Final efficiency for ${meal.name}: ${finalEfficiency}`);
        
        return {
          ...meal,
          originalEfficiency: meal.efficiency || meal.metabolicEfficiency || 80,
          efficiency: finalEfficiency,
          actualEnergy: Math.round(meal.calories * (finalEfficiency / 100)),
          wastedEnergy: Math.round(meal.calories * ((100 - finalEfficiency) / 100))
        };
      } catch (err) {
        console.warn(`Error processing meal ${index}:`, err);
        const fallbackEfficiency = meal.efficiency || meal.metabolicEfficiency || 80;
        return {
          ...meal,
          efficiency: fallbackEfficiency,
          actualEnergy: Math.round(meal.calories * (fallbackEfficiency / 100)),
          wastedEnergy: Math.round(meal.calories * ((100 - fallbackEfficiency) / 100))
        };
      }
    });
    
    const filteredData = updatedData.filter(meal => 
      meal.mealType !== "Pre-workout" && meal.mealType !== "Post-workout"
    );
    
    console.log('ProcessedData with consistent efficiency:', filteredData);
    setProcessedData(filteredData);
  }, [data, userData, foodDatabase]);

  useEffect(() => {
    if (!chartRef.current || !processedData || processedData.length === 0) return;
    
    select(chartRef.current).selectAll("*").remove();
    
    const margin = { top: 60, right: 20, bottom: 50, left: 50 };
    const width = 900 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    
    const svg = select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Enhanced Metabolic Efficiency Chart");
      
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-style", "italic")
      .text("Optimized for Long COVID energy management");
    
    const tooltip = select("body")
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "5px")
      .style("padding", "12px")
      .style("font-size", "14px")
      .style("box-shadow", "0 3px 14px rgba(0,0,0,0.25)")
      .style("z-index", "10")
      .style("max-width", "300px");
    
    // Generate date range without timezone issues
    const allDatesInRange = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const formattedDate = formatDateForComparison(date);
      allDatesInRange.push(formattedDate);
    }
    
    const combinedData = [];
    const groupedByDate = group(processedData, d => d.date);
    
    const uniqueMealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
    
    allDatesInRange.forEach(date => {
      const dateData = groupedByDate.get(date) || [];
      
      if (dateData.length > 0) {
        const mealsByType = group(dateData, d => d.mealType);
      
        uniqueMealTypes.forEach(mealType => {
          const meals = mealsByType.get(mealType);
          if (meals && meals.length > 0) {
            const totalCalories = sum(meals, d => d.calories);
            
            const weightedEfficiency = meals.reduce((acc, meal) => {
              const mealEfficiency = meal.efficiency || 0;
              const calorieWeight = totalCalories > 0 ? meal.calories / totalCalories : 0;
              return acc + (mealEfficiency * calorieWeight);
            }, 0);
            
            const totalActualEnergy = sum(meals, d => d.actualEnergy || (d.calories * (d.efficiency / 100)));
            const totalWastedEnergy = totalCalories - totalActualEnergy;
            
            combinedData.push({
              date: date,
              mealType: mealType,
              time: meals[0].time,
              name: `${mealType} (${meals.length} items)`,
              efficiency: Math.round(weightedEfficiency),
              calories: totalCalories,
              actualEnergy: totalActualEnergy,
              wastedEnergy: totalWastedEnergy,
              originalMeals: meals,
              mealOrder: uniqueMealTypes.indexOf(mealType)
            });
          }
        });
      }
    });
    
    const chronologicalData = [...combinedData].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.mealOrder - b.mealOrder;
    });

    const xOuter = scaleBand()
      .domain(allDatesInRange)
      .range([0, width])
      .padding(0.2);
    
    const xInner = scaleBand()
      .domain(uniqueMealTypes)
      .range([0, xOuter.bandwidth()])
      .padding(0.1);
    
    const formatDate = date => {
      const parts = date.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    };
    
    const maxCalories = max(combinedData, d => d.calories) || 1000;
    const y = scaleLinear()
      .domain([0, maxCalories])
      .range([height, 0]);

    const yEff = scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Create axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(axisBottom(xOuter).tickFormat(formatDate))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    svg.append("g")
      .call(axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Calories");

    svg.append("g")
      .attr("transform", `translate(${width}, 0)`)
      .call(axisRight(yEff))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Enhanced Efficiency (%)");

    const mealColors = {
      "Breakfast": "#DC2626",
      "Morning Snack": "#EA580C",
      "Lunch": "#16A34A",
      "Afternoon Snack": "#0891B2",
      "Dinner": "#7C3AED",
      "Late Night Snack": "#BE185D"
    };

    // Add stacked bars
    combinedData.forEach(meal => {
      const mealColor = mealColors[meal.mealType] || "#999999";
      const barX = xOuter(meal.date) + xInner(meal.mealType);
      const barWidth = xInner.bandwidth();
      
      // Actual energy bar
      svg.append("rect")
        .attr("class", "actual-energy-bar")
        .attr("x", barX)
        .attr("y", y(meal.actualEnergy))
        .attr("width", barWidth)
        .attr("height", height - y(meal.actualEnergy))
        .attr("fill", mealColor)
        .attr("opacity", 0.9)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event) {
          select(this).attr("opacity", 0.7);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;margin-bottom:10px;font-size:15px;">${meal.date} - ${meal.mealType}</div>
              <div style="margin-bottom:6px;">Total Calories: ${Math.round(meal.calories)}</div>
              <div style="margin-bottom:6px;"><strong>Enhanced Efficiency: ${meal.efficiency}%</strong></div>
              <div style="margin-bottom:6px;">Usable Energy: ${Math.round(meal.actualEnergy)} cal</div>
              <div style="margin-bottom:12px;">Energy Lost: ${Math.round(meal.wastedEnergy)} cal</div>
              <div style="font-weight:bold;margin-bottom:5px;">Individual Items:</div>
              <ul style="margin-top:0;padding-left:20px;">
                ${meal.originalMeals.map(item => `
                  <li>${item.name} - ${item.calories} cal (${Math.round(item.efficiency)}% efficient)</li>
                `).join('')}
              </ul>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          select(this).attr("opacity", 0.9);
          tooltip.style("visibility", "hidden");
        });
      
      // Potential energy bar (wasted energy)
      svg.append("rect")
        .attr("class", "potential-energy-bar")
        .attr("x", barX)
        .attr("y", y(meal.calories))
        .attr("width", barWidth)
        .attr("height", y(meal.actualEnergy) - y(meal.calories))
        .attr("fill", mealColor)
        .attr("opacity", 0.3)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    });

    if (chronologicalData.length > 0) {
      const lineData = chronologicalData.map((meal, index) => {
        const barX = xOuter(meal.date) + xInner(meal.mealType);
        const barWidth = xInner.bandwidth();
        const barCenterX = barX + (barWidth / 2);
        
        return {
          ...meal,
          xPos: barCenterX,
          chronologicalIndex: index
        };
      });

      const sortedLineData = [...lineData].sort((a, b) => a.xPos - b.xPos);
      
      const lineGenerator = line()
        .x(d => d.xPos)
        .y(d => yEff(d.efficiency))
        .defined(d => d.efficiency != null && !isNaN(d.efficiency))
        .curve(curveMonotoneX);
      
      svg.append("path")
        .datum(sortedLineData)
        .attr("fill", "none")
        .attr("stroke", "grey")
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);
      
      svg.selectAll(".efficiency-point")
        .data(sortedLineData)
        .enter()
        .append("circle")
        .attr("class", "efficiency-point")
        .attr("cx", d => d.xPos)
        .attr("cy", d => yEff(d.efficiency))
        .attr("r", 5)
        .attr("fill", "grey")
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          select(this).attr("r", 8);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;font-size:16px;">${d.mealType} - ${d.time}</div>
              <div style="font-weight:bold;font-size:14px;">${d.date}</div>
              <div>Enhanced Efficiency: <strong>${d.efficiency}%</strong></div>
              <div style="margin-top:6px">Calculated using enhanced Long COVID algorithms</div>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          select(this).attr("r", 5);
          tooltip.style("visibility", "hidden");
        });
    }

    // Add legend
    const legendY = height + 100;
    
    svg.append("line")
      .attr("x1", 10)
      .attr("x2", 40)
      .attr("y1", legendY)
      .attr("y2", legendY)
      .attr("stroke", "grey")
      .attr("stroke-width", 3);
    
    svg.append("circle")
      .attr("cx", 25)
      .attr("cy", legendY)
      .attr("r", 5)
      .attr("fill", "grey")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.append("text")
      .attr("x", 50)
      .attr("y", legendY + 4)
      .style("font-size", "12px")
      .text("Enhanced Efficiency (%)");
    
    const legendData = [
      { label: "Usable Energy", color: "#DC2626", opacity: 0.9 },
      { label: "Energy Lost", color: "#DC2626", opacity: 0.3 }
    ];
    
    svg.selectAll(".legend-rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 200)
      .attr("y", (d, i) => legendY - 10 + i * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("opacity", d => d.opacity)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".legend-text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 225)
      .attr("y", (d, i) => legendY + 2 + i * 20)
      .style("font-size", "12px")
      .text(d => d.label);
    
    // Meal type legend
    const mealTypeData = Object.entries(mealColors).map(([type, color]) => ({ type, color }));
    
    svg.selectAll(".meal-type-rect")
      .data(mealTypeData)
      .enter()
      .append("rect")
      .attr("x", (d, i) => 400 + Math.floor(i/3) * 140)
      .attr("y", (d, i) => legendY - 10 + (i % 3) * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".meal-type-text")
      .data(mealTypeData)
      .enter()
      .append("text")
      .attr("x", (d, i) => 425 + Math.floor(i/3) * 140)
      .attr("y", (d, i) => legendY + 2 + (i % 3) * 20)
      .style("font-size", "12px")
      .text(d => d.type);

    return () => {
      select(".chart-tooltip").remove();
    };
  }, [chartRef, processedData, userData]);

  if (!processedData || processedData.length === 0) {
    return (
      <div className="chart-container" style={{ width: '100%', minHeight: '300px' }}>
        <div ref={chartRef} className="efficiency-chart">
          <div className="placeholder">
            <p>No meal data available for enhanced efficiency analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '900px', display: 'flex', flexDirection: 'column' }}>
      <div ref={chartRef} className="efficiency-chart" style={{ 
        height: '600px', 
        width: '100%', 
        overflow: 'visible',
        flexShrink: 0
      }}></div>
      
      <div style={{ 
        marginTop: '40px', 
        padding: '25px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ 
          marginTop: '0', 
          marginBottom: '20px', 
          fontSize: '20px', 
          fontWeight: 'bold',
          color: '#333'
        }}>
          Enhanced Metabolic Efficiency
        </h4>
        <p style={{ marginBottom: '20px', lineHeight: '1.6', fontSize: '16px', color: '#555' }}>
          This chart uses meal timing, macronutrient balance, and individual factors to calculate metabolic efficiency scores for energy management. The efficiency line follows proper chronological order.
        </p>
        <div style={{ marginTop: '20px' }}>
          <strong style={{ fontSize: '18px', color: '#333' }}>Features:</strong>
          <ul style={{ marginTop: '15px', paddingLeft: '30px', lineHeight: '1.8', fontSize: '15px', color: '#555' }}>
            <li style={{ marginBottom: '8px' }}>Circadian rhythm timing optimization</li>
            <li style={{ marginBottom: '8px' }}>Macronutrient balance scoring</li>
            <li style={{ marginBottom: '8px' }}>Meal type weighting (breakfast vs. late-night snack)</li>
            <li style={{ marginBottom: '8px' }}>Chronologically ordered efficiency tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Condition key normaliser ────────────────────────────────────────────────
const CONDITION_KEY_MAP = {
  // comorbidConditions keys (exact IDs from PersonalSettings.js)
  'mecfs': 'me_cfs', 'pots': 'pots', 'mcas': 'mcas', 'fibro': 'fibro', 'eds': 'eds',
  // legacy / alternate spellings
  'long covid': 'long_covid', 'long_covid': 'long_covid',
  'me/cfs': 'me_cfs', 'me_cfs': 'me_cfs',
};

/**
 * Resolves active conditions from the actual Firestore profile shape:
 *   profile.severity            → Long COVID (main condition field in PersonalSettings)
 *   profile.comorbidConditions  → { mecfs, pots, mcas, fibro, eds }
 */
const resolveConditions = (profile) => {
  if (!profile) return [];
  const found = new Set();

  // 1. Long COVID — stored as profile.severity
  const lcSeverity = profile.severity || profile.covid_severity || profile.longCovidSeverity;
  if (lcSeverity && lcSeverity !== '' && lcSeverity.toLowerCase() !== 'none') {
    found.add('long_covid');
  }

  // 2. Comorbid conditions object { mecfs: 'severe', pots: 'mild', … }
  if (profile.comorbidConditions && typeof profile.comorbidConditions === 'object') {
    Object.keys(profile.comorbidConditions).forEach(key => {
      const mapped = CONDITION_KEY_MAP[key.toLowerCase()];
      if (mapped) found.add(mapped);
    });
  }

  // 3. Legacy array fields fallback
  for (const f of ['medical_conditions', 'conditions', 'medicalConditions']) {
    if (Array.isArray(profile[f])) {
      profile[f].forEach(c => {
        const mapped = CONDITION_KEY_MAP[c.toLowerCase().trim()];
        if (mapped) found.add(mapped);
      });
    }
  }

  return [...found];
};

const CONDITION_NOTES = {
  long_covid: {
    label: 'Long COVID', icon: '🦠', color: '#6366f1', bg: '#f5f3ff', border: '#c4b5fd',
    notes: [
      { nutrient: 'Calories',           guidance: 'Your needs may run 5–15% above standard TDEE due to elevated immune activity. Prioritise nutrient-dense foods; under-eating worsens fatigue and recovery.' },
      { nutrient: 'Protein',            guidance: 'Aim for 25–30% of calories (~1.2–1.6 g/kg body weight) to support tissue repair and immune function.' },
      { nutrient: 'Vitamin C',          guidance: 'Consider 200–500 mg/day (vs. ~75–90 mg RDA) to counter oxidative stress and support immune response.' },
      { nutrient: 'Vitamin D',          guidance: 'Aim for 2,000–4,000 IU/day (vs. 600–800 IU RDA) for immune modulation and fatigue reduction.' },
      { nutrient: 'B12 & B-complex',    guidance: 'Prioritize the higher end of RDA — supports mitochondrial function, nerve health, and energy metabolism.' },
      { nutrient: 'Zinc',               guidance: 'Consider 15–25 mg/day (vs. 8–11 mg RDA) to support immune function and taste/smell recovery.' },
      { nutrient: 'Magnesium',          guidance: 'Aim for 400–500 mg/day — important for nerve function, muscle recovery, and energy metabolism.' },
      { nutrient: 'Omega-3 (EPA+DHA)',  guidance: 'Target 2–4 g/day from fatty fish or supplements to reduce neuroinflammation and support brain health.' },
    ],
  },
  me_cfs: {
    label: 'ME/CFS', icon: '⚡', color: '#0891b2', bg: '#ecfeff', border: '#67e8f9',
    notes: [
      { nutrient: 'Calories',           guidance: 'Needs vary by symptom phase. Reduce portions during crashes; maintain adequate intake during stable periods — chronic under-eating accelerates muscle loss.' },
      { nutrient: 'Meal size',          guidance: 'Prefer small, frequent meals (4–6/day) — large meals worsen post-exertional fatigue.' },
      { nutrient: 'B-complex',          guidance: 'Prioritize B1, B2, B3, B6, B12, and folate at the higher end of RDA — directly support mitochondrial energy production.' },
      { nutrient: 'CoQ10',              guidance: '100–300 mg/day may support cellular energy; commonly depleted in ME/CFS.' },
      { nutrient: 'Magnesium',          guidance: 'Magnesium malate or glycinate (300–400 mg/day) supports muscle function and may reduce pain and fatigue.' },
      { nutrient: 'Carbohydrates',      guidance: 'Avoid large carbohydrate loads; focus on low-GI complex carbs to prevent post-meal energy crashes.' },
    ],
  },
  mcas: {
    label: 'MCAS', icon: '🧬', color: '#b45309', bg: '#fffbeb', border: '#fcd34d',
    notes: [
      { nutrient: 'Calories',           guidance: 'Standard TDEE applies, but low-histamine restrictions make hitting calorie targets harder. Track intake carefully to avoid under-eating.' },
      { nutrient: 'Histamine management', guidance: 'Avoid aged cheeses, fermented foods, alcohol, canned goods, tomatoes, spinach, and leftovers. Cook fresh and eat immediately.' },
      { nutrient: 'Vitamin C',          guidance: '500–2,000 mg/day acts as a natural antihistamine and DAO enzyme cofactor — take with meals.' },
      { nutrient: 'Quercetin',          guidance: '500–1,000 mg/day is a natural mast cell stabilizer; found in apples, onions, and as a supplement.' },
      { nutrient: 'DAO enzyme',         guidance: 'DAO supplements taken before meals may reduce histamine absorption from food.' },
    ],
  },
  pots: {
    label: 'POTS', icon: '💧', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc',
    notes: [
      { nutrient: 'Calories',           guidance: 'Standard TDEE applies. Distribute across 5–6 small meals — large meals divert blood to the gut and trigger orthostatic symptoms.' },
      { nutrient: 'Sodium',             guidance: 'Target 3,000–5,000 mg/day (vs. 2,300 mg standard) to increase blood volume — use under medical supervision.' },
      { nutrient: 'Fluids',             guidance: 'Aim for 2–3 L/day of water and electrolyte-containing beverages.' },
      { nutrient: 'Potassium',          guidance: 'Maintain ~3,500–4,700 mg/day alongside high sodium to support heart rhythm and blood pressure.' },
      { nutrient: 'Caffeine',           guidance: 'Limit or avoid — acts as a diuretic and may worsen heart rate instability.' },
    ],
  },
  fibro: {
    label: 'Fibromyalgia', icon: '💢', color: '#be185d', bg: '#fdf2f8', border: '#f9a8d4',
    notes: [
      { nutrient: 'Calories',           guidance: 'Standard TDEE applies. Pain and fatigue may suppress appetite — ensure adequate intake to support muscle function and avoid worsening energy levels.' },
      { nutrient: 'Magnesium',          guidance: 'Aim for 300–500 mg/day — deficiency is common in fibromyalgia and linked to increased pain sensitivity and poor sleep.' },
      { nutrient: 'Vitamin D',          guidance: 'Low vitamin D is strongly associated with fibromyalgia pain. Aim for 1,000–2,000 IU/day; test serum levels and supplement accordingly.' },
      { nutrient: 'Anti-inflammatory foods', guidance: 'Emphasize omega-3 rich fish, leafy greens, and berries; reduce refined sugars and processed foods that amplify pain signalling.' },
      { nutrient: 'Protein',            guidance: 'Adequate protein (1.0–1.2 g/kg) supports muscle repair and helps prevent weakness worsened by inactivity and pain.' },
      { nutrient: 'Tryptophan-rich foods', guidance: 'Turkey, eggs, nuts, and seeds support serotonin production, which may help with pain modulation and sleep quality.' },
    ],
  },
  eds: {
    label: 'EDS', icon: '🦴', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    notes: [
      { nutrient: 'Calories',           guidance: 'Standard TDEE applies. GI dysmotility (common in EDS) may impair absorption — smaller, more frequent meals can help if absorption is a concern.' },
      { nutrient: 'Vitamin C',          guidance: 'Aim for 500–1,000 mg/day — essential for collagen synthesis. EDS involves defective connective tissue and higher vitamin C demand.' },
      { nutrient: 'Protein',            guidance: 'Target 1.2–1.5 g/kg — amino acids (especially glycine and proline) are collagen building blocks.' },
      { nutrient: 'Magnesium',          guidance: '300–400 mg/day supports muscle tone, reduces cramping, and may help with autonomic dysregulation common in EDS.' },
      { nutrient: 'Copper & Zinc',      guidance: 'Both are cofactors for collagen cross-linking enzymes. Aim for RDA levels; excessive zinc depletes copper — balance matters.' },
      { nutrient: 'Sodium & fluids',    guidance: 'If POTS co-occurs (common in EDS), follow POTS sodium guidance (3,000–5,000 mg/day) under medical supervision.' },
    ],
  },
};

const ConditionNutritionNotes = ({ profile }) => {
  const matched = resolveConditions(profile);
  if (matched.length === 0) return null;

  return (
    <div className="condition-nutrition-notes">
      <h4 className="cnn-heading">📋 Nutrition Guidance for Your Conditions</h4>
      <p className="cnn-intro">
        The RDA values and calorie targets in the charts reflect standard recommendations. Based on your conditions, your calorie needs and nutrient requirements may differ from these baselines. The guidance below explains how and why — consult your healthcare provider before significantly changing your intake.
      </p>
      {matched.map(key => {
        const info = CONDITION_NOTES[key];
        if (!info) return null;
        return (
          <div key={key} className="cnn-condition-block" style={{ borderLeftColor: info.border, background: info.bg }}>
            <div className="cnn-condition-header" style={{ color: info.color }}>
              <span className="cnn-icon">{info.icon}</span>
              <strong>{info.label}</strong>
            </div>
            <ul className="cnn-notes-list">
              {info.notes.map(({ nutrient, guidance }) => (
                <li key={nutrient} className="cnn-note-item">
                  <span className="cnn-nutrient" style={{ color: info.color }}>{nutrient}:</span>{' '}
                  <span className="cnn-guidance">{guidance}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

function AnalysisTab({ foodLog, userProfile }) {
  const [activeProfile, setActiveProfile] = useState(userProfile);

  // Sync activeProfile when parent userProfile loads or changes
  // (profile starts null while Firestore fetches, so we must update on load)
  useEffect(() => {
    if (userProfile) setActiveProfile(userProfile);
  }, [userProfile]);

  if (!foodLog || !Array.isArray(foodLog)) {
    return (
      <div className="analysis-error">
        <h3>Data Error</h3>
        <p>Unable to load food log data. Please try refreshing the page.</p>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="analysis-error">
        <h3>Profile Error</h3>
        <p>User profile data is missing. Please check your account settings.</p>
      </div>
    );
  }

  const today = formatDateForComparison(new Date());
  const analysisDate = foodLog.length > 0 ? foodLog[0].date : today;
  const todayMeals = foodLog.filter(entry => entry.date === today);
  const { macroSums, microSums, efficiencyData } = getChartData(foodLog, activeProfile);

  return (
    <div className="food-analysis-section">
      <div className="analysis-header">
        <h3>📊 Nutritional Analysis Dashboard</h3>
        <p className="analysis-date">Analysis for {analysisDate}</p>
        <div className="analysis-summary">
          <span className="summary-stat">
            <strong>{todayMeals.length}</strong> meals logged today ({today})
          </span>
        </div>
      </div>

      {/* User Profile — at the top so the COVID toggle affects all charts below */}
      <div className="profile-card">
        <h3 className="profile-title">User Profile</h3>
        <div className="profile-grid">
          <div className="profile-item">
            <p className="profile-label">Age</p>
            <p className="profile-value">{activeProfile?.age || 'Not specified'} years</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Gender</p>
            <p className="profile-value">{activeProfile?.gender ? activeProfile.gender.charAt(0).toUpperCase() + activeProfile.gender.slice(1) : 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">BMI</p>
            <p className="profile-value">{activeProfile?.weight && activeProfile?.height ?
              (activeProfile.weight / Math.pow(activeProfile.height/100, 2)).toFixed(1) : 'N/A'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Activity Level</p>
            <p className="profile-value">{activeProfile?.activity_level || 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Medical Conditions</p>
            <p className="profile-value">
              {resolveConditions(activeProfile).length > 0
                ? resolveConditions(activeProfile)
                    .map(k => CONDITION_NOTES[k]?.label || k)
                    .join(', ')
                : 'None specified'}
            </p>
          </div>
        </div>
      </div>

      <ConditionNutritionNotes profile={activeProfile} />

      <div className="charts-container">
        
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>🎯 Macronutrient Balance</h4>
            <p className="chart-description">Your protein, carbohydrate, and fat intake compared to personalized recommendations</p>
          </div>
          <MacronutrientChart userData={activeProfile} userIntake={macroSums} />
        </div>
        
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>💊 Micronutrient Status</h4>
            <p className="chart-description">Essential vitamins and minerals as percentage of recommended daily amounts</p>
          </div>
          <MicronutrientChart data={microSums} userData={activeProfile} />
        </div>
        
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>⚡ Metabolic Efficiency</h4>
            <p className="chart-description">How effectively your body converts food calories into usable energy</p>
          </div>
          <div style={{ width: '100%', overflow: 'visible' }}>
            <EfficiencyChart data={efficiencyData} userData={activeProfile} />
          </div>
        </div>

      </div>
    </div>
  );
}

export { AnalysisTab, MacronutrientChart, MicronutrientChart, EfficiencyChart };