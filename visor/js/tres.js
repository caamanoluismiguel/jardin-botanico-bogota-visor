// Sol y sombra en 3D, solo bajo pedido. Edificios de Catastro extruidos por pisos, árboles del censo
// con copa supuesta y sol calculado con el algoritmo de la NOAA. Nada de esto se carga en la primera vista.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cargar, num, fecha, marca, esc, rayado } from "./util.js";

const RAD = Math.PI / 180;
let listo = null; // la escena se arma una sola vez
let E = null;     // estado de la escena

// ---------- Sol (NOAA, siglos julianos) ----------
export function sol(ms, lat, lon) {
  const jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const y = Math.tan(eps * RAD / 2) ** 2;
  const eot = 4 / RAD * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  const d = new Date(ms), minUTC = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const ha = ((minUTC + eot + 4 * lon) / 4 - 180) * RAD;
  const la = lat * RAD;
  const cz = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha);
  const elev = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / RAD;
  const az = ((Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / RAD + 180) % 360 + 360) % 360;
  return { elev, az };
}
// Hora de Bogotá (UTC−5, sin horario de verano) a milisegundos UTC.
const msBogota = (iso, horas) => Date.parse(iso + "T00:00:00Z") + (horas + 5) * 3600000;

// ---------- Geometría local en metros: x al este, n al norte ----------
function proyector(lon0, lat0) {
  const kx = 111320 * Math.cos(lat0 * RAD), ky = 110574;
  return (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky];
}

