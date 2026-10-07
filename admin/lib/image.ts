// Comprobaciones de seguridad para fotos subidas (funciones puras).
// No se confía en el nombre ni en el tipo que declara el navegador: se mira el contenido real.

/** Tamaño máximo de la foto original que se acepta subir. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Forma exacta de las fotos que guarda este panel (lo único que el panel muestra desde disco o borra). */
export const OWN_IMAGE_PATH = /^assets\/menu\/[a-z0-9-]+\.webp$/;

export type ImageKind = "jpeg" | "png" | "webp" | "avif";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

/**
 * Detecta el formato por sus primeros bytes ("magic bytes").
 * SVG, GIF, HEIC y cualquier otra cosa se rechazan a propósito (un SVG puede llevar scripts).
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) return "avif";
  return null;
}
