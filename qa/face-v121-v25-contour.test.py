#!/usr/bin/env python3
"""Measure actual v25 against v24, including absolute oral depth and 45-degree contour."""
import math,json,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
V=runpy.run_path(str(ROOT/'qa/face-v121-v23-skin.test.py'))
def contour_sections(p,idx,sign):
    edges={tuple(sorted((a,b))) for i in range(0,len(idx),3)
           for a,b in ((idx[i],idx[i+1]),(idx[i+1],idx[i+2]),(idx[i+2],idx[i])) if a!=b}
    values=[]
    for y in (.222,.228,.234,.240,.246,.252,.258,.264,.270,.276,.282):
        projected=[]
        for i,j in edges:
            a,b=p[i],p[j]
            if abs(a[1]-b[1])<1e-9 or not min(a[1],b[1])<=y<=max(a[1],b[1]):continue
            t=(y-a[1])/(b[1]-a[1])
            x=a[0]+t*(b[0]-a[0]);z=a[2]+t*(b[2]-a[2])
            if sign*x>.040 and z>.060:projected.append((sign*x+z)/math.sqrt(2))
        if not projected:raise AssertionError('Missing actual cheek cross-section')
        values.append(max(projected))
    return values
class RealV25(unittest.TestCase):
    def test_v25(self):
        _,a0,i0=Q['read'](ROOT/'qa/baselines/face-v121-v24.glb')
        g,a,i=Q['read'](ROOT/'qa/baselines/face-v121-v25.glb');p0,p=a0['POSITION'],a['POSITION']
        self.assertEqual(i,i0)
        self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertTrue(all(math.isfinite(v) for q in p+a['NORMAL'] for v in q))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        self.assertTrue(all(x==y for x,y in zip(p0,p) if x[1]>=.300))
        self.assertLess(max(math.dist(x,y) for x,y in zip(p0,p)),.008)
        report={}
        for sign in (-1,1):
            for lo,hi in ((.225,.250),(.250,.282)):
                ids=[j for j,(x,y,z) in enumerate(p0) if .050<sign*x<.090 and lo<y<hi and z>.085]
                self.assertGreaterEqual(len(ids),15)
                delta=statistics.median((sign*(p0[j][0]-p[j][0])+p0[j][2]-p[j][2])/math.sqrt(2) for j in ids)
                report[f'{sign}/{lo} median45Retraction']=delta
                self.assertGreater(delta,.0015)
            prev=contour_sections(p0,i0,sign);new=contour_sections(p,i,sign)
            curvature=max(abs(new[j+1]-2*new[j]+new[j-1]) for j in range(1,len(new)-1))
            report[str(sign)+'45ContourSecondDifferenceMax']=curvature
            # Absolute chord deviation, sampled every 6 mm, not a percentage
            # improvement over the previous visibly imperfect face.
            self.assertLess(curvature,.0017)
            self.assertLess(max(new),max(prev)-.002)
        g0,g1=V['grooves'](p0,i0),V['grooves'](p,i)
        n0,n1=V['normal_rms'](p0,a0['NORMAL'],i0),V['normal_rms'](p,a['NORMAL'],i)
        report.update(grooves=[g0,g1],normalAngleRMS=[n0,n1])
        print(json.dumps(report,indent=2))
        self.assertLess(g1[0],g0[0])
        self.assertLessEqual(g1[1],.00018)
        self.assertLessEqual(g1[0],.000045)
        self.assertLessEqual(n1,n0*1.15)
        for x,y in ((0.,.241),(-.010,.243),(.010,.243),(0.,.226)):
            self.assertAlmostEqual(Q['surface_z'](p,i,x,y),Q['surface_z'](p0,i0,x,y),delta=.0004)
        for before,after in zip(Q['channel_sections'](p0,i0),Q['channel_sections'](p,i)):
            self.assertAlmostEqual(before,after,delta=.0003)
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v25ContinuousContour']['version'],'v25')
if __name__=='__main__':unittest.main()
