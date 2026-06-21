#!/usr/bin/env python3
"""Add or update the per-artwork modifying_prompt field in list.json."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ensure every art piece has a modifying_prompt string.",
    )
    parser.add_argument(
        "--file",
        default="list.json",
        help="Path to the art book JSON file. Defaults to list.json.",
    )
    parser.add_argument(
        "--default",
        default="",
        help="Default value for missing modifying_prompt fields.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing modifying_prompt values with the default.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    path = Path(args.file)
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    total = 0

    for artist in data:
        for piece in artist.get("art_pieces", []):
            total += 1
            if args.overwrite or "modifying_prompt" not in piece:
                piece["modifying_prompt"] = args.default
                changed += 1

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Checked {total} art pieces; updated {changed}.")


if __name__ == "__main__":
    main()
