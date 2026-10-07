// Portal AW-RiseCR · acceso, menú de carpetas, Inicio y Bitácora (el panel del administrador vive en admin.js)
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS, CONTACTO, TURNSTILE_SITEKEY } from "/portal/config.js";
import { $, el, icono, fecha, fechaCorta, hora, dinero, fLarga, estadoCobro, cargador, ETAPAS, TIPOS, ESTADO_COBRO } from "/portal/util.js";
import { iniciarCliente, vistaPagos, vistaFondo, vistaDocumentos, vistaAccesos } from "/portal/cliente.js";
import { abrirTour } from "/portal/tour.js";
import { configurarCaptcha, crearCaptcha } from "/portal/captcha.js";

// El tipo de enlace (invitación o recuperación) se lee antes de que Supabase limpie la dirección
const hashInicial = new URLSearchParams(location.hash.slice(1));
const tipoEnlace = hashInicial.get("type");
const errorEnlace = hashInicial.get("error_description");

// Modo demo: solo en la computadora de desarrollo, con ?demo o ?demo=cliente
const parametros = new URLSearchParams(location.search);
const esLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const DEMO = esLocal && parametros.has("demo");

// Captcha: en demo solo con ?captcha (llaves de prueba públicas de Cloudflare: "si" pasa solo, "reto" pide un clic)
const CAPTCHA_PRUEBA = { si: "1x00000000000000000000AA", reto: "3x00000000000000000000FF" };
configurarCaptcha(DEMO ? CAPTCHA_PRUEBA[parametros.get("captcha")] || (parametros.has("captcha") ? CAPTCHA_PRUEBA.si : "") : TURNSTILE_SITEKEY);


// ---------- Sesión guardada ----------
// Con "Mantener la sesión iniciada", la sesión se guarda en este navegador por 30 días (localStorage). Si no, vive solo
// mientras la pestaña esté abierta (sessionStorage). La fecha límite se guarda aparte; al vencer, se cierra la sesión.
const MARCA_RECORDAR = "aw-recordar-hasta";
const DIAS_RECORDAR = 30;
const local = {
  leer(k) { try { return localStorage.getItem(k); } catch { return null; } },
  poner(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ } },
  quitar(k) { try { localStorage.removeItem(k); } catch { /* nada que quitar */ } },
};
const recordando = () => Number(local.leer(MARCA_RECORDAR) || 0) > Date.now();
const recordarVencido = () => { const hasta = Number(local.leer(MARCA_RECORDAR) || 0); return hasta > 0 && hasta <= Date.now(); };
function recordarSesion(si) {
  if (si) local.poner(MARCA_RECORDAR, String(Date.now() + DIAS_RECORDAR * 86400000)); else local.quitar(MARCA_RECORDAR);
}
const almacenSesion = {
  getItem(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) {
    try {
      const [usar, limpiar] = recordando() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      usar.setItem(k, v); limpiar.removeItem(k);
    } catch { /* sin almacenamiento */ }
  },
  removeItem(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch { /* nada que quitar */ } },
};

// ---------- Datos ----------
let sb = null;
async function conectar() {
  const { createClient } = await import(SUPABASE_JS);
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storage: almacenSesion },
  });
}

