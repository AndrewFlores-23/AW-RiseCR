"""Genera el fondo de la cabecera de los correos del portal: el logo AW en grande, desvanecido y recortado,
para la esquina derecha de la cabecera (sobre el desvanecido cian).

Uso: python3 herramientas/correos/generar-cabecera.py [variante]
Sale en public/correo/cabecera-logo.png (400x176, se muestra a 200x88 en el correo).
Usa Playwright (ya instalado en la Mac) para dibujar con CSS y guardar un PNG con transparencia.
"""
import base64
import pathlib
import sys

from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parents[2]
LOGO = RAIZ / "public" / "aw-rise-logo-360.png"
SALIDA = RAIZ / "public" / "correo"

# Variantes: tamaño del logo, posición, opacidad y color
VARIANTES = {
    "blanco": {"alto": 210, "izq": 52, "arriba": -58, "opacidad": 0.20, "filtro": "brightness(0) invert(1)"},
    "neon": {"alto": 210, "izq": 52, "arriba": -58, "opacidad": 0.34, "filtro": "brightness(1.25) saturate(1.2)"},
    "grande": {"alto": 280, "izq": 40, "arriba": -96, "opacidad": 0.26, "filtro": "brightness(0) invert(1)"},
}


def generar(nombre, v, destino):
    logo = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()
    html = f"""<!doctype html><html><head><style>
      html, body {{ margin: 0; background: transparent; }}
      #pieza {{ position: relative; width: 200px; height: 88px; overflow: hidden;
        /* entra desvanecido desde la izquierda: solo se ve un pedazo del logo */
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%);
        mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%); }}
      #pieza img {{ position: absolute; left: {v['izq']}px; top: {v['arriba']}px; height: {v['alto']}px;
        opacity: {v['opacidad']}; filter: {v['filtro']}; }}
    </style></head><body><div id="pieza"><img src="{logo}" alt=""></div></body></html>"""
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page(device_scale_factor=2, viewport={"width": 200, "height": 88})
        pagina.set_content(html)
        pagina.locator("#pieza").screenshot(path=str(destino), omit_background=True)
        navegador.close()


# ---------- Cabecera completa: el espacio, la constelación de conexiones, el logo neón y el horizonte del planeta ----------
# La cabecera es el espacio; el cuerpo blanco del correo es un planeta de luz visto desde arriba.
ANCHO, ALTO = 560, 88          # zona del logo y el nombre
HORIZONTE = 64                 # el planeta (horizonte, atmósfera y luces) ocupa esta franja de abajo
ALTO_TOTAL = ALTO + HORIZONTE  # 152: la última fila es blanca y se une con el cuerpo del correo
# Geometría del planeta (elipse enorme): centro, radios y la cima del horizonte
PLANETA = {"cx": 280, "cima": 94, "rx": 640, "ry": 250}
INICIO_RED = 250               # la red nace a la derecha y se apaga antes de esta línea: no toca el logo ni el nombre
ZONA_LIBRE = (16, 10, 270, 80) # x1, y1, x2, y2: sin estrellas detrás del logo y el nombre


def red_svg(semilla=7, puntos=40):
    """Constelación de nodos y líneas (siempre igual gracias a la semilla): sale de la derecha hacia la izquierda."""
    import math
    import random
    azar = random.Random(semilla)
    nodos = []
    for _ in range(puntos):
        x = INICIO_RED - 20 + (azar.random() ** 0.6) * (ANCHO + 40 - INICIO_RED)  # más densa hacia la derecha
        y = azar.uniform(-12, ALTO + 8)
        nodos.append((x, y))
    lineas = set()
    for i, (x, y) in enumerate(nodos):
        cercanos = sorted(((math.hypot(x - a, y - b), j) for j, (a, b) in enumerate(nodos) if j != i))[:3]
        for d, j in cercanos:
            if d < 95:
                lineas.add(tuple(sorted((i, j))))
    trazos = "".join(f'<line x1="{nodos[i][0]:.1f}" y1="{nodos[i][1]:.1f}" x2="{nodos[j][0]:.1f}" y2="{nodos[j][1]:.1f}"/>' for i, j in lineas)
    puntos_svg = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{(2.2 if k % 5 == 0 else 1.4)}" class="{"brillo" if k % 5 == 0 else ""}"/>'
        for k, (x, y) in enumerate(nodos))
    return f"""<svg width="{ANCHO}" height="{ALTO_TOTAL}" viewBox="0 0 {ANCHO} {ALTO_TOTAL}" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#4cc2ff" stroke-opacity=".38" stroke-width=".8">{trazos}</g>
      <g fill="#9fe2ff" fill-opacity=".85">{puntos_svg}</g></svg>"""


