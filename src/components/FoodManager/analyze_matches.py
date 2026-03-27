#!/usr/bin/env python3
"""
Helper script to analyze match quality and suggest improvements
"""

import json
import pandas as pd

def analyze_matches(report_path):
    """Analyze the match report and provide insights"""
    
    with open(report_path, 'r') as f:
        report = json.load(f)
    
    print("="*80)
    print("MATCH QUALITY ANALYSIS")
    print("="*80)
    
    stats = report['statistics']
    matches = report['successful_matches']
    no_matches = report['no_matches']
    
    # Overall statistics
    print(f"\nTotal items: {stats['total']}")
    print(f"Matched: {stats['matched']} ({stats['matched']/stats['total']*100:.1f}%)")
    print(f"Not matched: {stats['not_matched']} ({stats['not_matched']/stats['total']*100:.1f}%)")
    
    # Score distribution
    if matches:
        scores = [m['score'] for m in matches]
        print(f"\n{'Score Range':<20} {'Count':<10} {'Percentage'}")
        print("-"*50)
        ranges = [
            ('Excellent (≥0.9)', lambda s: s >= 0.9),
            ('Good (0.8-0.9)', lambda s: 0.8 <= s < 0.9),
            ('Fair (0.7-0.8)', lambda s: 0.7 <= s < 0.8),
            ('Poor (0.6-0.7)', lambda s: 0.6 <= s < 0.7),
            ('Very Poor (<0.6)', lambda s: s < 0.6)
        ]
        
        for label, condition in ranges:
            count = sum(1 for s in scores if condition(s))
            pct = count / len(scores) * 100
            print(f"{label:<20} {count:<10} {pct:5.1f}%")
        
        print(f"\nAverage match score: {sum(scores)/len(scores):.3f}")
        print(f"Median match score: {sorted(scores)[len(scores)//2]:.3f}")
    
    # Poor matches that need review
    poor_matches = [m for m in matches if m['score'] < 0.7]
    if poor_matches:
        print("\n" + "="*80)
        print(f"MATCHES NEEDING REVIEW (score < 0.7): {len(poor_matches)}")
        print("="*80)
        print(f"{'Original':<35} {'Matched To':<35} {'Score'}")
        print("-"*80)
        for match in sorted(poor_matches, key=lambda x: x['score'])[:20]:
            print(f"{match['original'][:34]:<35} {match['matched'][:34]:<35} {match['score']:.3f}")
    
    # Unmatched items
    if no_matches:
        print("\n" + "="*80)
        print(f"UNMATCHED ITEMS: {len(no_matches)}")
        print("="*80)
        
        # Group by category if possible
        print("\nThese items may need manual mapping or custom rules:")
        for item in sorted(no_matches)[:30]:
            print(f"  - {item}")
        
        if len(no_matches) > 30:
            print(f"\n  ... and {len(no_matches)-30} more")
    
    # Recommendations
    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)
    
    if poor_matches:
        print("\n1. Review poor matches (< 0.7 score):")
        print("   - These may be incorrect matches")
        print("   - Consider adding custom mappings for these items")
    
    if no_matches:
        print("\n2. Create custom mappings for unmatched items:")
        print("   - Add a CUSTOM_MAPPINGS dictionary in the script")
        print("   - Map specific items to appropriate FNDDS entries")
    
    if stats['matched'] / stats['total'] < 0.7:
        print("\n3. Consider lowering the threshold:")
        print("   - Current threshold may be too strict")
        print("   - Try threshold=0.55 for more matches")
    
    print("\n4. Manual verification:")
    print("   - Spot-check 10-20 matched items")
    print("   - Verify nutrients make sense for the food type")
    
    return report

def generate_custom_mappings(report_path, fndds_excel_path):
    """Suggest custom mappings for unmatched items"""
    
    with open(report_path, 'r') as f:
        report = json.load(f)
    
    no_matches = report['no_matches']
    
    if not no_matches:
        print("No unmatched items to process!")
        return
    
    # Load FNDDS database
    fndds_df = pd.read_excel(fndds_excel_path, sheet_name='FNDDS Nutrient Values', skiprows=1)
    
    print("\n" + "="*80)
    print("SUGGESTED CUSTOM MAPPINGS")
    print("="*80)
    print("\nAdd these to your script in CUSTOM_MAPPINGS dictionary:\n")
    print("CUSTOM_MAPPINGS = {")
    
    # For each unmatched item, suggest potential matches manually
    for item in sorted(no_matches)[:20]:
        # Try to find category-based suggestions
        item_lower = item.lower()
        
        suggestions = []
        
        # Simple keyword matching
        if 'pizza' in item_lower:
            suggestions = fndds_df[fndds_df['Main food description'].str.contains('Pizza', case=False, na=False)]['Main food description'].tolist()[:3]
        elif 'smoothie' in item_lower:
            suggestions = fndds_df[fndds_df['Main food description'].str.contains('Smoothie', case=False, na=False)]['Main food description'].tolist()[:3]
        elif 'tea' in item_lower:
            suggestions = fndds_df[fndds_df['Main food description'].str.contains('Tea', case=False, na=False)]['Main food description'].tolist()[:3]
        elif 'yogurt' in item_lower:
            suggestions = fndds_df[fndds_df['Main food description'].str.contains('Yogurt', case=False, na=False)]['Main food description'].tolist()[:3]
        
        if suggestions:
            print(f"    # '{item}' - Suggestions:")
            for sug in suggestions:
                print(f"    #   - {sug}")
            print(f"    '{item}': 'CHOOSE_ONE_ABOVE',")
        else:
            print(f"    '{item}': 'NEEDS_MANUAL_LOOKUP',")
    
    print("}")
    
    print("\n" + "="*80)
    print("To use these mappings:")
    print("1. Copy the CUSTOM_MAPPINGS dictionary above")
    print("2. Paste it into update_nutrients_from_fndds.py")
    print("3. Choose appropriate FNDDS entries for each item")
    print("4. Re-run the script")
    print("="*80)

if __name__ == "__main__":
    report_path = '/mnt/user-data/outputs/all_meals_updated_with_fndds_match_report.json'
    fndds_excel = '/mnt/user-data/uploads/2021-2023_FNDDS_At_A_Glance_-_FNDDS_Nutrient_Values.xlsx'
    
    print("\n" + "="*80)
    print("NUTRIENT UPDATE - MATCH ANALYSIS TOOL")
    print("="*80)
    
    # Analyze matches
    report = analyze_matches(report_path)
    
    # Suggest custom mappings
    generate_custom_mappings(report_path, fndds_excel)
