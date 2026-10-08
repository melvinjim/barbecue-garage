import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Dónde viven las fotos de la carta (assets/menu/<nombre>.webp).
//
// El panel solo habla con esta interfaz; no sabe si las fotos están en el disco de tu computador
// (desarrollo) o en el repositorio de GitHub (producción, ver github-store.ts).
// El nombre del archivo SIEMPRE lo genera el servidor y se vuelve a comprobar aquí.

/** Nombre permitido para una foto: minúsculas, números y guiones + .webp */
export const IMAGE_FILE = /^[a-z0-9-]{1,200}\.webp$/;

export type ImageStore = {
  put(fileName: string, data: Uint8Array): Promise<void>;
  /** Devuelve null si la foto no existe. */
  get(fileName: string): Promise<Uint8Array | null>;
  /** Borrar algo que ya no existe no es un error. */
  remove(fileName: string): Promise<void>;
};

export function assertImageFile(fileName: string): void {
  if (!IMAGE_FILE.test(fileName)) throw new Error("Nombre de foto no permitido.");
}

export function createLocalImageStore(dir: string): ImageStore {
  return {
    async put(fileName, data) {
      assertImageFile(fileName);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), data);
    },

    async get(fileName) {
      assertImageFile(fileName);
      try {
        return new Uint8Array(await readFile(path.join(dir, fileName)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async remove(fileName) {
      assertImageFile(fileName);
      await rm(path.join(dir, fileName), { force: true });
    },
  };
}
