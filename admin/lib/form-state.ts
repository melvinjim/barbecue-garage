import type { FormValues } from "./form-values.ts";

/** Resultado de un formulario con errores: se devuelve a la pantalla para mostrarlos sin perder lo escrito. */
export type FormState = {
  message?: string;
  errors?: Record<string, string>;
  values?: FormValues;
} | null;
