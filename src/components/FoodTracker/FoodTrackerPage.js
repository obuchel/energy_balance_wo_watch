import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase-config';
import "../Common.css";
import './FoodTrackerPage.css';

import AddFoodTab from './AddFoodTab';
import FoodJournalTab from './FoodJournalTab';
import { AnalysisTab } from './FoodTrackerAnalysis';
import MicronutrientRadarChart from './MicronutrientRadarChart';
import VitaminTimeSeriesTab from './VitaminTimeSeriesTab';
import { ensureCompatibleFormat, getMacrosForServing, getMicronutrientsForServing, parseServingAmount } from './longCovidDataAdapter';
import foodSearchService from './foodSearchService';

const GRAMS_PER_OUNCE = 28.3495;

const convertWeight = {
  ozToG: (oz) => oz * GRAMS_PER_OUNCE,
  gToOz: (g) => g / GRAMS_PER_OUNCE,
};

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

// Term aliases: maps non-US English or common shorthand to FNDDS equivalents.
// Defined at module level so it's stable and never needs to be in useCallback deps.
const SEARCH_ALIASES = {
  // British/Commonwealth English → US English
  'porridge':       'oatmeal',
  'courgette':      'zucchini',
  'aubergine':      'eggplant',
  'coriander':      'cilantro',
  'rocket':         'arugula',
  'biscuit':        'cookie',
  'crisps':         'chips potato',
  'swede':          'rutabaga',
  'beetroot':       'beets',
  'minced beef':    'ground beef',
  'mince':          'ground beef',
  'prawns':         'shrimp',
  'chips':          'french fries',
  'jacket potato':  'baked potato',
  // Drinks commonly searched (LC / POTS contexts)
  'rooibos':        'tea herbal',
  'herbal tea':     'tea herbal',
  'decaf':          'coffee decaffeinated',
  'decaf coffee':   'coffee decaffeinated',
  'kombucha':       'tea kombucha',
  // Electrolytes / POTS
  'salt':           'sodium chloride',
  'sodium':         'sodium chloride',
  'electrolyte':    'sports drink electrolyte',
  // Other common terms
  'nut butter':     'peanut butter',
  'plant milk':     'almond milk',
};

const resolveSearchTerm = (term) => {
  const lower = term.toLowerCase().trim();
  if (SEARCH_ALIASES[lower]) return SEARCH_ALIASES[lower];
  for (const [alias, replacement] of Object.entries(SEARCH_ALIASES)) {
    if (lower.startsWith(alias)) return replacement + lower.slice(alias.length);
  }
  return lower;
};


