// Animación de apertura: el logo de AW-RiseCR se reconstruye con cubitos.
// Se muestra una vez por sesión; se salta con un toque o una tecla; no se
// muestra con "reducir movimiento" ni a robots. Usa GSAP, cargado solo aquí.
(() => {
  const html = document.documentElement;
  if (!html.classList.contains("aw-intro")) return;

  const EN = (html.lang || "").startsWith("en");
  const GSAP_URL = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js";
  const LOGO_URL = "/aw-rise-logo-360.png";
  const MARCA = "AW-RiseCR";
  const FRASE = EN ? "Digital ideas that help you grow" : "Ideas digitales que hacen crecer";

  let terminado = false;
  const terminar = (overlay) => {
    if (terminado) return;
    terminado = true;
    try { sessionStorage.setItem("aw-intro", "1"); } catch (e) {}
    overlay?.remove();
    html.classList.remove("aw-intro", "aw-intro-activa");
  };

  // Pantalla de carga
  const overlay = document.createElement("div");
  overlay.id = "aw-intro";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <canvas></canvas>
    <div class="aw-intro-marca">
      <div class="aw-intro-logo-caja">
        <img class="aw-intro-logo" src="${LOGO_URL}" alt="" width="360" height="360" decoding="async" />
        <span class="aw-intro-scan"></span>
      </div>
      <p class="aw-intro-nombre">${[...MARCA].map((l) => `<span>${l}</span>`).join("")}</p>
      <p class="aw-intro-frase">${FRASE}</p>
    </div>
    <p class="aw-intro-saltar">${EN ? "Tap to skip" : "Toca para saltar"}</p>`;
  document.body.appendChild(overlay);
  html.classList.add("aw-intro-activa");

  // Si algo falla o tarda demasiado, la web se muestra igual
  const seguro = setTimeout(() => terminar(overlay), 7000);

  const cargarScript = (src) =>
    new Promise((ok, mal) => {
      if (window.gsap) return ok();
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = mal;
      document.head.appendChild(s);
    });

  const cargarImagen = (img) =>
    new Promise((ok, mal) => {
      if (img.complete && img.naturalWidth) return ok();
      img.onload = ok;
      img.onerror = mal;
    });

  const logo = overlay.querySelector(".aw-intro-logo");

  Promise.all([cargarScript(GSAP_URL), cargarImagen(logo)])
    .then(() => animar())
    .catch(() => terminar(overlay));

  function animar() {
    const gsap = window.gsap;
    const canvas = overlay.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    // Lee los píxeles del logo en una grilla: cada celda con color es un cubito
    const caja = logo.getBoundingClientRect();
    const N = W < 600 ? 44 : 58;
    const muestra = document.createElement("canvas");
    muestra.width = muestra.height = N;
    const mctx = muestra.getContext("2d", { willReadFrequently: true });
    mctx.drawImage(logo, 0, 0, N, N);
    const datos = mctx.getImageData(0, 0, N, N).data;
    const celda = caja.width / N;

    const cubos = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        if (datos[i + 3] < 110) continue;
        const tx = caja.left + (x + 0.5) * celda;
        const ty = caja.top + (y + 0.5) * celda;
        const angulo = Math.random() * Math.PI * 2;
        const lejos = (0.45 + Math.random() * 0.75) * Math.max(W, H) * 0.6;
        cubos.push({
          x: W / 2 + Math.cos(angulo) * lejos,
          y: H / 2 + Math.sin(angulo) * lejos,
          tx, ty,
          s: celda * (0.3 + Math.random() * 1.4),
          r: (Math.random() - 0.5) * Math.PI * 2,
          a: 0,
          c: `rgb(${Math.min(255, datos[i] + 25)},${Math.min(255, datos[i + 1] + 25)},${Math.min(255, datos[i + 2] + 15)})`,
        });
      }
    }
    const minX = caja.left;

    const dibujar = () => {
      ctx.clearRect(0, 0, W, H);
      for (const q of cubos) {
        if (q.a <= 0.01) continue;
        ctx.globalAlpha = q.a;
        ctx.fillStyle = q.c;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.r);
        ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(dibujar);

    const letras = overlay.querySelectorAll(".aw-intro-nombre span");
    const scan = overlay.querySelector(".aw-intro-scan");
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.ticker.remove(dibujar);
        clearTimeout(seguro);
        terminar(overlay);
      },
    });

    // 1. Aparecen dispersos
    tl.to(cubos, { a: 0.45, duration: 0.3, ease: "power1.out", stagger: { amount: 0.2, from: "random" } }, 0);

    // 2. Vuelan a su lugar, de izquierda a derecha como si se escribiera
    cubos.forEach((q) => {
      const orden = (q.tx - minX) / caja.width;
      tl.to(q, {
        x: q.tx, y: q.ty, r: 0, s: celda * 0.94, a: 1,
        duration: 0.95, ease: "expo.out",
      }, 0.15 + orden * 0.6 + Math.random() * 0.12);
    });

    // 3. Línea de escaneo y el logo nítido reemplaza a los cubitos
    tl.addLabel("escaneo", 1.55)
      .fromTo(scan, { top: "0%", opacity: 0 }, { top: "100%", opacity: 1, duration: 0.5, ease: "power2.inOut" }, "escaneo")
      .to(scan, { opacity: 0, duration: 0.15 }, "escaneo+=0.45")
      .fromTo(logo, { opacity: 0, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 0.5, ease: "power2.inOut" }, "escaneo")
      .to(cubos, { a: 0, duration: 0.35, ease: "power1.in", stagger: { amount: 0.25, from: "start" } }, "escaneo+=0.1")
      .fromTo(".aw-intro-logo-caja", { filter: "drop-shadow(0 0 0px rgba(72,168,255,0))" },
        { filter: "drop-shadow(0 0 28px rgba(72,168,255,.75))", duration: 0.35, yoyo: true, repeat: 1, ease: "sine.inOut" }, "escaneo+=0.45")

    // 4. El nombre letra por letra y la frase
      .fromTo(letras, { opacity: 0, y: 14, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out", stagger: 0.04 }, "escaneo+=0.35")
      .fromTo(".aw-intro-frase", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "escaneo+=0.7")

    // 5. La pantalla se abre hacia arriba y deja ver la web
      .addLabel("salida", "escaneo+=1.35")
      .to(".aw-intro-marca", { y: -24, opacity: 0, duration: 0.45, ease: "power2.in" }, "salida")
      .to(".aw-intro-saltar", { opacity: 0, duration: 0.2 }, "salida")
      .to(overlay, { clipPath: "inset(0 0 100% 0)", duration: 0.7, ease: "power4.inOut" }, "salida+=0.2");

    // Toda la secuencia al doble de velocidad: ~1,9 s en total
    tl.timeScale(2);

    // Saltar: va directo a la salida
    const saltar = () => {
      if (tl.time() < tl.labels.salida) tl.seek("salida");
    };
    overlay.addEventListener("pointerdown", saltar);
    window.addEventListener("keydown", saltar, { once: true });
  }
})();