async function armar(estado) {
  const [con, cen] = await Promise.all([cargar("construcciones.json"), cargar("censo.json")]);
  const [lon0, lat0] = estado.base.centro;
  const P = proyector(lon0, lat0);
  const lienzo = document.getElementById("tres-lienzo");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  lienzo.appendChild(renderer.domElement);
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xe9ece6);
  const camara = new THREE.PerspectiveCamera(45, 1, 2, 6000);
  camara.position.set(120, 420, 520);
  const ctl = new OrbitControls(camara, renderer.domElement);
  ctl.target.set(0, 0, 0);
  ctl.maxPolarAngle = 1.45;
  ctl.minDistance = 40; ctl.maxDistance = 2000;

  escena.add(new THREE.HemisphereLight(0xffffff, 0x8a9a80, 0.9));
  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  Object.assign(luz.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 1, far: 2400 });
  luz.shadow.bias = -0.0004;
  escena.add(luz, luz.target);

  // Suelo
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ color: 0xdfe5d8 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  escena.add(suelo);

  // Polígono a Shape (anillo exterior + huecos)
  const forma = (anillos) => {
    const s = new THREE.Shape(anillos[0].map(([lo, la]) => new THREE.Vector2(...P(lo, la))));
    for (const h of anillos.slice(1)) s.holes.push(new THREE.Path(h.map(([lo, la]) => new THREE.Vector2(...P(lo, la)))));
    return s;
  };
  const linea = (anillo, color, alto = 0.15, ancho) => {
    const g = new THREE.BufferGeometry().setFromPoints(anillo.map(([lo, la]) => { const [x, n] = P(lo, la); return new THREE.Vector3(x, alto, -n); }));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
  };

  // Edificios: pisos × 3 m (supuesto), agrupados por número de pisos y fundidos en una malla.
  const porPisos = new Map();
  const bloques = [];
  for (const f of con.features) {
    const p = Math.max(1, f.properties.p || 1), H = p * con.altura_por_piso;
    if (!porPisos.has(p)) porPisos.set(p, []);
    porPisos.get(p).push(forma(f.geometry.coordinates));
    const anillo = f.geometry.coordinates[0].map(([lo, la]) => P(lo, la));
    let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    for (const [x, n] of anillo) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); n0 = Math.min(n0, n); n1 = Math.max(n1, n); }
    bloques.push({ anillo, H, cx: (x0 + x1) / 2, cn: (n0 + n1) / 2, r: Math.hypot(x1 - x0, n1 - n0) / 2 });
  }
  const geos = [];
  for (const [p, formas] of porPisos) {
    const g = new THREE.ExtrudeGeometry(formas, { depth: p * con.altura_por_piso, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const edificios = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color: 0xc9c4ba }));
  edificios.castShadow = true; edificios.receiveShadow = true;
  escena.add(edificios);

  // Tropicario: huella de Catastro resaltada; por dentro no hay datos.
  const trop = estado.base.tropicario.geom;
  const anTrop = trop.type === "Polygon" ? [trop.coordinates] : trop.coordinates;
  for (const a of anTrop) escena.add(linea(a[0], 0x8a5a00, 0.4));

  // Borde del lote y zonas: círculo de ubicación aproximada (el dato no trae el borde de la zona).
  const borde = estado.base.bordes.lote.geom;
  const anBorde = borde.type === "Polygon" ? [borde.coordinates] : borde.coordinates;
  for (const a of anBorde) escena.add(linea(a[0], 0x1c2620, 0.2));
  const zonas = estado.zonas.features;
  const zonaMallas = zonas.map((f, i) => {
    const p = f.properties;
    if (!f.geometry || p.r == null) return null;
    const [x, n] = P(...f.geometry.coordinates);
    const g = new THREE.CircleGeometry(p.r, 48);
    g.rotateX(-Math.PI / 2); g.translate(x, 0.08 + 0.002 * (zonas.length - i), -n);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xb9c7ae, transparent: true, opacity: 0.5, depthWrite: false }));
    m.receiveShadow = true;
    escena.add(m);
    return m;
  });

  // Árboles del censo: tronco fino y copa esférica supuesta (radio 0,25·h, centro a 0,65·h).
  const c = cen.cols, n = c.x.length, [ox, oy] = cen.origen, k = cen.escala;
  const arboles = [];
  for (let i = 0; i < n; i++) {
    const h = c.h[i] ? c.h[i] / 10 : 0;
    if (!h || c.x[i] === null) continue;
    const [x, nn] = P(ox + c.x[i] * k, oy + c.y[i] * k);
    arboles.push({ x, n: nn, h });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 5), new THREE.MeshLambertMaterial({ color: 0x6b5843 }), arboles.length);
  const copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x4f7a44 }), arboles.length);
  arboles.forEach((a, i) => {
    m4.compose(v.set(a.x, a.h * 0.25, -a.n), q, s.set(1, a.h * 0.5, 1)); troncos.setMatrixAt(i, m4);
    const r = a.h * 0.25;
    m4.compose(v.set(a.x, a.h * 0.65, -a.n), q, s.set(r, r, r)); copas.setMatrixAt(i, m4);
  });
  copas.castShadow = true; copas.receiveShadow = true;
  escena.add(troncos, copas);

  // Índice de copas en celdas de 10 m para buscar a lo largo de toda la sombra posible.
  const celdas = new Map();
  let hmax = 0;
  arboles.forEach((a, i) => {
    hmax = Math.max(hmax, a.h);
    const k = `${Math.floor(a.x / CELDA)},${Math.floor(a.n / CELDA)}`;
    if (!celdas.has(k)) celdas.set(k, []);
    celdas.get(k).push(i);
  });
  const bmax = bloques.reduce((m, b) => Math.max(m, b.H), 0);
  E = { renderer, escena, camara, ctl, luz, lienzo, copas, troncos, bloques, arboles, zonas, zonaMallas, celdas, hmax, bmax,
    visto: new Uint32Array(arboles.length), sello: 0, lat: lat0, lon: lon0, pedir: null };
  const pintar = () => { E.pedir = null; renderer.render(escena, camara); };
  E.redibujar = () => { if (!E.pedir) E.pedir = requestAnimationFrame(pintar); };
  ctl.addEventListener("change", E.redibujar);
  new ResizeObserver(() => {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); E.redibujar();
  }).observe(lienzo);
  conectarControles(estado);
}

