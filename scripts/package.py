#!/usr/bin/env python3
"""Zip the built dist/ folder (plus README, LICENSE, PRIVACY.md) into xanderbugs-v<version>.zip.

Files sit inside a top-level xanderbugs/ folder, so unzipping gives a folder ready for Load unpacked.

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
DOCS = ["README.md", "LICENSE", "PRIVACY.md"]
FOLDER = "xanderbugs"


def main(argv):
    version = json.loads((ROOT / "manifest.json").read_text())["version"]
    tag = argv[1] if len(argv) > 1 else ""
    if tag and tag.removeprefix("v") != version:
        sys.exit(f"Tag {tag} does not match manifest version {version}")
    if not (DIST / "manifest.json").is_file():
        sys.exit("dist/ is missing; run `npm run build` first")
    if json.loads((DIST / "manifest.json").read_text())["version"] != version:
        sys.exit("dist/ is stale; run `npm run build` first")

    files = [(p, p.relative_to(DIST)) for p in sorted(DIST.rglob("*")) if p.is_file()]
    files += [(ROOT / name, Path(name)) for name in DOCS]
    bad = [rel for _, rel in files if any(part.startswith("_") for part in rel.parts)]
    if bad:
        sys.exit(f"Chrome rejects files starting with '_': {bad}")

    out = ROOT / f"xanderbugs-v{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for p, rel in files:
            zf.write(p, f"{FOLDER}/{rel.as_posix()}")
    print(out.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main(sys.argv)
