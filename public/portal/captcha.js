// Portal AW-RiseCR · captcha de Cloudflare Turnstile para la entrada, la recuperación y el cambio de contraseña.
// Supabase verifica el token en su servidor (Authentication → Bot and Abuse Protection), así que un robot no puede
// probar contraseñas aunque llame a la API directo. Casi siempre es invisible: solo pide un clic si duda.
// Sin llave configurada no se carga nada y el portal funciona igual.
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let llave = "";
let cargando = null;

export function configurarCaptcha(llavePublica) { llave = llavePublica || ""; }
export const captchaActivo = () => Boolean(llave);

function cargar() {
  if (!cargando) {
    cargando = new Promise((listo, fallo) => {
      const s = document.createElement("script");
      s.src = SCRIPT; s.async = true;
      s.onload = () => (window.turnstile ? listo(window.turnstile) : fallo(new Error("captcha")));
      s.onerror = () => { cargando = null; s.remove(); fallo(new Error("captcha")); };
      document.head.append(s);
    });
  }
  return cargando;
}

// Pone el captcha dentro de `contenedor`. token() espera a que esté listo; cada token sirve una sola vez, así que
// después de usarlo se llama a reiniciar().
export function crearCaptcha(contenedor) {
  if (!captchaActivo()) return { token: async () => undefined, reiniciar() {} };
  let id = null, actual = null, esperando = [];
  const avisar = (t) => { actual = t; esperando.splice(0).forEach((f) => f(t)); };
  // Espera a que el contenedor esté en la página (las vistas se arman antes de mostrarse); se rinde a los 5 s
  const enPagina = () => new Promise((ok) => {
    const inicio = Date.now();
    const mirar = () => (contenedor.isConnected || Date.now() - inicio > 5000 ? ok() : requestAnimationFrame(mirar));
    mirar();
  });
  const listo = cargar().then(async (ts) => {
    await enPagina();
    id = ts.render(contenedor, {
      sitekey: llave, language: "es", appearance: "interaction-only", theme: "light", size: "flexible",
      callback: avisar, "expired-callback": () => { actual = null; }, "error-callback": () => { actual = null; },
      // Solo ocupa espacio cuando pide el clic
      "before-interactive-callback": () => contenedor.classList.add("visible"),
      "after-interactive-callback": () => contenedor.classList.remove("visible"),
    });
  });
  return {
    async token() {
      await listo;
      if (actual) return actual;
      return new Promise((ok, mal) => {
        const espera = setTimeout(() => mal(Object.assign(new Error("captcha"), { code: "captcha" })), 30000);
        esperando.push((t) => { clearTimeout(espera); ok(t); });
      });
    },
    reiniciar() { actual = null; if (id !== null) window.turnstile.reset(id); },
  };
}
