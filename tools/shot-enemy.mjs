// Deterministic enemy presentation plates in the lighting and spaces where each
// creature is actually encountered. These are diagnosis shots, not glamor shots:
// the normal world renderer, settled act ambient/fog, and held-skull light all
// remain. Transient fear post-processing is deliberately neutral so anatomy can
// be compared across states. Only the first-person hands/skull meshes are hidden
// so they cannot cover the subject (the skull's PointLight remains live).
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDir = resolve(
  process.argv[2] || process.env.FETCH_ENEMY_SHOT_DIR || 'tests/shots/enemy-presentation',
);
mkdirSync(outputDir, { recursive: true });

// Kneeler does not emerge or stalk in authored play: it waits folded near the
// end of the forest, winds up when awakened, then pursues. Preserve that truth
// instead of manufacturing three visually convenient but impossible states.
const scenarios = [
  { kind: 'walker', act: 'graveyard', state: 'emerge', distance: 5.8 },
  { kind: 'walker', act: 'graveyard', state: 'stalk', distance: 6.5 },
  { kind: 'walker', act: 'graveyard', state: 'windup', distance: 4.8 },
  { kind: 'resident', act: 'house', state: 'emerge', distance: 6.1 },
  { kind: 'resident', act: 'house', state: 'stalk', distance: 7.0 },
  { kind: 'resident', act: 'house', state: 'windup', distance: 5.2 },
  { kind: 'kneeler', act: 'forest', state: 'dormant', distance: 5.2 },
  { kind: 'kneeler', act: 'forest', state: 'windup', distance: 4.8 },
  { kind: 'kneeler', act: 'forest', state: 'chase', distance: 5.2 },
];

