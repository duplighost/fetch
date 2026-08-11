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
import { LAYER_HELD, LAYER_DOUBLE } from './mirrors.js';

const FIXED_DT = 1 / 120;
// Layer 1 is rendered only by the physical-world camera. Reflection cameras
// remain WORLD(0)+DOUBLE(3). The fixed-light reconciler normally needs only
// WORLD ballast, but it can assign a remainder to this layer when a live
// reflection-only story light makes the two authored point-light counts differ.
const LAYER_MAIN_ONLY = 1;
const Q = new URLSearchParams(location.search);
const TEST_MODE = Q.has('test') || Q.has('autotest');
// Opt-in only: the transition identity diagnostic records driver program keys,
// source renderables and exact light identities. Ordinary test=1 runs keep the
// same small artifacts and do not pay for scene/material introspection.
const GPU_IDENTITY_TRACE = TEST_MODE && Q.has('gpuidentity');
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BOOT_MODULE_AT = performance.now();
let BOOT_TITLE_INTERACTIVE_AT = null;
let BOOT_TITLE_PAINT_OPPORTUNITY_AT = null;
const _impV = new THREE.Vector3();
const VERSION = '0.6.0-broken-promise';
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
    this.bootTiming = {
      moduleStartedAt: BOOT_MODULE_AT,
      titleInteractiveAt: BOOT_TITLE_INTERACTIVE_AT,
      titlePaintOpportunityAt: BOOT_TITLE_PAINT_OPPORTUNITY_AT,
      constructorStartedAt: performance.now(),
      constructedAt: null,
      firstRenderStartedAt: null,
      firstRenderEndedAt: null,
    };
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
    // Every WebGL context owns a separate set of programs, textures and FBOs.
    // Async warmup work captures this token; a loss/restore pair invalidates
    // both sides so stale completions can never certify a dead driver context.
    this._webglGeneration = 0;
    this._shaderResidentGeneration = 0;
    this._shaderResidentVariants = new Set();
    this.goreGeo = new THREE.IcosahedronGeometry(0.08, 0);
    this.goreMat = new THREE.MeshStandardMaterial({ color: 0x3a3236, roughness: 0.75 });   // must read in the dark

    this._setupRenderer();
    this._setupScene();
    this._buildGrain();
    this._initCurrentGpuResidency();
    // Submit the named full default-surface activation before the remaining CPU
    // world is assembled. Its nonblocking fence can finish during construction,
    // rather than competing with an immediate Wake click on the first game rAF.
    if (!TEST_MODE || Q.has('warmup')) this._advanceReducedSurfaceBootstrap();
    // Start only the three Stage-B-owned signatures while the remaining
    // CPU world is assembled. Each captured WebGLProgram is polled directly so
    // the shared material cannot make one variant accidentally certify the
    // other. A fenced full-surface clear and the later real renders remain the
    // sole residency certifications; no unmeasured startup draw is hidden here.
    this._beginReducedBootstrapCompile('mesh-basic');
    this._beginReducedBootstrapCompile('instanced-basic');
    this._beginReducedBootstrapCompile('grain');
    this._buildGorePool();
    this._buildImpactFx();

    this.audio = new GameAudio();
    // ?mute=1: audio never initializes (every call no-ops pre-init) — the
    // headless gate wedges inside native WebAudio under arena load; the sim
    // doesn't need ears, and real browsers keep the full soundscape.
    if (Q.has('mute')) this.audio.init = () => {};
    else this.audio.prepare();
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
    const outsideRenderStart = this.scene.children.length;
    buildOutside(this);
    // Shader residency works from explicit authored ownership boundaries. Keep
    // the outside snapshot now, while the builder's roots are contiguous, so a
    // later warmup never has to rediscover them by walking the assembled scene.
    this.outsideRenderRoots = this.scene.children.slice(outsideRenderStart);
    this.atmosphere = buildAtmosphere(this);
    this.finale = new Finale(this);
    if (this.houseMirror?.pool) {
      this.houseMirror.pool.onFailure = (failure) =>
        this._handleMirrorRuntimeFailure('house', failure);
      this.houseMirror.pool.onPoolChanged = (change) =>
        this._handleMirrorPoolChanged('house', change);
    }
    if (this.finale?.mirrors) {
      this.finale.mirrors.onFailure = (failure) =>
        this._handleMirrorRuntimeFailure('finale', failure);
      this.finale.mirrors.onPoolChanged = (change) =>
        this._handleMirrorPoolChanged('finale', change);
    }
    // World.box() is intentionally merged by material only after every district
    // has authored its static shell. Keep the small set of resulting meshes as
    // an explicit ownership boundary: a mirror can reveal parts of these large
    // shared buffers that are outside the player's current frustum, so its
    // bounded owner-preload cannot infer them from the earlier builder roots.
    const staticWorldRenderStart = this.scene.children.length;
    this.world.finishStatic();
    this.staticWorldRenderRoots = this.scene.children.slice(staticWorldRenderStart);
    this.underfalls?.bindStaticShell?.();
    this.world.buildLights(this.scene);
    this.world.attachCandlePool(this.scene);

    this.skull = new Skull({ scene: this.scene, camera: this.camera, audio: this.audio, world: this.world, mats: this.mats, variant: Q.get('skull') });
    this.skull.setLayers((o) => o.layers.set(LAYER_HELD));
    this.initializeFlameCarry(this.skull);
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
    this.holdLight = new THREE.PointLight(0xd8bb90, 2.0, 2.0, 2.0);
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
    this._buildShaderBallast();

    this.input = new InputState();
    this._wireInput();
    this._wireOverlays();
    this.player.onStep = (surf) => this.director.onPlayerStep(surf);

    const spawn = this.director.getSpawn('bedroom');
    this.player.pos.set(spawn.x, 3.6, spawn.z);
    this.player.yaw = spawn.yaw;
    this.player._sync(0);
    this.checkpoint('bedroom');
    this.world.freezeMoonShadow(this.renderer, this.scene, this.camera);

    this._exposeDebug();
    this._scheduleShaderWarmup();
    this.bootTiming.constructedAt = performance.now();
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
    r.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this._webglGeneration++;
      this._resetCurrentGpuResidency?.('context-lost');
      this._invalidateShaderWarmup('context-lost');
    });
    r.domElement.addEventListener('webglcontextrestored', () => {
      // Three's own restore listener was registered inside WebGLRenderer before
      // this one, so its caches are fresh when the new generation is queued.
      this._webglGeneration++;
      this._resetCurrentGpuResidency?.('context-restored');
      // Submit the nonblocking full-surface activation in the restore event's
      // own named slice. Its fence can run before the next rAF instead of adding
      // an otherwise empty bootstrap paint to the recovery path.
      if (!TEST_MODE || Q.has('warmup')) this._advanceReducedSurfaceBootstrap?.();
      this._beginReducedBootstrapCompile?.('mesh-basic');
      this._beginReducedBootstrapCompile?.('instanced-basic');
      this._beginReducedBootstrapCompile?.('grain');
      this._dropQuality();
      // CPU-side Object3Ds survive GL loss, their buffers do not. Re-expose
      // the existing zero-scale flame representatives and impact ring until
      // the first delivered restored frame; no gameplay flag, target, light
      // or interaction is created here. The ordinary render tail retires them
      // immediately after that physical upload.
      this.flameCircuit?.primeDormantResources?.();
      if (this._impactRing) {
        this._impactRing.userData.bootPrime = true;
        this._impactRing.visible = true;
        this._impactRing.scale.setScalar(0);
        this._impactRing.material.opacity = 0;
      }
      // JS light objects survive a context loss; their GPU shadow attachment
      // does not. Re-prime it on the next physical-world paint, never inside
      // the restore callback and never with the HELD layer enabled.
      this.world?.freezeMoonShadow?.(this.renderer, this.scene, this.camera);
      this._invalidateShaderWarmup('context-restored');
      if (!this.terminal) this._scheduleShaderWarmup();
    });
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
    tint('rock', 0x48545c);
    tint('headstone', 0x7b898f);
    // The grade stopped at the front door. dirt, grass and bark own most of
    // every frame after the house, and ungraded they came out BRIGHTER than the
    // light the player is carrying — the forest floor outshone the skull's own
    // pool and the trunks were the brightest objects on screen. A carried light
    // needs something dark to carve.
    tint('grass', 0x3d4a3c);
    tint('dirt', 0x4a4239);
    tint('bark', 0x4e4a42);
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
          float a = abs(g)*0.055 + vig*(0.16 + uFear*0.42);
          gl_FragColor = vec4(vec3(0.007,0.006,0.01), clamp(a, 0., 0.88));
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.grainMat);
    quad.name = 'grain fullscreen quad';
    quad.position.z = -0.5;
    this.grainScene.add(quad);
    this.grainQuad = quad;
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

  _buildImpactFx() {
    // Keep the flash light resident from boot. Adding the old PointLight on
    // first contact changed NUM_POINT_LIGHTS and forced every visible lit
    // material to compile again -- exactly the bell/window-pulley hitch Alex
    // felt near the beginning. Zero intensity is visually free while retaining
    // a stable shader signature for every later impact.
    this._impactLight = new THREE.PointLight(0xd8cbb0, 0, 7, 1.8);
    this._impactLight.name = 'resident impact bloom';
    this._impactLight.userData.fetchImpactFx = true;
    this.scene.add(this._impactLight);

    this._impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.21, 24),
      new THREE.MeshBasicMaterial({
        color: 0xcfd6da,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this._impactRing.name = 'resident impact ring';
    this._impactRing.userData.fetchImpactFx = true;
    // One invisible title-frame draw primes the ring's exact BasicMaterial
    // variant even if Wake Up beats idle warmup. It retires immediately after
    // that render and remains draw-free until an actual impact.
    this._impactRing.userData.bootPrime = true;
    this._impactRing.frustumCulled = false;
    this._impactRing.visible = true;
    this.scene.add(this._impactRing);
    this._ringT = 0;
    this._ringIn = false;
  }

  _buildShaderBallast() {
    // Three keys every lit program by light *type and count*, even when a light
    // is many rooms away. FETCH previously exposed six different signatures
    // (6/14/15/16/18/20 lights), so the first Lambert/Standard material in each
    // district made D3D11 finalize a new program during play. These zero-energy,
    // non-shadowing slots normalize every shipping world pass to exactly:
    //   Ambient 1 + Hemisphere 1 + Directional 1 + Spot 1 + Point 16.
    // They change no illumination and add no draw calls.
    const points = Array.from({ length: 10 }, (_, index) => {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.name = `shader ballast point ${index + 1}`;
      light.castShadow = false;
      light.visible = false;
      light.userData.fetchShaderBallast = true;
      this.scene.add(light);
      return light;
    });
    const spot = new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 3, 0, 2);
    spot.name = 'shader ballast spot';
    spot.castShadow = false;
    spot.visible = false;
    spot.userData.fetchShaderBallast = true;
    spot.target.name = 'shader ballast spot target';
    this.scene.add(spot, spot.target);
    const directional = new THREE.DirectionalLight(0xffffff, 0);
    directional.name = 'shader ballast directional';
    // The live moon is the one directional shadow source in surface districts.
    // Three keys NUM_DIR_LIGHT_SHADOWS separately from light cardinality, so the
    // sealed districts need an equivalent zero-energy shadow slot as well.
    directional.castShadow = true;
    directional.shadow.autoUpdate = false;
    directional.shadow.needsUpdate = false;
    directional.visible = false;
    directional.userData.fetchShaderBallast = true;
    directional.target.name = 'shader ballast directional target';
    this.scene.add(directional, directional.target);
    const ambient = new THREE.AmbientLight(0xffffff, 0);
    ambient.name = 'shader ballast ambient';
    ambient.visible = false;
    ambient.userData.fetchShaderBallast = true;
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
    hemi.name = 'shader ballast hemisphere';
    hemi.visible = false;
    hemi.userData.fetchShaderBallast = true;
    this.scene.add(hemi);
    this._shaderBallast = {
      points, spot, directional, ambient, hemi,
      caveLights: [points[0], points[1], points[2], points[3], spot, directional],
      all: [...points, spot, directional, ambient, hemi],
      choirSwapLight: null,
      choirSwapSuppressed: false,
      authoredCensus: {
        AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
        SpotLight: 0, PointLight: 0,
      },
      reflectionCensus: {
        AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
        SpotLight: 0, PointLight: 0,
      },
      authoredLights: [],
      registryChoir: null,
      registryExactHead: null,
      registryRefreshes: 0,
      syncs: 0,
      lastCensus: {},
    };
    this._refreshShaderAuthoredLightRegistry();
    // render() reasserts the slots after every district culler and immediately
    // before Three builds its light list. Doing the same writes at 120Hz would
    // only duplicate work between paints.
    this._syncShaderBallast();
  }

  _refreshShaderAuthoredLightRegistry() {
    const ballast = this._shaderBallast;
    if (!ballast) return;
    ballast.authoredLights.length = 0;
    this.scene.traverse((object) => {
      if (object.isLight && !object.userData?.fetchShaderBallast) {
        ballast.authoredLights.push(object);
      }
    });
    ballast.registryChoir = this.enemies?.choir?.mesh || null;
    ballast.registryExactHead = this.finale?.figure?.userData?.exactHead || null;
    ballast.registryRefreshes++;
  }

  _shaderLightEffectivelyVisible(light) {
    if (!light?.visible) return false;
    let node = light;
    while (node && node !== this.scene) {
      if (!node.visible) return false;
      node = node.parent;
    }
    return node === this.scene;
  }

  _syncShaderBallast() {
    const ballast = this._shaderBallast;
    if (!ballast) return;
    ballast.syncs++;
    const choirLive = this.act === 'cave' && !!this.enemies?.choir;

    if (!ballast.choirSwapLight) {
      ballast.choirSwapLight = this.underfalls?.lights?.[0] || null;
    }
    const swap = ballast.choirSwapLight;
    if (choirLive && swap && !ballast.choirSwapSuppressed) {
      swap.visible = false;
      ballast.choirSwapSuppressed = true;
    } else if (!choirLive && ballast.choirSwapSuppressed) {
      // Underfalls owns the authored edge state; restore true only while its
      // district is live, otherwise preserve its normal culled value.
      swap.visible = this.act === 'cave';
      ballast.choirSwapSuppressed = false;
    }

    // The authored list is stable for almost the whole game. Only the live
    // Choir and Finale's exact mounted head add light-bearing roots after boot.
    // Refresh on those identity edges, never by walking the assembled scene at
    // 60 Hz. The render hot path below inspects only this small light registry.
    const choirRoot = this.enemies?.choir?.mesh || null;
    const exactHead = this.finale?.figure?.userData?.exactHead || null;
    if (ballast.registryChoir !== choirRoot || ballast.registryExactHead !== exactHead) {
      this._refreshShaderAuthoredLightRegistry();
    }

    // Count the authored rig that is *actually* visible to the physical pass.
    // Story state can remove the skull's carry/head lights before the mirror or
    // add the Choir's light in the cave; act-name folklore was therefore P14 in
    // one real ending and P17 in another. A bounded light-only census makes the
    // zero-energy remainder exact without changing any authored intensity.
    const authored = ballast.authoredCensus;
    const reflected = ballast.reflectionCensus;
    authored.AmbientLight = authored.HemisphereLight = authored.DirectionalLight = 0;
    authored.SpotLight = authored.PointLight = 0;
    reflected.AmbientLight = reflected.HemisphereLight = reflected.DirectionalLight = 0;
    reflected.SpotLight = reflected.PointLight = 0;
    const worldMask = (1 << 0) | (1 << LAYER_MAIN_ONLY);
    const reflectionMask = (1 << 0) | (1 << LAYER_DOUBLE);
    for (const light of ballast.authoredLights) {
      if (!this._shaderLightEffectivelyVisible(light)) continue;
      const type = light.type;
      if (type !== 'AmbientLight' && type !== 'HemisphereLight'
          && type !== 'DirectionalLight' && type !== 'SpotLight'
          && type !== 'PointLight') continue;
      if ((light.layers.mask & worldMask) !== 0) authored[type]++;
      if ((light.layers.mask & reflectionMask) !== 0) reflected[type]++;
    }
    const worldPointNeed = Math.max(0, 16 - authored.PointLight);
    const reflectedPointNeed = Math.max(0, 16 - reflected.PointLight);
    const commonPoints = Math.min(worldPointNeed, reflectedPointNeed);
    const worldOnlyPoints = Math.max(0, worldPointNeed - commonPoints);
    const reflectionOnlyPoints = Math.max(0, reflectedPointNeed - commonPoints);
    const points = Math.min(
      ballast.points.length, commonPoints + worldOnlyPoints + reflectionOnlyPoints,
    );
    const spot = authored.SpotLight < 1;
    const directional = authored.DirectionalLight < 1;
    const ambient = authored.AmbientLight < 1;
    const hemi = authored.HemisphereLight < 1;
    const last = ballast.lastCensus;
    last.AmbientLight = authored.AmbientLight;
    last.HemisphereLight = authored.HemisphereLight;
    last.DirectionalLight = authored.DirectionalLight;
    last.SpotLight = authored.SpotLight;
    last.PointLight = authored.PointLight;
    last.reflectionPointLight = reflected.PointLight;
    last.points = points;
    last.commonPoints = commonPoints;
    last.worldOnlyPoints = worldOnlyPoints;
    last.reflectionOnlyPoints = reflectionOnlyPoints;
    last.spot = spot;
    last.directional = directional;
    last.ambient = ambient;
    last.hemi = hemi;

    // Visibility can be overwritten by a district edge even if the semantic key
    // did not change, so these bounded writes remain authoritative.
    for (let i = 0; i < ballast.points.length; i++) {
      const light = ballast.points[i];
      light.visible = i < points;
      if (i < commonPoints) light.layers.set(0);
      else if (i < commonPoints + worldOnlyPoints) light.layers.set(LAYER_MAIN_ONLY);
      else light.layers.set(LAYER_DOUBLE);
      light.intensity = 0;
    }
    ballast.spot.visible = spot;
    ballast.directional.visible = directional;
    ballast.ambient.visible = ambient;
    ballast.hemi.visible = hemi;
    ballast.spot.intensity = 0;
    ballast.directional.intensity = 0;
    ballast.ambient.intensity = 0;
    ballast.hemi.intensity = 0;
    if (this.act === 'cave' && this.underfalls?.visibility?.allowedCaveLights) {
      const allowed = this.underfalls.visibility.allowedCaveLights;
      for (const light of ballast.all) allowed.delete(light);
      for (const light of ballast.all) {
        if (light.visible) allowed.add(light);
      }
      if (this.underfalls.visibility.metrics) {
        this.underfalls.visibility.metrics.allowedLights = allowed.size;
      }
    }
  }

  _initCurrentGpuResidency() {
    this._reducedWorldMaterial = new THREE.MeshBasicMaterial({
      color: 0x161b1c,
      fog: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // Stage B deliberately owns exactly two fallback program signatures:
    // ordinary MeshBasic and monochrome InstancedMeshBasic. Decorative lines
    // and particles wait for the hidden exact pass; compiling or drawing them
    // in the playable silhouette caused the measured 614 ms first Points frame.
    this._reducedWorldBackground = new THREE.Color(0x030608);
    this._reducedWorldFrustum = new THREE.Frustum();
    this._reducedWorldProjection = new THREE.Matrix4();
    this._reducedWorldCenter = new THREE.Vector3();
    this._reducedWorldCamera = new THREE.Vector3();
    this._gpuPrimeViewport = new THREE.Vector4();
    this._gpuPrimeScissor = new THREE.Vector4();
    this._gpuResourceIds = new WeakMap();
    this._gpuArrayIds = new WeakMap();
    this._nextGpuResourceId = 1;
    this._nextGpuArrayId = 1;

    // These tiny real-camera scenes certify the two normalized reduced
    // signatures one paint at a time. Both share one trivial geometry; the
    // InstancedMesh has no instanceColor, exactly matching production clones.
    this._reducedBootstrapScene = new THREE.Scene();
    this._reducedBootstrapScene.name = 'reduced signature bootstrap';
    this._reducedBootstrapScene.fog = this.scene.fog;
    this._reducedBootstrapRoot = new THREE.Group();
    this._reducedBootstrapRoot.matrixAutoUpdate = false;
    this._reducedBootstrapScene.add(this._reducedBootstrapRoot);
    const bootstrapGeometry = new THREE.PlaneGeometry(0.008, 0.008);
    this._reducedBootstrapMesh = new THREE.Mesh(
      bootstrapGeometry, this._reducedWorldMaterial,
    );
    this._reducedBootstrapMesh.name = 'reduced MeshBasic signature';
    this._reducedBootstrapMesh.position.set(-0.01, 0, -0.5);
    this._reducedBootstrapMesh.frustumCulled = false;
    this._reducedBootstrapRoot.add(this._reducedBootstrapMesh);
    this._reducedBootstrapInstanced = new THREE.InstancedMesh(
      bootstrapGeometry, this._reducedWorldMaterial, 1,
    );
    this._reducedBootstrapInstanced.name = 'reduced monochrome InstancedMeshBasic signature';
    this._reducedBootstrapInstanced.position.set(0.01, 0, -0.5);
    this._reducedBootstrapInstanced.setMatrixAt(0, new THREE.Matrix4());
    this._reducedBootstrapInstanced.instanceColor = null;
    this._reducedBootstrapInstanced.frustumCulled = false;
    this._reducedBootstrapRoot.add(this._reducedBootstrapInstanced);
    this._resetCurrentGpuResidency('boot');
  }

  _clearReducedWorldProgress() {
    const progress = this.currentGpuResidency?.progressive;
    if (!progress?.scene) return;
    // Clones share the live BufferGeometry and the one resident Basic material.
    // Never dispose either here: the point of this scene is to upload the live
    // resource without stealing/reparenting it from gameplay.
    while (progress.scene.children.length) {
      progress.scene.remove(progress.scene.children[progress.scene.children.length - 1]);
    }
    progress.queue.length = 0;
    progress.ownerQueue.length = 0;
    progress.deferredQueue.length = 0;
    progress.exactQueue.length = 0;
    progress.ownerExactQueue.length = 0;
    progress.deferredExactQueue.length = 0;
    progress.pendingReducedReveal.length = 0;
    progress.queued.clear();
    progress.exactQueued.clear();
    progress.ownerExactQueued.clear();
    progress.deferredExactQueued.clear();
    progress.processed.clear();
    progress.exactProcessed.clear();
    progress.exactObjects.clear();
    progress.exactFingerprints.clear();
    progress.exactAllocationFingerprints.clear();
    progress.exactResourceSeen.clear();
    progress.exactGeometryFingerprints.clear();
    progress.exactUniverse.clear();
    progress.exactCovered.clear();
    progress.geometrySeen.clear();
    progress.geometryFingerprints.clear();
    progress.admissionSeen.clear();
    progress.resourceSeen.clear();
    progress.objectFingerprints.clear();
    progress.ownerUniverse.clear();
    progress.ownerCovered.clear();
    progress.ownerHouse.clear();
    progress.ownerFinale.clear();
    progress.ownerHouseGeometries.clear();
    progress.ownerFinaleGeometries.clear();
    progress.deferredUniverse.clear();
    progress.deferredCovered.clear();
    progress.deferredGeometries.clear();
    progress.failedObjects.clear();
    progress.failedOwners.clear();
    progress.failedDeferred.clear();
    progress.omittedReduced.clear();
    progress.ownerExactOnly.clear();
    progress.deferredExactOnly.clear();
    progress.ownerExactUniverse.clear();
    progress.ownerExactCovered.clear();
    progress.deferredExactUniverse.clear();
    progress.deferredExactCovered.clear();
    progress.lastExactScanSignatures.clear();
    progress.cloneFailureEvents.length = 0;
  }

  _resetCurrentGpuResidency(reason = 'reset') {
    const priorResidency = this.currentGpuResidency;
    const priorFence = priorResidency?._surfaceFence;
    if (priorFence) {
      try {
        const gl = this.renderer?.getContext?.();
        if (gl && !gl.isContextLost?.()) gl.deleteSync?.(priorFence);
      } catch {
        // A lost context owns the stale sync object. Its driver resources are
        // already gone, and the new generation must never touch that handle.
      }
    }
    this._clearReducedWorldProgress();
    this.currentGpuResidency = {
      generation: this._webglGeneration,
      reason,
      physical: new Set(),
      reduced: new Set(),
      owners: new Set(),
      activeKey: null,
      activeSince: performance.now(),
      bootstrapGeneration: this._webglGeneration,
      bootstrapStatus: 'pending',
      bootstrapPasses: [],
      surfaceStatus: 'pending',
      surfacePasses: [],
      snapshotPasses: [],
      bootstrapNext: 0,
      bootstrapCompiles: {},
      exactPasses: [],
      exactPreloadPasses: [],
      exactScanPasses: [],
      universeFinalizePasses: [],
      reducedPasses: [],
      ownerPasses: [],
      ownerUniverses: [],
      deferredUniverses: [],
      skullWorldPasses: [],
      errors: [],
      maxExactMs: 0,
      maxExactPreloadMs: 0,
      maxReducedPrimeMs: 0,
      maxOwnerMs: 0,
      reducedFrames: 0,
      fullFrames: 0,
      ownerFullFrames: 0,
      deferredFullFrames: 0,
      progressive: null,
      skullWorldReady: false,
      skullWorldReadyKey: null,
    };
    Object.defineProperties(this.currentGpuResidency, {
      _surfaceFence: { value: null, writable: true, configurable: true },
      _surfaceEntry: { value: null, writable: true, configurable: true },
    });
  }

  _beginReducedBootstrapCompile(kind) {
    // Deterministic suites opt into all GPU warm work with ?warmup=1. Preserve
    // their explicit no-warmup mode instead of leaking this early submission
    // around _scheduleShaderWarmup's test guard.
    if (TEST_MODE && !Q.has('warmup')) return null;
    const object = kind === 'mesh-basic'
      ? this._reducedBootstrapMesh
      : kind === 'instanced-basic'
        ? this._reducedBootstrapInstanced
        : kind === 'grain'
          ? this.grainQuad
          : null;
    if (!object) return null;
    const camera = kind === 'grain' ? this.grainCam : this.camera;
    const targetScene = kind === 'grain' ? this.grainScene : this._reducedBootstrapScene;
    const material = object.material;
    if (!camera || !targetScene || !material || Array.isArray(material)) return null;
    const residency = this.currentGpuResidency;
    if (!residency || residency.generation !== this._webglGeneration
        || this.renderer.getContext()?.isContextLost?.()) return null;
    const existing = residency.bootstrapCompiles?.[kind];
    if (existing?.generation === this._webglGeneration) {
      return existing;
    }

    const renderer = this.renderer;
    const startedAt = performance.now();
    const compile = {
      generation: this._webglGeneration,
      kind,
      mode: typeof renderer.compile === 'function'
        ? 'compile-plus-exact-readiness-poll'
        : 'direct-render',
      status: 'pending',
      startedAt,
      completedAt: null,
      submitDurationMs: 0,
      waitDurationMs: 0,
      submitOverBudget: false,
      readinessPolls: 0,
      maxReadinessPollDurationMs: 0,
      maxSynchronousSliceMs: 0,
      completionSliceDurationMs: 0,
      finalizationStatus: 'pending',
      finalizationDurationMs: 0,
      program: null,
      programOwner: null,
      afterSubmission: null,
      atCompletion: null,
      before: {
        programs: renderer.info.programs?.length || 0,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      },
      error: null,
    };
    residency.bootstrapCompiles[kind] = compile;

    if (typeof renderer.compile !== 'function') {
      compile.status = 'ready';
      compile.finalizationStatus = 'ready';
      compile.completedAt = performance.now();
      compile.waitDurationMs = compile.completedAt - startedAt;
      return compile;
    }

    let program;
    try {
      // compileAsync calls compile() and then repeatedly looks up the material's
      // mutable currentProgram. Both exact signatures intentionally share one
      // production material, so overlapping compileAsync calls would make both
      // promises observe only the last variant. Submit each exact object root
      // with compile(), capture its actual program immediately, and reproduce
      // Three's nonblocking isReady poll against that immutable identity. The
      // synchronous submission is measured and hard-gated like every other
      // bootstrap slice; no process-cold work escapes the telemetry.
      renderer.compile(
        object,
        camera,
        targetScene,
      );
      program = renderer.properties?.get?.(material)?.currentProgram;
      if (!program?.isReady) {
        throw new Error(`compiled ${kind} WebGLProgram is unavailable after submission`);
      }
      Object.defineProperty(compile, 'programRef', {
        value: program,
        enumerable: false,
      });
    } catch (caught) {
      compile.submitDurationMs = performance.now() - startedAt;
      compile.completedAt = performance.now();
      compile.waitDurationMs = compile.completedAt - startedAt;
      compile.status = 'failed';
      compile.error = `exact program submission: ${caught?.message || caught}`;
      return compile;
    }

    compile.submitDurationMs = performance.now() - startedAt;
    compile.submitOverBudget = compile.submitDurationMs >= 100;
    compile.afterSubmission = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      program: {
        id: program.id ?? null,
        cacheKey: `${program.cacheKey || ''}`,
      },
    };

    const pollExactProgram = () => {
      if (this.currentGpuResidency !== residency
          || residency.bootstrapCompiles?.[kind] !== compile
          || compile.generation !== this._webglGeneration
          || compile.status !== 'pending') return;
      const pollStartedAt = performance.now();
      const synchronousSliceStartedAt = compile.readinessPolls === 0
        ? startedAt
        : pollStartedAt;
      compile.readinessPolls++;
      try {
        const ready = program.isReady() === true;
        const pollDurationMs = performance.now() - pollStartedAt;
        compile.maxReadinessPollDurationMs = Math.max(
          compile.maxReadinessPollDurationMs,
          pollDurationMs,
        );
        if (!ready) {
          compile.maxSynchronousSliceMs = Math.max(
            compile.maxSynchronousSliceMs,
            performance.now() - synchronousSliceStartedAt,
          );
          setTimeout(pollExactProgram, 10);
          return;
        }
        compile.completedAt = performance.now();
        compile.waitDurationMs = compile.completedAt - startedAt;
        compile.atCompletion = {
          programs: renderer.info.programs?.length || 0,
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
          completionMode: 'captured-program-isReady',
          program: {
            id: program.id ?? null,
            cacheKey: `${program.cacheKey || ''}`,
            ready: true,
          },
        };
        compile.status = 'ready';
        this._finalizeReducedBootstrapProgram(compile);
        compile.completionSliceDurationMs = performance.now() - pollStartedAt;
        compile.maxSynchronousSliceMs = Math.max(
          compile.maxSynchronousSliceMs,
          performance.now() - synchronousSliceStartedAt,
        );
      } catch (caught) {
        compile.maxReadinessPollDurationMs = Math.max(
          compile.maxReadinessPollDurationMs,
          performance.now() - pollStartedAt,
        );
        compile.completedAt = performance.now();
        compile.waitDurationMs = compile.completedAt - startedAt;
        compile.status = 'failed';
        compile.error = `exact program completion: ${caught?.message || caught}`;
        compile.maxSynchronousSliceMs = Math.max(
          compile.maxSynchronousSliceMs,
          performance.now() - synchronousSliceStartedAt,
        );
      }
    };
    pollExactProgram();
    return compile;
  }

  _finalizeReducedBootstrapProgram(compile) {
    if (!compile || compile.generation !== this._webglGeneration
        || compile.status !== 'ready' || compile.finalizationStatus !== 'pending') {
      return compile;
    }
    const object = compile.kind === 'mesh-basic'
      ? this._reducedBootstrapMesh
      : compile.kind === 'instanced-basic'
        ? this._reducedBootstrapInstanced
        : compile.kind === 'grain'
          ? this.grainQuad
          : null;
    const startedAt = performance.now();
    try {
      // WebGLProgram intentionally defers link diagnostics plus active
      // uniform/attribute reflection until its first draw. Materialize that
      // exact captured program on its own measured paint; the subsequent real
      // draw still owns geometry upload and is the only residency certificate.
      const program = compile.programRef;
      if (!object || !program?.getUniforms || !program?.getAttributes) {
        throw new Error(`compiled ${compile.kind} WebGLProgram is unavailable for finalization`);
      }
      if (compile.atCompletion?.program?.id !== (program.id ?? null)
          || compile.atCompletion?.program?.cacheKey !== `${program.cacheKey || ''}`) {
        throw new Error(`completed ${compile.kind} WebGLProgram identity changed before finalization`);
      }
      const gl = this.renderer.getContext();
      const linkStatus = gl.getProgramParameter(program.program, gl.LINK_STATUS);
      if (!linkStatus) {
        const programLog = gl.getProgramInfoLog(program.program) || '(no program log)';
        const vertexLog = gl.getShaderInfoLog(program.vertexShader) || '(no vertex log)';
        const fragmentLog = gl.getShaderInfoLog(program.fragmentShader) || '(no fragment log)';
        throw new Error(`${compile.kind} link failed: ${programLog}; vertex: ${vertexLog}; fragment: ${fragmentLog}`);
      }

      // Three's debug path retrieves all three driver logs even after exact
      // readiness and LINK_STATUS have proved this built-in program complete
      // and valid. On ANGLE/D3D11 those redundant successful log reads were the
      // measured 121.6 ms cliff. Suppress them only for this already-validated
      // reflection, then restore the renderer policy.
      const debug = this.renderer.debug;
      const previousShaderErrorCheck = debug?.checkShaderErrors;
      if (debug) debug.checkShaderErrors = false;
      try {
        program.getUniforms();
        program.getAttributes();
      } finally {
        if (debug) debug.checkShaderErrors = previousShaderErrorCheck;
      }
      const cacheKey = `${program.cacheKey || ''}`;
      const material = object.material;
      // Three prefixes custom ShaderMaterial cache keys with two shader-cache
      // IDs. Those numeric IDs are deliberately rebuilt after context restore;
      // the shader sources and every remaining program parameter are stable.
      // Preserve the raw per-generation key for exact intra-generation checks,
      // and expose the source-bearing semantic identity for cross-generation
      // equality instead of pretending volatile allocator IDs are semantics.
      const shaderIdentity = material?.isShaderMaterial ? {
        vertexShader: material.vertexShader,
        fragmentShader: material.fragmentShader,
        defines: Object.entries(material.defines || {})
          .sort(([left], [right]) => left.localeCompare(right)),
        glslVersion: material.glslVersion || null,
        raw: material.isRawShaderMaterial === true,
      } : null;
      compile.program = {
        id: program.id ?? null,
        name: program.name || null,
        cacheKey,
        semanticCacheKey: shaderIdentity
          ? cacheKey.split(',').slice(2).join(',')
          : cacheKey,
        volatileCachePrefixFields: shaderIdentity ? 2 : 0,
        shaderIdentity,
        linkStatus,
        diagnosticsMode: 'exact-readiness-plus-link-status',
      };
      compile.programOwner = {
        object: object.name,
        objectType: object.type,
        isMesh: object.isMesh === true,
        isInstancedMesh: object.isInstancedMesh === true,
        objectUuid: object.uuid,
        geometryUuid: object.geometry?.uuid || null,
        materialType: object.material?.type || null,
        materialUuid: object.material?.uuid || null,
      };
      compile.finalizationStatus = 'ready';
    } catch (caught) {
      compile.finalizationStatus = 'failed';
      compile.status = 'failed';
      compile.error = `compiled program finalization: ${caught?.message || caught}`;
    } finally {
      compile.finalizationDurationMs = performance.now() - startedAt;
    }
    return compile;
  }

  _reducedBootstrapReady(kind = null) {
    const residency = this.currentGpuResidency;
    if (!residency || residency.generation !== this._webglGeneration) return false;
    if (kind) return residency.bootstrapPasses.some((entry) =>
      entry.generation === this._webglGeneration
      && entry.kind === kind && entry.error == null);
    return residency.bootstrapStatus === 'ready';
  }

  _advanceReducedSurfaceBootstrap() {
    const residency = this.currentGpuResidency;
    const renderer = this.renderer;
    const gl = renderer?.getContext?.();
    if (!residency || residency.generation !== this._webglGeneration || !gl
        || this.terminal || gl.isContextLost?.()) return null;
    if (residency.surfaceStatus === 'ready' || residency.surfaceStatus === 'failed') return null;

    const finish = (entry, error = null, sliceStartedAt = null) => {
      const deleteStartedAt = performance.now();
      try {
        if (residency._surfaceFence && !gl.isContextLost?.()) {
          gl.deleteSync(residency._surfaceFence);
        }
      } catch (caught) {
        error ||= `fence deletion: ${caught?.message || caught}`;
      }
      entry.waitDurationMs = performance.now() - entry.submittedAt;
      entry.error = error;
      entry.status = error ? 'failed' : 'ready';
      entry.generationStable = entry.generation === this._webglGeneration;
      residency._surfaceFence = null;
      residency._surfaceEntry = null;
      residency.surfacePasses.push(entry);
      residency.surfaceStatus = error ? 'failed' : 'ready';
      if (error) residency.errors.push(`reduced bootstrap ${entry.kind}: ${error}`);
      const completedAt = performance.now();
      const completeSliceDurationMs = completedAt - (sliceStartedAt ?? deleteStartedAt);
      entry.maxSynchronousSliceMs = Math.max(
        entry.maxSynchronousSliceMs || 0,
        completeSliceDurationMs,
      );
      if (sliceStartedAt === entry.submissionSliceStartedAt) {
        entry.submitDurationMs = Math.max(entry.submitDurationMs, completeSliceDurationMs);
      }
      entry.durationMs = entry.maxSynchronousSliceMs;
      entry.completedAt = completedAt;
      return entry;
    };

    if (residency._surfaceFence && residency._surfaceEntry) {
      const entry = residency._surfaceEntry;
      const pollStartedAt = performance.now();
      let result = null;
      let pollError = null;
      try {
        result = gl.clientWaitSync(residency._surfaceFence, 0, 0);
      } catch (caught) {
        pollError = `fence poll: ${caught?.message || caught}`;
      }
      const pollDurationMs = performance.now() - pollStartedAt;
      entry.polls++;
      entry.maxPollDurationMs = Math.max(entry.maxPollDurationMs, pollDurationMs);
      entry.maxSynchronousSliceMs = Math.max(entry.maxSynchronousSliceMs, pollDurationMs);
      entry.lastWaitResult = result;
      if (pollError) return finish(entry, pollError, pollStartedAt);
      if (result === gl.WAIT_FAILED) {
        return finish(entry, 'clientWaitSync returned WAIT_FAILED', pollStartedAt);
      }
      if (result === gl.TIMEOUT_EXPIRED) {
        entry.maxSynchronousSliceMs = Math.max(
          entry.maxSynchronousSliceMs,
          performance.now() - pollStartedAt,
        );
        return null;
      }
      if (result !== gl.ALREADY_SIGNALED && result !== gl.CONDITION_SATISFIED) {
        return finish(entry, `clientWaitSync returned unexpected status ${result}`, pollStartedAt);
      }
      entry.completionStatus = result === gl.ALREADY_SIGNALED
        ? 'already-signaled' : 'condition-satisfied';
      return finish(entry, null, pollStartedAt);
    }

    const submissionSliceStartedAt = performance.now();
    const before = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    const entry = {
      generation: this._webglGeneration,
      kind: 'default-surface-clear-fence',
      status: 'submitting',
      submittedAt: performance.now(),
      submissionSliceStartedAt,
      rendererSubmitDurationMs: 0,
      submitDurationMs: 0,
      durationMs: 0,
      waitDurationMs: 0,
      polls: 0,
      maxPollDurationMs: 0,
      maxSynchronousSliceMs: 0,
      width: 0,
      height: 0,
      programDelta: 0,
      textureDelta: 0,
      geometryDelta: 0,
      stateRestored: false,
      generationStable: true,
      completionStatus: null,
      lastWaitResult: null,
      error: null,
    };
    const previousViewport = new THREE.Vector4();
    const previousScissor = new THREE.Vector4();
    const previousClearColor = new THREE.Color();
    const drawingSize = new THREE.Vector2();
    const logicalSize = new THREE.Vector2();
    let previousTarget = null;
    let previousScissorTest = false;
    let previousClearAlpha = 1;
    const previousAutoClear = renderer.autoClear;
    const restoreErrors = [];
    let sync = null;
    let error = null;
    const submittedAt = performance.now();
    try {
      if (typeof gl.fenceSync !== 'function' || typeof gl.clientWaitSync !== 'function') {
        throw new Error('WebGL2 fenceSync/clientWaitSync unavailable');
      }
      previousTarget = renderer.getRenderTarget();
      renderer.getViewport(previousViewport);
      renderer.getScissor(previousScissor);
      previousScissorTest = renderer.getScissorTest();
      renderer.getClearColor(previousClearColor);
      previousClearAlpha = renderer.getClearAlpha();
      renderer.getDrawingBufferSize(drawingSize);
      renderer.getSize(logicalSize);
      entry.width = Math.max(1, Math.floor(drawingSize.x));
      entry.height = Math.max(1, Math.floor(drawingSize.y));
      entry.logicalWidth = Math.max(1, Math.floor(logicalSize.x));
      entry.logicalHeight = Math.max(1, Math.floor(logicalSize.y));
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, entry.logicalWidth, entry.logicalHeight);
      renderer.setScissor(0, 0, entry.logicalWidth, entry.logicalHeight);
      renderer.setScissorTest(true);
      renderer.autoClear = true;
      renderer.setClearColor(this._reducedWorldBackground, 1);
      // Color and depth activate the complete default surface. Avoid the
      // unnecessary stencil clear: Three r161 forces its write mask and would
      // otherwise mutate state that this transaction does not own.
      renderer.clear(true, true, false);
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) throw new Error('fenceSync returned null');
      gl.flush();
    } catch (caught) {
      error = `surface submission: ${caught?.message || caught}`;
    } finally {
      try { renderer.setRenderTarget(previousTarget); }
      catch (caught) { restoreErrors.push(`target: ${caught?.message || caught}`); }
      try { renderer.setViewport(previousViewport); }
      catch (caught) { restoreErrors.push(`viewport: ${caught?.message || caught}`); }
      try { renderer.setScissor(previousScissor); }
      catch (caught) { restoreErrors.push(`scissor: ${caught?.message || caught}`); }
      try { renderer.setScissorTest(previousScissorTest); }
      catch (caught) { restoreErrors.push(`scissor test: ${caught?.message || caught}`); }
      renderer.autoClear = previousAutoClear;
      try { renderer.setClearColor(previousClearColor, previousClearAlpha); }
      catch (caught) { restoreErrors.push(`clear color: ${caught?.message || caught}`); }
    }
    entry.rendererSubmitDurationMs = performance.now() - submittedAt;
    const after = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    entry.programDelta = after.programs - before.programs;
    entry.textureDelta = after.textures - before.textures;
    entry.geometryDelta = after.geometries - before.geometries;
    const checkViewport = new THREE.Vector4();
    const checkScissor = new THREE.Vector4();
    const checkClearColor = new THREE.Color();
    try {
      renderer.getViewport(checkViewport);
      renderer.getScissor(checkScissor);
      renderer.getClearColor(checkClearColor);
      if (renderer.getRenderTarget() !== previousTarget) restoreErrors.push('target mismatch');
      if (!checkViewport.equals(previousViewport)) restoreErrors.push('viewport mismatch');
      if (!checkScissor.equals(previousScissor)) restoreErrors.push('scissor mismatch');
      if (renderer.getScissorTest() !== previousScissorTest) restoreErrors.push('scissor-test mismatch');
      if (renderer.autoClear !== previousAutoClear) restoreErrors.push('autoClear mismatch');
      if (!checkClearColor.equals(previousClearColor)
          || renderer.getClearAlpha() !== previousClearAlpha) restoreErrors.push('clear-color mismatch');
    } catch (caught) {
      restoreErrors.push(`verification: ${caught?.message || caught}`);
    }
    entry.stateRestored = restoreErrors.length === 0;
    if (restoreErrors.length) error ||= `state restoration: ${restoreErrors.join('; ')}`;
    if (entry.programDelta || entry.textureDelta || entry.geometryDelta) {
      error ||= `surface clear created resources P${entry.programDelta}/T${entry.textureDelta}/G${entry.geometryDelta}`;
    }
    entry.submitDurationMs = performance.now() - submissionSliceStartedAt;
    entry.maxSynchronousSliceMs = entry.submitDurationMs;
    if (error || !sync) {
      residency._surfaceFence = sync;
      residency._surfaceEntry = entry;
      return finish(entry, error || 'surface fence was not created', submissionSliceStartedAt);
    }
    entry.status = 'waiting';
    residency._surfaceFence = sync;
    residency._surfaceEntry = entry;
    residency.surfaceStatus = 'waiting';
    entry.submitDurationMs = performance.now() - submissionSliceStartedAt;
    entry.maxSynchronousSliceMs = Math.max(
      entry.maxSynchronousSliceMs,
      entry.submitDurationMs,
    );
    return null;
  }

  _resumeShaderWarmupAfterBootstrap() {
    const state = this.shaderWarmup;
    const run = this._shaderWarmupRun;
    const residency = this.currentGpuResidency;
    const reducedReady = !this.started || (!!residency?.activeKey
      && residency.reduced.has(residency.activeKey));
    if (!state || state.status !== 'bootstrap-wait' || !run
        || state.generation !== this._webglGeneration
        || !this._reducedBootstrapReady()
        || !reducedReady
        || state.bootstrapResumeScheduled) return;
    state.bootstrapResumeScheduled = true;
    const handle = setTimeout(() => {
      if (state !== this.shaderWarmup || state.generation !== this._webglGeneration) return;
      state.bootstrapResumeScheduled = false;
      if (state.status === 'bootstrap-wait') run();
    }, 0);
    this._shaderWarmupCancel = () => clearTimeout(handle);
  }

  _advanceReducedBootstrap() {
    const residency = this.currentGpuResidency;
    const warmup = this.shaderWarmup;
    if (!residency || residency.generation !== this._webglGeneration
        || !warmup || warmup.status === 'skipped' || this.terminal
        || this.renderer.getContext()?.isContextLost?.()) return null;
    if (residency.bootstrapStatus === 'ready' || residency.bootstrapStatus === 'failed') {
      return null;
    }
    const surfaceEntry = this._advanceReducedSurfaceBootstrap();
    if (residency.surfaceStatus !== 'ready') return surfaceEntry;
    // The surface fence and the first real signature draw must settle on
    // separate browser tasks. Their individual synchronous maxima remain named.
    if (surfaceEntry) return surfaceEntry;
    const stages = ['mesh-basic', 'instanced-basic', 'grain'];
    const kind = stages[residency.bootstrapNext];
    if (!kind) {
      residency.bootstrapStatus = 'ready';
      this._resumeShaderWarmupAfterBootstrap();
      return null;
    }

    const compile = this._beginReducedBootstrapCompile(kind);
    if (compile?.status === 'pending') return null;
    if (compile?.status === 'ready' && compile.finalizationStatus === 'pending') {
      this._finalizeReducedBootstrapProgram(compile);
      // Keep program reflection and the real draw on separate browser tasks.
      // durationMs later reports their maximum, so neither slice is hidden.
      return null;
    }
    if (compile?.status === 'failed') {
      const before = compile.before;
      const compileAfter = compile.afterSubmission || {
        programs: this.renderer.info.programs?.length || 0,
        textures: this.renderer.info.memory.textures,
        geometries: this.renderer.info.memory.geometries,
      };
      const entry = {
        generation: this._webglGeneration,
        kind,
        durationMs: Math.max(
          compile.submitDurationMs,
          compile.maxSynchronousSliceMs,
          compile.finalizationDurationMs,
        ),
        renderDurationMs: 0,
        compileMode: compile.mode,
        compileSubmitDurationMs: compile.submitDurationMs,
        compileWaitDurationMs: compile.waitDurationMs,
        compileSubmitOverBudget: compile.submitOverBudget,
        compileReadinessPolls: compile.readinessPolls,
        compileMaxReadinessPollDurationMs: compile.maxReadinessPollDurationMs,
        compileMaxSynchronousSliceMs: compile.maxSynchronousSliceMs,
        compileCompletionSliceDurationMs: compile.completionSliceDurationMs,
        compileFinalizationDurationMs: compile.finalizationDurationMs,
        program: compile.program,
        programOwner: compile.programOwner,
        compileCompletion: compile.atCompletion,
        programDelta: compileAfter.programs - before.programs,
        textureDelta: compileAfter.textures - before.textures,
        geometryDelta: compileAfter.geometries - before.geometries,
        compileProgramDelta: compileAfter.programs - before.programs,
        compileTextureDelta: compileAfter.textures - before.textures,
        compileGeometryDelta: compileAfter.geometries - before.geometries,
        renderProgramDelta: 0,
        renderTextureDelta: 0,
        renderGeometryDelta: 0,
        error: compile.error || `exact ${kind} asynchronous preparation failed`,
      };
      residency.bootstrapPasses.push(entry);
      residency.bootstrapStatus = 'failed';
      residency.errors.push(`reduced bootstrap ${kind}: ${entry.error}`);
      return entry;
    }

    const renderer = this.renderer;
    const camera = this.camera;
    const before = compile?.before || {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    const renderBefore = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    let previousTarget = null;
    let targetRead = false;
    const previousViewport = new THREE.Vector4();
    const previousScissor = new THREE.Vector4();
    let viewportRead = false;
    let scissorRead = false;
    let previousScissorTest = false;
    const previousAutoClear = renderer.autoClear;
    const previousCameraMask = camera.layers.mask;
    const startedAt = performance.now();
    const restoreErrors = [];
    let error = null;
    try {
      previousTarget = renderer.getRenderTarget();
      targetRead = true;
      renderer.getViewport(previousViewport);
      viewportRead = true;
      renderer.getScissor(previousScissor);
      scissorRead = true;
      previousScissorTest = renderer.getScissorTest();
      renderer.setRenderTarget(null);
      const certificationSize = kind === 'mesh-basic'
        ? renderer.getSize(new THREE.Vector2())
        : new THREE.Vector2(1, 1);
      renderer.setViewport(0, 0,
        Math.max(1, Math.floor(certificationSize.x)),
        Math.max(1, Math.floor(certificationSize.y)));
      renderer.setScissor(0, 0,
        Math.max(1, Math.floor(certificationSize.x)),
        Math.max(1, Math.floor(certificationSize.y)));
      renderer.setScissorTest(true);
      renderer.autoClear = true;
      if (kind === 'grain') {
        renderer.render(this.grainScene, this.grainCam);
      } else {
        this._reducedBootstrapScene.background = this._reducedWorldBackground;
        this._reducedBootstrapScene.fog = this.scene.fog;
        camera.updateMatrixWorld(true);
        this._reducedBootstrapRoot.matrix.copy(camera.matrixWorld);
        this._reducedBootstrapRoot.matrixWorld.copy(camera.matrixWorld);
        this._reducedBootstrapRoot.matrixWorldNeedsUpdate = true;
        this._reducedBootstrapMesh.visible = kind === 'mesh-basic';
        this._reducedBootstrapInstanced.visible = kind === 'instanced-basic';
        camera.layers.set(0);
        renderer.render(this._reducedBootstrapScene, camera);
      }
    } catch (caught) {
      error = caught;
    } finally {
      camera.layers.mask = previousCameraMask;
      if (targetRead) {
        try { renderer.setRenderTarget(previousTarget); }
        catch (caught) { restoreErrors.push(`target: ${caught?.message || caught}`); }
      }
      if (viewportRead) {
        try { renderer.setViewport(previousViewport); }
        catch (caught) { restoreErrors.push(`viewport: ${caught?.message || caught}`); }
      }
      if (scissorRead) {
        try { renderer.setScissor(previousScissor); }
        catch (caught) { restoreErrors.push(`scissor: ${caught?.message || caught}`); }
      }
      if (targetRead || viewportRead || scissorRead) {
        try { renderer.setScissorTest(previousScissorTest); }
        catch (caught) { restoreErrors.push(`scissor test: ${caught?.message || caught}`); }
      }
      renderer.autoClear = previousAutoClear;
      this._reducedBootstrapMesh.visible = false;
      this._reducedBootstrapInstanced.visible = false;
    }

    const checkViewport = new THREE.Vector4();
    const checkScissor = new THREE.Vector4();
    try {
      renderer.getViewport(checkViewport);
      renderer.getScissor(checkScissor);
      if (targetRead && renderer.getRenderTarget() !== previousTarget) restoreErrors.push('target mismatch');
      if (viewportRead && !checkViewport.equals(previousViewport)) restoreErrors.push('viewport mismatch');
      if (scissorRead && !checkScissor.equals(previousScissor)) restoreErrors.push('scissor mismatch');
      if ((targetRead || viewportRead || scissorRead)
          && renderer.getScissorTest() !== previousScissorTest) restoreErrors.push('scissor-test mismatch');
      if (renderer.autoClear !== previousAutoClear) restoreErrors.push('autoClear mismatch');
      if (camera.layers.mask !== previousCameraMask) restoreErrors.push('camera-mask mismatch');
    } catch (caught) {
      restoreErrors.push(`verification: ${caught?.message || caught}`);
    }
    const renderDurationMs = performance.now() - startedAt;
    const compileSubmitDurationMs = compile?.submitDurationMs || 0;
    const compileFinalizationDurationMs = compile?.finalizationDurationMs || 0;
    const compileMaxSynchronousSliceMs = compile?.maxSynchronousSliceMs || 0;
    const durationMs = Math.max(
      renderDurationMs,
      compileSubmitDurationMs,
      compileMaxSynchronousSliceMs,
      compileFinalizationDurationMs,
    );
    const transactionError = error?.message || (restoreErrors.length ? restoreErrors.join('; ') : null);
    const after = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    const compileAfter = compile?.afterSubmission || before;
    const compileProgramDelta = compileAfter.programs - before.programs;
    const compileTextureDelta = compileAfter.textures - before.textures;
    const compileGeometryDelta = compileAfter.geometries - before.geometries;
    const renderProgramDelta = after.programs - renderBefore.programs;
    const renderTextureDelta = after.textures - renderBefore.textures;
    const renderGeometryDelta = after.geometries - renderBefore.geometries;
    const entry = {
      generation: this._webglGeneration,
      kind,
      durationMs,
      renderDurationMs,
      // The two exact program submissions overlap before either real render.
      // Attribute each signature only the resources created by its measured
      // submission and certification slices, never unrelated intervening work.
      programDelta: compile ? compileProgramDelta + renderProgramDelta : after.programs - before.programs,
      textureDelta: compile ? compileTextureDelta + renderTextureDelta : after.textures - before.textures,
      geometryDelta: compile ? compileGeometryDelta + renderGeometryDelta : after.geometries - before.geometries,
      error: transactionError,
    };
    if (compile) {
      entry.compileMode = compile.mode;
      entry.compileSubmitDurationMs = compileSubmitDurationMs;
      entry.compileWaitDurationMs = compile.waitDurationMs;
      entry.compileSubmitOverBudget = compile.submitOverBudget;
      entry.compileReadinessPolls = compile.readinessPolls;
      entry.compileMaxReadinessPollDurationMs = compile.maxReadinessPollDurationMs;
      entry.compileMaxSynchronousSliceMs = compileMaxSynchronousSliceMs;
      entry.compileCompletionSliceDurationMs = compile.completionSliceDurationMs;
      entry.compileFinalizationDurationMs = compileFinalizationDurationMs;
      entry.program = compile.program;
      entry.programOwner = compile.programOwner;
      entry.compileCompletion = compile.atCompletion;
      entry.compileProgramDelta = compileProgramDelta;
      entry.compileTextureDelta = compileTextureDelta;
      entry.compileGeometryDelta = compileGeometryDelta;
      entry.renderProgramDelta = renderProgramDelta;
      entry.renderTextureDelta = renderTextureDelta;
      entry.renderGeometryDelta = renderGeometryDelta;
    }
    residency.bootstrapPasses.push(entry);
    if (entry.error) {
      residency.bootstrapStatus = 'failed';
      residency.errors.push(`reduced bootstrap ${kind}: ${entry.error}`);
      return entry;
    }
    residency.bootstrapNext++;
    if (residency.bootstrapNext >= stages.length) {
      residency.bootstrapStatus = 'ready';
      this._resumeShaderWarmupAfterBootstrap();
    } else {
      residency.bootstrapStatus = 'pending';
    }
    return entry;
  }

  _makeReducedWorldProgress(key) {
    const scene = new THREE.Scene();
    scene.name = `current silhouette ${key}`;
    scene.background = this._reducedWorldBackground;
    scene.fog = this.scene.fog;
    return {
      key,
      scene,
      queue: [],
      ownerQueue: [],
      deferredQueue: [],
      exactQueue: [],
      ownerExactQueue: [],
      deferredExactQueue: [],
      pendingReducedReveal: [],
      queued: new Set(),
      exactQueued: new Set(),
      ownerExactQueued: new Set(),
      deferredExactQueued: new Set(),
      processed: new Set(),
      exactProcessed: new Set(),
      exactObjects: new Map(),
      exactFingerprints: new Map(),
      exactAllocationFingerprints: new Map(),
      exactResourceSeen: new Set(),
      exactGeometryFingerprints: new Set(),
      exactUniverse: new Set(),
      exactCovered: new Set(),
      geometrySeen: new Set(),
      geometryFingerprints: new Set(),
      admissionSeen: new Set(),
      resourceSeen: new Set(),
      objectFingerprints: new Map(),
      ownerUniverse: new Set(),
      ownerCovered: new Set(),
      ownerHouse: new Set(),
      ownerFinale: new Set(),
      ownerHouseGeometries: new Set(),
      ownerFinaleGeometries: new Set(),
      deferredUniverse: new Set(),
      deferredCovered: new Set(),
      deferredGeometries: new Set(),
      failedObjects: new Set(),
      failedOwners: new Set(),
      failedDeferred: new Set(),
      omittedReduced: new Map(),
      ownerExactOnly: new Set(),
      deferredExactOnly: new Set(),
      ownerExactUniverse: new Set(),
      ownerExactCovered: new Set(),
      deferredExactUniverse: new Set(),
      deferredExactCovered: new Set(),
      cloneFailureEvents: [],
      batches: 0,
      complete: false,
      snapshotReady: false,
      currentSnapshotReady: false,
      snapshotPhase: 'current',
      refreshes: 0,
      criticalRefreshes: 0,
      ownerPromotionChecks: 0,
      criticalPromotedObjects: 0,
      ownerPromotedObjects: 0,
      deferredPromotionChecks: 0,
      deferredPromotedObjects: 0,
      deferredRecorded: false,
      ownerRecorded: false,
      ownerExactRecorded: false,
      deferredExactRecorded: false,
      ownerFinalizeBlocked: false,
      deferredFinalizeBlocked: false,
      exactRefreshes: 0,
      exactInvalidations: 0,
      exactShaderRevision: 0,
      lastExactScanSignatures: new Map(),
      deferredLabel: null,
      blockedCritical: false,
      blockedReason: null,
    };
  }

  _currentDeferredGpuRoots() {
    const priority = this._shaderWarmPriorityKey();
    if (priority === 'house' || priority === 'mirror') {
      return { label: null, roots: [] };
    }
    const grave = new Set(this.graveyardRenderRoots || []);
    const forest = new Set(this.forest?.detailRoots || []);
    const cave = new Set(this.underfalls?.renderRoots || []);
    const clearing = (this.outsideRenderRoots || []).filter((root) =>
      !grave.has(root) && !forest.has(root) && !cave.has(root));
    const atmosphere = this.atmosphere?.districtRoots || {};
    const exteriorAtmosphere = [
      ...(atmosphere.sky || []), ...(atmosphere.graveyard || []),
      ...(atmosphere.forest || []), ...(atmosphere.clearing || []),
    ];
    const surfaceOutside = (this.outsideRenderRoots || []).filter((root) =>
      !cave.has(root) && root !== this.ossuary?.root);
    const surfaceStatic = (this.staticWorldRenderRoots || []).filter((root) =>
      root !== this.underfalls?.shellRoot);
    const roots = [];
    if (priority === 'graveyard') {
      // Before the gate, the authored cull law leaves the house and every
      // surface chapter alive; forest detail also wakes while `act` is still
      // graveyard at z>31.5. Own that real visibility overlap explicitly so a
      // walk toward the gate cannot reveal an unregistered cold buffer.
      roots.push(...surfaceStatic,
        ...(this.houseRenderRoots || []), ...surfaceOutside, ...exteriorAtmosphere);
      // Grave waves and the following forest create actors only when their
      // authored beats fire. Retained inert representatives make their shared
      // geometry/program bindings part of this finite future-surface universe.
      roots.push(...(this.enemies?.gpuResidencyRoots?.(['walker', 'kneeler']) || []));
    } else if (priority === 'ossuary') {
      // The under-yard culler hides every exterior top-level root. Its route
      // group contains the complete shell/mechanism/hatch universe; preloading
      // the entire surface here would be both dishonest and needlessly broad.
      roots.push(this.ossuary?.root);
    } else if (priority === 'forest') {
      // After the one-way gate only the authored grave lookback survives, while
      // the clearing remains live ahead until its zone claims the act.
      roots.push(...surfaceStatic,
        ...(this.graveyardLookbackRoots || []), ...forest, ...clearing,
        ...exteriorAtmosphere);
      roots.push(...(this.enemies?.gpuResidencyRoots?.(['walker', 'kneeler']) || []));
    } else if (priority === 'clearing') {
      // The authored look-back keeps the forest silhouette alive around the
      // oasis, plus the cheap grave gate/ground silhouette and every exterior
      // atmosphere stratum the real surface culler leaves eligible.
      roots.push(...surfaceStatic,
        ...(this.graveyardLookbackRoots || []), ...forest, ...clearing,
        ...exteriorAtmosphere);
    } else if (priority === 'cave') {
      roots.push(...cave, ...(atmosphere.cave || []));
      roots.push(...(this.enemies?.gpuResidencyRoots?.(['choir']) || []));
    }
    if (['graveyard', 'forest', 'clearing', 'cave'].includes(priority)) {
      roots.push(this.goreMesh, this.enemies?.stainPool,
        ...(this.enemies?.list || []).map((enemy) => enemy.mesh));
    }
    return { label: priority, roots: [...new Set(roots.filter(Boolean))] };
  }

  _exactResidencyEntryKey(object, {
    critical = false,
    preloadOwner = null,
    preloadDeferred = null,
    rig = 'world',
  } = {}) {
    // A WebGL binding state is keyed by both geometry and program. The same
    // authored object can therefore need three honest certificates: its live
    // default-framebuffer program, a future district program, and an owner
    // render-target program. Keep those purposes distinct while the resource
    // maps below still deduplicate their shared BufferAttributes.
    const purpose = critical
      ? 'critical'
      : preloadOwner ? `owner:${preloadOwner}`
        : preloadDeferred ? `deferred:${preloadDeferred}` : 'preload';
    return `${purpose}:${rig}:${object?.uuid || 'missing'}`;
  }

  _exactPhysicalCandidate(object) {
    if ((!object?.isMesh && !object?.isLine && !object?.isPoints)
        || !object.geometry || !object.material
        || (object.layers.mask & ((1 << 0) | (1 << LAYER_MAIN_ONLY))) === 0) return false;
    let ancestor = object;
    while (ancestor && ancestor !== this.scene) {
      if (ancestor.visible === false) return false;
      ancestor = ancestor.parent;
    }
    if (ancestor !== this.scene) return false;
    // WebGLRenderer updates object geometry before it checks material.visible
    // or reaches a zero-instance draw. Those cases own allocation residency
    // even though they contribute no pixel.
    return object.frustumCulled === false || this._reducedWorldFrustum.intersectsObject(object);
  }

  _queueExactRenderable(progress, object, {
    critical = false,
    preloadOnly = true,
    preloadOwner = null,
    preloadDeferred = null,
    rig = 'world',
  } = {}) {
    if (!progress || (!object?.isMesh && !object?.isLine && !object?.isPoints)
        || !object.geometry || !object.material) return false;
    const key = this._exactResidencyEntryKey(object, {
      critical, preloadOwner, preloadDeferred, rig,
    });
    let entry = progress.exactObjects.get(key);
    if (!entry) {
      object.getWorldPosition(this._reducedWorldCenter);
      const name = `${object.name || ''}`.toLowerCase();
      entry = {
        key,
        object,
        rig,
        critical: false,
        preloadOnly: true,
        preloadOwner: null,
        preloadDeferred: null,
        distance: Number.POSITIVE_INFINITY,
        structural: 0,
      };
      progress.exactObjects.set(key, entry);
    }
    if (critical) {
      entry.critical = true;
      entry.preloadOnly = entry.preloadOnly && preloadOnly;
      if (!preloadOnly) {
        object.getWorldPosition(this._reducedWorldCenter);
        entry.distance = this._reducedWorldCenter.distanceTo(this._reducedWorldCamera);
        const name = `${object.name || ''}`.toLowerCase();
        entry.structural = (/(?:wall|floor|ceiling|door|frame|ground|path|shell|rock|stair|rail|beam)/
          .test(name) || object.receiveShadow) ? 1 : 0;
      }
      if (!progress.exactUniverse.has(key)) {
        progress.exactUniverse.add(key);
        progress.exactShaderRevision++;
      }
    }
    if (preloadOwner) {
      entry.preloadOwner ||= preloadOwner;
      progress.ownerExactUniverse.add(key);
    }
    if (preloadDeferred) {
      entry.preloadDeferred ||= preloadDeferred;
      progress.deferredExactUniverse.add(key);
    }
    if (progress.exactProcessed.has(key)) return false;

    const removeFrom = (queue, queuedSet) => {
      const index = queue.findIndex((candidate) => candidate.key === key);
      if (index >= 0) queue.splice(index, 1);
      queuedSet.delete(key);
    };
    const targetQueue = entry.critical
      ? progress.exactQueue
      : entry.preloadDeferred ? progress.deferredExactQueue : progress.ownerExactQueue;
    const targetSet = entry.critical
      ? progress.exactQueued
      : entry.preloadDeferred ? progress.deferredExactQueued : progress.ownerExactQueued;
    if (!targetSet.has(key)) {
      // Most admissions are genuinely new purpose-keyed entries. Do not linearly
      // scan all three growing queues for a key their membership sets already
      // prove is absent; House owner census can add thousands of exact entries
      // in one bounded snapshot. A rare purpose migration still removes the key
      // from the one queue that actually owns it before appending to the target.
      if (progress.exactQueued.has(key)) {
        removeFrom(progress.exactQueue, progress.exactQueued);
      }
      if (progress.ownerExactQueued.has(key)) {
        removeFrom(progress.ownerExactQueue, progress.ownerExactQueued);
      }
      if (progress.deferredExactQueued.has(key)) {
        removeFrom(progress.deferredExactQueue, progress.deferredExactQueued);
      }
      targetQueue.push(entry);
      targetSet.add(key);
      return true;
    }
    return false;
  }

  _sortExactResidencyQueues(progress) {
    progress.exactQueue.sort((left, right) => left.rig.localeCompare(right.rig)
      || Number(left.preloadOnly) - Number(right.preloadOnly)
      || right.structural - left.structural
      || left.distance - right.distance
      || left.key.localeCompare(right.key));
    progress.ownerExactQueue.sort((left, right) => left.key.localeCompare(right.key));
    progress.deferredExactQueue.sort((left, right) => left.key.localeCompare(right.key));
  }

  _refreshReducedWorldQueue(progress) {
    const snapshotStartedAt = performance.now();
    const snapshotPhase = progress.snapshotPhase || 'current';
    let phaseStartedAt = snapshotStartedAt;
    const phases = {};
    const markPhase = (name) => {
      const now = performance.now();
      phases[name] = now - phaseStartedAt;
      phaseStartedAt = now;
    };
    const camera = this.camera;
    const scene = this.scene;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this._reducedWorldProjection.multiplyMatrices(
      camera.projectionMatrix, camera.matrixWorldInverse,
    );
    this._reducedWorldFrustum.setFromProjectionMatrix(this._reducedWorldProjection);
    camera.getWorldPosition(this._reducedWorldCamera);
    markPhase('matrix-and-frustum');
    let added = 0;
    const recordSnapshotSlice = (phase, complete) => {
      const durationMs = performance.now() - snapshotStartedAt;
      const entry = {
        generation: this._webglGeneration,
        key: progress.key,
        kind: 'reduced-snapshot-census',
        phase,
        slice: (progress.snapshotSlices || 0) + 1,
        durationMs,
        phases,
        added,
        reducedQueued: progress.queue.length,
        ownerQueued: progress.ownerQueue.length,
        deferredQueued: progress.deferredQueue.length,
        exactQueued: progress.exactQueue.length,
        ownerExactQueued: progress.ownerExactQueue.length,
        deferredExactQueued: progress.deferredExactQueue.length,
        complete,
        error: null,
      };
      progress.snapshotSlices = entry.slice;
      this.currentGpuResidency?.snapshotPasses?.push(entry);
      return entry;
    };
    const enqueue = (object, preloadOnly = false, preloadOwner = null,
      preloadDeferred = null) => {
      if ((object?.isLine || object?.isPoints) && object.geometry && object.material) {
        progress.omittedReduced.set(object.uuid, object.isPoints ? 'points' : 'line');
        if (preloadOwner) progress.ownerExactOnly.add(object.uuid);
        if (preloadDeferred) progress.deferredExactOnly.add(object.uuid);
        return;
      }
      if (!object?.isMesh || !object.geometry || !object.material
          || progress.queued.has(object.uuid)) return;
      if (!preloadOnly
          && (object.layers.mask & ((1 << 0) | (1 << LAYER_MAIN_ONLY))) === 0) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!preloadOnly && object.frustumCulled !== false
          && !this._reducedWorldFrustum.intersectsObject(object)) return;

      // Opacity zero does not stop Three from updating and submitting an exact
      // renderable. Upload that real geometry through a transient reduced clone,
      // but do not add a visibly false silhouette to the persistent fallback.
      const materialHidden = !preloadOnly
        && !materials.some((material) => material?.visible !== false);
      const opacityHidden = !preloadOnly && !materials.some((material) =>
        material?.visible !== false
          && (!material.transparent || (material.opacity ?? 1) > 0.001));
      const zeroInstanceHidden = !preloadOnly && object.isInstancedMesh && object.count <= 0;
      const effectivePreloadOnly = preloadOnly || materialHidden
        || opacityHidden || zeroInstanceHidden;

      object.getWorldPosition(this._reducedWorldCenter);
      const distance = effectivePreloadOnly
        ? Number.POSITIVE_INFINITY
        : this._reducedWorldCenter.distanceTo(this._reducedWorldCamera);
      const name = `${object.name || ''}`.toLowerCase();
      const structural = !effectivePreloadOnly && /(?:wall|floor|ceiling|door|frame|ground|path|shell|rock|stair|rail|beam)/
        .test(name) || object.receiveShadow;
      const targetQueue = preloadOwner
        ? progress.ownerQueue : preloadDeferred ? progress.deferredQueue : progress.queue;
      targetQueue.push({
        object, distance, structural: structural ? 1 : 0,
        preloadOnly: effectivePreloadOnly, preloadOwner, preloadDeferred,
      });
      progress.queued.add(object.uuid);
      added++;
    };
    const priority = this._shaderWarmPriorityKey();
    if (snapshotPhase === 'current') scene.traverseVisible((object) => {
      enqueue(object, false);
      if (this._exactPhysicalCandidate(object)) {
        added += Number(this._queueExactRenderable(progress, object, {
          critical: true,
          preloadOnly: false,
          rig: 'world',
        }));
      }
    });
    if (snapshotPhase === 'current') markPhase('current-visible-universe');
    // The held skull, its future anatomical stages and its separate invisible
    // tether are deliberately outside the physical-view traversal. They still
    // become WORLD content on a normal throw/growth edge, so upload their real
    // BufferGeometries through the same <=16-unique-geometry paint budget. The
    // preload clones are removed immediately after the hidden 1px submission
    // and never contaminate the playable silhouette.
    if (snapshotPhase === 'current') this.skull?.hold?.traverse((object) => {
      enqueue(object, true);
      added += Number(this._queueExactRenderable(progress, object, {
        critical: true, preloadOnly: true, rig: 'held',
      }));
    });
    if (snapshotPhase === 'current') markPhase('held-universe');
    // Context loss is legal while the skull is outbound, returning or anchored,
    // when root is no longer parented below `hold`. Queue every future stage
    // directly as well; UUID dedupe makes the held case free. Only a genuinely
    // sacrificed/gone skull has no later WORLD activation to protect.
    if (snapshotPhase === 'current' && this.skull?.mode !== 'gone') {
      this.skull?.root?.traverse((object) => {
        enqueue(object, true);
        added += Number(this._queueExactRenderable(progress, object, {
          critical: true, preloadOnly: true, rig: 'world',
        }));
      });
    }
    const registerCriticalPreload = (object) => {
      enqueue(object, true);
      added += Number(this._queueExactRenderable(progress, object, {
        critical: true, preloadOnly: true, rig: 'world',
      }));
    };
    if (snapshotPhase === 'current') {
      registerCriticalPreload(this.skull?.tether);
      registerCriticalPreload(this._impactRing);
      registerCriticalPreload(this.goreMesh);
      registerCriticalPreload(this.enemies?.stainPool);
      // Three authored keys are later reparented below the jaw and become HELD
      // content. Their world mappings belong to the House census below, but a
      // world VAO cannot certify the two-light viewmodel program. Register the
      // actual finite carry geometry under the held signature now, without
      // touching, revealing, or spending any target.
      if (priority === 'house') {
        for (const target of this.world?.fetchTargets || []) {
          if (!target?.heldCarry || !target.object) continue;
          target.object.traverse((object) => {
            if ((!object?.isMesh && !object?.isLine && !object?.isPoints)
                || !object.geometry || !object.material) return;
            added += Number(this._queueExactRenderable(progress, object, {
              critical: true, preloadOnly: true, rig: 'held',
            }));
          });
        }
      }
      markPhase('dynamic-critical-universe');
    }
    const registerCriticalPreloadRoot = (root) => root?.traverse((object) => {
      if ((object?.isMesh || object?.isLine || object?.isPoints)
          && object.geometry && object.material) registerCriticalPreload(object);
    });
    if (snapshotPhase === 'current' && priority === 'house') {
      // These exact objects can materialize during the house without a district
      // transition: the nursery figure, its Walker, basement Walkers and the
      // Resident. Certify their default-framebuffer mappings before those beats.
      registerCriticalPreloadRoot(this.musicBox?.thingPool);
      // The physical silver echo is revealed only after the mirror owner pass.
      // It lives on layer 0, so certify its default-framebuffer mappings as
      // well as its separate reflection-target mappings before pane activation.
      registerCriticalPreloadRoot(this.houseMirror?.echo);
      for (const root of this.enemies?.gpuResidencyRoots?.(['walker', 'resident']) || []) {
        registerCriticalPreloadRoot(root);
      }
    }
    if (snapshotPhase === 'current' && priority === 'mirror') {
      // The Finale's authored room includes initially hidden fracture/debris
      // meshes that become physical as the walls close. Owner preload certifies
      // those exact objects against the reflection target, but that VAO is not
      // transferable to the default framebuffer's program. Certify the finite
      // late-room universe here before the first full physical reveal so a turn
      // or pressure beat cannot create a binding state on a visible frame.
      for (const root of this.finale?.warmRoots || []) {
        // The reflected figure (including its exact skull) is LAYER_DOUBLE-only.
        // Its shipping binding belongs solely to the owner/reflection-target lane;
        // forcing a layer-0 clone here would manufacture a nonshipping signature.
        if (root !== this.finale?.figure) registerCriticalPreloadRoot(root);
      }
    }
    if (snapshotPhase === 'current') {
      markPhase('current-future-universe');
      if (added) {
        progress.queue.sort((a, b) => Number(a.preloadOnly) - Number(b.preloadOnly)
          || b.structural - a.structural
          || a.distance - b.distance
          || a.object.uuid.localeCompare(b.object.uuid));
        this._sortExactResidencyQueues(progress);
      }
      markPhase('current-stable-sorts');
      progress.currentSnapshotReady = true;
      progress.snapshotPhase = ['house', 'mirror'].includes(priority)
        ? 'owner-primary' : 'deferred';
      recordSnapshotSlice('current', false);
      return added;
    }
    const dynamicOwnerRoots = [
      this.skull?.root,
      this.skull?.tether,
      this._impactRing,
      this.goreMesh,
      this.enemies?.stainPool,
    ];
    const physicalWorldMask = (1 << 0) | (1 << LAYER_MAIN_ONLY);
    const restorableHouseWorld = new Set();
    if (priority === 'house') {
      for (const entry of this.pumpGallery?.upperSector || []) {
        if (entry?.object && (entry.mask & physicalWorldMask) !== 0) {
          restorableHouseWorld.add(entry.object);
        }
      }
    }
    const registerOwnerRoot = (root, kind) => {
      root?.traverse((object) => {
        if ((object?.isLine || object?.isPoints) && object.geometry && object.material) {
          progress.omittedReduced.set(object.uuid, object.isPoints ? 'points' : 'line');
          progress.ownerExactOnly.add(object.uuid);
        }
        if ((object?.isMesh || object?.isLine || object?.isPoints)
            && object.geometry && object.material) {
          // House owner certification binds the same geometry to the mirror's
          // render-target program. That VAO cannot certify a later physical
          // camera turn on the default framebuffer. Add a distinct critical
          // world-purpose key for every renderable the shipping world pass can
          // consume; keep DOUBLE-only and HELD-only content in their own lanes.
          // This deliberately bypasses enqueue(): broad owner geometry stays in
          // the background owner reduced queue instead of delaying the first
          // Basic silhouette.
          const physicalNow = (object.layers.mask & physicalWorldMask) !== 0;
          const physicalAfterBasementCull = restorableHouseWorld.has(object);
          if (kind === 'house' && (physicalNow || physicalAfterBasementCull)) {
            added += Number(this._queueExactRenderable(progress, object, {
              critical: true, preloadOnly: true, rig: 'world',
            }));
          }
          added += Number(this._queueExactRenderable(progress, object, {
            preloadOnly: true, preloadOwner: kind, rig: 'world',
          }));
        }
        if (object?.isMesh && !object.isLine && !object.isPoints
            && object.geometry && object.material) {
          progress.ownerUniverse.add(object.uuid);
          const ownerObjects = kind === 'house' ? progress.ownerHouse : progress.ownerFinale;
          const ownerGeometries = kind === 'house'
            ? progress.ownerHouseGeometries : progress.ownerFinaleGeometries;
          ownerObjects.add(object.uuid);
          ownerGeometries.add(object.geometry.uuid);
          // Owner census deliberately runs after the first physical silhouette.
          // A current-view Mesh may therefore already own a committed reduced
          // transaction before it joins this later universe. Carry that exact
          // generation-local proof forward; queued is monotonic UUID dedupe and
          // must not strand a second copy in an empty owner queue.
          if (progress.processed.has(object.uuid)) {
            progress.ownerCovered.add(object.uuid);
          } else enqueue(object, true, kind);
        }
      });
    };
    let ownerKind = null;
    let ownerPrimaryRoots = [];
    let ownerSecondaryRoots = [];
    if (priority === 'house') {
      ownerKind = 'house';
      ownerPrimaryRoots = [
        ...(this.staticWorldRenderRoots || []),
        ...(this.houseRenderRoots || []),
      ];
      ownerSecondaryRoots = [
        ...(this.graveyardRenderRoots || []),
        this.atmosphere?.group,
        this.houseMirror?.double,
        this.houseMirror?.echo,
        this.musicBox?.thingPool,
        ...(this.enemies?.gpuResidencyRoots?.(['walker', 'resident']) || []),
        ...dynamicOwnerRoots,
      ];
    } else if (priority === 'mirror') {
      ownerKind = 'finale';
      ownerPrimaryRoots = [
        ...(this.staticWorldRenderRoots || []),
        ...(this.finale?.warmRoots || []),
      ];
      ownerSecondaryRoots = [
        this.finale?.figure,
        this.finale?.figure?.userData?.exactHead,
        ...dynamicOwnerRoots,
      ];
    }
    if (snapshotPhase === 'owner-primary') {
      for (const root of ownerPrimaryRoots) registerOwnerRoot(root, ownerKind);
      markPhase('owner-primary-universe');
      progress.snapshotPhase = 'owner-secondary';
      recordSnapshotSlice('owner-primary', false);
      return added;
    }
    if (snapshotPhase === 'owner-secondary') {
      for (const root of ownerSecondaryRoots) registerOwnerRoot(root, ownerKind);
      markPhase('owner-secondary-universe');
    }
    const deferred = this._currentDeferredGpuRoots();
    progress.deferredLabel = deferred.label;
    if (!deferred.label || deferred.roots.length === 0) {
      // House and Finale have no future district universe in this progress
      // object. Mark that empty scope complete once instead of appending an
      // identical empty fingerprint scan on every steady render forever.
      progress.deferredRecorded = true;
      progress.deferredExactRecorded = true;
    }
    const registerDeferredRoot = (root) => {
      root?.traverse((object) => {
        if ((object?.isLine || object?.isPoints) && object.geometry && object.material) {
          progress.omittedReduced.set(object.uuid, object.isPoints ? 'points' : 'line');
          progress.deferredExactOnly.add(object.uuid);
        }
        if ((object?.isMesh || object?.isLine || object?.isPoints)
            && object.geometry && object.material) {
          added += Number(this._queueExactRenderable(progress, object, {
            preloadOnly: true, preloadDeferred: deferred.label, rig: 'world',
          }));
        }
        if (object?.isMesh && !object.isLine && !object.isPoints
            && object.geometry && object.material) {
          progress.deferredUniverse.add(object.uuid);
          progress.deferredGeometries.add(object.geometry.uuid);
          if (progress.processed.has(object.uuid)) {
            progress.deferredCovered.add(object.uuid);
          } else enqueue(object, true, null, deferred.label);
        }
      });
    };
    for (const root of deferred.roots) registerDeferredRoot(root);
    markPhase('deferred-universe');
    if (added) {
      // The first delivered silhouette is architecture at the player's feet and
      // eyeline, not a handful of distant particles. Stable UUID ordering keeps
      // the same view deterministic across context restores.
      progress.queue.sort((a, b) => Number(a.preloadOnly) - Number(b.preloadOnly)
        || b.structural - a.structural
        || a.distance - b.distance
        || a.object.uuid.localeCompare(b.object.uuid));
      progress.ownerQueue.sort((a, b) => a.object.uuid.localeCompare(b.object.uuid));
      progress.deferredQueue.sort((a, b) => a.object.uuid.localeCompare(b.object.uuid));
      this._sortExactResidencyQueues(progress);
    }
    markPhase('stable-sorts');
    progress.refreshes++;
    progress.snapshotReady = true;
    progress.snapshotPhase = 'complete';
    recordSnapshotSlice(snapshotPhase, true);
    return added;
  }

  _cloneReducedRenderable(object, { preloadOnly = false } = {}) {
    if (!object?.isMesh || object.isLine || object.isPoints) return null;
    let clone = null;
    try {
      clone = object.isInstancedMesh
        ? new THREE.InstancedMesh(object.geometry, this._reducedWorldMaterial, 1)
        : new THREE.Mesh(object.geometry, this._reducedWorldMaterial);
    } catch { return null; }
    clone.name = `reduced ${object.name || object.uuid}`;
    clone.visible = true;
    clone.frustumCulled = false;
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(object.matrixWorld);
    clone.matrixWorld.copy(object.matrixWorld);
    clone.layers.set(0);
    if (object.isInstancedMesh) {
      clone.count = preloadOnly ? Math.max(1, object.count) : object.count;
      clone.instanceMatrix = object.instanceMatrix;
      // A source instanceColor is conservatively charged by admission accounting
      // but never attached here. That keeps the fallback on one monochrome
      // InstancedMeshBasic signature and leaves the color buffer exact-deferred.
      clone.instanceColor = null;
    }
    return clone;
  }

  _cloneExactRenderable(object, { preloadOnly = false } = {}) {
    if ((!object?.isMesh && !object?.isLine && !object?.isPoints)
        || !object.geometry || !object.material) return null;
    let clone = null;
    try {
      if (object.isInstancedMesh) {
        clone = new THREE.InstancedMesh(
          object.geometry, object.material, Math.max(1, object.instanceMatrix?.count || 1),
        );
        clone.instanceMatrix = object.instanceMatrix;
        clone.instanceColor = object.instanceColor;
        clone.count = preloadOnly ? Math.max(1, object.count) : object.count;
      } else if (object.isPoints) {
        clone = new THREE.Points(object.geometry, object.material);
      } else if (object.isLineSegments) {
        clone = new THREE.LineSegments(object.geometry, object.material);
      } else if (object.isLineLoop) {
        clone = new THREE.LineLoop(object.geometry, object.material);
      } else if (object.isLine) {
        clone = new THREE.Line(object.geometry, object.material);
      } else if (object.isSkinnedMesh) {
        clone = object.clone(false);
        clone.geometry = object.geometry;
        clone.material = object.material;
        clone.skeleton = object.skeleton;
      } else {
        clone = new THREE.Mesh(object.geometry, object.material);
        if (object.morphTargetInfluences) {
          clone.updateMorphTargets();
          clone.morphTargetInfluences = object.morphTargetInfluences.slice();
        }
      }
    } catch { return null; }
    clone.name = `exact preload ${object.name || object.uuid}`;
    clone.visible = true;
    clone.frustumCulled = false;
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(object.matrixWorld);
    clone.matrixWorld.copy(object.matrixWorld);
    clone.layers.set(0);
    clone.castShadow = object.castShadow;
    clone.receiveShadow = object.receiveShadow;
    clone.renderOrder = object.renderOrder;
    return clone;
  }

  _addExactResidencyLightRig(scene, rig = 'world') {
    const lights = rig === 'held'
      ? [
          new THREE.PointLight(0xffffff, 0, 1, 2),
          new THREE.PointLight(0xffffff, 0, 1, 2),
        ]
      : (() => {
          const directional = new THREE.DirectionalLight(0xffffff, 0);
          directional.castShadow = true;
          directional.shadow.autoUpdate = false;
          directional.shadow.needsUpdate = false;
          return [
            new THREE.AmbientLight(0xffffff, 0),
            new THREE.HemisphereLight(0xffffff, 0x000000, 0),
            directional,
            new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 3, 0, 2),
            ...Array.from({ length: 16 }, () => new THREE.PointLight(0xffffff, 0, 1, 2)),
          ];
        })();
    for (const light of lights) {
      light.visible = true;
      light.layers.set(0);
      scene.add(light);
      if (light.target) scene.add(light.target);
    }
    return lights.length;
  }

  _updateReducedWorldFrustum() {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    this._reducedWorldProjection.multiplyMatrices(
      this.camera.projectionMatrix, this.camera.matrixWorldInverse,
    );
    this._reducedWorldFrustum.setFromProjectionMatrix(this._reducedWorldProjection);
    this.camera.getWorldPosition(this._reducedWorldCamera);
  }

  _reducedPhysicalCandidate(object) {
    if (!object?.isMesh || object.isLine || object.isPoints
        || !object.geometry || !object.material
        || (object.layers.mask & ((1 << 0) | (1 << LAYER_MAIN_ONLY))) === 0) return false;
    let ancestor = object;
    while (ancestor && ancestor !== this.scene) {
      if (ancestor.visible === false) return false;
      ancestor = ancestor.parent;
    }
    if (ancestor !== this.scene) return false;
    return object.frustumCulled === false || this._reducedWorldFrustum.intersectsObject(object);
  }

  _reducedPhysicalEntry(object, preloadOwner = null, preloadDeferred = null) {
    object.getWorldPosition(this._reducedWorldCenter);
    const name = `${object.name || ''}`.toLowerCase();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const preloadOnly = (object.isInstancedMesh && object.count <= 0)
      || !materials.some((material) => material?.visible !== false
        && (!material.transparent || (material.opacity ?? 1) > 0.001));
    return {
      object,
      distance: preloadOnly ? Number.POSITIVE_INFINITY
        : this._reducedWorldCenter.distanceTo(this._reducedWorldCamera),
      structural: !preloadOnly && (/(?:wall|floor|ceiling|door|frame|ground|path|shell|rock|stair|rail|beam)/
        .test(name) || object.receiveShadow) ? 1 : 0,
      preloadOnly,
      preloadOwner,
      preloadDeferred,
    };
  }

  _sortReducedPhysicalQueue(progress) {
    progress.queue.sort((a, b) => Number(a.preloadOnly) - Number(b.preloadOnly)
      || b.structural - a.structural
      || a.distance - b.distance
      || a.object.uuid.localeCompare(b.object.uuid));
  }

  _refreshCriticalWorldQueue(progress) {
    if (!progress?.scene) return 0;
    this._updateReducedWorldFrustum();
    let added = 0;
    this.scene.traverseVisible((object) => {
      if (this._exactPhysicalCandidate(object)) {
        this._queueExactRenderable(progress, object, {
          critical: true, preloadOnly: false, rig: 'world',
        });
      }
      if (!this._reducedPhysicalCandidate(object) || progress.processed.has(object.uuid)) return;
      if (progress.queue.some((entry) => entry.object === object)) return;
      const ownerIndex = progress.ownerQueue.findIndex((entry) => entry.object === object);
      let preloadOwner = null;
      let preloadDeferred = null;
      if (ownerIndex >= 0) {
        preloadOwner = progress.ownerQueue[ownerIndex].preloadOwner;
        progress.ownerQueue.splice(ownerIndex, 1);
      } else {
        const deferredIndex = progress.deferredQueue
          .findIndex((entry) => entry.object === object);
        if (deferredIndex >= 0) {
          preloadDeferred = progress.deferredQueue[deferredIndex].preloadDeferred;
          progress.deferredQueue.splice(deferredIndex, 1);
        }
      }
      if (ownerIndex < 0 && preloadDeferred == null && progress.queued.has(object.uuid)) {
        // It belongs to an already-pending non-owner critical batch.
        return;
      }
      if (!progress.queued.has(object.uuid)) progress.queued.add(object.uuid);
      progress.queue.push(this._reducedPhysicalEntry(
        object, preloadOwner, preloadDeferred,
      ));
      added++;
    });
    if (added) {
      progress.criticalPromotedObjects += added;
      this._sortReducedPhysicalQueue(progress);
    }
    progress.criticalRefreshes++;
    return added;
  }

  _refreshExactResidencyQueue(progress, scope = 'critical') {
    const residency = this.currentGpuResidency;
    if (!progress || progress.key !== residency?.activeKey
        || residency.generation !== this._webglGeneration) return null;
    const startedAt = performance.now();
    const universe = scope === 'owner'
      ? progress.ownerExactUniverse
      : scope === 'deferred' ? progress.deferredExactUniverse : progress.exactUniverse;
    const covered = scope === 'owner'
      ? progress.ownerExactCovered
      : scope === 'deferred' ? progress.deferredExactCovered : progress.exactCovered;
    const queue = scope === 'owner'
      ? progress.ownerExactQueue
      : scope === 'deferred' ? progress.deferredExactQueue : progress.exactQueue;
    let added = 0;
    let invalidated = 0;
    const errors = [];

    if (scope === 'critical') {
      this._updateReducedWorldFrustum();
      this.scene.traverseVisible((object) => {
        if (!this._exactPhysicalCandidate(object)) return;
        if (object.isLine || object.isPoints) {
          progress.omittedReduced.set(object.uuid, object.isPoints ? 'points' : 'line');
        }
        added += Number(this._queueExactRenderable(progress, object, {
          critical: true, preloadOnly: false, rig: 'world',
        }));
      });
    }

    for (const key of [...universe]) {
      const exact = progress.exactObjects.get(key);
      const failed = scope === 'owner'
        ? progress.failedOwners.has(key)
        : scope === 'deferred' ? progress.failedDeferred.has(key)
          : progress.failedObjects.has(key);
      if (failed) {
        errors.push(`${key}: exact preload previously failed permanently`);
        continue;
      }
      if (!exact?.object) {
        errors.push(`${key}: missing exact source object`);
        continue;
      }
      const descriptor = this._describeReducedEntry(exact, progress, { exact: true });
      if (descriptor.error) {
        errors.push(`${key}: ${descriptor.error}`);
        if (scope === 'critical') progress.failedObjects.add(key);
        if (scope === 'owner') progress.failedOwners.add(key);
        if (scope === 'deferred') progress.failedDeferred.add(key);
        continue;
      }
      // A current-view compile can span several paints before any exact entry
      // is committed. Track the live allocation/program signature from the
      // first scan onward so a shader-affecting material or geometry mutation
      // cannot leave that in-flight compile looking current merely because the
      // entry has not reached exactProcessed yet.
      let criticalSignatureChanged = false;
      if (scope === 'critical') {
        const observed = exact.observedCriticalAllocationFingerprint;
        criticalSignatureChanged = observed != null
          && observed !== descriptor.allocationFingerprint;
        exact.observedCriticalAllocationFingerprint = descriptor.allocationFingerprint;
        if (criticalSignatureChanged) progress.exactShaderRevision++;
      }
      // Content versions may advance every gameplay frame for an already
      // allocated dynamic buffer. Cold residency is invalidated only when the
      // allocation/mapping/program identity changes; transaction-local version
      // stability remains enforced by the exact batch itself below.
      const committed = progress.exactAllocationFingerprints.get(key);
      if (progress.exactProcessed.has(key)
          && committed !== descriptor.allocationFingerprint) {
        progress.exactProcessed.delete(key);
        progress.exactCovered.delete(key);
        progress.ownerExactCovered.delete(key);
        progress.deferredExactCovered.delete(key);
        progress.exactFingerprints.delete(key);
        progress.exactAllocationFingerprints.delete(key);
        if (scope === 'critical' && !criticalSignatureChanged) {
          progress.exactShaderRevision++;
        }
        invalidated++;
        added += Number(this._queueExactRenderable(progress, exact.object, {
          critical: exact.critical,
          preloadOnly: exact.preloadOnly,
          preloadOwner: exact.preloadOwner,
          preloadDeferred: exact.preloadDeferred,
          rig: exact.rig,
        }));
      } else if (!progress.exactProcessed.has(key)
          && !progress.exactQueued.has(key)
          && !progress.ownerExactQueued.has(key)
          && !progress.deferredExactQueued.has(key)) {
        added += Number(this._queueExactRenderable(progress, exact.object, {
          critical: exact.critical,
          preloadOnly: exact.preloadOnly,
          preloadOwner: exact.preloadOwner,
          preloadDeferred: exact.preloadDeferred,
          rig: exact.rig,
        }));
      }
    }
    if (added || invalidated) this._sortExactResidencyQueues(progress);
    progress.exactInvalidations += invalidated;
    progress.exactRefreshes++;
    const entry = {
      generation: this._webglGeneration,
      key: progress.key,
      kind: `${scope}-exact-fingerprint-scan`,
      scope,
      universe: universe.size,
      covered: covered.size,
      queued: queue.length,
      added,
      invalidated,
      durationMs: performance.now() - startedAt,
      stable: errors.length === 0 && queue.length === 0 && covered.size === universe.size,
      error: errors.length ? errors.join('; ') : null,
    };
    const signature = [
      entry.universe, entry.covered, entry.queued, entry.added,
      entry.invalidated, Number(entry.stable), entry.error || '',
    ].join('|');
    const previousSignature = progress.lastExactScanSignatures.get(scope);
    entry.repeated = previousSignature === signature;
    progress.lastExactScanSignatures.set(scope, signature);
    if (!entry.repeated) {
      residency.exactScanPasses.push(entry);
      if (errors.length) {
        residency.errors.push(...errors.map((error) => `exact ${scope}: ${error}`));
      }
    }
    return entry;
  }

  _promoteVisibleOwnerQueue(progress) {
    if (!progress?.ownerQueue?.length) return 0;
    this._updateReducedWorldFrustum();
    let promoted = 0;
    for (let index = progress.ownerQueue.length - 1; index >= 0; index--) {
      const entry = progress.ownerQueue[index];
      if (!this._reducedPhysicalCandidate(entry.object)) continue;
      progress.ownerQueue.splice(index, 1);
      progress.queue.push(this._reducedPhysicalEntry(entry.object, entry.preloadOwner));
      promoted++;
    }
    if (promoted) {
      progress.ownerPromotedObjects += promoted;
      this._sortReducedPhysicalQueue(progress);
    }
    progress.ownerPromotionChecks++;
    return promoted;
  }

  _promoteVisibleDeferredQueue(progress) {
    if (!progress?.deferredQueue?.length) return 0;
    this._updateReducedWorldFrustum();
    let promoted = 0;
    for (let index = progress.deferredQueue.length - 1; index >= 0; index--) {
      const entry = progress.deferredQueue[index];
      if (!this._reducedPhysicalCandidate(entry.object)) continue;
      progress.deferredQueue.splice(index, 1);
      progress.queue.push(this._reducedPhysicalEntry(
        entry.object, null, entry.preloadDeferred,
      ));
      promoted++;
    }
    if (promoted) {
      progress.deferredPromotedObjects += promoted;
      this._sortReducedPhysicalQueue(progress);
    }
    progress.deferredPromotionChecks++;
    return promoted;
  }

  _currentGpuResidencyKey() {
    const priority = this._shaderWarmPriorityKey();
    const variant = this._shaderWarmRequiredVariant(priority) || 'ordinary';
    // Bedroom/house/basement intentionally share one *program* itinerary, but
    // their district cullers expose different real geometry. Keep that warmup
    // canonicalization while certifying each physical visibility set once.
    const physicalDistrict = this.ossuary?.inOssuary ? 'ossuary' : this.act;
    // Player verbs are deliberately absent. Throw/return, pickup/carry, flame
    // transfer and skull-stage evolution happen during fully visible play and
    // must never synchronously recertify the whole scene from render(). Their
    // bounded dedicated pools/held signature are prepared independently.
    return `${this._webglGeneration}:${physicalDistrict}:${variant}`;
  }

  _currentPhysicalVariantReady() {
    const warmup = this.shaderWarmup;
    if (!warmup || warmup.status === 'skipped') return true;
    const progress = this.currentGpuResidency?.progressive;
    if (!progress || warmup.currentExactKey !== progress.key
        || warmup.currentExactRevision !== progress.exactShaderRevision) return false;
    const priority = this._shaderWarmPriorityKey();
    const required = [this._shaderWarmRequiredVariant(priority)].filter(Boolean);
    if (this.skull?.mode === 'held'
        && priority !== 'cave' && priority !== 'mirror') required.push('held-view');
    const ready = warmup.readyVariants || [];
    required.push('grain');
    required.push('current-view-exact');
    // A degraded generation may still contain a perfectly valid *different*
    // district. Never certify the live material pass merely because some
    // background job failed: keep the playable silhouette until this exact
    // district (and HELD pass, when present) is genuinely ready.
    return required.every((label) => ready.includes(label));
  }

  _ensureCurrentExactShaderWarmup(progress) {
    const state = this.shaderWarmup;
    if (!progress || !state || state.status === 'skipped'
        || state.generation !== this._webglGeneration) return false;
    const matches = state.currentExactKey === progress.key
      && state.currentExactRevision === progress.exactShaderRevision
      && state.readyVariants?.includes('current-view-exact');
    if (matches) return true;
    const identityMatches = state.currentExactKey === progress.key
      && state.currentExactRevision === progress.exactShaderRevision;
    // A scheduled/pending itinerary that has not reached current-view yet will
    // capture the live revision when it does. Only retire a certificate that
    // is already stale (or a pre-Wake itinerary that finished without one).
    const hasCapturedCurrent = state.currentExactKey != null;
    if (!hasCapturedCurrent && !['ready'].includes(state.status)) return false;
    if (hasCapturedCurrent && identityMatches && state.status === 'pending') return false;
    if (['invalidated', 'degraded'].includes(state.status)) return false;
    state.readyVariants = (state.readyVariants || [])
      .filter((label) => label !== 'current-view-exact');
    this._shaderResidentVariants.delete('current-view-exact');
    this._invalidateShaderWarmup(
      `current-exact-revision:${progress.key}:${progress.exactShaderRevision}`,
      { preserveResident: true, preserveTargets: true },
    );
    this._scheduleShaderWarmup();
    return false;
  }

  _darkenMirrorConsumers() {
    const house = this.houseMirror;
    if (house?.pane) {
      house.pane.setActive(false);
      house.pane.material.uniforms.tDiffuse.value = null;
      house.active = false;
      if (house.double) house.double.visible = false;
      if (house.echo) house.echo.visible = false;
    }
    for (const pane of this.finale?.panes || []) {
      pane.setActive(false);
      pane.material.uniforms.tDiffuse.value = null;
    }
  }

  _beginSkullWorldResidency(proofKey) {
    const root = this.skull?.root;
    const tether = this.skull?.tether;
    if (!root || !proofKey
        || this.currentGpuResidency?.skullWorldReadyKey === proofKey) return null;
    let ancestor = root;
    while (ancestor && ancestor !== this.scene) ancestor = ancestor.parent;
    // After the waterfall the skull is intentionally gone and can never be
    // thrown again. Do not reparent it merely to satisfy an irrelevant cache.
    if (ancestor !== this.scene) return null;

    const states = [];
    root.traverse((object) => {
      if (object.isLight) return;
      states.push({
        object,
        visible: object.visible,
        frustumCulled: object.frustumCulled,
        layerMask: object.layers.mask,
      });
      object.layers.set(0);
      // Growth pieces are revealed only when the skull is away and offscreen.
      // Submit every already-built anatomical buffer now under the exact P16
      // WORLD signature so that later authored stage evolution stays free.
      object.visible = true;
      if (object.isMesh || object.isLine || object.isPoints) {
        object.frustumCulled = false;
      }
    });
    let tetherState = null;
    if (tether?.parent === this.scene) {
      tetherState = {
        visible: tether.visible,
        opacity: tether.material?.opacity,
        frustumCulled: tether.frustumCulled,
        layerMask: tether.layers.mask,
      };
      tether.visible = true;
      tether.frustumCulled = false;
      tether.layers.set(0);
      if (tether.material) tether.material.opacity = 0;
    }
    root.updateMatrixWorld(true);
    const restore = () => {
      for (const state of states) {
        state.object.visible = state.visible;
        state.object.frustumCulled = state.frustumCulled;
        state.object.layers.mask = state.layerMask;
      }
      if (tetherState && tether) {
        tether.visible = tetherState.visible;
        tether.frustumCulled = tetherState.frustumCulled;
        tether.layers.mask = tetherState.layerMask;
        if (tether.material) tether.material.opacity = tetherState.opacity;
      }
      root.updateMatrixWorld(true);
    };
    const isRestored = () => states.every((state) =>
      state.object.visible === state.visible
      && state.object.frustumCulled === state.frustumCulled
      && state.object.layers.mask === state.layerMask)
      && (!tetherState || (
        tether.visible === tetherState.visible
        && tether.frustumCulled === tetherState.frustumCulled
        && tether.layers.mask === tetherState.layerMask
        && tether.material?.opacity === tetherState.opacity
      ));
    return {
      restore,
      isRestored,
      nodes: states.length,
      tether: !!tetherState,
      forceCarryProgramSelection: () =>
        this.flameCircuit?.forceCarryProgramSelection?.() || 0,
    };
  }

  _gpuIdentityProgramSnapshot() {
    return GPU_IDENTITY_TRACE ? new Set(this.renderer?.info?.programs || []) : null;
  }

  _gpuIdentityLightCensus(camera = this.camera) {
    if (!GPU_IDENTITY_TRACE || !camera) return null;
    const identities = [];
    this.scene?.traverseVisible((object) => {
      if (!object.isLight || (object.layers.mask & camera.layers.mask) === 0) return;
      identities.push({
        uuid: object.uuid,
        name: object.name || '(unnamed)',
        type: object.type,
        intensity: Number(object.intensity || 0),
        castShadow: !!object.castShadow,
        layers: object.layers.mask,
        parent: object.parent?.name || object.parent?.type || null,
      });
    });
    identities.sort((a, b) => a.type.localeCompare(b.type)
      || a.name.localeCompare(b.name) || a.uuid.localeCompare(b.uuid));
    const byType = {};
    for (const light of identities) byType[light.type] = (byType[light.type] || 0) + 1;
    return {
      camera: camera.name || camera.type,
      cameraLayers: camera.layers.mask,
      total: identities.length,
      directionalShadows: identities.filter((light) =>
        light.type === 'DirectionalLight' && light.castShadow).length,
      byType,
      identities,
    };
  }

  _gpuIdentityProgramSummary(beforePrograms, {
    roots = [this.scene, this.grainScene], camera = this.camera,
  } = {}) {
    if (!GPU_IDENTITY_TRACE || !beforePrograms) return null;
    const allPrograms = [...(this.renderer?.info?.programs || [])];
    const fresh = allPrograms.filter((program) => !beforePrograms.has(program));
    if (fresh.length === 0) {
      return {
        count: 0,
        programs: [],
        ownerTraversalSkipped: true,
        lights: this._gpuIdentityLightCensus(camera),
      };
    }
    const freshSet = new Set(fresh);
    const owners = new Map(fresh.map((program) => [program, []]));
    const seenObjects = new Set();
    const seenRoots = new Set();
    const candidatePrograms = (properties) => {
      const values = [];
      const add = (value) => {
        if (!value) return;
        if (freshSet.has(value)) values.push(value);
        if (freshSet.has(value.program)) values.push(value.program);
      };
      add(properties?.currentProgram);
      const programs = properties?.programs;
      if (programs instanceof Map) {
        for (const value of programs.values()) add(value);
      } else if (Array.isArray(programs)) {
        for (const value of programs) add(value);
      } else if (programs && typeof programs === 'object') {
        for (const value of Object.values(programs)) add(value);
      }
      return [...new Set(values)];
    };
    const scan = (object) => {
      if (seenObjects.has(object.uuid) || !object.material) return;
      seenObjects.add(object.uuid);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        const properties = this.renderer.properties?.get?.(material) || null;
        for (const program of candidatePrograms(properties)) {
          const list = owners.get(program);
          if (!list || list.length >= 24) continue;
          list.push({
            object: object.name || '(unnamed)',
            objectType: object.type,
            objectUuid: object.uuid,
            geometryUuid: object.geometry?.uuid || null,
            material: material.name || '(unnamed)',
            materialType: material.type,
            materialUuid: material.uuid,
            layers: object.layers.mask,
          });
        }
      }
    };
    for (const root of roots.filter(Boolean)) {
      if (seenRoots.has(root.uuid)) continue;
      seenRoots.add(root.uuid);
      root.traverse(scan);
    }
    return {
      count: fresh.length,
      ownerTraversalSkipped: false,
      programs: fresh.map((program) => ({
        id: program.id ?? null,
        name: program.name || null,
        cacheKey: `${program.cacheKey || ''}`.slice(0, 4096),
        usedTimes: program.usedTimes ?? null,
        owners: owners.get(program) || [],
      })),
      lights: this._gpuIdentityLightCensus(camera),
    };
  }

  _gpuIdentityGeometryCandidates(progress) {
    if (!GPU_IDENTITY_TRACE) return null;
    const rows = [];
    const seenObjects = new Set();
    const geometrySeen = progress?.geometrySeen || new Set();
    const add = (object, source, force = false) => {
      if (!object || seenObjects.has(object.uuid)
          || (!object.isMesh && !object.isLine && !object.isPoints)
          || !object.geometry || !object.material) return;
      seenObjects.add(object.uuid);
      if (!force && !this._reducedPhysicalCandidate(object)) return;
      const properties = this.renderer.properties?.get?.(object.geometry) || null;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      rows.push({
        source,
        object: object.name || '(unnamed)',
        objectType: object.type,
        objectUuid: object.uuid,
        geometryUuid: object.geometry.uuid,
        plannerSeen: geometrySeen.has(object.geometry.uuid),
        rendererPropertyKeys: Object.keys(properties || {}).sort(),
        materials: materials.filter(Boolean).map((material) => ({
          name: material.name || '(unnamed)', type: material.type, uuid: material.uuid,
          visible: material.visible !== false, transparent: !!material.transparent,
          opacity: material.opacity ?? 1,
        })),
        visible: object.visible,
        frustumCulled: object.frustumCulled,
        layers: object.layers.mask,
        parent: object.parent?.name || object.parent?.type || null,
      });
    };
    this._updateReducedWorldFrustum();
    this.scene?.traverseVisible((object) => add(object, 'current-world'));
    this.skull?.root?.traverse((object) => add(object, 'skull-root', true));
    add(this.skull?.tether, 'skull-tether', true);
    this.grainScene?.traverse((object) => add(object, 'grain', true));
    rows.sort((a, b) => Number(a.plannerSeen) - Number(b.plannerSeen)
      || a.source.localeCompare(b.source) || a.object.localeCompare(b.object));
    return {
      total: rows.length,
      plannerUnseen: rows.filter((row) => !row.plannerSeen).length,
      rendererPropertiesEmpty: rows.filter((row) => !row.rendererPropertyKeys.length).length,
      rows: rows.slice(0, 160),
    };
  }

  _beginGpuIdentityGeometryTrace(progress) {
    if (!GPU_IDENTITY_TRACE) return null;
    const objects = new Map();
    const addRoot = (root, source) => root?.traverse((object) => {
      if ((!object.isMesh && !object.isLine && !object.isPoints)
          || !object.geometry || !object.material) return;
      const existing = objects.get(object.uuid);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        return;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      objects.set(object.uuid, {
        object,
        sources: [source],
        detail: {
          object: object.name || '(unnamed)',
          objectType: object.type,
          objectUuid: object.uuid,
          geometryUuid: object.geometry.uuid,
          plannerSeen: !!progress?.geometrySeen?.has(object.geometry.uuid),
          materials: materials.filter(Boolean).map((material) => ({
            name: material.name || '(unnamed)', type: material.type, uuid: material.uuid,
          })),
          parent: object.parent?.name || object.parent?.type || null,
          visible: object.visible,
          layers: object.layers.mask,
        },
      });
    });
    addRoot(this.scene, 'scene');
    addRoot(this.skull?.root, 'skull-root');
    addRoot(this.skull?.tether, 'skull-tether');
    addRoot(this.grainScene, 'grain');

    const arrayOwners = new Map();
    const attributeRows = [];
    const addAttribute = (entry, role, attribute) => {
      if (!attribute) return;
      const source = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
      const array = source?.array;
      if (!array) return;
      const row = {
        key: `${entry.object.uuid}:${role}`,
        role,
        attribute: source,
        array,
        bytes: array.byteLength || 0,
        ...entry.detail,
        sources: [...entry.sources],
      };
      attributeRows.push(row);
      const owners = arrayOwners.get(array) || [];
      if (!owners.some((owner) => owner.key === row.key)) owners.push(row);
      arrayOwners.set(array, owners);
    };
    for (const entry of objects.values()) {
      const geometry = entry.object.geometry;
      addAttribute(entry, 'index', geometry.index);
      for (const [name, attribute] of Object.entries(geometry.attributes || {})) {
        addAttribute(entry, `attribute:${name}`, attribute);
      }
      for (const [name, attributes] of Object.entries(geometry.morphAttributes || {})) {
        for (let index = 0; index < (attributes || []).length; index++) {
          addAttribute(entry, `morph:${name}:${index}`, attributes[index]);
        }
      }
      if (entry.object.isInstancedMesh) {
        addAttribute(entry, 'instanceMatrix', entry.object.instanceMatrix);
        addAttribute(entry, 'instanceColor', entry.object.instanceColor);
      }
    }

    const attributesApi = this.renderer.attributes;
    const attributeApiAvailable = typeof attributesApi?.get === 'function';
    const bufferIds = new WeakMap();
    let nextBufferId = 1;
    const bufferId = (buffer) => {
      if (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function')) return null;
      let id = bufferIds.get(buffer);
      if (!id) { id = nextBufferId++; bufferIds.set(buffer, id); }
      return id;
    };
    const attributeState = (row) => {
      let state = null;
      try { state = attributesApi?.get?.(row.attribute) || null; } catch { state = null; }
      const geometryProperties = this.renderer.properties?.get?.(
        objects.get(row.objectUuid)?.object?.geometry,
      ) || null;
      return {
        resident: !!state,
        buffer: bufferId(state?.buffer),
        version: state?.version ?? null,
        type: state?.type ?? null,
        bytesPerElement: state?.bytesPerElement ?? null,
        geometryPropertyKeys: Object.keys(geometryProperties || {}).sort(),
      };
    };
    const snapshot = (rows) => new Map(rows.map((row) => [row.key, attributeState(row)]));
    // Bundled r161 does not expose renderer.attributes publicly, so the former
    // trace paid thousands of guaranteed-null lookups before and after every
    // subpass. When the API does exist, one complete baseline identifies the
    // only rows that can become newly resident; subsequent boundaries need to
    // revisit only that frozen subset. GL buffer hooks below remain the primary
    // allocation/update evidence in either case.
    const baseline = attributeApiAvailable ? snapshot(attributeRows) : new Map();
    const initiallyUnresidentRows = attributeApiAvailable
      ? attributeRows.filter((row) => baseline.get(row.key)?.resident === false)
      : [];
    const stateChanged = (before, after) => JSON.stringify(before) !== JSON.stringify(after);
    const gl = this.renderer.getContext();
    const originalBufferData = gl.bufferData;
    const originalBufferSubData = gl.bufferSubData;
    let phase = null;
    let phaseBefore = null;
    let phaseUploadStart = 0;
    const uploads = [];
    const recordUpload = (method, args) => {
      if (!phase) return;
      const array = args.find((value) => ArrayBuffer.isView(value));
      if (!array) return;
      const owners = arrayOwners.get(array) || [];
      uploads.push({
        phase,
        method,
        bytes: array.byteLength || 0,
        owners: owners.slice(0, 16).map(({ key, role, attribute, array: ignored, ...owner }) => ({
          key, role, ...owner,
        })),
      });
    };
    let wrapped = false;
    try {
      gl.bufferData = function tracedBufferData(...args) {
        recordUpload('bufferData', args);
        return originalBufferData.apply(this, args);
      };
      gl.bufferSubData = function tracedBufferSubData(...args) {
        recordUpload('bufferSubData', args);
        return originalBufferSubData.apply(this, args);
      };
      wrapped = gl.bufferData !== originalBufferData && gl.bufferSubData !== originalBufferSubData;
    } catch { wrapped = false; }
    const subpasses = [];
    return {
      begin(label) {
        phase = label;
        phaseBefore = snapshot(initiallyUnresidentRows);
        phaseUploadStart = uploads.length;
      },
      end(label = phase) {
        if (!phaseBefore) return;
        const after = snapshot(initiallyUnresidentRows);
        const changed = [];
        for (const row of initiallyUnresidentRows) {
          const beforeState = phaseBefore.get(row.key);
          const afterState = after.get(row.key);
          if (!stateChanged(beforeState, afterState)) continue;
          const { attribute, array, ...detail } = row;
          changed.push({ ...detail, before: beforeState, after: afterState });
        }
        subpasses.push({
          label,
          attributeApiAvailable,
          bufferHooksInstalled: wrapped,
          recheckedAttributes: initiallyUnresidentRows.length,
          changed: changed.slice(0, 160),
          uploads: uploads.slice(phaseUploadStart),
        });
        phase = null;
        phaseBefore = null;
      },
      stop() {
        if (phaseBefore) this.end(`${phase}:aborted`);
        try { if (gl.bufferData !== originalBufferData) gl.bufferData = originalBufferData; } catch { /* diagnostic */ }
        try {
          if (gl.bufferSubData !== originalBufferSubData) gl.bufferSubData = originalBufferSubData;
        } catch { /* diagnostic */ }
      },
      subpasses,
      candidates: {
        objects: objects.size,
        attributes: attributeRows.length,
        arrays: arrayOwners.size,
        attributeApiAvailable,
        stateCheckMode: attributeApiAvailable ? 'selective-unresident' : 'gl-hooks-only',
        stateChecksSkipped: attributeApiAvailable ? 0 : attributeRows.length,
        baselineResident: attributeApiAvailable
          ? attributeRows.length - initiallyUnresidentRows.length : null,
        initiallyUnresident: attributeApiAvailable
          ? initiallyUnresidentRows.length : null,
        bufferHooksInstalled: wrapped,
      },
    };
  }

  _submitExactCurrentPass({ key, kind = 'exact', material = null, includeHeld = false } = {}) {
    const renderer = this.renderer;
    const camera = this.camera;
    const scene = this.scene;
    const residency = this.currentGpuResidency;
    if (!renderer || !camera || !scene || !residency
        || residency.generation !== this._webglGeneration) return null;
    const generationAtStart = this._webglGeneration;
    const progressAtStart = residency.progressive;
    const revisionAtStart = progressAtStart?.exactShaderRevision ?? 0;
    if (residency.activeKey !== key || progressAtStart?.key !== key) return null;

    const startedAt = performance.now();
    const before = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    const identityProgramsBefore = this._gpuIdentityProgramSnapshot();
    const identityGeometryBefore = GPU_IDENTITY_TRACE
      ? this._gpuIdentityGeometryCandidates(residency.progressive) : null;
    const identityGeometryTrace = this._beginGpuIdentityGeometryTrace(
      residency.progressive,
    );
    let identityProgramsAtMark = identityProgramsBefore;
    let identityStatsAtMark = { ...before };
    const identitySubpasses = [];
    const markIdentitySubpass = (label, passCamera = camera, roots) => {
      if (!GPU_IDENTITY_TRACE) return;
      const stats = {
        programs: renderer.info.programs?.length || 0,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      };
      identitySubpasses.push({
        label,
        programDelta: stats.programs - identityStatsAtMark.programs,
        textureDelta: stats.textures - identityStatsAtMark.textures,
        geometryDelta: stats.geometries - identityStatsAtMark.geometries,
        programIdentity: this._gpuIdentityProgramSummary(identityProgramsAtMark, {
          roots: roots || [scene, this.grainScene], camera: passCamera,
        }),
      });
      identityProgramsAtMark = this._gpuIdentityProgramSnapshot();
      identityStatsAtMark = stats;
    };
    let previousTarget = null;
    let targetRead = false;
    let primeError = null;
    const restoreErrors = [];
    const previousCameraMask = camera.layers.mask;
    const previousOverride = scene.overrideMaterial;
    const previousBackground = scene.background;
    const previousAutoClear = renderer.autoClear;
    let previousScissorTest = false;
    let viewportRead = false;
    let scissorRead = false;
    const panes = [
      this.houseMirror?.pane,
      ...(this.finale?.panes || []),
    ].filter(Boolean);
    const paneStates = panes.map((pane) => ({
      pane,
      active: pane.active,
      texture: pane.material.uniforms.tDiffuse.value,
    }));
    let skullPrime = null;
    let skullPrimeInfo = null;
    let skullWorldSubmitted = false;
    let carryMaterialSelections = 0;
    const subpassTimings = [];
    const timeSubpass = (label, callback) => {
      const subpassStartedAt = performance.now();
      try { return callback(); }
      finally {
        subpassTimings.push({
          label,
          durationMs: performance.now() - subpassStartedAt,
        });
      }
    };
    const skullWorldProofKey = `${key}|${revisionAtStart}`;

    try {
      previousTarget = renderer.getRenderTarget();
      targetRead = true;
      renderer.getViewport(this._gpuPrimeViewport);
      viewportRead = true;
      renderer.getScissor(this._gpuPrimeScissor);
      scissorRead = true;
      previousScissorTest = renderer.getScissorTest();
      for (const { pane } of paneStates) {
        pane.setActive(false);
        pane.material.uniforms.tDiffuse.value = null;
      }
      scene.overrideMaterial = material;
      if (material) scene.background = this._reducedWorldBackground;
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, 1, 1);
      renderer.setScissor(0, 0, 1, 1);
      renderer.setScissorTest(true);
      renderer.autoClear = true;
      camera.layers.set(0);
      camera.layers.enable(LAYER_MAIN_ONLY);
      if (kind === 'exact' && !material
          && residency.skullWorldReadyKey !== skullWorldProofKey) {
        skullPrime = this._beginSkullWorldResidency(skullWorldProofKey);
        skullPrimeInfo = skullPrime;
      }
      timeSubpass('world', () => {
        if (skullPrime) {
          carryMaterialSelections += skullPrime.forceCarryProgramSelection?.() || 0;
        }
        identityGeometryTrace?.begin('world');
        renderer.render(scene, camera);
        identityGeometryTrace?.end('world');
        markIdentitySubpass('world', camera, [scene]);
      });
      if (skullPrime) {
        skullPrime.restore();
        skullWorldSubmitted = true;
        skullPrime = null;
      }
      if (includeHeld) {
        renderer.autoClear = false;
        renderer.clearDepth();
        camera.layers.set(LAYER_HELD);
        scene.background = null;
        timeSubpass('held', () => {
          if (skullPrimeInfo) {
            carryMaterialSelections += skullPrimeInfo.forceCarryProgramSelection?.() || 0;
          }
          identityGeometryTrace?.begin('held');
          renderer.render(scene, camera);
          identityGeometryTrace?.end('held');
          markIdentitySubpass('held', camera, [scene]);
        });
      }
      // Film grain is part of the delivered frame and used to compile cold
      // immediately after an otherwise certified world. Submit its exact quad
      // under the same hidden 1px state so visible-delta accounting covers the
      // complete compositor, not only the 3D scene.
      renderer.autoClear = true;
      timeSubpass('grain', () => {
        identityGeometryTrace?.begin('grain');
        renderer.render(this.grainScene, this.grainCam);
        identityGeometryTrace?.end('grain');
        markIdentitySubpass('grain', this.grainCam, [this.grainScene]);
      });
      if (skullPrimeInfo) this.flameCircuit?.invalidateCarryProgramRig?.();
    } catch (error) {
      primeError = error;
    } finally {
      try { skullPrime?.restore?.(); }
      catch (error) { restoreErrors.push(`skull: ${error?.message || error}`); }
      try { identityGeometryTrace?.stop?.(); }
      catch (error) { restoreErrors.push(`geometry trace: ${error?.message || error}`); }
      camera.layers.mask = previousCameraMask;
      scene.overrideMaterial = previousOverride;
      scene.background = previousBackground;
      for (const state of paneStates) {
        try {
          state.pane.material.uniforms.tDiffuse.value = state.texture;
          state.pane.setActive(state.active);
        } catch (error) {
          restoreErrors.push(`pane: ${error?.message || error}`);
        }
      }
      if (targetRead) {
        let restored = false;
        let lastError = null;
        for (let attempt = 0; attempt < 2 && !restored; attempt++) {
          try { renderer.setRenderTarget(previousTarget); restored = true; }
          catch (error) { lastError = error; }
        }
        if (!restored) restoreErrors.push(`target: ${lastError?.message || lastError}`);
      }
      if (viewportRead) {
        try { renderer.setViewport(this._gpuPrimeViewport); }
        catch (error) { restoreErrors.push(`viewport: ${error?.message || error}`); }
      }
      if (scissorRead) {
        try { renderer.setScissor(this._gpuPrimeScissor); }
        catch (error) { restoreErrors.push(`scissor: ${error?.message || error}`); }
      }
      try { renderer.setScissorTest(previousScissorTest); }
      catch (error) { restoreErrors.push(`scissor test: ${error?.message || error}`); }
      renderer.autoClear = previousAutoClear;
    }

    if (skullWorldSubmitted && skullPrimeInfo?.isRestored?.() !== true) {
      restoreErrors.push('skull source state mismatch');
    }
    if (this.currentGpuResidency !== residency
        || this._webglGeneration !== generationAtStart
        || residency.generation !== generationAtStart
        || residency.activeKey !== key
        || residency.progressive !== progressAtStart
        || progressAtStart?.key !== key
        || progressAtStart?.exactShaderRevision !== revisionAtStart) {
      restoreErrors.push('exact pass generation/key/revision changed during transaction');
    }

    const durationMs = performance.now() - startedAt;
    const entry = {
      generation: this._webglGeneration,
      key,
      kind,
      durationMs,
      subpasses: subpassTimings,
      programDelta: (renderer.info.programs?.length || 0) - before.programs,
      textureDelta: renderer.info.memory.textures - before.textures,
      geometryDelta: renderer.info.memory.geometries - before.geometries,
      committed: false,
      error: primeError?.message || (restoreErrors.length ? restoreErrors.join('; ') : null),
    };
    if (GPU_IDENTITY_TRACE) {
      entry.identity = {
        geometryBefore: identityGeometryBefore,
        geometrySubpasses: identityGeometryTrace?.subpasses || [],
        geometryTrace: identityGeometryTrace?.candidates || null,
        subpasses: identitySubpasses,
        lightCensusBefore: this._gpuIdentityLightCensus(camera),
      };
    }
    const list = kind === 'reduced' ? residency.reducedPasses : residency.exactPasses;
    list.push(entry);
    if (kind === 'reduced') {
      residency.maxReducedPrimeMs = Math.max(residency.maxReducedPrimeMs, durationMs);
    } else residency.maxExactMs = Math.max(residency.maxExactMs, durationMs);
    if (primeError || restoreErrors.length) {
      residency.errors.push(`${kind}:${key}: ${entry.error}`);
      return null;
    }
    if (skullWorldSubmitted) {
      residency.skullWorldReady = true;
      residency.skullWorldReadyKey = skullWorldProofKey;
      residency.skullWorldPasses.push({
        key,
        proofKey: skullWorldProofKey,
        nodes: skullPrimeInfo?.nodes || 0,
        tether: !!skullPrimeInfo?.tether,
        durationMs,
        programDelta: entry.programDelta,
        textureDelta: entry.textureDelta,
        geometryDelta: entry.geometryDelta,
        stateRestored: skullPrimeInfo?.isRestored?.() === true,
        carryMaterialSelections,
      });
    }
    entry.committed = true;
    return entry;
  }

  _gpuWeakIdentity(value, map, counterName) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
    let id = map.get(value);
    if (id == null) {
      id = this[counterName]++;
      map.set(value, id);
    }
    return id;
  }

  _reducedResourceRecord(attribute, role, submitted = true) {
    if (!attribute || attribute.isGLBufferAttribute) {
      return { error: `${role}: unsupported external or missing buffer attribute` };
    }
    const source = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
    const array = source?.array;
    if (!source || !array || !ArrayBuffer.isView(array)) {
      return { error: `${role}: buffer has no countable typed array` };
    }
    const byteLength = Number(array.byteLength);
    const byteOffset = Number(array.byteOffset || 0);
    const count = Number(source.count ?? attribute.count);
    const itemSize = Number(attribute.itemSize || 0);
    const version = Number(source.version || 0);
    if (!Number.isSafeInteger(byteLength) || byteLength < 0
        || !Number.isSafeInteger(byteOffset) || byteOffset < 0
        || !Number.isFinite(count) || count < 0
        || !Number.isFinite(itemSize) || itemSize <= 0
        || !Number.isSafeInteger(version) || version < 0) {
      return { error: `${role}: invalid buffer dimensions or version` };
    }
    const sourceId = this._gpuWeakIdentity(
      source, this._gpuResourceIds, '_nextGpuResourceId',
    );
    const arrayId = this._gpuWeakIdentity(
      array, this._gpuArrayIds, '_nextGpuArrayId',
    );
    const stride = Number(source.stride || itemSize);
    const meshPerAttribute = Number(attribute.meshPerAttribute || 0);
    const key = [
      this._webglGeneration, sourceId, version, arrayId,
      array.constructor?.name || 'TypedArray', byteOffset, byteLength,
      count, stride, source.usage ?? attribute.usage ?? 0,
      source.gpuType ?? attribute.gpuType ?? 0,
    ].join(':');
    const allocationKey = [
      this._webglGeneration, sourceId, arrayId,
      array.constructor?.name || 'TypedArray', byteOffset, byteLength,
      count, stride, source.usage ?? attribute.usage ?? 0,
      source.gpuType ?? attribute.gpuType ?? 0,
    ].join(':');
    const mappingKey = [
      key, itemSize, Number(attribute.offset || 0),
      Number(attribute.normalized), meshPerAttribute,
    ].join('@');
    const allocationMappingKey = [
      allocationKey, itemSize, Number(attribute.offset || 0),
      Number(attribute.normalized), meshPerAttribute,
    ].join('@');
    return {
      role, key, allocationKey, mappingKey, allocationMappingKey,
      byteLength, submitted, sourceId, version,
      count, itemSize, stride, arrayType: array.constructor?.name || null,
    };
  }

  _describeReducedEntry(entry, progress, { exact = false } = {}) {
    const object = entry?.object;
    const geometry = object?.geometry;
    const renderable = object?.isMesh || object?.isLine || object?.isPoints;
    if (!renderable || (!exact && (!object.isMesh || object.isLine || object.isPoints))
        || !geometry) {
      return { error: exact
        ? 'only Mesh, Line, and Points are legal exact preload signatures'
        : 'only Mesh and InstancedMesh are legal reduced signatures' };
    }
    const resources = [];
    const roles = [];
    const materials = (Array.isArray(object.material) ? object.material : [object.material])
      .filter(Boolean);
    const add = (attribute, role, submitted = true) => {
      const record = this._reducedResourceRecord(attribute, role, submitted);
      if (record.error) throw new Error(record.error);
      resources.push(record);
      roles.push(`${role}=${record.mappingKey}`);
    };
    try {
      if (geometry.index) add(geometry.index, 'index', true);
      for (const name of Object.keys(geometry.attributes || {}).sort()) {
        // WebGLGeometries.update uploads every geometry attribute before
        // material visibility or shader attribute use is considered. Reduced
        // clones therefore certify normals/UVs/etc. as honestly as position.
        add(geometry.attributes[name], `attribute:${name}`, true);
      }
      for (const name of Object.keys(geometry.morphAttributes || {}).sort()) {
        const list = geometry.morphAttributes[name] || [];
        for (let index = 0; index < list.length; index++) {
          add(list[index], `morph:${name}:${index}`, true);
        }
      }
      if (object.isInstancedMesh) {
        add(object.instanceMatrix, 'instanceMatrix');
        if (object.instanceColor) add(object.instanceColor, 'instanceColor', exact);
      }
      if (exact && object.isMesh && materials.some((material) => material.wireframe)) {
        // r161 lazily derives and uploads a separate edge index for wireframe
        // Mesh draws. It is not present in geometry.attributes, so charge a
        // conservative Uint32 upper bound explicitly instead of letting the
        // real driver allocation evade the byte/element caps.
        const source = geometry.index || geometry.attributes?.position;
        const sourceRecord = resources.find((resource) => resource.role
          === (geometry.index ? 'index' : 'attribute:position'));
        const sourceCount = Number(source?.count || 0);
        const edgeIndexCount = Math.floor(sourceCount / 3) * 6;
        const byteLength = edgeIndexCount * Uint32Array.BYTES_PER_ELEMENT;
        const allocationKey = [
          this._webglGeneration, 'derived-wireframe', geometry.uuid,
          sourceRecord?.allocationKey || 'missing-source', byteLength,
        ].join(':');
        const key = [allocationKey, sourceRecord?.version || 0].join(':');
        const record = {
          role: 'derived:wireframe-index', key, allocationKey,
          mappingKey: key, allocationMappingKey: allocationKey,
          byteLength, submitted: true, sourceId: null,
          version: sourceRecord?.version || 0, count: edgeIndexCount,
          itemSize: 1, stride: 1, arrayType: 'Uint32Array-upper-bound',
          derived: true, conservative: true,
        };
        resources.push(record);
        roles.push(`${record.role}=${record.mappingKey}`);
      }
    } catch (caught) {
      return { error: caught?.message || String(caught) };
    }
    const position = geometry.attributes?.position;
    const available = Number(geometry.index?.count ?? position?.count);
    if (!Number.isSafeInteger(available) || available < 0) {
      return { error: 'geometry has no safe indexed or position draw count' };
    }
    const rangeStart = Number(geometry.drawRange?.start ?? 0);
    const rangeCountValue = geometry.drawRange?.count ?? Number.POSITIVE_INFINITY;
    const rangeCount = rangeCountValue === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY : Number(rangeCountValue);
    if (!Number.isSafeInteger(rangeStart) || rangeStart < 0
        || (rangeCount !== Number.POSITIVE_INFINITY
          && (!Number.isSafeInteger(rangeCount) || rangeCount < 0))) {
      return { error: 'geometry has an invalid drawRange' };
    }
    const drawStart = Math.min(rangeStart, available);
    const requestedEnd = rangeCount === Number.POSITIVE_INFINITY
      ? available : Math.min(Number.MAX_SAFE_INTEGER, drawStart + rangeCount);
    const drawEnd = Math.min(available, requestedEnd);
    const drawElements = Math.max(0, drawEnd - drawStart);
    let effectiveInstances = 1;
    if (object.isInstancedMesh) {
      const sourceCount = Number(object.count);
      const matrixCapacity = Number(object.instanceMatrix?.count);
      const colorCapacity = object.instanceColor ? Number(object.instanceColor.count) : null;
      if (!Number.isSafeInteger(sourceCount) || sourceCount < 0
          || !Number.isSafeInteger(matrixCapacity) || matrixCapacity < 0) {
        return { error: 'InstancedMesh has an invalid count or matrix capacity' };
      }
      effectiveInstances = entry.preloadOnly ? Math.max(1, sourceCount) : sourceCount;
      if (effectiveInstances > matrixCapacity
          || (colorCapacity != null && (!Number.isSafeInteger(colorCapacity)
            || colorCapacity < sourceCount))) {
        return { error: 'InstancedMesh count exceeds matrix/color capacity' };
      }
    }
    const wireframeMultiplier = exact && object.isMesh
      && materials.some((material) => material.wireframe) ? 2 : 1;
    const submittedElements = drawElements * effectiveInstances * wireframeMultiplier;
    if (!Number.isSafeInteger(submittedElements)) {
      return { error: 'submitted element count overflows a safe integer' };
    }
    const unique = new Map();
    for (const resource of resources) {
      const existing = unique.get(resource.key);
      if (!existing) unique.set(resource.key, { ...resource });
      else existing.submitted ||= resource.submitted;
    }
    const referencedBytes = [...unique.values()]
      .reduce((total, resource) => total + resource.byteLength, 0);
    const exactDeferredBytes = [...unique.values()]
      .filter((resource) => !resource.submitted)
      .reduce((total, resource) => total + resource.byteLength, 0);
    const drawRangeKey = `${drawStart}:${rangeCount === Number.POSITIVE_INFINITY
      ? 'Infinity' : rangeCount}:${drawEnd}`;
    const geometryFingerprint = [
      geometry.uuid, drawRangeKey, Number(geometry.morphTargetsRelative),
      ...roles.sort(),
    ].join('|');
    const materialFingerprint = exact
      ? materials
          .map((material) => [
            material.uuid, material.version || 0,
            this._shaderWarmMaterialSignature(material),
          ].join(':')).join('~~')
      : 'reduced-basic';
    const materialAllocationFingerprint = exact
      ? materials
          .map((material) => [
            material.uuid, this._shaderWarmMaterialSignature(material),
          ].join(':')).join('~~')
      : 'reduced-basic';
    const objectFingerprint = [
      entry.key || object.uuid, object.type, entry.rig || 'world', materialFingerprint,
      geometryFingerprint, effectiveInstances,
      ...[...unique.values()].map((resource) =>
        `${resource.role}:${resource.key}:${Number(resource.submitted)}`).sort(),
    ].join('|');
    const transactionFingerprint = [
      entry.key || object.uuid, object.type, entry.rig || 'world',
      materialAllocationFingerprint, geometryFingerprint, effectiveInstances,
      ...[...unique.values()].map((resource) =>
        `${resource.role}:${resource.key}:${Number(resource.submitted)}`).sort(),
    ].join('|');
    const allocationFingerprint = [
      entry.key || object.uuid, object.type, entry.rig || 'world', materialAllocationFingerprint,
      // Draw range and live instance count change what is submitted, not the
      // GPU allocation or program-to-attribute mapping. Including them here
      // made animated pools continuously revoke an otherwise valid residency
      // certificate. Capacity/type/stride remain represented by the resource
      // allocationMappingKeys below.
      geometry.uuid, Number(geometry.morphTargetsRelative),
      ...resources.map((resource) => [
        resource.role, resource.allocationMappingKey, Number(resource.submitted),
      ].join(':')).sort(),
    ].join('|');
    return {
      object, geometry, resources: [...unique.values()],
      geometryFingerprint, objectFingerprint, transactionFingerprint,
      allocationFingerprint,
      referencedBytes, exactDeferredBytes,
      drawElements, effectiveInstances, submittedElements,
      displayName: object.name || `(unnamed ${object.type} ${object.uuid})`,
      type: object.type, objectUuid: object.uuid, geometryUuid: geometry.uuid,
      exact, rig: entry.rig || 'world', entryKey: entry.key || object.uuid,
      materialFingerprint,
    };
  }

  _submitReducedWorldBatch(progress, {
    // Eight real geometries leaves measured margin for the default-framebuffer
    // draw and diagnostic hooks on older D3D11 hardware. Sixteen remains the
    // hard admission ceiling asserted by the gates, not a target each
    // transaction is obliged to fill.
    geometryBudget = 8,
    objectBudget = 32,
    byteBudget = 512 * 1024,
    elementBudget = 16 * 1024,
    ownerOnly = false,
    deferredOnly = false,
    exactOnly = false,
    exactTarget = null,
    exactOwner = null,
  } = {}) {
    const renderer = this.renderer;
    const camera = this.camera;
    const residency = this.currentGpuResidency;
    if (!progress || progress.key !== residency?.activeKey || !progress.scene
        || residency.generation !== this._webglGeneration
        || !this._reducedBootstrapReady('mesh-basic')
        || !this._reducedBootstrapReady('instanced-basic')) return null;

    const queue = exactOnly
      ? (ownerOnly ? progress.ownerExactQueue
        : deferredOnly ? progress.deferredExactQueue : progress.exactQueue)
      : (ownerOnly ? progress.ownerQueue
        : deferredOnly ? progress.deferredQueue : progress.queue);
    const queuedSet = exactOnly
      ? (ownerOnly ? progress.ownerExactQueued
        : deferredOnly ? progress.deferredExactQueued : progress.exactQueued)
      : progress.queued;
    const committedResourceSet = exactOnly
      ? progress.exactResourceSeen : progress.admissionSeen;
    if (!ownerOnly && !deferredOnly && progress.blockedCritical) return null;
    if (!queue.length) return null;
    const exactRig = exactOnly ? queue[0].rig : null;
    const exactTargetPool = exactOwner === 'house'
      ? this.houseMirror?.pool : exactOwner === 'finale' ? this.finale?.mirrors : null;
    const exactTargetIdentity = exactTargetPool ? {
      poolRef: exactTargetPool.pool,
      poolEpoch: exactTargetPool.poolEpoch,
      poolSignature: this._renderTargetPoolIdentity(exactTargetPool.pool, exactTargetPool),
      targetRef: exactTarget,
      targetUuid: exactTarget?.texture?.uuid || null,
    } : null;
    const batchScene = new THREE.Scene();
    batchScene.name = `${exactOnly ? 'transient exact preload' : 'transient reduced batch'} ${progress.key}`;
    batchScene.background = this._reducedWorldBackground;
    batchScene.fog = this.scene.fog;
    batchScene.environment = exactOnly ? this.scene.environment : null;
    const exactLights = exactOnly ? this._addExactResidencyLightRig(batchScene, exactRig) : 0;
    const stagedEntries = [];
    const stagedResourceKeys = new Set();
    const stagedGeometryKeys = new Set();
    const types = { meshes: 0, lines: 0, points: 0 };
    let admissionBytes = 0;
    let referencedBytes = 0;
    let submittedResourceBytes = 0;
    let exactDeferredBytes = 0;
    let submittedElements = 0;
    let maxGeometryBytes = 0;
    let preloadObjects = 0;
    let ownerPreloadObjects = 0;
    let ownerPreloadGeometries = 0;
    let deferredPreloadObjects = 0;
    let deferredPreloadGeometries = 0;
    let oversize = null;
    let stagingFailure = null;
    const materialStates = new Map();

    const rollbackStaging = () => {
      for (const staged of stagedEntries) staged.clone.removeFromParent();
      for (const [material, state] of materialStates) {
        material.visible = state.visible;
        material.side = state.side;
      }
      while (batchScene.children.length) {
        batchScene.remove(batchScene.children[batchScene.children.length - 1]);
      }
    };
    const cloneFailure = (next, queueIndex) => {
      next.cloneFailures = (next.cloneFailures || 0) + 1;
      const permanent = next.cloneFailures >= 3;
      const failure = {
        object: next.object.name || next.object.uuid,
        objectUuid: next.object.uuid,
        type: next.object.type,
        owner: next.preloadOwner || null,
        deferred: next.preloadDeferred || null,
        exact: exactOnly,
        rig: next.rig || null,
        attempt: next.cloneFailures,
        permanent,
      };
      progress.cloneFailureEvents.push(failure);
      if (permanent) {
        const failureKey = exactOnly ? next.key : next.object.uuid;
        if (ownerOnly || deferredOnly) {
          queue.splice(queueIndex, 1);
          queuedSet.delete(exactOnly ? next.key : next.object.uuid);
        }
        if (!ownerOnly && !deferredOnly) {
          progress.failedObjects.add(failureKey);
          progress.blockedCritical = true;
          progress.blockedReason = 'clone:' + failureKey;
        }
        if (next.preloadOwner) progress.failedOwners.add(failureKey);
        if (next.preloadDeferred) progress.failedDeferred.add(failureKey);
        residency.errors.push(`${exactOnly ? 'exact' : 'reduced'} clone failed permanently: `
          + (exactOnly ? next.key : next.object.uuid));
      }
      return failure;
    };

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
      if (stagedEntries.length >= objectBudget) break;
      const next = queue[queueIndex];
      if (exactOnly && next.rig !== exactRig) break;
      const descriptor = this._describeReducedEntry(next, progress, { exact: exactOnly });
      if (descriptor.error) {
        stagingFailure = {
          object: next.object?.name || next.object?.uuid || '(unknown)',
          objectUuid: next.object?.uuid || null,
          type: next.object?.type || null,
          error: descriptor.error,
          permanent: true,
          accounting: true,
        };
        const failureKey = exactOnly ? next.key : next.object.uuid;
        if (!ownerOnly && !deferredOnly) {
          progress.failedObjects.add(failureKey);
          progress.blockedCritical = true;
          progress.blockedReason = 'accounting:' + failureKey;
        } else {
          // Hidden consumers fail closed, but a permanently uncountable entry
          // must not spin the same full-frame queue forever. Quarantine only
          // that owner/deferred entry; its failed set still prevents readiness.
          queue.splice(queueIndex, 1);
          queuedSet.delete(exactOnly ? next.key : next.object.uuid);
        }
        if (next.preloadOwner) progress.failedOwners.add(failureKey);
        if (next.preloadDeferred) progress.failedDeferred.add(failureKey);
        residency.errors.push(`${exactOnly ? 'exact' : 'reduced'} accounting blocked: `
          + (exactOnly ? next.key : (next.object?.uuid || 'unknown')) + ': ' + descriptor.error);
        break;
      }
      const newResources = descriptor.resources.filter((resource) =>
        !committedResourceSet.has(resource.key) && !stagedResourceKeys.has(resource.key));
      const nextAdmissionBytes = newResources
        .reduce((total, resource) => total + resource.byteLength, 0);
      const nextSubmittedResourceBytes = newResources
        .filter((resource) => resource.submitted)
        .reduce((total, resource) => total + resource.byteLength, 0);
      const nextExactDeferredBytes = newResources
        .filter((resource) => !resource.submitted)
        .reduce((total, resource) => total + resource.byteLength, 0);
      const newGeometry = !stagedGeometryKeys.has(descriptor.geometryFingerprint);
      const candidate = {
        objects: stagedEntries.length + 1,
        geometries: stagedGeometryKeys.size + Number(newGeometry),
        bytes: admissionBytes + nextAdmissionBytes,
        elements: submittedElements + descriptor.submittedElements,
      };
      const violations = [];
      if (candidate.objects > objectBudget) violations.push('objects');
      if (candidate.geometries > geometryBudget) violations.push('geometries');
      if (candidate.bytes > byteBudget) violations.push('bytes');
      if (candidate.elements > elementBudget) violations.push('submitted-elements');
      if (violations.length && stagedEntries.length) break;
      if (violations.length) {
        oversize = {
          object: descriptor.displayName,
          name: descriptor.displayName,
          objectUuid: descriptor.objectUuid,
          type: descriptor.type,
          geometryUuid: descriptor.geometryUuid,
          reason: violations.join(', '),
          bytes: nextAdmissionBytes,
          submittedElements: descriptor.submittedElements,
          limits: {
            geometries: geometryBudget,
            objects: objectBudget,
            bytes: byteBudget,
            submittedElements: elementBudget,
          },
        };
      }

      const clone = exactOnly
        ? this._cloneExactRenderable(next.object, { preloadOnly: next.preloadOnly })
        : this._cloneReducedRenderable(next.object, { preloadOnly: next.preloadOnly });
      if (!clone) {
        stagingFailure = cloneFailure(next, queueIndex);
        break;
      }
      batchScene.add(clone);
      if (exactOnly) {
        const materials = Array.isArray(clone.material) ? clone.material : [clone.material];
        for (const material of materials.filter(Boolean)) {
          if (!materialStates.has(material)) {
            materialStates.set(material, {
              visible: material.visible,
              side: material.side,
            });
          }
          material.visible = true;
        }
      }
      const staged = {
        next,
        clone,
        descriptor,
        newResources,
        newGeometry,
        transactionFingerprint: descriptor.transactionFingerprint,
      };
      stagedEntries.push(staged);
      for (const resource of newResources) stagedResourceKeys.add(resource.key);
      stagedGeometryKeys.add(descriptor.geometryFingerprint);
      admissionBytes += nextAdmissionBytes;
      referencedBytes += descriptor.referencedBytes;
      submittedResourceBytes += nextSubmittedResourceBytes;
      exactDeferredBytes += nextExactDeferredBytes;
      submittedElements += descriptor.submittedElements;
      maxGeometryBytes = Math.max(maxGeometryBytes, nextAdmissionBytes);
      if (clone.isPoints) types.points++;
      else if (clone.isLine) types.lines++;
      else types.meshes++;
      if (next.preloadOnly) {
        preloadObjects++;
        if (next.preloadOwner) ownerPreloadObjects++;
        if (next.preloadDeferred) deferredPreloadObjects++;
      }
      if (newGeometry && next.preloadOwner) ownerPreloadGeometries++;
      if (newGeometry && next.preloadDeferred) deferredPreloadGeometries++;
      if (oversize) break;
    }

    if (stagingFailure) {
      rollbackStaging();
      return {
        key: progress.key,
        kind: ownerOnly ? 'owner-clone-retry'
          : deferredOnly ? 'deferred-clone-retry' : 'reduced-clone-retry',
        objects: 0,
        geometries: 0,
        submittedObjects: 0,
        submittedElements: 0,
        geometryBytes: 0,
        types,
        error: stagingFailure.error || null,
        cloneFailure: stagingFailure,
        deferred: !stagingFailure.permanent,
        failed: !!stagingFailure.permanent,
      };
    }
    if (!stagedEntries.length) return null;

    const submittedObjects = exactOnly ? stagedEntries.length : batchScene.children.length;
    const persistentObjectsBefore = progress.scene.children.length;
    const startedAt = performance.now();
    const identityProgramsBefore = this._gpuIdentityProgramSnapshot();
    const before = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    let previousTarget = null;
    let targetRead = false;
    const previousViewport = new THREE.Vector4();
    const previousScissor = new THREE.Vector4();
    let viewportRead = false;
    let scissorRead = false;
    let previousScissorTest = false;
    const previousAutoClear = renderer.autoClear;
    const previousMask = camera.layers.mask;
    const restoreErrors = [];
    let error = null;
    let identityProgramResult = null;
    let programSelectionDurationMs = 0;
    let programSelectionObjects = 0;
    try {
      previousTarget = renderer.getRenderTarget();
      targetRead = true;
      renderer.getViewport(previousViewport);
      viewportRead = true;
      renderer.getScissor(previousScissor);
      scissorRead = true;
      previousScissorTest = renderer.getScissorTest();
      renderer.setRenderTarget(exactOnly ? exactTarget : null);
      renderer.setViewport(0, 0, 1, 1);
      renderer.setScissor(0, 0, 1, 1);
      renderer.setScissorTest(true);
      renderer.autoClear = true;
      camera.layers.set(0);
      if (exactOnly) {
        // Three r161 deliberately excludes MeshBasic/LineBasic/PointsMaterial
        // from light-state invalidation even though every program cache key
        // still contains the complete light/shadow cardinality. A material last
        // selected under HELD P2 can therefore survive an ordinary render under
        // WORLD P16 and leave the exact batch certifying the wrong binding.
        // `compile` explicitly acquires the program for this bounded batch's
        // real target, fog/environment, object signatures and exact light rig;
        // the following render creates the matching geometry/program VAOs.
        // Any genuinely missing program remains visible through programDelta
        // and fails the existing transaction/gate instead of being hidden.
        const selectionStartedAt = performance.now();
        renderer.compile(batchScene, camera, batchScene);
        programSelectionDurationMs = performance.now() - selectionStartedAt;
        programSelectionObjects = stagedEntries.length;
      }
      renderer.render(batchScene, camera);
      identityProgramResult = this._gpuIdentityProgramSummary(identityProgramsBefore, {
        roots: [batchScene], camera,
      });
    } catch (caught) {
      error = caught;
    } finally {
      camera.layers.mask = previousMask;
      for (const [material, state] of materialStates) {
        material.visible = state.visible;
        material.side = state.side;
      }
      if (targetRead) {
        let restored = false;
        let lastError = null;
        for (let attempt = 0; attempt < 2 && !restored; attempt++) {
          try { renderer.setRenderTarget(previousTarget); restored = true; }
          catch (caught) { lastError = caught; }
        }
        if (!restored) restoreErrors.push('target: ' + (lastError?.message || lastError));
      }
      if (viewportRead) {
        try { renderer.setViewport(previousViewport); }
        catch (caught) { restoreErrors.push('viewport: ' + (caught?.message || caught)); }
      }
      if (scissorRead) {
        try { renderer.setScissor(previousScissor); }
        catch (caught) { restoreErrors.push('scissor: ' + (caught?.message || caught)); }
      }
      try { renderer.setScissorTest(previousScissorTest); }
      catch (caught) { restoreErrors.push('scissor test: ' + (caught?.message || caught)); }
      renderer.autoClear = previousAutoClear;
    }

    const checkViewport = new THREE.Vector4();
    const checkScissor = new THREE.Vector4();
    try {
      renderer.getViewport(checkViewport);
      renderer.getScissor(checkScissor);
      if (targetRead && renderer.getRenderTarget() !== previousTarget) {
        restoreErrors.push('target mismatch');
      }
      if (viewportRead && !checkViewport.equals(previousViewport)) {
        restoreErrors.push('viewport mismatch');
      }
      if (scissorRead && !checkScissor.equals(previousScissor)) {
        restoreErrors.push('scissor mismatch');
      }
      if (renderer.getScissorTest() !== previousScissorTest) {
        restoreErrors.push('scissor-test mismatch');
      }
      if (renderer.autoClear !== previousAutoClear) restoreErrors.push('autoClear mismatch');
      if (camera.layers.mask !== previousMask) restoreErrors.push('camera-mask mismatch');
      if ([...materialStates].some(([material, state]) =>
        material.visible !== state.visible || material.side !== state.side)) {
        restoreErrors.push('material-state mismatch');
      }
      if (exactTargetIdentity && (exactTargetPool?.pool !== exactTargetIdentity.poolRef
          || exactTargetPool?.poolEpoch !== exactTargetIdentity.poolEpoch
          || this._renderTargetPoolIdentity(exactTargetPool.pool, exactTargetPool)
            !== exactTargetIdentity.poolSignature
          || exactTargetPool.pool?.[0] !== exactTargetIdentity.targetRef
          || exactTargetIdentity.targetRef?.texture?.uuid !== exactTargetIdentity.targetUuid)) {
        restoreErrors.push(`${exactOwner} exact target identity changed during transaction`);
      }
    } catch (caught) {
      restoreErrors.push('verification: ' + (caught?.message || caught));
    }
    const generationStable = residency === this.currentGpuResidency
      && residency.generation === this._webglGeneration
      && progress.key === residency.activeKey;
    const queuePrefixStable = stagedEntries.every((staged, index) =>
      queue[index] === staged.next);
    const fingerprintsStable = stagedEntries.every((staged) => {
      const current = this._describeReducedEntry(
        staged.next, progress, { exact: exactOnly },
      );
      staged.committedDescriptor = current;
      return !current.error
        && current.transactionFingerprint === staged.transactionFingerprint;
    });
    if (!generationStable) restoreErrors.push('generation/key changed during transaction');
    if (!queuePrefixStable) restoreErrors.push('queue prefix changed during transaction');
    if (!fingerprintsStable) restoreErrors.push('buffer fingerprint changed during transaction');

    const durationMs = performance.now() - startedAt;
    const entry = {
      generation: this._webglGeneration,
      key: progress.key,
      kind: exactOnly
        ? (ownerOnly ? 'owner-exact-preload-batch'
          : deferredOnly ? 'deferred-exact-preload-batch' : 'current-exact-preload-batch')
        : (ownerOnly ? 'owner-preload-batch'
          : deferredOnly ? 'deferred-preload-batch' : 'reduced-batch'),
      batch: ++progress.batches,
      objects: stagedEntries.length,
      submittedObjects,
      geometries: stagedGeometryKeys.size,
      types,
      rig: exactRig,
      lights: exactLights,
      targetOwner: exactOwner,
      targetUuid: exactTargetIdentity?.targetUuid || null,
      preloadObjects,
      ownerPreloadObjects,
      ownerPreloadGeometries,
      deferredPreloadObjects,
      deferredPreloadGeometries,
      geometryBytes: admissionBytes,
      referencedBytes,
      submittedResourceBytes,
      exactDeferredBytes,
      maxGeometryBytes,
      vertices: submittedElements,
      submittedElements,
      visibleObjects: exactOnly ? 0 : stagedEntries.length - preloadObjects,
      physicalReady: residency.physical.has(progress.key),
      oversize,
      isolatedOversize: !!oversize,
      persistentObjectsBefore,
      durationMs,
      programSelectionDurationMs,
      programSelectionObjects,
      programDelta: (renderer.info.programs?.length || 0) - before.programs,
      textureDelta: renderer.info.memory.textures - before.textures,
      geometryDelta: renderer.info.memory.geometries - before.geometries,
      stateRestored: restoreErrors.length === 0,
      generationStable,
      fingerprintsStable,
      queuePrefixStable,
      committed: false,
      error: error?.message || (restoreErrors.length ? restoreErrors.join('; ') : null),
    };
    if (GPU_IDENTITY_TRACE) {
      entry.identity = {
        programIdentity: identityProgramResult,
        sources: stagedEntries.slice(0, 64).map(({ next, descriptor, newGeometry }) => ({
          object: descriptor.displayName,
          objectType: descriptor.type,
          objectUuid: descriptor.objectUuid,
          geometryUuid: descriptor.geometryUuid,
          geometryBytes: descriptor.referencedBytes,
          submittedElements: descriptor.submittedElements,
          effectiveInstances: descriptor.effectiveInstances,
          newGeometry,
          preloadOnly: !!next.preloadOnly,
          preloadOwner: next.preloadOwner || null,
          preloadDeferred: next.preloadDeferred || null,
          exact: exactOnly,
          rig: next.rig || null,
          entryKey: next.key || null,
        })),
      };
    }
    (exactOnly ? residency.exactPreloadPasses : residency.reducedPasses).push(entry);
    if (exactOnly) {
      residency.maxExactPreloadMs = Math.max(residency.maxExactPreloadMs || 0, durationMs);
    } else residency.maxReducedPrimeMs = Math.max(residency.maxReducedPrimeMs, durationMs);
    if (entry.error) {
      rollbackStaging();
      const attempts = stagedEntries.map(({ next }) => {
        next.transactionFailures = (next.transactionFailures || 0) + 1;
        return next.transactionFailures;
      });
      const attempt = Math.max(0, ...attempts);
      const permanentEntries = stagedEntries.filter(({ next }) =>
        next.transactionFailures >= 3);
      const permanent = permanentEntries.length > 0;
      entry.transactionFailure = {
        attempt,
        permanent,
        sources: stagedEntries.map(({ next, descriptor }) => ({
          key: exactOnly ? next.key : next.object.uuid,
          object: descriptor.displayName,
          objectUuid: descriptor.objectUuid,
          geometryUuid: descriptor.geometryUuid,
          attempt: next.transactionFailures,
          permanent: next.transactionFailures >= 3,
        })),
      };
      if (attempt === 1 || permanent) {
        residency.errors.push(`${exactOnly ? 'exact-preload' : 'reduced'}:${progress.key}: `
          + entry.error);
      }
      if (permanent) {
        for (const { next } of permanentEntries) {
          const failureKey = exactOnly ? next.key : next.object.uuid;
          if (ownerOnly) progress.failedOwners.add(failureKey);
          else if (deferredOnly) progress.failedDeferred.add(failureKey);
          else progress.failedObjects.add(failureKey);
          // Owner/deferred failures are removed below and therefore relinquish
          // queue membership. A critical permanent failure deliberately remains
          // at the blocked prefix; keep its Set membership coherent so a later
          // census cannot append a duplicate copy behind the blocker.
          if (ownerOnly || deferredOnly) queuedSet.delete(failureKey);
        }
        if (ownerOnly || deferredOnly) {
          const permanentSet = new Set(permanentEntries.map(({ next }) => next));
          for (let index = queue.length - 1; index >= 0; index--) {
            if (permanentSet.has(queue[index])) queue.splice(index, 1);
          }
        }
        else {
          progress.blockedCritical = true;
          progress.blockedReason = `transaction:${exactOnly
            ? permanentEntries[0]?.next?.key
            : permanentEntries[0]?.next?.object?.uuid}`;
        }
      }
      entry.rollbackReason = entry.error;
      return null;
    }

    let persistentObjectsAdded = 0;
    for (const staged of stagedEntries) {
      const { next, clone } = staged;
      const descriptor = staged.committedDescriptor || staged.descriptor;
      if (exactOnly || next.preloadOnly) clone.removeFromParent();
      else {
        // Do not consume a just-submitted buffer in the same JavaScript task.
        // The next residency pass reveals this exact committed clone after one
        // browser paint boundary, while preserving progressive accumulation.
        clone.visible = false;
        progress.scene.add(clone);
        progress.pendingReducedReveal.push(clone);
        persistentObjectsAdded++;
      }
      if (exactOnly) {
        progress.exactProcessed.add(next.key);
        progress.exactFingerprints.set(next.key, descriptor.objectFingerprint);
        progress.exactAllocationFingerprints.set(next.key, descriptor.allocationFingerprint);
        progress.exactGeometryFingerprints.add(descriptor.geometryFingerprint);
        for (const resource of descriptor.resources) {
          if (resource.submitted) progress.exactResourceSeen.add(resource.key);
        }
        if (progress.exactUniverse.has(next.key)) progress.exactCovered.add(next.key);
        if (progress.ownerExactUniverse.has(next.key)) progress.ownerExactCovered.add(next.key);
        if (progress.deferredExactUniverse.has(next.key)) progress.deferredExactCovered.add(next.key);
        progress.exactQueued.delete(next.key);
        progress.ownerExactQueued.delete(next.key);
        progress.deferredExactQueued.delete(next.key);
      } else {
        progress.processed.add(next.object.uuid);
        progress.objectFingerprints.set(next.object.uuid, descriptor.objectFingerprint);
        progress.geometrySeen.add(descriptor.geometryUuid);
        progress.geometryFingerprints.add(descriptor.geometryFingerprint);
        for (const resource of descriptor.resources) {
          progress.admissionSeen.add(resource.key);
          if (resource.submitted) progress.resourceSeen.add(resource.key);
        }
        if (progress.ownerUniverse.has(next.object.uuid)) {
          progress.ownerCovered.add(next.object.uuid);
        }
        if (progress.deferredUniverse.has(next.object.uuid)) {
          progress.deferredCovered.add(next.object.uuid);
        }
      }
    }
    queue.splice(0, stagedEntries.length);
    entry.persistentObjectsAdded = persistentObjectsAdded;
    entry.persistentObjectsAfter = progress.scene.children.length;
    entry.physicalRevealDeferred = persistentObjectsAdded > 0;
    entry.pendingPhysicalRevealObjects = progress.pendingReducedReveal.length;
    entry.committed = true;
    return entry;
  }
  _recordOwnerGpuUniverse(progress) {
    const residency = this.currentGpuResidency;
    if (!progress || (!progress.ownerUniverse.size && !progress.ownerExactUniverse.size)
        || progress.ownerRecorded
        || progress.ownerQueue.length || progress.ownerExactQueue.length
        || progress.failedOwners.size
        || progress.ownerCovered.size !== progress.ownerUniverse.size
        || progress.ownerExactCovered.size !== progress.ownerExactUniverse.size) return false;
    const exactMembers = [...new Set([...progress.ownerExactUniverse]
      .map((key) => progress.exactObjects.get(key)?.object?.uuid).filter(Boolean))].sort();
    const exactCoveredMembers = [...new Set([...progress.ownerExactCovered]
      .map((key) => progress.exactObjects.get(key)?.object?.uuid).filter(Boolean))].sort();
    residency.ownerUniverses.push({
      key: progress.key,
      total: progress.ownerUniverse.size,
      covered: progress.ownerCovered.size,
      house: progress.ownerHouse.size,
      finale: progress.ownerFinale.size,
      houseGeometries: progress.ownerHouseGeometries.size,
      finaleGeometries: progress.ownerFinaleGeometries.size,
      exactOnlyDecorative: progress.ownerExactOnly.size,
      exactOnlyMembers: [...progress.ownerExactOnly].sort(),
      exactTotal: exactMembers.length,
      exactCovered: exactCoveredMembers.length,
      exactMembers,
      exactCoveredMembers,
      batches: progress.batches,
      members: [...progress.ownerUniverse].sort(),
      coveredMembers: [...progress.ownerCovered].sort(),
      criticalRefreshes: progress.criticalRefreshes,
      ownerPromotionChecks: progress.ownerPromotionChecks,
      criticalPromotedObjects: progress.criticalPromotedObjects,
      ownerPromotedObjects: progress.ownerPromotedObjects,
      cloneFailureEvents: [...progress.cloneFailureEvents],
    });
    progress.ownerRecorded = true;
    progress.ownerExactRecorded = true;
    return true;
  }

  _recordDeferredGpuUniverse(progress) {
    const residency = this.currentGpuResidency;
    if (!progress || !progress.deferredLabel
        || (!progress.deferredUniverse.size && !progress.deferredExactUniverse.size)
        || progress.deferredRecorded
        || progress.deferredQueue.length || progress.deferredExactQueue.length
        || progress.failedDeferred.size
        || progress.deferredCovered.size !== progress.deferredUniverse.size
        || progress.deferredExactCovered.size !== progress.deferredExactUniverse.size) return false;
    const exactMembers = [...new Set([...progress.deferredExactUniverse]
      .map((key) => progress.exactObjects.get(key)?.object?.uuid).filter(Boolean))].sort();
    const exactCoveredMembers = [...new Set([...progress.deferredExactCovered]
      .map((key) => progress.exactObjects.get(key)?.object?.uuid).filter(Boolean))].sort();
    residency.deferredUniverses.push({
      key: progress.key,
      label: progress.deferredLabel,
      total: progress.deferredUniverse.size,
      covered: progress.deferredCovered.size,
      geometries: progress.deferredGeometries.size,
      exactOnlyDecorative: progress.deferredExactOnly.size,
      exactOnlyMembers: [...progress.deferredExactOnly].sort(),
      exactTotal: exactMembers.length,
      exactCovered: exactCoveredMembers.length,
      exactMembers,
      exactCoveredMembers,
      members: [...progress.deferredUniverse].sort(),
      coveredMembers: [...progress.deferredCovered].sort(),
      promotionChecks: progress.deferredPromotionChecks,
      promotedObjects: progress.deferredPromotedObjects,
      cloneFailureEvents: [...progress.cloneFailureEvents]
        .filter((event) => event.deferred),
    });
    progress.deferredRecorded = true;
    progress.deferredExactRecorded = true;
    return true;
  }

  _deferredExactGpuPrerequisitesReady(progress) {
    const ready = this.shaderWarmup?.readyVariants || [];
    const requirements = {
      graveyard: ['ordinary', 'house-world', 'forest', 'clearing'],
      ossuary: ['ossuary'],
      forest: ['forest', 'clearing'],
      clearing: ['forest', 'clearing'],
      cave: ['cave-lights', 'cave-threat'],
    }[progress?.deferredLabel] || [];
    return requirements.every((label) => ready.includes(label));
  }

  _ownerExactGpuPrerequisitesReady(kind) {
    const ready = this.shaderWarmup?.readyVariants || [];
    if (kind === 'house') {
      const target = this._houseMirrorTargetWarmState;
      const pool = this.houseMirror?.pool;
      const liveTarget = pool?.pool?.[0];
      return ready.includes('house-world') && ready.includes('house-reflection')
        && ready.includes('house-mirror-target')
        && target?.generation === this._webglGeneration && target.status === 'ready'
        && target.poolRef === pool?.pool && target.poolEpoch === pool?.poolEpoch
        && target.poolSignature === this._renderTargetPoolIdentity(pool?.pool, pool)
        && target.targetRef === liveTarget
        && target.targetUuid === liveTarget?.texture?.uuid;
    }
    const target = this.finale?._targetWarmState;
    const pool = this.finale?.mirrors;
    return ready.includes('finale-world') && ready.includes('reflection-target')
      && target?.generation === this._webglGeneration && target.status === 'ready'
      && target.poolRef === pool?.pool && target.poolEpoch === pool?.poolEpoch
      && target.poolSignature === this._renderTargetPoolIdentity(pool?.pool, pool)
      && pool?.pool?.[0]?.texture?.uuid != null;
  }

  _ownerExactGpuTarget(kind) {
    return kind === 'house'
      ? this.houseMirror?.pool?.pool?.[0] || null
      : this.finale?.mirrors?.pool?.[0] || null;
  }

  _prepareCurrentGpuResidency({ bootstrapReadyAtRenderStart = false } = {}) {
    const warmup = this.shaderWarmup;
    if (!this.started || !warmup || warmup.status === 'skipped') {
      return { full: true, key: 'unmanaged' };
    }
    if (!this.currentGpuResidency
        || this.currentGpuResidency.generation !== this._webglGeneration) {
      this._resetCurrentGpuResidency('generation-change');
    }
    const residency = this.currentGpuResidency;
    const key = this._currentGpuResidencyKey();
    if (residency.activeKey !== key) {
      const previousKey = residency.activeKey;
      const retiredOwners = [...residency.owners];
      const destinationPhysicalWasResident = residency.physical.has(key);
      const destinationReducedWasResident = residency.reduced.has(key);
      this._clearReducedWorldProgress();
      // `progressive` owns the fingerprints that made both of these set
      // memberships true. Once that proof object is discarded, a certificate
      // from an earlier visit to the destination act is no longer sufficient:
      // Finale isolation, story-created actors, and restored visibility can all
      // change the geometry/program-to-VAO universe without changing the
      // generation or render-target UUIDs. Re-earn the destination physical and
      // owner certificates through the existing bounded hidden transactions.
      residency.reduced.delete(previousKey);
      residency.reduced.delete(key);
      residency.physical.delete(key);
      residency.owners.clear();
      residency.skullWorldReady = false;
      residency.skullWorldReadyKey = null;
      const destinationPhysicalRetired = !residency.physical.has(key);
      const destinationReducedRetired = !residency.reduced.has(key);
      if (GPU_IDENTITY_TRACE) {
        residency.keyTransitions ||= [];
        residency.keyTransitions.push({
          generation: this._webglGeneration,
          previousKey,
          key,
          retiredOwners,
          destinationPhysicalWasResident,
          destinationReducedWasResident,
          destinationPhysicalRetired,
          destinationReducedRetired,
        });
      }
      residency.activeKey = key;
      residency.activeSince = performance.now();
      residency.progressive = this._makeReducedWorldProgress(key);
    }
    const progress = residency.progressive || (residency.progressive =
      this._makeReducedWorldProgress(key));
    // A reduced batch's 1x1 transaction proves and commits its buffers/VAO, but
    // the clones stay invisible for the remainder of that paint. Reveal exactly
    // that committed prefix now, one browser task later, while the next hidden
    // prefix may upload behind the already-resident silhouette.
    let revealedReducedObjects = 0;
    if (progress.pendingReducedReveal.length) {
      revealedReducedObjects = progress.pendingReducedReveal.length;
      for (const clone of progress.pendingReducedReveal) clone.visible = true;
      progress.pendingReducedReveal.length = 0;
    }
    // Census the current physical universe first. The larger future owner scope
    // is a separate named task and can overlap the following resident-prefix
    // reveal, so Wake never waits for mirror geometry it cannot yet see.
    let currentSnapshotProgress = false;
    if (!progress.currentSnapshotReady) {
      this._refreshReducedWorldQueue(progress);
      currentSnapshotProgress = true;
      // When the complete fallback bootstrap was already resident before this
      // render began, the CPU-only current census and first hidden reduced
      // upload can safely share one bounded paint. The upload still remains
      // invisible until the following browser task. This removes a blank Wake
      // boundary without ever consuming a buffer in the task that created it.
      // A bootstrap that merely finalized during this render is deliberately
      // ineligible; its own program-reflection slice still owns the paint.
      if (!progress.currentSnapshotReady || !bootstrapReadyAtRenderStart
          || !progress.queue.length) {
        return { full: false, key, snapshotProgress: true };
      }
    }
    // A bootstrap submission already owns this paint. CPU census work above is
    // independent and bounded, but never stack a real geometry upload behind a
    // bootstrap render or draw fallback geometry before both Basic signatures
    // are resident in this WebGL generation.
    if (this._bootstrapAdvancedThisRender || !this._reducedBootstrapReady('mesh-basic')
        || !this._reducedBootstrapReady('instanced-basic')) {
      return {
        full: false, key, bootstrapPending: true,
        snapshotProgress: currentSnapshotProgress,
      };
    }
    if (revealedReducedObjects > 0) {
      // This paint consumes only the prefix whose hidden upload completed on the
      // previous paint. Nothing else shares the first physical consumption; the
      // future-owner census begins only after this silhouette is on screen.
      progress.hasPhysicalSilhouette = true;
      this._darkenMirrorConsumers();
      return {
        full: false,
        key,
        justReducedReveal: true,
        revealedReducedObjects,
      };
    }
    if (residency.physical.has(key)
        && (progress.ownerQueue.length || progress.deferredQueue.length
          || progress.ownerExactQueue.length || progress.deferredExactQueue.length)) {
      // Input remains live while a pane or district universe drains. If a turn or step
      // brings one of those not-yet-uploaded objects into the physical frustum,
      // promote it to the critical queue and briefly use the accumulated
      // silhouette again. This scan exists only during the bounded deferred phase;
      // steady full rendering returns to zero scene walks once it is complete.
      const promoted = this._promoteVisibleOwnerQueue(progress)
        + this._promoteVisibleDeferredQueue(progress);
      if (promoted) {
        residency.physical.delete(key);
        residency.reduced.delete(key);
        progress.complete = false;
      }
      const exactScan = this._refreshExactResidencyQueue(progress, 'critical');
      if (exactScan?.queued || exactScan?.error || !exactScan?.stable) {
        residency.physical.delete(key);
        residency.reduced.delete(key);
        progress.complete = false;
      }
    }
    if (residency.physical.has(key)) {
      // Deferred geometry is deliberately a second phase. The physical district
      // is already exact and fully playable; one bounded hidden batch advances
      // either the finite district universe or a possible mirror-view universe.
      // Only a corresponding mirror pane stays dark. Never make Wake or an act
      // transition wait for either queue.
      let ownerEntry = null;
      let deferredEntry = null;
      let ownerExactEntry = null;
      let deferredExactEntry = null;
      if (progress.deferredQueue.length) {
        deferredEntry = this._submitReducedWorldBatch(progress, { deferredOnly: true });
      } else if (progress.ownerQueue.length) {
        this._darkenMirrorConsumers();
        ownerEntry = this._submitReducedWorldBatch(progress, { ownerOnly: true });
      } else if (progress.deferredExactQueue.length
          && this._deferredExactGpuPrerequisitesReady(progress)) {
        deferredExactEntry = this._submitReducedWorldBatch(progress, {
          deferredOnly: true, exactOnly: true,
        });
      } else if (progress.ownerExactQueue.length) {
        const ownerKind = progress.ownerExactQueue[0]?.preloadOwner;
        if (ownerKind && this._ownerExactGpuPrerequisitesReady(ownerKind)) {
          this._darkenMirrorConsumers();
          ownerExactEntry = this._submitReducedWorldBatch(progress, {
            ownerOnly: true,
            exactOnly: true,
            exactOwner: ownerKind,
            exactTarget: this._ownerExactGpuTarget(ownerKind),
          });
        }
      }
      let finalizationProgress = null;
      const submittedEntry = deferredEntry || ownerEntry || deferredExactEntry || ownerExactEntry;
      // A final batch can already own most of a paint. Verify and serialize the
      // complete exact universe on the following paint, then preserve the prior
      // canvas for that one CPU-only transaction instead of stacking a large
      // census, membership sort/copy, and the full physical render.
      if (!submittedEntry && !progress.deferredQueue.length
          && !progress.deferredExactQueue.length && !progress.deferredRecorded
          && !progress.deferredFinalizeBlocked
          && progress.failedDeferred.size === 0
          && this._deferredExactGpuPrerequisitesReady(progress)) {
        const startedAt = performance.now();
        const scan = this._refreshExactResidencyQueue(progress, 'deferred');
        const scanEndedAt = performance.now();
        const recorded = !!scan?.stable && this._recordDeferredGpuUniverse(progress);
        const finalizeError = scan?.error || (!scan
          ? 'deferred exact final scan became unavailable'
          : (!scan.stable && scan.queued === 0 && scan.added === 0
              && scan.invalidated === 0)
            ? 'deferred exact final scan could not converge with an empty queue'
            : scan.stable && !recorded
              ? 'deferred exact universe could not be recorded after a stable scan'
              : null);
        if (finalizeError) {
          progress.deferredFinalizeBlocked = true;
          if (!scan?.error) residency.errors.push(
            `deferred-exact-finalize:${progress.key}: ${finalizeError}`,
          );
        }
        const entry = {
          generation: this._webglGeneration,
          key: progress.key,
          kind: 'deferred-exact-finalize',
          scope: 'deferred',
          scanDurationMs: scanEndedAt - startedAt,
          recordDurationMs: performance.now() - scanEndedAt,
          durationMs: performance.now() - startedAt,
          recorded,
          error: finalizeError,
        };
        residency.universeFinalizePasses.push(entry);
        finalizationProgress = entry;
      } else if (!submittedEntry && !progress.ownerQueue.length
          && !progress.ownerExactQueue.length && !progress.ownerRecorded
          && !progress.ownerFinalizeBlocked
          && progress.failedOwners.size === 0) {
        const ownerKind = [...progress.ownerExactUniverse]
          .map((entryKey) => progress.exactObjects.get(entryKey)?.preloadOwner)
          .find(Boolean);
        if (ownerKind && this._ownerExactGpuPrerequisitesReady(ownerKind)) {
          const startedAt = performance.now();
          const scan = this._refreshExactResidencyQueue(progress, 'owner');
          const scanEndedAt = performance.now();
          const recorded = !!scan?.stable && this._recordOwnerGpuUniverse(progress);
          const finalizeError = scan?.error || (!scan
            ? `${ownerKind} owner exact final scan became unavailable`
            : (!scan.stable && scan.queued === 0 && scan.added === 0
                && scan.invalidated === 0)
              ? `${ownerKind} owner exact final scan could not converge with an empty queue`
              : scan.stable && !recorded
                ? `${ownerKind} owner exact universe could not be recorded after a stable scan`
                : null);
          if (finalizeError) {
            progress.ownerFinalizeBlocked = true;
            if (!scan?.error) residency.errors.push(
              `${ownerKind}-owner-exact-finalize:${progress.key}: ${finalizeError}`,
            );
          }
          const entry = {
            generation: this._webglGeneration,
            key: progress.key,
            kind: `${ownerKind}-owner-exact-finalize`,
            scope: 'owner',
            scanDurationMs: scanEndedAt - startedAt,
            recordDurationMs: performance.now() - scanEndedAt,
            durationMs: performance.now() - startedAt,
            recorded,
            error: finalizeError,
          };
          residency.universeFinalizePasses.push(entry);
          finalizationProgress = entry;
        }
      }
      return {
        full: true,
        key,
        ownerProgress: !!ownerEntry,
        ownerEntry,
        deferredProgress: !!deferredEntry,
        deferredEntry,
        ownerExactProgress: !!ownerExactEntry,
        ownerExactEntry,
        deferredExactProgress: !!deferredExactEntry,
        deferredExactEntry,
        finalizationProgress,
      };
    }

    this._darkenMirrorConsumers();
    if (!progress.snapshotReady && progress.hasPhysicalSilhouette) {
      this._refreshReducedWorldQueue(progress);
      return { full: false, key, snapshotProgress: true };
    }
    if (progress.queue.length) {
      const entry = this._submitReducedWorldBatch(progress);
      if (!entry) return { full: false, key, snapshotProgress: currentSnapshotProgress };
      progress.complete = progress.queue.length === 0
        && progress.pendingReducedReveal.length === 0;
      if (progress.complete) residency.reduced.add(key);
      return {
        full: false, key, justReduced: true, entry,
        snapshotProgress: currentSnapshotProgress,
      };
    }
    if (!progress.snapshotReady) {
      this._refreshReducedWorldQueue(progress);
      return { full: false, key, snapshotProgress: true };
    }
    // The player may have turned while the preceding paint-sized batches ran.
    // Re-snapshot only at the empty-queue boundary; any newly visible object is
    // promoted and uploaded before the hidden exact pass. A stable view pays
    // one check, while a moving view remains playable in the reduced scene.
    if (this._refreshCriticalWorldQueue(progress) > 0) {
      const entry = this._submitReducedWorldBatch(progress);
      if (!entry) return { full: false, key };
      progress.complete = progress.queue.length === 0
        && progress.pendingReducedReveal.length === 0;
      return { full: false, key, justReduced: true, entry, refreshedView: true };
    }
    progress.complete = true;
    residency.reduced.add(key);
    if (progress.failedObjects.size) {
      // The generic fallback above should make this unreachable in shipping,
      // but an actually uncloneable critical object is safer as a moving Basic
      // silhouette than as a cold exact reveal or an infinite retry loop.
      return { full: false, key, cloneFailure: true };
    }

    // Register the live exact set before trusting a shader certificate. The
    // player can turn while reduced batches drain; Line/Points or a custom
    // material entering the frustum must revise current-view readiness before
    // any real exact preload is allowed to submit it.
    const precompileExactScan = this._refreshExactResidencyQueue(progress, 'critical');
    const precompileExactRevision = progress.exactShaderRevision;
    this._ensureCurrentExactShaderWarmup(progress);
    if (!this._currentPhysicalVariantReady()) {
      return { full: false, key, exactScan: precompileExactScan };
    }
    if (progress.exactQueue.length) {
      const entry = this._submitReducedWorldBatch(progress, { exactOnly: true });
      return { full: false, key, justExactPreload: !!entry, exactPreloadEntry: entry };
    }
    // No task boundary or source mutation exists between this scan and the
    // certificate. Reuse the already-stable result rather than recomputing the
    // complete critical descriptor/fingerprint universe twice in one paint.
    if (this.currentGpuResidency !== residency
        || residency.activeKey !== key || residency.progressive !== progress
        || progress.key !== key || progress.exactShaderRevision !== precompileExactRevision) {
      return { full: false, key, exactScan: precompileExactScan };
    }
    const exactScan = precompileExactScan;
    if (!exactScan?.stable || exactScan.error || progress.exactQueue.length) {
      return { full: false, key, exactScan };
    }
    const priority = this._shaderWarmPriorityKey();
    const includeHeld = this.skull?.mode === 'held'
      && priority !== 'cave' && priority !== 'mirror';
    const entry = this._submitExactCurrentPass({ key, includeHeld });
    if (entry) {
      residency.physical.add(key);
      // The hidden exact certificate can itself be a substantial bounded pass.
      // Keep this paint on the already-built Basic silhouette; the next paint
      // sees `physical` and delivers the first full exact frame. Never stack the
      // certification render and production render into one >100ms operation.
      return { full: false, key, justCertified: true, entry, exactScan };
    }
    return { full: false, key };
  }

  _renderReducedCurrentWorld(key) {
    const residency = this.currentGpuResidency;
    const scene = residency?.progressive?.key === key
      ? residency.progressive.scene : null;
    const camera = this.camera;
    if (!scene) return { calls: 0, triangles: 0 };
    const previousMask = camera.layers.mask;
    scene.background = this._reducedWorldBackground;
    scene.fog = this.scene.fog;
    camera.layers.set(0);
    try {
      this.renderer.render(scene, camera);
    } finally {
      camera.layers.mask = previousMask;
    }
    residency.reducedFrames++;
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  _ownerGpuResidencyKey(kind) {
    if (kind === 'house') {
      const mirrorPool = this.houseMirror?.pool;
      return `${this._webglGeneration}:house:${this._renderTargetPoolIdentity(
        mirrorPool?.pool, mirrorPool,
      )}`;
    }
    const mirrorPool = this.finale?.mirrors;
    return `${this._webglGeneration}:finale:${this._renderTargetPoolIdentity(
      mirrorPool?.pool, mirrorPool,
    )}`;
  }

  _renderTargetPoolIdentity(pool, owner = null) {
    if (!this._renderTargetPoolEpochs) {
      this._renderTargetPoolEpochs = new WeakMap();
      this._nextRenderTargetPoolEpoch = 1;
    }
    if (!Array.isArray(pool)) return 'no-pool';
    let epoch = this._renderTargetPoolEpochs.get(pool);
    if (!epoch) {
      epoch = this._nextRenderTargetPoolEpoch++;
      this._renderTargetPoolEpochs.set(pool, epoch);
    }
    const textures = pool.map((target) => target?.texture?.uuid || 'no-texture').join('|');
    return `epoch${owner?.poolEpoch ?? epoch}:budget${owner?.budget ?? pool.length}:size${owner?.size ?? 'na'}:${textures}`;
  }

  _ownerGpuPrerequisitesReady(kind) {
    const warmup = this.shaderWarmup;
    if (warmup?.status === 'skipped') return true;
    const ready = warmup?.readyVariants || [];
    const progress = this.currentGpuResidency?.progressive;
    if (!progress || progress.key !== this.currentGpuResidency?.activeKey
        || progress.ownerQueue.length || progress.ownerExactQueue.length
        || !progress.ownerRecorded || !progress.ownerExactRecorded
        || progress.failedOwners.size
        || progress.ownerCovered.size !== progress.ownerUniverse.size
        || progress.ownerExactCovered.size !== progress.ownerExactUniverse.size) return false;
    if (kind === 'house' && progress.ownerHouse.size === 0) return false;
    if (kind === 'finale' && progress.ownerFinale.size === 0) return false;
    if (kind === 'house') {
      const target = this._houseMirrorTargetWarmState;
      const mirrorPool = this.houseMirror?.pool;
      const poolRef = mirrorPool?.pool;
      const liveTarget = poolRef?.[0];
      const poolSignature = this._renderTargetPoolIdentity(poolRef, mirrorPool);
      return ready.includes('house-reflection')
        && ready.includes('house-mirror-target')
        && target?.generation === this._webglGeneration
        && target.status === 'ready' && target.warmed === 1
        && target.poolRef === poolRef
        && target.poolEpoch === mirrorPool?.poolEpoch
        && target.poolSignature === poolSignature
        && target.targetRef === liveTarget
        && liveTarget?.texture?.uuid === target.targetUuid;
    }
    const targets = this.finale?._targetWarmState;
    const mirrorPool = this.finale?.mirrors;
    const poolRef = mirrorPool?.pool;
    const signature = this._renderTargetPoolIdentity(poolRef, mirrorPool);
    return ready.includes('reflection-target')
      && ready.includes('finale-world')
      && targets?.generation === this._webglGeneration
      && targets.status === 'ready'
      && targets.warmed === this.finale?.mirrors?.budget
      && targets.poolRef === poolRef
      && this.finale?._targetPoolRefsMatch?.(targets) === true
      && targets.poolEpoch === mirrorPool?.poolEpoch
      && targets.poolSignature === signature
      && !targets.failedTargets?.length;
  }

  _ownerGpuCandidate(kind) {
    if (kind === 'house') {
      const house = this.houseMirror;
      const pos = house?.pos;
      return !!(house?.awakened && pos && !this.dead && this.act === 'house'
        && this.player.pos.y > -0.35 && this.player.pos.y < 2.95
        && this.player.pos.distanceTo(pos) < 7);
    }
    return !!(this.finale?.active && this.act === 'mirror'
      && !['black', 'end'].includes(this.finale.phase));
  }

  _prepareOwnerGpuResidency(kind) {
    const residency = this.currentGpuResidency;
    if (!residency || residency.generation !== this._webglGeneration
        || !this._ownerGpuCandidate(kind)) return { ready: false, candidate: false };
    const key = this._ownerGpuResidencyKey(kind);
    if (residency.owners.has(key)) return { ready: true, key };
    if (!this._ownerGpuPrerequisitesReady(kind)) return { ready: false, candidate: true, key };

    const renderer = this.renderer;
    const startedAt = performance.now();
    const before = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    };
    const identityProgramsBefore = this._gpuIdentityProgramSnapshot();
    let previousTarget = null;
    let targetRead = false;
    let viewportRead = false;
    let scissorRead = false;
    let previousScissorTest = false;
    const previousAutoClear = renderer.autoClear;
    const previousMask = this.camera.layers.mask;
    const restoreErrors = [];
    let error = null;
    let rendered = false;
    let identityProgramResult = null;
    try {
      previousTarget = renderer.getRenderTarget();
      targetRead = true;
      renderer.getViewport(this._gpuPrimeViewport);
      viewportRead = true;
      renderer.getScissor(this._gpuPrimeScissor);
      scissorRead = true;
      previousScissorTest = renderer.getScissorTest();
      if (kind === 'house') rendered = !!this.houseMirror.render(this.scene, this.camera);
      else {
        this.finale.completeContextRewarm?.(this._webglGeneration);
        rendered = !!this.finale.mirrors.update(this.scene, this.camera);
      }
      if (GPU_IDENTITY_TRACE) {
        const reflectionCamera = kind === 'house'
          ? this.houseMirror?.pool?._vcam : this.finale?.mirrors?._vcam;
        identityProgramResult = this._gpuIdentityProgramSummary(identityProgramsBefore, {
          roots: [this.scene], camera: reflectionCamera || this.camera,
        });
      }
    } catch (caught) {
      error = caught;
    } finally {
      this.camera.layers.mask = previousMask;
      if (targetRead) {
        let restored = false;
        let lastError = null;
        for (let attempt = 0; attempt < 2 && !restored; attempt++) {
          try { renderer.setRenderTarget(previousTarget); restored = true; }
          catch (caught) { lastError = caught; }
        }
        if (!restored) restoreErrors.push(`target: ${lastError?.message || lastError}`);
      }
      if (viewportRead) {
        try { renderer.setViewport(this._gpuPrimeViewport); }
        catch (caught) { restoreErrors.push(`viewport: ${caught?.message || caught}`); }
      }
      if (scissorRead) {
        try { renderer.setScissor(this._gpuPrimeScissor); }
        catch (caught) { restoreErrors.push(`scissor: ${caught?.message || caught}`); }
      }
      try { renderer.setScissorTest(previousScissorTest); }
      catch (caught) { restoreErrors.push(`scissor test: ${caught?.message || caught}`); }
      renderer.autoClear = previousAutoClear;
      // Certification is an invisible owner pass. The following normal frame
      // is the first one allowed to bind its texture into visible glass.
      if (kind === 'house') {
        this.houseMirror?.pane?.setActive(false);
        if (this.houseMirror?.pane) {
          this.houseMirror.pane.material.uniforms.tDiffuse.value = null;
        }
      } else {
        for (const pane of this.finale?.panes || []) {
          pane.setActive(false);
          pane.material.uniforms.tDiffuse.value = null;
        }
      }
    }

    const durationMs = performance.now() - startedAt;
    const entry = {
      generation: this._webglGeneration,
      key,
      kind,
      durationMs,
      rendered,
      programDelta: (renderer.info.programs?.length || 0) - before.programs,
      textureDelta: renderer.info.memory.textures - before.textures,
      geometryDelta: renderer.info.memory.geometries - before.geometries,
      error: error?.message || (restoreErrors.length ? restoreErrors.join('; ') : null),
    };
    if (GPU_IDENTITY_TRACE) entry.identity = { programIdentity: identityProgramResult };
    residency.ownerPasses.push(entry);
    residency.maxOwnerMs = Math.max(residency.maxOwnerMs, durationMs);
    if (error || restoreErrors.length || !rendered) {
      residency.errors.push(`owner:${key}: ${entry.error || 'no pane rendered'}`);
      return { ready: false, candidate: true, key, entry };
    }
    residency.owners.add(key);
    return { ready: true, candidate: true, key, justCertified: true, entry };
  }

  _compileWarmVariant(scene, camera, targetScene = scene, isCurrent = () => true) {
    const renderer = this.renderer;
    const generation = this._webglGeneration;
    const submittedAt = performance.now();
    const submittedMaterials = new Set();
    scene.traverse((object) => {
      if (!object?.material) return;
      for (const material of Array.isArray(object.material)
        ? object.material : [object.material]) {
        if (material) submittedMaterials.add(material);
      }
    });
    const wrappersFor = (material) => {
      const properties = renderer.properties?.get?.(material);
      const wrappers = [];
      const add = (candidate) => {
        const wrapper = candidate?.isReady && candidate?.program
          ? candidate
          : candidate?.program?.isReady && candidate.program?.program
            ? candidate.program : null;
        if (wrapper && !wrappers.includes(wrapper)) wrappers.push(wrapper);
      };
      add(properties?.currentProgram);
      const associated = properties?.programs;
      if (associated instanceof Map) {
        for (const value of associated.values()) add(value);
      } else if (Array.isArray(associated)) {
        for (const value of associated) add(value);
      } else if (associated && typeof associated === 'object') {
        for (const value of Object.values(associated)) add(value);
      }
      return wrappers;
    };
    const submittedSides = new Map([...submittedMaterials]
      .map((material) => [material, material.side]));
    if (!isCurrent()) {
      return Promise.resolve({
        generation, programs: 0, invalidated: true,
        rendererCompileDurationMs: 0, programCaptureDurationMs: 0,
        submitDurationMs: performance.now() - submittedAt,
        readinessPolls: 0, maxReadinessPollDurationMs: 0,
        finalizationDurationMs: 0,
        maxSynchronousSliceMs: performance.now() - submittedAt,
        identities: [],
      });
    }
    const rendererCompileAt = performance.now();
    let compiledMaterials;
    try {
      compiledMaterials = renderer.compile(scene, camera, targetScene);
    } finally {
      // r161 temporarily mutates transparent DoubleSide materials for its
      // BackSide/FrontSide pair. A driver/compiler exception must never leak
      // that internal state into the live shared material.
      for (const [material, side] of submittedSides) material.side = side;
    }
    const rendererCompileEndedAt = performance.now();
    for (const material of compiledMaterials || []) submittedMaterials.add(material);
    const programs = [];
    const seenPrograms = new Set();
    for (const material of submittedMaterials) {
      const associated = wrappersFor(material);
      for (const program of associated) {
        // r161 emits both BackSide and FrontSide programs for transparent
        // DoubleSide materials, then leaves only the latter in currentProgram.
        // A prior invalidated job may also have reached driver readiness before
        // it could materialize reflection. Capture every associated wrapper;
        // getUniforms/getAttributes are idempotent and readiness alone is not a
        // certificate that reflection was already paid.
        if (!seenPrograms.has(program)) {
          seenPrograms.add(program);
          programs.push(program);
        }
      }
    }
    const identities = programs.map((program) => ({
      id: program.id ?? null,
      cacheKey: `${program.cacheKey || ''}`,
    }));
    const submittedAtEnd = performance.now();
    const result = {
      generation,
      programs: programs.length,
      rendererCompileDurationMs: rendererCompileEndedAt - rendererCompileAt,
      programCaptureDurationMs: submittedAtEnd - rendererCompileEndedAt,
      submitDurationMs: submittedAtEnd - submittedAt,
      readinessPolls: 0,
      maxReadinessPollDurationMs: 0,
      finalizationDurationMs: 0,
      maxSynchronousSliceMs: submittedAtEnd - submittedAt,
      identities,
    };
    if (!programs.length) return Promise.resolve(result);

    // Native compileAsync polls material.currentProgram. Overlapping signatures
    // commonly share a material, and transparent DoubleSide compilation owns
    // two wrappers. Poll this complete immutable captured set instead.
    return new Promise((resolve, reject) => {
      const poll = () => {
        const contextUnavailable = this.terminal
          || generation !== this._webglGeneration
          || renderer.getContext()?.isContextLost?.();
        if (contextUnavailable) {
          resolve({ ...result, invalidated: true });
          return;
        }
        const pollAt = performance.now();
        result.readinessPolls++;
        try {
          if (!programs.every((program) => program.isReady() === true)) {
            const pollMs = performance.now() - pollAt;
            result.maxReadinessPollDurationMs = Math.max(
              result.maxReadinessPollDurationMs, pollMs,
            );
            result.maxSynchronousSliceMs = Math.max(result.maxSynchronousSliceMs, pollMs);
            setTimeout(poll, 10);
            return;
          }
          const finalizeAt = performance.now();
          if (!isCurrent()) {
            // A same-generation itinerary can be reprioritized after this GL
            // program was submitted, but browser shader compilation cannot be
            // cancelled. Keep its generation-wide slot until every captured
            // wrapper reports ready; otherwise a replacement itinerary can
            // overlap the stale driver job while telemetry falsely reports one.
            const pollMs = performance.now() - pollAt;
            result.maxReadinessPollDurationMs = Math.max(
              result.maxReadinessPollDurationMs, pollMs,
            );
            result.maxSynchronousSliceMs = Math.max(result.maxSynchronousSliceMs, pollMs);
            resolve({ ...result, invalidated: true, drainedAfterInvalidation: true });
            return;
          }
          const gl = renderer.getContext();
          const debug = renderer.debug;
          const previousShaderErrorCheck = debug?.checkShaderErrors;
          if (debug) debug.checkShaderErrors = false;
          try {
            for (const program of programs) {
              if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
                throw new Error(`warm WebGLProgram ${program.id ?? 'unknown'} failed link status`);
              }
              program.getUniforms();
              program.getAttributes();
            }
          } finally {
            if (debug) debug.checkShaderErrors = previousShaderErrorCheck;
          }
          result.finalizationDurationMs = performance.now() - finalizeAt;
          const pollMs = performance.now() - pollAt;
          result.maxReadinessPollDurationMs = Math.max(
            result.maxReadinessPollDurationMs, pollMs,
          );
          result.maxSynchronousSliceMs = Math.max(
            result.maxSynchronousSliceMs, result.finalizationDurationMs, pollMs,
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      setTimeout(poll, 0);
    });
  }

  _shaderWarmMaterialSignature(material) {
    if (!material) return 'none';
    const mapSlots = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'displacementMap',
      'emissiveMap', 'metalnessMap', 'roughnessMap', 'lightMap', 'envMap',
      'gradientMap', 'matcap', 'specularMap', 'clearcoatMap',
      'clearcoatNormalMap', 'clearcoatRoughnessMap', 'iridescenceMap',
      'iridescenceThicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
      'transmissionMap', 'thicknessMap', 'anisotropyMap',
    ];
    const maps = mapSlots.map((slot) => {
      const texture = material[slot];
      if (!texture) return `${slot}:0`;
      return `${slot}:1:${texture.channel ?? 0}:${texture.mapping ?? 0}:${texture.colorSpace || ''}`;
    }).join(',');
    const defines = Object.entries(material.defines || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`).join(',');
    let customKey = '';
    try { customKey = material.customProgramCacheKey?.call(material) || ''; } catch {}
    const shader = material.isShaderMaterial || material.isRawShaderMaterial
      ? `${material.vertexShader || ''}\u0000${material.fragmentShader || ''}` : '';
    // Deliberately no UUID: color/opacity/uniform-only clones share one driver
    // program. The fields below are the shader-defining portion of Three's
    // program cache key, plus custom source for authored ShaderMaterials.
    return [
      material.type, material.side, material.shadowSide ?? '',
      material.vertexColors ? 1 : 0, material.flatShading ? 1 : 0,
      material.fog === false ? 0 : 1, material.lights ? 1 : 0,
      material.toneMapped === false ? 0 : 1, material.premultipliedAlpha ? 1 : 0,
      material.dithering ? 1 : 0, material.transparent ? 1 : 0,
      material.alphaHash ? 1 : 0, material.alphaToCoverage ? 1 : 0,
      material.alphaTest || 0, material.blending, material.depthFunc,
      material.depthTest === false ? 0 : 1, material.depthWrite === false ? 0 : 1,
      material.wireframe ? 1 : 0, material.glslVersion || '',
      material.normalMapType ?? '', maps, defines, customKey, shader,
    ].join('|');
  }

  _collectShaderWarmTextures(material, out) {
    if (!material || !out) return;
    // Program compilation does not upload sampler resources in bundled Three r161.
    // Walk the actual material fields as well as authored ShaderMaterial
    // uniforms so a district's first visible draw cannot still be the first
    // `texImage2D` for a program that was otherwise resident.
    const collect = (value) => {
      // Render-target attachments must be initialized by binding their owning
      // target, never through initTexture. Finale's four-target resident pool
      // does that separately and also covers active-context restoration, where
      // pane uniforms can still reference the invalidated generation's texture.
      if (value?.isTexture && !value.isRenderTargetTexture) out.add(value);
      else if (Array.isArray(value)) for (const item of value) collect(item);
    };
    for (const value of Object.values(material)) collect(value);
    for (const uniform of Object.values(material.uniforms || {})) collect(uniform?.value);
  }

  _shaderWarmObjectSignature(object) {
    if ((!object?.isMesh && !object?.isLine && !object?.isPoints)
        || !object.geometry || !object.material) return null;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(Boolean)) return null;
    const attributes = object.geometry.attributes || {};
    const shaderGeometry = [
      attributes.color ? `color:${attributes.color.itemSize}` : 'color:0',
      attributes.tangent ? 'tangent:1' : 'tangent:0',
      attributes.uv ? 'uv:1' : 'uv:0',
      attributes.uv1 ? 'uv1:1' : 'uv1:0',
      attributes.uv2 ? 'uv2:1' : 'uv2:0',
      attributes.uv3 ? 'uv3:1' : 'uv3:0',
    ].join(',');
    const materialKey = materials.map((material) => this._shaderWarmMaterialSignature(material)).join('~~');
    return [
      object.isInstancedMesh ? 'instanced' : object.type,
      object.isSkinnedMesh ? 'skinned' : '',
      object.morphTargetInfluences ? 'morph' : '',
      object.instanceColor ? 'instance-color' : '',
      object.castShadow ? 'cast-shadow' : '',
      object.receiveShadow ? 'receive-shadow' : '',
      object.geometry.morphAttributes?.position?.length ? 'morph-position' : '',
      object.geometry.morphAttributes?.normal?.length ? 'morph-normal' : '',
      object.geometry.morphAttributes?.color?.length ? 'morph-color' : '',
      shaderGeometry, materialKey,
    ].join('|');
  }

  _addShaderWarmRepresentative(warmScene, object, seen, representatives, layer = 0) {
    const key = this._shaderWarmObjectSignature(object);
    if (!key) return false;
    const existing = seen instanceof Map ? seen.get(key) : (seen.has(key) ? true : null);
    if (existing) return existing === true ? false : existing;
    let representative;
    if (object.isInstancedMesh) {
      representative = new THREE.InstancedMesh(object.geometry, object.material, 1);
      representative.setMatrixAt(0, new THREE.Matrix4());
      if (object.instanceColor) representative.setColorAt(0, new THREE.Color(1, 1, 1));
    } else if (object.isPoints) {
      representative = new THREE.Points(object.geometry, object.material);
    } else if (object.isLineSegments) {
      representative = new THREE.LineSegments(object.geometry, object.material);
    } else if (object.isLineLoop) {
      representative = new THREE.LineLoop(object.geometry, object.material);
    } else if (object.isLine) {
      representative = new THREE.Line(object.geometry, object.material);
    } else if (object.isSkinnedMesh) {
      representative = new THREE.SkinnedMesh(object.geometry, object.material);
    } else {
      representative = new THREE.Mesh(object.geometry, object.material);
      if (object.morphTargetInfluences) representative.updateMorphTargets();
    }
    representative.name = `shader representative ${representatives.length + 1}`;
    representative.userData.shaderWarmSource = {
      object: object.name || object.type || 'unnamed',
      objectType: object.type || '',
      material: (Array.isArray(object.material) ? object.material : [object.material])
        .filter(Boolean)
        .map((material) => material.name || material.type || 'material')
        .join(' + '),
    };
    representative.castShadow = object.castShadow;
    representative.receiveShadow = object.receiveShadow;
    representative.visible = true;
    representative.frustumCulled = false;
    representative.layers.set(layer);
    representative.position.set(0, 0, -2.2);
    representative.scale.setScalar(0.0005);
    warmScene.add(representative);
    representatives.push(representative);
    if (seen instanceof Map) seen.set(key, representative);
    else seen.add(key);
    return representative;
  }

  _shaderWarmRootBatches(extraRoots = []) {
    const claimed = new Set();
    const batches = [];
    const take = (label, roots) => {
      const bounded = [];
      for (const root of roots || []) {
        if (!root || root === this.scene || claimed.has(root)) continue;
        claimed.add(root);
        bounded.push(root);
      }
      if (bounded.length) batches.push({ label, roots: bounded });
    };
    take('house-mirror', [this.houseMirror?.double, this.houseMirror?.echo]);
    take('static-world', this.staticWorldRenderRoots || []);
    const grave = new Set(this.graveyardRenderRoots || []);
    const forest = new Set(this.forest?.detailRoots || []);
    const cave = new Set(this.underfalls?.renderRoots || []);
    take('grave', grave);
    take('forest', forest);
    take('cave', cave);
    take('clearing', (this.outsideRenderRoots || []).filter((root) =>
      !grave.has(root) && !forest.has(root) && !cave.has(root)));
    take('atmosphere', [this.atmosphere?.group]);
    const finaleRoots = this.finale?.warmRoots || [];
    take('finale-room', finaleRoots.filter((root) => root !== this.finale?.figure));
    take('finale-figure', [this.finale?.figure]);
    take('house', this.houseRenderRoots || []);
    take('music-box-figure', [this.musicBox?.thingPool]);
    take('future-walker', this.enemies?.gpuResidencyRoots?.(['walker']) || []);
    take('future-resident', this.enemies?.gpuResidencyRoots?.(['resident']) || []);
    take('future-kneeler', this.enemies?.gpuResidencyRoots?.(['kneeler']) || []);
    take('future-choir', this.enemies?.gpuResidencyRoots?.(['choir']) || []);
    // The tether is a separate scene root and first becomes visible on the
    // throw edge. Treat it as part of the skull's WORLD/P16 registry so that
    // edge never owns its first LineBasic program or BufferGeometry upload.
    take('skull', [this.skull?.root, this.skull?.tether]);
    take('dynamic', [
      this.goreMesh,
      this.enemies?.stainPool,
      this._impactLight,
      this._impactRing,
      this.houseMirror?.double,
      this.houseMirror?.echo,
      ...(this.windowRelay?.visitor?.stages || []),
    ]);
    // Current-view is a certificate, not a chapter ownership bucket. Keep its
    // roots independent of `claimed`: a clearing-owned Points root can be in
    // the bedroom frustum long before the chronological clearing compile.
    // `_beginShaderWarmup` refreshes this list again at execution time.
    const currentRoots = [...new Set([
      ...(this.currentGpuResidency?.progressive?.exactObjects?.values() || []),
    ].filter((entry) => entry.critical && entry.rig === 'world')
      .map((entry) => entry.object).filter(Boolean))];
    if (currentRoots.length) batches.push({ label: 'current-view', roots: currentRoots });
    for (const entry of extraRoots) take(entry.label, [entry.root]);
    return batches;
  }

  _scheduleShaderWarmup() {
    if (this._shaderResidentGeneration !== this._webglGeneration) {
      this._shaderResidentGeneration = this._webglGeneration;
      this._shaderResidentVariants.clear();
    }
    if (this._shaderWarmupRecoveryGeneration !== this._webglGeneration) {
      this._shaderWarmupRecoveryGeneration = this._webglGeneration;
      this._shaderWarmupRecoveryRound = 0;
    }
    const state = this.shaderWarmup = {
      status: 'scheduled',
      generation: this._webglGeneration,
      mode: 'captured-program-readiness',
      variants: ['ordinary', 'ossuary', 'hidden-threat', 'cave-lights', 'cave-threat', 'grain'],
      errors: [],
      recoveryRound: this._shaderWarmupRecoveryRound || 0,
      // Current-view readiness is keyed below to a physical residency
      // key/revision. A bare label is never transferable to a replacement
      // itinerary, even within the same WebGL generation.
      carriedReadyVariants: [...this._shaderResidentVariants]
        .filter((label) => label !== 'current-view-exact'),
      maxShieldDurationMs: this._shaderMaxShieldDurationMs || 0,
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
      if (state !== this.shaderWarmup || state.generation !== this._webglGeneration) {
        this._shaderWarmupRun = null;
        state.status = 'invalidated';
        state.reason ||= 'stale-generation';
        return;
      }
      if (this.terminal) {
        this._shaderWarmupRun = null;
        state.status = 'skipped';
        state.reason = 'terminal';
        return;
      }
      // The playable fallback is itself a shader consumer. Let its two tiny
      // Basic signatures and the real grain quad cross WebGL first, one paint
      // each, before broad district compileAsync work can contend with Wake.
      const reducedReady = !this.started || (!!this.currentGpuResidency?.activeKey
        && this.currentGpuResidency.reduced.has(this.currentGpuResidency.activeKey));
      if (!this._reducedBootstrapReady() || !reducedReady) {
        state.status = 'bootstrap-wait';
        state.reason = this._reducedBootstrapReady()
          ? 'reduced-silhouette-residency' : 'reduced-bootstrap';
        this._shaderWarmupRun = run;
        return;
      }
      this._shaderWarmupRun = null;
      // Chrome exposes KHR_parallel_shader_compile through compileAsync. If an
      // older renderer has only the synchronous compiler and play has already
      // begun, do not replace a later organic hitch with one giant artificial
      // hitch in the player's current room.
      if (this.started && typeof this.renderer.compileAsync !== 'function') {
        state.status = 'skipped';
        state.reason = 'sync-compiler-after-start';
        return;
      }
      this._beginShaderWarmup(state);
    };
    this._shaderWarmupRun = run;
    // Focused hitch regression: hold the idle callback far enough away that
    // the harness can click Wake Up while status is provably still scheduled.
    // startGame then exercises the shipping continuation path by cancelling
    // this timer and beginning work on the next task. This affects test mode
    // only; an ordinary player still receives the browser's earliest idle slot.
    if (TEST_MODE && Q.has('warmupRace') && !this.started) {
      const handle = setTimeout(run, 10000);
      this._shaderWarmupCancel = () => clearTimeout(handle);
      return;
    }
    // A restored context while play is live cannot rely on a future title-idle
    // opportunity. Start the same bounded async pass on the next task.
    if (this.started) {
      const handle = setTimeout(run, 0);
      this._shaderWarmupCancel = () => clearTimeout(handle);
      return;
    }
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(run, { timeout: 1200 });
      this._shaderWarmupCancel = () => {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
      };
    } else {
      const handle = setTimeout(run, 350);
      this._shaderWarmupCancel = () => clearTimeout(handle);
    }
  }

  _cancelScheduledShaderWarmup() {
    if (!this._shaderWarmupCancel) return;
    this._shaderWarmupCancel();
    this._shaderWarmupCancel = null;
    this.shaderWarmup.status = 'skipped';
    this.shaderWarmup.reason = 'cancelled';
  }

  _scheduleRecoverableShaderRetry(state) {
    if (!state || state !== this.shaderWarmup || state.status !== 'degraded'
        || state.generation !== this._webglGeneration || this.terminal) return false;
    const recoverable = state.errors.some((error) => /(?:house-mirror-target|house-reflection|finale-reflection|finale-reflection runtime|reflection-target|house-world|ordinary|ossuary|forest|clearing|cave-lights|cave-threat|finale-world|held-view|current-view|grain|target:)/i.test(error));
    if (!recoverable || state.recoveryRound >= 2 || state.recoveryScheduled) return false;
    state.recoveryScheduled = true;
    const generation = state.generation;
    const nextRound = state.recoveryRound + 1;
    const handle = setTimeout(() => {
      if (this._shaderWarmupRecoveryTimer === handle) this._shaderWarmupRecoveryTimer = null;
      if (state !== this.shaderWarmup || state.status !== 'degraded'
          || generation !== this._webglGeneration || this.terminal) return;
      this._shaderWarmupRecoveryGeneration = generation;
      this._shaderWarmupRecoveryRound = nextRound;
      this._invalidateShaderWarmup('same-generation-resource-retry', {
        preserveResident: true,
      });
      this._scheduleShaderWarmup();
    }, 800);
    this._shaderWarmupRecoveryTimer = handle;
    return true;
  }

  _handleMirrorPoolChanged(kind, change = null) {
    for (const key of [...(this.currentGpuResidency?.owners || [])]) {
      if (key.startsWith(`${this._webglGeneration}:${kind}:`)) {
        this.currentGpuResidency.owners.delete(key);
      }
    }
    if (kind === 'house') {
      if (this._houseMirrorTargetWarmState) {
        this._houseMirrorTargetWarmState.status = 'invalidated';
        this._houseMirrorTargetWarmState.reason = 'pool-changed';
        this._houseMirrorTargetWarmState = null;
      }
      this.houseMirror?.pane?.setActive(false);
      if (this.houseMirror?.pane) {
        this.houseMirror.pane.material.uniforms.tDiffuse.value = null;
      }
      if (this.houseMirror?.double) this.houseMirror.double.visible = false;
      if (this.houseMirror?.echo) this.houseMirror.echo.visible = false;
      this._shaderResidentVariants.delete('house-mirror-target');
      this._shaderResidentVariants.delete('house-reflection');
    } else {
      this.finale?.invalidateWarmRenderTargets?.('pool-changed');
      this.finale?.beginContextRewarm?.(this._webglGeneration);
      for (const pane of this.finale?.panes || []) {
        pane.setActive(false);
        pane.material.uniforms.tDiffuse.value = null;
      }
      this._shaderResidentVariants.delete('reflection-target');
    }
    if (!this.terminal && this.shaderWarmup?.status !== 'skipped') {
      this._invalidateShaderWarmup(`${kind}-mirror-pool-changed`, {
        preserveResident: true,
        preserveTargets: true,
      });
      this._scheduleShaderWarmup();
    }
    if (GPU_IDENTITY_TRACE && this.currentGpuResidency) {
      this.currentGpuResidency.poolChanges ||= [];
      this.currentGpuResidency.poolChanges.push({
        kind,
        generation: this._webglGeneration,
        previousEpoch: change?.previousEpoch ?? null,
        poolEpoch: change?.poolEpoch ?? null,
        textureIds: [...(change?.textureIds || [])],
      });
    }
    return true;
  }

  _handleMirrorRuntimeFailure(kind, failure) {
    if (this.terminal) return false;
    const message = `${kind}-reflection runtime: ${failure?.phase || 'unknown'}: ${failure?.message || 'failure'}`;
    for (const key of this.currentGpuResidency?.owners || []) {
      if (key.startsWith(`${this._webglGeneration}:${kind}:`)) {
        this.currentGpuResidency.owners.delete(key);
      }
    }
    if (kind === 'house') {
      const targets = this._houseMirrorTargetWarmState;
      if (targets?.generation === this._webglGeneration) {
        targets.status = 'degraded';
        targets.warmed = 0;
        targets.failed = true;
        if (!targets.errors.includes(message)) targets.errors.push(message);
      }
      this.houseMirror.pane.setActive(false);
      this.houseMirror.pane.material.uniforms.tDiffuse.value = null;
      this.houseMirror.double.visible = false;
      this.houseMirror.echo.visible = false;
    } else {
      const targets = this.finale?._targetWarmState;
      if (targets?.generation === this._webglGeneration) {
        targets.status = 'degraded';
        targets.warmed = 0;
        if (!targets.failedTargets.includes(-1)) targets.failedTargets.push(-1);
        if (!targets.errors.includes(message)) targets.errors.push(message);
        this.finale._scheduleWarmRenderTargetRecovery?.(targets);
      }
      this.finale?.beginContextRewarm?.(this._webglGeneration);
    }
    const shader = this.shaderWarmup;
    if (shader && shader.generation === this._webglGeneration
        && !['invalidated', 'skipped'].includes(shader.status)) {
      if (!shader.errors.includes(message)) shader.errors.push(message);
      shader.status = 'degraded';
      const retire = kind === 'house'
        ? new Set(['house-mirror-target', 'house-reflection'])
        : new Set(['reflection-target']);
      shader.readyVariants = (shader.readyVariants || [])
        .filter((label) => !retire.has(label));
      for (const label of retire) this._shaderResidentVariants.delete(label);
      this._scheduleRecoverableShaderRetry(shader);
    }
    return true;
  }

  _invalidateShaderWarmup(reason = 'invalidated', {
    preserveResident = false,
    preserveTargets = false,
  } = {}) {
    if (this._shaderWarmupRecoveryTimer) {
      clearTimeout(this._shaderWarmupRecoveryTimer);
      this._shaderWarmupRecoveryTimer = null;
    }
    this._shaderWarmupCancel?.();
    this._shaderWarmupCancel = null;
    this._shaderWarmupRun = null;
    const state = this.shaderWarmup;
    if (state) {
      state.preserveResidentOnInvalidation = preserveResident;
      state.status = 'invalidated';
      state.reason = reason;
      state.invalidatedAt = performance.now();
      state._invalidate?.(reason);
    }
    if (!preserveResident) {
      for (const material of this._shaderWarmMaterials || []) material.dispose();
      this._shaderWarmMaterials = null;
      this._shaderResidentVariants.clear();
    }
    if (!preserveTargets && this._houseMirrorTargetWarmState) {
      this._houseMirrorTargetWarmState.status = 'invalidated';
      this._houseMirrorTargetWarmState.reason = reason;
      this._houseMirrorTargetWarmState = null;
    }
    // A context generation owns the render-target texture currently sampled by
    // the lag mirror. Retire that binding immediately; otherwise an active pane
    // can expose an invalid attachment while the restored generation is still
    // compiling. Dark silver is the deterministic safe fallback.
    if (!preserveTargets && this.houseMirror?.pane) {
      this.houseMirror.pane.setActive(false);
      this.houseMirror.pane.material.uniforms.tDiffuse.value = null;
    }
    if (!preserveTargets && this.houseMirror?.double) this.houseMirror.double.visible = false;
    if (!preserveTargets && this.houseMirror?.echo) this.houseMirror.echo.visible = false;
    if (!preserveTargets) this.finale?.invalidateWarmRenderTargets?.(reason);
  }

  _beginShaderWarmup(state) {
    // `compileAsync` still traverses its input synchronously. Build a bounded
    // program-signature scene from explicit district ownership registries, then
    // discover and initiate late variants one paint-separated slice at a time.
    // No call in this path ever traverses `this.scene`.
    state.status = 'pending';
    state.startedAt = performance.now();
    state.setupSlices = [];
    state.compileSlices = [];
    state.maxSetupSliceMs = 0;
    state.maxCompileSliceMs = 0;
    state.maxTextureSliceMs = 0;
    state.discoveryNodes = 0;
    state.texturesDiscovered = 0;
    state.texturesWarmed = 0;
    state.pendingTextures = 0;
    state.variantLights = {};
    state.variantLightTypes = {};
    state.variants = [];
    // Same-generation reprioritization cancels only the obsolete signature
    // itinerary. Completed program labels stay resident; physical buffers are
    // owned separately by currentGpuResidency's exact live-scene submissions.
    state.readyVariants = [...(state.carriedReadyVariants || [])];
    state.currentExactKey = null;
    state.currentExactRevision = null;
    state.currentExactUniverse = 0;
    state.currentExactRoots = 0;
    state.currentExactRepresentatives = 0;
    state.currentExactSignatureEntries = 0;
    state.currentExactLiveSignatureEntries = 0;
    state.currentExactSignatureSlices = 0;
    state.currentExactLiveSignatureSlices = 0;
    state.currentExactSignatureSliceLimit = 360;
    state.currentExactSignatureMaxSliceEntries = 0;
    state.currentExactStatus = 'awaiting-progress';
    // `compileAsync` still traverses and creates each program synchronously.
    // Launch exactly one signature per paint; current play never waits behind
    // this background queue, so there is no reason to spend four programs from
    // one player's frame merely to make an offline itinerary finish sooner.
    state.variantBatchSize = 1;
    state.compileConcurrencyLimit = 1;
    state.compileJobsInFlight = 0;
    state.maxCompileJobsInFlight = 0;
    state.compileSlotWaits = 0;
    state.maxCompileSlotWaitMs = 0;
    state.compileJobs = [];
    state.renderShieldFrames = 0;
    // A restored context has no resident programs at all. Remember the live
    // district now so its exact pass can jump the background chapter queue;
    // otherwise losing GL in Underfalls made the player wait behind every
    // house/grave/forest compile before a single cave pixel returned.
    state.priorityAct = this._shaderWarmPriorityKey();
    const generation = state.generation;
    let compileActivity = this._shaderCompileActivity;
    if (!compileActivity || compileActivity.generation !== generation) {
      compileActivity = {
        generation,
        active: 0,
        peak: 0,
        waiters: new Set(),
        jobs: [],
      };
      this._shaderCompileActivity = compileActivity;
    }
    state.generationCompileJobsInFlight = compileActivity.active;
    state.generationMaxCompileJobsInFlight = compileActivity.peak;
    let invalidated = false;
    let resolveInvalidation;
    const invalidation = new Promise((resolve) => { resolveInvalidation = resolve; });
    const taskCancels = new Set();
    const isCurrent = () => !this.terminal && !invalidated
      && state === this.shaderWarmup
      && generation === this._webglGeneration;
    state._invalidate = (reason = 'invalidated') => {
      if (invalidated) return;
      invalidated = true;
      state.status = 'invalidated';
      state.reason = reason;
      for (const cancel of [...taskCancels]) cancel();
      resolveInvalidation(reason);
    };
    const waitForCompileSlot = async () => {
      while (isCurrent() && compileActivity.active >= state.compileConcurrencyLimit) {
        state.compileSlotWaits++;
        const waitStartedAt = performance.now();
        let wake = null;
        const available = new Promise((resolve) => {
          wake = resolve;
          compileActivity.waiters.add(resolve);
        });
        const released = await Promise.race([
          available.then(() => true),
          invalidation.then(() => false),
        ]);
        compileActivity.waiters.delete(wake);
        state.maxCompileSlotWaitMs = Math.max(
          state.maxCompileSlotWaitMs,
          performance.now() - waitStartedAt,
        );
        if (!released || !isCurrent()) return false;
      }
      return isCurrent();
    };

    const nextPaintTask = () => new Promise((resolve) => {
      let raf = 0, timer = 0, settled = false;
      const finishWait = (live) => {
        if (settled) return;
        settled = true;
        taskCancels.delete(cancel);
        resolve(live);
      };
      const cancel = () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        finishWait(false);
      };
      taskCancels.add(cancel);
      raf = requestAnimationFrame(() => {
        timer = setTimeout(() => finishWait(isCurrent()), 0);
      });
    });
    const nextIdleTask = () => new Promise((resolve) => {
      // Driver program creation is background work. Launch it from a browser
      // idle boundary (still one signature at a time) rather than spending the
      // front half of a gameplay rAF callback. The 120ms timeout guarantees
      // forward progress while the progressive current-view fallback remains
      // playable; the measured launch itself still owns a strict <100ms frame
      // gate and can never extend an opaque fade.
      if (typeof requestIdleCallback !== 'function') {
        nextPaintTask().then(resolve);
        return;
      }
      let handle = 0, settled = false;
      const finishWait = (live) => {
        if (settled) return;
        settled = true;
        taskCancels.delete(cancel);
        resolve(live);
      };
      const cancel = () => {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
        finishWait(false);
      };
      taskCancels.add(cancel);
      handle = requestIdleCallback(() => finishWait(isCurrent()), { timeout: 120 });
    });
    const recordSlice = (kind, label, startedAt, detail = null) => {
      const ms = performance.now() - startedAt;
      const entry = {
        label,
        ms,
        atMs: startedAt - state.startedAt,
        ...(detail && typeof detail === 'object' ? detail : {}),
      };
      if (kind === 'compile') {
        state.compileSlices.push(entry);
        state.maxCompileSliceMs = Math.max(state.maxCompileSliceMs, ms);
      } else if (kind === 'texture') {
        state.textureSlices.push(entry);
        state.maxTextureSliceMs = Math.max(state.maxTextureSliceMs, ms);
      } else {
        state.setupSlices.push(entry);
        state.maxSetupSliceMs = Math.max(state.maxSetupSliceMs, ms);
      }
      return entry;
    };
    const runSlice = async (kind, label, fn, { idle = false } = {}) => {
      if (!await (idle ? nextIdleTask() : nextPaintTask()) || !isCurrent()) return false;
      const at = performance.now();
      try {
        const detail = { scheduledAs: idle ? 'idle' : 'paint', ...(fn() || {}) };
        recordSlice(kind, label, at, detail);
        return true;
      } catch (error) {
        if (isCurrent()) state.errors.push(`${label}: ${error?.message || error}`);
        recordSlice(kind, label, at, {
          scheduledAs: idle ? 'idle' : 'paint',
          error: error?.message || `${error}`,
        });
        return false;
      }
    };

    const warmScene = new THREE.Scene();
    warmScene.fog = this.scene.fog;
    warmScene.environment = this.scene.environment;
    const warmCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 20);
    warmCamera.layers.set(0);
    warmScene.add(warmCamera);
    const reflectionScene = new THREE.Scene();
    reflectionScene.fog = this.scene.fog;
    reflectionScene.environment = this.scene.environment;
    const reflectionCamera = warmCamera.clone();
    reflectionCamera.layers.set(0);
    reflectionCamera.layers.enable(LAYER_DOUBLE);
    reflectionCamera.updateMatrixWorld(true);
    reflectionScene.add(reflectionCamera);
    const heldScene = new THREE.Scene();
    heldScene.fog = this.scene.fog;
    heldScene.environment = this.scene.environment;
    const heldCamera = warmCamera.clone();
    heldCamera.layers.set(LAYER_HELD);
    heldCamera.updateMatrixWorld(true);
    heldScene.add(heldCamera);
    const warmRepresentatives = [];
    const reflectionRepresentatives = [];
    const heldRepresentatives = [];
    let coreRepresentatives = [];
    const warmSignatures = new Map();
    const reflectionSignatures = new Map();
    const heldSignatures = new Map();
    const representativesByLabel = new Map();
    const textureSources = new Set();
    const textureProcessed = new Set();
    state.textureSlices = [];
    const baseSeedGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const lightSources = [];
    const lightSourceSeen = new Set();
    const lightClones = [];
    const addLightSource = (source, label, intendedVisible = true) => {
      if (!source?.isLight || lightSourceSeen.has(source)) return false;
      lightSourceSeen.add(source);
      const clone = source.clone(false);
      clone.visible = false;
      warmScene.add(clone);
      if (clone.target) warmScene.add(clone.target);
      lightSources.push({ source, label, intendedVisible, clone });
      lightClones.push(clone);
      return true;
    };
    const setLightRig = (labels) => {
      const enabled = new Set(labels);
      for (const entry of lightSources) {
        entry.clone.visible = entry.intendedVisible && enabled.has(entry.label);
      }
    };
    const visibleLightCensus = (scene, camera) => {
      const census = { AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
        SpotLight: 0, PointLight: 0, total: 0, directionalShadows: 0,
        spotShadows: 0, pointShadows: 0, totalShadows: 0 };
      scene.traverse((object) => {
        if (!object.isLight || !object.visible || !object.layers.test(camera.layers)) return;
        const type = object.type || 'Light';
        census[type] = (census[type] || 0) + 1;
        census.total++;
        if (object.castShadow) {
          census.totalShadows++;
          if (object.isDirectionalLight) census.directionalShadows++;
          else if (object.isSpotLight) census.spotShadows++;
          else if (object.isPointLight) census.pointShadows++;
        }
      });
      return census;
    };
    const jobs = [];
    const launchCompile = (scene, camera, label, targetScene = scene) => {
      if (compileActivity.active >= state.compileConcurrencyLimit) {
        throw new Error(`shader compile slot unavailable for ${label}`);
      }
      state.compileJobsInFlight++;
      state.maxCompileJobsInFlight = Math.max(
        state.maxCompileJobsInFlight, state.compileJobsInFlight,
      );
      compileActivity.active++;
      compileActivity.peak = Math.max(compileActivity.peak, compileActivity.active);
      state.generationCompileJobsInFlight = compileActivity.active;
      state.generationMaxCompileJobsInFlight = compileActivity.peak;
      state.compileInFlightLabel = label;
      const launchedAt = performance.now();
      const jobEntry = {
        label,
        generationAtMs: launchedAt,
        generationSettledAt: null,
        atMs: launchedAt - state.startedAt,
        settledMs: null,
        durationMs: null,
        source: scene.children
          .filter((object) => object.visible && object.userData?.shaderWarmSource)
          .map((object) => object.userData.shaderWarmSource),
      };
      state.compileJobs.push(jobEntry);
      compileActivity.jobs.push(jobEntry);
      const settle = () => {
        const settledAt = performance.now();
        jobEntry.generationSettledAt = settledAt;
        jobEntry.settledMs = settledAt - state.startedAt;
        jobEntry.durationMs = settledAt - launchedAt;
        state.compileJobsInFlight = Math.max(0, state.compileJobsInFlight - 1);
        if (!state.compileJobsInFlight) state.compileInFlightLabel = null;
        compileActivity.active = Math.max(0, compileActivity.active - 1);
        state.generationCompileJobsInFlight = compileActivity.active;
        state.generationMaxCompileJobsInFlight = compileActivity.peak;
        for (const wake of [...compileActivity.waiters]) wake();
        compileActivity.waiters.clear();
      };
      try {
        const job = this._compileWarmVariant(scene, camera, targetScene, isCurrent);
        const tracked = Promise.resolve(job).then((detail) => {
          if (detail && typeof detail === 'object') {
            jobEntry.programs = detail.programs;
            jobEntry.rendererCompileDurationMs = detail.rendererCompileDurationMs;
            jobEntry.programCaptureDurationMs = detail.programCaptureDurationMs;
            jobEntry.submitDurationMs = detail.submitDurationMs;
            jobEntry.readinessPolls = detail.readinessPolls;
            jobEntry.maxReadinessPollDurationMs = detail.maxReadinessPollDurationMs;
            jobEntry.finalizationDurationMs = detail.finalizationDurationMs;
            jobEntry.maxSynchronousSliceMs = detail.maxSynchronousSliceMs;
            jobEntry.programIdentities = detail.identities;
            jobEntry.invalidated = detail.invalidated === true;
            jobEntry.drainedAfterInvalidation = detail.drainedAfterInvalidation === true;
          }
          return detail?.invalidated !== true;
        }).catch((error) => {
          jobEntry.error = error?.message || `${error}`;
          if (isCurrent()) state.errors.push(`${label}: ${jobEntry.error}`);
          return false;
        }).finally(settle);
        jobs.push(tracked);
        return tracked;
      } catch (error) {
        settle();
        if (isCurrent()) state.errors.push(`${label}: ${error?.message || error}`);
        return Promise.resolve(false);
      }
    };
    const markVariantReady = (label) => {
      if (!state.variants.includes(label)) state.variants.push(label);
      if (!state.readyVariants.includes(label)) state.readyVariants.push(label);
      if (isCurrent() && this._shaderResidentGeneration === generation) {
        this._shaderResidentVariants.add(label);
      }
    };
    const compileVariant = async (label, labels, {
      scene = warmScene,
      camera = warmCamera,
      representatives = warmRepresentatives,
      target = null,
      lightCount = null,
      deferReady = false,
    } = {}) => {
      // A current-district priority pass may have already certified this exact
      // variant. Do not repeat it later merely because the full background
      // itinerary reached the same chapter label.
      if (labels) setLightRig(labels);
      if (!state.variants.includes(label)) state.variants.push(label);
      const lights = lightCount ?? lightSources.filter((entry) =>
        entry.clone.visible && entry.clone.layers.test(camera.layers)).length;
      state.variantLights[label] = lights;
      state.variantLightTypes[label] = visibleLightCensus(scene, camera);
      if (state.readyVariants.includes(label)) return isCurrent();
      const batchSize = state.variantBatchSize;
      const batches = Math.ceil(representatives.length / batchSize);
      const sceneRepresentatives = scene === reflectionScene
        ? reflectionRepresentatives
        : scene === heldScene ? heldRepresentatives : warmRepresentatives;
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        if (!await waitForCompileSlot()) return false;
        let batchJob = Promise.resolve();
        const begin = batchIndex * batchSize;
        const end = Math.min(representatives.length, begin + batchSize);
        const ok = await runSlice('compile', `${label}:${batchIndex + 1}/${batches}`, () => {
          // Three r161 compile() traverses every object regardless of visible.
          // Physically isolate this one-signature batch as the compile root and
          // pass the complete owning scene only as targetScene for its exact
          // environment/fog/light census.
          for (const representative of sceneRepresentatives) representative.visible = false;
          const compileScene = new THREE.Scene();
          const isolated = representatives.slice(begin, end);
          for (const representative of isolated) {
            representative.removeFromParent();
            representative.visible = true;
            compileScene.add(representative);
          }
          let previousTarget = null;
          let targetRead = !target;
          let compileError = null;
          try {
            if (target) {
              previousTarget = this.renderer.getRenderTarget();
              targetRead = true;
              this.renderer.setRenderTarget(target);
            }
            batchJob = launchCompile(
              compileScene, camera, `${label}:${batchIndex + 1}`, scene,
            );
          } catch (error) {
            compileError = error;
          } finally {
            for (const representative of isolated) {
              representative.removeFromParent();
              representative.visible = false;
              scene.add(representative);
            }
            if (target && targetRead) {
              let restored = false;
              let restoreError = null;
              for (let attempt = 0; attempt < 2 && !restored; attempt++) {
                try {
                  this.renderer.setRenderTarget(previousTarget);
                  restored = true;
                } catch (error) { restoreError = error; }
              }
              if (!restored) {
                const error = restoreError;
                const message = `compile target restore failed: ${error?.message || error}`;
                compileError = compileError
                  ? new Error(`${compileError?.message || compileError}; ${message}`)
                  : new Error(message);
              }
            }
          }
          if (compileError) throw compileError;
          return {
            representatives: Math.max(0, end - begin),
            representativeTotal: representatives.length,
            batch: batchIndex + 1,
            batches,
            lights,
            source: representatives.slice(begin, end)
              .map((representative) => representative.userData.shaderWarmSource),
          };
        }, { idle: true });
        if (!ok) return false;
        // KHR_parallel_shader_compile keeps this one signature's driver work
        // asynchronous relative to play. Do not overlap unrelated signatures:
        // seven pending D3D11 jobs repeatedly forced an otherwise resident
        // Cave frame past 100ms. The next idle paint launches only after this
        // captured program set is ready (or the itinerary is invalidated).
        const outcome = await Promise.race([batchJob, invalidation]);
        if (!isCurrent()) return false;
        if (outcome !== true) return false;
      }
      if (!deferReady) markVariantReady(label);
      return isCurrent();
    };
    const textureIsResident = (texture) =>
      this.renderer.properties.get(texture)?.__webglInit === true;
    const warmPendingTextures = async (label) => {
      const pending = [...textureSources].filter((texture) =>
        !textureProcessed.has(texture) && !textureIsResident(texture));
      for (let index = 0; index < pending.length; index++) {
        const texture = pending[index];
        if (!await runSlice('texture', `texture:${label}:${index + 1}`, () => {
          this.renderer.initTexture(texture);
          textureProcessed.add(texture);
          state.texturesWarmed++;
          return {
            texture: texture.name || texture.source?.uuid || texture.uuid,
            width: texture.image?.width || texture.source?.data?.width || null,
            height: texture.image?.height || texture.source?.data?.height || null,
          };
        })) return false;
      }
      // Already-resident shared maps never need to spend another paint slice.
      for (const texture of textureSources) {
        if (textureIsResident(texture)) textureProcessed.add(texture);
      }
      state.texturesDiscovered = textureSources.size;
      return isCurrent();
    };

    let targetWarmPromise = Promise.resolve(null);
    if (!this.terminal && this.finale?.warmRenderTargets) {
      state.targetStatus = 'scheduled';
      targetWarmPromise = new Promise((resolve) => {
        this.finale.warmRenderTargets((targetState) => {
          state.targetStatus = targetState.status;
          state.targetsWarmed = targetState.warmed;
          state.targetMaxSliceMs = targetState.maxSliceMs;
          if (isCurrent()) {
            for (const error of targetState.errors || []) state.errors.push(`target: ${error}`);
          }
          resolve(targetState);
        });
      });
    }

    const warmEntities = [];
    let warmRandomState = 0x5f3759df;
    const createSynthetic = (kind) => {
      const previousChoir = this.enemies.choir;
      if (kind === 'choir' && previousChoir) return previousChoir;
      const spawnSerial = this.enemies._spawnSerial;
      const hadSpawnLog = Object.prototype.hasOwnProperty.call(this, 'spawnLog');
      const spawnLogLength = this.spawnLog?.length || 0;
      const audioWasReady = this.audio._ready;
      const liveRandom = Math.random;
      let entity = null;
      this.audio._ready = false;
      Math.random = () => {
        warmRandomState = (Math.imul(warmRandomState, 1664525) + 1013904223) >>> 0;
        return warmRandomState / 0x100000000;
      };
      try {
        entity = kind === 'choir'
          ? this.enemies.beginDrownedChoir({
            pos: this.underfalls?.layout?.entrance || this.player.pos,
            heardPos: this.player.pos,
          })
          : this.enemies.spawn(
            kind, this.player.pos.x, this.player.pos.z, 'dormant', this.player.pos.y + 1,
          );
        if (entity) warmEntities.push(entity);
      } finally {
        Math.random = liveRandom;
        this.audio._ready = audioWasReady;
        if (entity) {
          const index = this.enemies.list.indexOf(entity);
          if (index >= 0) this.enemies.list.splice(index, 1);
          entity.loop?.stop?.();
          entity.loop = null;
          entity.mesh.removeFromParent();
        }
        this.enemies.choir = previousChoir || null;
        this.enemies._spawnSerial = spawnSerial;
        if (hadSpawnLog) this.spawnLog.length = spawnLogLength;
        else delete this.spawnLog;
      }
      return entity;
    };

    const batches = this._shaderWarmRootBatches();
    const rootsByLabel = new Map(batches.map((batch) => [batch.label, batch.roots]));
    state.rootRegistry = Object.fromEntries(batches.map((batch) => [batch.label, batch.roots.length]));
    const discoveredObjects = new Set();
    const reflectedObjects = new Set();
    const discover = async (label, roots, { reflection = false } = {}) => {
      let labelRepresentatives = representativesByLabel.get(label);
      if (!labelRepresentatives) {
        labelRepresentatives = new Set();
        representativesByLabel.set(label, labelRepresentatives);
      }
      const stack = [];
      for (let i = (roots || []).length - 1; i >= 0; i--) {
        stack.push({ object: roots[i], parentVisible: true, districtRoot: true });
      }
      while (stack.length && isCurrent()) {
        const ok = await runSlice('setup', `discover:${label}`, () => {
          let nodes = 0, added = 0, reflected = 0, lights = 0;
          while (stack.length && nodes < 360) {
            const entry = stack.pop();
            const object = entry.object;
            if (!object) continue;
            const discoverWarm = !discoveredObjects.has(object);
            const discoverReflection = reflection && !reflectedObjects.has(object);
            if (!discoverWarm && !discoverReflection) continue;
            if (discoverWarm) discoveredObjects.add(object);
            if (discoverReflection) reflectedObjects.add(object);
            nodes++;
            const nodeVisible = entry.parentVisible
              && (entry.districtRoot ? true : object.visible !== false);
            if (discoverWarm) {
              if (object.isLight && nodeVisible && addLightSource(object, label, true)) lights++;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) this._collectShaderWarmTextures(material, textureSources);
              const representative = this._addShaderWarmRepresentative(
                warmScene, object, warmSignatures, warmRepresentatives,
              );
              if (representative) {
                labelRepresentatives.add(representative);
                added++;
              }
            }
            if (discoverReflection && this._addShaderWarmRepresentative(
              reflectionScene, object, reflectionSignatures, reflectionRepresentatives,
            )) reflected++;
            for (let i = object.children.length - 1; i >= 0; i--) {
              stack.push({ object: object.children[i], parentVisible: nodeVisible, districtRoot: false });
            }
          }
            state.discoveryNodes += nodes;
            state.representatives = warmRepresentatives.length;
            state.reflectionRepresentatives = reflectionRepresentatives.length;
            return { nodes, added, reflected, lights, remaining: stack.length };
        });
        if (!ok) return false;
      }
      return isCurrent();
    };
    const discoverHeld = async () => {
      const stack = this.skull?.hold ? [this.skull.hold] : [];
      const visited = new Set();
      while (stack.length && isCurrent()) {
        const ok = await runSlice('setup', 'discover:held', () => {
          let nodes = 0, added = 0;
          while (stack.length && nodes < 240) {
            const object = stack.pop();
            if (!object || visited.has(object)) continue;
            visited.add(object);
            nodes++;
            if (!object.isLight) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) this._collectShaderWarmTextures(material, textureSources);
              const representative = this._addShaderWarmRepresentative(
                heldScene, object, heldSignatures, heldRepresentatives, LAYER_HELD,
              );
              if (representative) added++;
            }
            for (let index = object.children.length - 1; index >= 0; index--) {
              stack.push(object.children[index]);
            }
          }
          state.discoveryNodes += nodes;
          state.heldRepresentatives = heldRepresentatives.length;
          return { nodes, added, remaining: stack.length };
        });
        if (!ok) return false;
      }
      return isCurrent();
    };

    // The first post-Wake task warms the small shared material kit immediately.
    // It is intentionally independent of district discovery so even the
    // adversarial debug teleport has common static/instanced programs resident;
    // every late/custom signature follows in paint-separated slices below.
    const coreAt = performance.now();
    try {
      for (const material of Object.values(this.mats || {})) {
        if (!material?.isMaterial || material.visible === false) continue;
        this._collectShaderWarmTextures(material, textureSources);
        const mesh = new THREE.Mesh(baseSeedGeometry, material);
        this._addShaderWarmRepresentative(warmScene, mesh, warmSignatures, warmRepresentatives);
        const instanced = new THREE.InstancedMesh(baseSeedGeometry, material, 1);
        instanced.setMatrixAt(0, new THREE.Matrix4());
        this._addShaderWarmRepresentative(warmScene, instanced, warmSignatures, warmRepresentatives);
      }
      // The impact ring is not part of the shared material catalog. Include
      // its exact transparent BasicMaterial in the first tiny kit so a Wake-Up
      // click followed immediately by a locked bell/window hit never compiles
      // on that visible impact frame.
      this._addShaderWarmRepresentative(
        warmScene, this._impactRing, warmSignatures, warmRepresentatives,
      );
      coreRepresentatives = warmRepresentatives.slice();
      // Underfalls and the sealed ossuary each own smaller real light rigs than
      // the exterior. Split ambient floor, resident effect/view light, the two
      // ossuary candle slots, and the remaining exterior lights so every warm
      // signature matches the cardinality rendered at that physical seam.
      for (const light of [this.world?.ambient, this.world?.hemi]) {
        addLightSource(light, 'ambient-light', true);
      }
      for (const light of [this.fillLight, this._impactLight]) {
        addLightSource(light, 'resident-point', true);
      }
      // These are authored resident slots. A context restore can occur while a
      // sealed-district culler has their live `visible` bits temporarily off;
      // warming that transient snapshot would undercount every later exterior
      // and finale program. Their warm intent is the uncullable base rig, not
      // whichever district happened to own the scene during restoration.
      addLightSource(this.world?.moon, 'exterior-light', true);
      for (const light of (this.world?.candlePool || []).slice(0, 2)) {
        addLightSource(light, 'ossuary-candle', true);
      }
      for (const light of (this.world?.candlePool || []).slice(2)) {
        addLightSource(light, 'exterior-light', true);
      }
      addLightSource(this.skullLight, 'skull', true);
      addLightSource(this.skull?.carryLight, 'skull', true);
      addLightSource(this.crawlSecret?.lamp, 'house', true);
      for (const light of this.graveyardRenderRoots || []) {
        if (light?.isLight) addLightSource(light, 'grave', true);
      }
      const graveRoots = new Set(this.graveyardRenderRoots || []);
      const forestRoots = new Set(this.forest?.detailRoots || []);
      const caveRoots = new Set(this.underfalls?.renderRoots || []);
      for (const light of this.outsideRenderRoots || []) {
        if (light?.isLight && !graveRoots.has(light) && !forestRoots.has(light) && !caveRoots.has(light)) {
          addLightSource(light, 'clearing', true);
        }
      }
      addLightSource(this.finale?.lamp, 'finale-room', true);
      addLightSource(this.finale?.dresserGlow, 'finale-room', true);
      // Warm against one exact synthetic rig, never a transient union of every
      // authored light discovered across mutually-exclusive districts. The live
      // ballast presents this same A1/H1/D1/S1/P16 signature to every shipping
      // world/RT pass; intensity does not participate in Three's program key.
      const fixedWarmDirectional = new THREE.DirectionalLight(0xffffff, 0);
      fixedWarmDirectional.castShadow = true;
      fixedWarmDirectional.shadow.autoUpdate = false;
      fixedWarmDirectional.shadow.needsUpdate = false;
      const fixedWarmLights = [
        new THREE.AmbientLight(0xffffff, 0),
        new THREE.HemisphereLight(0xffffff, 0x000000, 0),
        fixedWarmDirectional,
        new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 3, 0, 2),
        ...Array.from({ length: 16 }, () => new THREE.PointLight(0xffffff, 0, 1, 2)),
      ];
      for (const light of fixedWarmLights) addLightSource(light, 'fixed-rig', true);
      state.representatives = warmRepresentatives.length;
      setLightRig(['fixed-rig']);
      state.variantLights['core-ordinary'] = lightSources.filter((entry) =>
        entry.clone.visible && entry.clone.layers.test(warmCamera.layers)).length;
      state.variantLightTypes['core-ordinary'] = visibleLightCensus(warmScene, warmCamera);
      recordSlice('setup', 'core-registry', coreAt, {
        representatives: warmRepresentatives.length,
        lights: state.variantLights['core-ordinary'],
      });
    } catch (error) {
      state.errors.push(`core-registry: ${error?.message || error}`);
      recordSlice('setup', 'core-registry', coreAt, { error: error?.message || `${error}` });
    }

    const warmHouseMirrorTarget = async () => {
      const mirrorPool = this.houseMirror?.pool;
      const poolEpoch = mirrorPool?.pool;
      const target = poolEpoch?.[0];
      if (!target) {
        state.errors.push('house-mirror-target: resident pool unavailable');
        return false;
      }
      const residentTargetState = this._houseMirrorTargetWarmState;
      const targetUuid = target.texture?.uuid || 'no-texture';
      const poolSignature = this._renderTargetPoolIdentity(poolEpoch, mirrorPool);
      if (residentTargetState?.generation === generation
          && residentTargetState.status === 'ready'
          && residentTargetState.warmed === 1
          && residentTargetState.poolRef === poolEpoch
          && residentTargetState.poolEpoch === mirrorPool.poolEpoch
          && residentTargetState.poolSignature === poolSignature
          && residentTargetState.targetRef === target
          && residentTargetState.targetUuid === targetUuid) {
        markVariantReady('house-mirror-target');
        state.houseMirrorTargetStatus = 'ready';
        return true;
      }
      const targetState = this._houseMirrorTargetWarmState = {
        status: 'scheduled', generation, warmed: 0, maxSliceMs: 0,
        attempts: 0, errors: [], failed: false,
        poolRef: poolEpoch, poolEpoch: mirrorPool.poolEpoch, poolSignature,
        targetRef: target, targetUuid,
      };
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts && isCurrent(); attempt++) {
        let succeeded = false;
        const ok = await runSlice('setup', `house-mirror-target:${attempt}/${maxAttempts}`, () => {
          if (!isCurrent() || targetState !== this._houseMirrorTargetWarmState) return null;
          targetState.status = 'warming';
          targetState.attempts = attempt;
          const previousTarget = this.renderer.getRenderTarget();
          const startedAt = performance.now();
          let attemptError = null;
          try {
            const liveTarget = mirrorPool?.pool?.[0];
            if (mirrorPool?._disposed || mirrorPool.pool !== poolEpoch
                || targetState.poolRef !== poolEpoch
                || targetState.poolEpoch !== mirrorPool.poolEpoch
                || targetState.poolSignature !== this._renderTargetPoolIdentity(
                  mirrorPool.pool, mirrorPool,
                )
                || liveTarget !== target || targetState.targetRef !== target
                || liveTarget?.texture?.uuid !== targetState.targetUuid) {
              throw new Error('resident pool epoch changed before bind');
            }
            this.renderer.setRenderTarget(liveTarget);
            this.renderer.clear(true, true, true);
            succeeded = true;
          } catch (error) {
            attemptError = error?.message || `${error}`;
          } finally {
            try { this.renderer.setRenderTarget(previousTarget); }
            catch (error) {
              const restoreError = `restore target: ${error?.message || error}`;
              attemptError = attemptError ? `${attemptError}; ${restoreError}` : restoreError;
              succeeded = false;
            }
            targetState.maxSliceMs = Math.max(
              targetState.maxSliceMs, performance.now() - startedAt,
            );
          }
          if (attemptError) targetState.errors.push(attemptError);
          if (succeeded) {
            targetState.warmed = 1;
            targetState.status = 'ready';
          } else {
            targetState.status = attempt < maxAttempts ? 'scheduled' : 'degraded';
          }
          state.houseMirrorTargetStatus = targetState.status;
          return {
            attempt, warmed: targetState.warmed, status: targetState.status,
            error: attemptError,
          };
        });
        if (!ok || !isCurrent()) return false;
        if (succeeded) {
          markVariantReady('house-mirror-target');
          return true;
        }
      }
      targetState.failed = true;
      const message = targetState.errors[targetState.errors.length - 1] || 'target bind failed';
      state.errors.push(`house-mirror-target: ${message}`);
      this.houseMirror?.pane?.setActive(false);
      return false;
    };

    const compileGrainVariant = async () => {
      if (state.readyVariants.includes('grain')) return isCurrent();
      if (!await waitForCompileSlot()) return false;
      let grainJob = Promise.resolve();
      const ok = await runSlice('compile', 'grain', () => {
        grainJob = launchCompile(this.grainScene, this.grainCam, 'grain');
        return { representatives: 1, lights: 0 };
      }, { idle: true });
      if (!ok || !isCurrent()) return false;
      const outcome = await Promise.race([grainJob, invalidation]);
      if (!isCurrent()) return false;
      if (outcome !== true) return false;
      markVariantReady('grain');
      return isCurrent();
    };

    const pipeline = (async () => {
      const fixedWorldRig = ['fixed-rig'];
      const repsFor = (...labels) => {
        const selected = new Set();
        for (const label of labels) {
          for (const representative of representativesByLabel.get(label) || []) {
            selected.add(representative);
          }
        }
        return [...selected];
      };
      if (!await compileVariant('core-ordinary', fixedWorldRig,
        { representatives: coreRepresentatives })) return;
      if (!state.readyVariants.includes('held-view')) {
        if (!await runSlice('setup', 'held-rig', () => {
          for (const source of [this.holdLight, this.holdFillLight]) {
            const clone = source.clone(false);
            clone.layers.set(LAYER_HELD);
            clone.visible = true;
            heldScene.add(clone);
          }
          state.heldLights = 2;
          return { lights: 2 };
        })) return;
        if (!await discoverHeld()) return;
        if (!await warmPendingTextures('held')) return;
        if (!await compileVariant('held-view', null, {
          scene: heldScene,
          camera: heldCamera,
          representatives: heldRepresentatives,
          lightCount: 2,
        })) return;
      } else {
        state.heldLights = 2;
        state.variantLights['held-view'] = 2;
        state.variantLightTypes['held-view'] = {
          AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
          SpotLight: 0, PointLight: 2, total: 2, directionalShadows: 0,
          spotShadows: 0, pointShadows: 0, totalShadows: 0,
        };
      }
      if (!await compileGrainVariant()) return;
      const coreRepresentativeSet = new Set(coreRepresentatives);
      const coldRepsFor = (...labels) => repsFor(...labels)
        .filter((representative) => !coreRepresentativeSet.has(representative));
      let reflectionRigReady = false;
      const ensureReflectionRig = async () => {
        if (reflectionRigReady) return isCurrent();
        const ok = await runSlice('setup', 'reflection-rig', () => {
          const reflectionTarget = new THREE.WebGLRenderTarget(4, 4, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: true,
            stencilBuffer: false,
          });
          reflectionTarget.texture.generateMipmaps = false;
          state._reflectionTarget = reflectionTarget;
          const reflectionDirectional = new THREE.DirectionalLight(0xffffff, 0);
          reflectionDirectional.castShadow = true;
          reflectionDirectional.shadow.autoUpdate = false;
          reflectionDirectional.shadow.needsUpdate = false;
          const reflectionRig = [
            new THREE.AmbientLight(0xffffff, 0),
            new THREE.HemisphereLight(0xffffff, 0x000000, 0),
            reflectionDirectional,
            new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 3, 0, 2),
            ...Array.from({ length: 16 }, () => new THREE.PointLight(0xffffff, 0, 1, 2)),
          ];
          for (const light of reflectionRig) {
            light.visible = true;
            light.layers.set(0);
            if (!light.isDirectionalLight) light.castShadow = false;
            reflectionScene.add(light);
            if (light.target) reflectionScene.add(light.target);
          }
          state.reflectionUsesMountedHeadLight = !!this.finale?.figure?.userData?.exactHead;
          const census = visibleLightCensus(reflectionScene, reflectionCamera);
          state.reflectionLights = census.total;
          state.variantLightTypes['reflection-rig'] = census;
          state.reflectionRepresentatives = reflectionRepresentatives.length;
          return { lights: state.reflectionLights, representatives: reflectionRepresentatives.length };
        });
        if (ok) reflectionRigReady = true;
        return ok;
      };

      // Restore/current-entry priority. Core and the isolated held pass are
      // already resident above; now certify the pass the player is physically
      // looking at before continuing the chronological background itinerary.
      // Every branch uses the same helpers and labels as that itinerary, so it
      // cannot invent a second shader contract or mutate story state.
      const priority = state.priorityAct;
      if (['bedroom', 'house', 'basement'].includes(priority)) {
        if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
        if (!await discover('house-mirror', rootsByLabel.get('house-mirror'))) return;
        if (!await discover('house', rootsByLabel.get('house'))) return;
        if (!await discover('grave', rootsByLabel.get('grave'))) return;
        if (!await discover('atmosphere', rootsByLabel.get('atmosphere'))) return;
        if (!await discover('skull', rootsByLabel.get('skull'), { reflection: true })) return;
        // Mirror targets render the dynamic stain/gore/impact roots with the
        // target output signature too. Discover both signatures before any
        // target label can be carried as ready.
        if (!await discover('dynamic', rootsByLabel.get('dynamic'), { reflection: true })) return;
        if (!await discover('music-box-figure', rootsByLabel.get('music-box-figure'))) return;
        if (!await discover('future-walker', rootsByLabel.get('future-walker'))) return;
        if (!await discover('future-resident', rootsByLabel.get('future-resident'))) return;
        if (!await warmPendingTextures('priority-house')) return;
        if (!await compileVariant('house-world', fixedWorldRig, {
          representatives: repsFor(
            'static-world', 'house', 'house-mirror', 'grave', 'atmosphere', 'skull', 'dynamic',
            'music-box-figure', 'future-walker', 'future-resident',
          ).filter((representative) => !coreRepresentativeSet.has(representative)),
        })) return;
      } else if (priority === 'graveyard' || priority === 'ossuary') {
        if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
        if (!await discover('grave', rootsByLabel.get('grave'))) return;
        if (!await discover('atmosphere', rootsByLabel.get('atmosphere'))) return;
        if (!await discover('skull', rootsByLabel.get('skull'), { reflection: true })) return;
        if (!await discover('dynamic', rootsByLabel.get('dynamic'))) return;
        if (!await warmPendingTextures(`priority-${priority}`)) return;
        if (priority === 'ossuary') {
          if (!await compileVariant('ossuary', fixedWorldRig,
            { representatives: repsFor('static-world', 'grave', 'skull') })) return;
        } else if (!await compileVariant('ordinary', fixedWorldRig, {
          representatives: coldRepsFor('static-world', 'grave', 'atmosphere', 'skull', 'dynamic'),
        })) return;
      } else if (priority === 'forest' || priority === 'clearing') {
        if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
        for (const kind of ['walker', 'resident', 'kneeler']) {
          let entity = null;
          if (!await runSlice('setup', `priority-synthetic:${kind}`, () => {
            entity = createSynthetic(kind);
            return { created: !!entity };
          })) return;
          if (entity && !await discover('enemy', [entity.mesh])) return;
        }
        if (!await discover('forest', rootsByLabel.get('forest'))) return;
        if (priority === 'clearing'
            && !await discover('clearing', rootsByLabel.get('clearing'))) return;
        if (!await discover('atmosphere', rootsByLabel.get('atmosphere'))) return;
        if (!await discover('skull', rootsByLabel.get('skull'), { reflection: true })) return;
        if (!await discover('dynamic', rootsByLabel.get('dynamic'))) return;
        if (!await warmPendingTextures(`priority-${priority}`)) return;
        if (priority === 'forest') {
          if (!await compileVariant('forest', fixedWorldRig, {
            representatives: repsFor('static-world', 'forest', 'atmosphere', 'enemy', 'skull', 'dynamic'),
          })) return;
        } else if (!await compileVariant('clearing', fixedWorldRig, {
          representatives: repsFor('static-world', 'forest', 'clearing', 'atmosphere', 'skull', 'dynamic'),
        })) return;
      } else if (priority === 'cave') {
        if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
        let priorityChoir = this.enemies.choir;
        if (!priorityChoir && !await runSlice('setup', 'priority-synthetic:choir', () => {
          priorityChoir = createSynthetic('choir');
          return { created: !!priorityChoir };
        })) return;
        if (priorityChoir && !await discover('choir', [priorityChoir.mesh])) return;
        if (!await discover('cave', rootsByLabel.get('cave'))) return;
        if (!await discover('atmosphere', rootsByLabel.get('atmosphere'))) return;
        if (!await discover('dynamic', rootsByLabel.get('dynamic'))) return;
        if (!await warmPendingTextures('priority-cave')) return;
        const cavePriorityLabel = this.enemies.choir ? 'cave-threat' : 'cave-lights';
        if (!await compileVariant(cavePriorityLabel, fixedWorldRig, {
          representatives: repsFor(
            'static-world', 'cave', 'atmosphere', 'dynamic',
            ...(cavePriorityLabel === 'cave-threat' ? ['choir'] : []),
          ),
        })) return;
      } else if (priority === 'mirror') {
        if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
        // The active Finale cannot let its first owner preload discover the
        // Instanced MeshBasic stain program for the reflection target.
        if (!await discover('dynamic', rootsByLabel.get('dynamic'), { reflection: true })) return;
        if (!await discover('finale-room', rootsByLabel.get('finale-room'), { reflection: true })) return;
        if (!await discover('finale-figure', rootsByLabel.get('finale-figure'), { reflection: true })) return;
        if (!await warmPendingTextures('priority-finale')) return;
        if (!await compileVariant('finale-world', fixedWorldRig, {
          representatives: repsFor('static-world', 'finale-room', 'finale-figure', 'dynamic'),
        })) return;
        if (!await ensureReflectionRig()) return;
        if (!await compileVariant('reflection-target', null, {
          scene: reflectionScene,
          camera: reflectionCamera,
          representatives: reflectionRepresentatives,
          target: state._reflectionTarget,
          lightCount: state.reflectionLights,
        })) return;
      }
      const currentExactProgressMatches = (progress, key, revision) => {
        const residency = this.currentGpuResidency;
        return isCurrent() && residency?.generation === generation
          && residency.activeKey === key && residency.progressive === progress
          && progress?.key === key && progress.exactShaderRevision === revision;
      };
      const currentExactSignature = async (progress, {
        phase, key, revision, baseline = null,
      }) => {
        if (!currentExactProgressMatches(progress, key, revision)
            || typeof progress.exactObjects?.values !== 'function') {
          return { stale: true, entries: 0, slices: 0, fingerprints: null, equal: false };
        }
        // Preserve the old exact, order-independent fingerprint equality without
        // rebuilding and sorting one giant string in a single task. `exactObjects`
        // is keyed by entry.key, so equality of the complete key->allocation map
        // is exactly equality of the former sorted key/fingerprint rows.
        const fingerprints = baseline ? null : new Map();
        const iterator = progress.exactObjects.values();
        let complete = false;
        let stale = false;
        let equal = true;
        let signatureEntries = 0;
        let slices = 0;
        let snapshotEntries = null;
        let remainingEntries = null;
        while (!complete && isCurrent()) {
          const ok = await runSlice('setup', `signature:current-view:${phase}`, () => {
            const slice = slices + 1;
            if (!currentExactProgressMatches(progress, key, revision)) {
              stale = true;
              return {
                phase, slice, entries: 0, signatureEntries: 0,
                totalSignatureEntries: signatureEntries,
                complete: false, stale: true, key, revision,
              };
            }
            // Freeze the iterator's finite admission count at the first slice.
            // Later owner/deferred census may append noncritical purpose keys to
            // the same Map without revising the current exact shader universe;
            // an atomic pre/post snapshot would not absorb those later inserts.
            if (snapshotEntries == null) {
              snapshotEntries = progress.exactObjects.size;
              remainingEntries = snapshotEntries;
            }
            let entries = 0;
            let included = 0;
            while (entries < state.currentExactSignatureSliceLimit && remainingEntries > 0) {
              const next = iterator.next();
              if (next.done) {
                complete = true;
                remainingEntries = 0;
                break;
              }
              entries++;
              remainingEntries--;
              const entry = next.value;
              if (!entry?.critical || entry.rig !== 'world' || !entry.object) continue;
              const descriptor = this._describeReducedEntry(entry, progress, { exact: true });
              if (descriptor.error) throw new Error(`${entry.key}: ${descriptor.error}`);
              included++;
              signatureEntries++;
              if (baseline) {
                if (!baseline.has(entry.key)
                    || baseline.get(entry.key) !== descriptor.allocationFingerprint) {
                  equal = false;
                }
              } else {
                fingerprints.set(entry.key, descriptor.allocationFingerprint);
              }
            }
            if (remainingEntries === 0) complete = true;
            state.currentExactSignatureMaxSliceEntries = Math.max(
              state.currentExactSignatureMaxSliceEntries, entries,
            );
            return {
              phase, slice, entries, signatureEntries: included,
              totalSignatureEntries: signatureEntries,
              entryLimit: state.currentExactSignatureSliceLimit,
              snapshotEntries, remainingEntries,
              complete, stale: false, key, revision,
            };
          });
          if (!ok) return null;
          slices++;
          if (stale) {
            return { stale: true, entries: signatureEntries, slices, fingerprints, equal: false };
          }
        }
        if (!isCurrent()) return null;
        if (!currentExactProgressMatches(progress, key, revision)) {
          return { stale: true, entries: signatureEntries, slices, fingerprints, equal: false };
        }
        return {
          stale: false,
          entries: signatureEntries,
          slices,
          fingerprints,
          equal: baseline ? equal && signatureEntries === baseline.size : true,
        };
      };
      const currentProgress = this.currentGpuResidency?.progressive;
      if (currentProgress?.key === this.currentGpuResidency?.activeKey) {
        const currentKey = currentProgress.key;
        const currentRevision = currentProgress.exactShaderRevision;
        const currentRoots = [...new Set([...currentProgress.exactObjects.values()]
          .filter((entry) => entry.critical && entry.rig === 'world')
          .map((entry) => entry.object).filter(Boolean))];
        state.currentExactKey = currentKey;
        state.currentExactRevision = currentRevision;
        state.currentExactUniverse = currentProgress.exactUniverse.size;
        state.currentExactRoots = currentRoots.length;
        state.currentExactStatus = 'discovering';
        const restartStaleCurrentExact = () => {
          if (!isCurrent()) return;
          state.currentExactStatus = 'stale';
          state.readyVariants = state.readyVariants
            .filter((label) => label !== 'current-view-exact');
          this._shaderResidentVariants.delete('current-view-exact');
          this._invalidateShaderWarmup(
            `current-view-changed:${currentKey}:${currentRevision}`,
            { preserveResident: true, preserveTargets: true },
          );
          this._scheduleShaderWarmup();
        };
        const currentSignature = await currentExactSignature(currentProgress, {
          phase: 'pre', key: currentKey, revision: currentRevision,
        });
        if (!currentSignature) return;
        if (currentSignature.stale) {
          restartStaleCurrentExact();
          return;
        }
        state.currentExactSignatureEntries = currentSignature.entries;
        state.currentExactSignatureSlices = currentSignature.slices;
        if (!await discover('current-view', currentRoots)) return;
        if (!await warmPendingTextures('current-view')) return;
        const currentRepresentatives = [...new Set(currentRoots.map((object) =>
          warmSignatures.get(this._shaderWarmObjectSignature(object))).filter(Boolean))];
        state.currentExactRepresentatives = currentRepresentatives.length;
        state.currentExactStatus = 'compiling';
        if (!await compileVariant('current-view-exact', fixedWorldRig, {
          representatives: currentRepresentatives,
          deferReady: true,
        })) return;
        const liveSignature = await currentExactSignature(currentProgress, {
          phase: 'post', key: currentKey, revision: currentRevision,
          baseline: currentSignature.fingerprints,
        });
        if (!liveSignature) return;
        state.currentExactLiveSignatureEntries = liveSignature.entries;
        state.currentExactLiveSignatureSlices = liveSignature.slices;
        const liveProgress = this.currentGpuResidency?.progressive;
        if (liveSignature.stale || !liveSignature.equal
            || liveProgress !== currentProgress || liveProgress?.key !== currentKey
            || liveProgress.exactShaderRevision !== currentRevision
            || this.currentGpuResidency?.activeKey !== currentKey) {
          restartStaleCurrentExact();
          return;
        }
        markVariantReady('current-view-exact');
        state.currentExactStatus = 'ready';
      }
      const houseTargetReady = await warmHouseMirrorTarget();
      if (!await discover('static-world', rootsByLabel.get('static-world'), { reflection: true })) return;
      if (!await discover('house-mirror', rootsByLabel.get('house-mirror'))) return;
      // The reflection camera sees the complete authored house, not only the
      // delayed inhabitant. Discover and upload every house-owned signature
      // before binding the 384px target so Three's outputColorSpace-specific
      // programs are resident before the first relay/near-facing pane update.
      if (!await discover('house', rootsByLabel.get('house'))) return;
      if (!await discover('grave', rootsByLabel.get('grave'))) return;
      if (!await discover('atmosphere', rootsByLabel.get('atmosphere'))) return;
      if (!await discover('skull', rootsByLabel.get('skull'), { reflection: true })) return;
      // The chronological background itinerary must certify the same dynamic
      // reflection signatures as the priority-Finale path. A carried
      // `reflection-target` label is only valid if both paths own this set.
      if (!await discover('dynamic', rootsByLabel.get('dynamic'), { reflection: true })) return;
      if (!await discover('music-box-figure', rootsByLabel.get('music-box-figure'))) return;
      if (!await discover('future-walker', rootsByLabel.get('future-walker'))) return;
      if (!await discover('future-resident', rootsByLabel.get('future-resident'))) return;
      if (!await warmPendingTextures('house')) return;
      if (!await compileVariant('house-world', fixedWorldRig, {
        representatives: repsFor(
          'static-world', 'house', 'house-mirror', 'grave', 'atmosphere', 'skull', 'dynamic',
          'music-box-figure', 'future-walker', 'future-resident',
        ).filter((representative) => !coreRepresentativeSet.has(representative)),
      })) return;
      if (houseTargetReady) {
        const reflectionTarget = this.houseMirror?.pool?.pool?.[0];
        if (!reflectionTarget
            || this.houseMirror.pool.pool !== this._houseMirrorTargetWarmState?.poolRef
            || this.houseMirror.pool.poolEpoch !== this._houseMirrorTargetWarmState?.poolEpoch
            || this._renderTargetPoolIdentity(
              this.houseMirror.pool.pool, this.houseMirror.pool,
            ) !== this._houseMirrorTargetWarmState?.poolSignature
            || reflectionTarget !== this._houseMirrorTargetWarmState?.targetRef
            || reflectionTarget.texture?.uuid !== this._houseMirrorTargetWarmState?.targetUuid) {
          this._houseMirrorTargetWarmState.status = 'degraded';
          state.errors.push('house-reflection: resident pool changed after target warm');
        } else if (!await compileVariant('house-reflection', fixedWorldRig, {
          target: reflectionTarget,
          representatives: repsFor(
            'static-world', 'house', 'house-mirror', 'grave', 'atmosphere', 'skull', 'dynamic',
            'music-box-figure', 'future-walker', 'future-resident',
          ),
        })) return;
      }
      // Early world detail, then the exact forest entities/atmosphere that used
      // to own the seven-second first sight. Each compile begins after a paint.
      if (!await warmPendingTextures('grave')) return;
      if (!await compileVariant('ossuary', fixedWorldRig,
        { representatives: repsFor('static-world', 'grave', 'skull') })) return;
      if (!await compileVariant('ordinary', fixedWorldRig,
        { representatives: coldRepsFor('static-world', 'house', 'grave', 'atmosphere', 'skull', 'dynamic') })) return;
      for (const kind of ['walker', 'resident', 'kneeler']) {
        let entity = null;
        if (!await runSlice('setup', `synthetic:${kind}`, () => {
          entity = createSynthetic(kind);
          return { created: !!entity };
        })) return;
        if (entity && !await discover('enemy', [entity.mesh])) return;
      }
      if (!await discover('forest', rootsByLabel.get('forest'))) return;
      if (!await warmPendingTextures('forest')) return;
      if (!await compileVariant('forest', fixedWorldRig,
        { representatives: repsFor('static-world', 'forest', 'atmosphere', 'enemy', 'skull', 'dynamic') })) return;
      if (!await discover('clearing', rootsByLabel.get('clearing'))) return;
      if (!await warmPendingTextures('clearing')) return;
      if (!await compileVariant('clearing', fixedWorldRig,
        { representatives: repsFor('static-world', 'forest', 'clearing', 'atmosphere', 'skull', 'dynamic') })) return;

      let choir = this.enemies.choir;
      if (!choir && !await runSlice('setup', 'synthetic:choir', () => {
        choir = createSynthetic('choir');
        return { created: !!choir };
      })) return;
      if (choir && !await discover('choir', [choir.mesh])) return;
      state.choirLights = lightSources.filter((entry) => entry.label === 'choir').length;
      if (!await discover('cave', rootsByLabel.get('cave'))) return;
      if (!await warmPendingTextures('cave')) return;
      if (!await compileVariant('cave-lights', fixedWorldRig,
        { representatives: repsFor('static-world', 'cave', 'atmosphere', 'dynamic') })) return;
      if (!await compileVariant('cave-threat', fixedWorldRig,
        { representatives: repsFor('static-world', 'cave', 'atmosphere', 'choir', 'dynamic') })) return;

      if (!await discover('finale-room', rootsByLabel.get('finale-room'), { reflection: true })) return;
      if (!await discover('finale-figure', rootsByLabel.get('finale-figure'), { reflection: true })) return;
      if (!await warmPendingTextures('finale')) return;
      if (!await compileVariant('finale-world', fixedWorldRig,
        { representatives: repsFor('static-world', 'finale-room', 'finale-figure', 'dynamic') })) return;
      if (!await compileGrainVariant()) return;

      if (!await ensureReflectionRig()) return;
      if (!await compileVariant('reflection-target', null, {
        scene: reflectionScene,
        camera: reflectionCamera,
        representatives: reflectionRepresentatives,
        target: state._reflectionTarget,
        lightCount: state.reflectionLights,
      })) return;

      await Promise.all(jobs);
      await targetWarmPromise;
    })().catch((error) => {
      if (isCurrent()) state.errors.push(`pipeline: ${error?.message || error}`);
    });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      delete state._invalidate;
      for (const cancel of [...taskCancels]) cancel();
      const validGeneration = isCurrent();
      const retainedMaterials = warmEntities.flatMap((entity) =>
        entity.kind === 'choir'
          ? (entity.mesh.userData.ownedMaterials || [])
          : (entity.mesh.userData.mat ? [entity.mesh.userData.mat] : []));
      if (this.terminal || (!validGeneration && !state.preserveResidentOnInvalidation)) {
        for (const material of retainedMaterials) material.dispose();
      } else {
        this._shaderWarmMaterials = [
          ...new Set([...(this._shaderWarmMaterials || []), ...retainedMaterials]),
        ];
      }
      warmScene.clear();
      reflectionScene.clear();
      heldScene.clear();
      baseSeedGeometry.dispose();
      state._reflectionTarget?.dispose?.();
      delete state._reflectionTarget;
      if (!validGeneration) {
        state.status = 'invalidated';
        state.reason ||= 'stale-generation';
        return;
      }
      state.status = state.errors.length ? 'degraded' : 'ready';
      if (state.status === 'ready') {
        this._shaderWarmupRecoveryGeneration = generation;
        this._shaderWarmupRecoveryRound = 0;
        // Retry rounds bound one contiguous failure episode. Once a clean
        // generation is fully certified, a later independent runtime fault
        // (for example house glass followed by Finale glass) owns a fresh
        // bounded budget instead of inheriting an already-spent counter.
        state.recoveryRound = 0;
      } else {
        this._scheduleRecoverableShaderRetry(state);
      }
      state.texturesDiscovered = textureSources.size;
      state.pendingTextures = [...textureSources]
        .filter((texture) => !textureIsResident(texture)).length;
      state.generationCompileJobsInFlight = compileActivity.active;
      state.generationMaxCompileJobsInFlight = compileActivity.peak;
      state.completedAt = performance.now();
      state.durationMs = state.completedAt - state.startedAt;
      this.finale?.completeContextRewarm?.(generation);
    };
    Promise.race([pipeline, invalidation]).then(finish);
  }

  _dropQuality() {
    this.renderer.setPixelRatio(1);
    // Keep the one directional-shadow slot resident across restoration. Three
    // keys NUM_DIR_LIGHT_SHADOWS separately; dropping castShadow here made the
    // carefully rewarmed fixed rig wrong on the first recovered world frame.
    // Pixel density is the bounded recovery concession; lighting semantics and
    // program cardinality remain exact.
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
        // A DOM button cannot honestly be mouse-clicked while Pointer Lock
        // retargets every pointer event to the canvas. Hide that false
        // affordance; Escape/P remain the immediate desktop pause controls.
        this._syncPauseUi();
        return;
      }
      // Pointer lock is a gameplay contract. Losing it is a pause, not a silent
      // return-to-play state with dead mouse-look and manufactured releases.
      if (this._canPause()) this.pauseGame('pointer-lock');
      else if (!this.paused) this.input.clearKeys();
    });
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
    try { this.renderer.domElement.focus({ preventScroll: true }); } catch { /* detached canvas */ }
    if (TEST_MODE || this.paused || this.dead || this.terminal) return;
    try {
      const pending = this.renderer.domElement.requestPointerLock?.();
      pending?.catch?.(() => {});
    } catch { /* unsupported or denied: the next canvas click can retry */ }
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

  startGame() {
    if (this.started) return;
    // Do not cancel parallel compilation when Alex wakes immediately. The old
    // cancellation made every later district pay its shader bill on the first
    // visible frame. The scheduled callback has a bounded representative scene
    // and continues behind play without touching input or simulation.
    // If the title did not finish the optional moon-map prime, retire it now.
    // Never let the idle timeout allocate a shadow attachment 1.8 seconds into
    // live movement. castShadow stays true, preserving the fixed program key.
    if (!this.world?.moon?.shadow?.map) this.world?.retireMoonShadowPrime?.();
    this.started = true;
    // The native context was prepared while the title loaded. Resume it and
    // build the tiny silent graph now, before pointer lock can consume the
    // activation; all PCM work still begins only after a delivered paint.
    if (!this.terminal) {
      try { this.audio.init(); }
      catch (error) {
        // Audio is essential atmosphere, but a browser WebAudio failure cannot
        // consume Wake and leave the title covering a game that never started.
        this.audio._failStartupBake?.(error);
      }
    }
    this.el.title.classList.add('hidden');
    // requestIdleCallback is allowed to wait 1.2 seconds. Once play begins,
    // advance that scheduled work to the next task (never this click task), so
    // a fast player cannot reach the first district before compilation has even
    // started. The async compiler still owns the heavy driver work.
    if (this.shaderWarmup?.status === 'scheduled' && this._shaderWarmupRun) {
      this._shaderWarmupCancel?.();
      this._shaderWarmupCancel = null;
      const beginWarmup = this._shaderWarmupRun;
      setTimeout(() => {
        if (this.shaderWarmup?.status === 'scheduled') beginWarmup();
      }, 0);
    }
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

  _impactFx(kind, pos) {
    // contact bloom + ring at the point of impact — brightness and motion
    // carry the meaning, never hue. outward ring = hurt; inward = locked.
    this._impactLight.position.copy(pos);
    this._impactLight.intensity = kind === 'pop' ? 70 : kind === 'locked' ? 16 : 32;
    const R = this._impactRing;
    R.userData.bootPrime = false;
    R.visible = true;
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
    // A torn plank gets one brief, deterministic clatter, then leaves the
    // doorway's visual throat entirely. The old ticker stopped it forever at
    // y=.15, so the now-open cellar still looked nailed shut and the light wood
    // crossed the player's path in Alex's screenshot.
    const boardIndex = Math.max(0, this.boards.indexOf(b));
    const side = boardIndex - (this.boards.length - 1) * 0.5;
    const spin = (side === 0 ? 1 : Math.sign(side)) * (3.8 + boardIndex * 0.55);
    let age = 0;
    b.userData.detachAge = 0;
    b.userData.retired = false;
    this.tickers.push((dt) => {
      if (b.userData.retired) return;
      age += dt;
      b.userData.detachAge = age;
      b.position.y -= dt * (2.15 + age * 4.6);
      b.position.x += dt * side * 0.62;
      b.position.z -= dt * (0.72 + boardIndex * 0.08);
      b.rotation.z += dt * spin;
      b.rotation.x += dt * (1.1 + boardIndex * 0.3);
      if (age < 1.18) return;
      b.userData.retired = true;
      b.visible = false;
      b.removeFromParent();
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
    // Terminal is a real lifecycle boundary. Cancel every asynchronous shader,
    // texture and target task before disposing anything it may still reference,
    // and make any already-entered frame refuse a post-step render.
    this.terminal = true;
    this._invalidateShaderWarmup('terminal');
    this.enemies.clear();
    this.enemies.disposeGpuResidencyRoots?.();
    this.audio.stopAll({ suspend: true });
    this.finale?.mirrors?.dispose?.();
    this.houseMirror?.dispose?.();
    for (const material of this._shaderWarmMaterials || []) material.dispose();
    this._shaderWarmMaterials = null;
    this._reducedWorldMaterial?.dispose?.();
    this._reducedLineMaterial?.dispose?.();
    this._reducedPointsMaterial?.dispose?.();
    this.tickers.length = 0;
    this._syncPauseUi();
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
    const interactionsLive = !this.dead && !this.flags.has('ended') && !this._basementExit;
    const ctx = {
      playerVel: new THREE.Vector3(this.player.vel.x, this.player.fallV, this.player.vel.z),
      yawVel: this.player.yawVel, pitchVel: this.player.pitchVel,
      callHeld: frame.callHeld, throwHeld: frame.throwHeld, bobY: this.player.bobY,
      interactionsLive,
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
    const verbsLive = interactionsLive;
    if (verbsLive && frame.throwPressed && this.skull.mode === 'held') this.skull.tryThrow(ctx);
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
  _shaderWarmPriorityKey() {
    if (this.ossuary?.inOssuary || this.act === 'ossuary') return 'ossuary';
    if (['bedroom', 'house', 'basement'].includes(this.act)) return 'house';
    return this.act;
  }

  _shaderWarmRequiredVariant(priority) {
    if (priority === 'house') return 'house-world';
    if (priority === 'graveyard') return 'ordinary';
    if (priority === 'ossuary') return 'ossuary';
    if (priority === 'forest') return 'forest';
    if (priority === 'clearing') return 'clearing';
    if (priority === 'cave') return this.enemies?.choir ? 'cave-threat' : 'cave-lights';
    if (priority === 'mirror') return 'finale-world';
    return null;
  }

  _reprioritizeShaderWarmup(priority) {
    const state = this.shaderWarmup;
    if (!this.started || !state || state.status !== 'pending'
        || state.priorityAct === priority || this.terminal) return false;
    const required = this._shaderWarmRequiredVariant(priority);
    if (required && state.readyVariants?.includes(required)) {
      // A background itinerary can cross an already-certified chapter without
      // throwing away its current slice. Bedroom/house/basement are likewise
      // canonicalized to one key, so the normal early route never thrashes.
      state.priorityAct = priority;
      return false;
    }
    this._shaderWarmPriorityChanges = (this._shaderWarmPriorityChanges || 0) + 1;
    this._invalidateShaderWarmup(`current-act-priority:${priority}`, {
      preserveResident: true,
      preserveTargets: true,
    });
    this._scheduleShaderWarmup();
    if (this.shaderWarmup) {
      this.shaderWarmup.reprioritizations = this._shaderWarmPriorityChanges;
      this.shaderWarmup.requestedPriority = priority;
    }
    return true;
  }

  _shaderDistrictRenderShielded() {
    const state = this.shaderWarmup;
    // Background signature work is never a reason to stop submitting the
    // player's current view. `_prepareCurrentGpuResidency` chooses either the
    // fully certified pass or an actual-geometry, unlit silhouette fallback;
    // both preserve motion/input and both draw a nonzero world. Mirrors keep
    // their own dark-glass fail-closed contract until their owner RT is exact.
    if (state) state.renderShieldVariant = null;
    return false;
  }

  _syncShaderTransitionShield(shielded) {
    if (!this.el?.fade) return;
    if (shielded && !this._shaderTransitionShield) {
      this._shaderTransitionShield = true;
      this._shaderShieldStartedAt = performance.now();
      if (this.shaderWarmup) this.shaderWarmup.shieldStartedAt = this._shaderShieldStartedAt;
      this.el.fade.classList.remove('slow');
      this.el.fade.style.transitionDuration = '0.08s';
      this.el.fade.style.opacity = 1;
    } else if (shielded && this._shaderTransitionShield && this.shaderWarmup
        && this.shaderWarmup.shieldStartedAt == null) {
      // A current-act reprioritization swaps state objects while the same brief
      // opaque handoff remains active. Carry the original wall-clock start so
      // no restart can launder a long blackout into several innocent slices.
      this.shaderWarmup.shieldStartedAt = this._shaderShieldStartedAt;
    } else if (!shielded && this._shaderTransitionShield) {
      this._shaderTransitionShield = false;
      if (this._shaderShieldStartedAt != null) {
        const duration = performance.now() - this._shaderShieldStartedAt;
        this._shaderMaxShieldDurationMs = Math.max(
          this._shaderMaxShieldDurationMs || 0, duration,
        );
        if (this.shaderWarmup) {
        this.shaderWarmup.lastShieldDurationMs = duration;
        this.shaderWarmup.maxShieldDurationMs = Math.max(
            this.shaderWarmup.maxShieldDurationMs || 0, duration,
        );
        delete this.shaderWarmup.shieldStartedAt;
        }
        this._shaderShieldStartedAt = null;
      }
      this.fadeIn(0.34);
    }
  }

  render() {
    if (this.terminal) return;
    const firstBootRender = this.bootTiming.firstRenderStartedAt == null;
    if (firstBootRender) this.bootTiming.firstRenderStartedAt = performance.now();
    // embedded panes / headless report sizes late — self-correct every frame (chamber fix)
    const c = this.renderer.domElement;
    if (c.clientWidth !== innerWidth || c.clientHeight !== innerHeight) {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    }
    // Snapshot this before advancing: an async bootstrap program may become
    // ready and finalize in `_advanceReducedBootstrap()` while returning no
    // render entry. Such a finalization still owns this paint and must not be
    // stacked with the first reduced-world upload.
    const bootstrapReadyAtRenderStart = this._reducedBootstrapReady();
    const bootstrapEntry = this._advanceReducedBootstrap();
    this._bootstrapAdvancedThisRender = !!bootstrapEntry;
    if (!this.started) {
      // The DOM title has already received two paint boundaries before Game is
      // constructed. Its WebGL work is limited to one named Stage-B surface or
      // signature slice; the assembled house, held pass and shadow rig remain
      // untouched.
      this.lastRender = {
        drawCalls: 0, triangles: 0,
        worldDrawCalls: 0, worldTriangles: 0,
        heldDrawCalls: 0, heldTriangles: 0,
        grainSubmitted: false,
        grainCertified: this._reducedBootstrapReady('grain'),
        bootstrapKind: bootstrapEntry?.kind || null,
      };
      if (firstBootRender) this.bootTiming.firstRenderEndedAt = performance.now();
      return;
    }
    this._syncShaderBallast();
    this.flameCircuit?.syncCarryProgramRig?.();
    this._reprioritizeShaderWarmup(this._shaderWarmPriorityKey());
    // impact fx breathe every rendered frame — including inside hit-stop
    // Cosmetic time must never run backwards. A freshly resumed or automated
    // browser can occasionally deliver a stale RAF timestamp; feeding that
    // negative delta into the FOV decay *adds* kick every render until the
    // perspective matrix crosses 180 degrees and the whole world turns into
    // an inverted fisheye/starburst. Clamp at both consumption and capture.
    const rdt = this.paused ? 0 : clamp(this._lastShakeDt || 0.016, 0, 0.05);
    if (this._impactLight.intensity > 0.1) {
      this._impactLight.intensity *= Math.exp(-rdt * 9);
    } else if (this._impactLight.intensity > 0) {
      this._impactLight.intensity = 0;
    }
    if (this._ringT > 0) {
      this._ringT -= rdt;
      const R = this._impactRing, k = Math.max(0, this._ringT / 0.22);
      R.scale.setScalar(this._ringIn ? 0.5 + k * 2.7 : 0.6 + (1 - k) * 2.6);
      R.material.opacity *= Math.exp(-rdt * 6.5);
      if (this._ringT <= 0) {
        R.material.opacity = 0;
        R.visible = false;
      }
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
    const residencyPass = this._prepareCurrentGpuResidency({
      bootstrapReadyAtRenderStart,
    });
    const reducedDetail = !residencyPass.full;
    const districtShaderShielded = this._shaderDistrictRenderShielded();
    this._syncShaderTransitionShield(districtShaderShielded);
    // KHR_parallel_shader_compile is allowed to work while an already-resident
    // district keeps rendering. Retaining every frame for every *future* variant
    // turned a hitch fix into seconds of frozen imagery. Submission pauses only
    // when the current act would consume a signature that is not resident yet.
    // The hidden exact certificate is itself the one bounded GPU submission for
    // this paint. Preserve the already-presented reduced canvas and submit the
    // first full exact frame on the following paint; drawing even the reduced
    // silhouette here stacked two honest sub-100ms passes into one >100ms rAF.
    const skipGpuSubmission = districtShaderShielded
      || !!residencyPass.justCertified
      || !!residencyPass.justReduced
      || !!residencyPass.snapshotProgress
      || !!residencyPass.finalizationProgress;
    let visibleBefore = {
      programs: this.renderer.info.programs?.length || 0,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
    };
    let ownerCertifiedThisFrame = false;
    // Never stack an owner-RT certification on the same paint as the physical
    // room certification or a bounded owner-geometry upload. Either pass can
    // legitimately consume most of its D3D11 budget; combining them recreated
    // a long transition frame.
    // Panes are already dark from _prepareCurrentGpuResidency and may certify on
    // the following paint.
    if (!skipGpuSubmission && !reducedDetail && !residencyPass.justCertified
        && !residencyPass.ownerProgress && !residencyPass.deferredProgress
        && !residencyPass.ownerExactProgress && !residencyPass.deferredExactProgress) {
      if (this.houseMirror) {
        // Broad deterministic suites intentionally skip the expensive GPU pass;
        // preserve the original gameplay path there. Shipping async generations
        // certify the actual owner target/view once before glass may sample it.
        const warmupSkipped = this.shaderWarmup?.status === 'skipped';
        const owner = warmupSkipped
          ? { ready: true, candidate: this._ownerGpuCandidate('house') }
          : this._prepareOwnerGpuResidency('house');
        ownerCertifiedThisFrame ||= !!owner.justCertified;
        if (warmupSkipped || (owner.ready && !owner.justCertified) || !owner.candidate) {
          this.houseMirror.render(this.scene, this.camera);
        } else {
          // Fail closed as ordinary smoked glass. Never enter Mirrors._renderPane
          // with an unallocated, failed or prior-generation attachment.
          this.houseMirror.active = false;
          this.houseMirror.double.visible = false;
          this.houseMirror.echo.visible = false;
          this.houseMirror.pane.setActive(false);
        }
      }
      const finaleOwner = this.shaderWarmup?.status === 'skipped'
        ? { ready: true }
        : this._prepareOwnerGpuResidency('finale');
      ownerCertifiedThisFrame ||= !!finaleOwner.justCertified;
      if (this.shaderWarmup?.status === 'skipped'
          || !this._ownerGpuCandidate('finale')
          || (finaleOwner.ready && !finaleOwner.justCertified)) {
        this.finale.render(this.scene, this.camera);
      } else {
        for (const pane of this.finale?.panes || []) {
          pane.setActive(false);
          pane.material.uniforms.tDiffuse.value = null;
        }
      }
    }
    if (ownerCertifiedThisFrame) {
      // The owner certification is deliberately hidden behind dark glass. Its
      // allocations belong to the cert record, not the next revealed frame.
      visibleBefore = {
        programs: this.renderer.info.programs?.length || 0,
        textures: this.renderer.info.memory.textures,
        geometries: this.renderer.info.memory.geometries,
      };
    }

    // Render the physical world and the first-person cradle as two depth
    // passes. Three's light list is camera-global: merely putting the 58-cd
    // skull lantern and the hands on different object layers did not stop that
    // point-blank world light from bleaching every finger white. The world
    // pass keeps the lantern's environmental pool; the cleared-depth held pass
    // sees only its calibrated viewmodel key and can never clip into walls.
    const cameraMask = this.camera.layers.mask;
    let worldInfo = { calls: 0, triangles: 0 };
    let heldInfo = { calls: 0, triangles: 0 };
    if (!skipGpuSubmission) {
      if (reducedDetail) {
        worldInfo = this._renderReducedCurrentWorld(residencyPass.key);
      } else {
        this.camera.layers.set(0);
        this.camera.layers.enable(LAYER_MAIN_ONLY);
        this.world.prepareMoonShadowFrame?.(
          this.renderer, !this.started && this._webglGeneration === 0,
        );
        this.renderer.render(this.scene, this.camera);
        this.world.completeMoonShadowFreeze?.();
        worldInfo = {
          calls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        };
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.camera.layers.set(LAYER_HELD);
        const worldBackground = this.scene.background;
        this.scene.background = null; // do not paint over the completed world pass
        this.renderer.render(this.scene, this.camera);
        // Dormant flame representatives are intentionally retired only after
        // both real material passes have reached WebGL. Reduced-detail and
        // post-process submissions also advance renderer.info.render.frame,
        // but neither uploads the HELD flame materials/buffers.
        this.flameCircuit?.retireDormantResources?.();
        this.scene.background = worldBackground;
        heldInfo = {
          calls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        };
        if (this.currentGpuResidency) this.currentGpuResidency.fullFrames++;
        if (residencyPass.ownerProgress && this.currentGpuResidency) {
          this.currentGpuResidency.ownerFullFrames++;
        }
        if (residencyPass.deferredProgress && this.currentGpuResidency) {
          this.currentGpuResidency.deferredFullFrames++;
        }
      }
    }
    this.camera.layers.mask = cameraMask;
    this.camera.rotation.x -= rkx;
    this.camera.rotation.y -= rky;
    this.lastRender = {
      drawCalls: worldInfo.calls + heldInfo.calls,
      triangles: worldInfo.triangles + heldInfo.triangles,
      worldDrawCalls: worldInfo.calls,
      worldTriangles: worldInfo.triangles,
      heldDrawCalls: heldInfo.calls,
      heldTriangles: heldInfo.triangles,
      reducedDetail,
      ownerProgress: !!residencyPass.ownerProgress,
      deferredProgress: !!residencyPass.deferredProgress,
      ownerExactProgress: !!residencyPass.ownerExactProgress,
      deferredExactProgress: !!residencyPass.deferredExactProgress,
      reducedBatchSubmitted: !!residencyPass.justReduced,
      reducedBatchRevealed: !!residencyPass.justReducedReveal,
      revealedReducedObjects: residencyPass.revealedReducedObjects || 0,
      snapshotProgress: !!residencyPass.snapshotProgress,
      residencyKey: residencyPass.key,
      visibleProgramDelta: 0,
      visibleTextureDelta: 0,
      visibleGeometryDelta: 0,
      grainSubmitted: false,
      grainCertified: this._reducedBootstrapReady('grain')
        || this.shaderWarmup?.status === 'skipped',
      grainProgramDelta: null,
      grainTextureDelta: null,
      grainGeometryDelta: null,
      bootstrapKind: bootstrapEntry?.kind || null,
    };
    this.grainMat.uniforms.uTime.value = REDUCED_MOTION ? 0 : this.time % 300;
    this.grainMat.uniforms.uFear.value = this.fx.fear;
    // Rendering any scene while KHR_parallel_shader_compile is still pending
    // can force Chrome/D3D11 to synchronously flush the new programs. Retain
    // the last delivered frame for that bounded slice; simulation and input
    // continue, and the next paint resumes normally without the former
    // multi-second `renderer.render` stall.
    const grainCertified = this._reducedBootstrapReady('grain')
      || this.shaderWarmup?.status === 'skipped';
    if (!skipGpuSubmission && grainCertified && !this._bootstrapAdvancedThisRender) {
      const grainBefore = {
        programs: this.renderer.info.programs?.length || 0,
        textures: this.renderer.info.memory.textures,
        geometries: this.renderer.info.memory.geometries,
      };
      this.renderer.render(this.grainScene, this.grainCam);
      this.lastRender.grainSubmitted = true;
      this.lastRender.grainProgramDelta =
        (this.renderer.info.programs?.length || 0) - grainBefore.programs;
      this.lastRender.grainTextureDelta =
        this.renderer.info.memory.textures - grainBefore.textures;
      this.lastRender.grainGeometryDelta =
        this.renderer.info.memory.geometries - grainBefore.geometries;
    }
    this.lastRender.visibleProgramDelta =
      (this.renderer.info.programs?.length || 0) - visibleBefore.programs;
    this.lastRender.visibleTextureDelta =
      this.renderer.info.memory.textures - visibleBefore.textures;
    this.lastRender.visibleGeometryDelta =
      this.renderer.info.memory.geometries - visibleBefore.geometries;
    if (this.currentGpuResidency?.reducedFrames > 0) {
      this._resumeShaderWarmupAfterBootstrap();
    }
    this.renderer.autoClear = true;
    if (this._impactRing.userData.bootPrime && !skipGpuSubmission && !reducedDetail) {
      this._impactRing.userData.bootPrime = false;
      this._impactRing.visible = false;
    }

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
    if (firstBootRender) this.bootTiming.firstRenderEndedAt = performance.now();
  }

  // ----------------------------------------------------------------- loop
  run() {
    let last = performance.now();
    let acc = 0;
    const tick = (now) => {
      if (this.terminal) return;
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
      if (!this.terminal) this.render();
      if (!this.terminal) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- debug
  _exposeDebug() {
    const g = this;
    const api = {
      version: VERSION,
      feelProfile: FEEL_PROFILE,
      get ready() {
        // Deterministic no-warmup suites retain their immediate boot contract.
        // Shipping and focused GPU gates become ready only after the three
        // explicitly measured fallback signatures and surface transaction have
        // completed, so Wake cannot race a title-idle driver task.
        return g.shaderWarmup?.status === 'skipped' || g._reducedBootstrapReady();
      },
      start() { g.startGame(); return true; },
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
// Install the one meaningful title action before constructing the large static
// world. Two rAF boundaries guarantee the browser can paint the HTML key art
// and service an immediate click first; an early click is remembered and starts
// the finished game exactly once rather than feeling like a dead button.
const bootTitle = document.getElementById('title');
let queuedStart = false;
const provisionalStart = (event) => {
  if (!event.target.closest('[data-action="start"]')) return;
  queuedStart = true;
  const button = event.target.closest('[data-action="start"]');
  button?.setAttribute('aria-busy', 'true');
};
BOOT_TITLE_INTERACTIVE_AT = performance.now();
bootTitle?.addEventListener('click', provisionalStart);
window.__FETCH_BOOT = {
  moduleStartedAt: BOOT_MODULE_AT,
  titleInteractiveAt: BOOT_TITLE_INTERACTIVE_AT,
  get queuedStart() { return queuedStart; },
};

const launchGame = () => {
  const game = new Game();
  window.__game = game;
  bootTitle?.removeEventListener('click', provisionalStart);
  bootTitle?.querySelector('[data-action="start"]')?.removeAttribute('aria-busy');
  if (TEST_MODE) {
    game._selfStep = false;
    game.run();
    if (Q.has('autotest')) runAutotest(game).catch((e) => {
      document.body.dataset.autotestDetails = JSON.stringify([{ name: 'suite-crashed', passed: false, error: String(e) }]);
      document.body.dataset.autotestResult = 'fail';
      console.error(e);
    });
  } else game.run();
  if (queuedStart) game.startGame();
};

requestAnimationFrame(() => {
  BOOT_TITLE_PAINT_OPPORTUNITY_AT = performance.now();
  requestAnimationFrame(launchGame);
});
