#!/usr/bin/env python3
import math,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
H=runpy.run_path(str(ROOT/'scripts/finish-v121-natural-folds.py'))
class V28(unittest.TestCase):
    def test_mesh(self):
        prev=ROOT/'qa/baselines/face-v121-v27.glb'
        _,a0,i0=Q['read'](prev);g,a,i=Q['read'](Q['PATH'])
        old,new=a0['POSITION'],a['POSITION']
        self.assertEqual(i,i0);self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertTrue(all(x==y for x,y in zip(old,new) if x[1]>=.335 or abs(x[0])>=.125))
        self.assertTrue(all(math.isfinite(v) for p in new+a['NORMAL'] for v in p))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        for s in (-1,1):
            ids=[j for j,(x,y,z) in enumerate(old) if .052<s*x<.080 and .222<y<.255 and z>.095]
            self.assertGreater(len(ids),10)
            self.assertGreater(statistics.median(new[j][2]-old[j][2] for j in ids),.001)
        g0,b0=H['read_glb'](prev);g1,b1=H['read_glb'](Q['PATH'])
        self.assertEqual(len(b0),len(b1))
        for part,limit in [('UPPER_EYELASHES',.95),('LOWER_EYELASHES',.75)]:
            def get(g,b):
                m=next(m for m in g['meshes'] if part in m['name']);p=m['primitives'][0]
                return H['accessor'](g,b,p['attributes']['POSITION'])
            x,y=get(g0,b0),get(g1,b1)
            ratios=[math.dist(y[j],y[j+36])/math.dist(x[j],x[j+36]) for j in range(0,(82 if part.startswith('UPPER') else 44)*42,42)]
            self.assertLess(statistics.median(ratios),limit)
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v28ReferenceAnatomy']['version'],'v28')
if __name__=='__main__':unittest.main()
