export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-text">404</p>
        <h1 className="mt-1 text-2xl font-bold">Página no encontrada</h1>
        <a href="/" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 font-semibold text-white">
          Ir al inicio
        </a>
      </div>
    </main>
  );
}
