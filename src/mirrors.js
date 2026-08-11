// The reflection engine (ported from THE LAG's hall-of-mirrors).
//
// Real planar reflections (a virtual camera mirrored across each pane), but:
//   1. Render targets are POOLED. Only the few panes nearest / most in-view get a
//      live reflection each frame; the rest fall back to cheap "dark glass". Heavy
//      fog hides the seam. FETCH's finale is one 4-wall room seen close-up, so the
//      defaults are budget 4 / size 1024 / maxDist 18.
//   2. Each pane carries a LAYER MASK for its reflection camera. Panes reflect
//      layer 0 (world) + layer 3 (the skull-headed double). The double therefore
//      exists ONLY inside glass — turn around and there is nothing behind you.
//
// Gotchas (load-bearing):
//   - Pane meshes have matrixAutoUpdate=false. Move them ONLY via place(), which
//     updates the matrices — FETCH animates the closing walls per-frame this way;
//     touching .position directly freezes the reflection at the old transform.
//   - camera.layers.set() wipes the mask before .enable() adds to it.
import * as THREE from 'three';

export const LAYER_WORLD = 0;  // room geometry — seen by everyone
export const LAYER_HELD = 2;   // the player's held item — main camera only
export const LAYER_DOUBLE = 3; // the skull-headed double — mirror cameras only

export const MASK_DOUBLE = (1 << LAYER_WORLD) | (1 << LAYER_DOUBLE);

const V = () => new THREE.Vector3();

function mirrorMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uTextureMatrix: { value: new THREE.Matrix4() },
      uTint: { value: new THREE.Color(opts.tint || 0xcdd6db) },
      uFogColor: { value: new THREE.Color(opts.fogColor ?? 0x05070a) },
      uFogDensity: { value: opts.fogDensity ?? 0.165 },
      uActive: { value: 0 },
      uEdge: { value: opts.edge ?? 0.0 }, // cool rim glint on the glass
    },
    vertexShader: /* glsl */`
      uniform mat4 uTextureMatrix;
      varying vec4 vProj;
      varying float vDepth;
      varying vec2 vLocal;
      void main() {
        // uTextureMatrix already includes the model matrix — use LOCAL position
        vProj = uTextureMatrix * vec4(position, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        vLocal = uv;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform vec3 uTint;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uActive;
      uniform float uEdge;
      varying vec4 vProj;
      varying float vDepth;
      varying vec2 vLocal;
      void main() {
        vec3 col;
        if (uActive > 0.5) {
          vec2 uv = vProj.xy / vProj.w;
          col = texture2D(tDiffuse, uv).rgb * uTint;
        } else {
          // dim silvered glass — a mirror too far/oblique to resolve, not a black void
          col = vec3(0.050, 0.066, 0.082);
        }
        // faint cool glint along the pane edges — reads as "glass" when a flare hits
        float e = smoothstep(0.5, 0.5 - uEdge, abs(vLocal.x - 0.5))
                + smoothstep(0.5, 0.5 - uEdge, abs(vLocal.y - 0.5));
        col += vec3(0.10, 0.16, 0.20) * uEdge * e;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export class Mirror {
  constructor(width, height, opts = {}) {
    this.geometry = new THREE.PlaneGeometry(width, height);
    this.material = mirrorMaterial(opts);
    this.material.toneMapped = false;
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.userData.mirror = this;
    this.reflectMask = opts.reflectMask ?? MASK_DOUBLE;
    this.active = false;
    this._wp = V();
    this._n = V();
  }
  place(x, y, z, rotY) {
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.set(0, rotY, 0);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
    return this;
  }
  worldNormal(out) { return out.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize(); }
  setActive(on) { this.active = !!on; this.material.uniforms.uActive.value = on ? 1 : 0; }
  setFlare(v) { this.material.uniforms.uEdge.value = v; }
}

export class Mirrors {
  constructor(renderer, { budget = 4, size = 1024, maxDist = 18, fogColor = 0x05070a, fogDensity = 0.165 } = {}) {
    this.renderer = renderer;
    this.budget = budget;
    this.size = size;
    this.maxDist = maxDist;
    this.fogColor = new THREE.Color(fogColor);
    this.fogDensity = fogDensity;
    this.mirrors = [];
    this.poolEpoch = 0;
    this.onPoolChanged = null;
    this.pool = this._makePool(budget, size);
    // scratch
    this._vcam = new THREE.PerspectiveCamera();
    this._rPos = V(); this._cPos = V(); this._rot = new THREE.Matrix4();
    this._normal = V(); this._view = V(); this._look = V(); this._target = V();
    this._plane = new THREE.Plane(); this._clip = new THREE.Vector4(); this._q = new THREE.Vector4();
    this._texMat = new THREE.Matrix4();
    this._fwd = V(); this._to = V(); this._tmp = V();
    this.clipBias = 0.0008;
    this._activeCount = 0;
    this._inUpdate = false;
    this._pendingSize = 0;
    this._disposed = false;
    this._failureSerial = 0;
    this.lastFailure = null;
    this.onFailure = null;
  }

  _makePool(budget, size) {
    this.poolEpoch++;
    const pool = [];
    for (let i = 0; i < budget; i++) {
      const rt = new THREE.WebGLRenderTarget(size, size, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false,
      });
      rt.texture.generateMipmaps = false;
      pool.push(rt);
    }
    return pool;
  }

  // add() stamps the pool's fog onto the pane, so per-pane defaults can't drift
  add(mirror) {
    mirror.material.uniforms.uFogColor.value.copy(this.fogColor);
    mirror.material.uniforms.uFogDensity.value = this.fogDensity;
    this.mirrors.push(mirror);
    return mirror;
  }

  // Single write point for fog: the shader does its own (manual) fog, so animated
  // scene fog MUST come through here or panes and world mismatch. Caller keeps
  // scene.fog in step by reading back .fogDensity/.fogColor (or passing the same
  // values to both).
  setFog(density, color) {
    this.fogDensity = density;
    if (color !== undefined) this.fogColor.set(color);
    for (const m of this.mirrors) {
      m.material.uniforms.uFogDensity.value = density;
      if (color !== undefined) m.material.uniforms.uFogColor.value.copy(this.fogColor);
    }
  }

  // Reallocate the RT pool at a new resolution (finale bumps 512 -> 1024).
  // Deferred if called mid-update — the pool is being rendered into.
  setSize(px) {
    if (this._disposed) return;
    if (this._inUpdate) { this._pendingSize = px; return; }
    if (px === this.size) return;
    const previousPool = this.pool;
    const previousEpoch = this.poolEpoch;
    this.size = px;
    this._activeCount = 0;
    for (const m of this.mirrors) { m.setActive(false); m.material.uniforms.tDiffuse.value = null; }
    for (const rt of this.pool) rt.dispose();
    this.pool = this._makePool(this.budget, px);
    try {
      this.onPoolChanged?.({
        previousPool,
        pool: this.pool,
        previousEpoch,
        poolEpoch: this.poolEpoch,
        size: this.size,
        textureIds: this.pool.map((target) => target.texture?.uuid || 'no-texture'),
      });
    } catch { /* owner invalidation is advisory; panes already fail closed */ }
  }

  // Choose panes worth reflecting this frame and render them into the pool.
  // Call BEFORE the main render; leaves the render target at null for it.
  update(scene, camera) {
    if (this._disposed) return false;
    if (this._pendingSize) {
      const s = this._pendingSize;
      this._pendingSize = 0;
      this.setSize(s);
      // Pool replacement invalidates target/program and owner certificates.
      // The callback above has left every pane dark and queued a rewarm; never
      // consume the fresh uninitialised attachments in this same update call.
      return false;
    }
    let outerTarget = null;
    try { outerTarget = this.renderer.getRenderTarget(); }
    catch (error) { this._recordFailure(error, 'read-outer-target'); return false; }
    this._inUpdate = true;
    try {
      camera.updateMatrixWorld();
      this._cPos.setFromMatrixPosition(camera.matrixWorld);
      this._fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

      const cands = [];
      for (const m of this.mirrors) {
        m._wp.setFromMatrixPosition(m.mesh.matrixWorld);
        m.worldNormal(m._n);
        this._to.subVectors(m._wp, this._cPos);
        const dist = this._to.length();
        if (dist > this.maxDist) continue;
        // camera must be on the front (+normal) side to see a reflection
        const facing = -this._to.dot(m._n) / (dist || 1); // >0 when we face the front
        if (facing <= 0.02) continue;
        const ahead = this._to.clone().normalize().dot(this._fwd); // in front of us?
        if (ahead < -0.35 && dist > 3.5) continue;
        const priority = ahead * 1.6 + facing * 0.6 - dist * 0.12;
        cands.push({ m, dist, priority });
      }
      cands.sort((a, b) => b.priority - a.priority);
      const chosen = cands.slice(0, this.budget);

      // Everything is dark glass during the reflection passes (prevents feedback and
      // gives a clean single-bounce; fog hides that mirrors-in-mirrors read as glass).
      for (const m of this.mirrors) m.setActive(false);

      const rendered = [];
      const failureSerial = this._failureSerial;
      for (let i = 0; i < chosen.length; i++) {
        const ok = this._renderPane(scene, camera, chosen[i].m, this.pool[i]);
        if (this._failureSerial !== failureSerial) break;
        if (ok) rendered.push({ m: chosen[i].m, rt: this.pool[i] });
      }
      if (this._failureSerial === failureSerial) {
        for (const entry of rendered) {
          entry.m.material.uniforms.tDiffuse.value = entry.rt.texture;
          entry.m.material.uniforms.uTextureMatrix.value.copy(entry.m._texMatrix);
          entry.m.setActive(true);
        }
        this._activeCount = rendered.length;
      } else this._darkenAll();
    } catch (error) {
      this._recordFailure(error, 'update');
      this._darkenAll();
    } finally {
      try { this.renderer.setRenderTarget(outerTarget); }
      catch (error) { this._recordFailure(error, 'restore-outer-target'); this._darkenAll(); }
      this._inUpdate = false;
    }
    return this._activeCount > 0;
  }

  _darkenAll() {
    this._activeCount = 0;
    for (const mirror of this.mirrors) {
      mirror.setActive(false);
      mirror.material.uniforms.tDiffuse.value = null;
    }
  }

  _recordFailure(error, phase) {
    const failure = {
      serial: ++this._failureSerial,
      phase,
      message: error?.message || `${error}`,
      at: performance.now(),
    };
    this.lastFailure = failure;
    try { this.onFailure?.(failure); } catch { /* fail-closed callback is advisory */ }
    return failure;
  }

  _renderPane(scene, camera, mirror, rt) {
    const scope = mirror.mesh;
    this._rPos.setFromMatrixPosition(scope.matrixWorld);
    this._cPos.setFromMatrixPosition(camera.matrixWorld);
    this._rot.extractRotation(scope.matrixWorld);
    this._normal.set(0, 0, 1).applyMatrix4(this._rot).normalize();

    this._view.subVectors(this._rPos, this._cPos);
    if (this._view.dot(this._normal) > 0) return false; // facing away
    this._view.reflect(this._normal).negate().add(this._rPos);

    this._rot.extractRotation(camera.matrixWorld);
    this._look.set(0, 0, -1).applyMatrix4(this._rot).add(this._cPos);
    this._target.subVectors(this._rPos, this._look);
    this._target.reflect(this._normal).negate().add(this._rPos);

    const vc = this._vcam;
    vc.position.copy(this._view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(this._normal);
    vc.lookAt(this._target);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    // MUST recopy every call — the oblique clip below rewrites this in place
    vc.projectionMatrix.copy(camera.projectionMatrix);
    vc.layers.mask = mirror.reflectMask;

    // texture matrix maps world position -> reflection UV
    this._texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this._texMat.multiply(vc.projectionMatrix);
    this._texMat.multiply(vc.matrixWorldInverse);
    this._texMat.multiply(scope.matrixWorld);
    if (!mirror._texMatrix) mirror._texMatrix = new THREE.Matrix4();
    mirror._texMatrix.copy(this._texMat);

    // oblique near-clip at the mirror plane, so nothing behind the glass leaks in
    if (!this.noClip) {
      this._plane.setFromNormalAndCoplanarPoint(this._normal, this._rPos);
      this._plane.applyMatrix4(vc.matrixWorldInverse);
      this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
      const p = vc.projectionMatrix.elements;
      this._q.x = (Math.sign(this._clip.x) + p[8]) / p[0];
      this._q.y = (Math.sign(this._clip.y) + p[9]) / p[5];
      this._q.z = -1.0;
      this._q.w = (1.0 + p[10]) / p[14];
      this._clip.multiplyScalar(2.0 / this._clip.dot(this._q));
      p[2] = this._clip.x; p[6] = this._clip.y;
      p[10] = this._clip.z + 1.0 - this.clipBias; p[14] = this._clip.w;
    }

    const r = this.renderer;
    let prevTarget = null;
    try { prevTarget = r.getRenderTarget(); }
    catch (error) { this._recordFailure(error, 'read-pane-target'); return false; }
    const scopeWasVisible = scope.visible;
    let failure = null;
    let failurePhase = 'bind-pane-target';
    let rendered = false;
    scope.visible = false; // a pane must not appear in its own reflection
    try {
      r.setRenderTarget(rt);
      failurePhase = 'clear-pane-target';
      r.clear();
      failurePhase = 'render-pane';
      r.render(scene, vc);
      rendered = true;
    } catch (error) {
      failure = error;
    } finally {
      try { r.setRenderTarget(prevTarget); }
      catch (error) {
        failure = error;
        failurePhase = 'restore-pane-target';
      }
      scope.visible = scopeWasVisible;
    }
    if (failure) {
      this._recordFailure(failure, failurePhase);
      return false;
    }
    return rendered;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._pendingSize = 0;
    this._activeCount = 0;
    this.onFailure = null;
    this.onPoolChanged = null;
    for (const m of this.mirrors) {
      m.setActive(false);
      m.material.uniforms.tDiffuse.value = null;
    }
    for (const rt of this.pool) rt.dispose();
    this.pool.length = 0;
  }
}
