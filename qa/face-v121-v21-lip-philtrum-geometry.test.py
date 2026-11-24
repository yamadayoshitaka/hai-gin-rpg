#!/usr/bin/env python3
"""v21: inspect real GLB accessors; reject metadata-only geometry claims."""
import json, math, pathlib, struct, sys, unittest

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

class RealGeometry(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.a,cls.idx=read(PATH)
        cls.m=metric(PATH)
        print('v21 actual GLB metrics:',json.dumps(cls.m,indent=2))
        baseline=ROOT/'qa/baselines/face-v121-v20.glb'
        if baseline.exists():
            cls.base=metric(baseline)
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
        self.assertEqual(self.m['degenerate_triangles'],0)
        self.assertTrue(all(0<=i<len(self.a['POSITION']) for i in self.idx))

    def test_real_philtrum_relief(self):
        m=self.m
        self.assertLess(m['philtrum_center_z'],(m['philtrum_left_z']+m['philtrum_right_z'])/2-.0002)

    def test_v20_baseline_is_required(self):
        self.assertIsNotNone(self.base,'Frozen v20 GLB baseline missing; do not approve release')
        self.assertLessEqual(self.m['lip_x_span'],self.base['lip_x_span']*1.02)

if __name__=='__main__': unittest.main()
