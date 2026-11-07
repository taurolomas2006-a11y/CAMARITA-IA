import { validateDetections } from './tracker.js';

export function validateSsdContract(model) {
  if (model.runtime !== 'onnx-ssd' || model.format !== 'onnx' || model.input?.type !== 'uint8' ||
      model.input?.layout !== 'NHWC' || JSON.stringify(model.input?.shape) !== '[1,-1,-1,3]' ||
      model.preprocessing !== 'original-rgb-uint8' || model.nms !== 'included' ||
      model.boxFormat !== 'yxyx-normalized' || model.classIdOffset !== 1 ||
      typeof model.input.name !== 'string' || !model.input.name ||
      !['detection_boxes', 'detection_scores', 'detection_classes', 'num_detections'].every((name) => typeof model.outputs?.[name] === 'string') ||
      !Number.isFinite(model.confidenceThreshold) || model.confidenceThreshold <= 0 || model.confidenceThreshold > 1 ||
      (model.duplicateIouThreshold !== undefined && (!Number.isFinite(model.duplicateIouThreshold) || model.duplicateIouThreshold < 0.5 || model.duplicateIouThreshold > 1))) {
    throw new Error('Este modelo todavía no tiene un contrato SSD validado para el motor instalado. ONNX/TFLite por sí solos no garantizan compatibilidad.');
  }
}

export function decodeSsd(outputs, model, threshold = model.confidenceThreshold) {
  const boxes = outputs[model.outputs.detection_boxes];
  const scores = outputs[model.outputs.detection_scores];
  const classes = outputs[model.outputs.detection_classes];
  const count = Number(outputs[model.outputs.num_detections]?.data?.[0]);
  if (!Number.isInteger(count) || count < 0 || !boxes || !scores || !classes ||
      boxes.dims.length !== 3 || boxes.dims[0] !== 1 || boxes.dims[2] !== 4 ||
      scores.dims.length !== 2 || classes.dims.length !== 2 || scores.dims[0] !== 1 || classes.dims[0] !== 1 ||
      boxes.data.length < count * 4 || scores.data.length < count || classes.data.length < count) {
    throw new Error('Las salidas del modelo no coinciden con el contrato SSD.');
  }
  const detections = [];
  for (let i = 0; i < count; i++) {
    const confidence = Number(scores.data[i]);
    if (!Number.isFinite(confidence)) throw new Error('El modelo devolvió una confianza inválida.');
    if (confidence < threshold) continue;
    const classId = Number(classes.data[i]) - model.classIdOffset;
    if (!Number.isInteger(classId) || !model.labels[classId]) throw new Error('El modelo devolvió una clase desconocida.');
    const [y1, x1, y2, x2] = Array.from(boxes.data.slice(i * 4, i * 4 + 4), Number);
    detections.push({ classId, label: model.labels[classId], confidence, box: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } });
  }
  validateDetections(detections);
  return detections;
}