function FoodTrackerPage() {
  const navigate = useNavigate();

  // State declarations
  //const [allFoodsCache, setAllFoodsCache] = useState([]);
  //const [pyodideStatus] = useState('unavailable');
  const [searchFocused, setSearchFocused] = useState(false);

  // Search service state
  const [searchServiceReady, setSearchServiceReady] = useState(false);
  const [searchServiceError, setSearchServiceError] = useState('');
  const [initProgress, setInitProgress] = useState('');

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
  // longCovidAdjust checkbox removed - Long COVID features are always active
  // The app is purpose-built for Long COVID patients; profile.hasLongCovid controls severity adjustments
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

  // Initialize search service on mount
  useEffect(() => {
    const initSearch = async () => {
      try {
        setInitProgress('Loading food database...');
        // Get current path dynamically
        const basePath = window.location.pathname.split('/').slice(0, 2).join('/');
        const dataUrl = `${basePath}/foods_updated.json`;
        await foodSearchService.initialize(dataUrl);
        setSearchServiceReady(true);
        setInitProgress('');
        console.log('✅ Search service ready!');
      } catch (error) {
        console.error('Failed to initialize search:', error);
        setSearchServiceError('Failed to load food database. Please refresh the page.');
        setInitProgress('');
      }
    };

    initSearch();

    // Cleanup on unmount
    return () => {
      foodSearchService.terminate();
    };
  }, []);

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
    console.log('Editing entry:', entry);
    
    // Determine user's preferred unit system
    const userUnitSystem = userProfile?.unitSystem || 'metric';
    
    // Entry is stored in grams, convert if user prefers imperial
    let displayServing = entry.serving || 0;
    let displayUnit = 'g';
    
    if (userUnitSystem === 'imperial') {
      displayServing = Math.round(convertWeight.gToOz(displayServing) * 10) / 10;
      displayUnit = 'oz';
    }
    
    // Find the meal in database for full info
    const findAndSetMeal = async () => {
      try {
        const results = await foodSearchService.search(entry.name, 10);
        const meal = results.find(m => m.name === entry.name) || results[0];
        
        if (meal) {
          const compatibleMeal = ensureCompatibleFormat(meal);
          setSelectedMeal(compatibleMeal);
          
          // Set fields with converted values
          setFields({
            name: entry.name,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            calories: entry.calories,
            serving: displayServing, // Display in user's preferred unit
            servingUnit: displayUnit,
            servingInGrams: entry.serving, // Keep original grams value
            servingDescription: entry.servingDescription,
            visualEquivalent: entry.visualEquivalent,
            servingReason: entry.servingReason,
            servingTiming: entry.servingTiming,
            micronutrients: entry.micronutrients || {},
            longCovidBenefits: entry.longCovidBenefits || [],
            longCovidCautions: entry.longCovidCautions || [],
            longCovidRelevance: entry.longCovidRelevance || {}
          });
        }
      } catch (err) {
        console.error('Error finding meal for edit:', err);
      }
    };
    
    findAndSetMeal();
    setSearch(entry.name);
    setMealType(entry.mealType);
    setTime(entry.time);
    setDate(entry.date);
    setEditingEntry(entry);
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

      let servingInGrams = parseFloat(fields.serving) || 100;
const servingUnit = fields.servingUnit || 'g';

if (servingUnit === 'oz') {
  servingInGrams = convertWeight.ozToG(servingInGrams);
  console.log(`Converted ${fields.serving}oz to ${servingInGrams.toFixed(1)}g for database storage`);
}

const entryData = {
  name: fields.name,
  protein: parseFloat(fields.protein) || 0,
  carbs: parseFloat(fields.carbs) || 0,
  fat: parseFloat(fields.fat) || 0,
  calories: parseFloat(fields.calories) || 0,
  serving: Math.round(servingInGrams * 10) / 10, // Always store in grams
  servingUnit: 'g', // Always store as grams for consistency
  servingDisplayed: fields.serving, // Original value user entered
  servingDisplayedUnit: servingUnit, // Unit user used
  servingDescription: fields.servingDescription || null,
  visualEquivalent: fields.visualEquivalent || null,
  servingReason: fields.servingReason || null,
  servingTiming: fields.servingTiming || null,
  micronutrients: fields.micronutrients || {},
  mealType,
  time,
  date,
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
  const fetchUserProfile = useCallback(async (uid) => {
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
  }, []);

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
  }, [navigate, fetchUserProfile]);

  // Authentication effect
  useEffect(() => {
    checkUserAuthentication();
  }, [checkUserAuthentication]);

  // Helper function for COVID food rating
  // Reads LC/MCAS rating purely from the food object's data properties.
  // No string matching — correctness depends entirely on the food JSON data.
  // properties.histamine: 'low' | 'moderate' | 'high' | 'liberator'
  // properties.safeForMCAS: true | false
  // longCovidRelevance.antiInflammatory: 'high' | 'moderate' | 'low' | 'negative'
  const getCovidFoodRating = (food) => {
    if (!food || typeof food !== 'object') return 'neutral';
    const props = food.properties || {};
    const relevance = food.longCovidRelevance || {};

    // Explicit MCAS unsafe or high histamine → caution
    if (props.safeForMCAS === false) return 'caution';
    if (props.histamine === 'high' || props.histamine === 'liberator') return 'caution';
    if (relevance.antiInflammatory === 'negative' || relevance.antiInflammatory === 'very-low')
      return 'caution';

    // Explicitly safe and beneficial
    if (props.safeForMCAS === true && props.histamine === 'low') return 'beneficial';
    if (relevance.antiInflammatory === 'high' || relevance.antiInflammatory === 'very-high')
      return 'beneficial';

    // Moderate — show as neutral
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

    if (userProfile?.hasLongCovid) {
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

  // Recalculate nutrients based on serving size
  const recalculateNutrients = useCallback((newServing, unit = 'g') => {
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
    let servingInGrams = serving;
    
    // Convert to grams if needed (all nutrients are per 100g)
    if (unit === 'oz') {
      servingInGrams = convertWeight.ozToG(serving);
      ratio = servingInGrams / 100;
      console.log('Imperial conversion:', {
        serving: serving + 'oz',
        servingInGrams: servingInGrams.toFixed(1) + 'g',
        ratio: ratio
      });
    } else if (unit === 'ml') {
      const density = getDensityForFood(selectedMeal.name) || 1.0;
      servingInGrams = serving * density;
      ratio = servingInGrams / 100;
      console.log('Liquid conversion:', {
        serving: serving + 'ml',
        density: density,
        servingInGrams: servingInGrams + 'g',
        ratio: ratio
      });
    } else {
      // Already in grams
      ratio = serving / 100;
      console.log('Metric conversion:', {
        serving: serving + 'g',
        ratio: ratio
      });
    }
    
    console.log('Recalculating nutrients:', {
      selectedMeal: selectedMeal.name,
      newServing: serving,
      unit: unit,
      servingInGrams: servingInGrams.toFixed(1),
      ratio: ratio
    });
  
    setFields(prevFields => {
      const updatedFields = { 
        ...prevFields, 
        serving: serving, // Keep in user's unit for display
        servingUnit: unit,
        servingInGrams: servingInGrams // Store for calculations
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
  }, [selectedMeal]);

  // Enhanced handleSelectMeal function
  const handleSelectMeal = (meal) => {
    console.log('=== Meal Selected ===');
    console.log('Meal name:', meal.name);
    console.log('Has longCovidServings:', !!meal.longCovidServings);
    
    setSelectedMeal(meal);
    setSearch(meal.name);
    setSuggestions([]);
    setSearchFocused(false);
    
    // Determine default serving
    let defaultServing = 100;
    let defaultUnit = 'g';
    let defaultDescription = '100g';
    
    // Check for longCovidServings first (new format)
    if (meal.longCovidServings && meal.longCovidServings.length > 0) {
      console.log('Using longCovidServings default');
      const firstServing = meal.longCovidServings[1] || meal.longCovidServings[0]; // Use "Standard Recovery Portion" if available
      const parsed = parseServingAmount(firstServing.amount);
      defaultServing = parsed.weight;
      defaultUnit = parsed.unit;
      defaultDescription = firstServing.name;
    } 
    // Fall back to legacy serving_options
    else if (meal.nutritional_metrics?.serving_options) {
      console.log('Using legacy serving_options default');
      const firstOption = Object.values(meal.nutritional_metrics.serving_options)[0];
      if (firstOption) {
        defaultServing = firstOption.weight;
        defaultUnit = firstOption.unit || 'g';
        defaultDescription = firstOption.description;
      }
    }
    
    console.log('Default serving:', defaultServing, defaultUnit);
    
    // Calculate nutrients for default serving using adapter
    const macros = getMacrosForServing(meal, defaultServing);
    const micronutrients = getMicronutrientsForServing(meal, defaultServing);
    
    console.log('Initial macros:', macros);
    console.log('Initial micronutrients:', Object.keys(micronutrients).length, 'nutrients');
    
    // Set all fields
    setFields({
      name: meal.name,
      serving: defaultServing,
      servingUnit: defaultUnit,
      servingDescription: defaultDescription,
      calories: Math.round(macros.calories),
      protein: Number(macros.protein.toFixed(1)),
      carbs: Number(macros.carbs.toFixed(1)),
      fat: Number(macros.fat.toFixed(1)),
      fiber: Number(macros.fiber.toFixed(1)),
      sugars: Number(macros.sugars.toFixed(1)),
      micronutrients: micronutrients,
      // Long COVID data
      longCovidBenefits: meal.longCovidBenefits || [],
      longCovidCautions: meal.longCovidCautions || [],
      longCovidRelevance: meal.longCovidRelevance || {},
      functionalCompounds: meal.functionalCompounds || {},
      properties: meal.properties || {}
    });
    
    console.log('=== Meal Selection Complete ===');
  };
  
  // Handle serving selection
  const handleServingSelection = (weight, description, unit = 'g', visualEquivalent = null, reason = null, timing = null) => {
    console.log('=== Serving Selection ===');
    console.log('Weight:', weight, 'Unit:', unit, 'Description:', description);
    console.log('Visual Equivalent:', visualEquivalent);
    console.log('Reason:', reason);
    console.log('Timing:', timing);
    
    if (!selectedMeal) {
      console.error('No meal selected');
      return;
    }
    
    // Convert to grams for calculations (all nutrient data is per 100g)
    let weightInGrams = weight;
    if (unit === 'oz') {
      weightInGrams = convertWeight.ozToG(weight);
      console.log(`Converted ${weight}oz to ${weightInGrams.toFixed(1)}g`);
    }
    
    // Get macros using grams
    const macros = getMacrosForServing(selectedMeal, weightInGrams);
    console.log('Calculated macros:', macros);
    
    // Get micronutrients using grams
    const micronutrients = getMicronutrientsForServing(selectedMeal, weightInGrams);
    console.log('Calculated micronutrients:', Object.keys(micronutrients).length, 'nutrients');
    
    // Update all fields including Long COVID data and serving metadata
    setFields(prevFields => ({
      ...prevFields,
      serving: weight, // Keep in user's unit for display
      servingUnit: unit,
      servingInGrams: weightInGrams, // Store for database
      servingDescription: description,
      visualEquivalent: visualEquivalent,
      servingReason: reason,
      servingTiming: timing,
      calories: Math.round(macros.calories),
      protein: Number(macros.protein.toFixed(1)),
      carbs: Number(macros.carbs.toFixed(1)),
      fat: Number(macros.fat.toFixed(1)),
      fiber: Number(macros.fiber.toFixed(1)),
      sugars: Number(macros.sugars.toFixed(1)),
      micronutrients: micronutrients,
      // Preserve Long COVID metadata (don't overwrite)
      longCovidBenefits: prevFields.longCovidBenefits || selectedMeal.longCovidBenefits || [],
      longCovidCautions: prevFields.longCovidCautions || selectedMeal.longCovidCautions || [],
      longCovidRelevance: prevFields.longCovidRelevance || selectedMeal.longCovidRelevance || {},
      functionalCompounds: prevFields.functionalCompounds || selectedMeal.functionalCompounds || {},
      properties: prevFields.properties || selectedMeal.properties || {}
    }));
    
    setSuccess(`Serving updated to ${description} (${weight}${unit})`);
    setTimeout(() => setSuccess(''), 2000);
    
    console.log('=== Fields Updated ===');
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

  // Updated fetchSuggestions to use Web Worker search
  const fetchSuggestions = useCallback(async () => {
    const rawSearch = search.toLowerCase().trim();
    // Apply alias resolution so non-US / shorthand terms find results
    const normalizedSearch = resolveSearchTerm(rawSearch);

    console.log('fetchSuggestions called with:', rawSearch, '→', normalizedSearch);

    if (normalizedSearch.length < 2) {
      setSuggestions([]);
      return;
    }

    // Check local cache first
    if (suggestionCache[normalizedSearch]) {
      console.log('Using cached results for:', normalizedSearch);
      setSuggestions(suggestionCache[normalizedSearch]);
      return;
    }

    if (!searchServiceReady) {
      console.log('Search service not ready yet...');
      return;
    }

    try {
      console.log(`Search for: "${normalizedSearch}"`);

      // Search via Web Worker
      const results = await foodSearchService.search(normalizedSearch, 100);

      // Ensure compatible format
      const compatibleResults = results.map(food => ensureCompatibleFormat(food));

      console.log(`Found ${compatibleResults.length} results`);

      // Cache results locally
      setSuggestionCache(prev => ({
        ...prev,
        [normalizedSearch]: compatibleResults
      }));

      setSuggestions(compatibleResults);
      
      // Clear any previous error on successful search
      setError('');

    } catch (err) {
      console.error('Search error:', err);
      setSuggestions([]);
      setError('Search failed. Please try again.');
    }
  }, [search, suggestionCache, searchServiceReady]);

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

      {/* Show loading notice if service isn't ready yet */}
      {!searchServiceReady && search.length >= 2 && (
        <div className="search-loading-notice">
          <small>⏳ Food database is loading — results will appear shortly…</small>
        </div>
      )}

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
                      {s.searchScore >= 50 ? '🎯' : s.searchScore >= 20 ? '🔍' : '📄'}
                    </div>
                  )}
                </div>
                
                <div className="suggestion-indicators">
                  {s.nutritional_metrics?.serving_options && (
                    <span className="serving-indicator" title="Has serving suggestions">
                      📏
                    </span>
                  )}
                  <span className={`covid-indicator ${getCovidFoodRating(s)}`}>
                      {getCovidFoodRating(s) === 'beneficial' ? '✅' : 
                       getCovidFoodRating(s) === 'caution' ? '⚠️' : 'ℹ️'}
                    </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tip rendered OUTSIDE the scroll container — never overlaps list items */}
      {suggestions.length > 20 && searchFocused && (
        <div className="search-tips-external">
          <small>
            💡 Tip: Type more specific terms to narrow results, or scroll to browse all {suggestions.length} matches
          </small>
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
        recalculateNutrients(value, fields.servingUnit || 'g');
      }
    } else {
      setFields(prev => ({ ...prev, [name]: value }));
    }
  };
  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    const currentServing = parseFloat(fields.serving) || 0;
    const oldUnit = fields.servingUnit || 'g';
    
    if (currentServing === 0 || newUnit === oldUnit) {
      setFields(prev => ({ ...prev, servingUnit: newUnit }));
      return;
    }
    
    let convertedServing = currentServing;
    
    // Convert the serving value
    if (oldUnit === 'g' && newUnit === 'oz') {
      convertedServing = Math.round(convertWeight.gToOz(currentServing) * 10) / 10;
    } else if (oldUnit === 'oz' && newUnit === 'g') {
      convertedServing = Math.round(convertWeight.ozToG(currentServing));
    }
    
    console.log(`Unit change: ${currentServing}${oldUnit} → ${convertedServing}${newUnit}`);
    
    setFields(prev => ({ 
      ...prev, 
      serving: convertedServing,
      servingUnit: newUnit 
    }));
    
    // Recalculate nutrients with new unit
    if (selectedMeal) {
      recalculateNutrients(convertedServing, newUnit);
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

  // Show loading screen while initializing search service
  if (!searchServiceReady && !searchServiceError) {
    return (
      <div className="food-tracker-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <h3>🔍 Loading Food Database...</h3>
          {initProgress && <p className="init-progress">{initProgress}</p>}
          <p className="loading-tip">
            💡 This is a one-time load for your session.<br />
            Future visits will load from cache instantly!
          </p>
          <div className="loading-details">
            <small>Loading 50MB+ database with 8,000+ foods...</small>
          </div>
        </div>
      </div>
    );
  }

  // Show error if search service failed to initialize
  if (searchServiceError) {
    return (
      <div className="food-tracker-container">
        <div className="error-indicator">
          <div className="error-icon">❌</div>
          <h3>{searchServiceError}</h3>
          <p>Please check your internet connection and try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        

          <button
            onClick={handleBack} // Use navigate instead of window.location.href
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading state for authentication
  if (authLoading) {
    return (
      <div className="food-tracker-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <h3>Loading...</h3>
        </div>
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
  selectedMeal={selectedMeal}
  fields={fields}
  mealType={mealType}
  setMealType={setMealType}
  time={time}
  date={date}
  setDate={setDate}
  renderSearchInput={renderSearchInput}
  editingEntry={editingEntry}
  handleCancelEdit={handleCancelEdit}
  handleFieldChange={handleFieldChange}
  handleServingSelection={handleServingSelection}
  handleUnitChange={handleUnitChange}  // ⭐ ADD THIS LINE
  handleTimeChange={handleTimeChange}
  convertTo24Hour={convertTo24Hour}
  handleLogFood={handleLogFood}
  loading={loading}
  success={success}
  error={error}
  mealTypes={mealTypes}
  //pyodideStatus={pyodideStatus}
  foodLog={foodLog}
  MicronutrientRadarChart={MicronutrientRadarChart}
  userProfile={userProfile}  // ⭐ ADD THIS LINE
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