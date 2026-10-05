import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createSimulationRun, openTwin, twinPath } from './helpers';

test('profile reduced-quality frame tails on the frozen camera workload', async ({ page, request }) => {
  test.skip(process.env.RUN_SCENE_PROFILE !== '1', 'Explicit diagnostic run only.');
  const runId = await createSimulationRun(request);
  test.setTimeout(100_000);
  await openTwin(page);
  await expect(page.getByRole('region', { name: 'Latest Simulation Run' })).toContainText(runId);
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toHaveCount(0);
  await page.goto(twinPath + '?sceneBenchmark=1');
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  for (const parameter of ['PM10', 'NO2', 'CO2']) {
    const toggle = page.getByLabel(parameter, { exact: true });
    await expect(toggle).toBeAttached();
    // The benchmark Canvas intentionally covers the ordinary controls.
    await toggle.evaluate((input: HTMLInputElement) => { if (!input.checked) input.click(); });
    await expect(toggle).toBeChecked();
  }
  await expect(page.locator('.map-badge')).toHaveCount(12);
  await page.getByLabel('Reduced quality', { exact: true }).check();
  const session = await page.context().newCDPSession(page);
  await session.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.gc', transferMode: 'ReturnAsStream' });
  const result = await page.evaluate(() => (window as any).siteSceneProbe.runBenchmark());
  const completed = new Promise<any>((resolve) => session.once('Tracing.tracingComplete', resolve));
  await session.send('Tracing.end');
  const { stream } = await completed;
  let trace = '';
  while (true) {
    const part = await session.send('IO.read', { handle: stream });
    trace += part.data;
    if (part.eof) break;
  }
  await session.send('IO.close', { handle: stream });
  const events = JSON.parse(trace).traceEvents.filter((event: any) => event.ph === 'X' && event.dur);
  const summary = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  for (const event of events) {
    const item = summary.get(event.name) ?? { count: 0, totalMs: 0, maxMs: 0 };
    item.count++; item.totalMs += event.dur / 1000; item.maxMs = Math.max(item.maxMs, event.dur / 1000);
    summary.set(event.name, item);
  }
  const report = { result, badgeCount: await page.locator('.map-badge').count(),
    events: [...summary].map(([name, timing]) => ({ name, ...timing })).sort((a, b) => b.totalMs - a.totalMs) };
  writeFileSync('../docs/site-scene-profile.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(result));
});
