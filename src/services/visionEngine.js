import { validateSsdContract } from '../domain/ssd.js';
import { createInferenceGate } from './inferenceGate.js';

export function createVisionEngine(model) {
  validateSsdContract(model);
  if (!globalThis.Worker || !globalThis.OffscreenCanvas || !globalThis.createImageBitmap) {
    throw new Error('Este navegador no tiene las funciones de procesamiento local requeridas. Actualizá Chrome, Edge o Firefox.');
  }
  const worker = new Worker(new URL('../workers/vision.worker.js', import.meta.url), { type: 'module' });
  const requests = new Map();
  let sequence = 0;
  let disposed = false;
  const dispose = () => {
    disposed = true;
    worker.terminate();
    for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new DOMException('Motor de IA detenido.', 'AbortError')); }
    requests.clear();
  };
  worker.onmessage = ({ data }) => {
    const request = requests.get(data.id);
    if (!request) return;
    requests.delete(data.id);
    clearTimeout(request.timer);
    if (data.error) request.reject(new Error(data.error)); else request.resolve(data.result);
  };
  worker.onerror = () => {
    for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error('Falló el motor local. Revisá compatibilidad y memoria disponible.')); }
    dispose();
  };
  const request = (data, transfer, timeout) => new Promise((resolve, reject) => {
    if (disposed) { data.bitmap?.close(); reject(new DOMException('Motor de IA detenido.', 'AbortError')); return; }
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error('La IA tardó demasiado en responder. Volvé a cargar el modelo.')); dispose(); }, timeout);
    requests.set(id, { resolve, reject, timer });
    try { worker.postMessage({ ...data, id }, transfer); }
    catch (error) { data.bitmap?.close(); clearTimeout(timer); requests.delete(id); reject(error); }
  });
  return {
    load: (bytes) => request({ type: 'load', model, bytes }, [bytes], 120000),
    infer: createInferenceGate((bitmap) => {
      if (disposed) { bitmap.close(); throw new DOMException('Motor de IA detenido.', 'AbortError'); }
      return request({ type: 'infer', bitmap, threshold: model.confidenceThreshold }, [bitmap], 60000);
    }),
    dispose,
  };
}
