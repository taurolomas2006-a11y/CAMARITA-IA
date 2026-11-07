import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { decodeSsd, validateSsdContract } from '../domain/ssd.js';
import { deduplicateUnits } from '../domain/deduplicate.js';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
let session;
let model;
self.onmessage = async ({ data }) => {
  let bitmap = data.bitmap;
  let tensor;
  let outputs;
  try {
    if (data.type === 'load') {
      model = data.model;
      validateSsdContract(model);
      session = await ort.InferenceSession.create(data.bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      if (session.inputNames.length !== 1 || session.inputNames[0] !== model.input.name ||
          !Object.values(model.outputs).every((name) => session.outputNames.includes(name))) throw new Error('Los tensores reales no coinciden con los metadatos publicados.');
      const input = session.inputMetadata[0];
      if (input?.type !== 'uint8' || input.shape?.length !== 4 || input.shape[3] !== 3) throw new Error('La entrada real debe ser RGB uint8 NHWC.');
      self.postMessage({ id: data.id, result: { backend: 'CPU · WebAssembly SIMD · 1 hilo' } });
    } else if (data.type === 'infer') {
      if (!session) throw new Error('El modelo no está cargado.');
      const started = performance.now();
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      const { width, height } = bitmap;
      bitmap.close();
      bitmap = null;
      const pixels = context.getImageData(0, 0, width, height).data;
      const rgb = new Uint8Array(width * height * 3);
      for (let source = 0, dest = 0; source < pixels.length; source += 4) {
        rgb[dest++] = pixels[source]; rgb[dest++] = pixels[source + 1]; rgb[dest++] = pixels[source + 2];
      }
      tensor = new ort.Tensor('uint8', rgb, [1, height, width, 3]);
      outputs = await session.run({ [model.input.name]: tensor });
      const detections = deduplicateUnits(decodeSsd(outputs, model, data.threshold), model.duplicateIouThreshold ?? 0.85);
      self.postMessage({ id: data.id, result: { detections, durationMs: performance.now() - started } });
    } else throw new Error('Operación de inferencia desconocida.');
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  } finally {
    bitmap?.close();
    tensor?.dispose();
    if (outputs) for (const output of Object.values(outputs)) output.dispose();
  }
};
