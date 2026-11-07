"""Comprueba que nada de lo que sirve el visor delata una accesión sensible (CR, EN, VU o EW).

Uso:
  python3 -I visor/build/comprobar_sensibles.py                     revisa visor/
  python3 -I visor/build/comprobar_sensibles.py --dir OTRO_VISOR    revisa otra copia (por ejemplo la pública)
  python3 -I visor/build/comprobar_sensibles.py --prueba-negativa   planta tres árboles prohibidos en copias
        temporales; tiene que encontrar los tres y salir con 3 (si alguno se le escapa, sale con 0)

Lee las coordenadas sensibles del dato crudo (datos-crudos/visor/coleccion_puntos.json) y recorre todo lo
servido en datos/ y js/ más index.html. Dos pruebas:
  1. Ningún punto cae en una sensible: cada par con forma de longitud y latitud en un JSON, las tablas por
     columnas ya decodificadas, los pares cx, cy y los pares de decimales escritos en los .js y .html.
     Coincide si queda a 1 millonésima de grado o menos en cada eje (unos 0,11 m).
  2. La regla de build/regla_sensibles.py se cumple en las tablas de árboles y accesiones: ningún árbol
     ni accesión visible con punto a 1 m o menos de una sensible, ni a 20 m o menos de una sensible de
     su mismo género (o de cualquiera, si tiene nombre y no se le conoce el género), y ninguna sensible
     con punto.
Sale con código 1 si hay al menos una falla. Solo biblioteca estándar.
"""
import argparse, json, os, re, shutil, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
VISOR = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from regla_sensibles import (Regla, casos_negativos, es_tabla, nombrado_censo, revisar_tabla,  # noqa: E402
                             sensibles_crudos, tabla_generos)


def es_lonlat(a, b):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and -75.5 < a < -73 and 3.5 < b < 5.5


def pares_json(o, salida, ruta="$"):
    if isinstance(o, dict):
        cols, org, esc = o.get("cols"), o.get("origen"), o.get("escala")
        if isinstance(cols, dict) and isinstance(org, list) and esc and "x" in cols and "y" in cols:
            for i, (x, y) in enumerate(zip(cols["x"], cols["y"])):
                if x is not None and y is not None:
                    salida.append((org[0] + x * esc, org[1] + y * esc, f"{ruta}.cols[{i}]"))
        if es_lonlat(o.get("cx"), o.get("cy")):
            salida.append((o["cx"], o["cy"], f"{ruta}.cx,cy"))
        for k, v in o.items():
            pares_json(v, salida, f"{ruta}.{k}")
    elif isinstance(o, list):
        if len(o) >= 2 and es_lonlat(o[0], o[1]):
            salida.append((o[0], o[1], ruta))
        else:
            for i, v in enumerate(o):
                pares_json(v, salida, f"{ruta}[{i}]")


NUM = re.compile(r"-?\d+\.\d{4,}")


def pares_texto(texto, salida, nombre):
    nums = [(float(m.group()), m.start()) for m in NUM.finditer(texto)]
    for (a, pa), (b, _) in zip(nums, nums[1:]):
        if es_lonlat(a, b):
            salida.append((a, b, f"{nombre}@{pa}"))


def revisar(directorio, regla, generos):
    servidos = []
    for raiz, dirs, archivos in os.walk(directorio):
        dirs[:] = [d for d in dirs if d not in ("build", "capturas")]
        for a in archivos:
            if a.endswith((".json", ".js", ".html", ".geojson")):
                servidos.append(os.path.join(raiz, a))
    total, malos = 0, []
    for p in sorted(servidos):
        rel = os.path.relpath(p, directorio)
        pares = []
        with open(p, encoding="utf-8") as f:
            texto = f.read()
        de_regla, tabla = [], False
        if p.endswith((".json", ".geojson")):
            o = json.loads(texto)
            pares_json(o, pares, rel)
            tabla = es_tabla(o)
            if tabla:
                de_regla = revisar_tabla(o, rel, regla, generos)
        else:
            pares_texto(texto, pares, rel)
        total += len(pares)
        n_malos = 0
        for x, y, donde in pares:
            if regla.v0(x, y):
                malos.append(donde)
                n_malos += 1
        malos += de_regla
        extra = f", {len(de_regla)} contra la regla de sensibles" if tabla else ""
        print(f"  {rel}: {len(pares):,} puntos revisados, {n_malos} en un punto sensible{extra}")
    return total, malos


def prueba_negativa(sens, regla, generos):
    """Copia el visor a un directorio temporal, mueve un árbol de censo.json a un sitio prohibido y corre la
    revisión. Tres casos (ver regla_sensibles.casos_negativos); los tres tienen que fallar."""
    cen = json.load(open(os.path.join(VISOR, "datos", "censo.json")))
    c, esp = cen["cols"], cen["especies"]
    filas = [(i, generos.get(esp[c["e"][i]], ""), nombrado_censo(esp[c["e"][i]]))
             for i in range(len(c["x"])) if c["x"][i] is not None]
    ox, oy = cen["origen"]; s = cen["escala"]
    vistos = 0
    for nombre, i, lon, lat in casos_negativos(sens, filas, cen["origen"], s):
        tmp = tempfile.mkdtemp(prefix="sensibles-v0-")
        try:
            shutil.copytree(os.path.join(VISOR, "datos"), os.path.join(tmp, "datos"))
            o = json.loads(json.dumps(cen))
            o["cols"]["x"][i] = round((lon - ox) / s)
            o["cols"]["y"][i] = round((lat - oy) / s)
            with open(os.path.join(tmp, "datos", "censo.json"), "w") as f:
                json.dump(o, f)
            print(f"Prueba negativa: {nombre} (fila {i} de censo.json)")
            _, malos = revisar(tmp, regla, generos)
            suyos = [m for m in malos if m.startswith(f"datos/censo.json.cols[{i}]")]
            if suyos and len(suyos) == len(malos):
                vistos += 1
                print(f"  detectado: {suyos[0]}")
            else:
                print(f"  NO DETECTADO: {nombre}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return vistos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=VISOR)
    ap.add_argument("--prueba-negativa", action="store_true")
    ap.add_argument("--regla", default="1m", choices=("1m", "v0"))
    a = ap.parse_args()
    sens = sensibles_crudos()
    regla = Regla(sens, a.regla)
    generos = tabla_generos()
    print(f"Regla de sensibles: {a.regla}")
    if a.prueba_negativa:
        vistos = prueba_negativa(sens, Regla(sens, "1m"), generos)
        if vistos == 3:
            print("FALLA esperada: la comprobación encontró los 3 árboles prohibidos (sale con 3).")
            sys.exit(3)
        print(f"La comprobación solo encontró {vistos} de 3 árboles prohibidos; sale con 0 para que la build se detenga.")
        sys.exit(0)
    if not os.path.isdir(os.path.join(a.dir, "datos")):
        raise SystemExit(f"FALLA: {a.dir} no tiene carpeta datos/")
    total, malos = revisar(os.path.abspath(a.dir), regla, generos)
    print(f"Puntos sensibles en el dato crudo: {len(sens):,}. Puntos servidos revisados: {total:,}.")
    if malos:
        print(f"FALLA: {len(malos)} coincidencias. Primeras: {malos[:10]}")
        sys.exit(1)
    print("OK: ningún punto servido cae en una accesión CR, EN, VU o EW, y la regla de sensibles se cumple.")


if __name__ == "__main__":
    main()
