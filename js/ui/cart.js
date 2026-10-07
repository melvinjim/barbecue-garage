import { MAX_QTY, NOTE_MAX } from '../features/cart.js';
import { FIELD_LIMITS, buildOrderMessage, buildOrderUrl, isOrderUrl, validateOrder } from '../features/order.js';
import { h, icon } from '../lib/dom.js';
import { formatPrice } from '../lib/format.js';
import { createStepper } from './controls.js';

// Pedido: botón del encabezado, barra flotante, mensajes breves y el panel
// "Tu pedido" donde el cliente revisa lo que eligió, escoge la SEDE y envía el
// pedido por WhatsApp al número de esa sede.

const TOAST_MS = 2200;

function choice({ name, value, title, detail, checked = false }) {
  const input = h('input', { type: 'radio', name, value, id: `co-${name}-${value}`, checked: checked ? true : null });
  return h(
    'label',
    { class: 'choice', for: input.id },
    input,
    h('span', { class: 'choice__body' }, h('strong', {}, title), detail ? h('small', {}, detail) : null),
  );
}

function textField({ name, label, type = 'text', maxlength, autocomplete, inputmode, placeholder, optional = false }) {
  const id = `co-${name}`;
  const input = h('input', {
    id,
    name,
    type,
    maxlength,
    autocomplete,
    inputmode,
    placeholder,
    'aria-describedby': `${id}-error`,
  });
  const error = h('p', { class: 'field__error', id: `${id}-error` });
  const wrap = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label, optional ? h('span', { class: 'field__opt' }, ' (opcional)') : null),
    input,
    error,
  );
  return { wrap, input, error };
}

