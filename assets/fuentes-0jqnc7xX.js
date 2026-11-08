import{c as e,d as t,h as n,m as r,p as i,u as a}from"./index-d3x25gXC.js";var o=[[`Tropicario por dentro`,`Se conoce el contorno de cada cúpula y su altura de diseño, no qué plantas hay adentro ni dónde. Falta saber si lo construido cumple las alturas de 2015.`],[`Estado sanitario`,`Ni la colección ni el censo publican cómo está cada planta hoy.`],[`Procedencia silvestre`,`No se publica de dónde vino cada accesión.`],[`Copa medida`,`El censo publica altura, no el diámetro de la copa. En 3D la copa es supuesta por tipo de árbol.`],[`Diámetro del tronco`,`El censo abierto no trae el DAP. El tronco en 3D también es supuesto.`],[`Horizonte de los cerros`,`La sombra en 3D toma el horizonte plano. Los cerros orientales recortan algo de sol temprano; está por verificar.`]];async function s(s,c){s.innerHTML=`<p class="cargando">Cargando fuentes…</p>`;let l,u;try{[l,u]=await Promise.all([e(`cifras.json`),e(`licencias.json`)])}catch(e){s.innerHTML=`<p>No se pudo leer: ${a(e.message)}</p>`;return}let d=(e,t)=>/^https?:\/\//.test(e)?`<a href="${a(e)}" target="_blank" rel="noopener">${t}</a>`:t,f=u.fuentes.map(e=>`<li>${d(e.enlace,a(e.fuente))}, ${d(e.licencia_texto,a(e.licencia))}. ${a(e.uso||``)}
      <span class="detalle">Atribución: «${a(e.atribucion)}». Archivos: ${e.archivos.map(a).join(`, `)}${e.en_vivo?`, más la consulta en vivo`:``}. Licencia consultada el ${t(e.fecha_consulta)}.</span></li>`).join(``),p=c.base?.resumen?.inaturalist,m=l.cifras.map(e=>`<tr>
      <td><strong>${a(e.texto)}</strong><br><span class="detalle">${a(e.fuente)}${e.nota?`. `+a(e.nota[0].toUpperCase()+e.nota.slice(1)):``}. Calculado el ${t(e.fecha)}.</span></td>
      <td class="v">${a(e.valor)}</td><td>${i(e.marca)}</td></tr>`).join(``);s.innerHTML=`
  <fieldset class="grupo"><legend>Qué significa cada marca</legend>
    <ul class="cifras marcas">
      <li><span class="que">${i(`medido`)}</span><span>Lo calculamos con la geometría o el dato abierto.</span></li>
      <li><span class="que">${i(`de fuente`)}</span><span>Lo dice la fuente tal cual.</span></li>
      <li><span class="que">${i(`inferido`)}</span><span>Sale de cruzar dos fuentes.</span></li>
      <li><span class="que">${i(`supuesto`)}</span><span>Es un modelo o una hipótesis, no una medida.</span></li></ul>
  </fieldset>

  <fieldset class="grupo"><legend>Las cifras del visor</legend>
    <div class="envoltura-tabla"><table class="tabla-cifras">
      <thead><tr><th scope="col">Cifra</th><th scope="col">Valor</th><th scope="col">Marca</th></tr></thead>
      <tbody>${m}</tbody></table></div>
    <p class="detalle">Datos preparados el ${t(l.generado)} con guiones del equipo que no se publican con el visor. Cada archivo servido trae su fuente, el nombre de su guion, su versión y su sha256 en <code>datos/manifiesto.json</code>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Fuentes usadas</legend>
    <ul class="lista-fuentes">${f}</ul>
    ${u.pie_orto?`<p class="detalle">${a(u.pie_orto)}</p>`:``}
    ${u.pie?`<p class="detalle">${a(u.pie)}</p>`:``}
    <p class="detalle">La misma lista, legible por máquina, está en <a href="datos/licencias.json">datos/licencias.json</a>.</p>
    ${p?`<p class="detalle">iNaturalist, ${t(p.consultado)}: ${r(p.apta)} observaciones con licencia apta (CC0 ${r(p.cc0)}, CC BY ${r(p.ccby)}) y ${r(p.sin_licencia)} sin licencia ${i(`de fuente`)}.</p>`:``}
  </fieldset>

  <fieldset class="grupo"><legend>Cómo se arma el 3D</legend>
    <ul class="cifras">
      <li><span class="que">Posición y altura de cada árbol</span><span class="valor">${i(`de fuente`)}</span></li>
      <li><span class="que">Forma y tamaño de la copa, por tipo de árbol</span><span class="valor">${i(`supuesto`)}</span></li>
      <li><span class="que">Tipo de árbol según el nombre común</span><span class="valor">${i(`inferido`)} o ${i(`supuesto`)}</span></li>
      <li><span class="que">Altura de los edificios, pisos × 3 m</span><span class="valor">${i(`supuesto`)}</span></li>
      <li><span class="que">Huella de los edificios</span><span class="valor">${i(`medido`)}</span></li>
      <li><span class="que">Contorno de las cúpulas del Tropicario, calcado sobre la ortoimagen 2025</span><span class="valor">${i(`medido`)}</span></li>
      <li><span class="que">Altura de las cúpulas: de diseño (planos 2015); donde los planos dan dos cifras, la más baja</span><span class="valor">${i(`de fuente`)}</span></li>
      <li><span class="que">Plantas útiles y colecciones especializadas: sin cota con su nombre en los planos, la altura se lee en el dibujo</span><span class="valor">${i(`inferido`)}</span></li>
      <li><span class="que">Forma de casquete de las cúpulas</span><span class="valor">${i(`supuesto`)}</span></li>
      <li><span class="que">Disco de cada zona</span><span class="valor">${i(`inferido`)}</span></li>
      <li><span class="que">Horas de sol por zona y mes</span><span class="valor">${i(`supuesto`)}</span></li></ul>
    <p class="detalle">El tipo de árbol de cada nombre común sale de una tabla provisional de 279 nombres, un borrador sin revisión humana. Mientras nadie la revise, solo las palmas, las coníferas y los helechos arbóreos toman su forma; los demás árboles con especie van con la forma neutra y el color de identificado. La ficha marca el tipo inferido, o supuesto cuando la tabla dice certeza baja. NN y «Otro» van con una silueta neutra y gris.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que no se usó y por qué</legend>
    <ul class="lista-fuentes">${u.no_usadas.map(e=>`<li><strong>${a(e.fuente)}.</strong> ${a(e.motivo)}</li>`).join(``)}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que falta por saber</legend>
    ${o.map(([e,t])=>n(e,t)).join(``)}
  </fieldset>

  <fieldset class="grupo"><legend>Lo que este visor no es</legend>
    <p>Es una demo independiente con datos abiertos. No es un sitio del Jardín Botánico ni habla por él.</p>
    <p>Complementa el <a href="https://geoportal.jbb.gov.co/" target="_blank" rel="noopener">Geoportal Bosques Urbanos</a>, no lo reemplaza: para consultar el arbolado de la ciudad, ese es el lugar.</p>
    <p class="detalle">Las posiciones exactas de las plantas amenazadas y extintas en estado silvestre no se publican aquí; se muestran solo agregadas por zona. Ninguna de ellas se usa para ubicar los círculos de las zonas. Algunas plantas de la colección tampoco llevan punto porque están cerca de una amenazada. Árboles del censo SIGAU tal como los publica la ciudad. El visor no marca cuáles están cerca de plantas amenazadas. Un guion de la build comprueba las dos cosas: que ninguna amenazada tenga punto y que el censo sea el mismo que publica la ciudad, sin nada de la colección.</p>
  </fieldset>`}export{s as pintarFuentes};