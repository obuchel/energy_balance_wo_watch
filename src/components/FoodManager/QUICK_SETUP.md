# Food Manager - Quick Setup Checklist

## ✅ Prerequisites

- [ ] React app is running
- [ ] Firebase is configured
- [ ] You have a `foods` collection in Firestore
- [ ] You have the FNDDS updated JSON file

## 📁 Step 1: Copy Files

```bash
# Copy the FoodManager folder to your components directory
cp -r FoodManager/ your-project/src/components/
```

**Result:** You should have:
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

## 📄 Step 2: Add FNDDS Data

```bash
# Copy the FNDDS file to public folder
cp all_meals_updated_with_fndds.json your-project/public/
```

**Result:**
```
public/
└── all_meals_updated_with_fndds.json
```

## 🔧 Step 3: Update App.js

Open `src/App.js` and make these changes:

### Add Import (around line 14)

```javascript
import FoodManager from './components/FoodManager/FoodManager';
```

### Add Route (around line 487, after personal-settings route)

```javascript
{/* Food Manager - Admin tool for managing food database */}
<Route 
  path="/food-manager" 
  element={<FoodManager />} 
/>
```

**Full context** - your routes section should look like:

```javascript
{/* Add Personal Settings route */}
<Route 
  path="/personal-settings" 
  element={
    <ProtectedRoute>
      <PersonalSettings />
    </ProtectedRoute>
  } 
/>

{/* NEW: Food Manager route */}
<Route 
  path="/food-manager" 
  element={<FoodManager />} 
/>

{/* Default route - redirect based on authentication status */}
<Route 
  path="/" 
  element={
    isAuthenticated() ? 
      <Navigate to="/dashboard" replace /> : 
      <Navigate to="/login" replace />
  } 
/>
```

## 🚀 Step 4: Test It

1. Start your development server:
   ```bash
   npm start
   ```

2. Navigate to:
   ```
   http://localhost:3000/energy_balance_wo_watch/food-manager
   ```

3. You should see:
   - Statistics dashboard showing total foods, FNDDS matches, etc.
   - Search bar and filters
   - Table of all foods from Firebase

## ✅ Verification Checklist

Test these features to ensure everything works:

- [ ] Page loads without errors
- [ ] Statistics show correct counts
- [ ] Search box filters foods
- [ ] Filters (FNDDS/No FNDDS) work
- [ ] Sort options work (name, category, match score)
- [ ] Click "Edit" button - opens editor
- [ ] Click "Compare" button - shows comparison (if food has FNDDS data)
- [ ] In editor: can modify nutrient values
- [ ] In editor: "Save Changes" updates Firebase
- [ ] In comparison: shows side-by-side data correctly

## 🔍 Troubleshooting Quick Fixes

### Error: "Failed to load foods"

**Check:**
```javascript
// In browser console, run:
firebase.auth().currentUser
// If null, you need to add authentication to the route
```

**Fix:** Add `<ProtectedRoute>` wrapper or allow public access

### Error: "FNDDS comparison file not found"

**Check:**
```bash
# Verify file exists
ls public/all_meals_updated_with_fndds.json
```

**Fix:** Copy the file to public folder

### No foods appear

**Check:** 
```javascript
// In browser console:
// 1. Open Firestore in Firebase console
// 2. Verify 'foods' collection exists
// 3. Check a food document structure
```

**Fix:** Ensure foods collection exists and has documents

### Can't save changes

**Check Firebase Rules:**
```javascript
// Go to Firebase Console > Firestore > Rules
// You need write permission:
allow write: if true; // For testing only!
```

**Fix:** Update Firestore security rules

## 🎨 Optional: Add Link from Dashboard

Want to access Food Manager from your Dashboard? Add this to `Dashboard.js`:

```javascript
// Add this in the Quick Actions section
<button 
  className="action-button food-manager" 
  onClick={() => navigate('/food-manager')}
>
  🛠️ Manage Foods
</button>
```

## 📊 Data Structure Expected

Your Firestore foods should look like:

```javascript
// Collection: foods
// Document ID: auto-generated or custom
{
  name: "Chicken Soup",
  category: "soup",
  nutrients: {
    per100g: {
      calories: { value: 53, unit: "kcal" },
      protein: { value: 3.84, unit: "g" },
      // ... more nutrients
    }
  },
  // Optional - added by FNDDS update script
  fndds_metadata: {
    matched_food: "Soup, chicken noodle",
    food_code: 58403040,
    match_score: 0.718,
    wweia_category: "Soups, broth-based",
    updated: true
  }
}
```

## 🔐 Security Reminder

**Important:** The Food Manager has NO authentication by default!

### For Production:

**Option 1:** Add authentication wrapper

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

**Option 2:** Use Firebase security rules

```javascript
// Firestore rules
match /foods/{foodId} {
  allow read, write: if request.auth != null && 
    request.auth.token.admin == true;
}
```

**Option 3:** Don't deploy it publicly
- Keep it only in development
- Or deploy to a separate private URL

## 📈 Next Steps

Once everything is working:

1. Review foods with poor match scores (<70%)
2. Use the comparison view to verify FNDDS matches
3. Update nutrient values as needed
4. Consider adding custom FNDDS mappings for unmatched foods

## 🎉 Success!

If you can:
- See your foods list ✅
- Search and filter ✅
- Edit a food and save ✅
- View FNDDS comparison ✅

Then you're all set! 🚀

## 📚 More Information

See `INTEGRATION_GUIDE.md` for:
- Detailed feature documentation
- Customization options
- Performance optimization
- Advanced configurations
