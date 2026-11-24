#!/usr/bin/env python3
"""GLB regression for brow/eyelid stain, chin tint and nasolabial sculpt."""
import json
import math
import pathlib
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
GLB=ROOT/'assets/generated/neutral-face-v121.glb'


def read_glb(path):
    data=path.read_bytes()
    assert data[:4]==b'glTF'
    assert struct.unpack_from('<II',data,4)==(2,len(data))
    n=struct.unpack_from('<I',data,12)[0]
    g=json.loads(data[20:20+n])
    return g,data[28+n:]


def accessor(g,b,number):
    a=g['accessors'][number]
    view=g['bufferViews'][a['bufferView']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    fmt={5125:'I',5126:'f'}[a['componentType']]
    at=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',struct.calcsize(fmt)*n)
    return [struct.unpack_from('<'+fmt*n,b,at+j*stride)
            for j in range(a['count'])]


class V121SkinClean(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.buffer=read_glb(GLB)
        cls.face=cls.g['meshes'][0]
        cls.p=cls.face['primitives'][0]
        cls.xyz=accessor(cls.g,cls.buffer,cls.p['attributes']['POSITION'])
        cls.colors=accessor(cls.g,cls.buffer,cls.p['attributes']['COLOR_0'])

    def test_real_fold_regions_and_preserved_mesh(self):
        meta=self.face['extras']
        self.assertEqual(meta['version'],121)
        self.assertFalse(meta['hairIncluded'])
        self.assertTrue(meta['futureExpressionsImplemented'])
        self.assertEqual(meta['topology']['vertices'],13455)
        self.assertEqual(len(self.xyz),13455)
        self.assertEqual(len(self.g['meshes']),11)
        self.assertIn('eyeConstruction',meta)
        self.assertIn('eyelidFiberUpgrade',meta)
        self.assertEqual(meta['naturalFoldCleanup']['version'],'v121-soft-supported-cheeks-20261124-v20')
        self.assertTrue(meta['naturalFoldCleanup']['surfaceDeformationOnly'])
        self.assertTrue(meta['naturalFoldCleanup']['removedLegacyBrowLidBand'])
        self.assertTrue(meta['naturalFoldCleanup']['removedChinTintLeakage'])
        # Shallow smile lines now sit INSIDE the cheeks, from the nasal alae
        # toward the commissures. The former outer-cheek trench stays removed.
        for side,sign in (('nasolabialLeftVertexIds',-1),
                          ('nasolabialRightVertexIds',1)):
            ids=meta['naturalFoldCleanup'][side]
            self.assertGreater(len(ids),8)
            for ix in ids:
                x,y,z=self.xyz[ix]
                self.assertGreater(sign*x,.025)
                self.assertLess(sign*x,.064)
                self.assertGreater(y,.224)
                self.assertLess(y,.276)
        center=meta['naturalFoldCleanup']['philtrumVertexIds']
        corrected=meta['naturalFoldCleanup']['dimpleCorrectionVertexIds']
        self.assertGreater(len(center),12)
        self.assertGreater(len(corrected),12)
        for ix in center:
            x,y,z=self.xyz[ix]
            self.assertLess(abs(x),.011)
            self.assertGreater(y,.251)
            self.assertLess(y,.268)
        for ix in corrected:
            x,y,z=self.xyz[ix]
            self.assertGreater(abs(x),.025)
            self.assertLess(abs(x),.067)
            self.assertGreater(y,.217)
            self.assertLess(y,.252)
        self.assertTrue(meta['referenceFeatureSculpt']['lateralNasolabialPitRemoved'])
        self.assertGreaterEqual(meta['referenceFeatureSculpt']['philtrumGrooveMasterDepth'],.0025)
        self.assertLessEqual(meta['referenceFeatureSculpt']['philtrumGrooveMasterDepth'],.0038)
        self.assertLessEqual(meta['referenceFeatureSculpt']['philtrumGrooveMasterDepth'],.004)
        self.assertGreaterEqual(meta['referenceFeatureSculpt']['philtrumColumnsRelief'],.0006)
        self.assertLessEqual(meta['referenceFeatureSculpt']['philtrumColumnsRelief'],.0010)
        self.assertTrue(meta['referenceFeatureSculpt']['philtrumNoOvalPit'])
        self.assertIn('continuous_nose_base_to_upper_vermilion',meta['referenceFeatureSculpt']['philtrumShape'])
        self.assertGreater(meta['referenceFeatureSculpt']['centralPhiltrumStart'][1],.259)
        self.assertLess(meta['referenceFeatureSculpt']['centralPhiltrumEnd'][1],.251)
        # The depression is continuous through the middle of the philtrum.
        for low,high in ((.253,.257),(.257,.261),(.261,.266)):
            self.assertGreater(sum(1 for i in center if low<=self.xyz[i][1]<high),
                               0, f'central philtrum groove missing in y band {low}..{high}')
        self.assertTrue(meta['referenceFeatureSculpt']['parametricDepthControlSupported'])
        self.assertEqual(len(accessor(self.g,self.buffer,self.p['indices'])),25920*3)
        self.assertEqual(len(accessor(self.g,self.buffer,self.p['attributes']['NORMAL'])),13455)

    def test_no_eyelid_brow_band_or_pink_chin(self):
        # Discrete colour bands are prohibited; brows and eyeliner are actual
        # independent mesh objects, not reddish painted vertex-colour masks.
        brow=[c for (x,y,z),c in zip(self.xyz,self.colors)
              if .028<abs(x)<.066 and .324<y<.346 and z>.085]
        chin=[c for (x,y,z),c in zip(self.xyz,self.colors)
              if abs(x)<.052 and .111<y<.161 and z>.005]
        lip=[c for (x,y,z),c in zip(self.xyz,self.colors)
             if abs(x)<.029 and .217<y<.247 and z>.12]
        self.assertGreater(len(brow),25)
        self.assertGreater(len(chin),20)
        self.assertGreater(len(lip),10)
        self.assertLess(max(c[0]-c[1] for c in brow),.018)
        self.assertLess(max(c[0]-c[1] for c in chin),.018)
        self.assertLess(max(abs(c[j]-.994) for c in chin for j in (0,1,2)),.025)
        self.assertGreater(max(c[0]-c[1] for c in lip),.035)

    def test_normals_are_finite_and_cosmetic_meshes_intact(self):
        normals=accessor(self.g,self.buffer,self.p['attributes']['NORMAL'])
        self.assertTrue(all(math.isfinite(v) for row in normals for v in row))
        self.assertTrue(all(.95<math.sqrt(sum(v*v for v in row))<1.05 for row in normals))
        self.assertEqual(len(self.g['nodes']),11)
        for name in ('V121_UPPER_EYELINER','V121_TAPERED_UPPER_EYELASHES',
                     'V121_FINE_LOWER_EYELASHES','V121_INDIVIDUAL_EYEBROW_FIBERS'):
            self.assertIn(name,[m['name'] for m in self.g['meshes']])
        lid=next(m for m in self.g['materials']
                 if m['name']=='V121_NATURAL_UPPER_LID_CREASE_PBR')
        self.assertGreater(lid['pbrMetallicRoughness']['baseColorFactor'][0],.75)
        print('V121 NATURAL FOLDS',{
            'left':len(self.face['extras']['naturalFoldCleanup']['nasolabialLeftVertexIds']),
            'right':len(self.face['extras']['naturalFoldCleanup']['nasolabialRightVertexIds']),
            'chin':self.face['extras']['naturalFoldCleanup']['chinVerticesSmoothed']})

if __name__=='__main__':
    unittest.main()
