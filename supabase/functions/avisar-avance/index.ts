// Portal AW-RiseCR · avisar-avance
// Cuando el admin publica un avance, avisa por correo a las personas del negocio que ya activaron su cuenta.
// Solo el administrador con dos pasos puede llamarla. La llave de Resend vive en los secretos de Supabase
// (RESEND_API_KEY): nunca en el código ni en el navegador.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const ORIGENES = ["http://127.0.0.1:8788", "http://localhost:8788", "https://awrisecr.com", "https://www.awrisecr.com"];
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const LLAVE_SECRETA = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { return undefined; }
})() ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// La llave se limpia por si se guardó mal copiada: sin espacios y, si quedó repetida, una sola vez
const RESEND = (() => {
  const bruto = (Deno.env.get("RESEND_API_KEY") ?? "").replace(/\s+/g, "");
  const mitad = bruto.length / 2;
  if (bruto.startsWith("re_") && bruto.length % 2 === 0 && bruto.slice(0, mitad) === bruto.slice(mitad)) return bruto.slice(0, mitad);
  const trozos = bruto.split("re_").filter(Boolean);
  if (trozos.length > 1 && trozos.every((t) => t === trozos[0])) return "re_" + trozos[0];
  return bruto || undefined;
})();
const REMITENTE = "AW-RiseCR <portal@awrisecr.com>";
const RESPONDER_A = "awrisecr@gmail.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS: Record<string, string> = {
  inicio: "Inicio del proyecto", avance: "Avance", captura: "Captura", entregable: "Entregable",
  aprobacion: "Necesita tu aprobación", nota: "Nota",
};
const fechaCR = new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });

