#!/usr/bin/env python3
"""v21: inspect real GLB accessors; reject metadata-only geometry claims."""
import json, math, pathlib, struct, sys, unittest
from collections import Counter
from statistics import median

ROOT=pathlib.Path(__file__).resolve().parents[1]
PATH=ROOT/'assets/generated/neutral-face-v121.glb'

def read(path):
    raw=path.read_bytes()
    assert raw[:4]==b'glTF' and struct.unpack_from('<II',raw,4)==(2,len(raw))
    n=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+n])
    offset=20+n
    assert raw[offset+4:offset+8]==b'BIN\0'
    b=raw[offset+8:]
    def acc(i):
        a=g['accessors'][i]; v=g['bufferViews'][a['bufferView']]
        fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]
        k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        size=struct.calcsize('<'+fmt*k)
        at=v.get('byteOffset',0)+a.get('byteOffset',0)
        stride=v.get('byteStride',size)
        return [struct.unpack_from('<'+fmt*k,b,at+j*stride) for j in range(a['count'])]
    p=g['meshes'][0]['primitives'][0]
    return g, {key:acc(i) for key,i in p['attributes'].items()},[v[0] for v in acc(p['indices'])]

def metric(path):
    g,a,idx=read(path)
    pos=a['POSITION']; normals=a['NORMAL']
    def region(x0,x1,y0,y1):
        return [p for p in pos if x0<=p[0]<=x1 and y0<=p[1]<=y1 and p[2]>.10]
    def peak(x,y,r=.005):
        q=[p[2] for p in pos if abs(p[0]-x)<r and abs(p[1]-y)<r and p[2]>.11]
        if not q: raise AssertionError('missing actual vertices at landmark '+str((x,y)))
        return max(q)
    lip=region(-.048,.048,.218,.251)
    assert lip, 'no actual lip vertices'
    return {'vertex_count':len(pos),'triangle_count':len(idx)//3,
        'upper_center_z':peak(0,.242),'upper_left_z':peak(-.010,.243),
        'upper_right_z':peak(.010,.243),'philtrum_center_z':peak(0,.259),
        'philtrum_left_z':peak(-.010,.259),
        'philtrum_right_z':peak(.010,.259),
        'lip_x_span':max(p[0] for p in lip)-min(p[0] for p in lip),
        'nonfinite':sum(not all(math.isfinite(v) for v in p) for p in pos+normals),
        'bad_normals':sum(abs(math.sqrt(sum(v*v for v in n))-1)>.06 for n in normals),
        'degenerate_triangles':sum(len(set(idx[i:i+3]))<3 for i in range(0,len(idx),3))}

def repeated_index_faces(indices):
    return Counter(tuple(sorted(indices[i:i+3])) for i in range(0,len(indices),3)
                   if len(set(indices[i:i+3]))<3)

def surface_z(points,indices,x,y):
    """Intersect actual triangles with a fixed front-view ray (not a window max)."""
    hits=[]
    for i in range(0,len(indices),3):
        a,b,c=(points[j] for j in indices[i:i+3])
        if not min(a[0],b[0],c[0])<=x<=max(a[0],b[0],c[0]):continue
        if not min(a[1],b[1],c[1])<=y<=max(a[1],b[1],c[1]):continue
        u=(b[0]-a[0],b[1]-a[1]);v=(c[0]-a[0],c[1]-a[1])
        det=u[0]*v[1]-u[1]*v[0]
        if abs(det)<1e-12:continue
        dx=x-a[0];dy=y-a[1]
        s=(dx*v[1]-dy*v[0])/det;t=(u[0]*dy-u[1]*dx)/det
        if min(s,t,1-s-t)<-1e-7:continue
        hits.append(a[2]+s*(b[2]-a[2])+t*(c[2]-a[2]))
    if not hits:raise AssertionError(f'no skin intersection at {x,y}')
    return max(hits)

