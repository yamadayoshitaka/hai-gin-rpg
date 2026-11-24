#!/usr/bin/env python3
"""Compare generated v23 GLB to immutable v22; no metadata-only acceptance."""
import os
import collections
import json
import math
import pathlib
import runpy
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
S=runpy.run_path(str(ROOT/'scripts/fair-v121-skin-v23.py'))

def normal_rms(p,n,idx):
    edges={tuple(sorted((a,b))) for i in range(0,len(idx),3)
           for a,b in ((idx[i],idx[i+1]),(idx[i+1],idx[i+2]),(idx[i+2],idx[i])) if a!=b}
    v=[math.acos(max(-1.,min(1.,sum(x*y for x,y in zip(n[a],n[b])))))
       for a,b in edges if S['weight'](p[a])>.5 and S['weight'](p[b])>.5
       and S['region'](p[a])==S['region'](p[b])==0 and math.dist(p[a],p[b])<.008]
    assert v
    return math.sqrt(sum(x*x for x in v)/len(v))

def grooves(p,idx):
    # Fixed front-ray second difference, across both lateral commissures
    # and across the lower-lip/skin transition; reports real depth curvature.
    ray=Q['surface_z'];out=[]
    for sign in (-1,1):
        for y in (.224,.232,.240):
            for x in (.042,.050,.058):
                a,b,c=[ray(p,idx,sign*(x+d),y) for d in (-.003,0,.003)]
                out.append(max(0.,(a+c)/2-b))
    for x in (-.015,0.,.015):
        for y in (.210,.215,.220):
            a,b,c=[ray(p,idx,x,y+d) for d in (-.002,0,.002)]
            out.append(max(0.,(a+c)/2-b))
    return math.sqrt(sum(d*d for d in out)/len(out)),max(out)

class RealV23(unittest.TestCase):
    def test_real_comparison(self):
        baseline=ROOT/'qa/baselines/face-v121-v22.glb'
        self.assertTrue(baseline.is_file(),'immutable v22 GLB required')
        _,a0,i0=Q['read'](baseline)
        g,a,i=Q['read'](pathlib.Path(os.environ.get('V23_MODEL',str(Q['PATH']))))
        p0,p=a0['POSITION'],a['POSITION']
        self.assertEqual(len(p),len(p0))
        self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertEqual(i,i0,'no new connectivity defects or altered mouth seal')
        self.assertTrue(all(math.isfinite(v) for q in p+a['NORMAL'] for v in q))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        self.assertTrue(all(a==b for a,b in zip(p0,p) if a[1]>=.266 or abs(a[0])>=.102))
        self.assertLessEqual(max(math.dist(a,b) for a,b in zip(p0,p)),.00251)
        near=S['neighborhoods'](p0)
        rms0,rms1=S['rms'](p0,near),S['rms'](p,near)
        n0,n1=normal_rms(p0,a0['NORMAL'],i0),normal_rms(p,a['NORMAL'],i)
        groove0,groove1=grooves(p0,i0),grooves(p,i)
        print(json.dumps({'skinRMS':[rms0,rms1],'normalAngleRMS':[n0,n1],
            'grooveRmsAndMax':[groove0,groove1]},indent=2))
        self.assertLess(rms1,rms0)
        self.assertLessEqual(n1,n0*1.05)
        self.assertLessEqual(groove1[0],groove0[0]*1.05+.00002)
        self.assertLessEqual(groove1[1],groove0[1]+.0001)
        # Actual channel remains, and central lip relief stays within .3 mm.
        for x,y in ((0.,.241),(-.010,.243),(.010,.243),(0.,.226)):
            self.assertAlmostEqual(Q['surface_z'](p,i,x,y),Q['surface_z'](p0,i0,x,y),delta=.0004)
        for d0,d in zip(Q['channel_sections'](p0,i0),Q['channel_sections'](p,i)):
            self.assertAlmostEqual(d,d0,delta=.0004)
            self.assertGreater(d,.0002)
            self.assertLess(d,.0035)
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v23SkinFairing']['version'],'v23')

if __name__=='__main__':unittest.main()
