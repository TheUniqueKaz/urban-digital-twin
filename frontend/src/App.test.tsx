// @vitest-environment jsdom

import { act, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthBoundary, useAuth } from './auth/AuthBoundary';

const scene = vi.hoisted(() => ({ add: vi.fn(), setView: vi.fn(), destroy: vi.fn() }));
vi.mock('cesium', () => ({
  Viewer: class {
    private elements = new Map<string, HTMLElement>();
    private groups = new Map<string, HTMLElement>();
    private select?: (event: { position: string }) => void;
    private destroyed = false;
    constructor(private container: HTMLElement) {}
    private entityCollection = {
      add: (entity: { id?: string; name: string; label?: { text: string; backgroundColor?: string } }) => {
        scene.add(entity);
        if (!entity.id || !entity.label) return;
        const sensorId = entity.id.split('/')[0];
        let group = this.groups.get(sensorId);
        if (!group) {
          group = document.createElement('div');
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', `${entity.name} map Sensor`);
          this.container.append(group);
          this.groups.set(sensorId, group);
        }
        const label = document.createElement(entity.id.includes('/') ? 'span' : 'button');
        label.textContent = entity.label.text;
        label.style.display = 'block';
        if (entity.label.backgroundColor) label.style.backgroundColor = entity.label.backgroundColor;
        label.onclick = () => this.select?.({ position: entity.id! });
        group.append(label);
        this.elements.set(entity.id, label);
      },
      removeById: (id: string) => { this.elements.get(id)?.remove(); this.elements.delete(id); },
    };
    get entities() {
      if (this.destroyed) throw new Error('Viewer is destroyed');
      return this.entityCollection;
    }
    scene = { pick: (position: string) => ({ id: { id: position } }) };
    screenSpaceEventHandler = { setInputAction: (listener: (event: { position: string }) => void) => { this.select = listener; } };
    camera = { setView: scene.setView };
    isDestroyed = () => this.destroyed;
    destroy = () => { this.destroyed = true; this.container.replaceChildren(); scene.destroy(); };
  },
  Cartesian3: {
    fromDegreesArray: (coordinates: number[]) => coordinates,
    fromDegrees: (longitude: number, latitude: number) => [longitude, latitude],
  },
  Cartesian2: class {
    constructor(public x: number, public y: number) {}
  },
  Rectangle: { fromDegrees: (...bounds: number[]) => bounds },
  ScreenSpaceEventType: { LEFT_CLICK: 'click' },
  EllipsoidTerrainProvider: class {},
  Color: {
    CYAN: { withAlpha: () => 'transparent cyan' },
    YELLOW: 'yellow',
    WHITE: 'white',
    fromCssColorString: (color: string) => color,
  },
}));

const boundary = {
  type: 'Polygon',
  coordinates: [[[106.695, 10.770], [106.705, 10.770], [106.705, 10.779], [106.695, 10.779], [106.695, 10.770]]],
};
const sensors = [{
  id: 'sensor-a', digitalTwinId: 'twin-a', code: 'VS-01', name: 'North Gate', kind: 'VIRTUAL',
  location: { longitude: 106.697, latitude: 10.777 }, capabilities: ['PM25', 'NO2'],
}];
const simulationRun = {
  id: 'run-a', seed: 20260928, configuration: 'non-scientific-demo-rule-v1',
  timeZone: 'Asia/Ho_Chi_Minh', startAt: '2026-09-28T01:00:00Z',
  endAt: '2026-09-28T11:00:00Z', intervalMinutes: 15, createdAt: '2026-09-28T00:00:00Z',
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  scene.add.mockClear();
  scene.setView.mockClear();
  scene.destroy.mockClear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/login');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function render(ui: ReactNode) {
  await act(async () => root.render(ui));
}

