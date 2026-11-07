// Visor demo: mapa en planta, lentes, censo a pedido, fichas con URL propia.
import { cargar, num, fecha, marca, esc } from "./util.js";
import { abrirZona, abrirAccesion, abrirArbol, iniciarFichas, buscar } from "./fichas.js";

const estado = { borde: "lote", verBorde: true, lente: "coleccion", censo: false, base: null, zonas: null };
let mapa;
const COLORES_N = ["#e3eedb", "#bcd8ae", "#8fbe7f", "#5f9f58", "#367a3a", "#1d5226"];
const CORTES_N = [50, 150, 300, 600, 1000];
const COLORES_A = ["#f3e3d2", "#efc39a", "#e39a62", "#cc6a3c", "#a33f22"];
const CORTES_A = [10, 30, 80, 150];
const SIN_AMEN = "#ecebe6";
const COLORES_D = ["#e8eef4", "#bfd1e3", "#8eaecd", "#5a86b2", "#2f5d8c"];
const CORTES_D = [25, 75, 125, 250];
const K_COLOR = ["#2d6a3e", "#d9822b", "#8b5e34"];

function paso(prop, cortes, colores, cero) {
  const e = ["step", ["get", prop], colores[0]];
  cortes.forEach((c, i) => e.push(c, colores[i + 1]));
  return cero ? ["case", ["==", ["get", prop], 0], cero, e] : e;
}

function rayasImagen() {
  const t = 12, c = document.createElement("canvas");
  c.width = c.height = t;
  const x = c.getContext("2d");
  x.strokeStyle = "rgba(80,80,80,0.75)";
  x.lineWidth = 1.5;
  for (let i = -t; i < 2 * t; i += 6) { x.beginPath(); x.moveTo(i, t); x.lineTo(i + t, 0); x.stroke(); }
  return x.getImageData(0, 0, t, t);
}

function cajaGeom(g) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  const recorre = (c) => (typeof c[0] === "number" ? (a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]) : c.forEach(recorre));
  recorre(g.coordinates);
  return a;
}

// Zona como círculo de ubicación aproximada: centro y radio vienen de la build (solo plantas visibles).
const ROTULO_ZONA = "ubicación aproximada de la zona; el dato no trae su borde";
function circulosZonas(zonas) {
  const fs = [];
  for (const f of zonas.features) {
    const p = f.properties;
    if (!f.geometry || p.r == null) continue;
    const [lon, lat] = f.geometry.coordinates;
    const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574, anillo = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i % 64) / 64 * 2 * Math.PI;
      anillo.push([lon + p.r * Math.cos(a) / kx, lat + p.r * Math.sin(a) / ky]);
    }
    fs.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [anillo] }, properties: { ...p, cats: JSON.stringify(p.cats), m: undefined } });
  }
  fs.sort((a, b) => b.properties.r - a.properties.r); // las pequeñas encima
  return { type: "FeatureCollection", features: fs };
}

function encuadrarJardin(animar = true) {
  const b = cajaGeom(estado.base.bordes[estado.borde].geom);
  mapa.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 24, animate: animar, duration: animar ? 600 : 0 });
}

async function iniciar() {
  iniciarPestanas();
  try {
    const [base, zonas] = await Promise.all([cargar("base.json"), cargar("zonas.json")]);
    estado.base = base;
    estado.zonas = zonas;
  } catch (e) {
    document.getElementById("lente-texto").innerHTML = `<p>No se pudieron leer los datos del visor. ${esc(e.message)}</p>`;
    return;
  }
  iniciarFichas(estado, { resaltarAccesion, irA });
  pintarBordeTexto();
  pintarLente();
  iniciarMapa();
  enlazarControles();
}

