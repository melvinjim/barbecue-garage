// Prepara la carpeta `dist/` con SOLO lo que debe ser público.
//
// El repositorio también guarda el panel (admin/), las pruebas, los .bat y el servidor local.
// Nada de eso debe publicarse: el hosting recibe únicamente `dist/`.
// Para publicar algo nuevo (una página, una carpeta) se agrega a PUBLIC_ENTRIES: lista cerrada a propósito.

import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PUBLIC_ENTRIES = Object.freeze([
  'index.html',
  'carta.html',
  'domicilios.html',
  'ubicacion.html',
  'robots.txt',
  '_headers', // cabeceras de seguridad: Cloudflare las lee desde la raíz de lo publicado
  'css',
  'js',
  'data',
  'assets',
]);

export async function buildPublic({ root = path.resolve(here, '..'), out = path.join(root, 'dist') } = {}) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  for (const entry of PUBLIC_ENTRIES) {
    const from = path.join(root, entry);
    try {
      await access(from);
    } catch {
      // Mejor fallar que publicar un sitio incompleto sin darse cuenta.
      throw new Error(`Falta "${entry}": el sitio quedaría incompleto.`);
    }
    await cp(from, path.join(out, entry), { recursive: true });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildPublic();
  console.log(`Sitio público listo en ${out} (${PUBLIC_ENTRIES.length} elementos).`);
}
