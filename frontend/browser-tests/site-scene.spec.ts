import { expect, test } from '@playwright/test';

import { openTwin, twinPath } from './helpers';
import { writeFileSync } from 'node:fs';

test('real scene aligns API geometry, frames Site, and preserves no-run/ADMIN generation and observation controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let measurementRequests = 0, assetRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/measurements')) measurementRequests++;
    if (request.url().endsWith('/geography/innovation-campus.json')) assetRequests++;
  });
  await page.route('**/simulation-runs/latest', (route) => route.fulfill({ status: 204 }));
  await openTwin(page, 'ADMIN');
  await expect(page.getByText('No simulation data is available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toBeEnabled();
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  const alignment = await page.evaluate(async () => {
    const probe = (window as any).siteSceneProbe;
    const token = localStorage.getItem('digital-twin-access-token');
    const url = '/api/customers/20000000-0000-0000-0000-000000000001/digital-twins/40000000-0000-0000-0000-000000000001';
    const data = await (await fetch(url + '/sensors', { headers: { Authorization: `Bearer ${token}` } })).json();
    const mismatches = data.filter((sensor: any) => {
      const actual = probe.state.scene.getObjectByName(sensor.id).position.toArray();
      const expected = probe.frame.toGround([sensor.location.longitude, sensor.location.latitude]);
      return actual.some((value: number, i: number) => Math.abs(value - expected[i]) > 0.001);
    });
    const boundary = probe.state.scene.getObjectByName('Site boundary');
    const corners = probe.frame.rings[0].map((point: number[]) => {
      const v = boundary.position.clone().set(...point).project(probe.state.camera);
      return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
    });
    return { mismatches, framed: corners.every(Boolean), orthographic: probe.state.camera.isOrthographicCamera };
  });
  expect(alignment).toEqual({ mismatches: [], framed: true, orthographic: true });
  await page.unroute('**/simulation-runs/latest');
  await page.getByRole('button', { name: 'Generate Simulation', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveAttribute('max', '40');
  const assetRequestsBeforeExploring = assetRequests;
  for (const label of ['PM10', 'NO2', 'CO2']) await page.getByLabel(label, { exact: true }).check();
  const map = page.getByRole('group', { name: 'Central Court map Sensor', exact: true });
  await expect(map.locator('.map-badge')).toHaveCount(4);
  const staticBefore = await page.evaluate(() => (window as any).siteSceneProbe.state.scene.getObjectByName('Geographic environment').uuid);
  const valuesBefore = await map.textContent();
  await page.getByRole('slider').fill('40');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', '18:00');
  expect(await map.textContent()).not.toBe(valuesBefore);
  expect(await page.evaluate(() => (window as any).siteSceneProbe.state.scene.getObjectByName('Geographic environment').uuid)).toBe(staticBefore);
  expect(measurementRequests).toBe(1);
  expect(assetRequests).toBe(assetRequestsBeforeExploring);
  await map.locator('.map-badge').first().click();
  await expect(page.getByRole('dialog', { name: 'Central Court observations' })).toContainText('SIMULATED');
  await expect(page.getByRole('dialog').locator('li')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/site-observations.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('camera pan/zoom/constrained orbit/reset, source object picking and Sensor picking coexist', async ({ page }) => {
  await openTwin(page);
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  const camera = () => page.evaluate(() => {
    const p = (window as any).siteSceneProbe;
    return { position: p.state.camera.position.toArray(), zoom: p.state.camera.zoom, target: p.controls.current.target.toArray() };
  });
  const initial = await camera();
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 15 }); await page.mouse.up();
  expect((await camera()).position).not.toEqual(initial.position);
  expect(await page.evaluate(() => {
    const c = (window as any).siteSceneProbe.controls.current;
    return c.getPolarAngle() >= c.minPolarAngle - 0.00001 && c.getPolarAngle() <= c.maxPolarAngle + 0.00001;
  })).toBe(true);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await camera()).zoom).not.toBe(initial.zoom);
  await page.mouse.down({ button: 'right' }); await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 10 }); await page.mouse.up({ button: 'right' });
  expect((await camera()).target).not.toEqual(initial.target);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset to Site', exact: true }).click();
  await expect.poll(camera).toEqual(initial);
  // Actual pointer dispatch at a projected roof centroid; no mocked WebGL/picking.
  const screen = await page.evaluate(() => {
    const p = (window as any).siteSceneProbe;
    const group = p.state.scene.getObjectByName('Geographic environment');
    const mesh = group.children.find((child: any) => child.name.startsWith('Context sector') && child.children[0].geometry.attributes.position.count > 0).children[0];
    const positions = mesh.geometry.attributes.position;
    const point = mesh.position.clone();
    for (let index = 0; index < positions.count; index += 3) {
      if (positions.getY(index) === 18 && positions.getY(index + 1) === 18 && positions.getY(index + 2) === 18) {
        point.set((positions.getX(index) + positions.getX(index+1) + positions.getX(index+2))/3, 18,
          (positions.getZ(index) + positions.getZ(index+1) + positions.getZ(index+2))/3); break;
      }
    }
    point.project(p.state.camera);
    const rect = p.state.gl.domElement.getBoundingClientRect();
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1-point.y) * rect.height / 2 };
  });
  await page.mouse.move(screen.x, screen.y);
  await expect.poll(() => page.evaluate(() => (window as any).siteSceneProbe.state.scene
    .getObjectByName('Geographic environment').children.some((object: any) => object.isMesh && object.material.color.getHexString() === 'efbd63'))).toBe(true);
  await page.mouse.click(screen.x, screen.y);
  await expect(page.getByRole('complementary', { name: 'Environment context' })).toContainText('Real height: unavailable');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('group', { name: 'North Gate map Sensor', exact: true }).getByRole('button', { name: 'North Gate', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'North Gate observations' })).toBeVisible();
  await page.screenshot({ path: 'test-results/site-context.png', fullPage: true });
});

