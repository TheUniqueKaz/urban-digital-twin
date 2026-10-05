# Render Site-centered Digital Twins with React Three Fiber and geographic source layout

Status: Accepted, 2026-10-05. Supersedes [ADR 0001](./0001-stream-cesium-osm-buildings.md).

## Context and decision

The Digital Twin needs a stylized, interactive Site scene with real GIS layout and authoritative Site/Sensor geography. The initial demonstration is a campus-sized Site of approximately 1 km²; the architecture may grow to a campus or nearby district spanning a few kilometres. Continuous city/region navigation, terrain, and full geographic map layers remain deferred.

Use React Three Fiber (R3F) over Three.js as the single Site renderer. Replace the Cesium implementation inside `SiteScene`, preserving its geographic boundary/Sensor inputs, display-ready observation badges, and Sensor-selection callback. Preserve the surrounding application and all behavior completed in Issues #2–#7: authentication, Customer isolation, `Customer → Site → Digital Twin`, PostGIS validation, deterministic simulation, Measurements, timeline, Parameter toggles, legends, canonical units, `SIMULATED` provenance, and no-run behavior.

The decision is real GIS layout + real authoritative Site/Sensor geography + stylized 3D presentation. It does not authorize a fictional campus or claim photorealistic or surveyed geometry.

## Alternatives considered

- **Retain Cesium:** minimizes immediate migration and retains geographic terrain, globe navigation, and streaming facilities. Custom stylized assets are possible, but these geographic facilities are outside the accepted initial scope.
- **R3F/Three.js:** requires a bounded scene migration and explicit geographic registration. It fits the existing React UI and gives direct control over the camera, materials, lighting, reusable props, and object interactions required for this Site-centered presentation. This is the selected option; it is not a guarantee of better performance without measurement.
- **Dual renderer:** introduces camera/frame alignment, depth, picking, input, and lifecycle coordination with no concrete advantage in the accepted scope. Do not add a renderer registry or plugin framework.

## Geographic authority and coordinate strategy

PostGIS remains authoritative: `Site.boundary` is Polygon SRID 4326 and `Sensor.location` is Point SRID 4326. Keep the existing geographic APIs and boundary-inclusive spatial validation. Derived local rendering coordinates must never become backend/domain truth and must never be persisted.

Use one shared conversion for every boundary vertex (including interior rings), Sensor point, building footprint, and road vertex:

```text
WGS84 longitude/latitude → ECEF → Site-local ENU → Three.js
x = East
y = Up
z = -North
one scene unit = one metre
```

Derive the origin deterministically from the longitude/latitude midpoint of the Site boundary's bounding extent and keep it fixed while that Site scene is mounted. Convert WGS84 geodetic positions to ECEF, subtract the origin's ECEF position, then rotate the difference into East/North/Up. Perform conversion and origin subtraction using JavaScript numbers before creating GPU position buffers; do not place Earth-sized coordinates into those buffers. Geographic arrays are longitude first, latitude second. Do not independently stretch geometry or move Sensors to fit environment assets.

Flat ground is acceptable: use zero ellipsoidal height as a conversion convention, retain East/North placement, discard curvature-related Up displacement, and render ground at `y = 0`. This is not authoritative elevation. Building extrusion heights, assumed road widths, and Sensor marker height offsets are presentation attributes and must be identified as approximate where appropriate. Terrain and authoritative elevation are not introduced.

Use independent coordinate-reference fixtures for the origin, axis signs, known positions, and positions several kilometres from the origin, with a documented tolerance. Camera changes must not alter geographic registration. Any later precomputed local asset must declare its geographic origin, axes, and metre scale so it can be registered to the same frame.

## Environment assets and interaction

Start with one bounded, curated geographic snapshot for an existing seeded Site. Record source, retrieval date, coverage, attribution/licensing, and limitations. Use source-backed building footprints and source-backed main-road layout where available, preserving horizontal position, approximate footprint, orientation, and metre scale. Identify missing coverage rather than inventing surveyed facts.

