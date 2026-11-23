#!/usr/bin/env python3
"""Deployment-only relay guard: retain the 9MB v121 GLB, trim duplicate art."""
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pages_prepare',ROOT/'scripts/prepare-pages-site.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TestPagesApprovedStoryRelay(unittest.TestCase):
    def test_large_approved_webp_offloaded_by_exact_release(self):
        story=ROOT/'assets/story/chapters/c01/c01-s02-pre-male-p01.webp'
        self.assertTrue(story.is_file())
        self.assertGreater(story.stat().st_size,400000)
        self.assertTrue(module.include(story.relative_to(ROOT)))
        self.assertTrue(module.is_large_runtime_binary(story.relative_to(ROOT),story))
        self.assertIn('OFFLOADED.has(file)',(ROOT/'scripts/prepare-pages-site.py').read_text())
        self.assertIn('raw.githubusercontent.com',(ROOT/'scripts/prepare-pages-site.py').read_text())

    def test_female_v121_stays_local_even_above_binary_threshold(self):
        p=pathlib.Path('assets/generated/neutral-face-v121.glb')
        source=ROOT/p
        self.assertTrue(source.is_file())
        self.assertFalse(module.is_large_runtime_binary(p,source))
        self.assertFalse(module.is_large_runtime_binary(
            pathlib.Path('assets/generated/neutral-face-v120.glb'),
            ROOT/'assets/generated/neutral-face-v120.glb'))

    def test_staging_material_is_not_published(self):
        rejected=pathlib.Path('assets/story/chapter-drafts/c01/unapproved-native-candidates/test.webp')
        self.assertFalse(module.include(rejected))

if __name__=='__main__':
    unittest.main()