function encabezados(origen: string | null) {
  return {
    "Access-Control-Allow-Origin": origen && ORIGENES.includes(origen) ? origen : ORIGENES[2],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Todo lo que escribe el admin se escapa antes de ir al HTML del correo
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const unaLinea = (t: string) => t.replace(/[\r\n]+/g, " ").trim();

type Datos = { nombre: string; proyecto: string; tipo: string; titulo: string; nota: string; fecha: string; capturas: number; archivos: number; requiere: boolean; enlace: string };

// Mismo diseño que la invitación y recuperar contraseña (herramientas/correos/armar-plantillas.py):
// cabecera = el espacio con el horizonte del planeta, cuerpo = el planeta, pie = la parte de abajo del planeta.
// El logo y el nombre van dentro de la imagen y el texto blanco lleva el truco de Gmail para el modo oscuro.
const IMG = "https://awrisecr.com/correo";

function html(d: Datos) {
  const fuente = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  const mono = "Menlo, Consolas, monospace";
  const adjuntos = [d.capturas ? `${d.capturas} ${d.capturas === 1 ? "captura" : "capturas"}` : "", d.archivos ? `${d.archivos} ${d.archivos === 1 ? "archivo" : "archivos"}` : ""].filter(Boolean).join(" y ");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light">
<style>
  u + .body .gmail-blend-screen { background:#000; mix-blend-mode:screen; }
  u + .body .gmail-blend-difference { background:#000; mix-blend-mode:difference; }
</style></head>
<body class="body" style="margin:0; padding:0; background:#e9eef7;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(d.titulo)} · ${esc(d.proyecto)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9eef7;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; border-radius:14px; overflow:hidden; background:#ffffff; box-shadow:0 8px 28px rgba(6,22,51,.18);">
<tr><td height="88" bgcolor="#061633" style="height:88px; background-color:#061633; background-image:url('${IMG}/cabecera-arriba.png'); background-size:560px 88px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td></tr>
<tr><td height="64" bgcolor="#ffffff" style="height:64px; background-color:#ffffff; background-image:url('${IMG}/cabecera-horizonte.png'); background-size:560px 64px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:4px 28px 18px; font-family:${fuente}; color:#0a1834;">
<p style="margin:0 0 6px; font-size:15px; color:#3a4966;">Hola${d.nombre ? ", " + esc(d.nombre) : ""} 👋</p>
<p style="margin:0 0 18px; font-size:15px; line-height:1.55; color:#3a4966;">${d.requiere ? "Tenemos algo de tu proyecto que necesita tu visto bueno." : "Publicamos un avance nuevo en tu proyecto."}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px; border:1px solid #d6dfee; border-radius:12px; background:#f7f9fd;"><tr><td style="padding:16px 18px;">
<div style="font-family:${mono}; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${d.requiere ? "#a26c06" : "#1167e8"};">${esc(TIPOS[d.tipo] ?? "Avance")} · ${esc(d.proyecto)}</div>
<div style="margin:8px 0 4px; font-size:18px; font-weight:700; line-height:1.3; color:#0a1834;">${esc(d.titulo)}</div>
${d.nota ? `<div style="margin:6px 0 0; font-size:14.5px; line-height:1.55; color:#3a4966;">${esc(d.nota).replace(/\n/g, "<br>")}</div>` : ""}
<div style="margin:10px 0 0; font-family:${mono}; font-size:12px; color:#6b7a97;">${esc(d.fecha)}${adjuntos ? " · " + esc(adjuntos) : ""}</div>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr><td style="border-radius:10px; background-color:#1167e8; background-image:linear-gradient(#1167e8, #1167e8);">
<a href="${esc(d.enlace)}" style="display:inline-block; padding:14px 26px; font-size:15.5px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;"><span class="gmail-blend-screen" style="display:inline-block;"><span class="gmail-blend-difference" style="display:inline-block;">${d.requiere ? "Revisar y aprobar" : "Ver en mi portal"}</span></span></a>
</td></tr></table>
</td></tr>
<tr><td height="64" bgcolor="#ffffff" style="height:64px; background-color:#ffffff; background-image:url('${IMG}/pie-horizonte-v2.png'); background-size:560px 64px; background-position:left top; background-repeat:no-repeat; font-size:0; line-height:0;">&nbsp;</td></tr>
<tr><td bgcolor="#061633" style="background-color:#061633; background-image:linear-gradient(#061633, #061633); padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" style="background-image:url('${IMG}/pie-espacio-v2.png'); background-size:560px auto; background-position:left top; background-repeat:no-repeat; padding:14px 28px 26px; font-family:${fuente}; text-align:center; color:#ffffff;">
<div class="gmail-blend-screen"><div class="gmail-blend-difference">
<div style="font-size:13.5px; line-height:1.6; color:#ffffff;">¿Dudas? Responde este correo o escríbenos por WhatsApp al <b style="white-space:nowrap;">+506 8584-7369</b>.</div>
<div style="margin-top:10px; font-size:12px; line-height:1.55; color:#ffffff;">Recibes este aviso porque tienes acceso al portal de tu proyecto con AW-RiseCR.</div>
<div style="margin-top:8px; font-size:12px; line-height:1.55; color:#ffffff;"><a href="https://awrisecr.com" style="color:#ffffff; text-decoration:underline;">awrisecr.com</a> · Santa Cruz, Guanacaste</div>
</div></div>
</td></tr></table>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function texto(d: Datos) {
  return [`Hola${d.nombre ? ", " + d.nombre : ""}:`, "",
    d.requiere ? "Tenemos algo de tu proyecto que necesita tu visto bueno." : "Publicamos un avance nuevo en tu proyecto.", "",
    `${TIPOS[d.tipo] ?? "Avance"} · ${d.proyecto}`, d.titulo, d.nota, d.fecha, "",
    `${d.requiere ? "Revísalo y apruébalo" : "Míralo"} en tu portal: ${d.enlace}`, "",
    "¿Dudas? Responde este correo o escríbenos por WhatsApp al +506 8584-7369.", "AW-RiseCR · awrisecr.com"].filter((l) => l !== undefined).join("\n");
}

Deno.serve(async (req) => {
  const origen = req.headers.get("origin");
  const h = encabezados(origen);
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return responder({ error: "Sin sesión" }, 401);
    const admin = createClient(URL_SB, LLAVE_SECRETA, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: verificado, error: errorToken } = await admin.auth.getClaims(token);
    const claims = verificado?.claims;
    if (errorToken || !claims?.sub) return responder({ error: "Sesión inválida" }, 401);
    if (claims.aal !== "aal2") return responder({ error: "Se requiere verificación en dos pasos" }, 403);
    const { data: perfil } = await admin.from("perfiles").select("rol, activo").eq("id", claims.sub).maybeSingle();
    if (!perfil || perfil.rol !== "admin" || !perfil.activo) return responder({ error: "Sin permiso" }, 403);

    if (!RESEND) return responder({ error: "Falta configurar la llave de Resend en Supabase (RESEND_API_KEY)" }, 503);
    const cuerpo = await req.json().catch(() => ({}));
    const id = String(cuerpo.entrada_id ?? "");
    if (!UUID.test(id)) return responder({ error: "Entrada inválida" }, 400);

    const { data: e } = await admin.from("bitacora")
      .select("id, negocio_id, tipo, titulo, nota, requiere_aprobacion, creado_en, proyectos(nombre), adjuntos(tipo_mime)")
      .eq("id", id).maybeSingle();
    if (!e) return responder({ error: "Entrada no encontrada" }, 404);

    // Personas del negocio con cuenta activa y correo confirmado (las invitaciones pendientes no reciben avisos)
    const { data: personas } = await admin.from("perfiles").select("id, nombre").eq("negocio_id", e.negocio_id).eq("rol", "cliente").eq("activo", true);
    const destinos: { correo: string; nombre: string }[] = [];
    for (const p of personas ?? []) {
      const { data } = await admin.auth.admin.getUserById(p.id);
      if (data.user?.email && data.user.email_confirmed_at) destinos.push({ correo: data.user.email, nombre: (p.nombre || "").split(" ")[0] });
    }
    const sinCuenta = (personas?.length ?? 0) - destinos.length;
    if (!destinos.length) return responder({ enviados: 0, sin_cuenta: sinCuenta });

    const adjuntos = (e.adjuntos ?? []) as { tipo_mime: string | null }[];
    const capturas = adjuntos.filter((a) => a.tipo_mime?.startsWith("image/")).length;
    const base = origen && ORIGENES.includes(origen) ? origen : "https://awrisecr.com";
    const proyecto = (e.proyectos as { nombre?: string } | null)?.nombre ?? "tu proyecto";
    const comun = {
      proyecto, tipo: e.tipo, titulo: e.titulo, nota: e.nota ?? "", fecha: fechaCR.format(new Date(e.creado_en)),
      capturas, archivos: adjuntos.length - capturas, requiere: Boolean(e.requiere_aprobacion), enlace: `${base}/portal/`,
    };
    const asunto = unaLinea(e.requiere_aprobacion ? `Necesitamos tu aprobación: ${e.titulo}` : `Nuevo avance en ${proyecto} · AW-RiseCR`).slice(0, 150);

    let enviados = 0;
    for (const d of destinos) {
      const datos = { ...comun, nombre: d.nombre };
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: REMITENTE, to: [d.correo], reply_to: RESPONDER_A, subject: asunto, html: html(datos), text: texto(datos) }),
      });
      if (r.ok) enviados++;
      else console.error("Resend", r.status, (await r.text()).slice(0, 200));
    }
    if (enviados) await admin.from("bitacora").update({ avisado_en: new Date().toISOString(), avisados: enviados }).eq("id", id);
    if (!enviados) return responder({ error: "Resend no aceptó el envío. Revisa la llave RESEND_API_KEY.", sin_cuenta: sinCuenta }, 502);
    return responder({ enviados, fallidos: destinos.length - enviados, sin_cuenta: sinCuenta });
  } catch (_e) {
    return responder({ error: "Error interno" }, 500);
  }
});
