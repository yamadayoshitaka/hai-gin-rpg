# 2026-11-14 approved humanoid summon concepts and combat gestures

This is the implementation contract for the approved four 2D character/action
concept sheets in the ChatGPT discussion of 2026-11-14: female Dragon King,
Forest Spirit, Angel, and six-panel monster attack/magic animation reference.
The drawings are **reference art**, not game-ready GLB meshes. The production
preview still uses the existing fully-skinned Superhero female donor while the
new studio body is separately audited.

## Dragon Lord — female humanoid

- **Approved design supersedes the earlier bald-scaled-head variant**: plum
  long coiffed hair, swept paired horn bases, intact native face and eyes,
  black/gold draconic regalia.
- Scalp now uses the existing local-head **wig** fit and reversible source
  crown mask; it must not display an opaque synthetic cap over the hairstyle.
- Eye surfaces remain the native skinned model. No duplicate yellow almond
  eyes (which became flat yellow dots in the screenshot), duplicate nose tube,
  or large free-floating whisker ornaments.
- Fit horn roots to sampled source skull width/height and attach on head bone.
  Keep wing roots at upper chest, tail at pelvis, fitted clothing at each limb.
- Verify close front, side, three-quarter and above-head views in Android.
  A generator screenshot alone is not proof of source-GLB fidelity.

## Forest Spirit vs Angel — two deliberately different species

| Design channel | Forest Spirit | Angel |
| --- | --- | --- |
| Head | Living wood antlers, secondary branches, flower buds | Sacred halo |
| Back | Leaf and moss mantle, **no feather wings** | Original 3-layer / 82 feather per side Guardian wings |
| Clothing | Woven leaves and blossoms, earthy green | Ivory and gold celestial robes |
| Magic | Green living energy, growth/recovery | Gold-white light protection |
| Motion | Grounded casting gesture | Original airborne hovering and articulated feathered wings |

The angel's original wing sculpt and flight code are protected by existing
regression tests; **never** substitute flat leaf strips for feathered wings.

## Combat gesture / magic motion contract

The approved sheet has six visual beats: close slash, rushing strike,
projectile, spell preparation, spell release, and hit recovery.

Current production adaptation is limited to:
1. Native GLB attack clip plus short additive strike emphasis, with a
   bone-attached attack accent.
2. 'special' action uses the native idle clip as the stable base. An
   **instance-local** two-arm spellcasting gesture runs in three temporal
   phases: anticipation (0–32%), release (32–72%), and recovery (72–100%).
3. Reusable hand-attached spell meshes tint by forest / angel / dragon.
   They allocate no per-frame geometry and are disposed when the actor unloads.
4. Native run, dodge, hit, death and existing bestiary fallback continue
   unchanged. Existing gallery spell VFX remain.

This does **not** yet add a new binary animation file, a full dedicated
missile-path animation for every monster species, or a new combat AI skill.
Those require later rig-specific animation production and battle E2E.

## Validation and safety

- Scope: female summons 3 plus existing humanlike monster adaptation.
- No changes to nonhuman 34, pending beast PR #345/#346, shared GLB,
  shared hero/NPC/army skeleton, or monetary APIs.
- Regression: humanoid costumes, 3 summon forms, source scalp restoration,
  mobile preview, original angel wing/flight, and per-instance magic gesture.
- Gate: all relevant CI + browser visual and Android display check before
  making any claim that the full 2D design is reproduced by live 3D.
