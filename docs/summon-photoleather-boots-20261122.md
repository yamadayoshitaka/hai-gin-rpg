# Summon leather boots — 2026-11-22

The gallery's **Forest Spirit Archer** used the wardrobe's \`leggings: 'leaf'\`
for both thigh coverings **and boots**. That painted the shin and foot green,
even though the skirt/leaves need to remain green. The Seraph and Dragonkin
costumes used the same inherited material problem in other colours.

## Applied material scope

- \`forest_spirit_female\`: keep green leaf thighs, use warm leather boots.
- \`seraph_female\`: preserve pale cloth and gold edges, use softer pale leather boots.
- \`dragonkin_female\`, \`dragonkin_male\`: preserve plated leggings and
  scale/wing surfaces, use dark dyed leather boots.
- Other nonhuman summons (wolves, dragon, kraken, insect, etc.) keep their
  **species-specific** maps; no leather is applied to claws, wings or scales.
- All footwear geometry stays on the *calf/foot bones* to survive walk,
  run, attack and summon motions. A separate inset outsole and cuff give
  distinct toe and leather-shaft detail.

## Sources and fallback

Photographic albedo, OpenGL normal and roughness use the 1K CC0
[Poly Haven Fabric Leather 01](https://polyhaven.com/a/fabric_leather_01).
The new shared loader only starts for near/high-detail boot materials,
and only swaps a map in **after a successful download**. The local repository
photo \`assets/textures/outfits/leather.jpg\` remains the fallback when
the player has no network connection or third-party CORS blocks a request.
This is an optional remote upgrade, **not** a new bundled texture asset.
No changes are made to the original GLBs or canonical source skin materials.

The photo is publicly licensed CC0 by Poly Haven; unlike the previously
bundled outfit photos, this source has confirmed reuse permission.
See \`src/summon-footwear-pbr.js\` for exact source and 1K map URLs.

## Verification

- \`node --test qa/summon-leather-boots.test.mjs\` (requires npm Three.js).
- \`node --check src/summon-footwear-pbr.js\`
- \`node --check src/monster-character-cosplay.js\`
- \`node --check src/monster-regal-garments.js\`
- On \`summon-showcase.html\`, switch to Forest Spirit Archer -> female form,
  select **Foot/Equipment**, and inspect front/side/back.
  Check walk/run and that forest leaves stay green while leather boots remain brown.
- Inspect Seraph and Dragonkin female/male forms: boots must not overwrite
  wings, heads, scales or weapons. Check mobile low LOD/offline view still shows
  a boot with local photo texture.
- Follow up with real mobile rendering before claiming final visual QA.

## Known limit

The downloaded PBR maps affect **surface** realism; they do not fix
misaligned rig joints, insufficient boot topology or green donor garments
that are baked into a source GLB's single skinning atlas. Such issues need
separate mesh/UV changes and front/side/back screenshots.
