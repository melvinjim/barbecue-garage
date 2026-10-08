"use client";

import { useActionState, useEffect, useState } from "react";
import { saveCategoryAction } from "../categorias/actions";
import { shrinkImage } from "../../lib/client-image";
import { text, type FormValues } from "../../lib/form-values";
import { Field, Notice, inputClass, primaryButton } from "./ui";

type Props = {
  initial: FormValues;
  categoryId?: string; // si existe, se está editando
  bannerPreview?: string;
  idPrefix: string; // evita ids repetidos cuando hay varios formularios en la misma página
};

export function CategoryForm({ initial, categoryId, bannerPreview, idPrefix }: Props) {
  const [state, formAction, pending] = useActionState(saveCategoryAction, null);
  const values = state?.values ?? initial;
  const errors = state?.errors ?? {};

  const [chosenPreview, setChosenPreview] = useState<string>();
  const [shrinking, setShrinking] = useState(false); // el banner se reduce antes de poder enviar el formulario
  useEffect(
    () => () => {
      if (chosenPreview) URL.revokeObjectURL(chosenPreview);
    },
    [chosenPreview],
  );

  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4" noValidate>
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
      {state?.message ? <Notice kind="error">{state.message}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" htmlFor={id("name")} error={errors.name} hint="Ejemplo: Burgers">
          <input id={id("name")} name="name" className={inputClass} defaultValue={text(values, "name")} maxLength={40} aria-invalid={Boolean(errors.name)} required />
        </Field>
        <Field label="Subtítulo" htmlFor={id("subtitle")} error={errors.subtitle} hint="Opcional. Ejemplo: Para compartir.">
          <input id={id("subtitle")} name="subtitle" className={inputClass} defaultValue={text(values, "subtitle")} maxLength={60} aria-invalid={Boolean(errors.subtitle)} />
        </Field>
      </div>

      <Field label="Aviso" htmlFor={id("note")} error={errors.note} hint="Opcional. Se muestra bajo el nombre. Ejemplo: Disponible hasta las 4:00 pm.">
        <input id={id("note")} name="note" className={inputClass} defaultValue={text(values, "note")} maxLength={120} aria-invalid={Boolean(errors.note)} />
      </Field>

      <div className="grid grid-cols-1 gap-3">
        <p className="text-sm font-semibold">Banner</p>
        {chosenPreview || bannerPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa del banner (puede ser externo)
          <img src={chosenPreview ?? bannerPreview} alt="Vista previa del banner" className="aspect-[4/1] w-full max-w-xl rounded-xl border border-line bg-[#383838] object-contain" />
        ) : (
          <p className="text-sm text-muted">Sin banner: se muestra el nombre en texto con estrellas.</p>
        )}
        <Field label={bannerPreview ? "Cambiar el banner" : "Subir un banner"} htmlFor={id("bannerFile")} error={errors.bannerFile} hint="Ideal: imagen ancha 4:1 (por ejemplo 1536 × 384) con fondo transparente (PNG). Hasta 8 MB.">
          <input
            id={id("bannerFile")}
            name="bannerFile"
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
            aria-invalid={Boolean(errors.bannerFile)}
          />
        </Field>
        {bannerPreview ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" name="removeBanner" className="size-5 accent-[#da2928]" />
            <span>Quitar el banner actual (si no subes otro)</span>
          </label>
        ) : null}
      </div>

      <div>
        <button type="submit" className={primaryButton} disabled={pending || shrinking}>
          {pending ? "Guardando…" : shrinking ? "Preparando la foto…" : categoryId ? "Guardar categoría" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}
