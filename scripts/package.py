#!/usr/bin/env python3
"""Zip the built dist/ folder into xanderbugs-v<version>.zip for the Chrome Web Store.

Usage: scripts/package.py [tag]   (run `npm run build` first; `npm run zip` does both)
If a tag (e.g. v1.0.1) is given, it must match the manifest version.
Prints the path of the created zip.
"""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def main(argv):
    version = json.loads((ROOT / "manifest.json").read_text())["version"]
    tag = argv[1] if len(argv) > 1 else ""
    if tag and tag.removeprefix("v") != version:
        sys.exit(f"Tag {tag} does not match manifest version {version}")
    if not (DIST / "manifest.json").is_file():
        sys.exit("dist/ is missing; run `npm run build` first")
    if json.loads((DIST / "manifest.json").read_text())["version"] != version:
        sys.exit("dist/ is stale; run `npm run build` first")

    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    bad = [p for p in files if any(part.startswith("_") for part in p.relative_to(DIST).parts)]
    if bad:
        sys.exit(f"Chrome rejects files starting with '_': {bad}")

    out = ROOT / f"xanderbugs-v{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            zf.write(p, p.relative_to(DIST).as_posix())
    print(out.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main(sys.argv)
