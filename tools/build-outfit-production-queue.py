#!/usr/bin/env python3
"""Inventory every unique source armor and every job/sex dependency; no false readiness."""
import json
from pathlib import Path

root=Path("assets/characters/seven-head-equipment-candidates")
manifest=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
audit=json.loads((root/"rig-audit.json").read_text(encoding="utf-8"))
usage={}
for job, sexes in manifest["jobs"].items():
    for sex, files in sexes.items():
        for filename in files:
            usage.setdefault(filename, []).append({"job":job,"sex":sex})
items=[]
for filename, consumers in sorted(usage.items()):
    info=audit["results"].get(filename,{})
    items.append({
        "source":str(root/filename),
        "consumers":consumers,
        "skinCount":info.get("skins",0),
        "status":"requires-alignment-and-skinning" if not info.get("skins") else "requires-motion-review",
        "alignedSource":None,
        "riggedOutput":None,
        "verified":False
    })
out={"schema":"outfit-production-queue-v1",
     "note":"Candidate GLBs are not wearable until alignment, skinning, motion review and approval.",
     "totalAssignments":sum(len(v) for v in usage.values()),
     "uniqueSources":len(items),"approved":0,"items":items}
dest=Path("data/character-system/outfit-production-queue.json")
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"{len(items)} unique source GLBs; {out['totalAssignments']} job/sex assignments; 0 approved")