const datosReales = {
  async perfil(uid) {
    const { data, error } = await sb.from("perfiles").select("id, nombre, rol, activo, negocio_id, tour_visto_en").eq("id", uid).maybeSingle();
    if (error) throw error;
    return data;
  },
  async negocios() {
    const { data, error } = await sb.from("negocios").select("id, nombre, ciudad, estado, proyectos(etapa, creado_en)").order("nombre");
    if (error) throw error;
    return data;
  },
  async negocio(id) {
    const { data, error } = await sb.from("negocios").select("id, nombre, ciudad").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async proyectos(negocioId) {
    const { data, error } = await sb.from("proyectos").select("*").eq("negocio_id", negocioId).order("creado_en", { ascending: false });
    if (error) throw error;
    return data;
  },
  async ultimaEntrada(negocioId) {
    const { data, error } = await sb.from("bitacora")
      .select("id, tipo, titulo, nota, requiere_aprobacion, aprobado_en, creado_en, proyecto_id, adjuntos(id, ruta, nombre, tipo_mime, tamano)")
      .eq("negocio_id", negocioId).order("creado_en", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  async bitacora(proyectoId) {
    const { data, error } = await sb.from("bitacora")
      .select("id, tipo, titulo, nota, requiere_aprobacion, aprobado_en, creado_en, avisado_en, avisados, adjuntos(id, ruta, nombre, tipo_mime, tamano)")
      .eq("proyecto_id", proyectoId).order("creado_en", { ascending: false });
    if (error) throw error;
    return data;
  },
  async proximoCobro(negocioId) {
    const { data, error } = await sb.from("cobros_estado").select("concepto, monto, vence, estado, proyecto_id").eq("negocio_id", negocioId)
      .in("estado", ["atrasado", "por_vencer", "programado"]).order("vence").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  async fondo(negocioId) {
    const { data, error } = await sb.from("fondo_saldos").select("saldo, proximo_vencimiento, referidos").eq("negocio_id", negocioId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async cobros(negocioId) {
    const { data, error } = await sb.from("cobros_estado").select("*").eq("negocio_id", negocioId).order("vence");
    if (error) throw error;
    return data;
  },
  async servicios(negocioId) {
    const { data, error } = await sb.from("servicios").select("*, proyectos(nombre, etapa, entregado_en)").eq("negocio_id", negocioId).order("creado_en");
    if (error) throw error;
    return data;
  },
  // Accesos: el usuario viene descifrado solo para su propio negocio (o el admin)
  async accesos(negocioId) {
    const { data, error } = await sb.rpc("accesos_de", { p_negocio: negocioId });
    if (error) throw error;
    return data || [];
  },
  // Datos de pago (SINPE, cuenta, IBAN): en la base de datos, solo para usuarios con sesión
  async pago() {
    const { data, error } = await sb.from("ajustes").select("valor").eq("clave", "pago").maybeSingle();
    if (error) throw error;
    return data?.valor || {};
  },
  async movimientos(negocioId) {
    const { data, error } = await sb.from("fondo_movimientos").select("id, tipo, monto, descripcion, fecha, vence").eq("negocio_id", negocioId).order("creado_en", { ascending: false });
    if (error) throw error;
    return data;
  },
  async documentos(negocioId) {
    const { data, error } = await sb.from("documentos").select("id, tipo, titulo, contenido, proyecto_id, creado_en, adjuntos(id, ruta, nombre, tipo_mime, tamano)")
      .eq("negocio_id", negocioId).order("creado_en", { ascending: false });
    if (error) throw error;
    return data;
  },
  async urls(rutas) {
    if (!rutas.length) return {};
    const { data, error } = await sb.storage.from("portal").createSignedUrls(rutas, 3600);
    if (error) throw error;
    return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  },
  async aprobar(id) {
    const { error } = await sb.rpc("aprobar_entrada", { p_entrada: id });
    if (error) throw error;
  },
  async marcarTour() {
    const { error } = await sb.rpc("marcar_tour_visto");
    if (error) throw error;
  },
  async cuenta() {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user;
  },
  // Cambio de contraseña: primero confirma la actual con una sesión aparte (no toca la sesión abierta ni la verificación en
  // dos pasos del administrador) y después la cambia. Si Supabase pide volver a autenticarse (sesión de más de 24 horas),
  // la cambia con la sesión recién confirmada. La sesión aparte se cierra siempre al final.
  async cambiarClave(actual, nueva, cerrarOtras, captchaToken) {
    const { data: { user } } = await sb.auth.getUser();
    const { createClient } = await import(SUPABASE_JS);
    const aparte = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "aw-confirmar-clave" },
    });
    const { error: errorActual } = await aparte.auth.signInWithPassword({ email: user.email, password: actual, options: { captchaToken } });
    if (errorActual) {
      throw /invalid/i.test(`${errorActual.code} ${errorActual.message}`) ? Object.assign(new Error("Clave actual incorrecta"), { code: "clave_actual" }) : errorActual;
    }
    try {
      let { error } = await sb.auth.updateUser({ password: nueva, currentPassword: actual });
      if (error?.code === "reauthentication_needed") ({ error } = await aparte.auth.updateUser({ password: nueva, currentPassword: actual }));
      if (error) throw error;
    } finally {
      await aparte.auth.signOut({ scope: "local" }).catch(() => {});
    }
    if (cerrarOtras) await sb.auth.signOut({ scope: "others" }).catch(() => {});
  },
  async enlaceClave(correo, captchaToken) {
    const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + "/portal/", captchaToken });
    if (error) throw error;
  },
};

// Datos de ejemplo para revisar el diseño en la computadora de desarrollo
const hace = (dias, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
const enDias = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const DEMO_NEGOCIO = { id: "demo-1", nombre: "Surf & Coffee Tamarindo", ciudad: "Tamarindo" };
const datosDemo = {
  async perfil() { return { id: "demo", nombre: parametros.get("demo") === "cliente" ? "Mariana Solís" : "Andrew Corea Flores", rol: parametros.get("demo") === "cliente" ? "cliente" : "admin", activo: true, negocio_id: parametros.get("demo") === "cliente" ? "demo-1" : null, tour_visto_en: null }; },
  async negocios() { return [{ ...DEMO_NEGOCIO, estado: "activo", proyectos: [{ etapa: "desarrollo" }] }, { id: "demo-2", nombre: "Tamarindo Tours", ciudad: "Tamarindo", estado: "activo", proyectos: [{ etapa: "anticipo" }] }]; },
  async negocio(id) { return id === "demo-2" ? { id, nombre: "Tamarindo Tours", ciudad: "Tamarindo" } : DEMO_NEGOCIO; },
  async proyectos(id) {
    return id === "demo-2" ? [] : [
      { id: "p-2", nombre: "Tienda en línea", etapa: "diseno", monto_total: 800, inicio: enDias(-3), entrega_estimada: enDias(30) },
      { id: "p-1", nombre: "Página web con reservas", etapa: "desarrollo", monto_total: 600, inicio: enDias(-14), entrega_estimada: enDias(14) },
    ];
  },
  async ultimaEntrada(id) { return id === "demo-2" ? null : { ...(await this.bitacora("p-1"))[0], proyecto_id: "p-1" }; },
  async bitacora(proyectoId) {
    if (proyectoId === "p-2") return [
      { id: "c2", tipo: "avance", titulo: "Bocetos de la tienda", nota: "Primera propuesta de la página de productos y el carrito.", creado_en: hace(1, 11, 20), adjuntos: [] },
      { id: "c1", tipo: "inicio", titulo: "Arrancamos la tienda en línea", nota: "Segundo proyecto con AW-RiseCR: catálogo, carrito y pagos.", creado_en: hace(3, 9, 0), adjuntos: [] },
    ];
    return [
      { id: "b5", tipo: "aprobacion", titulo: 'Textos de la sección "Nuestro menú"', nota: "Revisa los precios y nombres de los platos antes de publicarlos.", requiere_aprobacion: true, aprobado_en: null, creado_en: hace(0, 16, 40), adjuntos: [] },
      { id: "b4", tipo: "avance", titulo: "Sistema de reservas conectado", nota: "Ya puedes probar reservar una mesa desde el celular. Te dejé capturas del paso a paso.", creado_en: hace(0, 16, 12), adjuntos: [{ id: "a1", ruta: "demo/1.png", nombre: "reservas.png", tipo_mime: "image/png" }, { id: "a2", ruta: "demo/2.png", nombre: "whatsapp.png", tipo_mime: "image/png" }] },
      { id: "b3", tipo: "entregable", titulo: "Diseño aprobado: página de inicio y menú", nota: "Versión final del diseño, aprobada por ti.", creado_en: hace(4, 10, 5), adjuntos: [{ id: "a3", ruta: "demo/diseno.pdf", nombre: "diseno-inicio-v2.pdf", tipo_mime: "application/pdf", tamano: 2400000 }] },
      { id: "b2", tipo: "nota", titulo: "Fotos del local recibidas", nota: "Usaremos 6 en la portada y la galería.", creado_en: hace(7, 18, 30), adjuntos: [] },
      { id: "b1", tipo: "inicio", titulo: "¡Arrancamos! Bienvenida a AW-RiseCR", nota: "Recibimos tu anticipo. Tu documento de bienvenida explica las etapas.", creado_en: hace(14, 9, 0), adjuntos: [] },
    ];
  },
  async proximoCobro(id) { return (await this.cobros(id)).filter((c) => ["atrasado", "por_vencer", "programado"].includes(c.estado))[0] || null; },
  async fondo(id) { return id === "demo-2" ? null : { saldo: 115, proximo_vencimiento: enDias(300), referidos: 1 }; },
  async cobros(id) {
    if (id === "demo-2") return [];
    return [
      { id: "c1", proyecto_id: "p-1", concepto: "Anticipo 50 % · Página web con reservas", monto: 300, vence: enDias(-14), pagado_en: enDias(-14), metodo: "SINPE Móvil" },
      { id: "c3", proyecto_id: "p-2", concepto: "Anticipo 50 % · Tienda en línea", monto: 400, vence: enDias(-3), pagado_en: enDias(-3), metodo: "Transferencia" },
      { id: "c2", proyecto_id: "p-1", concepto: "Saldo 50 % al publicar · Página web con reservas", monto: 300, vence: enDias(14) },
      { id: "c4", proyecto_id: "p-2", concepto: "Saldo 50 % al publicar · Tienda en línea", monto: 400, vence: enDias(30) },
    ].map((c) => ({ ...c, estado: estadoCobro(c) })).sort((a, b) => a.vence.localeCompare(b.vence));
  },
  async servicios(id) {
    return id === "demo-2" ? [] : [{ id: "s1", proyecto_id: "p-1", tipo: "mantenimiento", plan: "Mantenimiento web", monto_mensual: 25, estado: "activo",
      proyectos: { nombre: "Página web con reservas", etapa: "desarrollo", entregado_en: null } }];
  },
  async accesos(id) {
    return id === "demo-2" ? [] : [
      { id: "a1", servicio: "Dominio surfcoffee.cr", proveedor: "NIC Costa Rica", titular: "Surf & Coffee S.A.", usuario: "hola@surfcoffee.cr", vence: enDias(20), estado: "activo", enlace_bitwarden: null },
      { id: "a2", servicio: "Hosting y correo", proveedor: "Cloudflare", titular: "Surf & Coffee S.A.", usuario: "admin@surfcoffee.cr", vence: enDias(240), estado: "activo", enlace_bitwarden: "https://send.bitwarden.com/#ejemplo" },
    ];
  },
  // Valores de ejemplo, no reales: los datos de verdad solo viven en la base de datos
  async pago() { return { sinpe: "8000-0000", sinpe_titular: "Nombre del titular", banco: "BAC", cuenta_titular: "NOMBRE DEL TITULAR", cuenta: "000000000", iban: "CR00 0000 0000 0000 0000 00" }; },
  async movimientos(id) {
    return id === "demo-2" ? [] : [
      { id: "m3", tipo: "referido", monto: 90, descripcion: "Recomendaste a Tamarindo Tours", fecha: enDias(-65), vence: enDias(300) },
      { id: "m1", tipo: "bienvenida", monto: 25, descripcion: "Bienvenida por venir recomendado", fecha: enDias(-90), vence: enDias(275) },
    ];
  },
  async documentos(id) {
    return id === "demo-2" ? [] : [
      { id: "d2", tipo: "bienvenida", titulo: "Bienvenida · Tienda en línea", contenido: { plantilla: "bienvenida", version: 1 }, proyecto_id: "p-2", creado_en: hace(3, 9, 0), adjuntos: [] },
      { id: "d1", tipo: "bienvenida", titulo: "Bienvenida · Página web con reservas", contenido: { plantilla: "bienvenida", version: 1 }, proyecto_id: "p-1", creado_en: hace(14, 9, 0), adjuntos: [] },
      { id: "d0", tipo: "propuesta", titulo: "Propuesta firmada", contenido: null, proyecto_id: "p-1", creado_en: hace(16, 15, 0), adjuntos: [{ id: "a9", ruta: "demo/propuesta.pdf", nombre: "propuesta.pdf", tipo_mime: "application/pdf" }] },
    ];
  },
  async urls(rutas) { return Object.fromEntries(rutas.map((r) => [r, "/project-preview-odrys-mobile-v5.jpg"])); },
  async aprobar() {},
  async marcarTour() {},
  async cuenta() { return { email: parametros.get("demo") === "cliente" ? "mariana@surfcoffee.cr" : CONTACTO.correo, last_sign_in_at: hace(0, 8, 15) }; },
  // En demo, la contraseña actual "incorrecta" muestra el error; cualquier otra simula el cambio
  async cambiarClave(actual, nueva, cerrar, captchaToken) {
    await esperar(500);
    if (parametros.has("captcha") && !captchaToken) throw Object.assign(new Error("captcha"), { code: "captcha" });
    if (actual === "incorrecta") throw Object.assign(new Error("Clave actual incorrecta"), { code: "clave_actual" });
  },
  async enlaceClave() { await esperar(400); },
};

const datos = DEMO ? datosDemo : datosReales;

// ---------- Estado ----------
const estado = { perfil: null, seccion: "inicio", negocioVista: null, proyectoVista: null, documentoVista: null };

// ---------- Acceso ----------
function mostrar(id) {
  for (const s of ["carga", "acceso", "app"]) $("#" + s).hidden = s !== id;
}
function mostrarForm(id) {
  for (const f of document.querySelectorAll(".formulario")) f.hidden = f.id !== id;
  const aviso = $("#" + id + " .aviso"); if (aviso) aviso.hidden = true;
  $("#" + id + " input")?.focus();
}
function avisar(form, texto, tipo = "error") {
  const a = $(".aviso", form); a.textContent = texto; a.className = "aviso " + tipo; a.hidden = false;
}
function traducirError(e) {
  const m = (e?.message || "").toLowerCase();
  if (e?.code === "captcha" || m.includes("captcha")) return "No pudimos comprobar que eres una persona. Recarga la página e inténtalo de nuevo.";
  if (e?.code === "limite_solicitudes" || e?.status === 429) return "Demasiadas solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.";
  if (e?.code === "clave_actual" || m.includes("current password")) return "Tu contraseña actual no es correcta.";
  if (e?.code === "reauthentication_needed") return "Por seguridad, cierra sesión, vuelve a entrar y cambia tu contraseña otra vez.";
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Revisa la invitación que te enviamos.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("should be different")) return "La nueva contraseña debe ser distinta a la anterior.";
  if (m.includes("weak") || m.includes("at least")) return "La contraseña es muy débil. Usa al menos 10 caracteres.";
  return "Algo salió mal. Inténtalo de nuevo en un momento.";
}
const esClaveIncorrecta = (e) => e?.code === "clave_actual" || /invalid login|invalid_credentials/i.test(`${e?.code} ${e?.message}`);

// Freno de intentos en este navegador: después de 5 fallos seguidos hay que esperar 30 s, y la espera se duplica con
// cada fallo nuevo (máximo 15 min). La protección de fondo está en el servidor (límites de Supabase y el captcha);
// esto evita que alguien martille el botón desde la pantalla.
function freno(nombre) {
  const k = "aw-freno-" + nombre;
  const leer = () => { try { return JSON.parse(local.leer(k)) || { fallos: 0, hasta: 0 }; } catch { return { fallos: 0, hasta: 0 }; } };
  return {
    espera: () => Math.max(0, leer().hasta - Date.now()),
    fallo() {
      const e = leer(); e.fallos += 1;
      if (e.fallos >= 5) e.hasta = Date.now() + Math.min(30000 * 2 ** (e.fallos - 5), 900000);
      local.poner(k, JSON.stringify(e));
    },
    exito: () => local.quitar(k),
  };
}
const frenos = { entrar: freno("entrar"), mfa: freno("mfa"), cuenta: freno("cuenta") };

// Deja un botón desactivado con cuenta regresiva en su texto (freno de intentos o espera para reenviar un correo)
const enCuenta = (boton) => Boolean(boton._cuenta);
const tiempo = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);
function cuentaRegresiva(boton, ms, rotulo) {
  clearInterval(boton._cuenta);
  boton._rotulo ??= boton.textContent;
  const fin = Date.now() + ms;
  const pintar = () => {
    const s = Math.ceil((fin - Date.now()) / 1000);
    if (s <= 0) { clearInterval(boton._cuenta); boton._cuenta = null; boton.disabled = false; boton.textContent = boton._rotulo; return; }
    boton.disabled = true; boton.textContent = rotulo(tiempo(s));
  };
  boton._cuenta = setInterval(pintar, 1000);
  pintar();
}
function frenar(form, boton, f) {
  if (!f.espera()) return false;
  avisar(form, "Demasiados intentos fallidos. Por seguridad, espera un momento antes de volver a intentar.");
  cuentaRegresiva(boton, f.espera(), (t) => `Espera ${t}`);
  return true;
}

