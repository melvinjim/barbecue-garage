import { MAX_QTY } from '../features/cart.js';
import { h, icon, media } from '../lib/dom.js';
import { formatPrice } from '../lib/format.js';
import { paragraphs } from '../lib/text.js';
import { buildDetailBlocks, createBuy } from './detail.js';
import { reducedMotion, scrollBehavior, stickyBottom } from './scroll.js';
import { closeSheet, openSheet } from './sheet.js';

// Tarjeta de producto (plato, bebida, licor…).
//
// - Escritorio: tocar la tarjeta despliega un panel con el detalle DEBAJO de su
//   fila, con animación de altura. Las demás tarjetas no se mueven.
// - Celular: tocar la tarjeta abre una ventana emergente (sheet.js) con botón de
//   cerrar; así la foto no se repite en la página.
// - Cada tarjeta tiene un botón rápido "+" para agregar al pedido (también los
//   adicionales). Los productos con presentaciones (p. ej. jarra) abren el
//   detalle para elegir.
// - Accesibilidad: el nombre es un <button> dentro de un título; un
//   pseudo-elemento lo estira para que TODA la cabecera sea clicable.
// - Solo hay un detalle abierto a la vez en toda la página.

const ANIMATION_MS = 340;
const PHONE = matchMedia('(max-width: 719.98px)');
const entries = new WeakMap();
let current = null;

/** "Meats · Cortes de carne" */
export const categoryLabel = (category) =>
  category.subtitle ? `${category.name} · ${category.subtitle}` : category.name;

/** Un producto se despliega solo si tiene algo más que mostrar que nombre y precio. */
export function isExpandable(p) {
  return Boolean(
    p.image || p.description || p.note || p.includes || p.units || p.availability || p.variants || p.award || p.launch,
  );
}

function shortText(p) {
  const [first] = paragraphs(p.description);
  if (first) return first;
  return p.includes ? p.includes.join(' · ') : '';
}

// --- Sincronía con el carrito -------------------------------------------------
// Los botones rápidos se actualizan cuando cambia el pedido. Los que ya no están
// en la página (por un cambio de categoría) se descartan solos.

const painters = new Set();
const watchedCarts = new WeakSet();

function watchCart(cart) {
  if (watchedCarts.has(cart)) return;
  watchedCarts.add(cart);
  cart.subscribe(() => {
    for (const painter of painters) {
      if (painter.node.isConnected) painter.paint();
      else painters.delete(painter);
    }
  });
}

/** Botón rápido: "+" o, si ya hay unidades, [ − n + ]. */
function createQuick(product, { cart, toast }, expand) {
  const needsChoice = Boolean(product.variants);

  const add = () => {
    const before = cart.count();
    const line = cart.adjust(product.id, +1);
    if (!line) toast('Tu pedido llegó al máximo de productos distintos');
    else if (cart.count() === before) toast(`Máximo ${MAX_QTY} unidades por producto`);
    else toast(`${product.name} agregado`);
  };

  const plus = h(
    'button',
    {
      class: 'qty__btn qty__plus',
      type: 'button',
      'aria-label': needsChoice ? `Elegir presentación de ${product.name}` : `Agregar ${product.name} al pedido`,
      on: { click: needsChoice ? expand : add },
    },
    icon('plus'),
  );
  const minus = h(
    'button',
    {
      class: 'qty__btn qty__minus',
      type: 'button',
      'aria-label': `Quitar una unidad de ${product.name}`,
      on: { click: () => cart.adjust(product.id, -1) },
    },
    icon('minus'),
  );
  const count = h('span', { class: 'qty__count' });
  const root = h('div', { class: 'qty' }, minus, count, plus);

  const paint = () => {
    const qty = cart.qtyOf(product.id);
    root.classList.toggle('has-qty', qty > 0);
    count.textContent = String(qty);
    count.hidden = qty === 0;
    minus.hidden = needsChoice || qty === 0;
  };
  paint();
  watchCart(cart);
  painters.add({ node: root, paint });
  return root;
}

// --- Panel de detalle (escritorio) ----------------------------------------------

function buildPanel(entry) {
  const { product: p, categoryLabels, orders } = entry;

  const body = h(
    'div',
    { class: 'detail__body' },
    ...buildDetailBlocks(p, categoryLabels),
    orders ? createBuy(p, orders).el : null,
    h(
      'button',
      { class: 'btn btn--ghost btn--sm detail__close', type: 'button', on: { click: () => closeOpenCard({ focus: true }) } },
      'Cerrar',
    ),
  );

  entry.clip.append(
    h(
      'div',
      { class: p.image ? 'detail__inner detail__inner--media' : 'detail__inner' },
      p.image ? media({ src: p.image, alt: p.name, className: 'detail__media' }) : null,
      body,
    ),
  );
}

/** Mueve el panel justo después de la última tarjeta de la fila de `entry`. */
function placePanel(entry) {
  const grid = entry.article.parentElement;
  if (!grid) return;
  const cards = [...grid.children].filter((el) => el.classList.contains('card'));
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  const row = Math.floor(cards.indexOf(entry.article) / columns);
  const last = cards[Math.min(cards.length, (row + 1) * columns) - 1];
  if (last.nextElementSibling !== entry.panel) last.after(entry.panel);

  const attached = columns === 1; // en una columna el panel se pega a su tarjeta
  entry.panel.classList.toggle('detail--attached', attached);
  entry.article.classList.toggle('is-attached', attached);
}

