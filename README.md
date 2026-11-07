# Camarita IA · demostración de heladera

Aplicación React/Vite para video, detección local e inventario por unidad. No genera detecciones simuladas. El sensor de luz figura como **no conectado**; el funcionamiento actual es continuo, con una sola inferencia en curso y un máximo de 5 cuadros procesados por segundo, reducido automáticamente según la duración del procesamiento.

## Instalación y ejecución en Windows

Requisito: Node.js 22.12 o superior (desarrollo comprobado con 24.15).

```powershell
cd "C:\Users\ferna\OneDrive\Desktop\2026\Heladera\CAMARITA-IA"
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`. Elegir la fuente, pulsar **Conectar** y después **Cargar y validar modelo** en Desarrollador. La cámara del dispositivo se solicita al pulsar Conectar, no al abrir la página. La detección comienza cuando hay un modelo cargado y cuadros nuevos.

Para preparar los archivos de publicación:

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

`dist/` es una salida generada y está excluida de Git. Vercel debe ejecutar el build desde estas fuentes; los binarios de modelos se versionan en `public/models/`.

En Android, la opción más sencilla es la aplicación publicada por HTTPS. Abrir un servidor HTTP por su IP de red no habilita la cámara del teléfono ni todas las funciones del motor. `localhost` en el teléfono se refiere al teléfono, no a Windows.

## Cámara del dispositivo o USB

Elegir **Cámara del dispositivo / USB**, seleccionar la cámara y conectar. Se requiere permiso del navegador y HTTPS o localhost. Permisos denegados, cámara ocupada y desconexiones muestran un mensaje. Los errores de conexión transitorios reintentan cada 3–30 segundos. Desconectar cancela reintentos y libera la cámara.

La pestaña debe quedar visible durante la muestra. Al ocultarla se pausa la inferencia y las unidades quedan pendientes. Los temporizadores de ingreso siguen corriendo. Bloquear el teléfono, suspender Windows o cambiar de pestaña puede suspender la cámara; no se interpreta como retiro de productos.

## EZVIZ H1c por RTSP: puente Windows

El navegador recibe WebRTC desde un puente local go2rtc. La PC debe permanecer encendida en la misma red que el teléfono y la cámara. Vercel aloja la aplicación y los modelos; no transporta el video ni realiza inferencia.

Se prepararon `bridge/setup.ps1`, `bridge/server.mjs` y una configuración **local, excluida de Git**. En esta PC el ejecutable go2rtc 1.9.15 ya fue descargado y se comprobó su SHA-256 contra la publicación oficial. Para otra instalación:

```powershell
.\bridge\setup.ps1
npm run bridge
```

El instalador solicita la URL RTSP sin mostrarla y genera una clave del puente. `bridge/bridge.local.json` guarda la URL RTSP y esa clave. El proceso genera `bridge/go2rtc.local.yaml`, también excluido de Git. **La clave que se introduce en la app es `token`, no la contraseña RTSP.**

En la aplicación, elegir **EZVIZ por puente local**:

- En la misma PC: `http://localhost:1985`.
- En Android: `http://IP-DE-LA-PC-WINDOWS:1985`.
- Copiar el campo `token` de `bridge.local.json` en **Clave del puente**.

El gateway permite solamente señalización de video y una consulta de estado, requiere la clave y comprueba el origen web. La administración de go2rtc queda en `127.0.0.1:1984`, inaccesible desde la red. El video usa TCP/UDP 8555; el gateway usa TCP 1985. Si Windows solicita permiso de red, permitirlo en la red privada de la demostración. No hace falta abrir puertos en Internet.

