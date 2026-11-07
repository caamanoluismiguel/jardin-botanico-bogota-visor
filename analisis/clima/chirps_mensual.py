"""CHIRPS v3.0 mensual (0,05°) en la celda del punto de trabajo del jardín, leyendo solo los bloques del píxel en los COG.
No baja los archivos globales (unos 30 MB cada uno).

Uso, desde la raíz del repo:  python3 -I analisis/clima/chirps_mensual.py [anio_ini] [anio_fin]   (por defecto 2017 a 2026)
Salida: datos-crudos/clima/chirps_v3_mensual.csv (mes, mm en la celda, media 3x3 de contexto), que lee la preparación de datos del visor (guion fuera de este repo).
Necesita rasterio (ver requirements.txt). CHIRPS v3, Climate Hazards Center, UC Santa Barbara, CC BY 4.0.
"""
import csv, os, sys
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
import rasterio
from rasterio.windows import Window

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, "datos-crudos", "clima")
# Punto de trabajo: centro aproximado del jardín, el mismo de power_punto.py
LON, LAT = -74.100109, 4.668057
a0, a1 = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (2017, 2026)
URL = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/chirps-v3.0.{:04d}.{:02d}.cog"

filas = []
for a in range(a0, a1 + 1):
    for m in range(1, 13):
        try:
            with rasterio.open("/vsicurl/" + URL.format(a, m)) as ds:
                r, c = ds.index(LON, LAT)
                v = ds.read(1, window=Window(c - 1, r - 1, 3, 3)).astype(float)
                cx, cy = ds.xy(r, c)
        except Exception:  # mes aún no publicado
            continue
        filas.append({"mes": f"{a}-{m:02d}", "mm_celda": round(float(v[1, 1]), 2),
                      "mm_3x3": round(float(v[v >= 0].mean()), 2), "centro_celda": f"{cy:.3f},{cx:.3f}"})
        print(filas[-1], flush=True)
os.makedirs(SALIDA, exist_ok=True)
with open(os.path.join(SALIDA, "chirps_v3_mensual.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0]))
    w.writeheader()
    w.writerows(filas)
print("escrito chirps_v3_mensual.csv,", len(filas), "meses")
