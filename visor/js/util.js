// Utilidades compartidas: carga de datos, números y fechas en español; las marcas vienen de marcas.js.

const cache = new Map();
export function cargar(nombre) {
  if (!cache.has(nombre)) {
    cache.set(nombre, fetch(`datos/${nombre}`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo leer ${nombre} (${r.status})`);
      return r.json();
    }).catch((e) => { cache.delete(nombre); throw e; }));
  }
  return cache.get(nombre);
}

// Punto de miles y coma decimal, también con 4 cifras (9.013, no 9013).
export function num(v, dec = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "sin dato";
  const neg = v < 0;
  const [ent, frac] = Math.abs(v).toFixed(dec).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + miles + (frac ? "," + frac : "");
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function fecha(iso) {
  if (!iso) return "sin fecha";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}
export function fechaDias(dias) {
  if (dias === null || dias === undefined) return "sin fecha";
  return fecha(new Date(dias * 86400000).toISOString());
}
export function mesCorto(i) { return MESES[i]; }

// Las marcas salen de la tabla única (marcas.js, copia exacta de visor3d/src/marcas.js): se piden por el id de la cifra.
export { marca, marcaTipo, activarMarcas } from "./marcas.js";

export function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function rayado(titulo, texto) {
  return `<div class="rayado" role="note"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;
}

// Parámetros de la URL para las fichas: ?accesion=, ?arbol=, ?zona=
export function ponerParam(clave, valor) {
  const u = new URL(location.href);
  ["accesion", "arbol", "zona"].forEach((k) => u.searchParams.delete(k));
  if (clave && valor !== undefined && valor !== null) u.searchParams.set(clave, valor);
  history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
}
