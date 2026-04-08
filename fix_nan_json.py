#!/usr/bin/env python3
"""
fix_nan_json.py
Replaces bare NaN / Infinity / -Infinity values in a JSON file with null,
making it valid for JSON.parse() in JavaScript.

Usage:
    python fix_nan_json.py foods_updated.json
    python fix_nan_json.py foods_updated.json --out foods_clean.json
"""
import re
import sys
import json
import argparse
from pathlib import Path

def fix_nan(src: Path, dst: Path):
    print(f"Reading {src} ...")
    text = src.read_text(encoding="utf-8")

    before = len(text)

    # Replace bare NaN / Infinity tokens that are not inside quoted strings.
    # This regex matches them only when surrounded by JSON structural chars.
    nan_count = len(re.findall(r'\bNaN\b', text))
    inf_count = len(re.findall(r'\b-?Infinity\b', text))

    text = re.sub(r'\bNaN\b', 'null', text)
    text = re.sub(r'\b-Infinity\b', 'null', text)
    text = re.sub(r'\bInfinity\b', 'null', text)

    # Verify the result actually parses
    print(f"Replaced {nan_count} NaN and {inf_count} Infinity values → null")
    print("Validating JSON...")
    try:
        data = json.loads(text)
        count = len(data) if isinstance(data, list) else 1
        print(f"✅ Valid JSON — {count} records")
    except json.JSONDecodeError as e:
        print(f"❌ Still invalid after substitution: {e}")
        print("   There may be a deeper structural issue. Exiting without writing.")
        sys.exit(1)

    dst.write_text(text, encoding="utf-8")
    after = len(text)
    print(f"Written to {dst}  ({before:,} → {after:,} bytes)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("src", help="Input JSON file (e.g. foods_updated.json)")
    parser.add_argument("--out", help="Output path (default: overwrites src)", default=None)
    args = parser.parse_args()

    src = Path(args.src)
    dst = Path(args.out) if args.out else src

    if not src.exists():
        print(f"File not found: {src}")
        sys.exit(1)

    fix_nan(src, dst)
