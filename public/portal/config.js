// Conexión pública del portal. La llave publicable es segura en el navegador:
// los permisos los controla la base de datos (RLS); la llave de servicio nunca va aquí.
export const SUPABASE_URL = "https://gppltlberzswfufgrhif.supabase.co";
export const SUPABASE_KEY = "sb_publishable_mt2WQeu-skg1zU516of69g_LkLXp9eI";
export const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

// Captcha de Cloudflare Turnstile (entrada, recuperación y cambio de contraseña). La "site key" es pública y va aquí;
// la "secret key" va SOLO en Supabase → Authentication → Bot and Abuse Protection. Vacía = sin captcha.
export const TURNSTILE_SITEKEY = "0x4AAAAAAFP8zwsnQCgNN-K_";

// Contacto que ve el cliente. Los datos de pago (SINPE, cuenta, IBAN) NO van aquí: este archivo es público.
// Se guardan en la base de datos (tabla ajustes) y Andrew los cambia desde Cobros → Datos de pago.
export const CONTACTO = {
  whatsapp: "50685847369", whatsappVisible: "+506 8584-7369", llamadas: "+506 8795-2070", correo: "awrisecr@gmail.com",
};
