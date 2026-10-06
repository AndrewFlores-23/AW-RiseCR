// Portal AW-RiseCR · secciones del cliente: Pagos, Fondo AW, Documentos y el documento de bienvenida
import { CONTACTO } from "/portal/config.js";
import { el, fecha, fechaCorta, dinero, hoy, sumarDias, filaMovimiento, proximaMensualidad, ETAPAS, ESTADO_COBRO, TIPO_SERVICIO } from "/portal/util.js";

let ctx = null; // { datos, estado, irA, pintarVista, selectorAdmin }
export function iniciarCliente(contexto) { ctx = contexto; }

const PENDIENTE = ["atrasado", "por_vencer", "programado"];
const ORDEN = { atrasado: 0, por_vencer: 1, programado: 2 };
const suma = (lista) => lista.reduce((s, c) => s + Number(c.monto), 0);
const whatsapp = (texto) => `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`;
const selloCobro = (c) => el("span", { class: "sello " + c.estado }, c.estado === "por_vencer" ? `Vence ${fechaCorta(c.vence)}` : ESTADO_COBRO[c.estado]);
const cabecera = (etiqueta, titulo, texto) => el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, etiqueta), el("h1", {}, titulo), texto ? el("p", {}, texto) : null));
const negociosAdmin = () => (ctx.estado.perfil.rol === "admin" ? ctx.datos.negocios() : Promise.resolve([]));
const AVISO_MENSUALIDAD = "La mensualidad de tu proyecto empieza a correr un mes posterior a la entrega.";

// Cuándo se cobra una mensualidad, como la ve el cliente
function cuandoCobra(s) {
  if (s.proyecto_id && !s.proyectos?.entregado_en) return AVISO_MENSUALIDAD;
  const proxima = proximaMensualidad(s);
  return proxima ? `Próximo cobro: ${fechaCorta(proxima)}` : "";
}

// Botón para copiar un dato de pago. Los números se copian limpios (sin guiones ni espacios) para pegarlos en la app del banco.
const soloDigitos = (v) => v.replace(/\D/g, "");
const sinEspacios = (v) => v.replace(/\s/g, "");
function copiable(etiqueta, valor, limpiar = (v) => v) {
  const boton = el("button", { class: "copiar", type: "button", "aria-label": `Copiar ${etiqueta}`, onclick: async () => {
    try { await navigator.clipboard.writeText(limpiar(valor)); boton.textContent = "Copiado ✓"; }
    catch { boton.textContent = "No se pudo"; }
    setTimeout(() => { boton.textContent = "Copiar"; }, 1600);
  } }, "Copiar");
  return el("div", { class: "dato-pago" }, el("small", {}, etiqueta), el("b", {}, valor), boton);
}

const datoFijo = (etiqueta, valor) => el("div", { class: "dato-pago" }, el("small", {}, etiqueta), el("b", {}, valor));

// Datos de pago (vienen de la base de datos; si faltan, se avisa que van por WhatsApp)
function datosDePago(pago) {
  const sinpe = pago.sinpe ? el("div", { class: "metodo-pago" }, el("span", { class: "etq" }, "SINPE Móvil"),
    copiable("Número", pago.sinpe, soloDigitos), pago.sinpe_titular ? copiable("A nombre de", pago.sinpe_titular) : null) : null;
  const banco = pago.cuenta || pago.iban ? el("div", { class: "metodo-pago" }, el("span", { class: "etq" }, `Transferencia bancaria${pago.banco ? " · " + pago.banco : ""}`),
    pago.cuenta_titular ? copiable("Titular", pago.cuenta_titular) : null,
    pago.cuenta ? copiable("Número de cuenta", pago.cuenta, soloDigitos) : null,
    pago.iban ? copiable("Cuenta IBAN", pago.iban, sinEspacios) : null) : null;
  if (!sinpe && !banco) return [el("p", {}, "Paga por SINPE Móvil o transferencia. Te enviamos los datos por WhatsApp con cada cobro.")];
  return [sinpe, sinpe && banco ? el("p", { class: "o-bien" }, "o bien") : null, banco];
}

