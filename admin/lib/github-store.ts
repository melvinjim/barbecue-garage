import { GithubConflictError, type GithubClient } from "./github.ts";
import { assertImageFile, type ImageStore } from "./image-store.ts";
import { assertValidMenu, type MenuStore } from "./menu-store.ts";
import type { RawMenu } from "./menu-types.ts";

// Producción: la carta y las fotos viven en el repositorio de GitHub.
//
// Cada guardado es un commit en la rama configurada. Como el sitio público se publica desde ese mismo
// repositorio, en uno o dos minutos Cloudflare lo reconstruye y el cambio queda visible. El historial
// de Git hace de respaldo: cualquier versión anterior de la carta se puede recuperar.
//
// Las garantías son las mismas que en la versión local (menu-store.ts):
//  - Los cambios dentro de una misma instancia van uno a la vez (cola).
//  - Si hay VARIAS instancias (hosting sin servidor), el control de versiones de GitHub (sha) evita pisar el
//    cambio de otra persona: se vuelve a leer la carta y se reaplica el cambio (hasta `maxAttempts` veces).
//  - Toda la carta resultante se valida con el validador del sitio público antes de guardar nada.

const MENU_PATH = "data/menu.json";
const IMAGE_DIR = "assets/menu/";

/** Texto de una línea, corto y sin caracteres de control, apto para el mensaje de un commit. */
function commitMessage(prefix: string, note?: string): string {
  const clean = (note ?? "").replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, 72);
  return clean ? `${prefix}: ${clean}` : `${prefix}: cambio desde el panel`;
}

export function createGithubMenuStore({ client, maxAttempts = 4 }: { client: GithubClient; maxAttempts?: number }): MenuStore {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<{ menu: RawMenu; sha: string }> {
    const file = await client.getFile(MENU_PATH);
    if (!file) throw new Error(`No se encontró ${MENU_PATH} en el repositorio.`);
    return { menu: JSON.parse(file.data.toString("utf8")) as RawMenu, sha: file.sha };
  }

  async function read(): Promise<RawMenu> {
    return (await load()).menu;
  }

  function update<T>(mutator: (menu: RawMenu) => T | Promise<T>, note?: string): Promise<T> {
    const run = async (): Promise<T> => {
      for (let attempt = 1; ; attempt++) {
        const { menu, sha } = await load();
        const result = await mutator(menu);
        assertValidMenu(menu);
        try {
          await client.putFile(MENU_PATH, `${JSON.stringify(menu, null, 2)}\n`, commitMessage("Carta", note), sha);
          return result;
        } catch (error) {
          // Alguien más guardó entre la lectura y la escritura: se reintenta sobre la versión nueva.
          if (error instanceof GithubConflictError && attempt < maxAttempts) continue;
          throw error;
        }
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  return { read, update };
}

export function createGithubImageStore(client: GithubClient): ImageStore {
  const pathOf = (fileName: string) => {
    assertImageFile(fileName);
    return `${IMAGE_DIR}${fileName}`;
  };

  return {
    async put(fileName, data) {
      // El nombre lo genera el servidor con 32 bits aleatorios: nunca existe ya, no hace falta leerlo antes.
      await client.putFile(pathOf(fileName), data, `Foto: ${fileName}`);
    },

    async get(fileName) {
      const file = await client.getFile(pathOf(fileName));
      return file ? new Uint8Array(file.data) : null;
    },

    async remove(fileName) {
      const filePath = pathOf(fileName);
      const file = await client.getFile(filePath);
      if (file) await client.deleteFile(filePath, file.sha, `Quitar foto: ${fileName}`);
    },
  };
}
