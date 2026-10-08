import { requireAdmin } from "../../lib/access.ts";
import { categoryToValues } from "../../lib/form-values.ts";
import { imageSrc } from "../../lib/image-src.ts";
import { PUBLISH_NOTE, menuStore } from "../../lib/store.ts";
import { CategoryForm } from "../_components/category-form";
import { Card, Notice, ghostButton } from "../_components/ui";
import { deleteCategoryAction, moveCategoryAction } from "./actions";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Mensajes fijos: nunca se muestra texto que venga en la dirección.
const ERRORS: Record<string, string> = {
  "en-uso": "No se puede eliminar: todavía hay productos en esa categoría. Muévelos o elimínalos primero.",
  "ya-no-existe": "Esa categoría ya no existía (quizá la eliminó otra persona).",
  guardar: "No se pudo guardar el cambio. Inténtalo de nuevo.",
};

export default async function CategoriesPage(props: PageProps<"/categorias">) {
  await requireAdmin();
  const params = await props.searchParams;
  const menu = await menuStore.read();

  const counts = new Map<string, number>();
  for (const product of menu.products) {
    for (const id of product.categories) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const saved = menu.categories.find((category) => category.id === first(params.guardado));
  const error = ERRORS[first(params.error)];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide">Categorías</h1>
      <p className="mt-2 text-muted">
        El orden de esta lista es el orden en que aparecen en la carta. Usa las flechas para cambiarlo.
      </p>

      <div className="mt-4 grid gap-3 empty:hidden">
        {saved ? <Notice>Guardado: “{saved.name}”. {PUBLISH_NOTE}</Notice> : null}
        {first(params.resultado) === "eliminada" ? <Notice>Categoría eliminada.</Notice> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}
      </div>

      <details className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-brand-text">+ Nueva categoría</summary>
        <div className="mt-4">
          <CategoryForm initial={{}} idPrefix="nueva" />
        </div>
      </details>

      <ol className="mt-6 grid grid-cols-1 gap-4">
        {menu.categories.map((category, index) => {
          const count = counts.get(category.id) ?? 0;
          return (
            <li key={category.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold uppercase">
                      {index + 1}. {category.name}
                    </h2>
                    <p className="text-sm text-muted">
                      {count} {count === 1 ? "producto" : "productos"}
                      {category.subtitle ? ` · ${category.subtitle}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={moveCategoryAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className={ghostButton} disabled={index === 0} aria-label={`Subir ${category.name}`}>
                        ↑
                      </button>
                    </form>
                    <form action={moveCategoryAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className={ghostButton}
                        disabled={index === menu.categories.length - 1}
                        aria-label={`Bajar ${category.name}`}
                      >
                        ↓
                      </button>
                    </form>
                  </div>
                </div>

                <details className="mt-4 border-t border-line pt-4">
                  <summary className="cursor-pointer font-semibold">Editar</summary>
                  <div className="mt-4">
                    <CategoryForm
                      initial={categoryToValues(category)}
                      categoryId={category.id}
                      bannerPreview={imageSrc(category.banner)}
                      idPrefix={category.id}
                    />
                  </div>

                  <div className="mt-6 border-t border-line pt-4">
                    {count > 0 ? (
                      <p className="text-sm text-muted">
                        Para eliminar esta categoría primero hay que vaciarla (tiene {count}{" "}
                        {count === 1 ? "producto" : "productos"}).
                      </p>
                    ) : (
                      <form action={deleteCategoryAction} className="grid gap-3">
                        <input type="hidden" name="categoryId" value={category.id} />
                        <p className="text-sm text-muted">Está vacía. Se guarda una copia de seguridad antes de eliminarla.</p>
                        <div>
                          <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-white hover:brightness-110">
                            Eliminar “{category.name}”
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
