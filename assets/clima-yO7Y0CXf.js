import{f as e,h as t,l as n,m as r,o as i,p as a,s as o,u as s}from"./index-CsDWIkbi.js";var c=e=>(e-32)*5/9;function l(e,t){let n=17.625,r=243.04;return 100*Math.exp(n*t/(r+t))/Math.exp(n*e/(r+e))}function u(e,{alto:t=120,color:n=`#2d6a3e`,etiquetas:i,unidad:a=``,dec:o=0}){let s=t-18,c=Math.max(...e)*1.1,l=314/e.length,u=e.map((e,u)=>{let d=e/c*(s-14);return`<rect x="${26+u*l+2}" y="${s-d}" width="${l-4}" height="${d}" fill="${n}"><title>${i[u]}: ${r(e,o)} ${a}</title></rect><text x="${26+u*l+l/2}" y="${t-4}" text-anchor="middle">${i[u].slice(0,1).toUpperCase()}</text>`}).join(``),d=`<text x="0" y="12">${r(c/1.1,o)}</text><line x1="26" x2="340" y1="${s}" y2="${s}" stroke="#9aa097"/>`;return`<svg class="grafica" viewBox="0 0 340 ${t}" role="img" aria-label="${e.map((e,t)=>`${i[t]} ${r(e,o)} ${a}`).join(`, `)}">${d}${u}</svg>`}async function d(c){c.innerHTML=`<p class="cargando">Cargando el clima…</p>`;let l;try{l=await o(`clima.json`)}catch(e){c.innerHTML=`<p>No se pudo leer el clima: ${n(e.message)}</p>`;return}let d=Array.from({length:12},(e,t)=>a(t)),p=l.power;c.innerHTML=`
  <fieldset class="grupo"><legend>Ahora en El Dorado (SKBO)</legend>
    <div id="metar" class="metar" aria-live="polite"><p class="cargando">Consultando el último parte…</p></div>
    <p class="detalle">Aeropuerto a ${r(l.metar.distancia_km,1)} km del centro del lote ${e(`medido`)}. Es el dato medido en vivo más cercano, no el clima del jardín.</p>
    <p class="detalle">Fuente: <a href="https://mesonet.agron.iastate.edu/" target="_blank" rel="noopener">${n(l.metar.fuente)}</a>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Lluvia por mes</legend>
    <p class="detalle">Promedio ${n(l.chirps.anios)} ${e(`de fuente`)}. Estimación por satélite y estaciones en una ${n(l.chirps.celda)}.</p>
    ${u(l.chirps.climatologia,{etiquetas:d,unidad:`mm`,color:`#1f5f8b`,dec:0})}
    <p class="detalle">Últimos 12 meses publicados, hasta ${i[l.chirps.ultimo_mes.slice(5,7)-1]} de ${l.chirps.ultimo_mes.slice(0,4)}:</p>
    ${u(l.chirps.ultimos.map(e=>e[1]),{etiquetas:l.chirps.ultimos.map(e=>a(e[0].slice(5)-1)),unidad:`mm`,color:`#5a86b2`})}
    <p class="detalle">Fuente: <a href="https://www.chc.ucsb.edu/data/chirps3" target="_blank" rel="noopener">${n(l.chirps.fuente)}</a>, DOI ${n(l.chirps.doi)}.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Sol que llega, según un modelo</legend>
    <p class="detalle">Radiación solar global de ${p.anio} por mes, en kWh/m² ${e(`supuesto`)}. Es un modelo de satélite y reanálisis, no una medida en el jardín.</p>
    ${u(p.radiacion_mensual,{etiquetas:d,unidad:`kWh/m²`,color:`#8a5a00`,dec:1})}
    <ul class="cifras">
      <li><span class="que">Total del año</span><span class="valor">${r(p.radiacion_total,1)} kWh/m² ${e(`supuesto`)}</span></li>
      <li><span class="que">Promedio por día</span><span class="valor">${r(p.radiacion_diaria,2)} kWh/m² ${e(`supuesto`)}</span></li>
      <li><span class="que">Nubosidad media</span><span class="valor">${r(p.nubes_media,1)} % ${e(`supuesto`)}</span></li></ul>
    <p class="detalle">No se muestran la temperatura ni la lluvia de este modelo: su celda está a 1.790 m, unos 760 m más abajo que El Dorado (2.548 m). Punto: ${n(p.punto)}.</p>
    <p class="detalle">Fuente: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">Datos obtenidos del proyecto POWER del NASA Langley Research Center, financiado por el programa NASA Earth Science/Applied Science</a>.</p>
  </fieldset>

  <fieldset class="grupo"><legend>Nubes vistas desde el espacio</legend>
    <div style="position:relative">
      <img class="imagen-nubes" src="datos/${n(l.gibs.archivo)}" loading="lazy" width="480" height="432"
        alt="Imagen de satélite en color verdadero de la sabana de Bogotá el ${s(l.gibs.fecha)}; el jardín está en el centro, marcado con un círculo.">
      <span aria-hidden="true" style="position:absolute;left:50%;top:48%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #1c2620"></span>
    </div>
    <p class="detalle">MODIS Terra, ${s(l.gibs.fecha)}, ${n(l.gibs.recuadro)} ${e(`de fuente`)}. Es la imagen de ese día bajada al construir el visor, no una vista en vivo.</p>
    <p class="detalle">Fuente: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">${n(l.gibs.fuente)}</a>.</p>
  </fieldset>
  ${t(`Clima medido dentro del jardín`,`No entra en esta demo. Lo medido más cercano es El Dorado; lo demás es estimación o modelo y así se marca.`)}`,f(l.metar)}async function f(t){let i=document.getElementById(`metar`),a=(t,a)=>{let o=c(t.t_f),s=l(o,c(t.td_f)),u=new Date(t.utc).toLocaleString(`es-CO`,{timeZone:`America/Bogota`,day:`numeric`,month:`short`,hour:`2-digit`,minute:`2-digit`,hour12:!1});i.innerHTML=`<ul class="cifras">
      <li><span class="que">Temperatura</span><span class="valor">${r(o,0)} °C ${e(`medido`)}</span></li>
      <li><span class="que">Humedad relativa</span><span class="valor">${r(s,0)} % ${e(`inferido`)}</span></li>
      <li><span class="que">Viento</span><span class="valor">${t.viento_kt==null?`sin dato`:r(t.viento_kt*1.852,0)+` km/h`}</span></li>
      <li><span class="que">Parte</span><span class="valor">${n(u)}, hora de Bogotá</span></li></ul>
      <p class="detalle">${a?`Consultado ahora.`:`Sin conexión con el servicio: es la copia guardada al construir el visor.`} La humedad se calcula del punto de rocío.</p>
      <p class="detalle"><code>${n(t.raw)}</code></p>`};try{let e=new AbortController,n=setTimeout(()=>e.abort(),7e3),r=await fetch(t.url,{signal:e.signal});clearTimeout(n);let i=(await r.json()).last_ob;if(!i||i[`airtemp[F]`]==null)throw Error(`sin parte`);a({utc:i.utc_valid,raw:i.raw,t_f:i[`airtemp[F]`],td_f:i[`dewpointtemp[F]`],viento_kt:i[`windspeed[kt]`]},!0)}catch{a(t.copia,!1)}}export{d as pintarClima};