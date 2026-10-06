// Portal AW-RiseCR · panel del administrador
// Registrar clientes, invitar personas, crear proyectos y publicar avances en la bitácora (cobros y Fondo AW en admin-plata.js).
// Solo se carga para el administrador; los permisos reales los aplica la base de datos (RLS + dos pasos).
import { el, icono, fechaCorta, dinero, hoy, ETAPAS, TIPOS } from "/portal/util.js";
import { ctx, fijarContexto, api, idc, TIPOS_ARCHIVO, MAX_ARCHIVO, tipoDe, campo, entrada, area, seleccion, mensaje, conBoton, linea, soloDigitos } from "/portal/admin-base.js";
import { vistaCobros, tarjetaCobros, tarjetaServicios, tarjetaFondo, avisoReferidos } from "/portal/admin-plata.js";
import { tarjetaAccesos, tarjetaDocumentos, avisoRenovaciones } from "/portal/admin-expediente.js";

export const iniciarAdmin = fijarContexto;
const etapaNombre = (k) => ETAPAS.find(([e]) => e === k)?.[1] || k;

// ---------- Vista: Clientes ----------
async function vistaClientes() {
  const negocios = await api().negocios();
  const zonaForm = el("div");
  const abrirFormulario = () => {
    zonaForm.replaceChildren(formNegocio(null, negocios, async (id) => { ctx.estado.negocioAdmin = id; await ctx.irA("cliente"); }, () => zonaForm.replaceChildren()));
    zonaForm.querySelector("input")?.focus();
  };
  const filas = negocios.map((n) => {
    const proyectos = (n.proyectos || []).sort((a, b) => (b.creado_en || "").localeCompare(a.creado_en || ""));
    const p = proyectos[0];
    const idx = p ? ETAPAS.findIndex(([k]) => k === p.etapa) : -1;
    return el("tr", {},
      el("td", {}, el("b", {}, n.nombre), el("br"), el("span", { class: "dato" }, [n.nicho, n.ciudad].filter(Boolean).join(" · "))),
      el("td", {}, el("div", { class: "mini-etapas" }, ETAPAS.map((_, i) => el("i", { class: i <= idx ? "h" : null }))),
        el("span", { class: "dato" }, p ? etapaNombre(p.etapa) + (proyectos.length > 1 ? ` · ${proyectos.length} proyectos` : "") : "Sin proyecto")),
      el("td", { class: "ocultar-movil" }, el("span", { class: n.estado === "activo" ? "sello cobrado" : "sello programado" }, n.estado)),
      el("td", { class: "acciones-fila" },
        el("button", { class: "boton primario", type: "button", onclick: async () => { ctx.estado.negocioAdmin = n.id; await ctx.irA("cliente"); } }, "Gestionar"),
        el("button", { class: "boton", type: "button", onclick: async () => { ctx.estado.negocioVista = n.id; ctx.estado.proyectoVista = null; await ctx.irA("inicio"); } }, "Ver portal")));
  });
  return [
    el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Panel interno"), el("h1", {}, "Clientes"),
      el("p", {}, `${negocios.length} ${negocios.length === 1 ? "cliente registrado" : "clientes registrados"}`)),
      el("button", { class: "boton primario", type: "button", onclick: abrirFormulario }, icono("publicar"), "Registrar cliente")),
    zonaForm,
    await avisoRenovaciones(negocios),
    await avisoReferidos(),
    el("div", { class: "tarjeta" }, negocios.length
      ? el("table", { class: "tabla" }, el("thead", {}, el("tr", {}, el("th", {}, "Cliente"), el("th", {}, "Proyecto"), el("th", { class: "ocultar-movil" }, "Estado"), el("th", {}, ""))), el("tbody", {}, filas))
      : el("div", { class: "vacio" }, "Todavía no hay clientes. Toca \"Registrar cliente\" para agregar el primero.")),
  ];
}

