"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FIELD_LIMITS } from "../../../js/data/schema.js";
import { requireAdmin } from "../../lib/access.ts";
import type { FormState } from "../../lib/form-state.ts";
import { formDataToValues } from "../../lib/form-values.ts";
import { deleteImageIfUnused, saveImage } from "../../lib/media.ts";
import { buildCategory, oneLine, parseCategoryForm } from "../../lib/menu-form.ts";
import { MenuValidationError } from "../../lib/menu-store.ts";
import { ImageError, UserFacingError } from "../../lib/menu-types.ts";
import { MENU_ASSETS_DIR } from "../../lib/paths.ts";
import { slugify, uniqueId } from "../../lib/slug.ts";
import { menuStore } from "../../lib/store.ts";
import { readUpload } from "../../lib/upload.ts";

function describe(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof MenuValidationError) return `No se pudo guardar porque la carta no quedaría válida: ${error.problems.join("; ")}.`;
  console.error("[admin] error inesperado", error);
  return "Ocurrió un error inesperado al guardar. Inténtalo de nuevo.";
}

function refresh() {
  revalidatePath("/categorias");
  revalidatePath("/productos");
  revalidatePath("/");
}

export async function saveCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdmin();
  const values = formDataToValues(formData);
  const fail = (message: string, errors?: Record<string, string>): FormState => ({ message, errors, values });

  const editingId = oneLine(formData.get("categoryId"));
  let newBanner: string | undefined;
  let oldBanner: string | undefined;
  let finalBanner: string | undefined;
  let savedId = "";

  try {
    const parsed = parseCategoryForm(formData);
    if (!parsed.ok) return fail("Revisa los campos marcados en rojo.", parsed.errors);

    const upload = await readUpload(formData, "bannerFile");
    if (upload) newBanner = await saveImage({ file: upload, use: "banner", label: `banner-${parsed.value.name}`, dir: MENU_ASSETS_DIR });
    const removeBanner = formData.get("removeBanner") === "on";

    try {
      savedId = await menuStore.update((menu) => {
        let id = editingId;
        let index = -1;
        if (editingId) {
          index = menu.categories.findIndex((category) => category.id === editingId);
          if (index === -1) throw new UserFacingError("Esta categoría ya no existe (quizá la eliminó otra persona).");
          oldBanner = menu.categories[index].banner;
        } else {
          id = uniqueId(slugify(parsed.value.name, FIELD_LIMITS.categoryId), menu.categories.map((c) => c.id), FIELD_LIMITS.categoryId);
        }
        finalBanner = newBanner ?? (removeBanner ? undefined : oldBanner);
        const category = buildCategory(id, parsed.value, finalBanner);
        if (index === -1) menu.categories.push(category);
        else menu.categories[index] = category;
        return id;
      });
    } catch (error) {
      if (newBanner) await deleteImageIfUnused(newBanner, await menuStore.read(), MENU_ASSETS_DIR);
      throw error;
    }

    if (oldBanner && oldBanner !== finalBanner) await deleteImageIfUnused(oldBanner, await menuStore.read(), MENU_ASSETS_DIR);
    console.info("[admin]", editingId ? "categoría editada" : "categoría creada", { id: savedId, por: access.userId });
  } catch (error) {
    return fail(describe(error), error instanceof ImageError ? { bannerFile: error.message } : undefined);
  }

  refresh();
  redirect(`/categorias?guardado=${encodeURIComponent(savedId)}`);
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const access = await requireAdmin();
  const id = oneLine(formData.get("categoryId"));
  const step = formData.get("direction") === "up" ? -1 : 1;
  let outcome = "ok";

  try {
    await menuStore.update((menu) => {
      const from = menu.categories.findIndex((category) => category.id === id);
      const to = from + step;
      if (from === -1 || to < 0 || to >= menu.categories.length) return; // ya está en el borde: no hay nada que mover
      [menu.categories[from], menu.categories[to]] = [menu.categories[to], menu.categories[from]];
    });
    console.info("[admin] categoría movida", { id, paso: step, por: access.userId });
  } catch (error) {
    outcome = "error";
    console.error("[admin] error moviendo categoría", error);
  }

  refresh();
  redirect(outcome === "ok" ? "/categorias" : "/categorias?error=guardar");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const access = await requireAdmin();
  const id = oneLine(formData.get("categoryId"));
  let oldBanner: string | undefined;
  let outcome = "ok";

  try {
    await menuStore.update((menu) => {
      const index = menu.categories.findIndex((category) => category.id === id);
      if (index === -1) throw new UserFacingError("ya-no-existe");
      if (menu.products.some((product) => product.categories.includes(id))) throw new UserFacingError("en-uso");
      oldBanner = menu.categories[index].banner;
      menu.categories.splice(index, 1);
    });
    await deleteImageIfUnused(oldBanner, await menuStore.read(), MENU_ASSETS_DIR);
    console.info("[admin] categoría eliminada", { id, por: access.userId });
  } catch (error) {
    outcome = error instanceof UserFacingError ? error.message : "guardar";
    if (!(error instanceof UserFacingError)) console.error("[admin] error eliminando categoría", error);
  }

  refresh();
  redirect(outcome === "ok" ? "/categorias?resultado=eliminada" : `/categorias?error=${outcome}`);
}
