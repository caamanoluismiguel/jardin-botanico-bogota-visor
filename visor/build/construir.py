"""Paso 2 de la build: lee datos-crudos/visor/ (de bajar.py), datos/limite/ y datos-crudos/clima/
(de analisis/clima/power_punto.py y chirps_mensual.py) y escribe archivos pequeños en visor/datos/ para el visor estático.

Uso: python3 -I visor/build/construir.py [--regla 1m|v0]
  --regla 1m  (por defecto) regla de sensibles vigente: ver build/regla_sensibles.py
  --regla v0  la regla anterior (1 millonésima de grado), solo para revertir

Solo biblioteca estándar. Áreas elipsoidales (proyección cilíndrica de áreas iguales con latitud auténtica, WGS84).
Ninguna geometría de OSM entra en los cálculos.
Lo que sale aquí no lleva rutas del disco, claves ni tokens.
"""
import argparse, csv, json, math, os, shutil, sys
from datetime import datetime, timezone, date

AQUI = os.path.dirname(os.path.abspath(__file__))
VISOR = os.path.dirname(AQUI)
RAIZ = os.path.dirname(VISOR)
CRUDO = os.path.join(RAIZ, "datos-crudos", "visor")
CLIMA = os.path.join(RAIZ, "datos-crudos", "clima")
LIMITE = os.path.join(RAIZ, "datos", "limite")
SALIDA = os.path.join(VISOR, "datos")
os.makedirs(SALIDA, exist_ok=True)
sys.path.insert(0, AQUI)
from regla_sensibles import Regla, genero, nombrado_censo, sensibles_crudos, tabla_generos  # noqa: E402


def cargar(*p):
    with open(os.path.join(*p)) as f:
        return json.load(f)


def escribir(nombre, obj):
    p = os.path.join(SALIDA, nombre)
    with open(p, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {nombre}: {os.path.getsize(p):,} B")


def fecha_ms(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date().isoformat()


# ---------- geometría ----------
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
E = math.sqrt(E2)


def _q(phi):
    s = math.sin(phi)
    return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * math.log((1 - E * s) / (1 + E * s)))


QP = _q(math.pi / 2)
RQ = A * math.sqrt(QP / 2)


def _proj(p):
    return (RQ * math.radians(p[0]), RQ * _q(math.radians(p[1])) / QP)


def area_anillo(r):
    P = [_proj(p) for p in r]
    s = 0
    for i in range(len(P) - 1):
        s += P[i][0] * P[i + 1][1] - P[i + 1][0] * P[i][1]
    return abs(s) / 2


def poligonos(g):
    return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]


def area_geom(g):
    return sum(area_anillo(p[0]) - sum(area_anillo(h) for h in p[1:]) for p in poligonos(g))


