import React from 'react';

// Delete Confirmation Modal Component
const DeleteConfirmModal = ({ entryId, entryName, onConfirm, onCancel, deleteLoading }) => (
  <div className="modal-overlay">
    <div className="delete-confirm-modal">
      <h3>Delete Food Entry</h3>
      <p>Are you sure you want to delete this food entry?</p>
      <div className="entry-preview">
        <strong>{entryName}</strong>
      </div>
      <p className="warning-text">This action cannot be undone.</p>
      <div className="modal-actions">
        <button 
          className="cancel-button" 
          onClick={onCancel}
          disabled={deleteLoading}
        >
          Cancel
        </button>
        <button 
          className="delete-button" 
          onClick={() => onConfirm(entryId)}
          disabled={deleteLoading}
        >
          {deleteLoading ? 'Deleting...' : 'Delete Entry'}
        </button>
      </div>
    </div>
  </div>
);

const FoodJournalTab = ({
  // Data
  foodLog,
  journalPage,
  
  // Loading and error states
  logLoading,
  journalError,
  success,
  
  // Delete confirmation
  deleteConfirmId,
  setDeleteConfirmId,
  deleteLoading,
  handleDeleteEntry,
  
  // Actions
  fetchFoodLog,
  handleEditEntry,
  
  // Constants
  ENTRIES_PER_PAGE,
  
  // Utility functions
  formatDateHeader
}) => {
  
  // Helper function to convert 12-hour time to 24-hour for sorting
  const convertTo24HourForSort = (time12h) => {
    if (!time12h) return '12:00';
    
    const [time, modifier] = time12h.split(' ');
    if (!time || !modifier) return time12h;
    
    let [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours, 10);
    
    if (modifier.toUpperCase() === 'AM') {
      if (hour24 === 12) hour24 = 0;
    } else if (modifier.toUpperCase() === 'PM') {
      if (hour24 !== 12) hour24 += 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minutes}`;
  };

  // Calculate daily totals
  const calculateDayTotals = (entries) => {
    return entries.reduce((totals, entry) => {
      totals.calories += (parseFloat(entry.calories) || 0);
      totals.protein += (parseFloat(entry.protein) || 0);
      totals.carbs += (parseFloat(entry.carbs) || 0);
      totals.fat += (parseFloat(entry.fat) || 0);
      totals.meals += 1;
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
  };

  // Handle all snack types for badge display
  const getMealBadge = (mealType) => {
    switch(mealType) {
      case 'Breakfast': return 'B';
      case 'Morning Snack': return 'MS';
      case 'Lunch': return 'L';
      case 'Afternoon Snack': return 'AS';
      case 'Dinner': return 'D';
      case 'Late Night Snack': return 'LN';
      case 'Snack': return 'S';
      default: return mealType.charAt(0);
    }
  };

  return (
    <div className="food-journal-section">
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          entryId={deleteConfirmId}
          entryName={foodLog.find(entry => entry.id === deleteConfirmId)?.name || 'Unknown'}
          onConfirm={handleDeleteEntry}
          onCancel={() => setDeleteConfirmId(null)}
          deleteLoading={deleteLoading}
        />
      )}

      <div className="journal-header">
        <h3>Your Food Journal</h3>
        <button 
          className="refresh-button"
          onClick={() => fetchFoodLog(1)}
          disabled={logLoading}
        >
          {logLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {journalError && <div className="error-message">{journalError}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {logLoading && foodLog.length === 0 ? (
        <div className="loading-indicator">Loading your food journal...</div>
      ) : foodLog.length === 0 ? (
        <div className="empty-state">
          <p>No entries found in your food journal.</p>
          <p>Start by adding a meal in the "Add Food" tab!</p>
        </div>
      ) : (
        <>
          <div className="journal-summary">
            <p>Showing {foodLog.length} meal entries</p>
          </div>
          
          <div className="journal-table-container">
            {(() => {
              // Sort entries using proper date comparison
              const sortedEntries = [...foodLog].sort((a, b) => {
                if (a.date !== b.date) {
                  return b.date.localeCompare(a.date); // Works for YYYY-MM-DD format
                }
                
                const timeA = convertTo24HourForSort(a.time);
                const timeB = convertTo24HourForSort(b.time);
                return timeA.localeCompare(timeB);
              });
              
              // Group entries by date
              const groupedEntries = {};
              sortedEntries.forEach(entry => {
                if (!groupedEntries[entry.date]) {
                  groupedEntries[entry.date] = [];
                }
                groupedEntries[entry.date].push(entry);
              });
              
              return (
                <div className="journal-by-day">
                  {Object.entries(groupedEntries).map(([date, entries]) => {
                    const dayTotals = calculateDayTotals(entries);
                    
                    return (
                      <div key={date} className="day-group">
                        {/* Day Header */}
                        <div className="day-header">
                          <div className="day-header-left">
                            <h4 className="day-title">
                              {formatDateHeader(date)}
                            </h4>
                            <span className="day-meal-count">
                              {dayTotals.meals} meal{dayTotals.meals !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="day-totals">
                            <div className="day-total-item">
                              <span className="total-label">Total:</span>
                              <span className="total-value">{Math.round(dayTotals.calories)} cal</span>
                            </div>
                            <div className="day-total-macros">
                              <span className="macro-total">P: {dayTotals.protein.toFixed(1)}g</span>
                              <span className="macro-total">C: {dayTotals.carbs.toFixed(1)}g</span>
                              <span className="macro-total">F: {dayTotals.fat.toFixed(1)}g</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Day's Meals Table */}
                        <table className="food-log-table day-table">
                          <thead>
                            <tr>
                              <th className="time-col">Time</th>
                              <th className="meal-type-col">Meal</th>
                              <th className="food-col">Food</th>
                              <th className="serving-col">Serving</th>
                              <th className="macro-col">P</th>
                              <th className="macro-col">C</th>
                              <th className="macro-col">F</th>
                              <th className="calories-col">Cal</th>
                              <th className="efficiency-col">Eff%</th>
                              <th className="actions-col">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry, index) => (
                              <tr key={entry.id} className={`meal-row ${index === 0 ? 'first-meal' : ''}`}>
                                <td className="time-cell">
                                  <span className="meal-time">
                                    {entry.time.replace(':00', '').replace(' ', '')}
                                  </span>
                                </td>
                                <td className="meal-type-cell">
                                  <span className={`meal-badge ${(entry.mealType || 'unknown').trim().toLowerCase().replace(/\s+/g, '-')}`}>
                                    {getMealBadge(entry.mealType || 'Unknown')}
                                  </span>
                                </td>
                                <td className="food-cell" title={entry.name}>
                                  <span className="food-name">
                                    {entry.name.length > 25 ? `${entry.name.substring(0, 25)}...` : entry.name}
                                  </span>
                                </td>
                                <td className="serving-cell">{entry.serving || '0'}g</td>
                                <td className="macro-cell">{typeof entry.protein === 'number' ? entry.protein.toFixed(1) : (entry.protein || '0')}</td>
                                <td className="macro-cell">{typeof entry.carbs === 'number' ? entry.carbs.toFixed(1) : (entry.carbs || '0')}</td>
                                <td className="macro-cell">{typeof entry.fat === 'number' ? entry.fat.toFixed(1) : (entry.fat || '0')}</td>
                                <td className="calories-cell">
                                  <strong>{entry.calories || '0'}</strong>
                                </td>
                                <td className="efficiency-cell">
                                  <span className={`efficiency-badge ${
                                    typeof entry.metabolicEfficiency === 'number' 
                                      ? entry.metabolicEfficiency >= 80 ? 'high' : 
                                        entry.metabolicEfficiency >= 60 ? 'medium' : 'low'
                                      : 'unknown'
                                  }`}>
                                    {typeof entry.metabolicEfficiency === 'number' ? entry.metabolicEfficiency.toFixed(0) : 'N/A'}
                                  </span>
                                </td>
                                <td className="actions-cell">
                                  <div className="action-buttons compact">
                                    <button
                                      className="edit-btn compact"
                                      onClick={() => handleEditEntry(entry)}
                                      title="Edit entry"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="delete-btn compact"
                                      onClick={() => setDeleteConfirmId(entry.id)}
                                      title="Delete entry"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          
          {foodLog.length >= journalPage * ENTRIES_PER_PAGE && (
            <div className="load-more-container">
              <button 
                className="load-more-button"
                onClick={() => fetchFoodLog(journalPage + 1)}
                disabled={logLoading}
              >
                {logLoading ? 'Loading...' : 'Load More Entries'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FoodJournalTab;