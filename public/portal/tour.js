// Portal AW-RiseCR · recorrido de bienvenida
// Oscurece la pantalla e ilumina una parte a la vez (un foco), con una tarjeta que explica qué hay ahí.
// Se mueve con Siguiente / Atrás, las flechas del teclado o Esc para saltarlo. Funciona en la computadora y en el dock del celular.
import { el, icono, azarConSemilla } from "/portal/util.js";

let abierto = null; // evita abrir dos recorridos a la vez

// Malla de conexiones (plexus) detrás del logo de la portada: puntos en una rejilla con un leve temblor, unidos con sus
// vecinos; una onda de luz la recorre desde el logo hacia los lados. Retrasos con CSSOM (la política de seguridad
// bloquea estilos escritos en el HTML).
const NS = "http://www.w3.org/2000/svg";
const svg = (etiqueta, atributos = {}) => {
  const n = document.createElementNS(NS, etiqueta);
  for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
  return n;
};
function redPortada() {
  const azar = azarConSemilla(8), entre = (a, b) => a + azar() * (b - a);
  const libre = (x, y) => Math.abs(x) < 50 && Math.abs(y) < 42; // sin puntos detrás del logo
  const puntos = [];
  for (let fila = 0, gy = -90; gy < 70; gy += 28, fila++) {
    for (let gx = -220; gx < 240; gx += 36) {
      const x = gx + entre(-11, 11) + (fila % 2 ? 18 : 0), y = gy + entre(-8, 8);
      if (!libre(x, y)) puntos.push([x, y]);
    }
  }
  const retraso = (x, y) => `${(Math.hypot(x, y) / 220 * 1.6).toFixed(2)}s`; // la onda sale del logo
  const red = svg("svg", { class: "portada-red", viewBox: "-210 -90 420 180", "aria-hidden": "true" });
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const [x1, y1] = puntos[i], [x2, y2] = puntos[j];
      if (Math.hypot(x1 - x2, y1 - y2) >= 46) continue;
      const l = svg("line", { x1: x1.toFixed(0), y1: y1.toFixed(0), x2: x2.toFixed(0), y2: y2.toFixed(0), class: "malla" });
      l.style.animationDelay = retraso((x1 + x2) / 2, (y1 + y2) / 2);
      red.append(l);
    }
  }
  for (const [x, y] of puntos) {
    const c = svg("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: 1.5, class: "punto" });
    c.style.animationDelay = retraso(x, y);
    red.append(c);
  }
  return red;
}

// Piezas para la entrada de la portada: 8 columnas, 3 filas en el espacio (cada una con su pedazo del cielo) y 6 en el cuerpo.
// Caen en cascada, fila por fila, con una leve diagonal (los estilos están en portal.css).
function piezasPortada() {
  const columnas = 8, filasCielo = 3, filas = filasCielo + 6;
  const armado = el("div", { class: "tour-armado", "aria-hidden": "true" });
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const pieza = el("i", { class: f < filasCielo ? "espacio" : null });
      pieza.style.animationDelay = `${(f / (filas - 1) * .26 + c / (columnas - 1) * .04).toFixed(3)}s`;
      if (f < filasCielo) pieza.style.backgroundPosition = `${(c / (columnas - 1) * 100).toFixed(2)}% ${f / (filasCielo - 1) * 100}%`;
      armado.append(pieza);
    }
  }
  return armado;
}

