#!/usr/bin/env python3
"""Audit actual source GLB positions and triangles, never just GLB magic header.

Example: python3 scripts/audit-wig-glb.py /tmp/wigs/hair_long01.glb
No external Python deps. This deliberately separates geometric quality from GLB validity.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import statistics
import struct

TYPES = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
FORMAT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}


def unpack(blob):
    if blob[:4] != b"glTF":
        raise ValueError("not a GLB")
    if struct.unpack_from("<I", blob, 4)[0] != 2:
        raise ValueError("not GLB2")
    off = 12
    js = None
    binary = None
    while off + 8 <= len(blob):
        length, kind = struct.unpack_from("<II", blob, off)
        off += 8
        chunk = blob[off : off + length]
        off += length
        if kind == 0x4E4F534A:
            js = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
    if js is None or binary is None:
        raise ValueError("Missing GLB2 JSON/BIN chunk")
    return js, binary


def values(js, binary, ai):
    a = js["accessors"][ai]
    v = js["bufferViews"][a["bufferView"]]
    n = TYPES[a["type"]]
    code = FORMAT[a["componentType"]]
    unit = struct.calcsize("<" + code)
    stride = v.get("byteStride", n * unit)
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    decode = struct.Struct("<" + code * n)
    return [decode.unpack_from(binary, start + stride * i) for i in range(a["count"])]


def quant(v, fraction):
    if not v:
        return None
    a = sorted(v)
    return round(a[int((len(a)-1)*fraction)], 6)


def audit(path):
    js, binchunk = unpack(Path(path).read_bytes())
    print("NODES", json.dumps([
        {k: n.get(k) for k in ("name", "mesh", "translation", "rotation", "scale", "matrix", "children") if k in n}
        for n in js.get("nodes", [])
    ], ensure_ascii=False)[:5000])
    results = []
    for i, m in enumerate(js["meshes"]):
        for j, primitive in enumerate(m["primitives"]):
            p = values(js, binchunk, primitive["attributes"]["POSITION"])
            idx = [x[0] for x in values(js, binchunk, primitive["indices"])] if "indices" in primitive else list(range(len(p)))
            x, y, z = zip(*p)
            lo = [min(x), min(y), min(z)]
            hi = [max(x), max(y), max(z)]
            size = [hi[k]-lo[k] for k in range(3)]
            edges = []
            degenerates=0
            for v in range(0, len(idx)-2, 3):
                tri=[p[k] for k in idx[v:v+3]]
                d=[
                    math.dist(tri[0],tri[1]),
                    math.dist(tri[1],tri[2]),
                    math.dist(tri[2],tri[0])
                ]
                edges.extend(d)
                if min(d)<1e-7: degenerates+=1
            detail = {
                "mesh": m.get("name", i),
                "primitive": j,
                "mode": primitive.get("mode", 4),
                "vertices": len(p),
                "triangles": len(idx)//3,
                "bounds": {"min": lo, "max": hi, "size": size},
                "edge_median": quant(edges,.5),
                "edge_p95": quant(edges,.95),
                "edge_p99": quant(edges,.99),
                "edge_max": max(edges) if edges else None,
                "triangle_degenerate": degenerates,
                "mesh_targets": len(primitive.get("targets", [])),
                "attributes": list(primitive["attributes"]),
                "material": primitive.get("material"),
            }
            results.append(detail)
    print("GEOMETRY", json.dumps(results, ensure_ascii=False)[:14000])
    print("SUMMARY", json.dumps({
        "asset": str(path), "meshes":len(js["meshes"]),
        "totalVertices": sum(r["vertices"] for r in results),
        "totalTriangles": sum(r["triangles"] for r in results),
        "materials":len(js.get("materials",[])),
        "images":len(js.get("images",[])),
        "animations":len(js.get("animations",[]))
    }))
    return results


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("path",nargs="+")
    args=parser.parse_args()
    for path in args.path:
        print("WIG_ASSET",path)
        audit(path)
