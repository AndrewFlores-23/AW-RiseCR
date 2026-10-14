// Portal AW-RiseCR · onda de luz que recorre una malla de conexiones (plexus) desde el logo hacia afuera.
// La malla quieta es un SVG que el navegador pinta una sola vez. La onda va en un lienzo encima: en cada cuadro solo se
// dibujan las líneas de los anillos encendidos, a 24 cuadros por segundo (la onda solo cambia de brillo, no se mueve de
// lugar, y se ve igual de suave) y con 2x de resolución como máximo.
// Antes la onda cambiaba el color de las líneas del SVG y el navegador repintaba la malla entera en cada cuadro: en el
// iPhone eso gastaba más de medio núcleo del procesador mientras la pantalla estaba abierta.
const CUADRO = 1000 / 24;
const suave = (x) => x * x * (3 - 2 * x); // como ease-in-out
const mezcla = (a, b, f) => a + (b - a) * f;

// Color que, puesto encima de la línea quieta (base), la deja con el color de la onda (base → luz según f)
function encima(base, luz, f) {
  const alfa = mezcla(base[3], luz[3], f);
  const arriba = 1 - (1 - alfa) / (1 - base[3]);
  const rgb = [0, 1, 2].map((i) => Math.round(Math.min(255, Math.max(0, (mezcla(base[i], luz[i], f) * alfa - base[i] * base[3] * (1 - arriba)) / arriba))));
  return `rgba(${rgb},${arriba.toFixed(3)})`;
}

// Intensidad de un anillo en su ciclo (0 a 1): sube hasta el 15 %, baja hasta el 40 % y se queda quieto hasta volver a empezar
const intensidad = (p) => p < .15 ? suave(p / .15) : p < .4 ? 1 - suave((p - .15) / .25) : 0;

// o: { lineas: [[x1, y1, x2, y2, anillo]], nudos: [[x, y, anillo]], anillos, retraso: (anillo) => segundos, periodo (s),
//      caja: [x, y, ancho, alto] (el viewBox del SVG, que llena el lienzo recortando lo que sobra), grosor, radio,
//      linea / lineaLuz / nudo / nudoLuz: [r, g, b, a], mascara: (ctx, ancho, alto, escala) => borra lo que el SVG desvanece,
//      seguir: () => false cuando la malla ya no se ve (la animación se detiene) }
export function ondaMalla(lienzo, o) {
  const trazos = Array.from({ length: o.anillos }, () => new Path2D());
  const puntos = Array.from({ length: o.anillos }, () => new Path2D());
  for (const [x1, y1, x2, y2, k] of o.lineas) { trazos[k].moveTo(x1, y1); trazos[k].lineTo(x2, y2); }
  for (const [x, y, k] of o.nudos) { puntos[k].moveTo(x + o.radio, y); puntos[k].arc(x, y, o.radio, 0, Math.PI * 2); }
  const ctx = lienzo.getContext("2d");
  const [x0, y0, cajaAncho, cajaAlto] = o.caja;
  let ancho = 0, alto = 0, escala = 1, inicio = 0, corriendo = false, limpio = true;

  function medir() {
    ancho = lienzo.clientWidth; alto = lienzo.clientHeight; escala = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = Math.round(ancho * escala); lienzo.height = Math.round(alto * escala);
    limpio = true; // cambiar el tamaño deja el lienzo en blanco
  }

  function cuadro(ahora) {
    if (!o.seguir()) { corriendo = false; removeEventListener("resize", medir); return; }
    dibujar(ahora);
    // El siguiente cuadro se pide justo cuando toca: así el navegador no despierta en cada refresco de la pantalla
    setTimeout(() => requestAnimationFrame(cuadro), Math.max(0, CUADRO - (performance.now() - ahora) - 4));
  }

  function dibujar(ahora) {
    const t = (ahora - inicio) / 1000;
    const s = Math.max(ancho / cajaAncho, alto / cajaAlto);
    let dibujo = false;
    for (let k = 0; k < o.anillos; k++) {
      const local = t - o.retraso(k);
      if (local < 0) continue;
      const f = intensidad(local % o.periodo / o.periodo);
      if (f < .02) continue;
      if (!dibujo) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        ctx.setTransform(escala * s, 0, 0, escala * s, escala * ((ancho - cajaAncho * s) / 2 - x0 * s), escala * ((alto - cajaAlto * s) / 2 - y0 * s));
        ctx.lineWidth = o.grosor;
        dibujo = true;
      }
      ctx.strokeStyle = encima(o.linea, o.lineaLuz, f);
      ctx.stroke(trazos[k]);
      ctx.fillStyle = encima(o.nudo, o.nudoLuz, f);
      ctx.fill(puntos[k]);
    }
    if (!dibujo) {
      if (!limpio) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, lienzo.width, lienzo.height); limpio = true; }
      return;
    }
    limpio = false;
    ctx.globalCompositeOperation = "destination-in";
    o.mascara(ctx, ancho, alto, escala);
    ctx.globalCompositeOperation = "source-over";
  }

  return {
    // Arranca la onda desde el centro. Si ya corre, no hace nada; con "reducir movimiento" la malla se queda quieta.
    iniciar() {
      if (corriendo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      corriendo = true;
      medir();
      addEventListener("resize", medir);
      inicio = performance.now();
      requestAnimationFrame(cuadro);
    },
  };
}
