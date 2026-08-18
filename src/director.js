// director.js — acts, beats, scares, growth. One update loop, zero setTimeout:
// every beat runs on accumulated dt so the whole game can be stepped by tests.
// Scare law: dread first; teach a rule, break it once; silence is a weapon.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep } from './util.js';
import { FOREST_GATE } from './outside.js';

const ACT_SPAWNS = {
  // THE WAKE: STANDING on the rug beside the bed, facing the moonlit window
  // across a dark room — the first frame resolves as dark room / glassed
  // window / tree beyond, with the bed you did not wake IN and its thrown-back
  // covers at your right hand. x 9.36 with the 0.34 capsule reaches 9.70 —
  // 3.5 cm clear of the bed posts at 9.735, close enough to read as
  // just-got-up. The camera sits above every loose cover box, and z 3.05 stays
  // out of the nightstand's collider (z 3.665).
  bedroom: { x: 9.36, z: 3.05, yaw: 2.47, y: 3.6 },
  house: { x: -1.5, z: 3, yaw: Math.PI, y: 3.6 },
  basement: { x: 9, z: 4.9, yaw: 0.5, y: -3.0 },  // z >= 4.85 clears the last tread's collider — no frame-one shove
  graveyard: { x: -8, z: 8, yaw: -2.86 },       // car left, gate/bodies ahead
  forest: { x: FOREST_GATE.x, z: FOREST_GATE.z + 3, yaw: Math.PI },
  clearing: null,   // computed from forest end
  cave: null,
  mirror: { x: 500, z: 500, yaw: 0 },
};

const STAGE_BY_ACT = { bedroom: 0, house: 1, basement: 2, graveyard: 3, forest: 3, clearing: 5, cave: 5, mirror: 5 };
// Seconds of house-act time before the Resident starts walking the house.
// Long enough to learn the first room, short enough that the act is HUNTED,
// per DESIGN.md's "it is always somewhere". Alex dials this here.
const HOUSE_RESIDENT_DELAY = 18;
const FOG_BY_ACT = {
  bedroom: 0.028, house: 0.03, basement: 0.06, graveyard: 0.034,
  // cave 0.07 was the densest fog in the game — with 0.42 ambient it read as
  // "feel your way through rocks". 0.055 (forest-equal) lets the new water
  // curtains be seen down a corridor while the air still hangs wet.
  forest: 0.055, clearing: 0.018, cave: 0.055, mirror: 0.012,
};
const FOG_COLOR_BY_ACT = {
  // Every outdoor act's fog == its own background (eaten-path's law): when they
  // match, the world ends in a wall of dark instead of a visible geometry
  // horizon, and the draw distance reads as authored rather than as a budget.
  // Interiors keep a fog slightly off their background — a room SHOULD have a
  // far wall, and matching there just flattens it.
  bedroom: 0x07101a, house: 0x080c13, basement: 0x070b0d, graveyard: 0x0b141c,
  forest: 0x030b10, clearing: 0x071821, cave: 0x07141a, mirror: 0x111620,
};
// How much free light each act gets, as a scale on the house's tuning. The
// house was never the problem and keeps exactly what it had; outdoors, ambient
// and hemisphere were drowning the one light the player actually carries.
const AMBIENT_BY_ACT = {
  // Alex, live, after the first darkness pass: "the woods is a little dark to
  // see now". A little — so the forest comes back up, and the carried light
  // comes up with it rather than instead of it.
  bedroom: 1.0, house: 1.0, basement: 0.9, graveyard: 0.46,
  // Underfalls has no carried skull-light. At 0.30 its authored wet line and
  // far hatch disappeared between local fixtures, turning navigation into a
  // wall-feeling exercise. 0.42 still leaves it darker than the forest while
  // preserving enough floor/wall value for the physical route grammar to read.
  forest: 0.54, clearing: 0.68, cave: 0.42, mirror: 0.6,
};
// The graveyard's haze came up from 0x050b16 to 0x0b141c (fog and background
// together — the equality is the district's own law, and breaking it puts a
// visible geometry horizon back). At near-black, every pale object in the yard
// popped out of NOTHING: no depth, no layers, and the far treeline that
// atmosphere.js instances by the hundred was invisible behind it. A readable
// haze is what lets a silhouette be a silhouette. MARROW, which this yard came
// from, sits at 0x14262b for exactly this reason.
const BACKGROUND_BY_ACT = {
  bedroom: 0x03060c, house: 0x03050a, basement: 0x020405, graveyard: 0x0b141c,
  forest: 0x030b10, clearing: 0x071821, cave: 0x02080b, mirror: 0x080b12,
};

const APPROACH_BY_ACT = {
  bedroom: 1.0, house: 0.85, basement: 0.7, graveyard: 0.55,
  forest: 0.4, clearing: 0.4, cave: 0.2, mirror: 0.0,
};

export class Director {
  constructor(game) {
    this.game = game;
    this.beats = [];              // { t, fn } — dt-driven timers
    this.scareT = 12;
    this.dread = 0;
    this.approach = 1.0;          // the gap between you and the thing that is coming
    this._mimicCool = 0;
    this._voidCool = 0;
    this.resident = null;
    this.residentPressure = 0;
    this.arena = null;
    this.graveArena = null;
    this.graveRitual = null;
    this.kneeler = null;
    this.stageGrown = 0;
    this._boxTh = null;
    this._gestureT = 0;
    this._silence = null;
    this._scope = 0;
    this._caveEcology = null;
    this._mirrorTransition = false;
    this._companyDebt = 0;
    this._companyPending = 0;
    this._chaser1 = null;          // null | 'scheduled' | 'spawned'
    this._chaser2 = null;
  }

  after(t, fn, { global = false } = {}) {
    this.beats.push({ t, fn, scope: global ? null : this._scope });
  }

  start() {
    const g = this.game;
    this.setAct('bedroom', true);
    // THE WAKE: the real boot comes to slower than the stock fade — four
    // seconds of surfacing at the bed edge. startGame's fadeIn(2.4) ran one
    // line ago; overriding before the first paint restyles the same
    // transition. (Test teleports still zero the DOM fade; canvas capture
    // never sees it either way.)
    g.fadeIn(4.0);
    // the first thing you hear: your own breath, the house settling, the jaw ticks
    this.after(4, () => g.audio.creak({ pos: new THREE.Vector3(2, 3.6, 0), gain: 0.4, verb: 0.4 }));
    this.after(9, () => g.audio.knock({ pos: new THREE.Vector3(-6, 0, -6), gain: 0.3, verb: 0.5 }));
  }

