// skull-variant-a2.js — "the calibrated anatomist" (Codex's in-hand pass over
// variant A, remounted from their fork's skull-variant-c.js: broader cranium
// for the 71-degree viewmodel, closed jaw gap, 0.8x eye globes). Competes at
// ?skull=a2 in the sculpt-off; Alex judges. Their default-swap did NOT ship.
//
// Contract: buildSkullMesh(boneMaterial) returns the exact skull-part contract
// consumed by Skull.  This pass preserves Variant A's sub-9000-triangle anatomy
// and growth rig, then corrects its in-hand silhouette without touching any
// throw, recall, collision, or timing behavior.
import * as THREE from 'three';
import { buildSkullMesh as buildAnatomicalSkull } from './skull-variant-a.js';

export function buildSkullMesh(boneMaterial) {
  const parts = buildAnatomicalSkull(boneMaterial);

  // A real cranium is broader than the courier sculpt read in the 71-degree
  // viewmodel camera.  Keep the source rig intact inside a wrapper so Skull can
  // freely position/rotate/scale the returned root without erasing this tune.
  const root = new THREE.Group();
  root.name = 'fetchShippingSkull';
  root.userData.variant = 'c';
  root.userData.source = 'anatomical-a';
  root.userData.triangleCount = parts.root.userData.triangleCount;
  root.userData.triangleBudget = parts.root.userData.triangleBudget;

  parts.root.name = 'anatomy';
  parts.root.scale.set(1.13, 0.97, 1.04);
  parts.root.position.y = -0.002;
  root.add(parts.root);

  // Close the dangling-jaw read without reducing chatter range. The jaw's own
  // animation remains authoritative; this only moves its neutral hinge closer
  // to the temporal bones.
  parts.jaw.position.y += 0.005;
  parts.jawMount.position.y += 0.003;

  // The courier source's eyes read as comic lenses at viewmodel scale. Slightly
  // smaller globes sit inside the unchanged lids/sockets and preserve their
  // asymmetric stage reveals while landing in a more human, uncanny register.
  parts.eyeL.scale.setScalar(0.8);
  parts.eyeR.scale.setScalar(0.8);

  return { ...parts, root };
}
