import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES, OWN_IMAGE_PATH, detectImageKind } from "./image.ts";
import type { ImageStore } from "./image-store.ts";
import type { RawMenu } from "./menu-types.ts";
import { ImageError } from "./menu-types.ts";
import { slugify } from "./slug.ts";

// Fotos y banners subidos desde el panel.
//
// Cada foto que entra se:
//  - valida por su contenido real (no por el nombre ni el tipo que declara el navegador),
//  - limita en tamaño y en cantidad de píxeles,
//  - gira según su orientación, reduce y convierte a WebP (ligera y sin metadatos: se borra
//    cualquier dato oculto como la ubicación GPS),
//  - guarda con un nombre generado por el servidor (nunca el que trae el archivo).

export type ImageKindOfUse = "product" | "banner";

const MAX_WIDTH: Record<ImageKindOfUse, number> = { product: 1200, banner: 1600 };
const MAX_INPUT_PIXELS = 50_000_000; // protege contra imágenes "bomba" (miles de millones de píxeles)

/** Foto original → WebP optimizada y limpia. */
export async function processImage(input: Uint8Array, use: ImageKindOfUse): Promise<Buffer> {
  if (input.byteLength === 0) throw new ImageError("El archivo está vacío.");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageError(`La foto pesa demasiado. El máximo es ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }
  if (!detectImageKind(input)) {
    throw new ImageError("Formato no permitido. Sube una foto JPG, PNG, WebP o AVIF.");
  }

  try {
    return await sharp(Buffer.from(input), { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // respeta la orientación del celular y descarta los metadatos EXIF
      .resize({ width: MAX_WIDTH[use], withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageError("No se pudo leer la foto. Prueba con otra imagen (JPG, PNG o WebP).");
  }
}

/** Ruta pública (la que se guarda en menu.json) a partir de un nombre de archivo del servidor. */
const PUBLIC_PREFIX = "assets/menu/";
const publicPath = (fileName: string) => `${PUBLIC_PREFIX}${fileName}`;

export { OWN_IMAGE_PATH };

/**
 * Procesa y guarda una foto en `store`. Devuelve la ruta pública (p. ej. "assets/menu/gaucha-burger-1a2b3c4d.webp").
 */
export async function saveImage(options: {
  file: Uint8Array;
  use: ImageKindOfUse;
  label: string; // para el nombre del archivo (se pasa por slugify)
  store: ImageStore;
}): Promise<string> {
  const data = await processImage(options.file, options.use);
  const fileName = `${slugify(options.label, 40)}-${randomBytes(4).toString("hex")}.webp`;
  await options.store.put(fileName, data);
  return publicPath(fileName);
}

/** ¿Alguien en la carta sigue usando esta foto? */
export function isImageInUse(imagePath: string, menu: RawMenu): boolean {
  return (
    menu.products.some((product) => product.image === imagePath) ||
    menu.categories.some((category) => category.banner === imagePath)
  );
}

/**
 * Borra una foto que ya nadie usa. Solo toca archivos con la forma exacta de las fotos del panel
 * (OWN_IMAGE_PATH); jamás una URL externa ni una ruta que alguien haya escrito a mano.
 */
export async function deleteImageIfUnused(imagePath: string | undefined, menu: RawMenu, store: ImageStore): Promise<void> {
  if (!imagePath || !OWN_IMAGE_PATH.test(imagePath) || isImageInUse(imagePath, menu)) return;
  await store.remove(imagePath.slice(PUBLIC_PREFIX.length)); // OWN_IMAGE_PATH garantiza que solo queda "<nombre>.webp"
}
