// @vitest-environment jsdom

import { act, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthBoundary, useAuth } from './auth/AuthBoundary';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
    expect(window.location.pathname).toBe('/');
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

function ProtectedRequest() {
  const { authenticatedFetch } = useAuth();
  return (
    <main>
      <p>Authenticated content</p>
      <button type="button" onClick={() => void authenticatedFetch('/api/protected')}>Load protected data</button>
    </main>
  );
}
