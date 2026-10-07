import { LIMITS } from "../../js/config.js";
import { FIELD_LIMITS } from "../../js/data/schema.js";
import type { CategoryFields, ProductFields, RawCategory, RawProduct } from "./menu-types.ts";

// Convierte lo que llega de un formulario (texto sin confiar) en datos de la carta.
// Usa los MISMOS límites que el validador del sitio público (js/data/schema.js).
// Aun así, antes de guardar se vuelve a validar toda la carta con ese validador.

export type FieldErrors = Record<string, string>;
export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Texto de una línea: sin saltos ni caracteres de control, espacios colapsados. */
export function oneLine(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.replace(CONTROL, " ").replace(/\s+/g, " ").trim() : "";
}

/** Texto de varias líneas: conserva los saltos (máximo una línea en blanco seguida). */
export function multiLine(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string"
    ? value
        .replace(/\r\n?/g, "\n")
        .replace(CONTROL, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : "";
}

/** "34.900", "$ 34.900" o "34900" → 34900. Devuelve null si no es un precio válido. */
export function parsePrice(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length > 9) return null;
  const price = Number(digits);
  return Number.isSafeInteger(price) && price <= LIMITS.price ? price : null;
}

const tooLong = (label: string, max: number) => `${label} admite hasta ${max} caracteres.`;

export type ProductFormValue = { fields: ProductFields; recommended: boolean };

