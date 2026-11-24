#!/usr/bin/env python3
"""v19 structural upper lip relief and supported cheek regression."""
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
        # Exclude red pigment from chin; natural cheek/nose blush is allowed.
        for point in ((0.,.208,.150),(0.,.200,.150),(.036,.200,.150)):
            color=SCULPT['neutral_color'](*point)
            self.assertLess(color[0]-color[1],.025)
        # Each Cupid peak is a higher border, not painted straight across.
        def upper(x):
            ax=abs(x)
            corner=SCULPT['fade'](ax,.029,.051)
            bell=SCULPT['bell']
            return .2495+.0028*bell(ax,.011,.0055)-.00075*bell(ax,0.,.004)-.0178*SCULPT['fade'](ax,.018,.045)
        self.assertGreater(upper(-.0115),upper(0.)+.002)
        self.assertGreater(upper(.0115),upper(0.)+.002)
        self.assertAlmostEqual(upper(-.0115),upper(.0115),places=9)

    def test_real_lip_border_relief_and_no_second_lip_underneath(self):
        sculpt=SCULPT['nose_and_lips']
        # Actual Z-position is changed on true lip vertices, not on chin.
        self.assertGreater(sculpt(0.,.240,.150)[2]-.150,.0015)
        self.assertGreater(sculpt(0.,.224,.150)[2]-.150,.0036)
        self.assertLess(abs(sculpt(0.,.200,.150)[2]-.150),.0003)
        self.assertLess(abs(sculpt(.060,.232,.150)[2]-.150),.0003)

    def test_outer_cheek_softens_and_inner_fold_curves_to_nose(self):
        fold=SCULPT['nasolabial_relief']
        smooth=SCULPT['fold_displacement']
        self.assertLess(fold(.039,.250,.150),-.00030)
        self.assertLess(fold(-.039,.250,.150),-.00030)
        self.assertEqual(fold(.078,.250,.150),0.)
        self.assertEqual(fold(.039,.204,.150),0.)
        # Outer cheek has more supporting volume than the inner soft valley.
        self.assertGreater(smooth(.078,.250,.150),
                           smooth(.039,.250,.150)+.0004)
        self.assertEqual(fold(0.,.250,.150),0.)  # central philtrum unchanged

    def test_upper_lip_is_convex_and_philtrum_does_not_erase_it(self):
        sculpt=SCULPT['nose_and_lips']
        groove=SCULPT['philtrum_relief']
        self.assertAlmostEqual(groove(0.,.243,.150),0.,places=8)
        self.assertLess(groove(0.,.259,.150),-.001)
        upper=sculpt(0.,.240,.150)[2]-.150
        lower=sculpt(0.,.224,.150)[2]-.150
        self.assertGreater(upper,.0064,'upper lip must protrude visibly')
        self.assertGreater(upper,lower+.0008,
                           'upper lip must not disappear behind lower')
        self.assertLess(abs(sculpt(0.,.202,.150)[2]-.150),.0003)

    def test_baked_glb_has_folds_and_border_not_just_metadata(self):
        raw=GLB.read_bytes()
        self.assertEqual(raw[:4],b'glTF')
        n=struct.unpack_from('<I',raw,12)[0]
        gltf=json.loads(raw[20:20+n])
        meta=gltf['meshes'][0]['extras']
        sculpt=meta['referenceFeatureSculpt']
        self.assertEqual(sculpt['version'],
                         'v121-convex-upper-vermilion-soft-cheeks-v19-20261124')
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
        self.assertTrue(meta['mouthChinRebuild']['noBroadInvertedUnderlipNormals'])
        self.assertGreater(meta['mouthChinRebuild']['repairedExteriorLipNormals'],50)
        self.assertGreater(meta['mouthChinRebuild']['upperVermilionLocalEdgeFlips'],0,
                           'upper lip must receive real connectivity edits')
        self.assertTrue(meta['mouthChinRebuild']['upperVermilionRetopologyExcludesMouthSeal'])
        from statistics import median
        n=struct.unpack_from('<I',raw,12)[0]
        offset=28+n
        blob=raw[offset:]
        prim=gltf['meshes'][0]['primitives'][0]
        accessor=SCULPT['accessor']
        points=accessor(gltf,blob,prim['attributes']['POSITION'])
        normals=accessor(gltf,blob,prim['attributes']['NORMAL'])
        underlip=[normal[2] for point,normal in zip(points,normals)
                  if abs(point[0])<.03 and .214<point[1]<.223
                  and point[2]>.132]
        self.assertGreater(len(underlip),35)
        self.assertGreater(median(underlip),.60,
                           'do not allow inward-facing broad underlip bar')
        self.assertEqual(meta['version'],121)
        self.assertFalse(meta['hairIncluded'])


if __name__=='__main__':
    unittest.main()
