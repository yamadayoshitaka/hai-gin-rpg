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
                       (.216,.222,.224,.232,.240,.245,.255,.260,.270,
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
        self.assertEqual(meta['version'],'female-v121-realspace-neutral-lower-face-v12')
        self.assertTrue(meta['noseAndUpperFaceHardLocked'])
        self.assertTrue(meta['lowerLipDepthRetracted'])
        self.assertTrue(meta['shallowLabiomentalSulcus'])
        self.assertTrue(meta['lowerVermilionHeightReduced'])
        self.assertLess(delta_z(.224),-.003)
        self.assertGreater(delta_z(.240),-.001)
        self.assertLess(delta_z(.202),delta_z(.173)-.0007)
        self.assertGreater(delta_y(.216),.001)
        self.assertGreater(delta_y(.149),.001)
        self.assertEqual(result[original(.260)],points[original(.260)])
        self.assertEqual(result[original(.270)],points[original(.270)])
        self.assertLess(meta['maximumDisplacement'],.014)
        self.assertGreater(meta['affectedVertices'],180)

if __name__=='__main__':
    unittest.main()
