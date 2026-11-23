#!/usr/bin/env python3
"""Check that v121 cosmetic eye features are real glTF geometry."""
import pathlib
import json
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
PATH=ROOT/'assets/generated/neutral-face-v121.glb'

class TestV121RealDetailMeshes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data=PATH.read_bytes()
        if data[:4]!=b'glTF' or struct.unpack_from('<I',data,8)[0]!=len(data):
            raise ValueError('Not a complete GLB')
        size=struct.unpack_from('<I',data,12)[0]
        cls.g=json.loads(data[20:20+size])

    def test_real_glb_not_2d_overlay(self):
        g=self.g
        self.assertEqual(len(g['meshes']),12)
        self.assertEqual(len(g['nodes']),12)
        meta=g['meshes'][0]['extras']
        self.assertEqual(meta['version'],121)
        self.assertFalse(meta['hairIncluded'])
        self.assertEqual(meta['topology']['vertices'],13455)
        self.assertTrue(meta['futureExpressionsImplemented'])
        self.assertEqual(meta['eyelidFiberUpgrade']['version'],'v121-eye-details-2')
        names=[
            'V121_UPPER_EYELINER',
            'V121_NATURAL_UPPER_LID_CREASE',
            'V121_TAPERED_UPPER_EYELASHES',
            'V121_FINE_LOWER_EYELASHES',
            'V121_INDIVIDUAL_EYEBROW_FIBERS']
        for name in names:
            with self.subTest(part=name):
                part=next(m for m in g['meshes'] if m['name']==name)
                prim=part['primitives'][0]
                p=g['accessors'][prim['attributes']['POSITION']]
                ix=g['accessors'][prim['indices']]
                self.assertGreater(p['count'],100)
                self.assertGreater(ix['count'],100)
                self.assertEqual(ix['count']%3,0)
                self.assertGreater(p['max'][2]-p['min'][2],.001)
                self.assertTrue(part['extras']['neutralOnly'])
                self.assertFalse(part['extras']['freeFloating'])
                self.assertIn(name,g['meshes'][0]['extras']['eyelidFiberUpgrade']['features'])
        self.assertGreater(
            g['meshes'][0]['extras']['eyelidFiberUpgrade']['features']['V121_INDIVIDUAL_EYEBROW_FIBERS']['strands'],200)
        self.assertGreater(
            g['meshes'][0]['extras']['eyelidFiberUpgrade']['features']['V121_TAPERED_UPPER_EYELASHES']['strands'],70)

    def test_iris_pupil_remain_uv_on_eyeball(self):
        g=self.g
        self.assertEqual(g['meshes'][0]['extras']['eyeConstruction']['irisAndPupilSeparateMeshes'],False)
        self.assertTrue(all('GLOBE_UV' in m['name'] for m in g['meshes'][1:3]))
        self.assertFalse(any('PUPIL_DISC' in m['name'] for m in g['meshes']))
        self.assertEqual(g['meshes'][0]['extras']['pbr']['albedoResolution'],2048)

if __name__=='__main__':
    unittest.main()
