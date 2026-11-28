/**
 * Beyond 3D — Prologue Segment P1 (0.0s – 26.0s · 文明远航)
 *
 * Implements Contract D of PROJECT.md (`SegmentP1Voyage`) across all 4 Act I sub-scenes:
 *   - S0A   (0.0 – 11.0s): Opening cinema titles dark cosmos, parallax starfield, sapphire veil & cosmic dust
 *   - S0B-1 (11.0 – 15.0s): Receding ribbed cryo-hibernation vault, 8 sculpted CryoPod units, Hero `08 号` sealing & cryo mist
 *   - S0B-2 (15.0 – 22.0s): Flagship「远航者号」+ 4 Escorts chevron formation, dual warp rings, shockwaves & superluminal tunnel
 *   - S0C   (22.0 – 26.0s): Serene 47-year deep-space void settle & peripheral Sagittarius-arm starlight for coordinate card
 *
 * Strictly deterministic from `snapshot.elapsedSec` for frame-exact `seekPrologue(tSec)`.
 * Strict Ghost translucency compliance: every translucent/additive/shader material sets
 * `disableDepthWrite = true` and `needDepthPrePass = false`.
 */

import { PALETTE, RENDER_GROUPS } from '../../engine/phase-materials.js';
import { createSoftGlowParticleTexture } from '../../engine/aaa-materials.js';
import {
  clamp,
  lerp,
  smoothstep,
  easeInOutCubic,
  easeOutExpo,
  createFlagshipVoyager,
  createEscortVessel,
  createCryoPodUnit,
} from './prologue-shared.js';

// ---------------------------------------------------------------------------
// Deterministic Seeded PRNG (100% Reproducible Starfields & Streaks)
// ---------------------------------------------------------------------------

function createSeededRng(seed = 0x564f5947) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Custom Cinema GLSL Shaders (WebGL 2.0 & SwiftShader Safe)
// ---------------------------------------------------------------------------

function registerP1Shaders(B) {
  const store = B.Effect.ShadersStore;

  // 1. Deep-Space Layered Volumetric Nebula Veil (S0A, S0B-2, S0C)
  if (!store.p1NebulaVeilVertexShader) {
    store.p1NebulaVeilVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.p1NebulaVeilFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uSeed;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorGold;
      varying vec2 vUv;

      float waveField(vec2 p, float t) {
        float a = sin(p.x * 2.4 + t * 0.14 + uSeed) * cos(p.y * 2.1 - t * 0.11);
        float b = sin((p.x * 4.7 - p.y * 3.8) + t * 0.18 + a * 1.4) * 0.5;
        float c = cos((p.x * 7.2 + p.y * 6.5) - t * 0.09 + b * 1.6) * 0.25;
        return 0.5 + 0.35 * (a + b + c);
      }

      void main(void) {
        vec2 centered = (vUv - 0.5) * 2.0;
        float r = length(centered);
        float edge = 1.0 - smoothstep(0.28, 0.98, r);
        if (edge <= 0.002) discard;

        // Subtle diagonal galactic sweep with domain-warped filaments
        vec2 warped = centered * vec2(1.15, 1.45);
        float band = exp(-pow((centered.y - centered.x * 0.36) * 1.9, 2.0));
        float f1 = clamp(waveField(warped, uTime), 0.0, 1.0);
        float f2 = clamp(waveField(warped * 1.85 + vec2(1.7, -0.9), uTime * 0.7), 0.0, 1.0);
        float density = pow(f1 * 0.65 + f2 * 0.35, 1.6) * (0.45 + 0.55 * band);

        vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.85, f2));
        float goldFilament = pow(clamp(f1 * f2 * band, 0.0, 1.0), 2.2);
        col += uColorGold * goldFilament * 1.45;

        float alpha = clamp(density * edge * uOpacity, 0.0, 0.92);
        gl_FragColor = vec4(col, alpha);
      }
    `;
  }

  // 2. Expanding Concentric Cyan-Gold Curvature Shockwave Ring (S0B-2 & S0C afterglow)
  if (!store.p1WarpShockwaveVertexShader) {
    store.p1WarpShockwaveVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.p1WarpShockwaveFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform float uPhase;
      uniform float uIntensity;
      uniform vec3 uColorCyan;
      uniform vec3 uColorGold;
      varying vec2 vUv;

      void main(void) {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 0.995) discard;

        float ang = atan(p.y, p.x);
        float arcMod = 0.68 + 0.24 * sin(ang * 6.0 + uTime * 2.8 + uPhase * 6.283)
                            + 0.14 * cos(ang * 13.0 - uTime * 3.9);
        arcMod = clamp(arcMod, 0.35, 1.05);

        // Razor-sharp, jewel-like narrow Gaussian curvature arc (width 0.018) + delicate harmonic filigree
        float primaryArc = exp(-pow((r - 0.84) / 0.018, 2.0));
        float fineInnerArc = exp(-pow((r - 0.68) / 0.012, 2.0)) * 0.42;
        float tightSheen = exp(-pow((r - 0.84) / 0.052, 2.0)) * 0.12;
        float edgeMask = 1.0 - smoothstep(0.92, 0.995, r);

        float energy = (primaryArc + fineInnerArc + tightSheen) * arcMod * edgeMask;
        if (energy <= 0.004) discard;

        // Rich saturated cyan (#3CE6D8) & antique gold (#F5C249) jewel tint with zero pure-white clipping
        float goldMix = clamp(0.28 + 0.52 * (0.5 + 0.5 * sin(ang * 3.0 + uPhase * 4.2)) + fineInnerArc * 0.45, 0.0, 1.0);
        vec3 col = mix(uColorCyan, uColorGold, goldMix);
        col *= (0.76 + 0.22 * primaryArc);

        float alpha = clamp(energy * uIntensity * 0.34, 0.0, 0.34);
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `;
  }

  // 3. Superluminal Cylindrical Warp Tunnel Star-Stream Shader (S0B-2)
  if (!store.p1WarpTunnelVertexShader) {
    store.p1WarpTunnelVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.p1WarpTunnelFragmentShader = `
      precision highp float;
      uniform float uScroll;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;

      float hash1(float n) {
        return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
      }

      void main(void) {
        // Smooth longitudinal fade at both open cylinder caps so zero hard rim ever shows
        float zFade = smoothstep(0.0, 0.16, vUv.y) * (1.0 - smoothstep(0.84, 1.0, vUv.y));
        if (zFade <= 0.002 || uIntensity <= 0.002) discard;

        // Layer 1: High-frequency crisp cyan-white superluminal lanes
        float laneA = floor(vUv.x * 72.0);
        float localA = fract(vUv.x * 72.0) - 0.5;
        float hA = hash1(laneA);
        float thinA = exp(-pow(localA * 10.0, 2.0));
        float streakA = pow(0.5 + 0.5 * sin((vUv.y * 6.0 - uScroll * (1.2 + hA * 1.1) + hA * 19.0) * 3.14159), 6.0);
        float layerA = thinA * streakA * step(0.28, hA);

        // Layer 2: Broad glowing sapphire-cyan curvature ribbons
        float laneB = floor(vUv.x * 28.0);
        float localB = fract(vUv.x * 28.0) - 0.5;
        float hB = hash1(laneB + 91.0);
        float thinB = exp(-pow(localB * 5.5, 2.0));
        float streakB = pow(0.5 + 0.5 * sin((vUv.y * 3.5 - uScroll * (0.85 + hB * 0.7) + hB * 13.0) * 3.14159), 4.0);
        float layerB = thinB * streakB * 0.65;

        // Layer 3: Radiant astral-gold high-velocity filaments
        float laneC = floor(vUv.x * 46.0);
        float localC = fract(vUv.x * 46.0) - 0.5;
        float hC = hash1(laneC + 213.0);
        float thinC = exp(-pow(localC * 12.0, 2.0));
        float streakC = pow(0.5 + 0.5 * sin((vUv.y * 8.0 - uScroll * (1.6 + hC * 1.3) + hC * 27.0) * 3.14159), 8.0);
        float layerC = thinC * streakC * step(0.62, hC);

        // Subtle atmospheric tunnel glow tying lanes together
        float veil = (0.06 + 0.05 * sin(vUv.x * 18.8495 + uTime * 1.4)) * zFade;

        vec3 sapphire = vec3(0.14, 0.42, 0.82);
        vec3 cyan = vec3(0.30, 0.90, 0.84);
        vec3 platinum = vec3(0.92, 0.98, 1.0);
        vec3 gold = vec3(0.98, 0.78, 0.30);

        vec3 col = (sapphire * veil
                 + mix(sapphire, cyan, 0.7) * layerB * 0.95
                 + mix(cyan, platinum, 0.45) * layerA * 1.20
                 + mix(gold, platinum, 0.28) * layerC * 1.30) * 0.58;

        float alpha = clamp((veil + layerA * 0.68 + layerB * 0.38 + layerC * 0.72) * zFade * uIntensity * 0.58, 0.0, 0.54);
        gl_FragColor = vec4(col, alpha);
      }
    `;
  }
}

// ---------------------------------------------------------------------------
// Procedural Soft Cryogenic Mist Cloud Texture (100% Offline)
// ---------------------------------------------------------------------------

