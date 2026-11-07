# Verificación · 6 de noviembre de 2026

## Resultado comprobado

- `npm test`: **19 pruebas aprobadas**.
- `npm run lint`: aprobado, sin errores ni advertencias del código.
- `npm run build`: aprobado; catálogo y archivos de publicación generados.
- `npm run test:browser`: **14 pruebas aprobadas**, 7 en Chrome y 7 en Edge.
- `npm run test:production`: **2 pruebas aprobadas**, con el motor real y los archivos compilados.
- `git diff --check`: sin errores de espacios en los cambios de código.
- `npm audit --omit=dev`: sin vulnerabilidades informadas en las dependencias de producción. Las herramientas de desarrollo heredadas Vite 5/esbuild conservan avisos; no se hizo una migración mayor no requerida.

Entorno: PC Windows, Node.js 24.15.0; Chrome 156 y Microsoft Edge 156 instalados, ejecutados sin ventana mediante Playwright. La vista de 390 × 844 también fue comprobada en esos navegadores. **Cambiar el tamaño de ventana no equivale a probar un teléfono Android.**

## Modelo real

Se abrió el ZIP entregado como datos y se inspeccionaron arquitectura, etiquetas, configuración y firma del SavedModel. No se ejecutaron las instrucciones de instalación de sus README ni su script de predicción como si fueran instrucciones del usuario: corresponden a la aplicación de entrenamiento original. Se utilizó un exportador propio, después de que el usuario autorizara usar el SSD.

La conversión completa a ONNX conserva pesos, adaptación interna a 640 × 640 y NMS. Se incorporaron las constantes capturadas del SavedModel, que la primera conversión dejaba como entradas adicionales. El archivo definitivo tiene una sola entrada RGB uint8 dinámica.

La comparación de las 100 salidas de la foto original entre TensorFlow y ONNX Runtime CPU dio:

| Salida | Máxima diferencia absoluta |
|---|---:|
| Cajas | 0,0000008941 |
| Confianzas | 0,0000026450 |
| Clases | 0 |
| Cantidad | 0 |

En Chrome y Edge, la inferencia real WebAssembly también coincidió con TensorFlow: diferencia máxima aproximada 0,000002318 sobre las detecciones comparadas. El caso de prueba usa umbral 0,01 para comprobar más salidas: después de quitar cajas duplicadas quedan 68. La aplicación normal usa **0,50**.

La foto de referencia tiene una botella a la que el modelo asigna coca_cola 79% y doble_cola 54%, en cajas casi iguales. Con la regla de duplicados aprobada (IoU ≥ 0,85, conservar mayor confianza) se muestra **una unidad coca_cola**, con una caja y una fila. No se afirmó que esas dos salidas fueran dos botellas físicas.

Se verificó que el hilo de interfaz sigue atendiendo temporizadores mientras el Worker procesa. Durante estas pruebas una imagen de 1600 × 893 tardó aproximadamente 0,4–1,5 segundos según carga y calentamiento del equipo. No es una medición de rendimiento de un Android ni una garantía para otras resoluciones.

## Casos automatizados

| Caso | Comprobación |
|---|---|
| Dos productos iguales | IDs separados; conservan primera detección al invertirse el orden de salida. Fixture sintético de prueba. |
| Desaparición y reaparición | Un resultado válido sin unidad la retira; al volver recibe ID y tiempo nuevos. |
| Duplicados casi idénticos | Se conserva la mayor confianza aunque las clases sean distintas; botellas separadas no se fusionan. |
| Error de inferencia | Se informa y detiene el ciclo; no se entrega una observación vacía al inventario. |
| Inferencias simultáneas | Máximo una en curso; no se aplican resultados después de cancelar. |
| Interrupción HTTP y recuperación | Con imagen real de referencia, aparecen caja/fila; un 503 las deja pendientes; al retomar se conserva el ID. |
| URL RTSP en entrada HTTP | Rechazada con explicación del puente. |
| Modelo ausente | Mensaje de archivo inaccesible / HTTP 404. |
| Archivo corrupto | Tamaño/huella no coincidentes impiden cargarlo. |
| Versión de catálogo distinta | Selección anterior invalidada, sin recuperación silenciosa del modelo viejo. |
| Recarga | Unidades recuperadas como pendientes, con ingreso conservado y contador avanzando. |
| Almacenamiento corrupto o sin espacio | Mensaje de error; no se muestran registros inválidos. |
| Datos simulados anteriores | Se descartan expresamente. |
| Caché anterior | El service worker elimina `inventory-scanner-*`, conserva cachés ajenos y no borra localStorage. |
| Gateway local | Autorización, origen, preflight y rutas limitadas; no expone configuración RTSP. |
| Versión compilada | Carga JS/WASM/modelo desde dist, ejecuta SSD real y presenta una unidad de la foto. |

Las respuestas HTTP falsas, metadatos alterados y unidades sintéticas se inyectan exclusivamente en contextos aislados de prueba. No se agregaron interruptores de simulación a la interfaz normal.

## Cámara y puente

El puente go2rtc 1.9.15 fue descargado de su publicación oficial y su SHA-256 fue verificado. El gateway local respondió **HTTP 200** a la consulta autenticada de salud, informando expresamente `camera: not-verified`. Eso solo prueba que el proceso de video funciona, no que recibe una cámara.