const server = await ensureServer();
let browser;
try {
  browser = await launchBrowser();
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, {
    width: 1440,
    height: 900,
  });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });

  // Enemy phase and any state-specific jitter after this point are repeatable.
  await page.evaluate(() => {
    let seed = 0x51f15e;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });

  const report = {
    version: await page.evaluate(() => window.__FETCH.version),
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    renderer: 'game renderer.toDataURL; system Chrome; ANGLE/D3D11',
    outputDir,
    scenarios: [],
  };

  for (const [index, scenario] of scenarios.entries()) {
    const result = await page.evaluate(({ scenario: shot, index: shotIndex }) => {
      const g = window.__game;
      const F = window.__FETCH;
      if (!g.started) F.start();

      F.teleport(shot.act);

      // Debug teleport changes the act targets immediately, but production
      // ambient/hemi and fog normally ease toward them over several seconds.
      // Snapping the existing world sources to those exact settled targets
      // avoids inheriting the previous plate's brighter act. Record the values
      // below so this gate cannot silently make that mistake again.
      g.world.ambient.intensity = g.world.ambientBase * g.ambientTarget;
      g.world.hemi.intensity = g.world.hemiBase * g.ambientTarget;
      g.scene.fog.density = g.fogTarget;
      g.enemies.clear();
      g.director.resident = null;
      g.director.kneeler = null;
      g.dead = false;
      g.hitStop = 0;
      g._shake = 0;
      g.fovKick = 0;
      g.fx.fear = 0;
      g.player.noise = 0;
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;

      let playerAt;
      let enemyAt;
      let yHint = 3;

      if (shot.act === 'graveyard') {
        // Just inside the cemetery approach, before the arena trigger: real
        // graveyard moon/ambient/fog, offset east of the wrecked car's collider.
        playerAt = g.player.pos.clone().set(2.0, 0, 8.0);
        playerAt.y = g.world.groundHeightAt(playerAt.x, playerAt.z, 3);
        enemyAt = playerAt.clone().set(2.0, 0, 8.0 + shot.distance);
        enemyAt.y = g.world.groundHeightAt(enemyAt.x, enemyAt.z, playerAt.y + 3);
      } else if (shot.act === 'house') {
        // East side of the ground-floor study, clear of its desk and sofa. This
        // keeps the Resident inside its actual claustrophobic house light budget.
        playerAt = g.player.pos.clone().set(-5.0, 0, 4.65);
        playerAt.y = g.world.groundHeightAt(playerAt.x, playerAt.z, 3);
        enemyAt = playerAt.clone().set(-5.0, 0, 4.65 - shot.distance);
        enemyAt.y = g.world.groundHeightAt(enemyAt.x, enemyAt.z, playerAt.y + 3);
      } else {
        const forest = g.forest;
        // The authored late-forest Kneeler lives among THE CHAIN's ropes at
        // s~=193. That is correct encounter composition but a terrible sculpt
        // plate: ropes occlude it and 11.5m is the lantern's hard falloff. This
        // gate approach is before the canopy closes over the trail, under the
        // same production forest ambient and skull-light budget.
        const presentationS = 8;
        enemyAt = forest.posAt(presentationS, 0);
        enemyAt.y = forest.heightAt(enemyAt.x, enemyAt.z);
        playerAt = forest.posAt(presentationS - shot.distance, 0);
        playerAt.y = forest.heightAt(playerAt.x, playerAt.z);
        yHint = playerAt.y + 3;
        // Seat forest visibility/corridor ownership on this real route point.
        g.player.pos.copy(playerAt);
        forest.recentre(g.player.pos);
        playerAt.copy(g.player.pos);
        // Do not let this one diagnostic step start the arena or manufacture a
        // second authored Kneeler behind the presentation subject.
        g.director.arena = { done: true, status: 'complete' };
      }

      g.player.pos.copy(playerAt);
      g.player._sync(0);

      const spawnState = shot.state === 'emerge'
        ? 'dormant'
        : shot.state === 'windup' ? 'wind' : shot.state;
      const e = g.enemies.spawn(shot.kind, enemyAt.x, enemyAt.z, spawnState, yHint);
      e.pos.copy(enemyAt);
      e.phase = 0.83 + shotIndex * 0.17;
      e.stepT = 1;
      e.mesh.position.copy(e.pos);
      e.mesh.visible = true;

      if (shot.state === 'emerge') {
        // Freeze the real emergence transform at the useful middle beat: enough
        // anatomy to judge, still visibly fighting its way out of the floor.
        e.graveRiseDur = 1.15;
        e.graveRiseT = e.graveRiseDur * 0.48;
        e.riseFrozen = true;
      } else {
        e.graveRiseT = 0;
        e.graveRiseDur = 1.15;
      }

      if (shot.state === 'windup') e.windT = e.spec.windup * 0.64;
      if (shot.kind === 'kneeler') {
        e.mesh.rotation.x = 0.5; // authored dormant pose persists through waking
        g.director.kneeler = e;
      }

      // One real fixed step resolves the production gait/pose and act culling.
      // Re-pin the diagnostic position afterward so stalk/chase cannot drift.
      F.stepWith(1 / 120, {}, false);
      e.pos.copy(enemyAt);
      e.mesh.position.copy(enemyAt);
      if (shot.state === 'emerge') {
        const remaining = e.graveRiseT / e.graveRiseDur;
        e.mesh.position.y -= remaining * remaining * 1.35;
      }
      if (shot.kind === 'kneeler' && shot.state === 'dormant') {
        e.mesh.rotation.y = Math.atan2(
          g.player.pos.x - e.pos.x,
          g.player.pos.z - e.pos.z,
        );
      }
      e.mesh.visible = true;

      const subjectHeight = e.spec.h * (e.mesh.scale.y / e.spec.scale);
      const aimY = e.mesh.position.y + subjectHeight * (shot.state === 'emerge' ? 0.54 : 0.48);
      const dx = e.mesh.position.x - g.player.pos.x;
      const dz = e.mesh.position.z - g.player.pos.z;
      const horizontal = Math.hypot(dx, dz);
      const eyeY = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(aimY - eyeY, horizontal);
      g.player._sync(0);
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.camera.updateMatrixWorld(true);
      e.mesh.updateMatrixWorld(true);

      // Exact projected bounds from every visible enemy mesh. They make framing
      // regressions machine-readable, while the PNG remains the signoff truth.
      const ndc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      e.mesh.traverse((part) => {
        if (!part.isMesh || !part.visible || !part.geometry) return;
        if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
        const box = part.geometry.boundingBox;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const p = box.min.clone().set(x, y, z).applyMatrix4(part.matrixWorld).project(g.camera);
              ndc.minX = Math.min(ndc.minX, p.x);
              ndc.maxX = Math.max(ndc.maxX, p.x);
              ndc.minY = Math.min(ndc.minY, p.y);
              ndc.maxY = Math.max(ndc.maxY, p.y);
            }
          }
        }
      });

      // Hide only renderables. Hiding the held group itself would also remove
      // the attached skull PointLight and falsify the encounter lighting.
      const hidden = [];
      g.skull.hold.traverse((part) => {
        if (!(part.isMesh || part.isLine || part.isPoints || part.isSprite)) return;
        hidden.push([part, part.visible]);
        part.visible = false;
      });

      let data;
      try {
        g._shake = 0;
        g._lastShakeDt = 0;
        // Presentation plates compare the physical creature, not a variable
        // vignette. Ambient, fog, world lights, and skull light remain real.
        g.fx.fear = 0;
        g.render();
        data = g.renderer.domElement.toDataURL('image/png');
      } finally {
        for (const [part, wasVisible] of hidden) part.visible = wasVisible;
      }

      const actualDistance = Math.hypot(
        e.pos.x - g.player.pos.x,
        e.pos.y - g.player.pos.y,
        e.pos.z - g.player.pos.z,
      );
      const finiteBounds = Object.values(ndc).every(Number.isFinite);
      return {
        data,
        meta: {
          kind: shot.kind,
          act: shot.act,
          requestedState: shot.state,
          resolvedState: e.state,
          requestedDistance: shot.distance,
          actualDistance: +actualDistance.toFixed(2),
          player: [...g.player.pos].map((n) => +n.toFixed(2)),
          enemy: [...e.pos].map((n) => +n.toFixed(2)),
          yaw: +g.player.yaw.toFixed(4),
          pitch: +g.player.pitch.toFixed(4),
          meshScale: [...e.mesh.scale].map((n) => +n.toFixed(3)),
          windupRatio: +(e.windT / e.spec.windup || 0).toFixed(3),
          emergenceRemaining: +(e.graveRiseT / e.graveRiseDur || 0).toFixed(3),
          projectedBoundsNdc: finiteBounds
            ? Object.fromEntries(Object.entries(ndc).map(([key, value]) => [key, +value.toFixed(3)]))
            : null,
          fullCreatureInFrame: finiteBounds
            && ndc.minX >= -0.96 && ndc.maxX <= 0.96 && ndc.minY >= -0.96 && ndc.maxY <= 0.96,
          heldRenderablesHidden: hidden.length,
          skullLight: {
            visible: g.skullLight.visible,
            intensity: g.skullLight.intensity,
            distance: g.skullLight.distance,
          },
          actPresentation: {
            ambientTarget: +g.ambientTarget.toFixed(3),
            ambientIntensity: +g.world.ambient.intensity.toFixed(4),
            expectedAmbientIntensity: +(g.world.ambientBase * g.ambientTarget).toFixed(4),
            hemisphereIntensity: +g.world.hemi.intensity.toFixed(4),
            expectedHemisphereIntensity: +(g.world.hemiBase * g.ambientTarget).toFixed(4),
            fogDensity: +g.scene.fog.density.toFixed(4),
            fogTarget: +g.fogTarget.toFixed(4),
            fogColor: `#${g.scene.fog.color.getHexString()}`,
            backgroundColor: `#${g.scene.background.getHexString()}`,
            transientFearNeutralized: g.fx.fear === 0,
          },
        },
      };
    }, { scenario, index });

    const file = `${scenario.kind}-${scenario.act}-${scenario.state}.png`;
    writeFileSync(resolve(outputDir, file), Buffer.from(result.data.split(',')[1], 'base64'));
    report.scenarios.push({ file, ...result.meta });
    console.log(
      `${file}: ${result.meta.resolvedState}, ${result.meta.actualDistance}m, `
      + `bounds=${JSON.stringify(result.meta.projectedBoundsNdc)}, `
      + `full=${result.meta.fullCreatureInFrame}`,
    );
  }

  report.browserErrors = errors;
  writeFileSync(resolve(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const badFrames = report.scenarios.filter((shot) => !shot.projectedBoundsNdc
    || (shot.requestedState !== 'emerge' && !shot.fullCreatureInFrame));
  const badLighting = report.scenarios.filter((shot) => {
    const p = shot.actPresentation;
    return !p || Math.abs(p.ambientIntensity - p.expectedAmbientIntensity) > 0.0001
      || Math.abs(p.hemisphereIntensity - p.expectedHemisphereIntensity) > 0.0001
      || Math.abs(p.fogDensity - p.fogTarget) > 0.0001
      || !p.transientFearNeutralized;
  });
  if (errors.length || badFrames.length || badLighting.length) {
    throw new Error([
      errors.length ? `browser errors: ${errors.join(' | ')}` : '',
      badFrames.length ? `bad framing: ${badFrames.map((shot) => shot.file).join(', ')}` : '',
      badLighting.length ? `unsettled act presentation: ${badLighting.map((shot) => shot.file).join(', ')}` : '',
    ].filter(Boolean).join('; '));
  }
  console.log(`wrote ${scenarios.length} frames and report.json to ${outputDir}`);
} finally {
  if (browser) await browser.close();
  server.stop();
}