// ---------- Pagos ----------
export async function vistaPagos() {
  const id = ctx.estado.negocioVista;
  const [negocio, cobros, servicios, proyectos, pago, negocios] = await Promise.all([
    ctx.datos.negocio(id), ctx.datos.cobros(id), ctx.datos.servicios(id), ctx.datos.proyectos(id), ctx.datos.pago(), negociosAdmin()]);
  const nombreProyecto = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]));
  const pendientes = cobros.filter((c) => PENDIENTE.includes(c.estado)).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.vence.localeCompare(b.vence));
  const pagados = cobros.filter((c) => c.estado === "cobrado").sort((a, b) => b.pagado_en.localeCompare(a.pagado_en));
  const activos = servicios.filter((s) => s.estado === "activo");
  const detalle = (c) => [c.proyecto_id && !c.concepto.includes(nombreProyecto[c.proyecto_id] || "—") ? nombreProyecto[c.proyecto_id] : null,
    c.servicio_id ? "Mensualidad" : null].filter(Boolean).join(" · ");

  const filaPendiente = (c) => el("div", { class: "cobro " + c.estado },
    el("div", { class: "cobro-info" }, el("b", {}, c.concepto), el("span", { class: "dato" }, [detalle(c), `Vence ${fechaCorta(c.vence)}`].filter(Boolean).join(" · "))),
    el("div", { class: "cobro-monto" }, dinero(c.monto)),
    el("div", { class: "cobro-sello" }, selloCobro(c)));
  const filaPagada = (c) => el("div", { class: "cobro cobrado" },
    el("div", { class: "cobro-info" }, el("b", {}, c.concepto), el("span", { class: "dato" }, [detalle(c), `Pagado ${fechaCorta(c.pagado_en)}`, c.metodo].filter(Boolean).join(" · "))),
    el("div", { class: "cobro-monto" }, dinero(c.monto)),
    el("div", { class: "cobro-sello" }, el("span", { class: "sello cobrado" }, c.metodo === "Fondo AW" ? "Fondo AW" : "Pagado")));

  const primero = pendientes[0];
  const comoPagar = el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Cómo pagar")),
    el("div", { class: "tarjeta-cuerpo" },
      datosDePago(pago),
      el("p", { class: "nota-pago" }, "Los montos están en dólares. Si pagas en colones, se usa el tipo de cambio de venta del Banco Central del día del pago."),
      el("div", { class: "acciones" }, el("a", { class: "boton primario", target: "_blank", rel: "noopener",
        href: whatsapp(primero ? `Hola, AW-RiseCR. Les envío el comprobante de "${primero.concepto}" (${dinero(primero.monto)}) de ${negocio?.nombre || "mi negocio"}.` : `Hola, AW-RiseCR. Les escribo de ${negocio?.nombre || "mi negocio"} sobre un pago.`) },
        "Enviar comprobante por WhatsApp"))));

  return [
    ctx.selectorAdmin(negocios),
    cabecera("Pagos", "Tus pagos", "Anticipos, saldos y mensualidades con AW-RiseCR."),
    el("div", { class: "rejilla dos arriba" },
      el("div", { class: "tarjeta" },
        el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Por pagar"), pendientes.length ? el("b", { class: "total-cab" }, dinero(suma(pendientes))) : null),
        el("div", { class: "tarjeta-cuerpo" }, pendientes.length ? el("div", { class: "cobros" }, pendientes.map(filaPendiente)) : el("p", { class: "vacio-chico" }, "Estás al día. No tienes pagos pendientes."))),
      el("div", { class: "rejilla" }, comoPagar,
        activos.length ? el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Mensualidades")),
          el("div", { class: "tarjeta-cuerpo" }, activos.map((s) => el("div", { class: "item-proyecto" },
            el("div", {}, el("b", {}, [s.plan || TIPO_SERVICIO[s.tipo], s.proyecto_id && proyectos.length > 1 ? s.proyectos?.nombre : null].filter(Boolean).join(" · ")), el("br"),
              el("span", { class: s.proyecto_id && !s.proyectos?.entregado_en ? "aviso-mensualidad" : "dato" }, cuandoCobra(s))),
            el("b", {}, dinero(s.monto_mensual), el("small", { class: "dato" }, " /mes")))))) : null)),
    el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Historial de pagos"),
      pagados.length ? el("span", { class: "dato" }, `Total ${dinero(suma(pagados))}`) : null),
      el("div", { class: "tarjeta-cuerpo" }, pagados.length ? el("div", { class: "cobros" }, pagados.map(filaPagada)) : el("p", { class: "vacio-chico" }, "Aquí vas a ver cada pago que registremos."))),
  ].filter(Boolean);
}

