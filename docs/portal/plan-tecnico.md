# Portal AW-RiseCR · Plan técnico (Fase 1)

Plataforma privada en `awrisecr.com/portal` para Andrew (administrador) y sus clientes (menos de 10 usuarios). Mockup aprobado: `herramientas/portal-mockup/index.html`.

## Decisiones tomadas (2026-10-04)

- Vive dentro de la web actual: carpeta `public/portal/`, mismo dominio y mismo despliegue en Cloudflare.
- Menú: **carpetas** (separadores de archivador) en computadora y **dock flotante** abajo en el celular.
- Diseño: paleta **Azul profundo** (fondo #061633, paneles #0c2554, acento celeste #4cc2ff con texto #03213f encima; estados verde #3ddc97, amarillo #ffcf5a, rojo #ff7a85), con **tarjetas blanco suave** (#edf2fa, sombra marcada para que no brillen tanto) sobre el fondo azul (texto #0a1834, acento #1167e8 y estados más oscuros dentro de la tarjeta: verde #12804c, amarillo #a26c06, rojo #cc2d3d), sellos de estado con color y forma, resúmenes tipo recibo, bitácora con fecha y hora del más reciente al primero.
- Contraseñas de las cuentas de los clientes: **Bitwarden** (nunca en el portal). El portal solo guarda la lista de accesos (servicio, proveedor, titular, vencimiento, estado).
- Acceso solo por invitación del usuario maestro; todo se maneja por correo.

## Proyecto de Supabase

- Nombre `aw-portal`, ref `gppltlberzswfufgrhif`, región us-east-1, plan gratuito, organización `AndrewFlores-23's Org` (creado 2026-10-04).
- Migraciones en `supabase/migrations/` (0001 base y RLS, 0002 cifrado/Fondo AW/actividad/archivos, 0003 políticas separadas, 0004 varios proyectos por cliente).
- **Varios proyectos por cliente:** bitácora, cobros y adjuntos van por proyecto; servicios, documentos y accesos pueden ligarse a un proyecto (vacío = todo el negocio). Un trigger impide ligar un proyecto de otro negocio. En el portal, Inicio muestra una tarjeta por proyecto y la Bitácora tiene pestañas por proyecto.
- Prueba de seguridad del 2026-10-04: 19 de 19 correctas (aislamiento entre clientes, cifrado, bloqueo de anónimos, cliente no puede hacerse admin ni escribir, reglas del Fondo AW).

## Estado de las sesiones

- Sesión 1 (base segura): lista 2026-10-04.
- Sesión 2 (portal visible): lista 2026-10-04 en `public/portal/` (index.html, portal.css, config.js, app.js); entrada, recuperar contraseña, crear contraseña por invitación o recuperación, carpetas + dock, Inicio y Bitácora con varios proyectos, vista de admin con selector de cliente, modo demo solo en localhost (`?demo` o `?demo=cliente`), `_headers` con CSP y `noindex`, robots `Disallow: /portal/`.
- Sesión 3 (panel de Andrew): lista 2026-10-05, sin probar todavía con datos reales.
  - Dos pasos obligatorios para el admin: migración `0005` (`privado.es_admin()` exige `aal2`) y registro o código TOTP al entrar.
  - Función `admin-usuarios` (invitar, listar, activar y desactivar; exige `aal2` y rol admin).
  - `public/portal/admin.js`, que solo se descarga para el admin:
    - Clientes: registrar con contacto cifrado y "Lo recomendó".
    - Gestionar cliente: datos, proyectos con cambio de etapa, acceso al portal.
    - Publicar avance: tipos, capturas al bucket privado, vista previa y aviso por WhatsApp.
  - Probado en modo demo en escritorio y celular.
  - El aviso por correo de cada avance queda para la Sesión 5, junto con Resend.
- Sesión 4 (plata y referidos): lista 2026-10-05.
  - Migraciones `0006` y `0007`. Las fechas van en hora de Costa Rica (`privado.hoy()`).
  - Mensualidades automáticas: al crear un servicio, y con una tarea diaria de `pg_cron` a las 6:00, se crea el cobro del mes 25 días antes. Nunca se duplica. Al pausar o cancelar se anulan los pendientes.
  - `crear_proyecto` crea en un solo paso:
    - el proyecto;
    - la entrada "¡Arrancamos!";
    - el documento de bienvenida;
    - los cobros 50 / 50 (anticipo hoy y saldo en la fecha de entrega). Al marcar "Publicada", el saldo vence ese día.
  - Fondo AW:
    - `pagar_con_fondo`: cubre hasta el 50 % del proyecto y no pasa del saldo.
    - `vencer_fondos`: los créditos se usan del más viejo al más nuevo y lo vencido se descuenta una sola vez.
    - `cargar_referido` paga una sola vez por recomendado y dice a quién recomendó.
    - La vista `referidos_pendientes` es solo para el admin.
  - Pantallas del cliente: Pagos, Fondo AW (con botón para recomendar por WhatsApp) y Documentos, con la bienvenida armada con los datos vivos del proyecto y lista para imprimir o guardar en PDF.
  - Pantallas del admin:
    - Cobros: indicadores, pendientes y recomendaciones por cargar.
    - En Gestionar cliente: cobros, mensualidades y Fondo AW.
  - Prueba en la base de datos: todas las reglas responden bien y no quedaron datos de prueba. También se probó en modo demo.
- Ajustes del 2026-10-05, pedidos por Andrew (migración `0008`):
  - **Datos de pago** (SINPE, banco, titular, cuenta, IBAN) en la tabla `ajustes`. No van en el código porque el repositorio es público.
    - Solo los leen usuarios con sesión y solo los cambia el admin con dos pasos.
    - Andrew los escribe en Cobros → "Datos de pago que ven tus clientes".
    - El cliente los ve en Pagos y en la bienvenida, con botón Copiar (los números se copian sin guiones ni espacios).
  - **Mensualidad ligada a la entrega:**
    - Si el servicio va ligado a un proyecto, empieza un mes después de `entregado_en`, el mismo día del mes. Si el mes es más corto, cae en su último día.
    - Mientras no hay entrega, el cliente ve "La mensualidad de tu proyecto empieza a correr un mes posterior a la entrega".
    - Si cambia o se quita la fecha de entrega, las mensualidades sin pagar se recalculan.
    - La fecha de entrega se puede corregir en Gestionar ("Entregado el").
  - **La mensualidad se define al registrar al cliente:** el formulario trae un bloque opcional "Primer proyecto" (nombre, monto, entrega y mensualidad). También está en "Nuevo proyecto". `crear_proyecto` recibe `p_mensualidad`.
  - **Fundido entre secciones:** la sección se desvanece en 0,15 s y la nueva entra en 0,28 s. Los repintados dentro de una sección no se animan. Se respeta "reducir movimiento".
- 2026-10-05: Andrew activó sus dos pasos y guardó sus datos de pago (6 campos) desde el panel.
- Sesión 5, primera parte (2026-10-05):
  - **Accesos sin contraseñas** (migración `0009`):
    - `guardar_acceso` guarda en un solo paso y deja el usuario cifrado.
    - El enlace solo puede ser de Bitwarden (`https://…bitwarden.com|eu/`).
    - El admin los maneja en Gestionar → Accesos. El cliente ve proveedor, titular, usuario (con Copiar) y la fecha de renovación, más un botón para "Ver contraseña (enlace seguro)" o para pedirla por WhatsApp.
  - **Documentos:** el admin sube PDF, imágenes o ZIP (propuesta, acuerdo, comprobante, otro) en Gestionar → Documentos, en la ruta `{negocio}/documentos/{doc}/…`. Los puede borrar; la bienvenida no se borra.
  - **Renovaciones:** en Clientes aparece el aviso de dominios y hosting que vencen en 30 días.
  - Nuevo módulo `admin-expediente.js`.
  - **Prueba de seguridad final: 50 de 50 correctas.**
    - Cubre aislamiento entre clientes, escrituras bloqueadas, que nadie se suba a admin, archivos, al admin sin dos pasos, al cliente desactivado y al anónimo.
    - Encontró un error: `ver_contacto` y `accesos_de` dejaban pasar cuando `mi_negocio()` era nulo (NULL en el IF). Se corrigió con `privado.puede_ver()` (migración `0010`).
    - `0011` quita el permiso de la función vieja `guardar_usuario_acceso`.
- Correos (2026-10-05):
  - Andrew creó la cuenta de Resend, verificó `awrisecr.com` en Cloudflare y conectó el SMTP de Supabase: `smtp.resend.com`, remitente `portal@awrisecr.com` "AW-RiseCR".
  - Plantillas con marca en `docs/portal/correos/` (invitación y recuperar contraseña), pegadas en Supabase → Authentication → Emails → Templates.
  - Dos pruebas de envío correctas.
- Respaldos (2026-10-06): `herramientas/respaldos-portal/respaldar.py`.
  - Usa solo Python y OpenSSL (en Windows, el de Git).
  - Descarga tablas, usuarios y archivos por la API con la llave secreta "respaldos". Las llaves nuevas van solo en `apikey`.
  - Cifra con AES-256 y PBKDF2 (600.000 vueltas) usando la frase guardada en Bitwarden. Un `verificador.enc` impide usar otra frase.
  - Sube a `aw-portal-respaldos`: un paquete de datos por fecha y cada archivo cifrado una sola vez.
  - `restaurar` descifra a una carpeta fuera del repositorio.
  - Probado de punta a punta con datos falsos y un repositorio de prueba.
- Aviso por correo de cada avance (2026-10-06):
  - Función `avisar-avance`: solo el admin con dos pasos; envía con Resend a las personas activas y confirmadas del cliente; responder llega a awrisecr@gmail.com.
  - Migración `0012`: `bitacora.avisado_en` y `avisados`.
  - En Publicar hay una casilla "Avisarle por correo", marcada por defecto. En la bitácora, el admin ve "📧 avisado a N".
- Primer respaldo real: `2026-10-06_1259`, subido cifrado a `aw-portal-respaldos`. La frase quedó registrada en `verificador.enc`.
  - El script lee la llave y la frase del portapapeles: copias en Bitwarden y presionas Enter, sin pegar en la Terminal.
  - Corrige sola una llave copiada con espacios o repetida, y la prueba contra Supabase antes de usarla.
  - Acepta una frase de 16 o más caracteres, o una contraseña al azar de 12 o más con 3 tipos de caracteres.
  - Por un pegado fallido, la primera llave "respaldos" quedó expuesta en la Terminal. Andrew la borró y creó otra; no quedó en ningún historial.
- Pendiente de Andrew:
  - Crear la llave de Resend "Avisos del portal" y guardarla como secreto `RESEND_API_KEY` en Supabase.
- Diseño de los correos (2026-10-06): el espacio y un planeta de luz.
  - Cabecera: estrellas, constelación de conexiones, logo neón y el horizonte con su atmósfera. El cuerpo es el planeta. El pie es la curva de abajo del planeta y el espacio con los datos de contacto.
  - Se adapta al modo oscuro de Gmail:
    - el logo y el nombre van dentro de la imagen;
    - el planeta es transparente y toma el color del cuerpo;
    - el texto blanco del pie y del botón lleva el truco de mix-blend-mode;
    - las plantillas son solo ASCII (entidades HTML).
  - Imágenes en `awrisecr.com/correo/` (cabecera-arriba, cabecera-horizonte, pie-horizonte-v2, pie-espacio-v2), subidas en commits aparte con solo esas imágenes.
  - Generadores: `herramientas/correos/generar-cabecera.py adaptables` y `herramientas/correos/armar-plantillas.py`.
  - Las plantillas de invitación y de recuperar contraseña están pegadas en Supabase. La función `avisar-avance` usa el mismo diseño.
  - Detalle aceptado por Andrew: en modo oscuro del iPhone, la última línea del pie puede quedar sobre un fondo claro.
- **Publicado el 2026-10-06** en https://awrisecr.com/portal/ con el commit ece5a8a. Lleva los encabezados de seguridad activos: CSP, noindex, no-store y DENY.
  - Antes de publicar se revisaron todas las pantallas con la CSP de producción: sin errores.
  - El aviso por correo de avances quedó probado de punta a punta. La función limpia la llave de Resend si se guardó mal copiada.
  - El arreglo de la pantalla Publicar (faltaba exportar `idc`) va incluido.
- Andrew todavía no lo usa con clientes reales: primero quiere pulir detalles y sumar algunas integraciones.
- Mejoras del 2026-10-06 (antes de los clientes reales):
  - **Recorrido de bienvenida** (`public/portal/tour.js`, migración `0013`).
    - La primera vez que entra un cliente se ilumina una sección a la vez: Inicio, Bitácora, Pagos, Fondo AW, Documentos, Accesos y el botón "¿Cómo funciona el portal?".
    - Se mueve con Siguiente / Atrás / Saltar, las flechas y Esc.
    - Se guarda en `perfiles.tour_visto_en` con la función `marcar_tour_visto()`, que solo toca el perfil propio. No se repite en otro dispositivo.
    - En demo: `?demo=cliente&tour`.
  - **Pantalla de carga**: estrellas que aparecen alrededor del logo y el logo las absorbe, con el logo flotando, el destello y un brillo que late.
    - Las posiciones van en `portal.css` (`.cielo i:nth-child(n)`), porque la CSP bloquea los estilos en línea.
    - Versión grande al abrir y al entrar. Versión chica (`cargador()` en `util.js`) cuando una sección tarda.
    - Se probó con la CSP de producción: sin bloqueos.
  - **Portada del recorrido**: logo flotando sobre una malla de conexiones (plexus) y el horizonte del planeta.
    - La primera vez, la tarjeta se arma en cascada: 72 piezas caen fila por fila y después entra el contenido. Dura 1,2 s.
    - Las piezas las pone `tour.js` y se quitan al terminar. Con "reducir movimiento" no hay animación.
  - **Mi cuenta** (menú del cliente y del admin): muestra nombre, correo, negocio y último ingreso, y permite cambiar la contraseña.
    - Para cambiarla se pide la contraseña actual. Se confirma con una sesión aparte, que se cierra al final, así que no toca la sesión abierta ni la verificación en dos pasos del admin.
    - Después se usa `updateUser({ password, currentPassword })`. Si Supabase pide volver a autenticarse (sesión de más de 24 horas), se usa la sesión recién confirmada.
    - Casilla marcada por defecto: cerrar la sesión en los otros dispositivos (`signOut({ scope: "others" })`).
    - Si el cliente no recuerda la actual, recibe el enlace de recuperación en su correo.
    - El recorrido de bienvenida tiene un paso para Mi cuenta.
  - **Entrada más segura** (2026-10-06):
    - "Mantener la sesión iniciada": con la casilla, la sesión se guarda 30 días en `localStorage`. Si no se marca, vive en `sessionStorage` y se cierra al cerrar la pestaña.
      - La fecha límite va en `aw-recordar-hasta`. Al vencer, se cierra la sesión también en el servidor.
    - Freno de intentos en el navegador para la entrada, el código de dos pasos y la contraseña actual de Mi cuenta. Después de 5 fallos hay que esperar 30 s, y la espera se duplica hasta 15 min. Sobrevive a recargar la página.
    - "Enviar enlace" de recuperación: un minuto de espera antes de reenviar.
    - Captcha de Cloudflare Turnstile (`captcha.js`) en la entrada, la recuperación y Mi cuenta. Casi siempre es invisible y Supabase lo verifica en su servidor.
      - Se activa con `TURNSTILE_SITEKEY` en `config.js`. La secret key va solo en Supabase.
      - La CSP permite `challenges.cloudflare.com` (script y frame).
      - En demo: `?captcha=si` o `?captcha=reto`, con las llaves de prueba públicas de Cloudflare.
    - Límite de solicitudes a la base de datos (migración `0014`, `limite.revisar()` como pre-request de PostgREST): 300 escrituras cada 5 min por usuario y 30 por IP sin sesión. Al pasar el tope responde 429.
      - Las lecturas no se pueden contar ahí, porque son de solo lectura. Las protegen RLS y el `statement_timeout` de 8 s.
      - Las escrituras que fallan no suman, porque se deshace todo.
      - Limpieza cada 10 min (cron `portal-limpiar-limites`).
    - Revisión de inyección SQL: todo va por supabase-js con parámetros. Las funciones RPC no arman SQL con texto del usuario (el único `execute format` está en migraciones, con nombres de tabla fijos). No hay `innerHTML`.
      - Sin sesión no se puede leer ni escribir ninguna tabla (probado con la API publicada).
    - Supabase ya trae límites de entrada por IP. El bloqueo por cuenta (hook de verificación de contraseña) y la protección contra contraseñas filtradas son de planes de pago.
- Pendiente antes de los clientes reales:
  - ~~Cambiar la Site URL de Supabase~~: hecho el 2026-10-06 (`https://awrisecr.com/portal/`).
  - Borrar el "Cliente de prueba" y su usuario.
  - Hacer un respaldo semanal.
  - Ojo: el commit local fb02bf9 (propuestas de LAHL y de Kenneth) no debe subirse al repositorio público. Andrew lo pidió así; hay que decidir qué hacer con él antes del push del portal.
  - Script de respaldos cifrados.
  - Publicación: commit y push con aprobación de Andrew, y Site URL a producción.

## Arquitectura

- **Pantallas:** HTML, CSS y JavaScript con módulos nativos, sin herramientas de compilación (igual que la web). Cliente de Supabase desde CDN con versión fija.
- **Datos, autenticación y archivos:** proyecto nuevo de Supabase, separado de cualquier otro (plan gratuito al inicio).
- **Correos:** Resend como SMTP de Supabase Auth y para avisos (gratis hasta 3.000 al mes). Remitente `portal@awrisecr.com`.
- **Lógica de servidor:** Edge Functions de Supabase (crear usuarios, enviar avisos, calcular el Fondo AW, generar enlaces firmados).

## Acceso y cuentas

- Registro público **desactivado** en Supabase Auth. No hay "Crear cuenta".
- Solo el usuario maestro (Andrew, rol `admin`) crea usuarios desde el panel. Una Edge Function con la llave de servicio verifica que quien llama sea admin y envía la invitación.
- Verificación en dos pasos (TOTP) obligatoria para el admin.
- Pantalla de entrada: correo, contraseña, "Entrar" y "¿Olvidaste tu contraseña?".
- Dentro del portal, "Mi cuenta" permite cambiar la contraseña pidiendo la actual.
- Correos (con logo, en español): invitación para crear contraseña, restablecer contraseña (vence en 1 hora, un solo uso), confirmación de cambio de correo, bienvenida, aviso de avance nuevo y recordatorio de cobro.
- El admin puede desactivar a un usuario (bloqueo inmediato).
- Límite de intentos de entrada fallidos (protección de Supabase Auth).

## Protección de datos

| Dato | Protección |
|---|---|
| Contraseñas del portal | Hash bcrypt de Supabase Auth |
| Contraseñas de cuentas de clientes | Bitwarden |
| Datos sensibles (teléfonos, correos de contacto, cédula, notas privadas, detalles de accesos) | Cifrado por columna; la llave vive fuera de la base de datos (secreto de Edge Function o Supabase Vault) |
| Datos de trabajo (fechas, montos, estados, etapas) | RLS por cliente, sin cifrar, para ordenar, sumar y avisar |
| Base de datos completa | Cifrado en disco y TLS (Supabase) |
| Capturas y archivos | Bucket privado, rutas por negocio, enlaces firmados temporales |

Además: RLS en todas las tablas (cada cliente solo ve lo de su negocio), registro de actividad, `noindex` y `Disallow: /portal/` en robots.txt, encabezados de seguridad, la llave de servicio nunca en el navegador. Respaldos manuales mediante GitHub mientras se use el plan gratuito (decisión de Andrew, 2026-10-04); pasar a Pro (USD 25/mes) más adelante.

## Respaldos (manuales, en GitHub)

- Repositorio **privado y separado**: `aw-portal-respaldos`. Nunca en `AW-RiseCR`, que es **público**.
- Script `respaldar` que exporta la base de datos completa (estructura y datos) y descarga los archivos del bucket.
- Antes de subirlo, el respaldo se **cifra** con una llave que solo tiene Andrew (guardada en Bitwarden). En GitHub queda un archivo ilegible.
- Se corre a mano (una vez por semana o antes de cambios grandes); un recordatorio programado avisa cada semana.
- Prueba de restauración en un proyecto de prueba al terminar la Fase 1.

## Modelo de datos

- `negocios`: nombre, nicho, ciudad, estado.
- `perfiles`: usuario de Auth, negocio, rol (`admin` | `cliente`), nombre, activo.
- `servicios`: negocio, tipo (web, mantenimiento, SEO, redes, fidelización), plan, monto mensual, día de cobro, estado, inicio.
- `proyectos`: negocio, nombre, monto total, etapa (anticipo, diseño, desarrollo, revisión, publicada), fechas.
- `bitacora`: proyecto, tipo (inicio, avance, captura, entregable, aprobación, nota), título, nota, creado_en (fecha y hora), requiere/aprobado, autor.
- `adjuntos`: entrada de bitácora o documento, ruta en el bucket, nombre, tamaño, tipo.
- `cobros`: negocio, concepto, monto, vence, estado (programado, por vencer, cobrado, atrasado), pagado_en, método, comprobante.
- `fondo_movimientos`: negocio, tipo (bienvenida, carga por referido, uso, vencimiento), monto, negocio referido, proyecto, fecha, vence.
- `accesos`: negocio, servicio, proveedor, titular, vence, estado, nota (sin contraseñas).
- `documentos`: negocio, tipo (bienvenida, propuesta, acuerdo, comprobante), título, archivo.
- `actividad`: quién, qué, cuándo.
- Vistas: saldo del Fondo AW por negocio, próximos cobros, vencimientos.

## Reglas del Fondo AW (en la base de datos)

- Quien recomienda: 15 % del proyecto del recomendado (20 % desde su 3.ª recomendación pagada), tope de USD 150 por recomendación.
- Se carga solo cuando el proyecto recomendado está pagado al 100 % y pasaron 15 días desde la entrega. Se calcula sobre el precio sin IVA ni costos de terceros.
- Recomendado: USD 25 de bienvenida.
- Vence a los 12 meses de cada carga. No se cambia por dinero. En proyectos nuevos cubre hasta el 50 %.

## Sesiones

1. **Base segura:** proyecto de Supabase, tablas, RLS, cifrado de columnas sensibles, bucket privado, registro desactivado, usuario admin con 2 pasos, datos de prueba.
2. **El portal se ve:** entrada con "¿Olvidaste tu contraseña?", menú de carpetas y dock, Inicio y Bitácora del cliente con datos reales.
3. **Panel de Andrew:** registrar e invitar clientes, publicar avances con capturas y aviso por correo y WhatsApp.
4. **Plata y referidos:** cobros y mensualidades, Fondo AW con su cálculo y documento de bienvenida automático.
5. **Cierre:** accesos y documentos, pruebas de seguridad (un cliente no puede ver datos de otro), correos con marca y publicación.

Fase 2: reportes mensuales de rendimiento (plantilla y luego automáticos desde GA4 y Search Console), solicitudes de cambios, PDF de documentos. Fase 3: reportes automáticos, recordatorios de cobro automáticos, prospectos.

## Lo que hace Andrew

- Crear cuenta en Resend y verificar el dominio `awrisecr.com` (registros DNS en Cloudflare).
- Crear cuenta en Bitwarden.
- Aprobar la creación del proyecto de Supabase.
