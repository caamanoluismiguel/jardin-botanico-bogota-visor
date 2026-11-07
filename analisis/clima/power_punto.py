"""Serie diaria de NASA POWER (radiación y nubosidad, modelo) en el punto de trabajo del jardín.

Uso, desde la raíz del repo:  python3 -I analisis/clima/power_punto.py 2025
Salida: datos-crudos/clima/power_<anio>.json (fuera de git), que lee visor/build/construir.py.
Solo biblioteca estándar. NASA POWER es dato abierto de la NASA y pide esta frase de crédito:
«Datos obtenidos del proyecto POWER del NASA Langley Research Center, financiado por el programa NASA Earth Science/Applied Science».
"""
import json, os, sys, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, "datos-crudos", "clima")
# Punto de trabajo: centro aproximado del jardín (4,668057 N; 74,100109 O). Fijo para que la serie se pueda repetir.
LON, LAT = -74.100109, 4.668057
PARAMETROS = "ALLSKY_SFC_SW_DWN,CLOUD_AMT"

anio = sys.argv[1] if len(sys.argv) > 1 else "2025"
os.makedirs(SALIDA, exist_ok=True)
q = urllib.parse.urlencode(dict(parameters=PARAMETROS, community="RE", longitude=LON, latitude=LAT,
                                start=f"{anio}0101", end=f"{anio}1231", format="JSON"))
req = urllib.request.Request("https://power.larc.nasa.gov/api/temporal/daily/point?" + q,
                             headers={"User-Agent": "visor-demo-jardin/0 (consulta pequena)"})
with urllib.request.urlopen(req, timeout=120) as r:
    b = r.read()
json.loads(b)  # falla aquí si la respuesta no es JSON
with open(os.path.join(SALIDA, f"power_{anio}.json"), "wb") as f:
    f.write(b)
print("POWER", anio, len(b), "bytes")
