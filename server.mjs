// Servidor local para desarrollo y vista previa → http://localhost:5173
//   node server.mjs           arranca el servidor
//   node server.mjs --open    además abre el navegador (lo usa iniciar.bat)
// Sin dependencias. Aplica las MISMAS cabeceras de seguridad que producción
// (se leen de _headers), así lo que ves aquí es lo que verá el público.
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? '127.0.0.1';
const OPEN_BROWSER = process.argv.includes('--open');

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`PORT inválido: "${process.env.PORT}". Usa un número entre 1 y 65535.`);
  process.exit(1);
}
const URL_LOCAL = `http://localhost:${PORT}`;

function openBrowser(url) {
  // `url` se arma solo con un puerto ya validado como número entero.
  const command =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {});
}

// Solo se sirve lo público: nunca package.json, tests, .git, etc.
const PUBLIC_DIRS = new Set(['assets', 'css', 'data', 'js']);
const PUBLIC_FILES = new Set(['robots.txt']);
const PAGE_RE = /^[a-z0-9-]+\.html$/; // cualquier página .html de la raíz (index, carta, ubicacion…): no hace falta registrarla

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Lee el bloque `/*` del archivo _headers. */
function loadSecurityHeaders() {
  const headers = {};
  let inGlobalBlock = false;
  for (const raw of readFileSync(resolve(ROOT, '_headers'), 'utf8').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    if (!/^\s/.test(raw)) {
      inGlobalBlock = raw.trim() === '/*';
      continue;
    }
    if (!inGlobalBlock) continue;
    const separator = raw.indexOf(':');
    headers[raw.slice(0, separator).trim()] = raw.slice(separator + 1).trim();
  }
  return headers;
}

const SECURITY_HEADERS = loadSecurityHeaders();

function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

/** Convierte la URL pedida en un archivo público dentro de ROOT, o null. */
function resolvePublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;

  const segments = decoded.split('/').filter(Boolean);
  if (segments.length === 0) segments.push('index.html');
  if (segments.some((s) => s === '..' || s.startsWith('.'))) return null;

  const allowed =
    (segments.length === 1 && (PUBLIC_FILES.has(segments[0]) || PAGE_RE.test(segments[0]))) ||
    (segments.length > 1 && PUBLIC_DIRS.has(segments[0]));
  if (!allowed) return null;

  const file = resolve(ROOT, ...segments);
  return file.startsWith(ROOT + sep) ? file : null;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const file = resolvePublicFile(new URL(req.url, 'http://localhost').pathname);
  try {
    if (!file || !(await stat(file)).isFile()) throw new Error('not found');
    const body = await readFile(file);
    send(res, 200, req.method === 'HEAD' ? undefined : body, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
  } catch {
    send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`\nEl puerto ${PORT} ya está en uso: lo más probable es que el sitio YA esté corriendo.`);
    console.log(`Ábrelo en  ${URL_LOCAL}\n(Si no lo ves, cierra la otra ventana del servidor o usa otro puerto: PORT=3000 node server.mjs)`);
    if (OPEN_BROWSER) openBrowser(URL_LOCAL);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log('\n  Barbecue Garage corriendo en');
  console.log(`  ${URL_LOCAL}\n`);
  console.log('  Páginas:  /  ·  /carta.html  ·  /domicilios.html');
  console.log('  Para detenerlo presiona Ctrl + C\n');
  if (OPEN_BROWSER) openBrowser(URL_LOCAL);
});
