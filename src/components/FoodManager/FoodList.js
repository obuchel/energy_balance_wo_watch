import React, { useState, useMemo } from 'react';
import './FoodManager.css';

function FoodList({ foods, searchTerm, onSearchChange, onSelectFood, onShowComparison }) {
  const [sortBy, setSortBy] = useState('name'); // 'name', 'category', 'match_score'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'fndds', 'no_fndds', 'high_match', 'low_match'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(foods.map(f => f.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [foods]);

  // Filter and sort foods
  const processedFoods = useMemo(() => {
    let filtered = [...foods];

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }

    // Apply FNDDS filter
    switch (filterBy) {
      case 'fndds':
        filtered = filtered.filter(f => f.fndds_metadata);
        break;
      case 'no_fndds':
        filtered = filtered.filter(f => !f.fndds_metadata);
        break;
      case 'high_match':
        filtered = filtered.filter(f => 
          f.fndds_metadata && f.fndds_metadata.match_score >= 0.8
        );
        break;
      case 'low_match':
        filtered = filtered.filter(f => 
          f.fndds_metadata && f.fndds_metadata.match_score < 0.7
        );
        break;
      default:
        break;
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'match_score':
          const scoreA = a.fndds_metadata?.match_score || 0;
          const scoreB = b.fndds_metadata?.match_score || 0;
          return scoreB - scoreA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [foods, filterBy, sortBy, categoryFilter]);

  const getMatchScoreBadge = (food) => {
    if (!food.fndds_metadata) {
      return <span className="badge badge-gray">No FNDDS</span>;
    }

    const score = food.fndds_metadata.match_score;
    if (score >= 0.9) {
      return <span className="badge badge-green">Excellent {(score * 100).toFixed(0)}%</span>;
    } else if (score >= 0.8) {
      return <span className="badge badge-blue">Good {(score * 100).toFixed(0)}%</span>;
    } else if (score >= 0.7) {
      return <span className="badge badge-yellow">Fair {(score * 100).toFixed(0)}%</span>;
    } else {
      return <span className="badge badge-orange">Poor {(score * 100).toFixed(0)}%</span>;
    }
  };

  return (
    <div className="food-list-container">
      {/* Controls */}
      <div className="list-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search foods by name or category..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Name (A-Z)</option>
              <option value="category">Category</option>
              <option value="match_score">Match Score</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Filter:</label>
            <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
              <option value="all">All Foods</option>
              <option value="fndds">Has FNDDS Data</option>
              <option value="no_fndds">No FNDDS Data</option>
              <option value="high_match">High Match (≥80%)</option>
              <option value="low_match">Low Match (&lt;70%)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Category:</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        Showing {processedFoods.length} of {foods.length} foods
      </div>

      {/* Food Table */}
      <div className="food-table-container">
        <table className="food-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>FNDDS Match</th>
              <th>Match Score</th>
              <th>Food Code</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedFoods.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-results">
                  No foods found matching your criteria
                </td>
              </tr>
            ) : (
              processedFoods.map(food => (
                <tr key={food.id} className="food-row">
                  <td className="food-name">
                    <strong>{food.name}</strong>
                    {food.fndds_metadata?.updated && (
                      <span className="updated-indicator" title="Modified by FNDDS">✓</span>
                    )}
                  </td>
                  <td className="food-category">
                    {food.category || <span className="text-muted">—</span>}
                  </td>
                  <td className="fndds-match">
                    {food.fndds_metadata ? (
                      <span title={`Matched to: ${food.fndds_metadata.matched_food}`}>
                        {food.fndds_metadata.matched_food}
                      </span>
                    ) : (
                      <span className="text-muted">Not matched</span>
                    )}
                  </td>
                  <td className="match-score">
                    {getMatchScoreBadge(food)}
                  </td>
                  <td className="food-code">
                    {food.fndds_metadata?.food_code || <span className="text-muted">—</span>}
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => onSelectFood(food)}
                      className="btn-action btn-edit"
                      title="Edit food"
                    >
                      ✏️ Edit
                    </button>
                    {food.fndds_metadata && (
                      <button
                        onClick={() => onShowComparison(food)}
                        className="btn-action btn-compare"
                        title="Compare with FNDDS"
                      >
                        🔍 Compare
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FoodList;