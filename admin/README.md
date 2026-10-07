# Panel administrativo — Barbecue Garage

Aplicación aparte (Next.js 16 + [Clerk](https://clerk.com)) para administrar la carta. **El sitio público no
depende de ella**: sigue siendo estático. El panel escribe el mismo archivo de datos (`../data/menu.json`) que el
sitio ya sabe leer y validar.

Estado actual: **acceso seguro + editor de la carta**. Siguen: banners/ventana promocional "Inicia tu experiencia
con:" y editar sedes/horarios (`site.json`).

## Qué se puede editar

| Pantalla | Para qué |
|---|---|
| **Resumen** (`/`) | Conteos y atajos. |
| **Productos** (`/productos`) | Buscar y filtrar por categoría; crear, editar y eliminar. Por producto: nombre, precio, categorías (varias), descripción, "qué incluye", nota, presentación, disponibilidad, otras presentaciones con precio (variantes), premio, etiquetas (favorito ★, precio de lanzamiento, recomendado) y **foto** (subir, cambiar o quitar). |
| **Categorías** (`/categorias`) | Crear, editar (nombre, subtítulo, aviso), **subir/quitar el banner**, **cambiar el orden** con las flechas y eliminar (solo si está vacía). |

Cada cambio se ve al instante en el sitio público (que lee el mismo `data/menu.json`).

### Cómo se guardan los cambios (seguro)

- Todo pasa por `lib/menu-store.ts`: las escrituras se **encolan** (dos personas guardando a la vez no se pisan), el
  resultado completo se **valida con el esquema del sitio público** (`../js/data/schema.js`) y si algo quedaría
  inválido o se perdería en silencio, **no se escribe nada**.
- Antes de cada cambio se guarda una **copia de seguridad** con fecha en `admin/.data-backups/` (las últimas 30; está
  en `.gitignore`). Para deshacer un cambio, copia el archivo de respaldo sobre `data/menu.json`.
- Escritura **atómica** (archivo temporal + renombrar): un corte a mitad no deja la carta a medias.
- Los identificadores (`id`) los genera el servidor desde el nombre y **no cambian al editar**, así los enlaces y el
  carrito de la gente no se rompen.

### Fotos (`lib/media.ts`)

- Se aceptan **JPG, PNG, WebP y AVIF** (se reconocen por su contenido real, no por el nombre; SVG, GIF y cualquier
  otra cosa se rechazan) de hasta **8 MB**.
- Se **reducen** (1200 px de ancho las de producto, 1600 las de banner), se convierten a **WebP** y se les **borran
  los datos ocultos** (EXIF/ubicación GPS) con `sharp`.
- El servidor les pone nombre (`assets/menu/<nombre>-<8 letras>.webp`); el usuario nunca decide una ruta.
- Al reemplazar o quitar una foto, la anterior se borra **solo si es una foto propia** (`assets/menu/…`) y **ninguna
  otra cosa la usa**. Las fotos antiguas que vienen de internet no se tocan.
- En el panel las fotos se ven por `/media/<nombre>` (ruta protegida, exige sesión de administrador).

## Arrancar

En Windows: doble clic en **`iniciar-panel.bat`** (en la raíz del proyecto) → <http://localhost:3000>.
O desde una terminal: `cd admin && npm run dev`.

## Primera configuración (una sola vez)

1. Abre <http://localhost:3000> y **crea tu cuenta** (la crea Clerk; el panel nunca guarda contraseñas).
2. Entrarás a **/acceso** ("Falta autorizar a la organización del restaurante"). Con el selector de arriba,
   **crea la organización** del restaurante: quien la crea queda como administrador.
3. Copia el identificador `org_…` que muestra la página, pégalo en `admin/.env.local` como
   `ADMIN_ORG_ID=org_…` y reinicia el panel.
4. Recomendado: en el [dashboard de Clerk](https://dashboard.clerk.com) → *Configure → Restrictions*, deja el
   registro **solo por invitación**, para que nadie más pueda crear cuentas. Invita desde la organización a quien
   deba administrar (rol *Admin*).

## Cómo está protegido

| Capa | Qué hace |
|---|---|
| `proxy.ts` | Todo exige sesión, salvo `/sign-in` y `/sign-up` (denegar por defecto). Es una barrera rápida, no la única. |
| `lib/access.ts` → `requireAdmin()` | Se llama al inicio de **cada** página, Route Handler o Server Action. Exige sesión + organización activa **igual a `ADMIN_ORG_ID`** + rol `org:admin`. |
| Organización fija | No basta ser admin de *alguna* organización (cualquiera podría crear la suya): debe ser la del restaurante. |
| Cabeceras (`next.config.ts`) | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, sin `X-Powered-By`. |
| `robots: noindex` | El panel no aparece en buscadores. |
| Llaves | `.env.local` está en `.gitignore`. **Nunca** subas ni compartas `CLERK_SECRET_KEY`. `.env.example` lista las variables sin valores. |

Regla para lo que venga: **ninguna lectura o escritura de datos sin `await requireAdmin()` antes** (cada Server Action
lo llama primero: son endpoints públicos aunque nadie los enlace), y validar siempre los datos recibidos con las
mismas reglas del sitio (`../js/data/schema.js`). Los mensajes que aparecen tras guardar/eliminar vienen de una lista
fija (nunca se imprime texto tomado de la dirección) y los registros `[admin]` llevan el id del usuario que hizo el cambio.

## Pruebas

`npm test` (en `admin/`): 29 pruebas de la lógica del editor (ids, reconocimiento de imágenes, formularios, guardado
con validación/concurrencia/copias, procesado de fotos). Desde la raíz, `node --test` corre todas (85).

## Clerk

- Aplicación enlazada: *barbecue garage* (instancia de **desarrollo**). Las organizaciones ya están habilitadas.
- Comprobar la integración: `npx clerk@latest doctor`.
- **Producción:** aún no existe. `npx clerk@latest deploy` crea la instancia de producción, te da los registros DNS y
  necesita un **dominio propio** para el panel; hay que correrlo en una terminal (es interactivo).
- La CLI de Clerk envía telemetría de uso; se desactiva con `npx clerk@latest telemetry disable`.

## Pendiente / próximas mejoras

- Banners/ventana promocional "Inicia tu experiencia con:" y edición de sedes/horarios/redes (`site.json`).
- Reordenar productos dentro de una categoría (hoy salen en el orden en que están en el archivo; los nuevos van al final).
- **Dónde se guardan los datos en producción.** Hoy el panel escribe `../data/menu.json` y `../assets/menu/` en el
  disco (sirve en tu computador o en un servidor propio con disco). En un hosting como Vercel el disco es de solo
  lectura: habrá que cambiar el almacenamiento por una base de datos / almacenamiento de archivos. Está aislado en
  `lib/menu-store.ts` (datos) y `lib/media.ts` (fotos), así que el cambio no toca las pantallas.
- Textos de Clerk en español (`@clerk/localizations`) y política CSP estricta con nonces.
- Las 5 alertas "high" de `npm audit` son de herramientas de desarrollo (ESLint) y no llegan a producción
  (`npm audit --omit=dev` = 0). No ejecutes `npm audit fix --force`.
