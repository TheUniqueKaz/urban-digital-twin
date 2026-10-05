import { expect, type APIRequestContext, type Page } from '@playwright/test';

const customer = '20000000-0000-0000-0000-000000000001';
const twin = '40000000-0000-0000-0000-000000000001';
export const twinPath = `/customers/${customer}/digital-twins/${twin}`;

export async function openTwin(page: Page, role = 'CUSTOMER', suffix = '') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(role === 'ADMIN' ? 'admin@example.com' : 'customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill(role === 'ADMIN' ? 'admin-demo-password' : 'customer-demo-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Saigon Campus Group', exact: true }).click();
  await page.getByRole('link', { name: 'Open Innovation Campus Digital Twin', exact: true }).click();
  if (suffix) await page.goto(twinPath + suffix);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('group', { name: 'North Gate map Sensor', exact: true })).toBeVisible();
  if (process.env.RUN_SCENE_PRODUCTION !== '1') await page.waitForFunction(() => Boolean((window as any).siteSceneProbe));
}

// Each optional mode creates its own immutable run via the authorized ADMIN API.
// Use only the isolated, seeded browser-test backend; the page remains CUSTOMER.
export async function createSimulationRun(request: APIRequestContext): Promise<string> {
  const login = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin-demo-password' },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const response = await request.post('/api' + twinPath + '/simulation-runs', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(201);
  const run = await response.json();
  expect(run.id).toEqual(expect.any(String));
  return run.id;
}
