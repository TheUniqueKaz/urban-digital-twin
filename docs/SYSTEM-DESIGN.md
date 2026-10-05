# System Design

## Product definition

The product is a synthetic urban air-quality monitoring demo. A Digital Twin is the time-aware digital representation of exactly one physical Site. It is not a file, a Cesium scene, a Project, or an environmental service.

The first demo uses a campus-sized Site of about 1 km². Its Digital Twin combines source-backed geographic road/building layout and stylized 3D presentation with customer-owned Site geometry, virtual sensors, simulated measurements, and a timeline. `SiteScene` implements the R3F/Three.js architecture in [ADR 0005](./adr/0005-site-local-stylized-visualization.md). The [curated snapshot](./site-scene-snapshot.md) documents source coverage and presentation limits.

## Domain relationships

```text
Customer 1 ─── * Customer Membership * ─── 1 User
    │
    └── 1 ─── * Site 1 ─── 1 Digital Twin
                              │
                              ├── 1 ─── * Sensor
                              │             └── * Sensor Capability
                              │
                              └── 1 ─── * Simulation Run
                                            └── * Measurement
```

There is deliberately no Organization or Project entity. `Customer` is both the product term and the authorization boundary. Project may be introduced later only if an initiative with its own objectives, dates, lifecycle, or multi-twin reporting scope emerges.

## Runtime architecture

```text
Browser
  React + TypeScript + React Three Fiber / Three.js
       │
       ├── loads curated geographic snapshot + reusable visual assets
       │
       └── HTTPS/JSON + JWT
                    │
                    ▼
Spring Boot modular monolith
  auth | customer | site | digitaltwin
  sensor | simulation | measurement | common
                    │
                    ▼
PostgreSQL + PostGIS
```

### Frontend boundary

The frontend:

- renders a Site-centered stylized scene, source-backed footprints/main roads where available, Site boundary, virtual sensors, labels, legends, contextual information, and timeline;
- loads an entire Simulation Run and selects the current timestamp locally;
- lets users toggle multiple parameters, showing one stacked badge per selected parameter at each sensor;
- supports environment hover, selection, highlighting, and contextual information, distinguishing source-backed layout, approximate dimensions, illustrative assets, and unavailable metadata;
- never decides ownership, authorization, provenance, or official simulation results.

Environment metadata comes from the curated source/asset snapshot. It is not persisted as backend buildings or treated as customer-owned domain data. Optional environment failure leaves Site/Sensor observation exploration usable. Sensor selection, stacked badges, legends, canonical units, visible `SIMULATED` provenance, and no-run behavior from Issues #2–#7 remain intact.

### Rendering coordinate frame

PostGIS SRID 4326 remains authoritative. Convert WGS84 longitude/latitude → ECEF → one Site-local ENU frame → Three.js, with `x = East`, `y = Up`, `z = -North`, and one unit equal to one metre. Derive a deterministic origin from the Site boundary's bounding extent and use it for boundary rings, Sensors, footprint vertices, and road geometry. Local coordinates are transient presentation data and must never be persisted or become backend/domain truth.

Flat ground at `y = 0` is acceptable; discard curvature-related Up displacement. Zero conversion height, building extrusion, road-width assumptions, and marker offsets do not introduce authoritative elevation. Preserve horizontal position, orientation, and scale; identify approximations.

### Backend boundary

Spring Boot:

- authenticates users and issues JWT access tokens;
- enforces global ADMIN access and Customer Membership checks;
- owns Customer, Site, Digital Twin, Sensor, Simulation Run, and Measurement rules;
- validates Site boundaries and that Sensor points lie inside their Site;
- generates deterministic, rule-based simulated time series;
- returns customer-scoped domain data through REST APIs.

The backend does not proxy visual-context providers or persist environment assets, building geometry, or building metadata. The renderer replacement requires no backend, schema, or API change.

### Database boundary

PostgreSQL stores relational domain data and time-series rows. PostGIS stores:

