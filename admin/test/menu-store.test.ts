import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildProduct } from "../lib/menu-form.ts";
import { MenuValidationError, assertValidMenu, createMenuStore } from "../lib/menu-store.ts";
import type { RawMenu } from "../lib/menu-types.ts";

const REAL_MENU = new URL("../../data/menu.json", import.meta.url);

/** Una carta de prueba aislada: copia de la real, en una carpeta temporal. */
async function setup(maxBackups?: number) {
  const dir = await mkdtemp(path.join(tmpdir(), "bg-menu-"));
  const dataFile = path.join(dir, "menu.json");
  const backupDir = path.join(dir, "backups");
  await writeFile(dataFile, await readFile(REAL_MENU, "utf8"));
  const store = createMenuStore({ dataFile, backupDir, maxBackups });
  return { dir, dataFile, backupDir, store, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const newProduct = (id: string) => buildProduct(id, { name: `Prueba ${id}`, price: 12345, categories: ["burgers"] });

test("la carta real pasa la validación estricta del panel", async () => {
  const menu = JSON.parse(await readFile(REAL_MENU, "utf8")) as RawMenu;
  assert.doesNotThrow(() => assertValidMenu(menu));
});

test("update: agrega un producto, guarda con el formato del archivo y crea copia de seguridad", async () => {
  const t = await setup();
  try {
    const before = await t.store.read();
    await t.store.update((menu) => void menu.products.push(newProduct("prueba-1")));

    const after = await t.store.read();
    assert.equal(after.products.length, before.products.length + 1);
    assert.equal(after.products.at(-1)?.id, "prueba-1");

    const text = await readFile(t.dataFile, "utf8");
    assert.ok(text.endsWith("}\n"), "termina con salto de línea");
    assert.ok(text.includes('\n  "categories": ['), "sangría de 2 espacios, como el original");

    const backups = await readdir(t.backupDir);
    assert.equal(backups.length, 1);
    const saved = JSON.parse(await readFile(path.join(t.backupDir, backups[0]), "utf8")) as RawMenu;
    assert.equal(saved.products.length, before.products.length, "la copia es la versión ANTERIOR");

    assert.deepEqual((await readdir(t.dir)).filter((n) => n.includes(".tmp-")), [], "no quedan temporales");
  } finally {
    await t.cleanup();
  }
});

test("update rechaza y NO guarda una carta inválida (el archivo queda intacto)", async () => {
  const t = await setup();
  try {
    const original = await readFile(t.dataFile, "utf8");
    const bad: Record<string, (menu: RawMenu) => void> = {
      "id repetido": (m) => void m.products.push({ ...m.products[0] }),
      "categoría inexistente": (m) => void m.products.push(buildProduct("x", { name: "X", price: 1, categories: ["no-existe"] })),
      "precio inválido": (m) => void m.products.push({ ...newProduct("x"), price: -5 }),
      "id con caracteres raros": (m) => void m.products.push({ ...newProduct("x"), id: "../../etc/passwd" }),
      "imagen de un sitio no permitido": (m) => void m.products.push({ ...newProduct("x"), image: "https://evil.com/x.png" }),
      "imagen javascript:": (m) => void m.products.push({ ...newProduct("x"), image: "javascript:alert(1)" }),
      "recomendado que no existe": (m) => void m.recommended.push("fantasma"),
      "recomendado repetido": (m) => void m.recommended.push(m.recommended[0]),
      "categoría repetida": (m) => void m.categories.push({ ...m.categories[0] }),
      "banner de sitio no permitido": (m) => void (m.categories[0].banner = "https://evil.com/b.png"),
    };
    for (const [label, mutate] of Object.entries(bad)) {
      await assert.rejects(() => t.store.update(mutate), MenuValidationError, label);
    }
    assert.equal(await readFile(t.dataFile, "utf8"), original, "el archivo no cambió");
    await assert.rejects(readdir(t.backupDir), "no se crearon copias por cambios rechazados");
  } finally {
    await t.cleanup();
  }
});

test("update en paralelo: nunca se pierde ni se mezcla un cambio", async () => {
  const t = await setup();
  try {
    const before = (await t.store.read()).products.length;
    await Promise.all(Array.from({ length: 12 }, (_, i) => t.store.update((menu) => void menu.products.push(newProduct(`par-${i}`)))));
    const after = await t.store.read();
    assert.equal(after.products.length, before + 12);
    assert.equal(new Set(after.products.map((p) => p.id)).size, after.products.length);
  } finally {
    await t.cleanup();
  }
});

test("un cambio rechazado no bloquea los siguientes", async () => {
  const t = await setup();
  try {
    await assert.rejects(() => t.store.update((m) => void m.recommended.push("fantasma")), MenuValidationError);
    await assert.doesNotReject(() => t.store.update((m) => void m.products.push(newProduct("despues"))));
    assert.ok((await t.store.read()).products.some((p) => p.id === "despues"));
  } finally {
    await t.cleanup();
  }
});

test("solo se conservan las últimas N copias de seguridad", async () => {
  const t = await setup(3);
  try {
    for (let i = 0; i < 6; i++) {
      await t.store.update((m) => void m.products.push(newProduct(`copia-${i}`)));
      await new Promise((r) => setTimeout(r, 5)); // nombres con fecha distinta
    }
    assert.equal((await readdir(t.backupDir)).length, 3);
  } finally {
    await t.cleanup();
  }
});

test("si el mutador falla, no se escribe nada", async () => {
  const t = await setup();
  try {
    const original = await readFile(t.dataFile, "utf8");
    await assert.rejects(() => t.store.update(() => { throw new Error("falló"); }), /falló/);
    assert.equal(await readFile(t.dataFile, "utf8"), original);
  } finally {
    await t.cleanup();
  }
});
