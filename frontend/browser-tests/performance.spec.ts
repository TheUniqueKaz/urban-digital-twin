import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createSimulationRun, openTwin, twinPath } from './helpers';

test('frozen 1080p workload: three normal and three reduced 60-second camera runs', async ({ page, browser, request }) => {
  test.skip(process.env.RUN_SCENE_BENCHMARK !== '1', 'Explicit benchmark run only.');
  const runId = await createSimulationRun(request);
  test.setTimeout(500_000);
  const requests: { url: string; bytes: number }[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/geography/')) requests.push({ url: response.url(), bytes: (await response.body()).length });
  });
  const started = Date.now();
  await openTwin(page, 'CUSTOMER');
  await expect(page.getByRole('region', { name: 'Latest Simulation Run' })).toContainText(runId);
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toHaveCount(0);
  for (const parameter of ['PM10', 'NO2', 'CO2']) await page.getByLabel(parameter, { exact: true }).check();
  await page.goto(twinPath + '?sceneBenchmark=1');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  // Local selection initializes per navigation; select all four on the fullscreen page.
  for (const parameter of ['PM10', 'NO2', 'CO2']) {
    const toggle = page.getByLabel(parameter, { exact: true });
    await expect(toggle).toBeAttached();
    // The benchmark Canvas intentionally covers the ordinary controls.
    await toggle.evaluate((input: HTMLInputElement) => { if (!input.checked) input.click(); });
    await expect(toggle).toBeChecked();
  }
  await expect(page.locator('.map-badge')).toHaveCount(12);
  const coldLoadMs = Date.now() - started;
  const renderer = await page.evaluate(() => {
    const p = (window as any).siteSceneProbe;
    const gl = p.state.gl.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'Unavailable',
      vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : 'Unavailable', userAgent: navigator.userAgent };
  });
  const runs: unknown[] = [];
  for (const reduced of [false, true]) {
    await page.getByLabel('Reduced quality', { exact: true }).setChecked(reduced);
    for (let index = 0; index < 3; index++) {
      await page.getByRole('button', { name: 'Reset to Site', exact: true }).click();
      const result = await page.evaluate(() => (window as any).siteSceneProbe.runBenchmark());
      runs.push(result); console.log(JSON.stringify(result));
      mkdirSync('test-results', { recursive: true });
      writeFileSync('test-results/performance.json', JSON.stringify({ browser: browser.version(), renderer, coldLoadMs,
        runs, badgeCount: 12, geographicRequests: requests, cleanupPending: true }, null, 2));
    }
  }
  const beforeIdle = await page.evaluate(() => (window as any).siteSceneProbe.renderedFrames);
  await page.waitForTimeout(2000);
  const idleFrames = await page.evaluate(() => (window as any).siteSceneProbe.renderedFrames) - beforeIdle;
  const navigation: unknown[] = [];
  for (let index = 0; index < 3; index++) {
    await page.goto('/customers');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean((window as any).siteSceneProbe))).toBe(false);
    await page.goto(twinPath + '?sceneBenchmark=1');
    await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
    await page.waitForFunction(() => (window as any).siteSceneProbe?.state.gl.info.memory.geometries === 18);
    navigation.push(await page.evaluate(() => {
      const p = (window as any).siteSceneProbe;
      return { geometries: p.state.gl.info.memory.geometries, textures: p.state.gl.info.memory.textures,
        canvases: document.querySelectorAll('canvas').length };
    }));
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/performance.json', JSON.stringify({ browser: browser.version(), renderer, coldLoadMs,
    runs, badgeCount: 12, idleFrames, navigation, geographicRequests: requests }, null, 2));
  await page.screenshot({ path: 'test-results/site-benchmark.png' });
});
