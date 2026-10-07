"use client";

// Si algo falla al dibujar una página, se muestra este aviso en vez de una pantalla en blanco.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6" role="alert">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-text">Algo salió mal</p>
        <h1 className="mt-1 text-2xl font-bold">No pudimos mostrar esta página</h1>
        <p className="mt-3 text-muted">
          Inténtalo de nuevo. Si sigue pasando, revisa la ventana del servidor del panel: ahí aparece el detalle del
          error{error.digest ? ` (código ${error.digest})` : ""}.
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-brand px-5 py-2 font-semibold text-white">
            Reintentar
          </button>
          <a href="/" className="rounded-full border border-line px-5 py-2 font-semibold">
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}
