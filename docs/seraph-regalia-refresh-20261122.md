# Seraph Guardian: ivory ceremonial regalia v3

Reference: user's approved 2026-11-22 image (celestial white/gold dress,
layered brocade with central embroidered tabard, draped split sleeves,
long structured dark leather boots, wings/halo unchanged).

### What previously went wrong
- \`ivoryCloth\` used \`bandage\`, which mapped to an oversized brown linen
  photograph, hence the screenshot's conspicuous burlap texture.
- The old generic boot was an enlarged sphere ending in a black rim; the
  photo-leather diffuse made it look like chocolate.
- Donor clothes with very dark embedded albedo peeked through the gown.

### Actual 3D implementation
- New \`src/seraph-ceremonial-regalia.js\`: independent joint-anchored chest
  bodice, collar, shoulder closure, 3 overlapping silk skirt panels, smooth
  inner dress, a tapered front embroidered brocade tabard, fine physical
  gold seam geometry, shoulder/sleeve drapes, leather shin shell and toe box,
  flat outsoles, small buckles and foot stitching. Preserves imported rig.
- New \`src/seraph-ceremonial-material.js\`: pearly ivory/gold materials with
  tiny local PBR normal/roughness and optional real CC0 
  [Poly Haven Crepe Satin](https://polyhaven.com/a/crepe_satin) PBR normal
  and roughness maps. Uses neither the tan diffuse nor the coarse source linen.
  Remote load failure leaves local PBR fallback.
- \`src/summon-footwear-pbr.js\`: for the Seraph only, use real CC0
  [Fabric Leather 01](https://polyhaven.com/a/fabric_leather_01)
  normal/roughness without its old chestnut albedo. Neutral dark-taupe
  dye and matte metalness 0 prevent candy/chocolate highlights.
  Non-Seraph forms continue using their original photo-leather source.
- \`src/monster-cosplay-pigmentation.js\`: remove the dark donor garment
  albedo only on **cloned** Seraph cloth materials, not human skin/eyes/hair.
- \`src/female-summon-costumes.js\`: canonical original feathered wings and
  animation remain. Halo/forearm bracers use antique gold, cape uses muted
  charcoal silk instead of purple velvet.
- Existing 3D outfits of other creatures remain on the old path. Combat and
  movement logic is unchanged.
- This is a geometry/material implementation, **not** an illustration,
  texture painted into the reference image, or a replacement GLB download.

### QA gate
- \`node --check\` both new modules and existing cosplay adapter
- \`node --test qa/seraph-ceremonial-regalia.test.mjs\`
- \`node --test qa/summon-leather-boots.test.mjs\`
- Existing gallery walking + spell/playwright flow
- Manual mobile: inspect Seraph, female form, idle/walk/run at front,
  side, rear. Check that wings stay feathered, face is visible, dress is
  pale and has no giant burlap check pattern, boots are slim/matte with
  stitched toe panels, and the donor skin does not tear open at hip/knee.
  Also inspect Forest Archer and Dragonkin to avoid material bleed.

### Notes and limits
The result is an articulated Three.js geometry approximation of the target
image, not a direct reconstruction of the illustration. Source donor GLB,
rig proportions and existing motion controls constrain tailoring. Any skin
piercing at large animation extremes should be fixed in a separate
topology/skin-weight pass, not concealed by painting over screenshots.
