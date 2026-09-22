# Authorization and API

## Authentication

Spring Security authenticates seeded demo users and returns a signed JWT access token. The MVP has no public registration, refresh-token flow, password-reset flow, or impersonation.

Recommended access-token lifetime is 30–60 minutes. Passwords are stored with a modern adaptive password hash such as BCrypt or Argon2. The JWT identifies the user and global role; it does not hold a mutable "active customer" selection.

## Roles

| Role | Access |
|---|---|
| `ADMIN` | Full application access across every Customer; can generate Simulation Runs. |
| `CUSTOMER` | Read-only access to Customers listed in Customer Membership. |

ADMIN operates as itself and does not impersonate a CUSTOMER. Separate seeded accounts are used to verify the CUSTOMER experience.

## Enforcement rules

For every customer-scoped request, the backend must:

1. authenticate the JWT;
2. allow a global ADMIN or verify CUSTOMER Membership for the path's `customerId`;
3. load the requested resource under that Customer ownership path;
4. return not-found/forbidden behavior consistently without leaking another Customer's data.

The frontend is not a security boundary. UUIDs, hidden navigation, and a `customerId` supplied by the browser are never sufficient authorization.

## MVP endpoints

### Authentication

```http
POST /api/auth/login
GET  /api/me
```

### Customers and Sites

```http
GET /api/customers
GET /api/customers/{customerId}
GET /api/customers/{customerId}/sites
GET /api/customers/{customerId}/sites/{siteId}
```

ADMIN sees all customers. CUSTOMER sees only memberships.

### Digital Twin and sensors

```http
GET /api/customers/{customerId}/digital-twins/{twinId}
GET /api/customers/{customerId}/digital-twins/{twinId}/sensors
```

The backend verifies that the twin belongs to a Site owned by the path Customer. A sensor response includes location, kind, and capabilities.

### Simulation and measurements

```http
GET  /api/customers/{customerId}/digital-twins/{twinId}/simulation-runs/latest
GET  /api/customers/{customerId}/digital-twins/{twinId}/simulation-runs/{runId}/measurements
POST /api/customers/{customerId}/digital-twins/{twinId}/simulation-runs
```

GET requests allow ADMIN or an authorized CUSTOMER. POST requires ADMIN. The POST accepts no scientific model configuration in the MVP; it invokes the fixed demo scenario and returns the completed run or an error.

## Web routes

```text
/login
/customers
/customers/:customerId
/customers/:customerId/digital-twins/:twinId
```

The Customer page lists its Site and Digital Twin. The twin page contains Cesium, layer/parameter controls, legend, sensor/building popups, timeline, provenance labeling, and the ADMIN-only Generate Simulation action.

A standalone dashboard is explicitly deferred. Reconsider `/dashboard` when the product has cross-customer summaries, alerts, multiple twins needing an overview, or another concrete dashboard use case.

