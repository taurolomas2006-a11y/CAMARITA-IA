import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createVisionEngine } from '../src/services/visionEngine.js';
import { startContinuousDetection } from '../src/services/detectionLoop.js';

const model = JSON.parse(await readFile(new URL('../public/models/ssd-todo-50ep-v1/model.json', import.meta.url), 'utf8'));
function mockBrowser(t) {
  for (const key of ['Worker', 'OffscreenCanvas', 'createImageBitmap']) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; });
  }
  globalThis.Worker = class { postMessage() {} terminate() {} };
  globalThis.OffscreenCanvas = class {};
  globalThis.createImageBitmap = () => {};
}

test('using a disposed engine consistently reports cancellation and releases the captured bitmap', async (t) => {
  mockBrowser(t);
  const engine = createVisionEngine(model);
  engine.dispose();
  let closed = 0;
  await assert.rejects(engine.infer({ close() { closed++; } }), { name: 'AbortError' });
  await assert.rejects(engine.load(new ArrayBuffer(1)), { name: 'AbortError' });
  assert.equal(closed, 1);
});

test('disposal while capture is pending does not report an old model error to a new load', async (t) => {
  mockBrowser(t);
  const engine = createVisionEngine(model);
  let releaseCapture;
  const capture = new Promise((resolve) => { releaseCapture = resolve; });
  let failures = 0;
  let observations = 0;
  let closed = 0;
  const stop = startContinuousDetection({ capture: () => capture, infer: engine.infer, onResult: () => observations++, onError: () => failures++, onMetrics() {}, isVisible: () => true });
  engine.dispose();
  releaseCapture({ sequence: 1, bitmap: { close() { closed++; } } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  stop();
  assert.equal(failures, 0);
  assert.equal(observations, 0);
  assert.equal(closed, 1);
});
