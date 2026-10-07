import { DATA_URLS } from './config.js';
import { loadJson } from './data/load.js';
import { parseMenu, parseSite } from './data/schema.js';
import { createCart } from './features/cart.js';
import { h } from './lib/dom.js';
import { closeOpenCard } from './ui/card.js';
import { mountCart } from './ui/cart.js';
import { renderChrome } from './ui/chrome.js';
import { renderHome, renderLocations } from './ui/home.js';
import { mountMenu } from './ui/menu.js';
import { renderRecommended } from './ui/recommended.js';
import { bindSiteText } from './ui/site.js';

// Arranque común de todas las páginas.
//   page = 'home'     → portada (las cuatro opciones)
//   page = 'location' → sedes (cada una abre Google Maps)
//   page = 'menu'     → carta para consultar (sin carrito)
//   page = 'delivery' → carta con carrito y pedido por WhatsApp

function showMenuError(root) {
  root.replaceChildren(
    h(
      'div',
      { class: 'container' },
      h(
        'div',
        { class: 'state state--error', role: 'alert' },
        h('p', { class: 'state__title' }, 'No pudimos cargar la carta'),
        h('p', {}, 'Revisa tu conexión e inténtalo de nuevo.'),
        h('button', { class: 'btn btn--primary', type: 'button', on: { click: () => location.reload() } }, 'Reintentar'),
      ),
    ),
  );
}

/** localStorage puede estar bloqueado (modo privado, políticas del navegador): sin él el pedido sigue funcionando. */
function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function startApp({ page }) {
  const needsMenu = page === 'menu' || page === 'delivery';

  const [siteResult, menuResult] = await Promise.allSettled([
    loadJson(DATA_URLS.site),
    needsMenu ? loadJson(DATA_URLS.menu) : Promise.resolve(null),
  ]);

  // La info del restaurante es opcional: si falla, las páginas igual funcionan.
  const site = parseSite(siteResult.status === 'fulfilled' ? siteResult.value : null);
  renderChrome({ page, site });
  bindSiteText(site);

  if (page === 'home') {
    renderHome(site);
    return;
  }
  if (page === 'location') {
    renderLocations(site);
    return;
  }

  const menuRoot = document.getElementById('menu-root');
  if (menuResult.status === 'rejected') {
    console.error('[carta] No se pudo cargar menu.json:', menuResult.reason);
    showMenuError(menuRoot);
    return;
  }

  let menu;
  try {
    menu = parseMenu(menuResult.value);
  } catch (error) {
    console.error('[carta] menu.json inválido:', error);
    showMenuError(menuRoot);
    return;
  }
  if (menu.warnings.length) console.warn('[carta] Avisos de datos:', menu.warnings);

  // Solo en la página de domicilios existe el pedido.
  let orders = null;
  if (page === 'delivery') {
    const cart = createCart({
      productsById: new Map(menu.products.map((p) => [p.id, p])),
      storage: safeStorage(),
    });
    const { toast, open } = mountCart({ cart, site });
    orders = { cart, toast, open };
  }

  renderRecommended(document.getElementById('recomendados'), document.getElementById('rec-grid'), { ...menu, orders });
  mountMenu(menuRoot, { ...menu, orders });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closeOpenCard({ focus: true });
  });
}
