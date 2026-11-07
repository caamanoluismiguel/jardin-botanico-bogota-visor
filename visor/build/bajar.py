"""Paso 1 de la build: baja las fuentes abiertas y las guarda tal cual en datos-crudos/visor/ (fuera de git).

Uso: python3 -I visor/build/bajar.py            (baja lo que falte)
     python3 -I visor/build/bajar.py --todo     (vuelve a bajar todo)

Solo usa la biblioteca estándar. Solo fuentes aptas (CC BY 4.0, dominio público o datos abiertos de la NASA).
Nada de OSM, Open-Meteo ni conjuntos NC.
"""
import json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
CRUDO = os.path.join(RAIZ, "datos-crudos", "visor")
os.makedirs(CRUDO, exist_ok=True)
TODO = "--todo" in sys.argv

JBB = "https://geoportal.jbb.gov.co/agc/rest/services/IDECA"
CAT = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services"
ORTO = "https://serviciosgis.catastrobogota.gov.co/image/rest/services/imagenesfunciones/orthourbana2025funcion/ImageServer"
UA = {"User-Agent": "visor-demo-jbb/0 (consulta pequena, datos abiertos)"}

# Recuadro de trabajo: el jardín más unos 300 m
ENV_300 = "-74.1060,4.6627,-74.0948,4.6731"
# Recuadro del jardín más unos 50 m, para el censo
ENV_50 = "-74.1040,4.6650,-74.0960,4.6710"


def leer(url, params=None, intentos=3, binario=False, post=False):
    datos = None
    if params and post:
        datos = urllib.parse.urlencode(params).encode()
    elif params:
        url = url + "?" + urllib.parse.urlencode(params)
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, data=datos, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                b = r.read()
                return b if binario else json.loads(b)
        except Exception as e:
            if i == intentos - 1:
                raise
            print("  reintento", i + 1, e, file=sys.stderr)
            time.sleep(3)


def guardar(nombre, obj):
    p = os.path.join(CRUDO, nombre)
    with open(p, "w") as f:
        json.dump(obj, f, ensure_ascii=False)
    print("  guardado", nombre)


def existe(nombre):
    return os.path.exists(os.path.join(CRUDO, nombre)) and not TODO


def paginar(url, base, tam):
    feats, off = [], 0
    while True:
        q = dict(base, resultOffset=off, resultRecordCount=tam)
        r = leer(url + "/query", q)
        if "error" in r:
            raise RuntimeError(r["error"])
        fs = r.get("features", [])
        feats += fs
        print("  ", off, len(fs))
        if len(fs) < tam and not r.get("exceededTransferLimit"):
            break
        off += len(fs)
    return feats


def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def coleccion():
    if existe("coleccion_puntos.json"):
        return
    print("Colección viva (capa 0, puntos)")
    url = JBB + "/colecionviva/FeatureServer/0"
    base = dict(where="1=1", outFields="IdAccesion,Familia,Con_Especie_ID,Nombre_esp,ZonaAccesion,CategoriaConservacion,Fecha_Actualizacion",
                returnGeometry="true", outSR=4326, f="json", orderByFields="OBJECTID")
    feats = paginar(url, base, 5000)
    conteos = {}
    for capa in (0, 1, 2):
        conteos[capa] = leer(JBB + f"/colecionviva/FeatureServer/{capa}/query", dict(where="1=1", returnCountOnly="true", f="json"))["count"]
    meta = leer("https://datosabiertos.bogota.gov.co/api/3/action/package_show", dict(id="colecciones-vivas-bogota-d-c"))["result"]
    guardar("coleccion_puntos.json", dict(consultado=ahora(), servicio=url, conteos_capas=conteos,
            ficha=dict(licencia=meta.get("license_id"), modificada=meta.get("metadata_modified")),
            features=[dict(a=f["attributes"], g=f.get("geometry")) for f in feats]))


def dominios():
    """Nombres de familias, zonas y categorías (dominios de la capa de la colección)."""
    if existe("coleccion_dominios.json"):
        return
    print("Dominios de la colección viva")
    d = leer(JBB + "/colecionviva/FeatureServer/0", dict(f="json"))
    out = {}
    for f in d["fields"]:
        cv = (f.get("domain") or {}).get("codedValues")
        if cv:
            out[f["name"]] = {c["code"]: c["name"] for c in cv}
    guardar("coleccion_dominios.json", dict(consultado=ahora(), dominios=out))


