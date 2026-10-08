import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SchemaError, parseMenu, parseSite } from '../js/data/schema.js';

const base = () => ({
  categories: [{ id: 'burgers', name: 'Burgers' }],
  products: [{ id: 'clasica', categories: ['burgers'], name: 'CLASICA', price: 30000 }],
});

test('parseMenu acepta datos válidos', () => {
  const menu = parseMenu(base());
  assert.equal(menu.products.length, 1);
  assert.equal(menu.warnings.length, 0);
});

test('parseMenu rechaza estructuras inválidas', () => {
  for (const raw of [null, [], 'x', {}, { categories: [], products: [] }, { categories: [{ id: 'a', name: 'A' }], products: [] }]) {
    assert.throws(() => parseMenu(raw), SchemaError);
  }
});

test('parseMenu omite productos inválidos sin romper el resto', () => {
  const raw = base();
  raw.products.push(
    { id: 'Mala ID!', categories: ['burgers'], name: 'x', price: 1 },
    { id: 'sin-precio', categories: ['burgers'], name: 'x' },
    { id: 'precio-texto', categories: ['burgers'], name: 'x', price: '1000' },
    { id: 'precio-negativo', categories: ['burgers'], name: 'x', price: -5 },
    { id: 'sin-categoria', categories: ['no-existe'], name: 'x', price: 1 },
    { id: 'clasica', categories: ['burgers'], name: 'duplicado', price: 1 },
    'texto suelto',
    null,
  );
  const menu = parseMenu(raw);
  assert.deepEqual(menu.products.map((p) => p.id), ['clasica']);
  assert.equal(menu.warnings.length, 8); // una advertencia por cada entrada inválida
});

test('parseMenu solo copia campos conocidos (sin contaminación de prototipo)', () => {
  const raw = JSON.parse(
    '{"categories":[{"id":"a","name":"A"}],"products":[{"id":"p","categories":["a"],"name":"P","price":1,"__proto__":{"admin":true},"evil":"<script>"}]}',
  );
  const [product] = parseMenu(raw).products;
  assert.equal(product.admin, undefined);
  assert.equal(product.evil, undefined);
  assert.equal({}.admin, undefined);
});

test('parseMenu descarta imágenes de hosts no permitidos pero conserva el producto', () => {
  const raw = base();
  raw.products[0].image = 'https://evil.com/x.jpg';
  const menu = parseMenu(raw);
  assert.equal(menu.products[0].image, undefined);
  assert.equal(menu.warnings.length, 1);
});

test('parseMenu limpia caracteres de control y respeta largos máximos', () => {
  const raw = base();
  raw.products[0].name = 'CLASICA\u0000\n\tX';
  raw.products[0].description = 'a'.repeat(901);
  const [product] = parseMenu(raw).products;
  assert.equal(product.name, 'CLASICA X');
  assert.equal(product.description, undefined);
});

test('parseMenu: el banner de categoría solo acepta imágenes de hosts permitidos', () => {
  const raw = base();
  raw.categories[0].banner = 'https://images-mini.cluvi.com/a/w_768_a_banner.png';
  assert.equal(parseMenu(raw).categories[0].banner, 'https://images-mini.cluvi.com/a/w_768_a_banner.png');

  for (const bad of ['https://evil.com/banner.png', 'javascript:alert(1)', 42]) {
    const menu = parseMenu({ ...base(), categories: [{ id: 'burgers', name: 'Burgers', banner: bad }] });
    assert.equal(menu.categories[0].banner, undefined);
    assert.equal(menu.warnings.length, 1, 'un banner rechazado deja una advertencia');
  }
});

test('parseMenu ignora recomendados que no existen', () => {
  const raw = base();
  raw.recommended = ['clasica', 'fantasma', 42];
  assert.deepEqual([...parseMenu(raw).recommended], ['clasica']);
});

test('parseSite: todo es opcional y los enlaces se construyen desde datos simples', () => {
  const empty = parseSite(null);
  assert.equal(empty.contact.phone, null);
  assert.equal(empty.hours.length, 0);
  assert.equal(empty.social.length, 0);

  const site = parseSite({
    name: 'Barbecue Garage',
    contact: { phone: '+57 300 123 4567', whatsapp: '573001234567', email: 'hola@ejemplo.com', mapsUrl: 'https://maps.app.goo.gl/x' },
    hours: [{ label: 'Lun - Dom', value: '12:00 pm - 10:00 pm' }, { label: '', value: 'x' }],
    social: { instagram: '@barbecuegarage' },
    reviewUrl: 'https://g.page/r/abc',
  });
  assert.equal(site.contact.phone.href, 'tel:+573001234567');
  assert.equal(site.contact.whatsapp.href, 'https://wa.me/573001234567');
  assert.equal(site.contact.email.href, 'mailto:hola@ejemplo.com');
  assert.equal(site.contact.maps, 'https://maps.app.goo.gl/x');
  assert.equal(site.hours.length, 1);
  assert.equal(site.social[0].href, 'https://www.instagram.com/barbecuegarage/');
  assert.equal(site.reviewHref, 'https://g.page/r/abc');
});

