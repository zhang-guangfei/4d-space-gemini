/**
 * Beyond 3D — Zero-Dependency Local ESM Dev Server (`npm run serve`)
 * Serves src/ directly and maps /vendor/babylon.js to node_modules/babylonjs/babylon.js.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function resolveRequestPath(urlPathname) {
  const clean = decodeURIComponent(urlPathname.split('?')[0]);
  if (clean === '/vendor/babylon.js') {
    return path.join(rootDir, 'node_modules', 'babylonjs', 'babylon.js');
  }
  const candidate = path.resolve(rootDir, `.${clean}`);
  // Guard against directory traversal outside repository root
  if (!candidate.startsWith(rootDir)) {
    return null;
  }
  return candidate;
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${host}:${port}`);

  if (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') {
    const query = reqUrl.search || '?level=14';
    res.writeHead(302, { Location: `/src/ui/index.html${query}` });
    res.end();
    return;
  }

  const filePath = resolveRequestPath(reqUrl.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not Found: ${reqUrl.pathname}`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Beyond 3D server listening at http://${host}:${port}/src/ui/index.html?level=14`);
});