- `site.boundary` as Polygon with SRID 4326;
- `sensor.location` as Point with SRID 4326.

The MVP does not store building geometry, local scene coordinates, 3D Tiles, terrain, or environment assets in the database. It does not require TimescaleDB.

## Visual context and scene growth

Use one bounded geographic snapshot for an existing seeded Site, with documented source, retrieval date, coverage, attribution/licensing, and limitations. Render stylized buildings from source-backed footprints and main-road layout where available. Use a small reusable visual asset set and instancing for repeated decorations. Frontend/source keys support picking without becoming backend building IDs. No runtime GIS provider queries are required. Derive camera framing from the authoritative Site boundary; support pan, zoom, constrained orbit, and reset.

The curated visual input does not create a Digital Twin version or authoritative backend building snapshot. Building persistence and backend spatial building queries remain deferred and require a separate decision. The obsolete planned `building_source` field was not implemented; removing it from the design implies no migration.

Keep environment geometry mounted across observation updates. Share materials/geometry and group instance batches spatially. Add selective LOD and bounded chunk loading when measured growth justifies them, without generic streaming or tile-generation infrastructure. The scope may grow to a campus or nearby district spanning a few kilometres; continuous city/region navigation, terrain, and final district-scale completeness remain deferred.

Target 60 FPS during normal camera movement at 1080p in normal quality on documented reference hardware and a repeatable representative workload. If normal quality is below 60 FPS, profile and document the bottleneck; small hardware-dependent variance alone does not fail the ticket. Reduced quality must meet at least 30 FPS for that recorded workload. The 1,000 repeated decorative instances case is a benchmark for instancing/performance, not a production object-count requirement. Record quality settings and results using Issue #8's procedure.

## Air-quality observation

The only current capability is Air Quality. Every Sensor can support any subset of:

- `PM25`, canonical unit `µg/m³`;
- `PM10`, canonical unit `µg/m³`;
- `NO2`, canonical unit `µg/m³`;
- `CO2`, canonical unit `ppm`.

The initial dataset uses 5–10 fixed virtual sensor locations. Runtime sensor placement and automatic distribution are deferred.

Visualization bands are configured separately for each parameter. They are labeled as visualization thresholds and must not be presented as an official AQI or health conclusion.

## Simulation behavior

An ADMIN can generate a Simulation Run using one fixed demo scenario:

- time window: 08:00–18:00 in the Site timezone;
- interval: 15 minutes;
- deterministic seed recorded on the run;
- rule-based values with parameter baselines, location effects, gradual temporal change, and bounded noise.

The generator is a demo model, not a scientific dispersion model. It runs synchronously in one database transaction. A failure leaves no partial run. Each request creates a new immutable run; the Digital Twin page uses the latest completed run by default.

The entire run is returned to the frontend because the expected dataset is small. With 10 sensors, 4 parameters, and 41 timestamps it contains about 1,640 measurements. The timeline snaps to recorded timestamps, so the MVP performs no interpolation.

## Provenance

Every Measurement has exactly one provenance:

- `MEASURED`: observed by a real device or real observation source;
- `SIMULATED`: generated by a model or scenario without claiming the event occurred;
- `ESTIMATED`: inferred for a real place/time from observations or rules rather than measured directly.

The MVP creates only `SIMULATED` measurements. Provenance is shown in sensor badges and popups, not only as a page-level disclaimer. Any later chart or derived view must preserve the same labeling.

## Frontend structure

Use feature-oriented code organization:

```text
auth
customers
digital-twin
simulation
shared
```

`SiteScene`, layer controls, timeline, sensor badges, legends, and environment context belong to `digital-twin`. Preserve the existing observation and simulation behavior and feature organization. `shared` contains only genuinely reusable components or utilities.

## Rendering migration

Issue #8 replaces only the Site rendering implementation and its renderer-specific integration. Replacement verification precedes removal of the Cesium dependencies/styles/build plugin. See [verification and performance](./site-scene-verification.md). There is one Site renderer and no backend building model or new simulation behavior.
