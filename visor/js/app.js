// Visor demo: mapa en planta, lentes, censo a pedido, fichas con URL propia.
import { cargar, num, fecha, marca, activarMarcas, esc } from "./util.js";
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
// Certeza con los mismos nombres y colores del 3D (visor3d/src/colores.js): con especie y sin especie (NN y Otro juntos).
const CON_ESPECIE = "#6f9a77", SIN_ESPECIE = "#5f6360", ZONA_NEUTRA = "#c9d1c2";
// Las tres zonas de la pregunta del sol, con el mismo nombre corto del 3D (CORTO_DEMO).
const ZONAS_DEMO = { O4: "Rosaleda", M3: "Herbal de la Salud", O1: "Plantas ornamentales" };
const PREGUNTA_SOL = "Entre la Rosaleda, el Herbal de la Salud y Plantas ornamentales, ¿cuál recibe más sol directo en el año y cuál cambia más entre junio y diciembre?";

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

// Zona como punto de tamaño fijo en su ubicación aproximada: el centro viene de la build (solo plantas visibles).
// El tamaño no codifica nada; la cifra va escrita junto al punto y el color repite la escala.
const ROTULO_ZONA = "ubicación aproximada de la zona; el dato no trae su borde";
function puntosZonas(zonas) {
  const fs = [];
  for (const f of zonas.features) {
    const p = f.properties;
    if (!f.geometry || p.r == null) continue;
    fs.push({ type: "Feature", geometry: f.geometry, properties: { ...p, cats: JSON.stringify(p.cats), m: undefined } });
  }
  return { type: "FeatureCollection", features: fs };
}

function encuadrarJardin(animar = true) {
  const b = cajaGeom(estado.base.bordes[estado.borde].geom);
  mapa.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 24, animate: animar, duration: animar ? 600 : 0 });
}

