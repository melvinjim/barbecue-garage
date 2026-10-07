/**
 * Normaliza texto para búsquedas: minúsculas, sin tildes ni signos.
 * "Bretaña" y "bretana" producen el mismo resultado.
 */
export function normalize(input) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto de una sola línea: sin caracteres de control, espacios colapsados y con largo máximo. */
export function cleanLine(input, max) {
  return String(input ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Limpia lo que escribe (o pega en la URL) el usuario antes de usarlo. */
export const sanitizeQuery = cleanLine;

const SMALL_WORDS = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'o', 'y']);
const KEEP_UPPER = new Set(['BBQ']);

/** "BRISKET BURGER" → "Brisket Burger", "MIX DE TACOS" → "Mix de Tacos", "BACON BBQ" → "Bacon BBQ". */
export function titleCase(input) {
  return String(input ?? '')
    .split(' ')
    .map((word, index) => {
      const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (KEEP_UPPER.has(bare)) return word;
      const lower = word.toLocaleLowerCase('es');
      if (index > 0 && SMALL_WORDS.has(bare.toLocaleLowerCase('es'))) return lower;
      return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('es'));
    })
    .join(' ');
}

/** Divide un texto en párrafos (separados por línea en blanco). */
export function paragraphs(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
