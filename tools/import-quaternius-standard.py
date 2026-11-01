"""Fetch Quaternius Standard CC0 animation GLB via public itch.io file API."""
import io
import json
import pathlib
import urllib.request
import zipfile

ROOT = pathlib.Path("motions/quaternius")
ROOT.mkdir(parents=True, exist_ok=True)
packs = [("ual1", "universal-animation-library", 17958403)]
for name, slug, file_id in packs:
    api = f"https://quaternius.itch.io/{slug}/file/{file_id}?source=game_download&as_props=1"
    req = urllib.request.Request(api, data=b"", method="POST", headers={"User-Agent": "hai-gin-rpg/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        signed_url = json.load(response)["url"]
    with urllib.request.urlopen(signed_url, timeout=120) as response:
        payload = response.read()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        options = [p for p in archive.namelist() if p.lower().endswith(".glb") and "standard" in p.lower() and "_rm" not in p.lower()]
        if not options:
            raise RuntimeError(f"No Standard GLB found in {name}")
        preferred = sorted(options, key=lambda p: ("unreal-godot" not in p.lower(), len(p)))[0]
        target = ROOT / f"{name}-standard.glb"
        target.write_bytes(archive.read(preferred))
        print(f"Imported {preferred} to {target} ({target.stat().st_size} bytes)")
(ROOT / "README.md").write_text("Quaternius Universal Animation Library Standard (CC0). Imported GLB is an unreviewed source asset; clips must be inspected and mapped before enabling jobs.\n", encoding="utf-8")
