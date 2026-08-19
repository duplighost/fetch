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
import { buildAtmosphere } from './atmosphere.js';
import { LAYER_HELD, LAYER_DOUBLE, MASK_DOUBLE } from './mirrors.js';

const FIXED_DT = 1 / 120;
const Q = new URLSearchParams(location.search);
const TEST_MODE = Q.has('test') || Q.has('autotest');
const HITCH_LOG = Q.has('hitch');
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
// A first-draw batch costing more than this means the driver is doing work the
// link poll could not see coming. See _warmDrawTick.
const WARM_DRAW_SLOW_MS = 120;
const _impV = new THREE.Vector3();
const OCC_AXES = ['x', 'y', 'z'];   // slab-test order for the E-pick occlusion
const VERSION = '0.5.0-intruder';
const GORE_CAP = 64;

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
  clearKeys() {
    // Focus loss cancels intent, not merely held state. A mousedown / E / Space
    // edge can arrive between RAF and the next fixed step; preserving that edge
    // would manufacture a throw, interaction or jump after the player has left
    // the window. The only edge that survives is the physical release promised
    // by an already-held throw (including an already-queued release).
    const releaseThrow = this.throwHeld || this.pending.throwReleased;
    this.keys.clear();
    this.pending = {
      throwPressed: false,
      throwReleased: releaseThrow,
      callTap: false,
      interact: false,
      jump: false,
    };
    this.throwHeld = false;
    this.callHeld = false;
    this.callDownAt = 0;
    this.lookX = 0;
    this.lookY = 0;
  }
  suspendForPause({ releaseHeld = false } = {}) {
    // A pause is not a synthetic mouse-up. Keep the physical LMB state and any
    // release that already happened, but discard movement/look and one-shot
    // actions so Escape can never manufacture a delayed throw or interaction.
    // If LMB is released while the pause screen is open, the ordinary mouseup
    // handler records that promise and it lands on the first resumed step.
    // A deliberate menu pause can preserve a physically held button because
    // the global mouseup listener will still observe its release. Focus or
    // visibility loss cannot make that promise: the release may happen in
    // another window. Queue one safe release edge in that case so resuming can
    // never resurrect a phantom held throw or anchored rope.
    const releaseThrow = this.pending.throwReleased || (releaseHeld && this.throwHeld);
    this.keys.clear();
    this.pending = {
      throwPressed: false,
      throwReleased: releaseThrow,
      callTap: false,
      interact: false,
      jump: false,
    };
    this.callHeld = false;
    this.callDownAt = 0;
    if (releaseHeld) this.throwHeld = false;
    this.lookX = 0;
    this.lookY = 0;
  }
  resetAll() {
    // Restart-from-checkpoint owns a fresh control edge. Unlike focus loss,
    // there is no live throw promise to preserve: respawn explicitly puts the
    // skull in the hands and aborts any rope swing.
    this.keys.clear();
    this.pending = {
      throwPressed: false,
      throwReleased: false,
      callTap: false,
      interact: false,
      jump: false,
    };
    this.throwHeld = false;
    this.callHeld = false;
    this.callDownAt = 0;
    this.lookX = 0;
    this.lookY = 0;
  }
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
    this.paused = false;
    this.pauseReason = null;
    this._pauseChangedAt = -Infinity;
    this._pausedAnimations = [];
    this.time = 0;
    this.hitStop = 0;
    this._shake = 0;
    this.baseTension = 0;
    this.fx = { fear: 0 };
    this.fogTarget = 0.028;
    this.snapBuffer = 0;
    this.lastCheckpoint = 'bedroom';
    this.checkpointPose = null;
    this._basementExit = null;
    this.endingTail = false;
    this.terminal = false;
    this._entering = false;          // title pressed, warm gate still running
    this._lockPending = false;       // a pointer-lock request is in flight
    this._lockEverHeld = false;
    this.longFrames = [];            // ?hitch=1 — every frame over 150 ms
    this.goreGeo = new THREE.IcosahedronGeometry(0.08, 0);
    this.goreMat = new THREE.MeshStandardMaterial({ color: 0x3a3236, roughness: 0.75 });   // must read in the dark

    this._setupRenderer();
    this._setupScene();
    this._buildGorePool();

    this.audio = new GameAudio();
    // ?mute=1: audio never initializes (every call no-ops pre-init) — the
    // headless gate wedges inside native WebAudio under arena load; the sim
    // doesn't need ears, and real browsers keep the full soundscape.
    if (Q.has('mute')) this.audio.init = () => {};
    this.world = new World(this.scene, this.mats);
    this.player = new Player(this.camera, this.world, this.audio);
    this.enemies = new Enemies(this);
    this.director = new Director(this);

    const houseRenderStart = this.scene.children.length;
    buildHouse(this);
    // The house is one authored district even though its room kit produces
    // many independent top-level roots. Keep the ownership boundary so the
    // forest can retire that finished chapter when the player crosses the
    // graveyard gate, including when they immediately look back.
    this.houseRenderRoots = this.scene.children.slice(houseRenderStart);
    this.houseInteriorRoots = this._findHouseInteriorRoots();
    buildOutside(this);
    this.atmosphere = buildAtmosphere(this);
    this.finale = new Finale(this);
    this.world.finishStatic();
    this.world.buildGroundContact(this.scene);
    this.world.buildLights(this.scene);
    this.world.attachCandlePool(this.scene);

    this.skull = new Skull({ scene: this.scene, camera: this.camera, audio: this.audio, world: this.world, mats: this.mats, variant: Q.get('skull') });
    this.skull.setLayers((o) => o.layers.set(LAYER_HELD));
    // the skull is the light you carry — throw it and the light leaves with it
    // Reaches further than it used to, because the world around it finally got
    // dark. The fix for "I can't see" out here is to make the thing in your
    // hands matter more, never to put the free light back — the free light was
    // what made throwing it cost nothing.
    this.skullLight = new THREE.PointLight(0xb6cfdd, 58, 11.5, 1.6);
    // the lantern lights the WORLD only: at point-blank range it was clipping
    // the whole viewmodel to white (the hands and skull never showed a single
    // form in hand). The viewmodel gets its own calibrated lamp instead.
    this.skullLight.layers.set(0);
    // NOT a shadow caster, and the reason is measured, not assumed. The premise
    // says the light you carry should throw shadows — but a PointLight shadow is
    // six cube faces against everything already flagged castShadow (world.box
    // flags every box it makes), and turning it on took the forest from 126 draw
    // calls to 821, straight through the 700 gate. The cheap version is a
    // one-face SpotLight shadow riding the skull, or a small proxy caster set;
    // until one of those exists this stays off. Measure before re-enabling:
    //   node tools/shot-areas.mjs  -> drawCalls per act.
    this.skull.root.add(this.skullLight);
    this.fillLight = new THREE.PointLight(0x28323c, 8, 3.5, 1.4);
    this.camera.add(this.fillLight);
    // Keep the viewmodel lamp well behind the object instead of centimetres
    // from its fingers. Inverse-square falloff at the old position bleached
    // every phalanx bone-white and flattened the skull's relief. This broader,
    // offset key preserves warm living skin, dark creases, and readable bone.
    // Distance 2.0 / decay 2.0 put the whole falloff curve inside the length of
    // a hand: knuckles clipped while the wrist fell into black. A longer reach
    // and a gentler exponent light the cradle as one object.
    this.holdLight = new THREE.PointLight(0xd8bb90, 2.0, 2.9, 1.8);
    this.holdLight.position.set(0.16, 0.18, -0.18);
    this.holdLight.layers.set(LAYER_HELD);
    this.camera.add(this.holdLight);
    // A very soft opposing fill keeps the far cheek and finger joints from
    // collapsing into one silhouette without making the skull feel evenly
    // studio-lit. Value contrast still does the work; the cool tint is mood,
    // never gameplay information.
    this.holdFillLight = new THREE.PointLight(0x7890a0, 0.38, 2.2, 2.0);
    this.holdFillLight.position.set(-0.3, -0.04, -0.08);
    this.holdFillLight.layers.set(LAYER_HELD);
    this.camera.add(this.holdFillLight);
    // A back rim behind the cradle. Front-lit hands against a black forest are
    // two flat orange shapes; one cool light from behind gives the knuckles and
    // the cranium an edge, so the silhouette survives when the fill goes away.
    // It EARNS its intensity in the dark acts (see _updateViewmodelLight) —
    // brightness and edge only, never colour carrying meaning.
    this.holdRimLight = new THREE.PointLight(0x8ea6c2, 0.5, 2.6, 1.7);
    this.holdRimLight.position.set(-0.34, 0.36, -1.06);
    this.holdRimLight.layers.set(LAYER_HELD);
    this.camera.add(this.holdRimLight);
    // Base values the act scaling multiplies. Kept here so the calibration is
    // one table rather than three magic numbers scattered through the loop.
    this._vmKey = { key: 2.0, fill: 0.38, rim: 0.5, lit: 1 };

    this.input = new InputState();
    this._wireInput();
    this._wireOverlays();
    this.player.onStep = (surf) => this.director.onPlayerStep(surf);

    const spawn = this.director.getSpawn('bedroom');
    this.player.pos.set(spawn.x, 3.6, spawn.z);
    this.player.yaw = spawn.yaw;
    this.player._sync(0);
    this.checkpoint('bedroom');
    this._buildImpactFx();
    // One loaner covers the Drowned Choir, the only creature that carries its
    // own lamp. Reserved BEFORE the census is pinned so it is counted with
    // everything else and never has to be created mid-run.
    this.world.reserveLoanLights(1);
    // The thing in the glass wears a CLONE of the skull, lamps and all, and it
    // used to be cloned at the door of the finale — two point lights joining
    // the mirror pass's light census in the last act of the game. Every lit
    // material reflected in that room then needed a fresh program at 31 lights
    // instead of 29, and the driver charged 9.5 seconds for it, once, at the
    // climax. Mounting it here puts those two lights in the pinned census with
    // everything else. They sit on LAYER_DOUBLE, so only the mirror cameras
    // ever see them: the world pass census does not move at all.
    this.finale.mountReflectionSkull();
    // Pin the shader light census before anything renders. Everything that
    // owns a light is built by now: house, outside, underfalls, atmosphere,
    // the finale's dresser and lamp, and the skull's own ember. The carriers
    // are the three things that MOVE a light, and district culling never
    // touches them.
    // The reflection is a carrier too: its lamps must ride the double's head,
    // not be lifted into the static pin root like a candle on a shelf.
    this.world.pinLightCensus(this.scene, [this.camera, this.skull.root, this.finale.figure]);
    this.world.freezeMoonShadow(this.renderer, this.scene, this.camera);

    // THE NEW OPENING: a fresh run wakes empty-handed — the skull arrives
    // later by shattering the bedroom window (bedroomAct owns that script;
    // Skull.bootAbsent is the census-safe absence). Gated on the act truth so
    // any future path that boots already past the arrival keeps its hands
    // full. Must run AFTER pinLightCensus: the pin counts the skull's lights
    // with skull.root as a carrier first, THEN bootAbsent parks them.
    if (this.act === 'bedroom' && !this.flags.has('skullArrived')) this.skull.bootAbsent();

    this._buildGrain();
    this._exposeDebug();
    this._scheduleShaderWarmup();
    this._scheduleWarmDraw();
  }

  // Which of the house's render roots can the graveyard actually SEE?
  //
  // Standing mid-yard and looking south submitted 1203 draw calls against a
  // 450 ceiling and not one of them was the graveyard: walls occlude nothing
  // in three.js, so the far plane held the entire furnished house and the
  // frustum took the lot. What SHOULD survive is the building's silhouette —
  // the player is meant to see the house standing behind them, and the arrival
  // reads against that shape — but the silhouette is not in here at all: the
  // exterior walls are world.box geometry, merged into the static shell by
  // finishStatic(). These roots are the furniture, the fixtures and the
  // mechanisms, plus the handful of pieces that stand proud of the roofline.
  //
  // tools/shot-cull-audit.mjs measured all 453 of them the only honest way —
  // hide one, render, pixel-diff, restore — at five graveyard poses plus two
  // deliberate look-backs at the house. Exactly eleven changed a pixel by more
  // than 3/765, and every one of them reaches above the eaves on the
  // graveyard-facing side. So that is the rule, with margin, rather than a
  // list of 420 array indices that would rot the first time someone adds a
  // chair: a root that stays below y 5.5 or behind z 5.5 is interior.
  //
  // Roots with no geometry at all (the three house PointLights) never qualify:
  // the visible light count keys every shader program in the game and hiding
  // one mid-play is the round-five freeze born again.
  _findHouseInteriorRoots() {
    const EAVES_Y = 5.5, YARD_FACE_Z = 5.5;
    const box = new THREE.Box3();
    // The basement's dropcloths hide one real walker, spawned during the house
    // build, so an enemy mesh is sitting in this array. Nothing that can move,
    // chase or be fought belongs in a static culling ledger at any price.
    const enemyMeshes = new Set((this.enemies?.list || []).map((e) => e.mesh));
    return this.houseRenderRoots.filter((root) => {
      if (root.isLight || enemyMeshes.has(root)) return false;
      root.updateWorldMatrix(true, true);
      box.makeEmpty();
      box.expandByObject(root);
      if (box.isEmpty() || !Number.isFinite(box.max.y) || !Number.isFinite(box.max.z)) return false;
      return !(box.max.y >= EAVES_Y && box.max.z >= YARD_FACE_Z);
    });
  }

  // ---------------------------------------------------------------- setup
  _setupRenderer() {
    // test mode keeps the backbuffer for deterministic canvas capture; shipping
    // players don't pay for the copy
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: TEST_MODE });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setSize(innerWidth, innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.tabIndex = -1;
    r.domElement.setAttribute('aria-label', 'FETCH game view');
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
    // Floors sit a clear step under the masonry standing on them.
    tint('stoneFloor', 0x5c5c56);
    tint('woodFloor', 0x7a7268);
    // A ceiling was the BRIGHTEST plane in most interior frames — brighter than
    // the walls, brighter than the floor, in rooms whose only light is a lamp
    // standing on a dresser. Lamplight falls on what is under it. Dropping the
    // albedo below the wallpaper's puts the value order back without taking a
    // single lumen out of the room ("the house feels empty" was never this).
    tint('ceiling', 0x5e5e5a);
    tint('bone', 0xcfc9bb);
    tint('rock', 0x48545c);
    tint('headstone', 0x7b898f);
    // The grade stopped at the front door. dirt, grass and bark own most of
    // every frame after the house, and ungraded they came out BRIGHTER than the
    // light the player is carrying — the forest floor outshone the skull's own
    // pool and the trunks were the brightest objects on screen. A carried light
    // needs something dark to carve.
    // #3d4a3c was green on top of a green painter, and multiplying two green
    // biases is how the yard's floor ended up carrying twice as much read in
    // hue as in value. #474845 is the same LUMINANCE (0.064 linear, measured)
    // with the bias taken out — the grade keeps every bit of its darkening job
    // and stops doing a colouring one. tools/probe-albedo.mjs prints the
    // product; it is the only honest way to judge either of these numbers.
    tint('grass', 0x474845);
    tint('dirt', 0x4a4239);
    tint('bark', 0x4e4a42);
  }

  _buildGrain() {
    this.grainScene = new THREE.Scene();
    this.grainCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.grainMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uFear: { value: 0 },
        uResolution: { value: new THREE.Vector2(1280, 720) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uFear;
        uniform vec2 uResolution;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          // Grain is sampled at the ACTUAL resolution, not a fixed 1280x720.
          // Pinning the scale was meant to keep it perceptible at 1440p; what
          // it actually did was make one grain cell cover four screen pixels
          // there and read as screen-door, and half a pixel at 720p and read
          // as nothing.
          float g = hash(vUv*uResolution + fract(uTime)*173.1) - 0.5;
          vec2 c = vUv - 0.5;
          // A vignette that only reaches 16% in the extreme corners is a
          // vignette nobody sees. Start it earlier and let it close harder:
          // the corners of a frame in a game about carrying the only light
          // should be somewhere the light has not got to. 0.18 -> 0.14 takes
          // the reference image's corners, which die well before its edges do.
          float vig = smoothstep(0.14, 0.98, dot(c,c)*(2.2 + uFear*2.0));
          float a = abs(g)*0.075 + vig*(0.30 + uFear*0.40);
          vec3 tint = vec3(0.007,0.006,0.01);
          // ORDERED-ISH DITHER, and the reason is that this game is 70-80%
          // near-black. ACES into an 8-bit swapchain quantises the fog
          // gradients into visible rings — the one artefact that makes a dark
          // frame look cheap — and a sub-LSB of noise before output breaks
          // them up for free. Invisible to every measured mean in the suite;
          // MARROW ships exactly this.
          float d = (hash(vUv*uResolution + 7.13) - 0.5) / 255.0;
          gl_FragColor = vec4(tint + d, clamp(a + d, 0., 0.88));
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.grainMat);
    quad.position.z = -0.5;
    this.grainScene.add(quad);
  }

  _buildGorePool() {
    // Cosmetic fragments are a bounded effect, never a reason for combat to
    // allocate meshes/vectors or splice arrays on the impact frame. Active
    // slots stay packed at the front so one InstancedMesh draws the whole burst.
    this.gorePool = Array.from({ length: GORE_CAP }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      scale: 1,
      t: 0,
    }));
    this.goreMesh = new THREE.InstancedMesh(this.goreGeo, this.goreMat, GORE_CAP);
    this.goreMesh.name = 'bounded impact fragment pool';
    this.goreMesh.userData.fetchGorePool = true;
    this.goreMesh.count = 0;
    this.goreMesh.visible = false;
    this.goreMesh.frustumCulled = false;
    this.goreMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.goreMesh);
    this._goreActive = 0;
    this._goreEmitted = 0;
    this._goreDropped = 0;
    this._goreMatrix = new THREE.Matrix4();
    this._goreQuaternion = new THREE.Quaternion();
    this._goreScale = new THREE.Vector3();
  }

  // THE WARM PASS IS SYNCHRONOUS ON PURPOSE. compileAsync() links exactly the
  // same programs and then polls every material's isReady() every 10 ms until
  // the driver reports done — and on ANGLE/D3D11 that poll does not return
  // early. Measured side by side on this machine, same coverage both ways:
  //
  //   compileAsync : worst frame 10052 ms, texture pass 10289 ms, entry 11.4 s
  //   compile      : worst frame   599 ms, texture pass   215 ms, entry 0.7 s
  //
  // So the "async" warm path was itself a ten-second freeze. It only ever hit
  // players patient enough to let it run — Alex's fast clicks cancelled it, and
  // he got the mid-play freezes instead. Neither is the deal. Hand the programs
  // to the driver and let it finish them on its own threads while he plays.
  _compileWarmVariant(scene, camera) {
    this.renderer.compile(scene, camera);
    return null;
  }

  _scheduleShaderWarmup() {
    const state = this.shaderWarmup = {
      status: 'scheduled',
      mode: 'sync',                  // see _compileWarmVariant for why, in numbers
      variants: ['ordinary', 'hidden-threat', 'cave-lights', 'cave-threat', 'grain'],
      errors: [],
    };
    // Deterministic suites exercise startup hundreds of times and do not need
    // driver precompilation. The focused regression opts in with ?warmup=1.
    if (TEST_MODE && !Q.has('warmup')) {
      state.status = 'skipped';
      state.reason = 'test-mode';
      return;
    }
    const run = () => {
      this._shaderWarmupCancel = null;
      if (this.terminal) {
        state.status = 'skipped';
        state.reason = 'terminal';
        return;
      }
      this._beginShaderWarmup(state);
    };
    // 400 ms, not 1200. The old idle timeout was longer than the gap between
    // the page becoming interactive and a player who is already clicking, so
    // the warmup lost the race on exactly the machines that needed it. Starting
    // it sooner means most sessions never see the start gate at all.
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(run, { timeout: 400 });
      this._shaderWarmupCancel = () => {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
      };
    } else {
      const handle = setTimeout(run, 250);
      this._shaderWarmupCancel = () => clearTimeout(handle);
    }
  }

  // Pull the scheduled pass forward instead of cancelling it. THE ROUND-FIVE
  // BUG: startGame() used to call a _cancelScheduledShaderWarmup() that marked
  // the state 'skipped / game-started' — so a player who clicks faster than the
  // idle callback paid for all ~230 programs mid-play, act by act, at first
  // sight. Measured on the spam-click path: 2149 ms in the bedroom, 816 house,
  // 716 basement, 566 forest, 1350 cave, 2399 entering the mirror room. That is
  // Alex's "many many areas of the game freeze for a few seconds", and he is
  // the fast clicker this cost was written for.
  _forceShaderWarmupNow() {
    if (this._shaderWarmupCancel) {
      this._shaderWarmupCancel();
      this._shaderWarmupCancel = null;
    }
    if (this.shaderWarmup.status === 'scheduled') this._beginShaderWarmup(this.shaderWarmup);
  }

  _beginShaderWarmup(state) {
    // With the light census pinned (World.pinLightCensus) there is exactly ONE
    // shader program set for the whole game, so this no longer has to guess at
    // representative light counts by assembling a synthetic scene of cloned
    // lights -- it compiles the real, assembled world once.
    //
    // renderer.compile() walks materials with scene.traverse(), which ignores
    // visibility, so a single pass over the live scene covers the house, the
    // basement, the graveyard, the forest, the clearing and all of Underfalls
    // without moving the player, changing act state, or touching the director.
    // The old curated-scene approach compiled the wrong light-count keys and
    // covered 122 of the ~230 programs the game actually uses; the rest were
    // paid for mid-play, which is what Alex felt as the freezes.
    //
    // The only meshes traverse() cannot see are the figures built on demand.
    // They are spawned into the real scene for the duration of the synchronous
    // pass and removed immediately afterwards, exactly as before.
    state.status = 'pending';
    state.startedAt = performance.now();
    // TWO clocks, because the driver has two. `created` is the synchronous
    // pass: every program the game will use is built and handed to the driver
    // (~1.5 s here). `done` is KHR_parallel_shader_compile reporting all of
    // them finished on its own background threads (~12 s here, and it is
    // BACKGROUND work — the main thread is free the whole time).
    //
    // The start gate waits for `created`, not `done`. Waiting for `done` is
    // what a 9-second title hold looks like, and it buys nothing: the freezes
    // were never the driver compiling, they were the game not having ASKED it
    // to. Once asked, it keeps working through the fade-in and the first
    // minutes of the bedroom, which is exactly the time it needs.
    this._shaderWarmupCreated = new Promise((resolve) => { this._resolveShaderCreated = resolve; });
    this._shaderWarmupDone = new Promise((resolve) => { this._resolveShaderWarmup = resolve; });
    const jobs = [];
    state.timings = {};
    const compile = (scene, camera, label) => {
      const t0 = performance.now();
      try {
        const job = this._compileWarmVariant(scene, camera);
        if (job && typeof job.then === 'function') {
          jobs.push(Promise.resolve(job).catch((error) => {
            state.errors.push(`${label}: ${error?.message || error}`);
          }));
        }
      } catch (error) {
        state.errors.push(`${label}: ${error?.message || error}`);
      }
      state.timings[label] = +(performance.now() - t0).toFixed(0);
    };

    const warmEntities = [];
    const spawnSerial = this.enemies._spawnSerial;
    const previousChoir = this.enemies.choir;
    const hadSpawnLog = Object.prototype.hasOwnProperty.call(this, 'spawnLog');
    const spawnLogLength = this.spawnLog?.length || 0;
    // The absent skull (the new opening) is the other mesh set traverse()
    // cannot see: bootAbsent() removed its root from every graph while its
    // lights stayed behind in the pinned census. Without this, the skull's
    // materials meet the held-pass light set for the first time on the catch
    // frame of the arrival — one program link landing on the act's biggest
    // beat. Stand the root in the scene for the compile (it carries no lights
    // while absent, so the census cannot move) and take it out again after.
    const skullStandIn = !this.skull.root.parent;
    if (skullStandIn) this.scene.add(this.skull.root);
    try {
      // Ordinary figures and the Drowned Choir are built on demand, so nothing
      // already in the boot scene carries their exact Lambert/custom programs.
      // Make one bounded set, compile with it present, then remove every
      // gameplay trace and retain only its materials.
      for (const kind of ['walker', 'resident', 'kneeler']) {
        warmEntities.push(this.enemies.spawn(
          kind, this.player.pos.x, this.player.pos.z, 'dormant', this.player.pos.y + 1,
        ));
      }
      if (!previousChoir) {
        warmEntities.push(this.enemies.beginDrownedChoir({
          pos: this.underfalls?.layout?.entrance || this.player.pos,
          heardPos: this.player.pos,
        }));
      }
    } catch (error) {
      state.errors.push(`threat-setup: ${error?.message || error}`);
    }

    const restingMask = this.camera.layers.mask;
    // TEXTURES FIRST, and while the stand-ins are still parented — their maps
    // are otherwise unreachable from the scene graph. Order matters more than
    // it looks: run after the compile instead and every upload queues behind
    // the driver's background shader work, which stretched a 200 ms pass to
    // 9954 ms on this machine. compile() links programs and uploads nothing,
    // so a texture that was never uploaded is a first-draw hitch of its own.
    this._warmTexturesNow();
    try {
      // COMPILE WITH THE MASK THE PASS ACTUALLY RENDERS WITH. three gathers the
      // light list through `light.layers.test(camera.layers)`, and the light
      // COUNT is the first thing in every program's cache key. render() drops
      // the camera to layer 0 for the world pass and to LAYER_HELD for the held
      // pass, restoring the resting mask (world + held) afterwards — so warming
      // with the camera at rest compiled every lit material for a 32-point-light
      // world that no frame ever draws. The real 29-light programs were then
      // linked one district at a time, at first sight, at ~600 ms each: house
      // 653, basement 628, forest 299, cave 649, mirror 658. The entire warm
      // pass was being spent on keys the game cannot use.
      this.camera.layers.set(0);
      compile(this.scene, this.camera, 'world');

      // The held layer is a second camera pass with its own light set (the
      // viewmodel lamps live on LAYER_HELD), so it owns a distinct program key.
      this.camera.layers.set(LAYER_HELD);
      compile(this.scene, this.camera, 'held');
      this.camera.layers.mask = restingMask;

      // The mirror room renders the scene into a linear-space render target,
      // and the colour space is part of the program key -- so every material
      // reflected in the finale needs a second program. Compiling against the
      // real target here is what keeps the last act from stalling.
      // Both mirror pools build identical UnsignedByteType targets, so warming
      // against either one produces the linear-space key the other needs.
      // The mirror cameras render at MASK_DOUBLE (world + the skull-headed
      // double), which is a third light census — same reason as above.
      const reflectionTarget = this.finale?.mirrors?.pool?.[0] || null;
      if (reflectionTarget) {
        const previousTarget = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(reflectionTarget);
        this.camera.layers.mask = MASK_DOUBLE;
        // compile() gathers its light list with traverseVisible, and the
        // double stands hidden until its act — so warming through a hidden
        // reflection compiled the mirror pass at the WRONG light count and
        // every reflected material relinked at the climax anyway. Stand it up
        // for the compile exactly as the enemy stand-ins do; nothing renders
        // during a compile, so it is never on screen.
        const figure = this.finale.figure;
        const figureWasVisible = figure ? figure.visible : null;
        if (figure) figure.visible = true;
        compile(this.scene, this.camera, 'reflection');
        if (figure) figure.visible = figureWasVisible;
        this.camera.layers.mask = restingMask;
        this.renderer.setRenderTarget(previousTarget);
      }

      compile(this.grainScene, this.grainCam, 'grain');
    } catch (error) {
      state.errors.push(`setup: ${error?.message || error}`);
    } finally {
      // The camera is the live one, not a clone: its mask goes back even if a
      // compile threw, or the next rendered frame draws the wrong layer set.
      this.camera.layers.mask = restingMask;
      // Remove the stand-ins the instant the synchronous compile is done. The
      // driver's remaining link work needs no scene objects.
      if (skullStandIn && this.skull.root.parent === this.scene) {
        this.scene.remove(this.skull.root);
      }
      for (const entity of warmEntities) {
        const index = this.enemies.list.indexOf(entity);
        if (index >= 0) this.enemies.list.splice(index, 1);
        entity.loop?.stop?.();
        entity.loop = null;
        // Hand a borrowed lamp back BEFORE the body goes (the enemies.js
        // removal law). Removing the Choir stand-in with the loaner still
        // parented to it carried the light out of the scene: the census moved
        // on the one path built to keep it still — every warmup-compiled
        // program keyed on the wrong light count — and the loaner was never
        // reclaimable, so the real Choir arrived lampless.
        if (entity.mesh.userData?.light) this.world.returnLight?.(entity.mesh.userData.light);
        entity.mesh.removeFromParent();
      }
      this.enemies.choir = previousChoir || null;
      this.enemies._spawnSerial = spawnSerial;
      if (hadSpawnLog) this.spawnLog.length = spawnLogLength;
      else delete this.spawnLog;
    }

    state.createdMs = performance.now() - state.startedAt;
    state.status = 'created';
    this._resolveShaderCreated?.();
    this._resolveShaderCreated = null;

    const finish = () => {
      const retainedMaterials = warmEntities.flatMap((entity) =>
        entity.kind === 'choir'
          ? (entity.mesh.userData.ownedMaterials || [])
          : (entity.mesh.userData.mat ? [entity.mesh.userData.mat] : []));
      if (this.terminal) {
        for (const material of retainedMaterials) material.dispose();
      } else {
        this._shaderWarmMaterials = retainedMaterials;
      }
      state.status = state.errors.length ? 'degraded' : 'ready';
      state.completedAt = performance.now();
      state.durationMs = state.completedAt - state.startedAt;
      this._resolveShaderWarmup?.();
      this._resolveShaderWarmup = null;
    };
    if (jobs.length) Promise.all(jobs).then(finish);
    else finish();
  }

  // ------------------------------------------------------- texture warm-up
  // renderer.compile() links programs. It does NOT upload textures: every
  // texture in this game is a canvas painted at boot, and each one goes to the
  // GPU on the frame it is first drawn. That is a second hitch class, invisible
  // to the program census, and it lands in the same places (a district's first
  // frame). initTexture() does the upload on demand, so the title screen can
  // pay for it a few at a time while the player is still reading.
  _gatherWarmTextures() {
    const set = this._warmTextureSet || (this._warmTextureSet = new Set());
    const MAPS = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap',
      'emissiveMap', 'bumpMap', 'displacementMap', 'lightMap', 'specularMap',
      'envMap', 'matcap', 'gradientMap', 'clearcoatMap', 'clearcoatNormalMap',
    ];
    const take = (material) => {
      if (!material) return;
      for (const key of MAPS) {
        const texture = material[key];
        if (texture && texture.isTexture && !texture.isRenderTargetTexture) set.add(texture);
      }
    };
    const walk = (root) => {
      root?.traverse?.((object) => {
        const material = object.material;
        if (Array.isArray(material)) for (const m of material) take(m);
        else take(material);
      });
    };
    walk(this.scene);
    walk(this.grainScene);
    walk(this.skull.root);
    for (const material of Object.values(this.mats || {})) take(material);
    return set;
  }

  _warmTexturesNow() {
    const queue = [...this._gatherWarmTextures()];
    const state = this.textureWarmup = {
      status: 'pending', total: queue.length, uploaded: 0, errors: 0,
      startedAt: performance.now(),
    };
    for (const texture of queue) {
      try { this.renderer.initTexture(texture); state.uploaded++; } catch { state.errors++; }
    }
    state.status = state.errors ? 'degraded' : 'ready';
    state.durationMs = performance.now() - state.startedAt;
    this._textureWarmupDone = Promise.resolve();
    return state;
  }

  // The gate itself: every program asked for, every texture uploaded. What it
  // deliberately does NOT wait for is the driver finishing in the background.
  async _warmGate() {
    // LET THE ACKNOWLEDGMENT PAINT FIRST. The warm pass is synchronous, so
    // starting it in the click's own task means the pressed state is set on an
    // element the browser never gets to draw — the player presses and the tab
    // simply stops for a second and a half, which is the thing this whole
    // section exists to stop. Two frames: one to commit the class, one to be
    // sure it reached the screen.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    this._forceShaderWarmupNow();
    if (this._shaderWarmupCreated) await this._shaderWarmupCreated;
    if (!this.textureWarmup) this._warmTexturesNow();
  }

  _warmGateSettled() {
    const shader = this.shaderWarmup?.status;
    if (shader === 'skipped') return true;             // test mode: nothing was warmed
    if (shader !== 'created' && shader !== 'ready' && shader !== 'degraded') return false;
    const texture = this.textureWarmup?.status;
    return texture === 'ready' || texture === 'degraded' || texture === 'skipped';
  }

  // ------------------------------------------------- first-draw warm-up
  // THE OTHER HALF OF THE FREEZE, and the older half. compile() links a program
  // and initTexture() uploads pixels — but ANGLE/D3D11 does the rest of its work
  // (input layout, driver-side specialization, whatever is left of the link)
  // when a program is first USED in a draw. The game only ever does that in a
  // district's first frame, forty or more of them in one gulp, and that is the
  // seven-to-nine second stall Alex has reported since round six: "loading new
  // areas just about always freezes it."
  //
  // Measured on this machine, cold profile (tools/probe-hitch.mjs, then
  // tools/probe-warm-draw.mjs with this pass in front of the tour):
  //   entering the basement   9017 ms  ->   76 ms
  //   house 37, graveyard 28, forest 26, clearing 28, cave 35, mirror 138.
  // BOTH SIDES REPORT +0 PROGRAMS. Nothing here is a compile, and the 191
  // geometries the stalling frame uploads are not it either — the same run puts
  // 162 geometries into the forest in 48 ms. It was never the geometry.
  //
  // THE TWO TRAPS THIS KIND OF PASS DIES ON, AND WHAT IT DOES INSTEAD:
  //  * `visible` IS NEVER TOUCHED. Revealing an object reveals the lights under
  //    it, the light census moves, and every lit material in the game needs a
  //    new program — the exact disease this exists to cure. Anything hidden,
  //    culled to layers.mask 0, or held at instance count 0 is drawn as a PROXY
  //    that shares its geometry and material and owns no children at all.
  //  * IT DRAWS INTO THE DEFAULT FRAMEBUFFER, never a render target. A target's
  //    colour space is part of the program key, so a target-warmed program is
  //    the wrong variant — it is why the mirror pass needs its own set. One
  //    pixel behind a scissor, over-painted by the frame that follows it.
  _scheduleWarmDraw() {
    const state = this.warmDraw = {
      status: 'scheduled', total: 0, drawn: 0, proxies: 0, skipped: 0,
      spentMs: 0, worstMs: 0, frames: 0, errors: [],
    };
    // Same rule as the shader warmup: the deterministic suites start hundreds of
    // times and must not pay for driver warmth they never use. ?warmup=1 opts in.
    if (TEST_MODE && !Q.has('warmup')) { state.status = 'skipped'; state.reason = 'test-mode'; }
  }

  // One draw per (material x geometry layout x object kind). That tuple is what
  // decides a program AND its vertex input layout, so the game's 2184 meshes
  // collapse to ~532 draws. Route order on top: the freeze lands on the first
  // district past the house, so warm what he walks into next, next.
  _warmDrawList() {
    const seen = new Set();
    const pushed = new Set();
    const work = [];
    // The skull is the one thing that is NOT in the scene at boot: the opening
    // wakes you empty-handed and bootAbsent() takes its root out of every graph
    // until the window breaks. Without it here, the game's most important
    // object meets the driver for the first time on the frame it arrives.
    const roots = [this.scene, this.skull?.root].filter((r) => r && (r === this.scene || !r.parent));
    const collect = (object) => {
      if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        const layout = Object.keys(object.geometry?.attributes || {}).sort().join(',');
        const kind = `${object.isInstancedMesh ? 'i' : ''}${object.isSkinnedMesh ? 's' : ''}`
          + `${object.isPoints ? 'p' : ''}${object.isLine ? 'l' : ''}${object.isSprite ? 'S' : ''}`
          + `${object.geometry?.index ? 'x' : ''}`;
        const key = `${material.uuid}|${layout}|${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // ONE ENTRY PER OBJECT, even when it carries several materials: three
        // draws a multi-material mesh once per group, so a single draw warms
        // all of them. Listing it twice was also a real bug — two entries in
        // one batch made the second capture the frustumCulled the first had
        // already set false, and restore it false forever.
        if (!pushed.has(object)) { pushed.add(object); work.push(object); }
      }
    };
    for (const root of roots) root.traverse(collect);
    const ROUTE = ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];
    const rank = (object) => {
      const e = object.matrixWorld.elements;
      const zone = this.world.zoneAt?.({ x: e[12], y: e[13], z: e[14] });
      const index = ROUTE.indexOf(zone);
      return index < 0 ? ROUTE.length : index;
    };
    return work
      .map((object, i) => [rank(object), i, object])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map((entry) => entry[2]);
  }

  // Drawable RIGHT NOW through a layer-0 camera? If not, it needs a proxy —
  // and the reason it is not drawable is never something this pass may change.
  _warmDrawable(object) {
    if (!(object.layers.mask & 1)) return false;
    if (object.isInstancedMesh && object.count === 0) return false;
    let root = object;
    for (let p = object; p; p = p.parent) { if (!p.visible) return false; root = p; }
    // ...and it has to be IN the scene. The list deliberately includes the
    // detached skull root, whose children would otherwise be called drawable,
    // counted as drawn, and never rendered at all. Those want the proxy path.
    if (root !== this.scene) return false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.every((m) => !m || m.visible !== false);
  }

  _warmDrawProxy(object) {
    let proxy;
    if (object.isInstancedMesh) {
      // ONE instance is all a warm draw needs, and asking for one is also all
      // it allocates — the constructor sizes a Float32Array(count * 16) that
      // the next line throws away for the shared buffer.
      proxy = new THREE.InstancedMesh(object.geometry, object.material, 1);
      proxy.instanceMatrix = object.instanceMatrix;      // shared, never written
      if (object.instanceColor) proxy.instanceColor = object.instanceColor;
      proxy.count = 1;
    } else if (object.isSkinnedMesh) return null;        // needs its skeleton; it is on screen every frame anyway
    else if (object.isPoints) proxy = new THREE.Points(object.geometry, object.material);
    else if (object.isLineSegments) proxy = new THREE.LineSegments(object.geometry, object.material);
    else if (object.isLine) proxy = new THREE.Line(object.geometry, object.material);
    else if (object.isSprite) proxy = new THREE.Sprite(object.material);
    else proxy = new THREE.Mesh(object.geometry, object.material);
    proxy.frustumCulled = false;
    proxy.layers.mask = 1;
    // It draws at the staging group's origin, not where the original stands,
    // and that is fine — frustumCulled is off, so where it sits changes
    // nothing about which program gets specialized. (An earlier version copied
    // matrixWorld here and it was dead code: the staging group updates its
    // children's world matrices from their identity local matrix every frame.)
    return proxy;
  }

  // Pointed at empty sky with a one-degree, two-metre frustum: the live scene
  // culls itself away and only what this pass deliberately un-culls is drawn.
  _warmDrawCamera() {
    if (this._warmCamera) return this._warmCamera;
    const camera = new THREE.PerspectiveCamera(1, 1, 0.1, 2);
    camera.position.set(0, 4000, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 5000, 0);
    camera.layers.set(0);                                // the world pass's mask
    camera.updateMatrixWorld(true);
    return (this._warmCamera = camera);
  }

  // NEVER DRAW WHILE THE DRIVER IS STILL LINKING. compile() hands ~261 programs
  // to ANGLE and they finish on its own threads 10.1 SECONDS later (measured:
  // tools/probe-link-poll.mjs). A draw issued into that queue does not wait for
  // its own program — it waits for the queue: the first warm draw, issued the
  // instant the compile returned, cost 6867 ms in one frame. Which is the old
  // freeze wearing a new hat.
  //
  // KHR_parallel_shader_compile is the one question you can ask about link state
  // without waiting for the answer to be yes. Asking about all 261 costs ~21 ms,
  // too much for a frame — so this walks the list a few at a time and stops at
  // the first unfinished one, because a linked program never un-links and the
  // scan only ever has to catch up. ~1-24 checks a frame, and it converges the
  // moment the driver does.
  _warmLinksSettled(budget = 24) {
    const state = this._warmLinks || (this._warmLinks = { status: 'polling', cursor: 0, pollMs: 0, startedAt: performance.now() });
    if (state.status !== 'polling') return state.status === 'settled';
    if (state.ext === undefined) {
      state.ext = this.renderer.getContext().getExtension('KHR_parallel_shader_compile') || null;
      // No extension means the driver linked synchronously inside compile():
      // there is no queue to wait for and nothing to ask about.
      if (!state.ext) { state.status = 'settled'; state.reason = 'no-khr'; return true; }
    }
    const programs = this.renderer.info.programs;
    if (state.total !== programs.length) { state.list = programs.slice(); state.total = programs.length; state.cursor = 0; }
    const gl = this.renderer.getContext();
    const t0 = performance.now();
    let checks = 0;
    while (state.cursor < state.list.length && checks++ < budget) {
      let done = true;
      try { done = !!gl.getProgramParameter(state.list[state.cursor].program, state.ext.COMPLETION_STATUS_KHR); }
      catch { done = true; }                      // disposed mid-scan: not our problem to wait on
      if (!done) break;
      state.cursor++;
    }
    state.pollMs = +(state.pollMs + (performance.now() - t0)).toFixed(1);
    if (state.cursor >= state.list.length) {
      state.status = 'settled';
      state.settledMs = +(performance.now() - state.startedAt).toFixed(0);
      return true;
    }
    // A program that never reports done must not park the warm pass forever.
    if (performance.now() - state.startedAt > 30000) { state.status = 'settled'; state.reason = 'timeout'; return true; }
    return false;
  }

  _warmDrawTick(budgetMs = 6) {
    const state = this.warmDraw;
    if (!state || state.status === 'done' || state.status === 'skipped' || state.status === 'degraded') return;
    if (this.terminal || this.paused || this.hitStop > 0) return;
    // A BATCH THAT COST TOO MUCH BUYS SILENCE BEFORE THE NEXT ONE.
    //
    // The budget can stop the pass from STARTING another batch; it cannot make
    // a render call that has already begun return sooner. Everything above
    // assumes the link poll keeps a blocking draw out of the frame — and on a
    // driver with no KHR_parallel_shader_compile there is no poll to keep it
    // out, only the guess that such a driver linked synchronously. Chrome on
    // ANGLE always has the extension, so that guess is the one thing here no
    // measurement on this machine can test, and Safari/Metal is exactly where
    // it is least likely to hold.
    //
    // So the pass watches its own cost. A batch over WARM_DRAW_SLOW_MS drops it
    // to one draw at a time and stands down for a stretch proportional to the
    // overrun. On a driver that behaves, this never fires; on one that does
    // not, the damage is a few long frames spread thin instead of a wall.
    if (state.holdUntil && performance.now() < state.holdUntil) return;
    // Programs first, draws after: drawing with a program the driver has not
    // finished linking is a block, and the block is the thing being cured.
    if (!this._warmGateSettled()) return;
    if (!this._warmLinksSettled()) return;
    if (!state.work) {
      try {
        state.work = this._warmDrawList();
        state.total = state.work.length;
        state.index = 0;
        state.status = 'running';
        this._warmRoot = new THREE.Group();
        this._warmRoot.name = 'warm-draw staging';
        this._warmRoot.visible = false;
        this.scene.add(this._warmRoot);
      } catch (error) {
        state.status = 'skipped';
        state.errors.push(`list: ${error?.message || error}`);
        return;
      }
    }

    const camera = this._warmDrawCamera();
    const viewport = this._warmViewport || (this._warmViewport = new THREE.Vector4());
    const scissor = this._warmScissor || (this._warmScissor = new THREE.Vector4());
    this.renderer.getViewport(viewport);
    this.renderer.getScissor(scissor);
    const scissorTest = this.renderer.getScissorTest();
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(0, 0, 1, 1);
    this.renderer.setViewport(0, 0, 1, 1);

    // A render costs ~7 ms of scene traversal before it draws anything — the
    // renderer walks all 2184 objects to build its list whatever the camera can
    // see. Behind the title that fixed cost is worth amortising over a batch;
    // in play it is not, because a batch can only ever make one frame longer.
    const batchSize = (this.started || state.slow) ? 1 : 4;
    const frameStart = performance.now();
    const staged = [];
    let spent = 0;
    try {
      while (state.index < state.work.length && spent < budgetMs) {
        staged.length = 0;
        while (staged.length < batchSize && state.index < state.work.length) {
          const object = state.work[state.index++];
          if (this._warmDrawable(object)) {
            staged.push([object, object.frustumCulled, null]);
            object.frustumCulled = false;
          } else {
            const proxy = this._warmDrawProxy(object);
            if (!proxy) { state.skipped++; continue; }
            this._warmRoot.add(proxy);
            staged.push([object, null, proxy]);
            state.proxies++;
          }
        }
        if (!staged.length) break;
        this._warmRoot.visible = true;
        const t0 = performance.now();
        this.renderer.render(this.scene, camera);
        const ms = performance.now() - t0;
        this._warmRoot.visible = false;
        for (const [object, culled, proxy] of staged) {
          if (proxy) this._warmRoot.remove(proxy);
          else object.frustumCulled = culled;
        }
        spent += ms;
        state.drawn += staged.length;
        if (ms > state.worstMs) state.worstMs = +ms.toFixed(1);
        if (ms > WARM_DRAW_SLOW_MS) {
          state.slow = true;
          state.slowBatches = (state.slowBatches || 0) + 1;
          state.holdUntil = performance.now() + Math.min(4000, ms * 4);
          break;
        }
      }
    } catch (error) {
      // Degraded is TERMINAL, and it has to clean up after itself: the tick
      // returns early on it forever after, so this is the last chance to take
      // the staging group out of the scene and let the work list go.
      state.errors.push(`draw: ${error?.message || error}`);
      state.status = 'degraded';
      state.work = null;
      if (this._warmRoot) { this.scene.remove(this._warmRoot); this._warmRoot = null; }
    } finally {
      // A throw mid-batch must not leave the world un-culled or the staging
      // group holding proxies: this pass is invisible or it is a bug.
      for (const [object, culled, proxy] of staged) {
        if (proxy) this._warmRoot?.remove(proxy);
        else object.frustumCulled = culled;
      }
      if (this._warmRoot) this._warmRoot.visible = false;
      this.renderer.setScissorTest(scissorTest);
      this.renderer.setScissor(scissor.x, scissor.y, scissor.z, scissor.w);
      this.renderer.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
    }

    state.frames++;
    state.spentMs = +(state.spentMs + (performance.now() - frameStart)).toFixed(1);
    if (state.index >= state.work.length && state.status !== 'degraded') {
      state.status = 'done';
      state.work = null;
      if (this._warmRoot) { this.scene.remove(this._warmRoot); this._warmRoot = null; }
    }
  }

  _dropQuality() {
    this.renderer.setPixelRatio(1);
    if (this.world.moon) this.world.moon.castShadow = false;
  }

  // ---------------------------------------------------------------- input
  _wireInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.started || this.dead || this.paused) return;
      if (!TEST_MODE && document.pointerLockElement !== canvas) { this._requestPointerLock(); return; }
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
        if (this.paused) { this.input.callDownAt = 0; return; }
        // duration alone decides — never gate the recall on mouse motion
        if (performance.now() - this.input.callDownAt < 260) this.input.pending.callTap = true;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (this.paused) return;
      if (!TEST_MODE && document.pointerLockElement !== canvas) return;
      this.input.lookX += e.movementX;
      this.input.lookY += e.movementY;
    });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const now = performance.now();
        if (this.paused) {
          // Chromium may report the pointer-lock loss and its Escape keydown in
          // either order. Do not let one physical key both pause and resume.
          if (now - this._pauseChangedAt > 160) this.resumeGame();
        } else {
          this.pauseGame('keyboard');
        }
        return;
      }
      if (this.paused) return;
      if (this.dead || this.flags.has('ended') || this._basementExit) return;
      this.input.keys.add(e.code);
      if (e.code === 'Space') this.input.pending.jump = true;
      if (e.code === 'KeyE') this.input.pending.interact = true;
    });
    addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    addEventListener('blur', () => {
      if (this._canPause()) this.pauseGame('focus-loss');
      else this.input.clearKeys();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      if (this._canPause()) this.pauseGame('visibility');
      else this.input.clearKeys();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        this._lockPending = false;
        this._lockEverHeld = true;
        // A DOM button cannot honestly be mouse-clicked while Pointer Lock
        // retargets every pointer event to the canvas. Hide that false
        // affordance; Escape/P remain the immediate desktop pause controls.
        this._syncPauseUi();
        return;
      }
      // Pointer lock is a gameplay contract. Losing it is a pause, not a silent
      // return-to-play state with dead mouse-look and manufactured releases.
      //
      // A lock we never held cannot be lost by a player decision — that edge is
      // the browser refusing or retracting a request during arrival, and it is
      // not a reason to stop his game. (The request itself no longer stacks;
      // see _requestPointerLock.)
      this._lockPending = false;
      if (this._canPause() && this._lockEverHeld) this.pauseGame('pointer-lock');
      else if (!this.paused) this.input.clearKeys();
    });
    document.addEventListener('pointerlockerror', () => { this._lockPending = false; });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      if (this.paused) this.render();
    });
  }

  _wireOverlays() {
    this.el = {
      title: document.getElementById('title'),
      die: document.getElementById('die'),
      pause: document.getElementById('pause'),
      pauseButton: document.getElementById('pauseButton'),
      fade: document.getElementById('fade'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      sr: document.getElementById('srState'),
    };
    this.el.title.addEventListener('click', (event) => {
      if (this.flags.has('ended')) { location.reload(); return; }
      if (event.target.closest('[data-action="start"]')) this.startGame();
    });
    this.el.die.addEventListener('click', () => {
      this.el.die.classList.add('hidden');
      this.director.respawn();
      this.fadeIn(1.2);
      this._syncPauseUi();
      this._requestPointerLock();
    });
    this.el.pauseButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.pauseGame('button');
    });
    this.el.pause.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'resume') this.resumeGame();
      if (action === 'restart-checkpoint') this.restartFromCheckpoint();
    });
    this._syncPauseUi();
  }

  _canPause() {
    return this.started && !this.dead && !this.flags.has('ended')
      && !this.endingTail && !this.terminal;
  }

  _requestPointerLock() {
    const canvas = this.renderer.domElement;
    try { canvas.focus({ preventScroll: true }); } catch { /* detached canvas */ }
    if (TEST_MODE || this.paused || this.dead || this.terminal) return;
    // Never stack requests. Spam-clicking the title puts a queued canvas click
    // straight through mousedown's retry path while the entry request is still
    // in flight, and a second requestPointerLock() against an in-flight first
    // one is how a lock gets granted and revoked in the same breath — which
    // arrived, to the player, as a game that paused itself on the way in.
    if (this._lockPending || document.pointerLockElement === canvas) return;
    this._lockPending = true;
    try {
      const pending = canvas.requestPointerLock?.();
      // A promise-returning implementation reports refusal here; the older
      // event-only one reports it as pointerlockerror. Both must clear the flag
      // or the retry path is dead for the rest of the session.
      if (pending?.catch) pending.catch(() => { this._lockPending = false; });
      else this._lockPending = false;
    } catch {
      this._lockPending = false;   // unsupported or denied: the next click retries
    }
  }

  _pauseDocumentAnimations() {
    this._pausedAnimations = [];
    if (!document.getAnimations) return;
    for (const animation of document.getAnimations()) {
      if (animation.playState !== 'running' && animation.playState !== 'pending') continue;
      const target = animation.effect?.target;
      if (target && this.el.pause?.contains(target)) continue;
      try { animation.pause(); this._pausedAnimations.push(animation); } catch { /* detached target */ }
    }
  }

  _resumeDocumentAnimations() {
    for (const animation of this._pausedAnimations) {
      try { if (animation.playState === 'paused') animation.play(); } catch { /* detached target */ }
    }
    this._pausedAnimations.length = 0;
  }

  _setAudioPaused(paused) {
    const ctx = this.audio?.ctx;
    if (!ctx) return;
    try {
      const op = paused ? ctx.suspend?.() : ctx.resume?.();
      Promise.resolve(op).catch(() => {}).finally(() => {
        // A rapid Escape double-tap can reverse the desired state while the
        // browser is still settling the first AudioContext promise. Reconcile
        // once more from authoritative game state so sound cannot resume under
        // a pause or remain muted after it.
        const shouldSuspend = this.paused || this.terminal;
        try {
          const settle = shouldSuspend && ctx.state === 'running'
            ? ctx.suspend?.()
            : (!shouldSuspend && this.started && ctx.state === 'suspended' ? ctx.resume?.() : null);
          settle?.catch?.(() => {});
        } catch { /* browser audio policy owns the fallback */ }
      });
    } catch { /* browsers without a live AudioContext simply remain silent */ }
  }

  _syncPauseUi() {
    if (!this.el) return;
    const showPause = this.paused && this._canPause();
    this.el.pause?.classList.toggle('hidden', !showPause);
    if (this.el.pauseButton) {
      const pointerLocked = document.pointerLockElement === this.renderer.domElement;
      this.el.pauseButton.hidden = !this.started || this.paused || this.dead
        || this.flags.has('ended') || this.endingTail || this.terminal
        || (!TEST_MODE && pointerLocked);
    }
    document.body.dataset.paused = showPause ? '1' : '0';
    this.el.crosshair?.setAttribute('aria-hidden', showPause ? 'true' : 'false');
  }

  pauseGame(reason = 'manual') {
    const releaseHeld = reason === 'focus-loss' || reason === 'visibility';
    if (this.paused) {
      // Pointer-lock loss can arrive just before blur/visibilitychange. Let the
      // later, stronger signal repair a mouse-up that the page may never see.
      if (releaseHeld) this.input.suspendForPause({ releaseHeld: true });
      return true;
    }
    if (!this._canPause()) return false;
    this.paused = true;
    this.pauseReason = reason;
    this._pauseChangedAt = performance.now();
    this.input.suspendForPause({ releaseHeld });
    this._lastShakeDt = 0;
    this.renderer.domElement.style.transform = '';
    this._pauseDocumentAnimations();
    this._setAudioPaused(true);
    this._syncPauseUi();
    if (!TEST_MODE && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    requestAnimationFrame(() => {
      this.el.pause?.querySelector('[data-action="resume"]')?.focus({ preventScroll: true });
    });
    return true;
  }

  _leavePause({ resumeAudio = true } = {}) {
    if (!this.paused) return false;
    this.paused = false;
    this.pauseReason = null;
    this._pauseChangedAt = performance.now();
    this._resumeDocumentAnimations();
    this._syncPauseUi();
    if (resumeAudio) this._setAudioPaused(false);
    return true;
  }

  resumeGame() {
    if (!this.paused || !this._canPause()) return false;
    this._leavePause({ resumeAudio: true });
    this._requestPointerLock();
    return true;
  }

  restartFromCheckpoint() {
    if (!this.paused || this.terminal || this.flags.has('ended')) return false;
    // Cancel an in-flight basement transaction before its global callback can
    // pull a checkpoint restart forward into the graveyard a second later.
    if (this._basementExit) {
      this._basementExit.complete = true;
      this._basementExit = null;
    }
    this.input.resetAll();
    this.hitStop = 0;
    this.snapBuffer = 0;
    this.director.respawn();
    this.el.die.classList.add('hidden');
    this.fadeIn(0.7);
    this._leavePause({ resumeAudio: true });
    this._requestPointerLock();
    return true;
  }

  // THE PRESS IS ANSWERED IMMEDIATELY; THE WARM WORK IS PAID ON THE TITLE.
  // The old start cancelled the warmup and dropped you into the bedroom with
  // ~230 unlinked programs and a few hundred un-uploaded textures — the cost
  // then arrived one district at a time, as freezes, forever. Now the button
  // takes the press (visual acknowledgment, no new words — his law), the warm
  // pass runs to completion behind it, and the game enters warm. If the warmup
  // already finished while he read the title, entry is synchronous as before.
  startGame() {
    if (this.started || this._entering) return;
    this._entering = true;
    this._pressedAt = performance.now();
    this._acknowledgeStart();
    if (this._warmGateSettled()) { this._enterGame(); return; }
    this.entryPromise = this._warmGate()
      .catch(() => {})                  // a degraded warm pass still enters
      .then(() => { if (!this.terminal) this._enterGame(); });
  }

  // Instant, wordless, hue-free: the keyart falls back, the pressed control
  // holds its lit state and stops answering, and the return mark keeps moving
  // so the tab never reads as hung. All of it is CSS on one class.
  _acknowledgeStart() {
    const title = this.el?.title;
    if (!title) return;
    title.classList.add('waking');
    const button = title.querySelector('[data-action="start"]');
    if (button) button.disabled = true;
  }

  _enterGame() {
    if (this.started) return;
    this._entering = false;
    this.started = true;
    this._programsAtEntry = this.renderer.info.programs.length;
    // How long the press was held on the title. This is the number that moved
    // out of mid-play and onto the title screen; keep it visible so it can
    // never quietly grow.
    this.entryLatencyMs = this._pressedAt ? performance.now() - this._pressedAt : 0;
    this.audio.init();
    this.el.title.classList.add('hidden');
    this.el.title.classList.remove('waking');
    this.fadeIn(2.4);
    this.director.start();
    this._syncPauseUi();
    this._requestPointerLock();
  }

  // ------------------------------------------------------------- services
  flag(name) { this.flags.add(name); }
  after(t, fn, options) { this.director.after(t, fn, options); }
  checkpoint(act, pose = null) {
    const p = pose || this.player;
    const pos = p.pos || p;
    this.lastCheckpoint = act;
    this.checkpointPose = {
      act,
      x: pos.x, y: pos.y, z: pos.z,
      yaw: p.yaw ?? this.player.yaw,
      pitch: p.pitch ?? this.player.pitch,
    };
  }
  shake(v) { this._shake = Math.max(this._shake, v); }
  residentHeard(n) { this.director.residentHeard(n); }

  impact(kind, pos) {
    // THE IMPACT LANGUAGE (kick-ball law): the load-bearing distinction is
    // TIME. quiet stun = short stop; the pop owns the longest stop in the
    // game; 'locked' collapses inward — this cannot be put down yet.
    if (kind === 'pop') { this.hitStop = Math.max(this.hitStop, 0.13); this.shake(0.6); this.fovKick = Math.max(this.fovKick || 0, 2.5); }
    else if (kind === 'break') { this.hitStop = Math.max(this.hitStop, 0.085); this.shake(0.46); this.fovKick = Math.max(this.fovKick || 0, 1.8); }
    else if (kind === 'hurt') { this.hitStop = Math.max(this.hitStop, 0.05); this.shake(0.28); this.fovKick = Math.max(this.fovKick || 0, 1.2); }
    else if (kind === 'locked') { this.hitStop = Math.max(this.hitStop, 0.06); this.shake(0.2); }
    else this.shake(0.11);
    if (pos) this._impactFx(kind, pos);
  }

  // Built at boot, never lazily. This used to construct itself on the first
  // impact — which added a point light to a live scene and so changed the
  // shader light census, making the driver recompile every lit material in the
  // game. The first thing the player hit therefore froze for several seconds,
  // wherever in the game that happened to be. That is Alex's "a lot of the
  // things that you hit with the skull to activate freeze the game for a
  // number of seconds": one lazy allocation, felt everywhere.
  _buildImpactFx() {
    this._impactLight = new THREE.PointLight(0xd8cbb0, 0, 7, 1.8);
    this._impactLight.name = 'impact bloom';
    this.scene.add(this._impactLight);
  }

  _impactFx(kind, pos) {
    // contact bloom + ring at the point of impact — brightness and motion
    // carry the meaning, never hue. outward ring = hurt; inward = locked.
    //
    // The LIGHT is built at boot (_buildImpactFx) because adding a light to a
    // live scene changes the shader light census and recompiles every lit
    // material in the game — so the first thing the player ever hit used to
    // freeze for seconds. The ring is only a mesh, costs the census nothing,
    // and is still built on demand.
    if (!this._impactRing) {
      this._impactRing = new THREE.Mesh(
        new THREE.RingGeometry(0.16, 0.21, 24),
        new THREE.MeshBasicMaterial({ color: 0xcfd6da, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      this._impactRing.name = 'impact ring';
      this.scene.add(this._impactRing);
    }
    this._impactLight.position.copy(pos);
    this._impactLight.intensity = kind === 'pop' ? 70 : kind === 'locked' ? 16 : 32;
    const R = this._impactRing;
    R.position.copy(pos);
    R.lookAt(this.camera.getWorldPosition(_impV));
    this._ringT = 0.22;
    this._ringIn = kind === 'locked';
    R.material.opacity = kind === 'pop' ? 0.8 : 0.5;
    R.scale.setScalar(this._ringIn ? 3.2 : 0.6);
  }

  gore(pos, n, speed = 20) {
    const k = 0.7 + clamp(speed / 40, 0, 1) * 0.8;   // harder hits burst harder
    for (let i = 0; i < n; i++) {
      if (this._goreActive >= GORE_CAP) {
        this._goreDropped += n - i;
        break;
      }
      const slot = this.gorePool[this._goreActive++];
      slot.scale = 0.65 + Math.random() * 0.7;
      slot.pos.copy(pos);
      slot.pos.y += 1;
      slot.vel.set(
        (Math.random() - 0.5) * 7 * k,
        Math.random() * 6 * k,
        (Math.random() - 0.5) * 7 * k,
      );
      slot.t = 1.6;
      this._goreMatrix.compose(
        slot.pos,
        this._goreQuaternion,
        this._goreScale.setScalar(slot.scale),
      );
      this.goreMesh.setMatrixAt(this._goreActive - 1, this._goreMatrix);
      this._goreEmitted++;
    }
    this.goreMesh.count = this._goreActive;
    this.goreMesh.visible = this._goreActive > 0;
    this.goreMesh.instanceMatrix.needsUpdate = true;
  }

  goreState() {
    return {
      capacity: GORE_CAP,
      active: this._goreActive,
      free: GORE_CAP - this._goreActive,
      emitted: this._goreEmitted,
      dropped: this._goreDropped,
    };
  }

  _updateGore(dt) {
    if (this._goreActive <= 0) return;
    let goreIndex = 0;
    while (goreIndex < this._goreActive) {
      const g = this.gorePool[goreIndex];
      g.t -= dt;
      g.vel.y -= 9 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.04) { g.pos.y = 0.04; g.vel.multiplyScalar(0.4); g.vel.y = 0; }
      if (g.t <= 0) {
        const last = --this._goreActive;
        if (goreIndex !== last) {
          this.gorePool[goreIndex] = this.gorePool[last];
          this.gorePool[last] = g;
        }
        continue;
      }
      this._goreMatrix.compose(
        g.pos,
        this._goreQuaternion,
        this._goreScale.setScalar(g.scale),
      );
      this.goreMesh.setMatrixAt(goreIndex, this._goreMatrix);
      goreIndex++;
    }
    this.goreMesh.count = this._goreActive;
    this.goreMesh.visible = this._goreActive > 0;
    this.goreMesh.instanceMatrix.needsUpdate = true;
  }

  detachBoard(b) {
    b.userData.off = true;
    // A plank that comes off the door has to end up somewhere that reads as
    // OFF. This used to sink it straight down at a constant 3 m/s and stop it
    // at y = 0.15 -- still upright, still spanning the doorway, still at the
    // exact x it was nailed at. Three throws later the player had an open
    // cellar door with three planks standing in the gap. Alex: "basement door
    // has theses in front of it even after opening it."
    //
    // Now it falls under gravity, tumbles onto its face, and comes to rest
    // flat on the kitchen floor a little back from the threshold, clear of the
    // walk line. The ticker retires itself once it has settled instead of
    // living forever as a no-op.
    const spin = (Math.random() - 0.5) * 7;
    const driftX = (Math.random() - 0.5) * 0.85;
    const restY = 0.05;                                   // half its thickness: lying flat
    const restZ = b.position.z - (0.44 + Math.random() * 0.34);
    const settle = { t: 0, v: 0, done: false };
    this.tickers.push((dt) => {
      if (settle.done) return;
      settle.t += dt;
      settle.v += dt * 9.2;
      b.position.y = Math.max(restY, b.position.y - settle.v * dt);
      const grounded = b.position.y <= restY + 1e-4;
      if (!grounded) b.position.x += dt * driftX;
      // tumble onto its face and STAY there, rather than spinning for ever
      b.rotation.x = damp(b.rotation.x, Math.PI / 2, 3.6, dt);
      b.position.z = damp(b.position.z, restZ, 3.4, dt);
      b.rotation.z += dt * spin * Math.max(0, 1 - settle.t / 0.75);
      if (grounded && settle.t > 1.1) settle.done = true;
    });
  }

  exitBasement() {
    if (this.act === 'graveyard' || this._basementExit) return;
    const transition = { complete: false };
    this._basementExit = transition;
    this.fadeOut(1.2, () => {
      if (transition.complete) return;
      transition.complete = true;

      // Opening the hatch is an irreversible physical act. If death landed in
      // the same 1.2-second fade, reconcile the whole transaction atomically
      // instead of leaving a spent hatch in a dead basement life.
      this.dead = false;
      this.player.frozen = false;
      this.player.movementLocked = false;
      this.el.die.classList.add('hidden');
      this.teleport('graveyard');
      this.fadeIn(1.6);
      this._basementExit = null;
    }, false, { global: true });
  }

  fadeOut(dur, cb, slow, options) {
    this.el.fade.classList.toggle('slow', !!slow);
    this.el.fade.style.transitionDuration = dur + 's';
    this.el.fade.style.opacity = 1;
    if (cb) this.after(dur, cb, options);
  }

  fadeIn(dur) {
    this.el.fade.style.transitionDuration = dur + 's';
    this.el.fade.style.opacity = 0;
  }

  showDeath() {
    this._leavePause({ resumeAudio: true });
    this.el.die.classList.remove('hidden');
    this._syncPauseUi();
    document.exitPointerLock && document.exitPointerLock();
  }

  showEnd() {
    if (this.endingTail || this.terminal) return;
    this._leavePause({ resumeAudio: true });
    this.endingTail = true;
    this.flag('ended');
    // in the dark: the catch you know — and someone else's gasp
    // The catch lands at the hands; the wordless human inhale occupies a point
    // just behind one ear. Nothing on screen explains whose breath it is.
    const listener = this.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const catchPos = listener.clone().addScaledVector(forward, 0.09);
    const gaspPos = listener.clone().addScaledVector(forward, -0.42).addScaledVector(right, 0.22);
    this.audio.catchThud({ pos: catchPos, gain: 0.7 });
    this.after(1.1, () => {
      this.audio.gasp({ pos: gaspPos, gain: 0.72, verb: 0.78 });
      // Give the stranger's breath its full audible body, then make "end" a
      // real terminal state: no hidden simulation, reflection renders or audio
      // beds continue underneath the title.
      this.after(1.15, () => this._finishEnd(), { global: true });
    }, { global: true });
    const t = this.el.title;
    t.querySelector('.keys').style.display = 'none';
    // The catch and the breath are the ending. Do not explain the image with a
    // model-authored epitaph; the only returning text surface is the title.
    t.querySelector('.tag').textContent = '';
    t.querySelector('.go').textContent = '';
    t.classList.add('ending');
    t.classList.remove('hidden');
    this._syncPauseUi();
    document.exitPointerLock && document.exitPointerLock();
  }

  _finishEnd() {
    if (this.terminal) return;
    this.enemies.clear();
    this.audio.stopAll({ suspend: true });
    this.finale?.mirrors?.dispose?.();
    for (const material of this._shaderWarmMaterials || []) material.dispose();
    this._shaderWarmMaterials = null;
    this.tickers.length = 0;
    this.terminal = true;
    this._syncPauseUi();
  }

  _completeArrivalInstant() {
    // Debug/test teleports force exact truthful state (the `if (hard)
    // setStage(stage)` pattern): a jump to ANY act before the bedroom arrival
    // completes the arrival instantly and silently — flag set, window swapped
    // to its shattered truth (the bedroom act's hook), lights restored, skull
    // in the hands. No flicker, no sounds. Idempotent: real arrivals set the
    // flag in the act script and this becomes a no-op.
    if (this.flags.has('skullArrived')) return;
    this.flag('skullArrived');
    this.bedroomArrival?.completeInstant?.();
    if (this.skull.mode === 'gone') {
      this.skull.arriveRestore();
      this.skull.holdNow();
    }
    if (this.skull.introFlicker) {   // a mid-flicker teleport settles instantly
      this.skull.introFlicker = null;
      this.skull.setStage(0);
    }
  }

  teleport(act) {
    this._completeArrivalInstant();
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
    this.player.abortSwing();     // never wake up still holding a rope
    this.player.vel.set(0, 0, 0);
    this.player._sync(0);
    if (this.forest && act !== 'forest' && act !== 'clearing' && act !== 'cave') {
      this.forest._lastIdx = 0;
      this.forest.sealS = -10;
      this.forest.entered = false;
    }
    // and arriving IN the forest re-seats it on where we actually landed
    if (this.forest && act === 'forest') this.forest.recentre(this.player.pos);
    if (this.forest && act === 'clearing') this.forest._lastIdx = this.forest.length - 1;
    if (this.forest && act === 'cave') this.forest._lastIdx = this.forest.length - 1;
    this.director.setAct(act, true);
  }

  // ----------------------------------------------------------------- step
  step(dt, frame) {
    if (this.terminal || this.paused) return;
    this.time += dt;
    const ctx = {
      playerVel: new THREE.Vector3(this.player.vel.x, this.player.fallV, this.player.vel.z),
      yawVel: this.player.yawVel, pitchVel: this.player.pitchVel,
      callHeld: frame.callHeld, throwHeld: frame.throwHeld, bobY: this.player.bobY,
      onCatch: (impactV, hard) => {
        this.shake(0.13 + impactV * 0.2);
        // The final hand-span now has a visible settle in skull.js. Give its
        // arrival a camera-only kick; the sacred catch/throw loop never pauses
        // simulation or delays the player's next input. Hard recovery catches
        // remain deliberately quiet.
        if (!hard) {
          this.fovKick = Math.max(this.fovKick || 0, 0.45 + impactV * 0.45);
        }
      },
    };

    // input → skull verbs. Alex's grammar: press throws, hold keeps it out,
    // release brings it home. The button is the tether.
    const verbsLive = !this.dead && !this.flags.has('ended') && !this._basementExit;
    // !introFlicker: throws wait for the arrival flicker to settle ("Then you
    // can throw it") — an input gate in kind with verbsLive, never control
    // theft: camera and movement stay live for the whole 3.6s.
    if (verbsLive && frame.throwPressed && this.skull.mode === 'held' && !this.skull.introFlicker) this.skull.tryThrow(ctx);
    // release ends an outbound throw AND lets go of a rope — one grammar, and
    // the anchored case is handled inside _updateAnchored so the swing and the
    // skull let go on the same frame
    if (frame.throwReleased && this.skull.mode === 'outbound') this.skull.beginReturn('snap');
    if (verbsLive && frame.callTap) {
      if (this.skull.mode === 'gone') this.director.onVoidCall();
      else this.snapBuffer = FEEL_PROFILE.snapBuffer;
    }
    if (this.snapBuffer > 0) {
      if (this.skull.call()) {
        // Backup call is the same release promise as letting go of LMB. If the
        // skull was the pivot of a live rope swing, recall and rope pull must
        // end in the same fixed step; otherwise held LMB can keep tugging the
        // player toward a pivot the skull has already abandoned.
        if (this.player.swing) this.player.endSwing();
        this.snapBuffer = 0;
      } else this.snapBuffer -= dt;
    }
    if (verbsLive && frame.interactPressed) this._interact();

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
    // AFTER the tickers, deliberately. The house keeps running when you walk
    // out of it — the crawl-space counterweight writes `visible` on its cable
    // and links from a ticker every frame of the game — so a culler that ran
    // with the other district cullers up in forest.update() got overwritten
    // before the frame was drawn. This is the last word on visibility.
    if (this.forest) this.forest.syncHouseInteriorCulling();
    this._updateGore(dt);
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

    this._updateViewmodelLight(dt);

    // fog eases toward the act's density
    this.scene.fog.density = damp(this.scene.fog.density, this.fogTarget, 0.8, dt);
    // colour and sky ease alongside density: atmosphere arrives as weather
    // rolling in, never as a second version of the room loading up
    if (this.fogColorTarget) this.scene.fog.color.lerp(this.fogColorTarget, Math.min(1, dt * 1.1));
    if (this.bgColorTarget) this.scene.background.lerp(this.bgColorTarget, Math.min(1, dt * 1.1));
  }

  // The hands and the held skull draw in their own depth pass with their own
  // lamps, so NOTHING about the world reaches them. They kept the bedroom's
  // lighting all the way into the graveyard, and measured there (
  // tools/probe-viewmodel-light.mjs) the hand region read mean 0.158 against a
  // world of 0.032 — five times the brightness of the frame they sit in, which
  // is exactly why they read as two salmon gloves floating in the dark.
  //
  // So the viewmodel key rides the act's own free-light floor: the same factor
  // the director eases world ambient by. Walking out of the house takes the
  // light off your own hands too. And the second term is the game's whole
  // premise made visible — while the skull is HELD it is the thing lighting
  // your hands, so when you throw it the cradle dims with everything else and
  // the rim is most of what is left of you. Value only, no hue read.
  _updateViewmodelLight(dt) {
    const V = this._vmKey;
    if (!V) return;
    const w = this.world;
    const k = w && w.ambient && w.ambientBase ? w.ambient.intensity / w.ambientBase : 1;
    // ^1.25 rather than linear: the acts are already only 0.42..1.0 apart, and
    // a linear ride left the dark ones still glowing.
    const act = clamp(Math.pow(clamp(k, 0.05, 1.4), 1.25), 0.2, 1.15);
    // The skull's own presence. `gone` is the waterfall — permanent, and the
    // hands should feel it for the rest of the game.
    const m = this.skull.mode;
    const carried = m === 'held' ? 1 : (m === 'gone' ? 0.44 : 0.6);
    V.lit = damp(V.lit, act * carried, 3.2, dt);
    this.holdLight.intensity = V.key * V.lit;
    this.holdFillLight.intensity = V.fill * V.lit;
    // The rim is the opposite contract: it exists to keep a silhouette alive
    // where there is nothing behind the hands to separate them from, so it
    // holds up as the key falls away instead of falling with it.
    this.holdRimLight.intensity = V.rim * (0.42 + 0.58 * V.lit) * (1.5 - 0.5 * act);
  }

  _interact() {
    // E: use what the crosshair holds, else call the skull home
    const inter = this._crosshairTarget();
    if (inter) {
      // mercy path: standing at a lock while the skull carries its key
      const doorMatch = this.world.doors.find((d) => 'door:' + d.id === inter.id && d.locked && this.skull.carry && this.skull.carry.id === d.locked);
      if (doorMatch) {
        if (doorMatch.carriedUnlock) {
          doorMatch.carriedUnlock();
          return;
        }
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

  // NOTE — the empty hand says nothing, deliberately. There used to be a soft
  // tick on every dead press (LMB, RMB, E into the air) before the skull
  // arrived, on the theory that silence reads as broken. That theory came from
  // the firebox, and the firebox was a different animal: a gameplay surface
  // refusing a real throw with no feedback at all, a promise broken. This is
  // not that. There is no verb on the button, and the player's own hands are
  // on screen and visibly empty.
  //
  // It also actively misled. One generic tick cannot tell "you pressed nothing
  // at nothing" from "you pressed the WRONG button at something", so it
  // answered both with the same reassuring sound — and Alex lost ten minutes
  // clicking at a drawer the crosshair had just lit, hearing the game agree,
  // and getting nothing. A refusal beat was tried in its place and cut for the
  // same reason he cut the tick: "if it doesn't make a sound, that's better
  // than even making a bad sound that says no... because it's obvious it does
  // nothing." An empty hand is self-evident. Do not re-add this.
  _crosshairTarget() {
    if (!this._ray) { this._ray = new THREE.Raycaster(); this._center = new THREE.Vector2(0, 0); }
    this.camera.updateMatrixWorld();   // sim-only steps never render; the ray must not cast from a stale pose
    this._ray.setFromCamera(this._center, this.camera);
    this._ray.far = 2.9;
    const hits = this._ray.intersectObjects(this.world.interactables, false);
    for (const h of hits) {
      const inter = h.object.userData.inter;
      if (!inter || inter.enabled === false) continue;
      if (this._occluded(h.distance, h.object)) continue;
      return inter;
    }
    return null;
  }

  // Reach, not x-ray. The pick ray is cast against the interactables LIST, so
  // for the whole life of the game nothing in the world could block it: E
  // selected — and the crosshair grew — straight through beds, walls and shut
  // doors. Solid geometry standing between you and the thing now wins.
  // Two deliberate exemptions, both real cases in this house: an interact that
  // LIVES inside something solid (a firebox target inside the boiler shell)
  // still answers, and so does anything picked while you stand inside a
  // collider yourself. Colliders, not meshes: the merged shell has no
  // per-object geometry to raycast, and the AABB list is the same truth the
  // player's own body collides against.
  _occluded(dist, obj) {
    const cols = this.world.colliders;
    if (!cols || !cols.length) return false;
    const lim = dist - 0.12;      // grazing the surface you reach past is not blocking
    if (lim <= 0) return false;
    if (!this._occP) this._occP = new THREE.Vector3();
    const o = this._ray.ray.origin, d = this._ray.ray.direction;
    const tp = obj.getWorldPosition(this._occP);
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.max.y - c.min.y < 1e-4) continue;              // collapsed: opened door, broken pane
      if (tp.x >= c.min.x - 0.03 && tp.x <= c.max.x + 0.03
        && tp.y >= c.min.y - 0.03 && tp.y <= c.max.y + 0.03
        && tp.z >= c.min.z - 0.03 && tp.z <= c.max.z + 0.03) continue;
      if (o.x >= c.min.x && o.x <= c.max.x && o.y >= c.min.y
        && o.y <= c.max.y && o.z >= c.min.z && o.z <= c.max.z) continue;
      let t0 = 0, t1 = lim, blocked = true;
      for (const ax of OCC_AXES) {
        const dv = d[ax];
        if (Math.abs(dv) < 1e-8) {
          if (o[ax] < c.min[ax] || o[ax] > c.max[ax]) { blocked = false; break; }
          continue;
        }
        let a = (c.min[ax] - o[ax]) / dv, b = (c.max[ax] - o[ax]) / dv;
        if (a > b) { const s = a; a = b; b = s; }
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
        if (t0 > t1) { blocked = false; break; }
      }
      if (blocked) return true;
    }
    return false;
  }

  _updateWindowAimAffordance(dt) {
    const openings = this.world.windowOpenings;
    if (!openings || !openings.length) return;
    if (!this._windowAimOrigin) {
      this._windowAimOrigin = new THREE.Vector3();
      this._windowAimDir = new THREE.Vector3();
      this._windowAimHit = new THREE.Vector3();
      this._windowAimTo = new THREE.Vector3();
    }
    const origin = this.camera.getWorldPosition(this._windowAimOrigin);
    const dir = this.camera.getWorldDirection(this._windowAimDir);
    for (const opening of openings) {
      const denom = dir.dot(opening.normal);
      let aimed = false;
      if (Math.abs(denom) > 0.0001) {
        const dist = this._windowAimTo.copy(opening.center).sub(origin).dot(opening.normal) / denom;
        if (dist > 0.15 && dist < 24) {
          const hit = this._windowAimHit.copy(origin).addScaledVector(dir, dist);
          const across = opening.horizontal === 'x'
            ? Math.abs(hit.x - opening.center.x)
            : Math.abs(hit.z - opening.center.z);
          aimed = across < opening.width * 0.47
            && Math.abs(hit.y - opening.center.y) < opening.height * 0.47;
        }
      }
      opening.aim += ((aimed ? 1 : 0) - opening.aim) * Math.min(1, dt * 13);
      opening.hot = Math.max(0, opening.hot - dt * 0.7);
      const pulse = (opening.hot > 0.01 || opening.aim > 0.01)
        ? Math.sin(this.time * (opening.hot > 0.2 ? 17 : 9)) * 0.055 : 0;
      opening.glint.material.opacity = 0.045
        + opening.aim * (0.58 + pulse)
        + opening.hot * (0.36 + pulse);
      const s = 1 + opening.aim * 0.025 + opening.hot * 0.045;
      opening.glint.scale.set(s, s, 1);
    }
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
    // impact fx breathe every rendered frame — including inside hit-stop
    // Cosmetic time must never run backwards. A freshly resumed or automated
    // browser can occasionally deliver a stale RAF timestamp; feeding that
    // negative delta into the FOV decay *adds* kick every render until the
    // perspective matrix crosses 180 degrees and the whole world turns into
    // an inverted fisheye/starburst. Clamp at both consumption and capture.
    const rdt = this.paused ? 0 : clamp(this._lastShakeDt || 0.016, 0, 0.05);
    if (this._impactLight && this._impactLight.intensity > 0.1)
      this._impactLight.intensity *= Math.exp(-rdt * 9);
    if (this._ringT > 0) {
      this._ringT -= rdt;
      const R = this._impactRing, k = Math.max(0, this._ringT / 0.22);
      R.scale.setScalar(this._ringIn ? 0.5 + k * 2.7 : 0.6 + (1 - k) * 2.6);
      R.material.opacity *= Math.exp(-rdt * 6.5);
      if (this._ringT <= 0) R.material.opacity = 0;
    }
    // FOV punch, decayed fast — a flinch, not a zoom
    this.fovKick = Math.max(0, (this.fovKick || 0) - rdt * 10);
    const fov = 71 + this.fovKick;
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // rotational flinch: first-person reads rotation as a hit to the HEAD;
    // applied for this frame only, removed after render
    let rkx = 0, rky = 0;
    const s2r = this._shake * this._shake;
    if (!this.paused && !REDUCED_MOTION && s2r > 0.0001) {
      rkx = (Math.random() - 0.5) * s2r * 0.05;
      rky = (Math.random() - 0.5) * s2r * 0.04;
      this.camera.rotation.x += rkx;
      this.camera.rotation.y += rky;
    }
    this._updateWindowAimAffordance(rdt);
    this.finale.render(this.scene, this.camera);

    // Render the physical world and the first-person cradle as two depth
    // passes. Three's light list is camera-global: merely putting the 58-cd
    // skull lantern and the hands on different object layers did not stop that
    // point-blank world light from bleaching every finger white. The world
    // pass keeps the lantern's environmental pool; the cleared-depth held pass
    // sees only its calibrated viewmodel key and can never clip into walls.
    const cameraMask = this.camera.layers.mask;
    this.camera.layers.set(0);
    this.renderer.render(this.scene, this.camera);
    const worldInfo = {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.camera.layers.set(LAYER_HELD);
    const worldBackground = this.scene.background;
    this.scene.background = null; // do not paint over the completed world pass
    this.renderer.render(this.scene, this.camera);
    this.scene.background = worldBackground;
    const heldInfo = {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
    this.camera.layers.mask = cameraMask;
    this.camera.rotation.x -= rkx;
    this.camera.rotation.y -= rky;
    this.lastRender = {
      drawCalls: worldInfo.calls + heldInfo.calls,
      triangles: worldInfo.triangles + heldInfo.triangles,
    };
    this.grainMat.uniforms.uTime.value = REDUCED_MOTION ? 0 : this.time % 300;
    this.grainMat.uniforms.uFear.value = this.fx.fear;
    // the drawing buffer, not the CSS size — this is the grid the grain and the
    // dither are quantised against
    this.grainMat.uniforms.uResolution.value.set(
      this.renderer.domElement.width, this.renderer.domElement.height);
    this.renderer.render(this.grainScene, this.grainCam);
    this.renderer.autoClear = true;

    // wordless HUD sync
    const ch = this.el.crosshair;
    ch.dataset.target = this._crosshairTarget() ? '1' : '';
    ch.dataset.skull = this.skull.mode === 'held' ? '' : 'away';
    this.el.vignette.style.opacity = clamp(this.fx.fear, 0, 1) * 0.85;
    // announce only meaningful state changes to assistive tech; a 60 Hz
    // aria-live stream is neither useful nor kind
    const srState = `${this.act}, skull ${this.skull.mode}${this.skull.carry ? ' carrying ' + this.skull.carry.id : ''}`;
    if (srState !== this._srState) { this._srState = srState; this.el.sr.textContent = srState; }

    // camera shake as canvas transform
    this._shake = Math.max(0, this._shake - rdt * 2.8);
    const s = this._shake * this._shake;
    this.renderer.domElement.style.transform = !this.paused && !REDUCED_MOTION && s > 0.0001
      ? `translate(${(Math.random() - 0.5) * s * 14}px, ${(Math.random() - 0.5) * s * 10}px)` : '';
  }

  // ----------------------------------------------------------------- loop
  run() {
    let last = performance.now();
    let acc = 0;
    const tick = (now) => {
      if (this.terminal) return;
      if (HITCH_LOG) this._recordLongFrame(now - last);
      const rawDt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      this._lastShakeDt = rawDt;
      if (this.paused) {
        // Drop wall time instead of accumulating a catch-up burst. The already
        // rendered WebGL frame stays pinned under the DOM pause layer.
        acc = 0;
        this._lastShakeDt = 0;
        if (!this.terminal) requestAnimationFrame(tick);
        return;
      }
      // Ahead of every render path, and cheap by construction: it spends a
      // fixed few milliseconds and stops. Behind the title it runs at a wide
      // budget because nothing there can be spoiled by a long frame; in play it
      // tip-toes, and it is finished long before anyone reaches the stairs.
      //
      // CAUGHT, ALWAYS. Every re-arm of requestAnimationFrame below this line
      // is downstream of it, so an exception here would stop the frame loop for
      // good — the game frozen, with no path back. Warmth is worth nothing at
      // that price: if this ever throws, it stands down and the game plays on.
      try {
        this._warmDrawTick(this.started ? 6 : 20);
      } catch (error) {
        if (this.warmDraw) {
          this.warmDraw.status = 'degraded';
          this.warmDraw.errors.push(`tick: ${error?.message || error}`);
        }
      }
      if (TEST_MODE && !this._selfStep) {
        this.render();
        if (!this.terminal) requestAnimationFrame(tick);
        return;
      }
      if (this.hitStop > 0) {
        // living freeze: the sim holds its breath but the cosmetic layer
        // drifts — hands, shake decay, impact bloom. A held breath, not a
        // dropped frame. Edges buffered, not lost.
        this.hitStop -= rawDt;
        this.skull._updateHands(rawDt * 0.2);
        this.render();
        if (!this.terminal) requestAnimationFrame(tick);
        return;
      }
      acc = Math.min(acc + rawDt, FIXED_DT * 10);
      let first = true;
      while (acc >= FIXED_DT) {
        const frame = this.input.frame(first);
        this.step(FIXED_DT, frame);
        first = false;
        acc -= FIXED_DT;
      }
      this.render();
      if (!this.terminal) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Believe the log, not the theory. ?hitch=1 records every frame over 150 ms
  // with what changed across it: programs linked (a compile stall), geometries
  // and textures uploaded (an allocation stall), plus where the player was
  // standing. Round five's whole §5 was found this way — the freezes are not
  // one bug, they are a class, and the class is "work paid at first sight".
  _recordLongFrame(ms) {
    const info = this.renderer.info;
    const programs = info.programs?.length || 0;
    const { geometries, textures } = info.memory;
    if (ms > 150) {
      this.longFrames.push({
        ms: +ms.toFixed(0),
        at: +(performance.now() / 1000).toFixed(2),
        act: this.act,
        started: this.started,
        pos: [+this.player.pos.x.toFixed(1), +this.player.pos.y.toFixed(1), +this.player.pos.z.toFixed(1)],
        programs: programs - (this._hitchPrograms ?? programs),
        geometries: geometries - (this._hitchGeometries ?? geometries),
        textures: textures - (this._hitchTextures ?? textures),
        totals: { programs, geometries, textures },
      });
      if (this.longFrames.length > 400) this.longFrames.shift();
    }
    this._hitchPrograms = programs;
    this._hitchGeometries = geometries;
    this._hitchTextures = textures;
  }

  // ---------------------------------------------------------------- debug
  _exposeDebug() {
    const g = this;
    const api = {
      version: VERSION,
      feelProfile: FEEL_PROFILE,
      ready: true,
      start() { g.startGame(); return true; },
      // The warm gate makes start asynchronous for a fast clicker: await this
      // (it is null in test mode, where nothing is warmed) to land in play.
      started() { return g.entryPromise || Promise.resolve(g.started); },
      warm() {
        return {
          shader: { ...g.shaderWarmup },
          textures: g.textureWarmup ? { ...g.textureWarmup } : null,
          draw: g.warmDraw ? { ...g.warmDraw, work: undefined } : null,
          links: g._warmLinks
            ? { status: g._warmLinks.status, linked: g._warmLinks.cursor, total: g._warmLinks.total ?? 0, pollMs: g._warmLinks.pollMs, settledMs: g._warmLinks.settledMs ?? null }
            : null,
          settled: g._warmGateSettled(),
          entryLatencyMs: g.entryLatencyMs ?? null,
          programsAtEntry: g._programsAtEntry ?? null,
          programsNow: g.renderer.info.programs.length,
        };
      },
      hitches() { return g.longFrames.slice(); },
      pause(reason = 'debug') { return g.pauseGame(reason); },
      resume() { return g.resumeGame(); },
      restartCheckpoint() { return g.restartFromCheckpoint(); },
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
          paused: g.paused,
          pauseReason: g.pauseReason,
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
  // THE NEW OPENING: a fresh boot wakes empty-handed at the bed edge — the
  // skull is not in the world until the bedroom bell calls it through the
  // window. Every teleport below still works because a hard jump completes
  // the arrival instantly (the debug/test contract in _completeArrivalInstant).
  check('act0-boots-skull-less', () => game.act === 'bedroom'
    && game.skull.mode === 'gone' && game.skull.root.parent === null
    && !game.flags.has('skullArrived'));
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
  check('teleport-grants-the-skull', () => game.skull.mode === 'held'
    && game.flags.has('skullArrived'));
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
  // Deliver it the way the game does: aim the live camera at the lock and
  // throw. (The old synthetic mid-air spawn behind the shut door predates the
  // authored bed-edge wake spawn; outbound guide steering follows the live
  // camera, so the flight must be aimed, never teleported past the aim.)
  const lockT = game.world.fetchTargets.find((t) => t.id === 'bedroomLock');
  const lockPos = lockT.object.getWorldPosition(new THREE.Vector3());
  {
    const dx = lockPos.x - game.player.pos.x;
    const dy = lockPos.y - (game.player.pos.y + 1.62);
    const dz = lockPos.z - game.player.pos.z;
    game.player.yaw = Math.atan2(-dx, -dz);
    game.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
    game.player._sync(0);
  }
  F.stepWith(FIXED_DT, { throwPressed: true, throwHeld: true });
  F.stepWith(0.5, { throwHeld: true });
  F.stepWith(FIXED_DT, { throwReleased: true });
  for (let t = 0; t < 2 && !game.flags.has('bedroomOpen'); t += 0.1) F.stepWith(0.1);
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
  // the pop is now a physical death: the corpse is launched and tumbles for
  // 0.62s before removal — assert the arc, then the removal
  check('stunned-walker-pops', () => (e.state === 'dying' || !game.enemies.list.includes(e)) && game.flags.has('firstPop'));
  F.stepWith(1.0);
  check('popped-walker-is-gone', () => !game.enemies.list.includes(e));
  F.stepWith(1.5);
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
