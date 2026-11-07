import { validateCatalog } from '../domain/modelCatalog.js';

const base = import.meta.env.BASE_URL;
export async function loadCatalog(signal) {
  const response = await fetch(`${base}models/catalog.json`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`No se pudo obtener el catálogo (HTTP ${response.status}).`);
  return validateCatalog(await response.json());
}
export async function verifyModel(model, signal) {
  const response = await fetch(`${base}models/${model.id}/${model.file}?sha256=${model.sha256}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Archivo ausente o inaccesible (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== model.bytes) throw new Error('El tamaño no coincide con el catálogo. Actualizá la aplicación.');
  if (!globalThis.crypto?.subtle) throw new Error('La verificación requiere HTTPS o localhost.');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== model.sha256) throw new Error('El archivo no coincide con su huella. Actualizá el catálogo y la aplicación.');
  return buffer;
}