def channel_sections(points,idx):
    return [((surface_z(points,idx,-.010,y)+surface_z(points,idx,.010,y))/2
             -surface_z(points,idx,0.,y)) for y in (.254,.255,.257,.259)]

class RealGeometry(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.a,cls.idx=read(PATH)
        cls.m=metric(PATH)
        print('v21 actual GLB metrics:',json.dumps(cls.m,indent=2))
        baseline=ROOT/'qa/baselines/face-v121-v20.glb'
        if baseline.exists():
            cls.base=metric(baseline)
            _,cls.base_attrs,cls.base_idx=read(baseline)
            print('v20 baseline metrics:',json.dumps(cls.base,indent=2))
        else:
            cls.base=None

    def test_real_attributes(self):
        self.assertEqual(len(self.a['POSITION']),13455)
        self.assertEqual(len(self.idx)%3,0)
        self.assertIn('TEXCOORD_0',self.a)
        self.assertEqual(len(self.a['NORMAL']),len(self.a['POSITION']))
        self.assertEqual(len(self.a['TEXCOORD_0']),len(self.a['POSITION']))

    def test_mesh_integrity(self):
        self.assertEqual(self.m['nonfinite'],0)
        self.assertEqual(self.m['bad_normals'],0)
        self.assertIsNotNone(self.base,'Frozen v20 required for inherited topology audit')
        # v20 contains 500 repeated-index faces. Reject every newly introduced
        # repeated-index face rather than mislabel inherited source defects.
        current=repeated_index_faces(self.idx)
        inherited=repeated_index_faces(self.base_idx)
        self.assertFalse(current-inherited,'New repeated-index triangles')
        self.assertEqual(self.m['triangle_count'],self.base['triangle_count'])
        self.assertTrue(all(0<=i<len(self.a['POSITION']) for i in self.idx))

    def test_real_philtrum_relief(self):
        self.assertIsNotNone(self.base)
        actual=channel_sections(self.a['POSITION'],self.idx)
        prior=channel_sections(self.base_attrs['POSITION'],self.base_idx)
        print('v21 philtrum relief by actual triangle ray (m):',actual,'v20:',prior)
        self.assertGreater(min(actual),.0002,'all four actual skin channel sections must be recessed')
        self.assertLess(max(actual),.0035,'no isolated deep philtrum pit')
        self.assertGreater(actual[-1]-prior[-1],.0010,'upper channel must improve over v20')
        # Preserve convex nose base/dorsum, not force the .263 nasal section
        # into a concavity. Protect the upper nasal surface from this edit.
        for x,y in ((0.,.267),(0.,.275),(-.010,.275),(.010,.275)):
            self.assertAlmostEqual(surface_z(self.a['POSITION'],self.idx,x,y),
                surface_z(self.base_attrs['POSITION'],self.base_idx,x,y),delta=.003)
        self.assertEqual(self.a['TEXCOORD_0'],self.base_attrs['TEXCOORD_0'])

    def test_upper_lip_projection_and_locked_seam(self):
        self.assertIsNotNone(self.base)
        before=self.base_attrs['POSITION']; after=self.a['POSITION']
        upper=[b[2]-a[2] for a,b in zip(before,after)
               if abs(a[0])<.020 and .238<a[1]<.245 and a[2]>.137]
        self.assertGreater(len(upper),20)
        self.assertGreater(median(upper),.0003,'actual upper-lip volume must increase')
        seam=[math.dist(a,b) for a,b in zip(before,after)
              if abs(a[0])<.035 and .230<a[1]<.233 and a[2]>.130]
        self.assertTrue(seam)
        self.assertLess(max(seam),.0003,'closed seam must stay stable')

    def test_v20_baseline_is_required(self):
        self.assertIsNotNone(self.base,'Frozen v20 GLB baseline missing; do not approve release')
        self.assertLessEqual(self.m['lip_x_span'],self.base['lip_x_span']*1.02)

if __name__=='__main__': unittest.main()
