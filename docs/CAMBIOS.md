# Cambios realizados

- Eliminación de productos aleatorios, espera artificial de dos segundos y escaneo cada hora.
- Cámara local con conexión explícita, permisos, liberación de recursos y reintentos.
- Puente Windows go2rtc 1.9.15: RTSP a WebRTC, gateway acotado, clave propia y configuración excluida de Git.
- Cámara física conectada y verificada por RTSP en `172.16.16.6:554`, ruta raíz, a través del puente. Video real de 1920 × 1080 y ejecución continua del modelo local.
- La interfaz propone el puente RTSP como fuente inicial y la entrada HTTP queda disponible para cámaras con un endpoint de fotos real.
- Fuente HTTP de capturas JPEG/PNG/WebP con lectura de píxeles y recuperación de errores.
- Exportación completa del SSD del ZIP a ONNX, con resize y NMS conservados y comparación numérica con TensorFlow.
- Inferencia real en un Web Worker, CPU WebAssembly SIMD, sin procesamiento de imágenes en Vercel.
- Cadencia adaptable, una inferencia a la vez, pausa al ocultar la pestaña y descarte de resultados cancelados.
- Exclusión de inferencias a nivel de motor, incluso entre reconexiones o reinicios del ciclo; las capturas nuevas se descartan si sigue ocupado, sin acumular cola.
- Medición de FPS por intervalos reales entre resultados, incluyendo captura y espera.
- Cancelación explícita al reemplazar el motor, también si la captura todavía está pendiente, para que un ciclo anterior no aborte la carga nueva.
- Detecciones sobre el video con cuadros, etiquetas, confianza e identificador individual.
- Seguimiento por clase y posición con unidades iguales separadas; retiro y reingreso con identidades distintas.
- Regla aprobada para contar una sola unidad cuando el modelo asigna etiquetas distintas a cajas casi idénticas: IoU ≥ 0,85, gana la mayor confianza.
- Inventario persistente por dispositivo, tiempos por segundo y estado pendiente durante interrupciones.
- Descarte de registros simulados guardados por la versión anterior.
- Catálogo generado desde las carpetas de modelos del repositorio, metadatos y SHA-256.
- Pantalla Desarrollador para consultar versiones, seleccionar y cargar modelos, y mostrar fallos e incompatibilidades.
- Corrección de caché anterior y configuración de publicación Vercel para evitar modelos viejos silenciosos.
- `dist` pasa a ser una salida de compilación local excluida de Git; los archivos antiguos se quitaron del índice y Vercel vuelve a generarlos desde las fuentes. No se borró el resultado local de compilación.
- Sensor de luz indicado como no conectado; planificador separado para integrar un disparador futuro.
- Interfaz adaptable a pantalla chica y desplazamiento vertical habilitado.
- Pruebas de seguimiento, persistencia, errores, catálogo, gateway e inferencia real en navegadores Windows.
- Documentación de instalación, cámara, actualización mediante Git y preparación de la muestra.

La prueba física confirmó recepción de cuadros reales antes de publicar en `main` mediante la conexión GitHub autorizada de la cuenta propietaria. Vercel completó el despliegue; se comprobaron video e inferencia desde la web HTTPS publicada en Chrome Windows. Las credenciales, el ejecutable descargado y las capturas privadas permanecen excluidos de Git. El reconocimiento físico de bebidas se pospuso por decisión del usuario.
