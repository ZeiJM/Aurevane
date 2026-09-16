#!/usr/bin/env python3
"""Decode every registered starter derivative in Chromium (requires Python Playwright).

This is a byte-decoding fixture, NOT an authenticated game or backend test.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright


def check(root: Path, output: Path, chromium: str | None, baseline: str) -> None:
    rows = []
    for source in sorted((root / "apps/web/src/media").glob("generated-starter-portraits-*.ts")):
        entries = re.findall(
            r"id: '(character\.creation\.portrait-\d+)',\s*src: '([^']+)'",
            source.read_text(),
        )
        rows.extend({"id": identifier, "src": uri} for identifier, uri in entries)
    expected = [f"character.creation.portrait-{number:02}" for number in range(1, 41)]
    if [row["id"] for row in rows] != expected:
        raise AssertionError("Expected exactly 40 unique, ordered starter portrait identities.")
    with sync_playwright() as playwright:
        options = {"headless": True}
        if chromium:
            options["executable_path"] = chromium
        browser = playwright.chromium.launch(**options)
        try:
            page = browser.new_page()
            results = page.evaluate("""async rows => await Promise.all(rows.map(async row => {
              const image = new Image();
              image.src = row.src;
              try {
                await image.decode();
                return {id: row.id, decoded: true, width: image.naturalWidth, height: image.naturalHeight};
              } catch (error) {
                return {id: row.id, decoded: false, error: error.message};
              }
            }))""", rows)
            version = browser.version
        finally:
            browser.close()
    for result, source in zip(results, rows, strict=True):
        result["dataUriSha256"] = hashlib.sha256(source["src"].encode()).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "baselineCommit": baseline,
        "environment": "Local Chromium image-decoding fixture; no app, authentication or database",
        "browserVersion": version,
        "portraits": results,
    }, indent=2) + "\n")
    failures = [result["id"] for result in results if not (
        result["decoded"] and result["width"] >= 96 and result["height"] == result["width"]
    )]
    if failures:
        raise AssertionError(f"Malformed or non-square starter portrait derivatives: {failures}")
    print(f"All {len(results)} starter derivatives decoded as square images in Chromium {version}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chromium", help="Optional path to an installed Chromium executable")
    parser.add_argument("--baseline", default="unspecified")
    arguments = parser.parse_args()
    check(arguments.root, arguments.output, arguments.chromium, arguments.baseline)
