// main.js — boot + loop + input + debug contract.
// Fixed timestep 1/120 (kick-ball law): edge inputs land on the first substep of
// each rendered frame; hit-stop eats time but never eats taps.
import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';
import { makeMaterials } from './textures.js';
import { GameAudio } from './audio.js';
import { World } from './world.js';
import { Skull, FEEL_PROFILE } from './skull.js';
import { Player, EYE } from './player.js';
import { Enemies } from './enemies.js';
import { Director } from './director.js';
import { Finale } from './finale.js';
import { buildHouse } from './house.js';
import { buildOutside } from './outside.js';
import { LAYER_HELD } from './mirrors.js';

const FIXED_DT = 1 / 120;
const Q = new URLSearchParams(location.search);
const TEST_MODE = Q.has('test') || Q.has('autotest');
const VERSION = '0.1.0-wake';

// ------------------------------------------------------------------- input
class InputState {
  constructor() {
    this.keys = new Set();
    this.lookX = 0; this.lookY = 0;
    this.throwHeld = false;
    this.callHeld = false;
    this.callDownAt = 0;
    this.pending = { throwPressed: false, throwReleased: false, callTap: false, interact: false, jump: false };
    this.testInput = null;      // harness override
  }
  clearKeys() { this.keys.clear(); this.throwHeld = false; this.callHeld = false; }
  frame(consumeEdges) {
    if (this.testInput) return { ...this.testInput };
    const k = this.keys;
    const f = {
      moveX: (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0),
      moveZ: (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0),
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      lookX: this.lookX, lookY: this.lookY,
      throwHeld: this.throwHeld, callHeld: this.callHeld,
      throwPressed: false, throwReleased: false, callTap: false, interactPressed: false, jumpPressed: false,
    };
    this.lookX = 0; this.lookY = 0;
    if (consumeEdges) {
      f.throwPressed = this.pending.throwPressed;
      f.throwReleased = this.pending.throwReleased;
      f.callTap = this.pending.callTap;
      f.interactPressed = this.pending.interact;
      f.jumpPressed = this.pending.jump;
      this.pending = { throwPressed: false, throwReleased: false, callTap: false, interact: false, jump: false };
    }
    return f;
  }
}

// -------------------------------------------------------------------- game
class Game {
  constructor() {
    this.act = 'bedroom';
    this.flags = new Set();
    this.keys = new Set();          // held key-items (rarely used; teeth carry keys)
    this.tickers = [];
    this.webs = [];
    this.boards = [];
    this.bridgeStones = [];
    this.dead = false;
    this.started = false;
    this.time = 0;
    this.hitStop = 0;
    this._shake = 0;
    this.baseTension = 0;
    this.fx = { fear: 0 };
    this.fogTarget = 0.028;
    this.snapBuffer = 0;
    this.lastCheckpoint = 'bedroom';
    this.gorePool = [];

    this._setupRenderer();
    this._setupScene();

    this.audio = new GameAudio();
    // ?mute=1: audio never initializes (every call no-ops pre-init) — the
    // headless gate wedges inside native WebAudio under arena load; the sim
    // doesn't need ears, and real browsers keep the full soundscape.
    if (Q.has('mute')) this.audio.init = () => {};
    this.world = new World(this.scene, this.mats);
    this.player = new Player(this.camera, this.world, this.audio);
    this.enemies = new Enemies(this);
    this.director = new Director(this);

    buildHouse(this);
    buildOutside(this);
    this.finale = new Finale(this);
    this.world.finishStatic();
    this.world.buildLights(this.scene);
    this.world.attachCandlePool(this.scene);

    this.skull = new Skull({ scene: this.scene, camera: this.camera, audio: this.audio, world: this.world, mats: this.mats, variant: Q.get('skull') });
    this.skull.setLayers((o) => o.layers.set(LAYER_HELD));
    // the skull is the light you carry — throw it and the light leaves with it
    this.skullLight = new THREE.PointLight(0xb6cfdd, 42, 9, 1.6);
    this.skull.root.add(this.skullLight);
    this.fillLight = new THREE.PointLight(0x28323c, 8, 3.5, 1.4);
    this.camera.add(this.fillLight);

    this.input = new InputState();
    this._wireInput();
    this._wireOverlays();
    this.player.onStep = (surf) => this.director.onPlayerStep(surf);

    const spawn = this.director.getSpawn('bedroom');
    this.player.pos.set(spawn.x, 3.6, spawn.z);
    this.player.yaw = spawn.yaw;
    this.player._sync(0);
    this.world.freezeMoonShadow(this.renderer, this.scene, this.camera);

    this._buildGrain();
    this._exposeDebug();
  }

