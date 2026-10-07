import { notFound } from "next/navigation";
import { FIELD_LIMITS } from "../../../../js/data/schema.js";
import { requireAdmin } from "../../../lib/access.ts";
import { productToValues } from "../../../lib/form-values.ts";
import { imageSrc } from "../../../lib/image-src.ts";
import { menuStore } from "../../../lib/store.ts";
import { ProductForm } from "../../_components/product-form";
import { deleteProductAction } from "../actions";

export default async function EditProductPage(props: PageProps<"/productos/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const menu = await menuStore.read();

  const product = menu.products.find((candidate) => candidate.id === id);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <a href="/productos" className="text-sm text-muted hover:text-white">← Volver a productos</a>
      <h1 className="mt-2 mb-6 text-3xl font-bold uppercase tracking-wide">Editar producto</h1>

      <ProductForm
        categories={menu.categories.map(({ id: categoryId, name, subtitle }) => ({ id: categoryId, name, subtitle }))}
        initial={productToValues(product, menu.recommended.includes(product.id))}
        productId={product.id}
        imagePreview={imageSrc(product.image)}
        recommendedCount={menu.recommended.length}
        recommendedLimit={FIELD_LIMITS.recommended}
      />

      {/* Eliminar: formulario aparte (no se anidan formularios) y con confirmación en dos pasos */}
      <details className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-brand-text">Eliminar este producto</summary>
        <form action={deleteProductAction} className="mt-4 grid gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <p className="text-sm text-muted">
            Se quitará “{product.name}” de la carta y se borrará su foto si ninguna otra la usa. Se guarda una copia de
            seguridad de la carta antes de cambiarla.
          </p>
          <div>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-white hover:brightness-110">
              Sí, eliminar definitivamente
            </button>
          </div>
        </form>
      </details>
    </main>
  );
}