function iniciarMapa() {
  const base = estado.base;
  if (!window.maplibregl) {
    document.getElementById("aviso-mapa").hidden = false;
    document.getElementById("aviso-mapa").textContent = "No cargó la biblioteca del mapa. El panel funciona igual.";
    abrirDesdeUrl();
    return;
  }
  mapa = new maplibregl.Map({
    container: "mapa",
    style: { version: 8, sources: {}, layers: [{ id: "fondo", type: "background", paint: { "background-color": "#eef0ea" } }] },
    center: base.centro,
    zoom: 15.4,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    maxZoom: 20,
  });
  mapa.touchZoomRotate.disableRotation();
  mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  mapa.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "Catastro Bogotá (UAECD), IDRD y Jardín Botánico José Celestino Mutis vía Datos Abiertos Bogotá, CC BY 4.0. Sin mapa base.",
  }), "bottom-right");

  if (!base.ortoimagen.ok) {
    const av = document.getElementById("aviso-mapa");
    av.hidden = false;
    av.textContent = `Sin foto aérea de fondo: el servicio de la ortoimagen 2025 de IDECA respondió con error el ${fecha(base.ortoimagen.probado)}. Solo se dibujan vectores.`;
  }

  mapa.on("load", () => {
    mapa.addImage("rayas", rayasImagen());
    mapa.addSource("calzadas", { type: "geojson", data: base.calzadas });
    mapa.addLayer({ id: "calzadas", type: "fill", source: "calzadas", paint: { "fill-color": "#d9dcd4", "fill-outline-color": "#c9ccc3" } });

    mapa.addSource("sectores", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({ id: "sectores", type: "fill", source: "sectores", layout: { visibility: "none" },
      paint: { "fill-color": paso("densidad", CORTES_D, COLORES_D), "fill-opacity": 0.85 } });
    mapa.addLayer({ id: "sectores-linea", type: "line", source: "sectores", layout: { visibility: "none" },
      paint: { "line-color": ["case", ["get", "jardin"], "#1c2620", "#ffffff"], "line-width": ["case", ["get", "jardin"], 3, 1] } });

    mapa.addSource("zonas", { type: "geojson", data: circulosZonas(estado.zonas), generateId: true });
    mapa.addLayer({ id: "zonas", type: "fill", source: "zonas", paint: { "fill-color": "#cccccc", "fill-opacity": 0.8 } });
    mapa.addLayer({ id: "zonas-linea", type: "line", source: "zonas", paint: { "line-color": "#ffffff", "line-width": 1 } });
    mapa.addLayer({ id: "zonas-sel", type: "line", source: "zonas", filter: ["==", ["get", "z"], ""], paint: { "line-color": "#0b57d0", "line-width": 3 } });

    mapa.addSource("tropicario", { type: "geojson", data: { type: "Feature", geometry: base.tropicario.geom, properties: {} } });
    mapa.addLayer({ id: "tropicario", type: "fill", source: "tropicario", paint: { "fill-pattern": "rayas", "fill-opacity": 0.9 } });
    mapa.addLayer({ id: "tropicario-linea", type: "line", source: "tropicario", paint: { "line-color": "#555", "line-width": 1.5, "line-dasharray": [2, 1.5] } });

    for (const k of ["lote", "idrd"]) {
      mapa.addSource(`borde-${k}`, { type: "geojson", data: { type: "Feature", geometry: base.bordes[k].geom, properties: {} } });
      mapa.addLayer({ id: `borde-${k}`, type: "line", source: `borde-${k}`,
        paint: { "line-color": k === "lote" ? "#1c2620" : "#7a4a8c", "line-width": 2.5, ...(k === "idrd" ? { "line-dasharray": [3, 2] } : {}) } });
    }

    mapa.addSource("censo", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({ id: "censo", type: "circle", source: "censo", layout: { visibility: "none" }, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 1.2, 17, 3, 19, 6],
      "circle-color": "#2d6a3e", "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 15, 0, 18, 0.8],
    } });

    mapa.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({ id: "sel", type: "circle", source: "sel", paint: { "circle-radius": 9, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#0b57d0", "circle-stroke-width": 3 } });

    encuadrarJardin(false);
    aplicarBorde();
    aplicarLente();

    mapa.on("click", (e) => {
      const capas = ["censo", "zonas"].filter((l) => mapa.getLayoutProperty(l, "visibility") !== "none");
      const fs = mapa.queryRenderedFeatures(e.point, { layers: capas });
      const arbol = fs.find((f) => f.layer.id === "censo");
      if (arbol) return abrirArbol(arbol.properties.c);
      const zs = fs.filter((f) => f.layer.id === "zonas");
      if (zs.length) {
        zs.sort((a, b) => a.properties.r - b.properties.r);
        return abrirZona(zs[0].properties.z);
      }
      if (estado.lente === "contexto") {
        const s = mapa.queryRenderedFeatures(e.point, { layers: ["sectores"] })[0];
        if (s) mostrarSector(s.properties);
      }
    });
    for (const l of ["zonas", "censo", "sectores"]) {
      mapa.on("mouseenter", l, () => { mapa.getCanvas().style.cursor = "pointer"; });
      mapa.on("mouseleave", l, () => { mapa.getCanvas().style.cursor = ""; });
    }
    abrirDesdeUrl();
  });
}

function abrirDesdeUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get("accesion")) abrirAccesion(p.get("accesion"));
  else if (p.get("arbol")) { activarCenso(true).then(() => abrirArbol(p.get("arbol"))); }
  else if (p.get("zona")) abrirZona(p.get("zona"));
}

