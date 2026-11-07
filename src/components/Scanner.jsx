import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, PlugZap, Unplug } from 'lucide-react';
import { useCamera } from '../hooks/useCamera.js';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { startContinuousDetection } from '../services/detectionLoop.js';
import { modelKey } from '../domain/modelCatalog.js';

export default function Scanner({ models, onTelemetry }) {
  const { engine, selected, fail } = models;
  const videoRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const markPending = useInventoryStore((state) => state.markPending);
  const applyDetections = useInventoryStore((state) => state.applyDetections);
  const [mode, setMode] = useState('bridge');
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState([]);
  const [url, setUrl] = useState('http://localhost:1985');
  const [token, setToken] = useState('');
  const [activeConfig, setActiveConfig] = useState(null);
  const [overlays, setOverlays] = useState([]);
  const [visible, setVisible] = useState(!document.hidden);
  const observationGeneration = useRef(0);
  const interrupt = useCallback(() => { observationGeneration.current++; markPending(); setOverlays([]); }, [markPending]);
  const camera = useCamera(videoRef, imageCanvasRef, interrupt);
  const cameraState = camera.status.state;

  useEffect(() => {
    const enumerate = () => navigator.mediaDevices?.enumerateDevices().then((all) => setDevices(all.filter((device) => device.kind === 'videoinput'))).catch(() => {});
    enumerate();
    navigator.mediaDevices?.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
  }, [cameraState]);
  useEffect(() => {
    const onVisibility = () => { setVisible(!document.hidden); interrupt(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [interrupt]);

  useEffect(() => {
    interrupt();
    if (cameraState !== 'live' || !engine || !selected || !visible || !activeConfig) return;
    const source = activeConfig.mode === 'device' ? `device:${activeConfig.deviceId || 'default'}` : `${activeConfig.mode}:${activeConfig.url}`;
    const context = `${source}|${modelKey(selected)}`;
    const generation = observationGeneration.current;
    return startContinuousDetection({
      capture: camera.capture,
      infer: engine.infer,
      onResult: (detections) => {
        if (generation !== observationGeneration.current) return;
        applyDetections(detections, context);
        setOverlays(useInventoryStore.getState().inventory);
      },
      onError: (error) => { interrupt(); fail(error); },
      onMetrics: (metrics) => onTelemetry({ ...metrics, cameraState: 'live', detecting: true }),
    });
  }, [cameraState, camera.capture, engine, selected, fail, visible, activeConfig, applyDetections, interrupt, onTelemetry]);

  useEffect(() => {
    onTelemetry({ cameraState, detecting: cameraState === 'live' && !!models.engine && visible, durationMs: null, fps: null });
  }, [cameraState, models.engine, visible, onTelemetry]);

  const changeMode = (next) => {
    camera.disconnect(); setActiveConfig(null); setMode(next); setUrl(next === 'bridge' ? 'http://localhost:1985' : '');
  };
  const submit = (event) => {
    event.preventDefault();
    const config = { mode, deviceId, url: url.trim().replace(/\/$/, ''), token };
    setActiveConfig(config);
    camera.connect(config);
  };
  return <section className="panel camera-panel" aria-labelledby="camera-title">
    <div className="section-heading"><div><p className="eyebrow">Fuente de video</p><h2 id="camera-title"><Camera size={20} />Cámara en vivo</h2></div><span className={`badge ${cameraState === 'live' ? 'success' : ''}`}>{cameraState === 'live' ? 'Recibiendo video' : 'Sin video confirmado'}</span></div>
    <form onSubmit={submit} className="camera-form">
      <label className="field">Fuente<select value={mode} onChange={(event) => changeMode(event.target.value)}>
        <option value="device">Cámara del dispositivo / USB</option><option value="bridge">EZVIZ por puente local (RTSP → WebRTC)</option><option value="snapshot">HTTP: fotos JPEG actualizadas</option>
      </select></label>
      {mode === 'device' ? <label className="field">Cámara<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}><option value="">Automática / trasera</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Cámara ${index + 1}`}</option>)}</select></label> : <>
        <label className="field">{mode === 'bridge' ? 'Dirección del puente Windows' : 'Dirección de una foto HTTP'}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={mode === 'bridge' ? 'http://IP-DE-LA-PC:1985' : 'https://camara/imagen.jpg'} required /></label>
        {mode === 'bridge' && <label className="field">Clave del puente<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required /><span className="fine-print">Se consulta en bridge.local.json. No es la contraseña RTSP.</span></label>}
      </>}
      <div className="button-row"><button className="button primary" type="submit"><PlugZap size={16} />Conectar</button><button className="button secondary" type="button" onClick={() => { camera.disconnect(); setActiveConfig(null); }}><Unplug size={16} />Desconectar</button></div>
    </form>
    {mode === 'bridge' && <p className="fine-print">La PC del puente y la cámara deben estar encendidas y en la misma red. En Android usá la IP de esa PC en lugar de localhost.</p>}
    {mode === 'snapshot' && <p className="fine-print">Esta opción consulta una foto nueva cada 250 ms más el tiempo de descarga; no reproduce un stream MJPEG. La fuente debe permitir CORS.</p>}
    <div className="video-stage" style={{ aspectRatio: `${camera.dimensions.width}/${camera.dimensions.height}` }}>
      <video ref={videoRef} autoPlay playsInline muted className={mode === 'snapshot' ? 'hidden' : ''} />
      <canvas ref={imageCanvasRef} className={mode === 'snapshot' ? '' : 'hidden'} />
      {cameraState !== 'live' && <div className="video-placeholder"><Camera size={36} /><span>{cameraState === 'connecting' ? 'Esperando cuadros de la cámara…' : 'Conectá una cámara para ver el video'}</span></div>}
      {cameraState === 'live' && <div className="detection-overlay" aria-label={`${overlays.length} detecciones`}>
        {overlays.map((unit) => <div key={unit.id} className="detection-box" style={{ left: `${unit.box.x * 100}%`, top: `${unit.box.y * 100}%`, width: `${unit.box.width * 100}%`, height: `${unit.box.height * 100}%` }}><span>{unit.label} · {Math.round(unit.confidence * 100)}% · #{unit.id.slice(7)}</span></div>)}
      </div>}
    </div>
    <p className={`notice ${cameraState === 'error' ? 'error' : ''}`} role="status">{camera.status.message}</p>
    {!visible && <p className="notice warning">Detección pausada mientras la pestaña está oculta. El tiempo de ingreso se conserva.</p>}
    {!models.engine && <p className="notice warning">Detección detenida. Cargá un modelo compatible desde Desarrollador.</p>}
  </section>;
}