function prepararAcceso() {
  document.querySelectorAll("[data-ir-form]").forEach((b) => b.addEventListener("click", () => mostrarForm(b.dataset.irForm)));

  const captchaEntrar = crearCaptcha($("#form-entrar [data-captcha]"));
  const captchaRecuperar = crearCaptcha($("#form-recuperar [data-captcha]"));
  $("#entrar-recordar").checked = recordando();
  frenar($("#form-entrar"), $("#form-entrar button[type=submit]"), frenos.entrar); // si quedó un freno de antes

  $("#form-entrar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const correo = $("#entrar-correo").value.trim(), clave = $("#entrar-clave").value;
    if (!correo || !clave) return avisar(form, "Escribe tu correo y tu contraseña.");
    if (frenar(form, boton, frenos.entrar)) return;
    boton.disabled = true;
    try {
      recordarSesion($("#entrar-recordar").checked);
      if (DEMO) {
        if (parametros.has("captcha")) { await captchaEntrar.token(); captchaEntrar.reiniciar(); }
        if (clave === "incorrecta") throw new Error("Invalid login credentials"); // para probar el freno en demo
        frenos.entrar.exito(); await entrarAlPortal(); return;
      }
      const captchaToken = await captchaEntrar.token();
      const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave, options: { captchaToken } });
      captchaEntrar.reiniciar();
      if (error) throw error;
      frenos.entrar.exito();
      $("#entrar-clave").value = "";
      await entrarAlPortal();
    } catch (e) {
      if (esClaveIncorrecta(e)) frenos.entrar.fallo();
      if (!frenar(form, boton, frenos.entrar)) avisar(form, traducirError(e));
    } finally { if (!enCuenta(boton)) boton.disabled = false; }
  });

  $("#form-recuperar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const correo = $("#recuperar-correo").value.trim();
    if (!correo) return avisar(form, "Escribe tu correo.");
    boton.disabled = true;
    try {
      if (!DEMO) {
        const captchaToken = await captchaRecuperar.token();
        const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + "/portal/", captchaToken });
        captchaRecuperar.reiniciar();
        if (error && !/rate/i.test(error.message)) throw error;
      }
      // Mismo mensaje exista o no el correo, para no revelar quién tiene cuenta. Un minuto antes de poder reenviar.
      avisar(form, "Si ese correo tiene acceso, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.", "ok");
      cuentaRegresiva(boton, 60000, (t) => `Puedes reenviar en ${t}`);
    } catch (e) { avisar(form, traducirError(e)); }
    finally { if (!enCuenta(boton)) boton.disabled = false; }
  });

  $("#form-clave").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const a = $("#clave-nueva").value, b = $("#clave-repetir").value;
    if (a.length < 10) return avisar(form, "La contraseña debe tener al menos 10 caracteres.");
    if (a !== b) return avisar(form, "Las contraseñas no coinciden.");
    boton.disabled = true;
    try {
      if (!DEMO) { const { error } = await sb.auth.updateUser({ password: a }); if (error) throw error; }
      history.replaceState(null, "", location.pathname);
      await entrarAlPortal();
    } catch (e) { avisar(form, traducirError(e)); }
    finally { boton.disabled = false; }
  });

  $("#form-mfa").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const codigo = $("#mfa-codigo").value.replace(/\D/g, "");
    if (codigo.length !== 6) return avisar(form, "Escribe los 6 dígitos del código.");
    if (frenar(form, boton, frenos.mfa)) return;
    boton.disabled = true;
    try {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factorMfa, code: codigo });
      if (error) throw error;
      frenos.mfa.exito();
      await entrarAlPortal();
    } catch (e) {
      if (/rate limit|too many/i.test(e?.message || "")) avisar(form, traducirError(e));
      else { frenos.mfa.fallo(); if (!frenar(form, boton, frenos.mfa)) avisar(form, "Código incorrecto o vencido. Escribe el código nuevo que muestra la app."); }
    }
    finally { if (!enCuenta(boton)) boton.disabled = false; }
  });

  document.querySelectorAll("[data-salir]").forEach((b) => b.addEventListener("click", salir));
  document.querySelectorAll(".lateral-pie [data-ayuda]").forEach((b) => b.addEventListener("click", () => iniciarRecorrido()));
}

