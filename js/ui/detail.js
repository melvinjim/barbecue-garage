import { MAX_QTY, productOptions } from '../features/cart.js';
import { h, icon } from '../lib/dom.js';
import { formatPrice } from '../lib/format.js';
import { paragraphs } from '../lib/text.js';
import { createStepper } from './controls.js';

// Piezas del detalle de un producto. Las usan dos presentaciones:
//  - escritorio: panel que se despliega bajo la fila (card.js)
//  - celular: ventana emergente (sheet.js)

/** Etiquetas, descripción, ingredientes, nota y datos (presentación, horario, categoría). */
export function buildDetailBlocks(p, categoryLabels) {
  const badges = [
    p.featured && h('span', { class: 'badge badge--red' }, icon('star', { fill: true }), 'Favorito'),
    p.award && h('span', { class: 'badge badge--outline' }, p.award),
    p.launch && h('span', { class: 'badge' }, 'Precio de lanzamiento'),
  ].filter(Boolean);

  const facts = [
    p.units && ['Presentación', p.units],
    p.availability && ['Disponible', p.availability],
    ...(p.variants ?? []).map((v) => [v.label, formatPrice(v.price)]),
    categoryLabels.length > 0 && [categoryLabels.length > 1 ? 'Categorías' : 'Categoría', categoryLabels.join(', ')],
  ].filter(Boolean);

  return [
    badges.length ? h('div', { class: 'badges' }, badges) : null,
    ...paragraphs(p.description).map((text) => h('p', { class: 'detail__text' }, text)),
    p.includes ? h('ul', { class: 'detail__list' }, p.includes.map((item) => h('li', {}, item))) : null,
    p.note ? h('p', { class: 'detail__note' }, icon('info'), h('span', {}, p.note)) : null,
    facts.length
      ? h('dl', { class: 'facts' }, facts.map(([term, value]) => h('div', {}, h('dt', {}, term), h('dd', {}, value))))
      : null,
  ];
}

/**
 * Bloque "Agregar al pedido": presentación + cantidad + botón.
 * Devuelve las partes por separado (`optionsEl`, `rowEl`) y juntas (`el`).
 * `onAdd` se llama después de agregar con éxito.
 */
export function createBuy(product, { cart, toast }, { onAdd } = {}) {
  const options = productOptions(product);
  let selected = options[0];
  let qty = 1;

  const optionButtons = options.map((option) =>
    h(
      'button',
      {
        class: 'option',
        type: 'button',
        'aria-pressed': String(option === selected),
        on: {
          click: () => {
            selected = option;
            paint();
          },
        },
      },
      h('span', {}, option.label),
      h('strong', {}, formatPrice(option.price)),
    ),
  );

  const stepper = createStepper({
    label: product.name,
    onMinus: () => {
      qty = Math.max(1, qty - 1);
      paint();
    },
    onPlus: () => {
      qty = Math.min(MAX_QTY, qty + 1);
      paint();
    },
  });

  const addButton = h(
    'button',
    {
      class: 'btn btn--primary buy__add',
      type: 'button',
      on: {
        click: () => {
          const line = cart.add(product.id, { variant: selected.variant, qty });
          toast(line ? `${qty} × ${line.name} agregado` : 'Tu pedido llegó al máximo de productos distintos');
          if (line) {
            qty = 1;
            paint();
            onAdd?.();
          }
        },
      },
    },
    icon('plus'),
    h('span', {}),
  );

  function paint() {
    optionButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(options[i] === selected)));
    stepper.set(qty, { min: 1, max: MAX_QTY });
    addButton.lastElementChild.textContent = `Agregar · ${formatPrice(selected.price * qty)}`;
  }
  paint();

  const optionsEl =
    options.length > 1 ? h('div', { class: 'options', role: 'group', 'aria-label': 'Presentación' }, optionButtons) : null;
  const rowEl = h('div', { class: 'buy__row' }, stepper.el, addButton);
  return { optionsEl, rowEl, el: h('div', { class: 'buy' }, optionsEl, rowEl) };
}
