// Build a flat, standalone Netlify-drop ZIP from the shipping game files.
// No dependency or platform ZIP utility is used, so entry names are always
// forward-slash paths and the archive is reproducible from any checkout.
//
//   node tools/package-netlify.mjs
//   node tools/package-netlify.mjs --output=C:/path/fetch-netlify.zip

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputArg = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
const outputPath = resolve(outputArg || join(projectRoot, 'release', 'fetch-netlify.zip'));
const shippingRoots = ['index.html', 'src', 'vendor'];

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

function collect(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in release: ${path}`);
  if (stat.isFile()) return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => collect(join(path, entry.name)));
}

function zipName(path) {
  const name = relative(projectRoot, path).split(sep).join('/');
  if (!name || name.startsWith('../') || name.includes('/../') || name.startsWith('/')) {
    throw new Error(`Unsafe ZIP path: ${name || path}`);
  }
  return name;
}

function dosStamp(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const sourceFiles = shippingRoots
  .flatMap((entry) => collect(join(projectRoot, entry)))
  .sort((a, b) => zipName(a).localeCompare(zipName(b)));

const folded = new Set();
for (const path of sourceFiles) {
  const name = zipName(path);
  const key = name.toLowerCase();
  if (folded.has(key)) throw new Error(`Case-colliding ZIP path: ${name}`);
  folded.add(key);
}

if (!folded.has('index.html')) throw new Error('Release archive must contain index.html at its root');

const localChunks = [];
const centralChunks = [];
let localOffset = 0;
let rawBytes = 0;

for (const path of sourceFiles) {
  const name = zipName(path);
  const nameBytes = Buffer.from(name, 'utf8');
  const data = readFileSync(path);
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);
  const stamp = dosStamp(lstatSync(path).mtime);
  const flags = 0x0800; // UTF-8 names.
  const method = 8; // DEFLATE.

  if (data.length > 0xffffffff || compressed.length > 0xffffffff || localOffset > 0xffffffff) {
    throw new Error(`ZIP64 would be required for ${name}`);
  }

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.day, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  localChunks.push(local, nameBytes, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(flags, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(stamp.time, 12);
  central.writeUInt16LE(stamp.day, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(localOffset, 42);
  centralChunks.push(central, nameBytes);

  localOffset += local.length + nameBytes.length + compressed.length;
  rawBytes += data.length;
}

if (sourceFiles.length > 0xffff) throw new Error('ZIP64 would be required for the entry count');
const centralDirectory = Buffer.concat(centralChunks);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(sourceFiles.length, 8);
end.writeUInt16LE(sourceFiles.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(localOffset, 16);
end.writeUInt16LE(0, 20);

const archive = Buffer.concat([...localChunks, centralDirectory, end]);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, archive);

const digest = createHash('sha256').update(archive).digest('hex');
console.log(JSON.stringify({
  output: outputPath,
  entries: sourceFiles.length,
  rawBytes,
  zipBytes: archive.length,
  sha256: digest,
  rootIndex: true,
}, null, 2));
