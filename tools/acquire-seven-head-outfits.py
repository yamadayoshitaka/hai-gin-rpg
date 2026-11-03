#!/usr/bin/env python3
"""Import verified MIT armor GLBs as candidates; never mark rigging complete."""
import json
import pathlib
import struct
import urllib.request

ROOT = pathlib.Path("assets/characters/seven-head-equipment-candidates")
SOURCE = "https://raw.githubusercontent.com/holokat/game-assets/main/site/collections/armor/models/"
JOBS = {
    "剣士": ["plate_chest", "plate_hands", "plate_feet", "plate_legs"],
    "格闘家": ["cloth_chest", "cloth_legs", "cloth_feet"],
    "魔法使い": ["dark_robe", "cloth_feet"],
    "弓使い": ["leather_chest", "leather_legs", "leather_feet"],
    "盾戦士": ["plate_chest", "plate_head", "plate_hands", "plate_legs", "plate_feet"],
    "盗賊": ["studded_chest", "studded_legs", "leather_feet"],
    "忍者": ["cloth_chest", "cloth_legs", "leather_feet"],
    "農民・職人": ["leather_apron", "cloth_legs", "cloth_feet"],
    "僧侶": ["cloth_chest", "cloth_legs", "cloth_feet"],
    "召喚士": ["dark_robe", "cloth_feet"],
}
def fetch(name):
    dest = ROOT / name
    if dest.exists() and dest.stat().st_size > 20:
        data = dest.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE + name, timeout=35) as response:
            data = response.read()
    if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 8)[0] != len(data):
        raise ValueError("Invalid GLB: " + name)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return len(data)
def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    files = sorted({f"{part}-{sex}.glb" for parts in JOBS.values() for part in parts for sex in ("male","female")})
    sizes = {name: fetch(name) for name in files}
    manifest = {
        "schema": "seven-head-equipment-candidates-v1",
        "source": "holokat/game-assets",
        "license": "MIT",
        "sourceUrl": "https://github.com/holokat/game-assets",
        "status": "downloaded-candidates; rigging/head-ratio/animation fit unverified",
        "jobs": {job: {sex: [f"{part}-{sex}.glb" for part in parts] for sex in ("male","female")} for job,parts in JOBS.items()},
        "files": sizes,
    }
    (ROOT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Validated {len(files)} GLBs; {sum(sizes.values())} bytes")
if __name__ == "__main__":
    main()
