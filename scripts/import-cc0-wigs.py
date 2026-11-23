#!/usr/bin/env python3
"""Fetch independently authored CC0 wig GLBs for the new wig-only studio.

Uses the public MakeHuman/CharacterCreator hair models ONLY as wig source meshes,
not any prior hai-gin-rpg hair geometry, renderer, or GPL program code.

Source code: https://github.com/kblood/CharacterCreator
Licence for *generated output/hair_*.glb*: CC0-1.0
https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md

Upstream files are pinned by Git blob SHA-1, length, GLB header and mesh count.
Never accept a changed remote binary silently, particularly for a commercial game.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import struct
import time
import urllib.error
import urllib.request

SOURCE_BASE = "https://raw.githubusercontent.com/kblood/CharacterCreator/master/output/"
SOURCES = {
    "long01": {
        "file": "hair_long01.glb",
        "length": 1545168,
        "blob_sha": "3a898bb098bd81ff45b24422890a47320a5d922d",
        "name": "ロングヘア",
    },
    "bob01": {
        "file": "hair_bob01.glb",
        "length": 1971860,
        "blob_sha": "8982bedabde11928b18bcedc9084fc77db9ee455",
        "name": "ロングボブ",
    },
    "ponytail01": {
        "file": "hair_ponytail01.glb",
        "length": 1825960,
        "blob_sha": "eb86d1319e83feec5c314b4639a8b35fd31d866a",
        "name": "ポニーテール",
    },
}


def inspect_glb(blob: bytes) -> dict:
    if len(blob) < 4096 or blob[:4] != b"glTF":
        raise ValueError("GLB header missing, unsuitable hair source")
    version, length = struct.unpack_from("<II", blob, 4)
    if version != 2 or length != len(blob):
        raise ValueError("Invalid glTF version / binary length")
    json_size, chunk_type = struct.unpack_from("<II", blob, 12)
    if chunk_type != 0x4E4F534A or json_size > len(blob) - 20:
        raise ValueError("Invalid GLB JSON chunk")
    header = json.loads(blob[20 : 20 + json_size])
    meshes = header.get("meshes", [])
    if not meshes or not any(mesh.get("primitives") for mesh in meshes):
        raise ValueError("Downloaded GLB does not contain any hair geometry")
    return {
        "meshes": len(meshes),
        "meshNames": [mesh.get("name", "") for mesh in meshes][:24],
        "materials": len(header.get("materials", [])),
        "images": len(header.get("images", [])),
        "nodes": len(header.get("nodes", [])),
        "skins": len(header.get("skins", [])),
    }


def checked_download(style: str, spec: dict) -> tuple[bytes, dict]:
    url = SOURCE_BASE + spec["file"]
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "HaiGinRPG-WigAssetImport/1.0"}
            )
            with urllib.request.urlopen(request, timeout=25) as response:
                blob = response.read(6_000_000)
            if len(blob) != spec["length"]:
                raise ValueError(
                    f"{style}: expected {spec['length']} bytes, got {len(blob)}"
                )
            sha = hashlib.sha1(
                f"blob {len(blob)}\0".encode("ascii") + blob
            ).hexdigest()
            if sha != spec["blob_sha"]:
                raise ValueError(
                    f"{style}: source changed (blob SHA {sha}); review licence and mesh"
                )
            return blob, inspect_glb(blob)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            error = exc
            if attempt < 2:
                time.sleep(1 + attempt)
    raise RuntimeError(f"Could not download CC0 hair source: {url}: {error}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=pathlib.Path)
    parser.add_argument("--only", choices=tuple(SOURCES), help="Import one style")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {"schema": "hai-gin-wig-source-v1", "licence": "CC0-1.0", "styles": []}
    for style, spec in SOURCES.items():
        if args.only and style != args.only:
            continue
        blob, info = checked_download(style, spec)
        dest = args.out / spec["file"]
        dest.write_bytes(blob)
        manifest["styles"].append(
            {
                "id": style,
                "label": spec["name"],
                "file": spec["file"],
                "bytes": len(blob),
                "gitBlobSHA": spec["blob_sha"],
                "url": SOURCE_BASE + spec["file"],
                "source": "MakeHuman CC0 system assets via kblood/CharacterCreator",
                "licence": "CC0-1.0",
                **info,
            }
        )
        print(f"IMPORTED {style}: {len(blob)} bytes, {info['meshes']} meshes, CC0")
    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
