#!/usr/bin/env python3
"""Native GLB QA: lower lashes on real eyelid rims, nostril-to-lip sculpt."""
import json
import math
import pathlib
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
GLB=ROOT/'assets/generated/neutral-face-v121.glb'

def load(path):
    raw=path.read_bytes()
    assert raw[:4]==b'glTF' and struct.unpack_from('<II',raw,4)==(2,len(raw))
    n=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+n])
    return g,raw[28+n:]

def get(g,b,i):
    a=g['accessors'][i]
    kind={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    dim={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    view=g['bufferViews'][a['bufferView']]
    offset=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',dim*struct.calcsize(kind))
    return [struct.unpack_from('<'+kind*dim,b,offset+j*stride)
            for j in range(a['count'])]

class ReferenceFeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.b=load(GLB)
        cls.head=cls.g['meshes'][0]
        cls.meta=cls.head['extras']
        cls.p=cls.head['primitives'][0]
        cls.xyz=get(cls.g,cls.b,cls.p['attributes']['POSITION'])

    def test_unchanged_neutral_topology_and_real_nose_lip_sculpt(self):
        meta=self.meta
        self.assertEqual(meta['version'],121)
        self.assertEqual(meta['topology']['vertices'],13455)
        self.assertFalse(meta['hairIncluded'])
        self.assertFalse(meta['futureExpressionsImplemented'])
        self.assertEqual(len(self.xyz),13455)
        self.assertEqual(len(get(self.g,self.b,self.p['indices'])),25920*3)
        self.assertEqual(len(self.g['meshes']),8)
        sculpt=meta['referenceFeatureSculpt']
        self.assertTrue(sculpt['foldIsActualSkinGeometry'])
        self.assertTrue(sculpt['preservesEyeAndMouthTopology'])
        self.assertGreater(len(sculpt['nostrilWingVerticesAdjusted']),20)
        self.assertGreater(len(sculpt['lipVermilionVerticesAdjusted']),30)
        self.assertGreater(len(meta['naturalFoldCleanup']['nasolabialLeftVertexIds']),40)
        self.assertGreater(len(meta['naturalFoldCleanup']['nasolabialRightVertexIds']),40)
        for i in sculpt['nostrilWingVerticesAdjusted']:
            x,y,z=self.xyz[i]
            self.assertLess(abs(x),.055)
            self.assertGreater(y,.225)
            self.assertLess(y,.280)
        for i in sculpt['lipVermilionVerticesAdjusted']:
            x,y,z=self.xyz[i]
            self.assertLess(abs(x),.058)
            self.assertGreater(y,.172)
            self.assertLess(y,.227)
        self.assertEqual(len(get(self.g,self.b,self.p['attributes']['NORMAL'])),13455)
        self.assertTrue(all(math.isfinite(v) for xyz in self.xyz for v in xyz))

    def test_lower_lashes_attach_to_real_eyelid_boundary(self):
        g,b=self.g,self.b
        meta=self.meta['eyelidFiberUpgrade']
        self.assertEqual(meta['lowerLashPlacementVersion'],
                         'v121-anatomical-rim-20261123')
        ix=[v[0] for v in get(g,b,self.p['indices'])]
        edges={}
        for i in range(0,len(ix),3):
            a,c,d=ix[i:i+3]
            for edge in ((a,c),(c,d),(d,a)):
                key=tuple(sorted(edge))
                edges[key]=edges.get(key,0)+1
        rim=set()
        for edge,num in edges.items():
            if num==1:
                rim.update(edge)
        boundary=[p for i,p in enumerate(self.xyz) if i in rim
                  and .022<abs(p[0])<.053 and .298<p[1]<.312
                  and .105<p[2]<.145]
        self.assertGreater(len(boundary),20)
        lash=next(m for m in g['meshes']
                  if m['name']=='V121_FINE_LOWER_EYELASHES')
        prim=lash['primitives'][0]
        vertices=get(g,b,prim['attributes']['POSITION'])
        self.assertEqual(len(vertices),352)
        max_gap=0.
        for i in range(0,len(vertices),8):
            a,c=vertices[i:i+2]
            root=((a[0]+c[0])*.5,(a[1]+c[1])*.5,(a[2]+c[2])*.5)
            tip=vertices[i+6]
            self.assertLess(tip[1],root[1]-.0013)
            self.assertTrue(.298<root[1]<.312)
            nearest=min(math.dist(root,p) for p in boundary)
            max_gap=max(max_gap,nearest)
            self.assertLess(nearest,.0055)
        print('Lower lash maximum root-to-lid-boundary distance:',round(max_gap,6))

if __name__=='__main__':
    unittest.main()
