// Marcas de procedencia: una sola fuente para el 3D, las proyecciones y el plano 2D.
// Plan de pedagogía, ítems 1.1 y 1.2 (decisiones D10, D12 y D13 del plan).
//
// Qué hay aquí:
//   TIPOS        las cuatro marcas públicas. «por verificar» no es marca pública (D10).
//   DICCIONARIO  la definición de una línea de cada marca. Es el único texto de definición del sitio.
//   CIFRAS       la tabla de marca por cifra: id → { marca, nota }. La nota dice qué se contó y sobre qué
//                dato (medido, D12) o qué ingrediente es supuesto (inferido, D13). Ningún otro lugar decide
//                la marca de una cifra: se pide por su id.
//   marca(id)    devuelve el botón de la marca de esa cifra, como texto HTML.
//   marcaTipo(t) la marca sola, sin cifra; solo para la clave de las marcas (Fuentes, recorrido).
//   activarMarcas(raiz)  un oyente delegado: al tocar una marca abre o cierra su explicación debajo.
//
// Sin dependencias y sin DOM al importar: se puede importar desde el navegador o desde Node (la prueba del
// armado, build/comprobar_marcas.mjs, lee esta misma tabla) y se puede copiar tal cual a otra página.
//
// Regla para elegir marca (la cierra el verificador):
//   medido     contar o calcular directo sobre un dato abierto, sin modelo: conteos, puntos dentro de un
//              borde, áreas, distancias, porcentajes de dos conteos. Nadie fue a medirlo al sitio.
//   de fuente  el valor lo trae el documento o la base tal cual.
//   inferido   hay un modelo o una lectura de por medio. Si lleva un ingrediente supuesto, la nota lo nombra.
//   supuesto   lo pusimos porque falta el dato.

export const TIPOS = ["medido", "de fuente", "inferido", "supuesto"];

export const DICCIONARIO = {
  "medido": "lo contamos o calculamos directo sobre un dato abierto; nadie fue a medirlo al sitio.",
  "de fuente": "lo dice un documento o una base que citamos.",
  "inferido": "sale de cruzar datos o de un modelo con datos.",
  "supuesto": "lo pusimos nosotros porque falta el dato.",
};

const m = (marca, nota) => ({ marca, nota });

