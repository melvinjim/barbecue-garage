// Configuración central del sitio.
// Si agregas o cambias un host de imágenes, actualiza también la CSP en
// index.html y en _headers (hay un test que verifica que coincidan).

/** Hosts desde los que se permite cargar fotos de productos. */
export const IMAGE_HOSTS = Object.freeze(['images.cluvi.com', 'images-mini.cluvi.com']);

/** Hosts permitidos para el enlace "Cómo llegar". */
export const MAP_HOSTS = Object.freeze([
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'maps.google.com',
  'waze.com',
  'www.waze.com',
  'ul.waze.com',
]);

export const DATA_URLS = Object.freeze({
  menu: 'data/menu.json',
  site: 'data/site.json',
});

export const LOCALE = 'es-CO';
export const CURRENCY = 'COP';

/** Límites defensivos: cualquier dato que los exceda se descarta. */
export const LIMITS = Object.freeze({
  categories: 40,
  products: 1000,
  query: 60,
  price: 10_000_000,
  jsonBytes: 1_500_000,
});

/** Logo que se usa si data/site.json no define uno. */
export const DEFAULT_LOGO = 'https://images-mini.cluvi.com/JB2A91gDlj/thumb_JB2A91gDlj_x9cjkengze_logo-header.png';
