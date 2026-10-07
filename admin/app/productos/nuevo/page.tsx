import { FIELD_LIMITS } from "../../../../js/data/schema.js";
import { requireAdmin } from "../../../lib/access.ts";
import { menuStore } from "../../../lib/store.ts";
import { ProductForm } from "../../_components/product-form";

export default async function NewProductPage(props: PageProps<"/productos/nuevo">) {
  await requireAdmin();
  const menu = await menuStore.read();

  // Si se llegó desde una categoría filtrada, esa categoría viene marcada (solo si existe de verdad).
  const requested = (await props.searchParams).cat;
  const preselected = typeof requested === "string" && menu.categories.some((c) => c.id === requested) ? [requested] : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <a href="/productos" className="text-sm text-muted hover:text-white">← Volver a productos</a>
      <h1 className="mt-2 mb-6 text-3xl font-bold uppercase tracking-wide">Nuevo producto</h1>
      <ProductForm
        categories={menu.categories.map(({ id, name, subtitle }) => ({ id, name, subtitle }))}
        initial={{ categories: preselected }}
        recommendedCount={menu.recommended.length}
        recommendedLimit={FIELD_LIMITS.recommended}
      />
    </main>
  );
}
