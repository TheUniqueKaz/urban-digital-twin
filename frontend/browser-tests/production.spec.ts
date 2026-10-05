import { expect, test } from '@playwright/test';
import { createSimulationRun, openTwin } from './helpers';

test('production scene preserves full badges and Sensor detail without development diagnostics', async ({ page, request }) => {
  test.skip(process.env.RUN_SCENE_PRODUCTION !== '1', 'Explicit production build verification only.');
  const runId = await createSimulationRun(request);
  await openTwin(page);
  await expect(page.getByRole('region', { name: 'Latest Simulation Run' })).toContainText(runId);
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  for (const parameter of ['PM10', 'NO2', 'CO2']) await page.getByLabel(parameter, { exact: true }).check();
  await expect(page.locator('.map-badge')).toHaveCount(12);
  await expect(page.getByRole('group', { name: /map Sensor$/ })).toHaveCount(6);
  await page.getByRole('group', { name: 'Central Court map Sensor', exact: true }).locator('.map-badge').first().click();
  await expect(page.getByRole('dialog', { name: 'Central Court observations' })).toContainText('SIMULATED');
  await expect(page.getByRole('dialog').locator('li')).toHaveCount(4);
  expect(await page.evaluate(() => Boolean((window as any).siteSceneProbe))).toBe(false);
  const overlaps = await page.locator('.sensor-label').evaluateAll((labels) => {
    const rectangles = labels.map((label) => label.getBoundingClientRect());
    return rectangles.some((a, i) => rectangles.slice(i+1).some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
  });
  expect(overlaps).toBe(false);
});
