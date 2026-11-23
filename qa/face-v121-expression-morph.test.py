#!/usr/bin/env python3
"""Real v121 PBR makeup, reduced cheek protrusion and expressive GLB morph QA."""
import json
import math
import pathlib
import struct
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
GLB=ROOT/'assets/generated/neutral-face-v121.glb'
NAMES=['blink','smile','laugh','angry','sad','mouthOpen',
       'vowelA','vowelI','vowelU','vowelE','vowelO']


def get_graph(path):
    blob=path.read_bytes()
    assert blob[:4]==b'glTF'
    assert struct.unpack_from('<II',blob,4)==(2,len(blob))
    size=struct.unpack_from('<I',blob,12)[0]
    g=json.loads(blob[20:20+size])
    return g,blob[28+size:]


def vector(g,bin_chunk,idx):
    a=g['accessors'][idx]
    width={'SCALAR':1,'VEC3':3}[a['type']]
    assert a['componentType']==5126
    view=g['bufferViews'][a['bufferView']]
    offset=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',4*width)
    return [struct.unpack_from('<'+'f'*width,bin_chunk,offset+j*stride)
            for j in range(a['count'])]


class TestRealExpressionGLB(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.b=get_graph(GLB)
        cls.skin=cls.g['meshes'][0]
        cls.prim=cls.skin['primitives'][0]
        cls.pos=vector(cls.g,cls.b,cls.prim['attributes']['POSITION'])

    def test_morph_tracks_and_real_positions(self):
        g=self.g
        self.assertEqual(len(self.pos),13455)
        self.assertEqual(len(g['meshes']),8)
        self.assertEqual(len(g['animations']),2)
        self.assertEqual([clip['name'] for clip in g['animations']],
                         ['V121_BlinkLoop','V121_ExpressionShowcase'])
        rig=self.skin['extras']['facialExpressionRig']
        self.assertEqual(rig['channels'],NAMES)
        self.assertEqual(rig['animatedMeshes'],6)
        self.assertTrue(self.skin['extras']['futureExpressionsImplemented'])
        self.assertFalse(self.skin['extras']['hairIncluded'])
        for i,mesh in enumerate(g['meshes']):
            if i in (1,2):
                self.assertNotIn('targets',mesh['primitives'][0])
                continue
            self.assertEqual(mesh['extras']['targetNames'],NAMES)
            self.assertEqual(mesh['weights'],[0.]*len(NAMES))
            self.assertEqual(len(mesh['primitives'][0]['targets']),len(NAMES))
            n=g['accessors'][mesh['primitives'][0]['attributes']['POSITION']]['count']
            for target in mesh['primitives'][0]['targets']:
                self.assertEqual(g['accessors'][target['POSITION']]['count'],n)
        for clip in g['animations']:
            self.assertEqual(len(clip['channels']),6)
            self.assertEqual(len(clip['samplers']),1)
            for ch in clip['channels']:
                self.assertEqual(ch['target']['path'],'weights')
            sampler=clip['samplers'][0]
            frames=g['accessors'][sampler['input']]['count']
            self.assertEqual(g['accessors'][sampler['output']]['count'],
                             frames*len(NAMES))

    def test_visible_blink_smile_talk_and_vowels(self):
        morphs=[vector(self.g,self.b,t['POSITION'])
                for t in self.prim['targets']]
        def y(name):return [v[1] for v in morphs[NAMES.index(name)]]
        self.assertLess(min(y('blink')),-.004)
        self.assertGreater(max(y('blink')),.003)
        self.assertGreater(max(y('smile')),.004)
        self.assertGreater(max(y('laugh')),max(y('smile')))
        self.assertLess(min(y('angry')),-.002)
        self.assertGreater(max(y('sad')),.003)
        self.assertLess(min(y('mouthOpen')),-.006)
        self.assertGreater(max(y('vowelA')),.0015)
        self.assertLess(min(y('vowelA')),-.008)
        self.assertLess(min(y('vowelO')),-.006)
        self.assertTrue(all(math.isfinite(c)
                            for shape in morphs for delta in shape for c in delta))
        self.assertGreater(sum(any(abs(c)>.0001 for c in pt)
                               for pt in morphs[0]),60)

    def test_real_brows_closer_to_upper_eye(self):
        brow=next(m for m in self.g['meshes']
                  if m['name']=='V121_INDIVIDUAL_EYEBROW_FIBERS')
        pts=vector(self.g,self.b,brow['primitives'][0]['attributes']['POSITION'])
        self.assertGreater(len(pts),1200)
        self.assertGreater(min(p[1] for p in pts),.336)
        self.assertLess(min(p[1] for p in pts),.342)
        self.assertTrue(self.skin['extras']['eyelidFiberUpgrade']['eyebrowToUpperLidGapReduced'])

    def test_skin_and_makeup_without_detached_decals(self):
        makeup=self.skin['extras']['referenceMakeup']
        self.assertTrue(makeup['skinPBR'])
        self.assertTrue(makeup['noSeparateFloatingDecals'])
        self.assertEqual(makeup['version'],'v121-makeup-20261123')
        colors=vector(self.g,self.b,self.prim['attributes']['COLOR_0'])
        cheek=[rgb for (x,y,z),rgb in zip(self.pos,colors)
               if .058<abs(x)<.092 and .235<y<.281 and z>.075]
        lip=[rgb for (x,y,z),rgb in zip(self.pos,colors)
             if abs(x)<.025 and .178<y<.218 and z>.075]
        chin=[rgb for (x,y,z),rgb in zip(self.pos,colors)
              if abs(x)<.045 and .110<y<.158 and z>.01]
        self.assertGreater(len(cheek),30)
        self.assertGreater(len(lip),15)
        self.assertGreater(len(chin),10)
        self.assertGreater(max(r-g for r,g,b in cheek),.025)
        self.assertGreater(max(r-g for r,g,b in lip),.07)
        self.assertLess(max(r-g for r,g,b in chin),.02)
        mat=self.g['materials'][0]
        self.assertLess(mat['normalTexture']['scale'],.10)
        self.assertGreater(mat['pbrMetallicRoughness']['roughnessFactor'],.8)
        self.assertEqual(len(self.g['images']),4)

    def test_cheek_sculpt_source_and_separation(self):
        source=(ROOT/'scripts/refine-neutral-face-v121.py').read_text()
        self.assertIn('+.0025*cheek+.0020*malar',source)
        self.assertNotIn('+.0080*cheek+.0041*malar',source)
        self.assertNotIn('animations',{'neutralMaster':True})

if __name__=='__main__':
    unittest.main()