Con Chrome y Edge puede ser necesario autorizar **red local** o **loopback** en los permisos del sitio. La app declara el tipo de dirección en sus solicitudes HTTP. La conexión desde `https://camarita-ia.vercel.app/` hacia este puente HTTP y la cámara física fue verificada en Chrome Windows con esos permisos concedidos para ese sitio. El comportamiento depende de la versión del navegador. Firefox u otros navegadores que bloqueen esta combinación requieren un puente HTTPS con certificado confiable. El servidor admite `tlsCert` y `tlsKey` en la configuración local para rutas a certificados PEM; no se instalaron certificados ni se desactivaron controles del navegador.

La conexión verificada desde esta PC es **RTSP en 172.16.16.6:554, ruta raíz `/`**, con las credenciales guardadas únicamente en `bridge.local.json`. El puerto 8000 comunicado para VLC cortó la conexión desde esta PC; el puerto 554 respondió a RTSP y entregó video real 1920 × 1080 a la aplicación. No fue necesario agregar `/streaming` ni otra ruta. La interfaz propone el puente RTSP como fuente inicial.

Cambiar `rtspUrl` y reiniciar `npm run bridge` cuando cambie la IP. La consulta de salud del puente sigue indicando que no verifica la cámara por sí sola: solo la recepción de cuadros habilita el estado de video en la interfaz.

Para evitar cambios de IP, se puede reservar su dirección DHCP por MAC en el router. La ubicación de esa opción depende del router. Si cambia también la IP de Windows, actualizar la dirección del puente en Android.

