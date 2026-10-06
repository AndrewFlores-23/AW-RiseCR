"""Arma las plantillas de correo del portal (invitación y recuperar contraseña) con un solo diseño:
cabecera = el espacio con el horizonte del planeta; cuerpo blanco = el planeta; pie = la parte de abajo del planeta.

Uso:
  python3 herramientas/correos/armar-plantillas.py            escribe docs/portal/correos/{invitacion,recuperar}.html
  python3 herramientas/correos/armar-plantillas.py <carpeta>  además deja una vista previa con datos de ejemplo

Las plantillas salen solo con caracteres ASCII (tildes, ñ y emoji como entidades HTML): no se dañan al copiarlas.
Las imágenes viven en awrisecr.com/correo/ (se generan con generar-cabecera.py).
"""
import base64
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "docs" / "portal" / "correos"
SITIO = "https://awrisecr.com"
FUENTE = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "Menlo, Consolas, monospace"


def correo(titulo, resumen, cuerpo, razon, img):
    """Esqueleto común. img: rutas de logo, cabecera y pie (URL real o datos para la vista previa)."""
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{titulo}</title>
<style>
  /* Gmail en modo oscuro (iPhone) oscurece el texto blanco: esto lo mantiene blanco (sin efecto en modo claro) */
  u + .body .gmail-blend-screen {{ background:#000; mix-blend-mode:screen; }}
  u + .body .gmail-blend-difference {{ background:#000; mix-blend-mode:difference; }}
</style>
</head>
<body class="body" style="margin:0; padding:0; background:#e9eef7;">
<!-- Asunto en Supabase: {titulo} -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">{resumen}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9eef7;">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; border-radius:14px; overflow:hidden; background:#ffffff; box-shadow:0 8px 28px rgba(6,22,51,.18);">
        <!-- Cabecera: el espacio (con el logo y el nombre dentro de la imagen, así Gmail no les cambia el color) -->
        <tr>
          <td height="88" bgcolor="#061633" style="height:88px; background-color:#061633; background-image:url('{img['arriba']}'); background-size:560px 88px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
        <!-- Horizonte del planeta: transparente abajo, toma el color del cuerpo (blanco, u oscuro en modo oscuro) -->
        <tr>
          <td height="64" bgcolor="#ffffff" style="height:64px; background-color:#ffffff; background-image:url('{img['horizonte']}'); background-size:560px 64px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
        <!-- Cuerpo: el planeta de luz -->
        <tr>
          <td style="padding:4px 28px 18px; font-family:{FUENTE}; color:#0a1834;">
{cuerpo}
          </td>
        </tr>
        <!-- Pie: la parte de abajo del planeta (transparente arriba, toma el color del cuerpo) -->
        <tr>
          <td height="64" bgcolor="#ffffff" style="height:64px; background-color:#ffffff; background-image:url('{img['pie_horizonte']}'); background-size:560px 64px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
        <!-- El espacio con los datos de contacto (texto blanco protegido para el modo oscuro de Gmail) -->
        <tr>
          <!-- El azul va como degradado de un solo color: Gmail no invierte los degradados, así queda oscuro aunque el texto ocupe más líneas -->
          <td bgcolor="#061633" style="background-color:#061633; background-image:linear-gradient(#061633, #061633); padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="center" style="background-image:url('{img['pie_espacio']}'); background-size:560px auto; background-position:left top; background-repeat:no-repeat; padding:14px 28px 26px; font-family:{FUENTE}; text-align:center; color:#ffffff;">
            <div class="gmail-blend-screen"><div class="gmail-blend-difference">
              <div style="font-size:13.5px; line-height:1.6; color:#ffffff;">¿Dudas? Escríbenos por WhatsApp al <b style="white-space:nowrap;">+506 8584-7369</b> o llámanos al <b style="white-space:nowrap;">+506 8795-2070</b>.</div>
              <div style="margin-top:10px; font-size:12px; line-height:1.55; color:#ffffff;">{razon}</div>
              <div style="margin-top:8px; font-size:12px; line-height:1.55; color:#ffffff;"><a href="{SITIO}" style="color:#ffffff; text-decoration:underline;">awrisecr.com</a> · Santa Cruz, Guanacaste</div>
            </div></div>
          </td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""


def boton(texto):
    return f"""            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
              <tr>
                <td style="border-radius:10px; background-color:#1167e8; background-image:linear-gradient(#1167e8, #1167e8);">
                  <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block; padding:14px 26px; font-size:15.5px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;"><span class="gmail-blend-screen" style="display:inline-block;"><span class="gmail-blend-difference" style="display:inline-block;">{texto}</span></span></a>
                </td>
              </tr>
            </table>"""


ENLACE = """            <p style="margin:0; font-size:12.5px; line-height:1.5; color:#6b7a97;">¿El botón no abre? Copia este enlace en tu navegador:<br><span style="word-break:break-all; color:#1167e8;">{{ .ConfirmationURL }}</span></p>"""

PUNTO = '<b style="color:#1167e8;">·</b>&nbsp; '


def plantillas(img):
    invitacion = correo(
        "Tu acceso al portal de AW-RiseCR",
        "Crea tu contraseña y mira el avance de tu proyecto en un solo lugar.",
        f"""            <h1 style="margin:0 0 12px; font-size:23px; line-height:1.25; color:#0a1834;">Hola{{{{ if .Data.nombre }}}}, {{{{ .Data.nombre }}}}{{{{ end }}}} 👋</h1>
            <p style="margin:0 0 14px; font-size:15.5px; line-height:1.6; color:#3a4966;">Te damos la bienvenida al portal de AW-RiseCR. Ahí vas a ver, en un solo lugar:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
              <tr><td style="padding:3px 0; font-size:15px; line-height:1.5; color:#3a4966;">{PUNTO}El avance de tu proyecto, con fecha y hora</td></tr>
              <tr><td style="padding:3px 0; font-size:15px; line-height:1.5; color:#3a4966;">{PUNTO}Tus pagos y mensualidades</td></tr>
              <tr><td style="padding:3px 0; font-size:15px; line-height:1.5; color:#3a4966;">{PUNTO}Tu Fondo AW y tus documentos</td></tr>
            </table>
            <p style="margin:0 0 22px; font-size:15.5px; line-height:1.6; color:#3a4966;">Para entrar, crea tu contraseña con este botón:</p>
{boton("Crear mi contraseña")}
            <p style="margin:0 0 6px; font-size:13.5px; line-height:1.55; color:#6b7a97;">Por seguridad, el enlace vence pronto. Si ya no funciona, escríbenos y te enviamos uno nuevo.</p>
{ENLACE}""",
        "Recibiste este correo porque AW-RiseCR te invitó al portal de tu proyecto. Si no esperabas esta invitación, puedes ignorarlo.",
        img)
    recuperar = correo(
        "Crea tu nueva contraseña · AW-RiseCR",
        "Usa este enlace para crear una nueva contraseña del portal.",
        f"""            <h1 style="margin:0 0 12px; font-size:23px; line-height:1.25; color:#0a1834;">Hola{{{{ if .Data.nombre }}}}, {{{{ .Data.nombre }}}}{{{{ end }}}}</h1>
            <p style="margin:0 0 22px; font-size:15.5px; line-height:1.6; color:#3a4966;">Recibimos una solicitud para cambiar la contraseña de tu cuenta del portal (<b style="color:#0a1834;">{{{{ .Email }}}}</b>). Créala con este botón:</p>
{boton("Crear nueva contraseña")}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
              <tr>
                <td style="padding:12px 14px; border-radius:10px; background:#f3f6fb; border:1px solid #d6dfee; font-size:13.5px; line-height:1.55; color:#3a4966;">
                  <b style="color:#0a1834;">¿No la pediste tú?</b> Ignora este correo: tu contraseña actual sigue funcionando y nadie puede cambiarla sin este enlace.
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px; font-size:12.5px; line-height:1.5; color:#6b7a97;">El enlace vence pronto.</p>
{ENLACE}""",
        "Este correo es del portal de clientes de AW-RiseCR.",
        img)
    return {"invitacion": invitacion, "recuperar": recuperar}


def solo_ascii(texto):
    """Tildes, ñ, signos y emoji como entidades HTML: la plantilla no se daña al copiarla y pegarla."""
    return "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in texto)


if __name__ == "__main__":
    nombres = {"arriba": "cabecera-arriba", "horizonte": "cabecera-horizonte", "pie_horizonte": "pie-horizonte-v2", "pie_espacio": "pie-espacio-v2"}
    reales = {clave: f"{SITIO}/correo/{archivo}.png" for clave, archivo in nombres.items()}
    for nombre, html in plantillas(reales).items():
        (DESTINO / f"{nombre}.html").write_text(solo_ascii(html), encoding="ascii")
        print("listo:", (DESTINO / f"{nombre}.html").relative_to(RAIZ))
    if len(sys.argv) > 1:  # vista previa con las imágenes incrustadas y datos de ejemplo
        datos = lambda ruta: "data:image/png;base64," + base64.b64encode((RAIZ / "public" / ruta).read_bytes()).decode()
        previa = {clave: datos(f"correo/{archivo}.png") for clave, archivo in nombres.items()}
        for nombre, html in plantillas(previa).items():
            html = (html.replace("{{ if .Data.nombre }}, {{ .Data.nombre }}{{ end }}", ", Mariana")
                        .replace("{{ .ConfirmationURL }}", f"{SITIO}/portal/").replace("{{ .Email }}", "mariana@surfcoffee.cr"))
            (pathlib.Path(sys.argv[1]) / f"vista-{nombre}.html").write_text(html, encoding="utf-8")
        print("vista previa en", sys.argv[1])
