import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCatalog, validateModel, modelKey } from '../src/domain/modelCatalog.js';
import { buildCatalog } from '../scripts/build-model-catalog.mjs';
import { decodeSsd, validateSsdContract } from '../src/domain/ssd.js';

const metadata = { id: 'test-v1', name: 'Test fixture', version: '1.0.0', format: 'onnx', file: 'model.onnx', labels: ['agua'] };
test('catalog builder detects versions/content changes and missing files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'camarita-models-'));
  try {
    await mkdir(join(root, metadata.id));
    await writeFile(join(root, metadata.id, 'model.json'), JSON.stringify(metadata));
    await assert.rejects(buildCatalog(root), /ENOENT/);
    await writeFile(join(root, metadata.id, metadata.file), 'synthetic test bytes - not an executable model');
    const first = validateCatalog(await buildCatalog(root));
    await writeFile(join(root, metadata.id, metadata.file), 'changed test bytes');
    const second = validateCatalog(await buildCatalog(root));
    assert.notEqual(modelKey(first.models[0]), modelKey(second.models[0]));
    assert.notEqual(first.models[0].sha256, second.models[0].sha256);
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'camarita-models-'))); await rm(root, { recursive: true }); }
});
test('metadata rejects traversal, missing identifiers, unknown extensions and fake compatibility', () => {
  assert.throws(() => validateModel({ ...metadata, id: '../elsewhere' }));
  assert.throws(() => validateModel({ ...metadata, id: undefined }));
  assert.throws(() => validateModel({ ...metadata, file: '../model.onnx' }));
  assert.throws(() => validateModel({ ...metadata, format: 'tflite' }));
  assert.throws(() => validateSsdContract(metadata));
});
test('SSD decoder respects the threshold, class offset and normalized yxyx; rejects incompatible output', () => {
  const model = { labels: ['agua'], classIdOffset: 1, confidenceThreshold: 0.5, outputs: { detection_boxes: 'boxes', detection_scores: 'scores', detection_classes: 'classes', num_detections: 'count' } };
  const values = { boxes: { dims: [1, 2, 4], data: [0.1, 0.2, 0.7, 0.4, 0, 0, 1, 1] }, scores: { dims: [1, 2], data: [0.9, 0.2] }, classes: { dims: [1, 2], data: [1, 1] }, count: { data: [2] } };
  const decoded = decodeSsd(values, model);
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].classId, 0);
  assert.equal(decoded[0].box.x, 0.2);
  assert.equal(decoded[0].box.y, 0.1);
  assert.throws(() => decodeSsd({ ...values, count: { data: [4] } }, model));
});