// ---------- Fondo AW ----------
export async function vistaFondo() {
  const id = ctx.estado.negocioVista;
  const [negocio, fondo, movimientos, negocios] = await Promise.all([ctx.datos.negocio(id), ctx.datos.fondo(id), ctx.datos.movimientos(id), negociosAdmin()]);
  const recomendar = `¡Hola! Te recomiendo AW-RiseCR para la página web de tu negocio: https://awrisecr.com · Diles que vas de parte de ${negocio?.nombre || "un cliente"} y empiezas con $25 de crédito.`;
  return [
    ctx.selectorAdmin(negocios),
    cabecera("Fondo AW", "Tu Fondo AW", "Crédito para tus próximos desarrollos con AW-RiseCR."),
    el("div", { class: "rejilla dos arriba" },
      el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" },
        el("span", { class: "etq" }, "Saldo disponible"),
        el("div", { class: "grande azul" }, dinero(fondo?.saldo || 0)),
        el("div", { class: "fila" },
          el("span", { class: "dato" }, fondo?.proximo_vencimiento ? `Parte de tu crédito vence el ${fechaCorta(fondo.proximo_vencimiento)}` : "Sin vencimientos próximos"),
          fondo?.referidos ? el("span", { class: "sello info" }, `${fondo.referidos} ${fondo.referidos === 1 ? "recomendación" : "recomendaciones"}`) : null),
        el("div", { class: "acciones" },
          el("a", { class: "boton primario", href: `https://wa.me/?text=${encodeURIComponent(recomendar)}`, target: "_blank", rel: "noopener" }, "Recomendar por WhatsApp")))),
      el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Cómo funciona")),
        el("div", { class: "tarjeta-cuerpo" }, el("ol", { class: "reglas" },
          el("li", {}, el("b", {}, "Recomiéndanos. "), "Cuando el negocio que recomendaste paga su proyecto, te cargamos el 15 % (20 % desde tu 3.ª recomendación), hasta $150 cada vez."),
          el("li", {}, el("b", {}, "Tu recomendado gana $25 "), "de bienvenida para su proyecto."),
          el("li", {}, el("b", {}, "Úsalo en tu próximo desarrollo: "), "cubre hasta el 50 % de un proyecto nuevo."),
          el("li", {}, el("b", {}, "Vence a los 12 meses "), "de cada carga y no se cambia por dinero."))))),
    el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Movimientos")),
      el("div", { class: "tarjeta-cuerpo" }, movimientos.length ? el("div", { class: "movimientos" }, movimientos.map(filaMovimiento))
        : el("p", { class: "vacio-chico" }, "Todavía no tienes movimientos. Tu primera recomendación pagada aparece aquí."))),
  ].filter(Boolean);
}

