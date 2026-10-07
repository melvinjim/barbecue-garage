import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

// Capa de acceso (Data Access Layer): TODA lectura o escritura de datos del panel
// debe pasar por `requireAdmin()`. Así la seguridad no depende solo del proxy.
//
// Regla de autorización: la persona debe haber iniciado sesión, tener activa la
// organización del restaurante (ADMIN_ORG_ID) y ser administradora de ella.
// Se fija UNA organización concreta a propósito: si bastara ser admin de
// "cualquier" organización, cualquiera que se registre podría crear la suya y entrar.

export type DeniedReason = "not-configured" | "no-org" | "wrong-org" | "not-admin";

export type Access =
  | { allowed: true; userId: string; orgId: string }
  | { allowed: false; reason: "signed-out" }
  | { allowed: false; reason: DeniedReason; userId: string; orgId: string | null; orgRole: string | null };

const ADMIN_ROLE = "org:admin";

export const getAccess = cache(async (): Promise<Access> => {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return { allowed: false, reason: "signed-out" };

  const adminOrgId = process.env.ADMIN_ORG_ID?.trim();
  const base = { allowed: false as const, userId, orgId: orgId ?? null, orgRole: orgRole ?? null };

  if (!adminOrgId) return { ...base, reason: "not-configured" };
  if (!orgId) return { ...base, reason: "no-org" };
  if (orgId !== adminOrgId) return { ...base, reason: "wrong-org" };
  if (orgRole !== ADMIN_ROLE) return { ...base, reason: "not-admin" };

  return { allowed: true, userId, orgId };
});

/** Úsalo al inicio de cada página, Route Handler o Server Action del panel. */
export async function requireAdmin() {
  const access = await getAccess();
  if (access.allowed) return access;
  redirect(access.reason === "signed-out" ? "/sign-in" : "/acceso");
}
