import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';
import { analyzeImage } from '../services/visionModelManager';
import { useInventoryStore } from '../store/useInventoryStore';

// CONSTANTE CRUCIAL: 3600000 ms (1 hora). Modificar a 10000 ms (10 seg) para pruebas en desarrollo.
const SCAN_INTERVAL = 3600000; 

export default function Scanner({ setNextScanCountdown, isProcessing, setIsProcessing }) {
  const webcamRef = useRef(null);
  const [errorStatus, setErrorStatus] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState({});
  const updateInventoryFromScan = useInventoryStore((state) => state.updateInventoryFromScan);

  // Cargar dispositivos disponibles
  const handleDevices = useCallback(
    (mediaDevices) => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setCameras(videoDevices);
      if(videoDevices.length > 0 && !deviceId) {
        setDeviceId(videoDevices[0].deviceId);
      }
    },
    [deviceId]
  );

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  const scanInProgress = useRef(false);
  const countdownRef = useRef(SCAN_INTERVAL / 1000);

  /**
   * Extrae el frame, lo convierte y llama a la API mock de IA.
   * Documentación JSDoc
   * @function ejecutarEscaneoAutonomo
   * @description Extrae frame base64 del webcam, lo manda a IAModel y actualiza Zustand.
   * @returns {Promise<void>} 
   */
  const ejecutarEscaneoAutonomo = useCallback(async () => {
    if (scanInProgress.current) return;
    
    scanInProgress.current = true;
    setIsProcessing(true);
    setErrorStatus(false);

    try {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        
        if (!imageSrc) throw new Error("No frame captured");

        // Llamada a Simulación API IA
        const analisisJson = await analyzeImage(imageSrc);
        
        // Causalidad y efecto
        updateInventoryFromScan(analisisJson);
      }
    } catch (err) {
      console.error("Falla en el ciclo de escaneo: ", err);
      setErrorStatus(true);
    } finally {
      // Resetear contadores y estados
      countdownRef.current = SCAN_INTERVAL / 1000;
      setNextScanCountdown(countdownRef.current);
      
      setIsProcessing(false);
      scanInProgress.current = false;
    }
  }, [updateInventoryFromScan, setIsProcessing, setNextScanCountdown]);

  // Motor de Bucle Principal (Seguro contra closures)
  useEffect(() => {
    // Establecer la UI inicialmente
    // setNextScanCountdown(countdownRef.current); // opcional

    const secTimer = setInterval(() => {
      // Bloquear el conteo si el modelo de red está en análisis
      if (!scanInProgress.current) {
        countdownRef.current = Math.max(countdownRef.current - 1, 0);
        
        if (countdownRef.current === 0) {
          // Forzar a 0 antes de procesar
          setNextScanCountdown(0);
          ejecutarEscaneoAutonomo();
        } else {
          setNextScanCountdown(countdownRef.current);
        }
      }
    }, 1000);

    return () => clearInterval(secTimer);
  }, [ejecutarEscaneoAutonomo, setNextScanCountdown]);

  return (
    <div className="relative group rounded-xl overflow-hidden glass-panel p-2">
      <div className="flex flex-col mb-2 space-y-2">
        <label className="text-xs text-brand-400 font-semibold uppercase tracking-wider pl-1 font-mono">Fuente de captura (Interna/Externa)</label>
        <select 
          className="bg-dark-900 border border-dark-700 text-white text-sm rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none w-full"
          onChange={(e) => setDeviceId(e.target.value)}
        >
          {cameras.map((camera, key) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `Cámara ${key + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[250px]">
         {/* Webcam Setup */}
         <Webcam
           audio={false}
           height={300}
           ref={webcamRef}
           screenshotFormat="image/jpeg"
           videoConstraints={{ deviceId: deviceId }}
           className={`w-full object-cover transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
         />
         
         {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 animate-pulse">
               <RefreshCw className="w-10 h-10 text-brand-400 animate-spin" />
               <span className="ml-3 text-brand-400 font-medium">Ejecutando Modelo de Inferencia...</span>
            </div>
         )}

         {errorStatus && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-sm z-10 text-red-400 font-semibold p-4 text-center">
              <AlertTriangle className="w-8 h-8 mr-2" /> Error de lectura o cámara desconectada.
            </div>
         )}
         
         <div className="absolute bottom-3 right-3 bg-dark-900/80 px-3 py-1.5 rounded-full border border-white/10 flex items-center shadow-lg">
            <Camera className="w-4 h-4 text-white/70 mr-2" />
            <span className="text-xs text-white/90 font-mono">Live Feed</span>
         </div>
      </div>
    </div>
  );
}
