import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMenu, parseSite } from '../js/data/schema.js';

const read = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));

// Estas pruebas protegen la carta real: si alguien edita menu.json y comete
// un error, `npm test` lo detecta antes de publicar.

test('data/menu.json es 100% válido (sin advertencias)', () => {
  const menu = parseMenu(read('menu.json'));
  assert.deepEqual([...menu.warnings], []);
  assert.ok(menu.products.length > 0);
});

test('cada categoría tiene al menos un producto', () => {
  const menu = parseMenu(read('menu.json'));
  for (const category of menu.categories) {
    const count = menu.products.filter((p) => p.categories.includes(category.id)).length;
    assert.ok(count > 0, `categoría vacía: ${category.id}`);
  }
});

test('los recomendados existen', () => {
  const raw = read('menu.json');
  const menu = parseMenu(raw);
  assert.equal(menu.recommended.length, raw.recommended.length, 'hay recomendados que no existen en products');
});

test('no hay dos productos con el mismo nombre, precio y categoría principal', () => {
  const menu = parseMenu(read('menu.json'));
  const seen = new Set();
  for (const p of menu.products) {
    const key = `${p.name}|${p.price}|${p.categories[0]}`;
    assert.ok(!seen.has(key), `producto repetido: ${key}`);
    seen.add(key);
  }
});

test('data/site.json es válido', () => {
  const site = parseSite(read('site.json'));
  assert.ok(site.name);
});