  setAct(act, hard) {
    const g = this.game;
    if (g.act === act && !hard) return;
    const prev = g.act;
    if (prev !== act) {
      this._cancelScheduledForestChasers();
      this._scope++;
    }
    if (prev === 'cave' && act !== 'cave') this._leaveCave(act);
    g.act = act;
    g.audio.setZone(act);
    g.fogTarget = FOG_BY_ACT[act] ?? 0.03;
    g.ambientTarget = AMBIENT_BY_ACT[act] ?? 1;
    // fog COLOUR eases like density does. Snapping it while density lagged
    // gave every act boundary a two-stage look — a clear "better version"
    // for a second, then the haze arriving like a second load. ("it almost
    // seemed that way" — it literally was.) Hard act sets seed both.
    g.fogColorTarget = new THREE.Color(FOG_COLOR_BY_ACT[act] ?? 0x070b12);
    g.bgColorTarget = new THREE.Color(BACKGROUND_BY_ACT[act] ?? 0x03050a);
    if (hard) {
      g.scene.fog.color.copy(g.fogColorTarget);
      g.scene.background.copy(g.bgColorTarget);
      g.scene.fog.density = g.fogTarget;
    }
    this.approach = APPROACH_BY_ACT[act] ?? this.approach;
    // The skull may look afraid; the player's calibrated throw never changes.
    g.skull.graveFear = act === 'graveyard';   // expression: the hands tremble
    g.skull.fearHome = false;                   // compatibility field; expression only

    // the skull grows between acts — never while you watch it happen
    const stage = STAGE_BY_ACT[act] ?? this.stageGrown;
    if (stage > this.stageGrown) {
      this.stageGrown = stage;
      if (hard) g.skull.setStage(stage);       // debug teleports need exact state
      else g.skull.requestStage(stage);        // real growth waits until unseen
      g.audio.webTear({ gain: 0.25, rate: 0.5 });   // a soft wet sound you can't place
    }

    if (act === 'house' && prev === 'bedroom') this._enterHouse();
    if (act === 'basement') this._enterBasement();
    if (act === 'graveyard') this._enterGraveyard();
    if (act === 'forest') this._enterForest();
    if (act === 'clearing') this._enterClearing();
    if (act === 'cave') this._enterCave();
    if (act === 'mirror') g.baseTension = 0;
  }

  // ------------------------------------------------------------- act beats
  _enterHouse() {
    const g = this.game;
    g.checkpoint('house');
    this.dread = 0.15;
    // footsteps where no one is — the house's opening statement
    this.after(6, () => this._paceOverhead(3));
    this.after(26, () => g.audio.doorOpen(false, { pos: new THREE.Vector3(-8, 0, 2), gain: 0.4, verb: 0.5 }));
  }

  _enterBasement() {
    const g = this.game;
    g.checkpoint('basement');
    g.baseTension = 0.25;
    this.dread = 0.5;
    if (this.resident) {
      // the Resident does not follow you down. the door slams instead. rule taught: doors mean something.
      const d = g.world.doorById.cellarDoor;
      this.after(1.2, () => {
        d.setOpen(false);
        g.audio.doorClose({ pos: d.group.position, gain: 1.0 });
        g.shake(0.3);
        this._removeResident();
      });
    }
    // the storeroom shapes: two lies and a truth
    this._storeArmed = true;
  }

  _enterGraveyard() {
    const g = this.game;
    g.checkpoint('graveyard');
    g.baseTension = 0.12;
    this.dread = 0.4;
    const resolved = g.flags.has('graveyardResolved') || g.flags.has('graveyardCleared');
    if (resolved) {
      if (g.graveyardGate) {
        g.graveyardGate.setRitualStage?.(3);
        if (g.flags.has('graveyardCleared')) g.graveyardGate.openGate();
      }
      g.ossuary?.unlock?.(this.graveRitual?.route || 'restored');
      g.gateKeys?.restore?.();
      // A player who took the stone off the throat must not find it back on
      // after a death. Both hatches are single scalars for exactly this: one
      // assignment each, no sequence to get wrong.
      if (g.flags.has('ossuaryEntered') && g.ossuary) {
        g.ossuary.entryLid.moving = true;
        g.ossuary.entryLid.t = 1;
        g.ossuary.entryLid.open = true;
        g.ossuary.slabT = 1;
      }
      // the counterweight's own flag, not the gate's: the gate is three keys
      // now and the under-yard is only one of them
      if (g.flags.has('ossuaryCleared') && g.ossuary) {
        g.ossuary.solved = true;
        g.ossuary.progress = 1;
        // exitT is the ONE number the far end derives from. Forcing only the
        // collider left the exit re-sealing itself for a second while exitT
        // caught up. The threshold-latched drop sounds are booleans so a forced
        // restore seats the pose without replaying the grind.
        g.ossuary.exitT = 1;
        g.ossuary._slabHeard = true;
        g.ossuary._slabHeard2 = true;
        g.ossuary._slabSeated = true;
        g.ossuary.exitCollider.max.y = g.ossuary.exitCollider.min.y;
      }
      if (!this.graveRitual) this.graveRitual = { credits: new Set([0, 1, 2]), done: true, route: 'restored' };
      else this.graveRitual.done = true;
      if (!this.graveArena) this.graveArena = { wave: 3, pending: 0, t: 0, engaged: false, done: true, route: 'restored' };
      else { this.graveArena.done = true; this.graveArena.pending = 0; }
      return;
    }
    if (!this.graveRitual) this.graveRitual = { credits: new Set(), done: false, route: null };
    if (!this._graveSpawned) {
      this._graveSpawned = true;
      const dormant = g.enemies.spawn('walker', -14, 24, 'dormant');
      dormant.graveArena = true;
      // the Standing Kind: they cross the graveyard only while you aren't looking
      for (const [x, z] of [[8, 30], [16, 16]]) {
        const e = g.enemies.spawn('walker', x, z, 'standing');
        e.standing = true;
        e.gravePressure = true;
        // The Standing Kind are stalking landmarks, not wave bookkeeping.
        // Requiring their deaths could deadlock the gate precisely because
        // staring at them is what stops them. They remain present pressure
        // throughout the fight while ordinary risen bodies own progression.
      }
    }
  }

  _enterForest() {
    const g = this.game;
    // The two Standing figures are graveyard pressure, not migrating forest
    // enemies. They keep circling the open gate until the player crosses it,
    // then remain behind instead of haunting unrelated acts.
    g.enemies.clear((e) => e.gravePressure || e.graveArena);
    g.checkpoint('forest');
    g.baseTension = 0.2;
    this.dread = 0.55;
    this._companyDebt = 0;
    this._companyPending = 0;
  }

  _enterClearing() {
    const g = this.game;
    this._cancelForestArena('clearing');
    g.checkpoint('clearing');
    g.baseTension = 0;
    this.dread = 0;
    g.enemies.clear();
    this.kneeler = null;
    this._kneelerGrace = 0;
    // The falls arrive FROZEN. A bargain cannot be offered to something that
    // is not moving, so the target stays cold and the skull does not start
    // asking until the water does — buildFrozenFalls calls armWaterfall() the
    // moment the ice lets go, and a restored save arrives already thawed.
    if (g.flags.has('fallsThawed')) this.armWaterfall();
  }

  armWaterfall() {
    const g = this.game;
    for (const t of g.world.fetchTargets) if (t.id === 'waterfall') t.enabled = true;
    this._gesturing = true;
  }

