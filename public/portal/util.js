// Portal AW-RiseCR · utilidades compartidas (DOM seguro, íconos, formatos y catálogos)
export const $ = (sel, raiz = document) => raiz.querySelector(sel);

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v == null || v === false) continue;
    if (k === "class") nodo.className = v;
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat(Infinity)) {
    if (h == null || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return nodo;
}

export function icono(nombre) {
  const trazos = {
    inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    bitacora: "M6 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 15.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 8.5v7M10 6h10M10 18h10M10 12h7",
    pagos: "M3 5h18v14H3zM3 10h18M7 15h4",
    fondo: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
    accesos: "M4 10h16v11H4zM8 10V7a4 4 0 0 1 8 0v3",
    documentos: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6",
    panel: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
    clientes: "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M21.5 20a5 5 0 0 0-4-4.9",
    publicar: "M12 5v14M5 12h14",
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", trazos[nombre] || trazos.inicio);
  svg.append(p);
  return svg;
}

export const zona = "America/Costa_Rica";
export const fFecha = new Intl.DateTimeFormat("es-CR", { timeZone: zona, day: "2-digit", month: "short" });
export const fHora = new Intl.DateTimeFormat("es-CR", { timeZone: zona, hour: "numeric", minute: "2-digit", hour12: true });
export const fLarga = new Intl.DateTimeFormat("es-CR", { timeZone: zona, weekday: "long", day: "numeric", month: "long" });
export const sinPunto = (t) => t.replace(/\./g, "").replace(/-/g, " ");
export const fecha = (iso) => sinPunto(fFecha.format(new Date(iso)));
const fFechaAno = new Intl.DateTimeFormat("es-CR", { timeZone: zona, day: "2-digit", month: "short", year: "numeric" });
// Fecha AAAA-MM-DD; lleva el año solo si no es el actual (un crédito que vence en 12 meses no debe parecer de este año)
export const fechaCorta = (dia) => {
  if (!dia) return "—";
  const f = new Date(dia.slice(0, 10) + "T12:00:00");
  const otroAno = dia.slice(0, 4) !== String(new Date().getFullYear());
  return sinPunto((otroAno ? fFechaAno : fFecha).format(f)).replace(/ de /g, " ");
};
export const hora = (iso) => fHora.format(new Date(iso));
export const dinero = (n) => {
  const v = Number(n || 0);
  return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
export const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date()); // AAAA-MM-DD en Costa Rica
export const sumarDias = (dia, n) => { const d = new Date(dia + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dos = (n) => String(n).padStart(2, "0");
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // mes de 1 a 12
// Fecha del mes (ano, mes) con ese día; si el mes es más corto, cae en su último día (31 → 28 de febrero)
const diaDelMes = (ano, mes, dia) => `${ano}-${dos(mes)}-${dos(Math.min(dia, ultimoDia(ano, mes)))}`;
export const sumarMeses = (dia, n) => {
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return diaDelMes(Math.floor(total / 12), (total % 12) + 1, d);
};
// Próxima fecha de cobro de una mensualidad (igual que la base de datos):
// ligada a un proyecto empieza un mes después de la entrega; sin entrega todavía, no hay fecha (null).
export function proximaMensualidad(s) {
  let dia, desde;
  if (s.proyecto_id) {
    const entregado = s.proyectos?.entregado_en;
    if (!entregado) return null;
    dia = Number(entregado.slice(8, 10));
    desde = sumarMeses(entregado, 1);
  } else {
    if (!s.dia_cobro) return null;
    dia = s.dia_cobro;
    desde = s.inicio || hoy();
  }
  const base = desde > hoy() ? desde : hoy();
  let [ano, mes] = base.split("-").map(Number);
  for (let i = 0; i < 2; i++) {
    const v = diaDelMes(ano, mes, dia);
    if (v >= base) return v;
    if (++mes > 12) { mes = 1; ano++; }
  }
  return diaDelMes(ano, mes, dia);
}

export const ETAPAS = [["anticipo", "Anticipo"], ["diseno", "Diseño"], ["desarrollo", "Desarrollo"], ["revision", "Revisión"], ["publicada", "Publicada"]];
export const TIPOS = {
  inicio: ["Inicio del proyecto", "info"], avance: ["Avance", "info"], captura: ["Captura", "info"],
  entregable: ["Entregable", "cobrado"], aprobacion: ["Necesita tu aprobación", "por_vencer"], nota: ["Nota", "nota"],
};
export const ESTADO_COBRO = { cobrado: "Cobrado", por_vencer: "Por vencer", atrasado: "Atrasado", programado: "Programado", anulado: "Anulado" };
// Igual que la vista cobros_estado de la base de datos (se usa en el modo demo)
export function estadoCobro(c) {
  if (c.anulado) return "anulado";
  if (c.pagado_en) return "cobrado";
  if (c.vence < hoy()) return "atrasado";
  return c.vence <= sumarDias(hoy(), 7) ? "por_vencer" : "programado";
}
export const TIPO_SERVICIO = { web: "Web", mantenimiento: "Mantenimiento", seo: "SEO", redes: "Redes sociales", fidelizacion: "Fidelización", otro: "Otro" };
export const MOVIMIENTO = { bienvenida: "Bienvenida", referido: "Recomendación", uso: "Usado", vencimiento: "Vencido", ajuste: "Ajuste" };
export const METODOS = ["SINPE Móvil", "Transferencia", "Efectivo", "Tarjeta", "Otro"];


// Movimiento del Fondo AW (lo ven el cliente y el admin)
export function filaMovimiento(m) {
  return el("div", { class: "movimiento" },
    el("div", {}, el("b", {}, m.descripcion || MOVIMIENTO[m.tipo]),
      el("span", { class: "dato" }, `${MOVIMIENTO[m.tipo]} · ${fechaCorta(m.fecha)}${m.vence && m.monto > 0 ? " · vence " + fechaCorta(m.vence) : ""}`)),
    el("span", { class: "mov-monto " + (m.monto > 0 ? "entra" : "sale") }, (m.monto > 0 ? "+" : "") + dinero(m.monto)));
}
