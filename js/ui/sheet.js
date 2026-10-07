import { h, icon, media } from '../lib/dom.js';
import { formatPrice } from '../lib/format.js';
import { buildDetailBlocks, createBuy } from './detail.js';

// Ventana emergente con el detalle de un producto (para celular).
// Es un <dialog> modal: tiene foco atrapado, se cierra con Esc, con el fondo
// oscuro o con el botón ✕, y devuelve el foco a la tarjeta que la abrió.

let dialog = null;
let onClose = null;

/** Avisa el cierre una sola vez, sin importar por qué camino se cerró. */
function finish() {
  const callback = onClose;
  onClose = null;
  callback?.();
}

/** Cierra la ventana y avisa al instante (sin esperar al evento "close" del navegador). */
function shut() {
  if (dialog?.open) dialog.close();
  finish();
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = h('dialog', { class: 'sheet', 'aria-labelledby': 'sheet-title' });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) shut(); // toque en el fondo oscuro
  });
  dialog.addEventListener('close', finish); // cierre con la tecla Esc
  document.body.append(dialog);
  return dialog;
}

export function closeSheet() {
  if (dialog?.open) shut();
}

/**
 * @param {{product:object, categoryLabels:string[], orders:{cart:object,toast:Function}, onClose?:Function}} options
 */
export function openSheet({ product, categoryLabels, orders, onClose: closed }) {
  const el = ensureDialog();
  if (el.open) return; // con la ventana abierta el fondo está bloqueado: no puede abrirse otra
  onClose = closed ?? null;

  const buy = orders ? createBuy(product, orders, { onAdd: shut }) : null; // sin pedido: solo se consulta
  const closeButton = h(
    'button',
    { class: 'icon-btn sheet__close', type: 'button', 'aria-label': 'Cerrar', on: { click: shut } },
    icon('close'),
  );

  el.className = product.image ? 'sheet' : 'sheet sheet--noimg';
  el.replaceChildren(
    h(
      'div',
      { class: 'sheet__inner' },
      closeButton,
      h(
        'div',
        { class: 'sheet__scroll' },
        product.image ? media({ src: product.image, alt: product.name, className: 'sheet__media' }) : null,
        h(
          'div',
          { class: 'sheet__body' },
          h(
            'div',
            { class: 'sheet__head' },
            h(
              'h2',
              { class: 'sheet__title', id: 'sheet-title' },
              product.name,
              product.featured ? h('span', { class: 'star', role: 'img', 'aria-label': 'Favorito' }, icon('star', { fill: true })) : null,
            ),
            h('p', { class: 'sheet__price' }, formatPrice(product.price)),
          ),
          ...buildDetailBlocks(product, categoryLabels),
          buy?.optionsEl,
        ),
      ),
      buy ? h('div', { class: 'sheet__foot' }, buy.rowEl) : null,
    ),
  );

  el.showModal();
}
