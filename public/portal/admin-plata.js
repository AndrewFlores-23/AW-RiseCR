// Portal AW-RiseCR · panel del administrador: cobros, mensualidades y Fondo AW
// Las reglas (50 % del Fondo, recomendaciones, mensualidades) las aplica la base de datos; aquí solo se muestran y se piden.
import { el, icono, fechaCorta, dinero, hoy, sumarDias, zona, filaMovimiento, proximaMensualidad, ESTADO_COBRO, TIPO_SERVICIO, METODOS } from "/portal/util.js";
import { ctx, api, campo, entrada, seleccion, mensaje, conBoton, textoError } from "/portal/admin-base.js";

const PENDIENTE = ["atrasado", "por_vencer", "programado"];
const ORDEN = { atrasado: 0, por_vencer: 1, programado: 2, cobrado: 3, anulado: 4 };
const ordenar = (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.vence.localeCompare(b.vence);
const suma = (lista) => lista.reduce((s, c) => s + Number(c.monto), 0);
const mesActual = new Intl.DateTimeFormat("es-CR", { timeZone: zona, month: "long" }).format(new Date());

export const selloCobro = (c) => el("span", { class: "sello " + c.estado }, c.estado === "por_vencer" ? `Vence ${fechaCorta(c.vence)}` : ESTADO_COBRO[c.estado]);
const botonSimple = (texto, accion, clase = "boton") => el("button", { class: clase, type: "button", onclick: accion }, texto);

// ---------- Fila de cobro con sus acciones ----------
function filaCobro(c, { nombres, proyectos, recargar }) {
  const acciones = el("div", { class: "acciones-fila" });
  const zona = el("div", { class: "cobro-form" });
  const avisos = el("div");
  const cerrar = () => { zona.replaceChildren(); acciones.hidden = false; };
  const abrir = (form) => { acciones.hidden = true; zona.replaceChildren(form, avisos); form.querySelector("input, select")?.focus(); };
  const ejecutar = async (b, tarea) => conBoton(b, async () => {
    try { await tarea(); await recargar(); } catch (e) { console.error(e); mensaje(avisos, textoError(e)); if (!zona.childNodes.length) zona.append(avisos); }
  });

  const formPagado = () => {
    const fecha = entrada("date", hoy(), { max: hoy() });
    const metodo = seleccion(METODOS.map((m) => [m, m]), METODOS[0]);
    const guardar = el("button", { class: "boton primario", type: "submit" }, "Guardar pago");
    abrir(el("form", { class: "fila-form", novalidate: true, onsubmit: (ev) => { ev.preventDefault(); ejecutar(guardar, () => api().actualizarCobro(c.id, { pagado_en: fecha.value || hoy(), metodo: metodo.value })); } },
      campo("Fecha del pago", fecha), campo("Método", metodo), el("div", { class: "acciones" }, guardar, botonSimple("Cancelar", cerrar))));
  };
  const formFondo = () => {
    const monto = entrada("number", c.monto, { min: "1", max: String(c.monto), step: "0.01" });
    const aplicar = el("button", { class: "boton primario", type: "submit" }, "Aplicar crédito");
    abrir(el("form", { class: "fila-form", novalidate: true, onsubmit: (ev) => { ev.preventDefault(); ejecutar(aplicar, () => api().pagarConFondo(c.id, Number(monto.value))); } },
      campo("Monto del Fondo AW", monto, "Cubre hasta el 50 % del proyecto y no pasa del saldo."), el("div", { class: "acciones" }, aplicar, botonSimple("Cancelar", cerrar))));
  };

  if (c.estado === "cobrado") {
    if (c.metodo !== "Fondo AW") acciones.append(botonSimple("Deshacer", (ev) => ejecutar(ev.currentTarget, () => api().actualizarCobro(c.id, { pagado_en: null, metodo: null }))));
  } else if (c.estado === "anulado") {
    acciones.append(botonSimple("Restaurar", (ev) => ejecutar(ev.currentTarget, () => api().actualizarCobro(c.id, { anulado: false }))));
  } else {
    acciones.append(botonSimple("Cobrado", formPagado, "boton primario"));
    if (c.proyecto_id && !c.servicio_id) acciones.append(botonSimple("Fondo AW", formFondo));
    acciones.append(botonSimple("Anular", (ev) => { if (confirm(`¿Anular "${c.concepto}"? Dejará de verse como pendiente.`)) ejecutar(ev.currentTarget, () => api().actualizarCobro(c.id, { anulado: true })); }));
  }

  const detalle = [
    nombres ? nombres[c.negocio_id] : null,
    !nombres && c.proyecto_id && proyectos[c.proyecto_id] && !c.concepto.includes(proyectos[c.proyecto_id]) ? proyectos[c.proyecto_id] : null,
    c.servicio_id ? "Mensualidad" : null,
    c.estado === "cobrado" ? `Pagado ${fechaCorta(c.pagado_en)} · ${c.metodo || "—"}` : `Vence ${fechaCorta(c.vence)}`,
  ].filter(Boolean).join(" · ");
  return el("div", { class: "cobro " + c.estado },
    el("div", { class: "cobro-info" }, el("b", {}, c.concepto), el("span", { class: "dato" }, detalle)),
    el("div", { class: "cobro-monto" }, dinero(c.monto)),
    el("div", { class: "cobro-sello" }, selloCobro(c)),
    acciones, zona);
}

function listaCobros(cobros, opciones, vacio = "No hay cobros.") {
  return cobros.length ? el("div", { class: "cobros" }, cobros.map((c) => filaCobro(c, opciones))) : el("p", { class: "vacio-chico" }, vacio);
}

// ---------- Formulario de cobro suelto ----------
function formCobro({ negocios, negocioId, proyectos, alGuardar, alCancelar }) {
  const cliente = negocioId ? null : seleccion(negocios.map((n) => [n.id, n.nombre]), negocios[0]?.id);
  const proyecto = seleccion([], "");
  const concepto = entrada("text", "", { required: true, maxlength: "140", placeholder: "Ej.: Dominio awrisecr.com por un año" });
  const monto = entrada("number", "", { min: "1", step: "0.01", placeholder: "25" });
  const vence = entrada("date", sumarDias(hoy(), 7));
  const avisos = el("div");
  const boton = el("button", { class: "boton primario", type: "submit" }, "Crear cobro");
  const cargarProyectos = async () => {
    const lista = negocioId ? proyectos : await api().proyectos(cliente.value);
    proyecto.replaceChildren(el("option", { value: "" }, "Sin proyecto (todo el negocio)"), ...lista.map((p) => el("option", { value: p.id }, p.nombre)));
  };
  cliente?.addEventListener("change", cargarProyectos);
  cargarProyectos();
  return el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (!concepto.value.trim() || !(Number(monto.value) > 0) || !vence.value) return mensaje(avisos, "Escribe el concepto, un monto mayor a cero y la fecha.");
    await conBoton(boton, async () => {
      try {
        await api().crearCobro({ negocio_id: negocioId || cliente.value, proyecto_id: proyecto.value || null, concepto: concepto.value.trim(), monto: Number(monto.value), vence: vence.value });
        await alGuardar();
      } catch (e) { console.error(e); mensaje(avisos, textoError(e, "No se pudo crear el cobro.")); }
    });
  } },
    el("div", { class: "form-grid" }, cliente ? campo("Cliente", cliente) : null, campo("Proyecto", proyecto), campo("Concepto *", concepto), campo("Monto (USD) *", monto), campo("Vence *", vence)),
    el("div", { class: "acciones" }, boton, botonSimple("Cancelar", alCancelar)), avisos);
}

