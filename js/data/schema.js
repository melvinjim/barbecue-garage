import { LIMITS } from '../config.js';
import {
  emailHref,
  facebookHref,
  googleMapsSearchUrl,
  httpsHref,
  instagramHref,
  mapsHref,
  sanitizeImageUrl,
  telHref,
  tiktokHref,
  whatsappHref,
  whatsappNumber,
} from '../lib/url.js';

// Validación estricta de los JSON de datos. Es una función pura (sin DOM),
// así que se ejecuta igual en el navegador y en los tests de Node.
//
// Principios:
//  - Se copian SOLO los campos conocidos (los demás se ignoran).
//  - Todo texto tiene tipo y largo máximo; se eliminan caracteres de control.
//  - Un producto inválido se omite con una advertencia; no rompe la página.

export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaError';
  }
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Formato válido de un id (minúsculas, números y guiones). Lo reutiliza el panel administrativo. */
export const ID_PATTERN = ID_RE;

/**
 * Límites de cada campo de la carta. Los usa este validador y también el panel
 * administrativo, para que lo que se guarda desde allí SIEMPRE lo acepte el sitio.
 */
export const FIELD_LIMITS = Object.freeze({
  productId: 80,
  productName: 100,
  description: 900,
  note: 400,
  availability: 120,
  units: 40,
  award: 80,
  includesItems: 12,
  includeLength: 80,
  variants: 6,
  variantLabel: 30,
  productCategories: 6,
  categoryId: 40,
  categoryName: 40,
  categorySubtitle: 60,
  categoryNote: 120,
  recommended: 12,
});

/** Opciones de la portada que pueden llevar una foto de fondo (data/site.json → "tiles"). */
const TILE_IDS = Object.freeze(['ubicacion', 'domicilio', 'menu', 'reserva']);
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Texto de una línea (sin saltos), o undefined. */
function line(value, max) {
  if (typeof value !== 'string') return undefined;
  const s = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : undefined;
}

/** Texto multilínea (conserva \n), o undefined. */
function block(value, max) {
  if (typeof value !== 'string') return undefined;
  const s = value
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .trim();
  return s && s.length <= max ? s : undefined;
}

function lineList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return undefined;
  const out = value.slice(0, maxItems).map((v) => line(v, maxLen)).filter(Boolean);
  return out.length ? Object.freeze(out) : undefined;
}

function parseVariants(value) {
  if (!Array.isArray(value)) return undefined;
  const out = [];
  for (const v of value.slice(0, FIELD_LIMITS.variants)) {
    const label = isObject(v) ? line(v.label, FIELD_LIMITS.variantLabel) : undefined;
    const price = isObject(v) ? v.price : undefined;
    if (label && Number.isInteger(price) && price >= 0 && price <= LIMITS.price) {
      out.push(Object.freeze({ label, price }));
    }
  }
  return out.length ? Object.freeze(out) : undefined;
}

function parseProduct(raw, categoryIds) {
  if (!isObject(raw)) return { reason: 'no es un objeto' };

  const id = typeof raw.id === 'string' && raw.id.length <= FIELD_LIMITS.productId && ID_RE.test(raw.id) ? raw.id : null;
  if (!id) return { reason: 'id inválido' };

  const name = line(raw.name, FIELD_LIMITS.productName);
  if (!name) return { reason: `${id}: nombre inválido` };

  const price = raw.price;
  if (!Number.isInteger(price) || price < 0 || price > LIMITS.price) {
    return { reason: `${id}: precio inválido` };
  }

  const categories = Array.isArray(raw.categories)
    ? [...new Set(raw.categories.filter((c) => typeof c === 'string' && categoryIds.has(c)))].slice(0, FIELD_LIMITS.productCategories)
    : [];
  if (!categories.length) return { reason: `${id}: categoría desconocida` };

  const product = { id, name, price, categories: Object.freeze(categories) };

  const description = block(raw.description, FIELD_LIMITS.description);
  const note = block(raw.note, FIELD_LIMITS.note);
  const availability = line(raw.availability, FIELD_LIMITS.availability);
  const units = line(raw.units, FIELD_LIMITS.units);
  const award = line(raw.award, FIELD_LIMITS.award);
  const includes = lineList(raw.includes, FIELD_LIMITS.includesItems, FIELD_LIMITS.includeLength);
  const variants = parseVariants(raw.variants);
  const image = raw.image === undefined ? null : sanitizeImageUrl(raw.image);

  if (description) product.description = description;
  if (note) product.note = note;
  if (availability) product.availability = availability;
  if (units) product.units = units;
  if (award) product.award = award;
  if (includes) product.includes = includes;
  if (variants) product.variants = variants;
  if (image) product.image = image;
  if (raw.featured === true) product.featured = true;
  if (raw.launch === true) product.launch = true;

  return { product: Object.freeze(product), warning: raw.image !== undefined && !image ? `${id}: imagen rechazada` : null };
}

