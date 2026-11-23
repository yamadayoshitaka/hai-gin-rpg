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
        self.assertTrue(meta['futureExpressionsImplemented'])
        self.assertEqual(len(self.xyz),13455)
        self.assertEqual(len(get(self.g,self.b,self.p['indices'])),25920*3)
        self.assertEqual(len(self.g['meshes']),12)
        sculpt=meta['referenceFeatureSculpt']
        self.assertTrue(sculpt['foldIsActualSkinGeometry'])
        self.assertTrue(sculpt['preservesEyeAndMouthTopology'])
        self.assertGreater(len(sculpt['nostrilWingVerticesAdjusted']),20)
        self.assertGreater(len(sculpt['lipVermilionVerticesAdjusted']),30)
        self.assertGreater(len(meta['naturalFoldCleanup']['philtrumVertexIds']),12)
        self.assertGreater(len(meta['naturalFoldCleanup']['dimpleCorrectionVertexIds']),12)
        self.assertTrue(sculpt['lateralNasolabialPitRemoved'])
        self.assertEqual(sculpt['centralPhiltrumStart'][0],0.)
        for i in sculpt['nostrilWingVerticesAdjusted']:
            x,y,z=self.xyz[i]
            self.assertLess(abs(x),.055)
            self.assertGreater(y,.225)
            self.assertLess(y,.280)
        for i in sculpt['lipVermilionVerticesAdjusted']:
            x,y,z=self.xyz[i]
            self.assertLess(abs(x),.058)
            self.assertGreater(y,.215)
            self.assertLess(y,.253)
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
        count=44
        rings=7
        radial_sides=6
        hair_vertices=count*rings*radial_sides
        self.assertEqual(len(vertices),hair_vertices+132,
                         'Each eye adds 33 two-sided lid rim ribbon points')
        self.assertTrue(meta['upperLashCcurl'])
        self.assertTrue(meta['lowerLashDownwardCurl'])
        self.assertTrue(meta['lowerLidWaterline'])
        self.assertEqual(meta['frontVisibleCurlVersion'],
                         'v121-front-hook-eyelashes-20261123')
        self.assertGreater(meta['lowerLashProjectionOutward'],.01)
        self.assertEqual(meta['curvedLashGeometry'],
                         'seven_segment_elliptical_3d_tapered_C_curl')
        def center(start):
            ring=vertices[start:start+6]
            return tuple(sum(p[j] for p in ring)/len(ring) for j in range(3))
        max_gap=0.
        # Two eyes each have 22 tubes followed by a 66-vertex lid ribbon.
        # Sample tube roots/tips only; interleaved waterlines are not lashes.
        for i in (eye*(22*42+66)+strand*42
                  for eye in range(2) for strand in range(22)):
            root=center(i)
            first=center(i+6)
            mid=center(i+18)
            tip=center(i+36)
            self.assertLess(tip[1],root[1]-.005,
                            'Lower eyelash tips must visibly descend')
            self.assertGreater(mid[2],root[2]+.007,
                               'Curl must rise out from skin before dropping')
            self.assertGreater(first[2],root[2]+.002)
            self.assertTrue(.298<root[1]<.312)
            nearest=min(math.dist(root,p) for p in boundary)
            max_gap=max(max_gap,nearest)
            self.assertLess(nearest,.0055)
        normals=get(g,b,prim['attributes']['NORMAL'])
        self.assertEqual(len(normals),len(vertices))
        self.assertTrue(any(abs(n[0])>.35 for n in normals[:hair_vertices]),
                        'Lower lashes must have real 3D tube normals')
        print('C-curved lower lash maximum root-to-lid-boundary distance:',
              round(max_gap,6))

    def test_upper_lashes_have_real_forward_then_upward_curl(self):
        g,b=self.g,self.b
        part=next(m for m in g['meshes'] if m['name']=='V121_TAPERED_UPPER_EYELASHES')
        prim=part['primitives'][0]
        points=get(g,b,prim['attributes']['POSITION'])
        self.assertEqual(len(points),82*42)
        def center(i):
            return tuple(sum(v[k] for v in points[i:i+6])/6 for k in range(3))
        for i in range(0,len(points),42):
            root,first,mid,tip=(center(i),center(i+6),center(i+18),center(i+36))
            self.assertGreater(tip[1],root[1]+.0047,
                               'Upper lash must have a visible upward curl')
            self.assertGreater(mid[2],root[2]+.003,
                               'Upper lash must project out from eyelid')
            self.assertGreater(first[2],root[2]+.0006)
            self.assertGreater(tip[2],root[2]+.004)
            # C-curl must also bend sideways in 2D front projection,
            # not appear as rigid upward spikes.
            near_tip=center(i+30)
            self.assertGreater(abs(tip[0]-root[0]),.0001)
            self.assertGreater(abs(near_tip[0]-root[0]),.0001)
        normal=get(g,b,prim['attributes']['NORMAL'])
        self.assertTrue(any(abs(v[1])>.3 for v in normal),
                        'Upper eyelash tubes must have actual tangent-based normals')

if __name__=='__main__':
    unittest.main()