// ---------- Verificación en dos pasos (obligatoria para el administrador) ----------
let factorMfa = null;
async function asegurarDosPasos() {
  const { data: nivel } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.currentLevel === "aal2") return true;
  const { data: factores } = await sb.auth.mfa.listFactors();
  const verificado = (factores?.totp || []).find((f) => f.status === "verified");
  mostrar("acceso");
  if (verificado) {
    factorMfa = verificado.id;
    $("#mfa-titulo").textContent = "Verificación en dos pasos";
    $("#mfa-texto").textContent = "Abre tu app de autenticación y escribe el código de 6 dígitos.";
    $("#mfa-qr").hidden = true;
  } else {
    // Limpia intentos de registro que quedaron sin terminar
    for (const f of (factores?.all || []).filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Portal AW " + new Date().toISOString().slice(0, 10) });
    if (error) { mostrarForm("form-entrar"); avisar($("#form-entrar"), "No se pudo preparar la verificación en dos pasos. Inténtalo de nuevo."); return false; }
    factorMfa = data.id;
    $("#mfa-titulo").textContent = "Activa la verificación en dos pasos";
    $("#mfa-texto").textContent = "Escanea este código con Google Authenticator o Microsoft Authenticator en tu celular y escribe el código que aparece.";
    $("#mfa-imagen").src = data.totp.qr_code;
    $("#mfa-secreto").textContent = data.totp.secret;
    $("#mfa-qr").hidden = false;
  }
  mostrarForm("form-mfa");
  $("#mfa-codigo").value = "";
  return false;
}

async function salir() {
  if (!DEMO) await sb.auth.signOut();
  recordarSesion(false);
  estado.perfil = null;
  mostrar("acceso"); mostrarForm("form-entrar");
}