  _enterCave() {
    const g = this.game;
    const C = g.clearingCenter;
    const layout = g.underfalls?.layout || null;
    g.checkpoint('cave');
    g.baseTension = 0.2;
    this.dread = 0.72;
    this._mirrorTransition = false;

    // All ambience hangs on authored world points. The waterfall is the first
    // source; the remaining sites are the actual cave candle/stone seams, not
    // random offsets around the listener.
    const waterfall = new THREE.Vector3(C.x, 0.65, C.z + 20.02);
    let choirSource;
    if (layout) {
      // IT USED TO BEGIN BEHIND YOU, four metres back along the ambulatory —
      // and then chase your own footstep breadcrumbs, which keeps it in your
      // rear 180 degrees structurally, forever. Alex: "I still do not see any
      // of those old enemies that used to be unique to the area under the
      // waterfall." He never saw it because it was authored where he could
      // not look. It stands across the chapel now, off the aisle you walk and
      // wide of the false sighting you have just been taught to read: lateral,
      // in the light, inside the cone of a player facing their own route.
      //
      // 2026-08-17, Alex again: "should spawn way in front of you." Lateral in
      // the chapel was better than behind you and still not in front. It stands
      // across the room now — sixteen and a half metres dead ahead, nine
      // degrees off the heading you are walking, in the chapel's own light,
      // with the trigger moved back to the west aisle so you arrive to find it
      // already standing there.
      choirSource = new THREE.Vector3(
        layout.chapel.x + 7.5,
        layout.chapel.y,
        layout.chapel.z + 5.5,
      );
    } else {
      choirSource = new THREE.Vector3(C.x, 0, C.z + 20.68);
    }
    const foreshadow = layout
      ? new THREE.Vector3(layout.main[2].x, layout.main[2].y + 1.15, layout.main[2].z)
      : waterfall.clone();
    const z = g.caveZone;
    const sites = layout
      ? [
          ...layout.main.slice(1).map((p, i) => new THREE.Vector3(p.x, p.y + 1.15 + (i % 2) * 0.65, p.z)),
          ...layout.chambers.map((p) => new THREE.Vector3(p.x, p.y + 2.25, p.z)),
        ]
      : g.world.candles
        .filter((c) => !z || (c.x >= z.min.x && c.x <= z.max.x && c.z >= z.min.z && c.z <= z.max.z))
        .map((c) => new THREE.Vector3(c.x, c.y + 0.4, c.z));
    if (g.caveEnd) sites.push(new THREE.Vector3(g.caveEnd.x, 2.85, g.caveEnd.z));
    this._caveEcology = {
      age: 0,
      dripT: 2.15,
      callT: 7.1,
      site: 0,
      sites,
      waterfall,
      foreshadow,
      choirSource,
      // ...and it arms in the chapel rather than at the lower sluice, which is
      // roughly 60% of the way through the district: a running player could
      // reach the hatch before it ever closed. Still after the passive
      // displacement has had its moment (that beat is at the west aisle, six
      // metres short of this line) — the false sighting is still first.
      // moved back from chapel.z + 1 to the west aisle, so the figure is already
      // standing across the room when you come through the arch — not spawning
      // next to you as you reach the middle of it
      choirTriggerZ: layout ? layout.chapel.z - 4 : -Infinity,
      choirArmed: false,
    };
    // The passive displaced-spray figure in the pump chapel is the first visual
    // lie. The actual predator only answers after the player has passed it.
    // A positioned call from the intake apse begins the sound-story now.
    g.audio.drownedCall({ pos: foreshadow, gain: 0.3, distant: true, ref: 8, roll: 1.1 });
  }

  _leaveCave(reason = 'leave') {
    // Cave isolation snapshots the exterior after the forest district culler
    // has already retired the completed house and graveyard. Restore that
    // snapshot before changing acts so Forest.update can then make the final,
    // authoritative visibility decision in the same frame. Letting the cave
    // ticker restore later would overwrite Forest's house/debug-teleport
    // restoration with the stale, already-culled cave-entry snapshot.
    this.game.underfalls?.visibility?.restore?.();
    this._caveEcology = null;
    this._mirrorTransition = reason === 'mirror';
    this.game.enemies.endDrownedChoir(reason);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;

    // dt-driven beat timers
    for (const b of this.beats.slice()) {
      if (b.scope !== null && b.scope !== this._scope) {
        this.beats.splice(this.beats.indexOf(b), 1);
        continue;
      }
      b.t -= dt;
      if (b.t <= 0) {
        this.beats.splice(this.beats.indexOf(b), 1);
        b.fn();
      }
    }

    // act detection by zone
    const zone = g.world.zoneAt(g.player.pos);
    if (zone && zone !== g.act) {
      // bedroom -> house only after the door opened; zones never move you backwards in the story
      const order = ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];
      const next = order.indexOf(zone), current = order.indexOf(g.act);
      const canGo = next >= 0 && (current < 0 || next > current);
      if (canGo) this.setAct(zone);
    }

    this._voidCool = Math.max(0, this._voidCool - dt);
    this._updateScares(dt);
    this._updateMusicBox(dt);
    this._updateResident(dt);
    this._updateStoreroom(dt);
    this._updateGraveyardArena(dt);
    this._updateForestBeats(dt);
    this._updateArena(dt);
    this._updateKneeler(dt);
    this._updateGesture(dt);
    this._updateCaveHorror(dt);
    this._updateSilence(dt);

    // the ravine takes what falls in it
    if (g.act === 'forest' && g.player.pos.y < -4 && !g.dead) this.death(null);
    if (g.act === 'clearing' && g.player.pos.y < -1.5 && !g.dead) this.death(null);

    // the free light eases toward the act's own floor, so walking out of the
    // house is a walk into darkness rather than a change of wallpaper
    const w = g.world;
    if (w && w.ambient) {
      const k = damp(w.ambient.intensity / w.ambientBase, g.ambientTarget ?? 1, 1.6, dt);
      w.ambient.intensity = w.ambientBase * k;
      w.hemi.intensity = w.hemiBase * k;
    }

