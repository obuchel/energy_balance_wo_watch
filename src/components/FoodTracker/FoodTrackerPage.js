import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
collection, 
query, 
getDocs, 
addDoc, 
deleteDoc,
updateDoc,
doc,
getDoc,
Timestamp, 
orderBy, 
limit
} from 'firebase/firestore';
import { db } from '../../firebase-config';
import "../Common.css";
import './FoodTrackerPage.css';

import * as FoodTrackerAnalysis from './FoodTrackerAnalysis';
import MicronutrientRadarChart from './MicronutrientRadarChart';
const AnalysisTab = FoodTrackerAnalysis.AnalysisTab;


// TIMEZONE UTILITIES - Centralized timezone handling
// TIMEZONE UTILITIES - Fixed and more robust
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const getTodayInUserTimezone = () => {
  const userTimezone = getUserTimezone();
  const today = new Date();
  
  // Get the date string in user's timezone in YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(today);
  const year = parts.find(part => part.type === 'year').value;
  const month = parts.find(part => part.type === 'month').value;
  const day = parts.find(part => part.type === 'day').value;
  
  return `${year}-${month}-${day}`;
};

const getDaysAgoInUserTimezone = (daysAgo) => {
  const userTimezone = getUserTimezone();
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  // Get the date string in user's timezone in YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year').value;
  const month = parts.find(part => part.type === 'month').value;
  const day = parts.find(part => part.type === 'day').value;
  
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  
  // For YYYY-MM-DD format, create date in local timezone
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    
    // Create date object in local timezone (not UTC)
    return new Date(year, month, day);
  }
  
  return new Date(dateString);
};

const formatDateHeader = (dateString) => {
  if (!dateString) return '';

  try {
    const date = parseLocalDate(dateString);
    if (!date || isNaN(date.getTime())) return dateString;

    const today = getTodayInUserTimezone();
    const yesterday = getDaysAgoInUserTimezone(1);
    
    console.log('Date comparison:', {
      dateString,
      today,
      yesterday,
      isToday: dateString === today,
      isYesterday: dateString === yesterday
    });

    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: getUserTimezone() // Ensure formatting is in user's timezone
    };
    
    const formattedDate = date.toLocaleDateString('en-US', options);

    if (dateString === today) {
      return `Today - ${formattedDate}`;
    } else if (dateString === yesterday) {
      return `Yesterday - ${formattedDate}`;
    } else {
      return formattedDate;
    }
  } catch (error) {
    console.warn('Error formatting date header:', error);
    return dateString;
  }
};

// Debug function to help diagnose timezone issues
const debugTimezone = (context = '') => {
  const userTimezone = getUserTimezone();
  const now = new Date();
  const localToday = getTodayInUserTimezone();
  const utcToday = now.toISOString().split('T')[0];
  const localTime = now.toLocaleString('en-US', { timeZone: userTimezone });

  console.log(`🌍 Timezone Debug ${context}:`, {
    userTimezone,
    localToday,
    utcToday,
    timezoneOffset: now.getTimezoneOffset(),
    localTime,
    currentTime: now.toString()
  });

  return { userTimezone, localToday, utcToday };
};

// Call this to see what's happening with your dates
window.debugTimezone = debugTimezone;



// Replace your date state initialization with:
// const [date, setDate] = useState(() => initializeDate());

// Add this effect to debug date issues when the component loads:




/*const debugTimezone = (context = '') => {
const userTimezone = getUserTimezone();
const now = new Date();
const localToday = getTodayInUserTimezone();
const utcToday = now.toISOString().split('T')[0];

console.log(`🌍 Timezone Debug ${context}:`, {
userTimezone,
localToday,
utcToday,
timezoneOffset: now.getTimezoneOffset(),
localTime: now.toLocaleString()
});

return { userTimezone, localToday, utcToday };
};*/

// MAIN COMPONENT CONSTANTS
const mealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
const TABS = ['Add Food', 'Food Journal', 'Analysis'];
const ENTRIES_PER_PAGE = 20;

