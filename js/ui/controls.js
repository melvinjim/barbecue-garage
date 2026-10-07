import { h, icon } from '../lib/dom.js';

/**
 * Selector de cantidad  [ − 2 + ].
 * Devuelve el elemento y `set(qty, { min, max })` para actualizarlo SIN recrearlo
 * (así el foco del teclado no se pierde al pulsar + o −).
 */
export function createStepper({ label, onMinus, onPlus, size = 'md' }) {
  const minus = h('button', { class: 'stepper__btn', type: 'button', 'aria-label': `Quitar una unidad de ${label}`, on: { click: onMinus } }, icon('minus'));
  const plus = h('button', { class: 'stepper__btn', type: 'button', 'aria-label': `Agregar una unidad de ${label}`, on: { click: onPlus } }, icon('plus'));
  const value = h('span', { class: 'stepper__qty', role: 'status' });
  const el = h('div', { class: `stepper stepper--${size}`, role: 'group', 'aria-label': `Cantidad de ${label}` }, minus, value, plus);

  return {
    el,
    set(qty, { min = 1, max = 20 } = {}) {
      value.textContent = String(qty);
      minus.disabled = qty <= min;
      plus.disabled = qty >= max;
    },
  };
}