// ---------- Vista: Cobros (todos los clientes) ----------
export async function vistaCobros() {
  const [cobros, negocios] = await Promise.all([api().cobros(), api().negocios()]);
  const nombres = Object.fromEntries(negocios.map((n) => [n.id, n.nombre]));
  const recargar = () => ctx.pintarVista();
  const pendientes = cobros.filter((c) => PENDIENTE.includes(c.estado)).sort(ordenar);
  const atrasados = pendientes.filter((c) => c.estado === "atrasado");
  const proximos = pendientes.filter((c) => c.estado !== "atrasado" && c.vence <= sumarDias(hoy(), 30));
  const cobradosMes = cobros.filter((c) => c.estado === "cobrado" && c.pagado_en?.slice(0, 7) === hoy().slice(0, 7) && c.metodo !== "Fondo AW");
  const recientes = cobros.filter((c) => c.estado === "cobrado").sort((a, b) => b.pagado_en.localeCompare(a.pagado_en)).slice(0, 8);
  const zonaNuevo = el("div");
  const nuevo = () => {
    if (!negocios.length) return mensaje(zonaNuevo, "Primero registra un cliente.");
    zonaNuevo.replaceChildren(el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" },
      formCobro({ negocios, alGuardar: recargar, alCancelar: () => zonaNuevo.replaceChildren() }))));
  };
  const indicador = (titulo, total, detalle, color) => el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo" },
    el("span", { class: "etq" }, titulo), el("div", { class: "grande " + (color || "") }, dinero(total)), el("span", { class: "dato" }, detalle)));
  const opciones = { nombres, proyectos: {}, recargar };

  return [
    el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Panel interno"), el("h1", {}, "Cobros"),
      el("p", {}, "Anticipos, saldos y mensualidades de todos tus clientes.")),
      el("button", { class: "boton primario", type: "button", onclick: nuevo }, icono("publicar"), "Nuevo cobro")),
    zonaNuevo,
    el("div", { class: "rejilla tres" },
      indicador("Atrasado", suma(atrasados), `${atrasados.length} ${atrasados.length === 1 ? "cobro" : "cobros"}`, atrasados.length ? "rojo" : ""),
      indicador("Próximos 30 días", suma(proximos), `${proximos.length} ${proximos.length === 1 ? "cobro" : "cobros"}`),
      indicador(`Cobrado en ${mesActual}`, suma(cobradosMes), `${cobradosMes.length} ${cobradosMes.length === 1 ? "pago" : "pagos"} · sin contar Fondo AW`, cobradosMes.length ? "verde" : "")),
    await avisoReferidos(),
    el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, `Pendientes (${pendientes.length})`)),
      el("div", { class: "tarjeta-cuerpo" }, listaCobros(pendientes, opciones, "No hay cobros pendientes. 🎉"))),
    el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Cobrados recientes")),
      el("div", { class: "tarjeta-cuerpo" }, listaCobros(recientes, opciones, "Todavía no hay pagos registrados."))),
    await tarjetaDatosPago(),
  ];
}

