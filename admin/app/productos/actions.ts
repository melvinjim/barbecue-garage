"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FIELD_LIMITS } from "../../../js/data/schema.js";
import { requireAdmin } from "../../lib/access.ts";
import type { FormState } from "../../lib/form-state.ts";
import { formDataToValues } from "../../lib/form-values.ts";
import { deleteImageIfUnused, saveImage } from "../../lib/media.ts";
import { buildProduct, oneLine, parseProductForm } from "../../lib/menu-form.ts";
import { MenuValidationError } from "../../lib/menu-store.ts";
import { ImageError, UserFacingError } from "../../lib/menu-types.ts";
import { MENU_ASSETS_DIR } from "../../lib/paths.ts";
import { slugify, uniqueId } from "../../lib/slug.ts";
import { menuStore } from "../../lib/store.ts";
import { readUpload } from "../../lib/upload.ts";

// Acciones del servidor para productos. Reglas:
//  - cada acción llama a requireAdmin() PRIMERO (no se confía en que la pantalla ya lo hizo),
//  - todo lo recibido se vuelve a validar aquí, en el servidor,
//  - el id de un producto lo genera el servidor y no cambia al editar.

const UNEXPECTED = "Ocurrió un error inesperado al guardar. Inténtalo de nuevo.";

function describe(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof MenuValidationError) return `No se pudo guardar porque la carta no quedaría válida: ${error.problems.join("; ")}.`;
  console.error("[admin] error inesperado", error);
  return UNEXPECTED;
}

export async function saveProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdmin();
  const values = formDataToValues(formData);
  const fail = (message: string, errors?: Record<string, string>): FormState => ({ message, errors, values });

  const editingId = oneLine(formData.get("productId"));
  let newImage: string | undefined;
  let oldImage: string | undefined;
  let finalImage: string | undefined;
  let savedId = "";

  try {
    const current = await menuStore.read();
    const parsed = parseProductForm(formData, new Set(current.categories.map((c) => c.id)));
    if (!parsed.ok) return fail("Revisa los campos marcados en rojo.", parsed.errors);
    const { fields, recommended } = parsed.value;

    const upload = await readUpload(formData, "imageFile");
    if (upload) newImage = await saveImage({ file: upload, use: "product", label: fields.name, dir: MENU_ASSETS_DIR });
    const removeImage = formData.get("removeImage") === "on";

    try {
      savedId = await menuStore.update((menu) => {
        let id = editingId;
        let index = -1;
        if (editingId) {
          index = menu.products.findIndex((product) => product.id === editingId);
          if (index === -1) throw new UserFacingError("Este producto ya no existe (quizá lo eliminó otra persona).");
          oldImage = menu.products[index].image;
        } else {
          id = uniqueId(slugify(fields.name, FIELD_LIMITS.productId - 10), menu.products.map((p) => p.id), FIELD_LIMITS.productId);
        }

        finalImage = newImage ?? (removeImage ? undefined : oldImage);
        const product = buildProduct(id, fields, finalImage);
        if (index === -1) menu.products.push(product);
        else menu.products[index] = product;

        const isRecommended = menu.recommended.includes(id);
        if (recommended && !isRecommended) {
          if (menu.recommended.length >= FIELD_LIMITS.recommended) {
            throw new UserFacingError(`Ya hay ${FIELD_LIMITS.recommended} recomendados. Quita uno antes de agregar otro.`);
          }
          menu.recommended.push(id);
        } else if (!recommended && isRecommended) {
          menu.recommended = menu.recommended.filter((recommendedId) => recommendedId !== id);
        }
        return id;
      });
    } catch (error) {
      // No se guardó: la foto recién subida quedaría huérfana.
      if (newImage) await deleteImageIfUnused(newImage, await menuStore.read(), MENU_ASSETS_DIR);
      throw error;
    }

    // Guardado: si la foto anterior ya no se usa en ningún lado, se borra del disco.
    if (oldImage && oldImage !== finalImage) await deleteImageIfUnused(oldImage, await menuStore.read(), MENU_ASSETS_DIR);
    console.info("[admin]", editingId ? "producto editado" : "producto creado", { id: savedId, por: access.userId });
  } catch (error) {
    return fail(describe(error), error instanceof ImageError ? { imageFile: error.message } : undefined);
  }

  revalidatePath("/productos");
  revalidatePath("/");
  redirect(`/productos?guardado=${encodeURIComponent(savedId)}`);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const access = await requireAdmin();
  const id = oneLine(formData.get("productId"));
  let oldImage: string | undefined;
  let outcome = "eliminado";

  try {
    await menuStore.update((menu) => {
      const index = menu.products.findIndex((product) => product.id === id);
      if (index === -1) throw new UserFacingError("ya-no-existe");
      oldImage = menu.products[index].image;
      menu.products.splice(index, 1);
      menu.recommended = menu.recommended.filter((recommendedId) => recommendedId !== id);
    });
    await deleteImageIfUnused(oldImage, await menuStore.read(), MENU_ASSETS_DIR);
    console.info("[admin] producto eliminado", { id, por: access.userId });
  } catch (error) {
    outcome = error instanceof UserFacingError ? "ya-no-existe" : "error";
    if (outcome === "error") console.error("[admin] error eliminando producto", error);
  }

  revalidatePath("/productos");
  revalidatePath("/");
  redirect(`/productos?resultado=${outcome}`);
}