function irA(lon, lat, zoom = 18) { if (mapa) mapa.easeTo({ center: [lon, lat], zoom, duration: 500 }); }

function resaltarAccesion(lonlat) {
  if (!mapa || !mapa.getSource("sel")) return;
  mapa.getSource("sel").setData(lonlat ? { type: "Feature", geometry: { type: "Point", coordinates: lonlat }, properties: {} } : { type: "FeatureCollection", features: [] });
}
export function resaltarZona(z) { if (mapa && mapa.getLayer("zonas-sel")) mapa.setFilter("zonas-sel", ["==", ["get", "z"], z || ""]); }
window.__resaltarZona = resaltarZona;

// ---------- borde ----------
function pintarBordeTexto() {
  const b = estado.base.bordes[estado.borde];
  const area = estado.borde === "lote" ? `${num(b.area_m2)} m²` : `${num(b.area_m2 / 1e4, 2)} ha`;
  document.getElementById("borde-detalle").innerHTML =
    `${esc(b.nombre)}. Área ${area} ${marca("medido")}. ${b.oficial ? "Es el borde que usa el visor para contar." : "Alternativa: cuenta con el polígono del parque."} Fuente: <a href="${b.enlace}" target="_blank" rel="noopener">${esc(b.fuente)}</a>.`;
  document.getElementById("sello-borde").textContent = estado.verBorde
    ? `Borde: ${b.nombre}. ${b.fuente}.`
    : "Borde oculto. Las cifras siguen contando con el " + (estado.borde === "lote" ? "lote catastral." : "parque IDRD.");
}
function aplicarBorde() {
  if (!mapa || !mapa.getLayer("borde-lote")) return;
  for (const k of ["lote", "idrd"]) mapa.setLayoutProperty(`borde-${k}`, "visibility", estado.verBorde && k === estado.borde ? "visible" : "none");
}

// ---------- lentes ----------
function leyendaEscala(colores, etiquetas, extra = "") {
  return `<div class="escala" aria-hidden="true">${colores.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
    <div class="extremos"><span>${etiquetas[0]}</span><span>${etiquetas[1]}</span></div>${extra}`;
}
function filaLeyenda(color, texto, estilo = "") { return `<div class="fila"><span class="muestra" style="background:${color};${estilo}"></span>${texto}</div>`; }
const filaRayas = `<div class="fila"><span class="muestra rayado" style="margin:0;padding:0"></span>Tropicario: interior sin datos abiertos</div>`;

