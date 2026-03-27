#!/usr/bin/env python3
"""
Script to update nutrient values in meals JSON from FNDDS database.
Matches food items by name and updates nutrient values.
"""

import pandas as pd
import json
from pathlib import Path
from difflib import SequenceMatcher
import re

def clean_food_name(name):
    """Normalize food names for better matching"""
    name = name.lower().strip()
    # Remove common prefixes/suffixes
    name = re.sub(r'\s*\(.*?\)\s*', ' ', name)  # Remove parenthetical notes
    name = re.sub(r'\s+', ' ', name).strip()  # Normalize whitespace
    return name

def calculate_similarity(name1, name2):
    """Calculate similarity score between two food names"""
    return SequenceMatcher(None, clean_food_name(name1), clean_food_name(name2)).ratio()

def find_best_match(food_name, fndds_df, threshold=0.6):
    """Find the best matching food in FNDDS database"""
    best_match = None
    best_score = 0
    
    for idx, row in fndds_df.iterrows():
        fndds_name = row['Main food description']
        score = calculate_similarity(food_name, fndds_name)
        
        if score > best_score:
            best_score = score
            best_match = row
    
    if best_score >= threshold:
        return best_match, best_score
    return None, 0

def map_fndds_to_json_nutrients(fndds_row):
    """Map FNDDS nutrient columns to JSON nutrient structure"""
    nutrient_mapping = {
        'calories': ('Energy (kcal)', 'kcal'),
        'protein': ('Protein (g)', 'g'),
        'carbs': ('Carbohydrate (g)', 'g'),
        'fiber': ('Fiber, total dietary (g)', 'g'),
        'fat': ('Total Fat (g)', 'g'),
        'saturated_fat': ('Fatty acids, total saturated (g)', 'g'),
        'monounsaturated_fat': ('Fatty acids, total monounsaturated (g)', 'g'),
        'polyunsaturated_fat': ('Fatty acids, total polyunsaturated (g)', 'g'),
        'cholesterol': ('Cholesterol (mg)', 'mg'),
        'sodium': ('Sodium (mg)', 'mg'),
        'potassium': ('Potassium (mg)', 'mg'),
        'calcium': ('Calcium (mg)', 'mg'),
        'iron': ('Iron\n(mg)', 'mg'),
        'magnesium': ('Magnesium (mg)', 'mg'),
        'phosphorus': ('Phosphorus (mg)', 'mg'),
        'zinc': ('Zinc\n(mg)', 'mg'),
        'copper': ('Copper (mg)', 'mg'),
        'selenium': ('Selenium (mcg)', 'mcg'),
        'vitamin_a': ('Vitamin A, RAE (mcg_RAE)', 'mcg'),
        'vitamin_c': ('Vitamin C (mg)', 'mg'),
        'vitamin_d': ('Vitamin D (D2 + D3) (mcg)', 'mcg'),
        'vitamin_e': ('Vitamin E (alpha-tocopherol) (mg)', 'mg'),
        'vitamin_k': ('Vitamin K (phylloquinone) (mcg)', 'mcg'),
        'thiamine': ('Thiamin (mg)', 'mg'),
        'riboflavin': ('Riboflavin (mg)', 'mg'),
        'niacin': ('Niacin (mg)', 'mg'),
        'vitamin_b6': ('Vitamin B-6 (mg)', 'mg'),
        'folate': ('Folate, total (mcg)', 'mcg'),
        'vitamin_b12': ('Vitamin B-12 (mcg)', 'mcg'),
        'choline': ('Choline, total (mg)', 'mg'),
        'beta_carotene': ('Carotene, beta (mcg)', 'mcg'),
        'lycopene': ('Lycopene (mcg)', 'mcg'),
    }
    
    nutrients = {}
    for json_key, (fndds_col, unit) in nutrient_mapping.items():
        if fndds_col in fndds_row.index:
            value = fndds_row[fndds_col]
            if pd.notna(value) and value != 0:
                # Convert mcg to mg for beta_carotene and lycopene if needed
                if json_key in ['beta_carotene', 'lycopene']:
                    value = value / 1000  # Convert mcg to mg
                    unit = 'mg'
                nutrients[json_key] = {
                    'value': round(float(value), 2),
                    'unit': unit
                }
    
    return nutrients

