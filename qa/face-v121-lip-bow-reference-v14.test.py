#!/usr/bin/env python3
"""Regression for the real female v121 v14 lip, philtrum and nasal sculpt.

Exercises 3D POSITION deformations; a lipstick-only edit cannot pass.
The GLB test also verifies the actual downloaded head carries the v14 pass.
"""
import json
import math
import pathlib
import runpy
import struct
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCULPT = runpy.run_path(str(ROOT / 'scripts/finish-v121-natural-folds.py'))
RESHAPE = runpy.run_path(str(ROOT / 'scripts/reshape-v121-reference-head.py'))
GLB = ROOT / 'assets/generated/neutral-face-v121.glb'

class ReferenceV14(unittest.TestCase):
    def test_cupid_bow_is_real_m_shaped_geometry(self):
        sculpt=SCULPT['nose_and_lips']
        center=sculpt(0.,.245,.150)
        left=sculpt(-.011,.245,.150)
        right=sculpt(.011,.245,.150)
        # The central dip must sit below the two Cupid peaks, not be paint.
        self.assertGreater(left[1]-center[1],.0007)
        self.assertGreater(right[1]-center[1],.0007)
        self.assertLess(abs(left[1]-right[1]),1.e-8)

    def test_lower_lip_has_volume_but_chin_has_no_second_lip(self):
        sculpt=SCULPT['nose_and_lips']
        original=.150
        lower=sculpt(0.,.224,original)
        bottom=sculpt(0.,.214,original)
        chin=sculpt(0.,.201,original)
        left=sculpt(-.046,.224,original)
        mid=sculpt(-.012,.224,original)
        # Raised lower vermilion; corners smoothly converge and lose volume.
        self.assertGreater(lower[2]-original,.002)
        self.assertGreater(mid[2]-left[2],.001)
        self.assertLess(abs(chin[2]-original),.0003)
        self.assertLess(bottom[2]-original,lower[2]-original)

    def test_nose_is_narrower_and_philtrum_is_shorter(self):
        sculpt=SCULPT['nose_and_lips']
        wing=sculpt(.026,.254,.153)
        original_nose=(.026,.254,.153)
        self.assertLess(wing[0],original_nose[0]-.001)
        mouth=sculpt(0.,.240,.15)
        nose_base=sculpt(0.,.267,.15)
        self.assertGreater(mouth[1]-.240,.003)
        # Central nose-to-lip spacing must be shorter than the v14
        # baseline, while the original nasal base stays locked.
        self.assertAlmostEqual(nose_base[1],.267,delta=.0002)
        self.assertLess(nose_base[1]-mouth[1],.027-.001)
        # A defined central groove fades laterally rather than being a line.
        groove=SCULPT['philtrum_relief'](0.,.252,.15)
        sides=SCULPT['philtrum_relief'](.028,.252,.15)
        self.assertLess(groove,sides-.001)
        # A longitudinal (not oval or painted) groove must remain visible
        # near both the upper Cupid edge and the underside of the nose.
        for y in (.243,.268):
            center=SCULPT['philtrum_relief'](0.,y,.15)
            outer=SCULPT['philtrum_relief'](.028,y,.15)
            self.assertLess(center,outer-.0007)

    def test_chin_vline_tapers_without_lower_lip_or_neck_distortion(self):
        sculpt=runpy.run_path(str(ROOT / 'scripts/rebuild-v121-mouth-chin.py'))
        pts=[(x,.150,.15) for x in (-.056,-.040,.0,.040,.056)]
        pts += [(x,.234,.15) for x in (-.056,-.04,0.,.04,.056)]
        pts += [(x,.080,.15) for x in (-.056,-.04,0.,.04,.056)]
        # The isolated low-density sample is too small for the 180-vertex
        # production sculpt safety guard: add realistic synthetic patch.
        pts += [(i/1000,j/1000,.15)
                for i in range(-64,65,4) for j in range(80,265,4)]
        out,meta=sculpt['new_lower_face_geometry'](pts,None)
        for n in (0,4):
            self.assertLess(abs(out[n][0]),abs(pts[n][0])-.002)
        for n in range(5,15):
            self.assertAlmostEqual(out[n][0],pts[n][0],delta=.0002)
        self.assertTrue(meta['shortSharperVLineChin'])
        self.assertTrue(meta['lipAndNeckExcludedFromJawTaper'])

    def test_chin_deep_shadow_source_is_reduced(self):
        old=(0.,.184,.142)
        new=RESHAPE['sculpt'](old)[0]
        # Still a feminine recessed chin, but no abrupt 14.5mm old collapse.
        self.assertLess(new[2],old[2]-.006)
        self.assertGreater(new[2],old[2]-.0145)

    def test_baked_glb_preserves_rig_and_v14_features(self):
        raw=GLB.read_bytes()
        self.assertEqual(raw[:4],b'glTF')
        size=struct.unpack_from('<I',raw,12)[0]
        g=json.loads(raw[20:20+size])
        mesh=g['meshes'][0]
        meta=mesh['extras']
        self.assertEqual(meta['version'],121)
        self.assertFalse(meta['hairIncluded'])
        self.assertEqual(meta['mouthChinRebuild']['version'],
                         'female-v121-realspace-neutral-lower-face-v15')
        sculpt=meta['referenceFeatureSculpt']
        for field in ('lowerLipFullerAndCornerTapered',
                      'upperLipMShapedCupidBow',
                      'nasalTipAndAlarNarrowed',
                      'philtrumDistanceShortenedByGeometry'):
            self.assertTrue(sculpt[field],field)
        self.assertEqual(meta['topology']['vertices'],13455)
        self.assertEqual(len(g['meshes'][0]['primitives'][0]['targets']),11)
        self.assertEqual(len(g['animations']),2)
        self.assertGreater(meta['mouthChinRebuild']['labiomentalFairingVertices'],100)

if __name__ == '__main__':
    unittest.main()
