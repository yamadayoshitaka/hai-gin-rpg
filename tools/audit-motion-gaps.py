"""Audit missing RPG motions against every checked-in Quaternius GLB inventory."""
import json,pathlib
root=pathlib.Path(".")
inventory=json.loads((root/"motion-quaternius-inventory.json").read_text())
candidate=json.loads((root/"motion-quaternius-job-candidates.json").read_text())
available={a["name"] for a in inventory["animations"]}
families={}
for family,entry in candidate["families"].items():
    present={role:name for role,name in entry["clips"].items() if name in available}
    missing=[role for role in entry["missingSpecialties"] if role not in present]
    families[family]={"available":present,"missing":missing,"completed":False,"qa":"not-run"}
out={"source":"Quaternius Universal Animation Library; Cinevva motion catalog overlaps with this source","sourceCount":len(available),"verifiedJobs":0,"families":families,"downloadStatus":"No additional Cinevva clips downloaded: official site requires paid GLB export; source packages need independently verified URLs"}
(root/"motion-gap-report.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(out,ensure_ascii=False,indent=2))
