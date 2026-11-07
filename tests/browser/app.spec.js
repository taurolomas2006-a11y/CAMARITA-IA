import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('honest initial state, real ONNX worker inference and mobile layout', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Camarita IA', exact: true })).toBeVisible();
  await expect(page.getByText('No conectado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cargar y validar modelo' })).toBeEnabled();
  await expect(page.locator('tbody')).toContainText('Todavía no hay unidades');
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByText('CPU · WebAssembly SIMD · 1 hilo', { exact: true })).toBeVisible({ timeout: 60000 });
  const result = await page.evaluate(async () => {
    const { createVisionEngine } = await import('/src/services/visionEngine.js');
    const { verifyModel } = await import('/src/services/modelCatalog.js');
    const { decodeSsd } = await import('/src/domain/ssd.js');
    const { deduplicateUnits } = await import('/src/domain/deduplicate.js');
    const catalog = await (await fetch('/models/catalog.json', { cache: 'no-store' })).json();
    const model = { ...catalog.models[0], confidenceThreshold: 0.01 };
    const reference = await (await fetch('/tests/fixtures/ssd-reference.json')).json();
    const dims = { detection_boxes: [1, 100, 4], detection_scores: [1, 100], detection_classes: [1, 100], num_detections: [1] };
    const expected = deduplicateUnits(decodeSsd(Object.fromEntries(Object.entries(reference).map(([name, data]) => [model.outputs[name], { dims: dims[name], data: Float32Array.from(data.flat(3)) }])), model), model.duplicateIouThreshold);
    const engine = createVisionEngine(model);
    try {
      const bytes = await verifyModel(model);
      await engine.load(bytes);
      const image = await createImageBitmap(await (await fetch('/tests/fixtures/ssd-reference.png')).blob());
      let heartbeats = 0;
      const interval = setInterval(() => heartbeats++, 10);
      const actual = await engine.infer(image);
      clearInterval(interval);
      let maxError = 0;
      if (actual.detections.length !== expected.length) throw new Error('Different detection counts');
      actual.detections.forEach((unit, index) => {
        if (unit.classId !== expected[index].classId) throw new Error('Different class IDs');
        maxError = Math.max(maxError, Math.abs(unit.confidence - expected[index].confidence), ...Object.keys(unit.box).map((key) => Math.abs(unit.box[key] - expected[index].box[key])));
      });
      return { count: actual.detections.length, maxError, durationMs: actual.durationMs, heartbeats, userAgent: navigator.userAgent };
    } finally { engine.dispose(); }
  });
  expect(result.count).toBeGreaterThan(0);
  expect(result.maxError).toBeLessThan(0.003);
  expect(result.heartbeats).toBeGreaterThan(0);
  console.log(testInfo.project.name, JSON.stringify(result));
  await testInfo.attach('real-model-results', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-mobile.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('HTTP failure does not invent or remove inventory, RTSP cannot be used as an HTTP URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Fuente', exact: true }).selectOption('snapshot');
  await page.getByLabel('Dirección de una foto HTTP').fill('rtsp://camera.invalid');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'RTSP requiere el puente' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Todavía no hay unidades');
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
});

