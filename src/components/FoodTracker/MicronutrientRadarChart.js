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
    'sodium',
    'fiber',
    'sugar'
  ];

  const micronutrientMapping = {
    'vitamin_c': 'Vitamin C',
    'vitamin_d': 'Vitamin D', 
    'vitamin_e': 'Vitamin E',
    'vitamin_a': 'Vitamin A',
    'vitamin_k': 'Vitamin K',
    'thiamin': 'B1 (Thiamin)',
    'riboflavin': 'B2 (Riboflavin)',
    'niacin': 'B3 (Niacin)',
    'vitamin_b6': 'B6',
    'folate': 'Folate',
    'vitamin_b12': 'B12',
    'calcium': 'Calcium',
    'iron': 'Iron',
    'magnesium': 'Magnesium',
    'phosphorus': 'Phosphorus',
    'potassium': 'Potassium',
    'sodium': 'Sodium',
    'zinc': 'Zinc',
    'fiber': 'Fiber',
    'sugar': 'Sugar'
  };

  // Extract available micronutrients in FIXED order
  const availableMicronutrients = fixedMicronutrientOrder.filter(key => 
    micronutrients[key]?.value !== undefined && 
    micronutrients[key]?.value > 0
  );

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

  // Create radar chart data with FIXED axis positions
  const chartSize = 420; // Increased from 340
  //const padding = 60; // Extra padding for labels
  const centerX = chartSize / 2;
  const centerY = chartSize / 2;
  const radius = 100;
  const labelRadius = radius + 50; // Increased from 30 to 50
  
  // Use FIXED number of axes (always 20) for consistent positioning
  const totalAxes = fixedMicronutrientOrder.length;
  const angleStep = (2 * Math.PI) / totalAxes;

  // Calculate max value for scaling
  const maxValue = Math.max(...availableMicronutrients.map(key => 
    parseFloat(micronutrients[key]?.value || 0)
  ));

  // Generate ALL axis lines (including empty ones) for consistent layout
  const allAxisLines = fixedMicronutrientOrder.map((key, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    return {
      x1: centerX,
      y1: centerY,
      x2: centerX + Math.cos(angle) * radius,
      y2: centerY + Math.sin(angle) * radius,
      label: micronutrientMapping[key],
      labelX: centerX + Math.cos(angle) * labelRadius,
      labelY: centerY + Math.sin(angle) * labelRadius,
      hasData: availableMicronutrients.includes(key),
      key: key
    };
  });

  // Generate data points only for nutrients with data, but positioned according to fixed axes
  const dataPoints = availableMicronutrients.map((key) => {
    const axisIndex = fixedMicronutrientOrder.indexOf(key);
    const angle = axisIndex * angleStep - Math.PI / 2;
    const value = parseFloat(micronutrients[key]?.value || 0);
    const normalizedValue = maxValue > 0 ? (value / maxValue) : 0;
    const pointRadius = normalizedValue * radius;
    
    return {
      x: centerX + Math.cos(angle) * pointRadius,
      y: centerY + Math.sin(angle) * pointRadius,
      label: micronutrientMapping[key],
      value: value,
      unit: micronutrients[key]?.unit || 'mg',
      angle: angle,
      normalizedValue: normalizedValue,
      axisIndex: axisIndex
    };
  });

  // Create polygon path using ONLY the data points in CORRECT CLOCKWISE ORDER
  const polygonPath = dataPoints.length > 2 ? 
    dataPoints
      .sort((a, b) => a.axisIndex - b.axisIndex) // Sort by axis position for correct polygon order
      .map((point, index) => 
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ).join(' ') + ' Z'
    : dataPoints.length === 2 ?
    // For only 2 points, just draw a line (no closed polygon)
    dataPoints
      .sort((a, b) => a.axisIndex - b.axisIndex)
      .map((point, index) => 
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ).join(' ')
    : ''; // No polygon for 1 or 0 points

  // Generate concentric circles for scale
  const scaleCircles = [0.2, 0.4, 0.6, 0.8, 1.0].map(scale => ({
    r: radius * scale,
    opacity: scale === 1.0 ? 0.3 : 0.1
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
          
          {/* Axis lines - show ALL axes but style differently for data vs no-data */}
          {allAxisLines.map((line, index) => (
            <g key={index}>
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.hasData ? "#ccc" : "#f0f0f0"}
                strokeWidth="1"
                opacity={line.hasData ? "0.7" : "0.3"}
              />
            </g>
          ))}
          
          {/* Data polygon - only if we have 3+ points for a proper polygon */}
          {dataPoints.length >= 3 && polygonPath && (
            <path
              d={polygonPath}
              fill="rgba(54, 162, 235, 0.2)"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="2"
            />
          )}
          
          {/* For 2 points, draw a line instead of polygon */}
          {dataPoints.length === 2 && polygonPath && (
            <path
              d={polygonPath}
              fill="none"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="2"
            />
          )}
          
          {/* Data points */}
          {dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="rgba(54, 162, 235, 0.8)"
              stroke="white"
              strokeWidth="2"
            />
          ))}
          
          {/* Labels - show ALL labels but style differently */}
          {allAxisLines.map((line, index) => {
            const isRightSide = line.labelX > centerX;
            const isLeftSide = line.labelX < centerX;
            const isTopHalf = line.labelY < centerY;
            //const isBottomHalf = line.labelY > centerY;
            const isNearCenter = Math.abs(line.labelX - centerX) < 30;
            
            // Better text anchoring based on position
            let textAnchor = "middle";
            if (isRightSide && !isNearCenter) {
              textAnchor = "start";
            } else if (isLeftSide && !isNearCenter) {
              textAnchor = "end";
            }
            
            // Better vertical alignment
            let dominantBaseline = "middle";
            if (isNearCenter) {
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
                fill={line.hasData ? "#666" : "#ccc"}
                className="radar-label"
                style={{ 
                  fontWeight: line.hasData ? 500 : 300,
                  opacity: line.hasData ? 1 : 0.6
                }}
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
                {point.value.toFixed(1)} {point.unit}
              </span>
            </div>
          ))}
        </div>
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
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
        
        @media (max-width: 768px) {
          .micronutrient-radar-container {
            padding: 16px;
          }
          
          .radar-chart {
            width: 380px;
            height: 380px;
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