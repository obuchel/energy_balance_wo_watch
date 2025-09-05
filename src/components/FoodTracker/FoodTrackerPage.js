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

// Import separated tab components
import AddFoodTab from './AddFoodTab';
import FoodJournalTab from './FoodJournalTab';
import { AnalysisTab } from './FoodTrackerAnalysis';
import MicronutrientRadarChart from './MicronutrientRadarChart';
import VitaminTimeSeriesTab from './VitaminTimeSeriesTab'; // ADD THIS LINE

// TIMEZONE UTILITIES - Centralized timezone handling
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const getTodayInUserTimezone = () => {
  const userTimezone = getUserTimezone();
  const today = new Date();
  
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
  
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
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

    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: getUserTimezone()
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

// MAIN COMPONENT CONSTANTS
const mealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
const TABS = ['Add Food', 'Food Journal', 'Analysis','Trends'];
const ENTRIES_PER_PAGE = 20;

function FoodTrackerPage() {
  const navigate = useNavigate();

  // State declarations
  const [allFoodsCache, setAllFoodsCache] = useState([]);
  const [pyodideStatus] = useState('unavailable');
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
  const [date, setDate] = useState(() => getTodayInUserTimezone());
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
  const handleEditEntry = (entry) => {
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
    
    const originalMeal = allFoodsCache.find(meal => 
      meal.name.toLowerCase() === entry.name.toLowerCase() || 
      meal.id === entry.mealId
    );
    
    if (originalMeal) {
      setSelectedMeal(originalMeal);
      console.log('Original meal found for editing:', originalMeal.name);
    } else {
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

  // Enhanced handleSelectMeal function
  const handleSelectMeal = (meal) => {
    console.log('handleSelectMeal called with:', meal.name);
    
    setSelectedMeal(meal);
    setSearch(meal.name);
    setSuggestions([]);
    setSearchFocused(false);
    
    const nutrients = meal.nutritional_metrics?.nutrients_per_100g || meal.nutrients?.per100g || {};
    
    let defaultServing = 100;
    let defaultUnit = 'g';
    let defaultDescription = '100g serving';
    
    if (meal.nutritional_metrics?.serving_options) {
      const firstOption = Object.values(meal.nutritional_metrics.serving_options)[0];
      if (firstOption?.weight) {
        defaultServing = firstOption.weight;
        defaultUnit = firstOption.unit || 'g';
        defaultDescription = firstOption.description;
      }
    }

    console.log('Setting default serving:', { defaultServing, defaultUnit, defaultDescription });

    const ratio = calculateServingRatio(defaultServing, defaultUnit, meal);
    
    setFields({
      name: meal.name,
      protein: (nutrients.protein?.value * ratio).toFixed(1),
      carbs: (nutrients.carbs?.value * ratio).toFixed(1),
      fat: (nutrients.fat?.value * ratio).toFixed(1),
      calories: (nutrients.calories?.value * ratio).toFixed(0),
      serving: defaultServing,
      servingUnit: defaultUnit,
      servingDescription: defaultDescription,
      micronutrients: nutrients,
      longCovidBenefits: meal.longCovidBenefits || [],
      longCovidCautions: meal.longCovidCautions || [],
      longCovidRelevance: meal.longCovidRelevance || {},
    });

    setTimeout(() => {
      setFields(prev => ({ ...prev }));
    }, 50);
  };

  // Helper function to calculate serving ratio with unit conversion
  const calculateServingRatio = (serving, unit = 'g', meal) => {
    if (unit === 'ml') {
      const density = getDensityForFood(meal?.name) || 1.0;
      const weightInGrams = serving * density;
      return weightInGrams / 100;
    } else {
      return serving / 100;
    }
  };

  const getDensityForFood = (foodName) => {
    if (!foodName || typeof foodName !== 'string') {
      return 1.0;
    }
    
    const foodLower = foodName.toLowerCase();
    
    const densityMap = {
      'water': 1.0,
      'milk': 1.03,
      'cream': 1.0,
      'oil': 0.92,
      'juice': 1.05,
      'soup': 1.0,
      'broth': 1.0,
      'stock': 1.0,
      'coffee': 1.0,
      'tea': 1.0,
      'wine': 0.99,
      'beer': 1.0,
      'yogurt': 1.1,
      'smoothie': 1.1,
      'sauce': 1.1,
      'syrup': 1.3,
      'honey': 1.4
    };
    
    for (const [key, density] of Object.entries(densityMap)) {
      if (foodLower.includes(key)) {
        return density;
      }
    }
    
    return 1.0;
  };

  // New function to handle serving selection from suggestions
  const handleServingSelection = (weight, description, unit = 'g') => {
    console.log('Serving selection:', { weight, description, unit });
    
    if (!selectedMeal) {
      console.error('No selected meal for serving calculation');
      return;
    }
    
    const weightNumber = parseFloat(weight);
    if (isNaN(weightNumber) || weightNumber <= 0) {
      console.error('Invalid weight provided:', weight);
      return;
    }
    const ratio = calculateServingRatio(weightNumber, unit, selectedMeal);
    
    const nutrients = selectedMeal?.nutritional_metrics?.nutrients_per_100g || 
                     selectedMeal?.nutrients?.per100g || {};
    
    if (!nutrients || Object.keys(nutrients).length === 0) {
      console.warn('No nutrition data found for selected meal');
      setFields(prev => ({
        ...prev,
        serving: weightNumber,
        servingUnit: unit
      }));
      return;
    }
    
    const newNutrition = {
      protein: ((nutrients.protein?.value || 0) * ratio).toFixed(1),
      carbs: ((nutrients.carbs?.value || 0) * ratio).toFixed(1),
      fat: ((nutrients.fat?.value || 0) * ratio).toFixed(1),
      calories: ((nutrients.calories?.value || 0) * ratio).toFixed(0)
    };
    
    console.log('Calculated nutrition for serving:', newNutrition);
    
    setFields(prev => ({
      ...prev,
      serving: weightNumber,
      servingUnit: unit,
      protein: newNutrition.protein,
      carbs: newNutrition.carbs,
      fat: newNutrition.fat,
      calories: newNutrition.calories
    }));
    
    setSuccess(`Serving updated to ${description} (${weightNumber}${unit})`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const recalculateNutrients = (newServing, unit = 'g') => {
    if (!selectedMeal) {
      console.log('No selected meal for recalculation');
      return;
    }
    
    const serving = parseFloat(newServing);
    if (isNaN(serving) || serving <= 0) {
      console.log('Invalid serving size for recalculation:', newServing);
      return;
    }
    
    const nutrients = selectedMeal.nutritional_metrics?.nutrients_per_100g || 
                     selectedMeal.nutrients?.per100g || {};

    let ratio;
    
    if (unit === 'ml') {
      const density = getDensityForFood(selectedMeal.name) || 1.0;
      const weightInGrams = serving * density;
      ratio = weightInGrams / 100;
      
      console.log('Liquid conversion:', {
        serving: serving + 'ml',
        density: density,
        weightInGrams: weightInGrams + 'g',
        ratio: ratio
      });
    } else {
      ratio = serving / 100;
      
      console.log('Solid conversion:', {
        serving: serving + 'g',
        ratio: ratio
      });
    }
    
    console.log('Recalculating nutrients:', {
      selectedMeal: selectedMeal.name,
      newServing: serving,
      unit: unit,
      ratio: ratio,
      originalNutrients: nutrients
    });

    setFields(prevFields => {
      const updatedFields = { 
        ...prevFields, 
        serving: serving,
        servingUnit: unit
      };

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

  const fetchSuggestions = useCallback(async () => {
    const normalizedSearch = search.toLowerCase().trim();

    console.log('fetchSuggestions called with:', normalizedSearch);

    if (normalizedSearch.length < 2) {
      setSuggestions([]);
      return;
    }

    if (suggestionCache[normalizedSearch]) {
      console.log('Using cached results for:', normalizedSearch);
      setSuggestions(suggestionCache[normalizedSearch]);
      return;
    }

    try {
      console.log(`Search for: "${normalizedSearch}"`);

      let allFoods = allFoodsCache;
      if (allFoods.length === 0) {
        console.log('Fetching food database...');
        const q = query(collection(db, 'meals'));

        const snap = await getDocs(q);
        allFoods = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data()
        }));

        setAllFoodsCache(allFoods);
        console.log(`Loaded ${allFoods.length} foods into cache`);
      }

      // Enhanced search algorithm with better scoring
      const results = allFoods
        .filter(meal => {
          if (!meal.name) return false;
          
          const mealNameLower = meal.name.toLowerCase();
          const category = (meal.category || '').toLowerCase();
          const description = (meal.description || '').toLowerCase();
          const tags = (meal.tags || []).map(tag => tag.toLowerCase());
          
          return mealNameLower.includes(normalizedSearch) ||
                 mealNameLower.startsWith(normalizedSearch) ||
                 category.includes(normalizedSearch) ||
                 description.includes(normalizedSearch) ||
                 tags.some(tag => tag.includes(normalizedSearch)) ||
                 mealNameLower.split(' ').some(word => word.startsWith(normalizedSearch));
        })
        .map(food => {
          const mealNameLower = (food.name || '').toLowerCase();
          const category = (food.category || '').toLowerCase();
          const description = (food.description || '').toLowerCase();
          
          let score = 0;
          
          if (mealNameLower === normalizedSearch) score += 100;
          if (mealNameLower.startsWith(normalizedSearch)) score += 50;
          if (mealNameLower.split(' ').some(word => word.startsWith(normalizedSearch))) score += 30;
          if (mealNameLower.includes(normalizedSearch)) score += 20;
          if (category.includes(normalizedSearch)) score += 15;
          if (description.includes(normalizedSearch)) score += 10;
          
          if (food.nutritional_metrics?.serving_options || food.nutritional_metrics?.common_portions) {
            score += 5;
          }
          
          if (food.longCovidRelevance || food.longCovidBenefits || food.longCovidCautions) {
            score += 3;
          }
          
          return {
            ...food,
            searchMethod: 'javascript',
            searchScore: score
          };
        })
        .sort((a, b) => {
          if (b.searchScore !== a.searchScore) {
            return b.searchScore - a.searchScore;
          }
          return (a.name || '').localeCompare(b.name || '');
        });

      console.log(`Found ${results.length} results (showing all)`);

      setSuggestionCache(prev => ({
        ...prev,
        [normalizedSearch]: results
      }));

      setSuggestions(results);

    } catch (err) {
      console.error('Search error:', err);
      setSuggestions([]);
    }
  }, [search, suggestionCache, allFoodsCache]);

  // Clear search function
  const clearSearch = () => {
    setSearch('');
    setSuggestions([]);
    setSelectedMeal(null);
    setSearchFocused(false);
    setFields({});
  };

  // Search input renderer
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
            <span className="result-count">
              {suggestions.length} result{suggestions.length !== 1 ? 's' : ''}
              {suggestions.length > 50 && (
                <span className="large-result-hint"> - scroll to see more</span>
              )}
            </span>
          )}
        </div>
      </div>

      {suggestions.length > 0 && searchFocused && (
        <div className="suggestions-container">
          <ul className="suggestions-list unlimited">
            {suggestions.map((s, index) => (
              <li 
                key={s.id || index} 
                onClick={() => handleSelectMeal(s)}
                onMouseDown={(e) => e.preventDefault()}
                className="suggestion-item"
              >
                <div className="suggestion-main">
                  <div className="suggestion-name">{s.name}</div>
                  {s.category && (
                    <div className="suggestion-category">{s.category}</div>
                  )}
                  {s.searchScore && (
                    <div className="suggestion-score" title={`Relevance: ${s.searchScore}`}>
                      {s.searchScore >= 50 ? '🎯' : s.searchScore >= 20 ? '🔍' : '📝'}
                    </div>
                  )}
                </div>
                
                <div className="suggestion-indicators">
                  {s.nutritional_metrics?.serving_options && (
                    <span className="serving-indicator" title="Has serving suggestions">
                      📏
                    </span>
                  )}
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
          
          {suggestions.length > 20 && (
            <div className="search-tips">
              <small>
                💡 Tip: Type more specific terms to narrow down results, or scroll to browse all {suggestions.length} matches
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Search effect
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

  // Fetch food log when user is authenticated
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
          <AddFoodTab
            // Search and meal selection
            search={search}
            setSearch={setSearch}
            suggestions={suggestions}
            setSuggestions={setSuggestions}
            selectedMeal={selectedMeal}
            setSelectedMeal={setSelectedMeal}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
            renderSearchInput={renderSearchInput}
            handleSelectMeal={handleSelectMeal}
            clearSearch={clearSearch}
            
            // Form fields and state
            fields={fields}
            setFields={setFields}
            mealType={mealType}
            setMealType={setMealType}
            time={time}
            setTime={setTime}
            date={date}
            setDate={setDate}
            longCovidAdjust={longCovidAdjust}
            setLongCovidAdjust={setLongCovidAdjust}
            
            // Edit mode
            editingEntry={editingEntry}
            handleCancelEdit={handleCancelEdit}
            
            // Form handlers
            handleFieldChange={handleFieldChange}
            handleServingSelection={handleServingSelection}
            handleTimeChange={handleTimeChange}
            convertTo24Hour={convertTo24Hour}
            handleLogFood={handleLogFood}
            
            // Status and messages
            loading={loading}
            success={success}
            error={error}
            
            // Constants
            mealTypes={mealTypes}
            pyodideStatus={pyodideStatus}
            
            // Other props
            foodLog={foodLog}
            MicronutrientRadarChart={MicronutrientRadarChart}
          />
        )}

        {tab === 'Food Journal' && (
          <FoodJournalTab
            // Data
            foodLog={foodLog}
            journalPage={journalPage}
            
            // Loading and error states
            logLoading={logLoading}
            journalError={journalError}
            success={success}
            
            // Delete confirmation
            deleteConfirmId={deleteConfirmId}
            setDeleteConfirmId={setDeleteConfirmId}
            deleteLoading={deleteLoading}
            handleDeleteEntry={handleDeleteEntry}
            
            // Actions
            fetchFoodLog={fetchFoodLog}
            handleEditEntry={handleEditEntry}
            
            // Constants
            ENTRIES_PER_PAGE={ENTRIES_PER_PAGE}
            
            // Utility functions
            formatDateHeader={formatDateHeader}
          />
        )}

        {tab === 'Analysis' && (
          <AnalysisTab 
            foodLog={foodLog} 
            userProfile={userProfile} 
          />
        )}
        {tab === 'Trends' && (
  <VitaminTimeSeriesTab 
    foodLog={foodLog}
    userProfile={userProfile}
  />
)}
      </div>
    </div>
  );
}

export default FoodTrackerPage;