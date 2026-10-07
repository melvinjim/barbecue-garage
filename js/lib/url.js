import { IMAGE_HOSTS, MAP_HOSTS } from '../config.js';

// Toda URL que llega a un atributo href/src pasa por aquí.
// Regla general: lista blanca estricta; ante la duda, se rechaza.

const LOCAL_IMAGE = /^assets\/[A-Za-z0-9_/-]+\.(?:jpe?g|png|webp|avif|svg)$/;
const REMOTE_PATH = /^\/[A-Za-z0-9._\-/%]+$/;

/** Devuelve un URL https sin credenciales ni puerto, o null. */
export function parseHttpsUrl(value, allowedHosts) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (allowedHosts && !allowedHosts.includes(url.hostname)) return null;
  return url;
}

/** Imagen local (assets/…) o remota de un host permitido. Devuelve el src limpio o null. */
export function sanitizeImageUrl(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (LOCAL_IMAGE.test(v)) return v;
  const url = parseHttpsUrl(v, IMAGE_HOSTS);
  if (!url || url.search || url.hash || !REMOTE_PATH.test(url.pathname)) return null;
  return url.href;
}

export const isAllowedImageUrl = (value) => sanitizeImageUrl(value) !== null;

/** Hrefs permitidos en el DOM: ancla interna, tel:, mailto: o https. */
export function safeHref(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#[A-Za-z0-9_-]{1,64}$/.test(v)) return v;
  // Páginas del propio sitio (carta.html, index.html#sedes…)
  if (/^[a-z0-9-]{1,30}\.html(?:#[A-Za-z0-9_-]{1,64})?$/.test(v)) return v;
  if (/^tel:\+?[0-9]{6,15}$/.test(v)) return v;
  if (/^mailto:[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/.test(v)) return v;
  return parseHttpsUrl(v)?.href ?? null;
}

// --- Constructores de enlaces de contacto -------------------------------
// A partir de datos "crudos" (teléfono, usuario…) generan el enlace completo,
// así nunca se acepta una URL arbitraria escrita a mano en site.json.

export function telHref(input) {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  if (!/^\+?[0-9 ()\-.]{6,24}$/.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  return `tel:${v.startsWith('+') ? '+' : ''}${digits}`;
}

/** "+57 304 270 3186" → "573042703186" (solo dígitos, 8 a 15), o null. */
export function whatsappNumber(input) {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s+()-]/g, '');
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function whatsappHref(input) {
  const number = whatsappNumber(input);
  return number ? `https://wa.me/${number}` : null;
}

export function emailHref(input) {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  return /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/.test(v) ? `mailto:${v}` : null;
}

export function mapsHref(input) {
  return parseHttpsUrl(input, MAP_HOSTS)?.href ?? null;
}

/** Enlace oficial de búsqueda de Google Maps para un texto (nombre + dirección). */
export function googleMapsSearchUrl(query) {
  const text =
    typeof query === 'string'
      ? query.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      : '';
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}

export function httpsHref(input) {
  return parseHttpsUrl(input)?.href ?? null;
}

export function instagramHref(handle) {
  const v = typeof handle === 'string' ? handle.trim().replace(/^@/, '') : '';
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? `https://www.instagram.com/${v}/` : null;
}

export function facebookHref(page) {
  const v = typeof page === 'string' ? page.trim() : '';
  return /^[A-Za-z0-9.-]{1,50}$/.test(v) ? `https://www.facebook.com/${v}` : null;
}

export function tiktokHref(handle) {
  const v = typeof handle === 'string' ? handle.trim().replace(/^@/, '') : '';
  return /^[A-Za-z0-9._]{1,24}$/.test(v) ? `https://www.tiktok.com/@${v}` : null;
}
