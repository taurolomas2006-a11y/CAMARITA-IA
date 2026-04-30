import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useInventoryStore = create(
  persist(
    (set, get) => ({
      inventory: [],
      lastScanTime: null,
      
      // Función principal de actualización basada en causalidad y efecto
      updateInventoryFromScan: (scanDataJSON) => {
        const currentTime = Date.now();
        const currentInventory = get().inventory;
        
        // Parsear JSON si viene como string
        let scannedItems = [];
        try {
          scannedItems = typeof scanDataJSON === 'string' ? JSON.parse(scanDataJSON) : scanDataJSON;
        } catch (e) {
          console.error("Error parseando datos de visión", e);
          return;
        }

        const newInventoryMap = new Map();

        scannedItems.forEach(item => {
          // Sanitización básica: escapar etiquetas HTML si existieran.
          const sanitize = str => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const safeItemName = sanitize(item.objeto);
          const safeLocation = sanitize(item.ubicacion);
          const safeStatus = sanitize(item.estado_visual);

          // Clave única basada en objeto y ubicación combinados
          const itemKey = `${safeItemName}-${safeLocation}`;

          // Revisar si ya existía en nuestro DB local
          const existingItem = currentInventory.find(
            inv => inv.objeto === safeItemName && inv.ubicacion === safeLocation
          );

          if (existingItem) {
            // Objeto existe -> Mantiene timestamp de registro inicial, actualiza estado
            newInventoryMap.set(itemKey, {
              ...existingItem,
              estado_visual: safeStatus,
              ultima_vista: currentTime
            });
          } else {
            // Objeto nuevo -> Se registra con Date.now() actual
            newInventoryMap.set(itemKey, {
              objeto: safeItemName,
              ubicacion: safeLocation,
              estado_visual: safeStatus,
              timestamp_ingreso: currentTime,
              ultima_vista: currentTime
            });
          }
        });

        // En lugar de retener todos (y eliminar solo retirados), 
        // asumimos que el JSON contiene TODO lo que está en la cámara,
        // por lo tanto, reconstruimos el inventario descartando los ausentes.
        const updatedInventory = Array.from(newInventoryMap.values());

        set({
          inventory: updatedInventory,
          lastScanTime: currentTime
        });
      },

      clearInventory: () => set({ inventory: [], lastScanTime: null })
    }),
    {
      name: 'inventario-heladera-storage', // clave para el localStorage
    }
  )
);
