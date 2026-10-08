import { DEFAULT_LOGO } from '../config.js';
import { h, icon } from '../lib/dom.js';
import { isLocalAdminHref } from '../lib/url.js';

// Encabezado y pie de página compartidos por todas las páginas.
// Se dibujan desde aquí para que el menú de navegación viva en un solo lugar.

const NAV = Object.freeze([
  { id: 'home', label: 'Inicio', href: 'index.html' },
  { id: 'location', label: 'Ubicación', href: 'ubicacion.html' },
  { id: 'menu', label: 'Menú', href: 'carta.html' },
  { id: 'delivery', label: 'Domicilios', href: 'domicilios.html' },
]);

function renderHeader(page, site) {
  const header = document.getElementById('site-header');
  const name = site.name ?? 'Barbecue Garage';

  const brand = h(
    'a',
    { class: 'brand', href: 'index.html', 'aria-label': `${name}, ir al inicio` },
    h('img', {
      class: 'brand__logo',
      src: site.logo ?? DEFAULT_LOGO,
      alt: '',
      width: 40,
      height: 40,
      decoding: 'async',
      referrerpolicy: 'no-referrer',
    }),
    h('span', { class: 'brand__text' }, h('strong', {}, name), site.branch ? h('small', {}, site.branch) : null),
  );

  // La opción donde estás (la página actual) se marca en rojo.
  const nav = h(
    'nav',
    { class: 'site-nav', id: 'site-nav', 'aria-label': 'Principal' },
    NAV.map((item) => h('a', { href: item.href, 'aria-current': item.id === page ? 'page' : null }, item.label)),
  );

  // Botón del pedido: solo existe en la página de domicilios.
  const cartButton =
    page === 'delivery'
      ? h(
          'button',
          { class: 'cart-btn', type: 'button', 'aria-label': 'Ver mi pedido', 'data-cart-open': '' },
          h('span', { class: 'cart-btn__icon', 'data-cart-icon': '' }),
          h('span', { class: 'cart-btn__badge', 'data-cart-count': '', hidden: true }, '0'),
        )
      : null;

  // Menú móvil. Los dos íconos (☰ y ✕) ya están en el DOM y el CSS alterna cuál se ve:
  // si se reemplazaran al hacer clic, el navegador creería que el clic fue "afuera" y lo cerraría.
  const toggle = h(
    'button',
    {
      class: 'nav-toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'site-nav',
      'aria-label': 'Abrir menú',
    },
    h('span', { class: 'nav-toggle__menu' }, icon('menu')),
    h('span', { class: 'nav-toggle__close' }, icon('close')),
  );

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  const isOpen = () => nav.classList.contains('is-open');

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  nav.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !event.composedPath().includes(header)) setOpen(false); // clic fuera del encabezado
  });

  header.replaceChildren(
    h('div', { class: 'container site-header__inner' }, brand, nav, h('div', { class: 'site-header__tools' }, cartButton, toggle)),
  );
}

const LOCAL_HOSTS = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

/**
 * Enlace al panel administrativo (site.adminUrl). La dirección local (localhost) solo se muestra cuando el sitio
 * se abre desde el mismo computador: a quien visita el sitio publicado le llevaría a una página rota.
 */
function adminLinkFor(site) {
  if (!site.adminHref) return null;
  if (isLocalAdminHref(site.adminHref) && !LOCAL_HOSTS.includes(location.hostname)) return null;
  return site.adminHref;
}

function renderFooter(site) {
  const footer = document.getElementById('site-footer');
  const name = site.name ?? 'Barbecue Garage';
  const adminHref = adminLinkFor(site);

  footer.replaceChildren(
    h(
      'div',
      { class: 'container site-footer__inner' },
      h(
        'p',
        { class: 'site-footer__brand' },
        adminHref
          ? h('a', { class: 'site-footer__admin', href: adminHref, target: '_blank', title: 'Panel administrativo', 'aria-label': `${name}, panel administrativo` }, h('strong', {}, name))
          : h('strong', {}, name),
        site.branch ? ` · ${site.branch}` : '',
      ),
      h(
        'nav',
        { class: 'site-footer__nav', 'aria-label': 'Secciones' },
        NAV.map((item) => h('a', { href: item.href }, item.label)),
      ),
      h('p', { class: 'site-footer__legal' }, `Precios en pesos colombianos (COP). © ${new Date().getFullYear()} ${name}.`),
      site.reviewHref
        ? h('a', { class: 'site-footer__review', href: site.reviewHref, target: '_blank' }, 'Califica tu experiencia')
        : null,
    ),
  );
}

export function renderChrome({ page, site }) {
  renderHeader(page, site);
  renderFooter(site);
}
