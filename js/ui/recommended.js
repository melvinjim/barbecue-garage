import { createCard, categoryLabel } from './card.js';

/** Rellena la sección "Recomendados". Si no hay recomendados, la sección queda oculta. */
export function renderRecommended(section, grid, { categories, products, recommended, orders }) {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const productsById = new Map(products.map((p) => [p.id, p]));

  const items = recommended.map((id) => productsById.get(id)).filter(Boolean);
  if (!items.length) return;

  grid.replaceChildren(
    ...items.map((product) =>
      createCard(product, {
        scope: 'rec',
        orders,
        level: 'h3',
        variant: 'feature',
        categoryLabels: product.categories.map((id) => categoryLabel(categoriesById.get(id))),
      }),
    ),
  );
  section.hidden = false;
}
