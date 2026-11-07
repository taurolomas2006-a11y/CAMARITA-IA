import { pendingInventory, validateDetections } from '../domain/tracker.js';

export const STORAGE_KEY = 'camarita-inventory-v2';
export const LEGACY_KEY = 'inventario-heladera-storage';

export function restoreInventory(storage) {
  const empty = { inventory: [], nextId: 1, lastScanTime: null, storageError: '', legacyDiscarded: false };
  try {
    if (storage.getItem(LEGACY_KEY)) {
      // Old versions persisted random products. Never migrate these as real units.
      storage.removeItem(LEGACY_KEY);
      empty.legacyDiscarded = true;
    }
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw);
    if (saved.version !== 2 || !Array.isArray(saved.inventory) || !Number.isSafeInteger(saved.nextId) || saved.nextId < 1 ||
        !(saved.lastScanTime === null || Number.isFinite(saved.lastScanTime))) throw new Error();
    validateDetections(saved.inventory);
    const ids = new Set();
    for (const unit of saved.inventory) {
      if (!/^unidad-\d+$/.test(unit.id) || ids.has(unit.id) || Number(unit.id.slice(7)) >= saved.nextId ||
          !Number.isFinite(unit.enteredAt) || !Number.isFinite(unit.lastSeenAt) || unit.enteredAt > unit.lastSeenAt ||
          typeof unit.context !== 'string') throw new Error();
      ids.add(unit.id);
    }
    return { ...empty, inventory: pendingInventory(saved.inventory), nextId: saved.nextId, lastScanTime: saved.lastScanTime };
  } catch {
    return { ...empty, storageError: 'No se pudo recuperar el inventario local. No se mostrarán datos dañados.' };
  }
}

export function saveInventory(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, inventory: state.inventory, nextId: state.nextId, lastScanTime: state.lastScanTime }));
    return '';
  } catch {
    return 'No se pudo guardar en este dispositivo. El inventario actual sigue disponible hasta cerrar la página.';
  }
}
