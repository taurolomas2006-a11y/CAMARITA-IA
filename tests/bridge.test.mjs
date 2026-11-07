import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createGateway } from '../bridge/server.mjs';
import { parseHttpUrl, localRequestOptions } from '../src/services/camera.js';

test('gateway exposes only signaling/health with a token; hides upstream credentials and config', async () => {
  const config = { token: 'test-token-for-unit-test-only', allowedOrigins: ['https://camarita-ia.vercel.app'] };
  const calls = [];
  const gateway = createServer(createGateway(config, 'http://upstream.invalid', async (url, options) => {
    calls.push({ url, options });
    return new Response('v=0\r\nanswer', { status: 200 });
  }));
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const base = `http://127.0.0.1:${gateway.address().port}`;
  const headers = { Authorization: `Bearer ${config.token}`, Origin: config.allowedOrigins[0], 'Content-Type': 'application/sdp' };
  try {
    assert.equal((await fetch(`${base}/health`)).status, 401);
    assert.equal((await fetch(`${base}/health`, { headers: { ...headers, Origin: 'https://unrelated.invalid' } })).status, 403);
    assert.equal((await fetch(`${base}/api/config`, { headers })).status, 404);
    const preflight = await fetch(`${base}/webrtc`, { method: 'OPTIONS', headers: { Origin: headers.Origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), headers.Origin);
    const answer = await fetch(`${base}/webrtc`, { method: 'POST', headers, body: 'v=0\r\noffer' });
    assert.equal(answer.status, 200);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.match(await answer.text(), /answer/);
    assert.equal(calls[0].url, 'http://upstream.invalid/api/webrtc?src=heladera');
    assert.equal((await fetch(`${base}/webrtc?src=arbitrary`, { method: 'POST', headers, body: 'x' })).status, 404);
  } finally { await new Promise((resolve) => gateway.close(resolve)); }
});
test('camera input does not accept RTSP or embedded credentials; requests distinguish LAN from loopback', () => {
  assert.throws(() => parseHttpUrl('rtsp://camera.invalid'));
  assert.throws(() => parseHttpUrl('http://user:secret@camera.invalid'));
  assert.equal(localRequestOptions(new URL('http://localhost:1985')).targetAddressSpace, 'loopback');
  assert.equal(localRequestOptions(new URL('http://172.16.16.10:1985')).targetAddressSpace, 'local');
});
