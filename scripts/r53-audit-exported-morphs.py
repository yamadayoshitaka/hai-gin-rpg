"""Audit the actual exported R53 male GLBs, including combined morphs.
Report defects without passing off the experimental candidates as final assets.
"""
import sys,hashlib,struct,json
from pathlib import Path
import numpy as np
src,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
report=json.loads((src/"male-motion-audit.json").read_text())
names=["jawOpen","viseme_A","viseme_I","viseme_U","viseme_E","viseme_O","smile","blink_L","blink_R","browRaise","browFrown"]
cases=[(n,{n:1}) for n in names]+[("blinkBoth",{"blink_L":1,"blink_R":1}),("smileBlink",{"smile":.65,"blink_L":1,"blink_R":1}),("openRaise",{"jawOpen":.65,"browRaise":.5}),("run",{"jawOpen":.5,"browFrown":.35}),("wave",{"smile":.7,"browRaise":.35})]
def unpack(g,b,i):
    a=g["accessors"][i]
    dt=np.dtype({5126:"<f4",5125:"<u4",5123:"<u2",5121:"u1"}[a["componentType"]])
    n={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[a["type"]]
    if "bufferView" in a:
        v=g["bufferViews"][a["bufferView"]]
        off=v.get("byteOffset",0)+a.get("byteOffset",0)
        stride=v.get("byteStride",dt.itemsize*n)
        data=np.ndarray((a["count"],n),dtype=dt,buffer=b,offset=off,strides=(stride,dt.itemsize)).copy()
    else:
        data=np.zeros((a["count"],n),dtype=dt)
    if a.get("sparse"):
        sparse=a["sparse"];count=sparse["count"]
        idx=sparse["indices"];val=sparse["values"]
        iv=g["bufferViews"][idx["bufferView"]];vv=g["bufferViews"][val["bufferView"]]
        it=np.dtype({5121:"u1",5123:"<u2",5125:"<u4"}[idx["componentType"]])
        indices=np.frombuffer(b,dtype=it,count=count,offset=iv.get("byteOffset",0)+idx.get("byteOffset",0))
        values=np.frombuffer(b,dtype=dt,count=count*n,offset=vv.get("byteOffset",0)+val.get("byteOffset",0)).reshape(count,n)
        if len(indices) and (int(indices.max())>=a["count"] or np.any(np.diff(indices.astype(np.int64))<=0)):raise ValueError("Invalid sparse indices")
        data[indices]=values
    return data
def normals(p,t):
    q=p[t];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
result=[]
for f in report["faces"]:
    path=src/(f["id"]+".glb");raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=f["sha256"]:raise ValueError("Hash mismatch "+f["id"])
    if raw[:4]!=b"glTF" or struct.unpack_from("<II",raw,4)!=(2,len(raw)):raise ValueError("GLB invalid")
    n=struct.unpack_from("<I",raw,12)[0]
    g=json.loads(raw[20:20+n]);b=memoryview(raw)[28+n:]
    if not g.get("skins"):raise ValueError("Missing exported skin")
    stats={k:{"reversed":0,"collapsed":0,"max_neck_delta_m":0} for k,_ in cases}
    vertices=0;triangles=0;material_indices=set();all_names=set()
    for mesh in g["meshes"]:
        ns=mesh.get("extras",{}).get("targetNames",[])
        for p in mesh["primitives"]:
            P=unpack(g,b,p["attributes"]["POSITION"]).astype(np.float64)
            t=unpack(g,b,p["indices"]).reshape(-1,3)
            assert np.isfinite(P).all()
            assert t.max()<len(P)
            if not all(k in p["attributes"] for k in ("NORMAL","TEXCOORD_0","JOINTS_0","WEIGHTS_0","COLOR_0")):
                raise ValueError("Missing rig/UV/material vertex attributes "+f["id"])
            all_names.update(ns);vertices+=len(P);triangles+=len(t);material_indices.add(p["material"])
            targets=p.get("targets",[])
            if len(ns)!=len(targets):raise ValueError("Morph target count mismatch")
            deltas={name:unpack(g,b,q["POSITION"]).astype(np.float64) for name,q in zip(ns,targets)}
            N=normals(P,t);area=np.linalg.norm(N,axis=1);valid=area>1e-10
            # GLTF uses Y up. Identify the actual lower neck band by local extent.
            anchor=P[:,1]<=P[:,1].min()+.020 if np.ptp(P[:,1])>.15 else np.zeros(len(P),bool)
            for tag,weights in cases:
                D=np.zeros_like(P)
                for key,w in weights.items():
                    if key in deltas:D+=deltas[key]*w
                Q=P+D
                if not np.isfinite(Q).all():raise ValueError("Invalid morph positions")
                M=normals(Q,t)
                s=stats[tag]
                s["reversed"]+=int(np.sum((np.einsum("ij,ij->i",N,M)<0)&valid))
                s["collapsed"]+=int(np.sum((np.linalg.norm(M,axis=1)<area*.01)&valid))
                if anchor.any():s["max_neck_delta_m"]=max(s["max_neck_delta_m"],float(np.linalg.norm(D[anchor],axis=1).max()))
    if set(names)!=all_names:raise ValueError("Missing expressions "+f["id"])
    if len(material_indices)!=3:raise ValueError("Expected three anatomical materials")
    r=dict(id=f["id"],vertices=vertices,triangles=triangles,materials=len(material_indices),cases=stats,
           source_sha256=f["sha256"],visualApproved=False)
    result.append(r)
    print(f["id"],json.dumps(stats),flush=True)
(out/"male-exported-morph-audit.json").write_text(json.dumps(dict(classification="actual GLB binary regression",faces=result),indent=2))
print("All ten exported GLBs checked. Geometry deviations are listed in the audit; no visual approval.")