function hoyBogota() {
  return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
}
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

function ponerSol() {
  const f = document.getElementById("tres-fecha").value || hoyBogota();
  const h = +document.getElementById("tres-hora").value;
  document.getElementById("tres-hora-txt").textContent = hhmm(h);
  const { elev, az } = sol(msBogota(f, h), E.lat, E.lon);
  const ce = Math.cos(elev * RAD);
  const dir = new THREE.Vector3(Math.sin(az * RAD) * ce, Math.sin(elev * RAD), -Math.cos(az * RAD) * ce);
  E.luz.position.copy(dir.multiplyScalar(1200));
  E.luz.intensity = elev > 0 ? 2.2 : 0;
  const rumbo = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"][Math.round(az / 45) % 8];
  document.getElementById("tres-sol").innerHTML = elev > 0
    ? `Sol a ${num(elev, 1)}° sobre el horizonte, hacia el ${rumbo} (${num(az, 0)}°), el ${fecha(f)} a las ${hhmm(h)} ${marca("inferido")}. Cielo despejado ${marca("supuesto")}.`
    : `A las ${hhmm(h)} del ${fecha(f)} el sol está bajo el horizonte.`;
  E.redibujar();
}

// ---------- Horas de sol directo por zona ----------
const CELDA = 10;      // metros
const TOPE = 400;      // alcance máximo de la búsqueda de sombra, en metros
function bloqueado(px, pn, h0, az, elev, conCopas) {
  const dx = Math.sin(az * RAD), dn = Math.cos(az * RAD), te = Math.tan(elev * RAD);
  const alcance = Math.min(TOPE, (E.bmax - h0) / Math.max(te, 1e-3));
  for (const b of E.bloques) {
    // descartar rápido: el edificio tiene que quedar cerca de la semirrecta
    const lx = b.cx - px, ln = b.cn - pn, t = lx * dx + ln * dn;
    if (t < -b.r || t > alcance + b.r) continue;
    if (Math.abs(lx * dn - ln * dx) > b.r) continue;
    const a = b.anillo;
    for (let i = 0; i < a.length - 1; i++) {
      const [x1, n1] = a[i], [x2, n2] = a[i + 1];
      const ex = x2 - x1, en = n2 - n1, den = dx * en - dn * ex;
      if (Math.abs(den) < 1e-9) continue;
      const wx = x1 - px, wn = n1 - pn;
      const tt = (wx * en - wn * ex) / den, u = (wx * dn - wn * dx) / den;
      if (tt >= 0 && u >= 0 && u <= 1 && h0 + tt * te < b.H) return true;
    }
  }
  if (conCopas) {
    // Se recorre la sombra posible entera: hasta la altura máxima del censo dividida por la tangente
    // de la altura del sol, con tope de 400 m. Cada copa es una esfera de radio 0,25·h con centro a 0,65·h.
    const ce = Math.cos(elev * RAD), D = [dx * ce, dn * ce, Math.sin(elev * RAD)];
    const largo = Math.min(TOPE, (E.hmax - h0) / Math.max(te, 1e-3));
    const vec = Math.ceil((E.hmax * 0.25) / CELDA) + 1;
    const sello = ++E.sello;
    let ultima = "";
    for (let t = 0; t <= largo + CELDA; t += CELDA / 2) {
      const cx = Math.floor((px + dx * t) / CELDA), cn = Math.floor((pn + dn * t) / CELDA);
      const clave = cx + "," + cn;
      if (clave === ultima) continue;
      ultima = clave;
      for (let i = -vec; i <= vec; i++) for (let j = -vec; j <= vec; j++) {
        const lista = E.celdas.get((cx + i) + "," + (cn + j));
        if (!lista) continue;
        for (const k of lista) {
          if (E.visto[k] === sello) continue;
          E.visto[k] = sello;
          const a = E.arboles[k];
          const lx = a.x - px, ln = a.n - pn, r = a.h * 0.25, lz = a.h * 0.65 - h0;
          const tca = lx * D[0] + ln * D[1] + lz * D[2];
          if (tca < 0) continue;
          if (lx * lx + ln * ln + lz * lz - tca * tca < r * r) return true;
        }
      }
    }
  }
  return false;
}

