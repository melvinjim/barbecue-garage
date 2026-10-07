import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { IMAGE_HOSTS } from '../js/config.js';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

/** Todas las páginas del sitio (.html en la raíz), sin listarlas a mano. */
const pages = readdirSync(root).filter((name) => name.endsWith('.html'));

/** Todos los .js del sitio (carpeta js/). */
function siteScripts(dir = 'js') {
  return readdirSync(new URL(`${dir}/`, root), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? siteScripts(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`${dir}/${entry.name}`] : [],
  );
}

const parseCsp = (csp) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values.sort().join(' ')];
      }),
  );

const metaCsp = (page) => read(page).match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
const headerCsp = () => read('_headers').match(/Content-Security-Policy:\s*(.+)/)?.[1];

test('el sitio tiene las páginas esperadas', () => {
  for (const page of ['index.html', 'ubicacion.html', 'carta.html', 'domicilios.html']) {
    assert.ok(pages.includes(page), `falta ${page}`);
  }
});

test('la CSP de CADA página coincide con la de _headers (salvo frame-ancestors)', () => {
  assert.ok(headerCsp(), '_headers debe tener CSP');
  const { 'frame-ancestors': frameAncestors, ...fromHeaders } = parseCsp(headerCsp());
  assert.equal(frameAncestors, "'none'");

  for (const page of pages) {
    assert.ok(metaCsp(page), `${page} debe tener meta CSP`);
    assert.deepEqual(parseCsp(metaCsp(page)), fromHeaders, `la CSP de ${page} difiere de _headers`);
  }
});

test('la CSP permite exactamente los hosts de imágenes de config.js', () => {
  for (const page of pages) {
    const imgSrc = parseCsp(metaCsp(page))['img-src'].split(' ');
    for (const host of IMAGE_HOSTS) assert.ok(imgSrc.includes(`https://${host}`), `falta ${host} en img-src de ${page}`);
    const remote = imgSrc.filter((v) => v.startsWith('https://'));
    assert.equal(remote.length, IMAGE_HOSTS.length, `img-src de ${page} permite hosts que config.js no conoce`);
  }
});

test('la CSP no permite scripts ni estilos inline, ni eval', () => {
  for (const page of pages) {
    const csp = parseCsp(metaCsp(page));
    for (const directive of ['script-src', 'style-src', 'default-src']) {
      assert.ok(!csp[directive].includes("'unsafe-inline'"), `${page}: ${directive} no debe permitir unsafe-inline`);
      assert.ok(!csp[directive].includes("'unsafe-eval'"), `${page}: ${directive} no debe permitir unsafe-eval`);
    }
    assert.equal(csp['script-src'], "'self'");
    assert.equal(csp['object-src'], "'none'");
    assert.equal(csp['base-uri'], "'none'");
  }
});

test('ninguna página contiene scripts, estilos ni manejadores inline', () => {
  for (const page of pages) {
    const html = read(page);
    assert.ok(!/<script(?![^>]*\ssrc=)/i.test(html), `${page}: hay un <script> inline`);
    assert.ok(!/<style/i.test(html), `${page}: hay un <style> inline`);
    assert.ok(!/\sstyle="/i.test(html), `${page}: hay un atributo style inline`);
    assert.ok(!/\son[a-z]+=/i.test(html), `${page}: hay un manejador on* inline`);
    assert.ok(!/javascript:/i.test(html), `${page}: hay un enlace javascript:`);
  }
});

test('cada página carga su script de arranque y este existe', () => {
  for (const page of pages) {
    const src = read(page).match(/<script type="module" src="([^"]+)"/)?.[1];
    assert.ok(src, `${page} debe cargar un módulo`);
    assert.ok(siteScripts().includes(src), `${page} apunta a ${src}, que no existe`);
  }
});

test('el código del sitio no usa APIs peligrosas', () => {
  const files = siteScripts();
  assert.ok(files.length > 15, 'no se encontraron los scripts del sitio');
  const forbidden = [
    /\.innerHTML\s*=/,
    /\.outerHTML\s*=/,
    /insertAdjacentHTML/,
    /document\.write/,
    /\beval\(/,
    /new Function\(/,
    /\.setAttribute\(\s*['"]style['"]/,
    /createContextualFragment/,
    /DOMParser/,
  ];
  for (const file of files) {
    const source = read(file);
    assert.ok(!source.includes('\0'), `${file} contiene bytes nulos`);
    for (const pattern of forbidden) assert.ok(!pattern.test(source), `${file} usa ${pattern}`);
  }
});
