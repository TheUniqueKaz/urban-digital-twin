# MVP Scope

MVP means Minimum Viable Product: the smallest end-to-end version that demonstrates the core value. For this personal project, success means a user can securely open a campus Digital Twin and observe clearly labeled simulated air-quality data changing over time.

## Success scenario

1. A seeded user logs in.
2. ADMIN sees all Customers; CUSTOMER sees only Customer Memberships.
3. The user opens a Customer and its campus Digital Twin.
4. Cesium displays the Site boundary and streamed OSM buildings.
5. The map displays 5–10 labeled virtual sensors.
6. The user toggles PM2.5, PM10, NO2, and CO2; selected parameters appear as stacked badges.
7. The user moves the timeline between 08:00 and 18:00 at 15-minute steps.
8. Sensor values and parameter-specific colors update for the selected timestamp.
9. Every simulated value is visibly labeled `SIMULATED`.
10. ADMIN can generate a new deterministic Simulation Run; CUSTOMER cannot.

## Included

- Spring Boot modular monolith
- PostgreSQL and PostGIS
- React, TypeScript, Vite, and CesiumJS
- Spring Security login and JWT access token
- Global ADMIN and read-only CUSTOMER roles
- Customer Membership authorization
- Seeded Customer, Site, Digital Twin, users, and virtual sensors
- One campus-sized Site of approximately 1 km²
- One Air Quality Digital Twin per Site
- Cesium OSM Buildings streamed directly
- Optional popup for building metadata available from Cesium
- PM2.5, PM10, NO2, and CO2
- Fixed deterministic Simulation Run generation
- Timeline and parameter-specific visualization legends
- Explicit provenance labeling

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
- Microservices, Kafka, Kubernetes, MinIO, Blender, and custom 3D model pipelines

## Definition of done

The MVP is done only when the success scenario works end to end and backend tests demonstrate that a CUSTOMER cannot read another Customer's Site, Digital Twin, sensors, Simulation Runs, or measurements by changing IDs or paths.

Visual polish or additional features do not compensate for missing tenant-isolation tests or ambiguous provenance.