async function entrarAlPortal() {
  mostrar("carga");
  let uid = "demo";
  if (!DEMO) {
    const { data } = await sb.auth.getUser();
    if (!data?.user) { mostrar("acceso"); mostrarForm("form-entrar"); return; }
    uid = data.user.id;
  }
  const perfil = await datos.perfil(uid);
  if (!perfil || !perfil.activo) {
    if (!DEMO) await sb.auth.signOut();
    mostrar("acceso"); mostrarForm("form-entrar");
    avisar($("#form-entrar"), "Tu acceso está desactivado. Escríbenos si crees que es un error.");
    return;
  }
  if (perfil.rol === "admin" && !DEMO && !(await asegurarDosPasos())) return;
  estado.perfil = perfil;
  estado.seccion = perfil.rol === "admin" ? "panel" : "inicio";
  estado.negocioVista = perfil.rol === "admin" ? null : perfil.negocio_id;
  $("#pie-nombre").textContent = perfil.nombre || "Mi cuenta";
  $("#marca-sub").textContent = perfil.rol === "admin" ? "Panel interno" : "Portal cliente";
  if (perfil.negocio_id) {
    const n = await datos.negocio(perfil.negocio_id).catch(() => null);
    $("#pie-negocio").textContent = n?.nombre || "";
  }
  for (const b of document.querySelectorAll("[data-ayuda]")) b.hidden = perfil.rol !== "cliente";
  mostrar("app");
  pintarMenu();
  await pintarVista();
  // La primera vez que entra un cliente, el recorrido de bienvenida (en demo: con ?tour)
  if (perfil.rol === "cliente" && (DEMO ? parametros.has("tour") : !perfil.tour_visto_en)) setTimeout(iniciarRecorrido, 450);
}

// ---------- Recorrido de bienvenida ----------
function pasosRecorrido() {
  const nombre = (estado.perfil.nombre || "").split(" ")[0];
  const menu = (id) => `#menu [data-seccion="${id}"]`;
  return [
    { portada: true, etiqueta: "Portal de clientes", titulo: `¡Te damos la bienvenida${nombre ? ", " + nombre : ""}!`,
      texto: "Este es tu portal con AW-RiseCR. Aquí sigues todo tu proyecto, en un solo lugar:",
      destacados: [["bitacora", "Cada avance con fecha y hora, y lo que necesita tu aprobación."],
                   ["pagos", "Tus pagos, tus mensualidades y tu Fondo AW."],
                   ["documentos", "Tus documentos y los accesos de tu negocio."]],
      pie: "Te muestro dónde está cada cosa en menos de un minuto." },
    { objetivo: menu("inicio"), titulo: "Inicio", texto: "Tu resumen: cómo va cada proyecto, el último avance, tu próximo pago y tu Fondo AW." },
    { objetivo: menu("bitacora"), titulo: "Bitácora", texto: "Cada avance de tu proyecto con fecha y hora, del más reciente al primero. Si algo necesita tu visto bueno, aquí aparece el botón Aprobar." },
    { objetivo: menu("pagos"), titulo: "Pagos", texto: "Lo que falta por pagar, tus mensualidades y el historial. Aquí están los datos para pagar por SINPE Móvil o transferencia." },
    { objetivo: menu("fondo"), titulo: "Fondo AW", texto: "Tu crédito por recomendarnos, para tus próximos desarrollos. Desde aquí puedes recomendarnos por WhatsApp." },
    { objetivo: menu("documentos"), titulo: "Documentos", texto: "Tu documento de bienvenida, propuestas, acuerdos y comprobantes, listos para abrir o descargar." },
    { objetivo: menu("accesos"), titulo: "Accesos", texto: "Tu dominio, hosting y cuentas, con sus fechas de renovación. Las contraseñas no se guardan aquí: te las enviamos con un enlace seguro." },
    { objetivo: menu("cuenta"), titulo: "Mi cuenta", texto: "Tus datos de acceso al portal. Aquí puedes cambiar tu contraseña cuando quieras." },
    { objetivo: "[data-ayuda]", titulo: "¿Dudas?", texto: "Puedes volver a ver este recorrido aquí cuando quieras. Y cada avance nuevo también te llega por correo." },
  ];
}

function iniciarRecorrido() {
  abrirTour(pasosRecorrido(), {
    alTerminar: async () => {
      if (estado.perfil.tour_visto_en) return;
      estado.perfil.tour_visto_en = new Date().toISOString();
      await datos.marcarTour().catch((e) => console.error(e)); // si falla, solo se vuelve a mostrar la próxima vez
    },
  });
}

