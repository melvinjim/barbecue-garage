// Reduce en el navegador las fotos pesadas ANTES de subirlas.
//
// Por qué: una foto de celular puede pesar 5-8 MB y algunos hostings (Vercel) rechazan envíos de más de
// ~4,5 MB; además así se gasta menos internet. Es solo una comodidad: el servidor igual vuelve a validar,
// reducir y limpiar (quitar la ubicación GPS, etc.) toda foto que recibe. Si algo falla aquí, se sube la original.

const MAX_SIDE = 1800; // el servidor la baja a 1200/1600 px; esto deja margen de calidad
const SKIP_BELOW_BYTES = 2 * 1024 * 1024; // las fotos ya livianas no se tocan
const SUPPORTED = /^image\/(?:jpeg|png|webp|avif)$/;

function canEncode(type: string): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.toDataURL(type).startsWith(`data:${type}`);
}

const EXTENSION: Record<string, string> = { "image/webp": ".webp", "image/png": ".png", "image/jpeg": ".jpg" };

export async function shrinkImage(file: File): Promise<File> {
  try {
    if (file.size <= SKIP_BELOW_BYTES || !SUPPORTED.test(file.type)) return file;

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // PNG/WebP pueden tener transparencia (banners): se conserva. Una foto JPG sale como JPG.
    const keepsAlpha = file.type === "image/png" || file.type === "image/webp";
    const type = keepsAlpha ? (canEncode("image/webp") ? "image/webp" : "image/png") : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]*$/, "") || "foto";
    return new File([blob], `${base}${EXTENSION[blob.type] ?? ""}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
