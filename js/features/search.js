import { normalize } from '../lib/text.js';

/**
 * Prepara un índice de búsqueda: por cada producto, un texto normalizado con
 * su nombre, descripción, ingredientes, premio y categorías.
 */
export function buildIndex(products, categoriesById) {
  return products.map((product) => {
    const categoryText = product.categories
      .map((id) => {
        const c = categoriesById.get(id);
        return c ? `${c.name} ${c.subtitle ?? ''}` : '';
      })
      .join(' ');
    const text = normalize(
      [product.name, product.description, product.includes?.join(' '), product.award, categoryText].join(' '),
    );
    return { product, text };
  });
}

/**
 * Devuelve las entradas que contienen TODAS las palabras de la consulta.
 * La consulta nunca se usa como expresión regular: solo `includes`.
 */
export function matchProducts(index, query) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return index;
  return index.filter((entry) => tokens.every((token) => entry.text.includes(token)));
}
