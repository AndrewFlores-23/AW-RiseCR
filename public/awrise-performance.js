const BUSINESS = {
  whatsapp: "50685847369",
  email: "awrisecr@gmail.com",
  supportEmail: "awrisecr@gmail.com",
  location: "Portegolpe, Santa Cruz, Guanacaste",
  instagram:
    "https://www.instagram.com/aw_risecr?igsh=N21jZndsODR4Zndo&utm_source=qr",
  facebook: "https://www.facebook.com/share/1Ed5t5b6TQ/?mibextid=wwXIfr",
  maps: "https://maps.app.goo.gl/gUyp98sPHAyXdhok9?g_st=ic",
};

const ICON_SPRITE = `
  <symbol id="arrow" viewBox="0 0 24 24">
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="whatsapp" viewBox="0 0 24 24">
    <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9.1 8.2c.3-.6.6-.6.9-.6h.4c.2 0 .4 0 .6.5l.8 1.8c.1.3.1.5-.1.7l-.6.8c-.2.2-.3.4-.1.7.6 1 1.5 1.8 2.5 2.4.3.2.5.1.7-.1l.8-1c.2-.3.5-.3.8-.2l1.7.8c.3.2.5.3.5.5 0 .2 0 1.1-.5 1.6-.5.6-1.4.9-2.1.9-.6 0-1.4-.2-2.8-.8-1.7-.8-3-2-4.1-3.4-.7-1-1.5-2.3-1.5-3.6 0-.5.1-.8.1-1Z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="code" viewBox="0 0 24 24">
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="card" viewBox="0 0 24 24">
    <rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M3 9h18M7 15h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="tools" viewBox="0 0 24 24">
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M9.5 4v2.5M14.5 4v2.5M9.5 17.5V20M14.5 17.5V20M4 9.5h2.5M4 14.5h2.5M17.5 9.5H20M17.5 14.5H20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <path d="m9.6 12.2 1.7 1.7 3.3-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="map-pin" viewBox="0 0 24 24">
    <path d="M20 10c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 1 1 16 0Z" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
  </symbol>
  <symbol id="mail" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="check" viewBox="0 0 24 24">
    <path d="m5 12 4.2 4.2L19 6.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="star" viewBox="0 0 24 24">
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="menu" viewBox="0 0 24 24">
    <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </symbol>
  <symbol id="close" viewBox="0 0 24 24">
    <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </symbol>
  <symbol id="external" viewBox="0 0 24 24">
    <path d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="shield" viewBox="0 0 24 24">
    <path d="M12 3 4.5 6v5.5c0 4.5 3 7.7 7.5 9.5 4.5-1.8 7.5-5 7.5-9.5V6L12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="monitor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="12.5" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M8.5 20h7M12 16.5V20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="search" viewBox="0 0 24 24">
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="cart" viewBox="0 0 24 24">
    <path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="9.5" cy="19.5" r="1.3" fill="currentColor"/><circle cx="17" cy="19.5" r="1.3" fill="currentColor"/>
  </symbol>
  <symbol id="megaphone" viewBox="0 0 24 24">
    <path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5V4.5L7 9H5a1 1 0 0 0-1 1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5M8 15l1.2 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="layers" viewBox="0 0 24 24">
    <path d="m12 3 9 5-9 5-9-5 9-5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="chevron" viewBox="0 0 24 24">
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="bolt" viewBox="0 0 24 24">
    <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  </symbol>
  <symbol id="tag" viewBox="0 0 24 24">
    <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.8 6.8a1.4 1.4 0 0 1-2 0l-8.2-8.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
  </symbol>
  <symbol id="phone" viewBox="0 0 24 24">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M10.5 18.5h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="pencil" viewBox="0 0 24 24">
    <path d="m15 5 4 4L8.5 19.5H4.5v-4L15 5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="m13 7 4 4" fill="none" stroke="currentColor" stroke-width="1.7"/>
  </symbol>
  <symbol id="refresh" viewBox="0 0 24 24">
    <path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M5 3v4h4M19 21v-4h-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="calendar" viewBox="0 0 24 24">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="wrench" viewBox="0 0 24 24">
    <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M14.5 6.5 17 4l3 3-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  </symbol>
  <symbol id="chart" viewBox="0 0 24 24">
    <path d="M4 20h16M7 16v-4M11.5 16V8M16 16v-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </symbol>
  <symbol id="heart" viewBox="0 0 24 24">
    <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  </symbol>
  <symbol id="users" viewBox="0 0 24 24">
    <circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3a5.5 5.5 0 0 1 3 5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="compass" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  </symbol>
  <symbol id="globe" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  </symbol>
  <symbol id="hand-arrow" viewBox="0 0 48 40">
    <path d="M40 4C36 18 24 28 8 30M8 30l7-7M8 30l9 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
`;

