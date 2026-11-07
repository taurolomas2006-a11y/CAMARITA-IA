import { useCallback, useEffect, useRef, useState } from 'react';
import { modelKey } from '../domain/modelCatalog.js';
import { loadCatalog, verifyModel } from '../services/modelCatalog.js';
import { createVisionEngine } from '../services/visionEngine.js';

const selectionKey = 'camarita-selected-model-v1';
export function useModels(onInterrupted) {
  const [catalog, setCatalog] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [engine, setEngine] = useState(null);
  const [status, setStatus] = useState({ state: 'idle', message: 'Consultando modelos incluidos…' });
  const [catalogError, setCatalogError] = useState('');
  const [preferenceError, setPreferenceError] = useState('');
  const current = useRef(null);
  const operation = useRef(0);
  const controller = useRef(null);

  const stop = useCallback(() => {
    operation.current++;
    controller.current?.abort();
    current.current?.dispose();
    current.current = null;
    setEngine(null);
    onInterrupted();
  }, [onInterrupted]);

  const refresh = useCallback(async () => {
    stop();
    const id = operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setCatalogError('');
    setStatus({ state: 'loading', message: 'Actualizando catálogo publicado…' });
    try {
      const next = await loadCatalog(abort.signal);
      if (id !== operation.current) return;
      setCatalog(next);
      let saved = '';
      try { saved = localStorage.getItem(selectionKey) || ''; } catch { setPreferenceError('No se pudo leer la selección local.'); }
      const match = next.models.find((model) => modelKey(model) === saved);
      setSelectedId(match?.id || (!saved ? next.models[0]?.id : '') || '');
      setStatus({ state: 'idle', message: saved && !match ? 'La versión seleccionada cambió o ya no está publicada. Seleccioná y cargá el modelo nuevamente.' : 'Seleccioná un modelo y cargalo para comprobarlo en este dispositivo.' });
    } catch (error) {
      if (!abort.signal.aborted) { setCatalog(null); setSelectedId(''); setCatalogError(error.message); setStatus({ state: 'error', message: 'Sin catálogo válido; inferencia detenida.' }); }
    }
  }, [stop]);

  useEffect(() => {
    refresh();
    return stop;
  }, [refresh, stop]);

  const select = (id) => {
    stop();
    setSelectedId(id);
    const model = catalog?.models.find((entry) => entry.id === id);
    try { if (model) localStorage.setItem(selectionKey, modelKey(model)); else localStorage.removeItem(selectionKey); }
    catch { setPreferenceError('La selección no se pudo guardar; deberás elegir el modelo al recargar.'); }
    setStatus({ state: 'idle', message: 'Modelo seleccionado. Cargalo para verificar el archivo y el motor.' });
  };

  const load = async () => {
    const model = catalog?.models.find((entry) => entry.id === selectedId);
    if (!model) return;
    stop();
    const id = operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setStatus({ state: 'loading', message: 'Descargando y verificando la huella del modelo…' });
    try {
      const bytes = await verifyModel(model, abort.signal);
      if (id !== operation.current) return;
      const nextEngine = createVisionEngine(model);
      current.current = nextEngine;
      setStatus({ state: 'loading', message: 'Archivo íntegro. Preparando el motor de IA local…' });
      const result = await nextEngine.load(bytes);
      if (id !== operation.current) { nextEngine.dispose(); return; }
      setEngine(nextEngine);
      try { localStorage.setItem(selectionKey, modelKey(model)); } catch { setPreferenceError('No se pudo guardar la selección en este navegador.'); }
      setStatus({ state: 'ready', message: result.backend });
    } catch (error) {
      if (id === operation.current) { current.current?.dispose(); current.current = null; setStatus({ state: 'error', message: error.message }); }
    }
  };
  const fail = useCallback((error) => { stop(); setStatus({ state: 'error', message: error.message }); }, [stop]);
  return { catalog, catalogError, preferenceError, selectedId, selected: catalog?.models.find((model) => model.id === selectedId), engine, status, select, load, refresh, fail };
}