// pasos: [{ titulo, texto, objetivo }] · objetivo: selector CSS (se usa el primero que esté visible) o nada (tarjeta al centro)
// Un paso con { portada: true, etiqueta, destacados: [[icono, texto]], pie } se muestra como tarjeta de bienvenida:
// el espacio con estrellas, el logo flotando y el horizonte del planeta (como los correos).
export function abrirTour(pasos, { alTerminar } = {}) {
  if (abierto) return;
  let i = 0;
  const anterior = document.activeElement;
  const bloqueo = el("div", { class: "tour-bloqueo" });
  const foco = el("div", { class: "tour-foco", "aria-hidden": "true" });
  const contador = el("span", { class: "tour-paso" });
  const titulo = el("h2", { id: "tour-titulo" });
  const texto = el("p", { id: "tour-texto" });
  const puntos = el("div", { class: "tour-puntos", "aria-hidden": "true" }, pasos.map(() => el("i")));
  // Portada de bienvenida: el espacio, el logo y el horizonte
  const cielo = el("div", { class: "portada-cielo", "aria-hidden": "true" },
    el("div", { class: "portada-estrellas" }, Array.from({ length: 14 }, () => el("i"))),
    el("div", { class: "portada-centro" }, redPortada(), el("div", { class: "astro" }, el("div", { class: "logo" }), el("div", { class: "brillo" }))),
    el("div", { class: "portada-horizonte" }));
  const etiqueta = el("span", { class: "portada-etiqueta" });
  const destacados = el("ul", { class: "portada-lista" });
  const pie = el("p", { class: "portada-pie" });
  const atras = el("button", { class: "boton", type: "button", onclick: () => ir(i - 1) }, "Atrás");
  const siguiente = el("button", { class: "boton primario", type: "button", onclick: () => ir(i + 1) });
  const saltar = el("button", { class: "enlace", type: "button", onclick: () => cerrar(false) }, "Saltar recorrido");
  const cabeza = el("div", { class: "fila entre tour-cabeza" }, contador, puntos);
  const tarjeta = el("div", { class: "tour-tarjeta", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-titulo", "aria-describedby": "tour-texto" },
    cielo,
    el("div", { class: "tour-cuerpo" }, cabeza, etiqueta, titulo, texto, destacados, pie,
      el("div", { class: "tour-acciones" }, saltar, el("div", { class: "fila" }, atras, siguiente))));
  document.body.append(bloqueo, foco, tarjeta);
  abierto = { cerrar };

  // Entrada de la portada por piezas (solo la primera vez). Las piezas se quitan cuando el fondo real ya se encendió;
  // si se pasa al siguiente paso antes, se quitan de una vez.
  let armado = null;
  const fondoListo = (ev) => { if (ev.target === tarjeta && ev.animationName === "armar-fondo") { armado?.remove(); armado = null; } };
  function desarmar() {
    armado?.remove(); armado = null;
    tarjeta.classList.remove("armando");
    tarjeta.removeEventListener("animationend", fondoListo);
  }
  if (pasos[0]?.portada && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    armado = piezasPortada();
    tarjeta.prepend(armado);
    tarjeta.classList.add("armando");
    tarjeta.addEventListener("animationend", fondoListo);
  }

  const visible = (nodo) => nodo && nodo.offsetParent !== null && nodo.getClientRects().length > 0;
  const objetivo = () => {
    const selector = pasos[i].objetivo;
    return selector ? [...document.querySelectorAll(selector)].find(visible) || null : null;
  };

  function colocar() {
    const vw = innerWidth, vh = innerHeight, margen = 16, separacion = 14, relleno = 6;
    const ancho = tarjeta.offsetWidth, alto = tarjeta.offsetHeight;
    const t = objetivo();
    const limitar = (v, min, max) => Math.max(min, Math.min(v, max));
    if (!t) {
      foco.hidden = true;
      bloqueo.classList.add("oscuro");
      tarjeta.style.left = `${(vw - ancho) / 2}px`;
      tarjeta.style.top = `${limitar((vh - alto) / 2, margen, vh - alto - margen)}px`;
      return;
    }
    t.scrollIntoView({ block: "center", inline: "center" }); // al centro: en el celular no queda tapado por el dock
    const r = t.getBoundingClientRect();
    foco.hidden = false;
    bloqueo.classList.remove("oscuro");
    Object.assign(foco.style, { left: `${r.left - relleno}px`, top: `${r.top - relleno}px`, width: `${r.width + relleno * 2}px`, height: `${r.height + relleno * 2}px` });
    let left, top;
    if (r.right + separacion + ancho + margen <= vw) {          // a la derecha (menú de la computadora)
      left = r.right + separacion + relleno;
      top = limitar(r.top + r.height / 2 - alto / 2, margen, vh - alto - margen);
    } else if (r.top - separacion - alto >= margen) {            // arriba (dock del celular)
      top = r.top - separacion - alto - relleno;
      left = limitar(r.left + r.width / 2 - ancho / 2, margen, vw - ancho - margen);
    } else if (r.bottom + separacion + alto + margen <= vh) {    // abajo
      top = r.bottom + separacion + relleno;
      left = limitar(r.left + r.width / 2 - ancho / 2, margen, vw - ancho - margen);
    } else {                                                      // no cabe al lado: al centro
      left = (vw - ancho) / 2;
      top = limitar((vh - alto) / 2, margen, vh - alto - margen);
    }
    tarjeta.style.left = `${left}px`;
    tarjeta.style.top = `${top}px`;
  }

  function ir(n) {
    if (n >= pasos.length) return cerrar(true);
    if (n < 0) return;
    i = n;
    const paso = pasos[i];
    const portada = Boolean(paso.portada);
    tarjeta.classList.toggle("portada", portada);
    if (!portada) desarmar();
    cielo.hidden = !portada;
    cabeza.hidden = portada;
    etiqueta.hidden = destacados.hidden = pie.hidden = !portada;
    if (portada) {
      etiqueta.textContent = paso.etiqueta || "";
      destacados.replaceChildren(...(paso.destacados || []).map(([nombre, linea]) => el("li", {}, el("span", { class: "portada-icono" }, icono(nombre)), el("span", {}, linea))));
      pie.textContent = paso.pie || "";
    }
    contador.textContent = `${i + 1} de ${pasos.length}`;
    titulo.textContent = paso.titulo;
    texto.textContent = paso.texto;
    [...puntos.children].forEach((p, k) => p.classList.toggle("activo", k === i));
    atras.hidden = i === 0;
    siguiente.textContent = portada ? "Empezar recorrido" : i === pasos.length - 1 ? "Listo" : "Siguiente";
    saltar.hidden = i === pasos.length - 1;
    colocar();
    siguiente.focus({ preventScroll: true });
  }

  function teclas(ev) {
    if (ev.key === "Escape") { ev.preventDefault(); cerrar(false); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); ir(i + 1); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); ir(i - 1); }
    else if (ev.key === "Tab") { // el foco del teclado se queda dentro de la tarjeta
      const botones = [...tarjeta.querySelectorAll("button")].filter((b) => !b.hidden);
      const primero = botones[0], ultimo = botones[botones.length - 1];
      if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
    }
  }
  const recolocar = () => colocar();

  function cerrar(completo) {
    document.removeEventListener("keydown", teclas, true);
    removeEventListener("resize", recolocar);
    removeEventListener("scroll", recolocar, true);
    bloqueo.remove(); foco.remove(); tarjeta.remove();
    abierto = null;
    anterior?.focus?.({ preventScroll: true });
    alTerminar?.(completo);
  }

  document.addEventListener("keydown", teclas, true);
  addEventListener("resize", recolocar);
  addEventListener("scroll", recolocar, true);
  ir(0);
}
