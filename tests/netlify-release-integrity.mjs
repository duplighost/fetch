// Negative integrity tests for the deterministic standalone release tools.
// The valid archive receives a real clean-extract/browser boot separately;
// these cases prove malformed archives and dangerous output paths fail closed.
//   node tests/netlify-release-integrity.mjs [archive]
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
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

try {
  const archive = readFileSync(archivePath);
  const eocdOffset = archive.length - 22;
  if (eocdOffset < 0 || archive.readUInt32LE(eocdOffset) !== 0x06054b50) {
    throw new Error('Expected the deterministic packer\'s zero-comment EOCD record');
  }
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);

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