function pintarLente() {
  const r = estado.base.resumen, k = estado.borde;
  const c = r.coleccion, pb = c.por_borde[k], cen = r.censo.por_borde[k];
  const nombreBorde = k === "lote" ? "del lote" : "del parque IDRD";
  const ley = document.getElementById("leyenda"), txt = document.getElementById("lente-texto");
  const L = estado.lente;
  if (L === "coleccion") {
    ley.innerHTML = `<p class="detalle">Accesiones por zona. Cada círculo es la ${ROTULO_ZONA} ${marca("inferido")}. Va en la mediana de las plantas que se pueden mostrar y su área crece con el número de accesiones.</p>`
      + leyendaEscala(COLORES_N, ["menos de 50", "1.000 o más"]) + filaRayas;
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Accesiones dentro ${nombreBorde}</span><span class="valor">${num(pb.n)} ${marca("inferido")}</span></li>
      <li><span class="que">Accesiones en todo el dato</span><span class="valor">${num(c.n)} ${marca("de fuente")}</span></li>
      <li><span class="que">Nombres de planta</span><span class="valor">${num(c.nombres)} ${marca("medido")}</span></li>
      <li><span class="que">Familias</span><span class="valor">${num(c.familias)} ${marca("medido")}</span></li>
      <li><span class="que">Zonas con plantas</span><span class="valor">${num(c.zonas)} ${marca("medido")}</span></li>
      <li><span class="que">Fecha del dato</span><span class="valor">${fecha(c.fecha_carga)} ${marca("de fuente")}</span></li></ul>
      <p class="detalle">Todas las accesiones traen la misma fecha: es el día en que se cargó el dato, no el día en que alguien vio la planta. Toca un círculo para abrir la ficha de la zona.</p>`;
  } else if (L === "conservacion") {
    const cats = c.cats, orden = ["CR", "EN", "VU", "NT", "LC", "DD", "EW", "NE"];
    ley.innerHTML = `<p class="detalle">Accesiones amenazadas (CR, EN y VU) sumadas por zona. Cada círculo es la ${ROTULO_ZONA}. Nunca se muestra el punto exacto de una planta amenazada, y ninguna se usa para ubicar el círculo.</p>`
      + leyendaEscala(COLORES_A, ["1 a 9", "150 o más"]) + filaLeyenda(SIN_AMEN, "Ninguna amenazada")
      + filaLeyenda("transparent", "Más de la mitad sin evaluar (NE)", `border:2.5px solid var(--ne)`) + filaRayas;
    const max = Math.max(...orden.map((o) => cats[o] || 0));
    const COL = { CR: "#a33f22", EN: "#cc6a3c", VU: "#e39a62", NT: "#c9b26b", LC: "#7aa36b", DD: "#9a9a9a", EW: "#3b2f2f", NE: "var(--ne)" };
    const NOM = { CR: "En peligro crítico", EN: "En peligro", VU: "Vulnerable", NT: "Casi amenazada", LC: "Preocupación menor", DD: "Datos insuficientes", EW: "Extinta en estado silvestre", NE: "No evaluada" };
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Amenazadas dentro ${nombreBorde}</span><span class="valor">${num(pb.amen)} ${marca("inferido")}</span></li>
      <li><span class="que">Amenazadas en todo el dato</span><span class="valor">${num(c.amen)} ${marca("medido")}</span></li>
      <li><span class="que">Sin evaluar (NE)</span><span class="valor">${num(c.ne)} ${marca("medido")}</span></li></ul>
      <div class="barras" aria-label="Accesiones por categoría">${orden.map((o) => `<div class="b"><span>${o} · ${NOM[o]}</span><span class="pista"><span style="width:${(100 * (cats[o] || 0) / max).toFixed(1)}%;background:${COL[o]}"></span></span><span class="n">${num(cats[o] || 0)}</span></div>`).join("")}</div>
      <p class="detalle">El ${num(100 * c.ne / c.n, 1)} % de la colección (${num(c.ne)}) no tiene categoría (NE). Va con su propio color porque nadie la ha evaluado. EW (${num(c.ew)}) se cuenta aparte de las amenazadas.</p>
      <div class="rayado" role="note"><strong>Escala por verificar</strong>El dato no dice si la categoría es la de la UICN o la de la Resolución 0126 de 2024. Por eso no se compara con otras listas.</div>`;
  } else if (L === "certeza") {
    ley.innerHTML = `<p class="detalle">Árboles del censo según si tienen nombre. Los círculos de las zonas de la colección quedan en gris.</p>`
      + filaLeyenda(K_COLOR[0], "Identificado") + filaLeyenda(K_COLOR[1], "NN: sin identificar") + filaLeyenda(K_COLOR[2], "«Otro»: sin especie en la lista");
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Árboles del censo dentro ${nombreBorde}</span><span class="valor">${num(cen.n)} ${marca("inferido")}</span></li>
      <li><span class="que">Sin identificar (NN y Otro)</span><span class="valor">${num(cen.sin_id)}, ${num(cen.pct_sin_id, 1)} % ${marca("inferido")}</span></li>
      <li><span class="que">NN / Otro</span><span class="valor">${num(cen.nn)} / ${num(cen.otro)}</span></li>
      <li><span class="que">Registros del censo</span><span class="valor">${fecha(cen.fmin)} a ${fecha(cen.fmax)} ${marca("de fuente")}</span></li>
      <li><span class="que">Colección viva</span><span class="valor">una sola fecha: ${fecha(c.fecha_carga)} ${marca("de fuente")}</span></li></ul>
      <p class="detalle">El ${num(cen.pct_sin_id, 1)} % de los árboles del censo dentro ${nombreBorde} no tiene nombre de especie. La colección viva sí tiene nombre en cada accesión, pero su fecha es la de carga, así que no dice desde cuándo se sabe.</p>`;
  } else if (L === "contexto") {
    const s = r.sectores;
    ley.innerHTML = `<p class="detalle">Árboles del censo por hectárea en los ${num(s.n)} sectores del parque Simón Bolívar (IDRD). El jardín va con borde negro.</p>`
      + leyendaEscala(COLORES_D, ["menos de 25", "250 o más"]);
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Jardín Botánico</span><span class="valor">${num(s.densidad_jardin)} por ha ${marca("inferido")}</span></li>
      <li><span class="que">Siguiente: ${esc(s.siguiente[0])}</span><span class="valor">${num(s.siguiente[1])} por ha ${marca("inferido")}</span></li>
      <li><span class="que">Área de los ${num(s.n)} sectores</span><span class="valor">${num(s.area_ha, 2)} ha ${marca("medido")}</span></li></ul>
      <p class="detalle">El jardín es el sector con más árboles por hectárea del Simón Bolívar. Toca un sector para ver su cifra.</p><p id="sector-sel" class="detalle" aria-live="polite"></p>`;
  } else {
    ley.innerHTML = `<p class="detalle">Sin lente. Se ven el borde, las zonas como círculos sin relleno (${ROTULO_ZONA}) y el Tropicario rayado.</p>` + filaRayas;
    txt.innerHTML = "";
  }
}

