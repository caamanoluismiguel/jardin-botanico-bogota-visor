// Fichas con URL propia: ?zona=, ?accesion=, ?arbol=
import { cargar, num, fecha, fechaDias, marca, esc, rayado, ponerParam } from "./util.js";

let estado, acciones;
const dlg = () => document.getElementById("ficha");
const AMENAZA = new Set(["CR", "EN", "VU"]);
const URL_COL = "https://datosabiertos.bogota.gov.co/dataset/colecciones-vivas-bogota-d-c";
const URL_CEN = "https://datosabiertos.bogota.gov.co/dataset/censo-arbolado-urbano";

export function iniciarFichas(e, a) {
  estado = e; acciones = a;
  document.getElementById("ficha-cerrar").addEventListener("click", () => dlg().close());
  dlg().addEventListener("close", () => { ponerParam(null); acciones.resaltarAccesion(null); window.__resaltarZona?.(null); });
  dlg().addEventListener("click", (ev) => { if (ev.target === dlg()) dlg().close(); });
}

function mostrar(tipo, titulo, cuerpo) {
  document.getElementById("ficha-tipo").textContent = tipo;
  document.getElementById("ficha-titulo").textContent = titulo;
  document.getElementById("ficha-cuerpo").innerHTML = cuerpo;
  const d = dlg();
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  document.getElementById("ficha-cerrar").focus();
}

function fila(dt, dd) { return `<div><dt>${dt}</dt><dd>${dd}</dd></div>`; }

