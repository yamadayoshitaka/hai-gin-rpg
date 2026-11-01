# Motion capture pipeline (40 jobs)

The registry in `job-motion-registry.json` defines every job/action pair. No action is marked recorded until a real animation file with provenance is committed.

## Source acquisition
1. Use original or explicitly licensed videos, or permissively licensed motion-capture datasets. Do not scrape copyrighted gameplay footage for redistribution.
2. Put authorized HTTPS MP4 links in `motion-sources.json` with `permission: "owner-authorized"`, `enabled: true`, and a unique `id`.
3. Run the **Import authorized motion videos** GitHub workflow. This downloads video artifacts only, **not** AI-extracted motion.

## Pose extraction
The existing `mocap-test.html` supports browser-based pose estimation from an uploaded video. This is an inspection/pose capture tool, not a trained game-specific motion model. Monocular 3D depth, occluded joints, ground contact, and equipment handling require review.

For production BVH/GLB export, run an external video-to-motion model such as ExMR in a suitable GPU environment, then retarget to the project's skeleton. Do not claim conversion is complete before an output asset exists.

## Registration
For each job and action, set `status: "recorded"` only with:
```json
{"id":"walk","status":"recorded","source":{"file":"motions/approved/walk.bvh","license":"license-id","origin":"source attribution"}}
```
Run `node tools/validate-job-motions.mjs`. Missing files, duplicate actions, and missing provenance cause validation failure. The GitHub Actions workflow runs this validation when the registry changes.

## Quality gate
Check BVH parseability, left/right orientation, ground penetration, skeleton retargeting, hands and equipment alignment, and visual behavior in `job-action-test.html`. A valid source file is not automatically a production-ready animation.

## Current limitations
No authorized MP4 links are configured; the automated video importer has no input. The 40-job registry currently records **zero** finished actions. The legacy job-action viewer still uses separate provisional CMU BVH mappings, not the registry. Integrating the registry into the runtime is a separate step. Do not delete legacy files before this is working.