// Campos de un proyecto nuevo: se usan al registrar el cliente y en "Nuevo proyecto"
function camposProyecto({ opcional = false } = {}) {
  const nombre = entrada("text", "", { maxlength: "120", placeholder: "Ej.: Página web con reservas" });
  const monto = entrada("number", "", { min: "0", step: "1", placeholder: "600" });
  const inicio = entrada("date", hoy());
  const entrega = entrada("date", "");
  const mensualidad = entrada("number", "", { min: "0", step: "1", placeholder: "25" });
  const cobros = el("input", { type: "checkbox", checked: true });
  const bloque = [
    el("div", { class: "form-grid" },
      campo(opcional ? "Nombre del proyecto" : "Nombre *", nombre), campo("Monto total (USD, sin IVA)", monto),
      campo("Inicio", inicio), campo("Entrega estimada", entrega),
      campo("Mensualidad (USD)", mensualidad, "Mantenimiento. Empieza a cobrarse un mes después de la entrega. Vacío si no lleva.")),
    el("label", { class: "casilla" }, cobros, "Crear los cobros: 50 % de anticipo al iniciar y 50 % al publicar"),
    el("p", { class: "dato" }, "Se crean solos la entrada \"¡Arrancamos!\" en su bitácora y su documento de bienvenida."),
  ];
  const datos = (negocioId) => ({
    negocio_id: negocioId, nombre: nombre.value.trim(), monto_total: Number(monto.value || 0), inicio: inicio.value || null,
    entrega_estimada: entrega.value || null, cobros: cobros.checked, mensualidad: Number(mensualidad.value || 0),
  });
  return { nombre, bloque, datos };
}

// Formulario de negocio (registrar o editar) con su contacto cifrado; al registrar, también su primer proyecto
function formNegocio(actual, negocios, alGuardar, alCancelar) {
  const c = actual?.contacto || {};
  const nombre = entrada("text", actual?.nombre, { required: true, maxlength: "120" });
  const nicho = entrada("text", actual?.nicho, { placeholder: "Ej.: Restaurante, tours, barbería" });
  const ciudad = entrada("text", actual?.ciudad, { placeholder: "Ej.: Tamarindo" });
  const referido = seleccion([["", "Nadie (llegó solo)"], ...negocios.filter((n) => n.id !== actual?.id).map((n) => [n.id, n.nombre])], actual?.referido_por || "");
  const telefono = entrada("tel", c.telefono, { placeholder: "8888-8888" });
  const correo = entrada("email", c.correo);
  const cedula = entrada("text", c.cedula);
  const notas = area(c.notas_privadas, { placeholder: "Solo las ves tú" });
  const avisos = el("div");
  const boton = el("button", { class: "boton primario", type: "submit" }, actual ? "Guardar cambios" : "Registrar cliente");
  const proyecto = actual ? null : camposProyecto({ opcional: true });
  let creado = null; // si el negocio se creó pero falló algo después, el reintento no lo duplica
  let proyectoCreado = false;
  const form = el("form", { class: "tarjeta formulario-panel", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (!nombre.value.trim()) return mensaje(avisos, "Escribe el nombre del negocio.");
    await conBoton(boton, async () => {
      try {
        const datos = { nombre: nombre.value.trim(), nicho: nicho.value.trim() || null, ciudad: ciudad.value.trim() || null };
        let id = actual?.id || creado;
        if (id) await api().actualizarNegocio(id, datos);
        else id = creado = await api().crearNegocio({ ...datos, referido_por: referido.value || null });
        await api().guardarContacto(id, { telefono: telefono.value.trim(), correo: correo.value.trim(), cedula: cedula.value.trim(), notas: notas.value.trim() });
        if (proyecto?.nombre.value.trim() && !proyectoCreado) { await api().crearProyecto(proyecto.datos(id)); proyectoCreado = true; }
        await alGuardar(id);
      } catch (e) { console.error(e); mensaje(avisos, "No se pudo guardar. Revisa los datos e inténtalo de nuevo."); }
    });
  } },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, actual ? "Editar cliente" : "Nuevo cliente"),
      el("button", { class: "enlace", type: "button", onclick: alCancelar }, "Cancelar")),
    el("div", { class: "tarjeta-cuerpo" },
      el("div", { class: "form-grid" },
        campo("Nombre del negocio *", nombre), campo("Nicho", nicho), campo("Ciudad", ciudad),
        actual ? null : campo("Lo recomendó", referido, "Si vino recomendado, recibe $25 de bienvenida y el que lo recomendó suma a su Fondo AW.")),
      el("p", { class: "etq separador" }, "Contacto (se guarda cifrado)"),
      el("div", { class: "form-grid" }, campo("Teléfono / WhatsApp", telefono), campo("Correo", correo), campo("Cédula", cedula)),
      campo("Notas privadas", notas),
      proyecto ? [el("p", { class: "etq separador" }, "Primer proyecto (opcional)"), proyecto.bloque] : null,
      el("div", { class: "acciones" }, boton), avisos));
  return form;
}

