#!/usr/bin/env python3
"""Actual v24 vs frozen v23: both cheekbones and oral skin."""
import math,json,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
V=runpy.run_path(str(ROOT/'qa/face-v121-v23-skin.test.py'))
S=runpy.run_path(str(ROOT/'scripts/fair-v121-skin-v24.py'))
class RealV24(unittest.TestCase):
    def test_v24(self):
        _,a0,i0=Q['read'](ROOT/'qa/baselines/face-v121-v23.glb')
        g,a,i=Q['read'](Q['PATH'])
        p0,p=a0['POSITION'],a['POSITION']
        self.assertEqual(i,i0)
        self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertTrue(all(math.isfinite(v) for q in p+a['NORMAL'] for v in q))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        self.assertTrue(all(x==y for x,y in zip(p0,p) if x[1]>=.292 or (abs(x[0])<.035 and x[1]>=.223)))
        self.assertLess(max(math.dist(x,y) for x,y in zip(p0,p)),.007)
        report={}
        for sign in (-1,1):
            ids=[j for j,(x,y,z) in enumerate(p0) if .060<sign*x<.095 and .258<y<.281 and z>.100]
            self.assertGreaterEqual(len(ids),25, 'adequate actual malar crest vertices per side')
            # Project along the actual 45-degree viewing direction.
            diff=[(sign*(p0[j][0]-p[j][0])+p0[j][2]-p[j][2])/math.sqrt(2) for j in ids]
            report[str(sign)+'malar45MedianRetraction']=statistics.median(diff)
            self.assertGreater(statistics.median(diff),.001)
        g0,g1=V['grooves'](p0,i0),V['grooves'](p,i)
        n0,n1=V['normal_rms'](p0,a0['NORMAL'],i0),V['normal_rms'](p,a['NORMAL'],i)
        report.update(grooves=[g0,g1],normalAngleRMS=[n0,n1])
        print(json.dumps(report,indent=2))
        self.assertLess(g1[0],g0[0])
        self.assertLess(g1[1],g0[1])
        self.assertLessEqual(n1,n0*1.10)
        for x,y in ((0.,.241),(-.010,.243),(.010,.243),(0.,.226)):
            self.assertAlmostEqual(Q['surface_z'](p,i,x,y),Q['surface_z'](p0,i0,x,y),delta=.0001)
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v24CheekContour']['version'],'v24')
if __name__=='__main__':unittest.main()
