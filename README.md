# Barbecue Garage — Carta digital

Sitio web de **Barbecue Garage** (sedes Cra 21 y Le Meridiem Golf). Mantiene la identidad del sitio original
(negro, grises y el rojo `#DA2928`) y está dividido en páginas, como lo manejan hoy:

| Página | Archivo | Para qué sirve |
|---|---|---|
| **Portada** | `index.html` | Cuatro opciones, en este orden: ver el menú · pedir a domicilio · hacer reserva (*muy pronto*, aún sin función) · conocer la ubicación. |
| **Ubicación** | `ubicacion.html` | Las **sedes**: cada tarjeta abre Google Maps (y tiene su WhatsApp). Con botón para volver al inicio. |
| **Menú** | `carta.html` | La carta completa **solo para consultar** (sin botón de agregar ni carrito). Ideal para el código QR de las mesas. |
| **Domicilios** | `domicilios.html` | La misma carta **con pedido**: botón **+**, carrito, elegir sede y enviar por WhatsApp. |

- **Detalle de cada producto:** en escritorio se despliega bajo su fila (animado); en celular se abre como **ventana
  emergente** con botón de cerrar, para no repetir la foto en la página.
- **Pedidos a domicilio o para recoger:** cada producto tiene un botón **+**; el cliente revisa su pedido, **elige la sede**
  y el pedido sale por WhatsApp al número de esa sede (ver [Pedidos por WhatsApp](#pedidos-por-whatsapp)).
- Sin frameworks ni dependencias: HTML + CSS + JavaScript (módulos ES). Nada que actualizar ni que pueda traer
  vulnerabilidades por terceros.
- Toda la carta vive en **un solo archivo** (`data/menu.json`). Cambiar un precio no requiere tocar código.
- Móvil primero, accesible con teclado y lector de pantalla, con búsqueda y enlaces compartibles.

## Ver el sitio

Requiere [Node.js](https://nodejs.org) 20 o superior (solo para el servidor de prueba local).

**En Windows, lo más fácil:** doble clic en **`iniciar.bat`**. Arranca el servidor y abre el sitio en
<http://localhost:5173>. Deja esa ventana abierta mientras lo uses; ciérrala (o `Ctrl + C`) para detenerlo.

Desde una terminal también sirve (`npm start` si PowerShell no lo bloquea; si lo bloquea, usa `node server.mjs`):

```bash
node server.mjs --open
```

Páginas: <http://localhost:5173> (portada), <http://localhost:5173/carta.html> (menú) y
<http://localhost:5173/domicilios.html> (pedidos). **No abras `index.html` con doble clic**: la dirección sería
`file:///…` y los navegadores bloquean la carga de módulos y datos; siempre debe verse como `localhost:5173`.

- Si dice *"el puerto 5173 ya está en uso"*, el sitio **ya está corriendo**: abre <http://localhost:5173>.
- Para otro puerto: `PORT=3000 node server.mjs` (en PowerShell: `$env:PORT=3000; node server.mjs`).
- Cualquier página `.html` nueva en la raíz ya se sirve sola (no hace falta registrarla ni reiniciar), pero acuérdate de
  darle su CSP (copia la de otra página; `npm test` verifica que coincida) y de añadirla a `NAV` en `js/ui/chrome.js`.

## Estructura

```
index.html          Portada (las 4 opciones)            ┐ cada página lleva su política
ubicacion.html      Sedes (abren Google Maps)            ├ de seguridad (CSP) y carga un
carta.html          Menú, solo para consultar            ├ script de arranque de js/pages/
domicilios.html     Menú con carrito y pedido            ┘
css/                tokens (colores/medidas) · base · layout · components
js/
  app.js            Arranque común: carga datos, valida y dibuja según la página
  pages/            home.js · ubicacion.js · carta.js · domicilios.js (cada uno solo dice qué página es)
  config.js         Hosts permitidos, límites, moneda, logo por defecto
  data/             load.js (descarga) · schema.js (validación estricta)
  features/         search.js (búsqueda) · cart.js (carrito) · order.js (validar y armar el pedido)
  lib/              dom.js (DOM seguro) · url.js (enlaces seguros) · text.js · format.js
  ui/               chrome.js (encabezado y pie con menú) · home.js (opciones y sedes)
                    card.js (tarjeta + botón +) · detail.js · sheet.js (ventana en celular)
                    menu.js · recommended.js · cart.js (panel "Tu pedido") · controls.js · scroll.js · site.js
data/
  menu.json         LA CARTA: categorías, productos, recomendados
  site.json         Sedes (con su WhatsApp), contacto, horarios, redes
_headers            Cabeceras de seguridad para publicar
iniciar.bat         Doble clic en Windows: arranca el servidor y abre el sitio
iniciar-panel.bat   Doble clic en Windows: arranca el panel administrativo (http://localhost:3000)
admin/              Panel administrativo (Next.js + Clerk). Tiene su propio package.json y README
server.mjs          Servidor local (usa las mismas cabeceras que producción)
test/               Pruebas automáticas
```

## Editar la carta (`data/menu.json`)

Un producto:

```json
{
  "id": "gaucha-burger",
  "categories": ["burgers"],
  "name": "GAUCHA BURGER",
  "price": 37900,
  "description": "150 gramos de carne premium al carbón, queso mozzarella…",
  "note": "Todas nuestras burgers vienen acompañadas de papas a la francesa…",
  "featured": true,
  "image": "https://images.cluvi.com/…/foto.jpg"
}
```

| Campo | Obligatorio | Qué hace |
|---|---|---|
| `id` | sí | Único, en minúsculas y con guiones (`mi-plato`). Se usa en enlaces compartibles. |
| `categories` | sí | Una o más categorías. La primera es donde aparece en la vista "Todo". |
| `name`, `price` | sí | Nombre y precio **en pesos, número entero** (`34900`, no `"$34.900"`). |
| `description` | no | Texto del plato. Una línea en blanco (`\n\n`) crea un párrafo nuevo. |
| `includes` | no | Lista de lo que trae (`["Taco de Chili", "Taco de Brisket"]`). |
| `note` | no | Aclaración, p. ej. con qué se acompaña. |
| `units` | no | Presentación: `"10 unds."`. |
| `availability` | no | Horario/día: `"De 12:00 pm a 4:00 pm"`. |
| `variants` | no | Otras presentaciones con precio: `[{ "label": "Jarra", "price": 33900 }]`. |
| `award` | no | Premio, p. ej. `"Ganadora Burger Master 2026"`. |
| `featured` | no | Muestra la estrella "Favorito". |
| `launch` | no | Muestra "Precio de lanzamiento". |
| `image` | no | Foto. Sin foto se muestra el placeholder de la marca. |

- **Recomendados:** la lista `recommended` (arriba del archivo) define qué platos salen en esa sección y en qué orden.
- **Agotado/retirado:** borra el producto del arreglo `products`.
- Un producto que solo tiene nombre y precio (p. ej. "Salsa de la casa") no se expande: no hay más que mostrar.

Después de editar, ejecuta `npm test`: valida que el JSON esté bien (ids repetidos, precios inválidos, categorías
inexistentes…) antes de que llegue al público. Si un producto inválido llegara a publicarse, el sitio lo omite
y sigue funcionando.

### Categorías y sus banners

Cada categoría de `categories` puede llevar un `banner`: la imagen con el nombre, estrellas y trazos rojos que se ve
encima de sus productos (son los mismos banners del sitio original). Si una categoría no tiene `banner` (hoy *To Share*)
o la imagen falla, se muestra su nombre en texto con el mismo estilo rojo y estrellas.

```json
{ "id": "burgers", "name": "Burgers", "banner": "https://images-mini.cluvi.com/…/w_768_…_banner.png" }
```

Los banners miden 768 × 192 px (proporción 4:1). La carta usa el gris `#383838` con el patrón de dibujos del original como
fondo de página, tarjetas negras y botones de categoría negros con texto rojo (rojos al seleccionarlos); los colores
están en `css/tokens.css`.

## Pedidos por WhatsApp

1. El cliente toca **+** en cualquier producto (también en *Adicionales*). Los productos con presentaciones
   (p. ej. cerveza o jarra) abren su detalle para elegir; ahí también puede cambiar la cantidad.
2. Abre **Tu pedido** (botón del carrito arriba o barra roja inferior): puede ajustar cantidades y añadir una nota
   por producto (“sin cebolla”).
3. Debe **elegir la sede** (no viene preseleccionada), si es *Domicilio* o *Recoger*, y dejar nombre, teléfono y,
   si es domicilio, la dirección.
4. Al enviar se abre WhatsApp con el pedido ya escrito, dirigido al número **de la sede elegida**. El restaurante lo
   confirma por ahí (incluido el valor del domicilio). El sitio **no cobra ni guarda pedidos**.

El mensaje está escrito en la voz del cliente, con saludo según la hora, código de pedido (`BG-0710-1932`), productos
con su nota, subtotal y datos ordenados. Su formato vive en `buildOrderMessage` (`js/features/order.js`) y está
cubierto por pruebas, por si quieren ajustar el tono o los emojis.

Las sedes y sus números se configuran en `data/site.json`:

```json
"locations": [
  { "id": "cra-21", "name": "Sede Cra 21", "address": "Cra 21 # 48-08 L2", "whatsapp": "+57 304 270 3186" },
  { "id": "le-meridiem-golf", "name": "Sede Le Meridiem Golf", "address": "CC Le Meridiem Golf, Cra 59b # 81-158 L 301", "whatsapp": "+57 301 749 1089" }
]
```

- Para agregar una sede: añade otro bloque con un `id` único (minúsculas y guiones). Una sede sin WhatsApp válido se
  muestra en "Sedes" pero no recibe pedidos.
- Los precios del pedido salen de `menu.json`. Hoy hay **una sola carta** para ambas sedes; si una sede tuviera
  precios o platos distintos habría que separar el menú por sede.
- Límites: 20 unidades por producto y 30 productos distintos por pedido (evita mensajes demasiado largos).
- El pedido en curso se guarda en el navegador del cliente (`localStorage`) para no perderlo si recarga; no sale de su
  dispositivo hasta que él decide enviarlo.

## Datos del restaurante (`data/site.json`)

### Sedes y Google Maps

Cada sede de `locations` se muestra en la página de ubicación como una tarjeta que **abre Google Maps** en una pestaña nueva. Por
defecto el enlace se genera solo, con una búsqueda oficial de Google Maps por *nombre del restaurante + dirección*.
Para que llegue **exactamente** al punto del negocio, abre la sede en Google Maps, toca *Compartir → Copiar enlace* y
pégalo en `mapsUrl`:

```json
{ "id": "cra-21", "name": "Sede Cra 21", "address": "Cra 21 # 48-08 L2", "whatsapp": "+57 304 270 3186",
  "mapsUrl": "https://maps.app.goo.gl/…" }
```

### Portada

- `logo`: logo del encabezado. `tiles`: foto de fondo de cada opción de la portada (`ubicacion`, `domicilio`, `menu`,
  `reserva`). Solo se aceptan imágenes de los hosts permitidos (`js/config.js`) o de `assets/`.
- **Reserva:** la tarjeta se muestra como *"Muy pronto"* y no es un enlace. Cuando esté lista, se activa en
  `TILES` (`js/ui/home.js`) quitando `soon: true` y poniendo su `href`.

### Contacto adicional

Completa lo que tengas; **lo que dejes vacío no se muestra** (horarios, teléfono general y redes aparecen bajo las sedes
solo si los configuras).

```json
{
  "contact": {
    "address": "Calle … # …", "city": "…",
    "phone": "+57 300 123 4567", "whatsapp": "573001234567",
    "email": "hola@…", "mapsUrl": "https://maps.app.goo.gl/…"
  },
  "hours": [{ "label": "Lunes a jueves", "value": "12:00 pm - 10:00 pm" }],
  "social": { "instagram": "@usuario", "facebook": "pagina", "tiktok": "@usuario" },
  "reviewUrl": "https://…"
}
```

Teléfonos, WhatsApp y redes se escriben como datos simples; el sitio construye los enlaces (así nadie puede colar una
URL maliciosa por error). `mapsUrl` solo acepta Google Maps/Waze.

## Seguridad

No hay servidor ni base de datos, así que no existe inyección SQL ni credenciales que robar. El riesgo real en un
sitio así es el **XSS** (código malicioso en el navegador), el clickjacking y dependencias de terceros. Cómo se cubre:

| Riesgo | Defensa |
|---|---|
| XSS | El texto **nunca** entra como HTML: se construye el DOM con `textContent` (`js/lib/dom.js`). Está prohibido `innerHTML`, `eval`, etc. y un test lo verifica. |
| XSS (segunda capa) | CSP estricta: solo scripts y estilos propios, sin inline, sin `eval`. Aunque alguien lograra inyectar código, el navegador no lo ejecuta. |
| Datos manipulados | `js/data/schema.js` valida tipo, largo y formato de cada campo; descarta lo inválido y copia solo campos conocidos. |
| Enlaces e imágenes maliciosas | Lista blanca: solo `https` y los hosts de `config.js`; se bloquean `javascript:`, `data:`, credenciales, puertos, etc. |
| Búsqueda / parámetros de la URL | Se limpian y limitan; nunca se usan como regex ni como HTML; `cat` y `p` se validan contra los datos reales. |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| Tabnabbing | Enlaces externos con `rel="noopener noreferrer"`. |
| Cadena de suministro | Cero dependencias, cero scripts de CDN. |
| Pedidos manipulados | El número de WhatsApp sale **solo** de `site.json` (validado a dígitos), nunca de lo que escribe el cliente. Los precios se recalculan desde `menu.json` (lo guardado en el navegador se valida y se ignora si fue alterado). Antes de abrir el enlace se comprueba que sea exactamente `https://wa.me/<número>?text=…`. |
| Inyección en el mensaje | Los datos del cliente se limpian (largo, caracteres de control y símbolos de formato de WhatsApp). |
| Privacidad | Sin cookies ni analítica: no hace falta banner de cookies. Solo se usa `localStorage` para recordar el pedido en curso, en el dispositivo del cliente. |

### Al publicar

La CSP también viaja dentro de `index.html`, pero **algunas protecciones solo funcionan como cabecera HTTP**
(`frame-ancestors`, HSTS…). Publícalo en un hosting que aplique `_headers`:

- **Netlify / Cloudflare Pages:** ya funciona, `_headers` se aplica solo.
- **Vercel:** traduce `_headers` a la sección `headers` de `vercel.json`.
- **nginx:** repite cada línea como `add_header Nombre "valor" always;` dentro de `server { … }`.
- **Apache:** `Header always set Nombre "valor"` (módulo `mod_headers`).

Siempre sobre **HTTPS**. Puedes comprobar el resultado en <https://securityheaders.com>.

## Pruebas

```bash
npm test
```

Cubren: validación de URLs y enlaces, esquema de datos, búsqueda, integridad de `menu.json`, que la CSP de
`index.html` y `_headers` coincidan, y que el código no use APIs peligrosas.

## Publicar el sitio público (Cloudflare)

El repositorio guarda también el panel, las pruebas y herramientas locales; **nada de eso se publica**.
`npm run build` copia a `dist/` solo lo público (lista cerrada en [`scripts/build-public.mjs`](scripts/build-public.mjs):
las 4 páginas, `css/`, `js/`, `data/`, `assets/`, `robots.txt` y `_headers`) y `wrangler.jsonc` le dice a Cloudflare que
sirva esa carpeta. En Cloudflare (Workers & Pages → importar desde GitHub): *Build command* `npm run build`, *Deploy
command* `npx wrangler deploy`. Si se agrega una página o carpeta pública nueva, hay que sumarla a `PUBLIC_ENTRIES`
(hay una prueba que avisa si algo sobra o falta). El panel (`admin/`) **no** se publica aquí: necesita servidor.

## Próximas etapas (acordadas, aún sin implementar)

- **Panel administrativo** (en curso, carpeta [`admin/`](admin/README.md)): que el restaurante pueda añadir y quitar
  platos, cambiar precios y subir banners sin tocar archivos. Es una app aparte (Next.js + **Clerk** para el inicio de
  sesión) que escribe el mismo `data/menu.json` (con validación estricta); el sitio público no depende de ella y sigue
  siendo estático. **Hecho:** acceso seguro (todo exige sesión, solo administra la organización del restaurante) y
  **editor de la carta**: productos (datos, variantes, etiquetas y fotos) y categorías (banner y orden), con copias de
  seguridad automáticas. **Falta:** ventana promocional, editar sedes/horarios, y decidir dónde se guardan los datos en
  producción. Arranque: `iniciar-panel.bat`.
- **Ventana promocional** como la del sitio original: tras un rato viendo la carta aparece *"Inicia tu experiencia con:"*
  con 3 productos sugeridos (foto, nombre, precio y botón *Ver*). Configurable desde el panel: título, productos, segundos
  de espera, frecuencia (p. ej. una vez por visita) y activa/inactiva.
- **Reserva:** la tarjeta "Hacer una reserva" de la portada ya existe como *"Muy pronto"*.

## Pendientes recomendados

1. **Horarios y redes** en `data/site.json` (las sedes y sus WhatsApp ya están cargados).
2. **Fotos propias:** hoy las imágenes se cargan del servicio actual (`images.cluvi.com`). Si ese servicio cambia o
   se cancela, las fotos dejarían de verse. Descárgalas a `assets/` y cambia las rutas en `menu.json`
   (p. ej. `"image": "assets/gaucha-burger.webp"`); las rutas locales ya están soportadas y permitidas.
3. **Tipografía de marca:** se usan fuentes del sistema (rápidas y sin terceros). Para usar Oswald/Poppins,
   alójalas en `assets/fonts/` (formato `.woff2`) y agrégalas con `@font-face` en `css/base.css`; no hace falta
   tocar la CSP porque `font-src 'self'` ya lo permite.
4. **Logo oficial / favicon:** `assets/favicon.svg` es genérico; reemplázalo por el de la marca.