const iconMarkup = (name) =>
  `<svg aria-hidden="true"><use href="#${name}"></use></svg>`;

const normalizeIconReferences = () => {
  if (!document.getElementById("aw-icon-sprite")) {
    const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sprite.id = "aw-icon-sprite";
    sprite.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    sprite.setAttribute("aria-hidden", "true");
    sprite.style.position = "absolute";
    sprite.style.width = "0";
    sprite.style.height = "0";
    sprite.style.overflow = "hidden";
    sprite.innerHTML = ICON_SPRITE;
    document.body.prepend(sprite);
  }

  document.querySelectorAll("use").forEach((use) => {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href");
    const match = href?.match(/icons\.svg#([A-Za-z0-9_-]+)$/);
    if (!match) return;
    use.setAttribute("href", `#${match[1]}`);
    use.removeAttribute("xlink:href");
  });
};

normalizeIconReferences();

const pageName = document.body.dataset.page || "inicio";
const nav = document.querySelector(".site-nav");
const menuButton = document.querySelector(".menu-toggle");

document.querySelectorAll("[data-nav]").forEach((link) => {
  if (link.dataset.nav === pageName) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  }
});

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.innerHTML = iconMarkup(open ? "close" : "menu");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("menu-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.innerHTML = iconMarkup("menu");
    });
  });
}

const EN = (document.documentElement.lang || "").startsWith("en");

const makeWhatsAppUrl = (message) =>
  `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(message)}`;

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  const message =
    link.dataset.whatsapp ||
    (EN ? "Hi AW-RiseCR, I'd like more information about your services." : "Hola AW-RiseCR, me gustaría recibir más información sobre sus servicios.");
  link.href = makeWhatsAppUrl(message);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

