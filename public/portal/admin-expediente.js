// Portal AW-RiseCR · panel del administrador: expediente del cliente (accesos, documentos y reportes mensuales)
// Accesos sin contraseñas: esas viven en Bitwarden y se entregan con un Send que se destruye solo.
import { el, fecha, fechaCorta, hoy, sumarDias, mesLargo, TIPOS_REPORTE } from "/portal/util.js";
import { ctx, api, TIPOS_ARCHIVO, MAX_ARCHIVO, tipoDe, campo, entrada, seleccion, mensaje, conBoton, textoError } from "/portal/admin-base.js";
import { miniaturaPdf } from "/portal/miniatura.js";

const ESTADOS_ACCESO = [["activo", "Activo"], ["pendiente", "Pendiente"], ["vencido", "Vencido"], ["inactivo", "Inactivo"]];
const TIPOS_DOC = [["propuesta", "Propuesta"], ["acuerdo", "Acuerdo"], ["comprobante", "Comprobante"], ["otro", "Otro"]];
const NOMBRE_DOC = { bienvenida: "Bienvenida", propuesta: "Propuesta", acuerdo: "Acuerdo", comprobante: "Comprobante", otro: "Documento" };
export const ENLACE_BITWARDEN = /^https:\/\/([a-z0-9-]+\.)*bitwarden\.(com|eu)\//;
const botonSimple = (texto, accion, clase = "boton") => el("button", { class: clase, type: "button", onclick: accion }, texto);

// Sello de vencimiento de un acceso (dominio, hosting): rojo si venció, amarillo si faltan 30 días o menos
export function selloVence(vence) {
  if (!vence) return null;
  if (vence < hoy()) return el("span", { class: "sello atrasado" }, "Vencido");
  if (vence <= sumarDias(hoy(), 30)) return el("span", { class: "sello por_vencer" }, `Vence ${fechaCorta(vence)}`);
  return el("span", { class: "dato" }, `Renueva ${fechaCorta(vence)}`);
}

// ---------- Accesos ----------
export async function tarjetaAccesos(negocioId, proyectos, recargar) {
  const accesos = await api().accesos(negocioId);
  const zonaForm = el("div");
  const formAcceso = (actual) => {
    const servicio = entrada("text", actual?.servicio, { maxlength: "120", placeholder: "Ej.: Dominio surfcoffee.cr" });
    const proveedor = entrada("text", actual?.proveedor, { maxlength: "80", placeholder: "Ej.: Namecheap, Cloudflare, Hostinger" });
    const titular = entrada("text", actual?.titular, { maxlength: "120", placeholder: "A nombre de quién está" });
    const usuario = entrada("text", actual?.usuario, { maxlength: "120", placeholder: "Correo o usuario de acceso", autocomplete: "off" });
    const vence = entrada("date", actual?.vence || "");
    const estado = seleccion(ESTADOS_ACCESO, actual?.estado || "activo");
    const proyecto = seleccion([["", "Todo el negocio"], ...proyectos.map((p) => [p.id, p.nombre])], actual?.proyecto_id || proyectos[0]?.id || "");
    const enlace = entrada("url", actual?.enlace_bitwarden, { maxlength: "300", placeholder: "https://send.bitwarden.com/…", autocomplete: "off" });
    const avisos = el("div");
    const boton = el("button", { class: "boton primario", type: "submit" }, actual ? "Guardar acceso" : "Agregar acceso");
    return el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      if (!servicio.value.trim()) return mensaje(avisos, "Escribe el servicio (por ejemplo, el dominio).");
      if (enlace.value.trim() && !ENLACE_BITWARDEN.test(enlace.value.trim())) return mensaje(avisos, "El enlace debe ser de Bitwarden (https://send.bitwarden.com/…).");
      await conBoton(boton, async () => {
        try {
          await api().guardarAcceso({ id: actual?.id, negocio_id: negocioId, proyecto_id: proyecto.value || null, servicio: servicio.value.trim(), proveedor: proveedor.value.trim(),
            titular: titular.value.trim(), usuario: usuario.value.trim(), vence: vence.value || null, estado: estado.value, enlace_bitwarden: enlace.value.trim() });
          await recargar();
        } catch (e) { console.error(e); mensaje(avisos, textoError(e, "No se pudo guardar el acceso.")); }
      });
    } },
      el("div", { class: "form-grid" }, campo("Servicio *", servicio), campo("Proveedor", proveedor), campo("A nombre de", titular), campo("Usuario o correo", usuario, "Se guarda cifrado."),
        campo("Vence o renueva", vence), campo("Estado", estado), proyectos.length ? campo("Proyecto", proyecto) : null),
      campo("Enlace de Bitwarden Send (opcional)", enlace, "Para entregar la contraseña: crea un Send con vencimiento y pocos accesos. Nunca escribas contraseñas aquí."),
      el("div", { class: "acciones" }, boton, botonSimple("Cancelar", () => zonaForm.replaceChildren())), avisos);
  };
  const abrir = (actual) => { zonaForm.replaceChildren(formAcceso(actual)); zonaForm.querySelector("input")?.focus(); };

  const items = accesos.map((a) => el("div", { class: "item-proyecto" },
    el("div", {}, el("b", {}, a.servicio), el("br"),
      el("span", { class: "dato" }, [a.proveedor, a.titular ? "a nombre de " + a.titular : null, a.usuario, a.enlace_bitwarden ? "con enlace seguro" : null, a.estado !== "activo" ? a.estado : null].filter(Boolean).join(" · "))),
    el("div", { class: "fila" }, selloVence(a.vence),
      botonSimple("Editar", () => abrir(a)),
      botonSimple("Borrar", async (ev) => {
        if (!confirm(`¿Borrar el acceso "${a.servicio}"? No toca nada en Bitwarden.`)) return;
        await conBoton(ev.currentTarget, async () => { try { await api().borrarAcceso(a.id); await recargar(); } catch (e) { console.error(e); } });
      }))));

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Accesos"), botonSimple("Agregar", () => abrir(null))),
    el("div", { class: "tarjeta-cuerpo" }, zonaForm,
      items.length ? items : el("p", { class: "vacio-chico" }, "Dominio, hosting, correo, Google y redes del cliente. Sin contraseñas: esas van en Bitwarden.")));
}

