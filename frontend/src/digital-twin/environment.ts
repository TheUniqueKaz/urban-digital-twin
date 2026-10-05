import { Path, Shape, Vector2 } from 'three';
import type { ScenePoint, SiteFrame } from './geography';

export type Building = { id: string; name: string | null; kind: string; coordinates: number[][][] };
export type Road = { id: string; name: string | null; kind: string; coordinates: number[][] };
export type EnvironmentSnapshot = {
  source: string; retrievedAt: string; coverage: number[]; attribution: string; license: string;
  buildings: Building[]; roads: Road[];
};
export type EnvironmentObject = { id: string; name: string; type: 'building' | 'road' | 'tree' };

export const snapshotUrl = '/geography/innovation-campus.json';

export async function loadEnvironment(signal: AbortSignal): Promise<EnvironmentSnapshot> {
  const response = await fetch(snapshotUrl, { signal }).catch(() => {
    throw new Error('Geographic environment unavailable. Boundary, Sensors and observations remain available.');
  });
  if (!response.ok) throw new Error('Geographic environment unavailable. Boundary, Sensors and observations remain available.');
  const data: EnvironmentSnapshot = await response.json().catch(() => {
    throw new Error('Geographic snapshot is invalid. Boundary, Sensors and observations remain available.');
  });
  const validFeature = (feature: Building | Road) => feature && typeof feature.id === 'string' && typeof feature.kind === 'string'
    && (feature.name === null || typeof feature.name === 'string');
  if (!data || !Array.isArray(data.coverage) || data.coverage.length !== 4 || !data.coverage.every(Number.isFinite)
    || ![data.source, data.retrievedAt, data.attribution, data.license].every((value) => typeof value === 'string')
    || !Array.isArray(data.buildings) || !Array.isArray(data.roads)
    || data.buildings.some((building) => !validFeature(building) || !validRings(building.coordinates))
    || data.roads.some((road) => !validFeature(road) || !validLine(road.coordinates))) {
    throw new Error('Geographic snapshot is invalid. Boundary, Sensors and observations remain available.');
  }
  return data;
}

function validLine(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length >= 2 && value.every((point) => Array.isArray(point)
    && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
}
function validRings(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every((ring) => validLine(ring) && ring.length >= 4
    && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
}

export function coversSite(snapshot: EnvironmentSnapshot, frame: SiteFrame) {
  const [west, south, east, north] = snapshot.coverage;
  return frame.origin[0] >= west && frame.origin[0] <= east && frame.origin[1] >= south && frame.origin[1] <= north;
}

// XY shape uses (East, North); rotating -PI/2 around X maps extrusion Up and North to -Z.
export function footprintShape(rings: ScenePoint[][]) {
  const points = (ring: ScenePoint[]) => ring.map(([x, , z]) => new Vector2(x, -z));
  const shape = new Shape(points(rings[0]));
  shape.holes = rings.slice(1).map((ring) => new Path(points(ring)));
  return shape;
}

export function roadWidth(road: Road) {
  return road.kind === 'primary' || road.kind === 'trunk' ? 14 : road.kind === 'secondary' ? 10 : 8;
}

// Two triangles per segment, butt joins; width is explicitly approximate.
export function roadVertices(points: ScenePoint[], width: number) {
  const vertices: number[] = [];
  for (let index = 1; index < points.length; index++) {
    const [ax, , az] = points[index - 1];
    const [bx, , bz] = points[index];
    const length = Math.hypot(bx - ax, bz - az);
    if (!length) continue;
    const dx = -(bz - az) * width / (2 * length);
    const dz = (bx - ax) * width / (2 * length);
    vertices.push(ax + dx, 0.3, az + dz, bx + dx, 0.3, bz + dz, ax - dx, 0.3, az - dz,
      ax - dx, 0.3, az - dz, bx + dx, 0.3, bz + dz, bx - dx, 0.3, bz - dz);
  }
  return new Float32Array(vertices);
}
