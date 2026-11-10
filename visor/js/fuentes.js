// Fuentes y método: cada cifra con su marca, fuente y fecha; lo que no se usó y por qué; lo que falta.
import { cargar, num, fecha, marca, marcaTipo, esc, rayado } from "./util.js";

const DA = "https://datosabiertos.bogota.gov.co/dataset/";
const FUENTES = [
  ["Lotes, Catastro Bogotá (UAECD)", "CC BY 4.0", DA + "lote", "Borde oficial: lote 005506001044."],
  ["Sistema Distrital de Parques, IDRD", "CC BY 4.0", DA + "sistema-distrital-de-parques-y-escenarios-publicos-deportivos", "Borde alterno (parque 10-291) y los 19 sectores del Simón Bolívar."],
  ["Construcciones, Catastro Bogotá (UAECD)", "CC BY 4.0", DA + "construccion", "Huellas y pisos para la sombra en 3D y la huella del Tropicario."],
  ["Mapa de Referencia IDECA, Catastro Bogotá", "CC BY 4.0", DA + "mapa-de-referencia", "Calzadas alrededor del jardín, como contexto."],
  ["Colecciones vivas, Jardín Botánico José Celestino Mutis", "CC BY 4.0", DA + "colecciones-vivas-bogota-d-c", "Accesiones, zonas y categorías de amenaza."],
  ["Censo del arbolado urbano (SIGAU), Jardín Botánico José Celestino Mutis", "CC BY 4.0", DA + "censo-arbolado-urbano", "Árboles del censo, altura registrada y fecha del registro."],
  ["METAR SKBO vía Iowa Environmental Mesonet, Iowa State University", "uso libre con crédito", "https://mesonet.agron.iastate.edu/", "Último parte de El Dorado, consultado en vivo."],
  ["CHIRPS v3, Climate Hazards Center, UC Santa Barbara", "CC BY 4.0", "https://www.chc.ucsb.edu/data/chirps3", "Lluvia mensual estimada."],
  ["NASA POWER, NASA Langley Research Center", "uso libre con crédito", "https://power.larc.nasa.gov/", "Radiación y nubosidad modeladas."],
  ["NASA GIBS (MODIS Terra)", "uso libre con crédito", "https://earthdata.nasa.gov/gibs", "Imagen de nubes del día de la construcción."],
  ["iNaturalist", "solo conteos", "https://www.inaturalist.org/observations?place_id=170214", "Cuántas observaciones tienen licencia apta. No se copia ninguna."],
  ["Algoritmo solar de la NOAA", "dominio público", "https://gml.noaa.gov/grad/solcalc/calcdetails.html", "Posición del sol para el 3D y los días de sol cenital."],
];

const NO_USADO = [
  ["ERA5 y Open-Meteo", "Fuera de esta demo por decisión de alcance y de licencia de uso."],
  ["Conjuntos del Jardín en GBIF con licencia no comercial", "Esta demo deja fuera todo dato con licencia no comercial."],
  ["Observaciones de iNaturalist sin licencia", "Se cuentan y se enlazan, no se copian."],
  ["OpenStreetMap", "Ninguna geometría de OSM entra en los cálculos ni en el mapa."],
  ["Ortoimagen urbana 2025 de IDECA (CC BY 4.0)", "Era la base prevista. El servicio respondió con error al probarlo, así que el mapa va sin fondo y lo avisa."],
];

const HUECOS = [
  ["Tropicario por dentro", "Se conoce la huella del edificio, no qué plantas hay adentro ni dónde."],
  ["Estado sanitario", "Ni la colección ni el censo publican cómo está cada planta hoy."],
  ["Procedencia silvestre", "No se publica de dónde vino cada accesión."],
  ["Copa medida", "El censo publica altura, no el diámetro de la copa. En 3D la copa es un supuesto."],
  ["Horizonte de los cerros", "La sombra en 3D toma el horizonte plano. Los cerros orientales recortan algo de sol temprano; está por verificar."],
];

export async function pintarFuentes(el, estado) {
  el.innerHTML = `<p class="cargando">Cargando fuentes…</p>`;
  let d;
  try { d = await cargar("cifras.json"); } catch (e) { el.innerHTML = `<p>No se pudo leer: ${esc(e.message)}</p>`; return; }
  const ina = estado.base?.resumen?.inaturalist;
  const filas = d.cifras.map((c) => `<tr>
      <td><strong>${esc(c.texto)}</strong><br><span class="detalle">${esc(c.fuente)}${c.nota ? ". " + esc(c.nota[0].toUpperCase() + c.nota.slice(1)) : ""}. Calculado el ${fecha(c.fecha)}.</span></td>
      <td class="v">${esc(c.valor)}</td><td>${marcaTipo(c.marca)}</td></tr>`).join("");
  el.innerHTML = `
  <fieldset class="grupo"><legend>Qué significa cada marca</legend>
    <ul class="cifras marcas">
      <li><span class="que">${marcaTipo("medido")}</span><span>Lo calculamos con la geometría o el dato abierto.</span></li>
      <li><span class="que">${marcaTipo("de fuente")}</span><span>Lo dice la fuente tal cual.</span></li>
      <li><span class="que">${marcaTipo("inferido")}</span><span>Sale de cruzar dos fuentes.</span></li>
      <li><span class="que">${marcaTipo("supuesto")}</span><span>Es un modelo o una hipótesis, no una medida.</span></li></ul>
  </fieldset>

  <fieldset class="grupo"><legend>Las cifras del visor</legend>
    <div class="envoltura-tabla"><table class="tabla-cifras">
      <thead><tr><th scope="col">Cifra</th><th scope="col">Valor</th><th scope="col">Marca</th></tr></thead>
      <tbody>${filas}</tbody></table></div>
    <p class="detalle">Datos preparados el ${fecha(d.generado)} con guiones del equipo que no se publican con el visor.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Fuentes usadas</legend>
    <ul class="lista-fuentes">${FUENTES.map(([n, l, u, para]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>, ${esc(l)}. ${esc(para)}</li>`).join("")}</ul>
    ${ina ? `<p class="detalle">iNaturalist, ${fecha(ina.consultado)}: ${num(ina.apta)} observaciones con licencia apta (CC0 ${num(ina.cc0)}, CC BY ${num(ina.ccby)}) y ${num(ina.sin_licencia)} sin licencia ${marcaTipo("de fuente")}.</p>` : ""}
  </fieldset>

  <fieldset class="grupo"><legend>Lo que no se usó y por qué</legend>
    <ul class="lista-fuentes">${NO_USADO.map(([n, p]) => `<li><strong>${esc(n)}.</strong> ${esc(p)}</li>`).join("")}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que falta por saber</legend>
    ${HUECOS.map(([t, x]) => rayado(t, x)).join("")}
  </fieldset>

  <fieldset class="grupo"><legend>Lo que este visor no es</legend>
    <p>Es una demo independiente con datos abiertos. No es un sitio del Jardín Botánico ni habla por él.</p>
    <p>Complementa el <a href="https://geoportal.jbb.gov.co/" target="_blank" rel="noopener">Geoportal Bosques Urbanos</a>, no lo reemplaza: para consultar el arbolado de la ciudad, ese es el lugar.</p>
    <p class="detalle">Las posiciones exactas de las plantas amenazadas y extintas en estado silvestre no se publican aquí; se muestran solo agregadas por zona. Ninguna de ellas se usa para ubicar los círculos de las zonas. Algunos árboles no se dibujan para proteger especies sensibles. Lo mismo pasa con el punto de algunas plantas de la colección. Un guion de la build lo comprueba.</p>
  </fieldset>`;
}