// ---------- Vista: Gestionar un cliente ----------
async function vistaGestionar() {
  const id = ctx.estado.negocioAdmin;
  if (!id) { ctx.estado.seccion = "panel"; return vistaClientes(); }
  const [negocio, contacto, proyectos, negocios] = await Promise.all([api().negocio(id), api().contacto(id), api().proyectos(id), api().negocios()]);
  if (!negocio) return [el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "No encontramos este cliente."))];

  const recargar = () => ctx.pintarVista();
  const zonaEditar = el("div");

  // Datos y contacto
  const datosCard = el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Datos y contacto"),
      el("button", { class: "boton", type: "button", onclick: () => {
        zonaEditar.replaceChildren(formNegocio({ ...negocio, contacto }, negocios, async () => { zonaEditar.replaceChildren(); await recargar(); }, () => zonaEditar.replaceChildren()));
      } }, "Editar")),
    el("div", { class: "tarjeta-cuerpo recibo" },
      linea("Teléfono", contacto.telefono || "—"), linea("Correo", contacto.correo || "—"), linea("Cédula", contacto.cedula || "—"),
      linea("Nicho", negocio.nicho || "—"), linea("Ciudad", negocio.ciudad || "—"),
      contacto.notas_privadas ? el("p", { class: "nota-privada" }, "🔒 ", contacto.notas_privadas) : null));

  return [
    el("div", { class: "cab" },
      el("div", {}, el("button", { class: "enlace volver", type: "button", onclick: () => ctx.irA("panel") }, "← Clientes"),
        el("h1", {}, negocio.nombre), el("p", {}, [negocio.nicho, negocio.ciudad].filter(Boolean).join(" · ") || "Cliente")),
      el("div", { class: "fila" },
        el("button", { class: "boton", type: "button", onclick: async () => { ctx.estado.negocioVista = id; ctx.estado.proyectoVista = null; await ctx.irA("inicio"); } }, "Ver su portal"),
        el("button", { class: "boton primario", type: "button", onclick: async () => { ctx.estado.publicarNegocio = id; await ctx.irA("publicar"); } }, icono("publicar"), "Publicar avance"))),
    zonaEditar,
    el("div", { class: "rejilla dos arriba" },
      await tarjetaProyectos(id, proyectos, recargar),
      el("div", { class: "rejilla" }, datosCard, await tarjetaAcceso(id))),
    el("div", { class: "rejilla dos arriba" },
      await tarjetaCobros(id, proyectos, recargar),
      el("div", { class: "rejilla" }, await tarjetaServicios(id, proyectos, recargar), await tarjetaFondo(id))),
    el("div", { class: "rejilla dos arriba" },
      await tarjetaDocumentos(id, proyectos, recargar),
      await tarjetaAccesos(id, proyectos, recargar)),
  ];
}

