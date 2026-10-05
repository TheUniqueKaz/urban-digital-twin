# MVP Scope

MVP means Minimum Viable Product: the smallest end-to-end version that demonstrates the core value. For this personal project, success means a user can securely open a campus Digital Twin and observe clearly labeled simulated air-quality data changing over time.

## Success scenario

1. A seeded user logs in.
2. ADMIN sees all Customers; CUSTOMER sees only Customer Memberships.
3. The user opens a Customer and its campus Digital Twin.
4. The R3F/Three.js Site scene displays the authoritative Site boundary and a geographically aligned stylized environment.
5. The map displays 5–10 labeled virtual sensors.
6. The user toggles PM2.5, PM10, NO2, and CO2; selected parameters appear as stacked badges.
7. The user moves the timeline between 08:00 and 18:00 at 15-minute steps.
8. Sensor values and parameter-specific colors update for the selected timestamp.
9. Every simulated value is visibly labeled `SIMULATED`.
10. ADMIN can generate a new deterministic Simulation Run; CUSTOMER cannot.

## Included

- Spring Boot modular monolith
- PostgreSQL and PostGIS
- React, TypeScript, Vite, React Three Fiber, and Three.js as the accepted target; migration of the existing Cesium `SiteScene` is Issue #8
- Spring Security login and JWT access token
- Global ADMIN and read-only CUSTOMER roles
- Customer Membership authorization
- Seeded Customer, Site, Digital Twin, users, and virtual sensors
- One campus-sized Site of approximately 1 km²
- One Air Quality Digital Twin per Site
- One bounded source-backed geographic snapshot for an existing seeded Site: building footprints and main-road layout where available, with documented sources, attribution, and limitations
- Stylized footprint-based buildings, approximate heights, illustrative reusable props, and instancing for repeated assets
- Environment hover, selection, highlighting, and contextual information distinguishing sourced, approximate, illustrative, and unavailable attributes
- Shared WGS84 → ECEF → Site-local ENU → Three.js coordinates (`x = East`, `y = Up`, `z = -North`, metres); PostGIS remains authoritative and local positions are never persisted
- Flat ground, Site-derived camera framing, pan/zoom/constrained orbit/reset, and graceful optional environment failure
- PM2.5, PM10, NO2, and CO2
- Fixed deterministic Simulation Run generation
- Timeline and parameter-specific visualization legends
- Explicit provenance labeling

The rendering decision is recorded in [ADR 0005](./adr/0005-site-local-stylized-visualization.md). It preserves all completed Issues #2–#7 behavior and implies no backend/schema change. Issue #8 proves one complete visualization slice, with real-browser checks and a recorded representative performance workload: desired 60 FPS at 1080p in normal quality, bottleneck profiling below target, and a minimum 30 FPS in reduced quality on documented reference hardware. Small hardware-dependent normal-quality variance alone does not fail the ticket. The 1,000 decorative instances case exercises instancing as a benchmark; it is not a production requirement.

## Deferred

- Project and Organization entities
- Customer/user management UI
- Public registration, refresh tokens, and impersonation
- Dashboard; reconsider when overview use cases exist
- Runtime sensor placement or automatic distribution
- Real sensor ingestion and live updates
- UAV or UAV simulation
- OSM building import and backend building queries
- Customer building annotations or overrides
- Heatmaps, spatial interpolation, and generated ESTIMATED data
- Alerts, reports, and exports
- Digital Twin versions and immutable building snapshots
- Simulation run selector and advanced scenario form
- Scientific dispersion modeling, weather, wind, and traffic ingestion
- Flood, carbon, methane, forestry, landslide, and solar capabilities
- WebSockets, background jobs, message brokers, and TimescaleDB
- Microservices, Kafka, Kubernetes, MinIO, required Blender/DCC tooling, and general-purpose automated 3D asset pipelines; one bounded geographic snapshot and reusable licensed visual assets are permitted
- Terrain/authoritative elevation, continuous city/region navigation, and full geographic map layers
- Dual-renderer integration, mobile/tablet performance acceptance, and final district-scale visual completeness
- Runtime GIS provider queries, runtime environment editing, interiors, and character/game movement
- Generic streaming and tile-generation infrastructure

## Definition of done

The MVP is done only when the success scenario works end to end and backend tests demonstrate that a CUSTOMER cannot read another Customer's Site, Digital Twin, sensors, Simulation Runs, or measurements by changing IDs or paths.

Visual polish or additional features do not compensate for missing tenant-isolation tests or ambiguous provenance.