document.querySelectorAll("[data-social]").forEach((link) => {
  const url = BUSINESS[link.dataset.social];
  if (!url) return;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

document.querySelectorAll("[data-map-link]").forEach((link) => {
  link.href = BUSINESS.maps;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

document.querySelectorAll("[data-business-email]").forEach((link) => {
  const email =
    link.dataset.businessEmail === "support"
      ? BUSINESS.supportEmail
      : BUSINESS.email;
  link.href = `mailto:${email}`;
  link.textContent = email;
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll("[data-reveal]").forEach((element) => {
  revealObserver.observe(element);
});

const header = document.querySelector(".site-header");
const setHeaderState = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 18);
};
let headerFrame = 0;
const requestHeaderState = () => {
  if (headerFrame) return;
  headerFrame = window.requestAnimationFrame(() => {
    setHeaderState();
    headerFrame = 0;
  });
};
setHeaderState();
window.addEventListener("scroll", requestHeaderState, { passive: true });

const enableTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (enableTilt) {
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    let tiltFrame = 0;
    card.addEventListener("pointermove", (event) => {
      if (tiltFrame) return;
      const { clientX, clientY } = event;
      tiltFrame = window.requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width - 0.5;
        const y = (clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--tilt-x", `${y * -3.5}deg`);
        card.style.setProperty("--tilt-y", `${x * 4.5}deg`);
        card.style.setProperty("--glow-x", `${(x + 0.5) * 100}%`);
        card.style.setProperty("--glow-y", `${(y + 0.5) * 100}%`);
        tiltFrame = 0;
      });
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });
}

const contactForm = document.querySelector("[data-contact-form]");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const value = (key) => data.get(key)?.toString().trim() || "";
    // Solo se agregan al mensaje los campos que la persona llenó
    const fields = EN
      ? [
          ["Name", value("name")],
          ["Business", value("business")],
          ["WhatsApp / phone", value("phone")],
          ["I need", value("service")],
          ["Approximate budget", value("budget")],
          ["Details", value("message")],
        ]
      : [
          ["Nombre", value("name")],
          ["Negocio", value("business")],
          ["WhatsApp / teléfono", value("phone")],
          ["Necesito", value("service")],
          ["Presupuesto aproximado", value("budget")],
          ["Detalles", value("message")],
        ];
    const message = [
      EN ? "Hi AW-RiseCR, I'd like a quote for a project." : "Hola AW-RiseCR, quiero valorar un proyecto.",
      "",
      ...fields.filter(([, text]) => text).map(([label, text]) => `${label}: ${text}`),
    ].join("\n");
    window.open(makeWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  });
}

document.querySelectorAll("[data-whatsapp-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get("name")?.toString().trim() || (EN ? "Client" : "Cliente");
    const type = form.dataset.formType;

    let message;
    if (type === "web") {
      const idea = data.get("idea")?.toString().trim() || (EN ? "No details given." : "No indicó detalles.");
      message = (EN
        ? ["Hi AW-RiseCR, I'd like a quote for a web project.", "", `Name: ${name}`, `Project idea: ${idea}`]
        : ["Hola AW-RiseCR, quiero cotizar un proyecto web.", "", `Nombre: ${name}`, `Idea del proyecto: ${idea}`]
      ).join("\n");
    } else if (type === "repair") {
      const problem =
        data.get("problem")?.toString().trim() || "No indicó detalles.";
      message = [
        "Hola AW-RiseCR, quiero realizar una reparación con ustedes.",
        "",
        `Nombre del cliente: ${name}`,
        `Descripción del problema: ${problem}`,
      ].join("\n");
    } else {
      message = EN
        ? `Hi AW-RiseCR, I'm ${name}. I'd like some information.`
        : `Hola AW-RiseCR, soy ${name}. Me gustaría recibir información.`;
    }

    window.open(makeWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  });
});

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
;
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");

  const activateSolution = (name) => {
    document.querySelectorAll("[data-solution]").forEach((button) => {
      const active = button.dataset.solution === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    document.querySelectorAll("[data-solution-screen]").forEach((screen) => {
      const active = screen.dataset.solutionScreen === name;
      screen.classList.toggle("is-active", active);
      screen.setAttribute("aria-hidden", String(!active));
    });
  };

  const solutionButtons = [...document.querySelectorAll("[data-solution]")];
  const journey = document.querySelector(".mg-journey");
  let proposalTimer;

  const stopProposalRotation = () => window.clearInterval(proposalTimer);
  const startProposalRotation = () => {
    stopProposalRotation();
    if (reduceMotion.matches || document.hidden || !journey || solutionButtons.length < 2) return;
    proposalTimer = window.setInterval(() => {
      const current = solutionButtons.findIndex((button) => button.classList.contains("is-active"));
      const next = solutionButtons[(current + 1) % solutionButtons.length];
      activateSolution(next.dataset.solution);
    }, 5000);
  };

  solutionButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
    button.addEventListener("click", () => {
      activateSolution(button.dataset.solution);
      startProposalRotation();
    });
  });

  if (journey && !reduceMotion.matches) {
    const journeyObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) startProposalRotation();
      else stopProposalRotation();
    }, { threshold: 0.2 });
    journeyObserver.observe(journey);
    journey.addEventListener("pointerenter", stopProposalRotation);
    journey.addEventListener("pointerleave", startProposalRotation);
    journey.addEventListener("focusin", stopProposalRotation);
    journey.addEventListener("focusout", startProposalRotation);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopProposalRotation();
      else if (journey.getBoundingClientRect().bottom > 0 && journey.getBoundingClientRect().top < window.innerHeight) startProposalRotation();
    });
  }

  const phone = document.querySelector("[data-phone-parallax]");
  const heroVisual = document.querySelector(".mg-hero-visual");
  if (phone && heroVisual && !coarsePointer.matches && !reduceMotion.matches) {
    let pointerFrame = 0;
    heroVisual.addEventListener("pointermove", (event) => {
      if (pointerFrame) return;
      const { clientX, clientY } = event;
      pointerFrame = window.requestAnimationFrame(() => {
        const rect = heroVisual.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width - 0.5;
        const y = (clientY - rect.top) / rect.height - 0.5;
        phone.style.transform = `rotateY(${x * 7}deg) rotateX(${y * -5}deg) rotateZ(-3deg) translate3d(${x * 7}px, ${y * 5}px, 0)`;
        pointerFrame = 0;
      });
    });
    heroVisual.addEventListener("pointerleave", () => {
      phone.style.transform = "rotateY(0deg) rotateX(0deg) rotateZ(-3deg) translate3d(0, 0, 0)";
    });
  }

  if (!coarsePointer.matches && !reduceMotion.matches) {
    document.querySelectorAll(".mg-glass-card, .mg-featured-plan, .mg-contact-panel").forEach((card) => {
      let pointerFrame = 0;
      card.addEventListener("pointermove", (event) => {
        if (pointerFrame) return;
        const { clientX, clientY } = event;
        pointerFrame = window.requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--mg-pointer-x", `${clientX - rect.left}px`);
          card.style.setProperty("--mg-pointer-y", `${clientY - rect.top}px`);
          pointerFrame = 0;
        });
      });
    });
  }

  document.querySelectorAll(".mg-faq details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll(".mg-faq details").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const updateScrollProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    document.documentElement.style.setProperty("--mg-scroll-progress", progress.toFixed(4));
  };
  let scrollFrame = 0;
  const requestScrollProgress = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      updateScrollProgress();
      scrollFrame = 0;
    });
  };
  updateScrollProgress();
  window.addEventListener("scroll", requestScrollProgress, { passive: true });

  document.querySelectorAll(".mg-project-rail, .mg-plan-rail").forEach((rail) => {
    let railFrame = 0;
    rail.addEventListener("scroll", () => {
      if (railFrame) return;
      railFrame = window.requestAnimationFrame(() => {
        const max = rail.scrollWidth - rail.clientWidth;
        rail.style.setProperty("--rail-progress", max > 0 ? String(rail.scrollLeft / max) : "0");
        railFrame = 0;
      });
    }, { passive: true });
  });
})();
;
(() => {
  const policyLinks = [...document.querySelectorAll(".mg-policy-nav a[href^='#']")];
  const policySections = policyLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (policySections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      policyLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
    }, { rootMargin: "-20% 0px -65%", threshold: [0.05,.3,.6] });
    policySections.forEach((section) => observer.observe(section));
  }

  document.querySelectorAll("[data-exclusive-details]").forEach((group) => {
    group.querySelectorAll("details").forEach((item) => item.addEventListener("toggle", () => {
      if (!item.open) return;
      group.querySelectorAll("details").forEach((other) => { if (other !== item) other.open = false; });
    }));
  });
})();

