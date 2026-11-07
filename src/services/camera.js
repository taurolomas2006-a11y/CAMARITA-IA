export function parseHttpUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Ingresá una dirección HTTP o HTTPS completa.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('RTSP requiere el puente local. Ingresá aquí su dirección HTTP o HTTPS.');
  if (url.username || url.password) throw new Error('Guardá las credenciales de la cámara en el puente local, no en la dirección de la app.');
  if (url.hash) throw new Error('La dirección no debe incluir un fragmento (#).');
  return url;
}

export function localRequestOptions(url) {
  const host = url.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host.startsWith('127.')) return { targetAddressSpace: 'loopback' };
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local')) return { targetAddressSpace: 'local' };
  return {};
}

export function waitForIce(peer, signal) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', check);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const check = () => { if (peer.iceGatheringState === 'complete') finish(); };
    const abort = () => finish(new DOMException('Conexión cancelada', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('No se pudieron preparar los puertos de video. Revisá la red y el firewall.')), 6000);
    peer.addEventListener('icegatheringstatechange', check);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function connectBridge({ url, token, signal, video, onFailure, onPeer }) {
  if (!globalThis.RTCPeerConnection) throw new Error('Este navegador no permite WebRTC. Probá Chrome o Edge actualizados.');
  const endpoint = parseHttpUrl(url);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/webrtc`;
  const peer = new RTCPeerConnection({ iceServers: [] });
  onPeer(peer);
  peer.addTransceiver('video', { direction: 'recvonly' });
  peer.ontrack = (event) => {
    if (signal.aborted) return;
    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    video.play().catch(() => onFailure(new Error('El navegador bloqueó la reproducción. Volvé a conectar.')));
    event.track.onended = () => onFailure(new Error('El puente dejó de enviar video.'));
  };
  peer.onconnectionstatechange = () => {
    if (['failed', 'disconnected'].includes(peer.connectionState)) onFailure(new Error('Se interrumpió la conexión con el puente.'));
  };
  await peer.setLocalDescription(await peer.createOffer());
  await waitForIce(peer, signal);
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${token}` },
    body: peer.localDescription.sdp, signal, cache: 'no-store', ...localRequestOptions(endpoint),
  });
  if (response.status === 401) throw new Error('La clave del puente no es correcta. Revisá bridge.local.json en Windows.');
  if (!response.ok) throw new Error(`El puente no pudo abrir la cámara (HTTP ${response.status}). Revisá alimentación, IP, RTSP y códec H.264.`);
  await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
}

export function cameraError(error) {
  if (error.name === 'NotAllowedError') return 'Permiso de cámara denegado. Permití la cámara en la configuración de este sitio.';
  if (error.name === 'NotFoundError') return 'No se encontró una cámara en este dispositivo.';
  if (error.name === 'NotReadableError') return 'La cámara está ocupada o no responde. Cerrá otras aplicaciones que la estén usando.';
  if (error.name === 'SecurityError') return 'No se pueden leer los cuadros. La fuente debe permitir CORS y el sitio debe usar HTTPS o localhost.';
  if (error instanceof TypeError) return 'No se pudo acceder a la fuente. Revisá la dirección, CORS, permisos de red local y HTTPS. En Chrome, permití el acceso a la red local de este sitio.';
  return error.message || 'No se pudo conectar la cámara.';
}