async function tarjetaProyectos(negocioId, proyectos, recargar) {
  const zonaNuevo = el("div");
  const nuevo = () => {
    const campos = camposProyecto();
    const avisos = el("div");
    const boton = el("button", { class: "boton primario", type: "submit" }, "Crear proyecto");
    zonaNuevo.replaceChildren(el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      if (!campos.nombre.value.trim()) return mensaje(avisos, "Escribe el nombre del proyecto.");
      await conBoton(boton, async () => {
        try { await api().crearProyecto(campos.datos(negocioId)); await recargar(); }
        catch (e) { console.error(e); mensaje(avisos, "No se pudo crear el proyecto."); }
      });
    } },
      campos.bloque,
      el("div", { class: "acciones" }, boton, el("button", { class: "boton", type: "button", onclick: () => zonaNuevo.replaceChildren() }, "Cancelar")), avisos));
    campos.nombre.focus();
  };

  const items = proyectos.map((p) => {
    const etapa = seleccion(ETAPAS, p.etapa, { "aria-label": "Etapa de " + p.nombre, class: "etapa-select" });
    // La fecha de entrega manda: la mensualidad empieza un mes después (se puede corregir si se publicó otro día)
    const entregado = entrada("date", p.entregado_en || "", { max: hoy(), class: "etapa-select", "aria-label": "Fecha de entrega de " + p.nombre });
    const aviso = el("span", { class: "dato" });
    const guardar = async (control, tarea) => {
      control.disabled = true;
      try { await tarea(); await recargar(); }
      catch (e) { console.error(e); aviso.textContent = "No se pudo guardar"; etapa.value = p.etapa; entregado.value = p.entregado_en || ""; control.disabled = false; }
    };
    etapa.addEventListener("change", () => {
      const campos = { etapa: etapa.value };
      if (etapa.value === "publicada" && !p.entregado_en) campos.entregado_en = hoy();
      if (etapa.value !== "publicada" && p.entregado_en) {
        if (!confirm("Al sacarlo de Publicada se borra su fecha de entrega y la mensualidad deja de correr hasta que lo vuelvas a publicar. ¿Seguir?")) { etapa.value = p.etapa; return; }
        campos.entregado_en = null;
      }
      guardar(etapa, async () => {
        await api().actualizarProyecto(p.id, campos);
        if (etapa.value === "publicada") {
          const saldos = (await api().cobros(negocioId)).filter((c) => c.proyecto_id === p.id && !c.pagado_en && !c.anulado && c.concepto.startsWith("Saldo") && c.vence > hoy());
          for (const c of saldos) await api().actualizarCobro(c.id, { vence: hoy() });
        }
      });
    });
    entregado.addEventListener("change", () => {
      if (!entregado.value || entregado.value === p.entregado_en) return;
      guardar(entregado, () => api().actualizarProyecto(p.id, { entregado_en: entregado.value }));
    });
    return el("div", { class: "item-proyecto" },
      el("div", {}, el("b", {}, p.nombre), el("br"),
        el("span", { class: "dato" }, `${dinero(p.monto_total)} · inicio ${fechaCorta(p.inicio)}${p.entregado_en ? " · entregado " + fechaCorta(p.entregado_en) : p.entrega_estimada ? " · entrega ~" + fechaCorta(p.entrega_estimada) : ""}`)),
      el("div", { class: "fila" }, etapa,
        p.etapa === "publicada" ? el("label", { class: "entrega" }, el("span", { class: "dato" }, "Entregado el"), entregado) : null, aviso));
  });

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, `Proyectos (${proyectos.length})`),
      el("button", { class: "boton", type: "button", onclick: nuevo }, icono("publicar"), "Nuevo proyecto")),
    el("div", { class: "tarjeta-cuerpo" }, zonaNuevo, items.length ? items : el("p", {}, "Este cliente todavía no tiene proyectos.")));
}

