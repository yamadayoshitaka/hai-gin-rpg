# Hero Studio v42 — Male/Female independent scenes, layered hair and job motion QA

## Contract
- Female and male face presets use different browser storage keys and editable mesh instances; no change to the library v8 female source preset.
- Male appearance is loaded from the CC0 male body and the male 65-bone motion/outfit rig; female remains female. Face and outfit previews are gender-scoped.
- On static previews, the wig uses **no cloned transparent head/base**. Root follicles use a real sculpted scalp; the original strand guide mesh is duplicated along vertex normal offsets with three layers, and cap/strands/fibres become one renderable Mesh (multi-material groups).
- Hair GLB export contains only authored hair geometry, not cloned transparent head. Physics remains disabled for static studios.
- Eye sockets remain anatomical: large visible irises while eyeballs stay slightly behind eyelid/eyeliner, and no protruding sphere. Female cheek volume is softened; lips/lip pigment remain attached to source face triangles.
- Ordinary armor, buckles, rivets and cloth are bone-mounted/fitted. Intentionally floating magic ornamentation is only accepted where the summoner-specific source explicitly says so. Do not hide entire arms, chest, thigh or foot anatomy.
- Each of 10 jobs renders action buttons only from `job-command-motion-map.json` rows with available=true, command, asset and clip. Selecting a command calls real playCommand and reports the playing clip; unavailable actions never render clickable buttons.
- Never change the real battle renderer while tuning preview-specific beauty or size.

## Regression acceptance
1. Male and female settings remain separate across refresh and navigation; male scene does not load female body.
2. Preview haircut contains exactly one static wig Mesh; no DETACHABLE_WIG_TRANSPARENT_HEAD_BASE and no geometry cloning of face/head into the wig.
3. Camera front/side/crown reveals no scalp baldness or strands crossing eyes/face.
4. Female eye iris remains prominent without crossing the eyeliner plane. Facial cheeks, lipstick and natural mouth silhouette visually compared front + side.
5. Armor remains fitted when idle, running, attacking and casting. Summoner floating exceptions only, never arbitrary rivets.
6. All 10 job selections populate job-specific action buttons from the motion map. Each button actually plays an available clip.
7. GLB exports, mobile frame budget, collision and battle baseline remain stable. Visual QA is required beyond passing unit tests.

## Deployment
Review PR + checks before merge. GitHub Pages publication must be verified separately; file commit alone is **not** proof of deployment.
