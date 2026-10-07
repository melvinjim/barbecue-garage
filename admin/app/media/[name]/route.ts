import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAccess } from "../../../lib/access.ts";
import { MENU_ASSETS_DIR } from "../../../lib/paths.ts";

// Muestra en el panel las fotos propias de la carta (assets/menu/<nombre>.webp).
//
// - Exige ser administrador: aquí NO basta con el proxy (no corre en rutas con extensión de archivo,
//   por eso la dirección es /media/<nombre> sin ".webp" y la comprobación se hace aquí mismo).
// - El nombre solo puede ser minúsculas, números y guiones: imposible salirse de la carpeta.

const NAME = /^[a-z0-9-]+$/;

export async function GET(_request: Request, context: RouteContext<"/media/[name]">) {
  const access = await getAccess();
  if (!access.allowed) return new Response("No autorizado", { status: 403 });

  const { name } = await context.params;
  if (!NAME.test(name)) return new Response("No encontrado", { status: 404 });

  try {
    const data = await readFile(path.join(MENU_ASSETS_DIR, `${name}.webp`));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
