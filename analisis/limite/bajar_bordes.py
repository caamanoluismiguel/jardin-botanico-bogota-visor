"""Baja los tres polígonos que usa el visor y los guarda en datos/limite/:
  * lote catastral 005506001044 (Lotes, Catastro Bogotá, UAECD, CC BY 4.0),
  * parque 10-291, Simón Bolívar sector Jardín Botánico (Parques de Bogotá, IDRD, CC BY 4.0),
  * huella del Tropicario, construcción OBJECTID 52913428 (Construcciones, Catastro Bogotá, UAECD, CC BY 4.0).

Uso, desde la raíz del repo:  python3 -I analisis/limite/bajar_bordes.py
Solo biblioteca estándar. Sobrescribe los archivos de datos/limite/ con la versión vigente del servicio.
"""
import json, os, urllib.parse, urllib.request
from datetime import date

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, "datos", "limite")
C = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services"
HOY = date.today().isoformat()
CAPAS = [
    ("catastro_lote_005506001044", C + "/catastro/lote/MapServer/0", "LOTCODIGO='005506001044'",
     "UAECD Catastro Bogotá, catastro/lote/0, consulta " + HOY, "CC BY 4.0 (ficha de Datos Abiertos Bogotá: lote)"),
    ("idrd_parque_10-291", C + "/recreaciondeporte/parquesyescenarios/MapServer/1", "ID_PARQUE='10-291'",
     "IDRD, capa Parques y escenarios (recreaciondeporte/parquesyescenarios/1), consulta " + HOY,
     "CC BY 4.0 (ficha de Datos Abiertos Bogotá: sistema-distrital-de-parques-y-escenarios-publicos-deportivos)"),
    ("catastro_construccion_tropicario", C + "/catastro/construccion/MapServer/0", "OBJECTID=52913428",
     "UAECD Catastro Bogotá, catastro/construccion/0, OBJECTID 52913428, consulta " + HOY,
     "CC BY 4.0 (ficha de Datos Abiertos Bogotá: construccion)"),
]

os.makedirs(SALIDA, exist_ok=True)
for nombre, url, donde, fuente, licencia in CAPAS:
    q = urllib.parse.urlencode(dict(where=donde, outFields="*", outSR=4326, f="geojson", returnGeometry="true"))
    req = urllib.request.Request(url + "/query?" + q, headers={"User-Agent": "visor-demo-jardin/0 (consulta pequena)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read())
    fs = d.get("features", [])
    if len(fs) != 1:
        raise SystemExit(f"{nombre}: se esperaba 1 objeto y llegaron {len(fs)} {d.get('error', '')}")
    out = {"type": "FeatureCollection", "name": nombre, "fuente": fuente, "licencia": licencia, "features": fs}
    with open(os.path.join(SALIDA, nombre + ".geojson"), "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print(nombre, "ok")
