// Portal AW-RiseCR · base del panel del administrador: acceso a datos (real y demo) y piezas de formulario
import { el, hoy, sumarDias, sumarMeses, estadoCobro } from "/portal/util.js";

export let ctx = null; // { sb, DEMO, estado, irA, pintarVista }
export function fijarContexto(contexto) { ctx = contexto; }

export const TIPOS_ARCHIVO = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "application/zip", "text/plain"];
export const MAX_ARCHIVO = 20 * 1024 * 1024;

// Windows marca los ZIP como x-zip-compressed y a veces el navegador no da tipo: se corrige por la extensión
export function tipoDe(archivo) {
  if (archivo.type === "application/x-zip-compressed") return "application/zip";
  if (archivo.type) return archivo.type;
  const ext = archivo.name.split(".").pop().toLowerCase();
  return { zip: "application/zip", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", txt: "text/plain" }[ext] || "";
}
export function nombreSeguro(nombre) {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "archivo";
}

// ---------- Acceso a datos ----------
async function invocar(cuerpo, funcion = "admin-usuarios") {
  const { data, error } = await ctx.sb.functions.invoke(funcion, { body: cuerpo });
  if (error) {
    let mensaje = "";
    try { mensaje = (await error.context.json()).error; } catch { /* sin detalle */ }
    throw new Error(mensaje || "No se pudo completar la acción.");
  }
  return data;
}
function revisar({ data, error }) { if (error) throw error; return data; }

const real = {
  negocios: async () => revisar(await ctx.sb.from("negocios").select("id, nombre, nicho, ciudad, estado, referido_por, proyectos(id, nombre, etapa, creado_en)").order("nombre")),
  negocio: async (id) => revisar(await ctx.sb.from("negocios").select("id, nombre, nicho, ciudad, estado, referido_por").eq("id", id).maybeSingle()),
  crearNegocio: async (d) => revisar(await ctx.sb.from("negocios").insert(d).select("id").single()).id,
  actualizarNegocio: async (id, d) => revisar(await ctx.sb.from("negocios").update(d).eq("id", id)),
  contacto: async (id) => (revisar(await ctx.sb.rpc("ver_contacto", { p_negocio: id })) || [])[0] || {},
  guardarContacto: async (id, c) => revisar(await ctx.sb.rpc("guardar_contacto", { p_negocio: id, p_telefono: c.telefono, p_correo: c.correo, p_cedula: c.cedula, p_notas: c.notas })),
  usuarios: async (id) => (await invocar({ accion: "usuarios", negocio_id: id })).usuarios,
  invitar: async (id, nombre, correo) => invocar({ accion: "invitar", negocio_id: id, nombre, correo }),
  cambiarAcceso: async (usuario, activo) => invocar({ accion: activo ? "activar" : "desactivar", usuario_id: usuario }),
  proyectos: async (id) => revisar(await ctx.sb.from("proyectos").select("*").eq("negocio_id", id).order("creado_en", { ascending: false })),
  // La base de datos crea la entrada "¡Arrancamos!", el documento de bienvenida y, si se pide, los cobros 50 / 50
  // y la mensualidad de mantenimiento (que empieza un mes después de la entrega)
  crearProyecto: async (d) => revisar(await ctx.sb.rpc("crear_proyecto", {
    p_negocio: d.negocio_id, p_nombre: d.nombre, p_monto: d.monto_total, p_inicio: d.inicio, p_entrega: d.entrega_estimada,
    p_cobros: d.cobros, p_mensualidad: d.mensualidad || 0,
  })),
  actualizarProyecto: async (id, campos) => revisar(await ctx.sb.from("proyectos").update(campos).eq("id", id)),
  async publicar({ negocio_id, proyecto_id, tipo, titulo, nota, archivos }, progreso) {
    const entrada = revisar(await ctx.sb.from("bitacora").insert({
      negocio_id, proyecto_id, tipo, titulo, nota: nota || null, requiere_aprobacion: tipo === "aprobacion",
    }).select("id").single());
    let i = 0;
    for (const archivo of archivos) {
      progreso?.(++i, archivos.length);
      const ruta = `${negocio_id}/${proyecto_id}/${entrada.id}/${crypto.randomUUID().slice(0, 8)}-${nombreSeguro(archivo.name)}`;
      revisar(await ctx.sb.storage.from("portal").upload(ruta, archivo, { contentType: tipoDe(archivo), upsert: false }));
      revisar(await ctx.sb.from("adjuntos").insert({ negocio_id, bitacora_id: entrada.id, ruta, nombre: archivo.name, tamano: archivo.size, tipo_mime: tipoDe(archivo) }));
    }
    return entrada.id;
  },
  // Cobros y mensualidades
  async cobros(negocioId) {
    let q = ctx.sb.from("cobros_estado").select("*").order("vence");
    if (negocioId) q = q.eq("negocio_id", negocioId);
    return revisar(await q);
  },
  crearCobro: async (d) => revisar(await ctx.sb.from("cobros").insert(d)),
  actualizarCobro: async (id, campos) => revisar(await ctx.sb.from("cobros").update(campos).eq("id", id)),
  pagarConFondo: async (id, monto) => revisar(await ctx.sb.rpc("pagar_con_fondo", { p_cobro: id, p_monto: monto })),
  servicios: async (id) => revisar(await ctx.sb.from("servicios").select("*, proyectos(nombre, etapa, entregado_en)").eq("negocio_id", id).order("creado_en")),
  crearServicio: async (d) => revisar(await ctx.sb.from("servicios").insert(d)),
  actualizarServicio: async (id, campos) => revisar(await ctx.sb.from("servicios").update(campos).eq("id", id)),
  // Fondo AW
  fondo: async (id) => revisar(await ctx.sb.from("fondo_saldos").select("saldo, proximo_vencimiento, referidos").eq("negocio_id", id).maybeSingle()),
  movimientos: async (id) => revisar(await ctx.sb.from("fondo_movimientos").select("*").eq("negocio_id", id).order("creado_en", { ascending: false })),
  referidosPendientes: async () => revisar(await ctx.sb.from("referidos_pendientes").select("*")),
  cargarReferido: async (proyectoId) => revisar(await ctx.sb.rpc("cargar_referido", { p_proyecto: proyectoId })),
  // Aviso por correo del avance a las personas del cliente (función avisar-avance, con la llave de Resend en Supabase)
  avisarAvance: async (entradaId) => invocar({ entrada_id: entradaId }, "avisar-avance"),
  // Accesos (sin contraseñas: esas viven en Bitwarden; el usuario se guarda cifrado)
  accesos: async (id) => revisar(await ctx.sb.rpc("accesos_de", { p_negocio: id })) || [],
  guardarAcceso: async (a) => revisar(await ctx.sb.rpc("guardar_acceso", {
    p_id: a.id || null, p_negocio: a.negocio_id, p_proyecto: a.proyecto_id || null, p_servicio: a.servicio, p_proveedor: a.proveedor,
    p_titular: a.titular, p_usuario: a.usuario, p_vence: a.vence || null, p_estado: a.estado, p_enlace: a.enlace_bitwarden,
  })),
  borrarAcceso: async (id) => revisar(await ctx.sb.from("accesos").delete().eq("id", id)),
  renovaciones: async () => revisar(await ctx.sb.from("accesos").select("id, negocio_id, servicio, proveedor, vence, estado")
    .eq("estado", "activo").not("vence", "is", null).lte("vence", sumarDias(hoy(), 30)).order("vence")),
  // Documentos subidos (propuestas, acuerdos, comprobantes)
  documentos: async (id) => revisar(await ctx.sb.from("documentos").select("id, tipo, titulo, contenido, proyecto_id, creado_en, adjuntos(id, ruta, nombre, tipo_mime, tamano)")
    .eq("negocio_id", id).order("creado_en", { ascending: false })),
  async subirDocumento({ negocio_id, proyecto_id, tipo, titulo, archivos }, progreso) {
    const doc = revisar(await ctx.sb.from("documentos").insert({ negocio_id, proyecto_id, tipo, titulo }).select("id").single());
    let i = 0;
    for (const archivo of archivos) {
      progreso?.(++i, archivos.length);
      const ruta = `${negocio_id}/documentos/${doc.id}/${crypto.randomUUID().slice(0, 8)}-${nombreSeguro(archivo.name)}`;
      revisar(await ctx.sb.storage.from("portal").upload(ruta, archivo, { contentType: tipoDe(archivo), upsert: false }));
      revisar(await ctx.sb.from("adjuntos").insert({ negocio_id, documento_id: doc.id, ruta, nombre: archivo.name, tamano: archivo.size, tipo_mime: tipoDe(archivo) }));
    }
    return doc.id;
  },
  async borrarDocumento(doc) {
    const rutas = (doc.adjuntos || []).map((a) => a.ruta);
    if (rutas.length) revisar(await ctx.sb.storage.from("portal").remove(rutas));
    revisar(await ctx.sb.from("documentos").delete().eq("id", doc.id));
  },
  async urls(rutas) {
    if (!rutas.length) return {};
    const data = revisar(await ctx.sb.storage.from("portal").createSignedUrls(rutas, 3600));
    return Object.fromEntries(data.filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  },
  // Datos de pago que ven los clientes (en la base de datos, nunca en el código)
  pago: async () => revisar(await ctx.sb.from("ajustes").select("valor").eq("clave", "pago").maybeSingle())?.valor || {},
  guardarPago: async (valor) => revisar(await ctx.sb.from("ajustes").update({ valor, actualizado_en: new Date().toISOString() }).eq("clave", "pago")),
};

// Datos en memoria para revisar el diseño en localhost (?demo). Imitan las reglas de la base de datos.
const d = (n) => sumarDias(hoy(), n);
const memoria = {
  negocios: [
    { id: "demo-1", nombre: "Surf & Coffee Tamarindo", nicho: "Restaurante", ciudad: "Tamarindo", estado: "activo", referido_por: null },
    { id: "demo-2", nombre: "Tamarindo Tours", nicho: "Tours", ciudad: "Tamarindo", estado: "activo", referido_por: "demo-1" },
  ],
  proyectos: [
    { id: "p-2", negocio_id: "demo-1", nombre: "Tienda en línea", etapa: "diseno", monto_total: 800, inicio: d(-4), entrega_estimada: d(30), creado_en: d(-4) },
    { id: "p-1", negocio_id: "demo-1", nombre: "Página web con reservas", etapa: "desarrollo", monto_total: 600, inicio: d(-15), entrega_estimada: d(13), creado_en: d(-15) },
    { id: "p-3", negocio_id: "demo-2", nombre: "Web de tours", etapa: "publicada", monto_total: 500, inicio: d(-60), entrega_estimada: d(-20), entregado_en: d(-18), creado_en: d(-60) },
  ],
  contactos: { "demo-1": { telefono: "8888-1111", correo: "hola@surfcoffee.cr", cedula: "3-101-000000", notas_privadas: "Prefiere WhatsApp por la tarde." } },
  usuarios: { "demo-1": [{ id: "u1", nombre: "Mariana Solís", correo: "mariana@surfcoffee.cr", activo: true, confirmado: true, ultimo_acceso: new Date().toISOString() }] },
  cobros: [
    { id: "c1", negocio_id: "demo-1", proyecto_id: "p-1", concepto: "Anticipo 50 % · Página web con reservas", monto: 300, vence: d(-15), pagado_en: d(-15), metodo: "SINPE Móvil" },
    { id: "c2", negocio_id: "demo-1", proyecto_id: "p-1", concepto: "Saldo 50 % al publicar · Página web con reservas", monto: 300, vence: d(13) },
    { id: "c3", negocio_id: "demo-1", proyecto_id: "p-2", concepto: "Anticipo 50 % · Tienda en línea", monto: 400, vence: d(-4) },
    { id: "c4", negocio_id: "demo-1", proyecto_id: "p-2", concepto: "Saldo 50 % al publicar · Tienda en línea", monto: 400, vence: d(30) },
    { id: "c5", negocio_id: "demo-2", proyecto_id: "p-3", servicio_id: "s2", concepto: "Mensualidad Mantenimiento web · Web de tours", monto: 20, vence: sumarMeses(d(-18), 1) },
    { id: "c6", negocio_id: "demo-2", proyecto_id: "p-3", concepto: "Anticipo 50 % · Web de tours", monto: 250, vence: d(-60), pagado_en: d(-60), metodo: "SINPE Móvil" },
    { id: "c7", negocio_id: "demo-2", proyecto_id: "p-3", concepto: "Saldo 50 % al publicar · Web de tours", monto: 250, vence: d(-18), pagado_en: d(-18), metodo: "Transferencia" },
  ],
  servicios: [{ id: "s1", negocio_id: "demo-1", proyecto_id: "p-1", tipo: "mantenimiento", plan: "Mantenimiento web", monto_mensual: 25, estado: "activo" },
    { id: "s2", negocio_id: "demo-2", proyecto_id: "p-3", tipo: "mantenimiento", plan: "Mantenimiento web", monto_mensual: 20, estado: "activo" }],
  accesos: [
    { id: "a1", negocio_id: "demo-1", proyecto_id: "p-1", servicio: "Dominio surfcoffee.cr", proveedor: "NIC Costa Rica", titular: "Surf & Coffee S.A.", usuario: "hola@surfcoffee.cr", vence: d(20), estado: "activo", enlace_bitwarden: null },
    { id: "a2", negocio_id: "demo-1", proyecto_id: "p-1", servicio: "Hosting y correo", proveedor: "Cloudflare", titular: "Surf & Coffee S.A.", usuario: "admin@surfcoffee.cr", vence: d(240), estado: "activo", enlace_bitwarden: "https://send.bitwarden.com/#ejemplo" },
  ],
  documentos: [
    { id: "d0", negocio_id: "demo-1", tipo: "propuesta", titulo: "Propuesta firmada", contenido: null, proyecto_id: "p-1", creado_en: d(-16) + "T15:00:00Z", adjuntos: [{ id: "x1", ruta: "demo/propuesta.pdf", nombre: "propuesta.pdf", tipo_mime: "application/pdf", tamano: 820000 }] },
    { id: "d1", negocio_id: "demo-1", tipo: "bienvenida", titulo: "Bienvenida · Página web con reservas", contenido: { plantilla: "bienvenida" }, proyecto_id: "p-1", creado_en: d(-15) + "T09:00:00Z", adjuntos: [] },
  ],
  // Valores de ejemplo, no reales: los datos de verdad solo viven en la base de datos
  pago: { sinpe: "8000-0000", sinpe_titular: "Nombre del titular", banco: "BAC", cuenta_titular: "NOMBRE DEL TITULAR", cuenta: "000000000", iban: "CR00 0000 0000 0000 0000 00" },
  movimientos: [
    { id: "m1", negocio_id: "demo-1", tipo: "bienvenida", monto: 25, descripcion: "Bienvenida por venir recomendado", fecha: d(-16), vence: d(349) },
    { id: "m2", negocio_id: "demo-2", tipo: "bienvenida", monto: 25, descripcion: "Bienvenida por venir recomendado", fecha: d(-61), vence: d(304) },
  ],
};
const conEstado = (c) => ({ ...c, estado: estadoCobro(c) });
const saldoDemo = (id) => memoria.movimientos.filter((m) => m.negocio_id === id).reduce((s, m) => s + m.monto, 0);
const demo = {
  negocios: async () => memoria.negocios.map((n) => ({ ...n, proyectos: memoria.proyectos.filter((p) => p.negocio_id === n.id) })),
  negocio: async (id) => memoria.negocios.find((n) => n.id === id),
  crearNegocio: async (datos) => {
    const id = "demo-" + Date.now(); memoria.negocios.push({ id, estado: "activo", ...datos });
    if (datos.referido_por) memoria.movimientos.unshift({ id: "m" + Date.now(), negocio_id: id, tipo: "bienvenida", monto: 25, descripcion: "Bienvenida por venir recomendado", fecha: hoy(), vence: d(365) });
    return id;
  },
  actualizarNegocio: async (id, datos) => Object.assign(memoria.negocios.find((n) => n.id === id), datos),
  contacto: async (id) => memoria.contactos[id] || {},
  guardarContacto: async (id, c) => { memoria.contactos[id] = { ...c, notas_privadas: c.notas }; },
  usuarios: async (id) => memoria.usuarios[id] || [],
  invitar: async (id, nombre, correo) => { (memoria.usuarios[id] ||= []).push({ id: "u" + Date.now(), nombre, correo, activo: true, confirmado: false }); },
  cambiarAcceso: async (u, activo) => { for (const l of Object.values(memoria.usuarios)) for (const x of l) if (x.id === u) x.activo = activo; },
  proyectos: async (id) => memoria.proyectos.filter((p) => p.negocio_id === id),
  crearProyecto: async (p) => {
    const id = "p-" + Date.now();
    memoria.proyectos.unshift({ id, etapa: "anticipo", creado_en: new Date().toISOString(), ...p });
    if (p.mensualidad > 0) memoria.servicios.push({ id: "s" + Date.now(), negocio_id: p.negocio_id, proyecto_id: id, tipo: "mantenimiento", plan: "Mantenimiento web", monto_mensual: p.mensualidad, estado: "activo" });
    if (p.cobros && p.monto_total > 0) {
      const mitad = Math.round(p.monto_total * 50) / 100;
      memoria.cobros.push({ id: "c" + Date.now(), negocio_id: p.negocio_id, proyecto_id: id, concepto: "Anticipo 50 % · " + p.nombre, monto: mitad, vence: p.inicio || hoy() },
        { id: "c" + (Date.now() + 1), negocio_id: p.negocio_id, proyecto_id: id, concepto: "Saldo 50 % al publicar · " + p.nombre, monto: p.monto_total - mitad, vence: p.entrega_estimada || sumarDias(p.inicio || hoy(), 30) });
    }
    return id;
  },
  actualizarProyecto: async (id, c) => Object.assign(memoria.proyectos.find((p) => p.id === id), c),
  publicar: async (_d, progreso) => { progreso?.(1, 1); return "demo"; },
  avisarAvance: async () => ({ enviados: 1, sin_cuenta: 0 }),
  cobros: async (id) => memoria.cobros.filter((c) => !id || c.negocio_id === id).map(conEstado).sort((a, b) => a.vence.localeCompare(b.vence)),
  crearCobro: async (c) => { memoria.cobros.push({ id: "c" + Date.now(), ...c }); },
  actualizarCobro: async (id, campos) => Object.assign(memoria.cobros.find((c) => c.id === id), campos),
  async pagarConFondo(id, monto) {
    const c = memoria.cobros.find((x) => x.id === id);
    const p = memoria.proyectos.find((x) => x.id === c.proyecto_id);
    const usado = -memoria.movimientos.filter((m) => m.tipo === "uso" && m.proyecto_id === p.id).reduce((s, m) => s + m.monto, 0);
    if (monto > saldoDemo(c.negocio_id)) throw new Error("El saldo del Fondo AW no alcanza");
    if (usado + monto > p.monto_total / 2) throw new Error("El Fondo AW cubre hasta el 50 % del proyecto");
    memoria.movimientos.unshift({ id: "m" + Date.now(), negocio_id: c.negocio_id, tipo: "uso", monto: -monto, proyecto_id: p.id, descripcion: "Usado en: " + c.concepto, fecha: hoy() });
    if (monto === c.monto) Object.assign(c, { pagado_en: hoy(), metodo: "Fondo AW" });
    else { c.monto -= monto; memoria.cobros.push({ id: "c" + Date.now(), negocio_id: c.negocio_id, proyecto_id: p.id, concepto: c.concepto + " · Fondo AW", monto, vence: hoy(), pagado_en: hoy(), metodo: "Fondo AW" }); }
  },
  servicios: async (id) => memoria.servicios.filter((s) => s.negocio_id === id).map((s) => ({ ...s, proyectos: memoria.proyectos.find((p) => p.id === s.proyecto_id) || null })),
  crearServicio: async (s) => { memoria.servicios.push({ id: "s" + Date.now(), estado: "activo", ...s }); },
  actualizarServicio: async (id, c) => Object.assign(memoria.servicios.find((s) => s.id === id), c),
  fondo: async (id) => {
    const lista = memoria.movimientos.filter((m) => m.negocio_id === id);
    if (!lista.length) return null;
    const vences = lista.filter((m) => m.monto > 0 && m.vence >= hoy()).map((m) => m.vence).sort();
    return { saldo: saldoDemo(id), proximo_vencimiento: vences[0] || null, referidos: lista.filter((m) => m.tipo === "referido").length };
  },
  movimientos: async (id) => memoria.movimientos.filter((m) => m.negocio_id === id),
  referidosPendientes: async () => memoria.negocios.filter((n) => n.referido_por && !memoria.movimientos.some((m) => m.tipo === "referido" && m.referido_negocio_id === n.id))
    .flatMap((n) => memoria.proyectos.filter((p) => p.negocio_id === n.id).map((p) => {
      const r = memoria.negocios.find((x) => x.id === n.referido_por);
      return { proyecto_id: p.id, proyecto: p.nombre, negocio_id: n.id, negocio: n.nombre, referidor_id: r.id, referidor: r.nombre, monto_total: p.monto_total, etapa: p.etapa, entregado_en: p.entregado_en,
        pagado: memoria.cobros.filter((c) => c.proyecto_id === p.id && c.pagado_en && !c.anulado).reduce((s, c) => s + c.monto, 0),
        previas: memoria.movimientos.filter((m) => m.negocio_id === r.id && m.tipo === "referido").length };
    })),
  accesos: async (id) => memoria.accesos.filter((a) => a.negocio_id === id),
  guardarAcceso: async (a) => {
    if (a.id) Object.assign(memoria.accesos.find((x) => x.id === a.id), a);
    else memoria.accesos.push({ ...a, id: "a" + Date.now() });
  },
  borrarAcceso: async (id) => { memoria.accesos = memoria.accesos.filter((a) => a.id !== id); },
  renovaciones: async () => memoria.accesos.filter((a) => a.estado === "activo" && a.vence && a.vence <= d(30)).sort((a, b) => a.vence.localeCompare(b.vence)),
  documentos: async (id) => memoria.documentos.filter((x) => x.negocio_id === id),
  subirDocumento: async (doc, progreso) => {
    progreso?.(1, 1);
    memoria.documentos.unshift({ ...doc, id: "d" + Date.now(), contenido: null, creado_en: new Date().toISOString(),
      adjuntos: doc.archivos.map((f, i) => ({ id: "x" + Date.now() + i, ruta: "demo/" + f.name, nombre: f.name, tipo_mime: tipoDe(f), tamano: f.size })) });
  },
  borrarDocumento: async (doc) => { memoria.documentos = memoria.documentos.filter((x) => x.id !== doc.id); },
  urls: async (rutas) => Object.fromEntries(rutas.map((r) => [r, "/project-preview-odrys-mobile-v5.jpg"])),
  pago: async () => ({ ...memoria.pago }),
  guardarPago: async (valor) => { memoria.pago = valor; },
  async cargarReferido(proyectoId) {
    const pend = (await this.referidosPendientes()).find((x) => x.proyecto_id === proyectoId);
    const monto = Math.min(150, Math.round(pend.monto_total * (pend.previas >= 2 ? 20 : 15)) / 100);
    memoria.movimientos.unshift({ id: "m" + Date.now(), negocio_id: pend.referidor_id, tipo: "referido", monto, referido_negocio_id: pend.negocio_id, proyecto_id: proyectoId, descripcion: "Recomendaste a " + pend.negocio, fecha: hoy(), vence: d(365) });
    return monto;
  },
};
export const api = () => (ctx.DEMO ? demo : real);

// Traduce los errores de la base de datos a un mensaje corto para Andrew
export function textoError(e, porDefecto = "No se pudo completar. Inténtalo de nuevo.") {
  const m = e?.message || "";
  const conocidos = ["Fondo AW", "pagado al 100", "15 días", "ya se cargó", "no vino recomendado", "no está pendiente", "Monto inválido", "no tiene monto", "Sin permiso", "no pertenece", "Falta el servicio", "no encontrado"];
  return conocidos.some((k) => m.includes(k)) ? m : porDefecto;
}

// ---------- Piezas de formulario ----------
let contador = 0;
export const idc = (p) => `${p}-${++contador}`;
export function campo(etiqueta, control, nota) {
  return el("div", { class: "campo" }, el("label", { for: control.id }, etiqueta), control, nota ? el("small", { class: "nota-campo" }, nota) : null);
}
export function entrada(tipo, valor = "", extra = {}) { return el("input", { id: idc("c"), type: tipo, value: valor ?? "", ...extra }); }
export function area(valor = "", extra = {}) { const t = el("textarea", { id: idc("c"), rows: "4", ...extra }); t.value = valor ?? ""; return t; }
export function seleccion(opciones, valor, extra = {}) {
  return el("select", { id: idc("c"), ...extra }, opciones.map(([v, t]) => el("option", { value: v, selected: v === valor }, t)));
}
export function mensaje(destino, texto, tipo = "error") { destino.replaceChildren(el("div", { class: "aviso " + tipo }, texto)); }
export async function conBoton(boton, tarea) {
  boton.disabled = true;
  try { return await tarea(); } finally { boton.disabled = false; }
}
export function linea(etiqueta, valor) {
  return el("div", { class: "linea" }, el("span", { class: "et" }, etiqueta), el("span", { class: "rell" }), el("span", { class: "val" }, valor));
}
export const soloDigitos = (t) => (t || "").replace(/\D/g, "");
