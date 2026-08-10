// Negative integrity tests for the deterministic standalone release tools.
// The valid archive receives a real clean-extract/browser boot separately;
// these cases prove malformed archives and dangerous output paths fail closed.
//   node tests/netlify-release-integrity.mjs [archive]
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archivePath = resolve(process.argv[2] || join(projectRoot, 'release', 'fetch-netlify.zip'));
const verifier = join(projectRoot, 'tools', 'verify-netlify-release.mjs');
const packer = join(projectRoot, 'tools', 'package-netlify.mjs');
const scratch = mkdtempSync(join(tmpdir(), 'fetch-release-negative-'));
const checks = [];
let guardedOutput = null;
let guardedOutputExisted = false;
const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 30000,
  });
  return {
    status: result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
    error: result.error?.message || null,
  };
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

// Parse only the deterministic packer's deliberately small ZIP dialect. The
// rebuilt negative fixtures then have coherent CRCs, sizes, offsets, headers,
// and central directories; a semantic rejection cannot be a malformed-ZIP
// false positive.
function readPackedEntries(archive) {
  const eocdOffset = archive.length - 22;
  if (eocdOffset < 0 || archive.readUInt32LE(eocdOffset) !== 0x06054b50) {
    throw new Error('Expected the deterministic packer\'s zero-comment EOCD record');
  }
  const count = archive.readUInt16LE(eocdOffset + 10);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Expected central-directory entry ${index + 1}`);
    }
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const rawSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Expected local header for ${name}`);
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
    if (data.length !== rawSize) throw new Error(`Unexpected raw size for ${name}`);
    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function buildPackedArchive(entries) {
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const flags = 0x0800;
    const method = 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localChunks.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralChunks.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localChunks, centralDirectory, end]);
}

function replaceEntry(entries, name, replacement) {
  let replaced = false;
  const next = entries.map((entry) => {
    if (entry.name !== name) return entry;
    replaced = true;
    return { name, data: Buffer.from(replacement(entry.data)) };
  });
  if (!replaced) throw new Error(`Archive fixture is missing ${name}`);
  return next;
}

try {
  const archive = readFileSync(archivePath);
  const eocdOffset = archive.length - 22;
  if (eocdOffset < 0 || archive.readUInt32LE(eocdOffset) !== 0x06054b50) {
    throw new Error('Expected the deterministic packer\'s zero-comment EOCD record');
  }
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const packedEntries = readPackedEntries(archive);

  const staleSourceEntries = replaceEntry(packedEntries, 'src/main.js', (data) => {
    const source = data.toString('utf8');
    const stale = source.replace(
      /const VERSION = '[^']+';/,
      "const VERSION = '0.4.0-stale-negative';",
    );
    if (stale === source) throw new Error('Could not create stale src/main.js fixture');
    return Buffer.from(stale, 'utf8');
  });
  const staleSourcePath = join(scratch, 'stale-current-source.zip');
  writeFileSync(staleSourcePath, buildPackedArchive(staleSourceEntries));
  const staleSourceResult = run(verifier, [`--archive=${staleSourcePath}`]);
  check(
    'verifier rejects a structurally valid archive built from stale source',
    staleSourceResult.status !== 0
      && /Archive content differs from current shipping source: src\/main\.js/.test(staleSourceResult.output),
    staleSourceResult,
  );

  const wrongTitleEntries = replaceEntry(
    packedEntries,
    'assets/fetch-title-keyart-5ab7c65b.webp',
    () => Buffer.from('valid ZIP entry, deliberately wrong title artwork', 'utf8'),
  );
  const wrongTitlePath = join(scratch, 'wrong-title-art.zip');
  writeFileSync(wrongTitlePath, buildPackedArchive(wrongTitleEntries));
  const wrongTitleResult = run(verifier, [`--archive=${wrongTitlePath}`]);
  check(
    'verifier rejects wrong title artwork despite a matching content-addressed filename',
    wrongTitleResult.status !== 0
      && /Title artwork filename hash disagrees with content/.test(wrongTitleResult.output),
    wrongTitleResult,
  );

  const badCrc = Buffer.from(archive);
  const wrongCrc = (badCrc.readUInt32LE(14) ^ 1) >>> 0;
  badCrc.writeUInt32LE(wrongCrc, 14);
  badCrc.writeUInt32LE(wrongCrc, centralOffset + 16);
  const crcPath = join(scratch, 'bad-crc.zip');
  writeFileSync(crcPath, badCrc);
  const crcResult = run(verifier, [`--archive=${crcPath}`]);
  check(
    'verifier rejects content whose local and central CRC agree but body CRC does not',
    crcResult.status !== 0 && /CRC-32 mismatch/.test(crcResult.output),
    crcResult,
  );

  const eocdPath = join(scratch, 'truncated-eocd.zip');
  writeFileSync(eocdPath, archive.subarray(0, archive.length - 1));
  const eocdResult = run(verifier, [`--archive=${eocdPath}`]);
  check(
    'verifier rejects a truncated end-of-central-directory record',
    eocdResult.status !== 0 && /end-of-central-directory/.test(eocdResult.output),
    eocdResult,
  );

  const badCentral = Buffer.from(archive);
  badCentral[centralOffset] = 0;
  const centralPath = join(scratch, 'bad-central-signature.zip');
  writeFileSync(centralPath, badCentral);
  const centralResult = run(verifier, [`--archive=${centralPath}`]);
  check(
    'verifier rejects a broken central-directory signature',
    centralResult.status !== 0 && /central-directory entry/.test(centralResult.output),
    centralResult,
  );

  const oversizedEntry = Buffer.from(archive);
  const declaredBombSize = 40 * 1024 * 1024;
  oversizedEntry.writeUInt32LE(declaredBombSize, 22);
  oversizedEntry.writeUInt32LE(declaredBombSize, centralOffset + 24);
  const oversizedPath = join(scratch, 'oversized-entry.zip');
  writeFileSync(oversizedPath, oversizedEntry);
  const oversizedResult = run(verifier, [`--archive=${oversizedPath}`]);
  check(
    'verifier rejects oversized declared output before inflating entry data',
    oversizedResult.status !== 0 && /raw-size budget exceeded/.test(oversizedResult.output),
    oversizedResult,
  );

  guardedOutput = process.platform === 'win32'
    ? join(projectRoot.toUpperCase(), 'SRC', 'release-guard.zip')
    : join(projectRoot, 'src', 'release-guard.zip');
  guardedOutputExisted = existsSync(guardedOutput);
  const guardResult = run(packer, [`--output=${guardedOutput}`]);
  check(
    'packer refuses a case-aliased output path inside shipping source',
    guardResult.status !== 0
      && /Refusing release output inside shipping source/.test(guardResult.output)
      && !existsSync(guardedOutput),
    guardResult,
  );
} catch (error) {
  check('negative release harness completed', false, error?.stack || String(error));
} finally {
  rmSync(scratch, { recursive: true, force: true });
  // If the guard regresses, do not let this negative test poison the next
  // package with the exact file it deliberately tried to create. Never remove
  // a pre-existing user file.
  if (guardedOutput && !guardedOutputExisted && existsSync(guardedOutput)) {
    rmSync(guardedOutput, { force: true });
  }
}

for (const row of checks) {
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.name}`
    + (row.passed || row.details == null ? '' : ` -- ${JSON.stringify(row.details)}`));
}
const failures = checks.filter((row) => !row.passed);
console.log(failures.length ? `FAIL: ${failures.length}/${checks.length}` : `PASS: ${checks.length}/${checks.length}`);
process.exit(failures.length ? 1 : 0);
