import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ENCODED_LENGTH, buildOrderMessage, buildOrderUrl, isOrderUrl, validateOrder } from '../js/features/order.js';

const locations = [
  { id: 'cra-21', name: 'Sede Cra 21', address: 'Cra 21 # 48-08 L2', whatsapp: { number: '573042703186' } },
  { id: 'golf', name: 'Sede Le Meridiem Golf', address: 'CC Le Meridiem Golf', whatsapp: { number: '573017491089' } },
  { id: 'sin-whatsapp', name: 'Sede sin número', whatsapp: null },
];

const valid = {
  locationId: 'golf',
  mode: 'delivery',
  name: 'Ana Pérez',
  phone: '300 123 4567',
  address: 'Calle 1 # 2-3',
  references: 'Apto 402',
  comments: '',
};

test('un pedido completo es válido y queda ligado a la sede elegida', () => {
  const { ok, value } = validateOrder(valid, locations);
  assert.equal(ok, true);
  assert.equal(value.location.whatsapp.number, '573017491089');
});

test('la sede es obligatoria: sin elegirla (o con una inválida) no se puede pedir', () => {
  for (const locationId of [undefined, '', 'otra', '__proto__', 'sin-whatsapp']) {
    const { ok, errors } = validateOrder({ ...valid, locationId }, locations);
    assert.equal(ok, false, `locationId=${String(locationId)}`);
    assert.ok(errors.location);
  }
});

test('valida modalidad, nombre, teléfono y dirección (solo para domicilio)', () => {
  assert.ok(validateOrder({ ...valid, mode: 'volando' }, locations).errors.mode);
  assert.ok(validateOrder({ ...valid, mode: '__proto__' }, locations).errors.mode);
  assert.ok(validateOrder({ ...valid, name: ' ' }, locations).errors.name);
  assert.ok(validateOrder({ ...valid, phone: 'abc' }, locations).errors.phone);
  assert.ok(validateOrder({ ...valid, phone: '123' }, locations).errors.phone);
  assert.ok(validateOrder({ ...valid, address: '' }, locations).errors.address);

  const pickup = validateOrder({ ...valid, mode: 'pickup', address: '', references: 'x' }, locations);
  assert.equal(pickup.ok, true, 'para recoger no se pide dirección');
  assert.equal(pickup.value.references, '');
});

test('los campos se limpian y se recortan', () => {
  const { value } = validateOrder({ ...valid, name: 'Ana\n\u0000  Pérez', comments: 'x'.repeat(999) }, locations);
  assert.equal(value.name, 'Ana Pérez');
  assert.equal(value.comments.length, 200);
});

const lines = [
  { qty: 2, product: { name: 'BRISKET BURGER' }, variant: null, note: '', total: 93800 },
  { qty: 1, product: { name: 'HEINEKEN' }, variant: 'Jarra', note: 'bien fría', total: 33900 },
  { qty: 1, product: { name: 'BACON BBQ' }, variant: null, note: '', total: 36900 },
];
const evening = new Date(2026, 9, 7, 19, 32); // 7 de octubre de 2026, 7:32 pm

