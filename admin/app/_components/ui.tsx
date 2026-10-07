import type { ReactNode } from "react";

// Piezas de interfaz compartidas por los formularios del panel.

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted/60 focus:border-white focus:outline-none aria-[invalid=true]:border-brand-text";

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-5 font-semibold transition hover:border-white";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-semibold text-brand-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {title ? <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">{title}</h2> : null}
      <div className="grid grid-cols-1 gap-4">{children}</div>
    </section>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        kind === "error" ? "border-brand bg-brand/15 text-brand-text" : "border-line bg-surface-2"
      }`}
    >
      {children}
    </p>
  );
}

export const formatCop = (value: number) => `$ ${value.toLocaleString("es-CO")}`;
