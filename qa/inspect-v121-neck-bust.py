#!/usr/bin/env python3
"""Print numerical anatomical bands for v121 head before a full neck/lip rebuild."""
import collections, json, math, pathlib, runpy, sys
h=runpy.run_path(str(pathlib.Path(__file__).parents[1]/'scripts/rebuild-v121-mouth-chin.py'))
g,b=h['read_glb'](pathlib.Path(sys.argv[1]))
p=g['meshes'][0]['primitives'][0]
pts=[tuple(t) for t in h['accessor'](g,b,p['attributes']['POSITION'])]
uv=[tuple(t) for t in h['accessor'](g,b,p['attributes']['TEXCOORD_0'])]
tri=[int(t[0]) for t in h['accessor'](g,b,p['indices'])]
def q(values, frac):
 s=sorted(values)
 return round(s[min(len(s)-1,int(frac*(len(s)-1)))],5) if s else None
print('ANATOMY_BOUNDING',json.dumps({axis:[(round(min(t[i] for t in pts),5),round(max(t[i] for t in pts),5)) for i in range(3)],meshes:[v['name'] for v in g['meshes']]}))
for y0,y1 in [(-.30,-.15),(-.15,-.08),(-.08,0),(0,.025),(.025,.050),(.050,.075),(.075,.095),(.095,.115),(.115,.135),(.135,.155),(.155,.175),(.175,.195),(.195,.215),(.215,.235),(.235,.255),(.255,.275)]:
 rows=[(p,u) for p,u in zip(pts,uv) if y0<=p[1]<y1]
 front=[(p,u) for p,u in rows if abs(p[0])<.015 and p[2]>.0]
 side=[(p,u) for p,u in rows if abs(p[0])>.04 and p[2]>.0]
 print('ANATOMY_BAND',json.dumps(dict(y=[y0,y1],n=len(rows),front=len(front),x=q([abs(p[0]) for p,u in rows],.95),zFront=q([p[2] for p,u in front],.9),zMedian=q([p[2] for p,u in rows],.5),zBack=q([p[2] for p,u in rows],.1),uvFront=[q([u[0] for p,u in front],.5),q([u[1] for p,u in front],.5)],side=len(side))))
print('ANATOMY_DONE')
