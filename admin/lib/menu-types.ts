// Forma "cruda" de data/menu.json (la misma que lee y valida el sitio público).

export type RawVariant = { label: string; price: number };

export type RawProduct = {
  id: string;
  categories: string[];
  name: string;
  price: number;
  description?: string;
  includes?: string[];
  units?: string;
  note?: string;
  availability?: string;
  variants?: RawVariant[];
  award?: string;
  featured?: true;
  launch?: true;
  image?: string;
};

export type RawCategory = {
  id: string;
  name: string;
  subtitle?: string;
  note?: string;
  banner?: string;
};

export type RawMenu = {
  categories: RawCategory[];
  recommended: string[];
  products: RawProduct[];
};

/** Campos editables de un producto (todo menos el id y la foto). */
export type ProductFields = Omit<RawProduct, "id" | "image">;

/** Campos editables de una categoría (todo menos el id y el banner). */
export type CategoryFields = Omit<RawCategory, "id" | "banner">;

/** Error cuyo mensaje se puede mostrar tal cual a la persona que administra. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Problema con la foto subida (formato, peso, archivo dañado…): se muestra junto al campo de la foto. */
export class ImageError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}