export const CIFRAS = {
  // ---------- censo de árboles de la ciudad ----------
  cen_lote: m("medido", "Contamos los árboles del censo de la ciudad cuyo punto cae dentro del lote de Catastro."),
  cen_idrd: m("medido", "Contamos los árboles del censo cuyo punto cae dentro del parque del Distrito."),
  cen_sinid_lote: m("medido", "Contamos los árboles del lote que el censo marca NN (no se identificó) u Otro (no está en su lista de especies)."),
  cen_sinid_idrd: m("medido", "Contamos los árboles del parque que el censo marca NN u Otro."),
  cen_dibujados_lote: m("medido", "Contamos los árboles que dibuja el visor frente a los del censo en el lote: solo faltan los robles, que son una especie amenazada y por eso se cuentan sin dibujarse."),
  cen_dibujados: m("medido", "Contamos los árboles que dibuja el visor frente a los del censo dentro del borde elegido: solo faltan los robles, que son una especie amenazada y por eso se cuentan sin dibujarse."),
  cen_dibujados_plano: m("medido", "Contamos los árboles que dibuja el plano frente a los del censo dentro del borde elegido; algunos no se dibujan para proteger especies sensibles, y los robles, especie amenazada, solo se cuentan."),
  cen_altos_lote: m("medido", "Contamos los árboles del lote con 15 m o más de altura en el censo."),
  cen_altura: m("medido", "Promedio de la altura que registra el censo para cada árbol del parque."),
  cen_fechas: m("de fuente", "Son la primera y la última fecha de registro que trae el censo."),
  cen_ciudad: m("de fuente", "Es el total de árboles que publica el censo de la ciudad."),
  cen_ficha: m("de fuente", "Es la fecha de la última modificación que muestra la ficha del censo en el portal de datos."),
  dens: m("medido", "Dividimos los árboles del censo en el sector entre el área del sector."),
  dens_sig: m("medido", "La misma cuenta, árboles entre área, para el sector que sigue en densidad."),
  arbol_nombre: m("de fuente", "Es el nombre común que escribió el censo para este árbol."),
  arbol_ident: m("de fuente", "El censo marca cada árbol como identificado, NN u Otro."),
  altura_censo: m("de fuente", "Es la altura que registró el censo para este árbol, sin medirla de nuevo."),
  arbol_fecha: m("de fuente", "Es la última actualización de este árbol en el censo."),
  arboles_censo: m("de fuente", "La posición y la altura de cada árbol salen del censo de la ciudad tal como lo publica."),
  copa: m("supuesto", "El censo publica la altura, no el ancho de la copa; la copa la ponemos según el tipo de árbol."),
  tipo_neutro: m("supuesto", "Sin especie no hay tipo de árbol: se dibuja una silueta neutra."),
  tipo_regla: m("supuesto", "El nombre común no está en nuestra tabla; se usa una regla provisional."),
  tipo_tabla: m("inferido", "Leemos el tipo de árbol en una tabla de nombres comunes que armamos nosotros y nadie ha revisado aún."),
  tipo_tabla_baja: m("supuesto", "La tabla de nombres comunes duda de este nombre: el tipo de árbol queda como supuesto."),

  // ---------- colección viva del Jardín ----------
  col_puntos: m("de fuente", "Es el total de registros que trae la colección viva que publica el Jardín."),
  col_ids: m("medido", "Contamos los números de accesión distintos; cuatro se repiten."),
  col_nombres: m("medido", "Contamos los nombres de planta distintos en la colección viva."),
  col_familias: m("medido", "Contamos las familias distintas; dos aparecen escritas de dos maneras y se cuentan una vez."),
  col_zonas: m("medido", "Contamos las zonas de la colección que tienen al menos una planta."),
  col_fecha: m("de fuente", "Es la fecha de carga del conjunto, la misma para todas las accesiones; no dice desde cuándo está la planta."),
  col_amen: m("medido", "Contamos las accesiones con categoría CR, EN o VU en la colección viva."),
  col_ne: m("medido", "Contamos las accesiones con categoría NE, no evaluada."),
  col_lote: m("medido", "Contamos las accesiones cuyo punto cae dentro del lote de Catastro."),
  col_amen_lote: m("medido", "Contamos las accesiones amenazadas cuyo punto cae dentro del lote."),
  col_idrd: m("medido", "Contamos las accesiones cuyo punto cae dentro del parque del Distrito."),
  col_dentro: m("medido", "Contamos las accesiones cuyo punto cae dentro del borde elegido."),
  col_amen_dentro: m("medido", "Contamos las accesiones amenazadas cuyo punto cae dentro del borde elegido; no se dice dónde está cada una."),
  col_zona_n: m("de fuente", "Las accesiones de cada zona, tal como las publica la colección viva del Jardín."),
  col_zona_amen: m("medido", "Contamos por zona las accesiones con categoría CR, EN o VU; el visor no muestra su punto."),
  zona_n: m("medido", "Contamos las accesiones de esta zona en la colección viva."),
  zona_nombres: m("medido", "Contamos los nombres de planta distintos de esta zona."),
  zona_familias: m("medido", "Contamos las familias distintas de esta zona."),
  zona_amen: m("medido", "Contamos las accesiones de esta zona con categoría CR, EN o VU."),
  zona_ne: m("medido", "Contamos las accesiones de esta zona con categoría NE."),
  zona_lote: m("medido", "Contamos las accesiones de esta zona cuyo punto cae dentro del lote."),
  zona_disco: m("inferido", "El dato no trae el borde de la zona: el disco va en la mediana de sus plantas y crece con el número de accesiones."),
  zona_punto: m("inferido", "El dato no trae el borde de la zona: en el plano, el punto va en la mediana de sus plantas que se pueden mostrar, sin usar ninguna amenazada."),
  acc_coord: m("de fuente", "Son las coordenadas que trae el registro de esta accesión."),
  acc_familia: m("de fuente", "Es la familia que trae el registro de esta accesión."),
  acc_categoria: m("de fuente", "Es la categoría de amenaza que trae el registro de esta accesión."),
  dentro: m("medido", "Miramos si el punto del registro cae dentro del lote de Catastro y del parque del Distrito."),
  inat: m("de fuente", "Es el conteo de observaciones que da hoy iNaturalist; cambia a diario."),

  // ---------- sol ----------
  horas_sol: m("inferido", "Sale de la posición del sol y de la sombra de edificios y copas. Usa una copa supuesta por tipo de árbol, edificios de pisos × 3 m, cielo despejado y suelo plano."),
  horizonte_plano: m("supuesto", "Tomamos el suelo plano: en este cálculo los cerros no tapan el sol."),
  realce_sombra: m("supuesto", "Con el realce, la sombra se pinta como si el cielo estuviera despejado."),
  luz_dia_medio: m("inferido", "La luz de un día medio del mes sale de un modelo del clima por satélite; no se midió en el Jardín."),
  cenital: m("inferido", "Sale de la fórmula de la posición del sol para la latitud de Bogotá."),

  // ---------- lluvia y clima ----------
  chirps_mes: m("de fuente", "Es el promedio por mes que publica un conjunto de lluvia por satélite y estaciones para la celda del Jardín."),
  temporadas: m("inferido", "Lo leemos en las barras de lluvia por mes; la fuente no lo dice."),
  lluvia_hora: m("medido", "Contamos, hora por hora, los reportes del aeropuerto El Dorado de 2016 a 2025 que traen lluvia."),
  skbo: m("medido", "Distancia en línea recta desde el centro del lote de Catastro hasta el aeropuerto."),
  metar_temp: m("medido", "La mide el aeropuerto El Dorado; la leemos en su último reporte."),
  humedad: m("medido", "La calculamos con la temperatura y el punto de rocío del mismo reporte del aeropuerto."),
  era5_rad: m("inferido", "Sale de un modelo del clima, promedio de 1991 a 2020; no se ha comparado con medidas en Bogotá."),
  era5_nub: m("inferido", "Sale del mismo modelo del clima, promedio de 1991 a 2020; no se ha comparado con medidas en Bogotá."),
  power_rad: m("inferido", "Sale de un modelo de satélite y reanálisis para la celda del Jardín, año 2025; no se midió en el Jardín."),
  power_nub: m("inferido", "Sale del mismo modelo de satélite y reanálisis, año 2025; no se midió en el Jardín."),
  nubes_imagen: m("de fuente", "Es la imagen de satélite de ese día tal como la publica el servicio de imágenes; no es una vista en vivo."),
  escorrentia: m("inferido", "Sale de un método de cálculo con el piso sellado que se ve y la lluvia del año; usa dos coeficientes supuestos."),
  coef_rv: m("supuesto", "Es el coeficiente del método para la parte sellada; nadie lo midió en el lote."),
  coef_pj: m("supuesto", "Es la parte de la lluvia del año que el método toma como capaz de correr; no se midió."),
  lluvia_anual: m("de fuente", "Es la lluvia media del año en la celda del Jardín, según el conjunto de lluvia por satélite."),

  // ---------- lugar, bordes y terreno ----------
  area_lote: m("medido", "Calculamos el área del polígono del lote que publica Catastro."),
  area_idrd: m("medido", "Calculamos el área del polígono del parque que publica el Distrito."),
  sb_area: m("medido", "Sumamos el área de los 19 sectores del parque Simón Bolívar."),
  borde: m("de fuente", "Es el polígono que publica Catastro, o el del parque del Distrito; lo dibujamos tal cual."),
  borde_area: m("medido", "Calculamos el área del borde elegido sobre su polígono."),
  entradas: m("medido", "Ubicamos las entradas y la plazoleta sobre la ortoimagen 2025 de la ciudad."),
  escultura: m("de fuente", "Su posición sale del mapa de referencia de la ciudad."),
  edificio_altura: m("supuesto", "Catastro da los pisos, no la altura: ponemos 3 m por piso."),
  huella_edificios: m("de fuente", "Es la huella de cada construcción tal como la publica Catastro."),
  con_dentro: m("medido", "Contamos las construcciones de Catastro con el centro dentro del lote y sumamos su área."),
  trop: m("medido", "Calculamos el área de la huella del Tropicario en Catastro, con y sin patios."),
  techos_calcados: m("medido", "Los calcamos sobre la ortoimagen 2025; la foto no da su altura."),
  techo_area: m("medido", "Calculamos el área del techo calcado sobre la ortoimagen 2025."),
  orilla_calcada: m("medido", "Calcamos la orilla del agua sobre la ortoimagen 2025."),
  orilla_bajo_copa: m("inferido", "Donde la copa tapa el agua, unimos la orilla vista con una línea: en la foto no se ve."),
  lago_area: m("medido", "Calculamos el área del espejo de agua calcado sobre la ortoimagen 2025."),
  lago_agua_libre: m("medido", "Medimos en la foto qué parte del espejo se ve sin plantas encima."),
  lago_orilla: m("medido", "Medimos el largo de la orilla calcada."),
  calco_error: m("medido", "Calcamos dos veces los mismos estanques y medimos cuánto se corrió la orilla."),
  calcos: m("medido", "Orillas, techos, piso duro y borde de la plazoleta, calcados y medidos sobre la ortoimagen 2025."),
  piso_visto: m("medido", "Contamos el piso duro que se ve en la ortoimagen 2025, en píxeles de 20 cm."),
  piso_area: m("medido", "Contamos el piso duro visto en la ortoimagen 2025, en píxeles de 20 cm."),
  superficie_2025: m("medido", "Contamos píxeles de 20 cm de la ortoimagen 2025, clasificados por lo que se ve desde arriba."),
  lote_pixeles: m("medido", "Contamos el lote en píxeles de 20 cm; por eso difiere un poco del área de Catastro."),
  sellado: m("medido", "Sumamos techos y piso duro vistos desde arriba; el rango sale de las dos clasificaciones."),
  curvas: m("de fuente", "Las curvas salen del modelo de terreno 2025 de la ciudad."),
  lote_altura: m("medido", "Leemos la menor y la mayor altura del terreno dentro del lote en ese modelo."),

  // ---------- Tropicario ----------
  tropicario_contorno: m("medido", "Calcamos el contorno de cada cúpula sobre la ortoimagen 2025."),
  tropicario_altura: m("de fuente", "Sale de los planos de diseño de 2015, no de una medida del edificio construido."),
  tropicario_altura_dibujo: m("inferido", "Los planos no traen la cota con su nombre: la leemos en el dibujo."),
  tropicario_forma: m("supuesto", "Dibujamos cada cúpula como un casquete; los planos no dan la forma completa."),
  tropicario_nombres: m("de fuente", "Los nombres de las salas salen de los planos de diseño."),
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clase = (tipo) => tipo.replace(" ", "-");
const boton = (tipo, id, texto, dice) =>
  `<button type="button" class="marca ${clase(tipo)}" data-marca="${tipo}"${id ? ` data-cifra="${id}"` : ""}${dice ? ` data-dice="${esc(dice)}"` : ""} aria-expanded="false">${esc(texto)}</button>`;

/** El botón de la marca de una cifra. `id` es una clave de CIFRAS; si no está, avisa en consola y no pinta nada. */
export function marca(id, { texto } = {}) {
  const c = CIFRAS[id];
  if (!c) { console.error(`marca: la cifra «${id}» no está en la tabla de marcas`); return ""; }
  return boton(c.marca, id, texto ?? c.marca);
}

/** La marca sola, sin cifra: para la clave que explica las cuatro marcas y, mientras sus cifras no estén en la
 *  tabla, para el árbol de las proyecciones. `dice` cambia la explicación general por una propia (la fuente exacta). */
export function marcaTipo(tipo, { texto, dice } = {}) {
  if (!TIPOS.includes(tipo)) { console.error(`marcaTipo: «${tipo}» no es una marca`); return ""; }
  return boton(tipo, null, texto ?? tipo, dice);
}

/** Tipo de marca de una cifra, o null. */
export const marcaDe = (id) => CIFRAS[id]?.marca ?? null;

/** Texto que se abre al tocar: la definición y, si es una cifra, qué se contó o qué supuesto lleva. */
export function explicacion(tipo, id) {
  const def = DICCIONARIO[tipo];
  const nota = id && CIFRAS[id] ? ` ${CIFRAS[id].nota}` : "";
  return `<strong>${esc(tipo[0].toUpperCase() + tipo.slice(1))}</strong>: ${esc(def)}${nota ? `<br>${esc(nota.trim())}` : ""}`;
}

const raices = new WeakSet();
/** Un oyente delegado en `raiz` (por defecto el documento). Se puede llamar varias veces sin duplicar. */
export function activarMarcas(raiz = document) {
  if (raices.has(raiz)) return;
  raices.add(raiz);
  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest?.("button.marca");
    if (!b) return;
    ev.preventDefault(); // dentro de un label no debe marcar la casilla
    ev.stopPropagation();
    const abierta = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!abierta));
    let dice = b.nextElementSibling?.classList.contains("marca-dice") ? b.nextElementSibling : null;
    if (!dice) {
      dice = document.createElement("span");
      dice.className = "marca-dice";
      dice.id = `marca-dice-${Math.random().toString(36).slice(2, 9)}`;
      if (b.dataset.dice) dice.textContent = b.dataset.dice; else dice.innerHTML = explicacion(b.dataset.marca, b.dataset.cifra);
      b.setAttribute("aria-controls", dice.id);
      b.after(dice);
    }
    dice.hidden = abierta;
  });
}
