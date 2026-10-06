#!/usr/bin/env python3
"""Respaldo cifrado del portal AW-RiseCR → repositorio privado aw-portal-respaldos (GitHub).

Uso:
  python3 respaldar.py                         saca un respaldo nuevo, lo cifra y lo sube a GitHub
  python3 respaldar.py restaurar               descifra el último respaldo en una carpeta local
  python3 respaldar.py restaurar 2026-10-06_0930   descifra ese respaldo

Te pide, sin mostrarlos en pantalla:
  - la llave secreta de Supabase "respaldos" (Project Settings → API Keys → Secret keys)
  - la frase de cifrado de los respaldos (guárdala en Bitwarden)
Ninguna de las dos se guarda en disco ni en el repositorio. Sin la frase, los respaldos no se pueden abrir.

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
VERIFICADOR = "AW-RiseCR · respaldos del portal · v1"
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
    for intento in range(3):
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
    salir("No se recibió el dato. No se guardó nada.")


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


def pedir_frase(llave=None):
    def revisar(v):
        if v.startswith("sb_") or v == llave:
            return "Lo copiado es una llave, no la frase. Copia \"Respaldos del portal · frase\"."
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

    def pedir(self, metodo, ruta, cuerpo=None):
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        req = urllib.request.Request(URL + ruta, data=datos, method=metodo, headers={
            # Las llaves nuevas (sb_secret_…) no son JWT: van solo en "apikey", nunca como "Authorization: Bearer"
            "apikey": self.llave, "Content-Type": "application/json", "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
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
        git("pull", "--rebase", "--quiet")
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

## Sacar un respaldo (una vez por semana o antes de cambios grandes)

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py

## Abrir un respaldo

    python3 AW-RiseCR/herramientas/respaldos-portal/respaldar.py restaurar [AAAA-MM-DD_HHMM]

Deja los datos descifrados en `aw-portal-restaurado-<fecha>/`, fuera de este repositorio. Bórrala al terminar.

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
    llave = pedir_llave()
    avisar("  ✓ Llave recibida.")
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
    git("commit", "-q", "-m", f"Respaldo {ahora.strftime('%Y-%m-%d %H:%M')} (cifrado)")
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


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "restaurar":
            restaurar(sys.argv[2] if len(sys.argv) > 2 else None)
        elif len(sys.argv) == 1:
            respaldar()
        else:
            print(__doc__)
    except KeyboardInterrupt:
        salir("Cancelado.")
