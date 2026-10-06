// Portal AW-RiseCR · panel del administrador: expediente del cliente (accesos y documentos)
// Accesos sin contraseñas: esas viven en Bitwarden y se entregan con un Send que se destruye solo.
import { el, fecha, fechaCorta, hoy, sumarDias } from "/portal/util.js";
import { ctx, api, TIPOS_ARCHIVO, MAX_ARCHIVO, tipoDe, campo, entrada, seleccion, mensaje, conBoton, textoError } from "/portal/admin-base.js";

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
