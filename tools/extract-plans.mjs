// extract-plans.mjs -- turn the triage workflow's merged output into a readable spec.
// The JOURNAL keeps plans and their challenges as separate agent results; the
// workflow's own return value is where they are paired. Use that.
import { readFileSync, writeFileSync } from 'node:fs';
const out = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const plans = out.result?.plans || [];
const FENCE = String.fromCharCode(96, 96, 96);
const TICK = String.fromCharCode(96);
const base = (f) => String(f).split(/[\/]/).pop();
let md = '# Round thirteen — the full diagnosis set\n\n'
  + 'Generated from the parallel triage run: 22 agents, 4.55M tokens, 66 minutes, zero failures.\n\n'
  + 'Every plan was challenged by a second agent whose only job was to REFUTE it.\n'
  + '**Read the Challenge section before applying anything** — several plans carry blockers,\n'
  + 'and in at least one case the challenger caught the plan walking into the exact trap it\n'
  + 'claimed to have designed around.\n\n'
  + '## Index\n\n';
for (const pl of plans) {
  const b = (pl.blockers || []).length;
  md += '- [' + pl.key + '](#' + pl.key + ') — ' + (pl.verdict || '?') + (b ? ' — **' + b + ' blocker(s)**' : '') + '\n';
}
for (const pl of plans) {
  md += '\n\n---\n\n<a id="' + pl.key + '"></a>\n\n## ' + pl.key + '\n\n**' + pl.headline + '**\n\n';
  md += '- confidence: ' + pl.confidence + '\n- challenge verdict: **' + (pl.verdict || '?') + '**\n';
  if ((pl.blockers || []).length) {
    md += '\n### BLOCKERS — do not apply without these\n\n';
    for (const q of pl.blockers) md += '- **' + q.problem + '**\n  - _fix:_ ' + q.fix + '\n\n';
  }
  if (pl.corrected) md += '\n### Execute THIS (the challenged, corrected plan)\n\n' + pl.corrected + '\n';
  md += '\n### Findings\n\n';
  for (const f of pl.findings || []) {
    md += '- **' + f.what + '**\n  - ' + TICK + base(f.file) + ':' + f.line + TICK + '\n';
    md += '  - evidence: ' + String(f.evidence).replace(/\n/g, ' ').slice(0, 700) + '\n\n';
  }
  md += '\n### Raw steps (superseded by the corrected plan above where they conflict)\n\n';
  (pl.steps || []).forEach((s, i) => {
    md += '**' + (i + 1) + '. ' + s.step + '** — ' + TICK + base(s.file) + TICK + '\n\n';
    md += '_anchor:_\n' + FENCE + 'js\n' + String(s.anchor).slice(0, 900) + '\n' + FENCE + '\n\n';
    md += '_change:_\n' + FENCE + 'js\n' + String(s.change).slice(0, 2600) + '\n' + FENCE + '\n\n';
  });
  md += '\n### Cost\n\n' + (pl.cost || '-') + '\n\n### Risk\n\n' + (pl.risk || '-') + '\n';
  if ((pl.openQuestions || []).length) {
    md += '\n### Open questions\n\n';
    for (const q of pl.openQuestions) md += '- ' + q + '\n';
  }
}
writeFileSync('docs/analysis/ROUND-THIRTEEN-PLANS.md', md);
console.log('wrote docs/analysis/ROUND-THIRTEEN-PLANS.md — ' + Math.round(md.length / 1024) + ' KB, ' + plans.length + ' plans\n');
for (const pl of plans) {
  console.log('  ' + String(pl.key).padEnd(14) + String(pl.verdict || '?').padEnd(26)
    + ((pl.blockers || []).length ? (pl.blockers.length + ' BLOCKER(S)') : 'clear'));
}
