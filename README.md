# Urban Air Quality Digital Twin

This repository currently contains the agreed design for a personal-demo urban air-quality Digital Twin platform. Implementation has deliberately not started.

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

