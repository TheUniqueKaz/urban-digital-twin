import type { Parameter } from '../simulation/observations';

export type SiteBoundary = { type: 'Polygon'; coordinates: number[][][] };
export type Sensor = {
  id: string;
  digitalTwinId: string;
  code: string;
  name: string;
  kind: 'VIRTUAL';
  location: { longitude: number; latitude: number };
  capabilities: Parameter[];
};
export type SensorBadge = { sensorId: string; parameter: string; text: string; color: string };
export type ScenePoint = [number, number, number];

const radians = Math.PI / 180;
const semiMajor = 6378137;
const eccentricitySquared = 6.6943799901413165e-3;

function ecef([longitude, latitude]: number[]): ScenePoint {
  const lon = longitude * radians;
  const lat = latitude * radians;
  const radius = semiMajor / Math.sqrt(1 - eccentricitySquared * Math.sin(lat) ** 2);
  return [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon),
    radius * (1 - eccentricitySquared) * Math.sin(lat)];
}

// Campus/few-kilometre frame. Geographic inputs stay longitude first.
export function siteFrame(boundary: SiteBoundary) {
  const exterior = boundary.coordinates[0];
  const longitudes = exterior.map(([longitude]) => longitude);
  const latitudes = exterior.map(([, latitude]) => latitude);
  const origin: [number, number] = [
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  ];
  const base = ecef(origin);
  const lon = origin[0] * radians;
  const lat = origin[1] * radians;
  function toScene(coordinates: number[]): ScenePoint {
    const point = ecef(coordinates);
    const [dx, dy, dz] = point.map((value, index) => value - base[index]);
    const east = -Math.sin(lon) * dx + Math.cos(lon) * dy;
    const north = -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
    const up = Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz;
    return [east, up, -north];
  }
  // Flat ground deliberately discards curvature-related Up; no elevation claims.
  const toGround = (coordinates: number[]): ScenePoint => {
    const [east, , negativeNorth] = toScene(coordinates);
    return [east, 0, negativeNorth];
  };
  const rings = boundary.coordinates.map((ring) => ring.map(toGround));
  const xs = rings[0].map(([x]) => x);
  const zs = rings[0].map(([, , z]) => z);
  const center: ScenePoint = [(Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2];
  const radius = Math.max(...rings[0].map(([x, , z]) => Math.hypot(x - center[0], z - center[2])), 1);
  return { origin, toScene, toGround, rings, center, radius };
}

export type SiteFrame = ReturnType<typeof siteFrame>;