async function submitSeededAdmin() {
  const inputs = container.querySelectorAll('input');
  await act(async () => {
    setInput(inputs[0], 'admin@example.com');
    setInput(inputs[1], 'admin-demo-password');
  });
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Issue #3 authentication flow', () => {
  it('lets a seeded user submit the login form and renders authenticated identity', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/auth/login') {
        return json({ accessToken: 'signed.jwt', expiresIn: 3600 });
      }
      if (input === '/api/customers') {
        return json([]);
      }
      return json({
        id: '10000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        role: 'ADMIN',
      });
    });
    vi.stubGlobal('fetch', fetcher);

    await render(<App />);
    await submitSeededAdmin();

    expect(container.textContent).toContain('Signed in as admin@example.com');
    expect(container.textContent).toContain('Role: ADMIN');
    expect(window.localStorage.getItem('digital-twin-access-token')).toBe('signed.jwt');
    expect(window.location.pathname).toBe('/customers');
  });

  it('clears authenticated UI and returns to login when any protected request receives 401', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/auth/login') {
        return json({ accessToken: 'expired.jwt', expiresIn: 3600 });
      }
      if (input === '/api/me') {
        return json({
          id: '10000000-0000-0000-0000-000000000001',
          email: 'admin@example.com',
          role: 'ADMIN',
        });
      }
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal('fetch', fetcher);

    await render(
      <AuthBoundary>
        <ProtectedRequest />
      </AuthBoundary>,
    );
    await submitSeededAdmin();
    expect(container.textContent).toContain('Authenticated content');

    await act(async () => {
      container.querySelector('button')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(window.localStorage.getItem('digital-twin-access-token')).toBeNull();
    expect(container.textContent).toContain('Sign in');
    expect(container.textContent).not.toContain('Authenticated content');
    expect(window.location.pathname).toBe('/login');
  });
});

