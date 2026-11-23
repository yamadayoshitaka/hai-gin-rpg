#!/usr/bin/env python3
"""Four-view reference requires substantial actual 3D skin resculpt, not sliders."""
import importlib.util
import json
import math
import pathlib
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location(
    'v121_anatomical_reference_sculpt',
    ROOT/'scripts/reshape-v121-reference-head.py')
SCULPT=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCULPT)
GLB=ROOT/'assets/generated/neutral-face-v121.glb'

class FourViewSculptQA(unittest.TestCase):
    def test_real_front_profile_geometry_and_reference_metadata(self):
        raw=GLB.read_bytes()
        self.assertEqual(raw[:4],b'glTF')
        self.assertEqual(struct.unpack_from('<II',raw,4),(2,len(raw)))
        n=struct.unpack_from('<I',raw,12)[0]
        graph=json.loads(raw[20:20+n])
        head=graph['meshes'][0]
        p=head['primitives'][0]
        meta=head['extras']['referenceMeshResculpt']
        self.assertEqual(meta['sourceReferenceViews'],
                         ['front','front45','profile','rear'])
        self.assertEqual(meta['version'],
                         'four-view-skinhead-female-v121-20261123')
        self.assertGreater(meta['changedVerticesAbove045mm'],900)
        self.assertLess(meta['changedVerticesAbove045mm'],13456)
        self.assertGreater(meta['largestWorldSpaceDisplacement'],.001)
        self.assertLess(meta['largestWorldSpaceDisplacement'],.018)
        self.assertEqual(meta['baseVertices'],13455)
        self.assertEqual(meta['triangleCount'],25920)
        self.assertTrue(meta['uvAndTriangleIndicesPreserved'])
        self.assertTrue(meta['skinheadPreserved'])
        self.assertTrue(meta['chinShortenedAndRounded'])
        self.assertIn('supported-lower-cheek',meta['frontProfileContourPass'])
        self.assertTrue(meta['referenceImageIsNot3DScan'])
        self.assertGreater(graph['accessors'][p['attributes']['POSITION']]['count'],16000)
        self.assertEqual(graph['accessors'][p['attributes']['NORMAL']]['count'],graph['accessors'][p['attributes']['POSITION']]['count'])
        for region in ('temple','malar','jaw','tip','upperLip','lowerLip','underEye'):
            self.assertGreater(meta['resculptedRegionVertexCounts'][region],0,region)

    def test_changes_are_real_3d_not_just_cosmetic_or_slider(self):
        def transformed(point):
            return SCULPT.sculpt(point)[0]
        # Side-profile cheekbone should recede, not swell outward.
        cheek=(.075,.267,.125)
        self.assertLess(transformed(cheek)[2],cheek[2]-.001)
        # Jaw and brow-side forehead form a softer feminine ovoid.
        jaw=(.087,.156,.101)
        self.assertLess(transformed(jaw)[0],jaw[0]-.001)
        forehead=(.099,.393,.094)
        self.assertLess(transformed(forehead)[0],forehead[0]-.0005)
        # Nasal wings slimmer and nose tip restrained.
        wing=(.028,.248,.144)
        self.assertLess(transformed(wing)[0],wing[0])
        nose=(0.,.251,.157)
        self.assertLess(transformed(nose)[2],nose[2])
        # Both lip vermilion bands gain actual volume, not painted lipstick.
        upper=(.008,.240,.145)
        lower=(.008,.223,.143)
        self.assertGreater(transformed(upper)[2],upper[2]-.001)
        self.assertGreater(transformed(lower)[2],lower[2]-.001)
        # A smooth profile needs cheek support beneath the cheekbone and
        # a shorter, softly rounded chin, not a point or hollowed jaw.
        lower_cheek=(.088,.217,.098)
        self.assertGreater(transformed(lower_cheek)[2],lower_cheek[2]+.0006)
        chin=(.030,.180,.138)
        self.assertGreater(transformed(chin)[1],chin[1]+.003)
        self.assertLess(transformed(chin)[2],chin[2]-.005)
        # The front of the chin is drawn back and lifted while the mouth
        # and the lower neck retain their independent silhouette.
        central=(0.,.184,.142)
        self.assertLess(transformed(central)[2],central[2]-.006)
        jaw_side=(.055,.155,.11)
        self.assertLess(transformed(jaw_side)[2],jaw_side[2])
        # Lower neck is not pulled with the chin.
        neck=(.04,.04,.07)
        self.assertLess(math.dist(neck,transformed(neck)),.0002)

if __name__=='__main__':
    unittest.main()
