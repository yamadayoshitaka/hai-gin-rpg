#!/usr/bin/env python3
"""Protect v121 nose/eyes and check the lower-lip/chin contour in actual XYZ."""
import pathlib
import runpy
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
script=runpy.run_path(str(ROOT/'scripts/rebuild-v121-mouth-chin.py'))
sculpt=script['new_lower_face_geometry']

class LowerFaceProfileQA(unittest.TestCase):
    def test_lip_sulcus_chin_and_hard_nose_lock(self):
        # A dense synthetic skin patch exercises bounded displacement without
        # depending on preview material or on any browser shader.
        points=[(i/1000,j/1000,.15)
                for i in range(-60,61,4)
                for j in range(80,265,4)]
        points.extend([(0.,y,.15) for y in
                       (.211,.216,.222,.224,.232,.240,.245,.255,.260,.270,
                        .202,.173,.149,.126)])
        result,meta=sculpt(points,None)
        def original(y):
            return points.index((0.,y,.15))
        def delta_z(y):
            i=original(y)
            return result[i][2]-points[i][2]
        def delta_y(y):
            i=original(y)
            return result[i][1]-points[i][1]
        self.assertEqual(meta['version'],'female-v121-realspace-neutral-lower-face-v16')
        self.assertTrue(meta['noseAndUpperFaceHardLocked'])
        self.assertTrue(meta['lowerLipDepthRetracted'])
        self.assertTrue(meta['shallowLabiomentalSulcus'])
        self.assertTrue(meta['lowerVermilionHeightReduced'])
        # v19 retracts the lower vermilion less aggressively to avoid a
        # dark double-lip shelf. Check anatomical depth ORDER, not the
        # obsolete v12 3-mm recession at a single point.
        self.assertLess(delta_z(.224),-.002)
        self.assertGreater(delta_z(.240),-.001)
        self.assertLess(delta_z(.202),delta_z(.173)-.0002)
        # The shallow labiomental hollow must continuously rise toward the
        # true vermilion, without a second projected band underneath.
        self.assertLess(delta_z(.204),delta_z(.211))
        self.assertLess(delta_z(.211),delta_z(.224))
        self.assertGreater(delta_y(.216),0.)
        self.assertLess(delta_y(.216),.0015)
        self.assertTrue(meta['secondaryUnderlipRidgeRemoved'])
        # Sharpen both mandibular edges, never create a projected or
        # elongated chin tip, and never distort the lip or neck geometry.
        self.assertTrue(meta['shortSharperVLineChin'])
        self.assertTrue(meta['lipAndNeckExcludedFromJawTaper'])
        idx=points.index((.056,.152,.15))
        self.assertLess(result[idx][0],points[idx][0]-.0025)
        self.assertLess(result[idx][2],points[idx][2])
        lip_edge=points.index((.056,.232,.15))
        self.assertEqual(result[lip_edge][0],points[lip_edge][0])
        neck_edge=points.index((.056,.080,.15))
        self.assertAlmostEqual(result[neck_edge][0],points[neck_edge][0],delta=.0002)

        self.assertGreater(delta_y(.149),.001)
        self.assertEqual(result[original(.260)],points[original(.260)])
        self.assertEqual(result[original(.270)],points[original(.270)])
        self.assertLess(meta['maximumDisplacement'],.014)
        self.assertGreater(meta['affectedVertices'],180)

if __name__=='__main__':
    unittest.main()