// ---------- índice de accesiones ----------
let idx = null;
async function accesiones() {
  if (idx) return idx;
  const d = await cargar("accesiones.json");
  const porId = new Map();
  d.cols.id.forEach((id, i) => { if (!porId.has(id)) porId.set(id, []); porId.get(id).push(i); });
  const normal = d.especies.map((s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  idx = { d, porId, normal };
  return idx;
}
function lonlat(d, i) {
  if (d.cols.x[i] === null) return null;
  return [d.origen[0] + d.cols.x[i] * d.escala, d.origen[1] + d.cols.y[i] * d.escala];
}
function dentroTexto(b) {
  const p = [];
  if (b & 1) p.push("lote catastral");
  if (b & 2) p.push("parque IDRD");
  return p.length ? p.join(" y ") : "fuera de ambos bordes";
}

// ---------- zona ----------
export async function abrirZona(z) {
  const f = estado.zonas.features.find((x) => x.properties.z === z);
  if (!f) return mostrar("Zona", "No encontrada", `<p>No hay una zona con el código ${esc(z)} en el dato de la colección viva.</p>`);
  const p = f.properties;
  ponerParam("zona", z);
  window.__resaltarZona?.(z);
  acciones.resaltarAccesion(null);
  const cats = typeof p.cats === "string" ? JSON.parse(p.cats) : p.cats;
  const orden = ["CR", "EN", "VU", "NT", "LC", "DD", "EW", "NE"].filter((c) => cats[c]);
  const max = Math.max(...orden.map((o) => cats[o]));
  const COL = { CR: "#a33f22", EN: "#cc6a3c", VU: "#e39a62", NT: "#c9b26b", LC: "#7aa36b", DD: "#9a9a9a", EW: "#3b2f2f", NE: "var(--ne)" };
  let html = `<ul class="cifras">
    <li><span class="que">Accesiones</span><span class="valor">${num(p.n)} ${marca("zona_n")}</span></li>
    <li><span class="que">Nombres de planta</span><span class="valor">${num(p.esp)} ${marca("zona_nombres")}</span></li>
    <li><span class="que">Familias</span><span class="valor">${num(p.fam)} ${marca("zona_familias")}</span></li>
    <li><span class="que">Amenazadas (CR, EN, VU)</span><span class="valor">${num(p.amen)} ${marca("zona_amen")}</span></li>
    <li><span class="que">Sin evaluar (NE)</span><span class="valor">${num(p.ne)} ${marca("zona_ne")}</span></li>
    <li><span class="que">Dentro del lote catastral</span><span class="valor">${num(p.nlote)} ${marca("zona_lote")}</span></li>
    <li><span class="que">Fecha del dato</span><span class="valor">${fecha(p.fmax)} ${marca("col_fecha")}</span></li></ul>
    <div class="barras" aria-label="Accesiones por categoría">${orden.map((o) => `<div class="b"><span>${o}</span><span class="pista"><span style="width:${(100 * cats[o] / max).toFixed(1)}%;background:${COL[o]}"></span></span><span class="n">${num(cats[o])}</span></div>`).join("")}</div>
    <p class="detalle">${p.r != null ? `En el mapa, el punto es la ubicación aproximada de la zona; el dato no trae su borde ${marca("zona_punto")}. Va en la mediana de las ${num(p.nvis)} plantas que se pueden mostrar y no usa ninguna planta amenazada.` : "Esta zona tiene menos de 3 plantas que se pueden mostrar, así que no lleva punto en el mapa."} ${p.puntos_unicos < p.n ? `Hay ${num(p.n - p.puntos_unicos)} accesiones que comparten coordenada con otra.` : ""}</p>`;
  if (p.trop) html += rayado("Interior del Tropicario", "No hay datos abiertos de temperatura, humedad ni luz dentro del Tropicario. Lo que se sabe es la huella del edificio en Catastro.");
  html += `${p.r != null ? `<button class="boton secundario" id="zona-ver">Ver la zona en el mapa</button>` : ""}
    <h3>Accesiones de la zona</h3><div id="zona-lista" class="cargando">Bajando la lista…</div>
    <p class="detalle">Fuente: <a href="${URL_COL}" target="_blank" rel="noopener">Colecciones vivas, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0</a>.</p>`;
  mostrar(`Zona ${z} de la colección viva`, p.nombre, html);
  document.getElementById("zona-ver")?.addEventListener("click", () => { dlg().close(); window.__resaltarZona?.(z); acciones.irA(p.cx, p.cy, 18); });
  try {
    const { d } = await accesiones();
    const filas = [];
    d.cols.z.forEach((zz, i) => { if (zz === z) filas.push(i); });
    filas.sort((a, b) => d.especies[d.cols.e[a]].localeCompare(d.especies[d.cols.e[b]], "es"));
    pintarLista(d, filas, 40);
  } catch (e) { document.getElementById("zona-lista").textContent = `No se pudo bajar la lista: ${e.message}`; }
}

function pintarLista(d, filas, cuantas) {
  const el = document.getElementById("zona-lista");
  if (!el) return;
  el.classList.remove("cargando");
  el.innerHTML = `<ul class="lista-acc">${filas.slice(0, cuantas).map((i) => `<li><button data-acc="${esc(d.cols.id[i])}"><em>${esc(d.especies[d.cols.e[i]] || "sin nombre")}</em><br><small>Accesión ${esc(d.cols.id[i])} · ${esc(d.cols.c[i] || "sin categoría")}</small></button></li>`).join("")}</ul>`
    + (filas.length > cuantas ? `<button class="enlace-boton" id="zona-mas">Ver las ${num(filas.length)}</button>` : "");
  el.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => abrirAccesion(b.dataset.acc)));
  document.getElementById("zona-mas")?.addEventListener("click", () => pintarLista(d, filas, filas.length));
}

