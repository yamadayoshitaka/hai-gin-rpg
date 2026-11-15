#!/usr/bin/env python3
"""Rank bounded PBR preview candidates against an aspirational 2D reference.
No semantic equivalence or actual photorealism certification is implied.
The proxy reports lighting, contrast, edge activity and color distributions;
reviewers must confirm geometry, silhouette, textures and game behavior.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageStat, ImageFilter

def features(path):
    with Image.open(path) as source:
        rgb=source.convert("RGB")
    rgb.thumbnail((512,288),Image.Resampling.LANCZOS)
    stat=ImageStat.Stat(rgb)
    y=rgb.convert("L")
    ed=y.filter(ImageFilter.FIND_EDGES)
    edge=ImageStat.Stat(ed).mean[0]/255
    hist=y.histogram()
    total=sum(hist)
    clipped=sum(hist[:8]+hist[-8:])/max(total,1)
    brightness=sum(stat.mean)/765
    chroma=sum(stat.std)/765
    return {"edge":round(edge,5),"brightness":round(brightness,5),
            "chroma":round(chroma,5),"clipped":round(clipped,5)}

def similarity(f, ref):
    if f["edge"]<.016 or f["chroma"]<.012 or f["clipped"]>.50:
        return -1
    # Measurements are only visual-quality proxies, not learned image similarity.
    return round(1-(
       .34*min(1,abs(f["edge"]-ref["edge"])/.20)+
       .32*min(1,abs(f["brightness"]-ref["brightness"])/.50)+
       .25*min(1,abs(f["chroma"]-ref["chroma"])/.40)+
       .09*min(1,abs(f["clipped"]-ref["clipped"])/.30)
    ),5)

def run(ref_path, captures):
    ref=features(ref_path)
    candidates=[]
    for p in captures["captures"]:
        file=Path(p["filename"])
        if not file.is_file() or file.stat().st_size<10000:
            raise ValueError("Missing real WebGL screenshot: "+str(file))
        f=features(file)
        candidates.append({**p,"metrics":f,"proxyScore":similarity(f,ref)})
    baseline=next((x for x in candidates if x["roughnessScale"]==1),None)
    if not baseline:raise ValueError("Baseline must be captured")
    best=max(candidates,key=lambda x:x["proxyScore"])
    # Prevent visually insignificant or invalid machine-only changes.
    improved=(best["proxyScore"]>=baseline["proxyScore"]+.012 and
              best["proxyScore"]>0 and best["roughnessScale"]!=1)
    return {"kind":"WORLD_PBR_VARIANT_PROPOSAL_HUMAN_QA_REQUIRED",
        "referenceFile":str(ref_path),"referenceMetrics":ref,
        "baselineScore":baseline["proxyScore"],"bestProxyScore":best["proxyScore"],
        "chosenRoughnessScale":best["roughnessScale"] if improved else 1,
        "proxyImproved":improved,"candidates":candidates,
        "humanVisualReview":"PENDING","photorealismCertified":False,
        "gameBuildApplied":False,"approvedForMain":False,
        "note":"Image feature proxy only. Similar colors do not prove a correct or photoreal 3D object."}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("capture_json")
    parser.add_argument("output")
    args=parser.parse_args()
    output=run(Path(args.reference),json.loads(Path(args.capture_json).read_text()))
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"candidate":args.output,"suggested":output["chosenRoughnessScale"],
      "baseline":output["baselineScore"],"best":output["bestProxyScore"],
      "humanVisualReview":"PENDING"}))
