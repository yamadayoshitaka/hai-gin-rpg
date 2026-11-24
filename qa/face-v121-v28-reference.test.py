#!/usr/bin/env python3
import math,pathlib,runpy,statistics,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=runpy.run_path(str(ROOT/'qa/face-v121-v21-lip-philtrum-geometry.test.py'))
H=runpy.run_path(str(ROOT/'scripts/finish-v121-natural-folds.py'))
def surface_pairs(old,new,indices,xs,ys,min_z):
    """Sample the actual front triangle at a regular grid in v27 and track
    the SAME barycentric material point in v28. Independent of vertex density."""
    tris=[]
    for k in range(0,len(indices),3):
        ids=indices[k:k+3]
        a,b,c=(old[j] for j in ids)
        if max(a[2],b[2],c[2])<min_z:continue
        lo_x,hi_x=min(a[0],b[0],c[0]),max(a[0],b[0],c[0])
        lo_y,hi_y=min(a[1],b[1],c[1]),max(a[1],b[1],c[1])
        if hi_x<min(xs) or lo_x>max(xs) or hi_y<min(ys) or lo_y>max(ys):continue
        u=(b[0]-a[0],b[1]-a[1]);v=(c[0]-a[0],c[1]-a[1])
        det=u[0]*v[1]-u[1]*v[0]
        if abs(det)>1e-12:tris.append((ids,a,u,v,det,lo_x,hi_x,lo_y,hi_y))
    pairs=[]
    for x in xs:
        for y in ys:
            best=None
            for ids,a,u,v,det,lx,hx,ly,hy in tris:
                if not lx<=x<=hx or not ly<=y<=hy:continue
                dx,dy=x-a[0],y-a[1]
                s=(dx*v[1]-dy*v[0])/det;t=(u[0]*dy-u[1]*dx)/det
                weights=(1-s-t,s,t)
                if min(weights)<-1e-7:continue
                before=tuple(sum(old[j][k]*f for j,f in zip(ids,weights)) for k in range(3))
                if before[2]<min_z or (best and before[2]<=best[0][2]):continue
                after=tuple(sum(new[j][k]*f for j,f in zip(ids,weights)) for k in range(3))
                best=(before,after)
            if best:pairs.append(best)
    return pairs

class V28(unittest.TestCase):
    def test_mesh(self):
        prev=ROOT/'qa/baselines/face-v121-v27.glb'
        _,a0,i0=Q['read'](prev);g,a,i=Q['read'](Q['PATH'])
        old,new=a0['POSITION'],a['POSITION']
        self.assertEqual(i,i0);self.assertEqual(a0['TEXCOORD_0'],a['TEXCOORD_0'])
        self.assertTrue(all(x==y for x,y in zip(old,new) if x[1]>=.335 or abs(x[0])>=.125))
        self.assertTrue(all(math.isfinite(v) for p in new+a['NORMAL'] for v in p))
        self.assertTrue(all(abs(math.sqrt(sum(v*v for v in n))-1)<.002 for n in a['NORMAL']))
        # Inspect the front surface, not the number of vertices incidentally
        # contained in a rectangular box. Sampling remains fixed across builds.
        def check(label,xs,ys,min_z,axis,sign,minimum):
            with self.subTest(region=label):
                pairs=surface_pairs(old,new,i0,xs,ys,min_z)
                self.assertGreaterEqual(len(pairs),12,label+' insufficient actual surface coverage')
                delta=[sign*(b[axis]-a[axis]) for a,b in pairs]
                med=statistics.median(delta)
                print(label,'surface samples:',len(pairs),'median delta (m):',med,flush=True)
                self.assertGreater(med,minimum,label+' actual geometry must improve')
                self.assertGreater(sum(d>0 for d in delta),len(delta)*.65,label+' direction consistency')
        for side in (-1,1):
            check('lower cheek '+str(side),[side*x/1000 for x in range(52,81,4)],
                  [y/1000 for y in range(222,253,4)],.075,2,1,.001)
            check('upper cheek '+str(side),[side*x/1000 for x in range(40,69,4)],
                  [y/1000 for y in range(274,289,3)],.090,2,-1,.0003)
        for lo,hi,label in ((236,241,'upper lip'),(222,227,'lower lip')):
            check(label,[x/1000 for x in range(-18,19,3)],
                  [y/1000 for y in range(lo,hi+1)],.125,1,-1,.0003)
        for side in (-1,1):
            check('alar rim '+str(side),[side*x/1000 for x in range(16,28,2)],
                  [y/1000 for y in range(264,273,2)],.120,1,-1,.00015)
        check('muzzle retraction',[x/1000 for x in range(-21,22,3)],
              [y/1000 for y in range(222,243,4)],.125,2,-1,.001)
        g0,b0=H['read_glb'](prev);g1,b1=H['read_glb'](Q['PATH'])
        for part in ('EYEBROW_FIBERS',):
            def brow_positions(g,b):
                m=next(m for m in g['meshes'] if part in m['name'])
                p=m['primitives'][0]
                return H['accessor'](g,b,p['attributes']['POSITION'])
            b_old,b_new=brow_positions(g0,b0),brow_positions(g1,b1)
            self.assertEqual(len(b_old),len(b_new))
            self.assertEqual(len(b_new),272*8)
            self.assertTrue(all(math.isfinite(z) for p in b_new for z in p))
            self.assertGreater(sum(math.dist(a,b)>.0001 for a,b in zip(b_old,b_new)),len(b_new)//2)
        self.assertEqual(len(b0),len(b1),'No duplicate BIN allocation')
        for part,limit in [('UPPER_EYELASHES',.95),('LOWER_EYELASHES',.75)]:
            def get(g,b):
                m=next(m for m in g['meshes'] if part in m['name']);p=m['primitives'][0]
                return H['accessor'](g,b,p['attributes']['POSITION'])
            x,y=get(g0,b0),get(g1,b1)
            starts=list(range(0,82*42,42)) if part.startswith('UPPER') else [eye_id*(22*42+66)+j*42 for eye_id in range(2) for j in range(22)]
            ratios=[math.dist(y[j],y[j+36])/math.dist(x[j],x[j+36]) for j in starts]
            self.assertEqual(len(x),len(y))
            print(part,'median strand length ratio:',statistics.median(ratios),flush=True)
            with self.subTest(region=part):self.assertLess(statistics.median(ratios),limit)
        self.assertEqual(g['meshes'][0]['extras']['mouthChinRebuild']['v28ReferenceAnatomy']['version'],'v28')
if __name__=='__main__':unittest.main()
