// Clean-extract and real-GPU boot verification for the standalone Netlify ZIP.
// This intentionally does not trust the working tree after packaging: it reads
// the archive, validates every entry path, extracts to a unique temp directory,
// serves only that directory, and waits for the shipped game to report ready.
//
//   node tools/verify-netlify-release.mjs
//   node tools/verify-netlify-release.mjs --archive=C:/path/fetch-netlify.zip

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  mkdirSync,
  mkdtempSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launchBrowser, openPage } from '../tests/lib/harness.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archiveArg = process.argv.find((arg) => arg.startsWith('--archive='))?.slice(10);
const archivePath = resolve(archiveArg || join(projectRoot, 'release', 'fetch-netlify.zip'));
const shippingRoots = ['index.html', 'assets', 'src', 'vendor'];
const TITLE_ART_SHA256 = '5ab7c65b0e3ecc50d96454ee5f3393284d02d521ed7f1af2dcfc2691b1cff998';
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 4096;
const MAX_ENTRY_RAW_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_RAW_BYTES = 256 * 1024 * 1024;
let archive;
let extractRoot;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function safeName(rawName) {
  if (!rawName || rawName.includes('\0') || rawName.includes('\\')
    || rawName.startsWith('/') || /^[a-z]:/i.test(rawName)) {
    throw new Error(`Unsafe ZIP entry: ${rawName || '<empty>'}`);
  }
  const segments = rawName.split('/');
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..'
    || segment.includes(':') || /[. ]$/.test(segment) || reserved.test(segment))) {
    throw new Error(`Unsafe ZIP entry: ${rawName}`);
  }
  return rawName;
}

