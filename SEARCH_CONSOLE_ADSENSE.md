# DURO 2.0 — SEO / AEO / Search Console / AdSense

## Qué quedó preparado

- `index.html` con title, meta description, robots, canonical, Open Graph, Twitter Card y JSON-LD de Organization + WebSite + WebPage.
- `noticias.html` como archivo editorial navegable con filtros.
- El Worker `playlistapi.js` ya contiene renderizado HTML para `/noticias` y `/noticias/:slug`, incluyendo canonical, Open Graph y datos estructurados de artículos.
- El Worker genera `sitemap.xml` dinámico desde los artículos publicados. Se amplió para incluir las páginas institucionales.
- `robots.txt` permite rastreo y bloquea `/admin` y `/api`.
- Navegación interna y enlaces contextuales entre portada, noticias, artículos, playlist, marca y contacto.
- Páginas institucionales: quiénes somos, publicidad, contacto, privacidad, cookies y términos.
- Diseño responsive y estructura semántica con headings, navegación, artículos y enlaces claros.

## Google Search Console

1. Verifica `duroconbrayan.com` como propiedad. Preferiblemente utiliza una propiedad de dominio mediante DNS.
2. Si utilizas verificación por HTML, coloca el archivo que Google entregue en la raíz del sitio.
3. Abre Search Console y añade el sitemap:
   `https://duroconbrayan.com/sitemap.xml`
4. Después de publicar artículos, usa Inspección de URL para comprobar una URL nueva y solicitar indexación cuando sea necesario.
5. Revisa periódicamente indexación, Core Web Vitals, mejoras y datos estructurados.

Google recomienda enviar el sitemap y comprobar las URLs con la herramienta de inspección después de implementar datos estructurados. La indexación no es instantánea. 

## AEO

AEO aquí significa preparar el contenido para que buscadores y sistemas de respuesta puedan entenderlo bien. No existe un botón de "AEO" ni una garantía de aparición en respuestas.

Para cada artículo nuevo:

- Un H1 claro.
- Un primer párrafo que responda rápidamente qué pasó.
- Nombres propios escritos de forma consistente.
- Fechas y contexto.
- Subtítulos H2/H3 cuando el artículo sea largo.
- Enlaces internos a historias relacionadas.
- Autor y fecha visibles.
- Imagen principal con `alt` descriptivo.
- SEO title y SEO description propios.
- URL corta y descriptiva.
- Datos estructurados coherentes con el contenido real.

Google no garantiza resultados enriquecidos aunque los datos estructurados estén correctamente implementados. 

## AdSense

NO se dejó un ID de AdSense inventado.

Cuando Google entregue el `ca-pub-XXXXXXXXXXXXXXXX` real, se debe añadir su código oficial exactamente como lo proporciona Google. No se debe solicitar aprobación mientras el sitio siga pareciendo una plantilla o tenga contenido insuficiente.

Antes de solicitar:

- Publicar contenido original y útil de forma consistente.
- Tener navegación completamente funcional.
- Tener páginas institucionales y de privacidad.
- Revisar que no existan enlaces rotos ni secciones "en construcción" innecesarias.
- Comprobar que el sitio funciona perfectamente en móvil.
- Revisar que la publicidad, cuando se active, no se confunda con navegación ni interfiera con la experiencia.
- Comprobar políticas de contenido y privacidad aplicables.

Google señala expresamente como problemas comunes el contenido insuficiente, contenido de baja calidad y problemas de navegación; también indica que el sitio debe estar completamente construido y tener suficiente contenido para poder evaluarlo. 

## Importante

La aprobación de AdSense nunca puede garantizarse desde código. La calidad, originalidad, volumen y utilidad del contenido publicado serán determinantes.
