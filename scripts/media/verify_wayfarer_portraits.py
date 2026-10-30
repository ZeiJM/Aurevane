#!/usr/bin/env python3
"""Verify the committed Wayfarer derivatives without requiring the original PNG masters."""
import base64
import hashlib
import json
from pathlib import Path
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
MANIFEST = PUBLIC / "media/art/wayfarer/provenance.json"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def verify():
    manifest = json.loads(MANIFEST.read_text())
    assert [row["number"] for row in manifest["records"]] == list(range(2, 41))
    assert manifest["artworkSetVersion"] == "wayfarer-v02"
    pixel_hashes = set()
    total = 0
    for row in manifest["records"]:
        runtime = row["runtime"]
        assert runtime["path"] == f'/media/art/wayfarer/portrait-{row["number"]:02}-v02.webp'
        path = PUBLIC / runtime["path"].lstrip("/")
        data = path.read_bytes()
        assert sha256(data) == runtime["sha256"]
        assert len(data) == runtime["byteLength"]
        with Image.open(path) as image:
            image.load()  # Fully decode pixels, not merely the WebP header.
            assert image.format == "WEBP" and image.size == (1024, 1024)
            rgb = image.convert("RGB")
            assert rgb.getcolors(1024) is None, "Portrait has unexpectedly few distinct colors"
            pixels = sha256(rgb.tobytes())
            assert pixels == runtime["decodedPixelSha256"]
            assert pixels not in pixel_hashes, "Duplicate decoded portrait"
            pixel_hashes.add(pixels)
        assert row["origin"] == "OpenAI built-in imagegen"
        assert row["generatedMaster"]["dimensions"][0] >= 1024
        assert row["generatedMaster"]["dimensions"][0] == row["generatedMaster"]["dimensions"][1]
        assert row["prompt"] and row["inputs"]
        total += len(data)
    assert len(pixel_hashes) == 39
    source = (ROOT / "apps/web/src/media/generated-starter-portraits-1.ts").read_text()
    first = re.search(r"id: 'character.creation.portrait-01',\s*src: 'data:image/webp;base64,([^']+)'", source)
    assert first
    preserved = manifest["preservedAssets"]
    assert len(preserved) == 25
    for row in preserved:
        data = base64.b64decode(first[1]) if row["portraitRef"].endswith("wayfarer-01") else (PUBLIC / row["runtimePath"].lstrip("/")).read_bytes()
        assert sha256(data) == row["sha256"]
    print(json.dumps({"portraitsDecoded": 39, "preservedPortraits": 25, "runtimeBytes": total}))


if __name__ == "__main__":
    verify()
