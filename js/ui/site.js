import { h, icon } from '../lib/dom.js';

// Datos del restaurante (data/site.json): textos de marca y datos de contacto opcionales.
// Todo lo que esté vacío simplemente no se muestra.

const TEXT_FIELDS = ['name', 'branch', 'tagline', 'description'];

/** Rellena los elementos marcados con data-site="name|branch|tagline|description". */
export function bindSiteText(site) {
  for (const el of document.querySelectorAll('[data-site]')) {
    const field = el.getAttribute('data-site');
    if (TEXT_FIELDS.includes(field) && site[field]) el.textContent = site[field];
  }
}

const externalAttrs = (href) => (href.startsWith('https:') ? { target: '_blank' } : {});

function infoCard(iconName, title, ...content) {
  return h(
    'div',
    { class: 'info' },
    h('span', { class: 'info__icon' }, icon(iconName)),
    h('div', { class: 'info__body' }, h('h3', { class: 'info__title' }, title), ...content),
  );
}

/** Horarios, contacto general y redes (solo lo que esté configurado). */
export function renderExtras(site, root) {
  const { contact, hours, social } = site;
  const place = [contact.address, contact.city].filter(Boolean).join(', ');

  const cards = [
    place &&
      infoCard(
        'pin',
        'Dónde estamos',
        h('p', {}, place),
        contact.maps ? h('a', { class: 'info__link', href: contact.maps, ...externalAttrs(contact.maps) }, 'Cómo llegar') : null,
      ),
    hours.length &&
      infoCard(
        'clock',
        'Horarios',
        h('dl', { class: 'facts' }, hours.map((row) => h('div', {}, h('dt', {}, row.label), h('dd', {}, row.value)))),
      ),
    (contact.phone || contact.whatsapp || contact.email) &&
      infoCard(
        'phone',
        'Contáctanos',
        contact.phone ? h('p', {}, h('a', { class: 'info__link', href: contact.phone.href }, contact.phone.label)) : null,
        contact.whatsapp
          ? h(
              'p',
              {},
              h('a', { class: 'info__link', href: contact.whatsapp.href, ...externalAttrs(contact.whatsapp.href) }, `WhatsApp ${contact.whatsapp.label}`),
            )
          : null,
        contact.email ? h('p', {}, h('a', { class: 'info__link', href: contact.email.href }, contact.email.label)) : null,
      ),
    social.length &&
      infoCard(
        'share',
        'Síguenos',
        h(
          'p',
          { class: 'info__social' },
          social.map((item) =>
            h('a', { class: 'btn btn--ghost btn--sm', href: item.href, ...externalAttrs(item.href) }, item.label),
          ),
        ),
      ),
  ].filter(Boolean);

  if (!cards.length) return;
  root.replaceChildren(...cards);
  root.hidden = false;
}
