import React from 'react';
import { Box, RefreshCw } from 'lucide-react';

export default function ModelPanel({ models }) {
  const selected = models.selected;
  return <section className="panel" aria-labelledby="models-title">
    <div className="section-heading"><div><p className="eyebrow">Desarrollador</p><h2 id="models-title"><Box size={20} />Modelos incluidos</h2></div>
      <button className="button secondary" onClick={models.refresh} disabled={models.status.state === 'loading'}><RefreshCw size={16} />Actualizar catálogo</button></div>
    <p className="muted">Los modelos llegan con la publicación de la aplicación. Esta pantalla no sube archivos.</p>
    {models.catalogError && <p className="notice error" role="alert">{models.catalogError}</p>}
    {models.preferenceError && <p className="notice warning">{models.preferenceError}</p>}
    {models.catalog?.models.length === 0 ? <div className="empty-state">Todavía no hay modelos publicados. La cámara puede usarse; la detección está pendiente.</div> : <>
      <label className="field">Modelo seleccionado
        <select value={models.selectedId} onChange={(event) => models.select(event.target.value)}>
          <option value="">Elegir un modelo</option>
          {models.catalog?.models.map((model) => <option key={model.id} value={model.id}>{model.name} · v{model.version} · {model.format.toUpperCase()}</option>)}
        </select>
      </label>
      {selected && <div className="model-details">
        <div><strong>{selected.name}</strong>{selected.experimental && <span className="badge warning">Experimental</span>}</div>
        <p>{selected.labels.join(' · ')}</p>
        <p className="muted">{(selected.bytes / 1048576).toFixed(1)} MB · {selected.runtime || 'Motor pendiente de integración'} · confianza {Math.round((selected.confidenceThreshold || 0) * 100)}%</p>
        <details><summary>Versión y huella del archivo</summary><p className="fingerprint">{selected.id} · {selected.version}<br />SHA-256: {selected.sha256}</p></details>
      </div>}
      <button className="button primary" onClick={models.load} disabled={!selected || models.status.state === 'loading'}>{models.status.state === 'loading' ? 'Preparando modelo…' : 'Cargar y validar modelo'}</button>
    </>}
    <p className={`notice ${models.status.state === 'error' ? 'error' : ''}`} role="status">{models.status.message}</p>
    <p className="fine-print">Comprobar la huella confirma el archivo. El motor también debe aceptar sus tensores y operaciones. YOLOv8 y TFLite necesitan su propia integración validada.</p>
  </section>;
}
