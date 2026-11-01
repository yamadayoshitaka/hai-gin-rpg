#!/usr/bin/env python3
"""Import verified CC0 animation archives from a public GitHub LFS mirror."""
import hashlib,io,json,os,pathlib,re,urllib.request,zipfile
SOURCE="https://media.githubusercontent.com/media/MightyBubble/Ludots-Assets/main/"
PACKS={
"quaternius2":("animations/Quaternius-Universal-Animation-Library-2-Standard.zip","4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68"),
"kaykit":("animations/KayKit-Character-Animations-Free-1.1.zip","65882f31f905ad2e953819648a59287cdeab8f623908d5ef701971d3758be20f")}
output=pathlib.Path("motions/external");manifest=[]
for key,(remote,sha) in PACKS.items():
    req=urllib.request.Request(SOURCE+remote,headers={"User-Agent":"hai-gin-rpg-cc0-import/1.0"})
    with urllib.request.urlopen(req,timeout=100) as response:
        data=response.read(40000000)
    actual=hashlib.sha256(data).hexdigest()
    if actual!=sha:raise RuntimeError(f"{key}: SHA256 mismatch ({actual})")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members=[m for m in archive.infolist() if not m.is_dir() and pathlib.PurePosixPath(m.filename).suffix.lower() in (".glb",".gltf",".bin")]
        if not members:raise RuntimeError(f"{key}: no glTF/GLB content")
        for item in members:
            name=pathlib.PurePosixPath(item.filename)
            if ".." in name.parts or item.file_size>30000000:raise RuntimeError("unsafe ZIP member")
            target=output/key/name
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(archive.read(item))
        manifest.append({"source":SOURCE+remote,"sha256":sha,"license":"CC0","formatFiles":len(members),"files":[str(output/key/pathlib.PurePosixPath(m.filename)) for m in members]})
output.mkdir(parents=True,exist_ok=True)
(output/"import-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps([{"source":m["source"],"formatFiles":m["formatFiles"]} for m in manifest],indent=2))
