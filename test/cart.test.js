import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LINES, MAX_QTY, NOTE_MAX, createCart, productOptions } from '../js/features/cart.js';

const products = new Map(
  [
    { id: 'burger', name: 'BURGER', price: 30000, categories: ['b'] },
    { id: 'cerveza', name: 'CERVEZA', price: 10000, categories: ['b'], variants: [{ label: 'Jarra', price: 30000 }] },
    { id: 'salsa', name: 'SALSA', price: 2000, categories: ['e'] },
  ].map((p) => [p.id, p]),
);

const fakeStorage = (initial) => {
  const data = new Map(initial ? [['k', initial]] : []);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
};

test('agregar suma cantidades y calcula el total desde el menú', () => {
  const cart = createCart({ productsById: products });
  cart.add('burger', { qty: 2 });
  cart.add('salsa');
  assert.equal(cart.count(), 3);
  assert.equal(cart.subtotal(), 62000);
  assert.equal(cart.qtyOf('burger'), 2);
});

test('el mismo producto con la misma presentación y nota se fusiona; con otra nota, no', () => {
  const cart = createCart({ productsById: products });
  cart.add('burger');
  cart.add('burger');
  cart.add('burger', { note: 'sin cebolla' });
  const lines = cart.getLines();
  assert.equal(lines.length, 2);
  assert.equal(lines[0].qty, 2);
  assert.equal(lines[1].note, 'sin cebolla');
});

test('presentaciones: usa el precio de la presentación y rechaza las inexistentes', () => {
  const cart = createCart({ productsById: products });
  const line = cart.add('cerveza', { variant: 'Jarra' });
  assert.equal(line.unit, 30000);
  assert.equal(line.name, 'CERVEZA (Jarra)');
  assert.equal(cart.add('cerveza', { variant: 'Barril' }), null);
  assert.equal(cart.add('burger', { variant: 'Jarra' }), null);
  assert.deepEqual(productOptions(products.get('cerveza')).map((o) => o.label), ['Individual', 'Jarra']);
});

test('rechaza productos inexistentes y limita cantidades, líneas y notas', () => {
  const cart = createCart({ productsById: products });
  assert.equal(cart.add('fantasma'), null);
  assert.equal(cart.add('__proto__'), null);

  cart.add('burger', { qty: 999 });
  assert.equal(cart.count(), MAX_QTY);
  cart.add('burger', { qty: 5 });
  assert.equal(cart.count(), MAX_QTY, 'no debe pasar del máximo');

  const line = cart.add('salsa', { note: 'x'.repeat(500) });
  assert.equal(line.note.length, NOTE_MAX);

  const many = createCart({ productsById: products });
  for (let i = 0; i < MAX_LINES + 5; i++) many.add('burger', { note: `nota ${i}` });
  assert.equal(many.getLines().length, MAX_LINES);
});

test('setQty, adjust y remove', () => {
  const cart = createCart({ productsById: products });
  const { id } = cart.add('burger');
  cart.setQty(id, 4);
  assert.equal(cart.count(), 4);
  cart.adjust('burger', -1);
  assert.equal(cart.count(), 3);
  cart.adjust('salsa', +1);
  assert.equal(cart.qtyOf('salsa'), 1);
  cart.adjust('salsa', -1);
  assert.equal(cart.qtyOf('salsa'), 0, 'al llegar a 0 se quita la línea');
  cart.setQty(id, 0);
  assert.equal(cart.getLines().length, 0);
});

test('notifica cambios con su motivo y permite dejar de escuchar', () => {
  const cart = createCart({ productsById: products });
  const reasons = [];
  const stop = cart.subscribe((reason) => reasons.push(reason));
  const { id } = cart.add('burger');
  cart.setQty(id, 2);
  cart.setNote(id, 'bien cocida');
  cart.remove(id);
  stop();
  cart.add('burger');
  assert.deepEqual(reasons, ['add', 'qty', 'note', 'remove']);
});

test('se guarda y se recupera del almacenamiento', () => {
  const storage = fakeStorage();
  const first = createCart({ productsById: products, storage, storageKey: 'k' });
  first.add('burger', { qty: 2, note: 'sin salsa' });
  first.add('cerveza', { variant: 'Jarra' });

  const second = createCart({ productsById: products, storage, storageKey: 'k' });
  assert.equal(second.count(), 3);
  assert.equal(second.subtotal(), 2 * 30000 + 30000);
  assert.equal(second.getLines()[0].note, 'sin salsa');
});

test('un almacenamiento alterado no rompe nada ni mete datos falsos', () => {
  const tampered = JSON.stringify({
    v: 1,
    lines: [
      { p: 'burger', q: 2, n: 'ok', price: 1 }, // el precio guardado se ignora
      { p: 'fantasma', q: 1 },
      { p: 'burger', q: -5 },
      { p: 'burger', q: 1.5 },
      { p: 'burger', q: 'mucho' },
      { p: 'cerveza', v: 'Barril', q: 1 },
      { p: { toString: 'x' }, q: 1 },
      'texto',
      null,
      { p: 'salsa', q: 9999, n: '<img src=x onerror=alert(1)>' },
    ],
  });
  const cart = createCart({ productsById: products, storage: fakeStorage(tampered), storageKey: 'k' });
  const lines = cart.getLines();
  assert.equal(lines.length, 2);
  assert.equal(lines[0].total, 60000, 'el precio sale del menú, no del almacenamiento');
  assert.equal(lines[1].qty, MAX_QTY);

  for (const garbage of ['no es json', '{"v":2}', '[]', 'null', '{"v":1,"lines":"x"}']) {
    const safe = createCart({ productsById: products, storage: fakeStorage(garbage), storageKey: 'k' });
    assert.equal(safe.count(), 0);
  }
});

test('funciona aunque el almacenamiento falle', () => {
  const broken = {
    getItem() {
      throw new Error('bloqueado');
    },
    setItem() {
      throw new Error('lleno');
    },
  };
  const cart = createCart({ productsById: products, storage: broken, storageKey: 'k' });
  cart.add('burger');
  assert.equal(cart.count(), 1);
});
