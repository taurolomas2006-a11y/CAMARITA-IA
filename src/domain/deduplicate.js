import { intersectionOverUnion } from './tracker.js';

// Approved policy: near-identical boxes represent one physical unit even if
// SSD assigned different labels. Keep the highest-confidence observation.
export function deduplicateUnits(detections, threshold = 0.85) {
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) throw new Error('El umbral para cajas duplicadas es inválido.');
  const kept = [];
  for (const detection of [...detections].sort((a, b) => b.confidence - a.confidence)) {
    if (!kept.some((unit) => intersectionOverUnion(unit.box, detection.box) >= threshold)) kept.push(detection);
  }
  return kept;
}