def estrellas_svg(semilla=21, cantidad=70):
    """Estrellas pequeñas y tenues en el espacio, fuera de la zona del logo y el nombre."""
    import random
    azar = random.Random(semilla)
    x1, y1, x2, y2 = ZONA_LIBRE
    puntos = []
    while len(puntos) < cantidad:
        x, y = azar.uniform(0, ANCHO), azar.uniform(0, ALTO + 6)
        if x1 <= x <= x2 and y1 <= y <= y2:
            continue
        puntos.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{azar.uniform(.35, 1.05):.2f}" fill="#ffffff" fill-opacity="{azar.uniform(.25, .85):.2f}"/>')
    return f'<svg width="{ANCHO}" height="{ALTO_TOTAL}" viewBox="0 0 {ANCHO} {ALTO_TOTAL}" xmlns="http://www.w3.org/2000/svg">{"".join(puntos)}</svg>'


def horizonte_y(x):
    """Altura del borde del planeta en la posición x."""
    import math
    cx, cima, rx, ry = PLANETA["cx"], PLANETA["cima"], PLANETA["rx"], PLANETA["ry"]
    return cima + ry - ry * math.sqrt(max(0.0, 1 - ((x - cx) / rx) ** 2))


def planeta_svg():
    """El planeta de luz, sencillo: horizonte curvo con su atmósfera celeste. Sin luces ni adornos."""
    cx, cima, rx, ry = PLANETA["cx"], PLANETA["cima"], PLANETA["rx"], PLANETA["ry"]
    cy = cima + ry
    return f"""<svg width="{ANCHO}" height="{ALTO_TOTAL}" viewBox="0 0 {ANCHO} {ALTO_TOTAL}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="b3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
        <filter id="b8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="b14" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
        <linearGradient id="cierre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      </defs>
      <!-- atmósfera: resplandor amplio y otro más cercano al borde -->
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#1167e8" stroke-opacity=".55" stroke-width="34" filter="url(#b14)"/>
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#4cc2ff" stroke-opacity=".85" stroke-width="12" filter="url(#b8)"/>
      <!-- superficie: celeste cerca del horizonte y blanco hacia adentro -->
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#2f86d9"/>
      <ellipse cx="{cx}" cy="{cy + 10}" rx="{rx}" ry="{ry}" fill="#a9d8fb" filter="url(#b3)"/>
      <ellipse cx="{cx}" cy="{cy + 25}" rx="{rx}" ry="{ry}" fill="#ffffff" filter="url(#b8)"/>
      <!-- línea del horizonte -->
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#eaf8ff" stroke-opacity=".95" stroke-width="1.6"/>
      <!-- las últimas filas terminan en blanco puro: se unen con el cuerpo del correo sin línea -->
      <rect x="0" y="{ALTO_TOTAL - 16}" width="{ANCHO}" height="16" fill="url(#cierre)"/>
    </svg>"""


def generar_cabecera(destino, semilla=7):
    logo = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()
    v = VARIANTES["neon"]
    html = f"""<!doctype html><html><head><style>
      html, body {{ margin: 0; background: #ffffff; }}
      #cabecera {{ position: relative; width: {ANCHO}px; height: {ALTO_TOTAL}px; overflow: hidden;
        background: linear-gradient(90deg, #061633 0%, #061633 38%, #0a4a86 75%, #1e9fe0 100%); }}
      .capa {{ position: absolute; inset: 0; }}
      #estrellas {{ opacity: .9; }}
      #red {{ -webkit-mask-image: linear-gradient(90deg, transparent 0%, transparent {INICIO_RED / ANCHO * 100:.0f}%, rgba(0,0,0,.5) 62%, #000 88%);
        mask-image: linear-gradient(90deg, transparent 0%, transparent {INICIO_RED / ANCHO * 100:.0f}%, rgba(0,0,0,.5) 62%, #000 88%); }}
      #red .brillo {{ filter: drop-shadow(0 0 3px #4cc2ff); }}
      #logo {{ position: absolute; right: 0; top: 0; width: 200px; height: {ALTO_TOTAL}px; overflow: hidden;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%);
        mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%); }}
      #logo img {{ position: absolute; left: {v['izq']}px; top: {v['arriba']}px; height: {v['alto']}px;
        opacity: {v['opacidad']}; filter: {v['filtro']}; }}
    </style></head><body><div id="cabecera">
      <div id="estrellas" class="capa">{estrellas_svg()}</div>
      <div id="red" class="capa">{red_svg(semilla)}</div>
      <div id="logo"><img src="{logo}" alt=""></div>
      <div class="capa">{planeta_svg()}</div></div></body></html>"""
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page(device_scale_factor=2, viewport={"width": ANCHO, "height": ALTO_TOTAL})
        pagina.set_content(html)
        pagina.locator("#cabecera").screenshot(path=str(destino))
        navegador.close()


