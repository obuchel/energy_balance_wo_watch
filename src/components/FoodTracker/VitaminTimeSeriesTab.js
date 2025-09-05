import React, { useState,  useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import _ from 'lodash';

const VitaminTimeSeriesTab = ({ foodLog = [], userProfile = {} }) => {
  const [selectedVitamins, setSelectedVitamins] = useState(['vitamin_c', 'vitamin_d', 'iron', 'calcium']);
  const [timeRange, setTimeRange] = useState(30); // days
  const [groupBy, setGroupBy] = useState('day'); // day, week, month
  const [showRecommended, setShowRecommended] = useState(true);
  //const [selectedUnit, setSelectedUnit] = useState('mg'); // mg, mcg, IU

  // Vitamin reference values (daily recommended intake)
  const vitaminRecommendations = {
    vitamin_a: { value: 900, unit: 'mcg', female: 700, male: 900 },
    vitamin_c: { value: 90, unit: 'mg', female: 75, male: 90 },
    vitamin_d: { value: 20, unit: 'mcg', female: 15, male: 15 },
    vitamin_e: { value: 15, unit: 'mg', female: 15, male: 15 },
    vitamin_k: { value: 120, unit: 'mcg', female: 90, male: 120 },
    thiamine: { value: 1.2, unit: 'mg', female: 1.1, male: 1.2 },
    riboflavin: { value: 1.3, unit: 'mg', female: 1.1, male: 1.3 },
    niacin: { value: 16, unit: 'mg', female: 14, male: 16 },
    vitamin_b6: { value: 1.7, unit: 'mg', female: 1.3, male: 1.7 },
    folate: { value: 400, unit: 'mcg', female: 400, male: 400 },
    vitamin_b12: { value: 2.4, unit: 'mcg', female: 2.4, male: 2.4 },
    biotin: { value: 30, unit: 'mcg', female: 30, male: 30 },
    pantothenic_acid: { value: 5, unit: 'mg', female: 5, male: 5 },
    calcium: { value: 1000, unit: 'mg', female: 1000, male: 1000 },
    iron: { value: 8, unit: 'mg', female: 18, male: 8 },
    magnesium: { value: 420, unit: 'mg', female: 320, male: 420 },
    zinc: { value: 11, unit: 'mg', female: 8, male: 11 },
    selenium: { value: 55, unit: 'mcg', female: 55, male: 55 },
    phosphorus: { value: 700, unit: 'mg', female: 700, male: 700 },
    potassium: { value: 3500, unit: 'mg', female: 2600, male: 3400 },
    sodium: { value: 2300, unit: 'mg', female: 2300, male: 2300 },
    copper: { value: 0.9, unit: 'mg', female: 0.9, male: 0.9 },
    manganese: { value: 2.3, unit: 'mg', female: 1.8, male: 2.3 },
    chromium: { value: 35, unit: 'mcg', female: 25, male: 35 },
    molybdenum: { value: 45, unit: 'mcg', female: 45, male: 45 }
  };

  // Available vitamins from food log
  const availableVitamins = useMemo(() => {
    if (!foodLog || !Array.isArray(foodLog)) return [];
    
    const vitamins = new Set();
    foodLog.forEach(entry => {
      if (entry && entry.micronutrients && typeof entry.micronutrients === 'object') {
        Object.keys(entry.micronutrients).forEach(vitamin => {
          vitamins.add(vitamin);
        });
      }
    });
    return Array.from(vitamins).sort();
  }, [foodLog]);

  // Process time series data
  const timeSeriesData = useMemo(() => {
    if (!foodLog || !Array.isArray(foodLog) || foodLog.length === 0) return [];

    // Helper function to parse local date correctly (inline)
    const parseLocalDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return new Date(dateString);
    };

    // Filter by time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    const filteredLog = foodLog.filter(entry => {
      if (!entry || !entry.date) return false;
      const entryDate = parseLocalDate(entry.date);
      return entryDate >= cutoffDate && !isNaN(entryDate.getTime());
    });

    if (filteredLog.length === 0) return [];

    // Group by time period
    const groupedData = _(filteredLog)
      .groupBy(entry => {
        const date = parseLocalDate(entry.date);
        switch (groupBy) {
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return weekStart.toISOString().split('T')[0];
          case 'month':
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
          default: // day
            return entry.date;
        }
      })
      .value();

    // Calculate daily totals for each vitamin
    const processedData = Object.entries(groupedData).map(([period, entries]) => {
      const vitaminTotals = {};
      
      entries.forEach(entry => {
        if (entry && entry.micronutrients && typeof entry.micronutrients === 'object') {
          Object.entries(entry.micronutrients).forEach(([vitamin, data]) => {
            if (!vitaminTotals[vitamin]) {
              vitaminTotals[vitamin] = 0;
            }
            const value = data && typeof data === 'object' ? data.value : data;
            vitaminTotals[vitamin] += parseFloat(value || 0);
          });
        }
      });

      return {
        period,
        date: parseLocalDate(period),
        ...vitaminTotals,
        entryCount: entries.length
      };
    });

    return processedData.sort((a, b) => a.date - b.date);
  }, [foodLog, timeRange, groupBy]);

  // Get recommendation value for vitamin based on user profile
  const getRecommendedValue = (vitamin) => {
    const rec = vitaminRecommendations[vitamin];
    if (!rec) return null;
    
    const gender = userProfile?.gender || 'female';
    return rec[gender] || rec.value;
  };

  // Color palette for different vitamins
  const vitaminColors = {
    vitamin_a: '#FF6B6B',
    vitamin_c: '#4ECDC4',
    vitamin_d: '#45B7D1',
    vitamin_e: '#96CEB4',
    vitamin_k: '#FFEAA7',
    thiamine: '#DDA0DD',
    riboflavin: '#98D8C8',
    niacin: '#F7DC6F',
    vitamin_b6: '#BB8FCE',
    folate: '#85C1E9',
    vitamin_b12: '#F8C471',
    biotin: '#82E0AA',
    pantothenic_acid: '#F1948A',
    calcium: '#AED6F1',
    iron: '#CD853F',
    magnesium: '#90EE90',
    zinc: '#DEB887',
    selenium: '#F0E68C',
    phosphorus: '#DA70D6',
    potassium: '#87CEEB',
    sodium: '#FFB6C1',
    copper: '#D2691E',
    manganese: '#9370DB',
    chromium: '#20B2AA',
    molybdenum: '#FF69B4'
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Parse the date correctly for display
      let displayDate;
      if (!label) {
        displayDate = new Date();
      } else if (label.includes('-')) {
        const parts = label.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          displayDate = new Date(year, month, day);
        } else {
          displayDate = new Date(label);
        }
      } else {
        displayDate = new Date(label);
      }
      
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
            {displayDate.toLocaleDateString()}
          </p>
          {payload.map((entry) => {
            const rec = getRecommendedValue(entry.dataKey);
            const percentage = rec ? ((entry.value / rec) * 100).toFixed(1) : null;
            const unit = vitaminRecommendations[entry.dataKey]?.unit || '';
            
            return (
              <p key={entry.dataKey} style={{ 
                margin: '4px 0', 
                color: entry.color,
                fontSize: '14px'
              }}>
                <strong>{entry.dataKey.replace(/_/g, ' ').toUpperCase()}:</strong> {entry.value?.toFixed(2)} {unit}
                {percentage && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                    ({percentage}% of RDA)
                  </span>
                )}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Handle vitamin selection
  const handleVitaminToggle = (vitamin) => {
    setSelectedVitamins(prev => 
      prev.includes(vitamin) 
        ? prev.filter(v => v !== vitamin)
        : [...prev, vitamin]
    );
  };

  // Preset vitamin groups
  const vitaminGroups = {
    'Water Soluble': ['vitamin_c', 'thiamine', 'riboflavin', 'niacin', 'vitamin_b6', 'folate', 'vitamin_b12', 'biotin', 'pantothenic_acid'],
    'Fat Soluble': ['vitamin_a', 'vitamin_d', 'vitamin_e', 'vitamin_k'],
    'Major Minerals': ['calcium', 'phosphorus', 'magnesium', 'sodium', 'potassium'],
    'Trace Minerals': ['iron', 'zinc', 'copper', 'manganese', 'selenium', 'chromium', 'molybdenum']
  };

  const selectVitaminGroup = (groupName) => {
    const group = vitaminGroups[groupName];
    const availableInGroup = group.filter(v => availableVitamins.includes(v));
    setSelectedVitamins(availableInGroup);
  };

  return (
    <div className="vitamin-timeseries-tab" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: '#2c3e50' }}>
          📈 Nutrient Trends Over Time
        </h3>
        
        {/* Controls */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px',
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          {/* Time Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Time Range:
            </label>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 2 weeks</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 2 months</option>
              <option value={90}>Last 3 months</option>
              <option value={180}>Last 6 months</option>
            </select>
          </div>

          {/* Group By */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Group By:
            </label>
            <select 
              value={groupBy} 
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>

          {/* Show Recommended Lines */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', marginTop: '32px' }}>
              <input 
                type="checkbox" 
                checked={showRecommended}
                onChange={(e) => setShowRecommended(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Show recommended intake lines
            </label>
          </div>
        </div>

        {/* Vitamin Group Presets */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Quick Select:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.keys(vitaminGroups).map(groupName => (
              <button
                key={groupName}
                onClick={() => selectVitaminGroup(groupName)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #007bff',
                  backgroundColor: 'white',
                  color: '#007bff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#007bff'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
              >
                {groupName}
              </button>
            ))}
            <button
              onClick={() => setSelectedVitamins([])}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #dc3545',
                backgroundColor: 'white',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Vitamin Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Select Vitamins/Minerals to Track ({selectedVitamins.length} selected):
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '8px',
            maxHeight: '150px',
            overflowY: 'auto',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white'
          }}>
            {availableVitamins.map(vitamin => (
              <label key={vitamin} style={{ 
                display: 'flex', 
                alignItems: 'center',
                padding: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input 
                  type="checkbox"
                  checked={selectedVitamins.includes(vitamin)}
                  onChange={() => handleVitaminToggle(vitamin)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: vitaminColors[vitamin] || '#666' }}>
                  ● {vitamin.replace(/_/g, ' ').toUpperCase()}
                </span>
                {vitaminRecommendations[vitamin] && (
                  <span style={{ marginLeft: '4px', fontSize: '11px', color: '#666' }}>
                    (RDA: {getRecommendedValue(vitamin)} {vitaminRecommendations[vitamin].unit})
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {timeSeriesData.length > 0 && selectedVitamins.length > 0 ? (
        <div style={{ height: '500px', width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="period"
                tickFormatter={(value) => {
                  // Handle date formatting correctly for local timezone
                  if (!value) return '';
                  if (value.includes('-')) {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                      const year = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10) - 1;
                      const day = parseInt(parts[2], 10);
                      const date = new Date(year, month, day);
                      return date.toLocaleDateString();
                    }
                  }
                  return new Date(value).toLocaleDateString();
                }}
                stroke="#666"
              />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {selectedVitamins.map(vitamin => (
                <Line
                  key={vitamin}
                  type="monotone"
                  dataKey={vitamin}
                  stroke={vitaminColors[vitamin] || '#666'}
                  strokeWidth={2}
                  dot={{ fill: vitaminColors[vitamin] || '#666', strokeWidth: 2, r: 4 }}
                  connectNulls={false}
                  name={vitamin.replace(/_/g, ' ').toUpperCase()}
                />
              ))}

              {/* Recommended intake reference lines */}
              {showRecommended && selectedVitamins.map(vitamin => {
                const recommendedValue = getRecommendedValue(vitamin);
                return recommendedValue ? (
                  <ReferenceLine
                    key={`${vitamin}-ref`}
                    y={recommendedValue}
                    stroke={vitaminColors[vitamin] || '#666'}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    label={{ 
                      value: `${vitamin.replace(/_/g, ' ').toUpperCase()} RDA`, 
                      position: 'topRight',
                      fontSize: 10
                    }}
                  />
                ) : null;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#666'
        }}>
          {timeSeriesData.length === 0 ? (
            <p>No food data available for the selected time range.</p>
          ) : (
            <p>Please select at least one vitamin or mineral to display the chart.</p>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {selectedVitamins.length > 0 && timeSeriesData.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>Summary Statistics</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {selectedVitamins.map(vitamin => {
              const values = timeSeriesData
                .map(d => d[vitamin])
                .filter(v => v !== undefined && v !== null);
              
              if (values.length === 0) return null;

              const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
              const max = Math.max(...values);
              const min = Math.min(...values);
              const recommended = getRecommendedValue(vitamin);
              const avgPercentage = recommended ? ((avg / recommended) * 100).toFixed(1) : null;
              const isPersonalized = vitaminRecommendations[vitamin]?.isPersonalized;

              return (
                <div key={vitamin} style={{
                  padding: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}>
                  <h5 style={{ 
                    margin: '0 0 8px 0',
                    color: vitaminColors[vitamin] || '#666'
                  }}>
                    {vitamin.replace(/_/g, ' ').toUpperCase()}
                  </h5>
                  <div style={{ fontSize: '14px' }}>
                    <div>Average: <strong>{avg.toFixed(2)} {vitaminRecommendations[vitamin]?.unit}</strong></div>
                    <div>Range: {min.toFixed(2)} - {max.toFixed(2)} {vitaminRecommendations[vitamin]?.unit}</div>
                    {recommended && (
                      <>
                        <div>
                          {isPersonalized ? 'Personalized RDA' : 'RDA'}: {recommended} {vitaminRecommendations[vitamin]?.unit}
                          {isPersonalized && <span style={{ color: '#2196f3', fontWeight: 'bold' }}>*</span>}
                        </div>
                        <div style={{ 
                          color: parseFloat(avgPercentage) >= 100 ? '#28a745' : 
                                 parseFloat(avgPercentage) >= 75 ? '#ffc107' : '#dc3545'
                        }}>
                          Average intake: <strong>{avgPercentage}% of {isPersonalized ? 'personalized' : 'standard'} RDA</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personalization Notice */}
      {Object.values(vitaminRecommendations).some(v => v.isPersonalized) && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1565c0', fontSize: '16px' }}>
            📋 Personalized Recommendations
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1976d2' }}>
            Values marked with <span style={{ fontWeight: 'bold', color: '#2196f3' }}>*</span> have been 
            personalized based on your profile:
          </p>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#1976d2' }}>
            {userProfile?.gender === 'female' && (
              <li>Gender-specific adjustments (e.g., higher iron needs for women)</li>
            )}
            {userProfile?.age && (userProfile.age >= 50 || userProfile.age <= 18) && (
              <li>Age-based modifications (e.g., increased vitamin D for elderly)</li>
            )}
            {(userProfile?.hasLongCovid || userProfile?.longCovidSeverity) && (
              <li>Long COVID severity adjustments for immune support nutrients</li>
            )}
            {(userProfile?.activityLevel === 'high' || userProfile?.activityLevel === 'very_high') && (
              <li>Enhanced requirements for active lifestyle</li>
            )}
          </ul>
          {(userProfile?.hasLongCovid || userProfile?.longCovidSeverity) && (
            <div style={{ 
              marginTop: '12px', 
              padding: '8px', 
              backgroundColor: '#fff3e0', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#e65100'
            }}>
              <strong>Long COVID Note:</strong> Recommendations for vitamin C, D, zinc, and selenium 
              have been increased based on your severity level to support immune function and recovery.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VitaminTimeSeriesTab;