let texturaRayas = null;
function rayas() {
  if (texturaRayas) return texturaRayas;
  const t = 32, c = document.createElement("canvas");
  c.width = c.height = t;
  const x = c.getContext("2d");
  x.fillStyle = "#f2f1ec"; x.fillRect(0, 0, t, t);
  x.strokeStyle = "#5c5c5c"; x.lineWidth = 3;
  for (let i = -t; i < 2 * t; i += 10) { x.beginPath(); x.moveTo(i, t); x.lineTo(i + t, 0); x.stroke(); }
  texturaRayas = new THREE.CanvasTexture(c);
  texturaRayas.wrapS = texturaRayas.wrapT = THREE.RepeatWrapping;
  texturaRayas.repeat.set(4, 4);
  return texturaRayas;
}

function calcular() {
  const f = document.getElementById("tres-fecha").value || hoyBogota();
  const conCopas = document.getElementById("tres-copas").checked;
  const P = proyector(E.lon, E.lat);
  const paso = 10 / 60;
  let horasSol = 0;
  const muestras = [];
  for (let h = 5.5; h <= 18.5 + 1e-9; h += paso) {
    const p = sol(msBogota(f, h), E.lat, E.lon);
    if (p.elev > 0) { muestras.push(p); horasSol += paso; }
  }
  // Cada zona se mide en varias plantas suyas que quedan fuera de toda construcción (vienen de la build)
  // y se promedia. Las zonas del Tropicario y las que no tienen ningún punto fuera de techo van rayadas.
  const filas = E.zonas.map((z, i) => {
    const p = z.properties;
    if (p.trop) return { i, z: p, horas: null, por: "techo" };
    if (!p.m || !p.m.length) return { i, z: p, horas: null, por: "sin-fuera" };
    let suma = 0;
    for (const [lo, la] of p.m) {
      const [px, pn] = P(lo, la);
      let libres = 0;
      for (const m of muestras) if (!bloqueado(px, pn, 1, m.az, m.elev, conCopas)) libres++;
      suma += libres * paso;
    }
    return { i, z: p, horas: suma / p.m.length, puntos: p.m.length };
  });
  const conHoras = filas.filter((r) => r.horas !== null).sort((a, b) => b.horas - a.horas);
  const rayadas = filas.filter((r) => r.horas === null);
  const escala = [0xc8d6e5, 0x8fb3d1, 0xe9c46a, 0xd08c1d];
  const corte = (hh) => (hh < 2 ? 0 : hh < 4 ? 1 : hh < 7 ? 2 : 3);
  for (const r of filas) {
    const m = E.zonaMallas[r.i];
    if (!m) continue;
    if (r.horas === null) { m.material.color.setHex(0xffffff); m.material.map = rayas(); }
    else { m.material.map = null; m.material.color.setHex(escala[corte(r.horas)]); }
    m.material.opacity = 0.85; m.material.needsUpdate = true;
  }
  E.redibujar();
  const nombres = ["menos de 2 h", "2 a 4 h", "4 a 7 h", "7 h o más"];
  const motivo = { "techo": "bajo techo, sin cálculo de sol", "sin-fuera": "ninguna planta de la zona queda fuera de los edificios, sin cálculo de sol" };
  document.getElementById("tres-resultado").innerHTML = `
    <p><strong>${fecha(f)}:</strong> el sol está arriba ${num(horasSol, 1)} h. Horas de sol directo a 1 m del suelo, cada 10 minutos, promediadas entre hasta 8 plantas de cada zona que quedan fuera de los edificios ${marca("inferido")}.</p>
    <ul class="leyenda-3d">${escala.map((c, i) => `<li><span class="muestra" style="background:#${c.toString(16).padStart(6, "0")}"></span>${nombres[i]}</li>`).join("")}
      <li><span class="muestra rayado" style="margin:0;padding:0"></span>Sin cálculo</li></ul>
    <ol class="lista-zonas">${conHoras.map((r) => `<li><span>${esc(r.z.nombre)}</span> <strong>${num(r.horas, 1)} h</strong></li>`).join("")}</ol>
    ${rayadas.length ? `<div class="rayado" role="note"><strong>Sin cálculo de sol</strong><ul class="lista-zonas">${rayadas.map((r) => `<li><span>${esc(r.z.nombre)}</span> <span>${motivo[r.por]}</span></li>`).join("")}</ul></div>` : ""}
    <p class="detalle">${conCopas ? "Cuenta la sombra de edificios y de las copas supuestas, buscadas a lo largo de toda la sombra posible (hasta 400 m)." : "Solo cuenta la sombra de los edificios: las copas están apagadas."} Es un promedio de puntos con plantas, no la zona entera.</p>`;
}

