#!/usr/bin/env python3
"""Respaldo cifrado del portal AW-RiseCR → repositorio privado aw-portal-respaldos (GitHub).

Uso:
  python3 respaldar.py                         saca un respaldo nuevo, lo cifra y lo sube a GitHub
  python3 respaldar.py restaurar               descifra el último respaldo en una carpeta local
  python3 respaldar.py restaurar 2026-10-06_0930   descifra ese respaldo
  python3 respaldar.py recuperar [AAAA-MM-DD_HHMM] [--cliente "Nombre"]
                                               vuelve a cargar en Supabase lo que falte (todo o un cliente),
                                               con sus mismos ids, usuarios y archivos
  python3 respaldar.py eliminar "Nombre"       borra un cliente completo (datos, usuarios, archivos y su actividad);
                                               pide escribir el nombre para confirmar

Te pide, sin mostrarlos en pantalla:
  - la llave secreta de Supabase "respaldos" (Project Settings → API Keys → Secret keys)
  - la frase de cifrado de los respaldos (guárdala en Bitwarden)
Ninguna de las dos se guarda en disco ni en el repositorio. Sin la frase, los respaldos no se pueden abrir.

Respaldo automático: GitHub Actions lo corre cada semana en el repositorio privado (.github/workflows/respaldo.yml).
Ahí la llave y la frase llegan desde los secrets del repositorio, en AW_SUPABASE_LLAVE y AW_RESPALDOS_FRASE.

Solo usa lo que ya trae la computadora: Python 3 y OpenSSL (en Windows, el que viene con Git).
"""
import datetime
import getpass
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROYECTO = "gppltlberzswfufgrhif"
URL = f"https://{PROYECTO}.supabase.co"
BUCKET = "portal"
REPO_REMOTO = "https://github.com/AndrewFlores-23/aw-portal-respaldos.git"
AQUI = Path(__file__).resolve()
CARPETA = Path(os.environ.get("AW_RESPALDOS_DIR") or AQUI.parents[3] / "aw-portal-respaldos")
MIGRACIONES = AQUI.parents[2] / "supabase" / "migrations"
# Tabla → columna para ordenar (paginación estable)
TABLAS = {
    "negocios": "id", "perfiles": "id", "contactos": "negocio_id", "servicios": "id", "proyectos": "id",
    "bitacora": "id", "documentos": "id", "adjuntos": "id", "cobros": "id", "fondo_movimientos": "id",
    "accesos": "id", "ajustes": "clave", "actividad": "id",
}
# Tablas que cuelgan de un cliente (columna negocio_id)
POR_NEGOCIO = ["contactos", "servicios", "proyectos", "bitacora", "documentos", "adjuntos", "cobros", "fondo_movimientos", "accesos"]
VERIFICADOR = "AW-RiseCR · respaldos del portal · v1"
# En GitHub Actions la llave y la frase vienen de los secrets del repositorio privado (nunca del código ni del registro)
AUTOMATICO = bool(os.environ.get("AW_SUPABASE_LLAVE", "").strip() and os.environ.get("AW_RESPALDOS_FRASE", "").strip())
EN_GITHUB = os.environ.get("GITHUB_ACTIONS") == "true"
ITERACIONES = "600000"


def avisar(texto):
    print(texto, flush=True)


def salir(texto):
    print(f"\n✗ {texto}", file=sys.stderr)
    sys.exit(1)


# ---------- OpenSSL (AES-256 con clave derivada de la frase, PBKDF2 de 600.000 vueltas) ----------
def openssl():
    ruta = shutil.which("openssl")
    if not ruta and os.name == "nt":
        for candidato in (r"C:\Program Files\Git\usr\bin\openssl.exe", r"C:\Program Files (x86)\Git\usr\bin\openssl.exe"):
            if Path(candidato).exists():
                ruta = candidato
    if not ruta:
        salir("No encontré OpenSSL. En Windows instala Git for Windows; en Mac ya viene incluido.")
    return ruta


def cifrar(entrada, salida, frase):
    # La frase va por la entrada estándar, nunca en la línea de comandos
    r = subprocess.run([openssl(), "enc", "-aes-256-cbc", "-pbkdf2", "-iter", ITERACIONES, "-md", "sha256", "-salt",
                        "-in", str(entrada), "-out", str(salida), "-pass", "stdin"],
                       input=(frase + "\n").encode(), capture_output=True)
    if r.returncode != 0:
        salir("No se pudo cifrar: " + r.stderr.decode(errors="ignore").strip())


