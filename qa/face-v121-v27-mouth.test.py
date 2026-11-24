#!/usr/bin/env python3
import math,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
H=runpy.run_path(str(ROOT/'scripts/finish-v121-natural-folds.py'))
class V27(unittest.TestCase):
    def test_real_mesh(self):
        prev=ROOT/'qa/baselines/face-v121-v26.glb'
        _,a0,i0=Q['read'](prev);g,a,i=Q['read'](ROOT/'qa/baselines/face-v121-v27.glb')
        old,new=a0['POSITION'],a['POSITION']
        self.assertEqual(i,i0)
        self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertEqual(a0['COLOR_0'],a['COLOR_0'])
        self.assertTrue(all(x==y for x,y in zip(old,new) if x[1]>=.286 or abs(x[0])>=.125))
        self.assertTrue(all(x==y for x,y in zip(old,new) if abs(x[0])<.025 and x[1]>=.253))
        self.assertTrue(all(math.isfinite(v) for p in new+a['NORMAL'] for v in p))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        self.assertLess(max(math.dist(x,y) for x,y in zip(old,new)),.008)
        lip=[j for j,(x,y,z) in enumerate(old) if .012<abs(x)<.027 and .224<y<.242 and z>.135]
        self.assertGreater(len(lip),20)
        self.assertAlmostEqual(statistics.median(abs(new[j][0]/old[j][0]) for j in lip),.88,delta=.001)
        self.assertAlmostEqual(statistics.median((new[j][1]-.232)/(old[j][1]-.232) for j in lip if abs(old[j][1]-.232)>.001),.90,delta=.001)
        meta=g['meshes'][0]['extras']['mouthChinRebuild']['v27CompactMouth']
        self.assertGreater(meta['skinFairingVertices'],100)
        # The seal has identical topology and remains affinely aligned to the skin.
        g0,b0=H['read_glb'](prev);g1,b1=H['read_glb'](ROOT/'qa/baselines/face-v121-v27.glb')
        def seal(g,b):
            m=next(m for m in g['meshes'] if m['name']=='V121_ORAL_CAVITY')
            p=m['primitives'][1]
            return H['accessor'](g,b,p['attributes']['POSITION']),H['accessor'](g,b,p['indices'])
        s0,j0=seal(g0,b0);s1,j1=seal(g1,b1)
        self.assertEqual(j0,j1)
        for (x,y,z),(u,v,w) in zip(s0,s1):
            self.assertAlmostEqual(u,.88*x,delta=.000002)
            self.assertAlmostEqual(v,.232+.90*(y-.232),delta=.000002)
            self.assertAlmostEqual(w,z,delta=.000002)
        print('v27 actual lip width / height scales 0.88 / 0.90; unchanged seal indices; skin fairing',meta['skinFairingVertices'])
if __name__=='__main__':unittest.main()