test('parseSite: sedes con WhatsApp se guardan como número y las inválidas no reciben pedidos', () => {
  const site = parseSite({
    locations: [
      { id: 'cra-21', name: 'Sede Cra 21', address: 'Cra 21 # 48-08 L2', whatsapp: '+57 304 270 3186' },
      { id: 'sin-numero', name: 'Sede B', whatsapp: 'javascript:alert(1)' },
      { id: 'cra-21', name: 'Duplicada', whatsapp: '573000000000' },
      { id: 'Mala ID', name: 'X', whatsapp: '573000000000' },
      { id: 'sin-nombre', whatsapp: '573000000000' },
      'texto',
      null,
    ],
  });
  assert.deepEqual(site.locations.map((l) => l.id), ['cra-21', 'sin-numero']);
  assert.equal(site.locations[0].whatsapp.number, '573042703186');
  assert.equal(site.locations[0].whatsapp.href, 'https://wa.me/573042703186');
  assert.equal(site.locations[1].whatsapp, null);
  assert.equal(parseSite({}).locations.length, 0);
});

test('parseSite: cada sede lleva su enlace a Google Maps (explícito o generado)', () => {
  const site = parseSite({
    name: 'Barbecue Garage',
    locations: [
      { id: 'a', name: 'Sede A', address: 'Cra 21 # 48-08 L2', whatsapp: '573000000000' },
      { id: 'b', name: 'Sede B', address: 'Otra dirección', mapsUrl: 'https://maps.app.goo.gl/abc123' },
      { id: 'c', name: 'Sede C', address: 'Otra', mapsUrl: 'javascript:alert(1)' },
      { id: 'd', name: 'Sede D' },
    ],
  });
  const [a, b, c, d] = site.locations;
  assert.match(a.maps, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Barbecue%20Garage%20Cra%2021/);
  assert.equal(b.maps, 'https://maps.app.goo.gl/abc123');
  assert.match(c.maps, /^https:\/\/www\.google\.com\/maps\/search\//, 'un mapsUrl inválido cae al enlace generado');
  assert.equal(d.maps, null, 'sin dirección ni enlace no hay mapa');
});

test('parseSite: logo e imágenes de la portada solo de hosts permitidos', () => {
  const site = parseSite({
    logo: 'https://images-mini.cluvi.com/a/logo.png',
    tiles: {
      ubicacion: 'https://images.cluvi.com/a/b.jpg',
      domicilio: 'https://evil.com/a.jpg',
      menu: 'javascript:alert(1)',
      reserva: 42,
      otra: 'https://images.cluvi.com/x/y.jpg',
    },
  });
  assert.equal(site.logo, 'https://images-mini.cluvi.com/a/logo.png');
  assert.deepEqual({ ...site.tiles }, { ubicacion: 'https://images.cluvi.com/a/b.jpg' });
  assert.equal(parseSite({ logo: 'https://evil.com/logo.png' }).logo, null);
});

test('parseSite rechaza enlaces peligrosos', () => {
  const site = parseSite({
    contact: { phone: 'javascript:alert(1)', email: 'x@y.co?bcc=z@z.co', mapsUrl: 'javascript:alert(1)' },
    social: { instagram: '../admin' },
    reviewUrl: 'javascript:alert(1)',
  });
  assert.equal(site.contact.phone, null);
  assert.equal(site.contact.email, null);
  assert.equal(site.contact.maps, null);
  assert.equal(site.social.length, 0);
  assert.equal(site.reviewHref, null);
});

test('parseSite: adminUrl solo acepta https o el localhost del panel', () => {
  assert.equal(parseSite({ adminUrl: 'http://localhost:3000' }).adminHref, 'http://localhost:3000');
  assert.equal(parseSite({ adminUrl: 'https://admin.barbecuegarage.com' }).adminHref, 'https://admin.barbecuegarage.com/');
  for (const bad of ['javascript:alert(1)', 'http://evil.com', '/admin', '', undefined, 7]) {
    assert.equal(parseSite({ adminUrl: bad }).adminHref, null, String(bad));
  }
  assert.equal(parseSite(null).adminHref, null);
});
