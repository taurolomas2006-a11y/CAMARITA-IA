import React, { useEffect, useState } from 'react';
import { Box } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatElapsed } from '../domain/tracker.js';

export default function InventoryTable() {
  const inventory = useInventoryStore((state) => state.inventory);
  const storageError = useInventoryStore((state) => state.storageError);
  const legacyDiscarded = useInventoryStore((state) => state.legacyDiscarded);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const confirmed = inventory.filter((unit) => unit.confirmed).length;
  return <section className="panel inventory-panel" aria-labelledby="inventory-title">
    <div className="section-heading"><div><p className="eyebrow">En este dispositivo</p><h2 id="inventory-title"><Box size={20} />Inventario individual</h2></div><span className="badge">{confirmed} confirmadas · {inventory.length - confirmed} pendientes</span></div>
    <p className="muted">Cada fila es una unidad. Su tiempo empieza con la primera detección y se actualiza cada segundo.</p>
    {storageError && <p role="alert" className="notice error">{storageError}</p>}
    {legacyDiscarded && <p className="notice warning">Se descartaron los productos simulados guardados por la versión anterior.</p>}
    <div className="table-scroll"><table><thead><tr><th>Unidad / producto</th><th>Tiempo en heladera</th><th>Estado</th></tr></thead><tbody>
      {inventory.length === 0 ? <tr><td colSpan={3} className="empty-state">Todavía no hay unidades registradas.<br />Solo se mostrarán detecciones reales de la cámara y el modelo.</td></tr> : inventory.map((unit) => <tr key={unit.id}>
        <td><strong>{unit.label}</strong><span className="cell-detail">#{unit.id.slice(7)} · {Math.round(unit.confidence * 100)}%</span></td>
        <td className="elapsed"><time dateTime={new Date(unit.enteredAt).toISOString()} title={`Ingreso: ${new Date(unit.enteredAt).toLocaleString()}`}>{formatElapsed(unit.enteredAt, now)}</time></td>
        <td><span className={`badge ${unit.confirmed ? 'success' : 'warning'}`}>{unit.confirmed ? 'Detectada' : 'Por confirmar'}</span><span className="cell-detail">Última vista: {new Date(unit.lastSeenAt).toLocaleTimeString()}</span></td>
      </tr>)}
    </tbody></table></div>
    <p className="fine-print">Un cuadro válido sin una unidad la retira de la tabla. Un error de cámara o IA conserva el inventario pendiente de confirmar. Las oclusiones pueden reiniciar identidades.</p>
  </section>;
}
