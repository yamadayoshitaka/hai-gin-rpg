"""Inspect checked-in GLB animations without external dependencies."""
import json, struct, pathlib
path=pathlib.Path("motions/quaternius/ual1-standard.glb")
raw=path.read_bytes()
if raw[:4]!=b"glTF": raise ValueError("Not a GLB")
version,length=struct.unpack_from("<II",raw,4)
if version!=2 or length!=len(raw):raise ValueError("Invalid GLB header")
size,kind=struct.unpack_from("<I4s",raw,12)
if kind!=b"JSON":raise ValueError("Missing GLB JSON chunk")
data=json.loads(raw[20:20+size])
clips=[{"name":a.get("name",f"animation_{i}"),"channels":len(a.get("channels",[]))} for i,a in enumerate(data.get("animations",[]))]
result={"file":str(path),"bytes":len(raw),"animationCount":len(clips),"animations":clips,"nodeCount":len(data.get("nodes",[])),"status":"inventory-only-not-retargeted-or-validated"}
out=pathlib.Path("motion-quaternius-inventory.json")
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
