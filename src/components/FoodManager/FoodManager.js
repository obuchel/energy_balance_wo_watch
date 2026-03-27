import React, { useState, useEffect } from 'react';
import { db } from '../../firebase-config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import FoodList from './FoodList';
import FoodEditor from './FoodEditor';
import FNDDSComparison from './FNDDSComparison';
import './FoodManager.css';

function FoodManager() {
  const [foods, setFoods] = useState([]);
  const [fnddsData, setFnddsData] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'editor', 'comparison'
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    withFNDDS: 0,
    modified: 0
  });

  // Load foods from Firebase
  useEffect(() => {
    loadFoods();
  }, []);

  // Load FNDDS comparison data
  useEffect(() => {
    loadFNDDSData();
  }, []);

  const loadFoods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading meals from Firebase (collection: meals)...');
      
      // Query meals collection - no orderBy to avoid index requirement
      const foodsRef = collection(db, 'meals');
      const querySnapshot = await getDocs(foodsRef);
      
      console.log(`📊 Fetched ${querySnapshot.size} documents from Firebase`);
      
      const foodsList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        foodsList.push({
          id: doc.id,
          ...data
        });
        
        // Log first few to verify fndds_metadata
        if (foodsList.length <= 3) {
          console.log(`  Sample meal: ${data.name}`);
          if (data.fndds_metadata) {
            console.log(`    ✅ Has FNDDS: ${data.fndds_metadata.matched_food} (${data.fndds_metadata.match_score})`);
          } else {
            console.log(`    ❌ No FNDDS metadata`);
          }
        }
      });
      
      // Sort in memory instead of using orderBy
      foodsList.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setFoods(foodsList);
      
      // Calculate statistics
      const withFNDDS = foodsList.filter(f => f.fndds_metadata).length;
      const modified = foodsList.filter(f => f.fndds_metadata?.updated).length;
      
      setStats({
        total: foodsList.length,
        withFNDDS,
        modified
      });
      
      console.log(`✅ Loaded ${foodsList.length} foods from Firebase`);
      console.log(`📈 Stats: ${withFNDDS} with FNDDS, ${modified} modified`);
      
      if (withFNDDS === 0) {
        console.warn('⚠️ No meals have fndds_metadata - did you run push_fndds_to_firebase.py?');
      }
      
    } catch (err) {
      console.error('❌ Error loading foods:', err);
      setError('Failed to load foods: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFNDDSData = async () => {
    try {
      console.log('🔍 Attempting to load FNDDS comparison data...');
      
      // Use PUBLIC_URL for correct path in React apps with basename
      const publicUrl = process.env.PUBLIC_URL || '';
      
      // Try multiple possible locations - GitHub Pages specific
      const possiblePaths = [
        'https://obuchel.github.io/all_meals_updated_with_fndds.json', // Direct GitHub Pages path
        '/all_meals_updated_with_fndds.json', // Root of domain
        `${publicUrl}/all_meals_updated_with_fndds.json`,
        '/energy_balance_wo_watch/all_meals_updated_with_fndds.json',
        `${window.location.origin}/all_meals_updated_with_fndds.json`
      ];
      
      for (const path of possiblePaths) {
        try {
          console.log('  Trying:', path);
          const response = await fetch(path);
          if (response.ok) {
            const data = await response.json();
            setFnddsData(data);
            console.log('✅ Loaded', data.length, 'items from FNDDS file at:', path);
            return;
          } else {
            console.log('  Failed:', response.status, response.statusText);
          }
        } catch (e) {
          console.log('  Error:', e.message);
          // Try next path
        }
      }
      
      console.warn('⚠️ FNDDS comparison file not found at any location');
      console.warn('  Tried paths:', possiblePaths);
      console.warn('  Comparison features will be limited');
    } catch (err) {
      console.warn('Could not load FNDDS comparison data:', err);
    }
  };

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setView('editor');
  };

  const handleUpdateFood = async (foodId, updates) => {
    try {
      // Update in Firebase
      const foodRef = doc(db, 'meals', foodId);
      await updateDoc(foodRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
      
      // Update local state
      setFoods(foods.map(f => 
        f.id === foodId ? { ...f, ...updates } : f
      ));
      
      // Update selected food if it's the one being edited
      if (selectedFood?.id === foodId) {
        setSelectedFood({ ...selectedFood, ...updates });
      }
      
      console.log('Food updated successfully');
      return true;
    } catch (err) {
      console.error('Error updating food:', err);
      alert('Failed to update food: ' + err.message);
      return false;
    }
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedFood(null);
  };

  const handleShowComparison = (food) => {
    setSelectedFood(food);
    setView('comparison');
  };

  const filteredFoods = foods.filter(food => 
    food.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    food.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="food-manager-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading food database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="food-manager-container">
      {/* Header */}
      <div className="food-manager-header">
        <div className="header-content">
          <h1>🍽️ Food Database Manager</h1>
          <p className="subtitle">Manage and compare food nutrient data</p>
        </div>
        
        {/* Statistics Dashboard */}
        <div className="stats-dashboard">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Foods</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.withFNDDS}</div>
            <div className="stat-label">With FNDDS Data</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.modified}</div>
            <div className="stat-label">Modified by FNDDS</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {stats.total > 0 ? Math.round(stats.withFNDDS / stats.total * 100) : 0}%
            </div>
            <div className="stat-label">Match Rate</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadFoods} className="retry-btn">Retry</button>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="breadcrumb">
        <button 
          className={`breadcrumb-item ${view === 'list' ? 'active' : ''}`}
          onClick={handleBackToList}
        >
          Food List
        </button>
        {view === 'editor' && selectedFood && (
          <>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">Edit: {selectedFood.name}</span>
          </>
        )}
        {view === 'comparison' && selectedFood && (
          <>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">Compare: {selectedFood.name}</span>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="food-manager-content">
        {view === 'list' && (
          <FoodList
            foods={filteredFoods}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelectFood={handleSelectFood}
            onShowComparison={handleShowComparison}
            fnddsData={fnddsData}
          />
        )}

        {view === 'editor' && selectedFood && (
          <FoodEditor
            food={selectedFood}
            onUpdate={handleUpdateFood}
            onBack={handleBackToList}
            fnddsData={fnddsData}
          />
        )}

        {view === 'comparison' && selectedFood && (
          <FNDDSComparison
            food={selectedFood}
            onBack={handleBackToList}
            onEdit={() => setView('editor')}
            onUpdate={handleUpdateFood}
          />
        )}
      </div>
    </div>
  );
}

export default FoodManager;