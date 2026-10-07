import { requireAdmin } from "../lib/access.ts";
import { menuStore } from "../lib/store.ts";

export default async function DashboardPage() {
  await requireAdmin(); // cada página del panel verifica el acceso por sí misma

  const menu = await menuStore.read();
  const countFor = (categoryId: string) => menu.products.filter((p) => p.categories.includes(categoryId)).length;
  const biggest = Math.max(1, ...menu.categories.map((category) => countFor(category.id)));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold uppercase tracking-wide">Panel administrativo</h1>
      <p className="mt-2 text-muted">Edita la carta: los cambios se ven al instante en el sitio público.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Resumen de la carta">
        {[
          ["Productos", menu.products.length, "/productos"],
          ["Categorías", menu.categories.length, "/categorias"],
          ["Recomendados", menu.recommended.length, "/productos"],
        ].map(([label, value, href]) => (
          <a key={label} href={String(href)} className="rounded-2xl border border-line bg-surface p-5 transition hover:border-white">
            <p className="text-sm uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-1 text-4xl font-bold text-brand-text">{value}</p>
          </a>
        ))}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/productos/nuevo" className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-white hover:brightness-110">
          + Nuevo producto
        </a>
        <a href="/categorias" className="inline-flex min-h-11 items-center rounded-full border border-line px-6 font-semibold hover:border-white">
          Ordenar categorías y banners
        </a>
      </div>

      <section className="mt-12" aria-labelledby="por-categoria">
        <h2 id="por-categoria" className="text-xl font-bold uppercase tracking-wide">
          Productos por categoría
        </h2>
        <p className="mt-1 text-sm text-muted">Toca una categoría para ver y editar sus productos.</p>

        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menu.categories.map((category) => {
            const count = countFor(category.id);
            // La barra compara cada categoría con la más grande (solo es un apoyo visual: el número está en texto).
            const share = count === 0 ? 0 : Math.max(6, Math.round((count / biggest) * 100));
            return (
              <li key={category.id}>
                <a
                  href={`/productos?cat=${encodeURIComponent(category.id)}`}
                  className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-white"
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-lg font-bold uppercase leading-tight">{category.name}</span>
                      <span className="mt-1 block min-h-5 text-sm text-muted">{category.subtitle ?? " "}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-4xl font-bold leading-none text-brand-text">{count}</span>
                      <span className="mt-1 block text-xs uppercase tracking-wider text-muted">
                        {count === 1 ? "producto" : "productos"}
                      </span>
                    </span>
                  </span>

                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                  </span>

                  {/* En el celular la tarjeta entera ya se toca: la invitación solo se muestra en pantallas grandes (o si está vacía). */}
                  <span
                    className={`mt-auto text-sm font-semibold text-muted transition group-hover:text-white ${
                      count === 0 ? "" : "hidden sm:block"
                    }`}
                  >
                    {count === 0 ? "Vacía · agregar productos" : "Ver productos"} →
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
