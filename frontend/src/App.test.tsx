// @vitest-environment jsdom

import { act, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthBoundary, useAuth } from './auth/AuthBoundary';

const scene = vi.hoisted(() => ({ add: vi.fn(), setView: vi.fn(), destroy: vi.fn() }));
vi.mock('cesium', () => ({
  Viewer: class {
    entities = { add: scene.add };
    camera = { setView: scene.setView };
    destroy = scene.destroy;
  },
  Cartesian3: {
    fromDegreesArray: (coordinates: number[]) => coordinates,
    fromDegrees: (longitude: number, latitude: number) => [longitude, latitude],
  },
  Cartesian2: class {
    constructor(public x: number, public y: number) {}
  },
  Rectangle: { fromDegrees: (...bounds: number[]) => bounds },
  EllipsoidTerrainProvider: class {},
  Color: {
    CYAN: { withAlpha: () => 'transparent cyan' },
    YELLOW: 'yellow',
    WHITE: 'white',
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
    expect(action?.disabled).toBe(true);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      '/api/me', '/api/customers/customer-a/digital-twins/twin-a',
      '/api/customers/customer-a/digital-twins/twin-a/sensors',
    ]);
  });

  it('keeps CUSTOMER read-only while showing the same empty scene', async () => {
    await openTwin('CUSTOMER');
    expect(container.textContent).toContain('No simulation data is available.');
    expect(container.textContent).toContain('North Gate');
    expect(container.textContent).not.toContain('Generate Simulation');
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