# ---------- Pie: la parte de abajo del planeta y el espacio con estrellas ----------
ALTO_PIE = 364   # alto del pie: la curva del planeta (64 px) y un espacio alto (300 px) que cubre el texto aunque ocupe muchas líneas
APICE_PIE = 50   # punto más bajo de la curva del planeta (al centro); en los costados queda unos 24 px más arriba


def pie_svg(semilla=33, estrellas=40):
    import random
    azar = random.Random(semilla)
    cx, rx, ry = PLANETA["cx"], PLANETA["rx"], PLANETA["ry"]
    cy = APICE_PIE - ry  # el planeta queda arriba: solo se ve su borde inferior
    puntos = []
    while len(puntos) < estrellas:
        x, y = azar.uniform(0, ANCHO), azar.uniform(APICE_PIE + 10, ALTO_PIE)
        if y < horizonte_pie(x) + 8:
            continue
        centro = 70 < x < ANCHO - 70  # en el centro (donde va el texto) las estrellas son más tenues
        puntos.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{azar.uniform(.35, 1):.2f}" fill="#ffffff" '
                      f'fill-opacity="{azar.uniform(.15, .4) if centro else azar.uniform(.35, .85):.2f}"/>')
    return f"""<svg width="{ANCHO}" height="{ALTO_PIE}" viewBox="0 0 {ANCHO} {ALTO_PIE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="p3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
        <filter id="p8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="p14" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
        <linearGradient id="abre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
      </defs>
      {"".join(puntos)}
      <!-- atmósfera bajo el borde del planeta -->
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#1167e8" stroke-opacity=".55" stroke-width="34" filter="url(#p14)"/>
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#4cc2ff" stroke-opacity=".85" stroke-width="12" filter="url(#p8)"/>
      <!-- superficie: blanco arriba (se une con el cuerpo del correo) y celeste cerca del borde -->
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#2f86d9"/>
      <ellipse cx="{cx}" cy="{cy - 10}" rx="{rx}" ry="{ry}" fill="#a9d8fb" filter="url(#p3)"/>
      <ellipse cx="{cx}" cy="{cy - 25}" rx="{rx}" ry="{ry}" fill="#ffffff" filter="url(#p8)"/>
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#eaf8ff" stroke-opacity=".95" stroke-width="1.6"/>
      <!-- las primeras filas son blanco puro: se unen con el cuerpo del correo sin línea -->
      <rect x="0" y="0" width="{ANCHO}" height="14" fill="url(#abre)"/>
    </svg>"""


def horizonte_pie(x):
    import math
    cx, rx, ry = PLANETA["cx"], PLANETA["rx"], PLANETA["ry"]
    return APICE_PIE - ry + ry * math.sqrt(max(0.0, 1 - ((x - cx) / rx) ** 2))


def generar_pie(destino):
    html = f"""<!doctype html><html><head><style>
      html, body {{ margin: 0; background: #ffffff; }}
      /* el espacio: mismo desvanecido de la cabecera, más oscuro hacia abajo (donde va el texto) */
      #pie {{ position: relative; width: {ANCHO}px; height: {ALTO_PIE}px; overflow: hidden;
        background: linear-gradient(180deg, rgba(6,22,51,0) 30%, #061633 100%),
                    linear-gradient(90deg, #061633 0%, #061633 38%, #0a4a86 75%, #1e9fe0 100%); }}
      #pie svg {{ position: absolute; inset: 0; }}
    </style></head><body><div id="pie">{pie_svg()}</div></body></html>"""
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page(device_scale_factor=2, viewport={"width": ANCHO, "height": ALTO_PIE})
        pagina.set_content(html)
        pagina.locator("#pie").screenshot(path=str(destino))
        navegador.close()