def censo():
    if existe("censo_jardin.json"):
        return
    print("Censo del arbolado SIGAU en el recuadro del jardín")
    url = JBB + "/CensoArbol/FeatureServer/0"
    base = dict(where="1=1", geometry=ENV_50, geometryType="esriGeometryEnvelope", inSR=4326, spatialRel="esriSpatialRelIntersects",
                outFields="Codigo_Arbol,Con_Especie_ID,Nombre_Esp,Altura_Total,Tipo_Emplazamiento,Fecha_Actualizacion",
                returnGeometry="true", outSR=4326, f="json", orderByFields="OBJECTID")
    feats = paginar(url, base, 2000)
    total = leer(url + "/query", dict(where="1=1", returnCountOnly="true", f="json"))["count"]
    st = leer(url + "/query", dict(where="1=1", f="json", outStatistics=json.dumps([
        {"statisticType": "min", "onStatisticField": "Fecha_Actualizacion", "outStatisticFieldName": "fmin"},
        {"statisticType": "max", "onStatisticField": "Fecha_Actualizacion", "outStatisticFieldName": "fmax"}])))
    meta = leer("https://datosabiertos.bogota.gov.co/api/3/action/package_show", dict(id="censo-arbolado-urbano"))["result"]
    guardar("censo_jardin.json", dict(consultado=ahora(), servicio=url, recuadro=ENV_50, total_ciudad=total,
            fechas_ciudad=st["features"][0]["attributes"],
            ficha=dict(licencia=meta.get("license_id"), modificada=meta.get("metadata_modified")),
            features=[dict(a=f["attributes"], g=f.get("geometry")) for f in feats]))


def construcciones():
    if existe("construcciones.json"):
        return
    print("Construcciones de Catastro (UAECD) en el recuadro de 300 m")
    url = CAT + "/catastro/construccion/MapServer/0"
    base = dict(where="1=1", geometry=ENV_300, geometryType="esriGeometryEnvelope", inSR=4326, spatialRel="esriSpatialRelIntersects",
                outFields="CONCODIGO,CONNPISOS,LOTECODIGO", returnGeometry="true", outSR=4326, f="geojson")
    feats = paginar(url, base, 2000)
    meta = leer("https://datosabiertos.bogota.gov.co/api/3/action/package_show", dict(id="construccion"))["result"]
    guardar("construcciones.json", dict(consultado=ahora(), servicio=url, recuadro=ENV_300,
            ficha=dict(licencia=meta.get("license_id"), modificada=meta.get("metadata_modified")), features=feats))


def sectores():
    if existe("sectores_simon_bolivar.json"):
        return
    print("Sectores del Simón Bolívar (IDRD) y árboles del censo en cada uno")
    url = CAT + "/recreaciondeporte/parquesyescenarios/MapServer/1"
    r = leer(url + "/query", dict(where="UPPER(NOMBREPAR) LIKE '%SIMON BOLIVAR%'", outFields="ID_PARQUE,NOMBREPAR",
                                  returnGeometry="true", outSR=4326, f="geojson"))
    fs = r["features"]
    for f in fs:
        g = f["geometry"]
        esri = {"rings": g["coordinates"] if g["type"] == "Polygon" else [ring for poly in g["coordinates"] for ring in poly],
                "spatialReference": {"wkid": 4326}}
        c = leer(JBB + "/CensoArbol/FeatureServer/0/query", dict(where="1=1", geometry=json.dumps(esri), geometryType="esriGeometryPolygon",
                 inSR=4326, spatialRel="esriSpatialRelIntersects", returnCountOnly="true", f="json"), post=True)
        f["properties"]["arboles_censo"] = c["count"]
        print("  ", f["properties"]["NOMBREPAR"], c["count"])
    meta = leer("https://datosabiertos.bogota.gov.co/api/3/action/package_show",
                dict(id="sistema-distrital-de-parques-y-escenarios-publicos-deportivos"))["result"]
    guardar("sectores_simon_bolivar.json", dict(consultado=ahora(), servicio=url,
            ficha=dict(licencia=meta.get("license_id"), modificada=meta.get("metadata_modified")), features=fs))


def calzadas():
    if existe("calzadas.json"):
        return
    print("Mapa de Referencia IDECA: calzadas en el recuadro de 300 m")
    url = CAT + "/Mapa_Referencia/Mapa_Referencia/MapServer/15"
    base = dict(where="1=1", geometry=ENV_300, geometryType="esriGeometryEnvelope", inSR=4326, spatialRel="esriSpatialRelIntersects",
                outFields="OBJECTID", returnGeometry="true", outSR=4326, f="geojson", geometryPrecision=6)
    feats = paginar(url, base, 1000)
    meta = leer("https://datosabiertos.bogota.gov.co/api/3/action/package_show", dict(id="mapa-de-referencia"))["result"]
    guardar("calzadas.json", dict(consultado=ahora(), servicio=url,
            ficha=dict(licencia=meta.get("license_id"), modificada=meta.get("metadata_modified")), features=feats))


