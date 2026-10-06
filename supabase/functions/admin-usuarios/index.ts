// Portal AW-RiseCR · admin-usuarios
// Solo el administrador (con verificación en dos pasos) puede invitar, listar y activar o desactivar
// usuarios de un negocio. Usa la llave secreta del servidor; nunca se expone al navegador.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const ORIGENES = ["http://127.0.0.1:8788", "http://localhost:8788", "https://awrisecr.com", "https://www.awrisecr.com"];
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const LLAVE_SECRETA = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { return undefined; }
})() ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encabezados(origen: string | null) {
  return {
    "Access-Control-Allow-Origin": origen && ORIGENES.includes(origen) ? origen : ORIGENES[2],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
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

    const cuerpo = await req.json().catch(() => ({}));

    switch (cuerpo.accion) {
      case "invitar": {
        const correo = String(cuerpo.correo ?? "").trim().toLowerCase();
        const nombre = String(cuerpo.nombre ?? "").trim().slice(0, 120);
        const negocio = String(cuerpo.negocio_id ?? "");
        if (!CORREO.test(correo) || !nombre || !UUID.test(negocio)) return responder({ error: "Datos incompletos" }, 400);
        const { data: n } = await admin.from("negocios").select("id").eq("id", negocio).maybeSingle();
        if (!n) return responder({ error: "Negocio no encontrado" }, 404);
        const base = origen && ORIGENES.includes(origen) ? origen : "https://awrisecr.com";
        const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, { data: { nombre }, redirectTo: `${base}/portal/` });
        if (error) {
          const ya = /already|registered|exists/i.test(error.message);
          return responder({ error: ya ? "Ese correo ya tiene una cuenta en el portal" : "No se pudo enviar la invitación" }, 400);
        }
        await admin.from("perfiles").update({ negocio_id: negocio, nombre, rol: "cliente" }).eq("id", data.user.id);
        return responder({ ok: true, usuario_id: data.user.id });
      }

      case "activar":
      case "desactivar": {
        const id = String(cuerpo.usuario_id ?? "");
        if (!UUID.test(id)) return responder({ error: "Usuario inválido" }, 400);
        if (id === claims.sub) return responder({ error: "No puedes desactivar tu propia cuenta" }, 400);
        const activo = cuerpo.accion === "activar";
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
        if (error) return responder({ error: "No se pudo actualizar el acceso" }, 400);
        await admin.from("perfiles").update({ activo }).eq("id", id);
        return responder({ ok: true });
      }

      case "usuarios": {
        const negocio = String(cuerpo.negocio_id ?? "");
        if (!UUID.test(negocio)) return responder({ error: "Negocio inválido" }, 400);
        const { data: perfiles } = await admin.from("perfiles").select("id, nombre, activo, creado_en").eq("negocio_id", negocio).order("creado_en");
        const usuarios = [];
        for (const p of perfiles ?? []) {
          const { data } = await admin.auth.admin.getUserById(p.id);
          usuarios.push({ ...p, correo: data.user?.email ?? "", confirmado: Boolean(data.user?.email_confirmed_at), ultimo_acceso: data.user?.last_sign_in_at ?? null });
        }
        return responder({ usuarios });
      }

      default:
        return responder({ error: "Acción desconocida" }, 400);
    }
  } catch (_e) {
    return responder({ error: "Error interno" }, 500);
  }
});
