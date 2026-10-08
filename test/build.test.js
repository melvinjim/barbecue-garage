import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPublic, PUBLIC_ENTRIES } from '../scripts/build-public.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

test('la publicación incluye el sitio y deja fuera panel, pruebas y herramientas locales', async () => {
  const out = mkdtempSync(path.join(tmpdir(), 'bg-dist-'));
  try {
    await buildPublic({ root: repoRoot, out });

    for (const required of ['index.html', 'carta.html', 'domicilios.html', 'ubicacion.html', '_headers', 'data/menu.json', 'data/site.json']) {
      assert.ok(existsSync(path.join(out, required)), `falta ${required}`);
    }
    for (const forbidden of ['admin', 'test', 'scripts', 'server.mjs', 'iniciar.bat', 'iniciar-panel.bat', 'package.json', 'README.md', '.env', '.git']) {
      assert.equal(existsSync(path.join(out, forbidden)), false, `${forbidden} no debe publicarse`);
    }
    // Solo lo declarado en PUBLIC_ENTRIES, nada más en la raíz de lo publicado.
    assert.deepEqual(readdirSync(out).sort(), [...PUBLIC_ENTRIES].sort());
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('si falta algo del sitio, la publicación falla en vez de salir incompleta', async () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'bg-empty-'));
  try {
    await assert.rejects(buildPublic({ root: empty, out: path.join(empty, 'dist') }), /incompleto/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
