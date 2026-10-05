# Issue #8 delivery verification

Validated on 2026-10-05. Parent [Issue #1](https://github.com/TheUniqueKaz/urban-digital-twin/issues/1), [Issue #8](https://github.com/TheUniqueKaz/urban-digital-twin/issues/8), and accepted ADR 0005 define the scope. No commit, issue closure, or Issue #9 work is part of this delivery.

## Implementation and changed files

- `frontend/src/digital-twin/SiteScene.tsx`: one R3F Canvas, native Three OrbitControls, boundary-derived orthographic framing, pan/zoom/orbit/reset, projected React-owned Sensor labels/badges with screen-space collision placement and marker leader lines, quality switch, optional-context status and object information.

- `geography.ts`: renderer-independent API types and shared metre frame. `environment.ts`: bounded public asset loading/validation, footprint shapes with holes, simple road widths/triangles. `SceneEnvironment.tsx`: source-backed extrusions and roads, four spatial sectors, merged static geometry, shared materials, instanced reusable trees, hover/selection highlights. `SceneProbe.tsx`: development-only diagnostics and repeatable camera workload, removed by production dead-code elimination.

- `DigitalTwinPage.tsx`, `simulation/SimulationPanel.tsx`, and `simulation/ObservationExplorer.tsx`: geographic type imports only. Measurement selection, Parameter capabilities, latest-run retrieval, generation, timezones, legends and provenance logic are unchanged.

- `frontend/public/geography/innovation-campus.json`: the frozen public OSM context described in [snapshot documentation](./site-scene-snapshot.md).

- `frontend/src/styles.css`: scene, toolbar, readable stacked buttons, attribution, context panel and development benchmark viewport.

- `frontend/src/App.test.tsx`: retain all 29 existing rendered application tests; execute the real SiteScene DOM, mocking only Canvas and geographic loading. Renderer-specific assertions now check the geographic input contract. `geography.test.ts` and `environment.test.ts` add independent coordinate/holes/metre and asset checks.

- `frontend/browser-tests/`, `playwright.config.ts`, package scripts: real Edge browser journey, actual pointer/camera checks, controlled asset/no-run failures, authorization, six-run benchmark and optional trace profile.

- `package.json`, `package-lock.json`, `vite.config.ts`: add R3F 9.8.1 and Three 0.186.1; dev-only Three types 0.186.0 and Playwright 1.63.0. Remove Cesium, vite-plugin-cesium and the unused drei dependency after replacement tests and the six-run benchmark passed. No Cesium runtime imports, widget CSS, build plugin, copied runtime assets or lockfile packages remain.

- README/design/scope documentation, this report, snapshot/performance/profile/load records and scene screenshot, `.gitignore` and `.workflow/site-scene/state.md` document the delivery and reproducible verification.

## Preserved behavior and browser verification

The actual seeded API boundary and all six Virtual Sensor positions use the same conversion; the browser checks scene positions against the authorized response and verifies boundary corners fit the orthographic view. Pointer gestures change orbit/zoom/pan, enforce polar limits and restore the initial Site camera on reset. All source footprint vertices and main-road center points were checked against actual uploaded browser buffers within Float32 rounding. Actual marker ray picking opens the existing Sensor dialog; source-backed roof picking opens approximate/unavailable context. Sensor buttons and badge buttons also open the existing observation dialog. The accessible Sensor list remains available.

All four Parameter toggles, the Central Court's four stacked badges, other Sensors' capability subsets, canonical units, visible SIMULATED labels, parameter legends and Site-timezone persisted timestamps remain intact. An ADMIN browser action creates a real run through the existing API; timeline movement changes values without additional Measurement/geographic requests or replacing the mounted environment. No-run responses show boundary/Sensors/context, a clear empty message, and role-appropriate generation controls. Browser no-run cases control the latest-run HTTP response for repeatability; the backend integration suite also verifies actual persisted no-run behavior. Optional snapshot HTTP failure retains Sensor selection and observation exploration. Parse/network errors and null/malformed optional records receive an unavailable-context message rather than raw parser details. Browser direct navigation to another Customer renders no protected scene; an invalid token clears the session and returns to login.

The initial HTML helper lost a label during React StrictMode mounting in a real browser. It was removed; labels now belong to the existing React DOM root, and camera projection updates their transforms without frame-by-frame React state. Camera controls use native Three.js. This removed an unnecessary dependency and its transitive packages. Final visual inspection exposed stacked label overlap; a local six-label placement loop reads dimensions before writing transforms and leader-line endpoints. It changes only screen-space annotation positions, with no geometry changes or React state per frame. The browser test now asserts non-overlapping full-badge labels at reset.

## Reference hardware and frozen workload

- CPU: AMD Ryzen 5 5600H. RAM: 7,897,944,064 bytes (about 7.36 GiB usable).

- OS: Windows 11 Home Single Language, 10.0.26300.

- Browser: Microsoft Edge 154.0.4258.53, automated headless Chromium with hardware WebGL.

- Actual WebGL renderer: ANGLE / AMD Radeon(TM) Graphics, Direct3D11 (0x1638). The installed GTX 1650 was **not** the renderer used for these runs. AMD driver 27.20.14032.15001; NVIDIA driver 32.0.15.9636.

- Viewport: 1920×1080 CSS pixels. Device ratio 1.5. Normal DPR capped at 1.5 (2880×1620 drawing buffer); reduced DPR 1 (1920×1080).

- Full frozen snapshot: 441 footprints, 146 main-road segments, coverage and SHA-256 in the snapshot document.

- Six API Virtual Sensors, all four toggles, maximum 12 supported badges; unsupported Parameters are never invented. 1,000 reusable tree instances (2,000 trunk/canopy instances) exercise instancing. Production uses 24 trees.

- Warm workload: 24 draw calls, 48,400 triangles, 18 uploaded geometries, 1 renderer-reported texture. There are no image textures, GLB downloads or texture asset transfers; the renderer's internal texture count is recorded rather than represented as an external asset.

- Geographic asset: 140,546 bytes raw; 28,579 bytes if gzip-compressed. Development responses transferred the raw asset. Production JS/CSS sizes are recorded below. There are no runtime geographic-provider requests.

- Lighting: ambient + one directional light, rough shared palette; no dynamic shadows, terrain, post-processing, physics or streaming infrastructure. Demand rendering is used when idle.

## Measurement procedure and results

`SceneProbe` warms four seconds, then follows the same 60-second camera path using elapsed monotonic time: constrained sinusoidal orbit (azimuth ±0.6 rad; polar 0.8±0.15 rad), pan ±0.1 Site radius, and orthographic zoom ±15%. Each run starts from Reset to Site. Three normal and three reduced runs use the same snapshot, Sensors, badge selection and instancing workload. Frame intervals are measured during active camera movement; median FPS is 1,000 divided by median frame interval. These are browser frame-cadence measurements, not GPU timestamp queries or a promise for other hardware.

Accepted full-badge measurements: [site-scene-performance.json](./site-scene-performance.json). The [initial diagnostic record](./site-scene-performance-initial.json) is retained with its missing badge-count assertion explicitly labeled; it is not the acceptance workload.

| Run | Median FPS | p95 ms | Worst ms | >50 ms | >100 ms | Frames >33.3 ms | Min full-second FPS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normal 1 | 76.34 | 20.20 | 104.50 | 2 | 1 | 7 | 45 |
| Normal 2 | 71.94 | 20.50 | 52.60 | 1 | 0 | 3 | 51 |
| Normal 3 | 69.93 | 23.50 | 57.50 | 1 | 0 | 12 | 41 |
| Reduced 1 | 140.85 | 12.00 | 61.70 | 1 | 0 | 2 | 85 |
| Reduced 2 | 140.85 | 12.80 | 37.60 | 0 | 0 | 2 | 79 |
| Reduced 3 | 140.85 | 14.20 | 234.40 | 2 | 2 | 11 | 39 |

Median of the three run medians: normal **71.94 FPS**, reduced **140.85 FPS**. Median p95 frame time: normal 20.5 ms, reduced 12.8 ms. Normal-quality medians exceed the approximate 60 FPS target; full-second cadence can be lower, as the table shows. Reduced quality remains above 30 FPS in every complete one-second bin (minimum 39 FPS); this does not mean every individual frame finishes within 33.3 ms. All slow-frame sequences contain only one slow interval, with the worst 234.4 ms interval explicitly retained. No runs or tails are discarded. Trace profiling is described below.

Cold browser journey to the warmed-ready workload: 2,546 ms, including sign-in, Customer/Site navigation and reopening the benchmark view; this is **not** an isolated asset-download timing or production cold-start claim. A separate scene-mount timing and geometry check is recorded in [site-scene-load.json](./site-scene-load.json); it uses cached application modules after login and a new snapshot request, not a production cold-start claim. The final collector records interval tails, longest slow-frame sequences and minimum complete one-second FPS.

Idle check: **zero frames in two seconds** after movement stopped. Three navigation/unmount/reopen cycles removed Canvas and the probe on exit and each restored exactly one Canvas, 18 uploaded geometries and one internal texture. Geographic input was loaded once per real scene mount (five completed responses across the initial journeys/reopen cycles), with no requests during the six movement runs or observation changes. StrictMode may abort the first mount's initial fetch in development; completed asset responses and timeline-triggered requests are distinguished.

## Profiling, final checks and limits

All 48 frontend tests pass (29 preserved application tests, nine coordinate/geometry cases and ten geographic-asset cases). All six default real Edge browser behavior tests pass (three optional modes skipped by default); the six-run performance/idle/navigation collector, full-badge trace and production journey each pass when explicitly enabled. The frontend production build passed: JavaScript 1,181.65 kB minified / 323.78 kB gzip, CSS 2.23 kB / 0.86 kB gzip. Vite reports a chunk above 500 kB; the warning is retained. There are no Cesium assets or development probe strings in the production output.

The backend regression/package validation passed 36 tests in an isolated PostgreSQL/PostGIS database using the unchanged Docker image and `mvn package`. Authentication, Customer isolation/navigation, Site/Sensor geometry, simulation and application smoke behavior passed. An independent test database and browser backend on port 8081 avoided changing the pre-existing Issue #7 database/service on port 8080.

The final instrumented [full-badge trace](./site-scene-profile.json) confirms 12 badges and measures 123.46 FPS median, 13.8 ms p95, 69.3 ms worst interval, minimum full-second cadence 77 FPS, and one isolated >50 ms interval. Animation callbacks average 1.69 ms and peak at 11.91 ms; paint events peak at 4.99 ms, layout-tree updates at 2.67 ms, layout at 1.25 ms, and minor GC at 15.05 ms. Nested trace totals are not additive. This trace does not reproduce the 234.4 ms tail in the accepted benchmark, so that stall's cause remains unconfirmed. Lower DPR materially improves cadence, which suggests pixel/rendering workload contributes to normal-quality cost; this is an inference, not a GPU timestamp measurement. No speculative rendering infrastructure was added to address an unproven cause.

The production bundle also passes a real Edge browser journey: six Sensors, all 12 supported badges, non-overlapping labels, and the existing four-Parameter detail dialog work with development diagnostics absent. The default browser suite additionally checks actual environment hover highlighting before source selection. `git diff --check` passes. No backend files are modified. Runtime source/package searches find no Cesium or drei; production output also contains no development probe strings.

No backend, schema, migration, API, authorization or simulation changes have been made. The source snapshot's omissions, uniform approximate heights, road widths and illustrative tree placement are intentional limits, not claims of surveyed truth. Geographic origin/axes/metre tests compare against PROJ to 1 mm, including approximately 7.8 km distance; this numeric tolerance does not claim OSM positional or elevation accuracy.

Complexity review removes the unused helper dependency, retains the native coordinate/geometry/control primitives, and limits batching to four sectors. Picking uses a small linear face-range lookup; there is no octree, renderer registry, scene service, state framework or generic ingestion/streaming pipeline. A HEAD-based code-review would see no uncommitted work, so correctness/spec review uses the working tree against the captured fixed point instead of making a review-only commit.

Runtime documentation consulted: [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas), [Three OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Three Shape](https://threejs.org/docs/pages/Shape.html). Source licensing/coverage is documented separately.

## Reproduction

Install locked frontend dependencies with `npm ci`. Run `npm test`, `npm run build`, and `npm run test:browser`. Browser tests use installed Microsoft Edge, a 1920×1080 viewport and an isolated seeded backend at `http://127.0.0.1:8081`; `playwright.config.ts` starts Vite on port 5175 with that API proxy. Set `VITE_API_PROXY_TARGET` to select another isolated test backend when needed; the default remains port 8081. The browser generation test writes a Simulation Run in that isolated database; do not point it at customer production data.

From frontend PowerShell, run the optional workload with `$env:RUN_SCENE_BENCHMARK='1'; npm run test:browser -- performance.spec.ts` and the optional trace with `$env:RUN_SCENE_PROFILE='1'; npm run test:browser -- profile.spec.ts`. Explicit tests wait for all four controls and assert 12 supported badges before measuring. The benchmark uses the development-only `?sceneBenchmark=1` page. Copy the generated `test-results/performance.json` when intentionally updating the durable record; ordinary browser tests do not silently overwrite it. The trace records event timing summaries only. Run the built production check with `$env:RUN_SCENE_PRODUCTION='1'; npm run test:browser -- production.spec.ts` after `npm run build`; its server uses Vite preview. Optional modes are skipped in the default browser suite and were each run explicitly during delivery. Each optional spec now calls the shared `createSimulationRun(request)` helper: authenticate as ADMIN, POST the normal scoped generation endpoint, then sign in as CUSTOMER and assert that exact run is loaded with no generation action. This requires only a fresh seeded isolated database and is safe to repeat there; every invocation creates a new immutable deterministic run, without depending on another spec or manual preparation.

The existing README Docker build/package workflow remains valid. This session used the existing PostGIS service with an additional isolated database because ports 5432/8080 already belonged to the Issue #7 validation stack. Backend source and image behavior were unchanged; Maven package ran against the isolated database rather than skipping integration tests.

The [first full-badge movement record](./site-scene-performance-retry.json) retains six completed runs from before the label-placement fix, including the 219.9 ms normal-quality stall. Its subsequent cleanup check raced probe readiness; the collector now waits for uploaded geometry and persists each run immediately. Final measurements use the visually verified label placement.

## Acceptance and review outcome

The desktop Issue #8 slice is implemented and verified against the parent specification and ADR 0005. The initial working-tree standards and correctness/spec review did not detect the foreground Sensor/environment raycast overlap. The Issue #8 review follow-up below reproduces and corrects that missed case. The separate minimal-complexity review retains only the shared coordinate frame, local renderer components, native Three controls, four static batches and small annotation placement needed by observed badge overlap. The unused helper dependency was removed. There is no renderer registry, plugin layer, GIS engine, backend building model, scene service, new global state framework, physics or streaming infrastructure.

Remaining limitations: the OSM coverage/omissions and illustrative dimensions described in the snapshot document; an unsplit production JS chunk that triggers Vite's 500 kB warning; isolated measured frame stalls whose cause the trace did not reproduce; and performance measured in hardware-backed headless Edge rather than a physical display refresh test. The recorded reduced workload maintains the 30 FPS floor in complete one-second bins, while individual slow frames are reported explicitly. These are recorded limits rather than fabricated guarantees. Mobile/tablet, terrain and district navigation are outside this ticket. No functional acceptance blocker remains. No commit was made, Issue #8 remains open, and Issue #9 was not started.


## Issue #8 review follow-up (2026-10-05)

Scope is limited to foreground Sensor picking and independent optional browser prerequisites. No dependencies, geographic geometry, rendering workload, backend/schema, observation logic or application authorization behavior changed.

The Library Walk regression was run before the fix and failed through actual Canvas mouse dispatch: `way/802105049` received the nearer geometric intersection and selected its environment panel. The marker's `renderOrder`/disabled depth test makes it visually foreground but does not change raycast distance order. The fix uses the native [R3F event filter](https://r3f.docs.pmnd.rs/api/events), before event delivery: when the ray intersects a tagged foreground Sensor marker, retain Sensor intersections in native distance order and omit environment intersections for that interaction. With no Sensor hit, preserve the original intersections unchanged. A Sensor hover handler also includes the markers in pointer-move raycasts, so underlying environment hover is not activated through a marker. The first fix used R3F's final two-pixel click delta. A later review identified an out-and-back gesture that bypassed it; the gesture follow-up below replaces that guard with sticky full-gesture movement tracking. Environment callbacks and geometry remain unchanged; no interaction service or registry was introduced.

The regression resets the deterministic camera, resolves Library Walk and North Gate from authorized API data, projects the actual marker mesh, asserts that the screen point targets CANVAS, and dispatches mouse input. It asserts Sensor observation dialogs open, the environment panel and `way/802105049` selection remain absent, and underlying source hover is absent. Actual orbit and right-button pan gestures begin on each marker and change the camera without opening a dialog. The retained environment-only roof test proves native hover highlighting and selection, with no Sensor dialog. Geographic buffers, Site boundary, badges, timeline, no-run/failure behavior, canonical units, SIMULATED observations and authorization regressions remain covered by the default browser suite and existing rendered tests.

Validation: focused coordinate/environment/picking unit tests 22/22; complete frontend suite 51/51; production build successful (existing 500 kB chunk warning); focused browser picking/camera/environment tests 2/2; default suite 7 passed, 3 explicitly optional skipped, exit code 0 (25.3 seconds). Port 5175 was released after teardown. Production mode passed independently on fresh `issue8_review_production`: zero Simulation Runs before invocation, one afterward; CUSTOMER loaded the helper-created run and could not generate.

Optional-mode validation and final teardown/whitespace checks are recorded below. The event-only change does not modify per-frame behavior or the frozen scene workload; rerunning the accepted six-run benchmark is not required for the fix. The existing performance collector is nevertheless exercised to verify its fresh-database prerequisite, with its measurements kept separate from the accepted baseline.

Fresh performance mode passed (6.6 minutes): `issue8_review_performance` contained zero runs before and one after setup. The six unmodified trials are retained in [review performance validation](./site-scene-review-performance.json), on the reference hardware/browser above. Median of run medians: normal 71.43 FPS, reduced 142.86 FPS; 24 draw calls, 48,400 triangles, 18 geometries and one internal texture in every run. Twelve badges remained visible, idle frames were zero, and three reopen cycles retained one Canvas/18 geometries/one texture. Scene/camera workload and quality configuration are unchanged. Normal-quality slower frame intervals are retained, including the 480.4 ms interval in the first trial; they are not hidden by the passing median. All reduced trials exceed the 30 FPS floor in complete one-second bins.

| Fresh validation trial | Median FPS | p95 frame ms | Worst interval ms | Minimum full-second FPS |
|---|---:|---:|---:|---:|
| Normal 1 | 68.49 | 28.60 | 480.40 | 22 |
| Normal 2 | 71.43 | 28.70 | 82.60 | 28 |
| Normal 3 | 76.92 | 19.00 | 82.70 | 47 |
| Reduced 1 | 142.86 | 10.40 | 35.40 | 98 |
| Reduced 2 | 142.86 | 9.50 | 32.00 | 105 |
| Reduced 3 | 142.86 | 9.50 | 58.40 | 95 |

Fresh profile mode passed (1.3 minutes): `issue8_review_profile` contained zero runs before and one after setup. Its [separate trace summary](./site-scene-review-profile.json) confirms 12 badges, 142.86 FPS reduced median, 10.30 ms p95, 26.30 ms worst interval and minimum full-second cadence 91 FPS. The original accepted benchmark, profile, scene image and loading record are preserved; these follow-up records describe prerequisite reproducibility, not a changed rendering workload. The temporary review backend on port 8082 was stopped; the original validation services were left running.

The final default browser suite was run a second time with the strengthened deterministic reset and hover assertions: 7 passed, 3 optional skipped, exit code 0 (24.0 seconds). Both default runs and all explicit optional modes exited normally. Port 5175 was released between invocations; the reported teardown hang was not reproduced. No lifecycle/process/timer changes were made or speculative teardown fix added.

Follow-up files changed: `frontend/src/digital-twin/SiteScene.tsx`, new `SiteScene.test.ts`, `frontend/browser-tests/helpers.ts`, `site-scene.spec.ts`, `production.spec.ts`, `performance.spec.ts`, `profile.spec.ts`, `frontend/playwright.config.ts`, this verification report, `.workflow/site-scene/state.md`, and the two new review validation JSON records. `SceneEnvironment.tsx`, geographic source/coordinates, observation modules, production behavior beyond pointer arbitration, dependencies, backend and schema remain unchanged. Review of the follow-up diff confirms one native event filter and one shared test-setup helper, with no global picking service, registry, framework or Issue #9 functionality.

Final focused browser rerun: Library Walk/North Gate Canvas priority plus environment-only hover/picking and camera checks 2/2 passed. `git diff --check` passes; separate UTF-8/trailing-whitespace checks include all untracked follow-up files. No backend/schema change, commit, Issue #8 closure or Issue #9 work was introduced. Both requested review findings are resolved.


## Out-and-back gesture follow-up (2026-10-05)

This change addresses only the remaining Sensor drag classification finding. The previous picking-priority and optional-mode setup fixes remain intact. `event.delta` measures effective press-to-release displacement, so a meaningful camera orbit that returns to its start can still satisfy the old guard. Before changing production code, the strengthened real Edge/WebGL regression reproduced Library Walk observations opening after a 60 px horizontal/30 px vertical drag and return.

`SiteScene` now owns one mutable gesture ref and uses capture-phase pointer handlers on its existing scene container. Pointer-down records pointer ID and original client coordinates and clears `dragged`. Pointer-move compares against those original coordinates and permanently latches `dragged` when Euclidean distance exceeds **2 CSS pixels**. Tracking the container receives moves outside the Sensor raycast target through OrbitControls' existing pointer capture, without preventing any camera events. Pointer-up checks its final coordinates and marks completion; the Sensor click callback consumes that completed result and only selects when it was never dragged. The existing left-button requirement remains. No React state is updated for gesture movement.

Pointer-cancel clears the matching gesture. Unexpected capture loss before pointer-up cancels it; normal OrbitControls capture release after pointer-up preserves the completed result until click resolution. Every new pointer-down starts fresh, so completed/canceled drags do not affect the next click. Unmount removes the React handlers and discards the component ref; no extra listeners, timers, global service, gesture library or state framework were added.

The Canvas regression covers Library Walk and North Gate, both orbit and right-button pan, gestures ending away and gestures returning exactly to the original pointer location. It confirms the camera changes after the outward 60 x 30 px movement, then asserts no observation dialog after release. Ordinary Canvas clicks before and after every gesture still open observations. Separate injected pointer-cancel/capture-loss lifecycle events suppress the interrupted selection and permit the next actual Canvas mouse click; the selection and out-and-back proof itself uses real mouse input. Environment-only source selection and hover highlighting remain verified by the retained browser test.

Focused frontend tests: 3/3 existing SiteScene picking tests passed. Complete frontend tests: 51/51 passed. Final focused browser interaction tests: 2/2 passed (20.4 seconds), including the new out-and-back and lifecycle cases. Production build passed; the existing unsplit-chunk warning remains. No helper abstraction or extra unit-only seam was added solely to duplicate the DOM/Canvas gesture integration tested in the browser.

The six-run benchmark was not rerun: gesture tracking only mutates a ref while native pointer events are dispatched. It adds no frame callback, render-loop work, React state update, geometry, material, workload change or idle invalidation. Existing recorded benchmarks remain valid for the unchanged rendering workload. Geographic coordinates, Sensor-priority intersections, observations, badges, timeline, units/provenance, no-run/failure paths, demand rendering, auth/isolation and the browser ADMIN setup helper are unchanged.

Default browser suite: **7 passed, 3 optional modes skipped**, 28.2 seconds, exit code 0. This retains API/buffer alignment, Site framing and camera reset, observation/timeline/stacked-badge behavior, no-run/ADMIN generation, optional environment failure and auth/Customer isolation coverage. The browser runner exited cleanly and released port 5175. `git diff --check` and follow-up UTF-8/trailing-whitespace checks passed. Review of this finding's diff retained only renderer-local pointer refs/handlers and Canvas regressions; no backend, schema, dependency, coordinate, Sensor-priority filter, scene workload, optional ADMIN helper or Issue #9 change was introduced.

Files changed for this finding: `frontend/src/digital-twin/SiteScene.tsx`, `frontend/browser-tests/site-scene.spec.ts`, this report and `.workflow/site-scene/state.md`. Original scene/load and benchmark/profile artifacts are retained unchanged. No commit was made and Issue #8 remains open.
