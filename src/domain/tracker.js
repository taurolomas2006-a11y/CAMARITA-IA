// Source-image boxes normalized to [0, 1]: x, y, width, height.
export function validateDetections(detections) {
  if (!Array.isArray(detections)) throw new Error('El modelo no devolvió una lista de detecciones válida.');
  for (const detection of detections) {
    const box = detection?.box;
    if (!Number.isInteger(detection?.classId) || detection.classId < 0 ||
        typeof detection.label !== 'string' || !detection.label.trim() ||
        !Number.isFinite(detection.confidence) || detection.confidence < 0 || detection.confidence > 1 ||
        !box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
        box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 ||
        box.x + box.width > 1.00001 || box.y + box.height > 1.00001) {
      throw new Error('Detección incompatible: se requieren clase, etiqueta, confianza y caja normalizada.');
    }
  }
}

export function intersectionOverUnion(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
}

export function reconcileInventory(previous, detections, { now, context, nextId = 1 }) {
  validateDetections(detections);
  if (!Number.isFinite(now) || !context) throw new Error('Falta el contexto del cuadro.');
  const candidates = [];
  previous.forEach((unit, unitIndex) => {
    detections.forEach((detection, detectionIndex) => {
      if (unit.context !== context || unit.classId !== detection.classId || unit.label !== detection.label) return;
      const overlap = intersectionOverUnion(unit.box, detection.box);
      const distance = Math.hypot(
        unit.box.x + unit.box.width / 2 - detection.box.x - detection.box.width / 2,
        unit.box.y + unit.box.height / 2 - detection.box.y - detection.box.height / 2,
      );
      if (overlap >= 0.1 || distance <= 0.1) candidates.push({ unitIndex, detectionIndex, score: overlap - distance });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const usedUnits = new Set();
  const matches = new Map();
  for (const candidate of candidates) {
    if (!usedUnits.has(candidate.unitIndex) && !matches.has(candidate.detectionIndex)) {
      usedUnits.add(candidate.unitIndex);
      matches.set(candidate.detectionIndex, previous[candidate.unitIndex]);
    }
  }
  const inventory = detections.map((detection, index) => {
    const existing = matches.get(index);
    return { ...detection, id: existing?.id ?? `unidad-${String(nextId++).padStart(6, '0')}`,
      enteredAt: existing?.enteredAt ?? now, lastSeenAt: now, context, confirmed: true };
  });
  return { inventory, nextId };
}

export function pendingInventory(inventory) {
  return inventory.map((unit) => ({ ...unit, confirmed: false }));
}

export function formatElapsed(enteredAt, now) {
  const seconds = Math.max(0, Math.floor((now - enteredAt) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