// ---------- Mi cuenta ----------
// Datos de acceso y cambio de contraseña. Para cambiarla se pide la actual; si no la recuerda, le llega el enlace de
// recuperación a su correo (el mismo de "¿Olvidaste tu contraseña?").
async function vistaCuenta() {
  const perfil = estado.perfil;
  const [usuario, negocio] = await Promise.all([datos.cuenta(), perfil.negocio_id ? datos.negocio(perfil.negocio_id).catch(() => null) : null]);
  const dato = (etiqueta, valor) => el("div", { class: "dato-pago" }, el("small", {}, etiqueta), el("b", {}, valor || "—"));
  const campo = (id, etiqueta, autocompletar) => el("div", { class: "campo" }, el("label", { for: id }, etiqueta),
    el("input", { id, type: "password", autocomplete: autocompletar, minlength: autocompletar === "new-password" ? "10" : null, required: true }));
  const otras = el("input", { type: "checkbox", checked: true });
  const enlace = el("button", { class: "enlace", type: "button", onclick: pedirEnlace }, "¿No recuerdas tu contraseña actual? Te enviamos un enlace");
  const cajaCaptcha = el("div", { class: "captcha" });
  const form = el("form", { class: "form-cuenta", novalidate: true, onsubmit: cambiar },
    el("input", { type: "email", autocomplete: "username", value: usuario.email, readonly: true, hidden: true }), // para el gestor de contraseñas
    campo("cuenta-actual", "Contraseña actual", "current-password"),
    campo("cuenta-nueva", "Nueva contraseña", "new-password"),
    campo("cuenta-repetir", "Repite la nueva", "new-password"),
    el("label", { class: "casilla" }, otras, "Cerrar la sesión en mis otros dispositivos"),
    cajaCaptcha,
    el("div", { class: "acciones" }, el("button", { class: "boton primario", type: "submit" }, "Cambiar contraseña")),
    enlace,
    el("div", { class: "aviso", hidden: true }));
  const captcha = crearCaptcha(cajaCaptcha);
  queueMicrotask(() => frenar(form, $("button[type=submit]", form), frenos.cuenta)); // si quedó un freno de antes

  async function cambiar(ev) {
    ev.preventDefault();
    const boton = $("button[type=submit]", form);
    const actual = $("#cuenta-actual", form).value, nueva = $("#cuenta-nueva", form).value, repetir = $("#cuenta-repetir", form).value;
    if (!actual) return avisar(form, "Escribe tu contraseña actual.");
    if (nueva.length < 10) return avisar(form, "La nueva contraseña debe tener al menos 10 caracteres.");
    if (nueva.length > 128) return avisar(form, "La nueva contraseña puede tener como máximo 128 caracteres.");
    if (nueva !== repetir) return avisar(form, "Las contraseñas nuevas no coinciden.");
    if (nueva === actual) return avisar(form, "La nueva contraseña debe ser distinta a la actual.");
    if (frenar(form, boton, frenos.cuenta)) return;
    const cerrar = otras.checked;
    boton.disabled = true;
    try {
      const captchaToken = await captcha.token();
      try { await datos.cambiarClave(actual, nueva, cerrar, captchaToken); } finally { captcha.reiniciar(); }
      frenos.cuenta.exito();
      form.reset();
      avisar(form, "Listo, tu contraseña cambió. Úsala la próxima vez que entres." + (cerrar ? " También cerramos tu sesión en tus otros dispositivos." : ""), "ok");
    } catch (e) {
      if (esClaveIncorrecta(e)) frenos.cuenta.fallo();
      if (!frenar(form, boton, frenos.cuenta)) avisar(form, traducirError(e));
    } finally { if (!enCuenta(boton)) boton.disabled = false; }
  }
  async function pedirEnlace() {
    enlace.disabled = true;
    try {
      const captchaToken = await captcha.token();
      try { await datos.enlaceClave(usuario.email, captchaToken); } finally { captcha.reiniciar(); }
      avisar(form, `Te enviamos un enlace a ${usuario.email} para crear una contraseña nueva. Revisa también la carpeta de spam.`, "ok");
      enlace.textContent = "Enlace enviado. Si no te llega, puedes pedir otro en un minuto.";
      setTimeout(() => { enlace.disabled = false; enlace.textContent = "¿No recuerdas tu contraseña actual? Te enviamos un enlace"; }, 60000);
    } catch (e) { avisar(form, traducirError(e)); enlace.disabled = false; }
  }

  const ingreso = usuario.last_sign_in_at ? `${fecha(usuario.last_sign_in_at)} · ${hora(usuario.last_sign_in_at)}` : null;
  const escribenos = `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(`Hola, AW-RiseCR. Soy ${perfil.nombre || ""} y necesito actualizar los datos de mi cuenta del portal.`)}`;
  return [
    el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Mi cuenta"), el("h1", {}, "Tu cuenta"),
      el("p", {}, "Tus datos de acceso al portal y tu contraseña."))),
    el("div", { class: "rejilla dos-iguales arriba" },
      el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("b", {}, "Tus datos")),
        el("div", { class: "tarjeta-cuerpo" },
          el("div", { class: "metodo-pago" }, dato("Nombre", perfil.nombre), dato("Correo", usuario.email),
            perfil.rol === "admin" ? dato("Rol", "Administrador") : dato("Negocio", negocio?.nombre), dato("Último ingreso", ingreso)),
          perfil.rol === "admin"
            ? el("p", { class: "nota-cuenta" }, "Tu cuenta tiene la verificación en dos pasos activa.")
            : el("p", { class: "nota-cuenta" }, "¿Necesitas cambiar tu nombre o tu correo? ",
                el("a", { href: escribenos, target: "_blank", rel: "noopener" }, "Escríbenos por WhatsApp"), " y lo actualizamos."))),
      el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("b", {}, "Cambiar contraseña")),
        el("div", { class: "tarjeta-cuerpo" },
          el("p", { class: "nota-cuenta primera" }, "Mínimo 10 caracteres. Usa una frase que recuerdes y que no uses en otro lado."), form))),
  ];
}

// ---------- Menú de carpetas ----------
function secciones() {
  const cliente = [
    ["inicio", "Inicio"], ["bitacora", "Bitácora"], ["pagos", "Pagos"], ["fondo", "Fondo AW"],
    ["documentos", "Documentos"], ["accesos", "Accesos"],
  ];
  const cuenta = ["cuenta", "Mi cuenta"];
  return estado.perfil.rol === "admin" ? [["panel", "Clientes"], ["cobros", "Cobros"], ["publicar", "Publicar"], cuenta, ...cliente] : [...cliente, cuenta];
}
const SECCIONES_ADMIN = ["panel", "cliente", "cobros", "publicar"];
const ICONOS = { panel: "clientes", cobros: "pagos" };
const seccionDelMenu = (s) => (s === "cliente" ? "panel" : s);

function pintarMenu() {
  const menu = $("#menu");
  menu.replaceChildren(...secciones().map(([id, nombre, pronto]) =>
    el("button", { class: "carpeta" + (id === "inicio" && estado.perfil.rol === "admin" ? " separada" : ""), type: "button", "data-seccion": id,
      "aria-current": seccionDelMenu(estado.seccion) === id ? "page" : null, onclick: () => irA(id) },
      icono(ICONOS[id] || id), el("span", {}, nombre), pronto ? el("span", { class: "pronto" }, "PRONTO") : null)));
}

async function irA(seccion, { documento = null } = {}) {
  estado.seccion = seccion;
  estado.documentoVista = documento;
  pintarMenu();
  await pintarVista({ transicion: true });
}

// ---------- Vistas ----------
// Fundido entre secciones: la vista actual se desvanece mientras carga la nueva y la nueva entra suave.
// Los repintados dentro de una misma sección (guardar, aprobar) no se animan: el contenido cambia sin parpadeo.
const SALIDA_MS = 150;
const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let turnoVista = 0; // si se cambia de sección rápido, una carga vieja no pisa a la nueva

async function armarVista() {
  if (SECCIONES_ADMIN.includes(estado.seccion) && estado.perfil.rol === "admin") return vistaDelAdmin(estado.seccion);
  if (estado.seccion === "cuenta") return vistaCuenta();
  if (!estado.negocioVista) return sinNegocio();
  if (estado.seccion === "inicio") return vistaInicio();
  if (estado.seccion === "bitacora") return vistaBitacora();
  if (estado.seccion === "pagos") return vistaPagos();
  if (estado.seccion === "fondo") return vistaFondo();
  if (estado.seccion === "documentos") return vistaDocumentos();
  if (estado.seccion === "accesos") return vistaAccesos();
  return vistaPronto();
}

async function pintarVista({ transicion = false } = {}) {
  const vista = $("#vista");
  const turno = ++turnoVista;
  const primera = !vista.childNodes.length;
  const animar = (transicion || primera) && !movimientoReducido.matches;
  if (animar && !primera) { vista.classList.remove("entrando"); vista.classList.add("saliendo"); }
  // Si la carga tarda, se avisa en vez de dejar la pantalla vacía
  const lento = setTimeout(() => {
    if (turno !== turnoVista || !(animar || primera)) return;
    vista.classList.remove("saliendo", "entrando");
    vista.replaceChildren(cargador("Cargando…"));
  }, 600);
  let contenido;
  try {
    [contenido] = await Promise.all([armarVista(), animar && !primera ? esperar(SALIDA_MS) : null]);
    contenido = [...[].concat(contenido).filter(Boolean), el("div", { class: "movil-pie" },
      estado.seccion !== "cuenta" ? el("button", { class: "enlace", type: "button", onclick: () => irA("cuenta") }, "Mi cuenta") : null,
      estado.perfil.rol === "cliente" ? el("button", { class: "enlace", type: "button", "data-ayuda": true, onclick: iniciarRecorrido }, "¿Cómo funciona el portal?") : null,
      el("button", { class: "enlace", type: "button", onclick: salir }, "Cerrar sesión"))];
  } catch (e) {
    console.error(e);
    contenido = [el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "No pudimos cargar esta sección. Revisa tu conexión e inténtalo de nuevo."))];
  }
  clearTimeout(lento);
  if (turno !== turnoVista) return;
  vista.replaceChildren(...contenido);
  vista.classList.remove("saliendo");
  if (transicion) window.scrollTo(0, 0);
  if (animar) {
    vista.classList.remove("entrando");
    void vista.offsetWidth; // reinicia la animación de entrada
    vista.classList.add("entrando");
  }
}

