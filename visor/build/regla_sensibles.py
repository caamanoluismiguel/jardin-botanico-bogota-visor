"""Regla de puntos sensibles, compartida por construir.py y por las dos comprobaciones (v0 y visor 3D).

Sensibles: accesiones de la colección viva en categoría CR, EN, VU o EW con coordenada.

Regla «1m» (la vigente desde el 6 nov 2026). Un árbol del censo o una
accesión visible NO lleva punto si:
  * está a RADIO_CUALQUIERA m o menos de cualquier accesión sensible, o
  * está a RADIO_TAXON m o menos de una accesión sensible de su mismo género, o
  * tiene nombre pero no se le conoce el género (nombre común fuera de la tabla o sin nombre científico)
    y está a RADIO_TAXON m o menos de cualquier accesión sensible: se trata como compatible.
NN y «Otro» no tienen nombre de especie, así que solo les aplica la primera condición.
El género del censo sale de arquetipos.csv (nombre común a nombre científico probable).

Regla «v0» (la anterior, para revertir): 1 millonésima de grado o menos en cada eje (unos 11 cm).

Distancias en metros con la proyección local del v0: 111.320·cos(lat) m por grado de longitud y
110.574 m por grado de latitud. Solo biblioteca estándar.
"""
import csv, json, math, os, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
SENS = {"CR", "EN", "VU", "EW"}
RADIO_CUALQUIERA = 1.0   # m
RADIO_TAXON = 20.0       # m
REGLAS = ("1m", "v0")
SIN_NOMBRE = {"", "nn", "otro"}
KY = 110574.0
CELDA = 5.0  # m, rejilla de búsqueda


def genero(nombre_cientifico):
    """Primer epíteto en minúsculas y sin tildes ('Ceroxylon sp.' -> 'ceroxylon'); '' si no hay."""
    s = unicodedata.normalize("NFD", nombre_cientifico or "").encode("ascii", "ignore").decode().strip().lower()
    partes = [p for p in s.replace("×", " ").split() if p not in ("x",)]
    return partes[0].strip(".,") if partes else ""


def tabla_generos():
    """Nombre común del censo -> género probable, de la tabla de arquetipos (borrador sin revisión humana)."""
    for ruta in (os.path.join(RAIZ, "visor3d", "build", "arquetipos.csv"), os.path.join(AQUI, "arquetipos.csv")):
        if os.path.exists(ruta):
            with open(ruta, newline="", encoding="utf8") as f:
                return {fila["nombre_comun"].strip(): genero(fila.get("nombre_cientifico_probable", ""))
                        for fila in csv.DictReader(f)}
    raise SystemExit("FALLA: falta arquetipos.csv; sin la tabla de géneros la regla de sensibles no se puede aplicar")


def sensibles_crudos():
    """Lista de (lon, lat, género, categoría) de las accesiones sensibles del dato crudo."""
    with open(os.path.join(RAIZ, "datos-crudos", "visor", "coleccion_puntos.json")) as f:
        col = json.load(f)
    out = []
    for ft in col["features"]:
        g = ft.get("g") or {}
        cat = ft["a"].get("CategoriaConservacion")
        if cat in SENS and g.get("x") is not None:
            out.append((g["x"], g["y"], genero(ft["a"].get("Nombre_esp")), cat))
    return out


