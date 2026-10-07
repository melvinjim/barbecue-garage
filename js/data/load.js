import { LIMITS } from '../config.js';

/**
 * Descarga un JSON del mismo origen.
 * - Sin cookies ni credenciales.
 * - Rechaza respuestas demasiado grandes.
 */
export async function loadJson(url) {
  const target = new URL(url, document.baseURI);
  if (target.origin !== location.origin) throw new Error('Origen no permitido');

  const response = await fetch(target, {
    credentials: 'omit',
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  if (text.length > LIMITS.jsonBytes) throw new Error('Respuesta demasiado grande');
  return JSON.parse(text);
}
