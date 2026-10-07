import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES } from "../lib/image.ts";
import { OWN_IMAGE_PATH, deleteImageIfUnused, isImageInUse, processImage, saveImage } from "../lib/media.ts";
import type { RawMenu } from "../lib/menu-types.ts";
import { UserFacingError } from "../lib/menu-types.ts";

const exists = (file: string) => access(file).then(() => true, () => false);

async function bigJpegWithMetadata() {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#da2928" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "dato-privado", Software: "camara-secreta" } })
    .toBuffer();
}

test("processImage: reduce, convierte a WebP y elimina los metadatos", async () => {
  const input = await bigJpegWithMetadata();
  assert.ok((await sharp(input).metadata()).exif, "la foto de prueba sí trae metadatos");

  const output = await processImage(input, "product");
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 800);
  assert.equal(meta.exif, undefined, "sin EXIF");
  assert.ok(output.length < input.length);

  const banner = await sharp(await processImage(input, "banner")).metadata();
  assert.equal(banner.width, 1600);
});

test("processImage: no agranda fotos pequeñas y conserva la transparencia de un PNG", async () => {
  const png = await sharp({ create: { width: 400, height: 100, channels: 4, background: { r: 218, g: 41, b: 40, alpha: 0.5 } } }).png().toBuffer();
  const meta = await sharp(await processImage(png, "banner")).metadata();
  assert.equal(meta.width, 400);
  assert.equal(meta.hasAlpha, true);
});

test("processImage rechaza archivos que no son fotos (aunque lo disfracen)", async () => {
  const enc = (text: string) => new TextEncoder().encode(text);
  const cases: Record<string, Uint8Array> = {
    svg: enc("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
    html: enc("<html><script>alert(1)</script></html>"),
    texto: enc("hola mundo, esto no es una foto"),
    vacío: new Uint8Array(0),
    "cabecera de JPG pero corrupto": new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(7)]),
  };
  for (const [label, data] of Object.entries(cases)) {
    await assert.rejects(() => processImage(data, "product"), UserFacingError, label);
  }
});

test("processImage rechaza fotos demasiado pesadas", async () => {
  const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  huge.set([0xff, 0xd8, 0xff]);
  await assert.rejects(() => processImage(huge, "product"), /pesa demasiado/);
});

test("saveImage: guarda con nombre generado por el servidor, nunca el del archivo", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bg-media-"));
  try {
    const saved = await saveImage({ file: await bigJpegWithMetadata(), use: "product", label: "../../Gaucha Burger!!", dir });
    assert.match(saved, OWN_IMAGE_PATH);
    assert.match(saved, /^assets\/menu\/gaucha-burger-[0-9a-f]{8}\.webp$/);
    assert.ok(await exists(path.join(dir, path.basename(saved))));
    assert.deepEqual((await readdir(dir)).length, 1);
    assert.equal((await sharp(await readFile(path.join(dir, path.basename(saved)))).metadata()).format, "webp");

    const again = await saveImage({ file: await bigJpegWithMetadata(), use: "product", label: "Gaucha Burger", dir });
    assert.notEqual(again, saved, "dos subidas nunca se pisan");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const menuWith = (image?: string, banner?: string): RawMenu => ({
  categories: [{ id: "c", name: "C", ...(banner ? { banner } : {}) }],
  recommended: [],
  products: [{ id: "p", name: "P", price: 1, categories: ["c"], ...(image ? { image } : {}) }],
});

test("isImageInUse mira productos y banners", () => {
  assert.equal(isImageInUse("assets/menu/a-11111111.webp", menuWith("assets/menu/a-11111111.webp")), true);
  assert.equal(isImageInUse("assets/menu/b-22222222.webp", menuWith(undefined, "assets/menu/b-22222222.webp")), true);
  assert.equal(isImageInUse("assets/menu/c-33333333.webp", menuWith()), false);
});

test("deleteImageIfUnused: borra solo fotos propias que nadie usa", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bg-media-"));
  try {
    const own = "assets/menu/vieja-aaaaaaaa.webp";
    const inUse = "assets/menu/activa-bbbbbbbb.webp";
    await writeFile(path.join(dir, "vieja-aaaaaaaa.webp"), "x");
    await writeFile(path.join(dir, "activa-bbbbbbbb.webp"), "x");
    await writeFile(path.join(dir, "secreto.txt"), "x");

    await deleteImageIfUnused(inUse, menuWith(inUse), dir);
    assert.ok(await exists(path.join(dir, "activa-bbbbbbbb.webp")), "una foto en uso no se borra");

    // Rutas que NO son fotos del panel: jamás se tocan
    for (const strange of ["https://images.cluvi.com/a/b.jpg", "../secreto.txt", "assets/menu/../secreto.txt", "assets/otra/x.webp", "secreto.txt", "assets/menu/MAYUS.webp"]) {
      await deleteImageIfUnused(strange, menuWith(), dir);
    }
    assert.ok(await exists(path.join(dir, "secreto.txt")));

    await deleteImageIfUnused(own, menuWith(), dir);
    assert.equal(await exists(path.join(dir, "vieja-aaaaaaaa.webp")), false, "la foto propia sin uso se borra");

    await assert.doesNotReject(() => deleteImageIfUnused(own, menuWith(), dir), "borrar algo que ya no existe no falla");
    await assert.doesNotReject(() => deleteImageIfUnused(undefined, menuWith(), dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