// ---------- Accesos (sin contraseñas) ----------
const ENLACE_BITWARDEN = /^https:\/\/([a-z0-9-]+\.)*bitwarden\.(com|eu)\//;
function selloVence(vence) {
  if (!vence) return null;
  if (vence < hoy()) return el("span", { class: "sello atrasado" }, "Vencido");
  if (vence <= sumarDias(hoy(), 30)) return el("span", { class: "sello por_vencer" }, `Vence ${fechaCorta(vence)}`);
  return el("span", { class: "dato" }, `Renueva ${fechaCorta(vence)}`);
}

export async function vistaAccesos() {
  const id = ctx.estado.negocioVista;
  const [negocio, accesos, negocios] = await Promise.all([ctx.datos.negocio(id), ctx.datos.accesos(id), negociosAdmin()]);
  const pedir = (a) => whatsapp(`Hola, AW-RiseCR. Soy de ${negocio?.nombre || "mi negocio"} y necesito la contraseña de "${a.servicio}".`);
  return [
    ctx.selectorAdmin(negocios),
    cabecera("Accesos", "Tus cuentas y servicios", "Dominio, hosting, correo y cuentas de tu negocio, con sus fechas de renovación."),
    el("div", { class: "tarjeta aviso-seguro" }, el("div", { class: "tarjeta-cuerpo" },
      el("b", {}, "🔒 Aquí no guardamos contraseñas."),
      el("p", {}, "Están en Bitwarden, un gestor cifrado. Si necesitas una, pídela y te la enviamos con un enlace que se destruye solo después de abrirlo."))),
    accesos.length
      ? el("div", { class: "rejilla dos-iguales" }, accesos.map((a) => el("div", { class: "tarjeta" },
          el("div", { class: "tarjeta-cab" }, el("b", {}, a.servicio), selloVence(a.vence)),
          el("div", { class: "tarjeta-cuerpo" },
            el("div", { class: "metodo-pago" },
              a.proveedor ? datoFijo("Proveedor", a.proveedor) : null,
              a.titular ? datoFijo("A nombre de", a.titular) : null,
              a.usuario ? copiable("Usuario o correo", a.usuario) : null),
            el("div", { class: "acciones" },
              a.enlace_bitwarden && ENLACE_BITWARDEN.test(a.enlace_bitwarden)
                ? el("a", { class: "boton primario", href: a.enlace_bitwarden, target: "_blank", rel: "noopener noreferrer" }, "Ver contraseña (enlace seguro)")
                : el("a", { class: "boton", href: pedir(a), target: "_blank", rel: "noopener" }, "Pedir contraseña por WhatsApp"))))))
      : el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" }, el("p", { class: "vacio-chico" }, "Todavía no hay accesos registrados."))),
  ].filter(Boolean);
}

// ---------- Documentos ----------
export async function vistaDocumentos() {
  const id = ctx.estado.negocioVista;
  const [documentos, proyectos, negocios] = await Promise.all([ctx.datos.documentos(id), ctx.datos.proyectos(id), negociosAdmin()]);
  const abierto = documentos.find((d) => d.id === ctx.estado.documentoVista);
  if (abierto) return leerDocumento(abierto, proyectos);
  ctx.estado.documentoVista = null;
  const nombreProyecto = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]));
  const urls = await ctx.datos.urls(documentos.flatMap((d) => (d.adjuntos || []).map((a) => a.ruta)));
  const TIPO_DOC = { bienvenida: "Bienvenida", propuesta: "Propuesta", acuerdo: "Acuerdo", comprobante: "Comprobante", otro: "Documento" };
  return [
    ctx.selectorAdmin(negocios),
    cabecera("Documentos", "Tus documentos", "Bienvenida, propuestas, acuerdos y comprobantes de tus proyectos."),
    el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" }, documentos.length
      ? documentos.map((d) => el("div", { class: "item-proyecto" },
          el("div", {}, el("b", {}, d.titulo), el("br"),
            el("span", { class: "dato" }, [TIPO_DOC[d.tipo], d.proyecto_id && !d.titulo.includes(nombreProyecto[d.proyecto_id]) ? nombreProyecto[d.proyecto_id] : null, fecha(d.creado_en)].filter(Boolean).join(" · "))),
          el("div", { class: "fila" },
            d.contenido ? el("button", { class: "boton primario", type: "button", onclick: async () => { ctx.estado.documentoVista = d.id; await ctx.pintarVista({ transicion: true }); } }, "Abrir") : null,
            (d.adjuntos || []).map((a) => el("a", { class: "boton", href: urls[a.ruta] || "#", target: "_blank", rel: "noopener" }, "📎 ", a.nombre)))))
      : el("p", { class: "vacio-chico" }, "Todavía no hay documentos."))),
  ].filter(Boolean);
}

