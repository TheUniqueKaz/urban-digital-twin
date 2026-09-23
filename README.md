# Urban Air Quality Digital Twin

This repository contains the agreed design and the minimal runnable full-stack baseline for a personal-demo urban air-quality Digital Twin platform.

## Local startup

Prerequisite: Docker Desktop with Docker Compose.

```bash
docker compose up --build
```

Then open <http://localhost:5173/login>. The frontend sends authentication requests to the backend through the Vite development proxy.

The seeded development accounts are:

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `admin-demo-password` |
| CUSTOMER | `customer@example.com` | `customer-demo-password` |

These are local demo credentials only. Docker Compose supplies an explicit development-only `AUTH_JWT_SECRET`; set it to a random value of at least 32 bytes in every other environment.

The local services are:

- frontend: <http://localhost:5173>
- backend smoke endpoint: <http://localhost:8080/api/smoke>
- PostgreSQL/PostGIS: `localhost:5432`, database/user/password `digital_twin`

Flyway applies `backend/src/main/resources/db/migration` when the backend starts. On an empty database, the first migration enables PostGIS.

Stop the stack with `docker compose down`. Add `--volumes` only when you intentionally want to delete the local database.

## Tests

With Docker available, run both minimal test harnesses without installing Maven or Node locally:

```bash
docker compose up -d db
docker compose run --rm backend mvn test
docker compose run --rm --no-deps frontend npm test
```

The backend integration suite uses that PostgreSQL/PostGIS service and applies the production Flyway migrations, including the seeded demo users.

## Design documents

- [Domain language](./CONTEXT.md)
- [System design](./docs/SYSTEM-DESIGN.md)
- [Data model](./docs/DATA-MODEL.md)
- [Authorization and API](./docs/AUTHORIZATION-AND-API.md)
- [MVP scope](./docs/MVP-SCOPE.md)
- [Architecture decisions](./docs/adr/)

## Fixed constraints

- Backend: Java and Spring Boot
- Frontend: React, TypeScript, Vite, and CesiumJS
- Database: PostgreSQL with PostGIS
- Architecture: modular monolith
- Authentication: Spring Security with JWT
- Multi-customer authorization enforced by the backend
- No microservices, Kafka, Kubernetes, real UAV, or Blender
