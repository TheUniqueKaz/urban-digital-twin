import { afterEach, expect, it, vi } from 'vitest';
import frozenSnapshot from '../../public/geography/innovation-campus.json';
import { coversSite, loadEnvironment, type EnvironmentSnapshot } from './environment';
import { siteFrame } from './geography';

const snapshot: EnvironmentSnapshot = frozenSnapshot;
afterEach(() => vi.unstubAllGlobals());

it('loads the frozen public source snapshot without a geographic-provider query or customer credentials', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(snapshot)));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  const result = await loadEnvironment(signal);
  expect(result.buildings).toHaveLength(441);
  expect(result.roads).toHaveLength(146);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledWith('/geography/innovation-campus.json', { signal });
  const [west, south, east, north] = result.coverage;
  for (const coordinates of [...result.buildings.flatMap((building) => building.coordinates), ...result.roads.map((road) => road.coordinates)]) {
    for (const [longitude, latitude] of coordinates) {
      expect(longitude).toBeGreaterThanOrEqual(west); expect(longitude).toBeLessThanOrEqual(east);
      expect(latitude).toBeGreaterThanOrEqual(south); expect(latitude).toBeLessThanOrEqual(north);
    }
  }
  expect(JSON.stringify(result)).not.toMatch(/sensorId|customerId|siteId|digitalTwinId/);
});

it.each([
  null,
  { ...snapshot, buildings: [null] },
  { ...snapshot, buildings: [{ ...snapshot.buildings[0], coordinates: [[[106.7, NaN]]] }] },
  { ...snapshot, roads: [{ ...snapshot.roads[0], coordinates: [[181, 10], [106.7, 10.77]] }] },
  { ...snapshot, buildings: [{ ...snapshot.buildings[0], name: { fabricated: 'name' } }] },
])('rejects invalid optional assets before they enter the renderer', async (invalid) => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(invalid)));
  await expect(loadEnvironment(new AbortController().signal)).rejects.toThrow('Geographic snapshot is invalid');
});

it('reports HTTP failure without creating context', async () => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
  await expect(loadEnvironment(new AbortController().signal)).rejects.toThrow('Geographic environment unavailable');
});

it('does not apply the snapshot to a Site outside its declared geographic coverage', () => {
  const outside = siteFrame({ type: 'Polygon', coordinates: [[[107, 11], [107.01, 11], [107.01, 11.01], [107, 11]]] });
  expect(coversSite(snapshot, outside)).toBe(false);
});

it.each([
  async () => new Response('not JSON'),
  async () => { throw new TypeError('Failed to fetch'); },
])('normalizes optional parse and network failures', async (fetcher) => {
  vi.stubGlobal('fetch', fetcher);
  await expect(loadEnvironment(new AbortController().signal)).rejects.toThrow(/Geographic (snapshot is invalid|environment unavailable)/);
});