async function leerDocumento(doc, proyectos) {
  const proyecto = proyectos.find((p) => p.id === doc.proyecto_id);
  const [negocio, cobros, servicios, pago] = await Promise.all([
    ctx.datos.negocio(ctx.estado.negocioVista), ctx.datos.cobros(ctx.estado.negocioVista), ctx.datos.servicios(ctx.estado.negocioVista), ctx.datos.pago()]);
  const cuerpo = doc.contenido?.plantilla === "bienvenida"
    ? bienvenida({ negocio, proyecto, pago,
        cobros: cobros.filter((c) => c.proyecto_id === doc.proyecto_id && !c.servicio_id && c.estado !== "anulado"),
        mensualidades: servicios.filter((s) => s.proyecto_id === doc.proyecto_id && s.estado === "activo") })
    : [el("p", {}, "Este documento no tiene contenido para mostrar.")];
  return [
    el("div", { class: "cab no-imprimir" },
      el("div", {}, el("button", { class: "enlace volver", type: "button", onclick: async () => { ctx.estado.documentoVista = null; await ctx.pintarVista({ transicion: true }); } }, "← Documentos"),
        el("h1", {}, doc.titulo), el("p", {}, fecha(doc.creado_en))),
      el("button", { class: "boton", type: "button", onclick: () => window.print() }, "Imprimir o guardar PDF")),
    el("article", { class: "tarjeta documento" }, cuerpo),
  ];
}

