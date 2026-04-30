import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { Clock, Box } from 'lucide-react';

export default function InventoryTable() {
  const inventory = useInventoryStore((state) => state.inventory);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Motor de Tiempo Real visual (Secundario - Actualiza cada 1 Minuto)
  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // 60 segundos
    return () => clearInterval(timerId);
  }, []);

  const formatearTiempoTranscurrido = (timestampIngreso) => {
    if (!timestampIngreso) return 'Desconocido';
    
    // Cálculo: Timestamp Actual - Timestamp Ingreso Registrado
    const diffMs = currentTime - timestampIngreso;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `Hace ${diffDays} día(s)`;
    if (diffHours > 0) return `Hace ${diffHours} hr(s)`;
    if (diffMins > 0) return `Hace ${diffMins} min(s)`;
    return 'Hace Segundos';
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
         <h2 className="text-xl font-semibold text-white/90 flex items-center">
            <Box className="w-5 h-5 text-brand-400 mr-2" />
            Stock Identificado en Tiempo Real
         </h2>
         <div className="bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full text-xs text-brand-400 font-mono">
            {inventory.length} Ítem(s) Detectados
         </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-white/60 text-sm uppercase tracking-wider font-semibold border-b border-white/10">
              <th className="p-4 py-3"><div className="flex items-center"><Box className="w-4 h-4 mr-2"/>Producto</div></th>
              <th className="p-4 py-3"><div className="flex items-center"><Clock className="w-4 h-4 mr-2"/>Tiempo Transcurrido</div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {inventory.length === 0 ? (
              <tr>
                <td colSpan="2" className="p-8 text-center text-white/40 italic">
                  No hay productos registrados en el frigorífico. 
                  <br />Esperando próximo escaneo...
                </td>
              </tr>
            ) : (
              inventory.map((item, id) => (
                <tr key={`${item.objeto}-${id}`} className="hover:bg-white/5 transition-colors duration-200">
                  <td className="p-4 font-medium text-white/90">{item.objeto}</td>
                  <td className="p-4 font-mono text-white/60">
                    {formatearTiempoTranscurrido(item.timestamp_ingreso)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