/** Valida data/menu.json. Lanza SchemaError si no hay nada utilizable. */
export function parseMenu(raw) {
  if (!isObject(raw) || !Array.isArray(raw.categories) || !Array.isArray(raw.products)) {
    throw new SchemaError('menu.json: estructura inválida');
  }
  const warnings = [];

  const categories = [];
  const categoryIds = new Set();
  for (const c of raw.categories.slice(0, LIMITS.categories)) {
    const id = isObject(c) && typeof c.id === 'string' && ID_RE.test(c.id) && c.id.length <= FIELD_LIMITS.categoryId ? c.id : null;
    const name = isObject(c) ? line(c.name, FIELD_LIMITS.categoryName) : undefined;
    if (!id || !name || categoryIds.has(id)) {
      warnings.push(`Categoría omitida: ${String(id ?? '?')}`);
      continue;
    }
    const category = { id, name };
    const subtitle = line(c.subtitle, FIELD_LIMITS.categorySubtitle);
    const note = line(c.note, FIELD_LIMITS.categoryNote);
    const banner = c.banner === undefined ? null : sanitizeImageUrl(c.banner);
    if (subtitle) category.subtitle = subtitle;
    if (note) category.note = note;
    if (banner) category.banner = banner;
    else if (c.banner !== undefined) warnings.push(`Banner rechazado: ${id}`);
    categories.push(Object.freeze(category));
    categoryIds.add(id);
  }
  if (!categories.length) throw new SchemaError('menu.json: sin categorías válidas');

  const products = [];
  const productIds = new Set();
  for (const item of raw.products.slice(0, LIMITS.products)) {
    const { product, reason, warning } = parseProduct(item, categoryIds);
    if (!product) {
      warnings.push(`Producto omitido (${reason})`);
      continue;
    }
    if (productIds.has(product.id)) {
      warnings.push(`Producto duplicado omitido: ${product.id}`);
      continue;
    }
    if (warning) warnings.push(warning);
    productIds.add(product.id);
    products.push(product);
  }
  if (!products.length) throw new SchemaError('menu.json: sin productos válidos');

  const recommended = Array.isArray(raw.recommended)
    ? [...new Set(raw.recommended.filter((id) => typeof id === 'string' && productIds.has(id)))].slice(0, FIELD_LIMITS.recommended)
    : [];

  return Object.freeze({
    categories: Object.freeze(categories),
    products: Object.freeze(products),
    recommended: Object.freeze(recommended),
    warnings: Object.freeze(warnings),
  });
}

function linkItem(label, href) {
  return label && href ? Object.freeze({ label, href }) : null;
}

/**
 * Sedes del restaurante. Cada sede con WhatsApp válido puede recibir pedidos;
 * el número se guarda solo como dígitos (nunca como URL escrita a mano).
 * El enlace a Google Maps sale de `mapsUrl` (si se define) o, si no, de una
 * búsqueda oficial de Google Maps con el nombre del restaurante y la dirección.
 */
function parseLocations(value, brand) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const seen = new Set();
  const out = [];
  for (const raw of value.slice(0, 6)) {
    if (!isObject(raw)) continue;
    const id = typeof raw.id === 'string' && raw.id.length <= 40 && ID_RE.test(raw.id) ? raw.id : null;
    const name = line(raw.name, 50);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);

    const label = line(raw.whatsapp, 24);
    const number = label ? whatsappNumber(label) : null;
    const address = line(raw.address, 120);
    const explicitMaps = typeof raw.mapsUrl === 'string' ? mapsHref(raw.mapsUrl) : null;
    out.push(
      Object.freeze({
        id,
        name,
        address,
        whatsapp: number ? Object.freeze({ label, number, href: `https://wa.me/${number}` }) : null,
        maps: explicitMaps ?? (address ? googleMapsSearchUrl(`${brand} ${address}`) : null),
      }),
    );
  }
  return Object.freeze(out);
}

/**
 * Valida data/site.json. Todo es opcional: lo que esté vacío o sea inválido
 * simplemente no se muestra. Los enlaces se construyen a partir de datos
 * simples (teléfono, usuario…), nunca de URLs escritas a mano.
 */
export function parseSite(raw) {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.contact) ? r.contact : {};
  const s = isObject(r.social) ? r.social : {};

  const phone = line(c.phone, 24);
  const whatsapp = line(c.whatsapp, 24);
  const email = line(c.email, 120);
  const instagram = line(s.instagram, 31);
  const facebook = line(s.facebook, 50);
  const tiktok = line(s.tiktok, 25);

  const hours = Array.isArray(r.hours)
    ? r.hours
        .slice(0, 10)
        .map((h) => (isObject(h) ? { label: line(h.label, 40), value: line(h.value, 60) } : null))
        .filter((h) => h?.label && h?.value)
        .map((h) => Object.freeze(h))
    : [];

  const social = [
    linkItem('Instagram', instagram && instagramHref(instagram)),
    linkItem('Facebook', facebook && facebookHref(facebook)),
    linkItem('TikTok', tiktok && tiktokHref(tiktok)),
  ].filter(Boolean);

  const tiles = {};
  for (const key of TILE_IDS) {
    const image = isObject(r.tiles) ? sanitizeImageUrl(r.tiles[key]) : null;
    if (image) tiles[key] = image;
  }

  return Object.freeze({
    name: line(r.name, 60),
    branch: line(r.branch, 60),
    tagline: line(r.tagline, 80),
    description: line(r.description, 240),
    logo: sanitizeImageUrl(r.logo),
    tiles: Object.freeze(tiles),
    locations: parseLocations(r.locations, line(r.name, 60) ?? 'Barbecue Garage'),
    contact: Object.freeze({
      address: line(c.address, 120),
      city: line(c.city, 60),
      phone: linkItem(phone, phone && telHref(phone)),
      whatsapp: linkItem(whatsapp, whatsapp && whatsappHref(whatsapp)),
      email: linkItem(email, email && emailHref(email)),
      maps: typeof c.mapsUrl === 'string' ? mapsHref(c.mapsUrl) : null,
    }),
    hours: Object.freeze(hours),
    social: Object.freeze(social),
    reviewHref: typeof r.reviewUrl === 'string' ? httpsHref(r.reviewUrl) : null,
  });
}