describe('Issue #4 customer navigation', () => {
  it('navigates Customer to Site to its Digital Twin', async () => {
    const customerId = '20000000-0000-0000-0000-000000000001';
    const siteId = '30000000-0000-0000-0000-000000000001';
    const twinId = '40000000-0000-0000-0000-000000000001';
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/auth/login') return json({ accessToken: 'signed.jwt', expiresIn: 3600 });
      if (input === '/api/me') return json({ id: 'user-id', email: 'admin@example.com', role: 'ADMIN' });
      if (input === '/api/customers') return json([{ id: customerId, name: 'Saigon Campus Group' }]);
      if (input === `/api/customers/${customerId}`) return json({ id: customerId, name: 'Saigon Campus Group' });
      if (input === `/api/customers/${customerId}/sites`) {
        return json([{ id: siteId, customerId, name: 'Innovation Campus', digitalTwin: { id: twinId, name: 'Innovation Campus Digital Twin' } }]);
      }
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}`) {
        return json({ id: twinId, siteId, name: 'Innovation Campus Digital Twin', boundary });
      }
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}/sensors`) return json(sensors);
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}/simulation-runs/latest`) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetcher);

    await render(<App />);
    await submitSeededAdmin();
    expect(container.textContent).toContain('Saigon Campus Group');

    await act(async () => {
      (container.querySelector('a[href^="/customers/"]') as HTMLAnchorElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Innovation Campus');
    expect(container.textContent).toContain('Open Innovation Campus Digital Twin');

    await act(async () => {
      (container.querySelector(`a[href$="${twinId}"]`) as HTMLAnchorElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Innovation Campus Digital Twin');
    expect(container.textContent).toContain(`Site: ${siteId}`);
  });

  it('shows a clear empty state for a CUSTOMER with zero memberships', async () => {
    window.localStorage.setItem('digital-twin-access-token', 'signed.jwt');
    window.history.replaceState(null, '', '/customers');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/me') {
        return json({ id: '10000000-0000-0000-0000-000000000004', email: 'no-memberships@example.com', role: 'CUSTOMER' });
      }
      return json([]);
    }));

    await render(<App />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.textContent).toContain('No customers available for this account');
  });

  it('renders no protected data after direct navigation to an inaccessible Digital Twin', async () => {
    window.localStorage.setItem('digital-twin-access-token', 'signed.jwt');
    window.history.replaceState(null, '', '/customers/other/digital-twins/secret');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/me') {
        return json({ id: 'customer-user', email: 'customer@example.com', role: 'CUSTOMER' });
      }
      return new Response(null, { status: 404 });
    }));

    await render(<App />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.textContent).toContain('Digital Twin data is unavailable.');
    expect(container.textContent).not.toContain('secret customer data');
  });
});

describe('Issue #5 Site and Virtual Sensors', () => {
  async function openTwin(
    role: 'ADMIN' | 'CUSTOMER',
    siteBoundary: typeof boundary = boundary,
    generatedRun?: typeof simulationRun,
  ) {
    const customerId = 'customer-a';
    const twinId = 'twin-a';
    window.localStorage.setItem('digital-twin-access-token', 'signed.jwt');
    window.history.replaceState(null, '', `/customers/${customerId}/digital-twins/${twinId}`);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/me') return json({ id: 'user-a', email: 'user@example.com', role });
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}`) {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed.jwt');
        return json({ id: twinId, siteId: 'site-a', name: 'Campus Digital Twin', boundary: siteBoundary });
      }
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}/sensors`) {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed.jwt');
        return json(sensors);
      }
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}/simulation-runs/latest`) {
        return new Response(null, { status: 204 });
      }
      if (input === `/api/customers/${customerId}/digital-twins/${twinId}/simulation-runs` && init?.method === 'POST') {
        return generatedRun ? json(generatedRun, 201) : new Response(null, { status: 500 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetcher);
    await render(<App />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    return fetcher;
  }

  it('renders the persisted boundary and labeled Sensor, focusing the camera on the boundary', async () => {
    await openTwin('ADMIN');
    expect(scene.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Site boundary', polygon: expect.anything(),
    }));
    expect(scene.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Site boundary outline', polyline: expect.anything(),
    }));
    expect(scene.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'North Gate', position: [106.697, 10.777], label: expect.objectContaining({ text: 'North Gate' }),
    }));
    expect(scene.setView).toHaveBeenCalledWith({ destination: expect.arrayContaining([
      expect.closeTo(106.693), expect.closeTo(10.7682),
      expect.closeTo(106.707), expect.closeTo(10.7808),
    ]) });
    expect(container.textContent).toContain('North Gate (VS-01) · PM25, NO2');
  });

  it('changes the Cesium camera focus when the backend Site boundary changes', async () => {
    await openTwin('ADMIN', {
      type: 'Polygon',
      coordinates: [[[10, 20], [20, 20], [20, 30], [10, 30], [10, 20]]],
    });

    expect(scene.setView).toHaveBeenCalledWith({ destination: [8, 18, 22, 32] });
  });

  it('shows no simulation data without creating any, with an ADMIN-only action', async () => {
    const fetcher = await openTwin('ADMIN');
    expect(container.textContent).toContain('No simulation data is available.');
    const action = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Generate Simulation');
    expect(action?.disabled).toBe(false);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      '/api/me', '/api/customers/customer-a/digital-twins/twin-a',
      '/api/customers/customer-a/digital-twins/twin-a/sensors',
      '/api/customers/customer-a/digital-twins/twin-a/simulation-runs/latest',
    ]);
  });

  it('keeps CUSTOMER read-only while showing the same empty scene', async () => {
    await openTwin('CUSTOMER');
    expect(container.textContent).toContain('No simulation data is available.');
    expect(container.textContent).toContain('North Gate');
    expect(container.textContent).not.toContain('Generate Simulation');
  });

  it('lets ADMIN synchronously generate and display the latest run metadata', async () => {
    const fetcher = await openTwin('ADMIN', boundary, simulationRun);
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === 'Generate Simulation')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/customers/customer-a/digital-twins/twin-a/simulation-runs',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(container.textContent).toContain('Latest Simulation Run');
    expect(container.textContent).toContain('Non-scientific SIMULATED demo data');
    expect(container.textContent).toContain('Seed: 20260928');
    expect(container.textContent).toContain('Run ID: run-a');
    expect(container.textContent).toContain('08:00 to 18:00 · 15-minute intervals (Asia/Ho_Chi_Minh)');
    expect(container.textContent).not.toContain('No simulation data is available.');
  });
});

