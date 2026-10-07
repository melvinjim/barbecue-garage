import { redirect } from "next/navigation";
import { getAccess, type DeniedReason } from "../../lib/access";

// Pantalla para quien YA inició sesión pero todavía no está autorizado en el panel.
// (La ruta exige sesión por el proxy; aquí además se explica qué falta.)

const messages: Record<DeniedReason, { title: string; text: string }> = {
  "not-configured": {
    title: "Falta autorizar a la organización del restaurante",
    text: "El panel todavía no sabe qué organización puede administrar la carta. Sigue los pasos de abajo (se hacen una sola vez).",
  },
  "no-org": {
    title: "Elige tu organización",
    text: "Usa el selector de organización de arriba y elige la del restaurante.",
  },
  "wrong-org": {
    title: "Esta organización no tiene acceso",
    text: "Cambia a la organización del restaurante con el selector de arriba.",
  },
  "not-admin": {
    title: "Necesitas ser administrador",
    text: "Tu cuenta pertenece a la organización, pero sin el rol de administrador. Pídele a quien administra el restaurante que te lo asigne.",
  },
};

export default async function AccessPage() {
  const access = await getAccess();
  if (access.allowed) redirect("/");
  if (access.reason === "signed-out") redirect("/sign-in");

  const message = messages[access.reason];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-text">Acceso restringido</p>
        <h1 className="mt-1 text-2xl font-bold">{message.title}</h1>
        <p className="mt-3 text-muted">{message.text}</p>

        {access.reason === "not-configured" && (
          <ol className="mt-5 list-decimal space-y-2 pl-5">
            <li>
              Con el selector de arriba, <strong>crea la organización</strong> del restaurante (o elige la que ya
              tengas). Quien la crea queda como administrador.
            </li>
            <li>
              Copia este identificador de organización:{" "}
              {access.orgId ? (
                <code className="rounded bg-surface-2 px-2 py-1 font-mono text-sm break-all">{access.orgId}</code>
              ) : (
                <em className="text-muted">(aparece cuando eliges una organización activa)</em>
              )}
            </li>
            <li>
              Pégalo en <code className="font-mono">admin/.env.local</code> como{" "}
              <code className="font-mono">ADMIN_ORG_ID=…</code> y reinicia el panel.
            </li>
          </ol>
        )}

        <p className="mt-6 text-sm text-muted">
          Tu rol actual: <strong>{access.orgRole ?? "sin organización activa"}</strong>
        </p>
      </div>
    </main>
  );
}
