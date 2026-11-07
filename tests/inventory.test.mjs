import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInventory, pendingInventory, formatElapsed } from '../src/domain/tracker.js';
import { restoreInventory, saveInventory, STORAGE_KEY, LEGACY_KEY } from '../src/services/inventoryStorage.js';
import { deduplicateUnits } from '../src/domain/deduplicate.js';

// Synthetic fixtures are used only by tests; never loaded by the application.
const detection = (x, classId = 0) => ({ classId, label: classId ? 'agua' : 'coca_cola', confidence: 0.9, box: { x, y: 0.1, width: 0.12, height: 0.4 } });
test('near-identical boxes count once, keeping the best label; separate equal products survive', () => {
  const best = detection(0.1);
  const duplicate = { ...detection(0.101, 1), confidence: 0.7 };
  const separate = detection(0.6);
  const result = deduplicateUnits([duplicate, separate, best]);
  assert.equal(result.length, 2);
  assert.ok(result.includes(best));
  assert.ok(result.includes(separate));
  assert.ok(!result.includes(duplicate));
});
test('two equal products keep independent identities when detection order changes', () => {
  const first = reconcileInventory([], [detection(0.1), detection(0.6)], { now: 1000, context: 'camera-a', nextId: 1 });
  assert.equal(first.inventory.length, 2);
  assert.notEqual(first.inventory[0].id, first.inventory[1].id);
  const next = reconcileInventory(first.inventory, [detection(0.61), detection(0.11)], { now: 2000, context: 'camera-a', nextId: first.nextId });
  assert.equal(next.inventory[0].id, first.inventory[1].id);
  assert.equal(next.inventory[1].id, first.inventory[0].id);
  assert.equal(next.inventory[0].enteredAt, 1000);
});
test('a missing unit is removed; reappearance creates a new identity and timer', () => {
  const first = reconcileInventory([], [detection(0.1), detection(0.6)], { now: 1000, context: 'a' });
  const second = reconcileInventory(first.inventory, [detection(0.1)], { now: 2000, context: 'a', nextId: first.nextId });
  const third = reconcileInventory(second.inventory, [detection(0.1), detection(0.6)], { now: 3000, context: 'a', nextId: second.nextId });
  assert.notEqual(third.inventory[1].id, first.inventory[1].id);
  assert.equal(third.inventory[1].enteredAt, 3000);
  assert.equal(third.inventory[0].enteredAt, 1000);
  assert.deepEqual(reconcileInventory(third.inventory, [], { now: 4000, context: 'a', nextId: third.nextId }).inventory, []);
});
test('interruptions keep timestamps; first successful frame reconciles pending units', () => {
  const first = reconcileInventory([], [detection(0.1)], { now: 1000, context: 'a' });
  const pending = pendingInventory(first.inventory);
  assert.equal(pending[0].confirmed, false);
  const resumed = reconcileInventory(pending, [detection(0.11)], { now: 6000, context: 'a', nextId: first.nextId });
  assert.equal(resumed.inventory[0].id, pending[0].id);
  assert.equal(resumed.inventory[0].enteredAt, 1000);
  assert.equal(resumed.inventory[0].confirmed, true);
});
test('invalid outputs never remove inventory and a different source never reuses identities', () => {
  const first = reconcileInventory([], [detection(0.1)], { now: 1000, context: 'a' });
  assert.throws(() => reconcileInventory(first.inventory, [{ ...detection(0.1), confidence: NaN }], { now: 2000, context: 'a' }));
  assert.equal(first.inventory.length, 1);
  const switched = reconcileInventory(first.inventory, [detection(0.1)], { now: 2000, context: 'b', nextId: first.nextId });
  assert.notEqual(switched.inventory[0].id, first.inventory[0].id);
});
test('persistence restores real units as pending, discards old simulated records and handles quota/errors', () => {
  const memory = new Map([[LEGACY_KEY, 'old simulated data']]);
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  assert.equal(restoreInventory(storage).legacyDiscarded, true);
  assert.equal(memory.has(LEGACY_KEY), false);
  const state = { ...reconcileInventory([], [detection(0.1)], { now: 1000, context: 'a' }), lastScanTime: 1000 };
  assert.equal(saveInventory(storage, state), '');
  const restored = restoreInventory(storage);
  assert.equal(restored.inventory[0].enteredAt, 1000);
  assert.equal(restored.inventory[0].confirmed, false);
  memory.set(STORAGE_KEY, '{corrupt');
  assert.ok(restoreInventory(storage).storageError);
  assert.ok(saveInventory({ setItem: () => { throw new Error('quota'); } }, state));
});
test('elapsed time includes seconds, days and time during interruptions', () => {
  assert.equal(formatElapsed(1000, 2000), '00:00:01');
  assert.equal(formatElapsed(1000, 90062000), '1d 01:01:01');
  assert.equal(formatElapsed(2000, 1000), '00:00:00');
});