  // ---------------------------------------------------------------- setup
  _setupRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setSize(innerWidth, innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(r.domElement);
    r.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
    r.domElement.addEventListener('webglcontextrestored', () => this._dropQuality());
    this.renderer = r;
    this.lastRender = { drawCalls: 0, triangles: 0 };
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050c);
    this.scene.fog = new THREE.FogExp2(0x05060c, 0.028);
    this.camera = new THREE.PerspectiveCamera(71, innerWidth / innerHeight, 0.2, 260);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.set(0);
    this.camera.layers.enable(LAYER_HELD);
    this.scene.add(this.camera);
    this.mats = makeMaterials();
    // grade pass: crush the interiors toward damp (ACES + physical lights read
    // the authored maps too bright); value hierarchy preserved — bone/headstone pale
    const tint = (m, hex) => { if (this.mats[m]) this.mats[m].color.setHex(hex); };
    tint('wallpaper', 0x6e7570);
    tint('wallpaperRot', 0x6e6a60);
    tint('plaster', 0x7d7d78);
    tint('stone', 0x74746e);
    tint('brick', 0x6e6862);
    tint('woodFloor', 0x7a7268);
    tint('ceiling', 0x808080);
    tint('bone', 0xcfc9bb);
  }

  _buildGrain() {
    this.grainScene = new THREE.Scene();
    this.grainCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.grainMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uFear: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uFear;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          float g = hash(vUv*vec2(1280.,720.) + fract(uTime)*173.1) - 0.5;
          vec2 c = vUv - 0.5;
          float vig = smoothstep(0.35, 0.95, dot(c,c)*(2.4 + uFear*2.2));
          float a = abs(g)*0.11 + vig*(0.34 + uFear*0.5);
          gl_FragColor = vec4(vec3(0.007,0.006,0.01), clamp(a, 0., 0.94));
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.grainMat);
    quad.position.z = -0.5;
    this.grainScene.add(quad);
  }

  _dropQuality() {
    this.renderer.setPixelRatio(1);
    if (this.world.moon) this.world.moon.castShadow = false;
  }

  // ---------------------------------------------------------------- input
  _wireInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.started || this.dead) return;
      if (!TEST_MODE && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
      if (e.button === 0) { this.input.throwHeld = true; this.input.pending.throwPressed = true; }
      if (e.button === 2) { this.input.callHeld = true; this.input.callDownAt = performance.now(); }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.input.throwHeld) this.input.pending.throwReleased = true;
        this.input.throwHeld = false;
      }
      if (e.button === 2) {
        this.input.callHeld = false;
        // duration alone decides — never gate the recall on mouse motion
        if (performance.now() - this.input.callDownAt < 260) this.input.pending.callTap = true;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!TEST_MODE && document.pointerLockElement !== canvas) return;
      this.input.lookX += e.movementX;
      this.input.lookY += e.movementY;
    });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.input.keys.add(e.code);
      if (e.code === 'Space') this.input.pending.jump = true;
      if (e.code === 'KeyE') this.input.pending.interact = true;
    });
    addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    addEventListener('blur', () => this.input.clearKeys());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) this.input.clearKeys();
    });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _wireOverlays() {
    this.el = {
      title: document.getElementById('title'),
      die: document.getElementById('die'),
      fade: document.getElementById('fade'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      sr: document.getElementById('srState'),
    };
    this.el.title.addEventListener('click', () => {
      if (this.flags.has('ended')) { location.reload(); return; }
      this.startGame();
    });
    this.el.die.addEventListener('click', () => {
      this.el.die.classList.add('hidden');
      this.director.respawn();
      this.fadeIn(1.2);
      if (!TEST_MODE) this.renderer.domElement.requestPointerLock();
    });
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.audio.init();
    this.el.title.classList.add('hidden');
    this.fadeIn(2.4);
    this.director.start();
    if (!TEST_MODE) this.renderer.domElement.requestPointerLock();
  }

  // ------------------------------------------------------------- services
  flag(name) { this.flags.add(name); }
  after(t, fn) { this.director.after(t, fn); }
  checkpoint(act) { this.lastCheckpoint = act; }
  shake(v) { this._shake = Math.max(this._shake, v); }
  residentHeard(n) { this.director.residentHeard(n); }

  impact(kind, pos) {
    if (kind === 'break') { this.hitStop = Math.max(this.hitStop, 0.085); this.shake(0.46); }
    else if (kind === 'hurt') { this.hitStop = Math.max(this.hitStop, 0.05); this.shake(0.28); }
    else this.shake(0.11);
  }

  gore(pos, n) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1216 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.06, 0), mat);
      m.position.copy(pos);
      m.position.y += 1;
      const v = new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7);
      this.scene.add(m);
      this.gorePool.push({ m, v, t: 1.6 });
    }
  }

  detachBoard(b) {
    b.userData.off = true;
    const spin = (Math.random() - 0.5) * 6;
    this.tickers.push((dt) => {
      if (b.position.y <= 0.15) return;
      b.position.y -= dt * 3;
      b.position.x += dt * (Math.random() - 0.3);
      b.rotation.z += dt * spin;
    });
  }

  exitBasement() {
    this.fadeOut(1.2, () => {
      this.teleport('graveyard');
      this.fadeIn(1.6);
    });
  }

  fadeOut(dur, cb, slow) {
    this.el.fade.classList.toggle('slow', !!slow);
    this.el.fade.style.transitionDuration = dur + 's';
    this.el.fade.style.opacity = 1;
    if (cb) this.after(dur, cb);
  }

  fadeIn(dur) {
    this.el.fade.style.transitionDuration = dur + 's';
    this.el.fade.style.opacity = 0;
  }

  showDeath() {
    this.el.die.classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
  }

  showEnd() {
    this.flag('ended');
    // in the dark: the catch you know — and someone else's gasp
    this.audio.catchThud({ gain: 0.7 });
    this.after(1.1, () => this.audio.whisper({ gain: 0.55, rate: 1.5 }));
    const t = this.el.title;
    t.querySelector('.keys').style.display = 'none';
    t.querySelector('.tag').textContent = 'It kept you.';
    t.querySelector('.go').textContent = '';
    t.classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
  }

  teleport(act) {
    if (TEST_MODE) {
      this.el.fade.style.transitionDuration = '0s';
      this.el.fade.style.opacity = 0;
    }
    if (act === 'mirror') {
      this.finale.begin();
      this.director.setAct('mirror', true);
      return;
    }
    const s = this.director.getSpawn(act);
    if (!s) return;
    const y = s.y != null ? s.y : this.world.groundHeightAt(s.x, s.z, (s.y || 0) + 3);
    this.player.pos.set(s.x, y, s.z);
    this.player.yaw = s.yaw || 0;
    this.player.pitch = 0;
    this.player.fallV = 0;
    this.player._sync(0);
    if (this.forest && act !== 'forest' && act !== 'clearing' && act !== 'cave') {
      this.forest._lastIdx = 0;
      this.forest.sealS = -10;
      this.forest.entered = false;
    }
    if (this.forest && act === 'clearing') this.forest._lastIdx = this.forest.length - 1;
    if (this.forest && act === 'cave') this.forest._lastIdx = this.forest.length - 1;
    this.director.setAct(act, true);
  }

  // ----------------------------------------------------------------- step
  step(dt, frame) {
    this.time += dt;
    const ctx = {
      playerVel: new THREE.Vector3(this.player.vel.x, this.player.fallV, this.player.vel.z),
      yawVel: this.player.yawVel, pitchVel: this.player.pitchVel,
      callHeld: frame.callHeld, throwHeld: frame.throwHeld, bobY: this.player.bobY,
      onCatch: (impactV, hard) => { this.shake(0.1 + impactV * 0.15); },
    };

    // input → skull verbs. Alex's grammar: press throws, hold keeps it out,
    // release brings it home. The button is the tether.
    if (frame.throwPressed && this.skull.mode === 'held') this.skull.tryThrow(ctx);
    if (frame.throwReleased && this.skull.mode === 'outbound') this.skull.beginReturn('snap');
    if (frame.callTap) {
      if (this.skull.mode === 'gone') this.director.onVoidCall();
      else this.snapBuffer = FEEL_PROFILE.snapBuffer;
    }
    if (this.snapBuffer > 0) {
      if (this.skull.call()) this.snapBuffer = 0;
      else this.snapBuffer -= dt;
    }
    if (frame.interactPressed) this._interact();

    this.player.update(dt, frame);
    this.world.update(dt);
    this.skull.update(dt, ctx);
    if (this.started && !this.dead) this.enemies.update(dt, ctx);
    if (this.started) this.director.update(dt);
    if (this.forest) this.forest.update(dt);
    this.finale.update(dt);
    this.world.updateCandles(dt, this.player.pos, this.time);
    this.audio.update(dt, this.camera.position, this.camera);

    for (const t of this.tickers) t(dt, this.time);
    for (const g of this.gorePool.slice()) {
      g.t -= dt;
      g.v.y -= 9 * dt;
      g.m.position.addScaledVector(g.v, dt);
      if (g.m.position.y < 0.04) { g.m.position.y = 0.04; g.v.multiplyScalar(0.4); g.v.y = 0; }
      if (g.t <= 0) { this.scene.remove(g.m); this.gorePool.splice(this.gorePool.indexOf(g), 1); }
    }
    for (const st of this.bridgeStones) {
      if (st.userData.rise && st.position.y < 0.12) st.position.y = Math.min(0.12, st.position.y + dt * 0.7);
    }
    for (const w of this.webs) {
      if (w.userData.torn) continue;
      const d = w.position.distanceTo(this.camera.position);
      if (d < 0.7) {
        w.userData.torn = true;
        this.audio.webTear({ pos: w.position, gain: 0.5 });
        this.tickers.push((dt2) => { if (w.scale.y > 0.05) w.scale.y -= dt2 * 2; w.position.y -= dt2 * 0.4; });
      }
    }

    // fog eases toward the act's density
    this.scene.fog.density = damp(this.scene.fog.density, this.fogTarget, 0.8, dt);
  }

  _interact() {
    // E: use what the crosshair holds, else call the skull home
    const inter = this._crosshairTarget();
    if (inter) {
      // mercy path: standing at a lock while the skull carries its key
      const doorMatch = this.world.doors.find((d) => 'door:' + d.id === inter.id && d.locked && this.skull.carry && this.skull.carry.id === d.locked);
      if (doorMatch) {
        const c = this.skull.dropCarry();
        c.mesh.visible = false;
        doorMatch.unlock(this);
        return;
      }
      inter.action(this);
      return;
    }
    this.snapBuffer = FEEL_PROFILE.snapBuffer;
  }

  _crosshairTarget() {
    if (!this._ray) { this._ray = new THREE.Raycaster(); this._center = new THREE.Vector2(0, 0); }
    this.camera.updateMatrixWorld();   // sim-only steps never render; the ray must not cast from a stale pose
    this._ray.setFromCamera(this._center, this.camera);
    this._ray.far = 2.9;
    const hits = this._ray.intersectObjects(this.world.interactables, false);
    for (const h of hits) {
      const inter = h.object.userData.inter;
      if (inter && inter.enabled !== false) return inter;
    }
    return null;
  }

  // --------------------------------------------------------------- render
  render() {
    // embedded panes / headless report sizes late — self-correct every frame (chamber fix)
    const c = this.renderer.domElement;
    if (c.clientWidth !== innerWidth || c.clientHeight !== innerHeight) {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    }
    const mirrored = this.finale.render(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info.render;
    this.lastRender = { drawCalls: info.calls, triangles: info.triangles };
    this.renderer.autoClear = false;
    this.grainMat.uniforms.uTime.value = this.time % 300;
    this.grainMat.uniforms.uFear.value = this.fx.fear;
    this.renderer.render(this.grainScene, this.grainCam);
    this.renderer.autoClear = true;

    // wordless HUD sync
    const ch = this.el.crosshair;
    ch.dataset.target = this._crosshairTarget() ? '1' : '';
    ch.dataset.skull = this.skull.mode === 'held' ? '' : 'away';
    this.el.vignette.style.opacity = clamp(this.fx.fear, 0, 1) * 0.85;
    this.el.sr.textContent = `${this.act}, skull ${this.skull.mode}${this.skull.carry ? ' carrying ' + this.skull.carry.id : ''}`;

    // camera shake as canvas transform
    this._shake = Math.max(0, this._shake - this._lastShakeDt * 2.8);
    const s = this._shake * this._shake;
    this.renderer.domElement.style.transform =
      s > 0.0001 ? `translate(${(Math.random() - 0.5) * s * 14}px, ${(Math.random() - 0.5) * s * 10}px)` : '';
  }

  // ----------------------------------------------------------------- loop
  run() {
    let last = performance.now();
    let acc = 0;
    const tick = (now) => {
      requestAnimationFrame(tick);
      const rawDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this._lastShakeDt = rawDt;
      if (TEST_MODE && !this._selfStep) { this.render(); return; }
      if (this.hitStop > 0) { this.hitStop -= rawDt; this.render(); return; }   // edges buffered, not lost
      acc = Math.min(acc + rawDt, FIXED_DT * 10);
      let first = true;
      while (acc >= FIXED_DT) {
        const frame = this.input.frame(first);
        this.step(FIXED_DT, frame);
        first = false;
        acc -= FIXED_DT;
      }
      this.render();
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- debug
  _exposeDebug() {
    const g = this;
    const api = {
      version: VERSION,
      feelProfile: FEEL_PROFILE,
      ready: true,
      start() { g.startGame(); return true; },
      step(dt = 1 / 120, n = 1, render = true) {
        for (let i = 0; i < n; i++) g.step(dt, g.input.frame(i === 0));
        if (render) g.render();
        return true;
      },
      stepWith(seconds, controls = {}, render = true) {
        const n = Math.max(1, Math.round(seconds / FIXED_DT));
        for (let i = 0; i < n; i++) {
          const f = {
            moveX: 0, moveZ: 0, run: false, lookX: 0, lookY: 0,
            throwHeld: false, callHeld: false,
            throwPressed: false, throwReleased: false, callTap: false, interactPressed: false, jumpPressed: false,
            ...controls,
          };
          if (i > 0) { f.throwPressed = f.throwReleased = f.callTap = f.interactPressed = f.jumpPressed = false; }
          g.step(FIXED_DT, f);
        }
        if (render) g.render();
        return true;
      },
      state() {
        return {
          act: g.act,
          pos: [+g.player.pos.x.toFixed(2), +g.player.pos.y.toFixed(2), +g.player.pos.z.toFixed(2)],
          yaw: +g.player.yaw.toFixed(3),
          pitch: +g.player.pitch.toFixed(3),
          skull: g.skull.getState(),
          enemies: g.enemies.list.map((e) => ({ kind: e.kind, state: e.state, pos: [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1)] })),
          flags: [...g.flags],
          finale: { active: g.finale.active, phase: g.finale.phase, half: +g.finale.half.toFixed(2) },
          render: {
            drawCalls: g.lastRender.drawCalls, triangles: g.lastRender.triangles,
            geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures,
          },
        };
      },
      teleport(act) { if (!g.started) g.startGame(); g.teleport(act); return g.act; },
      setSkull(x, y, z, vx, vy, vz, mode) {
        if (mode && !['held', 'outbound', 'returning', 'anchored', 'gone'].includes(mode)) return false;
        if (mode && mode !== 'held' && g.skull.mode === 'held') {
          g.skull.hold.remove(g.skull.root);
          g.scene.add(g.skull.root);
          g.skull.root.traverse((o) => o.layers.set(0));
        }
        g.skull.pos.set(x, y, z);
        g.skull.prevPos.set(x, y, z);
        g.skull.vel.set(vx || 0, vy || 0, vz || 0);
        if (mode === 'held') g.skull.holdNow();
        else if (mode) {
          g.skull.mode = mode;
          g.skull.flightTime = 0; g.skull.freeFlightTime = 0;
          g.skull.outboundDuration = 1; g.skull.hardAway = 2; g.skull.maxRange = 60;
          g.skull.lastFlightSpeed = g.skull.vel.length() || 20;
          g.skull.returnTime = 0; g.skull.returnStuck = 0;
        }
        return true;
      },
      setStage(n) { g.skull.setStage(n); return g.skull.stage; },
      async shot(name) {
        const data = g.renderer.domElement.toDataURL('image/png');
        await fetch('/__save', { method: 'POST', body: JSON.stringify({ name, data }) });
        return name;
      },
    };
    window.__FETCH = api;
  }
}

// ---------------------------------------------------------------- autotest
async function runAutotest(game) {
  const checks = [];
  const check = (name, fn) => {
    try { const ok = fn(); checks.push({ name, passed: !!ok }); }
    catch (e) { checks.push({ name, passed: false, error: String(e) }); }
  };
  const F = window.__FETCH;
  game._selfStep = false;
  F.start();

  check('boot-ready', () => F.ready === true && game.started);
  check('hud-prints-no-words-during-play', () => {
    let text = '';
    for (const el of document.querySelectorAll('#hud *')) {
      if (el.classList.contains('sr-only')) continue;
      text += (el.textContent || '').trim();
    }
    return text === '';
  });

  // press throws; while held it stays out
  F.teleport('graveyard');
  F.stepWith(0.2);
  game.player.yaw = -Math.PI / 2;   // face open ground, not the crashed car
  F.stepWith(FIXED_DT, { throwPressed: true, throwHeld: true });
  F.stepWith(1.2, { throwHeld: true });
  check('throw-enters-outbound', () => game.skull.mode === 'outbound');
  // release IS the recall — it lands on the very next fixed step, hot
  F.stepWith(FIXED_DT, { throwReleased: true });
  check('quick-call-enters-return-on-the-next-fixed-step', () => game.skull.mode === 'returning' && game.skull.snapReturn === true);
  F.stepWith(3.5);
  check('skull-returns-and-is-caught', () => game.skull.mode === 'held');

  // a bare tap = the fast zip: out and straight back
  F.stepWith(FIXED_DT, { throwPressed: true, throwHeld: true });
  F.stepWith(0.08, { throwHeld: true });
  F.stepWith(FIXED_DT, { throwReleased: true });
  F.stepWith(2.5);
  check('called-skull-comes-home', () => game.skull.mode === 'held');

  // the skull can never be lost
  F.setSkull(0, -120, 0, 0, 0, 0, 'outbound');
  F.stepWith(4);
  check('skull-cannot-be-lost', () => game.skull.mode === 'held');

  // fetch flow: key from the tree, then the lock
  F.teleport('bedroom');
  F.setSkull(7.2, 5.7, 7.6, 0, 0, 8, 'outbound');
  F.stepWith(0.4);
  check('tree-key-rides-in-the-teeth', () => game.skull.carry && game.skull.carry.id === 'bedroomKey');
  F.stepWith(3);
  const door = game.world.doorById.bedroomDoor;
  F.setSkull(door.group.position.x, door.group.position.y, door.group.position.z - 1.5, 0, 0, 12, 'outbound');
  F.stepWith(0.4);
  check('key-unlocks-the-bedroom-door', () => game.flags.has('bedroomOpen'));
  F.stepWith(2.5);

  // door colliders collapse when open
  check('door-collider-collapses-when-open', () => {
    const d = game.world.doors.find((dd) => !dd.locked && !dd.open);
    if (!d) return true;
    d.setOpen(true);
    const ok = d.collider.max.y === d.collider.min.y;
    d.setOpen(false);
    return ok && d.collider.max.y > d.collider.min.y;
  });

  // stairs are ground, not colliders
  check('stairs-report-ground-height', () => {
    const h = game.world.groundHeightAt(2, -6, 3);
    return h > 0.5 && h < 3.6;
  });

  // enemy stun then pop — camera aims +x so guide steering helps, not fights
  F.teleport('graveyard');
  F.stepWith(0.2);
  game.player.yaw = -Math.PI / 2;
  const e = game.enemies.spawn('walker', game.player.pos.x + 3, game.player.pos.z, 'chase');
  F.setSkull(game.player.pos.x + 1, 1.2, game.player.pos.z, 20, 0, 0, 'outbound');
  F.stepWith(0.5);
  check('skull-stuns-a-walker', () => e.state === 'stunned');
  F.stepWith(0.4);   // clear the post-hit immunity window before the second throw
  F.setSkull(game.player.pos.x + 1, 1.2, game.player.pos.z, 20, 0, 0, 'outbound');
  F.stepWith(0.5);
  check('stunned-walker-pops', () => !game.enemies.list.includes(e) && game.flags.has('firstPop'));
  F.stepWith(2.5);
  game.enemies.clear();
  game.dead = false; game.player.frozen = false;

  // every act teleports and reports itself
  for (const act of ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    F.teleport(act);
    F.stepWith(0.5);
    check('teleport-' + act, () => game.act === act);
  }

  // the finale closes
  check('finale-walls-close', () => {
    const h0 = game.finale.half;
    F.stepWith(10);
    return game.finale.active && game.finale.half < h0;
  });

  check('render-under-budget', () => game.lastRender.drawCalls > 0 && game.lastRender.drawCalls < 700);

  const failed = checks.filter((c) => !c.passed);
  document.body.dataset.autotestDetails = JSON.stringify(checks);
  document.body.dataset.autotestResult = failed.length ? 'fail' : 'pass';
  console.log('[autotest]', failed.length ? 'FAIL' : 'PASS', checks);
}

// ----------------------------------------------------------------- launch
const game = new Game();
window.__game = game;
if (TEST_MODE) {
  game._selfStep = false;
  game.run();
  if (Q.has('autotest')) runAutotest(game).catch((e) => {
    document.body.dataset.autotestDetails = JSON.stringify([{ name: 'suite-crashed', passed: false, error: String(e) }]);
    document.body.dataset.autotestResult = 'fail';
    console.error(e);
  });
} else {
  game.run();
}
