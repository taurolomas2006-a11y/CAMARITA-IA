import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraError, connectBridge, localRequestOptions, parseHttpUrl } from '../services/camera.js';

export function useCamera(videoRef, imageCanvasRef, onInterrupted) {
  const [status, setStatus] = useState({ state: 'idle', message: 'Elegí una fuente y conectá la cámara.' });
  const [dimensions, setDimensions] = useState({ width: 16, height: 9 });
  const active = useRef(null);
  const retry = useRef(null);
  const generation = useRef(0);
  const resources = useRef({});
  const lastFrame = useRef({ at: 0, sequence: 0 });
  const startRef = useRef(null);
  const interruptedRef = useRef(onInterrupted);
  interruptedRef.current = onInterrupted;

  const release = useCallback(() => {
    const current = resources.current;
    resources.current = {};
    current.controller?.abort();
    clearTimeout(current.timeout);
    clearTimeout(current.snapshotTimer);
    clearInterval(current.watchdog);
    if (current.frameCallback !== undefined) videoRef.current?.cancelVideoFrameCallback?.(current.frameCallback);
    current.peer?.close();
    current.stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadeddata = null; }
    lastFrame.current = { at: 0, sequence: 0 };
  }, [videoRef]);

  const disconnect = useCallback(() => {
    active.current = null;
    generation.current++;
    clearTimeout(retry.current);
    release();
    interruptedRef.current();
    setStatus({ state: 'idle', message: 'Cámara desconectada. Las unidades anteriores quedan pendientes de confirmar.' });
  }, [release]);

  const connect = useCallback(async (config, attempt = 0) => {
    const id = ++generation.current;
    clearTimeout(retry.current);
    release();
    active.current = config;
    interruptedRef.current();
    setStatus({ state: 'connecting', message: attempt ? 'Reintentando conexión…' : 'Conectando cámara…' });
    const controller = new AbortController();
    const current = { controller, failed: false };
    resources.current = current;
    const fail = (error) => {
      if (generation.current !== id || current.failed || controller.signal.aborted) return;
      current.failed = true;
      generation.current++;
      release();
      interruptedRef.current();
      const noRetry = ['NotAllowedError', 'NotFoundError', 'SecurityError'].includes(error.name) || error.message?.includes('clave del puente');
      setStatus({ state: 'error', message: `${cameraError(error)}${noRetry ? '' : ' Se volverá a intentar automáticamente.'}` });
      if (!noRetry && active.current) retry.current = setTimeout(() => startRef.current(config, attempt + 1), Math.min(30000, 3000 * (attempt + 1)));
    };
    const frameReady = (width, height) => {
      if (generation.current !== id || !width || !height) return;
      lastFrame.current = { at: performance.now(), sequence: lastFrame.current.sequence + 1 };
      clearTimeout(current.timeout);
      if (!current.live) {
        current.live = true;
        setDimensions({ width, height });
        setStatus({ state: 'live', message: 'Video recibido. La captura de cuadros está disponible.' });
      }
    };
    current.timeout = setTimeout(() => fail(new Error('La fuente no entregó video a tiempo.')), 18000);
    try {
      if (config.mode === 'snapshot') {
        const endpoint = parseHttpUrl(config.url);
        const poll = async () => {
          let bitmap;
          try {
            const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal, ...localRequestOptions(endpoint) });
            if (!response.ok) throw new Error(`La cámara HTTP respondió ${response.status}.`);
            if (!/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '')) {
              throw new Error('Esta dirección no entrega fotos JPEG/PNG/WebP. MJPEG, HLS y RTSP requieren una fuente compatible o el puente.');
            }
            bitmap = await createImageBitmap(await response.blob());
            if (generation.current !== id) return;
            const canvas = imageCanvasRef.current;
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            canvas.getContext('2d').getImageData(0, 0, 1, 1); // Verify readable pixels, not just image display.
            frameReady(bitmap.width, bitmap.height);
            current.snapshotTimer = setTimeout(poll, 250);
          } catch (error) { fail(error); } finally { bitmap?.close(); }
        };
        poll();
      } else {
        if (!window.isSecureContext) throw new Error('Abrí la aplicación por HTTPS o localhost para usar la cámara.');
        const video = videoRef.current;
        const observe = () => {
          frameReady(video.videoWidth, video.videoHeight);
          if (generation.current === id && video.requestVideoFrameCallback) current.frameCallback = video.requestVideoFrameCallback(observe);
        };
        if (video.requestVideoFrameCallback) current.frameCallback = video.requestVideoFrameCallback(observe);
        else video.onloadeddata = observe;
        if (config.mode === 'device') {
          if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara del dispositivo no está disponible. Usá HTTPS o localhost y un navegador actualizado.');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: config.deviceId ? { deviceId: { exact: config.deviceId } } : { facingMode: { ideal: 'environment' } } });
          if (generation.current !== id) { stream.getTracks().forEach((track) => track.stop()); return; }
          current.stream = stream;
          stream.getVideoTracks()[0].onended = () => fail(new Error('La cámara del dispositivo se desconectó.'));
          video.srcObject = stream;
          await video.play();
        } else {
          await connectBridge({ ...config, signal: controller.signal, video, onFailure: fail, onPeer: (peer) => { current.peer = peer; } });
        }
      }
      if (generation.current !== id) return;
      let lastVideoTime = -1;
      current.watchdog = setInterval(() => {
        if (document.hidden) return;
        const video = videoRef.current;
        if (config.mode !== 'snapshot' && !video.requestVideoFrameCallback && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          if (video.readyState >= 2) frameReady(video.videoWidth, video.videoHeight);
        }
        if (lastFrame.current.at && performance.now() - lastFrame.current.at > 6000) fail(new Error('No llegan cuadros nuevos de la cámara.'));
      }, 1000);
    } catch (error) { fail(error); }
  }, [imageCanvasRef, release, videoRef]);
  startRef.current = connect;

  useEffect(() => () => { active.current = null; generation.current++; clearTimeout(retry.current); release(); }, [release]);

  const capture = useCallback(async () => {
    const frame = lastFrame.current;
    if (!frame.at || performance.now() - frame.at > 4000) return null;
    const source = active.current?.mode === 'snapshot' ? imageCanvasRef.current : videoRef.current;
    return { bitmap: await createImageBitmap(source), sequence: frame.sequence };
  }, [imageCanvasRef, videoRef]);

  return { status, dimensions, connect, disconnect, capture };
}
