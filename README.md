# DURO 2.0

Paquete de evolución del sitio DURO orientado a:

- Senior UI/UX
- CRO / conversión
- Publisher / AdSense readiness
- SEO técnico
- AEO / comprensión semántica
- Google Search Console
- experiencia móvil
- identidad DURO: negro + naranja + amarillo

## Archivos principales

- `index.html` — nueva portada.
- `home.css` / `home.js` — sistema visual y carga editorial.
- `noticias.html` / `news.css` / `news.js` — explorador de noticias.
- `playlist.html` / `style.css` / `script.js` — sistema de playlist existente, conservado.
- `playlistapi.js` — Worker de Cloudflare/D1 actual, conservando el sistema editorial y el renderizado SEO de `/noticias/:slug`; sitemap ampliado.
- `wrangler.jsonc` — configuración existente del Worker.
- `robots.txt` / `sitemap.xml` — infraestructura de rastreo.
- `quienes-somos.html`, `publicidad.html`, `contacto.html` — páginas comerciales/institucionales.
- `privacidad.html`, `cookies.html`, `terminos.html` — base legal del sitio.
- `assets/` — logo procesado, favicon y las fotografías suministradas.

## Despliegue

1. Haz una copia de seguridad de la versión actual.
2. Sube los archivos del paquete a la raíz pública de `duroconbrayan.com`.
3. Conserva la configuración de tu Worker/D1 actual.
4. Si tu arquitectura actual enruta `/noticias/:slug` mediante el Worker, conserva esa ruta: el Worker ya genera HTML server-side para esas URLs.
5. Si tu hosting separa el frontend del Worker, asegúrate de que las rutas `/noticias` y `/noticias/:slug` sigan llegando al Worker que contiene `playlistapi.js`.
6. Comprueba `/`, `/noticias`, un artículo, `/playlist.html`, `/publicidad.html` y las páginas legales.
7. Después de verificar el sitio, añade la propiedad a Google Search Console y envía `/sitemap.xml`.

## No incluido a propósito

- No se inventó un ID de AdSense.
- No se inventó una verificación de Search Console.
- No se activaron scripts publicitarios nuevos automáticamente.

Esto evita publicar credenciales o configuraciones falsas.