function selectorAdmin(negocios) {
  if (estado.perfil.rol !== "admin") return null;
  const select = el("select", { "aria-label": "Ver el portal de", onchange: async (e) => { estado.negocioVista = e.target.value || null; estado.proyectoVista = null; estado.documentoVista = null; await pintarVista({ transicion: true }); } },
    el("option", { value: "" }, "Elige un cliente…"),
    negocios.map((n) => el("option", { value: n.id, selected: n.id === estado.negocioVista }, n.nombre)));
  return el("div", { class: "selector-negocio" }, el("span", {}, "Ver el portal de"), select);
}

function sinNegocio() {
  if (estado.perfil.rol === "admin") {
    return el("div", {}, el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Vista del cliente"), el("h1", {}, "Elige un cliente"),
      el("p", {}, "Ve a Clientes y elige uno para ver su portal tal como él lo ve."))),
      el("button", { class: "boton primario", type: "button", onclick: () => irA("panel") }, "Ir a Clientes"));
  }
  return el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Tu cuenta todavía no está vinculada a un negocio. Escríbenos y lo activamos."));
}

function vistaPronto() {
  return el("div", {}, el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Próximamente"), el("h1", {}, "Esta sección está en camino"))),
    el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Pronto vas a ver aquí esta información. Mientras tanto, cualquier consulta por WhatsApp al 8584-7369.")));
}

// El código del panel solo se descarga cuando entra el administrador
let admin = null;
async function vistaDelAdmin(seccion) {
  if (!admin) {
    admin = await import("/portal/admin.js");
    admin.iniciarAdmin({ get sb() { return sb; }, DEMO, estado, irA, pintarVista });
  }
  return admin.vistaAdmin(seccion);
}

function bloqueEtapas(proyecto) {
  const idx = ETAPAS.findIndex(([k]) => k === proyecto.etapa);
  const fechas = { anticipo: proyecto.inicio, publicada: proyecto.entregado_en || proyecto.entrega_estimada };
  return el("div", { class: "etapas" }, ETAPAS.map(([k, nombre], i) =>
    el("div", { class: "etapa " + (i < idx || proyecto.etapa === "publicada" ? "hecha" : i === idx ? "actual" : "") },
      el("b", {}, nombre), el("span", {}, i === idx && k !== "publicada" ? "en curso" : fechas[k] ? (i > idx ? "~" : "") + fechaCorta(fechas[k]) : ""))));
}

async function vistaInicio() {
  const id = estado.negocioVista;
  const [negocio, proyectos, ultima, cobro, fondo, documentos, negocios] = await Promise.all([
    datos.negocio(id), datos.proyectos(id), datos.ultimaEntrada(id), datos.proximoCobro(id), datos.fondo(id), datos.documentos(id),
    estado.perfil.rol === "admin" ? datos.negocios() : Promise.resolve([]),
  ]);
  const bienvenidaDe = (pid) => documentos.find((d) => d.tipo === "bienvenida" && d.proyecto_id === pid);
  const urls = ultima ? await datos.urls((ultima.adjuntos || []).filter((a) => a.tipo_mime?.startsWith("image/")).map((a) => a.ruta)) : {};
  const primerNombre = (estado.perfil.nombre || "").split(" ")[0];
  const nombreProyecto = (pid) => proyectos.find((p) => p.id === pid)?.nombre || "";
  const verBitacora = (pid) => { estado.proyectoVista = pid; irA("bitacora"); };

  const tarjetasProyectos = proyectos.length
    ? proyectos.map((p) => el("div", { class: "tarjeta" },
        el("div", { class: "tarjeta-cab" },
          el("div", {}, el("span", { class: "etq" }, proyectos.length > 1 ? "Proyecto" : "Tu proyecto"), el("div", {}, el("b", {}, p.nombre))),
          el("div", { class: "fila" }, el("span", { class: "sello info" }, ETAPAS.find(([k]) => k === p.etapa)?.[1] || p.etapa),
            bienvenidaDe(p.id) && ["anticipo", "diseno"].includes(p.etapa)
              ? el("button", { class: "boton", type: "button", onclick: () => irA("documentos", { documento: bienvenidaDe(p.id).id }) }, "Bienvenida") : null,
            el("button", { class: "boton", type: "button", onclick: () => verBitacora(p.id) }, "Bitácora"))),
        el("div", { class: "tarjeta-cuerpo" }, bloqueEtapas(p))))
    : [el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Todavía no hay un proyecto registrado."))];

  return [
    selectorAdmin(negocios),
    el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, fLarga.format(new Date())),
      el("h1", {}, estado.perfil.rol === "admin" ? negocio?.nombre : `Hola, ${primerNombre}`),
      el("p", {}, proyectos.length > 1 ? `Tienes ${proyectos.length} proyectos con AW-RiseCR. Así va cada uno.` : "Así va todo lo que tienes con AW-RiseCR."))),
    el("div", { class: "rejilla" }, tarjetasProyectos),
    el("div", { class: "rejilla dos" },
      el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Último avance"),
          ultima ? el("button", { class: "boton", type: "button", onclick: () => verBitacora(ultima.proyecto_id) }, "Ver bitácora") : null),
        el("div", { class: "tarjeta-cuerpo" }, ultima
          ? [el("div", { class: "fila" }, sello(ultima), el("span", { class: "dato" }, `${fecha(ultima.creado_en)} · ${hora(ultima.creado_en)}`)),
             proyectos.length > 1 ? el("div", { class: "dato proyecto-etq" }, nombreProyecto(ultima.proyecto_id)) : null,
             el("h3", {}, ultima.titulo), ultima.nota ? el("p", {}, ultima.nota) : null, capturas(ultima, urls)]
          : el("p", {}, "Aquí vas a ver el último avance de tu proyecto."))),
      el("div", { class: "rejilla" },
        el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" }, el("div", { class: "fila entre" }, el("span", { class: "etq" }, "Próximo cobro"),
            el("button", { class: "enlace", type: "button", onclick: () => irA("pagos") }, "Ver pagos")),
          cobro ? [el("div", { class: "grande" }, dinero(cobro.monto), " ", el("small", {}, cobro.concepto)),
                   el("div", { class: "fila" }, el("span", { class: "sello " + cobro.estado }, cobro.estado === "por_vencer" ? `Vence ${fechaCorta(cobro.vence)}` : ESTADO_COBRO[cobro.estado]),
                     el("span", { class: "dato" }, proyectos.length > 1 && cobro.proyecto_id ? nombreProyecto(cobro.proyecto_id) : fechaCorta(cobro.vence)))]
                : el("p", {}, "No tienes cobros pendientes."))),
        el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" }, el("div", { class: "fila entre" }, el("span", { class: "etq" }, "Tu Fondo AW"),
            el("button", { class: "enlace", type: "button", onclick: () => irA("fondo") }, "Ver")),
          el("div", { class: "grande azul" }, dinero(fondo?.saldo || 0)),
          el("div", { class: "fila" }, el("span", { class: "dato" }, fondo?.proximo_vencimiento ? `Vence ${fechaCorta(fondo.proximo_vencimiento)}` : "Recomiéndanos y acumula crédito")))))),
  ].filter(Boolean);
}

