import React from 'react';

const MicronutrientRadarChart = ({ micronutrients = {}, selectedMeal = null }) => {
  // Define the micronutrients in a FIXED order for consistent axis positions
  const fixedMicronutrientOrder = [
    'vitamin_c',
    'vitamin_d', 
    'vitamin_a',
    'vitamin_e',
    'vitamin_k',
    'vitamin_b12',
    'folate',
    'vitamin_b6',
    'thiamin',
    'riboflavin',
    'niacin',
    'calcium',
    'iron',
    'magnesium',
    'zinc',
    'potassium',
    'phosphorus',
    'sodium'
  ];

  const micronutrientMapping = {
    'vitamin_c': 'Vitamin C',
    'vitamin_d': 'Vitamin D', 
    'vitamin_e': 'Vitamin E',
    'vitamin_a': 'Vitamin A',
    'vitamin_k': 'Vitamin K',
    'thiamin': 'B1',
    'riboflavin': 'B2',
    'niacin': 'B3',
    'vitamin_b6': 'B6',
    'folate': 'Folate',
    'vitamin_b12': 'B12',
    'calcium': 'Calcium',
    'iron': 'Iron',
    'magnesium': 'Magnesium',
    'phosphorus': 'Phosphorus',
    'potassium': 'Potassium',
    'sodium': 'Sodium',
    'zinc': 'Zinc'
  };

  // Extract available micronutrients that have meaningful values
  const availableMicronutrients = fixedMicronutrientOrder.filter(key => {
    const nutrient = micronutrients[key];
    return nutrient?.value !== undefined && 
           parseFloat(nutrient.value) > 0 && 
           parseFloat(nutrient.value) < 10000; // Filter out unrealistic values
  });

  // If no micronutrients available, show a message
  if (availableMicronutrients.length === 0) {
    return (
      <div className="micronutrient-radar-container">
        <h4>🔬 Micronutrient Profile</h4>
        <div className="no-micronutrients">
          <div className="no-data-icon">📊</div>
          <p>No micronutrient data available for this food item.</p>
          {selectedMeal && (
            <p className="data-note">
              <em>Select a different food or check if micronutrient data exists in the database.</em>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Use only the available nutrients for display (dynamic chart)
  const displayNutrients = availableMicronutrients.slice(0, 8); // Limit to 8 for better visibility
  
  const chartSize = 300;
  const centerX = chartSize / 2;
  const centerY = chartSize / 2;
  const radius = 80;
  const labelRadius = radius + 35;
  
  // Calculate angles for only the nutrients we're displaying
  const totalAxes = displayNutrients.length;
  const angleStep = (2 * Math.PI) / totalAxes;

  // Calculate max value for scaling (using only displayed nutrients)
  const maxValue = Math.max(...displayNutrients.map(key => 
    parseFloat(micronutrients[key]?.value || 0)
  ));

  // Generate axis lines only for displayed nutrients
  const axisLines = displayNutrients.map((key, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    return {
      x1: centerX,
      y1: centerY,
      x2: centerX + Math.cos(angle) * radius,
      y2: centerY + Math.sin(angle) * radius,
      label: micronutrientMapping[key],
      labelX: centerX + Math.cos(angle) * labelRadius,
      labelY: centerY + Math.sin(angle) * labelRadius,
      key: key,
      angle: angle
    };
  });

  // Generate data points for displayed nutrients
  const dataPoints = displayNutrients.map((key, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const value = parseFloat(micronutrients[key]?.value || 0);
    const normalizedValue = maxValue > 0 ? Math.min(value / maxValue, 1) : 0; // Cap at 100%
    const pointRadius = normalizedValue * radius;
    
    return {
      x: centerX + Math.cos(angle) * pointRadius,
      y: centerY + Math.sin(angle) * pointRadius,
      label: micronutrientMapping[key],
      value: value,
      unit: micronutrients[key]?.unit || 'mg',
      angle: angle,
      normalizedValue: normalizedValue,
      axisIndex: index
    };
  });

  // Create polygon path - FIXED to handle all cases properly
  let polygonPath = '';
  if (dataPoints.length >= 3) {
    // Create a proper closed polygon for 3+ points
    polygonPath = dataPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ') + ' Z';
  } else if (dataPoints.length === 2) {
    // For 2 points, draw a line segment
    polygonPath = `M ${dataPoints[0].x.toFixed(2)} ${dataPoints[0].y.toFixed(2)} L ${dataPoints[1].x.toFixed(2)} ${dataPoints[1].y.toFixed(2)}`;
  }

  // Generate concentric circles for scale
  const scaleCircles = [0.25, 0.5, 0.75, 1.0].map(scale => ({
    r: radius * scale,
    opacity: scale === 1.0 ? 0.4 : 0.2
  }));

  return (
    <div className="micronutrient-radar-container">
      <h4>🔬 Micronutrient Profile</h4>
      
      <div className="radar-chart-wrapper">
        <svg width={chartSize} height={chartSize} className="radar-chart">
          {/* Background circles */}
          {scaleCircles.map((circle, index) => (
            <circle
              key={index}
              cx={centerX}
              cy={centerY}
              r={circle.r}
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="1"
              opacity={circle.opacity}
            />
          ))}
          
          {/* Axis lines */}
          {axisLines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#ccc"
              strokeWidth="1"
              opacity="0.7"
            />
          ))}
          
          {/* Data polygon/line - only render if we have valid path */}
          {polygonPath && dataPoints.length >= 3 && (
            <path
              d={polygonPath}
              fill="rgba(54, 162, 235, 0.3)"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
          
          {/* For 2 points, draw a line with different styling */}
          {polygonPath && dataPoints.length === 2 && (
            <path
              d={polygonPath}
              fill="none"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          
          {/* Data points */}
          {dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="rgba(54, 162, 235, 0.9)"
              stroke="white"
              strokeWidth="2"
            />
          ))}
          
          {/* Labels with better positioning */}
          {axisLines.map((line, index) => {
            const isRightSide = line.labelX > centerX + 10;
            const isLeftSide = line.labelX < centerX - 10;
            const isTopHalf = line.labelY < centerY;
            
            let textAnchor = "middle";
            if (isRightSide) {
              textAnchor = "start";
            } else if (isLeftSide) {
              textAnchor = "end";
            }
            
            let dominantBaseline = "middle";
            if (Math.abs(line.labelX - centerX) < 15) {
              dominantBaseline = isTopHalf ? "auto" : "hanging";
            }
            
            return (
              <text
                key={index}
                x={line.labelX}
                y={line.labelY}
                textAnchor={textAnchor}
                dominantBaseline={dominantBaseline}
                fontSize="11"
                fill="#666"
                className="radar-label"
                style={{ fontWeight: 500 }}
              >
                {line.label}
              </text>
            );
          })}
        </svg>
      </div>
      
      {/* Micronutrient values list */}
      <div className="micronutrient-values">
        <h5>📋 Detailed Values</h5>
        <div className="micronutrient-grid">
          {dataPoints.map((point, index) => (
            <div key={index} className="micronutrient-item">
              <span className="nutrient-name">{point.label}:</span>
              <span className="nutrient-value">
                {point.value < 1 ? point.value.toFixed(2) : point.value.toFixed(1)} {point.unit}
              </span>
            </div>
          ))}
        </div>
        
        {availableMicronutrients.length > displayNutrients.length && (
          <div className="additional-nutrients">
            <small>
              +{availableMicronutrients.length - displayNutrients.length} more nutrients available
            </small>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .micronutrient-radar-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border: 1px solid #e1e5e9;
        }
        
        .micronutrient-radar-container h4 {
          margin: 0 0 16px 0;
          color: #2c3e50;
          font-size: 16px;
          font-weight: 600;
        }
        
        .radar-chart-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .radar-chart {
          background: #fafafa;
          border-radius: 8px;
        }
        
        .radar-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 500;
        }
        
        .no-micronutrients {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }
        
        .no-data-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .data-note {
          font-size: 14px;
          color: #888;
          margin-top: 12px;
        }
        
        .micronutrient-values h5 {
          margin: 0 0 12px 0;
          color: #34495e;
          font-size: 14px;
          font-weight: 600;
        }
        
        .micronutrient-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .micronutrient-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 13px;
        }
        
        .nutrient-name {
          color: #495057;
          font-weight: 500;
        }
        
        .nutrient-value {
          color: #2c3e50;
          font-weight: 600;
        }
        
        .additional-nutrients {
          text-align: center;
          padding: 8px;
          color: #6c757d;
          font-style: italic;
        }
        
        @media (max-width: 768px) {
          .micronutrient-radar-container {
            padding: 16px;
          }
          
          .micronutrient-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MicronutrientRadarChart;