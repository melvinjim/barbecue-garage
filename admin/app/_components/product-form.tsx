"use client";

import { useActionState, useEffect, useState } from "react";
import { saveProductAction } from "../productos/actions";
import { shrinkImage } from "../../lib/client-image";
import { list, text, type FormValues } from "../../lib/form-values";
import { Card, Field, Notice, ghostButton, inputClass, primaryButton } from "./ui";

type CategoryOption = { id: string; name: string; subtitle?: string };

type Props = {
  categories: CategoryOption[];
  initial: FormValues;
  productId?: string; // si existe, se está editando
  imagePreview?: string; // dirección de la foto actual
  recommendedCount: number;
  recommendedLimit: number;
};

export function ProductForm({ categories, initial, productId, imagePreview, recommendedCount, recommendedLimit }: Props) {
  const [state, formAction, pending] = useActionState(saveProductAction, null);
  const values = state?.values ?? initial;
  const errors = state?.errors ?? {};
  const selectedCategories = list(values, "categories");

  // Vista previa de la foto elegida (antes de guardar)
  const [chosenPreview, setChosenPreview] = useState<string>();
  const [shrinking, setShrinking] = useState(false); // la foto se reduce antes de poder enviar el formulario
  useEffect(
    () => () => {
      if (chosenPreview) URL.revokeObjectURL(chosenPreview);
    },
    [chosenPreview],
  );

  const variantLabels = list(values, "variantLabel");
  const variantPrices = list(values, "variantPrice");
  const variantRows = Math.min(6, Math.max(2, variantLabels.length + 1));

  const wasRecommended = text(initial, "recommended") === "on";
  const recommendedFull = !wasRecommended && recommendedCount >= recommendedLimit;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6" noValidate>
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {state?.message ? <Notice kind="error">{state.message}</Notice> : null}

      <Card title="Datos del producto">
        <Field label="Nombre *" htmlFor="name" error={errors.name}>
          <input id="name" name="name" className={inputClass} defaultValue={text(values, "name")} maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} required />
        </Field>

        <Field label="Precio (en pesos) *" htmlFor="price" error={errors.price} hint="Solo el número, por ejemplo 34900.">
          <input id="price" name="price" inputMode="numeric" className={inputClass} defaultValue={text(values, "price")} placeholder="34900" aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "price-error" : undefined} required />
        </Field>

        <fieldset className="grid min-w-0 grid-cols-1 gap-2"aria-describedby={errors.categories ? "categories-error" : undefined}>
          <legend className="mb-1.5 text-sm font-semibold">Categorías * (puede estar en varias)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
                <input type="checkbox" name="categories" value={category.id} defaultChecked={selectedCategories.includes(category.id)} className="size-5 accent-[#da2928]" />
                <span>
                  {category.name}
                  {category.subtitle ? <span className="text-muted"> · {category.subtitle}</span> : null}
                </span>
              </label>
            ))}
          </div>
          {errors.categories ? <p id="categories-error" className="text-sm font-semibold text-brand-text">{errors.categories}</p> : null}
        </fieldset>
      </Card>

      <Card title="Descripción">
        <Field label="Descripción" htmlFor="description" error={errors.description} hint="Lo que lleva y cómo se prepara. Una línea en blanco separa párrafos.">
          <textarea id="description" name="description" rows={5} className={inputClass} defaultValue={text(values, "description")} maxLength={900} aria-invalid={Boolean(errors.description)} />
        </Field>

        <Field label="Qué incluye (una línea por elemento)" htmlFor="includes" error={errors.includes} hint="Opcional. Útil para combos o platos con varias partes, por ejemplo: Taco de Chili.">
          <textarea id="includes" name="includes" rows={3} className={inputClass} defaultValue={text(values, "includes")} aria-invalid={Boolean(errors.includes)} />
        </Field>

        <Field label="Nota (con qué viene)" htmlFor="note" error={errors.note} hint="Por ejemplo: Todas nuestras burgers vienen con papas a la francesa.">
          <textarea id="note" name="note" rows={2} className={inputClass} defaultValue={text(values, "note")} maxLength={400} aria-invalid={Boolean(errors.note)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Presentación" htmlFor="units" error={errors.units} hint="Ejemplo: 10 unds.">
            <input id="units" name="units" className={inputClass} defaultValue={text(values, "units")} maxLength={40} aria-invalid={Boolean(errors.units)} />
          </Field>
          <Field label="Disponibilidad" htmlFor="availability" error={errors.availability} hint="Ejemplo: De 12:00 pm a 4:00 pm.">
            <input id="availability" name="availability" className={inputClass} defaultValue={text(values, "availability")} maxLength={120} aria-invalid={Boolean(errors.availability)} />
          </Field>
        </div>
      </Card>

      <Card title="Otras presentaciones y precios">
        <p className="text-sm text-muted">Para vender el mismo producto en otro formato con otro precio (por ejemplo, una jarra). Deja las filas vacías si no aplica.</p>
        {errors.variants ? <Notice kind="error">{errors.variants}</Notice> : null}
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: variantRows }, (_, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <input name="variantLabel" aria-label={`Nombre de la presentación ${index + 1}`} placeholder="Nombre (ej. Jarra)" className={inputClass} defaultValue={variantLabels[index] ?? ""} maxLength={30} />
              <input name="variantPrice" aria-label={`Precio de la presentación ${index + 1}`} placeholder="Precio (ej. 33900)" inputMode="numeric" className={inputClass} defaultValue={variantPrices[index] ?? ""} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Etiquetas">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="featured" defaultChecked={text(values, "featured") === "on"} className="size-5 accent-[#da2928]" />
          <span><strong>Favorito</strong> <span className="text-muted">— muestra la estrella ★ junto al nombre</span></span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="launch" defaultChecked={text(values, "launch") === "on"} className="size-5 accent-[#da2928]" />
          <span><strong>Precio de lanzamiento</strong> <span className="text-muted">— muestra esa etiqueta en el detalle</span></span>
        </label>
        <label className={`flex min-h-11 items-center gap-3 ${recommendedFull ? "opacity-60" : "cursor-pointer"}`}>
          <input type="checkbox" name="recommended" defaultChecked={text(values, "recommended") === "on"} disabled={recommendedFull} className="size-5 accent-[#da2928]" />
          <span>
            <strong>Recomendado</strong> <span className="text-muted">— aparece en la sección “Recomendados” ({recommendedCount} de {recommendedLimit})</span>
            {recommendedFull ? <span className="block text-sm text-brand-text">Ya hay {recommendedLimit}: quita uno desde su producto para agregar este.</span> : null}
          </span>
        </label>
        <Field label="Premio" htmlFor="award" error={errors.award} hint="Opcional. Ejemplo: Ganadora Burger Master 2026.">
          <input id="award" name="award" className={inputClass} defaultValue={text(values, "award")} maxLength={80} aria-invalid={Boolean(errors.award)} />
        </Field>
      </Card>

      <Card title="Foto">
        {chosenPreview || imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de una foto de la carta (puede ser externa)
          <img src={chosenPreview ?? imagePreview} alt="Vista previa de la foto" className="aspect-[4/3] w-full max-w-sm rounded-2xl border border-line object-cover" />
        ) : (
          <p className="text-sm text-muted">Este producto no tiene foto todavía.</p>
        )}
        <Field label={imagePreview ? "Cambiar la foto" : "Subir una foto"} htmlFor="imageFile" error={errors.imageFile} hint="JPG, PNG, WebP o AVIF, hasta 8 MB. Se reduce y optimiza sola, y se borran los datos ocultos (como la ubicación).">
          <input
            id="imageFile"
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-1.5 file:font-semibold file:text-white`}
            onChange={async (event) => {
              const input = event.currentTarget; // se guarda antes del await: después React ya no lo entrega
              const file = input.files?.[0];
              if (!file) return setChosenPreview(undefined);
              setShrinking(true);
              try {
                const smaller = await shrinkImage(file);
                if (smaller !== file) {
                  const transfer = new DataTransfer();
                  transfer.items.add(smaller);
                  input.files = transfer.files;
                }
                setChosenPreview(URL.createObjectURL(smaller));
              } finally {
                setShrinking(false);
              }
            }}
            aria-invalid={Boolean(errors.imageFile)}
          />
        </Field>
        {imagePreview ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" name="removeImage" className="size-5 accent-[#da2928]" />
            <span>Quitar la foto actual (si no subes otra)</span>
          </label>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButton} disabled={pending || shrinking}>
          {pending ? "Guardando…" : shrinking ? "Preparando la foto…" : productId ? "Guardar cambios" : "Crear producto"}
        </button>
        <a href="/productos" className={ghostButton}>Cancelar</a>
      </div>
    </form>
  );
}
