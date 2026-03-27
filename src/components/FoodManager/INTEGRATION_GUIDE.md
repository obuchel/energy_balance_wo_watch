# Food Manager Module - Integration Guide

## Overview

The Food Manager is a standalone administrative module for managing your food database. It allows you to:

- View all foods from Firebase
- Edit nutrient values
- Compare Firebase data with FNDDS updated data
- See match quality and accuracy scores
- Identify which values were changed by FNDDS matching

## Files Created

```
FoodManager/
├── FoodManager.js       - Main container component
├── FoodList.js          - Food listing with filters
├── FoodEditor.js        - Edit individual foods
├── FNDDSComparison.js   - Compare with FNDDS data
└── FoodManager.css      - Complete styling
```

## Installation Steps

### Step 1: Copy Files

Copy the entire `FoodManager` folder to your project:

```
src/
└── components/
    └── FoodManager/
        ├── FoodManager.js
        ├── FoodList.js
        ├── FoodEditor.js
        ├── FNDDSComparison.js
        └── FoodManager.css
```

### Step 2: Add FNDDS Data File

Place your `all_meals_updated_with_fndds.json` file in the `public` folder:

```
public/
└── all_meals_updated_with_fndds.json
```

This file will be loaded by the comparison feature.

### Step 3: Add Route to App.js

Add the Food Manager route to your `App.js`:

```javascript
// At the top with other imports
import FoodManager from './components/FoodManager/FoodManager';

// Inside your <Routes> component, add this route:
<Route 
  path="/food-manager" 
  element={<FoodManager />} 
/>
```

**Complete example for your App.js:**

```javascript
// Add this import at the top with your other imports (around line 14)
import FoodManager from './components/FoodManager/FoodManager';

// Then inside your <Routes> section (around line 487, after personal-settings), add:
<Route 
  path="/food-manager" 
  element={<FoodManager />} 
/>
```

### Step 4: Access the Module

The Food Manager is now accessible at:

```
http://localhost:3000/energy_balance_wo_watch/food-manager
```

Or on your deployed site:
```
https://obuchel.github.io/energy_balance_wo_watch/food-manager
```

## Features

### 1. Food List View

**Features:**
- Search foods by name or category
- Filter by:
  - All foods
  - Has FNDDS data
  - No FNDDS data
  - High match (≥80%)
  - Low match (<70%)
- Sort by:
  - Name (A-Z)
  - Category
  - Match score
- Category filter dropdown

**Visual Indicators:**
- ✓ Updated indicator for foods modified by FNDDS
- Color-coded match score badges:
  - Green: Excellent (≥90%)
  - Blue: Good (80-89%)
  - Yellow: Fair (70-79%)
  - Orange: Poor (<70%)
  - Gray: No FNDDS data

### 2. Food Editor

**Features:**
- Edit basic information (name, category)
- View FNDDS match metadata
- Edit all nutrient values (30+ nutrients)
- Visual indicators for nutrients different from FNDDS
- One-click "Use FNDDS" button to adopt FNDDS values
- Grouped nutrients:
  - Macronutrients
  - Minerals
  - Vitamins
  - Other compounds

**Workflow:**
1. Click "Edit" on any food in the list
2. Modify nutrient values
3. See which values differ from FNDDS (⚠️ indicator)
4. Optionally adopt FNDDS values with one click
5. Save changes to Firebase

### 3. FNDDS Comparison

**Features:**
- Side-by-side comparison of Firebase vs FNDDS values
- Statistical summary:
  - Total nutrients
  - Identical values
  - Different values
  - Only in FNDDS (new nutrients)
  - Only in Firebase
- Detailed comparison table showing:
  - Firebase value
  - FNDDS value
  - Absolute difference
  - Percentage change
  - Status badge
- Color-coded differences:
  - Green: Minor (<5% difference)
  - Orange: Moderate (5-20%)
  - Red: Major (>20%)
- Match information display:
  - Matched food name
  - Food code
  - Match score
  - WWEIA category
  - Update status

**Workflow:**
1. Click "Compare" on any food with FNDDS data
2. Review the comparison table
3. Identify differences
4. Click "Edit Values" to make changes if needed

## Understanding the Data

### FNDDS Metadata

Foods that were matched with FNDDS contain a `fndds_metadata` object:

```json
{
  "fndds_metadata": {
    "matched_food": "Soup, chicken noodle",
    "food_code": 58403040,
    "match_score": 0.718,
    "wweia_category": "Soups, broth-based",
    "updated": true
  }
}
```

**Fields:**
- `matched_food`: The FNDDS food name it was matched to
- `food_code`: Official FNDDS food code
- `match_score`: Similarity score (0-1)
  - 0.9+: Excellent match
  - 0.8-0.9: Good match
  - 0.7-0.8: Fair match
  - <0.7: Poor match (needs review)
- `wweia_category`: USDA's "What We Eat In America" category
- `updated`: Whether nutrients were updated from FNDDS

### Match Score Interpretation

- **0.9-1.0 (Excellent)**: Very confident match, food names are nearly identical
- **0.8-0.9 (Good)**: Good match, some variation in naming but clearly the same food
- **0.7-0.8 (Fair)**: Reasonable match, but should be manually reviewed
- **<0.7 (Poor)**: Questionable match, likely incorrect, needs manual mapping

## Database Structure

The module expects your Firebase Firestore to have a `foods` collection with documents like:

```javascript
{
  name: "Chicken Noodle Soup",
  category: "soup",
  nutrients: {
    per100g: {
      calories: { value: 53, unit: "kcal" },
      protein: { value: 3.84, unit: "g" },
      // ... more nutrients
    }
  },
  fndds_metadata: {
    matched_food: "Soup, chicken noodle",
    food_code: 58403040,
    match_score: 0.718,
    wweia_category: "Soups, broth-based",
    updated: true
  }
}
```