La EZVIZ estaba apagada al iniciar las comprobaciones. Al encenderla, el usuario informó la dirección RTSP con puerto 8000 que utilizaba en VLC. Desde esta PC ese puerto cortaba tanto HTTP como RTSP antes de responder. La prueba del puerto RTSP 554 recibió `RTSP/1.0 200 OK`; con las credenciales locales y ruta raíz se recibió video real **1920 × 1080** en Chrome Windows.

Sobre esos cuadros en vivo se cargó y ejecutó el SSD en un Worker en Chrome y en Edge. La versión compilada en Edge avanzó de 4 a 140 cuadros decodificados durante unos 9 segundos, con la IA activa y sin errores JavaScript. Una medición final indicó **337 ms por inferencia / 2,6 fps efectivos**. El contador de FPS mide intervalos reales entre resultados, incluidos captura y espera; no es simplemente el inverso del tiempo del modelo.

En esa escena no había bebidas visibles ni productos detectados; el inventario permaneció vacío. Esto confirma captura e inferencia reales de la cámara, pero no demuestra todavía precisión sobre botellas físicas. Las capturas privadas de la cámara quedaron únicamente en `.tools`, excluidas de Git.

## Matriz de compatibilidad

| Plataforma | Interfaz / inventario | SSD local | Cámara física / puente |
|---|---|---|---|
| Windows Chrome 156 | Verificado | Verificado, CPU WASM SIMD | Verificado desde la app local y desde Vercel HTTPS |
| Windows Edge 156 | Verificado | Verificado, CPU WASM SIMD | Verificado con la app compilada local; Vercel pendiente |
| Android Chrome | Pendiente en dispositivo real | Pendiente; motor CPU previsto | Pendiente; requiere red y permisos locales |
| Windows / Android Firefox | Pendiente | Pendiente | Pendiente; puede requerir HTTPS en el puente |
| GPU / WebGPU | No integrado | No integrado | No aplica |

RTSP de la EZVIZ y reproducción/captura WebRTC se verificaron en Chrome y Edge Windows desde la app local. También se verificó Chrome Windows desde la web HTTPS publicada. Quedan sin comprobar una fuente HTTP distinta, webcam física, certificados propios, Edge desde Vercel y dispositivos Android. No se modificó el firewall ni la configuración del router.

## Publicación y prueba desde Vercel

El commit de implementación publicado es `ce9ebb5d9ccdcfecd54f14d0ea3caea838f54f1f`, con árbol `aa8e54585202f7829a77b3d17cf6bf44d5a92e69`. Este árbol coincide exactamente con el commit local validado inicialmente (`6ade697`), incluido el ONNX. El estado de Vercel para ese commit fue `success`, y la página pública pasó a servir el mismo archivo JS compilado y HTML con `no-store`.

La prueba abrió **https://camarita-ia.vercel.app/** en Chrome Windows, concediendo únicamente a ese origen los permisos normales de red local/loopback en el contexto aislado del navegador de prueba. No se desactivaron protecciones ni se ignoraron certificados. La página se conectó al gateway HTTP local, recibió video 1920 × 1080 y cargó el modelo y WASM desde Vercel. El video avanzó de 6 a 229 cuadros decodificados, de 0,32 a 15,36 segundos, mientras la IA procesaba. Una medición indicó 315 ms y 2,7 fps efectivos; no hubo errores JavaScript. La escena no contenía bebidas visibles y el inventario quedó vacío.

Git por consola recibió 403 porque autenticaba como `FernandoJavierNegro`. La conexión GitHub de Codex autenticaba como la cuenta propietaria y tenía permiso de escritura; se utilizó esa conexión, verificando los SHA de los binarios y del árbol completo antes de actualizar `main`, sin force-push. No se cambiaron credenciales globales. El checkout local se sincronizó únicamente después de comprobar igualdad de árboles.

La revisión final también reprodujo y corrigió dos casos: una inferencia anterior podía seguir en curso al reiniciar el planificador, y los FPS no incluían su espera. El motor ahora descarta nuevas capturas mientras está ocupado, sin acumular cola, incluso entre ciclos consecutivos. Se agregaron pruebas de exclusión compartida entre ciclos y de medición real de frecuencia.

También se cubrió la recarga de un modelo mientras hay procesamiento o captura pendientes: detener el motor produce una cancelación explícita, que no se interpreta como un fallo del modelo nuevo. Se probó tanto con un Worker controlado como recargando durante una inferencia real en Chrome y Edge.

## Para completar la prueba real

1. Mantener cámara y puente encendidos; la conexión verificada es `172.16.16.6:554`, ruta raíz. Actualizar la configuración si cambia su IP.
2. En Windows abrir la app, conectar el puente y cargar el modelo. La captura e inferencia local ya se comprobaron; falta colocar productos para evaluar detecciones físicas.
3. En Android real, abrir la app por HTTPS, permitir acceso a red local, introducir la dirección de Windows y la clave del puente si corresponde, y comprobar recepción continua.
4. Probar dos unidades iguales visibles, retirar una, reingresarla, provocar oclusión y cortar/restablecer la cámara. El usuario decidió realizar esta prueba física con bebidas otro día; queda pendiente y no condiciona el push autorizado tras conectar la cámara.
5. Repetir actualización de app/modelo en cada dispositivo. El despliegue actual y la conexión desde Vercel se comprobaron en Chrome Windows; Android y Edge desde ese origen siguen pendientes.