def descifrar(entrada, salida, frase):
    r = subprocess.run([openssl(), "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", ITERACIONES, "-md", "sha256",
                        "-in", str(entrada), "-out", str(salida), "-pass", "stdin"],
                       input=(frase + "\n").encode(), capture_output=True)
    return r.returncode == 0


def revisar_frase(frase, nueva_permitida):
    """Confirma que la frase es la misma de los respaldos anteriores (o la registra la primera vez)."""
    archivo = CARPETA / "verificador.enc"
    with tempfile.TemporaryDirectory() as tmp:
        plano = Path(tmp) / "v.txt"
        if archivo.exists():
            if not descifrar(archivo, plano, frase) or plano.read_text(encoding="utf-8", errors="ignore") != VERIFICADOR:
                salir("La frase no coincide con la de los respaldos anteriores. Cópiala de Bitwarden e inténtalo de nuevo.")
            return
        if not nueva_permitida:
            salir("No hay respaldos en esta carpeta.")
        respuesta = input(f"  Recibí una frase de {len(frase)} caracteres. "
                          "¿Es la de Bitwarden \"Respaldos del portal · frase\"? Escribe si y presiona Enter: ").strip().lower()
        if respuesta not in ("si", "sí", "s"):
            salir("No se guardó nada. Vuelve a correr el respaldo cuando tengas la frase.")
        plano.write_text(VERIFICADOR, encoding="utf-8")
        cifrar(plano, archivo, frase)
        avisar("  ✓ Frase registrada. Los próximos respaldos solo se aceptan con esta misma frase.")


# ---------- Datos secretos: se leen del portapapeles, sin pegarlos en la Terminal ----------
# Pegar en la Terminal falló (llegaba repetido o con espacios) y, si el programa se cierra, lo pegado
# cae en la Terminal normal. Por eso: copias en Bitwarden, presionas Enter y el programa lo lee y borra el portapapeles.
def leer_portapapeles():
    try:
        if sys.platform == "darwin":
            return subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
        if os.name == "nt":
            return subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"], capture_output=True, text=True).stdout
    except OSError:
        pass
    return None


def limpiar_portapapeles():
    try:
        if sys.platform == "darwin":
            subprocess.run(["pbcopy"], input="", text=True)
        elif os.name == "nt":
            subprocess.run(["powershell", "-NoProfile", "-Command", "Set-Clipboard -Value ' '"], capture_output=True)
    except OSError:
        pass


def pedir_secreto(que, revisar):
    """Pide copiar el dato en Bitwarden y presionar Enter. Si se pega algo, también sirve (no se muestra)."""
    for intento in range(6):
        escrito = getpass.getpass(f"Copia {que} en Bitwarden y presiona Enter aquí (no hace falta pegar): ").strip()
        portapapeles = (leer_portapapeles() or "").strip()
        motivo = None
        for candidato in (portapapeles, escrito):
            if not candidato:
                continue
            motivo = revisar(candidato)
            if motivo is None:
                limpiar_portapapeles()
                return candidato
        avisar("  " + (motivo or "No encontré nada copiado. En Bitwarden toca el botón de copiar y vuelve a presionar Enter aquí."))
    salir("No se recibió el dato. No se guardó nada.\n  Si te quedó algo copiado, NO lo pegues en la Terminal: vuelve a correr el programa.")


def variantes_llave(bruto):
    """Arregla copias defectuosas: espacios en medio (la pantalla parte la llave en dos) o la llave repetida."""
    vistas = []
    def sumar(x):
        if x and x not in vistas:
            vistas.append(x)
    junta = "".join(bruto.split())
    for texto in (bruto, junta):
        sumar(texto)
        mitad = len(texto) // 2
        if len(texto) % 2 == 0 and texto[:mitad] == texto[mitad:]:
            sumar(texto[:mitad])
        for trozo in texto.split("sb_secret_"):
            if trozo.strip():
                sumar("sb_secret_" + "".join(trozo.split()))
    return [x for x in vistas if x.startswith("sb_secret_") and x.count("sb_secret_") == 1 and not any(c.isspace() for c in x)]


