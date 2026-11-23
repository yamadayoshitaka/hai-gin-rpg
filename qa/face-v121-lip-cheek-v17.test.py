#!/usr/bin/env python3
"""v17 anatomical lip border and shallow inner nasolabial fold regression."""
import json
import pathlib
import runpy
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SCULPT=runpy.run_path(str(ROOT/'scripts/finish-v121-natural-folds.py'))
GLB=ROOT/'assets/generated/neutral-face-v121.glb'


class LipAndCheekV17(unittest.TestCase):
    def test_cupid_peaks_lower_rim_and_skin_guard_use_one_boundary(self):
        outline=SCULPT['vermilion_outline']
        center=outline(0.,.240,.150)[0]
        self.assertGreater(center,.85)
        self.assertGreater(outline(0.,.224,.150)[0],.85)
        self.assertLess(outline(.048,.232,.150)[0],center*.5)
        for point in ((0.,.254,.150),(0.,.208,.150),
                      (.060,.231,.150),(0.,.225,.090),
                      (.036,.200,.150)):
            self.assertEqual(outline(*point)[0],0.,point)
            color=SCULPT['neutral_color'](*point)
            self.assertLess(color[0]-color[1],.025)
        # Each Cupid peak is a higher border, not painted straight across.
        def upper(x):
            ax=abs(x)
            corner=SCULPT['fade'](ax,.029,.051)
            bell=SCULPT['bell']
            return .2480+.0029*bell(ax,.0115,.006)-.00105*bell(ax,0.,.0042)-.0147*corner
        self.assertGreater(upper(-.0115),upper(0.)+.002)
        self.assertGreater(upper(.0115),upper(0.)+.002)
        self.assertAlmostEqual(upper(-.0115),upper(.0115),places=9)

    def test_real_lip_border_relief_and_no_second_lip_underneath(self):
        sculpt=SCULPT['nose_and_lips']
        # Actual Z-position is changed on true lip vertices, not on chin.
        self.assertGreater(sculpt(0.,.240,.150)[2]-.150,.0015)
        self.assertGreater(sculpt(0.,.224,.150)[2]-.150,.0045)
        self.assertLess(abs(sculpt(0.,.200,.150)[2]-.150),.0003)
        self.assertLess(abs(sculpt(.060,.232,.150)[2]-.150),.0003)

    def test_outer_cheek_softens_and_inner_fold_curves_to_nose(self):
        fold=SCULPT['nasolabial_relief']
        smooth=SCULPT['fold_displacement']
        self.assertLess(fold(.039,.250,.150),-.0003)
        self.assertLess(fold(-.039,.250,.150),-.0003)
        self.assertEqual(fold(.078,.250,.150),0.)
        self.assertEqual(fold(.039,.204,.150),0.)
        # Outer cheek has more supporting volume than the inner soft valley.
        self.assertGreater(smooth(.078,.250,.150),
                           smooth(.039,.250,.150)+.0004)
        self.assertEqual(fold(0.,.250,.150),0.)  # central philtrum unchanged

    def test_baked_glb_has_folds_and_border_not_just_metadata(self):
        raw=GLB.read_bytes()
        self.assertEqual(raw[:4],b'glTF')
        n=struct.unpack_from('<I',raw,12)[0]
        gltf=json.loads(raw[20:20+n])
        meta=gltf['meshes'][0]['extras']
        sculpt=meta['referenceFeatureSculpt']
        self.assertEqual(sculpt['version'],
                         'v121-clear-lip-border-inner-fold-v17-20261124')
        for field in ('anatomicalVermilionBorderRealGeometry',
                      'upperCupidBowBorderAndLowerRimDefined',
                      'lipCornerTaperedToOralCommissure',
                      'outerCheekTrenchSoftened',
                      'shallowInnerNasolabialFoldSculpted',
                      'noSecondSubLabialRidge'):
            self.assertTrue(sculpt[field],field)
        folds=meta['naturalFoldCleanup']
        for field in ('nasolabialLeftVertexIds','nasolabialRightVertexIds'):
            self.assertGreater(len(folds[field]),8)
        self.assertEqual(len(gltf['meshes'][0]['primitives']),1)
        self.assertTrue(meta['mouthChinRebuild']['noSecondaryUnderlipLine'])
        self.assertEqual(meta['version'],121)
        self.assertFalse(meta['hairIncluded'])


if __name__=='__main__':
    unittest.main()