function conectarControles(estado) {
  const fe = document.getElementById("tres-fecha"), ho = document.getElementById("tres-hora");
  fe.value = hoyBogota();
  fe.addEventListener("input", () => { ponerSol(); document.getElementById("tres-resultado").innerHTML = ""; });
  ho.addEventListener("input", ponerSol);
  document.getElementById("tres-copas").addEventListener("change", (e) => {
    E.copas.visible = e.target.checked; E.redibujar();
    document.getElementById("tres-resultado").innerHTML = "";
  });
  document.getElementById("tres-calcular").addEventListener("click", (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Calculando…";
    setTimeout(() => { try { calcular(); } finally { b.disabled = false; b.textContent = "Horas de sol por zona ese día"; } }, 30);
  });
  const dlg = document.getElementById("tres");
  document.getElementById("tres-cerrar").addEventListener("click", () => dlg.close());
  const cen = estado.base.resumen.cenital || [];
  document.getElementById("tres-notas").innerHTML = `
    <p>Edificios de Catastro con ${num(E.bloques.length)} huellas; la altura es pisos por 3 m ${marca("supuesto")}.</p>
    <p>${num(E.arboles.length)} árboles del censo con su altura registrada ${marca("de fuente")}; la copa es una esfera de radio 0,25 por la altura ${marca("supuesto")}.</p>
    <p>Cada zona es un círculo: ubicación aproximada de la zona; el dato no trae su borde ${marca("inferido")}.</p>
    ${cen.length === 2 ? `<p>En ${cen[0].slice(0, 4)} el sol pasa justo encima del jardín al mediodía el ${fecha(cen[0])} y el ${fecha(cen[1])} ${marca("inferido")}.</p>` : ""}
    ${rayado("Horizonte de los cerros", "El cálculo toma el horizonte plano. Los cerros orientales recortan algo del sol de la mañana; falta medirlo.")}
    ${rayado("Copa medida", "El censo no publica el ancho de la copa. Por eso la copa es un supuesto y se puede apagar.")}
    ${rayado("Tropicario por dentro", "Se dibuja su huella (línea ocre). No hay datos abiertos de su interior ni de su clima.")}`;
}

export async function abrirTres(estado) {
  const dlg = document.getElementById("tres");
  if (!listo) listo = armar(estado).catch((e) => { listo = null; throw e; });
  await listo;
  dlg.showModal();
  ponerSol();
  requestAnimationFrame(() => { E.renderer.setSize(E.lienzo.clientWidth, E.lienzo.clientHeight, false); E.camara.aspect = E.lienzo.clientWidth / E.lienzo.clientHeight; E.camara.updateProjectionMatrix(); E.redibujar(); });
}
