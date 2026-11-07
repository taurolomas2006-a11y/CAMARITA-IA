import http from 'node:http';
import https from 'node:https';
import { readFile, writeFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
export function createGateway(config, upstream = 'http://127.0.0.1:1984', fetchUpstream = fetch) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) { response.writeHead(403).end('Origen no permitido.'); return; }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const expected = Buffer.from(`Bearer ${config.token}`);
    const supplied = Buffer.from(request.headers.authorization || '');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) { response.writeHead(401).end('Clave del puente inválida.'); return; }
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/health' && request.method === 'GET') {
      try {
        const result = await fetchUpstream(`${upstream}/api`, { signal: AbortSignal.timeout(3000) });
        if (!result.ok) throw new Error();
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ bridge: 'ready', camera: 'not-verified' }));
      } catch { response.writeHead(503).end('El proceso de video no responde.'); }
      return;
    }
    if (url.pathname !== '/webrtc' || request.method !== 'POST' || url.search) { response.writeHead(404).end(); return; }
    if (!request.headers['content-type']?.startsWith('application/sdp')) { response.writeHead(415).end(); return; }
    try {
      let size = 0;
      const parts = [];
      for await (const part of request) {
        size += part.length;
        if (size > 262144) { response.writeHead(413).end(); return; }
        parts.push(part);
      }
      const result = await fetchUpstream(`${upstream}/api/webrtc?src=heladera`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: Buffer.concat(parts), signal: AbortSignal.timeout(15000) });
      if (!result.ok) { response.writeHead(502).end('No se pudo abrir el video de la cámara.'); return; }
      response.writeHead(200, { 'Content-Type': 'application/sdp' }).end(await result.text());
    } catch { if (!response.headersSent) response.writeHead(502).end('No respondió el proceso de video.'); }
  };
}

export async function startBridge() {
  let config;
  try { config = JSON.parse((await readFile(join(root, 'bridge.local.json'), 'utf8')).replace(/^\uFEFF/, '')); }
  catch { throw new Error('Falta bridge/bridge.local.json. Ejecutá bridge/setup.ps1.'); }
  const cameraUrl = new URL(config.rtspUrl);
  if (!['rtsp:', 'rtsps:'].includes(cameraUrl.protocol) || typeof config.token !== 'string' || config.token.length < 24 || !Array.isArray(config.allowedOrigins)) throw new Error('Configuración local inválida.');
  const candidates = Object.values(networkInterfaces()).flat().filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.')).map((address) => `${address.address}:8555`);
  const yaml = `api:\n  listen: "127.0.0.1:1984"\nrtsp:\n  listen: ""\nwebrtc:\n  listen: ":8555"\n  ice_servers: []\n  candidates: ${JSON.stringify(candidates)}\nstreams:\n  heladera: ${JSON.stringify(config.rtspUrl)}\nlog:\n  level: error\n`;
  const yamlPath = join(root, 'go2rtc.local.yaml');
  await writeFile(yamlPath, yaml);
  const process = spawn(join(root, 'runtime', 'go2rtc.exe'), ['-config', yamlPath], { windowsHide: true, stdio: 'ignore' });
  const handler = createGateway(config);
  const server = config.tlsCert && config.tlsKey ? https.createServer({ cert: await readFile(config.tlsCert), key: await readFile(config.tlsKey) }, handler) : http.createServer(handler);
  process.on('error', () => { console.error('No se pudo iniciar go2rtc. Ejecutá bridge/setup.ps1.'); server.close(); });
  process.on('exit', () => { console.log('El proceso de video se detuvo.'); server.close(); });
  server.on('error', (error) => { console.error(`No se pudo abrir el puente: ${error.code || 'error'}`); process.kill(); });
  server.listen(config.port || 1985, config.host || '0.0.0.0', () => {
    console.log(`Puente iniciado en ${config.tlsCert ? 'https' : 'http'}://localhost:${config.port || 1985}. Cámara aún no verificada.`);
    console.log('En Android usá la IP de esta PC. Abrí bridge.local.json para consultar la clave del puente.');
  });
  const close = () => { process.kill(); server.close(); };
  globalThis.process.once('SIGINT', close);
  globalThis.process.once('SIGTERM', close);
  return { server, close };
}
if (globalThis.process.argv[1] === fileURLToPath(import.meta.url)) {
  startBridge().catch((error) => { console.error(error.message); globalThis.process.exitCode = 1; });
}