// ---------- accesión ----------
export async function abrirAccesion(id) {
  let I;
  try { I = await accesiones(); } catch (e) { return mostrar("Accesión", "No se pudo abrir", `<p>${esc(e.message)}</p>`); }
  const { d, porId } = I;
  const filas = porId.get(String(id));
  if (!filas) return mostrar("Accesión", "No encontrada", `<p>No hay una accesión con el número ${esc(id)} en el dato abierto del ${fecha(d.consultado)}.</p>`);
  ponerParam("accesion", id);
  const i = filas[0];
  const c = d.cols.c[i], z = d.cols.z[i];
  const ll = lonlat(d, i);
  const oculta = AMENAZA.has(c) || c === "EW";
  const vecina = !oculta && ll === null && (d.sin_punto_por_vecina || []).includes(i);
  acciones.resaltarAccesion(ll);
  window.__resaltarZona?.(z);
  let ubic;
  if (oculta) ubic = `No se muestra. ${c === "EW" ? "Es una planta extinta en estado silvestre" : "Es una planta amenazada"}: el visor solo la cuenta en su zona.`;
  else if (vecina) ubic = "No se muestra su punto. Algunas plantas no se dibujan para proteger especies sensibles.";
  else if (ll) ubic = `${num(ll[1], 6)} N, ${num(-ll[0], 6)} O ${marca("acc_coord")} <button class="enlace-boton" id="acc-ver">Ver en el mapa</button>`;
  else ubic = "No se muestra su punto. Algunas plantas no se dibujan para proteger especies sensibles; otras no traen coordenada en el dato.";
  const html = `<dl class="datos">
    ${fila("Familia", esc(d.familias[d.cols.fa[i]] || "sin dato") + " " + marca("acc_familia"))}
    ${fila("Zona", `<button class="enlace-boton" id="acc-zona">${esc(d.zonas[z] || z)} (${esc(z)})</button>`)}
    ${fila("Categoría", `${esc(c)} · ${esc(d.categorias[c] || "sin categoría")} ${marca("acc_categoria")}`)}
    ${fila("Fecha en el dato", `${fechaDias(d.cols.f[i])} ${marca("col_fecha")}<br><small>Es la fecha de carga del conjunto, igual para todas las accesiones. No dice desde cuándo está la planta.</small>`)}
    ${fila("Ubicación", ubic)}
    ${fila("Dentro de", dentroTexto(d.cols.b[i]) + " " + marca("dentro"))}
  </dl>
  ${filas.length > 1 ? `<p class="detalle">Este número aparece ${filas.length} veces en el dato abierto; se muestra el primero.</p>` : ""}
  <h3>Lo que falta por saber</h3>
  ${rayado("Procedencia silvestre", "El dato abierto no dice si la planta vino de la naturaleza, de otro jardín o de un vivero, ni de qué lugar.")}
  ${rayado("Estado de la planta", "No hay dato abierto de si sigue viva, cómo está ni cuándo se revisó por última vez.")}
  ${AMENAZA.has(c) ? rayado("Escala de la categoría", "El dato no dice si la categoría sigue la lista de la UICN o la Resolución 0126 de 2024.") : ""}
  <p class="detalle">Fuente: <a href="${URL_COL}" target="_blank" rel="noopener">Colecciones vivas, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0</a>. Consulta del ${fecha(d.consultado)}.</p>`;
  mostrar(`Accesión ${id} · colección viva`, d.especies[d.cols.e[i]] || "Sin nombre", html);
  document.getElementById("acc-zona").addEventListener("click", () => abrirZona(z));
  document.getElementById("acc-ver")?.addEventListener("click", () => { dlg().close(); acciones.resaltarAccesion(ll); acciones.irA(ll[0], ll[1], 19); });
}

