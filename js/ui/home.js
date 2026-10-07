import { h, icon, media } from '../lib/dom.js';
import { renderExtras } from './site.js';

// Portada (las cuatro opciones) y página de ubicación (las sedes, cada una abre Google Maps).

const TILES = Object.freeze([
  { id: 'menu', icon: 'list', title: 'Ver nuestro menú', text: 'Toda la carta, con fotos y detalles', href: 'carta.html' },
  { id: 'domicilio', icon: 'bag', title: 'Pedir a domicilio', text: 'Arma tu pedido y envíalo por WhatsApp', href: 'domicilios.html' },
  { id: 'reserva', icon: 'calendar', title: 'Hacer una reserva', text: 'Estamos preparándola para ti', soon: true },
  { id: 'ubicacion', icon: 'pin', title: 'Conocer nuestra ubicación', text: 'Encuentra la sede más cercana', href: 'ubicacion.html' },
]);

function tile(definition, image) {
  const content = [
    image ? media({ src: image, alt: '', className: 'tile__media' }) : null,
    h(
      'span',
      { class: 'tile__content' },
      h('span', { class: 'tile__icon' }, icon(definition.icon)),
      h('span', { class: 'tile__text' }, h('strong', { class: 'tile__title' }, definition.title), h('small', {}, definition.text)),
      definition.soon
        ? h('span', { class: 'badge badge--outline' }, 'Muy pronto')
        : h('span', { class: 'tile__arrow' }, icon('arrow')),
    ),
  ];

  // La reserva aún no existe: se muestra, pero no es un enlace.
  if (definition.soon) {
    return h('div', { class: 'tile tile--soon', role: 'group', 'aria-label': `${definition.title}: muy pronto` }, content);
  }
  return h('a', { class: 'tile', href: definition.href }, content);
}

function place(location) {
  const body = [
    h('span', { class: 'place__icon' }, icon('pin')),
    h(
      'span',
      { class: 'place__body' },
      h('strong', { class: 'place__name' }, location.name),
      location.address ? h('span', { class: 'place__address' }, location.address) : null,
      location.maps
        ? h(
            'span',
            { class: 'place__cta' },
            'Cómo llegar en Google Maps',
            icon('external'),
            h('span', { class: 'sr-only' }, ' (se abre en una pestaña nueva)'),
          )
        : null,
    ),
  ];

  return h(
    'article',
    { class: 'place' },
    location.maps
      ? h('a', { class: 'place__link', href: location.maps, target: '_blank' }, body)
      : h('div', { class: 'place__link' }, body),
    location.whatsapp
      ? h('a', { class: 'btn btn--ghost btn--sm place__wa', href: location.whatsapp.href, target: '_blank' }, icon('chat'), `WhatsApp ${location.whatsapp.label}`)
      : null,
  );
}

/** Portada: las cuatro opciones. */
export function renderHome(site) {
  document.getElementById('home-tiles').replaceChildren(...TILES.map((definition) => tile(definition, site.tiles[definition.id])));
}

/** Página de ubicación: una tarjeta por sede (abre Google Maps) y, si hay, horarios y contacto. */
export function renderLocations(site) {
  const places = document.getElementById('places');
  if (site.locations.length) {
    places.replaceChildren(...site.locations.map(place));
  } else {
    places.replaceChildren(h('p', { class: 'state' }, 'Pronto publicaremos nuestras sedes.'));
  }
  renderExtras(site, document.getElementById('extras'));
}
