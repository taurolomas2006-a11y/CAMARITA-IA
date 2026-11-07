import test from 'node:test';
import assert from 'node:assert/strict';
import { startContinuousDetection } from '../src/services/detectionLoop.js';
import { createInferenceGate } from '../src/services/inferenceGate.js';

test('continuous processing never overlaps and ignores results after stopping', async () => {
  let inFlight = 0;
  let highest = 0;
  let observations = 0;
  let sequence = 0;
  let complete;
  const processed = new Promise((resolve) => { complete = resolve; });
  const stop = startContinuousDetection({
    capture: async () => ({ sequence: sequence++, bitmap: { close() {} } }),
    infer: async () => { inFlight++; highest = Math.max(highest, inFlight); await new Promise((resolve) => setTimeout(resolve, 30)); inFlight--; return { detections: [], durationMs: 30 }; },
    onResult: () => { observations++; if (observations === 2) complete(); }, onError: assert.fail, onMetrics() {}, isVisible: () => true,
  });
  await processed;
  stop();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(highest, 1);
  assert.equal(observations, 2);
});
test('inference failure is reported once and never translated into an empty observation', async () => {
  let observations = 0;
  const failures = [];
  let complete;
  const failed = new Promise((resolve) => { complete = resolve; });
  const stop = startContinuousDetection({ capture: async () => ({ sequence: 1, bitmap: { close() {} } }), infer: async () => { throw new Error('model failed'); }, onResult: () => observations++, onError: (error) => { failures.push(error.message); complete(); }, onMetrics() {}, isVisible: () => true });
  await failed;
  stop();
  assert.equal(observations, 0);
  assert.deepEqual(failures, ['model failed']);
});

test('disposing an old engine during an inference does not fail a new model load', async () => {
  let failures = 0;
  let observations = 0;
  let finish;
  const cancelled = new Promise((resolve) => { finish = resolve; });
  const stop = startContinuousDetection({
    capture: async () => ({ sequence: 1, bitmap: { close() {} } }),
    infer: async () => { finish(); throw new DOMException('Model replaced', 'AbortError'); },
    onResult: () => observations++, onError: () => failures++, onMetrics() {}, isVisible: () => true,
  });
  await cancelled;
  await new Promise((resolve) => setTimeout(resolve, 0));
  stop();
  assert.equal(failures, 0);
  assert.equal(observations, 0);
});

test('two successive cycles sharing an engine cannot overlap or queue stale captures', async () => {
  let active = 0;
  let highest = 0;
  let calls = 0;
  let releaseFirst;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const holding = new Promise((resolve) => { releaseFirst = resolve; });
  const infer = createInferenceGate(async () => {
    active++; highest = Math.max(highest, active); calls++;
    if (calls === 1) { markStarted(); await holding; }
    active--;
    return { detections: [], durationMs: 1 };
  });
  let oldResults = 0;
  let closed = 0;
  let sequence = 0;
  let complete;
  const observed = new Promise((resolve) => { complete = resolve; });
  const capture = async () => ({ sequence: sequence++, bitmap: { close() { closed++; } } });
  const stopOld = startContinuousDetection({ capture, infer, onResult: () => oldResults++, onError: assert.fail, onMetrics() {}, isVisible: () => true });
  await started;
  stopOld();
  const stopNew = startContinuousDetection({ capture, infer, onResult: complete, onError: assert.fail, onMetrics() {}, isVisible: () => true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 1);
  assert.equal(closed, 1);
  releaseFirst();
  await observed;
  stopNew();
  assert.equal(highest, 1);
  assert.equal(oldResults, 0);
});

test('reported fps measures time between results, including the scheduler wait', async () => {
  const completions = [];
  const metrics = [];
  let complete;
  const observed = new Promise((resolve) => { complete = resolve; });
  let sequence = 0;
  const stop = startContinuousDetection({
    capture: async () => ({ sequence: sequence++, bitmap: { close() {} } }),
    infer: async () => { await new Promise((resolve) => setTimeout(resolve, 220)); return { detections: [], durationMs: 220 }; },
    onResult: () => completions.push(performance.now()),
    onMetrics: (value) => { metrics.push(value); if (metrics.length === 2) complete(); },
    onError: assert.fail, isVisible: () => true,
  });
  await observed;
  stop();
  assert.equal(metrics[0].fps, null);
  const measured = 1000 / (completions[1] - completions[0]);
  assert.ok(Math.abs(metrics[1].fps - measured) < 0.1);
  assert.ok(metrics[1].fps < 4);
});
