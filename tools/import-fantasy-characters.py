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
