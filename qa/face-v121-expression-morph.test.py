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
    width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
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
        self.assertEqual(len(g['meshes']),12)
        self.assertEqual(len(g['animations']),2)
        self.assertEqual([clip['name'] for clip in g['animations']],
                         ['V121_BlinkLoop','V121_ExpressionShowcase'])
        rig=self.skin['extras']['facialExpressionRig']
        self.assertEqual(rig['channels'],NAMES)
        self.assertEqual(rig['animatedMeshes'],10)
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
            self.assertEqual(len(clip['channels']),10)
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
        self.assertGreater(max(y('smile')),.0036)
        # Laughter opens the lower lip rather than lifting the whole chin.
        self.assertLess(min(y('laugh')),min(y('smile'))-.004)
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

    def test_real_mouth_opening_and_stable_chin(self):
        g=self.g
        expected=['V121_ORAL_CAVITY','V121_ORAL_UPPER_TEETH','V121_ORAL_TONGUE']
        self.assertEqual(self.skin['extras']['facialExpressionRig']['oralCavityMeshNames'],expected)
        self.assertTrue(self.skin['extras']['facialExpressionRig']['oralPartsInSkinLocalSpace'])
        skin_node=next(n for n in g['nodes'] if n.get('mesh')==0)
        for name in expected:
            oral_node=next(n for n in g['nodes'] if n.get('name')==name)
            for transform in ('translation','rotation','scale','matrix'):
                self.assertEqual(oral_node.get(transform),skin_node.get(transform),
                                 name+' must share the actual transformed face origin')
        for name in expected:
            mesh=next(m for m in g['meshes'] if m['name']==name)
            self.assertEqual(len(mesh['primitives'][0]['targets']),11)
            self.assertTrue(mesh['extras']['v121OralPart'])
            original=vector(g,self.b,mesh['primitives'][0]['attributes']['POSITION'])
            def extent(morph):
                d=vector(g,self.b,mesh['primitives'][0]['targets'][NAMES.index(morph)]['POSITION'])
                return [(p[0]+v[0],p[1]+v[1],p[2]+v[2]) for p,v in zip(original,d)]
            a=extent('vowelA')
            i=extent('vowelI')
            u=extent('vowelU')
            mouth=extent('mouthOpen')
            if name==expected[0]:
                h=lambda v:max(t[1] for t in v)-min(t[1] for t in v)
                w=lambda v:max(t[0] for t in v)-min(t[0] for t in v)
                self.assertGreater(h(a),.019)
                self.assertGreater(h(mouth),.016)
                self.assertLess(h(i),.015)
                self.assertLess(w(u),w(i)*.60)
                # Outer rim conforms to the local curved lip rather than moving
        # every corner in front of the *highest* central lip position.
        center_front=max(t[2] for t in a)
        self.assertGreater(center_front,max(t[2] for t in original)+.001)
        # Mouth opening must not pull the chin down: vertex region below lip.
        shape=vector(g,self.b,self.prim['targets'][NAMES.index('vowelA')]['POSITION'])
        chin=[abs(q[1]) for p,q in zip(self.pos,shape)
              if p[1]<.160 and abs(p[0])<.075]
        self.assertLess(max(chin),.0007)
        # Verify the actual v121 skin morph, not just the separate
        # oral-cavity mesh or a UI label.
        for expression in ('mouthOpen','vowelA','vowelO'):
            delta=vector(g,self.b,self.prim['targets'][NAMES.index(expression)]['POSITION'])
            chin_stretch=[abs(d[1]) for p,d in zip(self.pos,delta)
                          if p[1]<.160 and abs(p[0])<.075]
            self.assertLess(max(chin_stretch),.0007,expression)
            recess=[d[2] for p,d in zip(self.pos,delta)
                    if abs(p[0])<.020 and .228<p[1]<.236 and p[2]>.120]
            self.assertGreater(len(recess),0,expression)
            self.assertLess(min(recess),-.006,expression)
        opened=vector(g,self.b,self.prim['targets'][NAMES.index('mouthOpen')]['POSITION'])
        upper=[d[1] for p,d in zip(self.pos,opened)
               if abs(p[0])<.025 and .236<p[1]<.245 and p[2]>.120]
        lower=[d[1] for p,d in zip(self.pos,opened)
               if abs(p[0])<.025 and .218<p[1]<.228 and p[2]>.120]
        self.assertGreater(len(upper),0)
        self.assertGreater(len(lower),0)
        self.assertGreater(max(upper),.002)
        self.assertLess(min(lower),-.006)
        self.assertTrue(self.skin['extras']['facialExpressionRig']['skinMouthCenterInwardOnOpening'])
        self.assertIn('real_aperture',
                      self.skin['extras']['facialExpressionRig']['mouthShapeVersion'])

    def test_real_mouth_aperture_and_sagittal_chin_clearance(self):
        profile=self.skin['extras']['sagittalChinProfile']
        self.assertEqual(profile['version'],'female-v121-sagittal-guard-20261123')
        self.assertLessEqual(profile['chinAfterZ'],
                             profile['lipFrontZ']-.0164)
        self.assertLessEqual(profile['chinAfterZ'],profile['chinBeforeZ'])
        lip=[z for x,y,z in self.pos
             if abs(x)<.042 and .217<y<.249]
        uv=vector(self.g,self.b,self.prim['attributes']['TEXCOORD_0'])
        # Do not mistake the still-protruding lower vermilion at y≈.202
        # for the anatomical menton. The newly rebuilt chin is the
        # separate native UV band extending into the submental region.
        chin=[z for (x,y,z),(u,v) in zip(self.pos,uv)
              if abs(u-.5)<.09 and .418<v<.490]
        self.assertGreater(len(lip),12)
        self.assertGreater(len(chin),12)
        self.assertGreater(max(lip)-max(chin),.0163)
        aperture=self.skin['extras']['facialExpressionRig']['splitMouthSeal']
        self.assertTrue(aperture['openingFromRealTopology'])
        self.assertTrue(aperture['noChinOrNeckTrianglesDetached'])
        self.assertGreaterEqual(aperture['detachedSkinTriangles'],8)
        self.assertGreaterEqual(aperture['sealVertices'],10)
        skin_idx=self.g['accessors'][self.prim['indices']]
        self.assertEqual(skin_idx['count'],25920*3)
        # Removed triangles are degenerate, retained only for fixed index
        # buffer length; a second primitive has the exact neutral skin patch.
        index_view=self.g['bufferViews'][skin_idx['bufferView']]
        offset=index_view.get('byteOffset',0)+skin_idx.get('byteOffset',0)
        count=skin_idx['count']
        raw=struct.unpack_from('<'+'I'*count,self.b,offset)
        degenerate=sum(raw[i]==raw[i+1]==raw[i+2]
                       for i in range(0,count,3))
        self.assertGreaterEqual(degenerate,aperture['detachedSkinTriangles'])
        cavity=next(m for m in self.g['meshes']
                    if m['name']=='V121_ORAL_CAVITY')
        self.assertEqual(len(cavity['primitives']),2)
        seal=cavity['primitives'][1]
        self.assertEqual(seal['material'],self.prim['material'])
        for att in ('POSITION','NORMAL','TEXCOORD_0','COLOR_0'):
            self.assertIn(att,seal['attributes'])
        self.assertEqual(len(seal['targets']),11)
        pos=vector(self.g,self.b,seal['attributes']['POSITION'])
        mouth_delta=vector(self.g,self.b,seal['targets'][NAMES.index('mouthOpen')]['POSITION'])
        self.assertLess(min(v[2] for v in mouth_delta),-.016)
        self.assertTrue(all(.230<v[1]<.235 and abs(v[0])<.037 for v in pos))

    def test_real_brows_closer_to_upper_eye(self):
        brow=next(m for m in self.g['meshes']
                  if m['name']=='V121_INDIVIDUAL_EYEBROW_FIBERS')
        pts=vector(self.g,self.b,brow['primitives'][0]['attributes']['POSITION'])
        self.assertGreater(len(pts),1200)
        self.assertGreater(min(p[1] for p in pts),.328)
        self.assertLess(min(p[1] for p in pts),.334)
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
             if abs(x)<.025 and .216<y<.249 and z>.075]
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
