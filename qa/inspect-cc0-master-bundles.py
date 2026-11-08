#!/usr/bin/env python3
"""Inspect two official free-source ZIPs without extracting untrusted archives.

Keep *unoptimized originals* only as CI artifacts pending model-fitting QA.
Copyright source: Blender Studio CC0 Human Base Meshes v1.4.1 and the
Makehuman-2 CC0 Viking release. This script never uses a paid service.
"""
from __future__ import annotations
import hashlib
import json
import pathlib
import sys
import zipfile

OUT = pathlib.Path("qa-reports")
OUT.mkdir(exist_ok=True)
SPEC = [
  dict(id="blender-human-v1.4.1",
       filename="human-base-meshes-bundle-v1.4.1.zip",
       upstream="https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip",
       license="CC0-1.0", license_url="https://www.blender.org/download/demo-files/",
       min_bytes=20_000_000, max_bytes=65_000_000, must_have=(".blend",)),
  dict(id="makehuman-viking-cc0",
       filename="RP_Viking_set_CC0.zip",
       upstream="https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/RP_Viking_set_CC0.zip",
       license="CC0-1.0", license_url="https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/tag/CC0",
       min_bytes=1_000_000, max_bytes=35_000_000, must_have=(".obj", ".mhclo", ".mhmat", ".png", ".jpg")),
]
res=[]
for entry in SPEC:
    f=pathlib.Path("qa-master-sources")/entry["filename"]
    if not f.is_file():
        raise RuntimeError(f"Official high-detail source not downloaded: {f}")
    size=f.stat().st_size
    if size < entry["min_bytes"] or size > entry["max_bytes"]:
        raise RuntimeError(f"Source archive unexpected size: {f}={size}")
    hash=hashlib.sha256(f.read_bytes()).hexdigest()
    with zipfile.ZipFile(f) as z:
        names=z.namelist()
        assert names and len(names)<20_000, f"Suspicious ZIP entry count: {len(names)}"
        assert all(not n.startswith(("/", "\\")) and ".." not in n.replace("\\", "/").split("/") for n in names), "Unsafe ZIP path"
        assert sum(i.file_size for i in z.infolist())<1_200_000_000, "Expanded source too large"
        if not any(n.lower().endswith(entry["must_have"]) for n in names):
            raise RuntimeError(f"{f} lacks usable model data (expected {entry['must_have']})")
        invalid=z.testzip()
        if invalid is not None:raise RuntimeError(f"Source ZIP CRC failed: {invalid}")
        entry=dict(entry)
        entry.update(bytes=size,sha256=hash,files=len(names),
                     previewFiles=[n for n in names if n.lower().endswith((".blend",".obj",".glb",".fbx",".png",".mhclo"))][:45],
                     state="downloaded-archive-validated",meshFitVerified=False,
                     sourceMasterUnoptimized=True,ff13ArtVerified=False,
                     loadedIntoLiveGame=False)
        res.append(entry)
print("OFFICIAL_CC0_MASTER_SOURCE "+json.dumps([{"id":x["id"],"bytes":x["bytes"],"files":x["files"],"sha256":x["sha256"]} for x in res]))
(OUT/"official-cc0-master-source-validation.json").write_text(json.dumps({"assets":res,"realMeshImport":False,
 "note":"Original archives preserved as artifact, no UV/rig-fit or visual proof"},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
