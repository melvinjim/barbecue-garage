import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCategory,
  buildProduct,
  multiLine,
  oneLine,
  parseCategoryForm,
  parsePrice,
  parseProductForm,
} from "../lib/menu-form.ts";

const categories = new Set(["burgers", "bebidas", "extras"]);

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const valid = { name: "Gaucha Burger", price: "37.900", categories: "burgers" };

test("parsePrice entiende los formatos habituales y rechaza lo raro", () => {
  assert.equal(parsePrice("37900"), 37900);
  assert.equal(parsePrice("37.900"), 37900);
  assert.equal(parsePrice("$ 37.900"), 37900);
  assert.equal(parsePrice("1.234.567"), 1234567);
  for (const bad of ["", "abc", "$", "99999999999"]) {
    assert.equal(parsePrice(bad), null, `"${bad}"`);
  }
});

test("oneLine / multiLine limpian caracteres de control y espacios", () => {
  assert.equal(oneLine("  hola \n\t mundo \u0000 "), "hola mundo");
  assert.equal(oneLine(null), "");
  assert.equal(oneLine(new File(["x"], "x.txt")), "", "un archivo nunca es texto");
  assert.equal(multiLine("a\r\n\r\n\r\n\r\nb  \n c\u0007"), "a\n\nb\n c");
});

test("producto mínimo válido", () => {
  const result = parseProductForm(form(valid), categories);
  assert.ok(result.ok);
  assert.deepEqual(result.value.fields, { name: "Gaucha Burger", price: 37900, categories: ["burgers"] });
  assert.equal(result.value.recommended, false);
});

test("producto completo: todos los campos", () => {
  const result = parseProductForm(
    form({
      ...valid,
      categories: ["burgers", "extras"],
      description: "Carne al carbón\n\nCon papas",
      includes: "Pan\n  Queso  \n\nTocineta",
      units: "2 unds.",
      note: "Incluye papas",
      availability: "De 12:00 pm a 4:00 pm",
      variantLabel: ["Jarra", ""],
      variantPrice: ["33.900", ""],
      award: "Ganadora Burger Master 2026",
      featured: "on",
      launch: "on",
      recommended: "on",
    }),
    categories,
  );
  assert.ok(result.ok);
  const { fields, recommended } = result.value;
  assert.deepEqual(fields.includes, ["Pan", "Queso", "Tocineta"]);
  assert.deepEqual(fields.variants, [{ label: "Jarra", price: 33900 }]);
  assert.equal(fields.featured, true);
  assert.equal(fields.launch, true);
  assert.equal(recommended, true);
  assert.equal(fields.description, "Carne al carbón\n\nCon papas");
});

test("errores por campo, en español y sin romper nada", () => {
  const cases: [Record<string, string | string[]>, string][] = [
    [{ ...valid, name: "   " }, "name"],
    [{ ...valid, name: "x".repeat(101) }, "name"],
    [{ ...valid, price: "gratis" }, "price"],
    [{ ...valid, price: "0" }, "price"],
    [{ ...valid, categories: [] }, "categories"],
    [{ ...valid, categories: "no-existe" }, "categories"],
    [{ ...valid, categories: ["burgers", "fantasma"] }, "categories"],
    [{ ...valid, description: "x".repeat(901) }, "description"],
    [{ ...valid, note: "x".repeat(401) }, "note"],
    [{ ...valid, includes: Array.from({ length: 13 }, (_, i) => `i${i}`).join("\n") }, "includes"],
    [{ ...valid, includes: "x".repeat(81) }, "includes"],
    [{ ...valid, units: "x".repeat(41) }, "units"],
    [{ ...valid, availability: "x".repeat(121) }, "availability"],
    [{ ...valid, award: "x".repeat(81) }, "award"],
    [{ ...valid, variantLabel: "Jarra", variantPrice: "" }, "variants"],
    [{ ...valid, variantLabel: "", variantPrice: "5000" }, "variants"],
    [{ ...valid, variantLabel: "Individual", variantPrice: "5000" }, "variants"],
    [{ ...valid, variantLabel: ["Jarra", "jarra"], variantPrice: ["5000", "6000"] }, "variants"],
    [{ ...valid, variantLabel: "x".repeat(31), variantPrice: "5000" }, "variants"],
  ];
  for (const [input, field] of cases) {
    const result = parseProductForm(form(input), categories);
    assert.equal(result.ok, false, `debería fallar: ${field}`);
    if (!result.ok) {
      assert.ok(result.errors[field], `falta el error de "${field}"`);
      assert.ok(result.errors[field].length > 10);
    }
  }
});

test("lo que llega en el formulario nunca se interpreta como código ni como HTML", () => {
  const result = parseProductForm(
    form({ ...valid, name: "<img src=x onerror=alert(1)>", description: "<script>alert(1)</script>" }),
    categories,
  );
  assert.ok(result.ok); // se guarda como texto; React lo escapa al mostrarlo y el sitio usa textContent
  assert.equal(result.value.fields.name, "<img src=x onerror=alert(1)>");
});

test("campos desconocidos o enviados de más se ignoran", () => {
  const result = parseProductForm(form({ ...valid, id: "otro-id", image: "https://evil.com/x.png", admin: "true" }), categories);
  assert.ok(result.ok);
  assert.deepEqual(Object.keys(result.value.fields).sort(), ["categories", "name", "price"]);
});

test("buildProduct mantiene el orden habitual de las claves", () => {
  const product = buildProduct(
    "gaucha",
    { name: "G", price: 1, categories: ["burgers"], award: "A", description: "D", featured: true, units: "U", note: "N", launch: true },
    "assets/menu/g-1a2b3c4d.webp",
  );
  assert.deepEqual(Object.keys(product), ["id", "categories", "name", "price", "description", "units", "note", "award", "featured", "launch", "image"]);
});

test("categorías: validación y orden de claves", () => {
  const ok = parseCategoryForm(form({ name: " Burgers ", subtitle: "Hamburguesas", note: "" }));
  assert.ok(ok.ok);
  assert.deepEqual(buildCategory("burgers", ok.value, "assets/menu/b-1a2b3c4d.webp"), {
    id: "burgers",
    name: "Burgers",
    subtitle: "Hamburguesas",
    banner: "assets/menu/b-1a2b3c4d.webp",
  });
  const invalid: Record<string, string>[] = [{ name: "" },{ name: "x".repeat(41) }, { name: "ok", subtitle: "x".repeat(61) }, { name: "ok", note: "x".repeat(121) }];
  for (const bad of invalid) {
    assert.equal(parseCategoryForm(form(bad)).ok, false);
  }
});
