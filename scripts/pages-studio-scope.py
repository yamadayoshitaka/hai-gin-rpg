#!/usr/bin/env python3
import re
import sys
PATTERN = re.compile(r"(?:body-action-studio\.html|glb-viewer\.html|equipment-studio\.html|src/(?:body-demographic-rig-v3\.js|body-motion-refinement-v4\.mjs|body-speech-v4\.js|original-body-motion-v2\.mjs|equipment-studio-(?:rig\.js|catalog\.mjs)|job-combat-motion-v5\.mjs|face-aging-v5\.js)|assets/equipment-studio/[^/]+\.glb|qa/(?:body-action-studio-smoke\.cjs|equipment-studio\.test\.mjs|job-combat-motion-v5\.test\.mjs|pages-approved-story-image-relay\.test\.py)|docs/(?:equipment-studio-v1|body-action-studio-v5)\.md|scripts/build-swordsman-equipment-v2\.mjs|scripts/prepare-pages-site\.py|scripts/pages-studio-scope\.py|\.github/workflows/publish-pages\.yml)")
def studio_only(paths):
    return bool(paths) and all(PATTERN.fullmatch(p) for p in paths)
if __name__ == "__main__":
    if len(sys.argv)>1 and sys.argv[1]=="--self-test":
        assert studio_only(["body-action-studio.html","assets/equipment-studio/chest.glb"])
        assert not studio_only(["body-action-studio.html","scripts/build-neutral-face-v121.py"])
        assert not studio_only(["src/game-core-flow.js"])
        assert not studio_only([])
        print("PASS studio scope")
    else:
        paths = [p for p in sys.stdin.read().splitlines() if p]
        print("true" if studio_only(paths) else "false")
