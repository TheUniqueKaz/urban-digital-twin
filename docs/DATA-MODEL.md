# Data Model

This document describes the logical schema. Exact SQL and ORM mappings are implementation work and remain intentionally unspecified.

## Core entities

### users

```text
id              UUID, primary key
email           unique
password_hash
role            ADMIN | CUSTOMER
enabled
created_at
```

ADMIN is global and needs no Customer Membership. CUSTOMER access requires membership.

### customers

```text
id              UUID, primary key
name
created_at
```

### customer_memberships

```text
user_id         FK users
customer_id     FK customers
created_at
unique (user_id, customer_id)
```

Membership has no role in the MVP because every CUSTOMER user is read-only. A membership role is added only when a real customer-side write role exists.

### sites

```text
id              UUID, primary key
customer_id     FK customers
name
boundary        geometry(Polygon, 4326)
time_zone       IANA timezone, e.g. Asia/Ho_Chi_Minh
created_at
```

Each Site belongs to exactly one Customer and is never shared across customers.

### digital_twins

```text
id              UUID, primary key
site_id         FK sites, unique
name
description
type            AIR_QUALITY
building_source CESIUM_OSM_BUILDINGS
created_at
```

The unique `site_id` implements the agreed one-to-one Site–Digital Twin relationship. `customer_id` is not duplicated; ownership is resolved through Site.

### sensors

```text
id              UUID, primary key
digital_twin_id FK digital_twins
code            unique within digital twin
name
kind            VIRTUAL | PHYSICAL
location        geometry(Point, 4326)
altitude_m      nullable
created_at
```

The MVP seeds 5–10 VIRTUAL sensors. The backend validates that each location lies within the Site boundary.

### sensor_capabilities

```text
sensor_id       FK sensors
parameter       PM25 | PM10 | NO2 | CO2
unique (sensor_id, parameter)
```

Parameters are Java enums persisted as strings, not a configurable database catalog.

### simulation_runs

```text
id               UUID, primary key
digital_twin_id  FK digital_twins
name
seed
start_at         timestamp with time zone
end_at           timestamp with time zone
interval_minutes 15
created_by       FK users
created_at       timestamp with time zone
```

A run is immutable after successful creation. The latest run is the one with the greatest creation time, using ID as a deterministic tie-breaker if necessary.

### measurements

```text
id                 UUID, primary key
sensor_id          FK sensors
simulation_run_id  FK simulation_runs, nullable in the future
parameter          PM25 | PM10 | NO2 | CO2
value              decimal
unit               string
observed_at        timestamp with time zone
recorded_at        timestamp with time zone
provenance         MEASURED | SIMULATED | ESTIMATED
```

For MVP data:

```text
provenance = SIMULATED
simulation_run_id IS NOT NULL
unit matches the parameter's canonical unit
unique (simulation_run_id, sensor_id, parameter, observed_at)
```

The schema does not pretend this uniqueness rule is sufficient for future real-device ingestion. A source identity and ingestion idempotency rule must be designed when MEASURED data is implemented.

## Time handling

All instants are stored with timezone semantics and exchanged as ISO-8601 timestamps. Database values represent instants; the UI renders them in `site.time_zone`.

## Ownership path

Ownership is normalized rather than copied onto every table:

```text
Measurement
  → Sensor
  → Digital Twin
  → Site
  → Customer
```

Every customer-scoped lookup must follow or encode this path in its query. A resource ID alone never grants access.
