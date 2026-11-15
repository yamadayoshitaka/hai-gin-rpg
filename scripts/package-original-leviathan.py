#!/usr/bin/env python3
"""Repair and package the independently authored m020 marine GLTF into GLB.

This script validates actual vertex positions, skin weights, jaw node,
per-species silhouette and seven real animation clips. It does NOT certify
FF-grade art direction or photogrammetry. No paid APIs or Python packages.
"""
import base64
import json
import math
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/creatures/original/m020"
TIERS = {"source": "source", "near": "high", "far": "low"}

def assign_skin(z):
    if z > -1.05:
        return 0, 1., 0.
    if z > -1.67:
        t = (-z - 1.05) / .62
        return 0, 1.-t, t
    if z > -2.62:
        return 1, 1., 0.
    if z > -3.05:
        t = (-z - 2.62) / .43
        return 1, 1.-t, t
    if z > -3.77:
        return 2, 1., 0.
    t = min(1., max(0., (-z - 3.77) / .5))
    return 2, 1.-t, t

def view_at(g, key, primitive):
    acc = g["accessors"][primitive["attributes"][key]]
    view = g["bufferViews"][acc["bufferView"]]
    if "byteStride" in view:
        raise ValueError("Interleaved source buffers are not supported")
    return view["byteOffset"] + acc.get("byteOffset", 0), acc["count"]

def validate_and_pack(tier, target):
    source = OUT / (tier + ".gltf")
    g = json.loads(source.read_text("utf8"))
    assert g["asset"]["version"] == "2.0", source
    assert len(g["skins"]) == 1 and len(g["skins"][0]["joints"]) == 4, source
    assert len(g["animations"]) == 7, source
    assert {a["name"] for a in g["animations"]} == {
        "idle", "walk", "run", "attack", "roar", "hit", "defeat"}, source
    assert g["nodes"][6]["name"] == "JawHinge", source
    assert len(g["meshes"]) == 2 and len(g["materials"]) >= 5, source
    for mat in g["materials"]:
        assert "pbrMetallicRoughness" in mat, "PBR material missing"

    uri = g["buffers"][0]["uri"]
    assert uri.startswith("data:application/octet-stream;base64,"), source
    binary = bytearray(base64.b64decode(uri.split(",", 1)[1]))
    assert len(binary) == g["buffers"][0]["byteLength"], source
    n_vertices = 0
    n_tris = 0
    for primitive in g["meshes"][0]["primitives"]:
        pos, count = view_at(g, "POSITION", primitive)
        joint, j_count = view_at(g, "JOINTS_0", primitive)
        weight, w_count = view_at(g, "WEIGHTS_0", primitive)
        assert j_count == w_count == count
        for i in range(count):
            x, y, z = struct.unpack_from("<3f", binary, pos+i*12)
            assert math.isfinite(x) and math.isfinite(y) and math.isfinite(z)
            j, w0, w1 = assign_skin(z)
            struct.pack_into("<4H", binary, joint+i*8, j, min(3, j+1), 0, 0)
            struct.pack_into("<4f", binary, weight+i*16, w0, w1, 0., 0.)
        n_vertices += count

    for mesh in g["meshes"]:
        for primitive in mesh["primitives"]:
            ind = g["accessors"][primitive["indices"]]
            assert ind["componentType"] == 5123 and ind["count"] % 3 == 0
            n_tris += ind["count"] // 3
            view = g["bufferViews"][ind["bufferView"]]
            off = view["byteOffset"] + ind.get("byteOffset", 0)
            high_index = max(struct.unpack_from("<" + "H"*ind["count"], binary, off))
            assert high_index < g["accessors"][primitive["attributes"]["POSITION"]]["count"]
    assert n_vertices > 4000 and n_tris > 5000
    assert len(g.get("images", [])) >= 2

    # GLB 2.0 BIN chunk with internal PBR data URIs preserved in the JSON.
    del g["buffers"][0]["uri"]
    g["extras"]["modelData"]["sourceSkinWeightsFixed"] = True
    g["extras"]["productionStatus"] = "redesigned marine model, not FF-grade-certified"
    json_bytes = json.dumps(g, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary += b"\0" * (-len(binary) % 4)
    chunk_a = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
    chunk_b = struct.pack("<I4s", len(binary), b"BIN\0") + binary
    output = b"glTF" + struct.pack("<II", 2, 12 + len(chunk_a) + len(chunk_b))
    output += chunk_a + chunk_b
    path = OUT / (target + ".glb")
    path.write_bytes(output)
    assert output[:4] == b"glTF"
    assert struct.unpack_from("<I", output, 8)[0] == len(output)
    return {"tier": target, "triangles": n_tris, "vertices": n_vertices,
            "bytes": len(output), "skinJoints": 4, "clips": 7, "file": str(path.relative_to(ROOT))}

def main():
    details = [validate_and_pack(src, dest) for src, dest in TIERS.items()]
    assert details[0]["triangles"] > details[1]["triangles"] > details[2]["triangles"]
    manifest = {
      "schema": "hai-gin/original-real-creature/v1",
      "id": "m020",
      "name": "深海リヴァイアサン",
      "author": "Hai-Gin original generated geometry",
      "license": "Project original, no external donor mesh",
      "master": "./assets/creatures/original/m020/source.glb",
      "high": "./assets/creatures/original/m020/high.glb",
      "low": "./assets/creatures/original/m020/low.glb",
      "model": {"authoring": "hand-authored sectional marine anatomy",
                "pbr": True, "jointCount": 4, "realAnimationClips": 7,
                "photogrammetry": False, "ffQualityApproved": False,
                "characterDesignerApproved": False},
      "generated": details
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
    print(json.dumps(details, ensure_ascii=False))
if __name__ == "__main__":
    main()
