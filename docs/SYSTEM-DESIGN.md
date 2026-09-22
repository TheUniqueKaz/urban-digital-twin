# System Design

## Product definition

The product is a synthetic urban air-quality monitoring demo. A Digital Twin is the time-aware digital representation of exactly one physical Site. It is not a file, a Cesium scene, a Project, or an environmental service.

The first demo uses a campus-sized Site of about 1 km². Its Digital Twin combines an externally streamed 3D building layer with customer-owned Site geometry, virtual sensors, simulated measurements, and a timeline.

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
  React + TypeScript + CesiumJS
       │
       ├── streams Cesium OSM Buildings from Cesium ion
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

- renders the globe, Cesium OSM Buildings, Site boundary, virtual sensors, labels, legends, popups, and timeline;
- loads an entire Simulation Run and selects the current timestamp locally;
- lets users toggle multiple parameters, showing one stacked badge per selected parameter at each sensor;
- displays available Cesium feature metadata and explicitly shows missing fields as unavailable;
- never decides ownership, authorization, provenance, or official simulation results.

Building metadata is read directly from the streamed Cesium feature when available. It is not persisted or treated as customer data.

### Backend boundary

Spring Boot:

- authenticates users and issues JWT access tokens;
- enforces global ADMIN access and Customer Membership checks;
- owns Customer, Site, Digital Twin, Sensor, Simulation Run, and Measurement rules;
- validates Site boundaries and that Sensor points lie inside their Site;
- generates deterministic, rule-based simulated time series;
- returns customer-scoped domain data through REST APIs.

The backend does not proxy Cesium OSM Buildings.

### Database boundary

PostgreSQL stores relational domain data and time-series rows. PostGIS stores:

- `site.boundary` as Polygon with SRID 4326;
- `sensor.location` as Point with SRID 4326.

The MVP does not store building geometry, 3D Tiles, terrain, or Cesium assets. It does not require TimescaleDB.

## Building strategy

Cesium OSM Buildings is an external visual base layer streamed directly by CesiumJS. The application persists the twin identity, Site boundary, sensors, measurements, simulation runs, and the fact that the base layer is `CESIUM_OSM_BUILDINGS`. The initial camera view is derived from the Site boundary.

This does not create an immutable snapshot of buildings. If durable building geometry or backend spatial queries become necessary, a later pipeline must acquire source OpenStreetMap data independently, normalize it, and store it in PostGIS. Tiles streamed from Cesium are not cached into the application database.

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

Cesium viewer, layer controls, timeline, sensor badges, legends, and building popup belong to `digital-twin`. `shared` contains only genuinely reusable components or utilities.

## Cesium credentials

CesiumJS uses a public, scoped Cesium ion client token supplied through frontend environment configuration. The token is not committed to Git and should be restricted by asset/domain where supported. An administrative Cesium token must never be exposed to the browser.
