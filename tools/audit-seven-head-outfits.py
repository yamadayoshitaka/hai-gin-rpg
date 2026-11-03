#!/usr/bin/env python3
"""Audit downloaded outfit GLBs without assuming they fit the game's rig."""
import json, pathlib, struct
ROOT=pathlib.Path("assets/characters/seven-head-equipment-candidates")
manifest=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))
results={}
for name in manifest["files"]:
    raw=(ROOT/name).read_bytes()
    if raw[:4]!=b"glTF" or len(raw)<20: raise ValueError(name)
    chunk_len,chunk_type=struct.unpack_from("<I4s",raw,12)
    if chunk_type!=b"JSON": raise ValueError("No JSON chunk: "+name)
    gltf=json.loads(raw[20:20+chunk_len])
    skins=gltf.get("skins",[])
    joints=[len(s.get("joints",[])) for s in skins]
    nodes=gltf.get("nodes",[])
    skinned_nodes=sum("skin" in n for n in nodes)
    results[name]={"meshes":len(gltf.get("meshes",[])),"skins":len(skins),"jointCounts":joints,"skinnedNodes":skinned_nodes,"animations":len(gltf.get("animations",[])),"status":"candidate-rig-compatibility-unverified"}
summary={"schema":"outfit-rig-audit-v1","source":"holokat/game-assets","results":results,"totalFiles":len(results),"withSkins":sum(bool(x["skins"]) for x in results.values()),"note":"Skin presence does not prove compatibility with seven-head base rig. No runtime activation."}
(ROOT/"rig-audit.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"GLBs={summary['totalFiles']} skinned={summary['withSkins']}")
