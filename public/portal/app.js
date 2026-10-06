// Portal AW-RiseCR · acceso, menú de carpetas, Inicio y Bitácora (el panel del administrador vive en admin.js)
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from "/portal/config.js";
import { $, el, icono, fecha, fechaCorta, hora, dinero, fLarga, estadoCobro, ETAPAS, TIPOS, ESTADO_COBRO } from "/portal/util.js";
import { iniciarCliente, vistaPagos, vistaFondo, vistaDocumentos, vistaAccesos } from "/portal/cliente.js";

// El tipo de enlace (invitación o recuperación) se lee antes de que Supabase limpie la dirección
const hashInicial = new URLSearchParams(location.hash.slice(1));
const tipoEnlace = hashInicial.get("type");
const errorEnlace = hashInicial.get("error_description");

// Modo demo: solo en la computadora de desarrollo, con ?demo o ?demo=cliente
const parametros = new URLSearchParams(location.search);
const esLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const DEMO = esLocal && parametros.has("demo");


// ---------- Datos ----------
let sb = null;
async function conectar() {
  const { createClient } = await import(SUPABASE_JS);
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
}

const datosReales = {
  async perfil(uid) {
    const { data, error } = await sb.from("perfiles").select("id, nombre, rol, activo, negocio_id").eq("id", uid).maybeSingle();
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
};

// Datos de ejemplo para revisar el diseño en la computadora de desarrollo
const hace = (dias, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
const enDias = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const DEMO_NEGOCIO = { id: "demo-1", nombre: "Surf & Coffee Tamarindo", ciudad: "Tamarindo" };
const datosDemo = {
  async perfil() { return { id: "demo", nombre: parametros.get("demo") === "cliente" ? "Mariana Solís" : "Andrew Corea Flores", rol: parametros.get("demo") === "cliente" ? "cliente" : "admin", activo: true, negocio_id: parametros.get("demo") === "cliente" ? "demo-1" : null }; },
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
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Revisa la invitación que te enviamos.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("should be different")) return "La nueva contraseña debe ser distinta a la anterior.";
  if (m.includes("weak") || m.includes("at least")) return "La contraseña es muy débil. Usa al menos 10 caracteres.";
  return "Algo salió mal. Inténtalo de nuevo en un momento.";
}

function prepararAcceso() {
  document.querySelectorAll("[data-ir-form]").forEach((b) => b.addEventListener("click", () => mostrarForm(b.dataset.irForm)));

  $("#form-entrar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const correo = $("#entrar-correo").value.trim(), clave = $("#entrar-clave").value;
    if (!correo || !clave) return avisar(form, "Escribe tu correo y tu contraseña.");
    boton.disabled = true;
    try {
      if (DEMO) { await entrarAlPortal(); return; }
      const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
      if (error) throw error;
      await entrarAlPortal();
    } catch (e) { avisar(form, traducirError(e)); }
    finally { boton.disabled = false; }
  });

  $("#form-recuperar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget, boton = $("button[type=submit]", form);
    const correo = $("#recuperar-correo").value.trim();
    if (!correo) return avisar(form, "Escribe tu correo.");
    boton.disabled = true;
    try {
      if (!DEMO) {
        const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + "/portal/" });
        if (error && !/rate/i.test(error.message)) throw error;
      }
      // Mismo mensaje exista o no el correo, para no revelar quién tiene cuenta
      avisar(form, "Si ese correo tiene acceso, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.", "ok");
    } catch (e) { avisar(form, traducirError(e)); }
    finally { boton.disabled = false; }
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
    boton.disabled = true;
    try {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factorMfa, code: codigo });
      if (error) throw error;
      await entrarAlPortal();
    } catch { avisar(form, "Código incorrecto o vencido. Escribe el código nuevo que muestra la app."); }
    finally { boton.disabled = false; }
  });

  document.querySelectorAll("[data-salir]").forEach((b) => b.addEventListener("click", salir));
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
  estado.perfil = null;
  mostrar("acceso"); mostrarForm("form-entrar");
}

async function entrarAlPortal() {
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
  mostrar("app");
  pintarMenu();
  await pintarVista();
}

// ---------- Menú de carpetas ----------
function secciones() {
  const cliente = [
    ["inicio", "Inicio"], ["bitacora", "Bitácora"], ["pagos", "Pagos"], ["fondo", "Fondo AW"],
    ["documentos", "Documentos"], ["accesos", "Accesos"],
  ];
  return estado.perfil.rol === "admin" ? [["panel", "Clientes"], ["cobros", "Cobros"], ["publicar", "Publicar"], ...cliente] : cliente;
}
const SECCIONES_ADMIN = ["panel", "cliente", "cobros", "publicar"];
const ICONOS = { panel: "clientes", cobros: "pagos" };
const seccionDelMenu = (s) => (s === "cliente" ? "panel" : s);

function pintarMenu() {
  const menu = $("#menu");
  menu.replaceChildren(...secciones().map(([id, nombre, pronto]) =>
    el("button", { class: "carpeta" + (id === "inicio" && estado.perfil.rol === "admin" ? " separada" : ""), type: "button",
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
    vista.replaceChildren(el("p", { class: "etq" }, "Cargando…"));
  }, 600);
  let contenido;
  try {
    [contenido] = await Promise.all([armarVista(), animar && !primera ? esperar(SALIDA_MS) : null]);
    contenido = [...[].concat(contenido).filter(Boolean), el("button", { class: "enlace movil-salir", type: "button", onclick: salir }, "Cerrar sesión")];
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
