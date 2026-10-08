import "server-only";

import { createGithubClient } from "./github.ts";
import { createGithubImageStore, createGithubMenuStore } from "./github-store.ts";
import { createLocalImageStore, type ImageStore } from "./image-store.ts";
import { createMenuStore, type MenuStore } from "./menu-store.ts";
import { BACKUP_DIR, DATA_FILE, MENU_ASSETS_DIR } from "./paths.ts";

// Único punto donde se decide DÓNDE se guarda la carta; el resto del panel usa solo `menuStore` e `imageStore`.
//
//  - Con GITHUB_TOKEN y GITHUB_REPO definidos → producción: commits en GitHub (el sitio se republica solo).
//  - Sin ellos → desarrollo: archivos del disco local (../data/menu.json y ../assets/menu).

const token = process.env.GITHUB_TOKEN?.trim() || undefined;
const repo = process.env.GITHUB_REPO?.trim() || undefined;

if (Boolean(token) !== Boolean(repo)) {
  throw new Error("Define GITHUB_TOKEN y GITHUB_REPO juntos (o ninguno de los dos para guardar en el disco local).");
}
if (!token && process.env.VERCEL) {
  // En Vercel el disco es de solo lectura: sin GitHub, guardar fallaría de forma confusa.
  throw new Error("En Vercel hay que configurar GITHUB_TOKEN y GITHUB_REPO para poder guardar la carta.");
}

export const storageMode: "github" | "local" = token ? "github" : "local";

let menu: MenuStore;
let images: ImageStore;

if (token && repo) {
  const client = createGithubClient({ token, repo, branch: process.env.GITHUB_BRANCH?.trim() || "main" });
  menu = createGithubMenuStore({ client });
  images = createGithubImageStore(client);
} else {
  menu = createMenuStore({ dataFile: DATA_FILE, backupDir: BACKUP_DIR });
  images = createLocalImageStore(MENU_ASSETS_DIR);
}

/** Carta (lectura y escritura con validación). */
export const menuStore: MenuStore = menu;

/** Fotos y banners de la carta. */
export const imageStore: ImageStore = images;

/** Qué decirle a la persona después de guardar, según dónde se guarda. */
export const PUBLISH_NOTE =
  storageMode === "github" ? "En 1 o 2 minutos se verá en el sitio público." : "Ya se ve en el sitio público.";
