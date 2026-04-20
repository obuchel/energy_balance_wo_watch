"""
merge_foods.py
--------------
Compresses the new foods array (foods.json) and merges it with the
existing compressed database (foods_updated.json).

Supported compression formats for foods_updated.json:
  - gzip  (.json.gz or magic bytes \x1f\x8b)
  - zlib  (deflate, magic bytes \x78\x9c / \x78\x01 / \x78\xda)
  - Plain JSON (uncompressed fallback)

Output is written in the same compression format as foods_updated.json.
Duplicate entries (matched by 'name' field) are skipped with a warning.

Usage:
    python merge_foods.py \
        --new    foods.json \
        --db     foods_updated.json \
        --output foods_updated.json   # overwrite in place, or give a new name

    # optionally force a specific compression:
    python merge_foods.py --new foods.json --db foods_updated.json --compress gzip
"""

import argparse
import gzip
import json
import os
import sys
import zlib


# ── Compression detection ──────────────────────────────────────────────────────

def detect_format(path: str) -> str:
    """Return 'gzip', 'zlib', or 'plain' by inspecting magic bytes."""
    with open(path, "rb") as f:
        header = f.read(4)
    if header[:2] == b"\x1f\x8b":
        return "gzip"
    if header[:1] in (b"\x78",) and header[1:2] in (b"\x9c", b"\x01", b"\xda", b"\x5e"):
        return "zlib"
    return "plain"


# ── Read helpers ───────────────────────────────────────────────────────────────

def read_json(path: str) -> list:
    """Read a JSON file regardless of compression; always returns a list."""
    fmt = detect_format(path)
    print(f"  Detected format for '{os.path.basename(path)}': {fmt}")

    with open(path, "rb") as f:
        raw = f.read()

    if fmt == "gzip":
        data = gzip.decompress(raw)
    elif fmt == "zlib":
        data = zlib.decompress(raw)
    else:
        data = raw

    parsed = json.loads(data.decode("utf-8"))
    if isinstance(parsed, dict):
        # tolerate a dict wrapper like {"foods": [...]}
        for key in ("foods", "data", "items", "records"):
            if key in parsed and isinstance(parsed[key], list):
                print(f"  Unwrapped dict key '{key}'")
                return parsed[key]
        raise ValueError(
            f"Expected a JSON array or a dict with a known list key, "
            f"got dict with keys: {list(parsed.keys())}"
        )
    if not isinstance(parsed, list):
        raise TypeError(f"Expected a JSON array, got {type(parsed).__name__}")
    return parsed


# ── Write helpers ──────────────────────────────────────────────────────────────

def write_json(data: list, path: str, fmt: str) -> None:
    """Serialise data to JSON and write with the requested compression."""
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")

    if fmt == "gzip":
        compressed = gzip.compress(payload, compresslevel=9)
    elif fmt == "zlib":
        compressed = zlib.compress(payload, level=9)
    else:
        compressed = payload  # plain text

    with open(path, "wb") as f:
        f.write(compressed)

    ratio = len(compressed) / max(len(payload), 1) * 100
    print(
        f"  Written '{os.path.basename(path)}' [{fmt}] "
        f"{len(compressed):,} bytes ({ratio:.1f}% of uncompressed {len(payload):,} bytes)"
    )


# ── Merge logic ────────────────────────────────────────────────────────────────

def merge(existing: list, new_entries: list) -> tuple[list, int, int]:
    """
    Append new_entries to existing, skipping duplicates by 'name' (case-insensitive).
    Returns (merged_list, added_count, skipped_count).
    """
    existing_names = {
        entry.get("name", "").strip().lower()
        for entry in existing
        if isinstance(entry, dict)
    }

    added, skipped = 0, 0
    merged = list(existing)  # shallow copy

    for entry in new_entries:
        if not isinstance(entry, dict):
            print(f"  WARNING: skipping non-dict entry: {entry!r:.80}")
            skipped += 1
            continue

        name = entry.get("name", "").strip().lower()
        if name in existing_names:
            print(f"  SKIP (duplicate): '{entry.get('name')}'")
            skipped += 1
        else:
            merged.append(entry)
            existing_names.add(name)
            added += 1

    return merged, added, skipped


# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Merge new foods into compressed database.")
    p.add_argument("--new",      default="foods.json",         help="New foods array (plain JSON)")
    p.add_argument("--db",       default="foods_updated.json", help="Existing database (any format)")
    p.add_argument("--output",   default=None,                 help="Output path (default: overwrite --db)")
    p.add_argument(
        "--compress",
        choices=["gzip", "zlib", "plain", "auto"],
        default="auto",
        help="Output compression (auto = match input DB format)"
    )
    return p.parse_args()


def main():
    args = parse_args()
    output_path = args.output or args.db

    print(f"\n{'─'*55}")
    print("  STEP 1 — Read new foods")
    print(f"{'─'*55}")
    new_entries = read_json(args.new)
    print(f"  Loaded {len(new_entries)} new entry/entries from '{args.new}'")

    print(f"\n{'─'*55}")
    print("  STEP 2 — Read existing database")
    print(f"{'─'*55}")
    db_fmt = detect_format(args.db)
    existing = read_json(args.db)
    print(f"  Loaded {len(existing):,} existing entries from '{args.db}'")

    print(f"\n{'─'*55}")
    print("  STEP 3 — Merge")
    print(f"{'─'*55}")
    merged, added, skipped = merge(existing, new_entries)
    print(f"  Added:   {added}")
    print(f"  Skipped: {skipped} (duplicates)")
    print(f"  Total:   {len(merged):,} entries")

    print(f"\n{'─'*55}")
    print("  STEP 4 — Write output")
    print(f"{'─'*55}")
    out_fmt = db_fmt if args.compress == "auto" else args.compress
    print(f"  Output compression: {out_fmt}")
    write_json(merged, output_path, out_fmt)

    print(f"\n✓ Done — merged database saved to '{output_path}'\n")


if __name__ == "__main__":
    main()
