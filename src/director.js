// director.js — acts, beats, scares, growth. One update loop, zero setTimeout:
// every beat runs on accumulated dt so the whole game can be stepped by tests.
// Scare law: dread first; teach a rule, break it once; silence is a weapon.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep } from './util.js';
import { FOREST_GATE } from './outside.js';

const ACT_SPAWNS = {
  bedroom: { x: 9.5, z: 1.5, yaw: Math.PI, y: 3.6 },   // wake facing the open window (+z)
  house: { x: -1.5, z: 3, yaw: Math.PI, y: 3.6 },
  basement: { x: 9, z: 4.5, yaw: 0.5, y: -3.0 },
  graveyard: { x: -8, z: 8, yaw: Math.PI },
  forest: { x: FOREST_GATE.x, z: FOREST_GATE.z + 3, yaw: Math.PI },
  clearing: null,   // computed from forest end
  cave: null,
  mirror: { x: 500, z: 500, yaw: 0 },
};

const STAGE_BY_ACT = { bedroom: 0, house: 1, basement: 2, graveyard: 3, forest: 3, clearing: 5, cave: 5, mirror: 5 };
const FOG_BY_ACT = {
  bedroom: 0.028, house: 0.03, basement: 0.06, graveyard: 0.034,
  forest: 0.055, clearing: 0.018, cave: 0.07, mirror: 0.012,
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
    this.kneeler = null;
    this.stageGrown = 0;
    this._boxTh = null;
    this._gestureT = 0;
    this._silence = null;
  }

  after(t, fn) { this.beats.push({ t, fn }); }

  start() {
    const g = this.game;
    this.setAct('bedroom', true);
    // the first thing you hear: your own breath, the house settling, the jaw ticks
    this.after(4, () => g.audio.creak({ pos: new THREE.Vector3(2, 3.6, 0), gain: 0.4, verb: 0.4 }));
    this.after(9, () => g.audio.knock({ pos: new THREE.Vector3(-6, 0, -6), gain: 0.3, verb: 0.5 }));
  }

  setAct(act, hard) {
    const g = this.game;
    if (g.act === act && !hard) return;
    const prev = g.act;
    g.act = act;
    g.audio.setZone(act);
    g.fogTarget = FOG_BY_ACT[act] ?? 0.03;
    this.approach = APPROACH_BY_ACT[act] ?? this.approach;
    g.skull.fearHome = act === 'graveyard';   // it refuses long throws here

    // the skull grows between acts — never while you watch it happen
    const stage = STAGE_BY_ACT[act] ?? this.stageGrown;
    if (stage > this.stageGrown) {
      this.stageGrown = stage;
      g.skull.setStage(stage);
      g.audio.webTear({ gain: 0.25, rate: 0.5 });   // a soft wet sound you can't place
    }

    if (act === 'house' && prev === 'bedroom') this._enterHouse();
    if (act === 'basement') this._enterBasement();
    if (act === 'graveyard') this._enterGraveyard();
    if (act === 'forest') this._enterForest();
    if (act === 'clearing') this._enterClearing();
    if (act === 'cave') g.baseTension = 0.15;
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
    if (!this._graveSpawned) {
      this._graveSpawned = true;
      g.enemies.spawn('walker', -14, 24, 'dormant');
      // the Standing Kind: they cross the graveyard only while you aren't looking
      for (const [x, z] of [[8, 30], [16, 16]]) {
        const e = g.enemies.spawn('walker', x, z, 'standing');
        e.standing = true;
      }
    }
  }

  _enterForest() {
    const g = this.game;
    g.checkpoint('forest');
    g.baseTension = 0.2;
    this.dread = 0.55;
  }

  _enterClearing() {
    const g = this.game;
    g.checkpoint('clearing');
    g.baseTension = 0;
    this.dread = 0;
    g.enemies.clear();
    // arm the waterfall; the skull begins asking
    for (const t of g.world.fetchTargets) if (t.id === 'waterfall') t.enabled = true;
    this._gesturing = true;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;

    // dt-driven beat timers
    for (const b of this.beats.slice()) {
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
      const canGo = order.indexOf(zone) >= 0;
      if (canGo && !(zone === 'bedroom' && g.act !== 'bedroom')) this.setAct(zone);
    }

    this._voidCool = Math.max(0, this._voidCool - dt);
    this._updateScares(dt);
    this._updateMusicBox(dt);
    this._updateResident(dt);
    this._updateStoreroom(dt);
    this._updateForestBeats(dt);
    this._updateArena(dt);
    this._updateKneeler(dt);
    this._updateGesture(dt);
    this._updateSilence(dt);

    // the ravine takes what falls in it
    if (g.act === 'forest' && g.player.pos.y < -4 && !g.dead) this.death(null);

    // fear display: vignette breathes with tension; fog eases toward the act's density
    g.fx.fear = damp(g.fx.fear,
      clamp(Math.max(this.dread * 0.4, g.lastThreat || 0, g.baseTension * 0.7), 0, 0.85), 2.2, dt);
  }

  // the mimic step: your footfalls, echoed one beat late from behind you.
  // The Approach IS the offset — it shrinks act by act, and nobody announces it.
  onPlayerStep(surf) {
    const g = this.game;
    if (g.act === 'bedroom' || g.act === 'clearing' || g.act === 'mirror' || g.dead) return;
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
      const cs = g.world.candles.filter((c) => Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) < 30);
      const c = cs[Math.floor(Math.random() * cs.length)];
      if (c) {
        const base = c.intensity;
        c.intensity = base * 2.6;
        this.after(0.7, () => { c.intensity = base; });
      }
      g.audio.stoneGrind({ pos: new THREE.Vector3(g.player.pos.x + 14, 1, g.player.pos.z + 8), gain: 0.16, rate: 0.6, verb: 0.8 });
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
      g.audio.sting(0.3);
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
    if (mb.wound > 0.03) {
      this._boxTh = (this._boxTh || 0) - dt;
      if (this._boxTh <= 0) {
        this._boxTh = 0.34 / (0.5 + mb.wound * 0.5);
        g.audio.glassTink({ pos: mb.mesh.position, gain: 0.12 + mb.wound * 0.15, rate: 0.9 + mb.wound * 0.3, verb: 0.6 });
      }
      if (mb.thing) { mb.thing.scale.setScalar(Math.max(0.001, mb.thing.scale.x - dt * 0.4)); if (mb.thing.scale.x <= 0.01) { g.scene.remove(mb.thing); mb.thing = null; } }
    } else if (inNursery) {
      // while the box is silent, something in the corner is taller than it was
      if (!mb.thing) {
        const m = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 1.5, 4, 8),
          new THREE.MeshLambertMaterial({ color: 0x0b0a10 }));
        m.position.set(-11.2, 4.6, 5.3);
        m.scale.setScalar(0.001);
        g.scene.add(m);
        mb.thing = m;
      }
      mb.thing.scale.setScalar(Math.min(1, mb.thing.scale.x + dt * 0.09));
      if (mb.thing.scale.x > 0.96 && !mb.spawned) {
        mb.spawned = true;
        g.scene.remove(mb.thing); mb.thing = null;
        g.audio.sting(0.7);
        g.enemies.spawn('walker', -10.5, 4.8, 'wind', 4.6);   // the nursery storey
      }
    }
  }

  // ------------------------------------------------------------- resident
  residentHeard(n) {
    const g = this.game;
    this.residentPressure += n;
    if (!this.resident && g.act === 'house') {
      this.resident = g.enemies.spawn('resident', -3, -12, 'stalk');
      g.audio.sting(0.5);
      this.after(0.8, () => g.audio.footstep('wood', { pos: this.resident.pos, gain: 0.9, rate: 0.7 }));
    } else if (this.resident) {
      // it heard that too
      this.resident.state = 'wind';
      this.resident.windT = 0;
    }
  }

  _updateResident(dt) {
    const g = this.game;
    if (!this.resident) return;
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

  // ---------------------------------------------------------------- forest
  _updateForestBeats(dt) {
    const g = this.game;
    if (g.act !== 'forest') return;
    const f = g.forest;
    if (!f) return;
    if (g.flags.has('treeCleared') && !this._chaser1) {
      this._chaser1 = true;
      this.after(6, () => {
        const s = f.posAt(Math.min(f.length - 1, f._lastIdx + 26));
        g.enemies.spawn('walker', s.x, s.z, 'stalk');
      });
    }
    if (g.flags.has('ropeLatched') && !this._chaser2) {
      this._chaser2 = true;
      this.after(4, () => {
        const s = f.posAt(Math.max(0, f._lastIdx - 8));
        g.enemies.spawn('walker', s.x, s.z, 'wind');
      });
    }
    if (!this.arena && f._lastIdx > f.arenaS() - 10) this._startArena();
    if (!this.kneeler && f._lastIdx > Math.floor(f.length * 0.85)) this._placeKneeler();
  }

  _startArena() {
    const g = this.game;
    const f = g.forest;
    const center = f.posAt(f.arenaS());
    this.arena = { center, wave: 0, alive: 0, t: 2.5, done: false };
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
    // count only the arena's own: a dormant statue three acts away must never
    // hold the wave gate open
    a.alive = g.enemies.list.filter((e) => e.kind === 'walker' &&
      Math.hypot(e.pos.x - a.center.x, e.pos.z - a.center.z) < 32).length;
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
          g.enemies.spawn('walker', a.center.x + Math.cos(ang) * r, a.center.z + Math.sin(ang) * r, 'chase');
          a.pending--;
        });
      }
      a.t = 14;
      g.audio.sting(0.4 + a.wave * 0.1);
    }
    if (a.wave >= 3 && a.alive === 0 && !(a.pending > 0)) {
      a.done = true;
      g.baseTension = 0;
      g.skull.setStage(4);
      this.stageGrown = 4;
      this._silence = { t: 6 };            // the payoff: total quiet
      g.audio.duck(0.1, 6);
      g.flag('arenaCleared');
    }
  }

  _placeKneeler() {
    const g = this.game;
    const f = g.forest;
    const s = f.posAt(Math.floor(f.length * 0.93), 2.2);
    this.kneeler = g.enemies.spawn('kneeler', s.x, s.z, 'dormant');
    this.kneeler.mesh.rotation.x = 0.5;    // it kneels. do not wake it.
  }

  _updateKneeler(dt) {
    const g = this.game;
    if (!this.kneeler) return;
    const e = this.kneeler;
    const d = Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z);
    if (e.state === 'dormant') {
      if (d < 16 && g.player.noise > 0.6) { e.state = 'wind'; e.windT = 0; g.audio.sting(0.9); }
    } else if (g.act === 'clearing') {
      // it will not enter the clearing. rule: the clearing is safe. (it is safe.)
      g.audio.brushCrash({ pos: e.pos, gain: 0.9 });
      g.enemies.clear((x) => x === this.kneeler);
      this.kneeler = null;
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

  waterfallTaken() {
    const g = this.game;
    this._gesturing = false;
    g.flag('waterfallTaken');
    g.audio.splash({ pos: new THREE.Vector3(g.clearingCenter.x, 4, g.clearingCenter.z + 20), gain: 0.9 });
    g.audio.duck(0.3, 4);
    // the bridge rises, stone by stone
    g.bridgeStones.forEach((st, i) => {
      this.after(1.2 + i * 0.7, () => {
        st.userData.rise = 0.12;
        g.audio.stoneGrind({ pos: st.position, gain: 0.5, rate: 0.8 + i * 0.05 });
      });
    });
    // NOTE the skull does not come back. no failsafe fires. the one broken promise.
  }

  enterMirrorRoom() {
    const g = this.game;
    g.fadeOut(1.6, () => {
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
    g.dead = true;
    g.audio.sting(1.0);
    g.audio.duck(0.05, 8);
    g.fx.fear = 1;
    g.shake(0.6);
    if (enemy) {
      // it turns you to face it before the dark
      const to = new THREE.Vector3(enemy.pos.x - g.player.pos.x, 0, enemy.pos.z - g.player.pos.z);
      g.player.yaw = Math.atan2(-to.x, -to.z);
    }
    g.player.frozen = true;
    this.after(1.1, () => g.showDeath());
  }

  respawn() {
    const g = this.game;
    g.dead = false;
    g.player.frozen = false;
    g.fx.fear = 0;
    const cp = g.lastCheckpoint || 'bedroom';
    g.enemies.clear((e) => e !== this.kneeler);
    this.resident = null;
    if (this.arena && !this.arena.done) this.arena = null;
    g.teleport(cp);
    g.skull.holdNow();
    g.skull.setStage(this.stageGrown);
  }

  onPop(e) {
    const g = this.game;
    // outside the arena, a pop invites company — but the debt drains; it must
    // never become a 1:1 treadmill that breeds forever
    if (g.act === 'forest' && (!this.arena || this.arena.done)) {
      this._company = (this._company || 0) + 1;
      if (this._company <= 2) {
        const f = g.forest;
        this.after(3, () => {
          const s = f.posAt(Math.min(f.length - 1, f._lastIdx + 20), 1);
          g.enemies.spawn('walker', s.x, s.z, 'chase');
        });
      }
    }
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
      return { x: c.x + 2, z: c.z + 26, yaw: Math.PI * 0.8 };
    }
    return ACT_SPAWNS[act];
  }
}