function collectShippingFiles(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in shipping source: ${path}`);
  if (stat.isFile()) return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => collectShippingFiles(join(path, entry.name)));
}

function shippingName(path) {
  return relative(projectRoot, path).split(sep).join('/');
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory() {
  if (archive.length < 22) throw new Error('Truncated ZIP: no end-of-central-directory record');
  const earliest = Math.max(0, archive.length - 22 - 0xffff);
  for (let offset = archive.length - 22; offset >= earliest; offset -= 1) {
    if (archive.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = archive.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === archive.length) return offset;
  }
  throw new Error('ZIP has no complete end-of-central-directory record');
}

function extractFlatZip() {
  const eocdOffset = findEndOfCentralDirectory();
  const disk = archive.readUInt16LE(eocdOffset + 4);
  const centralDisk = archive.readUInt16LE(eocdOffset + 6);
  const diskEntries = archive.readUInt16LE(eocdOffset + 8);
  const totalEntries = archive.readUInt16LE(eocdOffset + 10);
  const centralSize = archive.readUInt32LE(eocdOffset + 12);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) {
    throw new Error('Multi-disk ZIP archives are not supported');
  }
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported');
  }
  if (totalEntries > MAX_ENTRIES) throw new Error(`ZIP entry-count budget exceeded: ${totalEntries}`);
  if (centralOffset + centralSize !== eocdOffset) {
    throw new Error('Central-directory bounds do not meet the end record');
  }

  const names = [];
  const folded = new Set();
  const entries = [];
  let declaredRawBytes = 0;
  const centralEnd = centralOffset + centralSize;
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > centralEnd || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Missing or truncated central-directory entry ${index + 1}`);
    }
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const rawSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const startDisk = archive.readUInt16LE(cursor + 34);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > centralEnd) throw new Error(`Truncated central-directory metadata at entry ${index + 1}`);
    if (flags & 0x01) throw new Error('Encrypted ZIP entries are not supported');
    if (flags & 0x08) throw new Error('Data-descriptor ZIP entries are not supported');
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression method: ${method}`);
    if (startDisk !== 0) throw new Error('Multi-disk ZIP entry is not supported');
    if ([compressedSize, rawSize, localOffset].includes(0xffffffff)) {
      throw new Error('ZIP64 entry is not supported');
    }
    if (rawSize > MAX_ENTRY_RAW_BYTES) throw new Error(`ZIP entry raw-size budget exceeded at entry ${index + 1}`);
    declaredRawBytes += rawSize;
    if (declaredRawBytes > MAX_TOTAL_RAW_BYTES) {
      throw new Error(`ZIP total raw-size budget exceeded: ${declaredRawBytes}`);
    }
    const nameStart = cursor + 46;
    const name = safeName(archive.subarray(nameStart, nameStart + nameLength).toString('utf8'));
    const foldedName = name.toLowerCase();
    if (folded.has(foldedName)) throw new Error(`Duplicate or case-colliding ZIP entry: ${name}`);
    folded.add(foldedName);
    entries.push({ name, flags, method, checksum, compressedSize, rawSize, localOffset });
    cursor = entryEnd;
  }
  if (cursor !== centralEnd) throw new Error('Central-directory size or entry count mismatch');
  if (!entries.length) throw new Error('Archive contains no file entries');

  const localRanges = [];
  for (const entry of entries) {
    const { name, flags, method, checksum, compressedSize, rawSize, localOffset } = entry;
    if (localOffset + 30 > centralOffset || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Missing or truncated local header: ${name}`);
    }
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localChecksum = archive.readUInt32LE(localOffset + 14);
    const localCompressedSize = archive.readUInt32LE(localOffset + 18);
    const localRawSize = archive.readUInt32LE(localOffset + 22);
    const nameLength = archive.readUInt16LE(localOffset + 26);
    const extraLength = archive.readUInt16LE(localOffset + 28);
    const nameStart = localOffset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) throw new Error(`Truncated or overlapping ZIP entry data: ${name}`);
    const localName = safeName(archive.subarray(nameStart, nameStart + nameLength).toString('utf8'));
    if (localName !== name || localFlags !== flags || localMethod !== method
      || localChecksum !== checksum || localCompressedSize !== compressedSize || localRawSize !== rawSize) {
      throw new Error(`Local and central metadata disagree: ${name}`);
    }
    const compressed = archive.subarray(dataStart, dataEnd);
    const body = method === 8
      ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, rawSize) })
      : Buffer.from(compressed);
    if (body.length !== rawSize) throw new Error(`Uncompressed size mismatch: ${name}`);
    if (crc32(body) !== checksum) throw new Error(`CRC-32 mismatch: ${name}`);
    const destination = resolve(extractRoot, ...name.split('/'));
    const rootPrefix = extractRoot.endsWith(sep) ? extractRoot : extractRoot + sep;
    const comparableDestination = process.platform === 'win32' ? destination.toLowerCase() : destination;
    const comparablePrefix = process.platform === 'win32' ? rootPrefix.toLowerCase() : rootPrefix;
    if (!comparableDestination.startsWith(comparablePrefix)) throw new Error(`Escaped extraction root: ${name}`);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, body);
    names.push(name);
    localRanges.push({ start: localOffset, end: dataEnd, name });
  }

  localRanges.sort((a, b) => a.start - b.start);
  let localCursor = 0;
  for (const range of localRanges) {
    if (range.start !== localCursor) throw new Error(`Gap, overlap, or unindexed local entry before: ${range.name}`);
    localCursor = range.end;
  }
  if (localCursor !== centralOffset) throw new Error('Local entries do not end at the central directory');
  if (!folded.has('index.html')) throw new Error('Archive has no root index.html');
  return names;
}