function createCryoMistTexture(scene, name = 'p1_cryo_mist_tex') {
  const B = globalThis.BABYLON;
  const size = 128;
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);

  const puffs = [
    [64, 64, 58, 0.36],
    [48, 56, 36, 0.24],
    [82, 62, 34, 0.22],
    [62, 78, 38, 0.20],
    [58, 44, 30, 0.18],
  ];
  for (const [cx, cy, rad, peak] of puffs) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(220, 245, 255, ${peak})`);
    g.addColorStop(0.52, `rgba(145, 212, 248, ${peak * 0.42})`);
    g.addColorStop(1, 'rgba(90, 175, 235, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

// ---------------------------------------------------------------------------
// Helper: Thin-Instanced Multi-Depth Starfield Builder (Zero Draw-Call Bloat)
// ---------------------------------------------------------------------------

function buildThinStarCluster(scene, name, parent, count, material, rng, samplerFn) {
  const B = globalThis.BABYLON;
  const base = B.MeshBuilder.CreateSphere(name, { diameter: 1.0, segments: 6 }, scene);
  base.material = material;
  base.parent = parent;
  base.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
  base.alwaysSelectAsActiveMesh = true;
  base.isPickable = false;

  const matrices = new Float32Array(count * 16);
  const tempMat = new B.Matrix();
  const qIdentity = B.Quaternion.Identity();
  const scaleVec = new B.Vector3();
  const posVec = new B.Vector3();

  for (let i = 0; i < count; i += 1) {
    const { x, y, z, size } = samplerFn(i, rng);
    scaleVec.set(size, size, size);
    posVec.set(x, y, z);
    B.Matrix.ComposeToRef(scaleVec, qIdentity, posVec, tempMat);
    tempMat.copyToArray(matrices, i * 16);
  }
  base.thinInstanceSetBuffer('matrix', matrices, 16, true);
  return base;
}

/**
 * Build a cap-free tapered cylindrical tunnel aligned along +Z with exact UVs:
 *   u ∈ [0, 1] around circumference, v ∈ [0, 1] along length (zStart -> zEnd).
 * Zero circular end-caps and zero seam artifacts.
 */
function buildOpenWarpTunnelMesh(scene, name, { zStart, zEnd, radiusStart, radiusEnd, tessellation = 48, rings = 8 }) {
  const B = globalThis.BABYLON;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const cols = tessellation + 1;
  for (let j = 0; j <= rings; j += 1) {
    const v = j / rings;
    const z = lerp(zStart, zEnd, v);
    const r = lerp(radiusStart, radiusEnd, v);
    for (let i = 0; i <= tessellation; i += 1) {
      const u = i / tessellation;
      const theta = u * Math.PI * 2;
      const cx = Math.cos(theta);
      const sy = Math.sin(theta);
      positions.push(cx * r, sy * r, z);
      // Inward-facing normals toward the fleet inside the tunnel
      normals.push(-cx, -sy, 0);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < rings; j += 1) {
    for (let i = 0; i < tessellation; i += 1) {
      const a = j * cols + i;
      const b = a + 1;
      const c = (j + 1) * cols + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  vd.applyToMesh(mesh, false);
  return mesh;
}

function mergeByMaterial(B, meshList, name, material, parent, { receiveShadows = false, group = RENDER_GROUPS.ENVIRONMENT } = {}) {
  if (!meshList || meshList.length === 0) return null;
  for (const m of meshList) {
    m.computeWorldMatrix(true);
  }
  const result =
    meshList.length === 1
      ? meshList[0]
      : B.Mesh.MergeMeshes(meshList, true, true, undefined, false, false);
  if (!result) return null;
  result.name = name;
  result.material = material;
  result.parent = parent;
  result.receiveShadows = receiveShadows;
  result.renderingGroupId = group;
  result.isPickable = false;
  return result;
}

// ---------------------------------------------------------------------------
// Segment P1: 文明远航 (0.0s – 26.0s)
// ---------------------------------------------------------------------------

export class SegmentP1Voyage {
  constructor(scene, materials, sharedRig = {}) {
    this.B = globalThis.BABYLON;
    this.scene = scene;
    this.materials = materials;
    this.sharedRig = sharedRig || {};
    this.segmentId = 'P1';
    this.active = false;
    this._activeSubScene = null;
    this._pendingPrewarmTicks = 0;

    this._ownedMaterials = [];
    this._ownedTextures = [];
    this._ownedLights = [];
    this._particleSystems = [];
    this._heroDisposables = [];
    this._subRoots = {};
    this._subLights = { S0A: [], 'S0B-1': [], 'S0B-2': [], S0C: [] };
    this._subParticles = { S0A: [], 'S0B-1': [], 'S0B-2': [], S0C: [] };
    this._subMeshes = { S0A: [], 'S0B-1': [], 'S0B-2': [], S0C: [] };

    registerP1Shaders(this.B);

    this.root = new this.B.TransformNode('prologue_p1_root', scene);
    if (this.sharedRig.root) {
      this.root.parent = this.sharedRig.root;
    }

    // Shared particle textures (owned & cleanly disposed)
    this._softGlowTex = createSoftGlowParticleTexture(scene);
    this._ownedTextures.push(this._softGlowTex);
    this._cryoMistTex = createCryoMistTexture(scene, 'p1_cryo_mist_tex');
    this._ownedTextures.push(this._cryoMistTex);

    // Build shared P1-local opaque star & translucent VFX materials
    this._initLocalMaterials();

    // Build all 4 strictly isolated sub-scenes under this.root
    this._buildS0A();
    this._buildS0B1();
    this._buildS0B2();
    this._buildS0C();

    // Start cleanly disabled until PrologueScene activates P1
    this.setActive(false);
  }

  _trackMat(mat, isTranslucent = false) {
    if (isTranslucent) {
      mat.disableDepthWrite = true;
      mat.needDepthPrePass = false;
      mat._isPrologueTranslucent = true;
    } else {
      mat.disableDepthWrite = false;
      mat.needDepthPrePass = false;
    }
    this._ownedMaterials.push(mat);
    return mat;
  }

  _registerShadow(mesh) {
    if (mesh && typeof this.sharedRig.registerShadowCaster === 'function') {
      this.sharedRig.registerShadowCaster(mesh);
    }
  }

  _registerMirror(mesh) {
    if (mesh && typeof this.sharedRig.registerMirrorMesh === 'function') {
      this.sharedRig.registerMirrorMesh(mesh);
    }
  }

  _initLocalMaterials() {
    const B = this.B;
    const scene = this.scene;

    // Opaque star materials (alpha = 1.0, emissive crisp pinpoints)
    this._starCoolMat = this._trackMat(new B.StandardMaterial('p1_star_cool_mat', scene), false);
    this._starCoolMat.diffuseColor = B.Color3.FromHexString('#D4ECFF');
    this._starCoolMat.emissiveColor = B.Color3.FromHexString('#D4ECFF').scale(1.1);
    this._starCoolMat.disableLighting = true;

    this._starWarmMat = this._trackMat(new B.StandardMaterial('p1_star_warm_mat', scene), false);
    this._starWarmMat.diffuseColor = B.Color3.FromHexString('#FFE8BC');
    this._starWarmMat.emissiveColor = B.Color3.FromHexString('#FFE8BC').scale(1.0);
    this._starWarmMat.disableLighting = true;

    this._starVoidMat = this._trackMat(new B.StandardMaterial('p1_star_void_mat', scene), false);
    this._starVoidMat.diffuseColor = B.Color3.FromHexString('#B8DCFF');
    this._starVoidMat.emissiveColor = B.Color3.FromHexString('#A8D2FA').scale(0.85);
    this._starVoidMat.disableLighting = true;

    // Translucent additive star-stream streak materials (S0B-2)
    this._streakCyanMat = this._trackMat(new B.StandardMaterial('p1_streak_cyan_mat', scene), true);
    this._streakCyanMat.diffuseColor = B.Color3.FromHexString('#74F5EA');
    this._streakCyanMat.emissiveColor = B.Color3.FromHexString('#74F5EA').scale(1.35);
    this._streakCyanMat.disableLighting = true;
    this._streakCyanMat.alpha = 0.65;
    this._streakCyanMat.alphaMode = B.Engine.ALPHA_ADD;
    this._streakCyanMat.backFaceCulling = false;

    this._streakGoldMat = this._trackMat(new B.StandardMaterial('p1_streak_gold_mat', scene), true);
    this._streakGoldMat.diffuseColor = B.Color3.FromHexString('#FFD670');
    this._streakGoldMat.emissiveColor = B.Color3.FromHexString('#FFD670').scale(1.3);
    this._streakGoldMat.disableLighting = true;
    this._streakGoldMat.alpha = 0.58;
    this._streakGoldMat.alphaMode = B.Engine.ALPHA_ADD;
    this._streakGoldMat.backFaceCulling = false;

    // Hero Cryo 08 under-glow rim material (Ghost-safe additive)
    this._cryoAuraMat = this._trackMat(new B.StandardMaterial('p1_cryo_aura_mat', scene), true);
    this._cryoAuraMat.diffuseColor = B.Color3.FromHexString('#58A6FF');
    this._cryoAuraMat.emissiveColor = B.Color3.FromHexString('#58A6FF').scale(1.1);
    this._cryoAuraMat.disableLighting = true;
    this._cryoAuraMat.alpha = 0.28;
    this._cryoAuraMat.alphaMode = B.Engine.ALPHA_ADD;
    this._cryoAuraMat.backFaceCulling = false;

    // Flagship dual-warp-ring plasma core aura (S0B-2, Ghost-safe additive, bloom-calibrated)
    this._warpCoreAuraMat = this._trackMat(new B.StandardMaterial('p1_warp_core_aura_mat', scene), true);
    this._warpCoreAuraMat.diffuseColor = B.Color3.FromHexString('#52EFE0');
    this._warpCoreAuraMat.emissiveColor = B.Color3.FromHexString('#52EFE0').scale(1.15);
    this._warpCoreAuraMat.disableLighting = true;
    this._warpCoreAuraMat.alpha = 0.28;
    this._warpCoreAuraMat.alphaMode = B.Engine.ALPHA_ADD;
    this._warpCoreAuraMat.backFaceCulling = false;

    // Ensure shared PBR materials used in P1 accept all local sculpted PointLights alongside global 3-point rig
    const p1LightMats = [
      this.materials.hullTitanium,
      this.materials.hullDarkRib,
      this.materials.hullAccentGold,
      this.materials.cryoAlloy,
      this.materials.cryoFrostedGlass,
      this.materials.cabinDeckMirror,
      this.materials.cabinDarkTitanium,
      this.materials.linXiaSuit,
      this.materials.linXiaDarkTrim,
    ];
    for (const m of p1LightMats) {
      if (m && typeof m.maxSimultaneousLights === 'number' && m.maxSimultaneousLights < 12) {
        m.maxSimultaneousLights = 12;
      }
    }

    // Brighter metallic steel PBR clones for S0B-1 cathedral arches, vault shell & bay plinths (zero shared mutation)
    const cloneCorridorSteel = (name, tintHex, { metallic, roughness, clearCoatIntensity, clearCoatRoughness, emissiveHex }) => {
      const mat = this.materials.cryoAlloy.clone(name);
      mat.albedoColor = B.Color3.FromHexString(tintHex);
      mat.metallic = metallic;
      mat.roughness = roughness;
      mat.emissiveColor = B.Color3.FromHexString(emissiveHex);
      mat.clearCoat.isEnabled = true;
      mat.clearCoat.intensity = clearCoatIntensity;
      mat.clearCoat.roughness = clearCoatRoughness;
      mat.maxSimultaneousLights = 12;
      return this._trackMat(mat, false);
    };

    this._s0b1ArchRibMat = cloneCorridorSteel('p1_s0b1_arch_rib_steel_pbr', '#6B84A3', {
      metallic: 0.72,
      roughness: 0.32,
      clearCoatIntensity: 0.52,
      clearCoatRoughness: 0.16,
      emissiveHex: '#122236',
    });
    this._s0b1VaultShellMat = cloneCorridorSteel('p1_s0b1_vault_shell_steel_pbr', '#5C728F', {
      metallic: 0.66,
      roughness: 0.36,
      clearCoatIntensity: 0.44,
      clearCoatRoughness: 0.2,
      emissiveHex: '#0E1C2E',
    });
    this._s0b1PlinthAlloyMat = cloneCorridorSteel('p1_s0b1_plinth_alloy_pbr', '#DCE8F5', {
      metallic: 0.62,
      roughness: 0.28,
      clearCoatIntensity: 0.56,
      clearCoatRoughness: 0.14,
      emissiveHex: '#15273D',
    });

    // Hero Pod 08 internal glowing cryo-berth accent strip
    this._hero08BerthGlowMat = this._trackMat(new B.StandardMaterial('p1_s0b1_hero08_berth_glow', scene), true);
    this._hero08BerthGlowMat.diffuseColor = B.Color3.FromHexString('#7AD6FF');
    this._hero08BerthGlowMat.emissiveColor = B.Color3.FromHexString('#7AD6FF').scale(1.25);
    this._hero08BerthGlowMat.disableLighting = true;
    this._hero08BerthGlowMat.alpha = 0.42;
    this._hero08BerthGlowMat.alphaMode = B.Engine.ALPHA_ADD;
    this._hero08BerthGlowMat.backFaceCulling = false;

    // Dedicated S0B-1 volumetric shaft shader (independent of shared materials.volumetricShaft)
    this._cryoShaftMat = this._trackMat(
      new B.ShaderMaterial(
        'p1_cryo_vol_shaft_shader',
        scene,
        { vertex: 'prologueVolumetricShaft', fragment: 'prologueVolumetricShaft' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'uTime', 'uColor', 'uOpacity'],
          needAlphaBlending: true,
        }
      ),
      true
    );
    this._cryoShaftMat.setFloat('uTime', 0);
    this._cryoShaftMat.setColor3('uColor', B.Color3.FromHexString('#7AC8FF'));
    this._cryoShaftMat.setFloat('uOpacity', 0.16);
    this._cryoShaftMat.alpha = 0.42;
    this._cryoShaftMat.alphaMode = B.Engine.ALPHA_ADD;
    this._cryoShaftMat.backFaceCulling = false;
  }

  _makeNebulaMaterial(name, { colorA, colorB, colorGold, opacity, seed }) {
    const B = this.B;
    const mat = this._trackMat(
      new B.ShaderMaterial(
        name,
        this.scene,
        { vertex: 'p1NebulaVeil', fragment: 'p1NebulaVeil' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'uTime', 'uOpacity', 'uSeed', 'uColorA', 'uColorB', 'uColorGold'],
          needAlphaBlending: true,
        }
      ),
      true
    );
    mat.setFloat('uTime', 0);
    mat.setFloat('uOpacity', opacity);
    mat.setFloat('uSeed', seed);
    mat.setColor3('uColorA', B.Color3.FromHexString(colorA));
    mat.setColor3('uColorB', B.Color3.FromHexString(colorB));
    mat.setColor3('uColorGold', B.Color3.FromHexString(colorGold));
    mat.alpha = 0.55;
    mat.alphaMode = B.Engine.ALPHA_ADD;
    mat.backFaceCulling = false;
    return mat;
  }

  _makeShockwaveMaterial(name) {
    const B = this.B;
    const mat = this._trackMat(
      new B.ShaderMaterial(
        name,
        this.scene,
        { vertex: 'p1WarpShockwave', fragment: 'p1WarpShockwave' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'uTime', 'uPhase', 'uIntensity', 'uColorCyan', 'uColorGold'],
          needAlphaBlending: true,
        }
      ),
      true
    );
    mat.setFloat('uTime', 0);
    mat.setFloat('uPhase', 0);
    mat.setFloat('uIntensity', 0);
    mat.setColor3('uColorCyan', B.Color3.FromHexString('#3CE6D8'));
    mat.setColor3('uColorGold', B.Color3.FromHexString('#F5C249'));
    mat.alpha = 0.34;
    mat.alphaMode = B.Engine.ALPHA_ADD;
    mat.backFaceCulling = false;
    return mat;
  }

  // -------------------------------------------------------------------------
  // SUB-SCENE 1: S0A (0.0 – 11.0s) — Opening Cinema Titles & Deep Cosmic Dust
  // -------------------------------------------------------------------------

  _buildS0A() {
    const B = this.B;
    const scene = this.scene;
    const root = new B.TransformNode('p1_s0a_root', scene);
    root.parent = this.root;
    this._subRoots.S0A = root;

    const rng = createSeededRng(0x10a0f123);

    // Deep-space distant stars — deliberately quieter in the dead center so 3-line cinema titles glow cleanly
    const coolStars = buildThinStarCluster(scene, 'p1_s0a_stars_cool', root, 220, this._starCoolMat, rng, () => {
      const z = 26 + rng() * 98;
      const spreadX = z * 0.78;
      const spreadY = z * 0.42;
      const x = (rng() * 2 - 1) * spreadX;
      const y = (rng() * 2 - 1) * spreadY;
      const inCenterBand = Math.abs(x / z) < 0.28 && Math.abs(y / z) < 0.14;
      const size = (0.07 + Math.pow(rng(), 2.2) * 0.18) * (inCenterBand ? 0.5 : 1.0);
      return { x, y, z, size };
    });
    const warmStars = buildThinStarCluster(scene, 'p1_s0a_stars_warm', root, 80, this._starWarmMat, rng, () => {
      const z = 32 + rng() * 96;
      const x = (rng() * 2 - 1) * z * 0.76;
      const y = (rng() * 2 - 1) * z * 0.4;
      const inCenterBand = Math.abs(x / z) < 0.28 && Math.abs(y / z) < 0.14;
      const size = (0.06 + Math.pow(rng(), 2.0) * 0.16) * (inCenterBand ? 0.45 : 1.0);
      return { x, y, z, size };
    });
    this._s0aStarGroup = [coolStars, warmStars];
    this._subMeshes.S0A.push(coolStars, warmStars);

    // 3 ultra-subtle distant sapphire volumetric nebula planes (dark & serene behind white typography)
    this._s0aNebulae = [];
    const nebSpecs = [
      { pos: [-16, -4.5, 58], w: 68, h: 36, rz: 0.18, colorA: '#0B2244', colorB: '#164564', colorGold: '#4A3A20', baseOpacity: 0.14, seed: 1.1 },
      { pos: [18, 5.2, 74], w: 78, h: 40, rz: -0.14, colorA: '#091C38', colorB: '#153F5A', colorGold: '#3F3420', baseOpacity: 0.11, seed: 3.4 },
      { pos: [0, 0.5, 92], w: 92, h: 48, rz: 0.08, colorA: '#07162E', colorB: '#123750', colorGold: '#332C1E', baseOpacity: 0.09, seed: 5.7 },
    ];
    nebSpecs.forEach((spec, idx) => {
      const mat = this._makeNebulaMaterial(`p1_s0a_neb_mat_${idx}`, {
        colorA: spec.colorA,
        colorB: spec.colorB,
        colorGold: spec.colorGold,
        opacity: spec.baseOpacity,
        seed: spec.seed,
      });
      const plane = B.MeshBuilder.CreatePlane(`p1_s0a_nebula_${idx}`, { width: spec.w, height: spec.h }, scene);
      plane.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      plane.rotation.z = spec.rz;
      plane.material = mat;
      plane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      plane.isPickable = false;
      plane.parent = root;
      this._s0aNebulae.push({ mesh: plane, mat, baseOpacity: spec.baseOpacity });
      this._subMeshes.S0A.push(plane);
    });

    // Cosmic dust starfield ParticleSystem (luminous cold-white & pale sapphire star motes)
    const dustPs = new B.ParticleSystem('p1_s0a_cosmic_dust_ps', 240, scene);
    dustPs.particleTexture = this._softGlowTex;
    dustPs.emitter = new B.Vector3(0, 0, 14);
    dustPs.minEmitBox = new B.Vector3(-20, -9, -14);
    dustPs.maxEmitBox = new B.Vector3(20, 9, 28);
    dustPs.color1 = new B.Color4(0.92, 0.96, 1.0, 0.44);
    dustPs.color2 = new B.Color4(0.46, 0.72, 0.98, 0.30);
    dustPs.colorDead = new B.Color4(0.32, 0.55, 0.85, 0.0);
    dustPs.minSize = 0.045;
    dustPs.maxSize = 0.145;
    dustPs.minLifeTime = 4.2;
    dustPs.maxLifeTime = 8.8;
    dustPs.emitRate = 36;
    dustPs.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    dustPs.gravity = new B.Vector3(0, 0, 0);
    dustPs.direction1 = new B.Vector3(-0.08, -0.04, -0.26);
    dustPs.direction2 = new B.Vector3(0.08, 0.06, -0.08);
    dustPs.minEmitPower = 0.08;
    dustPs.maxEmitPower = 0.24;
    dustPs.updateSpeed = 0.015;
    dustPs.preWarmStepOffset = 3;
    dustPs.preventAutoStart = true;
    dustPs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this._particleSystems.push(dustPs);
    this._subParticles.S0A.push(dustPs);
  }

  // -------------------------------------------------------------------------
  // SUB-SCENE 2: S0B-1 (11.0 – 15.0s) — Receding Cryo-Hibernation Vault & Hero 08 号
  // -------------------------------------------------------------------------

  _buildS0B1() {
    const B = this.B;
    const scene = this.scene;
    const mats = this.materials;
    const root = new B.TransformNode('p1_s0b1_root', scene);
    root.parent = this.root;
    this._subRoots['S0B-1'] = root;

    // 1) Central Polished Reflective Metallic Deck Walkway (z = -3 .. +29)
    const mirrorDeck = B.MeshBuilder.CreateGround(
      'p1_s0b1_mirror_deck',
      { width: 2.38, height: 32.0, subdivisions: 2 },
      scene
    );
    mirrorDeck.position.set(0, 0.0, 13.0);
    mirrorDeck.material = mats.cabinDeckMirror;
    mirrorDeck.receiveShadows = true;
    mirrorDeck.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    mirrorDeck.isPickable = false;
    mirrorDeck.parent = root;
    this._subMeshes['S0B-1'].push(mirrorDeck);

    // 2) Sculpted Cathedral Ribbed Bulkheads, Bay Plinths, Shell & Far Vault Door (Merged by Material!)
    const darkRibParts = [];
    const alloyParts = [];
    const darkTiParts = [];
    const goldParts = [];
    const iceLightParts = [];
    const cyanAccentParts = [];

    // Raised lateral cryogenic bay plinths & recessed aisle guide rails
    for (const side of [-1, 1]) {
      const plinth = B.MeshBuilder.CreateBox(`tmp_plinth_${side}`, { width: 1.72, height: 0.05, depth: 32.0 }, scene);
      plinth.position.set(side * 2.04, 0.025, 13.0);
      alloyParts.push(plinth);

      const curb = B.MeshBuilder.CreateBox(`tmp_curb_${side}`, { width: 0.14, height: 0.075, depth: 32.0 }, scene);
      curb.position.set(side * 1.18, 0.038, 13.0);
      darkRibParts.push(curb);

      const floorRail = B.MeshBuilder.CreateBox(`tmp_frail_${side}`, { width: 0.045, height: 0.018, depth: 31.2 }, scene);
      floorRail.position.set(side * 1.07, 0.012, 13.0);
      iceLightParts.push(floorRail);

      // Continuous outer curved lower & upper shell wall panels (zero void leakage)
      const lowerWall = B.MeshBuilder.CreateBox(`tmp_lwall_${side}`, { width: 0.16, height: 1.85, depth: 32.0 }, scene);
      lowerWall.position.set(side * 2.94, 0.92, 13.0);
      darkTiParts.push(lowerWall);

      const upperCantWall = B.MeshBuilder.CreateBox(`tmp_uwall_${side}`, { width: 0.16, height: 1.95, depth: 32.0 }, scene);
      upperCantWall.position.set(side * 2.48, 2.58, 13.0);
      upperCantWall.rotation.z = side * 0.48;
      darkTiParts.push(upperCantWall);

      // Horizontal brushed-alloy wainscoting datum rails & cryo coolant conduit pipes
      for (const wy of [0.88, 1.82]) {
        const wainscot = B.MeshBuilder.CreateBox(`tmp_wain_${side}_${wy}`, { width: 0.1, height: 0.09, depth: 31.5 }, scene);
        wainscot.position.set(side * 2.84, wy, 13.0);
        alloyParts.push(wainscot);
      }

      const conduit = B.MeshBuilder.CreateCylinder(
        `tmp_pipe_${side}`,
        { diameter: 0.08, height: 31.5, tessellation: 10 },
        scene
      );
      conduit.rotation.x = Math.PI * 0.5;
      conduit.position.set(side * 2.74, 2.15, 13.0);
      alloyParts.push(conduit);

      // Recessed continuous overhead linear cryogenic light strips (reflecting in mirror deck!)
      const ceilingStrip = B.MeshBuilder.CreateBox(`tmp_cstrip_${side}`, { width: 0.14, height: 0.04, depth: 30.8 }, scene);
      ceilingStrip.position.set(side * 0.88, 3.36, 13.0);
      iceLightParts.push(ceilingStrip);

      // Subtle dorsal gold trim strip flanking the central spine
      const dorsalTrim = B.MeshBuilder.CreateBox(`tmp_dtrim_${side}`, { width: 0.045, height: 0.045, depth: 30.8 }, scene);
      dorsalTrim.position.set(side * 0.44, 3.44, 13.0);
      goldParts.push(dorsalTrim);
    }

    // Vaulted central ceiling soffit
    const ceilingSoffit = B.MeshBuilder.CreateBox('tmp_csoffit', { width: 3.6, height: 0.16, depth: 32.0 }, scene);
    ceilingSoffit.position.set(0, 3.55, 13.0);
    darkTiParts.push(ceilingSoffit);

    // Central spine rib running the length of the vault
    const centerSpine = B.MeshBuilder.CreateBox('tmp_cspine', { width: 0.46, height: 0.2, depth: 32.0 }, scene);
    centerSpine.position.set(0, 3.46, 13.0);
    darkRibParts.push(centerSpine);

    // 9 Ribbed Cathedral Structural Arches receding along Z = -1.8 .. +26.2 (every 3.5m)
    for (let i = 0; i < 9; i += 1) {
      const z = -1.8 + i * 3.5;

      for (const side of [-1, 1]) {
        // Heavy vertical lower pilaster
        const pilaster = B.MeshBuilder.CreateBox(`tmp_pil_${i}_${side}`, { width: 0.28, height: 1.92, depth: 0.34 }, scene);
        pilaster.position.set(side * 2.74, 0.96, z);
        darkRibParts.push(pilaster);

        // Brushed cryo-alloy inner flange & chamfered shoulder haunch
        const flange = B.MeshBuilder.CreateBox(`tmp_fl_${i}_${side}`, { width: 0.1, height: 1.72, depth: 0.18 }, scene);
        flange.position.set(side * 2.57, 0.94, z);
        alloyParts.push(flange);

        const shoulder = B.MeshBuilder.CreateBox(`tmp_sh_${i}_${side}`, { width: 0.3, height: 1.88, depth: 0.32 }, scene);
        shoulder.position.set(side * 2.15, 2.55, z);
        shoulder.rotation.z = side * 0.56;
        darkRibParts.push(shoulder);

        const shoulderTrim = B.MeshBuilder.CreateBox(`tmp_sht_${i}_${side}`, { width: 0.1, height: 1.55, depth: 0.14 }, scene);
        shoulderTrim.position.set(side * 1.98, 2.48, z);
        shoulderTrim.rotation.z = side * 0.56;
        alloyParts.push(shoulderTrim);

        // Brushed aerospace gold datum clamp at arch haunch
        const bracket = B.MeshBuilder.CreateBox(`tmp_brk_${i}_${side}`, { width: 0.12, height: 0.22, depth: 0.38 }, scene);
        bracket.position.set(side * 2.52, 1.88, z);
        goldParts.push(bracket);

        // Cross-arch icy-blue accent chevron luminaire bar
        const archLed = B.MeshBuilder.CreateBox(`tmp_aled_${i}_${side}`, { width: 0.055, height: 0.92, depth: 0.055 }, scene);
        archLed.position.set(side * 2.12, 2.54, z - 0.17);
        archLed.rotation.z = side * 0.56;
        iceLightParts.push(archLed);
      }

      // Crown beam tying left & right arch haunches
      const crown = B.MeshBuilder.CreateBox(`tmp_cr_${i}`, { width: 2.95, height: 0.24, depth: 0.32 }, scene);
      crown.position.set(0, 3.32, z);
      darkRibParts.push(crown);

      // Transverse deck expansion strip
      const deckStrip = B.MeshBuilder.CreateBox(`tmp_ds_${i}`, { width: 2.34, height: 0.012, depth: 0.08 }, scene);
      deckStrip.position.set(0, 0.008, z);
      darkRibParts.push(deckStrip);
    }

    // Far Cryogenic Vault Iris Bulkhead closing the vanishing point cleanly at Z = 28.6
    const backWall = B.MeshBuilder.CreateBox('tmp_bwall', { width: 6.2, height: 3.9, depth: 0.3 }, scene);
    backWall.position.set(0, 1.85, 28.8);
    darkTiParts.push(backWall);

    const irisOuter = B.MeshBuilder.CreateTorus('tmp_iris_out', { diameter: 3.1, thickness: 0.26, tessellation: 32 }, scene);
    irisOuter.rotation.x = Math.PI * 0.5;
    irisOuter.position.set(0, 1.65, 28.55);
    darkRibParts.push(irisOuter);

    const irisInner = B.MeshBuilder.CreateTorus('tmp_iris_in', { diameter: 2.25, thickness: 0.1, tessellation: 32 }, scene);
    irisInner.rotation.x = Math.PI * 0.5;
    irisInner.position.set(0, 1.65, 28.5);
    goldParts.push(irisInner);

    const irisCore = B.MeshBuilder.CreateTorus('tmp_iris_core', { diameter: 1.5, thickness: 0.055, tessellation: 28 }, scene);
    irisCore.rotation.x = Math.PI * 0.5;
    irisCore.position.set(0, 1.65, 28.48);
    cyanAccentParts.push(irisCore);

    // Merge all static architectural parts by material (brighter brushed metallic steel so arches & walls gleam!)
    const mDarkRib = mergeByMaterial(B, darkRibParts, 'p1_s0b1_arch_ribs', this._s0b1ArchRibMat, root, { receiveShadows: true });
    const mAlloy = mergeByMaterial(B, alloyParts, 'p1_s0b1_arch_alloy', this._s0b1PlinthAlloyMat, root, { receiveShadows: true });
    const mDarkTi = mergeByMaterial(B, darkTiParts, 'p1_s0b1_arch_shell', this._s0b1VaultShellMat, root, { receiveShadows: true });
    const mGold = mergeByMaterial(B, goldParts, 'p1_s0b1_arch_gold', mats.hullAccentGold, root, { receiveShadows: false });
    const mIceLight = mergeByMaterial(B, iceLightParts, 'p1_s0b1_arch_lights', mats.emissiveIceBlue, root, { receiveShadows: false });
    const mCyanAccent = mergeByMaterial(B, cyanAccentParts, 'p1_s0b1_iris_glow', mats.emissiveCyan, root, { receiveShadows: false });

    for (const m of [mDarkRib, mAlloy, mDarkTi, mGold, mIceLight, mCyanAccent]) {
      if (m) this._subMeshes['S0B-1'].push(m);
    }
    // Register sculpted arches, shell & ceiling lights for mirror deck reflections (avoid roof shadow swallowing corridor!)
    this._registerMirror(mDarkRib);
    this._registerMirror(mAlloy);
    this._registerMirror(mDarkTi);
    this._registerMirror(mIceLight);
    this._registerMirror(mCyanAccent);

    // 3) 8 Sculpted `createCryoPodUnit` Bays (4 Left, 4 Right — Hero `08 号` proud at focal point!)
    //    Note: `07 号` is actively on bridge duty, so stasis bays are 03, 04, 05, 08(HERO), 09, 10, 11, 12.
    this._cryoPodSpecs = [
      // Right Row (plaques rotated -2.62 rad to face camera at -X, -Z directly!)
      { code: '04 号', pos: [1.98, 0.05, 1.80], rotY: -2.68, closeStart: 11.0, closeEnd: 11.9, hero: false },
      { code: '08 号', pos: [1.58, 0.05, 5.20], rotY: -2.62, closeStart: 11.8, closeEnd: 14.2, hero: true },
      { code: '10 号', pos: [1.96, 0.05, 8.70], rotY: -2.62, closeStart: 11.4, closeEnd: 12.9, hero: false },
      { code: '12 号', pos: [1.96, 0.05, 12.20], rotY: -2.62, closeStart: 11.6, closeEnd: 13.4, hero: false },
      // Left Row (plaques rotated +2.62 rad to face camera at +X, -Z directly!)
      { code: '03 号', pos: [-1.98, 0.05, 2.05], rotY: 2.68, closeStart: 11.0, closeEnd: 11.8, hero: false },
      { code: '05 号', pos: [-1.96, 0.05, 5.55], rotY: 2.62, closeStart: 11.2, closeEnd: 12.3, hero: false },
      { code: '09 号', pos: [-1.96, 0.05, 9.05], rotY: 2.62, closeStart: 11.4, closeEnd: 12.8, hero: false },
      { code: '11 号', pos: [-1.96, 0.05, 12.55], rotY: 2.62, closeStart: 11.6, closeEnd: 13.3, hero: false },
    ];

    this._cryoPods = this._cryoPodSpecs.map((spec, idx) => {
      const unit = createCryoPodUnit(scene, mats, `p1_cryo_pod_${idx}`, {
        podCode: spec.code,
        statusLabel: '低温封存',
        accentHex: '#58A6FF',
      });
      unit.root.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      unit.root.rotation.y = spec.rotY;
      unit.root.parent = root;
      this._heroDisposables.push(unit);

      const childMeshes = unit.root.getChildMeshes();
      for (const cm of childMeshes) {
        cm.isPickable = false;
        // Elevate dark cryo-pod chassis bases to sculpted brushed metallic steel so every pod reads crisply in 3D
        if (cm.material === mats.hullDarkRib) {
          cm.material = this._s0b1ArchRibMat;
        } else if (cm.material === mats.cryoAlloy) {
          cm.material = this._s0b1PlinthAlloyMat;
        }
        this._subMeshes['S0B-1'].push(cm);
        if (!cm.material?._isPrologueTranslucent) {
          cm.receiveShadows = true;
          this._registerShadow(cm);
        }
        // Register hero & nearby midground pods for real-time floor reflections
        if (spec.pos[2] <= 9.5) {
          this._registerMirror(cm);
        }
      }

      // Internal glowing cryogenic berth bed strip inside Hero `08 号` pod for luminous depth under closing canopy
      if (spec.hero) {
        const berthGlow = B.MeshBuilder.CreatePlane(
          'p1_s0b1_hero08_berth_glow_plane',
          { width: 0.72, height: 1.76 },
          scene
        );
        berthGlow.rotation.x = Math.PI * 0.5;
        berthGlow.position.set(0, 0.76, 0.02);
        berthGlow.material = this._hero08BerthGlowMat;
        berthGlow.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
        berthGlow.isPickable = false;
        berthGlow.parent = unit.root;
        this._subMeshes['S0B-1'].push(berthGlow);
      }

      return { unit, spec };
    });

    // Subtle backlit cryogenic floor rim beneath Hero `08 号` pod
    const heroRim = B.MeshBuilder.CreateDisc('p1_s0b1_hero08_aura', { radius: 1.35, tessellation: 32 }, scene);
    heroRim.rotation.x = Math.PI * 0.5;
    heroRim.position.set(1.58, 0.06, 5.20);
    heroRim.material = this._cryoAuraMat;
    heroRim.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    heroRim.isPickable = false;
    heroRim.parent = root;
    this._hero08Aura = heroRim;
    this._subMeshes['S0B-1'].push(heroRim);

    // 4) 8 Far Receding Thin-Instanced Cryo Bays (z = 15.8, 19.2, 22.6, 26.0 left & right — only 4 draw calls!)
    const farPositions = [];
    for (const fz of [15.8, 19.2, 22.6, 26.0]) {
      farPositions.push({ x: 1.98, z: fz, rotY: -2.62 });
      farPositions.push({ x: -1.98, z: fz, rotY: 2.62 });
    }
    const buildFarThinPart = (protoMesh, mat, localY, group = RENDER_GROUPS.ENVIRONMENT) => {
      protoMesh.material = mat;
      protoMesh.parent = root;
      protoMesh.renderingGroupId = group;
      protoMesh.isPickable = false;
      protoMesh.alwaysSelectAsActiveMesh = true;
      const buf = new Float32Array(farPositions.length * 16);
      const m = new B.Matrix();
      const sVec = B.Vector3.One();
      farPositions.forEach((fp, idx) => {
        const q = B.Quaternion.FromEulerAngles(0, fp.rotY, 0);
        B.Matrix.ComposeToRef(sVec, q, new B.Vector3(fp.x, 0.05 + localY, fp.z), m);
        m.copyToArray(buf, idx * 16);
      });
      protoMesh.thinInstanceSetBuffer('matrix', buf, 16, true);
      this._subMeshes['S0B-1'].push(protoMesh);
      return protoMesh;
    };

    const farBase = B.MeshBuilder.CreateBox('p1_s0b1_far_base', { width: 0.96, height: 0.48, depth: 2.18 }, scene);
    buildFarThinPart(farBase, this._s0b1ArchRibMat, 0.24);

    const farCradle = B.MeshBuilder.CreateBox('p1_s0b1_far_cradle', { width: 0.9, height: 0.26, depth: 2.08 }, scene);
    buildFarThinPart(farCradle, this._s0b1PlinthAlloyMat, 0.56);

    const farDome = B.MeshBuilder.CreateCylinder(
      'p1_s0b1_far_dome',
      { diameter: 0.84, height: 1.84, tessellation: 14, arc: 0.5 },
      scene
    );
    // Half-cylinder arc lies in -Z; RotationX(+pi/2) arches it cleanly upward (+Y) along Z
    farDome.bakeTransformIntoVertices(B.Matrix.RotationX(Math.PI * 0.5));
    buildFarThinPart(farDome, mats.cryoFrostedGlass, 0.68, RENDER_GROUPS.PUZZLE_AND_GHOSTS);

    const farLed = B.MeshBuilder.CreateBox('p1_s0b1_far_led', { width: 0.98, height: 0.08, depth: 1.9 }, scene);
    buildFarThinPart(farLed, mats.emissiveIceBlue, 0.58);

    // 5) 3 Descending Volumetric Overhead Cryogenic Light Shafts (Ghost-safe additive)
    const shaftSpecs = [
      { pos: [1.05, 1.9, 5.1], w: 2.4, h: 3.35, ry: -0.35, rz: 0.16 },
      { pos: [-0.35, 1.95, 9.6], w: 2.9, h: 3.4, ry: 0.12, rz: -0.08 },
      { pos: [0.1, 1.95, 16.5], w: 3.4, h: 3.45, ry: 0.0, rz: 0.04 },
    ];
    shaftSpecs.forEach((sp, idx) => {
      const plane = B.MeshBuilder.CreatePlane(`p1_s0b1_shaft_${idx}`, { width: sp.w, height: sp.h }, scene);
      plane.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      plane.rotation.y = sp.ry;
      plane.rotation.z = sp.rz;
      plane.material = this._cryoShaftMat;
      plane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      plane.isPickable = false;
      plane.parent = root;
      this._subMeshes['S0B-1'].push(plane);
    });

    // 6) Strong Sculpted Corridor Illumination (enabled ONLY during S0B-1):
    //    4 cool-silver/ice-blue vault ceiling lights + dedicated warm-silver hero rim light on Pod `08 号`
    const vaultLightSpecs = [
      { id: 0, pos: [0.0, 3.05, 2.2], intensity: 3.6 },
      { id: 1, pos: [0.0, 3.05, 7.6], intensity: 4.2 },
      { id: 2, pos: [0.0, 3.05, 14.4], intensity: 3.8 },
      { id: 3, pos: [0.0, 3.05, 21.8], intensity: 3.4 },
    ];
    for (const ls of vaultLightSpecs) {
      const vl = new B.PointLight(`p1_s0b1_vault_light_${ls.id}`, new B.Vector3(ls.pos[0], ls.pos[1], ls.pos[2]), scene);
      vl.diffuse = B.Color3.FromHexString('#C8E4FF');
      vl.specular = B.Color3.FromHexString('#F0F8FF');
      vl.intensity = ls.intensity;
      vl.range = 18.0;
      vl.parent = root;
      this._ownedLights.push(vl);
      this._subLights['S0B-1'].push(vl);
    }

    const heroLight = new B.PointLight('p1_s0b1_hero_light', new B.Vector3(0.2, 2.3, 4.0), scene);
    heroLight.diffuse = B.Color3.FromHexString('#F2EEE6');
    heroLight.specular = B.Color3.FromHexString('#FFFDF8');
    heroLight.intensity = 3.8;
    heroLight.range = 14.0;
    heroLight.parent = root;

    this._s0b1HeroLight = heroLight;
    this._ownedLights.push(heroLight);
    this._subLights['S0B-1'].push(heroLight);

    // 7) Delicate Cryogenic Vapor Mist + Shimmering Frost Motes ParticleSystems
    const mistPs = new B.ParticleSystem('p1_s0b1_cryo_mist_ps', 200, scene);
    mistPs.particleTexture = this._cryoMistTex;
    mistPs.emitter = new B.Vector3(0.65, 0.58, 5.25);
    mistPs.minEmitBox = new B.Vector3(-2.35, -0.4, -2.4);
    mistPs.maxEmitBox = new B.Vector3(1.55, 0.45, 5.4);
    mistPs.color1 = new B.Color4(0.76, 0.92, 1.0, 0.24);
    mistPs.color2 = new B.Color4(0.45, 0.78, 0.98, 0.16);
    mistPs.colorDead = new B.Color4(0.35, 0.65, 0.92, 0.0);
    mistPs.minSize = 0.42;
    mistPs.maxSize = 1.15;
    mistPs.minLifeTime = 2.6;
    mistPs.maxLifeTime = 5.4;
    mistPs.emitRate = 48;
    mistPs.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
    mistPs.gravity = new B.Vector3(0, -0.035, 0);
    mistPs.direction1 = new B.Vector3(-0.22, 0.02, -0.18);
    mistPs.direction2 = new B.Vector3(0.14, 0.14, 0.18);
    mistPs.minEmitPower = 0.08;
    mistPs.maxEmitPower = 0.28;
    mistPs.updateSpeed = 0.015;
    mistPs.preWarmStepOffset = 3;
    mistPs.preventAutoStart = true;
    mistPs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this._s0b1MistPs = mistPs;

    const frostPs = new B.ParticleSystem('p1_s0b1_frost_motes_ps', 120, scene);
    frostPs.particleTexture = this._softGlowTex;
    frostPs.emitter = new B.Vector3(0.4, 1.35, 6.2);
    frostPs.minEmitBox = new B.Vector3(-2.2, -0.95, -4.2);
    frostPs.maxEmitBox = new B.Vector3(2.2, 1.45, 8.5);
    frostPs.color1 = new B.Color4(0.84, 0.96, 1.0, 0.68);
    frostPs.color2 = new B.Color4(0.38, 0.76, 1.0, 0.46);
    frostPs.colorDead = new B.Color4(0.35, 0.68, 1.0, 0.0);
    frostPs.minSize = 0.018;
    frostPs.maxSize = 0.052;
    frostPs.minLifeTime = 2.8;
    frostPs.maxLifeTime = 5.8;
    frostPs.emitRate = 28;
    frostPs.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    frostPs.gravity = new B.Vector3(0, -0.012, 0);
    frostPs.direction1 = new B.Vector3(-0.08, -0.02, -0.08);
    frostPs.direction2 = new B.Vector3(0.08, 0.06, 0.08);
    frostPs.minEmitPower = 0.04;
    frostPs.maxEmitPower = 0.16;
    frostPs.updateSpeed = 0.015;
    frostPs.preWarmStepOffset = 3;
    frostPs.preventAutoStart = true;
    frostPs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;

    this._particleSystems.push(mistPs, frostPs);
    this._subParticles['S0B-1'].push(mistPs, frostPs);
  }

  // -------------------------------------------------------------------------
  // SUB-SCENE 3: S0B-2 (15.0 – 22.0s) — Flagship「远航者号」+ 4 Escorts 7th FTL Warp
  // -------------------------------------------------------------------------

  _buildS0B2() {
    const B = this.B;
    const scene = this.scene;
    const mats = this.materials;
    const root = new B.TransformNode('p1_s0b2_root', scene);
    root.parent = this.root;
    this._subRoots['S0B-2'] = root;

    // 1) Deep-Space Starfield & Lush Sapphire-Gold Volumetric Nebula Backdrop
    const rng = createSeededRng(0x77b2f001);
    const bgCoolStars = buildThinStarCluster(scene, 'p1_s0b2_stars_cool', root, 260, this._starCoolMat, rng, () => {
      const z = 55 + rng() * 190;
      const x = (rng() * 2 - 1) * z * 1.15 + 14;
      const y = (rng() * 2 - 1) * z * 0.65;
      const size = 0.14 + Math.pow(rng(), 2.1) * 0.36;
      return { x, y, z, size };
    });
    const bgWarmStars = buildThinStarCluster(scene, 'p1_s0b2_stars_warm', root, 100, this._starWarmMat, rng, () => {
      const z = 60 + rng() * 185;
      const x = (rng() * 2 - 1) * z * 1.1 + 14;
      const y = (rng() * 2 - 1) * z * 0.62;
      const size = 0.14 + Math.pow(rng(), 2.0) * 0.34;
      return { x, y, z, size };
    });
    this._subMeshes['S0B-2'].push(bgCoolStars, bgWarmStars);

    this._s0b2Nebulae = [];
    const nebConfigs = [
      { pos: [26, 6, 102], w: 145, h: 78, ry: -0.35, rz: 0.18, colorA: '#0D2F5E', colorB: '#1E6F8C', colorGold: '#9E7128', baseOpacity: 0.34, seed: 2.2 },
      { pos: [6, -12, 132], w: 175, h: 92, ry: -0.24, rz: -0.14, colorA: '#091E42', colorB: '#195474', colorGold: '#876024', baseOpacity: 0.28, seed: 4.9 },
      { pos: [48, 18, 158], w: 190, h: 100, ry: -0.4, rz: 0.09, colorA: '#102A54', colorB: '#287D90', colorGold: '#C49238', baseOpacity: 0.24, seed: 7.3 },
    ];
    nebConfigs.forEach((cfg, idx) => {
      const mat = this._makeNebulaMaterial(`p1_s0b2_neb_mat_${idx}`, {
        colorA: cfg.colorA,
        colorB: cfg.colorB,
        colorGold: cfg.colorGold,
        opacity: cfg.baseOpacity,
        seed: cfg.seed,
      });
      const plane = B.MeshBuilder.CreatePlane(`p1_s0b2_nebula_${idx}`, { width: cfg.w, height: cfg.h }, scene);
      plane.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      plane.rotation.y = cfg.ry;
      plane.rotation.z = cfg.rz;
      plane.material = mat;
      plane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      plane.isPickable = false;
      plane.parent = root;
      this._s0b2Nebulae.push({ mesh: plane, mat, baseOpacity: cfg.baseOpacity });
      this._subMeshes['S0B-2'].push(plane);
    });

    // 2) Hero Fleet Root: Flagship「远航者号」+ 4 Escort Vessels in Majestic 3D Chevron V-Formation
    const fleetRoot = new B.TransformNode('p1_s0b2_fleet_root', scene);
    fleetRoot.parent = root;
    this._fleetRoot = fleetRoot;

    this._flagship = createFlagshipVoyager(scene, mats, 'p1_voyager');
    this._flagship.root.parent = fleetRoot;
    this._flagship.root.position.set(0, 0.25, 0);
    this._flagship.root.scaling.setAll(1.14);
    this._heroDisposables.push(this._flagship);
    for (const cm of this._flagship.root.getChildMeshes()) {
      cm.isPickable = false;
      this._subMeshes['S0B-2'].push(cm);
    }

    // Glowing plasma field aura nested inside the flagship's dual warp rings
    const warpCoreAura = B.MeshBuilder.CreateTorus(
      'p1_s0b2_warp_core_aura',
      { diameter: 5.8, thickness: 0.95, tessellation: 40 },
      scene
    );
    warpCoreAura.rotation.x = Math.PI * 0.5;
    warpCoreAura.position.set(0, 0.25, -2.55);
    warpCoreAura.material = this._warpCoreAuraMat;
    warpCoreAura.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    warpCoreAura.isPickable = false;
    warpCoreAura.parent = fleetRoot;
    this._warpCoreAura = warpCoreAura;
    this._subMeshes['S0B-2'].push(warpCoreAura);

    // 4 Escort Vessels arranged in crisp 3D chevron with zero hull overlap from port-dorsal camera
    const escortConfigs = [
      { id: 'port_high', basePos: [-7.2, 2.6, -1.5], scale: 0.54, lagFactor: 2.4, phase: 0.4 },
      { id: 'port_low', basePos: [-4.8, -3.1, -4.5], scale: 0.56, lagFactor: 3.4, phase: 1.5 },
      { id: 'stbd_inner', basePos: [7.8, 2.2, -2.8], scale: 0.54, lagFactor: 2.9, phase: 2.7 },
      { id: 'stbd_outer', basePos: [13.5, -1.4, -7.2], scale: 0.48, lagFactor: 4.5, phase: 3.9 },
    ];
    this._escorts = escortConfigs.map((cfg) => {
      const ship = createEscortVessel(scene, mats, `p1_escort_${cfg.id}`, cfg.scale);
      ship.root.parent = fleetRoot;
      ship.root.position.set(cfg.basePos[0], cfg.basePos[1], cfg.basePos[2]);
      this._heroDisposables.push(ship);
      for (const cm of ship.root.getChildMeshes()) {
        cm.isPickable = false;
        this._subMeshes['S0B-2'].push(cm);
      }
      return { ship, cfg };
    });

    // 3) 5 Phased Expanding Concentric Cyan-Gold Curvature Shockwave Rings
    this._shockwaves = [];
    for (let i = 0; i < 5; i += 1) {
      const mat = this._makeShockwaveMaterial(`p1_s0b2_shock_mat_${i}`);
      const disc = B.MeshBuilder.CreatePlane(`p1_s0b2_shockwave_${i}`, { size: 1.0 }, scene);
      disc.material = mat;
      disc.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      disc.isPickable = false;
      disc.parent = root;
      this._shockwaves.push({ mesh: disc, mat, index: i });
      this._subMeshes['S0B-2'].push(disc);
    }

    // 4) Custom GLSL Cylindrical Superluminal Warp Tunnel Envelope
    this._warpTunnelMat = this._trackMat(
      new B.ShaderMaterial(
        'p1_s0b2_warp_tunnel_shader',
        scene,
        { vertex: 'p1WarpTunnel', fragment: 'p1WarpTunnel' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'uScroll', 'uIntensity', 'uTime'],
          needAlphaBlending: true,
        }
      ),
      true
    );
    this._warpTunnelMat.setFloat('uScroll', 0);
    this._warpTunnelMat.setFloat('uIntensity', 0);
    this._warpTunnelMat.setFloat('uTime', 0);
    this._warpTunnelMat.alpha = 0.48;
    this._warpTunnelMat.alphaMode = B.Engine.ALPHA_ADD;
    this._warpTunnelMat.backFaceCulling = false;

    const tunnel = buildOpenWarpTunnelMesh(scene, 'p1_s0b2_warp_tunnel', {
      zStart: -38.0,
      zEnd: 92.0,
      radiusStart: 28.0,
      radiusEnd: 15.0,
      tessellation: 48,
      rings: 8,
    });
    tunnel.position.set(0, 0.35, 0);
    tunnel.material = this._warpTunnelMat;
    tunnel.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    tunnel.isPickable = false;
    tunnel.parent = root;
    this._warpTunnelMesh = tunnel;
    this._subMeshes['S0B-2'].push(tunnel);

    // 5) 220 Thin-Instanced 3D Radial Superluminal Star-Stream Streaks (150 Cyan + 70 Gold)
    const buildStreakPool = (name, count, mat, seedOffset) => {
      const sRng = createSeededRng(0x9a20b000 + seedOffset);
      const mesh = B.MeshBuilder.CreateBox(name, { width: 0.085, height: 0.085, depth: 1.0 }, scene);
      mesh.material = mat;
      mesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.parent = root;

      const seeds = [];
      for (let i = 0; i < count; i += 1) {
        const angle = sRng() * Math.PI * 2;
        // Keep clean 7.2m radius tunnel around flagship hull so zero streaks clip through ships
        const radius = 7.2 + Math.pow(sRng(), 0.75) * 23.0;
        seeds.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius * 0.76 + 0.3,
          z0: sRng() * 124.0,
          speedMul: 0.78 + sRng() * 0.65,
          thickness: 0.65 + sRng() * 1.15,
          lengthMul: 0.65 + sRng() * 0.9,
        });
      }
      const matrices = new Float32Array(count * 16);
      this._subMeshes['S0B-2'].push(mesh);
      return { mesh, seeds, matrices };
    };

    this._streakCyanPool = buildStreakPool('p1_s0b2_streaks_cyan', 150, this._streakCyanMat, 11);
    this._streakGoldPool = buildStreakPool('p1_s0b2_streaks_gold', 70, this._streakGoldMat, 47);

    // 6) Dedicated Local Fleet Rim, Gold Key & Blazing Warp Core Lights (enabled ONLY during S0B-2)
    const warpCoreLight = new B.PointLight('p1_s0b2_warp_light', new B.Vector3(0, 0.5, -2.4), scene);
    warpCoreLight.diffuse = B.Color3.FromHexString('#52EFE0');
    warpCoreLight.specular = B.Color3.FromHexString('#CCFDF8');
    warpCoreLight.intensity = 3.2;
    warpCoreLight.range = 46.0;
    warpCoreLight.parent = root;

    const goldKeyLight = new B.PointLight('p1_s0b2_gold_key', new B.Vector3(16, 8.5, 14), scene);
    goldKeyLight.diffuse = B.Color3.FromHexString('#FFD684');
    goldKeyLight.specular = B.Color3.FromHexString('#FFF0CC');
    goldKeyLight.intensity = 2.9;
    goldKeyLight.range = 72.0;
    goldKeyLight.parent = root;

    const rimFillLight = new B.PointLight('p1_s0b2_rim_fill', new B.Vector3(-12, -4.5, 6), scene);
    rimFillLight.diffuse = B.Color3.FromHexString('#6CB8FF');
    rimFillLight.specular = B.Color3.FromHexString('#A8D8FF');
    rimFillLight.intensity = 1.65;
    rimFillLight.range = 54.0;
    rimFillLight.parent = root;

    this._s0b2WarpLight = warpCoreLight;
    this._s0b2GoldKey = goldKeyLight;
    this._s0b2RimFill = rimFillLight;
    this._ownedLights.push(warpCoreLight, goldKeyLight, rimFillLight);
    this._subLights['S0B-2'].push(warpCoreLight, goldKeyLight, rimFillLight);

    // 7) Dual Blazing GPU Warp ParticleSystems (BLENDMODE_ADD)
    const warpStreamPs = new B.ParticleSystem('p1_s0b2_warp_stream_ps', 280, scene);
    warpStreamPs.particleTexture = this._softGlowTex;
    warpStreamPs.emitter = new B.Vector3(0, 0.4, 38);
    warpStreamPs.minEmitBox = new B.Vector3(-22, -14, -8);
    warpStreamPs.maxEmitBox = new B.Vector3(22, 14, 18);
    warpStreamPs.color1 = new B.Color4(0.45, 0.96, 0.92, 0.88);
    warpStreamPs.color2 = new B.Color4(1.0, 0.82, 0.36, 0.72);
    warpStreamPs.colorDead = new B.Color4(0.25, 0.72, 0.95, 0.0);
    warpStreamPs.minSize = 0.14;
    warpStreamPs.maxSize = 0.44;
    warpStreamPs.minLifeTime = 1.1;
    warpStreamPs.maxLifeTime = 2.3;
    warpStreamPs.emitRate = 92;
    warpStreamPs.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    warpStreamPs.direction1 = new B.Vector3(-0.35, -0.25, -28);
    warpStreamPs.direction2 = new B.Vector3(0.35, 0.25, -42);
    warpStreamPs.minEmitPower = 1.0;
    warpStreamPs.maxEmitPower = 1.9;
    warpStreamPs.updateSpeed = 0.016;
    warpStreamPs.preWarmStepOffset = 2;
    warpStreamPs.preventAutoStart = true;
    warpStreamPs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this._s0b2WarpStreamPs = warpStreamPs;

    const wakePs = new B.ParticleSystem('p1_s0b2_fleet_wake_ps', 160, scene);
    wakePs.particleTexture = this._softGlowTex;
    wakePs.emitter = new B.Vector3(0, 0.25, -6.5);
    wakePs.minEmitBox = new B.Vector3(-3.2, -2.2, -1.5);
    wakePs.maxEmitBox = new B.Vector3(3.2, 2.2, 1.5);
    wakePs.color1 = new B.Color4(1.0, 0.90, 0.52, 0.92);
    wakePs.color2 = new B.Color4(0.32, 0.94, 0.88, 0.76);
    wakePs.colorDead = new B.Color4(0.22, 0.62, 0.92, 0.0);
    wakePs.minSize = 0.12;
    wakePs.maxSize = 0.38;
    wakePs.minLifeTime = 0.9;
    wakePs.maxLifeTime = 1.9;
    wakePs.emitRate = 68;
    wakePs.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    wakePs.direction1 = new B.Vector3(-0.6, -0.5, -16);
    wakePs.direction2 = new B.Vector3(0.6, 0.5, -26);
    wakePs.minEmitPower = 0.9;
    wakePs.maxEmitPower = 1.7;
    wakePs.updateSpeed = 0.016;
    wakePs.preWarmStepOffset = 2;
    wakePs.preventAutoStart = true;
    wakePs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this._s0b2WakePs = wakePs;

    this._particleSystems.push(warpStreamPs, wakePs);
    this._subParticles['S0B-2'].push(warpStreamPs, wakePs);
  }

  // -------------------------------------------------------------------------
  // SUB-SCENE 4: S0C (22.0 – 26.0s) — 47-Year Deep-Space Void Coordinate Card
  // -------------------------------------------------------------------------

  _buildS0C() {
    const B = this.B;
    const scene = this.scene;
    const root = new B.TransformNode('p1_s0c_root', scene);
    root.parent = this.root;
    this._subRoots.S0C = root;

    const rng = createSeededRng(0x47412c00);

    // Vast serene Sagittarius-arm outer void starfield (biased slightly outward for clean coordinate-card legibility)
    const voidCool = buildThinStarCluster(scene, 'p1_s0c_stars_cool', root, 210, this._starVoidMat, rng, () => {
      const z = 28 + rng() * 105;
      const x = (rng() * 2 - 1) * z * 0.86;
      const y = (rng() * 2 - 1) * z * 0.45;
      const inCardZone = Math.abs(x / z) < 0.34 && Math.abs(y / z) < 0.15;
      const size = (0.06 + Math.pow(rng(), 2.2) * 0.17) * (inCardZone ? 0.42 : 1.0);
      return { x, y, z, size };
    });
    const voidWarm = buildThinStarCluster(scene, 'p1_s0c_stars_warm', root, 65, this._starWarmMat, rng, () => {
      const z = 34 + rng() * 102;
      const x = (rng() * 2 - 1) * z * 0.84;
      const y = (rng() * 2 - 1) * z * 0.44;
      const inCardZone = Math.abs(x / z) < 0.34 && Math.abs(y / z) < 0.15;
      const size = (0.06 + Math.pow(rng(), 2.2) * 0.15) * (inCardZone ? 0.4 : 1.0);
      return { x, y, z, size };
    });
    this._subMeshes.S0C.push(voidCool, voidWarm);

    // Subtle cool sapphire-indigo rim haze planes framing the vast void
    this._s0cNebulae = [];
    const voidNebSpecs = [
      { pos: [-22, -6, 74], w: 84, h: 42, rz: 0.22, colorA: '#091F42', colorB: '#154462', colorGold: '#38301E', baseOpacity: 0.13, seed: 8.1 },
      { pos: [24, 7, 96], w: 96, h: 46, rz: -0.18, colorA: '#071834', colorB: '#123A56', colorGold: '#342A1B', baseOpacity: 0.10, seed: 11.4 },
    ];
    voidNebSpecs.forEach((sp, idx) => {
      const mat = this._makeNebulaMaterial(`p1_s0c_neb_mat_${idx}`, {
        colorA: sp.colorA,
        colorB: sp.colorB,
        colorGold: sp.colorGold,
        opacity: sp.baseOpacity,
        seed: sp.seed,
      });
      const plane = B.MeshBuilder.CreatePlane(`p1_s0c_nebula_${idx}`, { width: sp.w, height: sp.h }, scene);
      plane.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      plane.rotation.z = sp.rz;
      plane.material = mat;
      plane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      plane.isPickable = false;
      plane.parent = root;
      this._s0cNebulae.push({ mesh: plane, mat, baseOpacity: sp.baseOpacity });
      this._subMeshes.S0C.push(plane);
    });

    // Fleeting warp exit afterglow ring dissolving over 22.0 – 22.8s
    this._s0cAfterglowMat = this._makeShockwaveMaterial('p1_s0c_afterglow_mat');
    const afterglow = B.MeshBuilder.CreatePlane('p1_s0c_afterglow', { size: 14.0 }, scene);
    afterglow.position.set(0, 0.15, 44.0);
    afterglow.material = this._s0cAfterglowMat;
    afterglow.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    afterglow.isPickable = false;
    afterglow.parent = root;
    this._s0cAfterglow = afterglow;
    this._subMeshes.S0C.push(afterglow);

    // Subtle distant pinpoint fleet glint off in the vast outer void (lower-right, clear of coordinate card)
    const distantGlint = B.MeshBuilder.CreateSphere('p1_s0c_distant_glint', { diameter: 0.34, segments: 8 }, scene);
    distantGlint.position.set(17.5, -4.5, 68.0);
    distantGlint.material = this._starWarmMat;
    distantGlint.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    distantGlint.isPickable = false;
    distantGlint.parent = root;
    this._subMeshes.S0C.push(distantGlint);

    // Whisper-slow deep-space starlight dust ParticleSystem
    const voidDustPs = new B.ParticleSystem('p1_s0c_void_dust_ps', 150, scene);
    voidDustPs.particleTexture = this._softGlowTex;
    voidDustPs.emitter = new B.Vector3(0, 0, 16);
    voidDustPs.minEmitBox = new B.Vector3(-22, -10, -16);
    voidDustPs.maxEmitBox = new B.Vector3(22, 10, 32);
    voidDustPs.color1 = new B.Color4(0.82, 0.92, 1.0, 0.34);
    voidDustPs.color2 = new B.Color4(0.38, 0.68, 0.94, 0.24);
    voidDustPs.colorDead = new B.Color4(0.24, 0.48, 0.78, 0.0);
    voidDustPs.minSize = 0.04;
    voidDustPs.maxSize = 0.12;
    voidDustPs.minLifeTime = 4.5;
    voidDustPs.maxLifeTime = 9.0;
    voidDustPs.emitRate = 24;
    voidDustPs.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    voidDustPs.gravity = new B.Vector3(0, 0, 0);
    voidDustPs.direction1 = new B.Vector3(-0.04, -0.02, -0.1);
    voidDustPs.direction2 = new B.Vector3(0.04, 0.03, -0.02);
    voidDustPs.minEmitPower = 0.04;
    voidDustPs.maxEmitPower = 0.14;
    voidDustPs.updateSpeed = 0.014;
    voidDustPs.preWarmStepOffset = 3;
    voidDustPs.preventAutoStart = true;
    voidDustPs.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this._particleSystems.push(voidDustPs);
    this._subParticles.S0C.push(voidDustPs);
  }

  // -------------------------------------------------------------------------
  // Sub-Scene Isolation & Lifecycle (Contract D)
  // -------------------------------------------------------------------------

  _stopAllParticles() {
    for (const ps of this._particleSystems) {
      if (!ps) continue;
      ps.stop();
      if (typeof ps.reset === 'function') {
        ps.reset();
      }
    }
  }

  _warmParticleSystems(systems, ticks) {
    const steps = clamp(Math.round(Number.isFinite(ticks) ? ticks : 0), 0, 90);
    for (const ps of systems) {
      if (!ps) continue;
      // Unconditionally call start() because Babylon 9 stop() clears emission via _stopped while keeping isStarted() true
      ps.start();
      if (steps > 0 && typeof ps.animate === 'function') {
        for (let i = 0; i < steps; i += 1) {
          ps.animate(true);
        }
      }
    }
  }

  _activateSubScene(nextKey) {
    if (this._activeSubScene === nextKey && this.root.isEnabled()) {
      return;
    }

    const keys = ['S0A', 'S0B-1', 'S0B-2', 'S0C'];
    for (const key of keys) {
      const enabled = this.active && key === nextKey;
      const subRoot = this._subRoots[key];
      if (subRoot) subRoot.setEnabled(enabled);

      for (const light of this._subLights[key]) {
        light.setEnabled(enabled);
      }

      if (!enabled) {
        for (const ps of this._subParticles[key]) {
          ps.stop();
          if (typeof ps.reset === 'function') ps.reset();
        }
      }
    }

    this._activeSubScene = this.active ? nextKey : null;

    if (this.active && nextKey && this._subParticles[nextKey]) {
      const warmTicks = Math.max(14, this._pendingPrewarmTicks);
      this._pendingPrewarmTicks = 0;
      for (const ps of this._subParticles[nextKey]) {
        if (typeof ps.reset === 'function') ps.reset();
      }
      this._warmParticleSystems(this._subParticles[nextKey], warmTicks);
    }
  }

  _resolveSubSceneKey(snapshot) {
    const sub = snapshot?.subBeatId;
    if (sub === 'S0A' || sub === 'S0B-1' || sub === 'S0B-2' || sub === 'S0C') {
      return sub;
    }
    const t = Number.isFinite(snapshot?.elapsedSec) ? snapshot.elapsedSec : 0;
    if (t < 11.0) return 'S0A';
    if (t < 15.0) return 'S0B-1';
    if (t < 22.0) return 'S0B-2';
    return 'S0C';
  }

  setActive(active) {
    const next = Boolean(active);
    this.active = next;
    this.root.setEnabled(next);

    if (!next) {
      for (const key of ['S0A', 'S0B-1', 'S0B-2', 'S0C']) {
        if (this._subRoots[key]) this._subRoots[key].setEnabled(false);
        for (const light of this._subLights[key]) light.setEnabled(false);
      }
      this._stopAllParticles();
      this._activeSubScene = null;
    }
  }

  prewarmParticles(ticks = 18) {
    const safeTicks = clamp(Math.round(Number.isFinite(ticks) ? ticks : 18), 1, 90);
    if (!this.active || !this._activeSubScene) {
      this._pendingPrewarmTicks = safeTicks;
      return;
    }
    const systems = this._subParticles[this._activeSubScene] || [];
    for (const ps of systems) {
      if (typeof ps.reset === 'function') ps.reset();
    }
    this._warmParticleSystems(systems, safeTicks);
  }

  // -------------------------------------------------------------------------
  // Purely Deterministic Per-Frame Evaluation from `snapshot.elapsedSec`
  // -------------------------------------------------------------------------

  evaluate(snapshot, _dtSec = 0) {
    if (!snapshot) return;
    if (!this.active) return;

    const t = clamp(Number.isFinite(snapshot.elapsedSec) ? snapshot.elapsedSec : 0, 0, 26.0);
    const key = this._resolveSubSceneKey(snapshot);
    this._activateSubScene(key);

    if (key === 'S0A') {
      this._evaluateS0A(t);
    } else if (key === 'S0B-1') {
      this._evaluateS0B1(t);
    } else if (key === 'S0B-2') {
      this._evaluateS0B2(t);
    } else if (key === 'S0C') {
      this._evaluateS0C(t);
    }
  }

  _evaluateS0A(t) {
    const fadeIn = smoothstep(0.0, 1.2, t);
    const fadeOut = 1.0 - smoothstep(10.2, 11.0, t);
    const envelope = fadeIn * fadeOut;

    for (const item of this._s0aNebulae) {
      item.mat.setFloat('uTime', t);
      item.mat.setFloat('uOpacity', item.baseOpacity * envelope);
    }

    // Subtle cosmic rotation parallax so distant stars feel alive without distracting titles
    const driftRoll = t * 0.0045;
    for (const starMesh of this._s0aStarGroup) {
      starMesh.rotation.z = driftRoll;
    }
  }

  _evaluateS0B1(t) {
    const localU = clamp((t - 11.0) / 4.0, 0, 1);

    // Animate all 8 CryoPod units deterministically: staggered sealing cascade + Hero `08 号` focal seal
    for (const { unit, spec } of this._cryoPods) {
      const closeProgress = easeInOutCubic(smoothstep(spec.closeStart, spec.closeEnd, t));
      const openAmount = (spec.hero ? 0.88 : 0.72) * (1.0 - closeProgress);
      const sealPulse = spec.hero
        ? 0.25 + 0.55 * (0.5 + 0.5 * Math.sin((t - 11.0) * 3.8)) + 0.35 * smoothstep(13.9, 14.4, t)
        : 0.18 + 0.24 * (0.5 + 0.5 * Math.sin((t - 11.0) * 2.6 + spec.pos[2]));

      unit.setStatus({
        mode: 'sleeping',
        openAmount,
        alertPulse: clamp(sealPulse, 0, 1),
        title: spec.code,
        subtitle: spec.hero && t >= 14.2 ? '冬眠封存 · LOCK' : '低温封存',
        accentHex: '#58A6FF',
      });
    }

    // Hero `08 号` under-glow & overhead volumetric light shafts breathe gently with the sealing latch
    const heroBreath = 0.82 + 0.18 * Math.sin((t - 11.0) * 3.4);
    this._cryoAuraMat.alpha = 0.22 + 0.14 * heroBreath;
    this._hero08Aura.scaling.setAll(0.96 + 0.08 * heroBreath);

    this._cryoShaftMat.setFloat('uTime', t);
    this._cryoShaftMat.setFloat('uOpacity', 0.14 + 0.04 * heroBreath);

    // Subtle warm-silver hero rim swell as Hero `08 号` canopy locks home
    this._s0b1HeroLight.intensity = 3.7 + 0.45 * smoothstep(12.2, 14.4, t) * heroBreath;

    // Cryo mist peaks while Hero `08 号` is closing and gently softens once locked
    this._s0b1MistPs.emitRate = lerp(56, 32, smoothstep(13.8, 14.9, t));
    this._s0b1MistPs.emitter.z = lerp(4.8, 5.4, localU);
  }

  _evaluateS0B2(t) {
    const B = this.B;
    const u = clamp((t - 15.0) / 7.0, 0, 1);
    const chargeU = smoothstep(15.0, 18.4, t);
    const surgeU = smoothstep(18.2, 21.3, t);
    const leapU = clamp((t - 21.15) / 0.85, 0, 1);

    // 1) Fleet deterministic forward trajectory aligned with camera target across KF-04 (17.5s) & KF-05 (20.2/20.8s)
    const fleetZ =
      lerp(-0.4, 3.1, chargeU) +
      7.4 * Math.pow(surgeU, 1.42) +
      44.0 * Math.pow(leapU, 2.3);
    const fleetRoll = Math.sin((t - 15.0) * 0.9) * 0.025 * (1.0 - leapU);

    this._fleetRoot.position.set(0, 0, fleetZ);
    this._fleetRoot.rotation.z = fleetRoll;

    // 2) Calibrated warp power climb: spins dual rings intensely & ignites crisp non-clipped thruster plumes
    const warpPower = clamp(0.42 + 0.42 * chargeU + 0.34 * easeOutExpo(surgeU), 0.35, 1.18);
    this._flagship.setWarpPower(warpPower, t);
    this._flagship.setAlertLevel(0, t);

    // Longitudinal relativistic stretch only during the final 0.85s flash leap
    const stretchZ = 1.0 + 1.65 * Math.pow(leapU, 1.9);
    this._flagship.root.scaling.set(1.14, 1.14, 1.14 * stretchZ);

    // Restrained dual-ring plasma core aura so flagship warp rings stay jewel-sharp without haze
    const auraPulse = 0.88 + 0.12 * Math.sin(t * 14.0);
    const auraScale = (0.94 + 0.18 * warpPower) * auraPulse;
    this._warpCoreAura.scaling.set(auraScale, auraScale, 0.85 + 0.45 * surgeU);
    this._warpCoreAuraMat.alpha = clamp((0.08 + 0.13 * warpPower) * (1.0 - smoothstep(21.4, 22.0, t)), 0, 0.24);

    // Update 4 Escort Vessels in dynamic 3D chevron
    for (const { ship, cfg } of this._escorts) {
      ship.setWarpPower(warpPower * 0.88, t + cfg.phase);
      const bobY = Math.sin(t * 1.4 + cfg.phase) * 0.14;
      const lagZ = -Math.pow(leapU, 1.8) * cfg.lagFactor * 4.0;
      ship.root.position.set(cfg.basePos[0], cfg.basePos[1] + bobY, cfg.basePos[2] + lagZ);
      ship.root.scaling.set(cfg.scale, cfg.scale, cfg.scale * (1.0 + 1.2 * Math.pow(leapU, 2.0)));
    }

    // Update shared thrusterPlume GLSL shader with crisp cyan-gold energy (zero solid-white blowout)
    if (typeof this.materials?.updateShaders === 'function') {
      this.materials.updateShaders(t, { thrusterPower: clamp(0.42 + warpPower * 0.44, 0.36, 0.94) });
    }

    // 3) 5 Phased Expanding Thin Jewel-Like Cyan-Gold Curvature Shockwave Arcs
    const shockEnvelope = smoothstep(15.1, 16.4, t) * (1.0 - smoothstep(21.45, 22.0, t));
    const shockBoost = lerp(0.72, 1.0, surgeU);
    for (const sw of this._shockwaves) {
      const phase = ((t - 15.0) * 0.56 + sw.index / this._shockwaves.length) % 1.0;
      const easedPhase = easeOutExpo(phase);
      const diameter = lerp(6.8, 33.5, easedPhase);
      const ringFade = smoothstep(0.0, 0.14, phase) * (1.0 - smoothstep(0.56, 1.0, phase));
      sw.mesh.position.set(0, 0.25, fleetZ - 2.6 - phase * 16.0);
      sw.mesh.scaling.set(diameter, diameter, 1.0);
      sw.mat.setFloat('uTime', t);
      sw.mat.setFloat('uPhase', phase);
      sw.mat.setFloat('uIntensity', shockEnvelope * shockBoost * ringFade);
    }

    // 4) Cylindrical Superluminal Warp Tunnel Shader (balanced brightness so fleet & streaks pop crisply)
    const tunnelScroll = (t - 15.0) * 1.45 + Math.pow(Math.max(0, t - 17.8), 1.75) * 0.85;
    const tunnelIntensity =
      (0.16 + 0.36 * smoothstep(15.6, 17.8, t) + 0.40 * smoothstep(18.2, 20.6, t)) *
      (1.0 - smoothstep(21.55, 22.0, t));
    this._warpTunnelMat.setFloat('uScroll', tunnelScroll);
    this._warpTunnelMat.setFloat('uIntensity', clamp(tunnelIntensity, 0, 0.92));
    this._warpTunnelMat.setFloat('uTime', t);
    this._warpTunnelMesh.rotation.z = (t - 15.0) * 0.08;

    // 5) 220 Thin-Instanced 3D Radial Superluminal Star-Stream Streaks (Purely Deterministic!)
    const streakLen = lerp(0.9, 6.2, chargeU) + 15.5 * easeInOutCubic(surgeU);
    const travelDist = (t - 15.0) * 18.0 + Math.pow(Math.max(0, t - 17.6), 2.15) * 26.0;
    const streakFade = 1.0 - smoothstep(21.5, 22.0, t);
    this._streakCyanMat.alpha = (0.34 + 0.46 * smoothstep(15.4, 20.2, t)) * streakFade;
    this._streakGoldMat.alpha = (0.28 + 0.44 * smoothstep(16.0, 20.4, t)) * streakFade;

    const qId = B.Quaternion.Identity();
    const tmpM = new B.Matrix();
    const sVec = new B.Vector3();
    const pVec = new B.Vector3();
    const updateStreakPool = (pool) => {
      const { mesh, seeds, matrices } = pool;
      for (let i = 0; i < seeds.length; i += 1) {
        const s = seeds[i];
        const rawZ = s.z0 - travelDist * s.speedMul;
        const wrappedZ = (((rawZ % 124.0) + 124.0) % 124.0) - 34.0;
        const len = Math.max(0.5, streakLen * s.lengthMul);
        const thick = s.thickness * (0.85 + 0.35 * surgeU);
        sVec.set(thick, thick, len);
        pVec.set(s.x, s.y, wrappedZ);
        B.Matrix.ComposeToRef(sVec, qId, pVec, tmpM);
        tmpM.copyToArray(matrices, i * 16);
      }
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    };
    updateStreakPool(this._streakCyanPool);
    updateStreakPool(this._streakGoldPool);

    // 6) Deep-Space Nebula Backdrop & Local Fleet Lights
    for (const neb of this._s0b2Nebulae) {
      neb.mat.setFloat('uTime', t);
      neb.mat.setFloat('uOpacity', neb.baseOpacity * (1.0 - 0.32 * surgeU));
    }

    this._s0b2WarpLight.position.set(0, 0.55, fleetZ - 2.4);
    this._s0b2WarpLight.intensity = (2.6 + warpPower * 2.1) * (1.0 - 0.5 * leapU);
    this._s0b2GoldKey.position.set(16, 8.5, fleetZ + 12);
    this._s0b2RimFill.position.set(-12, -4.5, fleetZ + 6);

    // 7) Dynamic Particle Emitters track flagship & ramp into warp peak
    this._s0b2WarpStreamPs.emitRate = lerp(65, 165, easeInOutCubic(u));
    this._s0b2WakePs.emitter.set(0, 0.25, fleetZ - 6.6);
    this._s0b2WakePs.emitRate = lerp(52, 130, clamp(warpPower / 1.4, 0, 1));
  }

  _evaluateS0C(t) {
    const fadeIn = smoothstep(22.0, 22.7, t);
    const fadeOut = 1.0 - smoothstep(25.3, 26.0, t);
    const nebEnv = (0.75 + 0.25 * fadeIn) * (0.35 + 0.65 * fadeOut);

    for (const item of this._s0cNebulae) {
      item.mat.setFloat('uTime', t);
      item.mat.setFloat('uOpacity', item.baseOpacity * nebEnv);
    }

    // Subtle fleeting cyan-platinum warp exit afterglow settling cleanly over 22.0 – 22.9s
    const afterglowU = clamp((t - 22.0) / 0.9, 0, 1);
    const afterglowAlpha = (1.0 - easeOutExpo(afterglowU)) * 0.45;
    this._s0cAfterglow.isVisible = afterglowAlpha > 0.005;
    this._s0cAfterglow.scaling.setAll(lerp(1.4, 0.45, afterglowU));
    this._s0cAfterglowMat.setFloat('uTime', t);
    this._s0cAfterglowMat.setFloat('uPhase', afterglowU);
    this._s0cAfterglowMat.setFloat('uIntensity', afterglowAlpha);
  }

  // -------------------------------------------------------------------------
  // Telemetry & Zero-Leak Teardown (Contract D)
  // -------------------------------------------------------------------------

  getDiagnostics() {
    const subKey = this._activeSubScene;
    const activeMeshes = this.active && subKey ? this._subMeshes[subKey] || [] : [];
    const activeHeroes = [];
    if (this.active && subKey === 'S0A') {
      activeHeroes.push('cosmic_starfield', 'sapphire_nebula_veil');
    } else if (this.active && subKey === 'S0B-1') {
      activeHeroes.push('cryo_vault_corridor', 'cryo_pod_08_hero', 'cryo_pods_array_8');
    } else if (this.active && subKey === 'S0B-2') {
      activeHeroes.push('flagship_voyager', 'escort_chevron_4', 'warp_shockwaves', 'superluminal_tunnel');
    } else if (this.active && subKey === 'S0C') {
      activeHeroes.push('deep_void_starfield', 'sagittarius_rim_haze');
    }

    return {
      segmentId: this.segmentId,
      active: this.active,
      activeSubScene: subKey,
      meshCount: activeMeshes.length,
      activeHeroes,
      particleSystems: this._particleSystems.length,
    };
  }

  dispose() {
    this.setActive(false);

    for (const ps of this._particleSystems) {
      if (ps && typeof ps.dispose === 'function') {
        ps.dispose(false);
      }
    }
    this._particleSystems = [];

    for (const hero of this._heroDisposables) {
      if (hero && typeof hero.dispose === 'function') {
        hero.dispose();
      }
    }
    this._heroDisposables = [];

    for (const light of this._ownedLights) {
      if (light && typeof light.dispose === 'function') {
        light.dispose();
      }
    }
    this._ownedLights = [];

    if (this.root && typeof this.root.dispose === 'function') {
      this.root.dispose();
    }

    for (const mat of this._ownedMaterials) {
      if (mat && typeof mat.dispose === 'function') {
        mat.dispose(false, false);
      }
    }
    this._ownedMaterials = [];

    for (const tex of this._ownedTextures) {
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }
    this._ownedTextures = [];
  }
}