// ---------- árbol del censo ----------
let cidx = null;
export async function abrirArbol(cod) {
  let d;
  try { d = await cargar("censo.json"); } catch (e) { return mostrar("Árbol", "No se pudo abrir", `<p>${esc(e.message)}</p>`); }
  if (!cidx) { cidx = new Map(); d.cols.c.forEach((c, i) => cidx.set(c, i)); }
  const i = cidx.get(String(cod));
  if (i === undefined) return mostrar("Árbol del censo", "No encontrado", `<p>No hay un árbol con el código ${esc(cod)} en el recorte del censo alrededor del jardín. Algunos árboles no se dibujan para proteger especies sensibles, y los robles, especie amenazada, solo se cuentan.</p>`);
  ponerParam("arbol", cod);
  window.__resaltarZona?.(null);
  const ll = d.cols.x[i] === null ? null : [d.origen[0] + d.cols.x[i] * d.escala, d.origen[1] + d.cols.y[i] * d.escala];
  acciones.resaltarAccesion(ll);
  const k = d.cols.k[i];
  const nombre = d.especies[d.cols.e[i]];
  const titulo = k === 1 ? "Sin identificar (NN)" : k === 2 ? "«Otro»: especie fuera de la lista" : nombre;
  const h = d.cols.h[i];
  const html = `<dl class="datos">
    ${fila("Nombre en el censo", esc(nombre) + " " + marca("arbol_nombre"))}
    ${fila("Identificación", (k === 0 ? "Identificado" : k === 1 ? "NN: no se identificó" : "Otro: no está en la lista de especies") + " " + marca("arbol_ident"))}
    ${fila("Altura registrada", (h === null ? "sin dato" : `${num(h / 10, 1)} m`) + " " + marca("altura_censo"))}
    ${fila("Fecha del registro", fechaDias(d.cols.f[i]) + " " + marca("arbol_fecha") + "<br><small>Es la última actualización de este árbol en el censo. No hay histórico abierto de cambios.</small>")}
    ${fila("Dentro de", dentroTexto(d.cols.b[i]) + " " + marca("dentro"))}
    ${ll ? "" : fila("Ubicación", "No se muestra. Algunos árboles no se dibujan para proteger especies sensibles.")}
  </dl>
  <h3>Lo que falta por saber</h3>
  ${rayado("Copa medida", "El censo abierto trae la altura, no el diámetro de la copa. En la vista 3D la copa es un supuesto.")}
  ${rayado("Estado sanitario", "No hay dato abierto de salud, riesgo ni mantenimiento de este árbol.")}
  <p class="detalle">Fuente: <a href="${URL_CEN}" target="_blank" rel="noopener">Censo del arbolado urbano, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0</a>. Consulta del ${fecha(d.consultado)}.</p>`;
  mostrar(`Árbol del censo · código ${cod}`, titulo, html);
}

// ---------- búsqueda ----------
const ROBLE = /^(robl(e|es)?|quercus( h[a-z]*)?)$/;
// Los robles van solo como conteo (regla SOLO_CONTEO de visor/build/regla_sensibles.py): el buscador lo dice.
function notaRoble(sc) {
  return `<li class="detalle">Los robles (Quercus humboldtii) son una especie amenazada: no se dibujan ni se buscan uno a uno, solo se cuentan${sc ? `. En el lote hay ${num(sc.lote)}, ${num(sc.lote_15m)} de ellos de 15 m o más` : ""}.</li>`;
}
export async function buscar(q) {
  const ul = document.getElementById("resultados");
  q = (q || "").trim();
  if (q.length < 2) { ul.innerHTML = ""; return; }
  ul.innerHTML = `<li class="cargando">Buscando…</li>`;
  let I;
  try { I = await accesiones(); } catch (e) { ul.innerHTML = `<li>${esc(e.message)}</li>`; return; }
  const { d, porId, normal } = I;
  const res = [];
  let nota = "";
  if (/^\d+$/.test(q)) {
    for (const [id, filas] of porId) { if (id.startsWith(q)) res.push(filas[0]); if (res.length >= 12) break; }
  } else {
    const n = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (let i = 0; i < d.cols.id.length && res.length < 12; i++) if (normal[d.cols.e[i]].includes(n)) res.push(i);
    if (ROBLE.test(n)) {
      let sc = null;
      try { sc = (await cargar("censo.json")).solo_conteo?.[0] || null; } catch { /* la nota sin cifras */ }
      nota = notaRoble(sc);
    }
  }
  ul.innerHTML = nota + (res.length || nota ? res.map((i) => `<li><button data-acc="${esc(d.cols.id[i])}"><em>${esc(d.especies[d.cols.e[i]])}</em><br><small>Accesión ${esc(d.cols.id[i])} · zona ${esc(d.zonas[d.cols.z[i]] || d.cols.z[i])}</small></button></li>`).join("")
    : `<li class="detalle">Nada con «${esc(q)}» en la colección viva.</li>`);
  ul.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => abrirAccesion(b.dataset.acc)));
}
