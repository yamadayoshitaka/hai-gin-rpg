#!/usr/bin/env python3
"""Fetch four upstream CC0 Quaternius fantasy outfits, optimize textures for mobile.
Never use this for proprietary packs. Exact source commit is recorded by GitHub workflow.
"""
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request
import json, io
from PIL import Image
REPO="https://raw.githubusercontent.com/agentkaerf/FreeModels/main/"
FOLDER="Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/"
DEST=Path("assets/characters/quaternius-outfits")
DEST.mkdir(parents=True,exist_ok=True)
NAMES=["Male_Peasant","Female_Peasant","Male_Ranger","Female_Ranger"]
textures=set()
def fetch(name):
  url=REPO+quote(FOLDER+name,safe="/")
  with urlopen(Request(url,headers={"User-Agent":"hai-gin-rpg-CC0-asset-import"}),timeout=60) as r:return r.read()
for name in NAMES:
  raw=fetch(name+".gltf")
  gltf=json.loads(raw)
  for b in gltf.get("buffers",[]):(DEST/b["uri"]).write_bytes(fetch(b["uri"]))
  for t in gltf.get("images",[]):textures.add(t["uri"])
  (DEST/(name+".gltf")).write_bytes(raw)
for name in sorted(textures):
  img=Image.open(io.BytesIO(fetch(name))).convert("RGB")
  img.thumbnail((512,512),Image.Resampling.LANCZOS)
  img.save(DEST/name,optimize=True,compress_level=9)
print("Imported",len(NAMES),"rigged models and",len(textures),"optimized textures")

# Full Quaternius humanoid bases, retained by OpenAgents with CC0 licences.
# These complement the headless outfit meshes; no material is inferred from screenshots.
UPSTREAM="https://raw.githubusercontent.com/OpenAgentsInc/openagents/main/assets/verse/characters/quaternius/"
BASE_DEST=Path("assets/characters/quaternius-base")
(BASE_DEST/"textures").mkdir(parents=True,exist_ok=True)
def fetch_upstream(path):
  with urlopen(Request(UPSTREAM+quote(path,safe="/"),headers={"User-Agent":"hai-gin-rpg-CC0-asset-import"}),timeout=90) as r:return r.read()
for gender in ("Male","Female"):
  name="Superhero_"+gender+"_FullBody"
  gltf=json.loads(fetch_upstream("base/"+name+".gltf"))
  for b in gltf.get("buffers",[]):
    (BASE_DEST/b["uri"]).write_bytes(fetch_upstream("base/"+b["uri"]))
  for image in gltf.get("images",[]):
    original=image["uri"]
    if not original.startswith("../textures/"):raise ValueError("Unexpected texture URI: "+original)
    filename=Path(original).name
    output=BASE_DEST/"textures"/filename
    if not output.exists():
      im=Image.open(io.BytesIO(fetch_upstream("textures/"+filename))).convert("RGB")
      im.thumbnail((512,512),Image.Resampling.LANCZOS)
      im.save(output,optimize=True,compress_level=9)
    image["uri"]="textures/"+filename
  (BASE_DEST/(name+".gltf")).write_text(json.dumps(gltf,separators=(",",":")))
for name in ("base-license.txt","animations-license.txt","README.md"):
  (BASE_DEST/name).write_bytes(fetch_upstream(name))
(BASE_DEST/"animations.glb").write_bytes(fetch_upstream("animations.glb"))
print("Imported two CC0 full-body humanoids and common animation library")
