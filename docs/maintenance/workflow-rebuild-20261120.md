# Workflow rebuild — 2026-11-20

All previous 146 workflow definitions have been moved unchanged to `ops/legacy-workflows-20261120/` and preserved on `backup/workflows-before-rebuild-20261120`. GitHub only executes workflows under `.github/workflows`.

The active set includes 9 legacy workflows converted to manual-only plus a manual `maintenance-control.yml`. `publish-pages.yml` alone runs on main push for the single controlled game release. No automatic quality-generation, comic-generation, model self-heal or recovery triggers remain in the active workflow directory.

Manual batches must stay opt-in. All nine groups in `data/batch-center-switches.json` remain disabled. No claim that existing running Actions have been cancelled; a separate GitHub API operation is necessary for that.

Current registered creature route: m019 revision `m019-volcanic-pbr-v19-20261120`. The m019 articulated-limb regression test has a corrected toe-pivot lookup. This is source/CI alignment, not an Android screenshot approval.

Release criteria: source commit, model route, CI QA, Pages deployment and public game render must each be independently confirmed. A green Pages check can include tolerated optional QA failures.

To restore old sources, use the archive tree or backup branch. Do not automatically restore old scheduled triggers.
