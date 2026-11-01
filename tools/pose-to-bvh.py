#!/usr/bin/env python3
"""Convert MediaPipe world-landmark track to a preliminary BVH.
Requires only stdlib. This is an approximate retarget, not approved production animation.
"""
import argparse,json,math,pathlib
JOINTS=[("Hips",None,23,24),("Spine","Hips",23,11),("Chest","Spine",11,12),("Neck","Chest",11,12),("Head","Neck",0,0),("LeftShoulder","Chest",11,13),("LeftElbow","LeftShoulder",13,15),("LeftWrist","LeftElbow",15,19),("RightShoulder","Chest",12,14),("RightElbow","RightShoulder",14,16),("RightWrist","RightElbow",16,20),("LeftHip","Hips",23,25),("LeftKnee","LeftHip",25,27),("LeftAnkle","LeftKnee",27,31),("RightHip","Hips",24,26),("RightKnee","RightHip",26,28),("RightAnkle","RightKnee",28,32)]
def pos(frame,i):
 p=frame["joints"][i];return (p["x"]*100,-p["y"]*100,-p["z"]*100)
def mid(a,b):return tuple((x+y)/2 for x,y in zip(a,b))
def direction(a,b):
 v=[y-x for x,y in zip(a,b)];l=math.sqrt(sum(x*x for x in v));return [x/l for x in v] if l>1e-6 else [0,1,0]
def angles(a,b):
 x,y,z=direction(a,b);return (math.degrees(math.atan2(z,math.sqrt(x*x+y*y))),0,-math.degrees(math.atan2(x,y)))
def main():
 p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args()
 d=json.loads(pathlib.Path(a.input).read_text());frames=d.get("frames",[])
 if len(frames)<3:raise ValueError("Need >=3 tracked frames")
 def point(f,name):
  if name=="Hips":return mid(pos(f,23),pos(f,24))
  if name=="Spine":return mid(pos(f,11),pos(f,12))
  if name=="Chest":return mid(pos(f,11),pos(f,12))
  if name=="Neck":return mid(pos(f,11),pos(f,12))
  if name=="Head":return pos(f,0)
  idx={"LeftShoulder":11,"LeftElbow":13,"LeftWrist":15,"RightShoulder":12,"RightElbow":14,"RightWrist":16,"LeftHip":23,"LeftKnee":25,"LeftAnkle":27,"RightHip":24,"RightKnee":26,"RightAnkle":28}
  return pos(f,idx[name])
 children={name:[] for name,*_ in JOINTS}
 for name,parent,*_ in JOINTS:
  if parent:children[parent].append(name)
 ref=frames[0]
 lines=["HIERARCHY"]
 def write_joint(name,parent,level):
  ind="  "*level;lines.append(ind+("ROOT " if parent is None else "JOINT ")+name);lines.append(ind+"{")
  a=point(ref,name);b=point(ref,parent) if parent else (0,0,0)
  off=tuple(x-y for x,y in zip(a,b))
  lines.append(ind+"  OFFSET "+" ".join(f"{v:.5f}" for v in off))
  lines.append(ind+"  CHANNELS "+("6 Xposition Yposition Zposition Zrotation Xrotation Yrotation" if parent is None else "3 Zrotation Xrotation Yrotation"))
  for child in children[name]:write_joint(child,name,level+1)
  if not children[name]:
   lines.extend([ind+"  End Site",ind+"  {",ind+"    OFFSET 0 5 0",ind+"  }"])
  lines.append(ind+"}")
 write_joint("Hips",None,0)
 lines+=["MOTION",f"Frames: {len(frames)}",f"Frame Time: {max(0.001,(frames[-1]['time']-frames[0]['time'])/(len(frames)-1)):.7f}"]
 # Local rotations are approximated from segment direction. These do not fully
 # recover twist or camera orientation and require visual QA.
 def rotations(f,name,parent):
  if parent is None:return (0,0,0)
  az,ax,ay=angles(point(f,parent),point(f,name))
  pz,px,py=angles(point(ref,parent),point(ref,name))
  return (az-pz,ax-px,ay-py)
 def channels(f,name,parent):
  result=[]
  if parent is None:
   result.extend(round(v,5) for v in point(f,name))
  result.extend(round(v,5) for v in rotations(f,name,parent))
  for child in children[name]:result.extend(channels(f,child,name))
  return result
 for frame in frames:lines.append(" ".join(str(v) for v in channels(frame,"Hips",None)))
 out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text("\n".join(lines)+"\n")
 print(f"Generated approximate BVH: {out}; visual QA required; not registered")
if __name__=="__main__":main()
