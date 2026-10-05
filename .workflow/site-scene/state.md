---
workflow_version: 1
work_id: site-scene
route: large-feature
status: complete
phase: complete
desired_ponytail_mode: off
current_unit: null
branch: main
base_ref: 2297e4430155ab8d6a5468994d9d3ee4cbd38740
---

# Workflow

## Source Artifacts

- spec: https://github.com/TheUniqueKaz/urban-digital-twin/issues/1
- ticket: https://github.com/TheUniqueKaz/urban-digital-twin/issues/8
- domain_context: CONTEXT.md
- ADR: docs/adr/0005-site-local-stylized-visualization.md
- delivery: docs/site-scene-verification.md
- source/limitations: docs/site-scene-snapshot.md
- accepted performance: docs/site-scene-performance.json
- full-badge profile: docs/site-scene-profile.json

## Completed

- Read repository guidance, requested documents, full issues and Issues #2-#7 implementation/tests before edits.
- Captured clean working tree and fixed point; baseline frontend 29 tests passed.
- Implemented shared WGS84/ECEF/ENU metre frame, bounded OSM snapshot, single R3F renderer, camera/environment interaction and readable Sensor badges.
- Preserved observation/simulation/authentication behavior; removed Cesium only after replacement verification. No backend/schema changes.
- Final frontend 48 tests and production build passed. Backend Maven package/regression: 36 tests passed.
- Default Edge browser suite: six passed; three optional modes skipped by default and each explicitly passed (six-run benchmark, trace profile, production bundle journey).
- Verified actual geometry buffers, marker/source picking, hover highlight, no-run/failure states and Customer isolation in a real browser.
- Recorded all six final workload runs, hardware, tails, zero idle frames and stable resources across three reopen cycles. Diagnostic/pre-label-fix records retained with limitations.
- Completed separate working-tree standards/spec and minimal-complexity reviews. HEAD-based review was inapplicable without an authorized commit.
- Diff whitespace and UTF-8 checks passed; final source hash matches the snapshot record.

- Scoped review follow-up: red Library Walk Canvas repro, native Sensor-priority event filter and shared optional ADMIN setup implemented.
- Follow-up validation: 22 focused/51 complete frontend tests; production build; two default browser runs (7 passed/3 skipped each), final focused browser 2/2 and production/performance/profile independently passed on three fresh seeded databases (zero runs before/one after each).
- Teardown hang not reproduced: all browser commands exited normally and released port 5175. No speculative lifecycle fix.
- Reviewed only follow-up diff for correctness/YAGNI; no dependency, geographic, frame-loop, backend/schema or Issue #9 changes. Accepted performance artifacts retained alongside separate fresh-mode validation records.

- Remaining out-and-back finding: reproduced Library Walk Canvas mis-selection before the fix; replaced final delta with a sticky 2 CSS pixel full-gesture ref in the existing scene container. Pointer-up/cancel/capture-loss and repeated clicks verified.
- Out-and-back validation: existing focused frontend 3/3, complete frontend 51/51, focused real-browser 2/2, default browser 7 passed/3 optional skipped (28.2 seconds), production build and diff whitespace checks passed. Browser exited cleanly. Rendering workload unchanged; long benchmark not rerun.

## Current

All requested Issue #8 review findings are fixed and verified, including the subsequent out-and-back gesture finding. Native Sensor-priority dispatch and optional ADMIN test setup remain unchanged; renderer-local gesture tracking now suppresses selection after any threshold-crossing movement. See the delivery follow-up sections for red/green Canvas proof, lifecycle checks and validation results.

## Next

No automatic work. Do not commit, close Issue #8 or start Issue #9 without a new user request.

## Blockers

None. Known source omissions, approximate dimensions, bundle warning and isolated frame stalls are recorded in the delivery document.

## Resume Instructions

This scoped workflow is complete. Inspect the delivery report and current working tree for any requested follow-up; preserve the captured fixed point and user constraints.
