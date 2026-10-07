/** "Margarita Garage Frutos Amarillos" → "margarita-garage-frutos-amarillos" */
export function slugify(text: string, max = 60): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Devuelve `base`, o `base-2`, `base-3`… si ya existe (respetando el largo máximo). */
export function uniqueId(base: string, taken: Iterable<string>, max = 80): string {
  const used = new Set(taken);
  const root = base.slice(0, max);
  if (!used.has(root)) return root;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${root.slice(0, max - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
