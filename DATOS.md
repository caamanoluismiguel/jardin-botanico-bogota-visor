# Datos y licencias

Cada fuente que usa el visor conserva su licencia. Esta lista dice qué se sirve, de dónde viene, con qué licencia y cómo se atribuye. La licencia del código y del diseño está en [LICENSE](LICENSE) y no se aplica a estos datos.

Las licencias se revisaron una por una el 6 de noviembre de 2026 en la ficha de cada conjunto. Si vas a reutilizar un dato, confirma su licencia vigente en la fuente.

## Fuentes servidas

| Fuente | Qué usa el visor | Archivo | Licencia | Atribución |
|---|---|---|---|---|
| [Colecciones vivas de Bogotá](https://datosabiertos.bogota.gov.co/dataset/colecciones-vivas-bogota-d-c), Jardín Botánico José Celestino Mutis | Accesiones, especie, familia, zona y categoría de amenaza. Las amenazadas (CR, EN, VU) y EW van sin coordenada | `visor/datos/accesiones.json`, `visor/datos/zonas.json` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) | «Colecciones vivas, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0» |
| [Censo del arbolado urbano (SIGAU)](https://datosabiertos.bogota.gov.co/dataset/censo-arbolado-urbano), Jardín Botánico José Celestino Mutis | Árboles en el recuadro del jardín: especie, altura, fecha del registro | `visor/datos/censo.json` | CC BY 4.0 | «Censo del arbolado urbano, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0» |
| [Lote](https://datosabiertos.bogota.gov.co/dataset/lote), Catastro Bogotá (UAECD) | Lote 005506001044, borde oficial del jardín | `datos/limite/catastro_lote_005506001044.geojson`, `visor/datos/base.json` | CC BY 4.0 | «Lotes, Catastro Bogotá (UAECD), CC BY 4.0» |
| [Construcción](https://datosabiertos.bogota.gov.co/dataset/construccion), Catastro Bogotá (UAECD) | Huellas y número de pisos para el 3D; huella del Tropicario | `visor/datos/construcciones.json`, `datos/limite/catastro_construccion_tropicario.geojson`, `visor/datos/base.json` | CC BY 4.0 | «Construcciones, Catastro Bogotá (UAECD), CC BY 4.0» |
| [Sistema Distrital de Parques y Escenarios](https://datosabiertos.bogota.gov.co/dataset/sistema-distrital-de-parques-y-escenarios-publicos-deportivos), IDRD | Parque 10-291 como borde alterno y los 19 sectores del Simón Bolívar | `datos/limite/idrd_parque_10-291.geojson`, `visor/datos/sectores.json`, `visor/datos/base.json` | CC BY 4.0 | «Parques de Bogotá, IDRD, Datos Abiertos Bogotá, CC BY 4.0» |
| [Mapa de Referencia IDECA](https://datosabiertos.bogota.gov.co/dataset/mapa-de-referencia), Catastro Bogotá | Calzadas alrededor del jardín, como contexto | `visor/datos/base.json` | CC BY 4.0 | «Mapa de Referencia IDECA (calzadas), Catastro Bogotá, CC BY 4.0» |
| [Modelo Digital de Terreno 2025](https://serviciosgis.catastrobogota.gov.co/image/rest/services/Imagenes/modelodigitalterreno2025funcion/ImageServer), IDECA | Relieve del 3D a 4 m y altura del suelo bajo árboles, zonas, edificios y calzadas | `datos/terreno.glb.gz`, `datos/arboles.bin.gz`, `datos/huellas.bin.gz`, `datos/escena.json`, `datos/calzadas.json`, `datos/horas_sol.json` | CC BY 4.0 | «Modelo Digital de Terreno 2025, IDECA, CC BY 4.0» |
| [METAR SKBO](https://mesonet.agron.iastate.edu/) vía Iowa Environmental Mesonet, Iowa State University | Último parte de El Dorado, en vivo, con una copia de respaldo | `visor/datos/clima.json` y consulta en vivo | Dominio público; IEM pide crédito ([aviso](https://mesonet.agron.iastate.edu/disclaimer.php)) | «METAR SKBO (El Dorado) vía Iowa Environmental Mesonet, Iowa State University» |
| [CHIRPS v3](https://www.chc.ucsb.edu/data/chirps3), Climate Hazards Center, UC Santa Barbara | Lluvia mensual estimada en la celda del jardín. DOI 10.15780/G2JQ0P | `visor/datos/clima.json` | CC BY 4.0 | «CHIRPS v3, Climate Hazards Center, UC Santa Barbara, CC BY 4.0» |
| [NASA POWER](https://power.larc.nasa.gov/), NASA Langley Research Center | Radiación solar y nubosidad de 2025, de modelo, no medidas | `visor/datos/clima.json` | Política de datos abiertos de la NASA, con frase de crédito ([cómo citar](https://power.larc.nasa.gov/docs/referencing/)) | «Datos obtenidos del proyecto POWER del NASA Langley Research Center, financiado por el programa NASA Earth Science/Applied Science» |
| [NASA GIBS](https://earthdata.nasa.gov/gibs), capa MODIS Terra color verdadero | Imagen de nubes sobre Bogotá del día en que se prepararon los datos | `visor/datos/gibs.jpg` | Datos abiertos de la NASA, con frase de reconocimiento | «Imágenes de NASA Global Imagery Browse Services (GIBS), parte de ESDIS» |
| [iNaturalist](https://www.inaturalist.org/observations?place_id=170214), lugar 170214 | Solo conteos por licencia; no se copia ninguna observación ni foto | `visor/datos/base.json`, `visor/datos/cifras.json` | Cada observación tiene la suya; aquí solo se usa el conteo | «iNaturalist» con enlace al lugar |
| [Algoritmo solar de la NOAA](https://gml.noaa.gov/grad/solcalc/calcdetails.html) | Posición del sol en 3D y días de sol cenital | `visor/js/tres.js`, `visor/build/construir.py` | Dominio público | «Algoritmo solar de la NOAA» |

El visor 3D usa las mismas fuentes; sus archivos están en `datos/` en la raíz del repo y `datos/licencias.json` dice, para cada uno, de qué fuente sale. La tabla de tipos de árbol por nombre común (`visor/build/arquetipos.csv`, y en el 3D `datos/arquetipos-tabla.json` y `datos/arquetipos.glb.gz`) es elaboración del equipo, sin revisión de un botánico todavía, y queda cubierta por [LICENSE](LICENSE).

## Lo que no se usa

Se dejan fuera los datos con licencia no comercial o con obligación de compartir igual, las fuentes sin licencia publicada y las geometrías de OpenStreetMap. La pestaña «Fuentes y método» del visor lo resume.

## Librerías

El plano 2D no las trae en este repo; el navegador las baja de jsDelivr con versión exacta.

| Librería | Versión | Licencia |
|---|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 4.7.1 | BSD 3-Clause |
| [three.js](https://github.com/mrdoob/three.js), con OrbitControls y BufferGeometryUtils | 0.170.0 | MIT |

El visor 3D lleva empaquetada en `assets/` la librería three.js 0.187.0 (MIT), con su decodificador meshopt (MIT). Sus avisos de licencia están en [LICENCIAS-TERCEROS.txt](LICENCIAS-TERCEROS.txt).
