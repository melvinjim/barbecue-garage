import { formatPrice } from '../lib/format.js';
import { cleanLine, titleCase } from '../lib/text.js';

// Armado y validación del pedido. Lógica pura (sin DOM).
//
// El pedido NO pasa por ningún servidor nuestro: se arma un mensaje de texto y
// se abre WhatsApp hacia el número de la sede elegida. El número sale de
// data/site.json (ya validado), nunca de lo que escribe el cliente.

export const MODES = Object.freeze({
  delivery: 'Domicilio',
  pickup: 'Recoger en el restaurante',
});

export const FIELD_LIMITS = Object.freeze({ name: 60, phone: 20, address: 120, references: 100, comments: 200 });

/** Límite del mensaje ya codificado en la URL (los enlaces muy largos fallan en algunos dispositivos). */
export const MAX_ENCODED_LENGTH = 6000;

const PHONE_RE = /^\+?[0-9 ()\-.]{7,20}$/;

/**
 * @param {object} input  Datos crudos del formulario
 * @param {Array}  locations  Sedes (data/site.json) — solo las que tienen WhatsApp pueden recibir pedidos
 * @returns {{ok:boolean, errors:Record<string,string>, value:object}}
 */
export function validateOrder(input, locations) {
  const errors = {};

  const location = locations.find((l) => l.id === input.locationId && l.whatsapp) ?? null;
  if (!location) errors.location = 'Elige a qué sede quieres hacer tu pedido.';

  const mode = typeof input.mode === 'string' && Object.hasOwn(MODES, input.mode) ? input.mode : null;
  if (!mode) errors.mode = 'Elige cómo quieres recibir tu pedido.';

  const name = cleanLine(input.name, FIELD_LIMITS.name);
  if (name.length < 2) errors.name = 'Escribe tu nombre.';

  const phone = cleanLine(input.phone, FIELD_LIMITS.phone);
  const digits = phone.replace(/\D/g, '').length;
  if (!PHONE_RE.test(phone) || digits < 7 || digits > 15) errors.phone = 'Escribe un teléfono válido (solo números).';

  let address = '';
  if (mode === 'delivery') {
    address = cleanLine(input.address, FIELD_LIMITS.address);
    if (address.length < 5) errors.address = 'Escribe la dirección de entrega.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      location,
      mode,
      name,
      phone,
      address,
      references: mode === 'delivery' ? cleanLine(input.references, FIELD_LIMITS.references) : '',
      comments: cleanLine(input.comments, FIELD_LIMITS.comments),
    },
  };
}

// --- Mensaje de WhatsApp --------------------------------------------------------

// WhatsApp interpreta *negrita*, _cursiva_, ~tachado~ y `código`: se quitan de lo que escribe el cliente.
const plain = (text) => String(text).replace(/[*_~`]/g, '');
const pad = (n) => String(n).padStart(2, '0');

const RULE = '━━━━━━━━━━━━━━━';

function greeting(date) {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  return hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** 19:32 → "07:32 pm" */
function clock(date) {
  const hour = date.getHours();
  return `${pad(hour % 12 || 12)}:${pad(date.getMinutes())} ${hour < 12 ? 'am' : 'pm'}`;
}

/** Código corto para que el restaurante y el cliente se refieran al pedido: BG-0710-1932 */
export function orderCode(date) {
  return `BG-${pad(date.getDate())}${pad(date.getMonth() + 1)}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * Mensaje que el cliente le envía al restaurante. Está escrito desde la voz del
 * cliente (cordial y formal) y con un orden claro para que cocina lo lea de un vistazo.
 */
export function buildOrderMessage({ brand, tagline, order, lines, subtotal, now = new Date() }) {
  const delivery = order.mode === 'delivery';
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  const out = [`🔥 *${plain(brand).toUpperCase()}*`];
  if (tagline) out.push(`_${plain(tagline)}_`);

  out.push(
    '',
    `${greeting(now)} 👋 Quisiera realizar el siguiente pedido en la *${plain(order.location.name)}*.`,
    '',
    `🧾 *Pedido ${orderCode(now)}*`,
    `🗓️ ${date} · ⏰ ${clock(now)}`,
    '',
    RULE,
    '*MI PEDIDO*',
    RULE,
  );

  for (const line of lines) {
    out.push(`*${line.qty} ×* ${plain(titleCase(line.product.name))}${line.variant ? ` (${plain(line.variant)})` : ''} — ${formatPrice(line.total)}`);
    if (line.note) out.push(`      ↳ _${plain(line.note)}_`);
  }

  out.push(RULE, `*Subtotal:* ${formatPrice(subtotal)}`);
  if (delivery) out.push('*Domicilio:* se confirma en este chat');
  out.push(RULE, '', '👤 *DATOS DEL CLIENTE*', `*Nombre:* ${plain(order.name)}`, `*Teléfono:* ${plain(order.phone)}`);
  out.push(delivery ? `🛵 *Servicio:* ${MODES.delivery}` : `🛍️ *Servicio:* ${MODES.pickup}`);
  if (delivery) {
    out.push(`📍 *Dirección:* ${plain(order.address)}`);
    if (order.references) out.push(`*Referencias:* ${plain(order.references)}`);
  }
  if (order.comments) out.push('', `💬 *Comentarios:* ${plain(order.comments)}`);

  out.push('', 'Quedo pendiente de su confirmación. ¡Muchas gracias! 🙏');
  return out.join('\n');
}

/** URL de WhatsApp para un número (solo dígitos) y un mensaje; null si es inválida o demasiado larga. */
export function buildOrderUrl(number, message) {
  if (typeof number !== 'string' || !/^\d{8,15}$/.test(number)) return null;
  const text = encodeURIComponent(message);
  return text.length > MAX_ENCODED_LENGTH ? null : `https://wa.me/${number}?text=${text}`;
}

/** Última barrera antes de abrir un enlace: solo https://wa.me/<dígitos>?text=… */
export function isOrderUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'wa.me' &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^\/\d{8,15}$/.test(u.pathname) &&
      [...u.searchParams.keys()].every((key) => key === 'text')
    );
  } catch {
    return false;
  }
}
