import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_UPLOAD_BYTES, detectImageKind } from "../lib/image.ts";
import { slugify, uniqueId } from "../lib/slug.ts";

test("slugify: quita tildes, símbolos y espacios", () => {
  assert.equal(slugify("Margarita Garage Frutos Amarillos"), "margarita-garage-frutos-amarillos");
  assert.equal(slugify("PICADA DE CHICHARRÓN"), "picada-de-chicharron");
  assert.equal(slugify("  --Jack Daniel's #7--  "), "jack-daniel-s-7");
  assert.equal(slugify("!!!"), "item");
  assert.equal(slugify("a".repeat(200)).length <= 60, true);
});

test("slugify: no deja cosas peligrosas en el id", () => {
  for (const evil of ["../../etc/passwd", "<script>alert(1)</script>", "a/b\\c", "..%2f..", "__proto__"]) {
    assert.match(slugify(evil), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("uniqueId: agrega -2, -3… si ya existe y respeta el largo", () => {
  assert.equal(uniqueId("burger", ["otra"]), "burger");
  assert.equal(uniqueId("burger", ["burger"]), "burger-2");
  assert.equal(uniqueId("burger", ["burger", "burger-2", "burger-3"]), "burger-4");
  const long = uniqueId("x".repeat(80), ["x".repeat(80)]);
  assert.equal(long.length, 80);
  assert.ok(long.endsWith("-2"));
});

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(Math.max(0, 16 - values.length)).fill(0)]);

test("detectImageKind: reconoce solo JPG, PNG, WebP y AVIF por su contenido", () => {
  assert.equal(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  assert.equal(detectImageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "png");
  assert.equal(detectImageKind(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(detectImageKind(new TextEncoder().encode("\0\0\0\x1cftypavif\0\0\0\0")), "avif");
});

test("detectImageKind: rechaza SVG, GIF, HTML, ejecutables y archivos vacíos aunque se llamen .jpg", () => {
  const enc = (text: string) => new TextEncoder().encode(text.padEnd(16, " "));
  assert.equal(detectImageKind(enc("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'>")), null);
  assert.equal(detectImageKind(enc("<?xml version='1.0'?><svg>")), null);
  assert.equal(detectImageKind(enc("GIF89a....")), null);
  assert.equal(detectImageKind(enc("<html><script>alert(1)</script>")), null);
  assert.equal(detectImageKind(enc("MZ\x90\0\x03\0\0\0 ejecutable")), null);
  assert.equal(detectImageKind(new Uint8Array(0)), null);
  assert.equal(detectImageKind(bytes(0xff, 0xd8)), null); // demasiado corto para ser real
});

test("el límite de subida es razonable", () => {
  assert.ok(MAX_UPLOAD_BYTES >= 1024 * 1024 && MAX_UPLOAD_BYTES <= 16 * 1024 * 1024);
});
