#!/usr/bin/env python3
import math,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
class RealV26(unittest.TestCase):
    def test_real_lip_and_shading(self):
        _,old,idx0=Q['read'](ROOT/'qa/baselines/face-v121-v25.glb')
        g,new,idx=Q['read'](Q['PATH'])
        a,b=old['POSITION'],new['POSITION']
        self.assertEqual(idx,idx0)
        self.assertEqual(old['TEXCOORD_0'],new['TEXCOORD_0'])
        self.assertTrue(all(x==y for x,y in zip(a,b) if x[1]>=.253 or abs(x[0])>=.046))
        self.assertTrue(all(x==y for x,y in zip(a,b) if .229<=x[1]<=.234))
        upper=[x[1]-y[1] for x,y in zip(a,b) if abs(x[0])<.020 and .239<x[1]<.247 and x[2]>.139]
        self.assertGreater(len(upper),9)
        self.assertGreater(statistics.median(upper),.001)
        self.assertLessEqual(max(math.dist(x,y) for x,y in zip(a,b)),.004)
        skin=[i for i,(x,y,z) in enumerate(a) if abs(x)<.024 and .205<y<.217 and z>.125]
        self.assertGreater(len(skin),10)
        oldnz=statistics.median(old['NORMAL'][i][2] for i in skin)
        newnz=statistics.median(new['NORMAL'][i][2] for i in skin)
        self.assertGreaterEqual(newnz, min(oldnz,.86))
        self.assertGreater(newnz,.75)
        self.assertTrue(all(math.isfinite(v) for p in b+new['NORMAL'] for v in p))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in new['NORMAL']))
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v26LipAndUnderlip']['version'],'v26')
        print('v26 actual upper median shrink (m):',statistics.median(upper),'underlip N.z:',oldnz,newnz)
if __name__=='__main__':unittest.main()