Fuentes del componente: [go2rtc](https://github.com/AlexxIT/go2rtc), [API de señalización usada](https://github.com/AlexxIT/go2rtc/blob/v1.9.15/internal/webrtc/server.go), [permisos de red local en Chrome](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access).

## Fuente HTTP

La cámara utilizada quedó conectada mediante RTSP y el puente. Las pruebas HTTP a su puerto 8000 terminaron con `ECONNRESET`; no se configuró ese puerto como fuente HTTP ni se presupuso un endpoint de fotos.

La opción **HTTP: fotos JPEG actualizadas** implementa solicitudes sucesivas a un endpoint que entregue una imagen JPEG, PNG o WebP y permita CORS. Una vez descargada y decodificada cada foto, espera 250 ms antes de pedir la siguiente. Distingue errores HTTP y contenido incorrecto; cancela la lectura si la fuente se interrumpe. **No reproduce directamente MJPEG ni HLS.** Para RTSP se usa el puente; otros formatos HTTP necesitan validar el endpoint antes de agregar su reproductor.

Para otra cámara HTTP, ingresar su URL de captura real. En HTTPS también se aplican permisos de red local y las restricciones de contenido mixto del navegador. Mostrar una imagen y poder leer sus píxeles son comprobaciones distintas; la app verifica acceso de lectura antes de usarla.

## Modelo real incluido

El ZIP entregado contiene **SSD MobileNet V2 FPNLite**, no YOLOv8, con el identificador original `TODO_cont20ep_20261104_211244`. Se autorizó utilizar este SSD. Se exportó a ONNX completo en `public/models/ssd-todo-50ep-v1/model.onnx`; conserva sus pesos, el resize interno y el NMS del SavedModel.

- Entrada: `image:0`, RGB `uint8`, NHWC `[1,H,W,3]`. Se envían píxeles originales, sin normalización ni letterbox.
- Salidas: cajas, puntuaciones, clases y cantidad. Los nombres exactos están en `model.json`.
- Cajas: `[ymin,xmin,ymax,xmax]` normalizadas respecto de la imagen original.
- IDs SSD 1–6 se convierten a IDs de aplicación 0–5.
- Clases: `coca_cola`, `manaos_pomelo`, `pritty`, `doble_cola`, `agua`, `sprite`.
- Umbral: 0,50. El NMS propio del modelo se conserva. Después se aplica la regla aprobada para unidades físicas: cajas con IoU de 0,85 o superior se consideran duplicadas, incluso entre clases, y se conserva la de mayor confianza. No se fusionan botellas separadas.
- Motor: ONNX Runtime Web 1.31.1, **CPU / WebAssembly SIMD, un hilo**, dentro de un Web Worker. No requiere enviar imágenes a un servidor ni aislamiento de origen para múltiples hilos.

El motor verifica nombres, tipo y forma de entrada al cargar, y valida salidas y cajas en cada inferencia. Las extensiones ONNX o TFLite por sí solas no prueban compatibilidad. El catálogo reconoce ambos formatos; **el motor actual solo ejecuta el contrato `onnx-ssd` validado**. YOLOv8, TFLite FP16, WebGPU y otros contratos siguen pendientes de una integración propia y pruebas con archivos reales.

El modelo conserva su condición experimental. Puede confundir etiquetas, omitir botellas o producir etiquetas de clases distintas sobre una misma botella. La foto incluida produjo dos etiquetas sobre la misma botella (coca_cola 79% y doble_cola 54%); con la regla aprobada se registra una sola unidad coca_cola. Dos productos muy superpuestos también pueden fusionarse por esta regla. Esto no establece precisión general ni desempeño en la heladera.

La comparación numérica de TensorFlow y ONNX CPU está en `docs/model-conversion.json` y comprueba las 100 salidas originales. Las pruebas de navegador comparan las salidas filtradas y sin duplicados al umbral de prueba 0,01 contra TensorFlow; ese umbral se usa **solo en pruebas**, la app usa 0,50. La conversión es reproducible con `scripts/export-ssd-onnx.py`, el TensorFlow 2.21 original y las versiones declaradas en `docs/requirements-export.txt`. Los convertidores adicionales se instalaron en `.tools/conversion-libs`, sin cambiar el entorno del proyecto de entrenamiento.

## Agregar modelos mediante Git

1. Crear `public/models/<id-unico-de-version>/`.
2. Guardar el archivo exportado y `model.json`. Usar el metadato incluido como referencia para este mismo contrato SSD. No copiar su firma para modelos de otra arquitectura.
3. Cambiar `id`, `version`, `name`, `file`, etiquetas y datos del contrato según el archivo real. La carpeta debe coincidir con `id`; el nombre del archivo no puede contener directorios.
4. Ejecutar `npm run models:catalog`. El proceso genera `public/models/catalog.json` con tamaño y SHA-256. Falta de archivos, JSON inválido, clases inválidas, archivos vacíos o punteros LFS sin descargar detienen la generación.
5. Ejecutar pruebas y `npm run build`. Subir el binario, sus metadatos, catálogo y código necesario al repositorio. No subir `.tools`, `node_modules` ni `bridge/*.local.*`.
6. Si Vercel está conectado a la rama que recibe el push, esperar un despliegue exitoso. Si no está conectado o no publica esa rama, hacer el despliegue correspondiente en Vercel. **Un push por sí solo no actualiza una app ya descargada.**
7. En cada dispositivo pulsar **Actualizar aplicación**, después **Actualizar catálogo**, seleccionar la versión y **Cargar y validar modelo**. La inferencia se detiene al actualizar el catálogo o cambiar de modelo; el inventario se conserva pendiente.

El binario actual pesa aproximadamente 10,9 MiB y cabe como archivo Git normal. El catálogo se regenera antes de `dev` y `build`; un contrato nuevo puede necesitar cambios de código además de los archivos del modelo.

### Caché y versiones

El catálogo y los modelos se piden con `cache: no-store`. Cada modelo incluye su SHA-256 en la URL y se comprueba la huella completa antes de cargarlo. La selección guardada incluye id, versión y huella: si cambia o desaparece, se invalida y se pide elegir nuevamente. No hay recuperación silenciosa de un modelo anterior.

`vercel.json` declara `no-store` para HTML, service worker y modelos. El service worker nuevo elimina solo los cachés antiguos `inventory-scanner-*` y no guarda modelos ni cámara. Los archivos JS/CSS/WASM de compilación usan nombres con huella. En la primera actualización desde la versión anterior puede hacer falta recargar de nuevo una vez instalado el service worker nuevo. Si sigue apareciendo la interfaz antigua, actualizar/eliminar ese service worker desde las herramientas del navegador y recargar; no borrar el almacenamiento local del inventario.

No se preparó instalación completamente sin conexión: se necesitan descargar la app, WASM y el modelo. Una vez cargados, las inferencias son locales, pero una recarga sin acceso al sitio puede impedir iniciar otra vez.

## Inventario y tiempos

Cada unidad tiene un identificador independiente, clase, caja, confianza, primera detección y última vista. El seguimiento asocia por clase/etiqueta y superposición o cercanía espacial, uno a uno. Dos unidades iguales pueden conservar identidades aunque cambie el orden de las detecciones.

Un resultado **válido** sin una unidad la retira inmediatamente. Si reaparece, recibe un ID nuevo y tiempo de ingreso nuevo. Un resultado inválido o un error de cámara/modelo nunca se convierte en una lista vacía.

Según lo acordado, las interrupciones, recargas y reinicios conservan las unidades como **pendientes de confirmar**, con el tiempo corriendo desde su ingreso original. Al retomar la misma fuente y la misma versión de modelo, el primer resultado válido reconcilia por clase y posición; los ausentes se retiran y los presentes recuperan identidad cuando es posible. Cambiar de fuente o versión de modelo crea un contexto distinto: no hereda identidades de otro contexto. Los datos simulados de la aplicación anterior se descartan expresamente.

La persistencia usa el navegador de cada dispositivo. Se guarda como máximo una vez por segundo y se fuerza un guardado al salir de la página. Un cierre abrupto puede perder hasta aproximadamente un segundo de observaciones. Borrar datos del sitio, modo privado o fallos de almacenamiento pueden impedir recuperarlos; la app informa errores. Chrome, Edge, otro perfil y otro dispositivo tienen inventarios separados.

Limitaciones: una oclusión de un solo cuadro retira la unidad; cruces, cambios de clase, movimientos bruscos o movimientos mientras la cámara está desconectada pueden cambiar/intercambiar IDs. No es identificación física ni reidentificación por apariencia. El tiempo usa el reloj del dispositivo: cambiarlo modifica el tiempo mostrado. Mantener la cámara fija, las etiquetas visibles y evitar tapar unas botellas con otras durante la muestra.

## Pruebas y preparación de la muestra

```powershell
npm test
npm run lint
npm run test:browser
npm run build
npm run test:production
```

Las pruebas de navegador usan los Chrome y Edge instalados en Windows; no necesitan descargar Chromium. Los fixtures sintéticos están restringidos a pruebas de seguimiento/persistencia/errores. El procesamiento del modelo se comprueba con una foto real incluida en el paquete; no se presentan fixtures de pruebas en la aplicación normal.

La matriz de comprobaciones y los requisitos pendientes se detallan en `docs/VERIFICACION.md`. Antes de la demostración: encender cámara/PC, comprobar direcciones y ruta, iniciar el puente si corresponde, autorizar permisos, cargar el modelo en cada dispositivo y probar dos botellas iguales, retirar una y volver a ingresarla.

Esta versión se publicó en `main` mediante la conexión GitHub de la cuenta propietaria. Vercel completó el despliegue y se comprobó que la web pública servía los mismos archivos compilados que la versión local, con `Cache-Control: no-store` para HTML. Después se verificaron video e inferencia de la cámara física desde esa web en Chrome Windows.

El Git de Windows usaba otra cuenta sin permiso de escritura y recibió un 403; no se cambiaron sus credenciales globales. La publicación por el conector conservó exactamente el árbol de archivos validado, y el checkout local quedó sincronizado con `origin/main`. La configuración local, claves del puente y capturas privadas permanecen fuera del repositorio; se recrean en cada PC que vaya a funcionar como puente. Los despliegues posteriores deben comprobarse nuevamente.