Extrude footprints into stylized buildings with approximate heights. Use a small reusable glTF/GLB or equivalent visual asset set for vegetation, furniture, and props, shared materials, a restrained palette, and instancing for repeated assets. Decorative objects may be illustrative. Context panels distinguish source-backed layout, approximate attributes, illustrative assets, and unavailable metadata; these classifications do not replace Measurement provenance.

Environment objects support hover, selection, highlighting, and contextual information. Sensor and badge picking retain the existing observation behavior, including the accessible Sensor list and details. Optional environment failure must leave the authoritative boundary, Sensors, and observation exploration usable.

These are frontend visual inputs, not backend buildings or customer-owned domain records. Source/asset keys may support picking but do not become backend building IDs. Do not add runtime GIS provider queries, backend imports, building persistence, APIs, or environment editing. Static visual assets must contain no protected customer-domain data.

## Scene growth and performance

Keep the initial controlled camera Site-centered, with pan, zoom, constrained orbit, and reset; an orthographic camera supplies the initial isometric presentation. Keep static environment geometry mounted across observation updates. Share resources, instance repeated assets, cap pixel ratio, provide reduced quality, limit dynamic shadows, and avoid expensive post-processing initially. Render on demand while idle and request frames during camera or observation updates.

Organize environment geometry and instance batches into spatial groups. For measured growth beyond the initial demo, introduce selective LOD and separately loaded chunks with bounded residency when profiling justifies them. R3F does not supply automatic geographic streaming. Generic streaming, tile generation, custom GIS engines, and final district-scale completeness are not requirements for Issue #8. A future existing 3D Tiles loader may be evaluated without requiring a second renderer.

Performance acceptance uses documented reference desktop/laptop hardware and a repeatable representative workload. Desired normal-quality performance is 60 FPS during normal camera movement at 1080p. If normal quality falls below 60 FPS, profile and document the bottleneck; small hardware-dependent variance alone does not fail the ticket. Reduced quality must sustain at least 30 FPS for the recorded reference workload, the minimum practical floor.

The 1,000 repeated decorative instances case is a benchmark workload to exercise instancing and performance, not a product requirement for the production Site. Record workload counts, assets, quality settings, hardware/browser, repeated camera path, FPS/frame times, stalls, loading, and navigation/unmount behavior. Issue #8 defines the measurement procedure; no performance results are asserted by this ADR.

## Consequences and migration boundary

The application gains direct control over stylized presentation but owns geographic conversion, asset registration, bounded loading, and performance verification. Flat presentation deliberately omits terrain and Earth curvature. Source coverage and approximate dimensions must be transparent.

Issue #8 migrates the existing concrete `SiteScene` boundary, moves shared geographic types to a renderer-independent location if necessary, and updates renderer-specific tests. Remove Cesium runtime dependencies, widget styles, and the build plugin only during that implementation after replacement verification. No backend/schema/API change is required; the obsolete planned `building_source` field was documentation only. No application source or dependency change is part of accepting this ADR.

Retain the existing test harness and completed behavior coverage. Real-browser verification must prove alignment, camera behavior, picking, readable observation badges, optional asset failure, no-run behavior, and the recorded performance workload.

## Conditions for reconsidering Cesium

Revisit this decision through a new ADR if accepted product requirements demand continuous city/region or globe navigation, real terrain/elevation and curvature-aware placement, full geographic map layers, or large geospatial datasets whose streaming/LOD needs cannot reasonably be met by the bounded local scene after profiling. Reconsider if measured coordinate accuracy fails an accepted larger-extent requirement. Mere scene growth or stylization alone is not sufficient.

A dual renderer would require a concrete need for both broad geographic navigation and specialized local rendering that one engine cannot reasonably satisfy, together with a demonstrated benefit that pays for alignment, depth, picking, input, and lifecycle complexity.