class Regla:
    def __init__(self, sensibles, regla="1m", lat_ref=4.668):
        if regla not in REGLAS:
            raise SystemExit(f"regla desconocida: {regla}")
        self.regla = regla
        self.kx = 111320 * math.cos(math.radians(lat_ref))
        self.pts_u = {(round(x * 1e6), round(y * 1e6)) for x, y, *_ in sensibles}
        self.rej = {}
        for x, y, g, c in sensibles:
            mx, my = x * self.kx, y * KY
            self.rej.setdefault((int(mx // CELDA), int(my // CELDA)), []).append((mx, my, g))

    def _cerca(self, lon, lat, radio):
        mx, my = lon * self.kx, lat * KY
        k = int(radio // CELDA) + 1
        cx, cy = int(mx // CELDA), int(my // CELDA)
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                for sx, sy, sg in self.rej.get((cx + dx, cy + dy), ()):
                    d = math.hypot(sx - mx, sy - my)
                    if d <= radio:
                        yield d, sg

    def v0(self, lon, lat):
        ix, iy = round(lon * 1e6), round(lat * 1e6)
        return any((ix + dx, iy + dy) in self.pts_u for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    def motivo(self, lon, lat, gen="", nombrado=False):
        """Devuelve None si el punto se puede servir, o un texto con la condición que lo impide.
        gen: género del punto ('' si no se conoce). nombrado: tiene nombre de especie (no NN ni «Otro»)."""
        if self.regla == "v0":
            return "a 1 millonésima de grado de una sensible" if self.v0(lon, lat) else None
        for d, sg in self._cerca(lon, lat, max(RADIO_CUALQUIERA, RADIO_TAXON)):
            if d <= RADIO_CUALQUIERA:
                return f"a {d:.2f} m de una sensible"
            if gen and gen == sg:
                return f"a {d:.2f} m de una sensible del mismo género ({gen})"
            if nombrado and not gen:
                return f"a {d:.2f} m de una sensible, con taxón desconocido"
        return None

    def protegido(self, lon, lat, gen="", nombrado=False):
        return self.motivo(lon, lat, gen, nombrado) is not None

    def cerca_cualquiera(self, lon, lat, radio=RADIO_CUALQUIERA):
        if self.regla == "v0":
            return self.v0(lon, lat)
        return any(True for _ in self._cerca(lon, lat, radio))


def nombrado_censo(nombre):
    return (nombre or "").strip().lower() not in SIN_NOMBRE


def es_tabla(o):
    """Una tabla por columnas servida (censo.json o accesiones.json del v0, copiadas al 3D)."""
    return (isinstance(o, dict) and isinstance(o.get("cols"), dict) and isinstance(o.get("origen"), list)
            and o.get("escala") and "x" in o["cols"] and "y" in o["cols"] and isinstance(o.get("especies"), list))


def puntos_tabla(o, generos):
    """(lon, lat, género, nombrado, categoría, índice) de cada fila con punto de una tabla servida.
    Censo (trae k): el género sale de la tabla de nombres comunes. Accesión (trae c): del nombre científico."""
    c, esp = o["cols"], o["especies"]
    ox, oy = o["origen"]; s = o["escala"]
    for i, (x, y) in enumerate(zip(c["x"], c["y"])):
        if x is None or y is None:
            continue
        nom = esp[c["e"][i]] if "e" in c and c["e"][i] is not None else ""
        if "k" in c:
            gen, nombrado = generos.get(nom, ""), nombrado_censo(nom)
        else:
            gen, nombrado = genero(nom), bool((nom or "").strip())
        yield ox + x * s, oy + y * s, gen, nombrado, (c.get("c") or [None] * (i + 1))[i], i


def revisar_tabla(o, rel, regla, generos):
    """Lista de fallas de la regla en una tabla servida: una sensible con punto, o un punto que la regla quita."""
    malos = []
    for lon, lat, gen, nombrado, cat, i in puntos_tabla(o, generos):
        if cat in SENS:
            malos.append(f"{rel}.cols[{i}] es una accesión {cat} con punto")
            continue
        m = regla.motivo(lon, lat, gen, nombrado)
        if m:
            malos.append(f"{rel}.cols[{i}] {m}")
    return malos


def casos_negativos(sensibles, filas, origen, escala):
    """Tres plantas falsas para la prueba negativa de las comprobaciones, ya cuantizadas al paso servido.
    filas: lista de (índice, género, nombrado) de árboles servidos. Devuelve [(nombre, índice, lon, lat)]:
      1. un árbol sobre el punto de una accesión EN (lo ve también la regla v0),
      2. un árbol sin especie (NN) a 0,8 m de una sensible (la regla v0 no lo ve),
      3. un árbol con nombre a 8 m de una sensible de su mismo género y a más de 1 m de toda otra
         sensible (la regla v0 no lo ve, y sin la condición de taxón tampoco)."""
    regla, vieja = Regla(sensibles, "1m"), Regla(sensibles, "v0")
    ox, oy = origen

    def q(lon, lat):
        return ox + round((lon - ox) / escala) * escala, oy + round((lat - oy) / escala) * escala

    def desplazar(lon, lat, d, ang):
        return q(lon + d * math.cos(ang) / regla.kx, lat + d * math.sin(ang) / KY)

    angulos = [k * math.pi / 8 for k in range(16)]
    en = next(s for s in sensibles if s[3] == "EN")
    casos = [("árbol sobre una accesión EN", filas[0][0]) + q(en[0], en[1])]
    nn = next(i for i, g, nombrado in filas if not nombrado)
    for s in sensibles:
        p = next((desplazar(s[0], s[1], 0.8, a) for a in angulos
                  if regla.motivo(*desplazar(s[0], s[1], 0.8, a)) and not vieja.v0(*desplazar(s[0], s[1], 0.8, a))), None)
        if p:
            casos.append(("árbol NN a 0,8 m de una sensible", nn) + p)
            break
    hecho = False
    for i, g, nombrado in filas:
        if hecho or not (g and nombrado):
            continue
        for s in sensibles:
            if s[2] != g:
                continue
            for a in angulos:
                p = desplazar(s[0], s[1], 8.0, a)
                if (not regla.cerca_cualquiera(*p) and regla.motivo(p[0], p[1]) is None
                        and regla.motivo(p[0], p[1], g, True) and not vieja.v0(*p)):
                    casos.append((f"árbol de {g} a 8 m de una sensible de su mismo género", i) + p)
                    hecho = True
                    break
            if hecho:
                break
    if len(casos) != 3:
        raise SystemExit(f"FALLA: la prueba negativa no pudo armar sus 3 casos ({[c[0] for c in casos]})")
    return casos