// ---------- Documentos ----------
export async function tarjetaDocumentos(negocioId, proyectos, recargar) {
  const documentos = await api().documentos(negocioId);
  const urls = await api().urls(documentos.flatMap((d) => (d.adjuntos || []).map((a) => a.ruta)));
  const nombreProyecto = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]));
  const zonaForm = el("div");

  const formDocumento = () => {
    const tipo = seleccion(TIPOS_DOC, "propuesta");
    const titulo = entrada("text", "", { maxlength: "140", placeholder: "Ej.: Propuesta firmada" });
    const proyecto = seleccion([["", "Todo el negocio"], ...proyectos.map((p) => [p.id, p.nombre])], proyectos[0]?.id || "");
    const archivos = el("input", { type: "file", multiple: true, accept: TIPOS_ARCHIVO.join(",") + ",.zip" });
    const avisos = el("div");
    const boton = el("button", { class: "boton primario", type: "submit" }, "Subir documento");
    archivos.addEventListener("change", () => {
      if (!titulo.value.trim() && archivos.files[0]) titulo.value = archivos.files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    });
    return el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      const lista = [...archivos.files];
      const malos = lista.filter((a) => !TIPOS_ARCHIVO.includes(tipoDe(a)) || a.size > MAX_ARCHIVO);
      if (!titulo.value.trim() || !lista.length) return mensaje(avisos, "Escribe el título y elige al menos un archivo.");
      if (malos.length) return mensaje(avisos, `No se pueden subir: ${malos.map((a) => a.name).join(", ")}. Usa PDF, imágenes o ZIP de hasta 20 MB.`);
      await conBoton(boton, async () => {
        try {
          await api().subirDocumento({ negocio_id: negocioId, proyecto_id: proyecto.value || null, tipo: tipo.value, titulo: titulo.value.trim(), archivos: lista },
            (i, total) => { boton.textContent = `Subiendo ${i} de ${total}…`; });
          await recargar();
        } catch (e) { console.error(e); mensaje(avisos, "No se pudo subir. Revisa tu conexión e inténtalo de nuevo."); }
        finally { boton.textContent = "Subir documento"; }
      });
    } },
      el("div", { class: "form-grid" }, campo("Tipo", tipo), campo("Título *", titulo), proyectos.length ? campo("Proyecto", proyecto) : null),
      el("div", { class: "campo" }, el("label", {}, "Archivos *"), archivos, el("small", { class: "nota-campo" }, "PDF, imágenes o ZIP de hasta 20 MB. El cliente los ve en Documentos.")),
      el("div", { class: "acciones" }, boton, botonSimple("Cancelar", () => zonaForm.replaceChildren())), avisos);
  };

  const items = documentos.map((d) => el("div", { class: "item-proyecto" },
    el("div", {}, el("b", {}, d.titulo), el("br"),
      el("span", { class: "dato" }, [NOMBRE_DOC[d.tipo], d.proyecto_id && !d.titulo.includes(nombreProyecto[d.proyecto_id] || "—") ? nombreProyecto[d.proyecto_id] : null, fecha(d.creado_en)].filter(Boolean).join(" · "))),
    el("div", { class: "fila" },
      (d.adjuntos || []).map((a) => el("a", { class: "boton", href: urls[a.ruta] || "#", target: "_blank", rel: "noopener noreferrer" }, "📎 ", a.nombre)),
      d.tipo === "bienvenida" ? el("span", { class: "dato" }, "Automático") : botonSimple("Borrar", async (ev) => {
        if (!confirm(`¿Borrar "${d.titulo}" y sus archivos? El cliente dejará de verlo.`)) return;
        await conBoton(ev.currentTarget, async () => { try { await api().borrarDocumento(d); await recargar(); } catch (e) { console.error(e); } });
      }))));

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Documentos"), botonSimple("Subir", () => { zonaForm.replaceChildren(formDocumento()); zonaForm.querySelector("input")?.focus(); })),
    el("div", { class: "tarjeta-cuerpo" }, zonaForm, items.length ? items : el("p", { class: "vacio-chico" }, "Propuestas, acuerdos y comprobantes del cliente.")));
}

