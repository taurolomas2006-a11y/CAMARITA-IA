const identifier = /^[a-z0-9][a-z0-9._-]*$/;
export function validateModel(model) {
  if (!model || typeof model.id !== 'string' || typeof model.version !== 'string' || !identifier.test(model.id) || !identifier.test(model.version) ||
      typeof model.name !== 'string' || !model.name.trim() || !['onnx', 'tflite'].includes(model.format) ||
      !Array.isArray(model.labels) || !model.labels.length ||
      model.labels.some((label) => typeof label !== 'string' || !label.trim()) || new Set(model.labels).size !== model.labels.length ||
      typeof model.file !== 'string' || !/^[a-zA-Z0-9._-]+\.(onnx|tflite)$/.test(model.file) || !model.file.endsWith(`.${model.format}`)) {
    throw new Error('Metadatos inválidos: revisá id, versión, formato, archivo y etiquetas.');
  }
  return model;
}
export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.models)) throw new Error('El catálogo de modelos tiene un formato desconocido.');
  const keys = new Set();
  for (const model of catalog.models) {
    validateModel(model);
    if (keys.has(model.id)) throw new Error(`Identificador de modelo repetido: ${model.id}`);
    keys.add(model.id);
    if (!/^[a-f0-9]{64}$/.test(model.sha256) || !Number.isSafeInteger(model.bytes) || model.bytes < 1) throw new Error(`Falta la integridad de ${model.id}. Volvé a generar el catálogo.`);
  }
  return catalog;
}
export function modelKey(model) {
  return `${model.id}@${model.version}:${model.sha256}`;
}
