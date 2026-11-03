#!/usr/bin/env python3
"""Release gate: reject unskinned outfit candidates for animated character use."""
import json
from pathlib import Path
root=Path("assets/characters/seven-head-equipment-candidates")
audit=json.loads((root/"rig-audit.json").read_text(encoding="utf-8"))
manifest=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
errors=[]
for job,sexes in manifest["jobs"].items():
    for sex,files in sexes.items():
        for file in files:
            info=audit["results"].get(file)
            if not info:
                errors.append(f"{job}/{sex}: missing audit for {file}")
            elif not info.get("skins") or not info.get("skinnedNodes"):
                errors.append(f"{job}/{sex}: {file} has no skin binding")
result={"schema":"seven-head-outfit-readiness-v1","ready":not errors,"missingSkinBindings":len(errors),"errors":errors,"policy":"Do not attach static GLBs to deforming character bones; rig and verify first."}
out=Path("data/character-system/seven-head-outfit-readiness.json")
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Ready: {result['ready']}; missing skin bindings: {len(errors)}")
# A report is generated without failing CI; readiness is explicitly false until rigged.