;
(() => {
  // Menú "Servicios": se abre con clic (y con hover en computadora),
  // se cierra con Escape o al hacer clic fuera.
  const groups = [...document.querySelectorAll(".nav-group")];
  if (!groups.length) return;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const isDesktop = () => window.innerWidth > 820;

  const setOpen = (group, open) => {
    group.classList.toggle("is-open", open);
    group.querySelector(".nav-drop")?.setAttribute("aria-expanded", String(open));
  };

  groups.forEach((group) => {
    const button = group.querySelector(".nav-drop");
    if (group.querySelector(`[data-nav="${pageName}"]`)) group.classList.add("is-active");

    button?.addEventListener("click", () => setOpen(group, !group.classList.contains("is-open")));
    group.addEventListener("mouseenter", () => { if (canHover.matches && isDesktop()) setOpen(group, true); });
    group.addEventListener("mouseleave", () => { if (canHover.matches && isDesktop()) setOpen(group, false); });
    group.addEventListener("focusout", (event) => {
      if (isDesktop() && !group.contains(event.relatedTarget)) setOpen(group, false);
    });
  });

  document.addEventListener("click", (event) => {
    groups.forEach((group) => { if (isDesktop() && !group.contains(event.target)) setOpen(group, false); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    groups.forEach((group) => {
      if (!group.classList.contains("is-open")) return;
      setOpen(group, false);
      group.querySelector(".nav-drop")?.focus();
    });
  });
})();
;
(() => {
  // Carrusel de proyectos: en celular y tableta avanza solo, sin fin, de
  // derecha a izquierda. Se pausa al tocarlo y retoma a los pocos segundos.
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)");
  const PX_POR_SEGUNDO = 32;
  const ESPERA_TRAS_TOCAR = 2500;

  document.querySelectorAll("[data-auto-carrusel]").forEach((rail) => {
    const originales = [...rail.children];
    if (originales.length < 2 || reducir.matches) return;

    // Copias al final para que el recorrido no tenga salto al volver a empezar
    originales.forEach((item) => {
      const copia = item.cloneNode(true);
      copia.classList.add("aw-clon");
      copia.setAttribute("aria-hidden", "true");
      copia.querySelectorAll("a, button").forEach((el) => el.setAttribute("tabindex", "-1"));
      copia.querySelectorAll("img").forEach((img) => img.setAttribute("loading", "eager"));
      rail.appendChild(copia);
    });

    const esCarrusel = () => rail.scrollWidth > rail.clientWidth + 8;
    const periodo = () => {
      const a = originales[0].getBoundingClientRect().left;
      const b = rail.querySelector(".aw-clon").getBoundingClientRect().left;
      return b - a;
    };

    let pos = rail.scrollLeft;
    let ultimo = 0;
    let pausaHasta = 0;
    let visible = false;
    let tocando = false;
    let frame = 0;

    const pausar = (ms = ESPERA_TRAS_TOCAR) => { pausaHasta = performance.now() + ms; };

    const paso = (t) => {
      frame = requestAnimationFrame(paso);
      const dt = ultimo ? Math.min(t - ultimo, 64) : 16;
      ultimo = t;
      if (!visible || tocando || document.hidden || t < pausaHasta || !esCarrusel()) {
        pos = rail.scrollLeft;
        return;
      }
      rail.classList.add("aw-auto");
      // Si el usuario deslizó, seguimos desde donde lo dejó
      if (Math.abs(rail.scrollLeft - pos) > 3) pos = rail.scrollLeft;
      pos += (PX_POR_SEGUNDO * dt) / 1000;
      const p = periodo();
      if (p > 0 && pos >= p) pos -= p;
      rail.scrollLeft = pos;
    };

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(rail);

    rail.addEventListener("pointerdown", () => { tocando = true; rail.classList.remove("aw-auto"); });
    window.addEventListener("pointerup", () => { if (tocando) { tocando = false; pausar(); } });
    rail.addEventListener("touchstart", () => { tocando = true; rail.classList.remove("aw-auto"); }, { passive: true });
    rail.addEventListener("touchend", () => { tocando = false; pausar(); }, { passive: true });
    rail.addEventListener("wheel", () => { rail.classList.remove("aw-auto"); pausar(); }, { passive: true });
    rail.addEventListener("mouseenter", () => { tocando = true; });
    rail.addEventListener("mouseleave", () => { tocando = false; pausar(800); });
    rail.addEventListener("focusin", () => { tocando = true; });
    rail.addEventListener("focusout", () => { tocando = false; pausar(); });
    // Al deslizar hacia atrás desde el inicio, saltamos a las copias sin que se note
    rail.addEventListener("scroll", () => {
      const p = periodo();
      if (p > 0 && rail.scrollLeft <= 1 && !rail.classList.contains("aw-auto") && !tocando) {
        rail.scrollLeft += p; pos = rail.scrollLeft;
      }
    }, { passive: true });

    pausar(1200);
    frame = requestAnimationFrame(paso);
  });
})();