def update_meals_with_fndds(meals_json_path, fndds_excel_path, output_path, 
                            threshold=0.6, max_items=None):
    """
    Main function to update meals JSON with FNDDS nutrient data
    
    Parameters:
    - meals_json_path: Path to the meals JSON file
    - fndds_excel_path: Path to the FNDDS Excel file
    - output_path: Path for the updated JSON file
    - threshold: Minimum similarity score for matching (0-1)
    - max_items: Maximum number of items to process (None for all)
    """
    
    # Load FNDDS database
    print("Loading FNDDS database...")
    fndds_df = pd.read_excel(fndds_excel_path, sheet_name='FNDDS Nutrient Values', skiprows=1)
    print(f"Loaded {len(fndds_df)} food items from FNDDS")
    
    # Load meals JSON
    print("\nLoading meals JSON...")
    with open(meals_json_path, 'r', encoding='utf-8') as f:
        meals = json.load(f)
    
    if max_items:
        meals = meals[:max_items]
        print(f"Processing first {max_items} items only")
    else:
        print(f"Loaded {len(meals)} food items from JSON")
    
    # Track statistics
    stats = {
        'total': len(meals),
        'matched': 0,
        'not_matched': 0,
        'updated': 0
    }
    
    matches_log = []
    no_match_log = []
    
    # Process each meal
    print("\nMatching and updating nutrients...\n")
    for idx, meal in enumerate(meals):
        if 'name' not in meal:
            print(f"Warning: Item {idx} has no 'name' field")
            continue
        
        food_name = meal['name']
        
        # Find best match in FNDDS
        match, score = find_best_match(food_name, fndds_df, threshold)
        
        if match is not None:
            stats['matched'] += 1
            fndds_name = match['Main food description']
            
            # Get updated nutrients
            updated_nutrients = map_fndds_to_json_nutrients(match)
            
            # Update the meal's nutrients
            if 'nutrients' not in meal:
                meal['nutrients'] = {}
            if 'per100g' not in meal['nutrients']:
                meal['nutrients']['per100g'] = {}
            
            # Merge new nutrients
            meal['nutrients']['per100g'].update(updated_nutrients)
            
            # Add metadata about the update
            if 'fndds_metadata' not in meal:
                meal['fndds_metadata'] = {}
            
            meal['fndds_metadata'] = {
                'matched_food': fndds_name,
                'food_code': int(match['Food code']),
                'match_score': round(score, 3),
                'wweia_category': match['WWEIA Category description'],
                'updated': True
            }
            
            stats['updated'] += 1
            matches_log.append({
                'original': food_name,
                'matched': fndds_name,
                'score': round(score, 3),
                'food_code': int(match['Food code'])
            })
            
            if idx < 20 or idx % 100 == 0:  # Show progress
                print(f"[{idx+1}/{len(meals)}] Matched: '{food_name}' -> '{fndds_name}' (score: {score:.3f})")
        else:
            stats['not_matched'] += 1
            no_match_log.append(food_name)
            if idx < 20:
                print(f"[{idx+1}/{len(meals)}] No match found for: '{food_name}'")
    
    # Save updated JSON
    print(f"\nSaving updated data to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(meals, f, indent=2, ensure_ascii=False)
    
    # Save match report
    report_path = output_path.replace('.json', '_match_report.json')
    report = {
        'statistics': stats,
        'successful_matches': matches_log,
        'no_matches': no_match_log
    }
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "="*80)
    print("UPDATE SUMMARY")
    print("="*80)
    print(f"Total items processed: {stats['total']}")
    print(f"Successfully matched: {stats['matched']} ({stats['matched']/stats['total']*100:.1f}%)")
    print(f"Not matched: {stats['not_matched']} ({stats['not_matched']/stats['total']*100:.1f}%)")
    print(f"Updated with new nutrients: {stats['updated']}")
    print(f"\nOutput file: {output_path}")
    print(f"Match report: {report_path}")
    print("="*80)
    
    return stats, matches_log, no_match_log


if __name__ == "__main__":
    # File paths
    meals_json = '/mnt/user-data/uploads/all_meals_20250814_121026.json'
    fndds_excel = '/mnt/user-data/uploads/2021-2023_FNDDS_At_A_Glance_-_FNDDS_Nutrient_Values.xlsx'
    output_json = '/mnt/user-data/outputs/all_meals_updated_with_fndds.json'
    
    # Run the update
    # Set max_items=100 for a test run, or None to process all items
    stats, matches, no_matches = update_meals_with_fndds(
        meals_json,
        fndds_excel,
        output_json,
        threshold=0.6,
        max_items=100  # Change to None to process all items
    )
    
    print("\n" + "="*80)
    print("SAMPLE MATCHES (first 10):")
    print("="*80)
    for match in matches[:10]:
        print(f"  '{match['original']}' -> '{match['matched']}' (score: {match['score']})")
    
    if no_matches:
        print("\n" + "="*80)
        print("ITEMS WITHOUT MATCHES (first 10):")
        print("="*80)
        for food in no_matches[:10]:
            print(f"  - {food}")