export function parseProductForm(form: FormData, categoryIds: ReadonlySet<string>): FormResult<ProductFormValue> {
  const errors: FieldErrors = {};

  const name = oneLine(form.get("name"));
  if (!name) errors.name = "Escribe el nombre del producto.";
  else if (name.length > FIELD_LIMITS.productName) errors.name = tooLong("El nombre", FIELD_LIMITS.productName);

  const price = parsePrice(oneLine(form.get("price")));
  if (price === null || price <= 0) errors.price = "Escribe un precio en pesos mayor a 0 (por ejemplo 34900).";

  const selected = [...new Set(form.getAll("categories").filter((v): v is string => typeof v === "string"))];
  const categories = selected.filter((id) => categoryIds.has(id));
  if (!categories.length) errors.categories = "Elige al menos una categoría.";
  else if (selected.length !== categories.length) errors.categories = "Hay una categoría que ya no existe. Recarga la página.";
  else if (categories.length > FIELD_LIMITS.productCategories) {
    errors.categories = `Elige máximo ${FIELD_LIMITS.productCategories} categorías.`;
  }

  const description = multiLine(form.get("description"));
  if (description.length > FIELD_LIMITS.description) errors.description = tooLong("La descripción", FIELD_LIMITS.description);

  const note = multiLine(form.get("note"));
  if (note.length > FIELD_LIMITS.note) errors.note = tooLong("La nota", FIELD_LIMITS.note);

  const includes = multiLine(form.get("includes"))
    .split("\n")
    .map((item) => oneLine(item))
    .filter(Boolean);
  if (includes.length > FIELD_LIMITS.includesItems) {
    errors.includes = `Puedes listar hasta ${FIELD_LIMITS.includesItems} elementos.`;
  } else if (includes.some((item) => item.length > FIELD_LIMITS.includeLength)) {
    errors.includes = `Cada elemento admite hasta ${FIELD_LIMITS.includeLength} caracteres.`;
  }

  const units = oneLine(form.get("units"));
  if (units.length > FIELD_LIMITS.units) errors.units = tooLong("La presentación", FIELD_LIMITS.units);

  const availability = oneLine(form.get("availability"));
  if (availability.length > FIELD_LIMITS.availability) {
    errors.availability = tooLong("La disponibilidad", FIELD_LIMITS.availability);
  }

  const award = oneLine(form.get("award"));
  if (award.length > FIELD_LIMITS.award) errors.award = tooLong("El premio", FIELD_LIMITS.award);

  // Presentaciones (p. ej. "Jarra" con su precio): filas paralelas label/price; las vacías se ignoran.
  const labels = form.getAll("variantLabel").map(oneLine);
  const prices = form.getAll("variantPrice").map(oneLine);
  const rows = labels.map((label, index) => ({ label, price: prices[index] ?? "" })).filter((row) => row.label || row.price);
  const variants: { label: string; price: number }[] = [];
  if (rows.length > FIELD_LIMITS.variants) {
    errors.variants = `Puedes agregar hasta ${FIELD_LIMITS.variants} presentaciones.`;
  } else {
    for (const row of rows) {
      const variantPrice = parsePrice(row.price);
      if (!row.label || variantPrice === null || variantPrice <= 0) {
        errors.variants = "Cada presentación necesita un nombre y un precio mayor a 0.";
        break;
      }
      if (row.label.length > FIELD_LIMITS.variantLabel) {
        errors.variants = tooLong("El nombre de la presentación", FIELD_LIMITS.variantLabel);
        break;
      }
      if (row.label.toLowerCase() === "individual") {
        errors.variants = '"Individual" ya existe: es el precio principal del producto.';
        break;
      }
      if (variants.some((v) => v.label.toLowerCase() === row.label.toLowerCase())) {
        errors.variants = "Hay dos presentaciones con el mismo nombre.";
        break;
      }
      variants.push({ label: row.label, price: variantPrice });
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const fields: ProductFields = { name, price: price as number, categories };
  if (description) fields.description = description;
  if (includes.length) fields.includes = includes;
  if (units) fields.units = units;
  if (note) fields.note = note;
  if (availability) fields.availability = availability;
  if (variants.length) fields.variants = variants;
  if (award) fields.award = award;
  if (form.get("featured") === "on") fields.featured = true;
  if (form.get("launch") === "on") fields.launch = true;

  return { ok: true, value: { fields, recommended: form.get("recommended") === "on" } };
}

/** Arma el producto con las claves en el orden habitual del archivo (queda prolijo y fácil de comparar). */
export function buildProduct(id: string, fields: ProductFields, image?: string): RawProduct {
  const product: RawProduct = { id, categories: fields.categories, name: fields.name, price: fields.price };
  if (fields.description) product.description = fields.description;
  if (fields.includes?.length) product.includes = fields.includes;
  if (fields.units) product.units = fields.units;
  if (fields.note) product.note = fields.note;
  if (fields.availability) product.availability = fields.availability;
  if (fields.variants?.length) product.variants = fields.variants;
  if (fields.award) product.award = fields.award;
  if (fields.featured) product.featured = true;
  if (fields.launch) product.launch = true;
  if (image) product.image = image;
  return product;
}

export function parseCategoryForm(form: FormData): FormResult<CategoryFields> {
  const errors: FieldErrors = {};

  const name = oneLine(form.get("name"));
  if (!name) errors.name = "Escribe el nombre de la categoría.";
  else if (name.length > FIELD_LIMITS.categoryName) errors.name = tooLong("El nombre", FIELD_LIMITS.categoryName);

  const subtitle = oneLine(form.get("subtitle"));
  if (subtitle.length > FIELD_LIMITS.categorySubtitle) errors.subtitle = tooLong("El subtítulo", FIELD_LIMITS.categorySubtitle);

  const note = oneLine(form.get("note"));
  if (note.length > FIELD_LIMITS.categoryNote) errors.note = tooLong("El aviso", FIELD_LIMITS.categoryNote);

  if (Object.keys(errors).length) return { ok: false, errors };

  const fields: CategoryFields = { name };
  if (subtitle) fields.subtitle = subtitle;
  if (note) fields.note = note;
  return { ok: true, value: fields };
}

export function buildCategory(id: string, fields: CategoryFields, banner?: string): RawCategory {
  const category: RawCategory = { id, name: fields.name };
  if (fields.subtitle) category.subtitle = fields.subtitle;
  if (fields.note) category.note = fields.note;
  if (banner) category.banner = banner;
  return category;
}
