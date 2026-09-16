#!/usr/bin/env python3
"""Restore damaged derivatives from the owner's approved HQ sheet (requires Pillow).

Usage: python tools/restore-starter-portraits.py --source /path/to/aurevane_character_creation_screen.png
The source is identified by SHA-256; no artwork generation or gameplay mutation occurs.
After recovery, format the JSON manifest with the repository's pinned Prettier.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image

SOURCE_SHA256 = "33e1f6d4e0015a77962693ed8b90261edc67ff807ba8445a6afa9f0dd9f1d72f"
RESTORED_IDS = (1, 22, *range(25, 41))


def restore(source: Path, root: Path) -> None:
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("This is not the approved 1672x941 HQ creation sheet.")
    image = Image.open(source).convert("RGB")
    if image.size != (1672, 941):
        raise ValueError("The source dimensions changed; do not guess new crop coordinates.")
    manifest = []
    for number in RESTORED_IDS:
        column, row = (number - 1) % 8, (number - 1) // 8
        x, y = 291 + column * 90, 227 + row * 90
        box = (1052, 224, 1452, 624) if number == 1 else (x, y, x + 80, y + 80)
        size = 400 if number == 1 else 96
        crop = image.crop(box).resize((size, size), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        crop.save(buffer, format="WEBP", quality=90, method=6)
        payload = buffer.getvalue()
        decoded = Image.open(io.BytesIO(payload))
        decoded.load()
        if decoded.size != (size, size):
            raise ValueError(f"Portrait {number} did not encode as a square.")
        identifier = f"character.creation.portrait-{number:02}"
        destination = root / f"apps/web/src/media/generated-starter-portraits-{(number - 1) // 6 + 1}.ts"
        pattern = rf"(id: '{re.escape(identifier)}',\s*src: ')[^']+(')"
        content, replacements = re.subn(
            pattern,
            lambda match: match[1] + "data:image/webp;base64," + base64.b64encode(payload).decode("ascii") + match[2],
            destination.read_text(),
        )
        if replacements != 1:
            raise ValueError(f"Expected exactly one existing entry for {identifier}.")
        destination.write_text(content)
        manifest.append({"id": identifier, "sourceBox": box, "width": size, "height": size, "sha256": hashlib.sha256(payload).hexdigest()})
    provenance = {
        "sourceFilename": source.name,
        "sourceSha256": SOURCE_SHA256,
        "sourceDimensions": [1672, 941],
        "sourceOrigin": "Owner-provided UI handover references/current-hq/aurevane_character_creation_screen.png",
        "operation": "Mechanical crop and WebP encoding. Portrait 01 uses its larger matching preview; 22 and 25-40 repair malformed encoded derivatives. All IDs are retained.",
        "restored": manifest,
    }
    (root / "apps/web/src/media/starter-portrait-restoration.json").write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    restore(args.source, args.root)