// ---------- Datos de pago que ven los clientes ----------
// Se guardan en la base de datos (no en el código, que es público) y solo los leen usuarios con sesión.
async function tarjetaDatosPago() {
  const pago = await api().pago();
  const campos = [
    ["sinpe", "SINPE Móvil (número)", "8888-8888"], ["sinpe_titular", "SINPE a nombre de", "Nombre completo"],
    ["banco", "Banco", "BAC"], ["cuenta_titular", "Titular de la cuenta", "NOMBRE COMPLETO"],
    ["cuenta", "Número de cuenta", ""], ["iban", "Cuenta IBAN", "CR00 0000 0000 0000 0000 00"],
  ].map(([clave, etiqueta, ejemplo]) => [clave, etiqueta, entrada("text", pago[clave] || "", { maxlength: "80", placeholder: ejemplo, autocomplete: "off" })]);
  const avisos = el("div");
  const boton = el("button", { class: "boton primario", type: "submit" }, "Guardar datos de pago");
  return el("form", { class: "tarjeta", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    await conBoton(boton, async () => {
      try {
        await api().guardarPago(Object.fromEntries(campos.map(([clave, , control]) => [clave, control.value.trim()]).filter(([, v]) => v)));
        mensaje(avisos, "Guardado. Tus clientes ya lo ven en Pagos y en su documento de bienvenida.", "ok");
      } catch (e) { console.error(e); mensaje(avisos, textoError(e, "No se pudieron guardar los datos de pago.")); }
    });
  } },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Datos de pago que ven tus clientes")),
    el("div", { class: "tarjeta-cuerpo" },
      el("p", {}, "Aparecen en Pagos y en el documento de bienvenida. Se guardan en la base de datos, no en el código, y solo los ven clientes con sesión."),
      el("div", { class: "form-grid separado" }, campos.map(([, etiqueta, control]) => campo(etiqueta, control))),
      el("div", { class: "acciones" }, boton), avisos));
}

// ---------- Tarjeta: cobros de un cliente ----------
export async function tarjetaCobros(negocioId, proyectos, recargar) {
  const cobros = await api().cobros(negocioId);
  const nombresProyecto = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]));
  const opciones = { nombres: null, proyectos: nombresProyecto, recargar };
  const pendientes = cobros.filter((c) => PENDIENTE.includes(c.estado)).sort(ordenar);
  const otros = cobros.filter((c) => !PENDIENTE.includes(c.estado)).sort((a, b) => (b.pagado_en || b.vence).localeCompare(a.pagado_en || a.vence));
  const zonaNuevo = el("div");
  const zonaOtros = el("div");
  const verOtros = otros.length ? el("button", { class: "enlace", type: "button", onclick: () => {
    const abierto = zonaOtros.childNodes.length > 0;
    zonaOtros.replaceChildren(...(abierto ? [] : [listaCobros(otros, opciones)]));
    verOtros.textContent = abierto ? `Ver cobrados y anulados (${otros.length})` : "Ocultar cobrados y anulados";
  } }, `Ver cobrados y anulados (${otros.length})`) : null;
  const pagado = suma(cobros.filter((c) => c.estado === "cobrado"));

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Cobros"),
      botonSimple("Nuevo cobro", () => zonaNuevo.replaceChildren(formCobro({ negocioId, proyectos, alGuardar: recargar, alCancelar: () => zonaNuevo.replaceChildren() })))),
    el("div", { class: "tarjeta-cuerpo" },
      zonaNuevo,
      el("div", { class: "fila resumen-cobros" },
        el("span", { class: "dato" }, `Pendiente ${dinero(suma(pendientes))}`), el("span", { class: "dato" }, `Pagado ${dinero(pagado)}`)),
      listaCobros(pendientes, opciones, "No tiene cobros pendientes."), verOtros, zonaOtros));
}