test('real SSD detections update overlays and inventory; HTTP interruption preserves units until recovery', async ({ page }) => {
  const referencePng = readFileSync('tests/fixtures/ssd-reference.png');
  let available = true;
  await page.route('**/test-camera.jpg', (route) => available ? route.fulfill({ contentType: 'image/png', body: referencePng }) : route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByText('CPU · WebAssembly SIMD · 1 hilo', { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('combobox', { name: 'Fuente', exact: true }).selectOption('snapshot');
  await page.getByLabel('Dirección de una foto HTTP').fill('http://127.0.0.1:5173/test-camera.jpg');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.locator('.detection-box')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const originalIds = await page.locator('tbody td:first-child .cell-detail').allTextContents();
  available = false;
  await expect(page.getByRole('status').filter({ hasText: 'HTTP respondió 503' })).toBeVisible();
  await expect(page.getByText('Por confirmar', { exact: true })).toHaveCount(1);
  await expect(page.locator('.detection-box')).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.locator('.detection-box')).toHaveCount(1, { timeout: 30000 });
  expect(await page.locator('tbody td:first-child .cell-detail').allTextContents()).toEqual(originalIds);
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
});

test('reloading a model while its worker is processing does not abort the new load', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const pending = new Set();
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({ data }) => { pending.delete(data.id); window.testInferencePending = pending.size > 0; });
      }
      postMessage(message, ...args) {
        if (message.type === 'infer') { pending.add(message.id); window.testInferencePending = true; }
        return super.postMessage(message, ...args);
      }
    };
  });
  await page.route('**/test-camera.jpg', (route) => route.fulfill({ contentType: 'image/png', body: readFileSync('tests/fixtures/ssd-reference.png') }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByText('CPU · WebAssembly SIMD · 1 hilo', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('combobox', { name: 'Fuente', exact: true }).selectOption('snapshot');
  await page.getByLabel('Dirección de una foto HTTP').fill('http://127.0.0.1:5173/test-camera.jpg');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const wait = () => { if (window.testInferencePending) resolve(); else setTimeout(wait, 5); };
      wait();
    });
    Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Cargar y validar modelo').click();
  });
  await expect(page.getByText('CPU · WebAssembly SIMD · 1 hilo', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.detection-box')).toHaveCount(1, { timeout: 30000 });
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
});

test('missing and tampered model files are reported; changed catalog invalidates stored selection', async ({ page }) => {
  await page.route('**/models/ssd-todo-50ep-v1/model.onnx?*', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Archivo ausente' })).toBeVisible();
  await page.unroute('**/models/ssd-todo-50ep-v1/model.onnx?*');
  const catalog = JSON.parse(readFileSync('public/models/catalog.json', 'utf8'));
  await page.route('**/models/ssd-todo-50ep-v1/model.onnx?*', (route) => route.fulfill({ status: 200, body: Buffer.alloc(catalog.models[0].bytes) }));
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'no coincide con su huella' })).toBeVisible();
  await page.evaluate((model) => localStorage.setItem('camarita-selected-model-v1', `${model.id}@${model.version}:${model.sha256}`), catalog.models[0]);
  catalog.models[0].sha256 = '0'.repeat(64);
  await page.route('**/models/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.getByRole('button', { name: 'Actualizar catálogo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'versión seleccionada cambió' })).toBeVisible();
  await expect(page.getByLabel('Modelo seleccionado')).toHaveValue('');
});

test('persisted units resume unconfirmed and their clock keeps running', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { useInventoryStore } = await import('/src/store/useInventoryStore.js');
    const unit = { classId: 0, label: 'Fixture de prueba', confidence: 0.9, box: { x: 0.1, y: 0.1, width: 0.2, height: 0.4 } };
    useInventoryStore.getState().applyDetections([unit, { ...unit, box: { ...unit.box, x: 0.6 } }], 'test-only', Date.now() - 5000);
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.reload();
  await expect(page.getByText('Fixture de prueba', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Por confirmar', { exact: true })).toHaveCount(2);
  const firstTime = await page.locator('tbody time').first().textContent();
  await expect.poll(() => page.locator('tbody time').first().textContent()).not.toBe(firstTime);
});

test.describe('service worker migration', () => {
  test.use({ serviceWorkers: 'allow' });
  test('old app cache is retired without touching local inventory or unrelated caches', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const current = await navigator.serviceWorker.ready;
      await current.unregister();
      await (await caches.open('inventory-scanner-v1')).put('/old-test-resource', new Response('stale test bytes'));
      await (await caches.open('unrelated-test-cache')).put('/other-test-resource', new Response('other data'));
      localStorage.setItem('cache-migration-test', 'keep');
      await navigator.serviceWorker.register('/sw.js?migration-test=1', { updateViaCache: 'none' });
    });
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('inventory-scanner-v1'))).toBe(false);
    expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-test-cache'))).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('cache-migration-test'))).toBe('keep');
  });
});
