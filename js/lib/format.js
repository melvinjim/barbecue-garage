import { CURRENCY, LOCALE } from '../config.js';

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 34900 → "$ 34.900" */
export function formatPrice(value) {
  if (!Number.isFinite(value)) return '';
  return formatter.format(value).replace(/ /g, ' ');
}