    // fear display: vignette breathes with tension; fog eases toward the act's density
    g.fx.fear = damp(g.fx.fear,
      clamp(Math.max(this.dread * 0.4, g.lastThreat || 0, g.baseTension * 0.7), 0, 0.85), 2.2, dt);
  }

  // the mimic step: your footfalls, echoed one beat late from behind you.
  // The Approach IS the offset — it shrinks act by act, and nobody announces it.
  onPlayerStep(surf) {
    const g = this.game;
    if (g.act === 'bedroom' || g.act === 'clearing' || g.act === 'mirror' || g.dead) return;
    if (g.act === 'cave') {
      // Running is still the valid escape, but it writes a louder, longer-lived
      // target into the cave. The Choir follows that target, not player.pos.
      g.enemies.drownedChoirHear(g.player.pos, g.player.running ? 1 : 0.68, 'step');
      return;
    }
    if (g.player.running) return;               // your own noise masks it
    this._mimicCool -= 1;
    if (this._mimicCool > 0) return;
    this._mimicCool = 2;                        // every other step
    const offset = 0.12 + this.approach * 0.55;
    const p = g.player.pos.clone();
    const s = Math.sin(g.player.yaw), c = Math.cos(g.player.yaw);
    p.x += s * 2.3; p.z += c * 2.3;             // behind you
    this.after(offset, () => {
      if (g.dead) return;
      g.audio.footstep(surf, { pos: new THREE.Vector3(p.x, p.y + 0.1, p.z), gain: 0.13, rate: 0.94, verb: 0.3 });
    });
  }

  // calling into nothing: after the waterfall the input lands on silence —
  // except in the cave, where something far away answers on its behalf.
  onVoidCall() {
    const g = this.game;
    if (this._voidCool > 0) return;
    this._voidCool = 5;
    if (g.act === 'cave') {
      const e = g.enemies.drownedChoirHear(g.player.pos, 1.25, 'call');
      if (!e && this._caveEcology) {
        g.audio.drownedCall({
          pos: this._caveEcology.foreshadow,
          gain: 0.42,
          distant: true,
          ref: 8,
          roll: 1.1,
        });
      }
      const cs = g.world.candles
        .filter((c) => Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) < 30)
        .sort((a, b) => {
          const p = e?.pos || g.player.pos;
          return Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z);
        });
      const c = cs[0];
      if (c) {
        const base = c.intensity;
        c.intensity = base * 0.16;
        this.after(0.58, () => { c.intensity = base; });
      }
    }
  }

  // --------------------------------------------------------------- scares
  _updateScares(dt) {
    const g = this.game;
    if (g.act !== 'house' && g.act !== 'basement') return;
    this.scareT -= dt;
    if (this.scareT > 0) return;
    this.scareT = (26 - this.dread * 12) + Math.random() * (20 - this.dread * 8);
    const r = Math.random();
    const p = g.player.pos;
    if (r < 0.3) {
      this._paceOverhead(2 + (Math.random() * 3 | 0));
    } else if (r < 0.5) {
      g.audio.knock({ pos: new THREE.Vector3(p.x + (Math.random() - 0.5) * 14, p.y + 2, p.z + (Math.random() - 0.5) * 14), gain: 0.4, verb: 0.5 });
    } else if (r < 0.7) {
      g.audio.whisper({ pos: new THREE.Vector3(p.x + (Math.random() - 0.5) * 8, p.y + 1.4, p.z + (Math.random() - 0.5) * 8), gain: 0.35 });
      this.dread = Math.min(1, this.dread + 0.06);
    } else if (r < 0.85) {
      // the nearest closed door on YOUR floor drifts open
      let best = null, bd = Infinity;
      for (const d of g.world.doors) {
        if (d.open || d.locked) continue;
        if (Math.abs(d.group.position.y - (p.y + 1.1)) > 2.2) continue;   // same-level filter
        const dd = d.group.position.distanceTo(new THREE.Vector3(p.x, p.y + 1.1, p.z));
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best && bd < 15) {
        best.setOpen(true);
        g.audio.creak({ pos: best.group.position, gain: 0.55, rate: 0.7 });
      }
    } else {
      // No abstract orchestra jab: the house itself performs the scare.
      this._paceOverhead(4);
      g.audio.creak({
        pos: new THREE.Vector3(p.x + (Math.random() - 0.5) * 10, p.y + 3.1, p.z + (Math.random() - 0.5) * 10),
        gain: 0.45, rate: 0.58, verb: 0.65,
      });
    }
  }

  _paceOverhead(steps) {
    // footsteps crossing the ceiling above you (or the floor below, in the cellar)
    const g = this.game;
    const p = g.player.pos.clone();
    const above = g.act === 'basement' ? 3.2 : (p.y < 3 ? 4.6 : -2.5);
    const dir = Math.random() * Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      this.after(0.42 * i, () => {
        g.audio.footstep('wood', {
          pos: new THREE.Vector3(p.x + Math.cos(dir) * i * 0.8, p.y + above, p.z + Math.sin(dir) * i * 0.8),
          gain: 0.5, verb: 0.35, rate: 0.9,
        });
      });
    }
    this.dread = Math.min(1, this.dread + 0.04);
  }

  // ------------------------------------------------------------ music box
  _updateMusicBox(dt) {
    const g = this.game;
    const mb = g.musicBox;
    if (!mb || g.act !== 'house') return;
    const p = g.player.pos;
    const inNursery = p.x < -4 && p.y > 3 && p.z > -2;
    mb.wound = Math.max(0, mb.wound - dt / 55);
    // The thing in the corner IS the creature now. It used to be a bare
    // capsule that grew for eleven seconds and was then deleted at scale 0.96
    // so a full-size walker could be spawned in its place — the reveal
    // swapped objects at the punchline, which is exactly the moment Alex was
    // watching ("i watched it before it expanded. that was cool"). The real
    // walker now drags itself out of the nursery floor on the same slow
    // clock, and what he watched rise is what winds up and comes.
    if (mb.wound > 0.03) {
      this._boxTh = (this._boxTh || 0) - dt;
      if (this._boxTh <= 0) {
        this._boxTh = 0.34 / (0.5 + mb.wound * 0.5);
        g.audio.glassTink({ pos: mb.mesh.position, gain: 0.12 + mb.wound * 0.15, rate: 0.9 + mb.wound * 0.3, verb: 0.6 });
      }
      // rewinding the box sends it back down
      if (mb.walker && !mb.spawned) {
        mb.walker.graveRiseT = Math.min(mb.walker.graveRiseDur, mb.walker.graveRiseT + dt * 2.4);
        if (mb.walker.graveRiseT >= mb.walker.graveRiseDur) {
          g.enemies.clear((e) => e === mb.walker);
          mb.walker = null;
        }
      }
    } else if (inNursery) {
      // while the box is silent, something in the corner is taller than it was
      if (!mb.walker) {
        mb.walker = g.enemies.spawn('walker', -11.2, 5.3, 'dormant', 4.6);
        mb.walker.graveRiseDur = 11.5;
        mb.walker.graveRiseT = 11.5;
        mb.walker.riseFrozen = true;      // this clock belongs to the music box
        // squash-only: the nursery floor is the ground floor's ceiling, so a
        // sunken body would hang into the room below for eleven seconds
        mb.walker.riseSquashOnly = true;
      }
      mb.walker.graveRiseT = Math.max(0, mb.walker.graveRiseT - dt);
      if (mb.walker.graveRiseT <= 0 && !mb.spawned) {
        mb.spawned = true;
        mb.walker.riseFrozen = false;
        mb.walker.state = 'wind';
        mb.walker.windT = 0;
        mb.walker = null;
        g.audio.sting(0.7);
      }
    }
  }

  // ------------------------------------------------------------- resident
  // The director's pointer can go stale: tests and death paths clear the
  // enemy list without telling the director, after which residentHeard
  // "already has" a Resident that no longer exists and the house goes
  // permanently empty. Resolve against the live list every time.
  _liveResident() {
    const list = this.game.enemies.list;
    if (this.resident && list.includes(this.resident)) return this.resident;
    this.resident = list.find((e) => e.kind === 'resident') || null;
    return this.resident;
  }

  residentHeard(n) {
    const g = this.game;
    this.residentPressure += n;
    const live = this._liveResident();
    if (!live && g.act === 'house') {
      this.resident = g.enemies.spawn('resident', -3, -12, 'stalk');
      g.audio.sting(0.5);
      this.after(0.8, () => g.audio.footstep('wood', { pos: this.resident.pos, gain: 0.9, rate: 0.7 }));
    } else if (live) {
      // it heard that too
      live.state = 'wind';
      live.windT = 0;
    }
  }

  _updateResident(dt) {
    const g = this.game;
    // The house is no longer empty until its final gate. Alex: "the enemy in
    // the house should come out pretty early and be a better chaser so you
    // have to close doors to avoid it" — and DESIGN.md always said the
    // Resident "hunts you through the gated section", which the code never
    // delivered: it spawned only on the cellar boards, the act's last beat.
    // It now walks the house from early in the act. One named constant so
    // Alex can dial it.
    if (g.act === 'house' && !g.dead && !this._liveResident()) {
      // ONE BEAT AT A TIME. The landing window scare now runs ~9 s from the
      // first sound to the thing skittering off into the dark, which walks
      // straight into this timer — and a Resident arriving mid-fold does not
      // stack, it steps on the only scare in the room. Hold the clock while
      // the window entry is live; it is the shortest sequence in the act and
      // it fires once. The constant stays exactly as Alex dialled it.
      const entering = g.windowWatcher?.entry?.state;
      const busy = entering && entering !== 'idle' && entering !== 'done';
      if (!busy) {
        this._houseResidentT = (this._houseResidentT ?? HOUSE_RESIDENT_DELAY) - dt;
        if (this._houseResidentT <= 0) this.residentHeard(0);
      }
    }
    if (!this._liveResident()) return;
    if (g.act !== 'house') return;
    // the Resident loses interest if it can't reach you, returns to pacing
    const e = this.resident;
    if (e.state === 'chase' && e.windT > 9) { e.state = 'stalk'; e.windT = 0; }
  }

  _removeResident() {
    if (!this.resident) return;
    this.game.enemies.clear((e) => e === this.resident);
    this.resident = null;
  }

  // ------------------------------------------------------------ storeroom
  _updateStoreroom(dt) {
    const g = this.game;
    if (!this._storeArmed || g.act !== 'basement') return;
    const p = g.player.pos;
    // two lies: passing the shapes plays steps behind you; nothing is there
    if (!this._lie1 && p.x < 0 && p.z < 0) {
      this._lie1 = true;
      this.after(0.9, () => {
        for (let i = 0; i < 3; i++)
          this.after(0.3 * i, () => g.audio.footstep('dirt', { pos: new THREE.Vector3(p.x + 2 + i, p.y, p.z + 2), gain: 0.5 }));
      });
    }
    // the truth: near the crawl door you understand one of the sheets was real —
    // it has been crossing the room behind you this whole time (the dropcloth
    // Standing One built in house.js). the sting is just you noticing.
    if (!this._truth && p.x < -3 && Math.abs(p.z + 3) < 3) {
      this._truth = true;
      g.audio.sting(0.6);
    }
  }

  // ----------------------------------------------------------- graveyard
  _updateGraveyardArena(dt) {
    const g = this.game;
    if (g.act !== 'graveyard' || g.flags.has('graveyardResolved') || g.flags.has('graveyardCleared')) return;

    // The first half of the yard is readable dread: wreck, bodies, graves, and
    // the optional locket line. Crossing the central row commits the player to
    // the combat ground; the iron forest gate is visibly shut from frame one.
    if (!this.graveArena) {
      if (g.player.pos.z < 18) return;
      this.graveArena = { wave: 0, pending: 0, t: 1.35, done: false, engaged: false };
      g.baseTension = 0.42;
      g.enemies.wakeAll(g.player.pos.x, g.player.pos.z, 60);
      g.audio.skullScream(g.camera.getWorldPosition(new THREE.Vector3()));
      g.shake(0.22);
    }

    const a = this.graveArena;
    if (a.done) return;
    const alive = g.enemies.list.filter((e) => e.graveArena && e.state !== 'dying').length;
    a.t -= dt;
    if (alive > 0 || a.pending > 0) {
      a.engaged = true;
      // STRAGGLERS. A wave that ends in hide-and-seek is not a fight. Every few
      // seconds the survivors are re-pointed at the player, and any of them
      // still far off answers out loud — so the last body is something you can
      // hear coming, never something you have to go looking for.
      a.callT = (a.callT || 0) - dt;
      if (a.callT <= 0) {
        a.callT = 5.5;
        g.enemies.wakeAll(g.player.pos.x, g.player.pos.z, 70);
        for (const e of g.enemies.list) {
          if (!e.graveArena || e.state === 'dying') continue;
          if (Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z) < 9) continue;
          g.audio.walkerRise({ pos: e.pos, gain: 0.34, rate: 0.86, verb: 0.7 });
        }
      }
      return;
    }
    if (a.engaged) {
      // `a.t` used to count down while the wave was alive, so the next horde
      // arrived on the same frame as the final loud pop. Give the player one
      // authored breath to catch the returning skull and choose new ground.
      a.engaged = false;
      a.t = 1.35 + Math.min(0.45, a.wave * 0.15);
      g.baseTension = 0.25;
      g.enemies._graveClaimRecovery = Math.max(g.enemies._graveClaimRecovery, 0.7);
      return;
    }
    if (a.t > 0) return;

    if (a.wave < 3) {
      a.wave++;
      g.baseTension = 0.42;
      const sites = [
        [-17, 13], [20, 13], [-17, 38], [20, 37],
        [-8, 34], [13, 29], [-2, 21], [10, 18],
      ];
      const count = a.wave === 1 ? 4 : a.wave === 2 ? 5 : 6;
      a.pending = count;
      for (let i = 0; i < count; i++) {
        const site = sites[(i + a.wave * 2) % sites.length];
        this.after(i * (0.58 + a.wave * 0.09), () => {
          if (!this.graveArena || this.graveArena.done || g.act !== 'graveyard') {
            if (this.graveArena) this.graveArena.pending = Math.max(0, this.graveArena.pending - 1);
            return;
          }
          const x = site[0] + Math.sin(i * 5.7 + a.wave) * 0.7;
          const z = site[1] + Math.cos(i * 4.3 + a.wave) * 0.7;
          const e = g.enemies.spawn('walker', x, z, 'wind');
          e.graveArena = true;
          e.graveRiseDur = 1.08;
          e.graveRiseT = e.graveRiseDur;
          e.windT = -i * 0.13;
          a.pending--;
          g.audio.stoneGrind({ pos: e.pos, gain: 0.28 + a.wave * 0.06, rate: 1.35 - a.wave * 0.1, verb: 0.55 });
          g.audio.walkerRise({ pos: e.pos, gain: 0.42 + a.wave * 0.06, rate: 1.08 - a.wave * 0.05, verb: 0.62 });
        });
      }
      a.t = 0;
      g.audio.sting(0.4 + a.wave * 0.14);
      return;
    }

    this._completeGraveyard('loud');
  }

  onGraveResonance(index, pos) {
    const g = this.game;
    if (g.act !== 'graveyard' || g.flags.has('graveyardResolved') || g.flags.has('graveyardCleared')) return false;
    if (!this.graveRitual) this.graveRitual = { credits: new Set(), done: false, route: null };
    const ritual = this.graveRitual;
    if (ritual.done || ritual.credits.has(index)) return false;
    ritual.credits.add(index);
    g.resonantGraves?.[index]?.setCredited?.(true);
    g.graveyardGate?.setRitualStage?.(ritual.credits.size);
    g.enemies.wakeAll(pos.x, pos.z, 13);
    g.audio.sting(0.24 + ritual.credits.size * 0.08);
    if (ritual.credits.size >= 3) this._completeGraveyard('ritual');
    return true;
  }

  _completeGraveyard(route) {
    const g = this.game;
    if (g.flags.has('graveyardResolved') || g.flags.has('graveyardCleared')) return false;
    const a = this.graveArena || (this.graveArena = {
      wave: 0, pending: 0, t: 0, engaged: false, done: false,
    });
    a.done = true;
    a.pending = 0;
    a.route = route;
    if (!this.graveRitual) this.graveRitual = { credits: new Set(), done: false, route: null };
    this.graveRitual.done = true;
    this.graveRitual.route = route;
    if (route === 'ritual') g.flag('funeralRite');
    g.flag('graveyardResolved');
    g.baseTension = 0.1;
    if (g.graveyardGate) {
      g.graveyardGate.setRitualStage?.(3);
    }
    g.ossuary?.unlock?.(route);
    g.audio.duck(0.2, 2.6);
    this._revealGraveyardRoutes();
    // Resolution is irreversible, but its checkpoint sits at the route it
    // actually opened rather than at whichever corpse happened to die last.
    g.checkpoint('graveyard', {
      x: -14.6, y: 0.08, z: 31.2, yaw: 0, pitch: 0,
    });
    return true;
  }

  // THE THREE ROUTES. The funeral does not open the gate any more — it opens
  // three ways to the three things the gate wants, and it says so out loud,
  // one at a time. Sequential, not simultaneous: three state changes landing
  // together is a flash, and three landing in order is a sentence. Each one
  // happens AT its own object, in motion and value, never in hue.
  _revealGraveyardRoutes() {
    const g = this.game;
    // 1. the west mausoleum's floor is already given (ossuary.unlock, above);
    //    this is the beat that points at it
    g.audio.sting(0.5);
    g.after(0.5, () => g.audio.stoneGrind({
      pos: new THREE.Vector3(-14.6, 0.4, 34.2), gain: 0.8, rate: 0.5, verb: 0.8,
    }), { global: true });
    // 2. the east mausoleum's seal gives
    g.after(2.1, () => g.sealedMausoleumSeal?.crack?.(), { global: true });
    // 3. and the tree lets its lights down
    g.after(4.0, () => g.keyTreeClimb?.drop?.(), { global: true });
  }

  // ---------------------------------------------------------------- forest
  _cancelScheduledForestChasers() {
    // A scoped beat disappears when its life/act scope changes. Only release a
    // pending reservation: a chaser that actually spawned is a spent authored
    // consequence and must not be duplicated on a later retry.
    if (this._chaser1 === 'scheduled') this._chaser1 = null;
    if (this._chaser2 === 'scheduled') this._chaser2 = null;
  }

  _updateForestBeats(dt) {
    const g = this.game;
    if (g.act !== 'forest' || g.dead) return;
    const f = g.forest;
    if (!f) return;
    // Loud forest play accumulates a bounded consequence, then genuinely
    // forgives sustained quiet. The old lifetime counter never decremented.
    this._companyDebt = Math.max(0, this._companyDebt - dt * 0.12);
    this._kneelerGrace = Math.max(0, (this._kneelerGrace || 0) - dt);

    // The far-side checkpoint belongs to CROSSING the ravine, not to the launch
    // that got you there. It used to fire from inside the rope's arrival
    // callback, which tied an irreversible progress guarantee to one particular
    // implementation of one particular jump. Now it fires when the player is
    // actually past the gash, however they managed it.
    if (!this._ravineCrossed && g.flags.has('ropeLatched')) {
      const pr = f.project(g.player.pos.x, g.player.pos.z);
      // The mire surface itself is technically ground, so +1 used to spend the
      // rope and snapshot a body that was still waist-deep in the hazard. Earn
      // the irreversible checkpoint only on the firm far bank.
      if (pr && pr.s >= f.ravineS() + 3.25 && g.player.grounded
        && (f._mireDepth || 0) < 0.08) {
        this._ravineCrossed = true;
        if (g.ravineRopeTarget) g.ravineRopeTarget.enabled = false;
        g.checkpoint('forest');
      }
    }

    if (g.flags.has('treeCleared') && !this._chaser1) {
      this._chaser1 = 'scheduled';
      this.after(6, () => {
        if (g.act !== 'forest' || g.dead) {
          if (this._chaser1 === 'scheduled') this._chaser1 = null;
          return;
        }
        const s = f.posAt(Math.min(f.length - 1, f._lastIdx + 26));
        const chaser = g.enemies.spawn('walker', s.x, s.z, 'stalk');
        chaser.forestChaser = 'tree-cleared';
        this._chaser1 = 'spawned';
      });
    }
    if (g.flags.has('ropeLatched') && !this._chaser2) {
      this._chaser2 = 'scheduled';
      this.after(4, () => {
        if (g.act !== 'forest' || g.dead) {
          if (this._chaser2 === 'scheduled') this._chaser2 = null;
          return;
        }
        const s = f.posAt(Math.max(0, f._lastIdx - 8));
        const chaser = g.enemies.spawn('walker', s.x, s.z, 'wind');
        chaser.forestChaser = 'rope-latched';
        this._chaser2 = 'spawned';
      });
    }
    if (!this.arena && f._lastIdx > f.arenaS() - 10) this._startArena();
    if (!this.kneeler && this._kneelerGrace <= 0
      && f._lastIdx > Math.floor(f.length * 0.85)) this._placeKneeler();
  }

  _startArena() {
    const g = this.game;
    const f = g.forest;
    const center = f.posAt(f.arenaS());
    this.arena = {
      center, wave: 0, alive: 0, pending: 0, t: 2.5,
      done: false, status: 'active', cancelReason: null,
    };
    g.enemies.clear((e) => e.kind === 'walker');   // clean slate; the horde is authored
    // the skull screams. you didn't ask it to.
    g.audio.skullScream(g.camera.getWorldPosition(new THREE.Vector3()));
    g.baseTension = 0.5;
    g.shake(0.25);
  }

  _updateArena(dt) {
    const g = this.game;
    const a = this.arena;
    if (!a || a.done) return;
    if (g.act !== 'forest') {
      this._cancelForestArena('act-left');
      return;
    }
    // count only the arena's own: a dormant statue three acts away must never
    // hold the wave gate open
    a.alive = g.enemies.list.filter((e) => e.forestArena && e.state !== 'dying').length;
    a.t -= dt;
    // clean wave breaks: the next wave waits for silence — waves that bleed
    // together converge 12-on-1 and read as unfair, not scary
    if (a.t <= 0 && a.wave < 3 && a.alive === 0 && !(a.pending > 0)) {
      a.wave++;
      const n = a.wave === 3 ? 4 : 2 + a.wave;
      a.pending = n;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + a.wave;
        const r = 19 + Math.random() * 4;
        // staggered arrivals: a synchronized ring is a wall no one can fight;
        // a broken rhythm of approaching footsteps is beatable AND worse to hear
        this.after(i * (0.9 + Math.random() * 1.1), () => {
          a.pending = Math.max(0, a.pending - 1);
          if (g.act !== 'forest' || this.arena !== a || a.status !== 'active') return;
          const e = g.enemies.spawn('walker', a.center.x + Math.cos(ang) * r,
            a.center.z + Math.sin(ang) * r, 'chase');
          e.forestArena = true;
        });
      }
      a.t = 14;
      g.audio.sting(0.4 + a.wave * 0.1);
    }
    if (a.wave >= 3 && a.alive === 0 && !(a.pending > 0)) {
      a.done = true;
      a.status = 'complete';
      g.baseTension = 0;
      g.skull.requestStage(4);
      this.stageGrown = 4;
      this._silence = { t: 6 };            // the payoff: total quiet
      g.audio.duck(0.1, 6);
      g.flag('arenaCleared');
      // Irreversible set pieces earn spatial checkpoints. A death beyond the
      // closing forest must never return the player to a spent rope or horde.
      g.checkpoint('forest');
    }
  }

  _cancelForestArena(reason = 'cancelled') {
    const a = this.arena;
    if (!a || a.status === 'complete' || a.status === 'cancelled') return false;
    a.done = true;
    a.status = 'cancelled';
    a.cancelReason = reason;
    a.pending = 0;
    this.game.enemies.clear((e) => e.forestArena);
    return true;
  }

  _placeKneeler() {
    const g = this.game;
    const f = g.forest;
    const authoredS = Math.floor(f.length * 0.93);
    const aheadS = Math.min(f.length - 4, Math.max(authoredS, f._lastIdx + 11));
    const s = f.posAt(aheadS, 2.2);
    this.kneeler = g.enemies.spawn('kneeler', s.x, s.z, 'dormant');
    this.kneeler.mesh.rotation.x = 0.5;    // it kneels. do not wake it.
  }

  _updateKneeler(dt) {
    const g = this.game;
    if (!this.kneeler) return;
    const e = this.kneeler;
    if (!g.enemies.list.includes(e)) {
      this.kneeler = null;
      return;
    }
    if (g.act !== 'forest') {
      g.enemies.clear((x) => x === e);
      this.kneeler = null;
      return;
    }
    const d = Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z);
    if (e.state === 'dormant') {
      if (d < 16 && g.player.noise > 0.6) { e.state = 'wind'; e.windT = 0; g.audio.sting(0.9); }
    }
  }

  // -------------------------------------------------- clearing + waterfall
  _updateGesture(dt) {
    const g = this.game;
    if (!this._gesturing || g.skull.mode !== 'held') return;
    this._gestureT -= dt;
    if (this._gestureT <= 0) {
      this._gestureT = 5 + Math.random() * 4;
      // the head turns to face the waterfall and holds there
      g.skull.gazeAt(new THREE.Vector3(
        g.clearingCenter.x - g.player.pos.x, 0, g.clearingCenter.z + 20 - g.player.pos.z).normalize(), 3.5);
      g.audio.whisper({ gain: 0.22, rate: 0.55 });
    }
  }

  _updateCaveHorror(dt) {
    const g = this.game;
    const c = this._caveEcology;
    if (!c || g.act !== 'cave' || g.dead || this._mirrorTransition) return;
    c.age += dt;

    if (!c.choirArmed && g.player.pos.z >= c.choirTriggerZ) {
      c.choirArmed = true;
      // It stands across the chapel, dead ahead, and is still audio-only for
      // its own full warning cadence before it pursues — so you hear it, then
      // you SEE it, and only then does it start closing.
      g.enemies.beginDrownedChoir({ pos: c.choirSource, heardPos: g.player.pos });
    }

    c.dripT -= dt;
    if (c.dripT <= 0 && c.sites.length) {
      const site = c.sites[c.site % c.sites.length];
      g.audio.caveDrip({
        pos: site,
        gain: 0.38 + (c.site % 3) * 0.07,
        rate: 0.86 + (c.site % 4) * 0.08,
        verb: 0.9,
      });
      const cadence = [2.7, 4.05, 3.25, 4.8];
      c.dripT = cadence[c.site % cadence.length];
      c.site++;
    }

    c.callT -= dt;
    if (c.callT <= 0) {
      const e = g.enemies.choir;
      const source = e?.pos || c.foreshadow;
      g.audio.drownedCall({ pos: source, gain: 0.27, distant: true, verb: 0.94, ref: 8, roll: 1.1 });
      c.callT = 8.4;
    }
  }

  waterfallTaken() {
    const g = this.game;
    this._gesturing = false;
    g.flag('waterfallTaken');
    g.checkpoint('clearing');
    if (g.caveZone) g.caveZone.enabled = true;
    if (g.bridgeBarrier) g.bridgeBarrier.max.y = g.bridgeBarrier.min.y;
    g.audio.splash({ pos: new THREE.Vector3(g.clearingCenter.x, 4, g.clearingCenter.z + 20), gain: 0.9 });
    g.audio.duck(0.3, 4);
    // the bridge rises, stone by stone
    g.bridgeStones.forEach((st, i) => {
      this.after(1.2 + i * 0.7, () => {
        st.userData.rise = 0.12;
        g.audio.stoneGrind({ pos: st.position, gain: 0.5, rate: 0.8 + i * 0.05 });
        // The bar across the lane goes down with the first stone, not with the
        // bargain: until something is there to stand on, the water is still
        // the thing that kills you.
        if (i === 0) {
          g.dropBasinSill?.();
          if (g.basinSill) g.audio.stoneGrind({ pos: g.basinSill.mesh.position, gain: 0.42, rate: 0.62 });
        }
      }, { global: true });
    });
    // NOTE the skull does not come back. no failsafe fires. the one broken promise.
  }

  enterMirrorRoom() {
    const g = this.game;
    if (this._mirrorTransition) return;
    this._mirrorTransition = true;
    const choir = g.enemies.choir;
    if (choir) {
      // The hatch is an earned escape, not a 1.6-second black-screen death
      // lottery. Its last pressure rush remains precisely behind the player.
      g.audio.drownedSurge({ pos: choir.pos, gain: 0.52, rate: 0.58, verb: 0.9 });
    }
    this._caveEcology = null;
    g.enemies.endDrownedChoir('hatch');
    g.fadeOut(1.6, () => {
      // Restore the cave culler's saved scene state before Finale.begin makes
      // its own deliberate visibility changes. Otherwise the cave ticker can
      // replay the figure's pre-cave `false` value later in this same step and
      // silently erase the real-route reflection forever.
      g.underfalls?.visibility?.restore?.();
      g.finale.begin();
      g.fadeIn(2.2);
    });
  }

  _updateSilence(dt) {
    if (!this._silence) return;
    this._silence.t -= dt;
    if (this._silence.t <= 0) this._silence = null;
  }

  // ----------------------------------------------------------------- death
  death(enemy) {
    const g = this.game;
    if (g.dead) return;
    if (g.act === 'cave') {
      this._caveEcology = null;
      g.enemies.endDrownedChoir('death');
    }
    g.dead = true;
    g.audio.sting(1.0);
    g.audio.duck(0.05, 8);
    g.fx.fear = 1;
    g.shake(0.6);
    // Movement stops, but look input remains live until vision is gone. Death
    // never turns the camera toward the killer or steals the player's eyes.
    g.player.movementLocked = true;
    this.after(1.1, () => { g.player.frozen = true; g.showDeath(); });
  }

  respawn() {
    const g = this.game;
    this._cancelScheduledForestChasers();
    this._scope++;                         // cancel delayed events from the dead life
    g.dead = false;
    g.player.frozen = false;
    g.player.movementLocked = false;
    g.player.noise = 0;
    g.fx.fear = 0;
    this._mirrorTransition = false;
    const saved = g.checkpointPose ? { ...g.checkpointPose } : null;
    const cp = saved?.act || g.lastCheckpoint || 'bedroom';
    // Snapshot the arrival truth BEFORE the teleport below: Game.teleport
    // auto-completes the bedroom arrival (the debug/test contract), but a
    // death/restart is not a debug jump — a pre-arrival life must respawn
    // into a pre-arrival room. bedroomArrival.completeInstant checks this
    // guard and stands down; the tail re-asserts absence.
    const preArrival = !g.flags.has('skullArrived');
    this._respawnPreArrival = preArrival;
    g.enemies.clear();
    this.kneeler = null;
    this.resident = null;
    if (this.arena && !this.arena.done) this.arena = null;
    this._companyDebt = 0;
    this._companyPending = 0;
    // The old live Kneeler was discarded, then recreated on the very first
    // post-respawn frame inside its wake radius. Three seconds of authored
    // quiet gives the player time to see, move, aim, or throw before the same
    // encounter is allowed to exist again.
    this._kneelerGrace = cp === 'forest' ? 3.25 : 0;
    const graveResolved = g.flags.has('graveyardResolved') || g.flags.has('graveyardCleared');
    if (cp === 'graveyard' && !graveResolved) {
      this.graveArena = null;
      this.graveRitual = null;
      this._graveSpawned = false;
      g.enemies.resetGraveClaims();
      if (g.graveyardGate) g.graveyardGate.reset();
      for (const grave of g.resonantGraves || []) grave.reset?.();
      for (const grave of g.destructibleGraves || []) grave.reset?.();
      g.ossuary?.reset?.();
    } else if (cp === 'graveyard' && graveResolved) {
      if (this.graveArena) { this.graveArena.done = true; this.graveArena.pending = 0; }
      if (this.graveRitual) this.graveRitual.done = true;
      g.graveyardGate?.setRitualStage?.(3);
      g.ossuary?.unlock?.(this.graveRitual?.route || 'restored');
      g.gateKeys?.restore?.();
      if (g.flags.has('graveyardCleared')) g.graveyardGate?.openGate?.();
    }
    g.teleport(cp);
    if (saved && saved.act === cp) {
      g.player.pos.set(saved.x, saved.y, saved.z);
      g.player.yaw = saved.yaw;
      g.player.pitch = saved.pitch;
      g.player.fallV = 0;
      g.player.vel.set(0, 0, 0);
      g.player.abortSwing();
      g.player._sync(0);
      g.checkpointPose = saved;             // hard teleport's act hook snapshots its spawn
    }
    // teleport re-seated the forest on the ACT SPAWN; if a checkpoint pose then
    // moved us somewhere else, re-seat again on where we actually ended up.
    if (g.forest && g.act === 'forest') { g.forest.recentre(g.player.pos); g.player._sync(0); }
    this._respawnPreArrival = false;
    if (g.flags.has('waterfallTaken')) {
      // The promise is already broken; death cannot un-break it or strand the
      // player with a half-raised bridge after scoped callbacks are cleared.
      for (const st of g.bridgeStones) st.userData.rise = 0.12;
      if (g.caveZone) g.caveZone.enabled = true;
      if (g.waterfallBarrier) g.waterfallBarrier.max.y = g.waterfallBarrier.min.y;
      g.dropBasinSill?.(true);
      g.skull.vanish();
    }
    else if (preArrival) {
      // THE ROOM BEFORE THE SKULL: teleport's instant-complete flagged the
      // arrival mid-respawn (main.js half); take the flag back and re-assert
      // absence. Search states persist — they are world truth — and the bell
      // returns to the player's found-but-unrung state; a window already
      // broken by a half-finished arrival stays broken.
      g.flags.delete('skullArrived');
      g.skull.bootAbsent();
      g.bedroomArrival?.resetForRespawn?.();
    }
    else {
      g.skull.holdNow();
      g.skull.setStage(this.stageGrown);
    }
  }

  forestNoise(pos, strength = 1, source = 'impact') {
    const g = this.game;
    const f = g.forest;
    if (g.act !== 'forest' || !f || !pos
      || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return false;

    const loudness = clamp(strength, 0.05, 1.5);
    const wasQuiet = this._companyDebt < 0.35;
    this._companyDebt = Math.min(3, this._companyDebt + loudness);
    // A world object is a real lure, not a disguised read of the player's live
    // coordinate. Nearby sleepers turn toward the appliance/grave/impact that
    // actually made the sound.
    g.enemies.wakeAll(pos.x, pos.z, 14 + loudness * 20);

    // During the authored horde, its own pressure budget remains sovereign.
    // Elsewhere, one loud choice may invite company, with a strict active cap
    // and genuine forgiveness after the debt has drained.
    if (!wasQuiet || (this.arena && !this.arena.done)) return true;
    const active = g.enemies.list.filter((x) => x.forestCompany && x.state !== 'dying').length;
    if (active + this._companyPending >= 2) return true;
    this._companyPending++;
    const heard = f.project(pos.x, pos.z);
    const heardS = heard?.s ?? f._lastIdx ?? 0;
    const delay = source === 'pop' ? 3 : 2.25;
    this.after(delay, () => {
      this._companyPending = Math.max(0, this._companyPending - 1);
      if (g.act !== 'forest' || (this.arena && !this.arena.done)) return;
      const nowActive = g.enemies.list.filter((x) => x.forestCompany && x.state !== 'dying').length;
      if (nowActive >= 2) return;
      const spawnS = Math.min(f.length - 1, heardS + 12 + loudness * 8);
      const at = f.posAt(spawnS, 1);
      const invited = g.enemies.spawn('walker', at.x, at.z, 'chase');
      invited.forestCompany = true;
      invited.heardWorldPos = new THREE.Vector3(pos.x, pos.y ?? at.y, pos.z);
    });
    return true;
  }

  onPop(e) {
    const g = this.game;
    // A permanent kill is never free. Outdoors it feeds the same bounded noise
    // economy as destructible sound props; inside the house it immediately
    // tells the Resident that the player chose violence.
    if (g.act === 'forest') this.forestNoise(e.pos, 1, 'pop');
    else if (g.act === 'house') this.residentHeard(1);
    if (g.act === 'graveyard') g.enemies.wakeAll(e.pos.x, e.pos.z, 40);
  }

  getSpawn(act) {
    const g = this.game;
    if (act === 'clearing') {
      const c = g.clearingCenter;
      return { x: c.x, z: c.z - 16, yaw: Math.PI };
    }
    if (act === 'cave') {
      const c = g.clearingCenter;
      return { x: c.x + 0.35, z: c.z + 23.35, yaw: -2.9 };
    }
    return ACT_SPAWNS[act];
  }
}
