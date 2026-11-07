import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('compiled app loads its local WASM, executes the real SSD and renders detections', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/test-camera.jpg', (route) => route.fulfill({ contentType: 'image/png', body: readFileSync('tests/fixtures/ssd-reference.png') }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar y validar modelo' }).click();
  await expect(page.getByText('CPU · WebAssembly SIMD · 1 hilo', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('combobox', { name: 'Fuente', exact: true }).selectOption('snapshot');
  await page.getByLabel('Dirección de una foto HTTP').fill('http://127.0.0.1:4173/test-camera.jpg');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.locator('.detection-box')).toHaveCount(1, { timeout: 30000 });
  await expect(page.getByText('Detectada', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/production-detections.png', fullPage: true });
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
  expect(errors).toEqual([]);
});
