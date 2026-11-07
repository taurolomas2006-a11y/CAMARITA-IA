import React, { useState } from 'react';
import Scanner from './Scanner.jsx';
import InventoryTable from './InventoryTable.jsx';
import ModelPanel from './ModelPanel.jsx';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { useModels } from '../hooks/useModels.js';

export default function Dashboard() {
  const markPending = useInventoryStore((state) => state.markPending);
  const lastScanTime = useInventoryStore((state) => state.lastScanTime);
  const models = useModels(markPending);
  const [telemetry, setTelemetry] = useState({ cameraState: 'idle', detecting: false, durationMs: null, fps: null });
  return <div className="dashboard">
    <div className="notice intro">Demostración con procesamiento local. Conectá la cámara y cargá un modelo para empezar. El inventario se guarda únicamente en este navegador.</div>
    <div className="stats-grid">
      <div className="stat"><span>Detección</span><strong>{telemetry.detecting ? 'Continua' : 'Detenida'}</strong></div>
      <div className="stat"><span>Última detección procesada</span><strong>{lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : 'Sin resultados'}</strong></div>
      <div className="stat"><span>Rendimiento de IA</span><strong>{telemetry.durationMs ? `${Math.round(telemetry.durationMs)} ms · ${Number.isFinite(telemetry.fps) ? `${telemetry.fps.toFixed(1)} fps` : 'midiendo frecuencia…'}` : 'Sin medición'}</strong></div>
      <div className="stat"><span>Sensor de luz</span><strong className="muted">No conectado</strong></div>
    </div>
    <div className="workspace-grid"><Scanner models={models} onTelemetry={setTelemetry} /><InventoryTable /></div>
    <ModelPanel models={models} />
  </div>;
}