// ---------- Documento de bienvenida (se arma con los datos vivos del proyecto) ----------
function bienvenida({ negocio, proyecto, cobros, mensualidades, pago }) {
  const nombre = negocio?.nombre || "tu negocio";
  const etapas = {
    anticipo: "Con el primer pago reservamos tu espacio en la agenda y arrancamos.",
    diseno: "Te mostramos la propuesta visual para que la revises y la apruebes.",
    desarrollo: "Construimos tu página con tus textos, fotos y funciones.",
    revision: "La revisas completa en tu celular y en la computadora, y nos pides los ajustes acordados.",
    publicada: "Tu página sale al aire con tu dominio y queda lista para recibir clientes.",
  };
  const pagos = cobros.length
    ? el("div", { class: "cobros" }, cobros.map((c) => el("div", { class: "cobro" },
        el("div", { class: "cobro-info" }, el("b", {}, c.concepto), el("span", { class: "dato" }, c.estado === "cobrado" ? `Pagado ${fechaCorta(c.pagado_en)}` : `Vence ${fechaCorta(c.vence)}`)),
        el("div", { class: "cobro-monto" }, dinero(c.monto)))))
    : el("p", {}, "El 50 % se paga al aprobar e iniciar y el 50 % restante al publicar.");
  return [
    el("header", { class: "doc-cab" },
      el("div", { class: "doc-marca" }, el("i", { "aria-hidden": "true" }), el("div", {}, el("b", {}, "AW-RiseCR"), el("small", {}, "Bienvenida"))),
      el("h2", {}, `¡Bienvenido a AW-RiseCR, ${nombre}!`),
      el("p", {}, `Gracias por confiar en nosotros${proyecto ? ` para ${proyecto.nombre}` : ""}. Este documento resume cómo vamos a trabajar juntos. Guárdalo: todo lo que dice también está en tu portal.`)),
    proyecto ? el("section", {}, el("h3", {}, "Tu proyecto"),
      el("div", { class: "doc-datos" },
        el("div", {}, el("small", {}, "Proyecto"), el("b", {}, proyecto.nombre)),
        Number(proyecto.monto_total) > 0 ? el("div", {}, el("small", {}, "Inversión"), el("b", {}, dinero(proyecto.monto_total))) : null,
        el("div", {}, el("small", {}, "Inicio"), el("b", {}, fechaCorta(proyecto.inicio))),
        proyecto.entrega_estimada ? el("div", {}, el("small", {}, "Entrega estimada"), el("b", {}, fechaCorta(proyecto.entrega_estimada))) : null)) : null,
    el("section", {}, el("h3", {}, "Cómo avanzamos"),
      el("ol", { class: "doc-etapas" }, ETAPAS.map(([k, n]) => el("li", { class: proyecto?.etapa === k ? "actual" : null }, el("b", {}, n), el("span", {}, etapas[k]))))),
    el("section", {}, el("h3", {}, "Lo que necesitamos de ti"),
      el("ul", {},
        el("li", {}, "Tu logo en buena calidad (PNG, SVG o el archivo original)."),
        el("li", {}, "Fotos de tu negocio, productos o servicios. Si no tienes, te ayudamos a elegir."),
        el("li", {}, "Textos y datos: horarios, precios, dirección, redes sociales y cómo te contactan."),
        el("li", {}, "Respuestas y aprobaciones a tiempo, para cumplir la fecha de entrega."),
        el("li", {}, el("b", {}, "Nunca nos envíes contraseñas por chat. "), "Si necesitamos un acceso (dominio, hosting, Google), te explicamos cómo compartirlo de forma segura."))),
    el("section", {}, el("h3", {}, "Tu portal"),
      el("ul", {},
        el("li", {}, el("b", {}, "Bitácora: "), "cada avance con fecha y hora, del más reciente al primero. Cuando algo necesite tu visto bueno, verás el botón Aprobar."),
        el("li", {}, el("b", {}, "Pagos: "), "lo que falta por pagar, tus mensualidades y el historial."),
        el("li", {}, el("b", {}, "Fondo AW: "), "tu crédito por recomendarnos."),
        el("li", {}, el("b", {}, "Documentos: "), "este documento, propuestas y comprobantes."))),
    el("section", {}, el("h3", {}, "Pagos"), pagos,
      mensualidades.map((s) => el("p", {}, el("b", {}, `${s.plan || TIPO_SERVICIO[s.tipo]}: ${dinero(s.monto_mensual)} al mes. `), cuandoCobra(s))),
      el("p", {}, "Los montos están en dólares. Si pagas en colones, se usa el tipo de cambio de venta del Banco Central del día del pago."),
      el("div", { class: "doc-pago" }, datosDePago(pago))),
    el("section", {}, el("h3", {}, "Fondo AW: recomiéndanos y gana crédito"),
      el("p", {}, "Si recomiendas a otro negocio y paga su proyecto, te cargamos el 15 % de ese proyecto (20 % desde tu 3.ª recomendación, hasta $150 cada vez) para tus próximos desarrollos. Quien llega recomendado recibe $25 de bienvenida. El crédito vence a los 12 meses y cubre hasta el 50 % de un proyecto nuevo.")),
    el("section", { class: "doc-contacto" }, el("h3", {}, "¿Dudas? Escríbenos"),
      el("div", { class: "doc-datos" },
        el("div", {}, el("small", {}, "WhatsApp"), el("b", {}, CONTACTO.whatsappVisible)),
        el("div", {}, el("small", {}, "Llamadas"), el("b", {}, CONTACTO.llamadas)),
        el("div", {}, el("small", {}, "Correo"), el("b", {}, CONTACTO.correo))),
      el("p", { class: "dato" }, "Condiciones completas en awrisecr.com/politicas")),
  ].filter(Boolean);
}