async function tarjetaAcceso(negocioId) {
  const cuerpo = el("div", { class: "tarjeta-cuerpo" }, el("p", { class: "dato" }, "Cargando…"));
  const tarjeta = el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Acceso al portal")), cuerpo);

  const pintar = async (avisoOk) => {
    let usuarios = [];
    try { usuarios = await api().usuarios(negocioId); }
    catch (e) { cuerpo.replaceChildren(el("div", { class: "aviso error" }, e.message)); return; }
    const nombre = entrada("text", "", { placeholder: "Nombre de la persona" });
    const correo = entrada("email", "", { placeholder: "correo@negocio.com" });
    const avisos = el("div");
    if (avisoOk) mensaje(avisos, avisoOk, "ok");
    const boton = el("button", { class: "boton primario", type: "submit" }, "Enviar invitación");
    cuerpo.replaceChildren(
      usuarios.length ? el("div", { class: "lista-usuarios" }, usuarios.map((u) => el("div", { class: "item-usuario" },
        el("div", {}, el("b", {}, u.nombre || u.correo), el("br"), el("span", { class: "dato" }, u.correo)),
        el("span", { class: "sello " + (!u.activo ? "atrasado" : u.confirmado ? "cobrado" : "por_vencer") },
          !u.activo ? "Desactivado" : u.confirmado ? "Activo" : "Invitación enviada"),
        el("button", { class: "boton", type: "button", onclick: async (ev) => {
          const b = ev.currentTarget;
          if (u.activo && !confirm(`¿Quitarle el acceso al portal a ${u.nombre || u.correo}? Podrás activarlo de nuevo.`)) return;
          await conBoton(b, async () => { try { await api().cambiarAcceso(u.id, !u.activo); await pintar(); } catch (e) { mensaje(avisos, e.message); } });
        } }, u.activo ? "Desactivar" : "Activar"))))
        : el("p", {}, "Nadie de este negocio tiene acceso todavía."),
      el("form", { class: "invitar", novalidate: true, onsubmit: async (ev) => {
        ev.preventDefault();
        if (!nombre.value.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.value.trim())) return mensaje(avisos, "Escribe el nombre y un correo válido.");
        await conBoton(boton, async () => {
          try { await api().invitar(negocioId, nombre.value.trim(), correo.value.trim()); await pintar("Invitación enviada. Le llegará un correo para crear su contraseña."); }
          catch (e) { mensaje(avisos, e.message); }
        });
      } },
        el("p", { class: "etq separador" }, "Invitar a una persona"),
        el("div", { class: "form-grid" }, campo("Nombre", nombre), campo("Correo", correo)),
        el("div", { class: "acciones" }, boton), avisos));
  };
  pintar();
  return tarjeta;
}

