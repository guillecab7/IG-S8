import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer, camera, camcontrols;
let mapa,
  mapsx,
  mapsy,
  scale = 5;

// Límites del mapa
let minlon = -15.46945,
  maxlon = -15.39203;
let minlat = 28.07653,
  maxlat = 28.18235;

// Colores
const C_GRIS = 0x9bbbd1; // no visitada
const C_VERDE = 0x00c853; // 1–2 visitas
const C_NARAN = 0xff8c00; // 3–5 visitas
const C_ROJO = 0xff0000; // >5 visitas

// Velocidad de simulación: Cambiar para ver más rápido o despacio
const SPEED_MIN_PER_SEC = 1440; // 1 día por segundo
// Ejemplos:
//  60  -> 1 hora/s
//  720 -> 12 h/s
// 2880 -> 2 días/s

// Datos/estado
let objetos = []; // meshes (esferas) de estaciones
const datosEstaciones = []; // {id,nombre,lat,lon,idxMesh}
const nombre2idx = new Map(); // nombre normalizado -> idxMesh
let rutasRaw = []; // rutas leídas del CSV (sin mapear aún)
let eventos = []; // [{time:Date, idx:number}] salidas/llegadas
const visitasPorIdx = new Map(); // idx -> contador visitas

let estacionesCargadas = false;
let rutasCargadas = false;
let simReady = false;
let simStart = null,
  simEnd = null,
  simNow = null;
let lastTS = null;

// HUD
let hud;

init();
animate();

function init() {
  // HUD
  hud = document.createElement("div");
  Object.assign(hud.style, {
    position: "absolute",
    top: "8px",
    left: "8px",
    padding: "10px 12px",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: "12px",
    borderRadius: "8px",
    zIndex: "10",
  });
  hud.textContent = "Cargando…";
  document.body.appendChild(hud);

  // Escena
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);

  // Mapa
  new THREE.TextureLoader().load("src/mapaLPGC.png", function (texture) {
    const ar = texture.image.width / texture.image.height;
    mapsy = scale;
    mapsx = mapsy * ar;
    Plano(0, 0, 0, mapsx, mapsy);
    mapa.material.map = texture;
    mapa.material.needsUpdate = true;

    // Carga CSV estaciones
    fetch("src/Geolocalización estaciones sitycleta.csv")
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.text();
      })
      .then(function (txt) {
        procesarCSVEstaciones(txt);
        estacionesCargadas = true;
        intentarPrepararSimulacion();
      })
      .catch(function (e) {
        console.error("Estaciones:", e);
        setHUD("Error cargando estaciones");
      });

    // Carga CSV rutas usuario (sin cabeceras)
    fetch("src/SITYRUTAS-2025.csv")
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.text();
      })
      .then(function (txt) {
        procesarCSVRutasUsuario(txt);
        rutasCargadas = true;
        intentarPrepararSimulacion();
      })
      .catch(function (e) {
        console.error("Rutas usuario:", e);
        setHUD("Error cargando rutas");
      });
  });
}

// ----------------- CSV Estaciones -----------------
function procesarCSVEstaciones(content) {
  const sep = ";";
  const filas = content
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  if (filas.length === 0) return;

  const headers = filas[0].split(sep).map(function (s) {
    return s.trim().toLowerCase();
  });
  const idx = {
    id: headers.indexOf("idbase"),
    nombre: headers.indexOf("nombre"),
    lat: headers.indexOf("latitud"),
    lon: headers.indexOf("longitud"),
  };
  if (idx.lon < 0) idx.lon = headers.indexOf("altitud"); // fallback

  if (idx.nombre < 0 || idx.lat < 0 || idx.lon < 0) {
    console.error(
      "Cabeceras esperadas: idbase;nombre;latitud;(longitud|altitud)"
    );
    return;
  }

  for (let i = 1; i < filas.length; i++) {
    const row = filas[i];
    if (!row || !row.trim()) continue;
    const cols = row.split(sep);
    if (cols.length <= Math.max(idx.id, idx.nombre, idx.lat, idx.lon)) continue;

    const nombre = (cols[idx.nombre] || "").trim();
    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    if (!nombre || isNaN(lat) || isNaN(lon)) continue;

    const x = Map2Range(lon, minlon, maxlon, -mapsx / 2, mapsx / 2);
    const y = Map2Range(lat, minlat, maxlat, -mapsy / 2, mapsy / 2);

    // Esfera por defecto grisácea (estación no visitada)
    Esfera(x, y, 0, 0.013, 14, 14, C_GRIS);
    const idxMesh = objetos.length - 1;

    datosEstaciones.push({
      id: cols[idx.id],
      nombre: nombre,
      lat: lat,
      lon: lon,
      idxMesh: idxMesh,
    });
    nombre2idx.set(nombre, idxMesh);
  }
}

// ----------------- CSV Rutas (usuario) -----------------
function procesarCSVRutasUsuario(content) {
  const sep = ";";
  const filas = content
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);

  rutasRaw = [];
  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    if (!row || !row.trim()) continue;
    const cols = row.split(sep).map(function (s) {
      return s.trim();
    });
    if (cols.length < 5) continue;

    const tIni = convertirFecha(cols[0]); // "DD/MM/YYYY HH:mm"
    const tFin = convertirFecha(cols[1]);
    const origen = cols[3];
    const destino = cols[4];
    if (!isFechaOk(tIni) || !isFechaOk(tFin)) continue;

    rutasRaw.push({ tIni: tIni, tFin: tFin, origen: origen, destino: destino });
  }
}