export function mountCart({ cart, site }) {
  const sedes = site.locations.filter((l) => l.whatsapp);
  const brand = site.name ?? 'Barbecue Garage';
  const lineRefs = new Map();

  // --- Mensajes breves (toast) ---------------------------------------------
  const toastEl = h('p', { class: 'toast', role: 'status' });
  let toastTimer = 0;
  function toast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = '';
    requestAnimationFrame(() => {
      toastEl.textContent = message;
      toastEl.classList.add('is-visible');
    });
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), TOAST_MS);
  }

  // --- Barra flotante y botón del encabezado ---------------------------------
  const barLabel = h('span', { class: 'cart-bar__label' });
  const barTotal = h('strong', { class: 'cart-bar__total' });
  const bar = h('button', { class: 'cart-bar', type: 'button', hidden: true, on: { click: open } }, icon('cart'), barLabel, barTotal);

  const headerButtons = [...document.querySelectorAll('[data-cart-open]')];
  const headerBadges = [...document.querySelectorAll('[data-cart-count]')];
  for (const button of headerButtons) {
    button.addEventListener('click', open);
    button.querySelector('[data-cart-icon]')?.replaceChildren(icon('cart'));
  }

  // --- Contenido del panel -----------------------------------------------------
  const linesBox = h('div', { class: 'cart__lines' });
  const sentBox = h('div', { class: 'sent', hidden: true, role: 'status' });
  const statusEl = h('p', { class: 'field__error cart__status', role: 'alert' });
  const subtotalEl = h('strong', {});

  const locationError = h('p', { class: 'field__error', id: 'co-location-error' });
  const modeError = h('p', { class: 'field__error', id: 'co-mode-error' });
  const name = textField({ name: 'name', label: 'Tu nombre', maxlength: FIELD_LIMITS.name, autocomplete: 'name' });
  const phone = textField({ name: 'phone', label: 'Tu teléfono', type: 'tel', maxlength: FIELD_LIMITS.phone, autocomplete: 'tel', inputmode: 'tel' });
  const address = textField({ name: 'address', label: 'Dirección de entrega', maxlength: FIELD_LIMITS.address, autocomplete: 'street-address', placeholder: 'Calle, número, barrio' });
  const references = textField({ name: 'references', label: 'Referencias', maxlength: FIELD_LIMITS.references, placeholder: 'Apto, torre, punto de referencia', optional: true });
  const addressBox = h('div', { class: 'field-row' }, address.wrap, references.wrap);

  const commentsInput = h('textarea', { id: 'co-comments', name: 'comments', rows: 2, maxlength: FIELD_LIMITS.comments, placeholder: 'Algo más que debamos saber' });
  const commentsField = h('div', { class: 'field' }, h('label', { for: 'co-comments' }, 'Comentarios', h('span', { class: 'field__opt' }, ' (opcional)')), commentsInput);

  const form = h(
    'form',
    { class: 'checkout', id: 'checkout-form', novalidate: true },
    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', {}, '1. ¿A qué sede quieres pedir?'),
      sedes.length
        ? h('div', { class: 'choices' }, sedes.map((l) => choice({ name: 'location', value: l.id, title: l.name, detail: l.address })))
        : h('p', { class: 'field__hint' }, 'Por ahora no hay sedes disponibles para pedidos en línea.'),
      locationError,
    ),
    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', {}, '2. ¿Cómo lo quieres?'),
      h(
        'div',
        { class: 'choices choices--row' },
        choice({ name: 'mode', value: 'delivery', title: 'Domicilio', checked: true }),
        choice({ name: 'mode', value: 'pickup', title: 'Recoger', detail: 'En el restaurante' }),
      ),
      modeError,
    ),
    h('div', { class: 'fieldset' }, h('p', { class: 'fieldset__title' }, '3. Tus datos'), name.wrap, phone.wrap, addressBox, commentsField),
  );

  const errorTargets = {
    location: { error: locationError, input: () => form.querySelector('input[name="location"]') },
    mode: { error: modeError, input: () => form.querySelector('input[name="mode"]') },
    name: { error: name.error, input: () => name.input },
    phone: { error: phone.error, input: () => phone.input },
    address: { error: address.error, input: () => address.input },
  };

  function showErrors(errors) {
    for (const [key, target] of Object.entries(errorTargets)) {
      const message = errors[key] ?? '';
      target.error.textContent = message;
      if (target.input()) target.input().setAttribute('aria-invalid', String(Boolean(message)));
    }
  }

  const submitButton = h(
    'button',
    { class: 'btn btn--primary cart__submit', type: 'submit', form: 'checkout-form', disabled: sedes.length ? null : true },
    icon('chat'),
    'Enviar pedido por WhatsApp',
  );

  const closeButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar mi pedido', on: { click: () => dialog.close() } }, icon('close'));

  const foot = h(
    'div',
    { class: 'cart__foot' },
    h('div', { class: 'cart__sum' }, h('span', {}, 'Subtotal'), subtotalEl),
    h('p', { class: 'cart__hint' }, 'Si es a domicilio, el valor del envío se confirma por WhatsApp.'),
    statusEl,
    submitButton,
  );

  const dialog = h(
    'dialog',
    { class: 'cart', 'aria-labelledby': 'cart-title' },
    h(
      'div',
      { class: 'cart__inner' },
      h('header', { class: 'cart__head' }, h('h2', { class: 'cart__title', id: 'cart-title' }, 'Tu pedido'), closeButton),
      h('div', { class: 'cart__body' }, linesBox, sentBox, form),
      foot,
    ),
  );

  document.body.append(dialog, bar, toastEl);

  // --- Líneas del pedido ---------------------------------------------------------
  function renderLine(line) {
    const ref = { qty: line.qty };
    ref.stepper = createStepper({
      label: line.name,
      size: 'sm',
      onMinus: () => cart.setQty(line.id, ref.qty - 1),
      onPlus: () => cart.setQty(line.id, ref.qty + 1),
    });
    ref.totalEl = h('span', { class: 'line__total' });
    ref.paint = (current) => {
      ref.qty = current.qty;
      ref.stepper.set(current.qty, { min: 1, max: MAX_QTY });
      ref.totalEl.textContent = formatPrice(current.total);
    };
    ref.paint(line);
    lineRefs.set(line.id, ref);

    const noteInput = h('input', {
      class: 'line__note',
      type: 'text',
      maxlength: NOTE_MAX,
      placeholder: 'Nota (ej. sin cebolla)',
      value: line.note,
      'aria-label': `Nota para ${line.name}`,
      on: {
        change: () => cart.setNote(line.id, noteInput.value),
        keydown: (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            noteInput.blur();
          }
        },
      },
    });

    return h(
      'li',
      { class: 'line' },
      h('div', { class: 'line__top' }, h('p', { class: 'line__name' }, line.name), ref.totalEl),
      h(
        'div',
        { class: 'line__bottom' },
        ref.stepper.el,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar ${line.name} del pedido`, on: { click: () => cart.remove(line.id) } }, icon('trash')),
      ),
      noteInput,
    );
  }

  let confirmClear = false;
  const clearButton = h('button', { class: 'link-btn', type: 'button' }, 'Vaciar pedido');
  clearButton.addEventListener('click', () => {
    if (!confirmClear) {
      confirmClear = true;
      clearButton.textContent = '¿Seguro? Toca otra vez';
      setTimeout(() => {
        confirmClear = false;
        clearButton.textContent = 'Vaciar pedido';
      }, 3000);
      return;
    }
    confirmClear = false;
    clearButton.textContent = 'Vaciar pedido';
    cart.clear();
  });

  function goToMenu() {
    dialog.close();
    document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth' });
  }

  function renderLines() {
    lineRefs.clear();
    const lines = cart.getLines();
    if (!lines.length) {
      linesBox.replaceChildren(
        h(
          'div',
          { class: 'state' },
          h('p', { class: 'state__title' }, 'Tu pedido está vacío'),
          h('p', {}, 'Toca el botón + de cualquier plato, bebida o adicional para agregarlo.'),
          h('button', { class: 'btn btn--primary', type: 'button', on: { click: goToMenu } }, 'Ver la carta'),
        ),
      );
      return;
    }
    linesBox.replaceChildren(
      h('div', { class: 'cart__lines-head' }, h('p', { class: 'fieldset__title' }, `Productos (${cart.count()})`), clearButton),
      h('ul', { class: 'lines' }, lines.map(renderLine)),
    );
  }

  /** Actualiza cantidades y totales sin recrear los controles (conserva el foco del teclado). */
  function patchLines() {
    const lines = cart.getLines();
    if (lines.some((line) => !lineRefs.has(line.id))) return renderLines();
    for (const line of lines) lineRefs.get(line.id).paint(line);
    return undefined;
  }

  function updateSummary() {
    const count = cart.count();
    const total = formatPrice(cart.subtotal());
    for (const badge of headerBadges) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
    bar.hidden = count === 0;
    barLabel.textContent = `Ver mi pedido · ${count}`;
    barTotal.textContent = total;
    subtotalEl.textContent = total;
    const empty = count === 0;
    form.hidden = empty;
    foot.hidden = empty;
    const heading = linesBox.querySelector('.fieldset__title');
    if (heading && !empty) heading.textContent = `Productos (${count})`;
  }

  // --- Envío ---------------------------------------------------------------------
  function openWhatsApp(url) {
    if (!isOrderUrl(url)) return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }

  function showSent(url, location) {
    const again = h('a', { class: 'btn btn--ghost btn--sm', target: '_blank' }, 'Abrir WhatsApp de nuevo');
    again.setAttribute('href', url);
    sentBox.replaceChildren(
      h('p', { class: 'sent__title' }, icon('check'), 'Pedido listo para enviar'),
      h('p', {}, `Abrimos WhatsApp con tu pedido para la ${location.name}. Envía el mensaje desde allí para que lo confirmen.`),
      h('div', { class: 'sent__actions' }, again),
    );
    sentBox.hidden = false;
    sentBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  form.addEventListener('change', () => {
    addressBox.hidden = form.elements.mode.value !== 'delivery';
  });
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.setAttribute('aria-invalid', 'false');
      if (Object.hasOwn(errorTargets, target.name)) errorTargets[target.name].error.textContent = '';
      statusEl.textContent = '';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (cart.count() === 0) return;
    statusEl.textContent = '';

    const data = Object.fromEntries(new FormData(form));
    const result = validateOrder(
      {
        locationId: data.location,
        mode: data.mode,
        name: data.name,
        phone: data.phone,
        address: data.address,
        references: data.references,
        comments: data.comments,
      },
      sedes,
    );
    showErrors(result.errors);
    if (!result.ok) {
      const first = Object.keys(errorTargets).find((key) => result.errors[key]);
      errorTargets[first]?.input()?.focus();
      return;
    }

    const message = buildOrderMessage({
      brand,
      tagline: site.tagline,
      order: result.value,
      lines: cart.getLines(),
      subtotal: cart.subtotal(),
    });
    const url = buildOrderUrl(result.value.location.whatsapp.number, message);
    if (!url) {
      statusEl.textContent = 'Tu pedido es muy grande para enviarlo en un solo mensaje. Divídelo en dos pedidos.';
      return;
    }
    openWhatsApp(url);
    showSent(url, result.value.location);
  });

  // --- Abrir / cerrar --------------------------------------------------------------
  function open() {
    sentBox.hidden = true;
    renderLines();
    updateSummary();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // clic en el fondo oscuro
  });

  cart.subscribe((reason) => {
    updateSummary();
    if (reason === 'note') return;
    if (reason === 'qty') patchLines();
    else renderLines();
    if (reason === 'clear') sentBox.hidden = true;
  });

  renderLines();
  updateSummary();
  return { open, toast };
}