// ---------- Vista: Publicar avance ----------
async function vistaPublicar() {
  const negocios = await api().negocios();
  if (!negocios.length) return [el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Bitácora"), el("h1", {}, "Publicar un avance"))),
    el("div", { class: "tarjeta" }, el("div", { class: "vacio" }, "Primero registra un cliente y crea su proyecto."))];

  const negocioSel = seleccion(negocios.map((n) => [n.id, n.nombre]), ctx.estado.publicarNegocio || negocios[0].id);
  const proyectoSel = el("select", { id: idc("c") });
  const titulo = entrada("text", "", { required: true, maxlength: "140", placeholder: "Ej.: Sistema de reservas conectado" });
  const nota = area("", { placeholder: "Lo que el cliente necesita saber de este avance" });
  const archivosInput = el("input", { id: idc("c"), type: "file", multiple: true, accept: TIPOS_ARCHIVO.join(",") + ",.zip", class: "oculto" });
  const listaArchivos = el("div", { class: "dato" });
  let archivos = [];
  let proyectos = [];
  const vistas = new Map(); // archivo → URL local para la vista previa
  let tipo = "avance";
  const avisos = el("div");
  const boton = el("button", { class: "boton primario", type: "submit" }, "Publicar en la bitácora");

  // Vista previa de cómo lo verá el cliente
  const previa = el("div", { class: "tarjeta-cuerpo" });
  const pintarPrevia = () => {
    const [texto, clase] = TIPOS[tipo] || TIPOS.avance;
    previa.replaceChildren(el("div", { class: "fila" }, el("span", { class: "sello " + clase }, texto), el("span", { class: "dato" }, "ahora")),
      el("h3", {}, titulo.value || "Título del avance"), nota.value ? el("p", {}, nota.value) : el("p", { class: "dato" }, "La nota aparece aquí."),
      archivos.length ? el("div", { class: "capturas" }, archivos.map((a) => tipoDe(a).startsWith("image/")
        ? el("span", { class: "captura" }, el("img", { src: vistas.get(a) || vistas.set(a, URL.createObjectURL(a)).get(a), alt: a.name }))
        : el("span", { class: "adjunto" }, "📎 ", a.name))) : null);
  };

  const cargarProyectos = async () => {
    proyectos = await api().proyectos(negocioSel.value);
    proyectoSel.replaceChildren(...(proyectos.length ? proyectos.map((p) => el("option", { value: p.id }, `${p.nombre} · ${etapaNombre(p.etapa)}`)) : [el("option", { value: "" }, "Este cliente no tiene proyectos")]));
  };
  negocioSel.addEventListener("change", cargarProyectos);
  await cargarProyectos();

  const elegirArchivos = (lista) => {
    const nuevos = [...lista];
    const malos = nuevos.filter((a) => !TIPOS_ARCHIVO.includes(tipoDe(a)) || a.size > MAX_ARCHIVO);
    if (malos.length) mensaje(avisos, `No se pueden subir: ${malos.map((a) => a.name).join(", ")}. Usa imágenes, PDF o ZIP de hasta 20 MB.`);
    archivos = [...archivos, ...nuevos.filter((a) => !malos.includes(a))].slice(0, 12);
    listaArchivos.textContent = archivos.length ? `${archivos.length} archivo(s): ${archivos.map((a) => a.name).join(", ")}` : "";
    pintarPrevia();
  };
  archivosInput.addEventListener("change", () => elegirArchivos(archivosInput.files));
  const soltar = el("label", { class: "soltar", for: archivosInput.id },
    "Arrastra capturas o archivos aquí o ", el("b", {}, "elige archivos"), el("br"), el("small", {}, "Imágenes, PDF o ZIP · hasta 20 MB c/u"));
  soltar.addEventListener("dragover", (e) => { e.preventDefault(); soltar.classList.add("encima"); });
  soltar.addEventListener("dragleave", () => soltar.classList.remove("encima"));
  soltar.addEventListener("drop", (e) => { e.preventDefault(); soltar.classList.remove("encima"); elegirArchivos(e.dataTransfer.files); });

  const tipos = el("div", { class: "tipos", role: "radiogroup", "aria-label": "Tipo de entrada" },
    [["avance", "Avance"], ["captura", "Captura"], ["entregable", "Entregable"], ["aprobacion", "Pedir aprobación"], ["nota", "Nota"]].map(([k, t]) =>
      el("button", { type: "button", role: "radio", "aria-checked": k === tipo ? "true" : "false", onclick: (ev) => {
        tipo = k;
        ev.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === ev.currentTarget)));
        pintarPrevia();
      } }, t)));
  titulo.addEventListener("input", pintarPrevia);
  nota.addEventListener("input", pintarPrevia);
  pintarPrevia();

  const avisarCorreo = el("input", { type: "checkbox", checked: true });
  const form = el("form", { class: "tarjeta", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (!proyectoSel.value) return mensaje(avisos, "Este cliente no tiene proyectos. Créale uno en Gestionar.");
    if (!titulo.value.trim()) return mensaje(avisos, "Escribe un título.");
    await conBoton(boton, async () => {
      try {
        const entradaId = await api().publicar({ negocio_id: negocioSel.value, proyecto_id: proyectoSel.value, tipo, titulo: titulo.value.trim(), nota: nota.value.trim(), archivos },
          (i, total) => { boton.textContent = `Subiendo ${i} de ${total}…`; });
        // El avance ya quedó publicado; si el correo falla, solo se avisa (no se pierde la publicación)
        let correo = null;
        if (avisarCorreo.checked) {
          boton.textContent = "Enviando el correo…";
          try { correo = await api().avisarAvance(entradaId); } catch (e) { correo = { error: e.message }; }
        }
        const negocio = negocios.find((n) => n.id === negocioSel.value);
        const proyecto = proyectos.find((p) => p.id === proyectoSel.value);
        const contacto = await api().contacto(negocioSel.value).catch(() => ({}));
        for (const url of vistas.values()) URL.revokeObjectURL(url);
        await exito(negocio, proyecto, titulo.value.trim(), contacto, correo);
      } catch (e) { console.error(e); mensaje(avisos, "No se pudo publicar. Revisa tu conexión e inténtalo de nuevo."); }
      finally { boton.textContent = "Publicar en la bitácora"; }
    });
  } },
    el("div", { class: "tarjeta-cuerpo" },
      el("div", { class: "form-grid" }, campo("Cliente", negocioSel), campo("Proyecto", proyectoSel)),
      el("div", { class: "campo" }, el("label", {}, "Tipo"), tipos),
      campo("Título *", titulo), campo("Nota para el cliente", nota),
      el("div", { class: "campo" }, el("label", { for: archivosInput.id }, "Capturas o archivos"), soltar, archivosInput, listaArchivos),
      el("label", { class: "casilla" }, avisarCorreo, "Avisarle por correo a las personas de este cliente que ya tienen su cuenta"),
      el("p", { class: "dato" }, "Se publica con la fecha y hora de este momento."),
      el("div", { class: "acciones" }, boton), avisos));

  const contenedor = el("div", {});
  // Resultado del aviso por correo, en palabras
  const textoCorreo = (c) => {
    if (!c) return null;
    if (c.error) return el("p", { class: "aviso error" }, `El avance quedó publicado, pero el correo no salió: ${c.error}`);
    if (c.enviados) return el("p", { class: "aviso ok" }, `📧 Le avisamos por correo a ${c.enviados} ${c.enviados === 1 ? "persona" : "personas"}.`);
    return el("p", { class: "dato" }, c.sin_cuenta
      ? "No se envió correo: nadie de este cliente ha activado su cuenta todavía."
      : "No se envió correo: este cliente aún no tiene personas con acceso. Invítalas en Gestionar.");
  };
  const exito = async (negocio, proyecto, tituloPublicado, contacto, correo) => {
    const tel = soloDigitos(contacto.telefono);
    const numero = tel.length === 8 ? "506" + tel : tel;
    const texto = `Hola 👋 Publicamos un avance nuevo en tu proyecto "${proyecto.nombre}": ${tituloPublicado}. Míralo en tu portal: https://awrisecr.com/portal/`;
    contenedor.replaceChildren(el("div", { class: "tarjeta" }, el("div", { class: "tarjeta-cuerpo exito" },
      el("h2", {}, "✓ Publicado en la bitácora"),
      el("p", {}, `${negocio.nombre} ya lo ve en su portal, con la fecha y hora de hoy.`),
      textoCorreo(correo),
      el("div", { class: "acciones" },
        numero ? el("a", { class: "boton primario", href: `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, target: "_blank", rel: "noopener" }, "Avisarle por WhatsApp") : el("span", { class: "dato" }, "Agrega su teléfono en Gestionar para avisarle por WhatsApp."),
        el("button", { class: "boton", type: "button", onclick: async () => { ctx.estado.negocioVista = negocio.id; ctx.estado.proyectoVista = proyecto.id; await ctx.irA("bitacora"); } }, "Ver en su bitácora"),
        el("button", { class: "boton", type: "button", onclick: () => ctx.pintarVista() }, "Publicar otro")))));
  };
  contenedor.append(el("div", { class: "rejilla dos" }, form,
    el("div", { class: "tarjeta previa" }, el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Así lo verá el cliente")), previa)));

  return [
    el("div", { class: "cab" }, el("div", {}, el("span", { class: "etq" }, "Bitácora"), el("h1", {}, "Publicar un avance"),
      el("p", {}, "Lo que publiques aparece en la bitácora del cliente con fecha y hora."))),
    contenedor,
  ];
}

// ---------- Punto de entrada ----------
export async function vistaAdmin(seccion) {
  if (seccion === "panel") return vistaClientes();
  if (seccion === "cliente") return vistaGestionar();
  if (seccion === "publicar") return vistaPublicar();
  if (seccion === "cobros") return vistaCobros();
  return [];
}