// ----------------- Preparar simulación -----------------
function intentarPrepararSimulacion() {
  if (!(estacionesCargadas && rutasCargadas)) return;

  // Construir lista de eventos (salida: cuenta origen; llegada: cuenta destino)
  eventos = [];
  for (let i = 0; i < rutasRaw.length; i++) {
    const r = rutasRaw[i];
    const idxA = encontrarIdx(r.origen);
    const idxB = encontrarIdx(r.destino);
    if (idxA === null && idxB === null) continue;

    if (idxA !== null) eventos.push({ time: r.tIni, idx: idxA });
    if (idxB !== null) eventos.push({ time: r.tFin, idx: idxB });
  }

  if (eventos.length === 0) {
    setHUD("No hay eventos mapeados (revisa nombres en rutas/estaciones)");
    return;
  }

  // Ordenar por tiempo
  eventos.sort(function (a, b) {
    return a.time - b.time;
  });

  // Rango temporal
  simStart = eventos[0].time;
  simEnd = eventos[eventos.length - 1].time;
  simNow = new Date(simStart.getTime());
  lastTS = performance.now();

  // Reset colores y contadores
  visitasPorIdx.clear();
  for (let i = 0; i < objetos.length; i++) {
    const mesh = objetos[i];
    if (mesh && mesh.material) mesh.material.setValues({ color: C_GRIS });
  }

  simReady = true;
  setHUD(estadoHUD());
}

// ----------------- Animación / Simulación -----------------
let evtPtr = 0;
function animate() {
  requestAnimationFrame(animate);

  if (simReady) {
    const now = performance.now();
    const dtSec = Math.max(0, (now - lastTS) / 1000);
    lastTS = now;

    // Avanza el reloj simulado
    const addMinutes = dtSec * SPEED_MIN_PER_SEC;
    simNow = new Date(simNow.getTime() + addMinutes * 60000);

    // Procesa todos los eventos que ya han "ocurrido"
    while (evtPtr < eventos.length && eventos[evtPtr].time <= simNow) {
      const e = eventos[evtPtr];
      const prev = visitasPorIdx.get(e.idx) || 0;
      const next = prev + 1;
      visitasPorIdx.set(e.idx, next);

      // Colorea según regla: >=1 verde, >5 rojo
      const mesh = objetos[e.idx];
      if (mesh && mesh.material) {
        if (next > 5) {
          mesh.material.setValues({ color: C_ROJO });
        } else if (next > 2) {
          mesh.material.setValues({ color: C_NARAN });
        } else {
          mesh.material.setValues({ color: C_VERDE }); // 1–2 visitas
        }
      }
      evtPtr++;
    }

    // Si hemos llegado al final, fijamos simNow = simEnd para que el HUD quede exacto
    if (simNow > simEnd) simNow = new Date(simEnd.getTime());

    setHUD(estadoHUD());
  }

  renderer.render(scene, camera);
}

function estadoHUD() {
  const totalEst = datosEstaciones.length;
  let visitadas = 0,
    rojas = 0;
  visitasPorIdx.forEach(function (v) {
    if (v > 0) visitadas++;
    if (v > 5) rojas++;
  });
  return [
    "Simulación: " +
      fechaHumana(simNow) +
      "  (de " +
      fechaHumana(simStart) +
      " a " +
      fechaHumana(simEnd) +
      ")",
    "Velocidad: " +
      SPEED_MIN_PER_SEC +
      " min/s  (~" +
      (SPEED_MIN_PER_SEC / 1440).toFixed(1) +
      " dia/s)",
    "Estaciones: " +
      totalEst +
      " | Visitadas: " +
      visitadas +
      " | Rojas (>5): " +
      rojas,
    "Colores: Verde->1-2 Naranja->2-5  Rojo>5",
  ].join("\n");
}

// ----------------- Utilidades -----------------
function encontrarIdx(nombre) {
  return nombre2idx.has(nombre) ? nombre2idx.get(nombre) : null;
}

function convertirFecha(s) {
  // "DD/MM/YYYY HH:mm"
  const parts = s.split(" ");
  if (parts.length < 2) return new Date(NaN);
  const fecha = parts[0].split("/").map(Number);
  const hora = parts[1].split(":").map(Number);
  return new Date(fecha[2], fecha[1] - 1, fecha[0], hora[0], hora[1]);
}
function isFechaOk(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

function fechaHumana(d) {
  const pad = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  return (
    pad(d.getDate()) +
    "/" +
    pad(d.getMonth() + 1) +
    "/" +
    d.getFullYear() +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function Map2Range(val, vmin, vmax, dmin, dmax) {
  const v = parseFloat(val);
  let t = 1 - (vmax - v) / (vmax - vmin);
  return dmin + t * (dmax - dmin);
}

function Esfera(px, py, pz, radio, nx, ny, col) {
  const geometry = new THREE.SphereBufferGeometry(radio, nx, ny);
  const material = new THREE.MeshBasicMaterial({ color: col });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  objetos.push(mesh);
  scene.add(mesh);
}

function Plano(px, py, pz, sx, sy) {
  const geometry = new THREE.PlaneGeometry(sx, sy);
  const material = new THREE.MeshBasicMaterial({});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);
  mapa = mesh;
}

function setHUD(t) {
  if (hud) hud.textContent = t;
}