test('el mensaje es cordial, ordenado y completo (domicilio)', () => {
  const { value } = validateOrder({ ...valid, comments: 'Sin afán' }, locations);
  const message = buildOrderMessage({
    brand: 'Barbecue Garage',
    tagline: 'Smoked burgers & meats',
    order: value,
    lines,
    subtotal: 164600,
    now: evening,
  });

  assert.match(message, /^🔥 \*BARBECUE GARAGE\*\n_Smoked burgers & meats_/);
  assert.match(message, /Buenas noches 👋 Quisiera realizar el siguiente pedido en la \*Sede Le Meridiem Golf\*/);
  assert.match(message, /\*Pedido BG-0710-1932\*/);
  assert.match(message, /07\/10\/2026 · ⏰ 07:32 pm/);
  assert.match(message, /\*2 ×\* Brisket Burger — \$ 93\.800/);
  assert.match(message, /\*1 ×\* Heineken \(Jarra\) — \$ 33\.900\n {6}↳ _bien fría_/);
  assert.match(message, /\*1 ×\* Bacon BBQ — \$ 36\.900/);
  assert.match(message, /\*Subtotal:\* \$ 164\.600/);
  assert.match(message, /\*Domicilio:\* se confirma en este chat/);
  assert.match(message, /\*Nombre:\* Ana Pérez/);
  assert.match(message, /🛵 \*Servicio:\* Domicilio/);
  assert.match(message, /📍 \*Dirección:\* Calle 1 # 2-3/);
  assert.match(message, /\*Referencias:\* Apto 402/);
  assert.match(message, /💬 \*Comentarios:\* Sin afán/);
  assert.match(message, /Quedo pendiente de su confirmación\. ¡Muchas gracias! 🙏$/);
});

test('para recoger no aparecen dirección ni domicilio, y el saludo cambia según la hora', () => {
  const { value } = validateOrder({ ...valid, mode: 'pickup', comments: '' }, locations);
  const base = { brand: 'Barbecue Garage', order: value, lines, subtotal: 164600 };

  const morning = buildOrderMessage({ ...base, now: new Date(2026, 9, 7, 9, 5) });
  assert.match(morning, /Buenos días/);
  assert.match(morning, /BG-0710-0905/);
  assert.match(morning, /09:05 am/);
  assert.match(morning, /🛍️ \*Servicio:\* Recoger en el restaurante/);
  assert.doesNotMatch(morning, /Dirección|Domicilio:|Referencias|Comentarios/);

  assert.match(buildOrderMessage({ ...base, now: new Date(2026, 9, 7, 15, 0) }), /Buenas tardes/);
  assert.match(buildOrderMessage({ ...base, now: new Date(2026, 9, 7, 0, 30) }), /Buenos días.*12:30 am|12:30 am/s);
});

test('el cliente no puede secuestrar el formato de WhatsApp', () => {
  const { value } = validateOrder({ ...valid, name: '*URGENTE* _yo_ ~x~ `y`' }, locations);
  const message = buildOrderMessage({ brand: 'BG', order: value, lines: [], subtotal: 0, now: evening });
  assert.match(message, /\*Nombre:\* URGENTE yo x y/);

  const noted = buildOrderMessage({
    brand: 'BG',
    order: value,
    lines: [{ qty: 1, product: { name: 'X' }, variant: null, note: '*gratis* _ya_', total: 1 }],
    subtotal: 1,
    now: evening,
  });
  assert.match(noted, /↳ _gratis ya_/);
});

test('un pedido de tamaño normal cabe en el enlace de WhatsApp', () => {
  const { value } = validateOrder({ ...valid, comments: 'Sin afán' }, locations);
  const many = Array.from({ length: 12 }, (_, i) => ({ qty: 2, product: { name: `PRODUCTO NUMERO ${i}` }, variant: null, note: 'sin cebolla', total: 50000 }));
  const message = buildOrderMessage({ brand: 'Barbecue Garage', tagline: 'Smoked burgers & meats', order: value, lines: many, subtotal: 600000, now: evening });
  assert.ok(buildOrderUrl('573017491089', message), 'un pedido de 12 productos debe poder enviarse');
});

test('buildOrderUrl solo acepta números válidos y respeta el largo máximo', () => {
  assert.equal(buildOrderUrl('573017491089', 'hola mundo'), 'https://wa.me/573017491089?text=hola%20mundo');
  for (const bad of ['', 'abc', '57 301', '573017491089/../x', '1'.repeat(16), null, undefined]) {
    assert.equal(buildOrderUrl(bad, 'hola'), null, String(bad));
  }
  assert.equal(buildOrderUrl('573017491089', 'a'.repeat(MAX_ENCODED_LENGTH + 1)), null);
});

test('isOrderUrl rechaza todo lo que no sea https://wa.me/<número>?text=', () => {
  assert.equal(isOrderUrl('https://wa.me/573017491089?text=hola'), true);
  for (const bad of [
    'http://wa.me/573017491089?text=hola',
    'https://evil.com/573017491089?text=hola',
    'https://wa.me.evil.com/573017491089',
    'https://wa.me/573017491089?text=a&phone=1',
    'https://user@wa.me/573017491089',
    'https://wa.me:8080/573017491089',
    'https://wa.me/abc',
    'javascript:alert(1)',
    '',
    null,
  ]) {
    assert.equal(isOrderUrl(bad), false, String(bad));
  }
});
