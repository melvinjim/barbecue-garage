import { OWN_IMAGE_PATH } from "./image.ts";

/**
 * Dirección con la que el panel muestra una foto de la carta:
 *  - fotos propias (assets/menu/<nombre>.webp) → por la ruta protegida /media/<nombre> del panel
 *  - fotos externas (https) → tal cual
 */
export function imageSrc(image: string | undefined): string | undefined {
  if (!image) return undefined;
  if (OWN_IMAGE_PATH.test(image)) return `/media/${image.slice("assets/menu/".length, -".webp".length)}`;
  return image.startsWith("https://") ? image : undefined;
}
