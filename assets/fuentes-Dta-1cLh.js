import{f as e,h as t,l as n,m as r,s as i,u as a}from"./index-CsDWIkbi.js";var o=[[`Tropicario por dentro`,`Se conoce la huella del edificio, no qué plantas hay adentro ni dónde.`],[`Estado sanitario`,`Ni la colección ni el censo publican cómo está cada planta hoy.`],[`Procedencia silvestre`,`No se publica de dónde vino cada accesión.`],[`Copa medida`,`El censo publica altura, no el diámetro de la copa. En 3D la copa es supuesta por tipo de árbol.`],[`Diámetro del tronco`,`El censo abierto no trae el DAP. El tronco en 3D también es supuesto.`],[`Horizonte de los cerros`,`La sombra en 3D toma el horizonte plano. Los cerros orientales recortan algo de sol temprano; está por verificar.`]];async function s(s,c){s.innerHTML=`<p class="cargando">Cargando fuentes…</p>`;let l,u;try{[l,u]=await Promise.all([i(`cifras.json`),i(`licencias.json`)])}catch(e){s.innerHTML=`<p>No se pudo leer: ${n(e.message)}</p>`;return}let d=(e,t)=>/^https?:\/\//.test(e)?`<a href="${n(e)}" target="_blank" rel="noopener">${t}</a>`:t,f=u.fuentes.map(e=>`<li>${d(e.enlace,n(e.fuente))}, ${d(e.licencia_texto,n(e.licencia))}. ${n(e.uso||``)}
      <span class="detalle">Atribución: «${n(e.atribucion)}». Archivos: ${e.archivos.map(n).join(`, `)}${e.en_vivo?`, más la consulta en vivo`:``}. Licencia consultada el ${a(e.fecha_consulta)}.</span></li>`).join(``),p=c.base?.resumen?.inaturalist,m=l.cifras.map(t=>`<tr>
      <td><strong>${n(t.texto)}</strong><br><span class="detalle">${n(t.fuente)}${t.nota?`. `+n(t.nota[0].toUpperCase()+t.nota.slice(1)):``}. Calculado el ${a(t.fecha)}.</span></td>
      <td class="v">${n(t.valor)}</td><td>${e(t.marca)}</td></tr>`).join(``);s.innerHTML=`
  <fieldset class="grupo"><legend>Qué significa cada marca</legend>
    <ul class="cifras marcas">
      <li><span class="que">${e(`medido`)}</span><span>Lo calculamos con la geometría o el dato abierto.</span></li>
      <li><span class="que">${e(`de fuente`)}</span><span>Lo dice la fuente tal cual.</span></li>
      <li><span class="que">${e(`inferido`)}</span><span>Sale de cruzar dos fuentes.</span></li>
      <li><span class="que">${e(`supuesto`)}</span><span>Es un modelo o una hipótesis, no una medida.</span></li></ul>
  </fieldset>

  <fieldset class="grupo"><legend>Las cifras del visor</legend>
    <div class="envoltura-tabla"><table class="tabla-cifras">
      <thead><tr><th scope="col">Cifra</th><th scope="col">Valor</th><th scope="col">Marca</th></tr></thead>
      <tbody>${m}</tbody></table></div>
    <p class="detalle">Datos preparados el ${a(l.generado)} con los guiones de <code>visor/build/</code> y <code>visor3d/build/</code>; se pueden repetir. Cada archivo servido trae fuente, guion, versión y sha256 en <code>datos/manifiesto.json</code>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Fuentes usadas</legend>
    <ul class="lista-fuentes">${f}</ul>
    <p class="detalle">La misma lista, legible por máquina, está en <a href="datos/licencias.json">datos/licencias.json</a>.</p>
    ${p?`<p class="detalle">iNaturalist, ${a(p.consultado)}: ${r(p.apta)} observaciones con licencia apta (CC0 ${r(p.cc0)}, CC BY ${r(p.ccby)}) y ${r(p.sin_licencia)} sin licencia ${e(`de fuente`)}.</p>`:``}
  </fieldset>

  <fieldset class="grupo"><legend>Cómo se arma el 3D</legend>
    <ul class="cifras">
      <li><span class="que">Posición y altura de cada árbol</span><span class="valor">${e(`de fuente`)}</span></li>
      <li><span class="que">Forma y tamaño de la copa, por tipo de árbol</span><span class="valor">${e(`supuesto`)}</span></li>
      <li><span class="que">Tipo de árbol según el nombre común</span><span class="valor">${e(`inferido`)} o ${e(`supuesto`)}</span></li>
      <li><span class="que">Altura de los edificios, pisos × 3 m</span><span class="valor">${e(`supuesto`)}</span></li>
      <li><span class="que">Huella de edificios y Tropicario</span><span class="valor">${e(`medido`)}</span></li>
      <li><span class="que">Disco de cada zona</span><span class="valor">${e(`inferido`)}</span></li>
      <li><span class="que">Horas de sol por zona y mes</span><span class="valor">${e(`supuesto`)}</span></li></ul>
    <p class="detalle">El tipo de árbol de cada nombre común sale de una tabla provisional de 279 nombres, un borrador sin revisión humana. Mientras nadie la revise, solo las palmas, las coníferas y los helechos arbóreos toman su forma; los demás árboles con especie van con la forma neutra y el color de identificado. La ficha marca el tipo inferido, o supuesto cuando la tabla dice certeza baja. NN y «Otro» van con una silueta neutra y gris.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que no se usó y por qué</legend>
    <ul class="lista-fuentes">${u.no_usadas.map(e=>`<li><strong>${n(e.fuente)}.</strong> ${n(e.motivo)}</li>`).join(``)}</ul>
  </fieldset>

  <fieldset class="grupo"><legend>Lo que falta por saber</legend>
    ${o.map(([e,n])=>t(e,n)).join(``)}
  </fieldset>

  <fieldset class="grupo"><legend>Lo que este visor no es</legend>
    <p>Es una demo independiente con datos abiertos. No es un sitio del Jardín Botánico ni habla por él.</p>
    <p>Complementa el <a href="https://geoportal.jbb.gov.co/" target="_blank" rel="noopener">Geoportal Bosques Urbanos</a>, no lo reemplaza: para consultar el arbolado de la ciudad, ese es el lugar.</p>
    <p class="detalle">Las posiciones exactas de las plantas amenazadas y extintas en estado silvestre no se publican aquí; se muestran solo agregadas por zona. Ninguna de ellas se usa para ubicar los círculos de las zonas. Algunos árboles no se dibujan para proteger especies sensibles. Lo mismo pasa con el punto de algunas plantas de la colección. Un guion de la build lo comprueba.</p>
  </fieldset>`}export{s as pintarFuentes};