import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateModel } from '../src/domain/modelCatalog.js';

export async function buildCatalog(root) {
  const models = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const model = validateModel(JSON.parse(await readFile(join(root, entry.name, 'model.json'), 'utf8')));
    if (model.id !== entry.name) throw new Error(`La carpeta ${entry.name} debe coincidir con el id del modelo.`);
    const bytes = await readFile(join(root, entry.name, model.file));
    if (!bytes.length || bytes.subarray(0, 128).toString().startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error(`El modelo ${model.id} está vacío o es un puntero Git LFS sin descargar.`);
    models.push({ ...model, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const catalog = { schemaVersion: 1, models };
  await writeFile(join(root, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = await buildCatalog(fileURLToPath(new URL('../public/models/', import.meta.url)));
  console.log(`Catálogo generado: ${catalog.models.length} modelo(s). La compatibilidad de inferencia requiere validación independiente.`);
}
