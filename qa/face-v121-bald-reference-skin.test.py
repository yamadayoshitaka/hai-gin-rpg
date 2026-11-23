#!/usr/bin/env python3
"""Structural safety, PBR rendering inputs, and v120 neutral-face regression."""
import json
import math
import pathlib
import struct
import unittest
from PIL import Image
from io import BytesIO

ROOT=pathlib.Path(__file__).resolve().parents[1]
OLD=ROOT/'assets/generated/neutral-face-v120.glb'
NEW=ROOT/'assets/generated/neutral-face-v121.glb'

def glb(file):
    blob=file.read_bytes()
    assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,4)[0]==2
    assert struct.unpack_from('<I',blob,8)[0]==len(blob)
    size=struct.unpack_from('<I',blob,12)[0]
    obj=json.loads(blob[20:20+size])
    pos=20+size
    assert blob[pos+4:pos+8]==b'BIN\0'
    chunk=blob[pos+8:]
    return obj,chunk

def accessor(g,b,i):
    a=g['accessors'][i]
    cols={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    kind={5125:'I',5126:'f'}[a['componentType']]
    view=g['bufferViews'][a['bufferView']]
    at=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',cols*struct.calcsize(kind))
    return [struct.unpack_from('<'+kind*cols,b,at+n*stride) for n in range(a['count'])]

class TestFaceV121(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a,cls.a_bin=glb(OLD)
        cls.b,cls.b_bin=glb(NEW)

    def test_geometry_is_a_new_real_3d_sculpt_preserving_v120_index_order(self):
        src=self.a['meshes'][0]['primitives'][0]
        dst=self.b['meshes'][0]['primitives'][0]
        oldp=accessor(self.a,self.a_bin,src['attributes']['POSITION'])
        newp=accessor(self.b,self.b_bin,dst['attributes']['POSITION'])
        self.assertEqual(len(oldp),13455)
        self.assertEqual(len(newp),len(oldp))
        original=accessor(self.a,self.a_bin,src['indices'])
        current=accessor(self.b,self.b_bin,dst['indices'])
        self.assertEqual(len(original),len(current))
        meta=self.b['meshes'][0]['extras']['neckBustRebuild']
        self.assertTrue(meta['entireOldLowerFaceRemoved'])
        self.assertTrue(meta['oneContiguousGeneratedMouthChinNeckShoulderBust'])
        self.assertEqual(meta['oldBodyTrianglesUsedInNewMesh'],0)
        cut=meta['replacedFromY']
        self.assertGreater(cut,.237)
        self.assertLess(cut,.255)
        retired=sum(1 for k in range(0,len(current),3)
                    if current[k]==current[k+1]==current[k+2])
        self.assertGreater(retired,meta['oldLowerFaceChinNeckBustTrianglesRetired'])
        self.assertGreater(meta['oldLowerFaceChinNeckBustTrianglesRetired'],4000)
        # This is the essential regression: no source chin, lips, throat,
        # jaw or shoulder triangles can remain visible below the cut.
        for k in range(0,len(current),3):
            face=[t[0] for t in current[k:k+3]]
            if len(set(face))!=3:continue
            self.assertGreaterEqual(min(newp[i][1] for i in face),cut-1e-7)
        self.assertEqual(self.b['meshes'][-1]['name'],
                         'V121_NEW_CONTIGUOUS_LOWER_FACE_LIPS_CHIN_NECK_BUST')
        replacement=self.b['meshes'][-1]['primitives'][0]
        positions=accessor(self.b,self.b_bin,replacement['attributes']['POSITION'])
        self.assertEqual(len(positions),meta['freshVisibleSurfaceVertices'])
        self.assertGreater(len(positions),1000)
        self.assertGreater(len(self.b['meshes'][-1]['primitives'][0]['targets']),10)
        self.assertLess(min(p[1] for p in positions),-.07)
        self.assertTrue(all(math.isfinite(v) for p in positions for v in p))
        # Retain indexed upper-face UV and 11 native expression channels.
        self.assertEqual(accessor(self.a,self.a_bin,src['attributes']['TEXCOORD_0']),
                         accessor(self.b,self.b_bin,dst['attributes']['TEXCOORD_0']))
        self.assertEqual(len(dst['targets']),11)
        self.assertEqual(len(accessor(self.b,self.b_bin,dst['attributes']['NORMAL'])),13455)
        distances=[math.dist(a,b) for a,b in zip(oldp,newp)]
        self.assertGreater(sum(d>.00004 for d in distances),1000)
        self.assertTrue(all(math.isfinite(v) for p in newp for v in p))
        colors=accessor(self.b,self.b_bin,dst['attributes']['COLOR_0'])
        self.assertGreater(len(set(tuple(round(v,2) for v in c) for c in colors)),10)


    def test_skinhead_and_future_expression_safety(self):
        src=self.a['meshes'][0]['extras']
        dst=self.b['meshes'][0]['extras']
        self.assertEqual(dst['version'],121)
        self.assertEqual(dst['futureExpressionsImplemented'],True)
        self.assertEqual(dst['hairIncluded'],False)
        self.assertEqual(dst['topology'],src['topology'])
        self.assertEqual(dst['futureRigZones'],src['futureRigZones'])
        self.assertEqual(dst['futureExpressions'],src['futureExpressions'])
        self.assertEqual(len(self.b.get('animations',[])),2)
        self.assertEqual(len(self.b['meshes'][0]['primitives'][0]['targets']),11)
        self.assertFalse(any('hair' in x.get('name','').lower() for x in self.b['meshes']))
        self.assertEqual(len(self.b['meshes']),12)
        sculpt=self.b['meshes'][0]['extras']['referenceMeshResculpt']
        self.assertGreater(sculpt['changedVerticesAbove045mm'],900)
        self.assertEqual(sculpt['baseVertices'],13455)
        self.assertEqual(sculpt['triangleCount'],25920)
        self.assertTrue(sculpt['uvAndTriangleIndicesPreserved'])
        self.assertTrue(all('GLOBE_UV' in mesh['name'] for mesh in self.b['meshes'][1:3]))
        self.assertFalse(any('PUPIL_' in node.get('name','') for node in self.b['nodes']))
        self.assertEqual(self.b['meshes'][0]['extras']['eyeConstruction']['irisAndPupilSeparateMeshes'],False)
        for globe in self.b['meshes'][1:3]:
            self.assertIn('TEXCOORD_0',globe['primitives'][0]['attributes'])
            self.assertGreater(len(accessor(self.b,self.b_bin,globe['primitives'][0]['attributes']['POSITION'])),2000)

    def test_pbr_maps_embedded_are_true_1024_px_skin_textures(self):
        skin=self.b['materials'][0]
        self.assertEqual(skin['name'],'V121_ANATOMICAL_SKIN_PBR_2048')
        mr=skin['pbrMetallicRoughness']
        self.assertEqual(mr['metallicFactor'],0)
        indices=[mr['baseColorTexture']['index'],
                 mr['metallicRoughnessTexture']['index'],
                 skin['normalTexture']['index']]
        self.assertEqual(len(set(indices)),3)
        self.assertEqual(len(self.b['images']),4)
        self.assertEqual(self.b['meshes'][0]['extras']['pbr']['embeddedImages'],4)
        for texture in indices:
            image=self.b['images'][self.b['textures'][texture]['source']]
            v=self.b['bufferViews'][image['bufferView']]
            pixels=self.b_bin[v['byteOffset']:v['byteOffset']+v['byteLength']]
            png=Image.open(BytesIO(pixels))
            self.assertEqual(png.size,(2048,2048))
            self.assertEqual(png.format,'PNG')
        self.assertIn('GLOBE_IRIS_PUPIL_UV',self.b['materials'][1]['name'])
        self.assertIn('occlusionTexture',skin)
        self.assertEqual(len(self.b['scenes'][0]['nodes']),12)
        self.assertIn('eyelidFiberUpgrade',self.b['meshes'][0]['extras'])
        self.assertIn('referenceMakeup',self.b['meshes'][0]['extras'])
        for name in ('V121_UPPER_EYELINER','V121_TAPERED_UPPER_EYELASHES','V121_FINE_LOWER_EYELASHES','V121_INDIVIDUAL_EYEBROW_FIBERS'):
            self.assertIn(name,[m['name'] for m in self.b['meshes']])

    def test_v121_preview_and_v120_viewer_are_separate(self):
        html=(ROOT/'face-neutral-v121.html').read_text()
        main=(ROOT/'face-mesh-studio.html').read_text()
        old=(ROOT/'face-neutral-v120.html').read_text()
        self.assertIn("dataset.neutralFaceReady='v121'",html)
        self.assertIn("neutral-face-v121.glb",html)
        self.assertIn("face-v121-parametric-sliders.js",html)
        self.assertIn("face-v121-expression-player.js",html)
        self.assertIn("data-expression=\"loop\"",html)
        module=(ROOT/'face-v121-parametric-sliders.js').read_text()
        self.assertIn('attachV121FaceSliders',module)
        self.assertIn('V121_REFERENCE_PRESET',module)
        self.assertIn('applyReferencePreset()',module)
        self.assertIn('dataset.v121Preset',module)
        self.assertIn('state.philtrum',module)
        self.assertIn('computeVertexNormals',module)
        self.assertIn('reset()',module)
        self.assertIn("hai-gin-face-v121-bald-skin-pbr.glb",html)
        self.assertIn("face-neutral-v120.html?v=120",html)
        self.assertIn("face-neutral-v121.html?v=121",main)
        self.assertIn("face-neutral-v121.html?v=121",old)
        self.assertIn("dataset.neutralFaceReady='v120'",old)

if __name__=='__main__':unittest.main()