// ---------- Reportes mensuales ----------
// Cada mes: el PDF de herramientas/reportes y qué servicios cubre. Solo se publican para clientes con mantenimiento,
// SEO, redes o fidelización activos (lo revisa la base de datos: al menos uno de los marcados debe estar activo).
function mesesRecientes() { // los últimos 18 meses, del actual hacia atrás
  const hoyF = new Date();
  return Array.from({ length: 18 }, (_, i) => {
    const d = new Date(hoyF.getFullYear(), hoyF.getMonth() - i, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return [valor, mesLargo(valor + "-01")];
  });
}
const tituloDelMes = (mes) => `Reporte de ${mesLargo(mes + "-01").split(" ")[0]}`;

export async function tarjetaReportes(negocioId, recargar) {
  const [reportes, servicios] = await Promise.all([api().reportes(negocioId), api().servicios(negocioId)]);
  const activos = new Set(servicios.filter((s) => s.estado === "activo" && TIPOS_REPORTE[s.tipo]).map((s) => s.tipo));
  const urls = await api().urls(reportes.flatMap((r) => (r.adjuntos || []).map((a) => a.ruta)));
  const zonaForm = el("div");
  const avisoListo = ctx.estado.avisoReportes ? el("div", { class: "aviso ok" }, ctx.estado.avisoReportes) : null;
  ctx.estado.avisoReportes = null;

  const formReporte = () => {
    const meses = mesesRecientes();
    const mes = seleccion(meses, meses[1][0]); // por defecto, el mes pasado
    const titulo = entrada("text", tituloDelMes(mes.value), { maxlength: "160" });
    let tituloEditado = false;
    titulo.addEventListener("input", () => { tituloEditado = true; });
    mes.addEventListener("change", () => { if (!tituloEditado) titulo.value = tituloDelMes(mes.value); });
    const pdf = el("input", { type: "file", accept: "application/pdf,.pdf" });
    // Al elegir el PDF se dibuja su portada: es la miniatura que verá el cliente junto al reporte
    const previa = el("div", { class: "previa-reporte" });
    let miniatura = null, preparando = null, turno = 0;
    pdf.addEventListener("change", () => {
      const archivoPdf = pdf.files[0], mio = ++turno;
      miniatura = null;
      if (!archivoPdf || tipoDe(archivoPdf) !== "application/pdf") { preparando = null; previa.replaceChildren(); return; }
      previa.replaceChildren(el("small", { class: "nota-campo" }, "Preparando la vista previa…"));
      preparando = miniaturaPdf(archivoPdf).then((imagen) => {
        if (mio !== turno) return;
        miniatura = imagen;
        previa.replaceChildren(el("div", { class: "reporte-vista" }, el("img", { src: URL.createObjectURL(imagen), alt: "Portada del reporte" })),
          el("small", { class: "nota-campo" }, "Así verá el cliente la miniatura del reporte."));
      }).catch((e) => {
        console.error(e);
        if (mio === turno) previa.replaceChildren(el("small", { class: "nota-campo" }, "No se pudo crear la vista previa. El reporte se publica igual, sin miniatura."));
      });
    });
    // Los cuatro tipos siempre a la vista; vienen marcados los que el cliente tiene activos
    const tipos = Object.entries(TIPOS_REPORTE).map(([tipo, nombre]) => ({ tipo, nombre, caja: el("input", { type: "checkbox", checked: activos.has(tipo) }) }));
    const avisar = el("input", { type: "checkbox", checked: true });
    const avisos = el("div");
    const boton = el("button", { class: "boton primario", type: "submit" }, "Publicar reporte");
    return el("form", { class: "nuevo-proyecto", novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      const archivoPdf = pdf.files[0];
      const elegidos = tipos.filter((t) => t.caja.checked).map((t) => t.tipo);
      if (!titulo.value.trim()) return mensaje(avisos, "Escribe el título del reporte.");
      if (!archivoPdf || tipoDe(archivoPdf) !== "application/pdf") return mensaje(avisos, "Elige el PDF del reporte.");
      if (archivoPdf.size > MAX_ARCHIVO) return mensaje(avisos, "El PDF puede pesar hasta 20 MB.");
      if (!elegidos.length) return mensaje(avisos, "Marca qué servicios cubre el reporte.");
      if (!elegidos.some((t) => activos.has(t))) return mensaje(avisos, "Marca al menos un servicio que el cliente tenga activo.");
      if (reportes.some((r) => r.periodo.startsWith(mes.value)) && !confirm(`Ya hay un reporte de ${mesLargo(mes.value + "-01")}. ¿Publicar otro del mismo mes?`)) return;
      await conBoton(boton, async () => {
        try {
          if (preparando) { boton.textContent = "Preparando vista previa…"; await preparando; }
          boton.textContent = "Subiendo…";
          const id = await api().publicarReporte({ negocio_id: negocioId, tipos: elegidos, periodo: mes.value + "-01", titulo: titulo.value.trim(), archivo: archivoPdf, miniatura });
          let correo = "";
          if (avisar.checked) {
            try {
              const r = await api().avisarReporte(id);
              correo = r.enviados ? ` Le avisamos por correo a ${r.enviados} ${r.enviados === 1 ? "persona" : "personas"}.` : " Nadie del cliente tiene la cuenta activa todavía, así que no se envió correo.";
            } catch (e) { correo = " No se pudo enviar el correo: " + e.message; }
          }
          ctx.estado.avisoReportes = "Reporte publicado." + correo;
          await recargar();
        } catch (e) { console.error(e); mensaje(avisos, textoError(e, "No se pudo publicar el reporte. Revisa tu conexión e inténtalo de nuevo.")); }
        finally { boton.textContent = "Publicar reporte"; }
      });
    } },
      el("div", { class: "form-grid" }, campo("Mes del reporte *", mes), campo("Título *", titulo)),
      el("div", { class: "campo" }, el("label", {}, "PDF del reporte *"), pdf, previa),
      el("div", { class: "campo" }, el("label", {}, "Servicios que cubre *"),
        el("div", { class: "servicios-reporte" }, tipos.map((t) =>
          el("label", { class: "casilla" }, t.caja, el("span", {}, t.nombre, el("small", {}, activos.has(t.tipo) ? "Activo" : "No lo tiene activo")))))),
      el("label", { class: "casilla" }, avisar, "Avisarle al cliente por correo"),
      el("div", { class: "acciones" }, boton, botonSimple("Cancelar", () => zonaForm.replaceChildren())), avisos);
  };

  const items = reportes.map((r) => {
    const pdfR = (r.adjuntos || []).find((a) => a.tipo_mime === "application/pdf");
    const vistaR = (r.adjuntos || []).find((a) => a.tipo_mime?.startsWith("image/") && urls[a.ruta]);
    return el("div", { class: "item-proyecto" },
      el("div", { class: "item-reporte" },
        el("span", { class: "reporte-vista" }, vistaR ? el("img", { src: urls[vistaR.ruta], alt: "", loading: "lazy" }) : el("span", { class: "sin-vista" }, "PDF")),
        el("div", {}, el("b", {}, r.titulo), el("br"),
          el("span", { class: "dato" }, [mesLargo(r.periodo), (r.tipos || []).map((t) => TIPOS_REPORTE[t] || t).join(" + "),
            r.avisado_en ? `📧 avisado a ${r.avisados}` : null].filter(Boolean).join(" · ")))),
      el("div", { class: "fila" },
        pdfR && urls[pdfR.ruta] ? el("a", { class: "boton", href: urls[pdfR.ruta], target: "_blank", rel: "noopener" }, "Ver PDF") : null,
        // Reportes sin miniatura (si no se pudo crear al publicarlo): se arma desde el PDF ya subido
        !vistaR && pdfR && urls[pdfR.ruta] ? botonSimple("Crear vista previa", async (ev) => {
          await conBoton(ev.currentTarget, async () => {
            try {
              const respuesta = await fetch(urls[pdfR.ruta]);
              if (!respuesta.ok) throw new Error("No se pudo descargar el PDF");
              await api().agregarMiniatura(negocioId, r.id, await miniaturaPdf(await respuesta.blob()));
              await recargar();
            } catch (e) { console.error(e); alert("No se pudo crear la vista previa del reporte."); }
          });
        }) : null,
        !r.avisado_en ? botonSimple("Avisar por correo", async (ev) => {
          await conBoton(ev.currentTarget, async () => {
            try {
              const x = await api().avisarReporte(r.id);
              ctx.estado.avisoReportes = x.enviados ? `Le avisamos por correo a ${x.enviados} ${x.enviados === 1 ? "persona" : "personas"}.` : "Nadie del cliente tiene la cuenta activa todavía.";
              await recargar();
            } catch (e) { alert("No se pudo enviar el correo: " + e.message); }
          });
        }) : null,
        botonSimple("Borrar", async (ev) => {
          if (!confirm(`¿Borrar "${r.titulo}" de ${mesLargo(r.periodo)} y su PDF? El cliente deja de verlo.`)) return;
          await conBoton(ev.currentTarget, async () => { try { await api().borrarReporte(r); await recargar(); } catch (e) { console.error(e); alert("No se pudo borrar el reporte."); } });
        })));
  });

  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, `Reportes mensuales (${reportes.length})`),
      activos.size ? botonSimple("Publicar reporte", () => { zonaForm.replaceChildren(formReporte()); zonaForm.querySelector("select")?.focus(); }) : null),
    el("div", { class: "tarjeta-cuerpo" }, avisoListo, zonaForm,
      !activos.size ? el("p", { class: "vacio-chico" }, reportes.length
        ? "El cliente ya no tiene un servicio mensual activo: conserva sus reportes, pero no se pueden publicar nuevos."
        : "Para publicar reportes, el cliente necesita activo mantenimiento web, SEO, redes o tarjetas de fidelidad (en Mensualidades).") : null,
      items.length ? items : activos.size ? el("p", { class: "vacio-chico" }, "Todavía no hay reportes. Cada mes, publica aquí el PDF del reporte.") : null));
}

// ---------- Renovaciones próximas (en Clientes) ----------
export async function avisoRenovaciones(negocios) {
  const lista = await api().renovaciones();
  if (!lista.length) return null;
  const nombres = Object.fromEntries(negocios.map((n) => [n.id, n.nombre]));
  return el("div", { class: "tarjeta" },
    el("div", { class: "tarjeta-cab" }, el("span", { class: "etq" }, "Renovaciones en los próximos 30 días"), el("span", { class: "dato" }, "Dominios, hosting y cuentas")),
    el("div", { class: "tarjeta-cuerpo" }, lista.map((a) => el("div", { class: "item-proyecto" },
      el("div", {}, el("b", {}, a.servicio), el("br"), el("span", { class: "dato" }, [nombres[a.negocio_id], a.proveedor].filter(Boolean).join(" · "))),
      el("div", { class: "fila" }, selloVence(a.vence),
        el("button", { class: "boton", type: "button", onclick: async () => { ctx.estado.negocioAdmin = a.negocio_id; await ctx.irA("cliente"); } }, "Gestionar"))))));
}