function mostrarSector(p) {
  const el = document.getElementById("sector-sel");
  if (el) el.textContent = `${p.nombre}: ${num(p.arboles)} árboles en ${num(p.ha, 2)} ha, ${num(p.densidad)} por ha.`;
}

async function aplicarLente() {
  if (!mapa || !mapa.getLayer("zonas")) return;
  const L = estado.lente;
  const vis = (id, v) => mapa.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  vis("sectores", L === "contexto"); vis("sectores-linea", L === "contexto");
  vis("zonas", L !== "contexto"); vis("zonas-linea", L !== "contexto");
  if (L === "coleccion") {
    mapa.setPaintProperty("zonas", "fill-color", paso("n", CORTES_N, COLORES_N));
    mapa.setPaintProperty("zonas", "fill-opacity", 0.85);
    mapa.setPaintProperty("zonas-linea", "line-color", "#ffffff");
    mapa.setPaintProperty("zonas-linea", "line-width", 1);
  } else if (L === "conservacion") {
    mapa.setPaintProperty("zonas", "fill-color", paso("amen", CORTES_A, COLORES_A, SIN_AMEN));
    mapa.setPaintProperty("zonas", "fill-opacity", 0.9);
    mapa.setPaintProperty("zonas-linea", "line-color", ["case", [">", ["get", "ne"], ["/", ["get", "n"], 2]], "#5b5f97", "#ffffff"]);
    mapa.setPaintProperty("zonas-linea", "line-width", ["case", [">", ["get", "ne"], ["/", ["get", "n"], 2]], 2.5, 1]);
  } else if (L === "certeza") {
    mapa.setPaintProperty("zonas", "fill-color", "#dcdcd6");
    mapa.setPaintProperty("zonas", "fill-opacity", 0.6);
    mapa.setPaintProperty("zonas-linea", "line-color", "#ffffff");
    mapa.setPaintProperty("zonas-linea", "line-width", 1);
  } else {
    mapa.setPaintProperty("zonas", "fill-color", "#ffffff");
    mapa.setPaintProperty("zonas", "fill-opacity", 0.01);
    mapa.setPaintProperty("zonas-linea", "line-color", "#8a8f87");
    mapa.setPaintProperty("zonas-linea", "line-width", 1);
  }
  if (L === "certeza" && !estado.censo) {
    document.getElementById("ver-censo").checked = true;
    await activarCenso(true);
  }
  pintarColorCenso();
  if (L === "contexto") {
    try {
      const s = await cargar("sectores.json");
      mapa.getSource("sectores").setData(s);
      let b = [Infinity, Infinity, -Infinity, -Infinity];
      s.features.forEach((f) => { const c = cajaGeom(f.geometry); b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[2]), Math.max(b[3], c[3])]; });
      mapa.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 20, duration: 600 });
    } catch (e) { document.getElementById("lente-texto").insertAdjacentHTML("beforeend", `<p>No se pudo leer el contexto: ${esc(e.message)}</p>`); }
  } else if (estado.lenteAnterior === "contexto") {
    encuadrarJardin();
  }
  estado.lenteAnterior = L;
}

function pintarColorCenso() {
  if (!mapa || !mapa.getLayer("censo")) return;
  mapa.setPaintProperty("censo", "circle-color", estado.lente === "certeza"
    ? ["match", ["get", "k"], 1, K_COLOR[1], 2, K_COLOR[2], K_COLOR[0]] : "#2d6a3e");
}