// ---------- Tarjeta: mensualidades (servicios) ----------
export async function tarjetaServicios(negocioId, proyectos, recargar) {
  const servicios = await api().servicios(negocioId);
  const zonaNuevo = el("div");
  const formServicio = (actual) => {
    const tipo = seleccion(Object.entries(TIPO_SERVICIO), actual?.tipo || "mantenimiento");
    const plan = entrada("text", actual?.plan, { maxlength: "80", placeholder: "Ej.: Mantenimiento básico" });
    const monto = entrada("number", actual?.monto_mensual, { min: "1", step: "0.01", placeholder: "25" });
    const dia = entrada("number", actual?.dia_cobro ?? Math.min(28, Number(hoy().slice(8))), { min: "1", max: "28", step: "1" });
    const inicio = entrada("date", actual?.inicio || hoy());
    // Por defecto va ligada al proyecto más reciente: así empieza a cobrarse un mes después de su entrega
    const proyecto = seleccion([["", "Todo el negocio (día fijo)"], ...proyectos.map((p) => [p.id, p.nombre])], actual ? actual.proyecto_id || "" : proyectos[0]?.id || "");
    const campoDia = campo("Día de cobro *", dia, "Del 1 al 28");
    const campoDesde = campo("Desde", inicio);
    const nota = el("p", { class: "dato" });
    const alternar = () => {
      const ligada = Boolean(proyecto.value);
      campoDia.hidden = campoDesde.hidden = ligada;
      nota.textContent = ligada
        ? "Empieza un mes después de la entrega del proyecto, el mismo día del mes. El cobro aparece 25 días antes."
        : "Se cobra el día elegido de cada mes desde la fecha indicada. El cobro aparece 25 días antes.";
    };
    proyecto.addEventListener("change", alternar);
    alternar();
    const avisos = el("div");
    const boton = el("button", { class: "boton primario", type: "submit" }, actual ? "Guardar" : "Agregar mensualidad");
    return el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      const d = Number(dia.value), ligada = Boolean(proyecto.value);
      if (!(Number(monto.value) > 0)) return mensaje(avisos, "Escribe el monto mensual.");
      if (!ligada && !(d >= 1 && d <= 28)) return mensaje(avisos, "Elige un día de cobro entre 1 y 28.");
      await conBoton(boton, async () => {
        try {
          const datos = { tipo: tipo.value, plan: plan.value.trim() || null, monto_mensual: Number(monto.value), proyecto_id: proyecto.value || null,
            dia_cobro: ligada ? null : d, inicio: ligada ? null : inicio.value || hoy() };
          if (actual) await api().actualizarServicio(actual.id, datos);
          else await api().crearServicio({ negocio_id: negocioId, ...datos });
          await recargar();
        } catch (e) { console.error(e); mensaje(avisos, textoError(e, "No se pudo guardar la mensualidad.")); }
      });
    } },
      el("div", { class: "form-grid" }, campo("Servicio", tipo), campo("Plan", plan), campo("Monto mensual (USD) *", monto), campo("Proyecto", proyecto), campoDia, campoDesde),
      nota,
      el("div", { class: "acciones" }, boton, botonSimple("Cancelar", () => zonaNuevo.replaceChildren())), avisos);
  };

  const items = servicios.map((s) => {
    const estado = seleccion([["activo", "Activo"], ["pausado", "Pausado"], ["cancelado", "Cancelado"]], s.estado, { class: "etapa-select", "aria-label": "Estado de " + (s.plan || TIPO_SERVICIO[s.tipo]) });
    const aviso = el("span", { class: "dato" });
    estado.addEventListener("change", async () => {
      if (estado.value !== "activo" && !confirm("Los cobros pendientes de esta mensualidad que aún no vencen se anularán. ¿Seguir?")) { estado.value = s.estado; return; }
      estado.disabled = true;
      try { await api().actualizarServicio(s.id, { estado: estado.value }); await recargar(); }
      catch { aviso.textContent = "No se pudo guardar"; estado.value = s.estado; estado.disabled = false; }
    });
    return el("div", { class: "item-proyecto" },
      el("div", {}, el("b", {}, s.plan || TIPO_SERVICIO[s.tipo]), el("br"),
        el("span", { class: "dato" }, `${dinero(s.monto_mensual)}/mes · ${cuandoCobra(s)}`)),
      el("div", { class: "fila" }, estado,
        botonSimple("Editar", () => { zonaNuevo.replaceChildren(formServicio(s)); zonaNuevo.querySelector("input")?.focus(); }), aviso));
  });

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Mensualidades"),
      botonSimple("Agregar", () => { zonaNuevo.replaceChildren(formServicio(null)); zonaNuevo.querySelector("input")?.focus(); })),
    el("div", { class: "tarjeta-cuerpo" }, zonaNuevo, items.length ? items : el("p", { class: "vacio-chico" }, "Sin mensualidades (mantenimiento, SEO, redes, fidelización).")));
}

