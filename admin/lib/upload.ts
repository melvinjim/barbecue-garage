import { MAX_UPLOAD_BYTES } from "./image.ts";
import { ImageError } from "./menu-types.ts";

/**
 * Lee el archivo subido en `field`. Devuelve null si no se eligió ninguno.
 * Solo valida el tamaño aquí; el contenido real se revisa en `processImage` (lib/media.ts).
 */
export async function readUpload(form: FormData, field: string): Promise<Uint8Array | null> {
  const value = form.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_UPLOAD_BYTES) {
    throw new ImageError(`La foto pesa demasiado. El máximo es ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }
  return new Uint8Array(await value.arrayBuffer());
}
