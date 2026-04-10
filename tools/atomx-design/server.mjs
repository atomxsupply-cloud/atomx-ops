import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = { port: 3002, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--port') args.port = Number(argv[i + 1] || 3002);
    if (token === '--root') args.root = String(argv[i + 1] || '').trim() || null;
  }
  return args;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function badRequest(res, message) {
  json(res, 400, { error: message });
}

function methodNotAllowed(res) {
  json(res, 405, { error: 'Method not allowed' });
}

function guessType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function handleCatalog(req, res, opsBaseUrl) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    const response = await fetch(`${opsBaseUrl.replace(/\/+$/, '')}/api/public/design/tintas`, {
      headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return json(res, response.status, { error: 'No he podido traer el catalogo de OPS', detalle: data });
    }
    return json(res, 200, data);
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Error cargando catalogo' });
  }
}

async function handleAnalyze(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const body = await readBody(req);
  if (!body) return badRequest(res, 'JSON invalido');
  const { image, prompt, mediaType } = body;
  if (!image || !prompt) return badRequest(res, 'Faltan datos');

  // Centralizamos IA en OPS: Design no guarda keys.
  // OPS expone un endpoint publico que ya valida ANTHROPIC_API_KEY en el backend.
  const opsUrl = `${opsBaseUrl.replace(/\/+$/, '')}/api/public/design/analyze`;
  try {
    const response = await fetch(opsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ image, prompt, mediaType }),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return json(res, response.status, { error: 'Error IA (OPS)', detalle: data });
    }

    return json(res, 200, data);
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Error IA (OPS)' });
  }
}

async function serveFile(res, root, urlPath) {
  const safePath = urlPath.split('?')[0].split('#')[0];
  const rel = safePath === '/' ? '/index.html' : safePath;
  const resolved = path.join(root, rel);
  const rootResolved = path.resolve(root);
  const resolvedAbs = path.resolve(resolved);
  if (!resolvedAbs.startsWith(rootResolved)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const st = await stat(resolvedAbs);
    if (st.isDirectory()) {
      const indexPath = path.join(resolvedAbs, 'index.html');
      const buf = await readFile(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
      return;
    }
    const buf = await readFile(resolvedAbs);
    res.writeHead(200, { 'Content-Type': guessType(resolvedAbs), 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch {
    // SPA fallback
    try {
      const buf = await readFile(path.join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = parseArgs(process.argv.slice(2));
const root = args.root || __dirname;
const port = Number(args.port || 3002);
const opsBaseUrl = String(process.env.ATOMX_OPS_API_URL || 'http://127.0.0.1:3001').trim();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (url.pathname === '/api/catalog') return handleCatalog(req, res, opsBaseUrl);
  if (url.pathname === '/api/analyze') return handleAnalyze(req, res);
  return serveFile(res, root, url.pathname);
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`ATOM X Design corriendo en puerto ${port} (root ${root})`);
});
