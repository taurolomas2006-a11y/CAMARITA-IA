import React, { useState } from 'react';
import Scanner from './Scanner';
import InventoryTable from './InventoryTable';
import { Activity, Clock } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';

export default function Dashboard() {
  const [nextScanCountdown, setNextScanCountdown] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScanTime = useInventoryStore((state) => state.lastScanTime);

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return 'Ahora';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatearHora = (timestamp) => {
    if (!timestamp) return 'Ninguno';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Panel Izquierdo: Telemetría y Cámara */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          
          {/* Tarjeta de Telemetría */}
          <div className="glass-panel p-5 relative overflow-hidden">
             
            {/* Efecto Glow en fondo */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-20 rounded-full transition-colors duration-1000 ${isProcessing ? 'bg-brand-500' : 'bg-green-500'}`}></div>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Activity className="text-brand-400 w-5 h-5 mr-2" />
              Telemetría del Sensor
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-white/60 text-sm">Estado del Sensor</span>
                <span className="flex items-center text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                  Activo
                </span>
              </div>
              
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-white/60 text-sm">Último Escaneo</span>
                <span className="text-white font-mono text-sm">{formatearHora(lastScanTime)}</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-white/60 text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Próximo Escaneo
                </span>
                <span className="text-brand-400 font-mono font-bold text-lg">
                  {formatCountdown(nextScanCountdown)}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Cámara/Scanner */}
          <Scanner 
            setNextScanCountdown={setNextScanCountdown} 
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing} 
          />

        </div>

        {/* Panel Derecho: Tabla de Datos */}
        <div className="w-full md:w-2/3">
          <InventoryTable />
        </div>
        
      </div>
    </div>
  );
}
