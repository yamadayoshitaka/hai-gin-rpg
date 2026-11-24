# Repository agent instructions — 灰銀のレゾナンス

## Hair / wig production (mandatory)

When a task involves **creating, modifying, refitting, exporting, or deploying a character wig/hair model**, read and follow [docs/wig-production-standard-v1.md](docs/wig-production-standard-v1.md) **before** editing source, GLB assets, or the wig studio.

Mandatory workflow: **G0 reference/head measurement → G1 silhouette & topology → G2 strands/materials → G3 fitting & collisions → G4 GLB/mobile validation → G5 multi-angle visual acceptance.**

Hard rules:
- Measure the **actual current head mesh** (e.g. female v121); never substitute a generic ellipsoid or scale styles by the whole hair bounding box.
- Preserve the independent detachable wig, eyebrows, underlying face/head model, source UVs and hair texture quality.
- Do not declare a successful model solely because tests/build/deploy pass. Provide front, left, right, rear, and crown views and a working device-preview route for user evaluation.
- No simple random primitive/plane assembly in lieu of authored clump geometry. Use Blender curves/geometry and mesh-based hair clumps; add Hair Cards only where appropriate.
- Fit bob, long and ponytail separately; inspect scalp visibility, forehead/hairline, crown, ears, neck and shoulder interference.
- Record work status against gates G0–G5. If tooling, a reference GLB, Blender execution, or render/visual assessment is unavailable, report the gap and do not claim final appearance approval.
- Do not break existing deployed workflows. Only claim a merge/deploy when confirmed.

Existing project references: `src/wig-glb-fit-v1.js`, `src/v121-anatomical-hair-cap.js`, `scripts/audit-wig-glb.py`, `docs/wig-cc0-source.md`, `wig-studio.html`.

These instructions are mandatory for future AI-assisted hair/wig tasks but do not imply that automated CI can judge artistic appearance; **visual signoff remains a human decision**.