describe('Issue #7 observation exploration', () => {
  const parameterNames = ['PM2.5', 'PM10', 'NO2', 'CO2'];
  const parameterIds = ['PM25', 'PM10', 'NO2', 'CO2'];
  const capableSensors = [
    { ...sensors[0], capabilities: parameterIds },
    { ...sensors[0], id: 'sensor-b', code: 'VS-02', name: 'South Gate', capabilities: ['PM25', 'CO2'] },
  ];
  const times = ['2026-09-28T01:00:00Z', '2026-09-28T01:30:00Z', '2026-09-28T11:00:00Z'];
  const rows = times.flatMap((observedAt, timeIndex) => capableSensors.flatMap((sensor) =>
    sensor.capabilities.filter((parameter) => !(sensor.id === 'sensor-b' && timeIndex === 1 && parameter === 'PM25'))
      .map((parameter) => ({
        id: `${sensor.id}-${parameter}-${timeIndex}`, sensorId: sensor.id, simulationRunId: simulationRun.id,
        parameter, value: (timeIndex === 0 ? [12, 25, 10, 430] : [35, 75, 45, 650])[parameterIds.indexOf(parameter)],
        unit: parameter === 'CO2' ? 'ppm' : 'µg/m³', observedAt,
        recordedAt: simulationRun.createdAt, provenance: 'SIMULATED',
      }))));

  async function openObservations({
    measurements = rows, run = simulationRun, measurementStatus = 200,
    sensorRows = capableSensors, role = 'CUSTOMER',
  }: {
    measurements?: typeof rows; run?: typeof simulationRun; measurementStatus?: number;
    sensorRows?: typeof capableSensors; role?: 'ADMIN' | 'CUSTOMER';
  } = {}) {
    window.localStorage.setItem('digital-twin-access-token', 'signed.jwt');
    window.history.replaceState(null, '', '/customers/customer-a/digital-twins/twin-a');
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed.jwt');
      if (input === '/api/me') return json({ id: 'user-a', email: 'customer@example.com', role });
      if (input === '/api/customers/customer-a/digital-twins/twin-a') {
        return json({ id: 'twin-a', siteId: 'site-a', name: 'Campus Digital Twin', boundary });
      }
      if (input === '/api/customers/customer-a/digital-twins/twin-a/sensors') return json(sensorRows);
      if (input === '/api/customers/customer-a/digital-twins/twin-a/simulation-runs/latest') return json(run);
      if (input === `/api/customers/customer-a/digital-twins/twin-a/simulation-runs/${run.id}/measurements`) {
        return json(measurements, measurementStatus);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetcher);
    await render(<App />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    return fetcher;
  }

  function mapSensor(name = 'North Gate') {
    return container.querySelector(`[aria-label="${name} map Sensor"]`)!;
  }

  function toggle(name: string) {
    const label = [...container.querySelectorAll('fieldset label')].find((label) => label.textContent === name)!;
    act(() => label.querySelector('input')!.click());
  }

  function moveTime(index: string) {
    act(() => setInput(container.querySelector('input[type="range"]')!, index));
  }

  it('loads the complete run once through the scoped authenticated API, then explores locally', async () => {
    const fetcher = await openObservations();
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      '/api/me', '/api/customers/customer-a/digital-twins/twin-a',
      '/api/customers/customer-a/digital-twins/twin-a/sensors',
      '/api/customers/customer-a/digital-twins/twin-a/simulation-runs/latest',
      '/api/customers/customer-a/digital-twins/twin-a/simulation-runs/run-a/measurements',
    ]);
    moveTime('1');
    moveTime('2');
    toggle('NO2');
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(mapSensor().textContent).toContain('PM2.5: 35 µg/m³ · SIMULATED');
    expect(mapSensor().textContent).toContain('NO2: 45 µg/m³ · SIMULATED');
    expect(container.textContent).not.toContain('Generate Simulation');
  });

  it('explores all 1,640 rows of the upper demo shape through one Measurement request', async () => {
    const allSensors = Array.from({ length: 10 }, (_, index) => ({
      ...capableSensors[0], id: `sensor-${index}`, name: `Sensor ${index}`, code: `VS-${index}`,
    }));
    const fullRun = Array.from({ length: 41 }, (_, index) => new Date(Date.parse(simulationRun.startAt) + index * 900_000).toISOString())
      .flatMap((observedAt, timeIndex) => allSensors.flatMap((sensor, sensorIndex) => parameterIds.map((parameter) => ({
        ...rows[0], id: `${sensor.id}-${parameter}-${timeIndex}`, sensorId: sensor.id, parameter,
        unit: parameter === 'CO2' ? 'ppm' : 'µg/m³', observedAt, value: 100 * sensorIndex + timeIndex,
      }))));
    expect(fullRun).toHaveLength(1640);
    const fetcher = await openObservations({ measurements: fullRun, sensorRows: allSensors });
    expect(container.querySelector('input[type="range"]')!.getAttribute('max')).toBe('40');
    parameterNames.slice(1).forEach(toggle);
    moveTime('40');
    expect(mapSensor('Sensor 9').textContent).toContain('CO2: 940 ppm · SIMULATED');
    expect(container.querySelector('input[type="range"]')!.getAttribute('aria-valuetext')).toBe('18:00');
    moveTime('0');
    expect(mapSensor('Sensor 9').textContent).toContain('PM2.5: 900 µg/m³ · SIMULATED');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('loads and displays the complete new run after the existing ADMIN Generate action', async () => {
    const fetcher = await openObservations({ role: 'ADMIN' });
    const originalFetch = fetcher.getMockImplementation()!;
    const nextRun = { ...simulationRun, id: 'run-b' };
    const nextRows = rows.map((row) => ({ ...row, simulationRunId: nextRun.id, value: 99 }));
    fetcher.mockImplementation(async (input, init) => {
      if (input === '/api/customers/customer-a/digital-twins/twin-a/simulation-runs' && init?.method === 'POST') {
        return json(nextRun, 201);
      }
      if (input === '/api/customers/customer-a/digital-twins/twin-a/simulation-runs/run-b/measurements') return json(nextRows);
      return originalFetch(input, init);
    });
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === 'Generate Simulation')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Run ID: run-b');
    expect(mapSensor().textContent).toContain('PM2.5: 99 µg/m³ · SIMULATED');
    expect(mapSensor().textContent).not.toContain('PM2.5: 12');
    expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/measurements'))).toHaveLength(2);
    moveTime('1');
    expect(mapSensor().textContent).toContain('PM2.5: 99 µg/m³ · SIMULATED');
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it.each(parameterNames)('toggles %s independently without affecting other selected Parameters', async (name) => {
    await openObservations();
    const expected = `${name}:`;
    if (name === 'PM2.5') {
      toggle('NO2');
      toggle(name);
      expect(mapSensor().textContent).not.toContain(expected);
      expect(mapSensor().textContent).toContain('NO2: 10 µg/m³ · SIMULATED');
    } else {
      toggle(name);
      expect(mapSensor().textContent).toContain(expected);
      expect(mapSensor().textContent).toContain('PM2.5: 12 µg/m³ · SIMULATED');
      toggle(name);
      expect(mapSensor().textContent).not.toContain(expected);
      expect(mapSensor().textContent).toContain('PM2.5: 12 µg/m³ · SIMULATED');
    }
  });

  it('renders multiple selected observations as separate stacked badges with units and provenance', async () => {
    await openObservations();
    parameterNames.slice(1).forEach(toggle);
    const badges = [...mapSensor().querySelectorAll('span')];
    expect(badges.map((badge) => badge.textContent)).toEqual([
      'PM2.5: 12 µg/m³ · SIMULATED', 'PM10: 25 µg/m³ · SIMULATED',
      'NO2: 10 µg/m³ · SIMULATED', 'CO2: 430 ppm · SIMULATED',
    ]);
    expect([...container.querySelectorAll('[aria-label="North Gate badges"] li')].map((badge) => badge.textContent))
      .toEqual(badges.map((badge) => badge.textContent));
    expect(mapSensor('South Gate').querySelectorAll('span')).toHaveLength(2);
    expect(mapSensor('South Gate').textContent).not.toMatch(/PM10:|NO2:/);
  });

  it('uses Sensor Capability data even if a response contains an unsupported observation', async () => {
    await openObservations({ measurements: [...rows, { ...rows[2], id: 'unsupported', sensorId: 'sensor-b' }] });
    toggle('NO2');
    expect(mapSensor('South Gate').textContent).not.toContain('NO2:');
    act(() => (mapSensor('South Gate').querySelector('button') as HTMLButtonElement).click());
    expect(container.querySelector('[role="dialog"]')!.textContent).not.toContain('NO2:');
  });

  it('renders separate fixed demo legends with Parameter-specific thresholds and canonical units', async () => {
    await openObservations();
    expect(container.querySelector('[aria-label="NO2 demo legend"]')).toBeNull();
    parameterNames.slice(1).forEach(toggle);
    const bands = [
      ['PM2.5', 'µg/m³', 15, 30], ['PM10', 'µg/m³', 30, 60],
      ['NO2', 'µg/m³', 20, 40], ['CO2', 'ppm', 450, 600],
    ];
    for (const [name, unit, first, second] of bands) {
      const legend = container.querySelector(`[aria-label="${name} demo legend"]`)!;
      expect([...legend.querySelectorAll('li')].map((band) => band.textContent)).toEqual([
        `Band 1: < ${first} ${unit}`, `Band 2: ${first}–< ${second} ${unit}`, `Band 3: ≥ ${second} ${unit}`,
      ]);
      expect(legend.querySelector('li')!.style.backgroundColor).toBe(mapSensor().querySelector('span')!.style.backgroundColor);
    }
    expect(container.textContent).toContain('Demo visualization bands');
    expect(container.textContent).not.toMatch(/AQI|healthy|unhealthy|safe|hazardous/i);
    toggle('PM10');
    expect(container.querySelector('[aria-label="PM10 demo legend"]')).toBeNull();
  });

  it('colors the same numeric value according to each Parameter scale', async () => {
    await openObservations({ measurements: rows.map((row) => ({ ...row, value: 25 })) });
    parameterNames.slice(1).forEach(toggle);
    const badges = [...mapSensor().querySelectorAll('span')];
    const legendBandColor = (name: string, band: number) =>
      (container.querySelector(`[aria-label="${name} demo legend"] li:nth-child(${band})`) as HTMLElement).style.backgroundColor;
    expect(badges.map((badge) => badge.style.backgroundColor)).toEqual([
      legendBandColor('PM2.5', 2), legendBandColor('PM10', 1),
      legendBandColor('NO2', 2), legendBandColor('CO2', 1),
    ]);
  });

  it('opens all available Sensor observations from the scene regardless of badge toggles', async () => {
    await openObservations();
    toggle('NO2');
    act(() => (mapSensor().querySelector('button') as HTMLButtonElement).click());
    const popup = container.querySelector('[role="dialog"]')!;
    expect(popup.getAttribute('aria-label')).toBe('North Gate observations');
    expect(document.activeElement).toBe(popup);
    expect([...popup.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'PM2.5: 12 µg/m³ · SIMULATED', 'PM10: 25 µg/m³ · SIMULATED',
      'NO2: 10 µg/m³ · SIMULATED', 'CO2: 430 ppm · SIMULATED',
    ]);
    expect(mapSensor().querySelectorAll('span')).toHaveLength(2);
    toggle('PM2.5');
    toggle('NO2');
    expect(mapSensor().querySelectorAll('span')).toHaveLength(0);
    expect(popup.querySelectorAll('li')).toHaveLength(4);
    moveTime('1');
    expect(popup.textContent).toContain('08:30');
    expect(popup.textContent).toContain('PM10: 75 µg/m³ · SIMULATED');
    expect(popup.textContent).toContain('CO2: 650 ppm · SIMULATED');
  });

  it('provides accessible Sensor selection and close controls', async () => {
    await openObservations();
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Inspect South Gate')!.click());
    expect(container.querySelector('[role="dialog"]')!.querySelectorAll('li')).toHaveLength(2);
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Close Sensor details')!.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('uses only persisted timestamps, skipping missing 08:15 and changing values and colors without interpolation', async () => {
    await openObservations();
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['0', '2', '1', '0']);
    expect(slider.getAttribute('aria-valuetext')).toBe('08:00');
    parameterNames.slice(1).forEach(toggle);
    const initialColor = mapSensor().querySelector('span')!.style.backgroundColor;
    moveTime('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('08:30');
    expect(container.querySelector('output time')!.getAttribute('datetime')).toBe(times[1]);
    expect(mapSensor().textContent).toContain('PM2.5: 35 µg/m³ · SIMULATED');
    expect(mapSensor().textContent).not.toContain('PM2.5: 12');
    expect(mapSensor().querySelector('span')!.style.backgroundColor).not.toBe(initialColor);
    for (const badge of mapSensor().querySelectorAll('span')) {
      expect(badge.style.backgroundColor).toBe((container.querySelector('[aria-label="CO2 demo legend"] li:last-child') as HTMLElement).style.backgroundColor);
    }
    expect(mapSensor('South Gate').textContent).not.toContain('PM2.5:');
    act(() => (mapSensor('South Gate').querySelector('button') as HTMLButtonElement).click());
    expect(container.querySelector('[role="dialog"]')!.textContent).toContain('PM2.5: No observation at this timestamp.');
    expect(container.textContent).not.toContain('08:15');
    expect(container.textContent).not.toContain('ESTIMATED');
    moveTime('2');
    expect(slider.getAttribute('aria-valuetext')).toBe('18:00');
    expect(mapSensor('South Gate').textContent).toContain('PM2.5: 35 µg/m³ · SIMULATED');
  });

  it('renders labels in the Site IANA timezone carried by the run, including daylight saving time', async () => {
    const startAt = '2026-07-01T12:00:00Z';
    const endAt = '2026-07-01T22:00:00Z';
    await openObservations({
      run: { ...simulationRun, timeZone: 'America/New_York', startAt, endAt },
      measurements: [{ ...rows[0], observedAt: endAt }, { ...rows[1], observedAt: startAt }],
    });
    expect(container.textContent).toContain('08:00 to 18:00 · 15-minute intervals (America/New_York)');
    expect(container.querySelector('input[type="range"]')!.getAttribute('aria-valuetext')).toBe('08:00');
    expect(container.querySelector('output time')!.getAttribute('datetime')).toBe(startAt);
    moveTime('1');
    expect(container.querySelector('input[type="range"]')!.getAttribute('aria-valuetext')).toBe('18:00');
  });

  it('handles a single persisted timestamp without offering unrecorded times', async () => {
    await openObservations({ measurements: [rows[0]] });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    expect(slider.max).toBe('0');
    expect(slider.getAttribute('aria-valuetext')).toBe('08:00');
  });

  it('shows an empty observation state without synthesizing timestamps or values', async () => {
    await openObservations({ measurements: [] });
    expect(container.textContent).toContain('No observations are available for this Simulation Run.');
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(mapSensor().querySelectorAll('span')).toHaveLength(0);
  });

  it('shows retrieval failure without fake/default observations or further requests', async () => {
    const fetcher = await openObservations({ measurementStatus: 404 });
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('Simulation observations are unavailable.');
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(mapSensor().querySelectorAll('span')).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('never renders Estimated Data or measurements referencing a different run', async () => {
    await openObservations({ measurements: [
      { ...rows[0], provenance: 'ESTIMATED', value: 999 },
      { ...rows[1], simulationRunId: 'other-run', value: 888 },
      rows[2],
    ] });
    parameterNames.slice(1).forEach(toggle);
    expect(mapSensor().textContent).toContain('NO2: 10 µg/m³ · SIMULATED');
    expect(container.textContent).not.toMatch(/ESTIMATED|999|888/);
  });
});

function ProtectedRequest() {
  const { authenticatedFetch } = useAuth();
  return (
    <main>
      <p>Authenticated content</p>
      <button type="button" onClick={() => void authenticatedFetch('/api/protected')}>Load protected data</button>
    </main>
  );
}
