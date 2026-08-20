import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEBUG = process.env.FETCH_DEBUG === '1';
const PORT = Number(process.argv[2]) || 8711;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  // The coda at ending/ is video-backed. Without these a <video> is handed
  // application/octet-stream and refuses to play, and the failure looks like
  // a coda bug rather than a one-line server omission.
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4',
};

createServer(async (req, res) => {
  try {
    // dev-only frame capture: browser POSTs { name, dataURL } so we can inspect renders
    if (DEBUG && req.method === 'POST' && req.url.startsWith('/__save')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { name, data } = JSON.parse(body);
          const b64 = data.replace(/^data:image\/\w+;base64,/, '');
          await mkdir(join(ROOT, '_shots'), { recursive: true });
          await writeFile(join(ROOT, '_shots', name), Buffer.from(b64, 'base64'));
          res.writeHead(200); res.end('ok');
        } catch (e) { res.writeHead(500); res.end('' + e); }
      });
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end('forbidden'); }
    try { const s = await stat(file); if (s.isDirectory()) file = join(file, 'index.html'); } catch {}
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404: ' + req.url);
  }
}).listen(PORT, () => console.log('FETCH on http://localhost:' + PORT));
