# Universal Animation Library — v90 integration

Source: Quaternius, Universal Animation Library Standard (CC0 1.0).
Expected runtime asset: `assets/animations/UAL1_Standard.glb`.

The original ZIP was supplied through the user's ChatGPT Library, and inspected (43 clips in the non-root-motion GLB). This directory currently contains only the loading contract, **not the binary GLB itself**. Until the asset is uploaded, gameplay remains on the previous fallback and must not be represented as verified external animation.

**Exact file**: `Unreal-Godot/UAL1_Standard.glb` (7,618,436 bytes)
SHA-256: `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`

Verification:
- GET `./assets/animations/UAL1_Standard.glb` -> HTTP 200 and `model/gltf-binary`
- `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Sword_Attack` are present.
- On a skinned Quaternius character, the `userData.universalMotion` mixer exists, the model updates while moving, and the procedural pose controller no longer writes to the external skeleton.
- Check outfit texture, weapon placement, arm/leg positions, collision, and Android control sizes visually before approving this as a production release.

Do not upload the original ZIP under this path; the game expects the extracted GLB.
