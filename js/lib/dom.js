import { isAllowedImageUrl, safeHref } from './url.js';

// Constructor de DOM seguro.
// - Nunca usa innerHTML: el texto siempre entra como nodo de texto.
// - Solo acepta etiquetas y atributos de una lista blanca (sin <script>, <style>,
//   <iframe>, on*, style).
// - href y src se validan antes de asignarse.

const SVG_NS = 'http://www.w3.org/2000/svg';

const TAGS = new Set([
  'a', 'address', 'article', 'button', 'dd', 'dialog', 'div', 'dl', 'dt', 'em', 'fieldset', 'figure',
  'form', 'h2', 'h3', 'h4', 'header', 'img', 'input', 'label', 'legend', 'li', 'nav', 'ol', 'p',
  'section', 'small', 'span', 'strong', 'textarea', 'ul',
]);

const ATTRS = new Set([
  'alt', 'autocomplete', 'checked', 'class', 'decoding', 'disabled', 'enterkeyhint', 'for', 'form',
  'height', 'hidden', 'id', 'inputmode', 'loading', 'maxlength', 'name', 'placeholder',
  'novalidate', 'referrerpolicy', 'rel', 'required', 'role', 'rows', 'spellcheck', 'tabindex',
  'target', 'title', 'type', 'value', 'width',
]);

const PREFIXED_ATTR = /^(?:aria|data)-[a-z0-9-]+$/;

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.append(child);
    else parent.append(document.createTextNode(String(child)));
  }
}

/**
 * h('p', { class: 'x', on: { click: fn } }, 'texto', otroNodo)
 * Los atributos aria-* se pasan como string ('true' / 'false').
 */
export function h(tag, attrs, ...children) {
  if (!TAGS.has(tag)) throw new Error(`Etiqueta no permitida: ${tag}`);
  const el = document.createElement(tag);

  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null) continue;
    if (value === false && !name.startsWith('aria-')) continue;

    if (name === 'class') {
      el.className = String(value);
    } else if (name === 'on') {
      for (const [type, handler] of Object.entries(value)) {
        if (typeof handler !== 'function') throw new Error(`Manejador inválido: ${type}`);
        el.addEventListener(type, handler);
      }
    } else if (name === 'href') {
      const href = safeHref(value);
      if (href) el.setAttribute('href', href);
      else console.warn('[dom] href rechazado');
    } else if (name === 'src') {
      if (isAllowedImageUrl(value)) el.setAttribute('src', value);
      else console.warn('[dom] src rechazado');
    } else if (ATTRS.has(name) || PREFIXED_ATTR.test(name)) {
      el.setAttribute(name, value === true ? '' : String(value));
    } else {
      throw new Error(`Atributo no permitido: ${name}`);
    }
  }

  if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
  append(el, children);
  return el;
}

/**
 * Contenedor de imagen con placeholder. Si la foto no existe o falla,
 * se muestra la marca "BG" en lugar de un icono roto.
 */
export function media({ src, alt = '', className = '' }) {
  const box = h('div', { class: `media ${className}`.trim() });
  if (!isAllowedImageUrl(src)) {
    box.classList.add('is-missing');
    return box;
  }
  const img = h('img', {
    src,
    alt,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('load', () => box.classList.add('is-loaded'), { once: true });
  img.addEventListener(
    'error',
    () => {
      box.classList.add('is-missing');
      img.remove();
    },
    { once: true },
  );
  box.append(img);
  if (img.complete && img.naturalWidth > 0) box.classList.add('is-loaded');
  return box;
}

const ICONS = Object.freeze({
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  close: 'M18 6 6 18M6 6l12 12',
  chevron: 'm6 9 6 6 6-6',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  cart: 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M7.5 21a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M18.5 21a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  check: 'M20 6 9 17l-5-5',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h2M12 13h2M8 17h2',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
});

/** Icono SVG inline (trazo `currentColor`). `fill: true` lo rellena. */
export function icon(name, { fill = false } = {}) {
  const d = ICONS[name];
  if (!d) throw new Error(`Icono desconocido: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', fill ? 'icon icon--fill' : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
