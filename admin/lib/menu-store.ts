import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMenu } from "../../js/data/schema.js";
import type { RawMenu } from "./menu-types.ts";

// Lectura y escritura de data/menu.json.
//
// Garantías de cada cambio (`update`):
//  1. Los cambios se aplican uno a la vez (cola), nunca dos escrituras entrelazadas.
//  2. Toda la carta resultante se valida con el MISMO validador del sitio público, y se
//     rechaza si algo se descartaría en silencio (producto, categoría o recomendado perdido).
//  3. Antes de escribir se guarda una copia de seguridad con fecha (se conservan las últimas N).
//  4. La escritura es atómica: se escribe un archivo temporal y se renombra, así el sitio
//     público nunca lee un archivo a medias.
//
// Esta es la implementación local (archivos). Para producción se reemplazaría por una base de
// datos o almacenamiento en la nube manteniendo esta misma interfaz { read, update }.

export class MenuValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`La carta resultante no es válida: ${problems.join("; ")}`);
    this.name = "MenuValidationError";
    this.problems = problems;
  }
}

/** Lanza MenuValidationError si el sitio público descartaría o rechazaría algo de esta carta. */
export function assertValidMenu(menu: RawMenu): void {
  let parsed;
  try {
    parsed = parseMenu(menu);
  } catch (error) {
    throw new MenuValidationError([error instanceof Error ? error.message : "estructura inválida"]);
  }

  const problems = [...parsed.warnings];
  if (parsed.products.length !== menu.products.length) problems.push("algún producto sería descartado");
  if (parsed.categories.length !== menu.categories.length) problems.push("alguna categoría sería descartada");
  if (parsed.recommended.length !== menu.recommended.length) problems.push("algún recomendado no existe o está repetido");
  if (problems.length) throw new MenuValidationError(problems);
}

type StoreOptions = { dataFile: string; backupDir: string; maxBackups?: number };

export function createMenuStore({ dataFile, backupDir, maxBackups = 30 }: StoreOptions) {
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<RawMenu> {
    return JSON.parse(await readFile(dataFile, "utf8")) as RawMenu;
  }

  async function backup(previous: string) {
    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(backupDir, `menu-${stamp}.json`), previous, "utf8");

    const files = (await readdir(backupDir)).filter((name) => /^menu-.*\.json$/.test(name)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - maxBackups))) {
      await rm(path.join(backupDir, old), { force: true });
    }
  }

  async function atomicWrite(content: string) {
    const temp = `${dataFile}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temp, content, "utf8");
      await rename(temp, dataFile);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  /** Aplica `mutator` sobre una copia de la carta; si queda válida, la guarda. Devuelve lo que devuelva `mutator`. */
  function update<T>(mutator: (menu: RawMenu) => T | Promise<T>): Promise<T> {
    const run = async () => {
      const previous = await readFile(dataFile, "utf8");
      const menu = JSON.parse(previous) as RawMenu;
      const result = await mutator(menu);
      assertValidMenu(menu);
      await backup(previous);
      await atomicWrite(`${JSON.stringify(menu, null, 2)}\n`);
      return result;
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  return { read, update };
}

export type MenuStore = ReturnType<typeof createMenuStore>;