test('optional asset failure preserves CUSTOMER observation exploration and read-only behavior', async ({ page }) => {
  await page.route('**/geography/innovation-campus.json', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await openTwin(page);
  await expect(page.locator('p[role="status"]')).toContainText('Geographic environment unavailable');
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'North Gate map Sensor', exact: true }).getByRole('button', { name: 'North Gate', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'North Gate observations' })).toBeVisible();
  await expect(page.getByRole('slider')).toBeVisible();
  await page.screenshot({ path: 'test-results/site-asset-failure.png', fullPage: true });
});

test('browser rejects direct navigation to another Customer and clears an invalid session', async ({ page }) => {
  await openTwin(page);
  await page.goto('/customers/20000000-0000-0000-0000-000000000002/digital-twins/40000000-0000-0000-0000-000000000003');
  await expect(page.getByRole('alert')).toContainText('Digital Twin data is unavailable');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('digital-twin-access-token', 'invalid.jwt'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('digital-twin-access-token'))).toBeNull();
});


test('CUSTOMER no-run and malformed context remain usable without generation', async ({ page }) => {
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/simulation-runs')) posts++; });
  await page.route('**/simulation-runs/latest', (route) => route.fulfill({ status: 204 }));
  await page.route('**/geography/innovation-campus.json', (route) => route.fulfill({ status: 200, body: 'invalid JSON' }));
  await openTwin(page);
  await expect(page.getByText('No simulation data is available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Geographic snapshot is invalid');
  await expect(page.getByRole('button', { name: 'Generate Simulation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: /map Sensor$/ })).toHaveCount(6);
  await page.getByRole('button', { name: 'Inspect North Gate', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'North Gate observations' })).toContainText('No observation at this timestamp');
  expect(posts).toBe(0);
  expect(await page.evaluate(() => Boolean((window as any).siteSceneProbe.state.scene.getObjectByName('Site boundary')))).toBe(true);
});

test('rendered source footprint vertices and road centers align; marker ray picking and full badges remain readable', async ({ page }) => {
  await openTwin(page);
  await page.goto('/customers');
  const start = Date.now();
  await page.goto(twinPath);
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  await expect(page.getByRole('slider')).toBeVisible();
  await page.waitForFunction(() => (window as any).siteSceneProbe?.state.gl.info.memory.geometries === 18);
  const sceneLoadMs = Date.now() - start;
  for (const parameter of ['PM10', 'NO2', 'CO2']) await page.getByLabel(parameter, { exact: true }).check();
  await expect(page.locator('.map-badge')).toHaveCount(12);
  const geometry = await page.evaluate(async () => {
    const p = (window as any).siteSceneProbe;
    const snapshot = await (await fetch('/geography/innovation-campus.json')).json();
    const buildings = new Set<string>(), roads = new Set<string>();
    const key = (x: number, z: number) => `${Math.round(x * 1000)}/${Math.round(z * 1000)}`;
    const matches = (set: Set<string>, x: number, z: number) => {
      for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
        if (set.has(`${Math.round(x * 1000) + dx}/${Math.round(z * 1000) + dz}`)) return true;
      }
      return false;
    };
    for (const group of p.state.scene.getObjectByName('Geographic environment').children) {
      if (!group.name.startsWith('Context sector')) continue;
      const mesh = group.children[0], positions = mesh.geometry.attributes.position;
      if (mesh.material.color.getHexString() === 'c4cbbd') {
        for (let i = 0; i < positions.count; i++) buildings.add(key(positions.getX(i), positions.getZ(i)));
      } else {
        for (let i = 0; i < positions.count; i += 6) {
          roads.add(key((positions.getX(i) + positions.getX(i+2))/2, (positions.getZ(i) + positions.getZ(i+2))/2));
          roads.add(key((positions.getX(i+1) + positions.getX(i+5))/2, (positions.getZ(i+1) + positions.getZ(i+5))/2));
        }
      }
    }
    const missing = (coordinates: number[][], set: Set<string>) => coordinates.filter((coordinate) => {
      const [x, , z] = p.frame.toGround(coordinate); return !matches(set, x, z);
    }).length;
    const outline = p.state.scene.getObjectByName('Site boundary outline').geometry.attributes.position;
    const boundaryMatches = p.frame.rings[0].every((point: number[], i: number) =>
      Math.abs(outline.getX(i) - point[0]) < 0.001 && Math.abs(outline.getZ(i) - point[2]) < 0.001);
    return { missingBuildings: missing(snapshot.buildings.flatMap((b: any) => b.coordinates.flat()), buildings),
      missingRoads: missing(snapshot.roads.flatMap((r: any) => r.coordinates), roads), boundaryMatches };
  });
  expect(geometry).toEqual({ missingBuildings: 0, missingRoads: 0, boundaryMatches: true });
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const screen = await page.evaluate(() => {
    const p = (window as any).siteSceneProbe;
    const marker = p.state.scene.getObjectByName('50000000-0000-0000-0000-000000000001');
    // A real marker point, below its DOM label; dispatch through the Canvas raycaster.
    const point = marker.position.clone(); point.y = 5; point.project(p.state.camera);
    const rect = p.state.gl.domElement.getBoundingClientRect();
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1-point.y) * rect.height / 2 };
  });
  await page.mouse.click(screen.x, screen.y);
  await expect(page.getByRole('dialog', { name: 'North Gate observations' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Sensor details', exact: true }).click();
  const overlaps = await page.locator('.sensor-label').evaluateAll((labels) => {
    const rectangles = labels.map((label) => label.getBoundingClientRect());
    return rectangles.some((a, i) => rectangles.slice(i+1).some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
  });
  expect(overlaps).toBe(false);
  await page.locator('section[aria-label="Site visualization"]').screenshot({ path: '../docs/site-scene.png' });
  writeFileSync('../docs/site-scene-load.json', JSON.stringify({ sceneLoadMs, description: 'Development scene mount after login; cached application modules, new geographic fetch', geometry }, null, 2));
});

test('Sensor priority: Library Walk and North Gate markers own Canvas clicks at reset', async ({ page }) => {
  await openTwin(page);
  await expect(page.getByText(/Layout:.*OpenStreetMap contributors/)).toBeVisible();
  const initialPosition = await page.evaluate(() => (window as any).siteSceneProbe.state.camera.position.toArray());
  const reset = async () => {
    await page.getByRole('button', { name: 'Reset to Site', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).siteSceneProbe.state.camera.position.toArray())).toEqual(initialPosition);
    await page.locator('canvas').scrollIntoViewIfNeeded();
  };
  for (const name of ['Library Walk', 'North Gate']) {
    await reset();
    const screen = await page.evaluate(async (sensorName) => {
      const probe = (window as any).siteSceneProbe;
      const token = localStorage.getItem('digital-twin-access-token');
      const sensors = await (await fetch('/api' + location.pathname + '/sensors', { headers: { Authorization: `Bearer ${token}` } })).json();
      const sensor = sensors.find((row: any) => row.name === sensorName);
      const marker = probe.state.scene.getObjectByName(sensor.id).children[0];
      const point = marker.getWorldPosition(marker.position.clone()).project(probe.state.camera);
      const rect = probe.state.gl.domElement.getBoundingClientRect();
      const x = rect.x + (point.x + 1) * rect.width / 2, y = rect.y + (1-point.y) * rect.height / 2;
      return { x, y, element: document.elementFromPoint(x, y)?.tagName };
    }, name);
    expect(screen.element).toBe('CANVAS');
    await page.mouse.move(screen.x, screen.y);
    await expect.poll(() => page.evaluate(() => (window as any).siteSceneProbe.state.scene
      .getObjectByName('Geographic environment').children.some((object: any) => object.isMesh && object.material.color.getHexString() === 'efbd63'))).toBe(false);
    await page.mouse.click(screen.x, screen.y);
    // The old Library Walk path selected way/802105049 instead of the visible marker.
    await expect(page.getByRole('complementary', { name: 'Environment context' })).toHaveCount(0);
    await expect(page.getByText(/Source feature: way\/802105049/)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: `${name} observations` })).toBeVisible();
    await page.getByRole('button', { name: 'Close Sensor details', exact: true }).click();
    // Start actual orbit/pan gestures on the marker, rather than an empty Canvas area.
    for (const button of ['left', 'right'] as const) for (const returnToStart of [false, true]) {
      await reset();
      const before = await page.evaluate(() => {
        const p = (window as any).siteSceneProbe;
        return { position: p.state.camera.position.toArray(), target: p.controls.current.target.toArray() };
      });
      await page.mouse.move(screen.x, screen.y);
      await page.mouse.down({ button });
      await page.mouse.move(screen.x + 60, screen.y + 30, { steps: 12 });
      const after = await page.evaluate(() => {
        const p = (window as any).siteSceneProbe;
        return { position: p.state.camera.position.toArray(), target: p.controls.current.target.toArray() };
      });
      expect(button === 'left' ? after.position : after.target).not.toEqual(button === 'left' ? before.position : before.target);
      // Out-and-back must remain a drag even though the final displacement is zero.
      if (returnToStart) await page.mouse.move(screen.x, screen.y, { steps: 12 });
      await page.mouse.up({ button });
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // A completed drag must not poison the next ordinary Canvas click.
      await reset();
      await page.mouse.click(screen.x, screen.y);
      await expect(page.getByRole('dialog', { name: `${name} observations` })).toBeVisible();
      await page.getByRole('button', { name: 'Close Sensor details', exact: true }).click();
    }
    // Exercise cancellation separately; selection and all drags above use real mouse input.
    for (const type of ['pointercancel', 'lostpointercapture']) {
      await reset();
      await page.locator('canvas').evaluate((canvas) => {
        canvas.addEventListener('pointerdown', (event) => {
          canvas.dataset.testPointerId = String(event.pointerId);
        }, { once: true });
      });
      await page.mouse.move(screen.x, screen.y);
      await page.mouse.down();
      await page.locator('canvas').evaluate((canvas, eventType) => {
        canvas.dispatchEvent(new PointerEvent(eventType, { pointerId: Number(canvas.dataset.testPointerId), bubbles: true }));
        delete canvas.dataset.testPointerId;
      }, type);
      await page.mouse.up();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.mouse.click(screen.x, screen.y);
      await expect(page.getByRole('dialog', { name: `${name} observations` })).toBeVisible();
      await page.getByRole('button', { name: 'Close Sensor details', exact: true }).click();
    }
  }
});
