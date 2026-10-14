// Portal AW-RiseCR · fondo de la pantalla de entrada: estrellas y una malla de conexiones (plexus) que cubre el cielo,
// con una onda de luz que sale desde el logo. El planeta y su brillo están en portal.css.
// La malla es un SVG quieto de dos trazos (líneas y puntos) que se pinta una sola vez; la onda la dibuja onda.js en un
// lienzo encima, por anillos según la distancia al logo.
// Posiciones y retrasos van por CSSOM, porque la política de seguridad bloquea los estilos escritos en el HTML.
import { azarConSemilla } from "/portal/util.js";
import { ondaMalla } from "/portal/onda.js";

const NS = "http://www.w3.org/2000/svg";
const ANILLOS = 16, ONDA = 2.2; // segundos que tarda la luz en llegar al borde

function estrellas(caja) {
  const azar = azarConSemilla(3);
  for (let n = 0; n < 70; n++) {
    const i = document.createElement("i");
    i.style.left = `${(1 + azar() * 98).toFixed(1)}%`;
    i.style.top = `${(1 + azar() * 71).toFixed(1)}%`;
    i.style.setProperty("--t", `${[1.5, 2, 2, 2.5, 3][Math.floor(azar() * 5)]}px`);
    i.style.animationDelay = `${(-azar() * 3).toFixed(1)}s`;
    caja.append(i);
  }
}

// La malla se dibuja con la proporción de la pantalla: en el celular salen menos puntos (unas 300 líneas; ~1.000 en computadora)
function malla() {
  const alto = 900, ancho = Math.round(alto * Math.min(Math.max(innerWidth / Math.max(innerHeight, 1), .4), 2.4));
  const cx = ancho / 2, cy = 230, pasoX = 78, pasoY = 60, enlace = 105;
  const azar = azarConSemilla(5), entre = (a, b) => a + azar() * (b - a);
  const puntos = [];
  for (let fila = 0, gy = -pasoY; gy < alto + pasoY; gy += pasoY, fila++) {
    for (let gx = -pasoX; gx < ancho + pasoX; gx += pasoX) {
      const x = gx + entre(-pasoX * .3, pasoX * .3) + (fila % 2 ? pasoX / 2 : 0), y = gy + entre(-pasoY * .28, pasoY * .28);
      if (Math.abs(x - cx) < 150 && Math.abs(y - cy) < 130) continue; // libre detrás del logo
      puntos.push([x, y]);
    }
  }
  const lejos = Math.hypot(Math.max(cx, ancho - cx), Math.max(cy, alto - cy));
  const anillo = (x, y) => Math.min(ANILLOS - 1, Math.floor(Math.hypot(x - cx, y - cy) / lejos * ANILLOS));
  const lineas = [];
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const [x1, y1] = puntos[i], [x2, y2] = puntos[j];
      if (Math.hypot(x1 - x2, y1 - y2) < enlace) lineas.push([...[x1, y1, x2, y2].map(Math.round), anillo((x1 + x2) / 2, (y1 + y2) / 2)]);
    }
  }
  const nudos = puntos.map(([x, y]) => [Math.round(x), Math.round(y), anillo(x, y)]);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "acceso-red");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  const trazo = (clase, d) => { const p = document.createElementNS(NS, "path"); p.setAttribute("class", clase); p.setAttribute("d", d); return p; };
  svg.append(trazo("malla", lineas.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join("")),
    trazo("punto", nudos.map(([x, y]) => `M${x - 1.6} ${y}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0`).join("")));

  const lienzo = document.createElement("canvas");
  lienzo.className = "acceso-onda";
  lienzo.setAttribute("aria-hidden", "true");
  return { svg, lienzo, lineas, nudos, caja: [0, 0, ancho, alto] };
}

// Se arma una sola vez, la primera vez que se muestra la pantalla de entrada; la onda arranca cada vez que se muestra
// y se detiene sola cuando la pantalla se oculta.
let onda = null;
export function armarFondoAcceso(fondo) {
  if (!fondo) return;
  if (!onda) {
    estrellas(fondo.querySelector(".acceso-estrellas"));
    const { svg, lienzo, lineas, nudos, caja } = malla();
    fondo.querySelector(".acceso-planeta").before(svg, lienzo);
    onda = ondaMalla(lienzo, {
      lineas, nudos, caja, anillos: ANILLOS, retraso: (k) => k / ANILLOS * ONDA, periodo: 4, grosor: 1, radio: 1.6,
      linea: [76, 194, 255, .13], lineaLuz: [150, 220, 255, .75], nudo: [191, 234, 255, .4], nudoLuz: [255, 255, 255, 1],
      // el mismo desvanecido del SVG: visible arriba y se apaga entre el 30 % y el 75 % del alto
      mascara(ctx, ancho, alto, escala) {
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        const g = ctx.createLinearGradient(0, alto * .3, 0, alto * .75);
        g.addColorStop(0, "#000"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.fillRect(0, 0, ancho, alto);
      },
      seguir: () => lienzo.isConnected && !fondo.closest("[hidden]"),
    });
  }
  onda.iniciar();
}
