# AW RiseCR — sitio web

Sitio estático de AW RiseCR publicado en https://awrisecr.com mediante un Worker de Cloudflare.

- `public/` — todo lo que se publica (HTML, CSS, JS e imágenes).
- `wrangler.jsonc` — configuración del despliegue.

Cada push a `main` despliega a producción con Workers Builds (`npx wrangler deploy`).

Base inicial: versión desplegada `v7-firmas-editoriales` del 2026-09-04.
