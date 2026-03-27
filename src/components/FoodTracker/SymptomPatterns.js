import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Calendar, BarChart3, Activity, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase-config';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import "../Common.css";
import './SymptomPatterns.css';

const SymptomPatterns = () => {
  const navigate = useNavigate();
  const [symptomData, setSymptomData] = useState({});
  const [customSymptoms, setCustomSymptoms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('overallWellbeing');
  const [hoveredDay, setHoveredDay] = useState(null);
  const [timeRange, setTimeRange] = useState(90);

  // Default symptom definitions (same as tracker)
  const defaultSymptomCategories = useMemo(() => ({
    neurological: {
      title: 'Neurological',
      icon: '🧠',
      symptoms: {
        brain_fog: { name: 'Brain Fog', description: 'Difficulty concentrating, memory issues' },
        headache: { name: 'Headache', description: 'Head pain, pressure, tension' },
        dizziness: { name: 'Dizziness', description: 'Lightheadedness, vertigo' }
      }
    },
    energy: {
      title: 'Energy & Fatigue',
      icon: '⚡',
      symptoms: {
        fatigue: { name: 'General Fatigue', description: 'Overall tiredness, lack of energy' },
        pem: { name: 'Post-Exertional Malaise', description: 'Worsening after activity' },
        sleep_issues: { name: 'Sleep Problems', description: 'Insomnia, poor sleep quality' }
      }
    },
    cardiovascular: {
      title: 'Cardiovascular',
      icon: '❤️',
      symptoms: {
        pots: { name: 'POTS Symptoms', description: 'Heart rate spikes when standing' },
        chest_pain: { name: 'Chest Pain', description: 'Chest discomfort, tightness' },
        palpitations: { name: 'Heart Palpitations', description: 'Irregular heartbeat' }
      }
    }
  }), []);

  // Combine all symptom definitions
  const allSymptoms = useMemo(() => {
    const symptoms = {};
    Object.values(defaultSymptomCategories).forEach(cat => {
      Object.entries(cat.symptoms).forEach(([id, symptom]) => {
        symptoms[id] = symptom;
      });
    });
    Object.entries(customSymptoms).forEach(([id, symptom]) => {
      symptoms[id] = symptom;
    });
    return symptoms;
  }, [defaultSymptomCategories, customSymptoms]);

  // Helper function to get local date string
  const getLocalDateString = useCallback((date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Load all symptom data from Firestore
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      if (!userId) throw new Error('No user ID found');

      // Load custom symptoms
      const customSymptomsDocRef = doc(db, 'users', userId, 'settings', 'customSymptoms');
      const customSymptomsDoc = await getDoc(customSymptomsDocRef);
      if (customSymptomsDoc.exists()) {
        setCustomSymptoms(customSymptomsDoc.data().symptoms || {});
      }

      // Load all symptom data documents
      const symptomCollectionRef = collection(db, 'users', userId, 'symptomData');
      const snapshot = await getDocs(symptomCollectionRef);

      const loadedData = {};
      snapshot.forEach(doc => {
        loadedData[doc.id] = doc.data();
      });

      setSymptomData(loadedData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);

      // Fallback to localStorage
      try {
        const existingData = JSON.parse(localStorage.getItem('symptomTrackerData') || '{}');
        const savedCustom = JSON.parse(localStorage.getItem('customSymptoms') || '{}');
        setSymptomData(existingData);
        setCustomSymptoms(savedCustom);
      } catch (e) {
        console.error('Fallback failed:', e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get severity for a symptom on a given date
  const getSymptomSeverity = useCallback((date, symptomId) => {
    const entry = symptomData[date];
    if (!entry || !entry.symptoms || !entry.symptoms[symptomId]) return null;

    const data = entry.symptoms[symptomId];
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      return Math.max(...data.map(i => i.severity || 0));
    }
    if (typeof data === 'object' && data.severity !== undefined) {
      return data.severity;
    }
    return null;
  }, [symptomData]);

  // Get value for the selected metric on a given date
  const getMetricValue = useCallback((date) => {
    const entry = symptomData[date];
    if (!entry) return null;

    if (selectedMetric === 'overallWellbeing') {
      return entry.overallWellbeing || null;
    }

    return getSymptomSeverity(date, selectedMetric);
  }, [symptomData, selectedMetric, getSymptomSeverity]);

  // Generate dates for heatmap
  const heatmapData = useMemo(() => {
    const today = new Date();
    const dates = [];

    for (let i = timeRange - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      dates.push({
        date: dateStr,
        dayOfWeek: date.getDay(),
        value: getMetricValue(dateStr),
        hasData: !!symptomData[dateStr]
      });
    }
    return dates;
  }, [timeRange, getLocalDateString, getMetricValue, symptomData]);

  // Organize heatmap into weeks for grid layout
  const heatmapWeeks = useMemo(() => {
    const weeks = [];
    let currentWeek = new Array(7).fill(null);

    heatmapData.forEach((day, index) => {
      currentWeek[day.dayOfWeek] = day;

      if (day.dayOfWeek === 6 || index === heatmapData.length - 1) {
        weeks.push([...currentWeek]);
        currentWeek = new Array(7).fill(null);
      }
    });

    return weeks;
  }, [heatmapData]);

  // Month labels for heatmap
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;

    heatmapWeeks.forEach((week, wIdx) => {
      const firstDay = week.find(d => d !== null);
      if (firstDay) {
        const date = new Date(firstDay.date + 'T12:00:00');
        const month = date.getMonth();
        if (month !== lastMonth) {
          labels.push({
            month: date.toLocaleString('default', { month: 'short' }),
            weekIndex: wIdx
          });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [heatmapWeeks]);

  // Color scales
  const getHeatmapColor = useCallback((value, hasData) => {
    if (!hasData) return 'var(--heatmap-empty)';
    if (value === null || value === undefined) return 'var(--heatmap-empty)';

    if (selectedMetric === 'overallWellbeing') {
      const colors = [
        'var(--heatmap-empty)',
        'var(--heatmap-wellbeing-1)',
        'var(--heatmap-wellbeing-2)',
        'var(--heatmap-wellbeing-3)',
        'var(--heatmap-wellbeing-4)',
        'var(--heatmap-wellbeing-5)',
      ];
      return colors[value] || 'var(--heatmap-empty)';
    } else {
      const colors = [
        'var(--heatmap-severity-0)',
        'var(--heatmap-severity-1)',
        'var(--heatmap-severity-2)',
        'var(--heatmap-severity-3)',
        'var(--heatmap-severity-4)',
        'var(--heatmap-severity-5)',
      ];
      return colors[value] || 'var(--heatmap-empty)';
    }
  }, [selectedMetric]);

  // Compute summary statistics
  const stats = useMemo(() => {
    const daysWithData = heatmapData.filter(d => d.hasData);
    const daysWithValue = heatmapData.filter(d => d.value !== null && d.value !== undefined);

    if (daysWithValue.length === 0) {
      return { avg: null, trend: 'stable', trendDiff: 0, daysTracked: daysWithData.length, daysWithSymptom: 0, maxStreak: 0, totalDays: 0 };
    }

    const values = daysWithValue.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const trendDiff = secondAvg - firstAvg;
    let trend = 'stable';
    if (Math.abs(trendDiff) > 0.3) {
      trend = trendDiff > 0 ? 'increasing' : 'decreasing';
    }

    let maxStreak = 0;
    let currentStreak = 0;
    daysWithValue.forEach(d => {
      if (selectedMetric === 'overallWellbeing' || d.value > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    const daysWithSymptom = selectedMetric !== 'overallWellbeing'
      ? values.filter(v => v > 0).length
      : daysWithValue.length;

    return {
      avg: Math.round(avg * 10) / 10,
      trend,
      trendDiff: Math.round(trendDiff * 10) / 10,
      daysTracked: daysWithData.length,
      daysWithSymptom,
      maxStreak,
      totalDays: daysWithValue.length
    };
  }, [heatmapData, selectedMetric]);

  // Day-of-week pattern analysis
  const dayOfWeekPattern = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daySums = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);

    heatmapData.forEach(d => {
      if (d.value !== null && d.value !== undefined) {
        daySums[d.dayOfWeek] += d.value;
        dayCounts[d.dayOfWeek]++;
      }
    });

    return dayNames.map((name, i) => ({
      name,
      avg: dayCounts[i] > 0 ? Math.round((daySums[i] / dayCounts[i]) * 10) / 10 : null,
      count: dayCounts[i]
    }));
  }, [heatmapData]);

  // Top symptoms by frequency
  const symptomFrequency = useMemo(() => {
    const freq = {};
    const dates = Object.keys(symptomData);

    dates.forEach(date => {
      const entry = symptomData[date];
      if (!entry || !entry.symptoms) return;

      Object.entries(entry.symptoms).forEach(([symptomId, data]) => {
        let maxSeverity = 0;
        if (Array.isArray(data)) {
          if (data.length > 0) {
            maxSeverity = Math.max(...data.map(i => i.severity || 0));
          }
        } else if (typeof data === 'object' && data.severity) {
          maxSeverity = data.severity;
        }

        if (maxSeverity > 0) {
          if (!freq[symptomId]) {
            freq[symptomId] = { count: 0, totalSeverity: 0, name: allSymptoms[symptomId]?.name || symptomId };
          }
          freq[symptomId].count++;
          freq[symptomId].totalSeverity += maxSeverity;
        }
      });
    });

    return Object.entries(freq)
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
        avgSeverity: Math.round((data.totalSeverity / data.count) * 10) / 10,
        percentage: dates.length > 0 ? Math.round((data.count / dates.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [symptomData, allSymptoms]);

  // Most common triggers
  const triggerFrequency = useMemo(() => {
    const freq = {};
    Object.values(symptomData).forEach(entry => {
      if (!entry || !entry.symptoms) return;
      Object.values(entry.symptoms).forEach(data => {
        const instances = Array.isArray(data) ? data : [data];
        instances.forEach(instance => {
          if (instance.triggers && Array.isArray(instance.triggers)) {
            instance.triggers.forEach(trigger => {
              const key = trigger.toLowerCase().trim();
              if (!freq[key]) freq[key] = { name: trigger, count: 0 };
              freq[key].count++;
            });
          }
        });
      });
    });
    return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [symptomData]);

  // Format date for tooltip
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getValueLabel = (value) => {
    if (value === null || value === undefined) return 'No data';
    if (selectedMetric === 'overallWellbeing') {
      const labels = ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
      return `${labels[value]} (${value}/5)`;
    }
    const labels = ['None', 'Mild', 'Mild-Moderate', 'Moderate', 'Moderate-Severe', 'Severe'];
    return `${labels[value]} (${value}/5)`;
  };

  // Metric options for dropdown
  const metricOptions = useMemo(() => {
    const options = [
      { value: 'overallWellbeing', label: '🌟 Overall Wellbeing', group: 'General' }
    ];

    Object.entries(defaultSymptomCategories).forEach(([catKey, cat]) => {
      Object.entries(cat.symptoms).forEach(([id, symptom]) => {
        options.push({ value: id, label: `${cat.icon} ${symptom.name}`, group: cat.title });
      });
    });

    if (Object.keys(customSymptoms).length > 0) {
      Object.entries(customSymptoms).forEach(([id, symptom]) => {
        options.push({ value: id, label: `📝 ${symptom.name}`, group: 'Custom' });
      });
    }

    return options;
  }, [defaultSymptomCategories, customSymptoms]);

  if (loading) {
    return (
      <div className="patterns-container">
        <div className="patterns-loading">
          <div className="patterns-loading-spinner" />
          <p>Loading your symptom patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patterns-container">
      {/* Floating background shapes */}
      <div className="floating-shape shape-1" />
      <div className="floating-shape shape-2" />
      <div className="floating-shape shape-3" />

      {/* Header */}
      <header className="patterns-header">
        <button onClick={() => navigate(-1)} className="patterns-back-btn">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div className="patterns-title-area">
          <h1 className="patterns-title">Symptom Patterns</h1>
          <p className="patterns-subtitle">
            {stats.daysTracked} day{stats.daysTracked !== 1 ? 's' : ''} tracked in the last {timeRange} days
          </p>
        </div>
      </header>

      {/* Controls bar */}
      <div className="patterns-controls">
        <div className="control-group">
          <label className="control-label">Viewing</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="metric-select"
          >
            {metricOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label className="control-label">Time range</label>
          <div className="range-toggle">
            {[30, 60, 90, 180].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`range-btn ${timeRange === range ? 'active' : ''}`}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon">
            <Calendar size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.daysTracked}</span>
            <span className="stat-label">Days Tracked</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {stats.avg !== null ? stats.avg : '—'}
              <span className="stat-unit">/5</span>
            </span>
            <span className="stat-label">
              {selectedMetric === 'overallWellbeing' ? 'Avg Wellbeing' : 'Avg Severity'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon trend-icon">
            {stats.trend === 'increasing' ? <TrendingUp size={18} /> :
             stats.trend === 'decreasing' ? <TrendingDown size={18} /> :
             <Minus size={18} />}
          </div>
          <div className="stat-content">
            <span className={`stat-value trend-${stats.trend}`}>
              {stats.trend === 'stable' ? 'Stable' :
               stats.trend === 'increasing' ? `+${stats.trendDiff}` :
               stats.trendDiff}
            </span>
            <span className="stat-label">Trend</span>
          </div>
        </div>
        {selectedMetric !== 'overallWellbeing' && (
          <div className="stat-card">
            <div className="stat-icon">
              <BarChart3 size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">
                {stats.daysWithSymptom}
                <span className="stat-unit">/{stats.totalDays}</span>
              </span>
              <span className="stat-label">Days Present</span>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Calendar */}
      <div className="heatmap-section">
        <div className="section-header">
          <h2 className="section-title">
            <Calendar size={20} />
            Heatmap Calendar
          </h2>
          <div className="heatmap-legend">
            {selectedMetric === 'overallWellbeing' ? (
              <>
                <span className="legend-label">Poor</span>
                {[1, 2, 3, 4, 5].map(v => (
                  <div key={v} className="legend-cell" style={{ background: getHeatmapColor(v, true) }} />
                ))}
                <span className="legend-label">Excellent</span>
              </>
            ) : (
              <>
                <span className="legend-label">None</span>
                {[0, 1, 2, 3, 4, 5].map(v => (
                  <div key={v} className="legend-cell" style={{ background: getHeatmapColor(v, true) }} />
                ))}
                <span className="legend-label">Severe</span>
              </>
            )}
            <div className="legend-cell legend-empty" />
            <span className="legend-label">No data</span>
          </div>
        </div>

        <div className="heatmap-wrapper">
          {/* Day labels */}
          <div className="heatmap-day-labels">
            <span></span>
            <span>Mon</span>
            <span></span>
            <span>Wed</span>
            <span></span>
            <span>Fri</span>
            <span></span>
          </div>

          <div className="heatmap-grid-container">
            {/* Month labels */}
            <div className="heatmap-month-labels">
              {monthLabels.map((label, i) => (
                <span
                  key={i}
                  className="month-label"
                  style={{ gridColumn: label.weekIndex + 1 }}
                >
                  {label.month}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${heatmapWeeks.length}, 1fr)` }}>
              {heatmapWeeks.map((week, wIdx) => (
                <div key={wIdx} className="heatmap-week">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      className={`heatmap-cell ${day ? 'has-day' : 'no-day'} ${hoveredDay === day?.date ? 'hovered' : ''}`}
                      style={day ? { background: getHeatmapColor(day.value, day.hasData) } : {}}
                      onMouseEnter={() => day && setHoveredDay(day.date)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {hoveredDay === day?.date && day && (
                        <div className="heatmap-tooltip">
                          <strong>{formatDate(day.date)}</strong>
                          <span>{getValueLabel(day.value)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Day of Week Patterns */}
      <div className="dow-section">
        <div className="section-header">
          <h2 className="section-title">
            <BarChart3 size={20} />
            Day of Week Patterns
          </h2>
        </div>
        <div className="dow-chart">
          {dayOfWeekPattern.map((day) => {
            const maxVal = 5;
            const height = day.avg !== null ? (day.avg / maxVal) * 100 : 0;
            return (
              <div key={day.name} className="dow-bar-container">
                <div className="dow-bar-wrapper">
                  <div
                    className="dow-bar"
                    style={{
                      height: `${height}%`,
                      background: day.avg !== null
                        ? getHeatmapColor(Math.round(day.avg), true)
                        : 'var(--heatmap-empty)'
                    }}
                  >
                    {day.avg !== null && (
                      <span className="dow-bar-value">{day.avg}</span>
                    )}
                  </div>
                </div>
                <span className="dow-label">{day.name}</span>
                <span className="dow-count">{day.count}d</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bottom-panels">
        {/* Top Symptoms */}
        <div className="panel-section">
          <div className="section-header">
            <h2 className="section-title">
              <Activity size={20} />
              Most Frequent Symptoms
            </h2>
          </div>
          {symptomFrequency.length === 0 ? (
            <div className="empty-state">
              <Info size={20} />
              <p>No symptom data recorded yet.</p>
            </div>
          ) : (
            <div className="frequency-list">
              {symptomFrequency.slice(0, 8).map((symptom, index) => (
                <div key={symptom.id} className="frequency-item">
                  <div className="frequency-rank">{index + 1}</div>
                  <div className="frequency-info">
                    <button
                      className="frequency-name-btn"
                      onClick={() => setSelectedMetric(symptom.id)}
                      title="View on heatmap"
                    >
                      {symptom.name}
                    </button>
                    <div className="frequency-bar-track">
                      <div
                        className="frequency-bar-fill"
                        style={{ width: `${symptom.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="frequency-stats">
                    <span className="frequency-count">{symptom.count}d</span>
                    <span className="frequency-severity">avg {symptom.avgSeverity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Common Triggers */}
        <div className="panel-section">
          <div className="section-header">
            <h2 className="section-title">
              <Info size={20} />
              Common Triggers
            </h2>
          </div>
          {triggerFrequency.length === 0 ? (
            <div className="empty-state">
              <Info size={20} />
              <p>No triggers recorded yet. Add triggers to symptom instances to see patterns here.</p>
            </div>
          ) : (
            <div className="trigger-cloud">
              {triggerFrequency.map((trigger) => (
                <span
                  key={trigger.name}
                  className="trigger-tag"
                  style={{
                    fontSize: `${Math.max(0.75, Math.min(1.3, 0.75 + (trigger.count / triggerFrequency[0].count) * 0.55))}rem`,
                    opacity: Math.max(0.6, trigger.count / triggerFrequency[0].count)
                  }}
                >
                  {trigger.name}
                  <span className="trigger-count">{trigger.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="patterns-error">
          <Info size={16} />
          {error}
        </div>
      )}
    </div>
  );
};

export default SymptomPatterns;