# ---------- Versión que se adapta al modo oscuro de Gmail ----------
# Gmail en el celular cambia los colores del correo (fondo blanco → negro, texto blanco → oscuro), pero no toca las imágenes.
# Por eso: el logo y el nombre van dentro de la imagen, y el planeta es transparente (toma el color del cuerpo:
# blanco en modo claro, oscuro en modo oscuro). La cabecera y el pie se parten en dos filas cada uno.
CORTE = 88  # la cabecera se parte aquí: arriba el espacio (fondo azul) y abajo el horizonte (fondo del cuerpo)


def elipse_path(cx, cy, rx, ry):
    return f"M{cx - rx},{cy} A{rx},{ry} 0 1,0 {cx + rx},{cy} A{rx},{ry} 0 1,0 {cx - rx},{cy} Z"


def mascara_sin_planeta(ancho, alto, cy):
    """Máscara CSS: todo visible menos el interior del planeta (que queda transparente)."""
    import urllib.parse
    cx, rx, ry = PLANETA["cx"], PLANETA["rx"], PLANETA["ry"]
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{ancho}" height="{alto}">'
           f'<path fill-rule="evenodd" fill="#fff" d="M0,0 H{ancho} V{alto} H0 Z {elipse_path(cx, cy, rx, ry)}"/></svg>')
    return "url(\"data:image/svg+xml," + urllib.parse.quote(svg) + "\")"


def atmosfera_svg(ancho, alto, cy):
    """Resplandor alrededor del borde, un tinte celeste que entra un poco al planeta y la línea del horizonte."""
    cx, rx, ry = PLANETA["cx"], PLANETA["rx"], PLANETA["ry"]
    return f"""<svg width="{ancho}" height="{alto}" viewBox="0 0 {ancho} {alto}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="a6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="a8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="a14" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
        <clipPath id="dentro"><path d="{elipse_path(cx, cy, rx, ry)}"/></clipPath>
        <mask id="fuera"><rect width="{ancho}" height="{alto}" fill="#fff"/><path d="{elipse_path(cx, cy, rx, ry)}" fill="#000"/></mask>
      </defs>
      <g mask="url(#fuera)">
        <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#1167e8" stroke-opacity=".6" stroke-width="34" filter="url(#a14)"/>
        <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#4cc2ff" stroke-opacity=".9" stroke-width="12" filter="url(#a8)"/>
      </g>
      <g clip-path="url(#dentro)">
        <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#4cc2ff" stroke-opacity=".55" stroke-width="22" filter="url(#a6)"/>
      </g>
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#eaf8ff" stroke-opacity=".95" stroke-width="1.6"/>
    </svg>"""


def marca_html():
    """Logo y nombre dentro de la imagen: así Gmail no les cambia el color."""
    logo = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()
    return f"""<div style="position:absolute; left:28px; top:22px; display:flex; align-items:center; gap:12px;">
      <img src="{logo}" style="width:44px; height:44px; display:block;">
      <div><div style="color:#f5f9ff; font:700 17px -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; line-height:1.2;">AW-RiseCR</div>
        <div style="color:#4cc2ff; font:700 11px Menlo, Consolas, monospace; letter-spacing:2px; text-transform:uppercase; margin-top:2px;">Portal de clientes</div></div></div>"""


def escena(alto, cy, contenido_espacio):
    estilo_espacio = f"position:absolute; inset:0; overflow:hidden; background:linear-gradient(90deg, #061633 0%, #061633 38%, #0a4a86 75%, #1e9fe0 100%);"
    mascara = mascara_sin_planeta(ANCHO, alto, cy)
    return f"""<!doctype html><html><head><style>
      html, body {{ margin: 0; background: transparent; }}
      #escena {{ position: relative; width: {ANCHO}px; height: {alto}px; overflow: hidden; }}
      #espacio {{ {estilo_espacio} -webkit-mask-image: {mascara}; mask-image: {mascara}; }}
      .capa {{ position: absolute; inset: 0; }}
      #red {{ -webkit-mask-image: linear-gradient(90deg, transparent 0%, transparent {INICIO_RED / ANCHO * 100:.0f}%, rgba(0,0,0,.5) 62%, #000 88%);
        mask-image: linear-gradient(90deg, transparent 0%, transparent {INICIO_RED / ANCHO * 100:.0f}%, rgba(0,0,0,.5) 62%, #000 88%); }}
      #red .brillo {{ filter: drop-shadow(0 0 3px #4cc2ff); }}
    </style></head><body><div id="escena"><div id="espacio">{contenido_espacio}</div>
      <div class="capa">{atmosfera_svg(ANCHO, alto, cy)}</div></div></body></html>"""


