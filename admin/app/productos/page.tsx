import { requireAdmin } from "../../lib/access.ts";
import { imageSrc } from "../../lib/image-src.ts";
import { PUBLISH_NOTE, menuStore } from "../../lib/store.ts";
import { Notice, formatCop, ghostButton, inputClass, primaryButton } from "../_components/ui";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Mensajes fijos: nunca se muestra texto que venga en la dirección.
const RESULTS: Record<string, { kind: "info" | "error"; text: string }> = {
  eliminado: { kind: "info", text: "Producto eliminado." },
  "ya-no-existe": { kind: "error", text: "Ese producto ya no existía (quizá lo eliminó otra persona)." },
  error: { kind: "error", text: "No se pudo eliminar el producto. Inténtalo de nuevo." },
};

export default async function ProductsPage(props: PageProps<"/productos">) {
  await requireAdmin();
  const params = await props.searchParams;
  const menu = await menuStore.read();

  const categoryNames = new Map(menu.categories.map((category) => [category.id, category.name]));
  const selectedCategory = categoryNames.has(first(params.cat)) ? first(params.cat) : "";
  const rawQuery = first(params.q).trim().slice(0, 60);
  const query = fold(rawQuery);

  // Dirección de un filtro de categoría que conserva lo que se escribió en la búsqueda.
  const filterHref = (categoryId: string) => {
    const search = new URLSearchParams();
    if (categoryId) search.set("cat", categoryId);
    if (rawQuery) search.set("q", rawQuery);
    const text = search.toString();
    return text ? `/productos?${text}` : "/productos";
  };

  const products = menu.products.filter(
    (product) =>
      (!selectedCategory || product.categories.includes(selectedCategory)) && (!query || fold(product.name).includes(query)),
  );
  const recommended = new Set(menu.recommended);

  const savedProduct = menu.products.find((product) => product.id === first(params.guardado));
  const result = RESULTS[first(params.resultado)];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold uppercase tracking-wide">Productos</h1>
        <a href={`/productos/nuevo${selectedCategory ? `?cat=${selectedCategory}` : ""}`} className={primaryButton}>
          + Nuevo producto
        </a>
      </div>

      <div className="mt-4 grid gap-3 empty:hidden">
        {savedProduct ? <Notice>Guardado: “{savedProduct.name}”. {PUBLISH_NOTE}</Notice> : null}
        {result ? <Notice kind={result.kind}>{result.text}</Notice> : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-4">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          {selectedCategory ? <input type="hidden" name="cat" value={selectedCategory} /> : null}
          <input name="q" defaultValue={rawQuery} placeholder="Buscar por nombre…" aria-label="Buscar por nombre" className={inputClass} />
          <button type="submit" className={ghostButton}>Buscar</button>
        </form>

        {/* Selector propio (no un <select>): el desplegable nativo del celular se sale de la página. Este se abre dentro de ella. */}
        <details className="group rounded-xl border border-line bg-surface-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 truncate">
              <span className="text-muted">Categoría: </span>
              <strong>{selectedCategory ? categoryNames.get(selectedCategory) : "Todas"}</strong>
            </span>
            <span aria-hidden="true" className="text-muted transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="flex flex-wrap gap-2 border-t border-line p-3">
            {[{ id: "", name: "Todas" }, ...menu.categories].map((category) => {
              const active = category.id === selectedCategory;
              return (
                <li key={category.id || "todas"}>
                  <a
                    href={filterHref(category.id)}
                    aria-current={active ? "true" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition ${
                      active ? "border-brand bg-brand text-white" : "border-line hover:border-white"
                    }`}
                  >
                    {category.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-4 text-sm text-muted" role="status">
        <span>
          {products.length} de {menu.products.length} productos
        </span>
        {selectedCategory || rawQuery ? (
          <a href="/productos" className="font-semibold text-brand-text hover:underline">
            Quitar filtros
          </a>
        ) : null}
      </p>

      <ul className="mt-3 grid grid-cols-1 gap-3">
        {products.map((product) => {
          const src = imageSrc(product.image);
          return (
            <li key={product.id}>
              <a
                href={`/productos/${encodeURIComponent(product.id)}`}
                className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-white"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de la carta (puede ser externa)
                  <img src={src} alt="" loading="lazy" className="size-[4.5rem] rounded-xl bg-surface-2 object-cover" />
                ) : (
                  <span className="grid size-[4.5rem] place-items-center rounded-xl bg-surface-2 text-xs text-muted">Sin foto</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-bold uppercase">
                    {product.name}
                    {product.featured ? <span className="ml-1 text-brand-text" title="Favorito">★</span> : null}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {product.categories.map((id) => categoryNames.get(id) ?? id).join(" · ")}
                    {recommended.has(product.id) ? " · Recomendado" : ""}
                  </span>
                </span>
                <span className="text-right font-bold text-brand-text">{formatCop(product.price)}</span>
              </a>
            </li>
          );
        })}
      </ul>

      {products.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          No hay productos con ese filtro.
        </p>
      ) : null}
    </main>
  );
}
