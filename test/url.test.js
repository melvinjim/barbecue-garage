import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminHref,
  emailHref,
  googleMapsSearchUrl,
  isLocalAdminHref,
  instagramHref,
  mapsHref,
  safeHref,
  sanitizeImageUrl,
  telHref,
  whatsappHref,
} from '../js/lib/url.js';

test('sanitizeImageUrl acepta solo imágenes locales o de hosts permitidos', () => {
  assert.equal(
    sanitizeImageUrl('https://images.cluvi.com/abc/w_576_abc_foto.jpg'),
    'https://images.cluvi.com/abc/w_576_abc_foto.jpg',
  );
  assert.equal(sanitizeImageUrl('https://images-mini.cluvi.com/abc/foto.JPG'), 'https://images-mini.cluvi.com/abc/foto.JPG');
  assert.equal(sanitizeImageUrl('assets/foto.webp'), 'assets/foto.webp');
});

test('sanitizeImageUrl rechaza vectores de ataque', () => {
  const bad = [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'http://images.cluvi.com/a/b.jpg', // sin https
    'https://evil.com/a/b.jpg', // host no permitido
    'https://images.cluvi.com.evil.com/a/b.jpg', // host parecido
    'https://user:pass@images.cluvi.com/a/b.jpg', // credenciales
    'https://images.cluvi.com:8443/a/b.jpg', // puerto
    'https://images.cluvi.com/a/b.jpg?x=1', // query
    'https://images.cluvi.com/a/b.jpg#x', // hash
    'https://images.cluvi.com/a b/"onerror=x.jpg', // caracteres raros
    '//images.cluvi.com/a/b.jpg',
    'assets/../secreto.png',
    '/etc/passwd',
    '',
    null,
    undefined,
    42,
    {},
  ];
  for (const value of bad) assert.equal(sanitizeImageUrl(value), null, `debería rechazar: ${String(value)}`);
});

test('safeHref solo permite ancla interna, tel:, mailto: y https', () => {
  assert.equal(safeHref('#carta'), '#carta');
  assert.equal(safeHref('tel:+573001234567'), 'tel:+573001234567');
  assert.equal(safeHref('mailto:hola@ejemplo.com'), 'mailto:hola@ejemplo.com');
  assert.equal(safeHref('https://wa.me/573001234567'), 'https://wa.me/573001234567');

  for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'http://x.com', 'vbscript:x', 'file:///c:/x', '//x.com', '', null]) {
    assert.equal(safeHref(value), null, `debería rechazar: ${String(value)}`);
  }
});

test('safeHref acepta las páginas del propio sitio y nada parecido', () => {
  for (const ok of ['index.html', 'carta.html', 'domicilios.html', 'index.html#sedes']) assert.equal(safeHref(ok), ok);
  for (const bad of ['carta-html', 'cartaXhtml', '../carta.html', '/carta.html', 'carta.html?x=1', 'a/b.html', 'carta.html#<script>', 'CARTA.html', '.html']) {
    assert.equal(safeHref(bad), null, `debería rechazar: ${bad}`);
  }
});

test('adminHref: https sin puerto, o localhost con puerto; todo lo demás se rechaza', () => {
  assert.equal(adminHref('https://admin.barbecuegarage.com'), 'https://admin.barbecuegarage.com/');
  assert.equal(adminHref('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(adminHref(' http://localhost:3000/ '), 'http://localhost:3000/');
  assert.equal(isLocalAdminHref('http://localhost:3000'), true);
  assert.equal(isLocalAdminHref('https://admin.barbecuegarage.com/'), false);
  assert.equal(safeHref('http://localhost:3000'), 'http://localhost:3000'); // el DOM también lo deja pasar

  const bad = [
    'javascript:alert(1)',
    'http://evil.com',
    'http://evil.com:3000',
    'http://localhost.evil.com:3000',
    'http://localhost:3000@evil.com',
    'http://localhost@evil.com:3000',
    'http://localhost:3000/../x',
    'http://localhost:3000/admin',
    'http://localhost',
    'http://127.0.0.1:3000',
    'https://user:pass@admin.example.com',
    'ftp://localhost:3000',
    null,
    42,
  ];
  for (const value of bad) {
    assert.equal(adminHref(value), null, `adminHref debería rechazar: ${String(value)}`);
    if (typeof value === 'string' && value.startsWith('http://')) assert.equal(safeHref(value), null, `safeHref debería rechazar: ${value}`);
  }
});

test('googleMapsSearchUrl genera el enlace oficial y limpia el texto', () => {
  assert.equal(
    googleMapsSearchUrl('Barbecue Garage Cra 21 # 48-08 L2'),
    'https://www.google.com/maps/search/?api=1&query=Barbecue%20Garage%20Cra%2021%20%23%2048-08%20L2',
  );
  const url = new URL(googleMapsSearchUrl('a\u0000 b\n&x=1<script>'));
  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.searchParams.get('query'), 'a b &x=1<script>'); // todo queda dentro de "query"
  assert.equal([...url.searchParams.keys()].join(','), 'api,query');
  assert.equal(googleMapsSearchUrl(''), null);
  assert.equal(googleMapsSearchUrl(null), null);
  assert.ok(mapsHref(googleMapsSearchUrl('x')), 'el enlace generado pasa la lista blanca de mapas');
});

test('constructores de enlaces de contacto', () => {
  assert.equal(telHref('+57 300 123 4567'), 'tel:+573001234567');
  assert.equal(telHref('(604) 444-5566'), 'tel:6044445566');
  assert.equal(telHref('javascript:alert(1)'), null);
  assert.equal(telHref('123'), null);

  assert.equal(whatsappHref('+57 300 123 4567'), 'https://wa.me/573001234567');
  assert.equal(whatsappHref('abc'), null);

  assert.equal(emailHref('hola@ejemplo.com'), 'mailto:hola@ejemplo.com');
  assert.equal(emailHref('a@b.co?subject=x&bcc=otro@x.com'), null);
  assert.equal(emailHref('no-es-correo'), null);

  assert.equal(instagramHref('@barbecuegarage'), 'https://www.instagram.com/barbecuegarage/');
  assert.equal(instagramHref('x/../../admin'), null);

  assert.equal(mapsHref('https://maps.app.goo.gl/abc123'), 'https://maps.app.goo.gl/abc123');
  assert.equal(mapsHref('https://evil.com/maps'), null);
  assert.equal(mapsHref('javascript:alert(1)'), null);
});
