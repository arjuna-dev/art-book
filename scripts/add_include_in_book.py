#!/usr/bin/env python3
"""Add or update the per-artwork include_in_book flag in list.json."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ensure every art piece has an include_in_book boolean flag.",
    )
    parser.add_argument(
        "--file",
        default="list.json",
        help="Path to the art book JSON file. Defaults to list.json.",
    )
    parser.add_argument(
        "--default",
        choices=("true", "false"),
        default="true",
        help="Default value for missing include_in_book flags.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing include_in_book values with the default.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    path = Path(args.file)
    include_default = args.default == "true"

    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    total = 0

    for artist in data:
        for piece in artist.get("art_pieces", []):
            total += 1
            if args.overwrite or "include_in_book" not in piece:
                piece["include_in_book"] = include_default
                changed += 1

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Checked {total} art pieces; updated {changed}.")


if __name__ == "__main__":
    main()