def en_anillo(x, y, r):
    dentro = False
    j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i][0], r[i][1]
        xj, yj = r[j][0], r[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def en_geom(x, y, g):
    for p in poligonos(g):
        if en_anillo(x, y, p[0]) and not any(en_anillo(x, y, h) for h in p[1:]):
            return True
    return False


def caja(g):
    xs = [c[0] for p in poligonos(g) for r in p for c in r]
    ys = [c[1] for p in poligonos(g) for r in p for c in r]
    return min(xs), min(ys), max(xs), max(ys)


def centroide(r):
    # relativo al primer vértice: con coordenadas absolutas (-74, 4) los polígonos pequeños pierden precisión
    x0, y0 = r[0][0], r[0][1]
    a = cx = cy = 0
    for i in range(len(r) - 1):
        xa, ya, xb, yb = r[i][0] - x0, r[i][1] - y0, r[i + 1][0] - x0, r[i + 1][1] - y0
        c = xa * yb - xb * ya
        a += c
        cx += (xa + xb) * c
        cy += (ya + yb) * c
    if a == 0:
        return x0, y0
    return x0 + cx / (3 * a), y0 + cy / (3 * a)


def casco(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cruz(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cruz(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def haversine(lon1, lat1, lon2, lat2):
    R = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def simplificar(r, tol):
    """Douglas-Peucker en grados (tol en grados)."""
    if len(r) < 4:
        return r
    def dist(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == dy == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    def dp(pts):
        dmax, idx = 0, 0
        for i in range(1, len(pts) - 1):
            d = dist(pts[i], pts[0], pts[-1])
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            return dp(pts[: idx + 1])[:-1] + dp(pts[idx:])
        return [pts[0], pts[-1]]
    s = dp(r)
    return s if len(s) >= 4 else r


def redondear(g, n=6, tol=None):
    def anillo(r):
        if tol:
            r = simplificar(r, tol)
        return [[round(c[0], n), round(c[1], n)] for c in r]
    if g["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [anillo(r) for r in g["coordinates"]]}
    if g["type"] == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [[anillo(r) for r in p] for p in g["coordinates"]]}
    if g["type"] == "LineString":
        return {"type": "LineString", "coordinates": anillo(g["coordinates"])}
    return g


def limpiar_sector(t):
    import re
    t = t.replace("¤", "ñ").replace("Simon Bolivar", "").replace("Sector", "").replace("(", "").replace(")", "")
    t = re.sub(r"\s+", " ", t).strip(" -")
    t = t.replace(" Ii", " II").replace("Desalvamento", "de Salvamento").replace("Jardin Botanico", "Jardín Botánico")
    t = t.replace("Colon", "Colón").replace("Ni¤o", "Niño").replace("Magico", "Mágico").replace("Fundacion", "Fundación")
    t = t.replace(" De ", " de ").replace(" Los ", " los ").replace(" El ", " el ")
    return t or "Simón Bolívar"


def num(v, d=0):
    """Número en español: punto de miles, coma decimal."""
    s = f"{v:,.{d}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ---------- sol (NOAA) ----------
def declinacion(d, hora_utc=17.0):
    """Declinación solar con el algoritmo de la NOAA (siglos julianos), por defecto al mediodía de Bogotá."""
    jd = d.toordinal() + 1721424.5 + hora_utc / 24
    t = (jd - 2451545.0) / 36525
    l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
    m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    c = (math.sin(math.radians(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + math.sin(math.radians(2 * m)) * (0.019993 - 0.000101 * t)
         + math.sin(math.radians(3 * m)) * 0.000289)
    om = 125.04 - 1934.136 * t
    lam = l0 + c - 0.00569 - 0.00478 * math.sin(math.radians(om))
    e0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = e0 + 0.00256 * math.cos(math.radians(om))
    return math.degrees(math.asin(math.sin(math.radians(eps)) * math.sin(math.radians(lam))))


def main():
    print("Construyendo visor/datos/")
    hoy = datetime.now(timezone.utc).date().isoformat()
    cifras = []

    def cifra(clave, texto, valor, marca, fuente, fecha, esperado=None, nota=""):
        cifras.append(dict(clave=clave, texto=texto, valor=valor, marca=marca, fuente=fuente, fecha=fecha,
                           esperado=esperado, coincide=(None if esperado is None else str(valor) == str(esperado)), nota=nota))

    # ---------- bordes ----------
    lote_fc = cargar(LIMITE, "catastro_lote_005506001044.geojson")
    idrd_fc = cargar(LIMITE, "idrd_parque_10-291.geojson")
    trop_fc = cargar(LIMITE, "catastro_construccion_tropicario.geojson")
    g_lote = lote_fc["features"][0]["geometry"]
    g_idrd = idrd_fc["features"][0]["geometry"]
    g_trop = trop_fc["features"][0]["geometry"]
    BORDES = {
        "lote": dict(geom=g_lote, nombre="Lote catastral 005506001044", fuente="Lotes, Catastro Bogotá (UAECD), CC BY 4.0",
                     enlace="https://datosabiertos.bogota.gov.co/dataset/lote", oficial=True),
        "idrd": dict(geom=g_idrd, nombre="Parque IDRD 10-291, Simón Bolívar sector Jardín Botánico",
                     fuente="Parques de Bogotá, IDRD, Datos Abiertos Bogotá, CC BY 4.0",
                     enlace="https://datosabiertos.bogota.gov.co/dataset/sistema-distrital-de-parques-y-escenarios-publicos-deportivos", oficial=False),
    }
    for k, b in BORDES.items():
        b["area"] = area_geom(b["geom"])
        b["caja"] = caja(b["geom"])
    cx, cy = centroide(g_lote["coordinates"][0])
    area_trop_bruta = area_anillo(g_trop["coordinates"][0])
    area_trop_neta = area_geom(g_trop)

    # ---------- colección viva ----------
    col = cargar(CRUDO, "coleccion_puntos.json")
    dom = cargar(CRUDO, "coleccion_dominios.json")["dominios"]
    zonas_nombre = dom["ZonaAccesion"]
    familias_nombre = dom["Familia"]
    cat_nombre = dom["CategoriaConservacion"]
    AMENAZA = {"CR", "EN", "VU"}
    especies, esp_idx = [], {}
    familias, fam_idx = [], {}
    filas = []
    for f in col["features"]:
        a, g = f["a"], f["g"] or {}
        x, y = g.get("x"), g.get("y")
        nom = (a.get("Nombre_esp") or "").strip()
        if nom not in esp_idx:
            esp_idx[nom] = len(especies)
            especies.append(nom)
        fam = familias_nombre.get(a.get("Familia"), a.get("Familia") or "")
        if fam not in fam_idx:
            fam_idx[fam] = len(familias)
            familias.append(fam)
        dentro = 0
        if x is not None:
            for bit, k in ((1, "lote"), (2, "idrd")):
                bx = BORDES[k]["caja"]
                if bx[0] <= x <= bx[2] and bx[1] <= y <= bx[3] and en_geom(x, y, BORDES[k]["geom"]):
                    dentro |= bit
        filas.append(dict(id=a["IdAccesion"], e=esp_idx[nom], fa=fam_idx[fam], z=a.get("ZonaAccesion") or "",
                          c=a.get("CategoriaConservacion") or "", f=a.get("Fecha_Actualizacion"), x=x, y=y, b=dentro))
    n_col = len(filas)
    fechas_col = sorted({fecha_ms(r["f"]) for r in filas if r["f"]})
    fecha_carga = fechas_col[-1]
    cats = {}
    for r in filas:
        cats[r["c"]] = cats.get(r["c"], 0) + 1
    n_amen = sum(cats.get(c, 0) for c in AMENAZA)

    # Puntos sensibles: accesiones CR, EN, VU y EW. La regla vive en build/regla_sensibles.py: una accesión
    # visible o un árbol del censo pierde su punto si queda cerca de una sensible (ver ese archivo).
    SENS = AMENAZA | {"EW"}
    regla = Regla(sensibles_crudos(), REGLA)
    generos_censo = tabla_generos()

    def toca_sensible(x, y):
        """Para centros de zona: nada a RADIO_CUALQUIERA m o menos de una sensible (v0: 1 millonésima)."""
        return regla.cerca_cualquiera(x, y)

    def protegido_servido(x, y, gen, nombrado):
        """La regla se mira en el punto crudo y en el punto ya redondeado a 1 millonésima de grado (el que se
        sirve, origen -74,105 y 4,660); basta con que uno de los dos caiga dentro para quitarlo."""
        xs, ys = -74.105 + round((x + 74.105) * 1e6) / 1e6, 4.660 + round((y - 4.660) * 1e6) / 1e6
        return regla.protegido(x, y, gen, nombrado) or regla.protegido(xs, ys, gen, nombrado)

    for r in filas:
        nom = especies[r["e"]]
        r["vecina"] = (r["c"] not in SENS and r["x"] is not None
                       and protegido_servido(r["x"], r["y"], genero(nom), bool(nom.strip())))
        r["vis"] = r["c"] not in SENS and r["x"] is not None and not r["vecina"]
    por_zona = {}
    for r in filas:
        por_zona.setdefault(r["z"], []).append(r)

    # accesiones: tabla por columnas; amenazadas (CR, EN, VU) y EW sin coordenada
    ox, oy = -74.105, 4.660
    cols = dict(id=[], e=[], fa=[], z=[], c=[], f=[], x=[], y=[], b=[])
    dia0 = date(1970, 1, 1)
    ocultas = 0
    vecinas = []  # visibles sin punto porque comparten coordenada con una sensible
    for r in filas:
        cols["id"].append(r["id"])
        cols["e"].append(r["e"])
        cols["fa"].append(r["fa"])
        cols["z"].append(r["z"])
        cols["c"].append(r["c"])
        cols["f"].append(int(r["f"] // 86400000) if r["f"] else None)
        oculta = not r["vis"]
        ocultas += oculta
        if r["vecina"]:
            vecinas.append(len(cols["id"]) - 1)
        cols["x"].append(None if oculta else round((r["x"] - ox) * 1e6))
        cols["y"].append(None if oculta else round((r["y"] - oy) * 1e6))
        cols["b"].append(r["b"])
    escribir("accesiones.json", dict(origen=[ox, oy], escala=1e-6, especies=especies, familias=familias,
                                     zonas=zonas_nombre, categorias=cat_nombre, consultado=col["consultado"][:10],
                                     ficha_modificada=col["ficha"]["modificada"][:10], cols=cols,
                                     # regla 1m: no se dice cuáles perdieron su punto por estar cerca de una
                                     # sensible (eso delataría la zona de la sensible); solo el total en cifras
                                     **(dict(sin_punto_por_vecina=vecinas) if REGLA == "v0" else {})))

    # ---------- censo SIGAU ----------
    cen = cargar(CRUDO, "censo_jardin.json")
    cesp, cesp_idx = [], {}
    ccols = dict(c=[], e=[], h=[], f=[], x=[], y=[], b=[], k=[])
    cen_tapados = 0
    cen_b = {"lote": [], "idrd": []}
    for f in cen["features"]:
        a, g = f["a"], f["g"]
        x, y = g["x"], g["y"]
        nom = (a.get("Nombre_Esp") or "").strip()
        eid = int(a.get("Con_Especie_ID") or 0)
        k = 1 if eid == 106 else 2 if eid == 107 else 0
        dentro = 0
        for bit, kb in ((1, "lote"), (2, "idrd")):
            if en_geom(x, y, BORDES[kb]["geom"]):
                dentro |= bit
                cen_b[kb].append(dict(k=k, h=a.get("Altura_Total"), f=a.get("Fecha_Actualizacion")))
        if REGLA == "v0":
            tapado = regla.v0(x, y)
        else:
            tapado = protegido_servido(x, y, generos_censo.get(nom, ""), nombrado_censo(nom))
        cen_tapados += tapado
        if tapado and REGLA != "v0":
            continue  # regla 1m: el árbol no se sirve (ni punto ni fila); solo entra en los conteos por borde
        if nom not in cesp_idx:
            cesp_idx[nom] = len(cesp)
            cesp.append(nom)
        ccols["c"].append(a["Codigo_Arbol"])
        ccols["e"].append(cesp_idx[nom])
        ccols["h"].append(round(a["Altura_Total"] * 10) if a.get("Altura_Total") is not None else None)
        ccols["f"].append(int(a["Fecha_Actualizacion"] // 86400000) if a.get("Fecha_Actualizacion") else None)
        ccols["x"].append(None if tapado else round((x - ox) * 1e6))
        ccols["y"].append(None if tapado else round((y - oy) * 1e6))
        ccols["b"].append(dentro)
        ccols["k"].append(k)
    escribir("censo.json", dict(origen=[ox, oy], escala=1e-6, especies=cesp, consultado=cen["consultado"][:10],
                                ficha_modificada=cen["ficha"]["modificada"][:10], cols=ccols,
                                nota="k: 0 identificado, 1 NN, 2 Otro. h en decímetros. f en días desde 1970-01-01. "
                                     + ("Algunos árboles no se incluyen para proteger especies sensibles." if REGLA != "v0" else
                                     "x e y van vacíos cuando el árbol cae en el punto de una accesión amenazada o EW.")))

    def resumen_censo(lst):
        n = len(lst)
        nn = sum(1 for r in lst if r["k"] == 1)
        ot = sum(1 for r in lst if r["k"] == 2)
        hs = [r["h"] for r in lst if r["h"] is not None]
        fs = sorted(r["f"] for r in lst if r["f"])
        return dict(n=n, nn=nn, otro=ot, sin_id=nn + ot, pct_sin_id=round(100 * (nn + ot) / n, 1),
                    altura_media=round(sum(hs) / len(hs), 2), fmin=fecha_ms(fs[0]), fmax=fecha_ms(fs[-1]))

    # ---------- construcciones ----------
    con = cargar(CRUDO, "construcciones.json")
    lx0, ly0, lx1, ly1 = BORDES["lote"]["caja"]
    m = 0.0011  # unos 120 m
    edif = []
    dentro_lote = []
    for f in con["features"]:
        g = f["geometry"]
        if not g or g["type"] not in ("Polygon", "MultiPolygon"):
            continue
        r0 = poligonos(g)[0][0]
        c = centroide(r0)
        if not (lx0 - m <= c[0] <= lx1 + m and ly0 - m <= c[1] <= ly1 + m):
            continue
        p = f["properties"]
        pisos = p.get("CONNPISOS") or 1
        ar = area_geom(g)
        inl = en_geom(c[0], c[1], g_lote)
        ini = en_geom(c[0], c[1], g_idrd)
        if inl:
            dentro_lote.append(dict(area=ar, pisos=pisos))
        edif.append({"type": "Feature", "geometry": redondear(g, 6, 0.000004),
                     "properties": dict(p=pisos, a=round(ar), d=(1 if inl else 0) | (2 if ini else 0))})
    escribir("construcciones.json", dict(consultado=con["consultado"][:10], ficha_modificada=con["ficha"]["modificada"][:10],
                                         altura_por_piso=3.0, type="FeatureCollection", features=edif))

    # ---------- zonas: círculo de ubicación aproximada, solo con puntos visibles ----------
    # El dato no trae el borde de las zonas. Cada zona va como un círculo centrado en la mediana de sus accesiones
    # visibles (nunca las amenazadas ni EW), ajustado a una grilla de 5 m, con área proporcional a sus accesiones.
    # Con menos de 3 puntos visibles distintos no se dibuja: el círculo señalaría una planta.
    techos = []
    for f in con["features"]:
        g = f["geometry"]
        if g and g["type"] in ("Polygon", "MultiPolygon"):
            bx = caja(g)
            if bx[2] >= lx0 - m and bx[0] <= lx1 + m and bx[3] >= ly0 - m and bx[1] <= ly1 + m:
                techos.append((bx, g))
    techos.append((caja(g_trop), g_trop))

    def bajo_techo(x, y):
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] and en_geom(x, y, g) for b, g in techos)

    kx = 111320 * math.cos(math.radians(cy))
    ky = 110574.0
    gx, gy = 5 / kx, 5 / ky
    MUESTRAS = 8
    zonas_feats = []
    for z, rs in sorted(por_zona.items(), key=lambda kv: -len(kv[1])):
        vis = sorted({(round(r["x"], 6), round(r["y"], 6)) for r in rs if r["vis"]})
        cc = {}
        for r in rs:
            cc[r["c"]] = cc.get(r["c"], 0) + 1
        fz = sorted(r["f"] for r in rs if r["f"])
        nombre = zonas_nombre.get(z, z)
        geom, ccx, ccy, radio = None, None, None, None
        if len(vis) >= 3:
            xs, ys = sorted(p[0] for p in vis), sorted(p[1] for p in vis)
            mx, my = xs[len(xs) // 2], ys[len(ys) // 2]
            ccx, ccy = round(round(mx / gx) * gx, 6), round(round(my / gy) * gy, 6)
            while toca_sensible(ccx, ccy) or (ccx, ccy) in vis:
                ccx = round(ccx + gx, 6)
            radio = round(max(10.0, 1.2 * math.sqrt(len(rs))), 1)
            geom = {"type": "Point", "coordinates": [ccx, ccy]}
        # puntos de muestra para el sol: plantas visibles fuera de toda construcción, repartidos por la zona
        fuera = [p for p in vis if not bajo_techo(*p)]
        muestras = []
        if fuera:
            mx = sorted(p[0] for p in fuera)[len(fuera) // 2]
            my = sorted(p[1] for p in fuera)[len(fuera) // 2]
            muestras.append(min(fuera, key=lambda p: ((p[0] - mx) * kx) ** 2 + ((p[1] - my) * ky) ** 2))
            dmin = {p: ((p[0] - muestras[0][0]) * kx) ** 2 + ((p[1] - muestras[0][1]) * ky) ** 2 for p in fuera}
            while len(muestras) < min(MUESTRAS, len(fuera)):
                q = max(fuera, key=lambda p: dmin[p])
                if dmin[q] < 4:  # a menos de 2 m de otra muestra: ya no aporta
                    break
                muestras.append(q)
                for p in fuera:
                    dmin[p] = min(dmin[p], ((p[0] - q[0]) * kx) ** 2 + ((p[1] - q[1]) * ky) ** 2)
        zonas_feats.append({"type": "Feature", "geometry": geom, "properties": dict(
            z=z, nombre=nombre, n=len(rs), esp=len({r["e"] for r in rs}), fam=len({r["fa"] for r in rs}),
            amen=sum(cc.get(c, 0) for c in AMENAZA), ne=cc.get("NE", 0), ew=cc.get("EW", 0), cats=cc,
            nlote=sum(1 for r in rs if r["b"] & 1), nidrd=sum(1 for r in rs if r["b"] & 2),
            trop=("Tropicario" in nombre), fmin=fecha_ms(fz[0]) if fz else None, fmax=fecha_ms(fz[-1]) if fz else None,
            puntos_unicos=len({(r["x"], r["y"]) for r in rs if r["x"] is not None}), nvis=len(vis),
            cx=ccx, cy=ccy, r=radio, nfuera=len(fuera), m=[list(p) for p in muestras])})
    escribir("zonas.json", {"type": "FeatureCollection", "features": zonas_feats})

    # ---------- base: bordes, tropicario, calzadas ----------
    calz = cargar(CRUDO, "calzadas.json")
    calz_f = [{"type": "Feature", "geometry": redondear(f["geometry"], 6, 0.000006), "properties": {}}
              for f in calz["features"] if f.get("geometry")]
    orto = cargar(CRUDO, "ortoimagen.json")
    base = dict(
        generado=hoy,
        centro=[round(cx, 6), round(cy, 6)],
        bordes={k: dict(nombre=b["nombre"], fuente=b["fuente"], enlace=b["enlace"], oficial=b["oficial"],
                        area_m2=round(b["area"]), geom=redondear(b["geom"], 7)) for k, b in BORDES.items()},
        tropicario=dict(geom=redondear(g_trop, 7), bruta_m2=round(area_trop_bruta), neta_m2=round(area_trop_neta),
                        fuente="Construcciones, Catastro Bogotá (UAECD), CC BY 4.0"),
        calzadas={"type": "FeatureCollection", "features": calz_f},
        calzadas_fuente="Mapa de Referencia IDECA (calzadas), Catastro Bogotá, CC BY 4.0",
        calzadas_consulta=calz["consultado"][:10],
        ortoimagen=dict(ok=orto["ok"], probado=orto["consultado"][:10], servicio="Ortoimagen urbana 2025, IDECA"),
    )

    # ---------- sectores del Simón Bolívar ----------
    sec = cargar(CRUDO, "sectores_simon_bolivar.json")
    sfeats, area_tot = [], 0
    for f in sec["features"]:
        a = area_geom(f["geometry"])
        area_tot += a
        n = f["properties"]["arboles_censo"]
        nombre = limpiar_sector(f["properties"]["NOMBREPAR"])
        sfeats.append({"type": "Feature", "geometry": redondear(f["geometry"], 6, 0.000005), "properties": dict(
            id=f["properties"]["ID_PARQUE"], nombre=nombre, arboles=n, ha=round(a / 1e4, 2),
            densidad=round(n / (a / 1e4)), jardin=f["properties"]["ID_PARQUE"] == "10-291")})
    sfeats.sort(key=lambda f: -f["properties"]["densidad"])
    escribir("sectores.json", dict(consultado=sec["consultado"][:10], fuente="Parques de Bogotá, IDRD, Datos Abiertos Bogotá, CC BY 4.0",
                                   area_total_ha=round(area_tot / 1e4, 2), type="FeatureCollection", features=sfeats))

    # ---------- clima ----------
    chirps = []
    with open(os.path.join(CLIMA, "chirps_v3_mensual.csv")) as fh:
        for r in csv.DictReader(fh):
            chirps.append((r["mes"], float(r["mm_celda"])))
    por_mes = {}
    anios_completos = sorted({m[:4] for m, _ in chirps if sum(1 for mm, _ in chirps if mm[:4] == m[:4]) == 12})
    for m_, v in chirps:
        if m_[:4] in anios_completos:
            por_mes.setdefault(int(m_[5:]), []).append(v)
    clim = [round(sum(por_mes[i]) / len(por_mes[i]), 1) for i in range(1, 13)]
    power = cargar(CLIMA, "power_2025.json")
    # el archivo de POWER no trae fecha de consulta: se usa la fecha en que se bajó el archivo
    f_power = date.fromtimestamp(os.path.getmtime(os.path.join(CLIMA, "power_2025.json"))).isoformat()
    par = power["properties"]["parameter"]
    rad_m, nub_m = [0.0] * 12, [[] for _ in range(12)]
    for d, v in par["ALLSKY_SFC_SW_DWN"].items():
        if v != -999:
            rad_m[int(d[4:6]) - 1] += v
    for d, v in par["CLOUD_AMT"].items():
        if v != -999:
            nub_m[int(d[4:6]) - 1].append(v)
    rad_tot = sum(rad_m)
    nub_todos = [v for l in nub_m for v in l]
    metar = cargar(CRUDO, "metar_skbo.json")
    skbo = cargar(CRUDO, "skbo_estacion.json")
    gibs = cargar(CRUDO, "gibs.json")
    shutil.copyfile(os.path.join(CRUDO, "gibs.jpg"), os.path.join(SALIDA, "gibs.jpg"))
    dist_skbo = haversine(cx, cy, skbo["lon"], skbo["lat"])
    lo = metar["dato"]["last_ob"]
    clima = dict(
        chirps=dict(fuente="CHIRPS v3, Climate Hazards Center, UC Santa Barbara, CC BY 4.0", doi="10.15780/G2JQ0P",
                    celda="celda de 0,05° centrada en 4,675 N, 74,125 O", anios=f"{anios_completos[0]} a {anios_completos[-1]}",
                    climatologia=clim, ultimos=[[m_, round(v, 1)] for m_, v in chirps[-12:]], ultimo_mes=chirps[-1][0]),
        power=dict(fuente="NASA POWER (MERRA-2 y CERES SYN1deg), modelo, no medido",
                   anio=2025, punto="4,668 N, 74,1 O; celda de modelo con elevación de 1.790 m",
                   radiacion_mensual=[round(v, 1) for v in rad_m], radiacion_total=round(rad_tot, 1),
                   radiacion_diaria=round(rad_tot / 365, 2),
                   nubes_mensual=[round(sum(l) / len(l), 1) for l in nub_m], nubes_media=round(sum(nub_todos) / len(nub_todos), 1)),
        metar=dict(fuente="METAR SKBO (El Dorado) vía Iowa Environmental Mesonet, Iowa State University",
                   url="https://mesonet.agron.iastate.edu/json/current.py?station=SKBO&network=CO__ASOS",
                   distancia_km=round(dist_skbo / 1000, 1), copia=dict(utc=lo["utc_valid"], raw=lo["raw"],
                   t_f=lo.get("airtemp[F]"), td_f=lo.get("dewpointtemp[F]"), viento_kt=lo.get("windspeed[kt]"),
                   dir=lo.get("winddirection[deg]"))),
        gibs=dict(fuente="Imágenes de NASA Global Imagery Browse Services (GIBS), parte de ESDIS", capa=gibs["capa"],
                  fecha=gibs["fecha"], recuadro=gibs["recuadro"], archivo="gibs.jpg"),
    )
    escribir("clima.json", clima)

    # ---------- cifras con su estado ----------
    rl = resumen_censo(cen_b["lote"])
    ri = resumen_censo(cen_b["idrd"])
    nl = sum(1 for r in filas if r["b"] & 1)
    ni = sum(1 for r in filas if r["b"] & 2)
    al = sum(1 for r in filas if r["b"] & 1 and r["c"] in AMENAZA)
    ai = sum(1 for r in filas if r["b"] & 2 and r["c"] in AMENAZA)
    nel = sum(1 for r in filas if r["b"] & 1 and r["c"] == "NE")
    nei = sum(1 for r in filas if r["b"] & 2 and r["c"] == "NE")
    sec_j = [f for f in sfeats if f["properties"]["jardin"]][0]["properties"]
    sec_sig = [f for f in sfeats if not f["properties"]["jardin"]][0]["properties"]
    inat = cargar(CRUDO, "inaturalist.json")
    # sol cenital: días en que la declinación pasa más cerca de la latitud del centro del lote
    anio = 2026
    dias = [date.fromordinal(date(anio, 1, 1).toordinal() + i) for i in range(365)]
    difs = [(abs(declinacion(d) - cy), d) for d in dias]
    pri = min((x for x in difs if x[1].month < 7), key=lambda t: t[0])[1]
    seg = min((x for x in difs if x[1].month >= 7), key=lambda t: t[0])[1]
    MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    def fdia(d):
        return f"{d.day} {MESES[d.month - 1]}"
    def fiso(s):
        y, m_, d = s.split("-")
        return f"{int(d)} {MESES[int(m_) - 1]} {y}"
    F_COL = "Colecciones vivas, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0"
    F_CEN = "Censo del arbolado urbano, Jardín Botánico José Celestino Mutis, Datos Abiertos Bogotá, CC BY 4.0"
    F_CON = "Construcciones, Catastro Bogotá (UAECD), CC BY 4.0"
    fc = col["consultado"][:10]
    fce = cen["consultado"][:10]

    cifra("area_lote", "Área del lote catastral", num(BORDES["lote"]["area"]) + " m²", "medido", "Lotes, Catastro Bogotá (UAECD), CC BY 4.0", hoy, "195.211 m²", "área elipsoidal")
    cifra("area_idrd", "Área del parque IDRD 10-291", num(BORDES["idrd"]["area"] / 1e4, 2) + " ha", "medido", BORDES["idrd"]["fuente"], hoy, "19,54 ha", "área elipsoidal")
    cifra("col_puntos", "Accesiones en la colección viva (puntos)", num(n_col), "de fuente", F_COL, fc, "15.575")
    cifra("col_ids", "Identificadores de accesión distintos", num(len({r['id'] for r in filas})), "medido", F_COL, fc, "15.571", "cuatro identificadores se repiten")
    cifra("col_nombres", "Nombres de planta distintos", num(len([e for e in especies if e])), "medido", F_COL, fc, "2.328")
    cifra("col_familias", "Familias", num(len({r['fa'] for r in filas})), "medido", F_COL, fc, "202", "el campo trae 204 valores; ASPLENIACEAE y POLYPODIACEAE aparecen con código y también escritas con su nombre, así que son 202 familias")
    cifra("col_zonas", "Zonas de accesión con plantas", num(len(por_zona)), "medido", F_COL, fc, "53")
    cifra("col_fecha", "Fecha de carga de la colección", fiso(fecha_carga), "de fuente", F_COL, fc, "31 jul 2026", "todas las accesiones tienen la misma fecha: es la fecha de carga, no de observación")
    cifra("col_amen", "Accesiones amenazadas (CR, EN, VU)", num(n_amen), "medido", F_COL, fc, "1.947", "EW se cuenta aparte")
    cifra("col_ne", "Accesiones no evaluadas (NE)", num(cats.get("NE", 0)), "medido", F_COL, fc, "7.608")
    cifra("col_lote", "Accesiones dentro del lote", num(nl), "inferido", F_COL + "; Lotes, Catastro Bogotá (UAECD)", hoy, "15.574", "punto dentro de polígono")
    cifra("col_amen_lote", "Amenazadas dentro del lote", num(al), "inferido", F_COL, hoy, "1.946")
    cifra("col_idrd", "Accesiones dentro del IDRD 10-291", num(ni), "inferido", F_COL, hoy, "15.554")
    cifra("cen_lote", "Árboles del censo dentro del lote", num(rl["n"]), "inferido", F_CEN, hoy, "9.013")
    cifra("cen_idrd", "Árboles del censo dentro del IDRD 10-291", num(ri["n"]), "inferido", F_CEN, hoy, "9.005")
    dib_l = sum(1 for bb, xx in zip(ccols["b"], ccols["x"]) if bb & 1 and xx is not None)
    cifra("cen_dibujados_lote", "Árboles del censo dibujados dentro del lote", f"{num(dib_l)} de {num(rl['n'])}", "medido", F_CEN, hoy,
          None, "algunos árboles no se dibujan para proteger especies sensibles")
    cifra("cen_sinid_idrd", "Sin identificar (NN y Otro), IDRD", f"{num(ri['nn'])} y {num(ri['otro'])}; {num(ri['sin_id'])}; {num(ri['pct_sin_id'], 1)} %", "inferido", F_CEN, hoy, "4.461 y 699; 5.160; 57,3 %")
    cifra("cen_sinid_lote", "Sin identificar (NN y Otro), lote", f"{num(rl['nn'])} y {num(rl['otro'])}; {num(rl['sin_id'])}; {num(rl['pct_sin_id'], 1)} %", "inferido", F_CEN, hoy, "4.459 y 696; 5.155; 57,2 %")
    cifra("cen_altura", "Altura media del censo, IDRD", num(ri["altura_media"], 2) + " m", "medido", F_CEN, hoy, "7,05 m", "altura registrada en el censo")
    cifra("cen_fechas", "Fechas de los registros del censo, IDRD", f"{fiso(ri['fmin'])} a {fiso(ri['fmax'])}", "de fuente", F_CEN, fce, "25 may 2007 a 29 nov 2024")
    cifra("cen_ciudad", "Árboles del censo en toda Bogotá", num(cen["total_ciudad"]), "de fuente", F_CEN, fce, "1.471.916")
    cifra("cen_ficha", "Última modificación de la ficha del censo", fiso(cen["ficha"]["modificada"][:10]), "de fuente", "Datos Abiertos Bogotá", fce, "27 oct 2026")
    cifra("dens", "Árboles por hectárea, sector Jardín Botánico", num(sec_j["densidad"]) + " por ha", "inferido", F_CEN + "; " + BORDES["idrd"]["fuente"], hoy, "461 por ha")
    cifra("dens_sig", "Sector siguiente en densidad", f"{sec_sig['nombre']}, {num(sec_sig['densidad'])} por ha", "inferido", F_CEN, hoy, None)
    cifra("sb_area", "Área de los 19 sectores del Simón Bolívar", num(area_tot / 1e4, 2) + " ha", "medido", BORDES["idrd"]["fuente"], hoy, "332,48 ha", "área elipsoidal")
    cifra("con_dentro", "Construcciones de Catastro dentro del lote", f"{len(dentro_lote)}, {num(sum(d['area'] for d in dentro_lote))} m²", "medido", F_CON, hoy, "24, 6.777 m²", "centroide dentro; área elipsoidal")
    cifra("trop", "Huella del Tropicario en Catastro", f"{num(area_trop_bruta)} m² bruto, {num(area_trop_neta)} m² neto", "medido", F_CON, hoy, "2.755 m² bruto, 1.995 m² neto", "el interior no tiene datos abiertos")
    cifra("skbo", "Distancia del centro del lote a SKBO", num(dist_skbo / 1000, 1) + " km", "medido", "Coordenada de SKBO, Iowa Environmental Mesonet", hoy, "6,4 km", "en línea recta, desde el centroide del lote catastral")
    cifra("cenital", "Días de sol cenital", f"{fdia(pri)} y {fdia(seg)}", "inferido", "Algoritmo solar de la NOAA (siglos julianos), mediodía de Bogotá, año 2026", hoy, "1 abr y 10 sep", "la fórmula corta de Spencer da 2 abr y 11 sep; el algoritmo completo de la NOAA, para 2026, da un día antes en ambos casos")
    cifra("power_rad", "Radiación solar global 2025, modelo", num(rad_tot, 1) + " kWh/m²", "supuesto", "NASA POWER", f_power, "1.652,0 kWh/m²", "modelo de satélite y reanálisis, no medido en el jardín")
    cifra("power_nub", "Nubosidad media 2025, modelo", num(sum(nub_todos) / len(nub_todos), 1) + " %", "supuesto", "NASA POWER", f_power, "82,1 %", "modelo, no medido")
    cifra("inat", "Observaciones de iNaturalist con licencia apta", f"{num(inat['cc0'] + inat['ccby'])} (CC0 {num(inat['cc0'])}, CC BY {num(inat['ccby'])})", "de fuente", "iNaturalist", inat["consultado"][:10], None, "conteo de hoy; cambia a diario; no se muestran fotos")

    for c in cifras:
        if c["esperado"] is not None:
            c["coincide"] = c["valor"] == c["esperado"]
    escribir("cifras.json", dict(generado=hoy, cifras=cifras))

    base["resumen"] = dict(
        coleccion=dict(n=n_col, nombres=len([e for e in especies if e]), familias=len({r['fa'] for r in filas}), zonas=len(por_zona),
                       amen=n_amen, ne=cats.get("NE", 0), ew=cats.get("EW", 0), cats=cats, fecha_carga=fecha_carga,
                       consultado=fc, ocultas=ocultas, sin_punto_por_vecina=len(vecinas),
                       por_borde=dict(lote=dict(n=nl, amen=al, ne=nel), idrd=dict(n=ni, amen=ai, ne=nei))),
        censo=dict(por_borde=dict(lote=rl, idrd=ri), ciudad=cen["total_ciudad"], consultado=fce, sin_punto=cen_tapados,
                   ficha_modificada=cen["ficha"]["modificada"][:10]),
        construcciones=dict(dentro_lote=len(dentro_lote), m2=round(sum(d['area'] for d in dentro_lote))),
        sectores=dict(n=len(sfeats), densidad_jardin=sec_j["densidad"], siguiente=[sec_sig["nombre"], sec_sig["densidad"]],
                      area_ha=round(area_tot / 1e4, 2)),
        cenital=[pri.isoformat(), seg.isoformat()],
        inaturalist=dict(apta=inat["cc0"] + inat["ccby"], cc0=inat["cc0"], ccby=inat["ccby"], sin_licencia=inat["sin_licencia"],
                         consultado=inat["consultado"][:10]),
    )
    escribir("base.json", base)

    print("\nComparación con los valores esperados:")
    for c in cifras:
        if c["esperado"] is not None:
            print(("  OK  " if c["coincide"] else "  DIF ") + c["clave"], "|", c["valor"], "| esperado", c["esperado"])
        else:
            print("  --  " + c["clave"], "|", c["valor"])


if __name__ == "__main__":
    _ap = argparse.ArgumentParser()
    _ap.add_argument("--regla", choices=["1m", "v0"], default="1m")
    REGLA = _ap.parse_args().regla
    print(f"Regla de sensibles: {REGLA}")
    main()
