# Character system v1 (work in progress)

The character model, skeleton profile, motion controller, equipment catalog and in-game instance are separate data entities. This folder is the source of truth for the new pipeline, not a declaration that the current game runtime already supports the schema.

- `schema-v1.json`: example instance and contracts.
- `rig-profiles.json`: explicit Quaternius base skeleton bone-name mapping. Bind rotations, axes, lengths and parent-chain compatibility are **not yet verified**.
- `equipment-catalog.json`: independent equipment definitions; contact grip and collision are **not yet implemented**.

Integration gates: validate bone names against the actual GLTF, test clip compatibility, implement contact/collision solver, then migrate game instances. Never silently map unrelated KayKit bones by name heuristics.