let server;
let browser;
try {
  const archiveBytes = statSync(archivePath).size;
  if (archiveBytes > MAX_ARCHIVE_BYTES) {
    throw new Error(`ZIP archive-size budget exceeded: ${archiveBytes}`);
  }
  archive = readFileSync(archivePath);
  extractRoot = mkdtempSync(join(tmpdir(), 'fetch-netlify-verify-'));
  const names = extractFlatZip();
  const titleArtName = 'assets/fetch-title-keyart-5ab7c65b.webp';
  if (!names.includes(titleArtName)) {
    throw new Error(`Archive is missing the title artwork: ${titleArtName}`);
  }
  const titleArtBytes = readFileSync(join(extractRoot, ...titleArtName.split('/')));
  const titleArtSha256 = createHash('sha256').update(titleArtBytes).digest('hex');
  if (titleArtSha256 !== TITLE_ART_SHA256) {
    throw new Error(`Title artwork filename hash disagrees with content: ${titleArtSha256}`);
  }
  // A clean boot proves only that an archive is internally runnable. Release
  // verification must also prove it is *this* working tree, not yesterday's
  // still-valid ZIP passed under a new filename.
  const shippingFiles = shippingRoots
    .flatMap((root) => collectShippingFiles(join(projectRoot, root)))
    .sort((a, b) => shippingName(a).localeCompare(shippingName(b)));
  const sourceNames = shippingFiles.map(shippingName);
  const archiveNames = [...names].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(sourceNames) !== JSON.stringify(archiveNames)) {
    throw new Error('Archive entry set does not exactly match current shipping roots');
  }
  for (const sourcePath of shippingFiles) {
    const name = shippingName(sourcePath);
    const extracted = readFileSync(join(extractRoot, ...name.split('/')));
    if (!readFileSync(sourcePath).equals(extracted)) {
      throw new Error(`Archive content differs from current shipping source: ${name}`);
    }
  }
  const versionMatch = readFileSync(join(projectRoot, 'src', 'main.js'), 'utf8')
    .match(/const VERSION = '([^']+)'/);
  if (!versionMatch) throw new Error('Could not read current source VERSION');
  const expectedVersion = versionMatch[1];
  server = createServer((req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://fetch.local').pathname);
      if (pathname === '/') pathname = '/index.html';
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(extractRoot, '.' + pathname);
      const rootPrefix = extractRoot.endsWith(sep) ? extractRoot : extractRoot + sep;
      if (!file.startsWith(rootPrefix) || !statSync(file).isFile()) throw new Error('not found');
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/?test=1&mute=1`;
  browser = await launchBrowser();
  const { page, errors } = await openPage(browser, url);
  await page.waitForFunction(
    () => window.__FETCH && window.__FETCH.ready === true,
    null,
    { timeout: 60000, polling: 200 },
  );
  const state = await page.evaluate(async () => {
    const titleArt = await new Promise((resolveImage, rejectImage) => {
      const image = new Image();
      image.onload = () => resolveImage({
        width: image.naturalWidth,
        height: image.naturalHeight,
        src: new URL(image.currentSrc || image.src, location.href).pathname,
      });
      image.onerror = () => rejectImage(new Error('title artwork failed to load'));
      image.src = './assets/fetch-title-keyart-5ab7c65b.webp';
    });
    const titleBackground = getComputedStyle(document.getElementById('title'), '::before').backgroundImage;
    window.__FETCH.start();
    await window.__FETCH.step(1 / 60, 30, false);
    window.__game.render();
    return {
      act: window.__FETCH.state().act,
      version: window.__FETCH.version,
      skullVariant: window.__game.skull.variant,
      render: window.__FETCH.state().render,
      titleArt,
      titleBackground,
    };
  });
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  if (state.act !== 'bedroom') throw new Error(`Unexpected boot act: ${state.act}`);
  if (state.version !== expectedVersion) {
    throw new Error(`Standalone ZIP version ${state.version} does not match current source ${expectedVersion}`);
  }
  if (state.skullVariant !== 'e') throw new Error(`Standalone ZIP did not boot shipping skull: ${state.skullVariant}`);
  if (state.titleArt.width !== 1280 || state.titleArt.height !== 720
    || state.titleArt.src !== '/assets/fetch-title-keyart-5ab7c65b.webp'
    || !state.titleBackground.includes('fetch-title-keyart-5ab7c65b.webp')) {
    throw new Error(`Standalone ZIP title artwork contract failed: ${JSON.stringify(state.titleArt)}`);
  }
  console.log(JSON.stringify({
    archive: archivePath,
    sha256: createHash('sha256').update(archive).digest('hex'),
    entries: names.length,
    integrityBudgets: {
      archiveBytes: MAX_ARCHIVE_BYTES,
      entries: MAX_ENTRIES,
      entryRawBytes: MAX_ENTRY_RAW_BYTES,
      totalRawBytes: MAX_TOTAL_RAW_BYTES,
    },
    extractedToUniqueTemp: true,
    exactCurrentShippingSource: true,
    titleArtSha256,
    rootIndex: true,
    ready: true,
    browserErrors: errors,
    state,
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise((accept) => server.close(accept));
  if (extractRoot) rmSync(extractRoot, { recursive: true, force: true });
}
