import { LIMITS } from '../config.js';
import { buildIndex, matchProducts } from '../features/search.js';
import { h, icon, media } from '../lib/dom.js';
import { sanitizeQuery } from '../lib/text.js';
import { categoryLabel, closeOpenCard, createCard, openCard } from './card.js';
import { scrollBehavior, stickyBottom } from './scroll.js';

// Estado compartible por URL: ?cat=burgers  ?q=brisket  ?p=gaucha-burger
// Cada valor se valida contra los datos reales; nunca se inserta como HTML.
function readUrl(categoriesById, productsById) {
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  const p = params.get('p');

  let category = cat && categoriesById.has(cat) ? cat : 'all';
  let query = sanitizeQuery(params.get('q') ?? '', LIMITS.query);
  const product = p && productsById.has(p) ? p : null;

  if (product) {
    const inCategory = productsById.get(product).categories.includes(category);
    if (query || (category !== 'all' && !inCategory)) {
      category = 'all';
      query = '';
    }
  }
  return { category, query, product };
}

export function mountMenu(root, { categories, products, orders }) {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const productsById = new Map(products.map((p) => [p.id, p]));
  const categoryOrder = new Map(categories.map((c, i) => [c.id, i]));
  const index = buildIndex(products, categoriesById);

  const initial = readUrl(categoriesById, productsById);
  const state = { category: initial.category, query: initial.query, openId: null };
  const cardsById = new Map();
  let debounceTimer = 0;

  // --- Construcción de la interfaz ---------------------------------------

  const input = h('input', {
    id: 'menu-search',
    class: 'search__input',
    type: 'search',
    name: 'q',
    placeholder: 'Buscar plato o bebida…',
    maxlength: LIMITS.query,
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    value: state.query,
  });

  const clearButton = h(
    'button',
    {
      class: 'search__clear',
      type: 'button',
      hidden: true,
      'aria-label': 'Borrar búsqueda',
      on: {
        click: () => {
          input.value = '';
          setQuery('');
          input.focus();
        },
      },
    },
    icon('close'),
  );

  const chipButtons = new Map();
  const chipItems = [{ id: 'all', label: 'Todo' }, ...categories.map((c) => ({ id: c.id, label: c.name }))];
  const chips = h(
    'ul',
    { class: 'chips' },
    chipItems.map(({ id, label }) => {
      const button = h(
        'button',
        { class: 'chip', type: 'button', 'aria-pressed': 'false', on: { click: () => selectCategory(id) } },
        label,
      );
      chipButtons.set(id, button);
      return h('li', {}, button);
    }),
  );

  const bar = h(
    'div',
    { class: 'menu__bar' },
    h(
      'div',
      { class: 'container menu__bar-inner' },
      h(
        'div',
        { class: 'search' },
        h('label', { class: 'sr-only', for: 'menu-search' }, 'Buscar en la carta'),
        h('span', { class: 'search__icon' }, icon('search')),
        input,
        clearButton,
      ),
      h('nav', { 'aria-label': 'Categorías de la carta' }, chips),
    ),
  );

  const status = h('p', { class: 'menu__status', role: 'status' });
  const list = h('div', { class: 'menu__list' });

  root.replaceChildren(bar, h('div', { class: 'container menu__body' }, status, list));

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    }).observe(bar);
  }

  // --- Lógica ------------------------------------------------------------

  function visibleGroups() {
    const matches = matchProducts(index, state.query).map((entry) => entry.product);

    if (!state.query && state.category !== 'all') {
      const items = matches.filter((p) => p.categories.includes(state.category));
      return [{ category: categoriesById.get(state.category), items }];
    }

    // Vista "Todo" y búsqueda: cada producto aparece una vez, en su categoría principal.
    const grouped = new Map();
    for (const product of matches) {
      const id = product.categories[0];
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(product);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => categoryOrder.get(a) - categoryOrder.get(b))
      .map(([id, items]) => ({ category: categoriesById.get(id), items }));
  }

  function onToggle(product, open) {
    if (open) state.openId = product.id;
    else if (state.openId === product.id) state.openId = null;
    syncUrl();
  }

  function renderGroup({ category, items }) {
    const titleId = `cat-${category.id}-title`;
    return h(
      'section',
      { class: 'group', id: `cat-${category.id}`, 'aria-labelledby': titleId },
      // Banner de la categoría (como en el sitio original). El título en texto siempre existe:
      // queda oculto (solo lectores de pantalla) mientras el banner se ve, y aparece si la imagen falla.
      h(
        'header',
        { class: category.banner ? 'group__head group__head--banner' : 'group__head' },
        category.banner ? media({ src: category.banner, alt: '', className: 'group__art' }) : null,
        h('h3', { class: 'group__title', id: titleId }, category.name),
        // Con banner, el nombre ya está en la imagen: no se repite el subtítulo debajo.
        category.subtitle && !category.banner ? h('p', { class: 'group__sub' }, category.subtitle) : null,
        category.note ? h('p', { class: 'badge badge--outline group__note' }, icon('clock'), category.note) : null,
      ),
      h(
        'div',
        { class: 'grid' },
        items.map((product) => {
          const card = createCard(product, {
            scope: 'menu',
            orders,
            level: 'h4',
            categoryLabels: product.categories.map((id) => categoryLabel(categoriesById.get(id))),
            onToggle,
          });
          cardsById.set(product.id, card);
          return card;
        }),
      ),
    );
  }

  function emptyState() {
    return h(
      'div',
      { class: 'state' },
      h('p', { class: 'state__title' }, 'No encontramos resultados'),
      h('p', {}, 'Prueba con otra palabra (por ejemplo "burger", "brisket" o "mojito") o explora las categorías.'),
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          on: {
            click: () => {
              input.value = '';
              setQuery('');
            },
          },
        },
        'Ver toda la carta',
      ),
    );
  }

  function updateChrome(total) {
    const searching = state.query !== '';
    for (const [id, button] of chipButtons) {
      button.setAttribute('aria-pressed', String(!searching && id === state.category));
    }
    clearButton.hidden = !searching;

    if (searching) {
      status.textContent = total
        ? `${total} ${total === 1 ? 'resultado' : 'resultados'} para «${state.query}»`
        : '';
    } else if (state.category === 'all') {
      status.textContent = `${total} opciones en la carta`;
    } else {
      status.textContent = `${total} en ${categoriesById.get(state.category).name}`;
    }
  }

  function keepListInView() {
    const limit = stickyBottom();
    const listTop = list.getBoundingClientRect().top;
    if (listTop < limit) {
      window.scrollTo({ top: window.scrollY + listTop - limit - 8, behavior: scrollBehavior() });
    }
  }

  function centerChip(id) {
    const button = chipButtons.get(id);
    if (!button) return;
    chips.scrollTo({
      left: button.offsetLeft - (chips.clientWidth - button.offsetWidth) / 2,
      behavior: scrollBehavior(),
    });
  }

  function render({ scroll = false } = {}) {
    closeOpenCard();
    cardsById.clear();
    const groups = visibleGroups();
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    list.replaceChildren(...(total ? groups.map(renderGroup) : [emptyState()]));
    updateChrome(total);
    if (scroll) keepListInView();
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.category !== 'all') params.set('cat', state.category);
    if (state.query) params.set('q', state.query);
    if (state.openId) params.set('p', state.openId);
    const search = params.toString();
    try {
      history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
    } catch {
      /* sin historial disponible (p. ej. vista previa incrustada): no es crítico */
    }
  }

  function selectCategory(id) {
    state.category = id;
    state.query = '';
    input.value = '';
    render({ scroll: true });
    syncUrl();
    centerChip(id);
  }

  function setQuery(value) {
    state.query = sanitizeQuery(value, LIMITS.query);
    render({ scroll: true });
    syncUrl();
  }

  input.addEventListener('input', () => {
    clearButton.hidden = input.value === '';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setQuery(input.value), 160);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(debounceTimer);
      setQuery(input.value);
      input.blur(); // cierra el teclado en móviles
    } else if (event.key === 'Escape' && input.value) {
      event.stopPropagation();
      input.value = '';
      setQuery('');
    }
  });

  // --- Arranque ------------------------------------------------------------

  render();
  centerChip(state.category);
  if (initial.product) {
    const card = cardsById.get(initial.product);
    if (card) openCard(card);
  }
}