function sello(entrada) {
  if (entrada.tipo === "aprobacion" && entrada.aprobado_en) return el("span", { class: "sello cobrado" }, "Aprobado");
  const [texto, clase] = TIPOS[entrada.tipo] || ["Nota", "nota"];
  return el("span", { class: "sello " + clase }, texto);
}

function capturas(entrada, urls) {
  const adj = entrada.adjuntos || [];
  const imagenes = adj.filter((a) => a.tipo_mime?.startsWith("image/") && urls[a.ruta]);
  const otros = adj.filter((a) => !a.tipo_mime?.startsWith("image/"));
  return [
    imagenes.length ? el("div", { class: "capturas" }, imagenes.map((a) =>
      el("a", { class: "captura", href: urls[a.ruta], target: "_blank", rel: "noopener" }, el("img", { src: urls[a.ruta], alt: a.nombre, loading: "lazy" })))) : null,
    otros.length ? el("div", {}, otros.map((a) => el("a", { class: "adjunto", href: urls[a.ruta] || "#", target: "_blank", rel: "noopener" },
      "📎 ", a.nombre, a.tamano ? ` · ${(a.tamano / 1048576).toFixed(1)} MB` : ""))) : null,
  ];
}

async function vistaBitacora() {
  const id = estado.negocioVista;
  const [proyectos, negocios] = await Promise.all([datos.proyectos(id), estado.perfil.rol === "admin" ? datos.negocios() : Promise.resolve([])]);
  if (!proyectos.find((p) => p.id === estado.proyectoVista)) estado.proyectoVista = proyectos[0]?.id || null;
  const proyecto = proyectos.find((p) => p.id === estado.proyectoVista);
  const cab = el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, proyecto?.nombre || "Proyecto"),
    el("h1", {}, "Bitácora del proyecto"), el("p", {}, "Cada avance que te enviamos, del más reciente al primero.")));
  // Pestañas de proyecto cuando el cliente tiene más de uno
  const pestanas = proyectos.length > 1
    ? el("div", { class: "proyectos-pestanas", role: "tablist", "aria-label": "Proyectos" }, proyectos.map((p) =>
        el("button", { class: "pestana", type: "button", role: "tab", "aria-selected": p.id === estado.proyectoVista ? "true" : "false",
          onclick: async () => { estado.proyectoVista = p.id; await pintarVista(); } },
          p.nombre, el("small", {}, ETAPAS.find(([k]) => k === p.etapa)?.[1] || ""))))
    : null;
  if (!proyecto) return [selectorAdmin(negocios), cab, el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Todavía no hay un proyecto registrado."))].filter(Boolean);
  const entradas = await datos.bitacora(proyecto.id);
  const urls = await datos.urls(entradas.flatMap((e) => (e.adjuntos || []).map((a) => a.ruta)));
  const lista = el("div", { class: "bitacora" }, entradas.map((e) =>
    el("article", { class: "entrada " + e.tipo },
      el("div", { class: "cuando" }, el("b", {}, fecha(e.creado_en)), el("span", {}, hora(e.creado_en))),
      el("div", { class: "eje" }, el("i", { class: "punto" })),
      el("div", { class: "tarjeta" },
        el("div", { class: "fila" }, sello(e),
          estado.perfil.rol === "admin" && e.avisado_en ? el("span", { class: "dato" }, `📧 avisado a ${e.avisados} ${e.avisados === 1 ? "persona" : "personas"}`) : null),
        el("h3", {}, e.titulo), e.nota ? el("p", {}, e.nota) : null, capturas(e, urls),
        e.requiere_aprobacion && !e.aprobado_en && estado.perfil.rol !== "admin"
          ? el("div", { class: "acciones" }, el("button", { class: "boton primario", type: "button", onclick: async (ev) => {
              const b = ev.currentTarget; b.disabled = true;
              try { await datos.aprobar(e.id); await pintarVista(); } catch { b.disabled = false; alert("No se pudo aprobar. Inténtalo de nuevo."); }
            } }, "Aprobar"))
          : null,
        e.aprobado_en ? el("p", { class: "aprobada" }, `✓ Aprobado el ${fecha(e.aprobado_en)} a las ${hora(e.aprobado_en)}`) : null))));
  return [selectorAdmin(negocios), cab, pestanas,
    entradas.length ? lista : el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Todavía no hay avances publicados en este proyecto."))].filter(Boolean);
}

// ---------- Arranque ----------
async function iniciar() {
  iniciarCliente({ datos, estado, irA, pintarVista, selectorAdmin });
  prepararAcceso();
  if (DEMO) { document.title = "Portal · DEMO"; await entrarAlPortal(); return; }
  try { await conectar(); }
  catch { mostrar("acceso"); mostrarForm("form-entrar"); avisar($("#form-entrar"), "No pudimos conectar con el portal. Revisa tu internet."); return; }

  // Pasaron los 30 días de "Mantener la sesión iniciada": se cierra también en el servidor
  if (recordarVencido()) { await sb.auth.signOut({ scope: "local" }).catch(() => {}); recordarSesion(false); }

  sb.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") { mostrar("acceso"); $("#clave-titulo").textContent = "Crea tu nueva contraseña"; mostrarForm("form-clave"); }
  });

  if (errorEnlace) {
    mostrar("acceso"); mostrarForm("form-recuperar");
    avisar($("#form-recuperar"), "El enlace venció o ya se usó. Pide uno nuevo aquí abajo.");
    history.replaceState(null, "", location.pathname);
    return;
  }

  const { data } = await sb.auth.getSession();
  if (data?.session && (tipoEnlace === "invite" || tipoEnlace === "recovery")) {
    mostrar("acceso");
    $("#clave-titulo").textContent = tipoEnlace === "invite" ? "Crea tu contraseña" : "Crea tu nueva contraseña";
    mostrarForm("form-clave");
    return;
  }
  if (data?.session) { await entrarAlPortal(); return; }
  mostrar("acceso"); mostrarForm("form-entrar");
}

iniciar();