def metar():
    # El «ahora» de la build. El navegador intenta bajar uno más nuevo al abrir el panel de clima.
    print("METAR SKBO por IEM")
    r = leer("https://mesonet.agron.iastate.edu/json/current.py", dict(station="SKBO", network="CO__ASOS"))
    guardar("metar_skbo.json", dict(consultado=ahora(), fuente="https://mesonet.agron.iastate.edu/json/current.py?station=SKBO&network=CO__ASOS", dato=r))


def estacion_skbo():
    if existe("skbo_estacion.json"):
        return
    print("Coordenada de SKBO en la red CO__ASOS del IEM")
    d = leer("https://mesonet.agron.iastate.edu/geojson/network/CO__ASOS.geojson")
    f = [x for x in d["features"] if x.get("id") == "SKBO" or x["properties"].get("sid") == "SKBO"][0]
    guardar("skbo_estacion.json", dict(consultado=ahora(), fuente="https://mesonet.agron.iastate.edu/geojson/network/CO__ASOS.geojson",
            nombre=f["properties"].get("sname"), lon=f["geometry"]["coordinates"][0], lat=f["geometry"]["coordinates"][1],
            elevacion=f["properties"].get("elevation")))


def gibs():
    # La imagen de nubes más reciente que tenga contenido (MODIS Terra, color verdadero).
    print("NASA GIBS, MODIS Terra color verdadero")
    hoy = datetime.now(timezone.utc).date()
    for d in range(1, 8):
        fecha = (hoy - timedelta(days=d)).isoformat()
        b = leer("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", dict(
            SERVICE="WMS", REQUEST="GetMap", VERSION="1.3.0", LAYERS="MODIS_Terra_CorrectedReflectance_TrueColor", STYLES="",
            CRS="EPSG:4326", BBOX="4.2,-74.6,5.1,-73.6", WIDTH=480, HEIGHT=432, FORMAT="image/jpeg", TIME=fecha), binario=True)
        if len(b) > 15000:
            with open(os.path.join(CRUDO, "gibs.jpg"), "wb") as f:
                f.write(b)
            guardar("gibs.json", dict(consultado=ahora(), fecha=fecha, capa="MODIS_Terra_CorrectedReflectance_TrueColor",
                                      recuadro="4,2 a 5,1 N; 74,6 a 73,6 O", bytes=len(b)))
            return
    print("  sin imagen útil en 7 días")


def inaturalist():
    print("iNaturalist, solo conteos del lugar 170214")
    base = "https://api.inaturalist.org/v1/observations"
    out = dict(consultado=ahora(), lugar=170214)
    for k, extra in dict(total={}, sin_licencia=dict(licensed="false"), cc0=dict(license="cc0"), ccby=dict(license="cc-by")).items():
        out[k] = leer(base, dict(place_id=170214, per_page=0, **extra))["total_results"]
        time.sleep(1.2)
    guardar("inaturalist.json", out)


def ortoimagen():
    # Prueba si el servicio de la ortoimagen urbana 2025 (IDECA, CC BY 4.0) entrega teselas hoy.
    print("Ortoimagen urbana 2025, prueba del servicio")
    estado = dict(consultado=ahora(), servicio=ORTO)
    try:
        b = leer(ORTO + "/exportImage", dict(bbox="-8249000,520000,-8248800,520200", bboxSR=3857, imageSR=3857, size="256,256",
                                              format="jpg", f="image"), binario=True)
        estado["ok"] = b[:3] == b"\xff\xd8\xff"
        estado["respuesta"] = "" if estado["ok"] else b[:200].decode("utf8", "replace")
    except Exception as e:
        estado.update(ok=False, respuesta=str(e)[:200])
    print("  ok" if estado["ok"] else "  falla: " + estado["respuesta"])
    guardar("ortoimagen.json", estado)


if __name__ == "__main__":
    for paso in (coleccion, dominios, censo, construcciones, sectores, calzadas, metar, estacion_skbo, gibs, inaturalist, ortoimagen):
        try:
            paso()
        except Exception as e:
            print("FALLO", paso.__name__, e, file=sys.stderr)
