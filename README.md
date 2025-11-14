# IG-S8
Entrega de la Tarea de la S8 de la asignatura Informática Gráfica.
## Enunciado
Esta tarea consistirá en proponer una visualización de datos de acceso abierto que contengan información geográfica en threejs, con las habilidades adquiridas en las sesiones previas. Podrás optar bien por adoptar datos integrando información OSM o datos sobre mapas o su combinación. Es requisito necesario para superar la práctica incluir en la entrega una captura en vídeo (preferentemente de no más de 30 segundos) que ilustre el resultado de la visualización. La entrega se realiza a través del campus virtual proporcionando un enlace github.

## Desarrollo de la tarea
Tomando como partida el [mapa de las estaciones de la sitycleta](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S8/code/script_24_mapasitycleta.js) que nos proporcionó el profesor [Modesto](https://github.com/otsedom/otsedom.github.io/tree/main) en clase, se me ocurrió hacer algo interesante con los datos de mis viajes de la sitycleta. Dado que mi uso de esta es muy frecuente, y empecé a usarla el 10/10/2025, decidí contear todos mis viajes hasta el 11/11/2025 (un mes de uso) y trabajar con estos datos para marcar las estaciones en el mapa que he visitado con más/menos frecuencia y las que todavía me quedan por visitar. 

Para conseguir los datos de mis viajes en un formato tratable contacté con [Sagulpa](https://www.sagulpa.com/contactar) para que me proporcionasen un archivo de mis datos en formato .csv o en cualquier archivo de texto a tratar. Como su respuesta fue inexistente y mi interés por realizar el proyecto era grande, decidí meter mi registro de viajes 1 a 1 en un archivo .csv para tratarlos en la práctica. Una vez realizado el [archivo de rutas](https://github.com/guillecab7/IG-S8/blob/main/src/SITYRUTAS-2025.csv) empezamos a realizar el proyecto.

## Realización de la practica
Toda la práctica y archivos han sido desarrollados en el CodeSandbox. Aquí os dejo el enlace al [CodeSandbox](https://codesandbox.io/p/sandbox/ig2526-s8-forked-72m3r8) por si queréis echarle un ojo. 

Ahora pasaré a explicar el código realizado del [marcador de mis estaciones recorridas](https://github.com/guillecab7/IG-S8/blob/main/src/Marcador_estaciones_recorridas.js), pero antes de eso comentar que tenemos un [catálogo con todas las estaciones de la sitycleta](https://github.com/guillecab7/IG-S8/blob/main/src/Geolocalizaci%C3%B3n%20estaciones%20sitycleta.csv), que es el que vamos a usar para marcar las estaciones en el [mapa de Las Palmas de Gran Canaria](https://github.com/guillecab7/IG-S8/blob/main/src/mapaLPGC.png).

### Parámetros clave 
Empezamos importando las librerías correspondientes, y antes de la función init creamos unos parámetros clave para la práctica.
```js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
```
Carga Three.js para render 3D en WebGL y los controles de cámara orbitantes.

```js
let scene, renderer, camera, camcontrols;
```
Referencias a la escena, el motor de render, la cámara y los controles.
```js
let mapa,
  mapsx,
  mapsy,
  scale = 5;
```
`mapa` será el plano con la textura; `mapsx/mapsy` su tamaño; `scale` determina su altura básica.

```js
// Límites del mapa
let minlon = -15.46945,
  maxlon = -15.39203;
let minlat = 28.07653,
  maxlat = 28.18235;
```
Rango de longitud/latitud de la imagen del mapa. Se usan para convertir coordenadas geográficas a coordenadas del plano.
```js
// Colores
const C_GRIS = 0x9bbbd1; // no visitada
const C_VERDE = 0x00c853; // 1–2 visitas
const C_NARAN = 0xff8c00; // 3–5 visitas
const C_ROJO = 0xff0000; // >5 visitas
```
Colores por número de visitas de cada estación:

- Gris: no visitada

- Verde: 1–2

- Naranja: 3–5

- Rojo: >5

```js
// Velocidad de simulación, podemos jugar con ella para aavanzar más rápido o más despacio
const SPEED_MIN_PER_SEC = 1440; // 1 día por segundo
```
Cuántos minutos simulados avanzan por cada segundo real (aquí 1 día/seg).

```js
// Datos/estado
let objetos = []; // meshes (esferas) de estaciones
const datosEstaciones = []; // {id,nombre,lat,lon,idxMesh}
const nombre2idx = new Map(); // nombre normalizado -> idxMesh
let rutasRaw = []; // rutas leídas del CSV (sin mapear aún)
let eventos = []; // [{time:Date, idx:number}] salidas/llegadas
const visitasPorIdx = new Map(); // idx -> contador visitas
```
`objetos`: meshes (esferas) de cada estación en el mapa.

`datosEstaciones`: info de cada estación (id, nombre, lat/lon, índice del mesh).

`nombre2idx`: índice rápido nombre→mesh para casar nombres desde el CSV de rutas.

`rutasRaw`: viajes leídos (con fechas y nombres de origen/destino).

`eventos`: lista ordenada tiempo→estación (salidas/llegadas) para la simulación.

`visitasPorIdx`: contador de visitas por estación.
```js
let estacionesCargadas, rutasCargadas, simReady;
let simStart, simEnd, simNow, lastTS;
```
Banderas para saber si ya se cargaron estaciones y rutas; simReady indica que se puede simular.
Tiempos: inicio/fin del periodo, tiempo simulado actual y sello temporal del último frame para avanzar el reloj.

### 1) Bootstrap: escena, cámara, render y controles
```js
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
camera.position.z = 5;

renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camcontrols = new OrbitControls(camera, renderer.domElement);
```
Se crea el canvas WebGL, una cámara perspectiva y controles orbitales.

### 2) HUD (panel informativo)
Se crea un `<div>` flotante donde se va actualizando el resumen de la simulación:
```js
hud = document.createElement("div");
Object.assign(hud.style, { ... });
hud.textContent = "Cargando…";
document.body.appendChild(hud);
```
### 3) Carga del mapa
```js
new THREE.TextureLoader().load("src/mapaLPGC.png", (texture) => {
  const ar = texture.image.width / texture.image.height;
  mapsy = scale; mapsx = mapsy * ar;
  Plano(0, 0, 0, mapsx, mapsy);
  mapa.material.map = texture;
  mapa.material.needsUpdate = true;
  // ... aquí se lanzan las cargas de CSV
});
```
- Se crea un plano del tamaño proporcional a la textura (`mapsx × mapsy`).
- La imagen se asigna como textura del plano.

### 4) Carga y parsing del CSV de estaciones
```js
fetch("src/Geolocalización estaciones sitycleta.csv")
  .then(r => r.text())
  .then(procesarCSVEstaciones)
```
`procesarCSVEstaciones`:

- Lee cabeceras y busca índices de `idbase`, `nombre`, `latitud` y `longitud` (o `altitud` como fallback).

- Recorre filas, convierte `lat/lon` a `x/y` del plano con `Map2Range`.

- Crea una esfera por estación (por defecto C_GRIS = no visitada).

- Guarda índice del mesh (`idxMesh`) y genera claves normalizadas para búsquedas por nombre:

### 5) Carga y parsing del CSV de rutas
```js
fetch("src/SITYRUTAS-2025.csv")
  .then(r => r.text())
  .then(procesarCSVRutasUsuario)
```
`procesarCSVRutasUsuario`:

- Divide por líneas y columnas; cada fila aporta:

  - `tIni` y `tFin` → `Date` (Usa la función `convertirFecha`)

  - `origen` y `destino` → texto

- Guarda todas las rutas en `rutasRaw`.

### 6) Preparación de la simulación
Cuando estaciones y rutas están cargadas, `intentarPrepararSimulacion()`:

- Construye una lista de eventos ordenados por tiempo:

  - En la salida (`tIni`) suma 1 visita a la estación de origen.

  - En la llegada (`tFin`) suma 1 visita a la estación de destino.
```js
eventos.push({ time: r.tIni, idx: idxA }); // origen
eventos.push({ time: r.tFin, idx: idxB }); // destino
eventos.sort((a,b) => a.time - b.time);
```
- Inicializa el rango temporal:

  - `simStart` = primera fecha de evento

  - `simEnd` = última fecha de evento

  - `simNow` = reloj simulado (arranca en `simStart`)

- Limpia colores y contadores:

  - Todas las estaciones a C_GRIS.

  - `visitasPorIdx.clear()`.

### 7) Bucle de animación y avance de tiempo
```js
function animate() {
  requestAnimationFrame(animate);

  if (simReady) {
    const now = performance.now();
    const dtSec = Math.max(0, (now - lastTS) / 1000);
    lastTS = now;

    const addMinutes = dtSec * SPEED_MIN_PER_SEC;
    simNow = new Date(simNow.getTime() + addMinutes * 60000);

    while (evtPtr < eventos.length && eventos[evtPtr].time <= simNow) {
      const { idx } = eventos[evtPtr];
      const prev = visitasPorIdx.get(idx) || 0;
      const next = prev + 1;
      visitasPorIdx.set(idx, next);

      // Reglas de color
      if (next > 5)      objetos[idx].material.setValues({ color: C_ROJO });
      else if (next > 2) objetos[idx].material.setValues({ color: C_NARAN });
      else               objetos[idx].material.setValues({ color: C_VERDE });

      evtPtr++;
    }

    if (simNow > simEnd) simNow = new Date(simEnd.getTime());
    setHUD(estadoHUD());
  }

  renderer.render(scene, camera);
}
```
- El reloj simulado (`simNow`) avanza minutos en función de `SPEED_MIN_PER_SEC`.

- Se consumen todos los eventos cuya hora ya pasó respecto a `simNow`.

- Se colorea cada estación según su contador de visitas acumulado.

8) HUD (estado de la simulación)

__estadoHUD()__ devuelve líneas con:

- fecha simulada y rango,

- velocidad (min/s),

- número total de estaciones, cuántas están visitadas y cuántas superan 5,

- leyenda de colores.
Se muestra con:
```js
function setHUD(t) { if (hud) hud.textContent = t; }
```
### Utilidades destacadas

- __Map2Range__: mapea `lon/lat` a coordenadas del plano (manteniendo proporción del mapa).

- __convertirFecha__: parsea `DD/MM/YYYY HH:mm` a `Date`.

### Personalización rápida
#### Velocidad de simulación
```js
const SPEED_MIN_PER_SEC = 1440; // 1 día/s
// Ejemplos:
//  60  -> 1 hora/s
//  720 -> 12 h/s
// 2880 -> 2 días/s
```
#### Umbrales y colores
```js
// Reglas actuales:
if (visitas > 5) rojo
else if (visitas > 2) naranja
else if (visitas >= 1) verde
else gris

// Cambia los hex para tu paleta:
const C_GRIS  = 0x9bbbd1;
const C_VERDE = 0x00c853;
const C_NARAN = 0xff8c00;
const C_ROJO  = 0xff0000;
```
## Video Final
Finalmente, filmé un vídeo de los resultados obtenidos, para mostrar la tarea ante los compañeros. Podéis decargar el [vídeo resultado aquí](https://github.com/guillecab7/IG-S8/blob/main/Video_Resultado.mp4)
__NOTA__: Aunque en el código la velocidad de simulación vaya a 1día/s, como el profe nos pidió un vídeo de menos de 30s, para que quedase un vídeo más corto se cambió la `SPEED_MIN_PER_SEC=2880`, que equivale a 2días/s.