// ---------- censo a pedido ----------
let censoGeo = null, dibujadosBorde = null;
export async function activarCenso(on) {
  estado.censo = on;
  const est = document.getElementById("censo-estado");
  if (on && !censoGeo) {
    est.textContent = "Bajando el censo…";
    try {
      const d = await cargar("censo.json");
      const c = d.cols, [ox, oy] = d.origen, s = d.escala;
      const fs = [];
      c.c.forEach((cod, i) => { if (c.x[i] !== null) fs.push({ type: "Feature",
        geometry: { type: "Point", coordinates: [+(ox + c.x[i] * s).toFixed(7), +(oy + c.y[i] * s).toFixed(7)] },
        properties: { c: cod, k: c.k[i] } }); });
      censoGeo = { type: "FeatureCollection", features: fs };
      // árboles dibujados dentro de cada borde (bit 1 lote, bit 2 parque)
      dibujadosBorde = { lote: 0, idrd: 0 };
      c.b.forEach((b, i) => { if (c.x[i] === null) return; if (b & 1) dibujadosBorde.lote++; if (b & 2) dibujadosBorde.idrd++; });
    } catch (e) { est.textContent = `No se pudo bajar el censo: ${e.message}`; estado.censo = false; document.getElementById("ver-censo").checked = false; return; }
  }
  if (mapa && mapa.getSource("censo")) {
    if (on) mapa.getSource("censo").setData(censoGeo);
    mapa.setLayoutProperty("censo", "visibility", on ? "visible" : "none");
  }
  pintarColorCenso();
  if (on) {
    const cen = estado.base.resumen.censo;
    est.innerHTML = `Encendido: ${num(censoGeo.features.length)} árboles dibujados alrededor del jardín; dentro del borde, ${num(dibujadosBorde[estado.borde])} dibujados de ${num(cen.por_borde[estado.borde].n)} en el censo ${marca("medido")}. Algunos árboles no se dibujan para proteger especies sensibles. Censo del arbolado urbano (SIGAU), ficha del ${fecha(cen.ficha_modificada)}. Toca un árbol para su ficha.`;
  } else est.textContent = "Apagado.";
}

// ---------- controles ----------
function enlazarControles() {
  document.getElementById("ver-borde").addEventListener("change", (e) => { estado.verBorde = e.target.checked; aplicarBorde(); pintarBordeTexto(); });
  document.querySelectorAll('input[name="borde"]').forEach((r) => r.addEventListener("change", (e) => {
    estado.borde = e.target.value; aplicarBorde(); pintarBordeTexto(); pintarLente();
    if (estado.censo) activarCenso(true);
  }));
  document.querySelectorAll('input[name="lente"]').forEach((r) => r.addEventListener("change", (e) => { estado.lente = e.target.value; pintarLente(); aplicarLente(); }));
  document.getElementById("ver-censo").addEventListener("change", (e) => activarCenso(e.target.checked));
  document.getElementById("abrir-3d").addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Cargando la vista 3D…";
    try { const m = await import("./tres.js"); await m.abrirTres(estado); }
    catch (err) { alertaPanel(`No se pudo abrir el 3D: ${err.message}`); }
    finally { b.disabled = false; b.textContent = "Abrir sol y sombra en 3D"; }
  });
  let t;
  document.getElementById("buscar").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => buscar(e.target.value), 200); });
}

function alertaPanel(m) { document.getElementById("lente-texto").insertAdjacentHTML("afterbegin", `<p role="alert">${esc(m)}</p>`); }

// ---------- pestañas ----------
function iniciarPestanas() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const hechas = new Set();
  const activar = async (tab, foco) => {
    tabs.forEach((t) => { const sel = t === tab; t.setAttribute("aria-selected", sel); t.tabIndex = sel ? 0 : -1; document.getElementById(t.getAttribute("aria-controls")).hidden = !sel; });
    if (foco) tab.focus();
    const id = tab.id;
    if (!hechas.has(id)) {
      hechas.add(id);
      if (id === "tab-clima") (await import("./clima.js")).pintarClima(document.getElementById("sec-clima"));
      if (id === "tab-fuentes") (await import("./fuentes.js")).pintarFuentes(document.getElementById("sec-fuentes"), estado);
    }
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activar(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const j = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        activar(tabs[j], true);
      }
    });
  });
}

iniciar();
