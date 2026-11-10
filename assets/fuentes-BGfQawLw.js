import{c as e,d as t,m as n,p as r,u as i}from"./index-DbXBbM-1.js";import{a,n as o,o as s,t as c}from"./marcas-ffQ6Sn29.js";var l=[[`Tropicario por dentro`,`Se conoce el contorno de cada cúpula y su altura de diseño, no qué plantas hay adentro ni dónde. Falta saber si lo construido cumple las alturas de 2015.`],[`Estado sanitario`,`Ni la colección ni el censo publican cómo está cada planta hoy.`],[`Procedencia silvestre`,`No se publica de dónde vino cada planta de la colección.`],[`Copa medida`,`El censo publica altura, no el diámetro de la copa. En 3D la copa es supuesta por tipo de árbol.`],[`Grosor del tronco`,`El censo no dice qué tan grueso es el tronco, así que lo dibujamos aproximado.`],[`Horizonte de los cerros`,`La sombra en 3D toma el horizonte plano. Los cerros orientales recortan algo de sol temprano; está por verificar.`]];async function u(u,d){u.innerHTML=`<p class="cargando">Cargando fuentes…</p>`;let f,p;try{[f,p]=await Promise.all([e(`cifras.json`),e(`licencias.json`)])}catch(e){u.innerHTML=`<p>No se pudo leer: ${i(e.message)}</p>`;return}let m=(e,t)=>/^https?:\/\//.test(e)?`<a href="${i(e)}" target="_blank" rel="noopener">${t}</a>`:t,h=p.fuentes.map(e=>`<li>${m(e.enlace,i(e.fuente))}, ${m(e.licencia_texto,i(e.licencia))}. ${i(e.uso||``)}
      <span class="detalle">Atribución: «${i(e.atribucion)}». Archivos: ${e.archivos.map(i).join(`, `)}${e.en_vivo?`, más la consulta en vivo`:``}. Licencia consultada el ${t(e.fecha_consulta)}.</span></li>`).join(``),g=d.base?.resumen?.inaturalist,_=d.base?.resumen?.censo?.por_borde?.lote,v=[[`el-jardin-botanico-lidera-la-arborizacion-y-mantenimiento-en-bogota`,`30 ene 2025`,`Unos 1,54 millones de árboles en el espacio público de Bogotá ${a(`arboles_ciudad_2025`)}`],[`jardin-botanico-bogota-avanza-en-plantacion-de-nuevos-arboles-urbanos`,`18 ene 2025`,`En 2024 el Jardín sembró 13.072 árboles ${a(`jbb_siembra_2024`)} y les hizo mantenimiento a 406.628 ${a(`jbb_mantenimiento_2024`)}`],[`el-jardin-botanico-de-bogota-jose-celestino-mutis-celebro-sus-70-anos`,`7 ago 2025`,`Lo fundó el padre Enrique Pérez Arbeláez el 6 de agosto de 1955 ${a(`jbb_fundacion`)}`]],y=f.cifras.map(e=>`<tr>
      <td><strong>${i(e.texto)}</strong><br><span class="detalle">${i(e.fuente)}${e.nota?`. `+i(e.nota[0].toUpperCase()+e.nota.slice(1)):``}. Calculado el ${t(e.fecha)}.</span></td>
      <td class="v">${i(e.valor)}</td><td>${a(e.clave)}</td></tr>`).join(``);u.innerHTML=`
  <fieldset class="grupo"><legend>Qué significa cada marca</legend>
    <ul class="cifras marcas">
      ${o.map(e=>`<li><span class="que">${s(e)}</span><span>${i(c[e][0].toUpperCase()+c[e].slice(1))}</span></li>`).join(``)}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Las cifras del visor</legend>
    <div class="envoltura-tabla"><table class="tabla-cifras">
      <thead><tr><th scope="col">Cifra</th><th scope="col">Valor</th><th scope="col">Marca</th></tr></thead>
      <tbody>${y}</tbody></table></div>
    <p class="detalle">Datos preparados el ${t(f.generado)} con guiones del equipo que no se publican con el visor. Cada archivo servido trae su fuente, el nombre de su guion, su versión y su sha256 en <code>datos/manifiesto.json</code>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que el Jardín hace por Bogotá</legend>
    <ul class="lista-jardin">${v.map(([e,t,n])=>`<li>${n}. <span class="detalle"><a href="https://bogota.gov.co/mi-ciudad/ambiente/${e}" target="_blank" rel="noopener">Alcaldía de Bogotá, bogota.gov.co</a>, ${t}. Licencia: por verificar.</span></li>`).join(``)}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Fuentes usadas</legend>
    <ul class="lista-fuentes">${h}</ul>
    ${p.pie_orto?`<p class="detalle">${i(p.pie_orto)}</p>`:``}
    ${p.pie?`<p class="detalle">${i(p.pie)}</p>`:``}
    <p class="detalle">La misma lista, legible por máquina, está en <a href="datos/licencias.json">datos/licencias.json</a>.</p>
    ${g?`<p class="detalle">iNaturalist, ${t(g.consultado)}: ${r(g.apta)} observaciones con licencia apta (CC0 ${r(g.cc0)}, CC BY ${r(g.ccby)}) y ${r(g.sin_licencia)} sin licencia ${a(`inat`)}.</p>`:``}
  </fieldset>

  <fieldset class="grupo"><legend>Cómo se arma el 3D</legend>
    <ul class="cifras">
      <li><span class="que">Posición y altura de cada árbol</span><span class="valor">${a(`arboles_censo`)}</span></li>
      <li><span class="que">Forma y tamaño de la copa, por tipo de árbol</span><span class="valor">${a(`copa`)}</span></li>
      <li><span class="que">Tipo de árbol según el nombre común</span><span class="valor">${a(`tipo_tabla`)} o ${a(`tipo_tabla_baja`)}</span></li>
      <li><span class="que">Altura de los edificios, pisos × 3 m</span><span class="valor">${a(`edificio_altura`)}</span></li>
      <li><span class="que">Huella de los edificios</span><span class="valor">${a(`huella_edificios`)}</span></li>
      <li><span class="que">Contorno de las cúpulas del Tropicario, calcado sobre la ortoimagen 2025</span><span class="valor">${a(`tropicario_contorno`)}</span></li>
      <li><span class="que">Altura de las cúpulas: de diseño (planos 2015); donde los planos dan dos cifras, la más baja</span><span class="valor">${a(`tropicario_altura`)}</span></li>
      <li><span class="que">Plantas útiles y colecciones especializadas: sin cota con su nombre en los planos, la altura se lee en el dibujo</span><span class="valor">${a(`tropicario_altura_dibujo`)}</span></li>
      <li><span class="que">Forma de casquete de las cúpulas</span><span class="valor">${a(`tropicario_forma`)}</span></li>
      <li><span class="que">Disco de cada zona</span><span class="valor">${a(`zona_disco`)}</span></li>
      <li><span class="que">Horas de sol por zona y mes</span><span class="valor">${a(`horas_sol`)}</span></li></ul>
    <p class="detalle">El tipo de árbol de cada nombre común sale de una tabla provisional de 279 nombres, un borrador sin revisión humana. Mientras nadie la revise, solo las palmas, las coníferas y los helechos arbóreos toman su forma; los demás árboles con especie van con la forma neutra y el color de identificado. La ficha marca el tipo inferido, o supuesto cuando la tabla dice certeza baja. Los árboles sin nombre en el censo de la ciudad van con una silueta neutra y gris.</p>
    ${_?`<p class="detalle">En el censo de arbolado, ${r(_.sin_id)} de los ${r(_.n)} árboles del lote figuran como NN u Otro. Son registros de la ciudad, no de la colección viva.</p>`:``}
  </fieldset>

  ${d.lagos?.length?`<fieldset class="grupo"><legend>Lagos calcados</legend>
    <p class="detalle">Ficha de cada lago, con su orilla calcada sobre la ortoimagen 2025 ${a(`orilla_calcada`)}.</p>
    <ul class="lista-lagos">${d.lagos.map(e=>`<li><button type="button" class="enlace-boton" data-lago="${i(e.id)}">${i(e.nombre)}</button></li>`).join(``)}</ul>
  </fieldset>`:``}

  <fieldset class="grupo"><legend>Lo que no se usó y por qué</legend>
    <ul class="lista-fuentes">${p.no_usadas.map(e=>`<li><strong>${i(e.fuente)}.</strong> ${i(e.motivo)}</li>`).join(``)}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que falta por saber</legend>
    ${l.map(([e,t])=>n(e,t)).join(``)}
  </fieldset>

  <fieldset class="grupo"><legend>Lo que este visor no es</legend>
    <p>Es una demo independiente con datos abiertos. No es un sitio del Jardín Botánico ni habla por él.</p>
    <p>Complementa el <a href="https://geoportal.jbb.gov.co/" target="_blank" rel="noopener">Geoportal Bosques Urbanos</a>, no lo reemplaza: para consultar el arbolado de la ciudad, ese es el lugar.</p>
    <p class="detalle">Las posiciones exactas de las plantas amenazadas y extintas en estado silvestre no se publican aquí; se muestran solo agregadas por zona. Ninguna de ellas se usa para ubicar los círculos de las zonas. Algunas plantas de la colección tampoco llevan punto porque están cerca de una amenazada. Árboles del censo SIGAU tal como los publica la ciudad, menos los robles (Quercus humboldtii): son una especie amenazada y por eso solo se cuentan, no se dibujan. El visor no marca cuáles están cerca de plantas amenazadas. Un guion de la build comprueba las tres cosas: que ninguna amenazada tenga punto, que ningún roble tenga punto y que el resto del censo sea el mismo que publica la ciudad, sin nada de la colección.</p>
  </fieldset>`}export{u as pintarFuentes};