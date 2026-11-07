import { create } from 'zustand';
import { pendingInventory, reconcileInventory } from '../domain/tracker.js';
import { restoreInventory, saveInventory } from '../services/inventoryStorage.js';

const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
export const useInventoryStore = create((set, get) => ({
  ...restoreInventory(storage),
  observationState: 'pending',
  applyDetections: (detections, context, now = Date.now()) => {
    const result = reconcileInventory(get().inventory, detections, { now, context, nextId: get().nextId });
    set({ ...result, lastScanTime: now, observationState: 'live' });
  },
  markPending: () => {
    if (get().observationState === 'pending') return;
    set({ inventory: pendingInventory(get().inventory), observationState: 'pending' });
  },
  clearInventory: () => {
    set({ inventory: [], lastScanTime: null, observationState: 'pending' });
    flush();
  },
}));

// Save at most once a second and flush on pagehide; no synchronous write per frame.
let saveTimer;
function flush() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const storageError = saveInventory(storage, useInventoryStore.getState());
  if (storageError !== useInventoryStore.getState().storageError) useInventoryStore.setState({ storageError });
}
useInventoryStore.subscribe((state, previous) => {
  if ((state.inventory !== previous.inventory || state.lastScanTime !== previous.lastScanTime) && !saveTimer) saveTimer = setTimeout(flush, 1000);
});
window.addEventListener('pagehide', flush);
