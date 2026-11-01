#!/usr/bin/env python3
"""Extract a preliminary 3D body pose track from an authorized MP4.
Requires: pip install mediapipe==0.10.21 opencv-python-headless numpy
Output is NOT BVH and cannot be promoted to recorded without retarget/QA.
"""
import argparse, json, pathlib, sys
def main():
 p=argparse.ArgumentParser()
 p.add_argument("video")
 p.add_argument("--output",required=True)
 p.add_argument("--stride",type=int,default=2)
 args=p.parse_args()
 if args.stride<1: p.error("stride must be >=1")
 try:
  import cv2, mediapipe as mp
 except ImportError as exc:
  sys.exit("Install mediapipe==0.10.21 and opencv-python-headless: "+str(exc))
 cap=cv2.VideoCapture(args.video)
 if not cap.isOpened():sys.exit("Cannot decode video")
 fps=cap.get(cv2.CAP_PROP_FPS) or 30
 frames=[]; index=0
 with mp.solutions.pose.Pose(static_image_mode=False,model_complexity=2,enable_segmentation=False) as pose:
  while True:
   ok,frame=cap.read()
   if not ok:break
   if index%args.stride==0:
    result=pose.process(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
    if result.pose_world_landmarks:
     points=[{"x":round(l.x,6),"y":round(l.y,6),"z":round(l.z,6),"visibility":round(l.visibility,4)} for l in result.pose_world_landmarks.landmark]
     frames.append({"frame":index,"time":round(index/fps,5),"joints":points})
   index+=1
 cap.release()
 if len(frames)<3:sys.exit("Insufficient detected 3D poses; no output produced")
 output=pathlib.Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps({"schema":1,"format":"mediapipe-pose-world-landmarks","source":args.video,"fps":fps,"totalVideoFrames":index,"detectedFrames":len(frames),"jointCount":33,"frames":frames,"quality":"raw-estimate-not-retargeted","approved":False},ensure_ascii=False),encoding="utf-8")
 print(f"Extracted {len(frames)} pose frames -> {output}; NOT a production animation")
if __name__=="__main__":main()
