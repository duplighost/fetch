// run-gates.mjs -- run a named list of gates in sequence, one line of verdict each.
//   node tools/run-gates.mjs smoke autotest ...
import { spawnSync } from 'node:child_process';
const names = process.argv.slice(2);
const rows = [];
for (const n of names) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [`tests/${n}.mjs`], { encoding: 'utf8', timeout: 900000 });
  const ms = Date.now() - t0;
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const ok = r.status === 0;
  rows.push({ n, ok, ms, tail: ok ? '' : out.trim().split('\n').slice(-14).join('\n') });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(Math.round(ms / 1000)).padStart(4)}s  ${n}`);
  if (!ok) console.log(rows.at(-1).tail.replace(/^/gm, '        | '));
}
console.log('---');
console.log(`${rows.filter((r) => r.ok).length}/${rows.length} green`);
if (rows.some((r) => !r.ok)) process.exitCode = 1;