## Common Tasks

### Task 1: Review All Low-Quality Matches

1. Go to Food Manager
2. Set filter to "Low Match (<70%)"
3. Review each food in the list
4. Click "Compare" to see FNDDS match
5. Click "Edit" to update if needed

### Task 2: Update a Food with FNDDS Values

1. Find the food in the list
2. Click "Compare" to view differences
3. Note which nutrients are different
4. Click "Edit Values"
5. For each different nutrient, click "Use FNDDS" button
6. Click "Save Changes"

### Task 3: Find Foods Without FNDDS Data

1. Set filter to "No FNDDS Data"
2. These foods weren't matched in the update process
3. Consider adding custom mappings (see nutrient update scripts)

### Task 4: Batch Review by Category

1. Select a category from the dropdown (e.g., "pizza")
2. Review all foods in that category
3. Use "Compare" to verify FNDDS matches make sense
4. Edit as needed

## Security Considerations

**Important:** This module has NO authentication built-in. Anyone with the URL can access it.

### Recommended Security Measures:

#### Option 1: Add Authentication (Recommended)

Update `App.js` to require authentication:

```javascript
<Route 
  path="/food-manager" 
  element={
    <ProtectedRoute>
      <FoodManager />
    </ProtectedRoute>
  } 
/>
```

#### Option 2: Use Firebase Security Rules

Add rules to limit who can edit foods:

```javascript
// firestore.rules
match /foods/{foodId} {
  // Allow admins to read and write
  allow read, write: if request.auth != null && 
    request.auth.token.admin == true;
    
  // Or allow specific users
  allow read, write: if request.auth != null && 
    request.auth.token.email in ['your-admin@email.com'];
}
```

#### Option 3: Deploy Separately

Deploy the Food Manager to a private subdomain or separate instance that's not publicly accessible.

## Troubleshooting

### Issue: "FNDDS comparison file not found"

**Solution:** 
- Ensure `all_meals_updated_with_fndds.json` is in the `public` folder
- Verify the file path in `FoodManager.js` line 51:
  ```javascript
  const response = await fetch('/all_meals_updated_with_fndds.json');
  ```

### Issue: "Failed to load foods"

**Solution:**
- Check Firebase connection
- Verify your `foods` collection exists in Firestore
- Check browser console for specific error messages
- Ensure Firebase security rules allow reading `foods` collection

### Issue: Comparison shows "No matching food found"

**Causes:**
- The food wasn't in the FNDDS update file
- Food name doesn't match between Firebase and FNDDS file
- The `firestore_id` doesn't match

**Solution:**
- Check if the food has `fndds_metadata`
- If not, it wasn't matched during FNDDS update
- Consider running the FNDDS update script again with custom mappings

### Issue: Changes don't save

**Solution:**
- Check browser console for errors
- Verify Firebase security rules allow writing to `foods` collection
- Ensure you're passing valid data (numbers for nutrient values)

### Issue: Slow loading with many foods

**Solution:**
- The module loads all foods at once
- For databases with >1000 foods, consider adding pagination
- Add an index on the `name` field in Firestore for better performance

## Performance Optimization

For large food databases (>500 foods):

### 1. Add Pagination to FoodList.js

```javascript
const [page, setPage] = useState(1);
const itemsPerPage = 50;
const startIdx = (page - 1) * itemsPerPage;
const endIdx = startIdx + itemsPerPage;
const paginatedFoods = processedFoods.slice(startIdx, endIdx);
```

### 2. Add Firestore Query Limits

In `FoodManager.js`:

```javascript
const q = query(foodsRef, orderBy('name'), limit(100));
```

### 3. Implement Virtual Scrolling

Use a library like `react-window` for large lists.

## Customization

### Changing Colors

Edit `FoodManager.css` and modify the color variables at the top:

```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to your colors */
background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
```

### Adding More Filters

In `FoodList.js`, add new filter options:

```javascript
<select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
  <option value="all">All Foods</option>
  {/* Add your custom filter */}
  <option value="high_protein">High Protein (>20g)</option>
</select>

// Then implement the filter logic
case 'high_protein':
  filtered = filtered.filter(f => 
    f.nutrients?.per100g?.protein?.value > 20
  );
  break;
```

### Adding Bulk Edit

To enable editing multiple foods at once, add a selection mechanism in `FoodList.js`:

```javascript
const [selectedFoods, setSelectedFoods] = useState([]);

// Add checkboxes to table
// Add "Edit Selected" button
// Implement bulk update function
```

## Future Enhancements

Potential features to add:

1. **Bulk Import**: Upload CSV/JSON to create multiple foods
2. **Export**: Download food data as CSV or JSON
3. **History**: Track changes over time (requires Firestore subcollection)
4. **Validation**: Ensure nutrient values are reasonable
5. **Duplicate Detection**: Find potential duplicate foods
6. **Merge Foods**: Combine duplicate entries
7. **Nutrient Completeness**: Show which foods have incomplete data
8. **Batch FNDDS Update**: Re-run FNDDS matching from within the app

## Support

If you encounter issues:

1. Check browser console for error messages
2. Verify Firebase configuration
3. Ensure all files are in correct locations
4. Check Firebase security rules
5. Test with a small dataset first

## Summary

The Food Manager provides a comprehensive interface for managing your food database with these key capabilities:

✅ View and search all foods
✅ Edit nutrient values
✅ Compare with FNDDS data
✅ See match quality scores
✅ Identify FNDDS updates
✅ Track data changes
✅ Filter and sort foods
✅ Visual indicators for data quality

Access it at: `/food-manager` route in your app.
