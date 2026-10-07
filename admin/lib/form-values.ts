import type { RawCategory, RawProduct } from "./menu-types.ts";

// Valores de formulario como texto, para (re)llenar los campos.
// Se usan al abrir un producto para editar y al devolver un formulario con errores
// (React vacía los campos tras enviar; así la persona no pierde lo que escribió).

export type FormValues = Record<string, string | string[]>;

/** Todo lo enviado en el formulario como texto (los archivos se omiten). */
export function formDataToValues(form: FormData): FormValues {
  const values: FormValues = {};
  for (const key of new Set(form.keys())) {
    const items = form.getAll(key).filter((item): item is string => typeof item === "string");
    if (!items.length) continue;
    values[key] = items.length === 1 && !key.endsWith("[]") && !MULTI_FIELDS.has(key) ? items[0] : items;
  }
  return values;
}

const MULTI_FIELDS = new Set(["categories", "variantLabel", "variantPrice"]);

export function productToValues(product: RawProduct, isRecommended: boolean): FormValues {
  const variants = product.variants ?? [];
  return {
    name: product.name,
    price: String(product.price),
    categories: product.categories,
    description: product.description ?? "",
    includes: (product.includes ?? []).join("\n"),
    units: product.units ?? "",
    note: product.note ?? "",
    availability: product.availability ?? "",
    award: product.award ?? "",
    variantLabel: variants.map((v) => v.label),
    variantPrice: variants.map((v) => String(v.price)),
    featured: product.featured ? "on" : "",
    launch: product.launch ? "on" : "",
    recommended: isRecommended ? "on" : "",
  };
}

export function categoryToValues(category: RawCategory): FormValues {
  return { name: category.name, subtitle: category.subtitle ?? "", note: category.note ?? "" };
}

export const text = (values: FormValues | undefined, key: string): string => {
  const value = values?.[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const list = (values: FormValues | undefined, key: string): string[] => {
  const value = values?.[key];
  return Array.isArray(value) ? value : value ? [value] : [];
};