/** Asegura que la tarjeta y su detalle queden a la vista (sin quedar bajo la cabecera). */
function reveal(entry) {
  const limit = stickyBottom() + 12;
  const card = entry.article.getBoundingClientRect();
  const panel = entry.panel.getBoundingClientRect();
  const overflow = panel.bottom - (innerHeight - 12);
  if (card.top >= limit && overflow <= 0) return;
  const delta = card.top < limit ? card.top - limit : Math.min(overflow, card.top - limit);
  window.scrollBy({ top: delta, behavior: scrollBehavior() });
}

/** Celular: el detalle se muestra como ventana emergente. */
function openAsSheet(entry) {
  closeOpenCard();
  entry.toggle.setAttribute('aria-haspopup', 'dialog');
  entry.onToggle?.(entry.product, true);
  openSheet({
    product: entry.product,
    categoryLabels: entry.categoryLabels,
    orders: entry.orders,
    onClose: () => entry.onToggle?.(entry.product, false),
  });
}

function openEntry(entry, { scroll = true } = {}) {
  if (PHONE.matches) {
    openAsSheet(entry);
    return;
  }
  if (current && current !== entry) closeEntry(current);
  current = entry;

  if (!entry.filled) {
    buildPanel(entry);
    entry.filled = true;
  }
  placePanel(entry);

  entry.toggle.setAttribute('aria-controls', entry.panel.id);
  entry.toggle.setAttribute('aria-expanded', 'true');
  entry.article.classList.add('is-open');
  entry.panel.hidden = false;
  void entry.panel.offsetHeight; // fuerza el cálculo de estilos para que la animación arranque
  entry.panel.classList.add('is-open');
  entry.onToggle?.(entry.product, true);

  if (scroll) setTimeout(() => current === entry && reveal(entry), reducedMotion() ? 0 : ANIMATION_MS);
}

function closeEntry(entry) {
  entry.toggle.setAttribute('aria-expanded', 'false');
  entry.article.classList.remove('is-open');
  entry.panel.classList.remove('is-open');
  entry.onToggle?.(entry.product, false);
  setTimeout(
    () => {
      if (!entry.panel.classList.contains('is-open')) entry.panel.hidden = true;
    },
    reducedMotion() ? 0 : ANIMATION_MS,
  );
}

export function openCard(article, options) {
  const entry = entries.get(article);
  if (entry) openEntry(entry, options);
}

export function closeOpenCard({ focus = false } = {}) {
  closeSheet();
  if (!current) return;
  const entry = current;
  current = null;
  closeEntry(entry);
  if (focus) entry.toggle.focus();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => current && placePanel(current), 150);
});

/**
 * @param {object} product  Producto ya validado (ver data/schema.js)
 * @param {{scope:string, orders?:{cart:object,toast:Function}|null, level?:'h3'|'h4', variant?:'row'|'feature', categoryLabels?:string[], onToggle?:Function}} options
 *   `orders` null → modo "solo ver": sin botón + ni "Agregar al pedido".
 */
export function createCard(product, { scope, orders, level = 'h4', variant = 'row', categoryLabels = [], onToggle }) {
  const expandable = isExpandable(product);
  const baseId = `${scope}-${product.id}`;
  const description = shortText(product);

  const nameNodes = [
    product.name,
    product.featured ? h('span', { class: 'star', role: 'img', 'aria-label': 'Favorito' }, icon('star', { fill: true })) : null,
  ];

  const toggle = expandable
    ? h(
        'button',
        { class: 'card__toggle', type: 'button', id: `${baseId}-toggle`, 'aria-expanded': 'false' },
        nameNodes,
      )
    : null;

  const clip = expandable ? h('div', { class: 'detail__clip' }) : null;
  const panel = expandable
    ? h('div', { class: 'detail', id: `${baseId}-panel`, role: 'region', 'aria-labelledby': `${baseId}-toggle`, hidden: true }, clip)
    : null;

  let entry = null;
  // Sin `orders` (página de solo menú) no hay botón de agregar.
  const quick = orders ? createQuick(product, orders, () => entry && openEntry(entry)) : null;

  const article = h(
    'article',
    {
      class: [
        'card',
        variant === 'feature' ? 'card--feature' : '',
        product.image ? '' : 'card--noimg',
        expandable ? 'is-expandable' : '',
      ]
        .filter(Boolean)
        .join(' '),
    },
    h(
      'div',
      { class: 'card__head' },
      product.image
        ? h('div', { class: 'card__visual' }, media({ src: product.image, alt: '', className: 'card__thumb' }), quick)
        : null,
      h(
        'div',
        { class: 'card__main' },
        h(level, { class: 'card__title' }, toggle ?? nameNodes),
        description ? h('p', { class: 'card__desc' }, description) : null,
      ),
      h(
        'div',
        { class: 'card__side' },
        h('p', { class: 'card__price' }, formatPrice(product.price)),
        h(
          'div',
          { class: 'card__tools' },
          expandable ? h('span', { class: 'card__chevron' }, icon('chevron')) : null,
          product.image ? null : quick,
        ),
      ),
    ),
  );

  if (expandable) {
    entry = { article, toggle, panel, clip, product, categoryLabels, orders, onToggle, filled: false };
    entries.set(article, entry);
    toggle.addEventListener('click', () => (current === entry ? closeOpenCard() : openEntry(entry)));
  }
  return article;
}
