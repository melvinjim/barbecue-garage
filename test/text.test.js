import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex, matchProducts } from '../js/features/search.js';
import { formatPrice } from '../js/lib/format.js';
import { normalize, paragraphs, sanitizeQuery, titleCase } from '../js/lib/text.js';

test('titleCase presenta bien los nombres de la carta', () => {
  assert.equal(titleCase('BRISKET BURGER'), 'Brisket Burger');
  assert.equal(titleCase('MIX DE TACOS'), 'Mix de Tacos');
  assert.equal(titleCase('BACON BBQ'), 'Bacon BBQ');
  assert.equal(titleCase('LA GRINGA'), 'La Gringa');
  assert.equal(titleCase("PA' EMPEZAR"), "Pa' Empezar");
  assert.equal(titleCase('TACOS DE CHICHARRÓN (2)'), 'Tacos de Chicharrón (2)');
  assert.equal(titleCase('LUNCH POSTA NEGRA (COLOMBIAN STYLE BLACK BEEF)'), 'Lunch Posta Negra (Colombian Style Black Beef)');
  assert.equal(titleCase("Botella Jack Daniel's #7"), "Botella Jack Daniel's #7");
  assert.equal(titleCase('MEAT & RIB'), 'Meat & Rib');
  assert.equal(titleCase(''), '');
});

test('normalize ignora tildes, mayúsculas y signos', () => {
  assert.equal(normalize('  Bretaña  '), 'bretana');
  assert.equal(normalize('PICADA DE CHICHARRÓN'), 'picada de chicharron');
  assert.equal(normalize("Hendrick's & Co."), 'hendrick s co');
  assert.equal(normalize(null), '');
});

test('sanitizeQuery limpia control, espacios y limita el largo', () => {
  assert.equal(sanitizeQuery('  hola \n\t mundo \u0000 ', 60), 'hola mundo');
  assert.equal(sanitizeQuery('x'.repeat(200), 60).length, 60);
  assert.equal(sanitizeQuery(undefined, 60), '');
});

test('paragraphs separa por línea en blanco', () => {
  assert.deepEqual(paragraphs('uno\n\ndos\n\n\ntres'), ['uno', 'dos', 'tres']);
  assert.deepEqual(paragraphs(''), []);
});

test('formatPrice usa formato colombiano', () => {
  assert.equal(formatPrice(34900), '$ 34.900');
  assert.equal(formatPrice(129900), '$ 129.900');
  assert.equal(formatPrice(Number.NaN), '');
});

test('búsqueda: todas las palabras, sin tildes y sin regex', () => {
  const categories = new Map([['burgers', { id: 'burgers', name: 'Burgers' }]]);
  const products = [
    { id: 'a', name: 'BRISKET BURGER', categories: ['burgers'], description: 'Pecho de res ahumado' },
    { id: 'b', name: 'CHORIZO ANTIOQUEÑO', categories: ['burgers'] },
    { id: 'c', name: 'SODA BRETAÑA', categories: ['burgers'] },
  ];
  const index = buildIndex(products, categories);
  const ids = (q) => matchProducts(index, q).map((e) => e.product.id);

  assert.deepEqual(ids(''), ['a', 'b', 'c']);
  assert.deepEqual(ids('brisket'), ['a']);
  assert.deepEqual(ids('ahumado res'), ['a']); // todas las palabras, en cualquier orden
  assert.deepEqual(ids('bretana'), ['c']); // sin tilde
  assert.deepEqual(ids('antioqueno'), ['b']);
  assert.deepEqual(ids('.*'), ['a', 'b', 'c']); // los signos se ignoran; nunca se interpretan como regex
  assert.deepEqual(ids('((['), ['a', 'b', 'c']);
  assert.deepEqual(ids('inexistente'), []);
});