// Cuándo se cobra una mensualidad, en palabras
export function cuandoCobra(s) {
  if (s.estado !== "activo") return s.estado === "pausado" ? "pausada" : "cancelada";
  if (s.proyecto_id && !s.proyectos?.entregado_en) return `${s.proyectos?.nombre || "proyecto"} · empieza un mes después de la entrega`;
  const proxima = proximaMensualidad(s);
  return [s.proyecto_id ? s.proyectos?.nombre : null, proxima ? `próximo cobro ${fechaCorta(proxima)}` : null].filter(Boolean).join(" · ");
}

// ---------- Tarjeta: Fondo AW de un cliente ----------
export async function tarjetaFondo(negocioId) {
  const [fondo, movimientos] = await Promise.all([api().fondo(negocioId), api().movimientos(negocioId)]);
  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Fondo AW"),
      fondo?.proximo_vencimiento ? el("span", { class: "dato" }, `Vence ${fechaCorta(fondo.proximo_vencimiento)}`) : null),
    el("div", { class: "tarjeta-cuerpo" },
      el("div", { class: "grande azul" }, dinero(fondo?.saldo || 0)),
      movimientos.length
        ? el("div", { class: "movimientos" }, movimientos.slice(0, 6).map(filaMovimiento))
        : el("p", { class: "vacio-chico" }, "Sin movimientos. Gana crédito cuando alguien que recomendó paga su proyecto.")));
}

// ---------- Recomendaciones por cargar (en Clientes y Cobros) ----------
export async function avisoReferidos() {
  const pendientes = await api().referidosPendientes();
  if (!pendientes.length) return null;
  const limite = sumarDias(hoy(), -15);
  const filas = pendientes.map((r) => {
    const total = Number(r.monto_total), pagado = Number(r.pagado);
    const estimado = Math.min(150, Math.round(total * (r.previas >= 2 ? 20 : 15)) / 100);
    const faltas = [];
    if (!(total > 0)) faltas.push("el proyecto no tiene monto");
    else if (pagado < total) faltas.push(`pagado ${dinero(pagado)} de ${dinero(total)}`);
    if (!r.entregado_en) faltas.push("falta publicarlo");
    else if (r.entregado_en > limite) {
      const dias = Math.round((new Date(r.entregado_en + "T12:00:00") - new Date(limite + "T12:00:00")) / 86400000);
      faltas.push(`faltan ${dias} ${dias === 1 ? "día" : "días"} de garantía`);
    }
    const listo = !faltas.length;
    const avisos = el("span", { class: "dato" });
    return el("div", { class: "item-proyecto" },
      el("div", {}, el("b", {}, `${r.referidor} ← ${r.negocio}`), el("br"),
        el("span", { class: "dato" }, `${r.proyecto} · ${listo ? "listo para cargar" : faltas.join(" · ")}`)),
      el("div", { class: "fila" },
        el("button", { class: "boton" + (listo ? " primario" : ""), type: "button", disabled: !listo, onclick: async (ev) => {
          if (!confirm(`¿Cargar ${dinero(estimado)} al Fondo AW de ${r.referidor}?`)) return;
          await conBoton(ev.currentTarget, async () => {
            try { await api().cargarReferido(r.proyecto_id); await ctx.pintarVista(); }
            catch (e) { console.error(e); avisos.textContent = textoError(e); }
          });
        } }, `Cargar ${dinero(estimado)}`), avisos));
  });
  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Fondo AW · recomendaciones por cargar"),
      el("span", { class: "dato" }, "15 % (20 % desde la 3.ª) · tope $150")),
    el("div", { class: "tarjeta-cuerpo" }, filas));
}