def fotografiar(html, alto, cortes):
    """Toma la escena y la corta en franjas: [(destino, y_inicio, y_fin), ...] con transparencia."""
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page(device_scale_factor=2, viewport={"width": ANCHO, "height": alto})
        pagina.set_content(html)
        pagina.wait_for_timeout(200)
        for destino, y1, y2 in cortes:
            pagina.screenshot(path=str(destino), omit_background=True, clip={"x": 0, "y": y1, "width": ANCHO, "height": y2 - y1})
        navegador.close()


def generar_adaptables():
    SALIDA.mkdir(parents=True, exist_ok=True)
    v = VARIANTES["neon"]
    logo = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()
    logo_grande = f"""<div style="position:absolute; right:0; top:0; width:200px; height:{ALTO_TOTAL}px; overflow:hidden;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%);
        mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%);">
        <img src="{logo}" style="position:absolute; left:{v['izq']}px; top:{v['arriba']}px; height:{v['alto']}px; opacity:{v['opacidad']}; filter:{v['filtro']};"></div>"""
    cy_cabecera = PLANETA["cima"] + PLANETA["ry"]
    cabecera = escena(ALTO_TOTAL, cy_cabecera,
                      f'<div class="capa" style="opacity:.9">{estrellas_svg()}</div><div id="red" class="capa">{red_svg()}</div>{logo_grande}{marca_html()}')
    fotografiar(cabecera, ALTO_TOTAL, [(SALIDA / "cabecera-arriba.png", 0, CORTE), (SALIDA / "cabecera-horizonte.png", CORTE, ALTO_TOTAL)])
    cy_pie = APICE_PIE - PLANETA["ry"]
    import random
    azar = random.Random(33)
    estrellas = []
    while len(estrellas) < 70:
        x, y = azar.uniform(0, ANCHO), azar.uniform(APICE_PIE + 10, ALTO_PIE)
        if y < horizonte_pie(x) + 8:
            continue
        centro = 70 < x < ANCHO - 70
        estrellas.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{azar.uniform(.35, 1):.2f}" fill="#fff" fill-opacity="{azar.uniform(.15, .4) if centro else azar.uniform(.35, .85):.2f}"/>')
    pie = escena(ALTO_PIE, cy_pie,
                 f'<div class="capa" style="background:linear-gradient(180deg, rgba(6,22,51,0) 30%, #061633 100%)"></div>'
                 f'<svg class="capa" width="{ANCHO}" height="{ALTO_PIE}" xmlns="http://www.w3.org/2000/svg">{"".join(estrellas)}</svg>')
    # Nombre con versión: Gmail guarda copias de las imágenes, así se usa la nueva
    fotografiar(pie, ALTO_PIE, [(SALIDA / "pie-horizonte-v2.png", 0, CORTE_PIE), (SALIDA / "pie-espacio-v2.png", CORTE_PIE, ALTO_PIE)])


CORTE_PIE = 64  # el pie se parte aquí: arriba el horizonte (fondo del cuerpo) y abajo el espacio con el texto


if __name__ == "__main__":
    if sys.argv[1:2] == ["adaptables"]:
        generar_adaptables()
        print("listo: cabecera-arriba, cabecera-horizonte, pie-horizonte, pie-espacio")
        sys.exit()
    if sys.argv[1:2] == ["pie"]:
        SALIDA.mkdir(parents=True, exist_ok=True)
        generar_pie(SALIDA / "pie-portal.png")
        print("listo: public/correo/pie-portal.png")
        sys.exit()
    if sys.argv[1:2] == ["cabecera"]:
        SALIDA.mkdir(parents=True, exist_ok=True)
        generar_cabecera(SALIDA / "cabecera-portal.png")
        print("listo: public/correo/cabecera-portal.png")
        sys.exit()
    SALIDA.mkdir(parents=True, exist_ok=True)
    elegidas = sys.argv[1:] or ["blanco"]
    for nombre in elegidas:
        destino = SALIDA / ("cabecera-logo.png" if len(elegidas) == 1 else f"cabecera-logo-{nombre}.png")
        generar(nombre, VARIANTES[nombre], destino)
        print("listo:", destino.relative_to(RAIZ))
