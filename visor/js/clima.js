// Clima sin cuenta: METAR de El Dorado en vivo, CHIRPS, NASA POWER (modelo) y nubes de GIBS.
import { cargar, num, fecha, marca, esc, rayado, mesCorto, MESES_LARGOS } from "./util.js";

const fC = (f) => (f - 32) * 5 / 9;
function humedad(t, td) { // Magnus, en °C
  const a = 17.625, b = 243.04;
  return 100 * Math.exp((a * td) / (b + td)) / Math.exp((a * t) / (b + t));
}

function barras(valores, { alto = 120, color = "#2d6a3e", etiquetas, unidad = "", dec = 0 }) {
  const ancho = 340, mi = 26, base = alto - 18, max = Math.max(...valores) * 1.1;
  const w = (ancho - mi) / valores.length;
  const rects = valores.map((v, i) => {
    const h = (v / max) * (base - 14);
    return `<rect x="${mi + i * w + 2}" y="${base - h}" width="${w - 4}" height="${h}" fill="${color}"><title>${etiquetas[i]}: ${num(v, dec)} ${unidad}</title></rect>`
      + `<text x="${mi + i * w + w / 2}" y="${alto - 4}" text-anchor="middle">${etiquetas[i].slice(0, 1).toUpperCase()}</text>`;
  }).join("");
  const top = `<text x="0" y="12">${num(max / 1.1, dec)}</text><line x1="${mi}" x2="${ancho}" y1="${base}" y2="${base}" stroke="#9aa097"/>`;
  return `<svg class="grafica" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${valores.map((v, i) => `${etiquetas[i]} ${num(v, dec)} ${unidad}`).join(", ")}">${top}${rects}</svg>`;
}

export async function pintarClima(el) {
  el.innerHTML = `<p class="cargando">Cargando el clima…</p>`;
  let c;
  try { c = await cargar("clima.json"); } catch (e) { el.innerHTML = `<p>No se pudo leer el clima: ${esc(e.message)}</p>`; return; }
  const meses = Array.from({ length: 12 }, (_, i) => mesCorto(i));
  const p = c.power;
  el.innerHTML = `
  <fieldset class="grupo"><legend>Ahora en El Dorado (SKBO)</legend>
    <div id="metar" class="metar" aria-live="polite"><p class="cargando">Consultando el último parte…</p></div>
    <p class="detalle">Aeropuerto a ${num(c.metar.distancia_km, 1)} km del centro del lote ${marca("medido")}. Es el dato medido en vivo más cercano, no el clima del jardín.</p>
    <p class="detalle">Fuente: <a href="https://mesonet.agron.iastate.edu/" target="_blank" rel="noopener">${esc(c.metar.fuente)}</a>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Lluvia por mes</legend>
    <p class="detalle">Promedio ${esc(c.chirps.anios)} ${marca("de fuente")}. Estimación por satélite y estaciones en una ${esc(c.chirps.celda)}.</p>
    ${barras(c.chirps.climatologia, { etiquetas: meses, unidad: "mm", color: "#1f5f8b", dec: 0 })}
    <p class="detalle">Últimos 12 meses publicados, hasta ${MESES_LARGOS[+c.chirps.ultimo_mes.slice(5, 7) - 1]} de ${c.chirps.ultimo_mes.slice(0, 4)}:</p>
    ${barras(c.chirps.ultimos.map((x) => x[1]), { etiquetas: c.chirps.ultimos.map((x) => mesCorto(+x[0].slice(5) - 1)), unidad: "mm", color: "#5a86b2" })}
    <p class="detalle">Fuente: <a href="https://www.chc.ucsb.edu/data/chirps3" target="_blank" rel="noopener">${esc(c.chirps.fuente)}</a>, DOI ${esc(c.chirps.doi)}.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Sol que llega, según un modelo</legend>
    <p class="detalle">Radiación solar global de ${p.anio} por mes, en kWh/m² ${marca("supuesto")}. Es un modelo de satélite y reanálisis, no una medida en el jardín.</p>
    ${barras(p.radiacion_mensual, { etiquetas: meses, unidad: "kWh/m²", color: "#8a5a00", dec: 1 })}
    <ul class="cifras">
      <li><span class="que">Total del año</span><span class="valor">${num(p.radiacion_total, 1)} kWh/m² ${marca("supuesto")}</span></li>
      <li><span class="que">Promedio por día</span><span class="valor">${num(p.radiacion_diaria, 2)} kWh/m² ${marca("supuesto")}</span></li>
      <li><span class="que">Nubosidad media</span><span class="valor">${num(p.nubes_media, 1)} % ${marca("supuesto")}</span></li></ul>
    <p class="detalle">No se muestran la temperatura ni la lluvia de este modelo: su celda está a 1.790 m, unos 760 m más abajo que El Dorado (2.548 m). Punto: ${esc(p.punto)}.</p>
    <p class="detalle">Fuente: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">Datos obtenidos del proyecto POWER del NASA Langley Research Center, financiado por el programa NASA Earth Science/Applied Science</a>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Nubes vistas desde el espacio</legend>
    <div style="position:relative">
      <img class="imagen-nubes" src="datos/${esc(c.gibs.archivo)}" loading="lazy" width="480" height="432"
        alt="Imagen de satélite en color verdadero de la sabana de Bogotá el ${fecha(c.gibs.fecha)}; el jardín está en el centro, marcado con un círculo.">
      <span aria-hidden="true" style="position:absolute;left:50%;top:48%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #1c2620"></span>
    </div>
    <p class="detalle">MODIS Terra, ${fecha(c.gibs.fecha)}, ${esc(c.gibs.recuadro)} ${marca("de fuente")}. Es la imagen de ese día bajada al construir el visor, no una vista en vivo.</p>
    <p class="detalle">Fuente: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">${esc(c.gibs.fuente)}</a>.</p>
  </fieldset>
  ${rayado("Clima medido dentro del jardín", "No entra en esta demo. Lo medido más cercano es El Dorado; lo demás es estimación o modelo y así se marca.")}`;
  pintarMetar(c.metar);
}

async function pintarMetar(m) {
  const el = document.getElementById("metar");
  const pinta = (o, vivo) => {
    const t = fC(o.t_f), td = fC(o.td_f);
    const hr = humedad(t, td);
    const hora = new Date(o.utc).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    el.innerHTML = `<ul class="cifras">
      <li><span class="que">Temperatura</span><span class="valor">${num(t, 0)} °C ${marca("medido")}</span></li>
      <li><span class="que">Humedad relativa</span><span class="valor">${num(hr, 0)} % ${marca("inferido")}</span></li>
      <li><span class="que">Viento</span><span class="valor">${o.viento_kt == null ? "sin dato" : num(o.viento_kt * 1.852, 0) + " km/h"}</span></li>
      <li><span class="que">Parte</span><span class="valor">${esc(hora)}, hora de Bogotá</span></li></ul>
      <p class="detalle">${vivo ? "Consultado ahora." : `Sin conexión con el servicio: es la copia guardada al construir el visor.`} La humedad se calcula del punto de rocío.</p>
      <p class="detalle"><code>${esc(o.raw)}</code></p>`;
  };
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(m.url, { signal: ctl.signal });
    clearTimeout(to);
    const j = await r.json();
    const o = j.last_ob;
    if (!o || o["airtemp[F]"] == null) throw new Error("sin parte");
    pinta({ utc: o.utc_valid, raw: o.raw, t_f: o["airtemp[F]"], td_f: o["dewpointtemp[F]"], viento_kt: o["windspeed[kt]"] }, true);
  } catch {
    pinta(m.copia, false);
  }
}
