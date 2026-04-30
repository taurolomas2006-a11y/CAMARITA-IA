import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertTriangle, Wifi } from 'lucide-react';
import { analyzeImage } from '../services/visionModelManager';
import { useInventoryStore } from '../store/useInventoryStore';

// CONSTANTE CRUCIAL: 3600000 ms (1 hora). Modificar a 10000 ms (10 seg) para pruebas en desarrollo.
const SCAN_INTERVAL = 3600000; 

export default function Scanner({ setNextScanCountdown, isProcessing, setIsProcessing }) {
  const webcamRef = useRef(null);
  const wifiImgRef = useRef(null);
  const [errorStatus, setErrorStatus] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState({});
  const [isWifiMode, setIsWifiMode] = useState(false);
  const [wifiUrl, setWifiUrl] = useState('');
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

  const captureWifiFrame = () => {
    if (!wifiImgRef.current) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = wifiImgRef.current.naturalWidth || 640;
      canvas.height = wifiImgRef.current.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(wifiImgRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (e) {
      console.error("CORS Error capturing WiFi frame:", e);
      return null;
    }
  };

  /**
   * Extrae el frame, lo convierte y llama a la API mock de IA.
   */
  const ejecutarEscaneoAutonomo = useCallback(async () => {
    if (scanInProgress.current) return;
    
    scanInProgress.current = true;
    setIsProcessing(true);
    setErrorStatus(false);

    try {
      let imageSrc = null;
      if (isWifiMode) {
        imageSrc = captureWifiFrame();
      } else if (webcamRef.current) {
        imageSrc = webcamRef.current.getScreenshot();
      }
      
      if (!imageSrc) throw new Error("No frame captured");

      // Llamada a Simulación API IA
      const analisisJson = await analyzeImage(imageSrc);
      
      // Causalidad y efecto
      updateInventoryFromScan(analisisJson);
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
  }, [updateInventoryFromScan, setIsProcessing, setNextScanCountdown, isWifiMode]);

  // Motor de Bucle Principal (Seguro contra closures)
  useEffect(() => {
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
        <div className="flex items-center justify-between">
          <label className="text-xs text-brand-400 font-semibold uppercase tracking-wider pl-1 font-mono flex items-center">
            Fuente de captura
          </label>
          <button 
            onClick={() => setIsWifiMode(!isWifiMode)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center shadow-sm border ${
              isWifiMode 
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' 
                : 'bg-dark-800 text-gray-400 border-dark-600 hover:bg-dark-700'
            }`}
          >
            <Wifi className="w-3 h-3 mr-1" />
            {isWifiMode ? 'Modo WiFi IP' : 'Añadir Cam WiFi'}
          </button>
        </div>
        
        {isWifiMode ? (
          <input 
            type="text" 
            placeholder="http://192.168.1.100:81/stream" 
            className="bg-dark-900 border border-brand-500/50 text-white text-sm rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none w-full placeholder-gray-600"
            value={wifiUrl}
            onChange={(e) => setWifiUrl(e.target.value)}
          />
        ) : (
          <select 
            className="bg-dark-900 border border-dark-700 text-white text-sm rounded-lg p-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none w-full"
            onChange={(e) => setDeviceId(e.target.value)}
            value={deviceId || ''}
          >
            {cameras.map((camera, key) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Cámara ${key + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[250px]">
         {/* Webcam Setup */}
         {isWifiMode ? (
           wifiUrl ? (
             <img 
               ref={wifiImgRef}
               src={wifiUrl}
               crossOrigin="anonymous"
               alt="WiFi Camera Stream"
               className={`w-full h-full object-cover min-h-[300px] transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
               onError={() => setErrorStatus(true)}
               onLoad={() => setErrorStatus(false)}
             />
           ) : (
             <div className="text-gray-500 text-sm flex flex-col items-center">
               <Wifi className="w-8 h-8 mb-2 opacity-50" />
               Ingresa la URL del stream WiFi
             </div>
           )
         ) : (
           <Webcam
             audio={false}
             height={300}
             ref={webcamRef}
             screenshotFormat="image/jpeg"
             videoConstraints={{ deviceId: deviceId }}
             className={`w-full object-cover transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
           />
         )}
         
         {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 animate-pulse">
               <RefreshCw className="w-10 h-10 text-brand-400 animate-spin" />
               <span className="ml-3 text-brand-400 font-medium">Ejecutando Modelo de Inferencia...</span>
            </div>
         )}

         {errorStatus && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-sm z-10 text-red-400 font-semibold p-4 text-center">
              <AlertTriangle className="w-8 h-8 mr-2" /> Error de conexión o cámara no disponible.
            </div>
         )}
         
         <div className="absolute bottom-3 right-3 bg-dark-900/80 px-3 py-1.5 rounded-full border border-white/10 flex items-center shadow-lg">
            <Camera className="w-4 h-4 text-white/70 mr-2" />
            <span className="text-xs text-white/90 font-mono">
              {isWifiMode ? 'WiFi Feed' : 'Live Feed'}
            </span>
         </div>
      </div>
    </div>
  );
}

