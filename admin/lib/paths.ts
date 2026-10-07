import path from "node:path";

// Etapa local: el panel (en <raíz>/admin) edita directamente los archivos del sitio público.
// Todas las rutas salen de aquí; nunca se arman con texto que escriba una persona.

/** Raíz del proyecto. `next dev` / `next start` se ejecutan dentro de admin/. */
export const REPO_ROOT = path.resolve(process.cwd(), "..");

export const DATA_FILE = path.join(REPO_ROOT, "data", "menu.json");

/** Carpeta de fotos de productos y banners (la sirve el sitio público como assets/menu/…). */
export const MENU_ASSETS_DIR = path.join(REPO_ROOT, "assets", "menu");

/** Copias de seguridad de la carta antes de cada cambio (fuera de las carpetas públicas). */
export const BACKUP_DIR = path.join(process.cwd(), ".data-backups");

/** Prefijo con el que el sitio público referencia las fotos locales. */
export const PUBLIC_IMAGE_PREFIX = "assets/menu/";