function FoodTrackerPage() {
const navigate = useNavigate();

// State declarations
const [allFoodsCache, setAllFoodsCache] = useState([]);
const [pyodideStatus, setPyodideStatus] = useState('loading');
const [searchFocused, setSearchFocused] = useState(false);

// User and authentication state
const [currentUser, setCurrentUser] = useState(null);
const [userProfile, setUserProfile] = useState({
age: 30,
gender: 'female',
weight: 65,
height: 165,
activityLevel: 'moderate',
hasLongCovid: false,
longCovidSeverity: 'moderate'
});
const [authLoading, setAuthLoading] = useState(true);

// UI state
const [tab, setTab] = useState('Add Food');

// Add Food state
const [search, setSearch] = useState('');
const [suggestions, setSuggestions] = useState([]);
const [selectedMeal, setSelectedMeal] = useState(null);
const [fields, setFields] = useState({});
const [mealType, setMealType] = useState('Breakfast');
const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
const [date, setDate] = useState(() => getTodayInUserTimezone()); // FIXED: Use consistent timezone function
const [longCovidAdjust, setLongCovidAdjust] = useState(true);
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState('');
const [error, setError] = useState('');

// Food Journal state
const [foodLog, setFoodLog] = useState([]);
const [logLoading, setLogLoading] = useState(false);
const [journalError, setJournalError] = useState('');
const [journalPage, setJournalPage] = useState(1);

// Edit/Delete state
const [editingEntry, setEditingEntry] = useState(null);
const [deleteConfirmId, setDeleteConfirmId] = useState(null);
const [deleteLoading, setDeleteLoading] = useState(false);

// Suggestion cache for performance
const [suggestionCache, setSuggestionCache] = useState({});

// Handle logout
const handleLogout = async () => {
console.log('Logout clicked - starting complete logout process');

try {
localStorage.removeItem('userData');
sessionStorage.clear();
setCurrentUser(null);
setAuthLoading(false);
navigate('/login', { replace: true });
} catch (error) {
console.error('Error during logout:', error);
localStorage.removeItem('userData');
sessionStorage.clear();
setCurrentUser(null);
navigate('/login', { replace: true });
}
};

// Delete Confirmation Modal Component
const DeleteConfirmModal = ({ entryId, entryName, onConfirm, onCancel }) => (
<div className="modal-overlay">
<div className="delete-confirm-modal">
<h3>🗑️ Delete Food Entry</h3>
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

// Handle delete entry
const handleDeleteEntry = async (entryId) => {
if (!currentUser || !entryId) return;

setDeleteLoading(true);
setJournalError('');

try {
await deleteDoc(doc(db, 'users', currentUser.id, 'food_journal', entryId));
setFoodLog(prevLog => prevLog.filter(entry => entry.id !== entryId));
setSuccess('Food entry deleted successfully!');
setTimeout(() => setSuccess(''), 3000);
} catch (err) {
console.error('Error deleting entry:', err);
setJournalError(`Failed to delete entry: ${err.message}`);
} finally {
setDeleteLoading(false);
setDeleteConfirmId(null);
}
};

// Handle edit entry
// Replace your existing handleEditEntry function with this enhanced version:
const handleEditEntry = (entry) => {
  // Set all the form fields from the entry
  setFields({
    name: entry.name,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    calories: entry.calories,
    serving: entry.serving || 100,
    micronutrients: entry.micronutrients || {},
    longCovidBenefits: entry.longCovidBenefits || [],
    longCovidCautions: entry.longCovidCautions || [],
    longCovidRelevance: entry.longCovidRelevance || {},
  });

  setMealType(entry.mealType);
  setTime(entry.time);
  setDate(entry.date);
  setLongCovidAdjust(entry.longCovidAdjust || false);
  setSearch(entry.name);
  setEditingEntry(entry);
  
  // Try to find the original meal data to enable recalculation
  const originalMeal = allFoodsCache.find(meal => 
    meal.name.toLowerCase() === entry.name.toLowerCase() || 
    meal.id === entry.mealId
  );
  
  if (originalMeal) {
    setSelectedMeal(originalMeal);
    console.log('Original meal found for editing:', originalMeal.name);
  } else {
    // If no original meal found, create a mock meal object for recalculation
    const mockMeal = {
      name: entry.name,
      nutritional_metrics: {
        nutrients_per_100g: {
          protein: { value: (entry.protein / (entry.serving || 100)) * 100 },
          carbs: { value: (entry.carbs / (entry.serving || 100)) * 100 },
          fat: { value: (entry.fat / (entry.serving || 100)) * 100 },
          calories: { value: (entry.calories / (entry.serving || 100)) * 100 },
        }
      }
    };
    setSelectedMeal(mockMeal);
    console.log('Created mock meal for editing:', entry.name);
  }
  
  setTab('Add Food');
};

const handleLogFood = async () => {
  console.log('=== LOGGING FOOD ===');
  console.log('Date being saved:', date);
  debugTimezone('Before Save');

if (!currentUser || !currentUser.id) {
setError('Please log in to save your meals');
return;
}

setLoading(true);
setError('');
setSuccess('');

try {
if (!fields.name) {
throw new Error('Food name is required');
}

const entryData = {
name: fields.name,
protein: parseFloat(fields.protein) || 0,
carbs: parseFloat(fields.carbs) || 0,
fat: parseFloat(fields.fat) || 0,
calories: parseFloat(fields.calories) || 0,
serving: parseFloat(fields.serving) || 100,
micronutrients: fields.micronutrients || {},
mealType,
time,
date,
longCovidAdjust,
longCovidBenefits: fields.longCovidBenefits || [],
longCovidCautions: fields.longCovidCautions || [],
longCovidRelevance: fields.longCovidRelevance || {},
mealId: selectedMeal?.id || null
};

entryData.metabolicEfficiency = calculateMetabolicEfficiency(entryData);

if (editingEntry) {
await updateDoc(
  doc(db, 'users', currentUser.id, 'food_journal', editingEntry.id), 
  {
    ...entryData,
    updatedAt: Timestamp.now()
  }
);

setFoodLog(prevLog => 
  prevLog.map(entry => 
    entry.id === editingEntry.id 
      ? { ...entry, ...entryData, id: editingEntry.id }
      : entry
  )
);

setSuccess('Food entry updated successfully!');
setEditingEntry(null);
} else {
entryData.createdAt = Timestamp.now();

const docRef = await addDoc(
  collection(db, 'users', currentUser.id, 'food_journal'), 
  entryData
);

const newEntry = { id: docRef.id, ...entryData };
setFoodLog(prevLog => [newEntry, ...prevLog]);
setSuccess('Food logged successfully!');
}

setFields({});
setSelectedMeal(null);
setSearch('');
} catch (err) {
console.error('Error logging food:', err);
setError(`Failed to ${editingEntry ? 'update' : 'log'} food: ${err.message}`);
} finally {
setLoading(false);
}
};

// Cancel edit mode
const handleCancelEdit = () => {
setEditingEntry(null);
setFields({});
setSelectedMeal(null);
setSearch('');
setSuccess('');
setError('');
};

// Fetch user profile from Firestore
const fetchUserProfile = async (uid) => {
try {
const userDocRef = doc(db, 'users', uid);
const userDoc = await getDoc(userDocRef);

if (userDoc.exists()) {
const userData = userDoc.data();
setUserProfile(userData);
} else {
console.log('No user profile found in database');
setUserProfile(null);
}
} catch (err) {
console.error("Error fetching user profile:", err);
setError('Failed to load user profile');
setUserProfile(null);
}
};

// Authentication check function
const checkUserAuthentication = useCallback(async () => {
try {
const storedUserData = localStorage.getItem('userData');

if (!storedUserData) {
navigate('/login');
return;
}

const parsedUserData = JSON.parse(storedUserData);
setCurrentUser(parsedUserData);

if (parsedUserData.id) {
await fetchUserProfile(parsedUserData.id);
} else {
console.log('No user ID found - user profile not loaded');
setUserProfile(null);
}
} catch (error) {
console.error("Error checking authentication:", error);
navigate('/login');
} finally {
setAuthLoading(false);
}
}, [navigate]);

// Authentication effect
useEffect(() => {
checkUserAuthentication();
}, [checkUserAuthentication]);



// Long COVID Food Information Component
const LongCovidFoodInfo = ({ foodName, mealData }) => {
if (mealData && (mealData.longCovidRelevance || mealData.longCovidBenefits || mealData.longCovidCautions)) {
const covidRelevance = mealData.longCovidRelevance || {};
const benefits = mealData.longCovidBenefits || [];
const cautions = mealData.longCovidCautions || [];
const functionalCompounds = mealData.functionalCompounds || {};

let category = 'neutral';
if (benefits.length > cautions.length) category = 'beneficial';
if (cautions.length > benefits.length) category = 'caution';

const antiInflammatoryLevel = covidRelevance.antiInflammatory || 'unknown';

return (
<div className={`long-covid-food-info ${category}`}>
  <div className="food-info-header">
    <span className={`category-icon ${category}`}>
      {category === 'beneficial' ? '✅' : 
       category === 'caution' ? '⚠️' : 'ℹ️'}
    </span>
    <strong>Database Analysis: {foodName}</strong>
  </div>
  
  <div className="inflammatory-level">
    <h5>🔥 Anti-Inflammatory Level</h5>
    <div className={`level-indicator level-${antiInflammatoryLevel}`}>
      <span className="level-value"> {antiInflammatoryLevel.toUpperCase()}</span>
      <span className="level-description">
        {antiInflammatoryLevel === 'high' ? 'Excellent for reducing inflammation' :
         antiInflammatoryLevel === 'moderate' ? 'Moderately helpful for inflammation' :
         antiInflammatoryLevel === 'low' ? 'Limited anti-inflammatory effects' :
         antiInflammatoryLevel === 'neutral' ? 'No significant inflammatory impact' : 'Not assessed'}
      </span>
    </div>
  </div>

  {Object.keys(functionalCompounds).length > 0 && (
    <div className="functional-compounds">
      <h5>🧬 Functional Compounds</h5>
      <div className="compounds-grid">
        {Object.entries(functionalCompounds).map(([compound, level]) => (
          <div key={compound} className="compound-item">
            <span className="compound-name">{compound.replace(/_/g, ' ')}</span>
            <span className={`compound-level level-${level}`}> {level}</span>
          </div>
        ))}
      </div>
    </div>
  )}
  
  {benefits.length > 0 && (
    <div className="benefits-list">
      <h5>✨ Benefits for Long COVID Recovery</h5>
      <ul>
        {benefits.map((benefit, i) => (
          <li key={i}>{benefit}</li>
        ))}
      </ul>
    </div>
  )}
  
  {cautions.length > 0 && (
    <div className="cautions-list">
      <h5>⚠️ Important Considerations</h5>
      <ul>
        {cautions.map((caution, i) => (
          <li key={i}>{caution}</li>
        ))}
      </ul>
    </div>
  )}
</div>
);
}

return (
<div className="no-food-info">
<div className="no-data-icon">📊</div>
<h4>No Long COVID Data Available</h4>
<p>This food doesn't have specific Long COVID information in our database yet.</p>
<p>Consider general anti-inflammatory principles:</p>
<ul className="general-tips">
  <li>Choose whole, unprocessed versions when possible</li>
  <li>Pay attention to how it affects your symptoms</li>
  <li>Consider portion sizes and frequency</li>
  <li>Pair with known anti-inflammatory foods</li>
</ul>
</div>
);
};

// Long COVID Side Panel Component
const LongCovidSidePanel = ({ selectedFood, selectedMeal, foodLog = [], isSearching = false, searchTerm = '' }) => {
if (selectedFood && selectedMeal) {
return (
<div className="long-covid-side-panel">
  <h3>🦠 Long COVID Nutrition Guide</h3>
  <div className="selected-food-analysis">
    <LongCovidFoodInfo foodName={selectedFood} mealData={selectedMeal} />
    
    <div className="back-to-guide">
      <p className="guide-hint">
        <em>Clear selection to see the full nutrition guide</em>
      </p>
    </div>
  </div>
</div>
);
}

if (isSearching && searchTerm.length >= 2) {
return (
<div className="long-covid-side-panel">
  <h3>🦠 Long COVID Nutrition Guide</h3>
  
  <div className="search-status">
    <p className="search-hint">
      <em>Searching for "{searchTerm}"... Select a food above to see its specific analysis.</em>
    </p>
  </div>
  
  <div className="nutrition-categories">
    <div className="category-section beneficial">
      <h4>✅ Quick Anti-Inflammatory Guide</h4>
      <p>Focus on omega-3 rich fish, berries, leafy greens, and anti-inflammatory spices.</p>
    </div>
  </div>
</div>
);
}

return (
<div className="long-covid-side-panel">
<h3>🦠 Long COVID Nutrition Guide</h3>

<div className="nutrition-categories">
  <div className="category-section beneficial">
    <h4>✅ Anti-Inflammatory Foods</h4>
    <ul>
      <li><strong>Fatty Fish:</strong> Salmon, mackerel, sardines (omega-3s)</li>
      <li><strong>Berries:</strong> Blueberries, strawberries (antioxidants)</li>
      <li><strong>Leafy Greens:</strong> Spinach, kale (vitamins, minerals)</li>
      <li><strong>Nuts:</strong> Walnuts, almonds (healthy fats)</li>
      <li><strong>Turmeric:</strong> Contains curcumin (anti-inflammatory)</li>
      <li><strong>Ginger:</strong> Natural anti-inflammatory</li>
      <li><strong>Green Tea:</strong> Polyphenols reduce inflammation</li>
    </ul>
  </div>

  <div className="category-section neutral">
    <h4>ℹ️ Recommended Foods</h4>
    <ul>
      <li><strong>Whole Grains:</strong> Oats, quinoa, brown rice</li>
      <li><strong>Lean Proteins:</strong> Chicken, turkey, legumes</li>
      <li><strong>Citrus Fruits:</strong> High in vitamin C</li>
      <li><strong>Olive Oil:</strong> Monounsaturated fats</li>
      <li><strong>Garlic & Onions:</strong> Immune support</li>
    </ul>
  </div>

  <div className="category-section caution">
    <h4>⚠️ Foods to Limit</h4>
    <ul>
      <li><strong>Processed Foods:</strong> High in inflammation-promoting ingredients</li>
      <li><strong>Refined Sugars:</strong> Can worsen inflammation</li>
      <li><strong>Red/Processed Meat:</strong> May increase inflammatory markers</li>
      <li><strong>Trans Fats:</strong> Found in margarine, processed foods</li>
      <li><strong>Refined Carbs:</strong> White bread, pastries</li>
      <li><strong>Fried Foods:</strong> High in inflammatory compounds</li>
    </ul>
  </div>
</div>

<div className="additional-tips">
  <h4>💡 General Tips</h4>
  <ul>
    <li>Stay well hydrated (8+ glasses water daily)</li>
    <li>Consider vitamin D supplementation</li>
    <li>Eat regular, smaller meals to maintain energy</li>
    <li>Focus on nutrient-dense, whole foods</li>
    <li>Limit alcohol and caffeine if they worsen symptoms</li>
  </ul>
</div>
</div>
);
};

// Helper function for COVID food rating
const getCovidFoodRating = (foodName) => {
const foodLower = foodName.toLowerCase();

const beneficial = [
'salmon', 'mackerel', 'sardines', 'tuna', 'trout',
'blueberries', 'strawberries', 'raspberries', 'blackberries',
'spinach', 'kale', 'broccoli', 'brussels sprouts',
'walnuts', 'almonds', 'chia seeds', 'flax seeds',
'turmeric', 'ginger', 'garlic', 'onion',
'olive oil', 'avocado', 'sweet potato',
'green tea', 'dark chocolate'
];

const caution = [
'processed meat', 'bacon', 'sausage', 'hot dog',
'french fries', 'fried chicken', 'fried',
'white bread', 'white rice', 'pastry',
'candy', 'soda', 'sugar', 'margarine',
'ice cream', 'chips'
];

if (beneficial.some(food => foodLower.includes(food))) return 'beneficial';
if (caution.some(food => foodLower.includes(food))) return 'caution';
return 'neutral';
};

// Utility functions
const convertTo24Hour = (time12h) => {
if (!time12h) return '';

const [time, modifier] = time12h.split(' ');
if (!time || !modifier) return time12h;

let [hours, minutes] = time.split(':');

if (hours === '12') {
hours = '00';
}

if (modifier === 'PM') {
hours = String(parseInt(hours, 10) + 12);
}

hours = String(hours);

return `${hours.padStart(2, '0')}:${minutes}`;
};

const handleTimeChange = (e) => {
const time24 = e.target.value;
if (!time24) return;

const date = new Date(`2000-01-01T${time24}`);
const time12 = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

setTime(time12);
};

// Calculate metabolic efficiency
const calculateMetabolicEfficiency = (mealData) => {
const timeStr = mealData.time;
const hourMatch = timeStr.match(/(\d+):/);
const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
const isPM = timeStr.toLowerCase().includes('pm');

let hour24 = hour;
if (isPM && hour !== 12) hour24 += 12;
if (!isPM && hour === 12) hour24 = 0;

const proteinFactor = (parseFloat(mealData.protein) || 0) * 0.2;
const carbFactor = (parseFloat(mealData.carbs) || 0) * 0.1;
const fatFactor = (parseFloat(mealData.fat) || 0) * 0.15;

let timeFactor = 1.0;
if (hour24 < 6 || hour24 > 20) {
timeFactor = 0.7;
} else if (hour24 >= 7 && hour24 <= 10) {
timeFactor = 1.2;
} else if (hour24 >= 17 && hour24 <= 19) {
timeFactor = 0.9;
}

const mealTypeFactors = {
'Breakfast': 1.3,
'Morning Snack': 0.9,
'Lunch': 1.1,
'Afternoon Snack': 0.8,
'Dinner': 0.9,
'Late Night Snack': 0.6,
'Snack': 0.8
};
const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;

const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
let efficiency = macroBalance * timeFactor * mealTypeFactor;

if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
const severityFactors = {
'mild': 0.95,
'moderate': 0.85,
'severe': 0.75,
'very severe': 0.65
};

const severityFactor = severityFactors[userProfile.longCovidSeverity] || 0.85;
efficiency *= severityFactor;

if (mealData.longCovidBenefits && mealData.longCovidBenefits.length > 0) {
efficiency *= 1.1;
}

if (mealData.longCovidCautions && mealData.longCovidCautions.length > 0) {
efficiency *= 0.9;
}
}

return Math.min(100, Math.max(0, efficiency));
};
// Serving Suggestions Component
const ServingSuggestions = ({ selectedMeal, onServingSelect, currentServing }) => {
  if (!selectedMeal || !selectedMeal.nutritional_metrics) return null;

  const { serving_options, common_portions } = selectedMeal.nutritional_metrics;
  
  const handleServingClick = (weight, description) => {
    onServingSelect(weight, description);
  };

  return (
    <div className="serving-suggestions">
      <h4>📏 Serving Size Suggestions</h4>
      
      {serving_options && Object.keys(serving_options).length > 0 && (
        <div className="serving-category">
          <h5>Standard Serving Options</h5>
          <div className="serving-buttons">
            {Object.entries(serving_options).map(([key, option]) => (
              <button
                key={key}
                className={`serving-button ${currentServing === option.weight ? 'selected' : ''}`}
                onClick={() => handleServingClick(option.weight, option.description)}
                title={option.description}
              >
                <span className="serving-weight">{option.weight}g</span>
                <span className="serving-description">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {common_portions && Object.keys(common_portions).length > 0 && (
        <div className="serving-category">
          <h5>Common Portions</h5>
          <div className="serving-buttons">
            {Object.entries(common_portions).map(([key, portion]) => (
              <button
                key={key}
                className={`serving-button ${currentServing === portion.weight ? 'selected' : ''}`}
                onClick={() => handleServingClick(portion.weight, portion.description)}
                title={portion.description}
              >
                <span className="serving-weight">{portion.weight}g</span>
                <span className="serving-description">{portion.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="serving-note">
        <small>💡 Click any suggestion to automatically set the serving size and update nutrition values</small>
      </div>
    </div>
  );
};

// Enhanced handleSelectMeal function (replace the existing one around line 1200)
const handleSelectMeal = (meal) => {
  console.log('handleSelectMeal called with:', meal.name);
  
  setSelectedMeal(meal);
  setSearch(meal.name);
  setSuggestions([]); // Clear suggestions immediately
  setSearchFocused(false); // Close the dropdown
  
  // Check if meal has new nutritional_metrics structure or old nutrients structure
  const nutrients = meal.nutritional_metrics?.nutrients_per_100g || meal.nutrients?.per100g || {};
  
  // Set default serving - try to use the first serving option if available
  let defaultServing = 100;
  if (meal.nutritional_metrics?.serving_options) {
    const firstOption = Object.values(meal.nutritional_metrics.serving_options)[0];
    if (firstOption?.weight) {
      defaultServing = firstOption.weight;
    }
  } else if (meal.nutritional_metrics?.common_portions) {
    const firstPortion = Object.values(meal.nutritional_metrics.common_portions)[0];
    if (firstPortion?.weight) {
      defaultServing = firstPortion.weight;
    }
  }

  setFields({
    name: meal.name,
    protein: nutrients.protein?.value || '',
    carbs: nutrients.carbs?.value || '',
    fat: nutrients.fat?.value || '',
    calories: nutrients.calories?.value || '',
    serving: defaultServing,
    micronutrients: nutrients,
    longCovidBenefits: meal.longCovidBenefits || [],
    longCovidCautions: meal.longCovidCautions || [],
    longCovidRelevance: meal.longCovidRelevance || {},
  });

  // Recalculate nutrients for the default serving
  if (defaultServing !== 100) {
    setTimeout(() => recalculateNutrients(defaultServing), 100);
  }

  // Force blur the search input
  setTimeout(() => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.blur();
    }
  }, 100);
};

// New function to handle serving selection from suggestions
const handleServingSelection = (weight, description) => {
  setFields(prev => ({ ...prev, serving: weight }));
  recalculateNutrients(weight);
  
  // Optional: Show a brief success message
  setSuccess(`Serving set to ${description}`);
  setTimeout(() => setSuccess(''), 2000);
};

// Enhanced recalculateNutrients function (replace the existing one around line 1100)
const recalculateNutrients = (newServing) => {
  if (!selectedMeal) {
    console.log('No selected meal for recalculation');
    return;
  }
  
  const serving = parseFloat(newServing);
  if (isNaN(serving) || serving <= 0) {
    console.log('Invalid serving size for recalculation:', newServing);
    return;
  }
  
  // Check for new nutritional_metrics structure first, then fall back to old structure
  const nutrients = selectedMeal.nutritional_metrics?.nutrients_per_100g || 
                   selectedMeal.nutrients?.per100g || {};

  const ratio = serving / 100;
  
  console.log('Recalculating nutrients:', {
    selectedMeal: selectedMeal.name,
    newServing: serving,
    ratio: ratio,
    originalNutrients: nutrients
  });

  setFields(prevFields => {
    const updatedFields = { ...prevFields, serving: serving };

    // Update main macronutrients
    if (nutrients.protein?.value !== undefined) {
      updatedFields.protein = (nutrients.protein.value * ratio).toFixed(1);
    }
    if (nutrients.carbs?.value !== undefined) {
      updatedFields.carbs = (nutrients.carbs.value * ratio).toFixed(1);
    }
    if (nutrients.fat?.value !== undefined) {
      updatedFields.fat = (nutrients.fat.value * ratio).toFixed(1);
    }
    if (nutrients.calories?.value !== undefined) {
      updatedFields.calories = (nutrients.calories.value * ratio).toFixed(0);
    }

    // Update micronutrients
    updatedFields.micronutrients = {};
    Object.entries(nutrients).forEach(([key, value]) => {
      if (!['protein', 'carbs', 'fat', 'calories', 'name', 'unit'].includes(key) && value?.value !== undefined) {
        updatedFields.micronutrients[key] = {
          ...value,
          value: (value.value * ratio).toFixed(1)
        };
      }
    });

    console.log('Updated fields after recalculation:', updatedFields);
    return updatedFields;
  });
};




// In the JSX, add the ServingSuggestions component in the Add Food section
// Replace the existing nutrition fields section (around line 1700) with this enhanced version:


// Recalculate nutrients when serving size changes


// Debounce hook for search
const useDebounce = (value, delay) => {
const [debouncedValue, setDebouncedValue] = useState(value);

useEffect(() => {
const handler = setTimeout(() => {
setDebouncedValue(value);
}, delay);

return () => clearTimeout(handler);
}, [value, delay]);

return debouncedValue;
};

const debouncedSearch = useDebounce(search, 300);

// Enhanced AI-powered search with fallback to JavaScript
// First, let's check if the Python search engine is properly loaded
// Replace your fetchSuggestions function with this diagnostic version:

// Replace your entire fetchSuggestions function with this simplified working version:

const fetchSuggestions = useCallback(async () => {
  const normalizedSearch = search.toLowerCase().trim();

  console.log('fetchSuggestions called with:', normalizedSearch);

  if (normalizedSearch.length < 2) {
    setSuggestions([]);
    return;
  }

  // Check cache first
  if (suggestionCache[normalizedSearch]) {
    console.log('Using cached results for:', normalizedSearch);
    setSuggestions(suggestionCache[normalizedSearch]);
    return;
  }

  try {
    console.log(`🔍 Search for: "${normalizedSearch}"`);

    let allFoods = allFoodsCache;
    if (allFoods.length === 0) {
      console.log('📥 Fetching food database...');
      const q = query(
        collection(db, 'meals'),
        limit(1000)
      );

      const snap = await getDocs(q);
      allFoods = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data()
      }));

      setAllFoodsCache(allFoods);
      console.log(`📊 Loaded ${allFoods.length} foods into cache`);
    }

    // Simple JavaScript search that actually works
    const results = allFoods
      .filter(meal => {
        if (!meal.name) return false;
        
        const mealNameLower = meal.name.toLowerCase();
        const category = (meal.category || '').toLowerCase();
        const description = (meal.description || '').toLowerCase();
        
        return mealNameLower.includes(normalizedSearch) ||
               mealNameLower.startsWith(normalizedSearch) ||
               category.includes(normalizedSearch) ||
               description.includes(normalizedSearch) ||
               mealNameLower.split(' ').some(word => word.startsWith(normalizedSearch));
      })
      .sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        
        // Exact matches first
        if (aName === normalizedSearch && bName !== normalizedSearch) return -1;
        if (bName === normalizedSearch && aName !== normalizedSearch) return 1;
        
        // Starts with search term
        if (aName.startsWith(normalizedSearch) && !bName.startsWith(normalizedSearch)) return -1;
        if (bName.startsWith(normalizedSearch) && !aName.startsWith(normalizedSearch)) return 1;
        
        // Alphabetical otherwise
        return aName.localeCompare(bName);
      })
      .slice(0, 15)
      .map(food => ({
        ...food,
        searchMethod: 'javascript',
        searchScore: 0.8
      }));

    console.log(`✅ Found ${results.length} results`);

    // Cache the results
    setSuggestionCache(prev => ({
      ...prev,
      [normalizedSearch]: results
    }));

    setSuggestions(results);

  } catch (err) {
    console.error('❌ Search error:', err);
    setSuggestions([]);
  }
}, [search, suggestionCache, allFoodsCache]);

// Simplified renderSearchInput function:
const renderSearchInput = () => (
  <div className="form-group search-group">
    <label>Search Food</label>
    <div className={`search-input-container ${searchFocused ? 'search-focused' : ''}`}>
      <input
        type="text"
        value={search}
        onChange={e => { 
          const newValue = e.target.value;
          setSearch(newValue); 
          setSelectedMeal(null);
          if (newValue.length < 2) {
            setSuggestions([]);
          }
        }}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setSearchFocused(false);
            setSuggestions([]);
          }, 200);
        }}
        placeholder="Search foods..."
        autoComplete="off"
        className="search-input"
      />

      {/* Clear button */}
      {search.length > 0 && (
        <button 
          onClick={clearSearch}
          className="clear-search-button"
          type="button"
          title="Clear search"
        >
          ✕
        </button>
      )}

      <div className="search-status">
        {suggestions.length > 0 && (
          <span className="result-count">({suggestions.length} results)</span>
        )}
      </div>
    </div>

    {suggestions.length > 0 && searchFocused && (
      <ul className="suggestions-list">
        {suggestions.map((s, index) => (
          <li 
            key={s.id || index} 
            onClick={() => handleSelectMeal(s)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="suggestion-main">
              <div className="suggestion-name">{s.name}</div>
              {s.category && (
                <div className="suggestion-category">{s.category}</div>
              )}
            </div>
            
            <div className="suggestion-indicators">
              {longCovidAdjust && (
                <span className={`covid-indicator ${getCovidFoodRating(s.name)}`}>
                  {getCovidFoodRating(s.name) === 'beneficial' ? '✅' : 
                   getCovidFoodRating(s.name) === 'caution' ? '⚠️' : 'ℹ️'}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);


// Remove the unused clearSearch function warning by using it:
const clearSearch = () => {
  setSearch('');
  setSuggestions([]);
  setSelectedMeal(null);
  setSearchFocused(false);
  setFields({});
};


// Remove the complex Pyodide monitoring and replace with simple status:
useEffect(() => {
  setPyodideStatus('unavailable'); // Simplify for now
}, []);



const debugPythonSetup = async () => {
  if (!window.pyodideReady) {
    console.log('❌ Pyodide not ready');
    return;
  }
  
  try {
    console.log('🔧 Testing Python setup...');
    
    // Test basic Python functionality
    const basicTest = await window.pyodide.runPython(`
import json
json.dumps({"python_working": True, "test": "hello"})
    `);
    console.log('Basic Python test:', JSON.parse(basicTest));
    
    // Check what modules are available
    const modulesTest = await window.pyodide.runPython(`
import json
import sys
modules = list(sys.modules.keys())
json.dumps({"modules_count": len(modules), "has_json": "json" in modules})
    `);
    console.log('Modules test:', JSON.parse(modulesTest));
    
    // Test search engine
    const engineTest = await window.pyodide.runPython(`
import json
try:
    engine_info = {
        "exists": "search_engine" in globals(),
        "type": str(type(search_engine)) if "search_engine" in globals() else "not_found"
    }
    json.dumps(engine_info)
except Exception as e:
    json.dumps({"error": str(e)})
    `);
    console.log('Search engine test:', JSON.parse(engineTest));
    
  } catch (error) {
    console.error('❌ Python debug failed:', error);
  }
};

// You can call this function from the browser console to test: debugPythonSetup()
window.debugPythonSetup = debugPythonSetup;
// Also add a function to clear search and reset the form:


// Monitor Pyodide status for AI search capabilities
useEffect(() => {
const checkPyodideStatus = () => {
if (window.pyodideReady) {
setPyodideStatus('ready');
} else if (window.pyodide) {
setPyodideStatus('loading');
} else {
setPyodideStatus('unavailable');
}
};

checkPyodideStatus();

const handlePyodideReady = () => {
setPyodideStatus('ready');
console.log('🎉 Pyodide ready event received');
};

const handlePyodideError = () => {
setPyodideStatus('unavailable');
console.log('⚠️ Pyodide error event received');
};

window.addEventListener('pyodideReady', handlePyodideReady);
window.addEventListener('pyodideError', handlePyodideError);

const interval = setInterval(checkPyodideStatus, 2000);

return () => {
window.removeEventListener('pyodideReady', handlePyodideReady);
window.removeEventListener('pyodideError', handlePyodideError);
clearInterval(interval);
};
}, []);



// Keep your useEffect simple:
useEffect(() => {
  console.log('=== TIMEZONE DEBUG ON LOAD ===');
  debugTimezone('Component Load');
  
  const today = getTodayInUserTimezone();
  const yesterday = getDaysAgoInUserTimezone(1);
  
  console.log('Date calculations:', {
    today,
    yesterday,
    currentDateState: date
  });
}, [date]); // Added 'date' dependency to fix the warning

// Keep your search useEffect separate:
useEffect(() => {
  if (debouncedSearch.length < 2) {
    setSuggestions([]);
    return;
  }
  fetchSuggestions();
}, [debouncedSearch, fetchSuggestions]);


// Handle field changes
const handleFieldChange = (e) => {
  const { name, value } = e.target;

  if (name === 'serving') {
    setFields(prev => ({ ...prev, [name]: value }));
    // Only recalculate if we have a selected meal with original nutrition data
    if (selectedMeal) {
      recalculateNutrients(value);
    }
  } else {
    setFields(prev => ({ ...prev, [name]: value }));
  }
};

// Fetch food log function
const fetchFoodLog = useCallback(async (page = 1) => {
if (!currentUser || !currentUser.id) return;

setLogLoading(true);
if (page === 1) setFoodLog([]);
setJournalError('');

try {
const q = query(
collection(db, 'users', currentUser.id, 'food_journal'),
orderBy('date', 'desc'),
orderBy('createdAt', 'desc'),
limit(ENTRIES_PER_PAGE * page)
);

const snap = await getDocs(q);
const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

setFoodLog(entries);
setJournalPage(page);

} catch (err) {
console.error('Error fetching food log:', err);
setJournalError(`Failed to load journal: ${err.message}`);
} finally {
setLogLoading(false);
}
}, [currentUser]);

// Fetch food log when user is authenticated (regardless of tab)
useEffect(() => {
if (currentUser && !authLoading) {
fetchFoodLog(1);
}
}, [currentUser, authLoading, fetchFoodLog]);

// Back navigation
const handleBack = () => {
navigate('/dashboard');
};

// Loading state
if (authLoading) {
return (
<div className="food-tracker-container">
<div className="loading-indicator">Loading...</div>
</div>
);
}

// Authentication required state
if (!currentUser) {
return (
<div className="food-tracker-container">
<div className="auth-required">
  <h2>Authentication Required</h2>
  <p>Please log in to use the food tracker.</p>
  <button onClick={handleBack} className="back-button">
    Back to Dashboard
  </button>
</div>
</div>
);
}

return (
<div className="food-tracker-container">
{/* Animated background elements */}
<div className="bg-animation">
<div className="card-glow"></div>
<div className="floating-shape shape-1"></div>
<div className="floating-shape shape-2"></div>
<div className="floating-shape shape-3"></div>
<div className="floating-shape shape-4"></div>
<div className="floating-shape shape-5"></div>
<div className="floating-shape shape-6"></div>
</div>

<div className="food-tracker-content">
{/* Delete Confirmation Modal */}
{deleteConfirmId && (
  <DeleteConfirmModal
    entryId={deleteConfirmId}
    entryName={foodLog.find(entry => entry.id === deleteConfirmId)?.name || 'Unknown'}
    onConfirm={handleDeleteEntry}
    onCancel={() => setDeleteConfirmId(null)}
  />
)}

{/* Header */}
<div className="tracker-header">
  <button onClick={handleBack} className="back-button">
    ← Back to Dashboard
  </button>
  <button onClick={handleLogout} className="logout-btn">
    Logout
  </button>
</div>

{/* Title */}
<h2>🍽️ Smart Meal Tracker</h2>

{/* AI Status Banner */}
<div className={`ai-status-banner ${pyodideStatus}`}>
  {pyodideStatus === 'ready' && (
    <div className="ai-ready">
      🚀 <strong>AI Search Enabled:</strong> Advanced food matching with intelligent recommendations
    </div>
  )}
  {pyodideStatus === 'loading' && (
    <div className="ai-loading">
      🔄 <strong>Loading AI:</strong> Preparing enhanced search capabilities...
    </div>
  )}
  {pyodideStatus === 'unavailable' && (
    <div className="ai-fallback">
      📝 <strong>Basic Search:</strong> AI unavailable, using standard search
    </div>
  )}
</div>

<div className="food-tabs">
  {TABS.map(t => (
    <button
      key={t}
      className={`food-tab${tab === t ? ' active' : ''}`}
      onClick={() => setTab(t)}
    >
      {t}
    </button>
  ))}
</div>

{tab === 'Add Food' && (
  <div className="food-form-section">
    <div className="food-form-left">
      {/* Edit Mode Indicator */}
      {editingEntry && (
        <div className="edit-mode-banner">
          <div className="edit-indicator">
            <span className="edit-icon">✏️</span>
            <span className="edit-text">
              <strong>Editing:</strong> {editingEntry.name}
            </span>
          </div>
          <button 
            className="cancel-edit-btn"
            onClick={handleCancelEdit}
            type="button"
          >
            Cancel Edit
          </button>
        </div>
      )}

      {/* Long COVID Checkbox */}
      <div className="form-group long-covid-checkbox-group">
        <label className="long-covid-checkbox-label">
          <input 
            type="checkbox" 
            checked={longCovidAdjust} 
            onChange={e => setLongCovidAdjust(e.target.checked)} 
            className="long-covid-checkbox"
          /> 
          <span className="checkbox-text">
            I have Long COVID - Show food recommendations and adjustments
          </span>
        </label>
        {longCovidAdjust && (
          <div className="long-covid-info-banner">
            <p>🔬 <strong>Long COVID Mode:</strong> Food recommendations will be adjusted to focus on anti-inflammatory options that may help manage symptoms and support recovery.</p>
          </div>
        )}
      </div>

      {renderSearchInput()}

     {/* Nutrition fields with serving suggestions */}
{selectedMeal && (
  <ServingSuggestions 
    selectedMeal={selectedMeal}
    onServingSelect={handleServingSelection}
    currentServing={fields.serving}
  />
)}

<div className="form-row">
  <div className="form-group">
    <input 
      name="protein" 
      value={fields.protein || ''} 
      onChange={handleFieldChange} 
      type="number"
      step="0.1"
      placeholder=" "
      readOnly={selectedMeal} // Make read-only when a meal is selected to prevent confusion
    />
    <label>Protein (g)</label>
  </div>
  <div className="form-group">
    <input 
      name="carbs" 
      value={fields.carbs || ''} 
      onChange={handleFieldChange} 
      type="number"
      step="0.1"
      placeholder=" "
      readOnly={selectedMeal}
    />
    <label>Carbs (g)</label>
  </div>
  <div className="form-group">
    <input 
      name="fat" 
      value={fields.fat || ''} 
      onChange={handleFieldChange} 
      type="number"
      step="0.1"
      placeholder=" "
      readOnly={selectedMeal}
    />
    <label>Fat (g)</label>
  </div>
  <div className="form-group">
    <input 
      name="serving" 
      value={fields.serving || ''} 
      onChange={handleFieldChange}
      type="number"
      step="1"
      className="serving-input"
      placeholder=" "
    />
    <label>Serving (g)</label>
  </div>
</div>

      {/* Meal details */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="meal-type">Meal Type</label>
          <select 
            id="meal-type" 
            value={mealType} 
            onChange={e => setMealType(e.target.value)}
          >
            {mealTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <input 
            type="time" 
            value={convertTo24Hour(time)} 
            onChange={handleTimeChange}
            placeholder=" "
          />
          <label>Time</label>
        </div>
        <div className="form-group">
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            placeholder=" "
          />
          <label>Date</label>
        </div>
      </div>

      {/* Calories field */}
      <div className="form-group">
        <input 
          name="calories" 
          value={fields.calories || ''} 
          onChange={handleFieldChange} 
          type="number"
          step="1"
          placeholder=" "
        />
        <label>Calories</label>
      </div>

      <div className="form-group">
        <button 
          className={`submit-button ${editingEntry ? 'update-mode' : ''}`}
          onClick={handleLogFood}
          disabled={loading || !fields.name}
        >
          {loading ? 
            (editingEntry ? 'Updating...' : 'Logging...') : 
            (editingEntry ? 'Update Food' : 'Log Food')
          }
        </button>
        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>

    <div className="food-form-right">
      {longCovidAdjust && (
        <LongCovidSidePanel 
          selectedFood={fields.name} 
          selectedMeal={selectedMeal}
          foodLog={foodLog}
          isSearching={search.length >= 2 && !selectedMeal}
          searchTerm={search}
        />
      )}


{/* ADD THIS: Micronutrient Radar Chart */}
{selectedMeal && fields.micronutrients && Object.keys(fields.micronutrients).length > 0 && (
  <MicronutrientRadarChart 
    micronutrients={fields.micronutrients}
    selectedMeal={selectedMeal}
  />
)}


      {!longCovidAdjust && (
        <div className="general-nutrition-info">
          <h3>📊 Nutrition Tips</h3>
          <p>Enable Long COVID mode above to get personalized food recommendations and anti-inflammatory guidance.</p>
          {pyodideStatus === 'ready' && (
            <div className="ai-tip">
              <p>💡 <strong>AI Tip:</strong> The search above uses machine learning to find the most relevant foods for your queries!</p>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
)}
{tab === 'Food Journal' && (
  <div className="food-journal-section">
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
            
            // FIXED: Sort entries using proper date comparison
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
            
            // FIXED: Use timezone-aware date formatting
            const formatDateHeaderFixed = (dateString) => {
              return formatDateHeader(dateString);
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
              <div className="journal-by-day">
                {Object.entries(groupedEntries).map(([date, entries]) => {
                  const dayTotals = calculateDayTotals(entries);
                  
                  return (
                    <div key={date} className="day-group">
                      {/* Day Header */}
                      <div className="day-header">
                        <div className="day-header-left">
                          <h4 className="day-title">
                            {formatDateHeaderFixed(date)}
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
)}

{tab === 'Analysis' && (
  <AnalysisTab 
    foodLog={foodLog} 
    userProfile={userProfile} 
  />
)}
</div>
</div>
);
}
export default FoodTrackerPage;