async function iniciar() {
  iniciarPestanas();
  activarMarcas(document);
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

  mapa.on("load", () => {
    mapa.addImage("rayas", rayasImagen());
    mapa.addSource("calzadas", { type: "geojson", data: base.calzadas });
    mapa.addLayer({ id: "calzadas", type: "fill", source: "calzadas", paint: { "fill-color": "#d9dcd4", "fill-outline-color": "#c9ccc3" } });

    mapa.addSource("sectores", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({ id: "sectores", type: "fill", source: "sectores", layout: { visibility: "none" },
      paint: { "fill-color": paso("densidad", CORTES_D, COLORES_D), "fill-opacity": 0.85 } });
    mapa.addLayer({ id: "sectores-linea", type: "line", source: "sectores", layout: { visibility: "none" },
      paint: { "line-color": ["case", ["get", "jardin"], "#1c2620", "#ffffff"], "line-width": ["case", ["get", "jardin"], 3, 1] } });

    mapa.addSource("zonas", { type: "geojson", data: puntosZonas(estado.zonas) });
    mapa.addLayer({ id: "zonas", type: "circle", source: "zonas", paint: {
      "circle-radius": RADIO_PUNTO, "circle-color": "#cccccc", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
    mapa.addLayer({ id: "zonas-sel", type: "circle", source: "zonas", filter: ["==", ["get", "z"], ""], paint: {
      "circle-radius": RADIO_SEL, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#0b57d0", "circle-stroke-width": 3 } });

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
      const visible = (l) => mapa.getLayoutProperty(l, "visibility") !== "none";
      if (visible("censo")) {
        const arbol = mapa.queryRenderedFeatures(e.point, { layers: ["censo"] })[0];
        if (arbol) return abrirArbol(arbol.properties.c);
      }
      if (visible("zonas")) {
        // el punto es chico: se toma el más cercano dentro de un margen de dedo
        const m = 14, caja = [[e.point.x - m, e.point.y - m], [e.point.x + m, e.point.y + m]];
        const zs = mapa.queryRenderedFeatures(caja, { layers: ["zonas"] });
        if (zs.length) {
          const d = (f) => { const p = mapa.project(f.geometry.coordinates); return (p.x - e.point.x) ** 2 + (p.y - e.point.y) ** 2; };
          zs.sort((a, b) => d(a) - d(b));
          return abrirZona(zs[0].properties.z);
        }
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
    crearRotulos();
    mapa.on("moveend", acomodarRotulos);
    abrirDesdeUrl();
  });
}

// ---------- rótulos de las zonas ----------
// El estilo del mapa no trae fuentes tipográficas, así que la cifra y el nombre van en marcadores HTML. Se esconden
// los que chocan con otro ya puesto; las tres zonas de la pregunta del sol van primero y siempre se ven.
const RADIO_PUNTO = ["interpolate", ["linear"], ["zoom"], 14, 4.5, 17, 7, 19, 9];
// El anillo de la zona elegida, 5 px más que el punto. MapLibre no deja sumar a una expresión de zoom: va como su propia rampa.
const RADIO_SEL = ["interpolate", ["linear"], ["zoom"], 14, 9.5, 17, 12, 19, 14];
const rotulos = [];
function crearRotulos() {
  for (const f of puntosZonas(estado.zonas).features) {
    const p = f.properties, el = document.createElement("div");
    el.className = "rotulo-zona" + (ZONAS_DEMO[p.z] ? " demo" : "");
    el.setAttribute("aria-hidden", "true");
    const mk = new maplibregl.Marker({ element: el, anchor: "left", offset: [9, 0] }).setLngLat(f.geometry.coordinates).addTo(mapa);
    rotulos.push({ p, el, mk });
  }
  pintarRotulos();
}
function pintarRotulos() {
  const L = estado.lente;
  for (const r of rotulos) {
    const nombre = ZONAS_DEMO[r.p.z] && L !== "contexto" ? ZONAS_DEMO[r.p.z] : "";
    const cifra = L === "coleccion" ? num(r.p.n) : L === "conservacion" ? num(r.p.amen) : "";
    r.el.innerHTML = nombre ? `<strong>${esc(nombre)}</strong>${cifra ? ` ${cifra}` : ""}` : cifra;
    r.vacio = !nombre && !cifra;
  }
  acomodarRotulos();
}
function acomodarRotulos() {
  if (!mapa || !rotulos.length) return;
  const puestas = [];
  const orden = [...rotulos].sort((a, b) => (!!ZONAS_DEMO[b.p.z] - !!ZONAS_DEMO[a.p.z]) || (b.p.n - a.p.n));
  for (const r of orden) {
    if (r.vacio) { r.el.hidden = true; continue; }
    r.el.hidden = false;
    const medir = () => { const c = r.el.getBoundingClientRect(); return [c.left - 2, c.top - 1, c.right + 2, c.bottom + 1]; };
    const pisa = (caja) => puestas.some((o) => caja[0] < o[2] && caja[2] > o[0] && caja[1] < o[3] && caja[3] > o[1]);
    let caja = medir();
    if (ZONAS_DEMO[r.p.z]) {
      // Las tres de la pregunta siempre se ven: si pisan otra ya puesta, suben o bajan hasta dos líneas.
      const alto = caja[3] - caja[1];
      for (const dy of [0, -alto, alto, -2 * alto, 2 * alto]) { r.mk.setOffset([9, dy]); caja = medir(); if (!pisa(caja)) break; }
      puestas.push(caja);
      continue;
    }
    const choca = pisa(caja);
    r.el.hidden = choca;
    if (!choca) puestas.push(caja);
  }
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
    `${esc(b.nombre)}. Área ${area} ${marca(estado.borde === "lote" ? "area_lote" : "area_idrd")}. ${b.oficial ? "Es el borde que usa el visor para contar." : "Alternativa: cuenta con el polígono del parque."} Fuente: <a href="${b.enlace}" target="_blank" rel="noopener">${esc(b.fuente)}</a>.`;
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
  const dosListas = `<p class="detalle">Hay dos listas: el censo de árboles de la ciudad y la colección del Jardín. La colección dice qué planta es cada accesión; el censo dice dónde está cada árbol, pero a muchos les falta la especie.</p>`;
  if (L === "coleccion") {
    ley.innerHTML = `<p class="detalle">Accesiones de la colección por zona. Cada punto es la ${ROTULO_ZONA} ${marca("zona_punto")}. El número junto al punto es cuántas accesiones tiene, y el color sigue la misma escala.</p>`
      + leyendaEscala(COLORES_N, ["menos de 50", "1.000 o más"]) + filaRayas;
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Accesiones dentro ${nombreBorde}</span><span class="valor">${num(pb.n)} ${marca("col_dentro")}</span></li>
      <li><span class="que">Accesiones en todo el dato</span><span class="valor">${num(c.n)} ${marca("col_puntos")}</span></li>
      <li><span class="que">Nombres de planta</span><span class="valor">${num(c.nombres)} ${marca("col_nombres")}</span></li>
      <li><span class="que">Familias</span><span class="valor">${num(c.familias)} ${marca("col_familias")}</span></li>
      <li><span class="que">Zonas con plantas</span><span class="valor">${num(c.zonas)} ${marca("col_zonas")}</span></li>
      <li><span class="que">Fecha del dato</span><span class="valor">${fecha(c.fecha_carga)} ${marca("col_fecha")}</span></li></ul>
      <p class="detalle">Todas las accesiones traen la misma fecha: es el día en que se cargó el dato, no el día en que alguien vio la planta. Toca un punto para abrir la ficha de la zona.</p>${dosListas}`;
  } else if (L === "conservacion") {
    const cats = c.cats, orden = ["CR", "EN", "VU", "NT", "LC", "DD", "EW", "NE"];
    ley.innerHTML = `<p class="detalle">Accesiones amenazadas (CR, EN y VU) sumadas por zona; el número junto al punto es cuántas hay. Cada punto es la ${ROTULO_ZONA}. Nunca se muestra dónde está una planta amenazada, y ninguna se usa para ubicar el punto de la zona.</p>`
      + leyendaEscala(COLORES_A, ["1 a 9", "150 o más"]) + filaLeyenda(SIN_AMEN, "Ninguna amenazada")
      + filaLeyenda("transparent", "Más de la mitad sin evaluar (NE)", `border:2.5px solid var(--ne);border-radius:50%`) + filaRayas;
    const max = Math.max(...orden.map((o) => cats[o] || 0));
    const COL = { CR: "#a33f22", EN: "#cc6a3c", VU: "#e39a62", NT: "#c9b26b", LC: "#7aa36b", DD: "#9a9a9a", EW: "#3b2f2f", NE: "var(--ne)" };
    const NOM = { CR: "En peligro crítico", EN: "En peligro", VU: "Vulnerable", NT: "Casi amenazada", LC: "Preocupación menor", DD: "Datos insuficientes", EW: "Extinta en estado silvestre", NE: "No evaluada" };
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Amenazadas dentro ${nombreBorde}</span><span class="valor">${num(pb.amen)} ${marca("col_amen_dentro")}</span></li>
      <li><span class="que">Amenazadas en todo el dato</span><span class="valor">${num(c.amen)} ${marca("col_amen")}</span></li>
      <li><span class="que">Sin evaluar (NE)</span><span class="valor">${num(c.ne)} ${marca("col_ne")}</span></li></ul>
      <div class="barras" aria-label="Accesiones por categoría">${orden.map((o) => `<div class="b"><span>${o} · ${NOM[o]}</span><span class="pista"><span style="width:${(100 * (cats[o] || 0) / max).toFixed(1)}%;background:${COL[o]}"></span></span><span class="n">${num(cats[o] || 0)}</span></div>`).join("")}</div>
      <p class="detalle">El ${num(100 * c.ne / c.n, 1)} % de la colección (${num(c.ne)}) no tiene categoría (NE). Va con su propio color porque nadie la ha evaluado. EW (${num(c.ew)}) se cuenta aparte de las amenazadas.</p>
      <div class="rayado" role="note"><strong>Escala por verificar</strong>El dato no dice si la categoría es la de la UICN o la de la Resolución 0126 de 2024. Por eso no se compara con otras listas.</div>`;
  } else if (L === "certeza") {
    ley.innerHTML = `<p class="detalle"><strong>¿De cuántos árboles se sabe la especie?</strong> Cada punto es un árbol del censo de la ciudad. Los puntos de las zonas de la colección quedan en gris.</p>`
      + filaLeyenda(CON_ESPECIE, "Con especie") + filaLeyenda(SIN_ESPECIE, "Sin especie: NN (no se identificó) u Otro (no está en la lista)");
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Árboles del censo dentro ${nombreBorde}</span><span class="valor">${num(cen.n)} ${marca(k === "lote" ? "cen_lote" : "cen_idrd")}</span></li>
      <li><span class="que">Sin especie (NN y Otro)</span><span class="valor">${num(cen.sin_id)}, ${num(cen.pct_sin_id, 1)} % ${marca(k === "lote" ? "cen_sinid_lote" : "cen_sinid_idrd")}</span></li>
      <li><span class="que">NN / Otro</span><span class="valor">${num(cen.nn)} / ${num(cen.otro)}</span></li>
      <li><span class="que">Registros del censo</span><span class="valor">${fecha(cen.fmin)} a ${fecha(cen.fmax)} ${marca("cen_fechas")}</span></li>
      <li><span class="que">Colección viva</span><span class="valor">una sola fecha: ${fecha(c.fecha_carga)} ${marca("col_fecha")}</span></li></ul>
      <p class="detalle">El ${num(cen.pct_sin_id, 1)} % de los árboles del censo dentro ${nombreBorde} no tiene nombre de especie. La colección viva sí tiene nombre en cada accesión, pero su fecha es la de carga, así que no dice desde cuándo se sabe.</p>
      <p class="detalle">No saber la especie de los árboles sin identificar es lo que más ensancha la proyección a 20 años, por poco. <a href="../proyecciones/proyecciones.html">Ver cómo</a></p>${dosListas}`;
  } else if (L === "contexto") {
    const s = r.sectores;
    ley.innerHTML = `<p class="detalle">Árboles del censo por hectárea en los ${num(s.n)} sectores del parque Simón Bolívar (IDRD). El jardín va con borde negro.</p>`
      + leyendaEscala(COLORES_D, ["menos de 25", "250 o más"]);
    txt.innerHTML = `<ul class="cifras">
      <li><span class="que">Jardín Botánico</span><span class="valor">${num(s.densidad_jardin)} por ha ${marca("dens")}</span></li>
      <li><span class="que">Siguiente: ${esc(s.siguiente[0])}</span><span class="valor">${num(s.siguiente[1])} por ha ${marca("dens_sig")}</span></li>
      <li><span class="que">Área de los ${num(s.n)} sectores</span><span class="valor">${num(s.area_ha, 2)} ha ${marca("sb_area")}</span></li></ul>
      <p class="detalle">El jardín es el sector con más árboles por hectárea del Simón Bolívar. Toca un sector para ver su cifra.</p><p id="sector-sel" class="detalle" aria-live="polite"></p>`;
  } else {
    ley.innerHTML = `<p class="detalle">Sin lente. Se ven el borde, las zonas como puntos sin color (${ROTULO_ZONA}) y el Tropicario rayado.</p>` + filaRayas;
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
  vis("zonas", L !== "contexto"); vis("zonas-sel", L !== "contexto");
  const pinta = (prop, v) => mapa.setPaintProperty("zonas", prop, v);
  const muchosNE = [">", ["get", "ne"], ["/", ["get", "n"], 2]];
  pinta("circle-stroke-color", "#ffffff"); pinta("circle-stroke-width", 1.5); pinta("circle-opacity", 1);
  if (L === "coleccion") pinta("circle-color", paso("n", CORTES_N, COLORES_N));
  else if (L === "conservacion") {
    pinta("circle-color", paso("amen", CORTES_A, COLORES_A, SIN_AMEN));
    pinta("circle-stroke-color", ["case", muchosNE, "#5b5f97", "#ffffff"]);
    pinta("circle-stroke-width", ["case", muchosNE, 2.5, 1.5]);
  } else if (L === "certeza") pinta("circle-color", ZONA_NEUTRA);
  else { pinta("circle-color", "#ffffff"); pinta("circle-stroke-color", "#8a8f87"); }
  pintarRotulos();
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
    ? ["match", ["get", "k"], 0, CON_ESPECIE, SIN_ESPECIE] : "#2d6a3e");
}

// ---------- censo a pedido ----------
let censoGeo = null, dibujadosBorde = null;
export async function activarCenso(on) {
  estado.censo = on;
  const est = document.getElementById("censo-estado");
  if (on && !censoGeo) {
    est.textContent = "Cargando los árboles…";
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
    } catch (e) { est.textContent = `No se pudieron cargar los árboles: ${e.message}`; estado.censo = false; document.getElementById("ver-censo").checked = false; return; }
  }
  if (mapa && mapa.getSource("censo")) {
    if (on) mapa.getSource("censo").setData(censoGeo);
    mapa.setLayoutProperty("censo", "visibility", on ? "visible" : "none");
  }
  pintarColorCenso();
  if (on) {
    const cen = estado.base.resumen.censo;
    est.innerHTML = `Encendido: ${num(censoGeo.features.length)} árboles dibujados alrededor del jardín; dentro del borde, ${num(dibujadosBorde[estado.borde])} dibujados de ${num(cen.por_borde[estado.borde].n)} en el censo ${marca("cen_dibujados_plano")}. Algunos árboles no se dibujan para proteger especies sensibles, y los robles, especie amenazada, solo se cuentan. Censo de árboles de la ciudad, actualizado en el portal de datos el ${fecha(cen.ficha_modificada)} ${marca("cen_ficha")}. Toca un árbol para ver su ficha.`;
  } else est.textContent = "Apagado. Enciéndelo para ver cada árbol y abrir su ficha.";
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
  document.getElementById("ver-sol").addEventListener("click", verSol);
  let t;
  document.getElementById("buscar").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => buscar(e.target.value), 200); });
}

// ---------- sol en tres zonas: las mismas horas que calcula el 3D ----------
// Lee ../datos/horas_sol.json, el archivo del 3D (en la publicación, el plano vive en visor/ junto a datos/).
// Si no se puede leer, el plano no calcula nada propio: manda al 3D.
async function verSol(e) {
  const b = e.currentTarget, caja = document.getElementById("sol-respuesta");
  const abierta = b.getAttribute("aria-expanded") === "true";
  b.setAttribute("aria-expanded", String(!abierta));
  b.textContent = abierta ? "Ver la respuesta" : "Ocultar la respuesta";
  caja.hidden = abierta;
  if (abierta || caja.dataset.lista) return;
  caja.innerHTML = `<p class="cargando">Leyendo las horas de sol…</p>`;
  try {
    const r = await fetch("../datos/horas_sol.json");
    if (!r.ok) throw new Error(String(r.status));
    const h = await r.json();
    const filas = Object.keys(ZONAS_DEMO).map((z) => {
      const v = h.zonas?.[z];
      if (!Array.isArray(v) || v.length !== 12) throw new Error(`sin horas para ${z}`);
      return { z, nombre: ZONAS_DEMO[z], prom: v.reduce((a, x) => a + x, 0) / 12, jun: v[5], dic: v[11] };
    });
    const mas = [...filas].sort((a, b) => b.prom - a.prom)[0];
    const cambia = [...filas].sort((a, b) => Math.abs(b.dic - b.jun) - Math.abs(a.dic - a.jun))[0];
    const [bajo, alto] = cambia.jun < cambia.dic ? [["junio", cambia.jun], ["diciembre", cambia.dic]] : [["diciembre", cambia.dic], ["junio", cambia.jun]];
    caja.innerHTML = `<p><strong>La ${esc(mas.nombre)} es la que más sol recibe</strong>: unas ${num(mas.prom, 1)} horas de sol directo al día en promedio. <strong>${esc(cambia.nombre)} es la que más cambia</strong>: de unas ${num(bajo[1], 1)} horas en ${bajo[0]} a ${num(alto[1], 1)} en ${alto[0]}. ${marca("horas_sol")}</p>
      <table class="tabla-sol"><caption class="detalle">Horas de sol directo al día</caption>
        <thead><tr><th scope="col">Zona</th><th scope="col">Promedio del año</th><th scope="col">Junio</th><th scope="col">Diciembre</th></tr></thead>
        <tbody>${filas.map((f) => `<tr><th scope="row">${esc(f.nombre)}</th><td>${num(f.prom, 1)}</td><td>${num(f.jun, 1)}</td><td>${num(f.dic, 1)}</td></tr>`).join("")}</tbody></table>
      <p class="detalle">Día 15 de cada mes, cielo despejado, suelo plano y copa de los árboles supuesta según su tipo. Son las mismas horas del visor 3D.</p>`;
    caja.dataset.lista = "1";
  } catch {
    caja.innerHTML = `<p>No se pudieron leer las horas de sol. Míralas en el <a href="../">visor 3D</a>.</p>`;
  }
}

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
