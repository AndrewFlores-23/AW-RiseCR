// Portal AW-RiseCR · fondo de la pantalla de entrada: estrellas y una malla de conexiones (plexus) que cubre el cielo,
// con una onda de luz que sale desde el logo. El planeta y su brillo están en portal.css.
// Las líneas se agrupan en anillos según su distancia al logo: se anima cada anillo (16 animaciones) y no cada línea.
// Posiciones y retrasos van por CSSOM, porque la política de seguridad bloquea los estilos escritos en el HTML.
import { azarConSemilla } from "/portal/util.js";

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
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "acceso-red");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  const grupos = (clase) => Array.from({ length: ANILLOS }, (_, k) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", clase);
    g.style.animationDelay = `${(k / ANILLOS * ONDA).toFixed(2)}s`;
    return g;
  });
  const lineas = grupos("malla"), nudos = grupos("punto");
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const [x1, y1] = puntos[i], [x2, y2] = puntos[j];
      if (Math.hypot(x1 - x2, y1 - y2) >= enlace) continue;
      const l = document.createElementNS(NS, "line");
      for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) l.setAttribute(k, v.toFixed(0));
      lineas[anillo((x1 + x2) / 2, (y1 + y2) / 2)].append(l);
    }
  }
  for (const [x, y] of puntos) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x.toFixed(0)); c.setAttribute("cy", y.toFixed(0)); c.setAttribute("r", "1.6");
    nudos[anillo(x, y)].append(c);
  }
  svg.append(...lineas, ...nudos);
  return svg;
}

// Se arma una sola vez, la primera vez que se muestra la pantalla de entrada
export function armarFondoAcceso(fondo) {
  if (!fondo || fondo.dataset.listo) return;
  fondo.dataset.listo = "1";
  estrellas(fondo.querySelector(".acceso-estrellas"));
  fondo.querySelector(".acceso-planeta").before(malla());
}