def llave_funciona(llave):
    """Prueba la llave contra Supabase antes de usarla (lee una tabla pequeña)."""
    req = urllib.request.Request(f"{URL}/rest/v1/ajustes?select=clave&limit=1", headers={"apikey": llave, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except urllib.error.HTTPError:
        return False
    except urllib.error.URLError as e:
        salir(f"No hay conexión con Supabase: {e.reason}")


def pedir_llave():
    for intento in range(3):
        escrito = getpass.getpass("Copia la llave \"Supabase · llave respaldos\" en Bitwarden y presiona Enter aquí (no hace falta pegar): ").strip()
        brutos = [x for x in ((leer_portapapeles() or "").strip(), escrito) if x]
        if not brutos:
            avisar("  No encontré nada copiado. Toca el botón de copiar en Bitwarden y vuelve a presionar Enter aquí.")
            continue
        if not any("sb_secret_" in b for b in brutos):
            avisar("  Lo copiado no es la llave secreta (debe tener sb_secret_). Copia la de \"Supabase · llave respaldos\".")
            continue
        for bruto in brutos:
            for llave in variantes_llave(bruto):
                if llave_funciona(llave):
                    limpiar_portapapeles()
                    if llave != bruto:
                        avisar("  (La llave venía con espacios o repetida y la corregí sola. Cuando puedas, arréglala en Bitwarden.)")
                    return llave
        avisar("  Supabase no acepta esa llave. Asegúrate de copiar la llave nueva \"respaldos\" (la vieja ya la borraste).\n"
               "  Lo más seguro: en Supabase → API Keys → Secret keys, toca el botón de copiar de \"respaldos\" y presiona Enter aquí.")
    salir("No se recibió una llave válida. No se guardó nada.")


def llave_de_entorno():
    """Respaldo automático: la llave del secret, con las mismas correcciones de copias defectuosas."""
    bruto = os.environ["AW_SUPABASE_LLAVE"].strip()
    for llave in variantes_llave(bruto):
        if llave_funciona(llave):
            return llave
    salir("Supabase no acepta la llave del secret AW_SUPABASE_LLAVE. Revisa en GitHub → Settings → Secrets → Actions "
          "que sea la llave secreta \"respaldos\" de Supabase (empieza con sb_secret_).")


def pedir_frase(llave=None):
    def revisar(v):
        if v.startswith("sb_") or v == llave:
            return ("Eso es la llave otra vez. Ahora copia la FRASE: en Bitwarden abre \"Respaldos del portal · frase\" "
                    "y toca copiar en el campo de contraseña (las 14 palabras).")
        # Sirve una frase de varias palabras (16+ caracteres) o una contraseña al azar de Bitwarden
        # (12+ caracteres mezclando mayúsculas, minúsculas, números o símbolos)
        tipos = sum([any(c.islower() for c in v), any(c.isupper() for c in v), any(c.isdigit() for c in v), any(not c.isalnum() for c in v)])
        if len(v) >= 16 or (len(v) >= 12 and tipos >= 3):
            return None
        return (f"Lo copiado tiene solo {len(v)} caracteres. Copia el campo Contraseña de \"Respaldos del portal · frase\", "
                "no el nombre ni el usuario.")
    return pedir_secreto("la frase \"Respaldos del portal · frase\"", revisar)


# ---------- Supabase ----------
class Supabase:
    def __init__(self, llave):
        self.llave = llave

    def pedir(self, metodo, ruta, cuerpo=None, datos=None, tipo="application/json", extra=None, permitir=()):
        if cuerpo is not None:
            datos = json.dumps(cuerpo).encode()
        req = urllib.request.Request(URL + ruta, data=datos, method=metodo, headers={
            # Las llaves nuevas (sb_secret_…) no son JWT: van solo en "apikey", nunca como "Authorization: Bearer"
            "apikey": self.llave, "Content-Type": tipo, "Accept": "application/json", **(extra or {}),
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in permitir:
                return None
            detalle = e.read().decode(errors="ignore")[:200]
            if e.code in (401, 403):
                salir("Supabase rechazó la llave secreta. Revisa que copiaste la llave \"respaldos\" completa.")
            salir(f"Supabase respondió {e.code} en {ruta.split('?')[0]}: {detalle}")
        except urllib.error.URLError as e:
            salir(f"No hay conexión con Supabase: {e.reason}")

    def tabla(self, nombre, orden):
        filas, desde = [], 0
        while True:
            lote = json.loads(self.pedir("GET", f"/rest/v1/{nombre}?select=*&order={orden}.asc&limit=1000&offset={desde}"))
            filas += lote
            if len(lote) < 1000:
                return filas
            desde += 1000

    def usuarios(self):
        todos, pagina = [], 1
        while True:
            lote = json.loads(self.pedir("GET", f"/auth/v1/admin/users?page={pagina}&per_page=200")).get("users", [])
            todos += lote
            if len(lote) < 200:
                return todos
            pagina += 1

    def archivos(self, prefijo=""):
        encontrados, desde = [], 0
        while True:
            lote = json.loads(self.pedir("POST", f"/storage/v1/object/list/{BUCKET}",
                                         {"prefix": prefijo, "limit": 1000, "offset": desde, "sortBy": {"column": "name", "order": "asc"}}))
            for item in lote:
                ruta = prefijo + item["name"]
                if item.get("id") is None:  # carpeta
                    encontrados += self.archivos(ruta + "/")
                else:
                    meta = item.get("metadata") or {}
                    encontrados.append({"ruta": ruta, "tamano": meta.get("size"), "tipo": meta.get("mimetype"), "actualizado": item.get("updated_at")})
            if len(lote) < 1000:
                return encontrados
            desde += 1000

    def descargar(self, ruta):
        return self.pedir("GET", f"/storage/v1/object/{BUCKET}/" + urllib.parse.quote(ruta))

    def leer(self, ruta):
        return json.loads(self.pedir("GET", ruta) or b"null")

    def usuario(self, uid):
        r = self.pedir("GET", f"/auth/v1/admin/users/{uid}", permitir=(404,))
        return json.loads(r) if r else None

    def subir(self, ruta, datos, tipo):
        self.pedir("POST", f"/storage/v1/object/{BUCKET}/" + urllib.parse.quote(ruta), datos=datos,
                   tipo=tipo or "application/octet-stream", extra={"x-upsert": "false"})


# ---------- Repositorio privado ----------
def git(*args, revisar=True):
    r = subprocess.run(["git", "-C", str(CARPETA), *args], capture_output=True, text=True)
    if revisar and r.returncode != 0:
        salir(f"git {' '.join(args)} falló: {r.stderr.strip()}")
    return r


def preparar_repositorio():
    if not shutil.which("git"):
        salir("No encontré git.")
    if not (CARPETA / ".git").exists():
        avisar(f"  Clonando el repositorio privado en {CARPETA} …")
        r = subprocess.run(["git", "clone", REPO_REMOTO, str(CARPETA)], capture_output=True, text=True)
        if r.returncode != 0:
            salir("No se pudo clonar aw-portal-respaldos: " + r.stderr.strip())
    if git("rev-parse", "--verify", "HEAD", revisar=False).returncode == 0:
        git("pull", "--rebase", "--autostash", "--quiet")  # si hay cambios locales sin guardar, los aparta y los devuelve
    (CARPETA / "respaldos").mkdir(exist_ok=True)
    (CARPETA / "archivos").mkdir(exist_ok=True)
    gitattributes = CARPETA / ".gitattributes"
    if not gitattributes.exists():
        gitattributes.write_text("*.enc binary\n", encoding="utf-8")
    gitignore = CARPETA / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("# Nunca subir nada descifrado\nrestaurado*/\n*.json\n*.tar.gz\n", encoding="utf-8")
    leeme = CARPETA / "README.md"
    if not leeme.exists():
        leeme.write_text(LEEME, encoding="utf-8")


LEEME = """# Respaldos del portal AW-RiseCR (privado)

Todo aquí está **cifrado** (AES-256, clave derivada de una frase con PBKDF2 de 600.000 vueltas).
Sin la frase guardada en Bitwarden ("Respaldos del portal · frase") no se puede abrir.

- `respaldos/AAAA-MM-DD_HHMM.datos.enc`: tablas del portal, usuarios y lista de archivos (JSON).
- `archivos/*.enc`: cada captura o documento, cifrado por separado (el nombre no revela el original).
- `verificador.enc`: confirma que cada respaldo nuevo usa la misma frase.

## Respaldo automático (cada domingo a las 2:00 a. m., hora de Costa Rica)

GitHub Actions corre `.github/workflows/respaldo.yml` con el mismo programa del respaldo a mano.
Usa dos secrets del repositorio (Settings → Secrets and variables → Actions):
- `AW_SUPABASE_LLAVE`: la llave secreta "respaldos" de Supabase (empieza con `sb_secret_`).
- `AW_RESPALDOS_FRASE`: la frase de cifrado (Bitwarden, "Respaldos del portal · frase").

Si una corrida falla, GitHub avisa por correo. Para correrlo a mano: pestaña Actions → "Respaldo semanal del portal" → Run workflow.

## Sacar un respaldo a mano (antes de cambios grandes)

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py

## Abrir un respaldo

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py restaurar [AAAA-MM-DD_HHMM]

Deja los datos descifrados en `aw-portal-restaurado-<fecha>/`, fuera de este repositorio. Bórrala al terminar.

## Recuperar un cliente borrado (o todo) en Supabase

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py recuperar [AAAA-MM-DD_HHMM] --cliente "Nombre"

Vuelve a cargar lo que falte con sus mismos ids: usuarios (sin contraseña: entran con "¿Olvidaste tu contraseña?"),
datos y archivos. Lo que ya existe no se toca. Sin `--cliente` recupera todo lo que falte.

## Eliminar un cliente completo

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py eliminar "Nombre"

Borra sus datos, usuarios, archivos y actividad. Pide escribir el nombre para confirmar.

## Recuperar el portal en un proyecto nuevo de Supabase

1. Aplicar las migraciones de `AW-RiseCR/supabase/migrations/` en orden.
2. Crear en Vault el secreto `portal_llave` con el valor guardado en Bitwarden (sin él, contactos y usuarios de acceso no se descifran).
3. Invitar de nuevo a los usuarios (las contraseñas no se respaldan: cada uno crea la suya con el enlace).
4. Cargar las tablas desde los JSON (negocios primero, luego perfiles y el resto) y subir `archivos/` al bucket `portal` con sus rutas originales.
"""


# ---------- Respaldar ----------
def respaldar():
    avisar("Respaldo del portal AW-RiseCR\n")
    openssl()
    preparar_repositorio()
    if AUTOMATICO:
        llave = llave_de_entorno()
        frase = os.environ["AW_RESPALDOS_FRASE"].strip()
        revisar_frase(frase, nueva_permitida=False)  # tiene que ser la misma frase de los respaldos anteriores
        avisar("  ✓ Llave y frase recibidas (secrets de GitHub).")
    elif EN_GITHUB:
        salir("Faltan los secrets AW_SUPABASE_LLAVE y AW_RESPALDOS_FRASE en el repositorio aw-portal-respaldos.")
    else:
        llave = pedir_llave()
        avisar("  ✓ Llave recibida. Ahora la frase (es otro dato de Bitwarden, no la llave).")
        frase = pedir_frase(llave)
        revisar_frase(frase, nueva_permitida=True)

    sb = Supabase(llave)
    ahora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-6)))  # hora de Costa Rica
    sello = ahora.strftime("%Y-%m-%d_%H%M")
    avisar("\n  Descargando datos…")
    tablas = {nombre: sb.tabla(nombre, orden) for nombre, orden in TABLAS.items()}
    usuarios = sb.usuarios()
    archivos = sb.archivos()
    for a in archivos:
        a["cifrado"] = hashlib.sha256(a["ruta"].encode()).hexdigest()[:40] + ".enc"
    manifiesto = {
        "creado": ahora.isoformat(timespec="seconds"), "proyecto": PROYECTO, "version": 1,
        "conteos": {**{t: len(f) for t, f in tablas.items()}, "usuarios": len(usuarios), "archivos": len(archivos)},
        "migraciones": sorted(p.name for p in MIGRACIONES.glob("*.sql")) if MIGRACIONES.exists() else [],
        "archivos": archivos,
    }
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / sello
        base.mkdir()
        for nombre, filas in tablas.items():
            (base / f"{nombre}.json").write_text(json.dumps(filas, ensure_ascii=False, indent=1), encoding="utf-8")
        (base / "usuarios.json").write_text(json.dumps(usuarios, ensure_ascii=False, indent=1), encoding="utf-8")
        (base / "manifiesto.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")
        paquete = Path(tmp) / "datos.tar.gz"
        with tarfile.open(paquete, "w:gz") as tar:
            tar.add(base, arcname=sello)
        cifrar(paquete, CARPETA / "respaldos" / f"{sello}.datos.enc", frase)

        nuevos = 0
        for a in archivos:
            destino = CARPETA / "archivos" / a["cifrado"]
            if destino.exists():
                continue
            plano = Path(tmp) / "archivo"
            plano.write_bytes(sb.descargar(a["ruta"]))
            cifrar(plano, destino, frase)
            plano.unlink()
            nuevos += 1

    c = manifiesto["conteos"]
    avisar(f"  ✓ {c['negocios']} clientes · {c['proyectos']} proyectos · {c['bitacora']} entradas · {c['cobros']} cobros · "
           f"{c['usuarios']} usuarios · {c['archivos']} archivos ({nuevos} nuevos)")

    avisar("\n  Subiendo a GitHub (repositorio privado)…")
    git("add", "-A")
    git("commit", "-q", "-m", f"Respaldo {ahora.strftime('%Y-%m-%d %H:%M')} (cifrado{', automático' if AUTOMATICO else ''})")
    git("branch", "-M", "main")
    git("push", "-q", "-u", "origin", "main")
    avisar(f"\n✓ Respaldo {sello} listo y subido cifrado a aw-portal-respaldos.")


# ---------- Restaurar (descifrar a una carpeta local) ----------
def restaurar(sello=None):
    if not (CARPETA / ".git").exists():
        salir(f"No encontré la carpeta de respaldos en {CARPETA}. Clónala primero.")
    lista = sorted((CARPETA / "respaldos").glob("*.datos.enc"))
    if not lista:
        salir("No hay respaldos todavía.")
    elegido = next((p for p in lista if p.name.startswith(sello)), None) if sello else lista[-1]
    if not elegido:
        salir(f"No hay un respaldo {sello}. Disponibles: " + ", ".join(p.name.split(".")[0] for p in lista[-5:]))
    frase = pedir_frase()
    revisar_frase(frase, nueva_permitida=False)
    nombre = elegido.name.split(".")[0]
    destino = CARPETA.parent / f"aw-portal-restaurado-{nombre}"
    destino.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        paquete = Path(tmp) / "datos.tar.gz"
        if not descifrar(elegido, paquete, frase):
            salir("No se pudo descifrar el respaldo.")
        with tarfile.open(paquete, "r:gz") as tar:
            for miembro in tar.getmembers():  # solo rutas dentro de la carpeta del respaldo
                if miembro.name.startswith("/") or ".." in Path(miembro.name).parts:
                    salir("El respaldo tiene rutas sospechosas. No se abrió.")
            tar.extractall(destino)
    datos = destino / nombre
    manifiesto = json.loads((datos / "manifiesto.json").read_text(encoding="utf-8"))
    faltan = 0
    for a in manifiesto["archivos"]:
        origen = CARPETA / "archivos" / a["cifrado"]
        salida = datos / "archivos" / a["ruta"]
        if ".." in Path(a["ruta"]).parts:
            continue
        salida.parent.mkdir(parents=True, exist_ok=True)
        if not origen.exists() or not descifrar(origen, salida, frase):
            faltan += 1
    avisar(f"\n✓ Respaldo {nombre} descifrado en:\n  {datos}")
    avisar(f"  {manifiesto['conteos']}")
    if faltan:
        avisar(f"  ⚠ {faltan} archivos no se pudieron descifrar.")
    avisar("  Contiene datos privados de clientes: bórralo cuando termines.")


# ---------- Eliminar un cliente completo ----------
def lotes(lista, tamano):
    for i in range(0, len(lista), tamano):
        yield lista[i:i + tamano]


def buscar_cliente(negocios, nombre):
    elegido = [n for n in negocios if n["nombre"].strip().lower() == nombre.strip().lower()]
    if not elegido:
        salir(f"No hay un cliente llamado \"{nombre}\". Clientes: " + (", ".join(n["nombre"] for n in negocios) or "(ninguno)"))
    return elegido[0]


def eliminar(nombre):
    avisar("Eliminar un cliente del portal AW-RiseCR\n")
    preparar_repositorio()  # para mostrar la fecha real del último respaldo (los automáticos están en GitHub)
    sb = Supabase(pedir_llave())
    n = buscar_cliente(sb.leer("/rest/v1/negocios?select=id,nombre"), nombre)
    nid = n["id"]
    filas = {t: sb.leer(f"/rest/v1/{t}?select={'negocio_id' if t == 'contactos' else 'id'}&negocio_id=eq.{nid}") for t in POR_NEGOCIO}
    perfiles = sb.leer(f"/rest/v1/perfiles?select=id,nombre,rol&negocio_id=eq.{nid}")
    if any(p["rol"] == "admin" for p in perfiles):
        salir("Ese cliente tiene una cuenta de administrador vinculada. No se borró nada.")
    archivos = [a["ruta"] for a in sb.archivos(nid + "/")]
    ids = sorted({nid, *(p["id"] for p in perfiles), *(f.get("id") or f.get("negocio_id") for t in filas for f in filas[t])})

    ultimo = sorted((CARPETA / "respaldos").glob("*.datos.enc"))[-1:] if (CARPETA / "respaldos").exists() else []
    avisar(f"  Cliente: {n['nombre']}")
    avisar(f"  Se borra: {len(filas['proyectos'])} proyectos · {len(filas['bitacora'])} entradas de bitácora · {len(filas['cobros'])} cobros · "
           f"{len(filas['documentos'])} documentos · {len(filas['accesos'])} accesos · {len(archivos)} archivos · su contacto, servicios, Fondo AW y actividad")
    avisar("  Usuarios que pierden el acceso: " + (", ".join(p["nombre"] or p["id"] for p in perfiles) or "(ninguno)"))
    avisar(f"  Último respaldo en esta computadora: {ultimo[0].name.split('.')[0] if ultimo else '(ninguno)'}"
           "  ← si no es de hoy, saca un respaldo antes de seguir.")
    escrito = input(f"\n  Esto no se puede deshacer (solo se recupera con un respaldo).\n  Para borrarlo, escribe el nombre del cliente ({n['nombre']}) y presiona Enter: ")
    if escrito.strip() != n["nombre"].strip():
        salir("El nombre no coincide. No se borró nada.")

    # 1) El cliente y todo lo suyo (las tablas se borran en cascada)  2) sus usuarios (y sus perfiles)
    # 3) sus archivos  4) su actividad, incluida la que dejó este mismo borrado
    sb.pedir("DELETE", f"/rest/v1/negocios?id=eq.{nid}")
    for p in perfiles:
        sb.pedir("DELETE", f"/auth/v1/admin/users/{p['id']}", permitir=(404,))
    for lote in lotes(archivos, 100):
        sb.pedir("DELETE", f"/storage/v1/object/{BUCKET}", {"prefixes": lote})
    for lote in lotes(ids, 40):
        sb.pedir("DELETE", "/rest/v1/actividad?registro=in.(" + ",".join(lote) + ")")
    avisar(f"\n✓ {n['nombre']} eliminado: {len(perfiles)} usuarios y {len(archivos)} archivos borrados.")


# ---------- Recuperar (volver a cargar en Supabase lo que falte) ----------
def elegir_respaldo(sello=None):
    lista = sorted((CARPETA / "respaldos").glob("*.datos.enc"))
    if not lista:
        salir("No hay respaldos todavía.")
    elegido = next((p for p in lista if p.name.startswith(sello)), None) if sello else lista[-1]
    if not elegido:
        salir(f"No hay un respaldo {sello}. Disponibles: " + ", ".join(p.name.split(".")[0] for p in lista[-5:]))
    return elegido


def abrir_respaldo(archivo, frase, tmp):
    """Descifra un respaldo en una carpeta temporal y devuelve sus tablas, usuarios y manifiesto."""
    paquete = tmp / "datos.tar.gz"
    if not descifrar(archivo, paquete, frase):
        salir("No se pudo descifrar el respaldo.")
    with tarfile.open(paquete, "r:gz") as tar:
        for miembro in tar.getmembers():
            if miembro.name.startswith("/") or ".." in Path(miembro.name).parts:
                salir("El respaldo tiene rutas sospechosas. No se abrió.")
        tar.extractall(tmp)
    base = tmp / archivo.name.split(".")[0]
    leer = lambda nombre: json.loads((base / f"{nombre}.json").read_text(encoding="utf-8")) if (base / f"{nombre}.json").exists() else []
    return {t: leer(t) for t in TABLAS}, leer("usuarios"), json.loads((base / "manifiesto.json").read_text(encoding="utf-8"))


def recuperar(sello=None, cliente=None):
    avisar("Recuperar desde un respaldo · portal AW-RiseCR\n")
    openssl()
    preparar_repositorio()  # trae los respaldos automáticos más recientes
    elegido = elegir_respaldo(sello)
    avisar(f"  Respaldo: {elegido.name.split('.')[0]}" + (f" · cliente: {cliente}" if cliente else " · todo"))
    llave = pedir_llave()
    avisar("  ✓ Llave recibida. Ahora la frase (es otro dato de Bitwarden, no la llave).")
    frase = pedir_frase(llave)
    revisar_frase(frase, nueva_permitida=False)
    sb = Supabase(llave)

    with tempfile.TemporaryDirectory() as tmp:
        tablas, usuarios, manifiesto = abrir_respaldo(elegido, frase, Path(tmp))
        if cliente:
            negocio = buscar_cliente(tablas["negocios"], cliente)
            nid = negocio["id"]
            datos = {"negocios": [negocio], "perfiles": [p for p in tablas["perfiles"] if p.get("negocio_id") == nid]}
            for t in POR_NEGOCIO:
                datos[t] = [f for f in tablas[t] if f.get("negocio_id") == nid]
            ids = {nid, *(p["id"] for p in datos["perfiles"]), *(f.get("id") or f.get("negocio_id") for t in POR_NEGOCIO for f in datos[t])}
            datos["actividad"] = [a for a in tablas["actividad"] if a.get("registro") in ids]
            archivos = [a for a in manifiesto["archivos"] if a["ruta"].split("/")[0] == nid]
        else:
            datos = {t: tablas[t] for t in TABLAS}
            archivos = manifiesto["archivos"]

        de_perfiles = {p["id"] for p in datos["perfiles"]}
        faltan_usuarios = [u for u in usuarios if u["id"] in de_perfiles and sb.usuario(u["id"]) is None]
        existentes = {a["ruta"] for a in sb.archivos()}
        faltan_archivos = [a for a in archivos if a["ruta"] not in existentes]
        avisar(f"  En el respaldo: {len(datos['negocios'])} clientes · {len(datos['proyectos'])} proyectos · {len(datos['bitacora'])} entradas · "
               f"{len(datos['cobros'])} cobros · {len(datos['actividad'])} registros de actividad")
        avisar(f"  Faltan en Supabase: {len(faltan_usuarios)} usuarios · {len(faltan_archivos)} archivos (las filas que ya existen no se tocan)")
        if input("\n  ¿Recuperar? Escribe si y presiona Enter: ").strip().lower() not in ("si", "sí", "s"):
            salir("No se cambió nada.")

        # 1) Usuarios, con su mismo id (sin contraseña: la crean de nuevo con "¿Olvidaste tu contraseña?")
        recreados = []
        for u in faltan_usuarios:
            cuerpo = {"id": u["id"], "email": u["email"], "email_confirm": bool(u.get("email_confirmed_at")), "user_metadata": u.get("user_metadata") or {}}
            if (u.get("banned_until") or "") > datetime.datetime.now(datetime.timezone.utc).isoformat():
                cuerpo["ban_duration"] = "876000h"  # seguía desactivado
            nuevo = json.loads(sb.pedir("POST", "/auth/v1/admin/users", cuerpo))
            if nuevo.get("id") != u["id"]:
                sb.pedir("DELETE", f"/auth/v1/admin/users/{nuevo.get('id')}", permitir=(404,))
                salir("Supabase no permitió recrear el usuario con su mismo id. No se cargaron datos.")
            recreados.append(u)

        # 2) Datos: solo se agrega lo que falta. Los perfiles van para los usuarios recién recreados o los que
        #    quedaron sin su negocio (su perfil se crea solo al crear el usuario y hay que ponerle los datos del respaldo)
        if de_perfiles:
            actuales = {x["id"]: x for x in sb.leer("/rest/v1/perfiles?select=id,negocio_id&id=in.(" + ",".join(sorted(de_perfiles)) + ")")}
            nuevos = {u["id"] for u in recreados}
            datos["perfiles"] = [x for x in datos["perfiles"] if x["id"] in nuevos or actuales.get(x["id"], {}).get("negocio_id") != x.get("negocio_id")]
        # Referencias a clientes o usuarios que ya no existen quedan vacías (no frenan la recuperación)
        hay_negocios = {x["id"] for x in sb.leer("/rest/v1/negocios?select=id")} | {x["id"] for x in datos["negocios"]}
        hay_usuarios = {x["id"] for x in sb.usuarios()}
        for tabla, columna, existen in (("negocios", "referido_por", hay_negocios), ("fondo_movimientos", "referido_negocio_id", hay_negocios),
                                        ("bitacora", "autor", hay_usuarios), ("bitacora", "aprobado_por", hay_usuarios),
                                        ("fondo_movimientos", "creado_por", hay_usuarios)):
            for fila in datos.get(tabla, []):
                if fila.get(columna) and fila[columna] not in existen:
                    fila[columna] = None
        agregado = json.loads(sb.pedir("POST", "/rest/v1/rpc/restaurar_respaldo", {"p_datos": datos}))

        # 3) Archivos, a su misma ruta
        for a in faltan_archivos:
            plano = Path(tmp) / "archivo"
            if not descifrar(CARPETA / "archivos" / a["cifrado"], plano, frase):
                salir(f"No se pudo descifrar el archivo {a['ruta']}.")
            sb.subir(a["ruta"], plano.read_bytes(), a.get("tipo"))
            plano.unlink()

    avisar("\n✓ Recuperado: " + ", ".join(f"{t} {n}" for t, n in agregado.items() if n) + f" · {len(recreados)} usuarios · {len(faltan_archivos)} archivos")
    if recreados:
        avisar("  Usuarios recreados (entran con \"¿Olvidaste tu contraseña?\" o con una invitación nueva):")
        for u in recreados:
            avisar(f"    · {u['email']}")


if __name__ == "__main__":
    try:
        args = sys.argv[1:]
        if args and args[0] == "restaurar":
            restaurar(args[1] if len(args) > 1 else None)
        elif args and args[0] == "recuperar":
            cliente = args[args.index("--cliente") + 1] if "--cliente" in args and args.index("--cliente") + 1 < len(args) else None
            sello = next((a for a in args[1:] if a[:4].isdigit() and a != cliente), None)
            recuperar(sello, cliente)
        elif args and args[0] == "eliminar" and len(args) > 1:
            eliminar(" ".join(args[1:]))
        elif not args:
            respaldar()
        else:
            print(__doc__)
    except KeyboardInterrupt:
        salir("Cancelado.")
