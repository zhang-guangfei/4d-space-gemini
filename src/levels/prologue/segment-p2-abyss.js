/**
 * Beyond 3D — Prologue Segment P2: 《无声入海》 (26.0s – 55.0s)
 *
 * Implements Contract D (`SegmentP2Abyss`) across Shots S1, S2, and S3:
 * - S1 (26.0–35.0s): 47 Years Later — Serene curved-bow Science Cabin, dramatic warm-amber
 *   architect lamp vs cool sapphire cryo-bay contrast, floating 3-ring holographic star chart,
 *   real-time MirrorTexture deck & PCF shadows, sculpted 07 号 Lin Xia & sleeping 08 号 pod,
 *   and flowing cyan-blue warp-cruise starlight streaks beyond the panoramic bow glass.
 * - S2 (35.0–44.0s): Unaware Silent Crossing — Flagship「远航者号」gliding smoothly with zero
 *   jolt through a towering custom-GLSL Liquid-Mercury 4D Boundary Veil at z = 0 with 3
 *   expanding concentric silver-white geometric intersection ripples + dynamic hull slice ring,
 *   followed strictly +2.0s after full hull immersion (t >= 40.5s) by restrained calm-amber
 *   predictive curvature beacons & bow scan rings.
 * - S3 (44.0–55.0s): Star Extinction & Cosmic Megalophobia — Warp freeze, 600 deterministic
 *   sequentially extinguishing stars, extreme dolly-out shrinking the flagship into a crisp
 *   cyan-rimlit silver speck below a colossal 3-tier SO(4) recursive 4D 8-cell tesseract
 *   megastructure driven by `computeRecursiveTesseract4D(t)`, ringed by sacred geometry halos,
 *   fractal floating sub-cells, volumetric light shafts, and cosmic quantum dust.
 *
 * All translucent / shader / ripple / halo / shaft materials strictly set
 * `disableDepthWrite = true` and `needDepthPrePass = false`.
 */

import { computeRecursiveTesseract4D } from '../../core/prologue-timeline.js';
import {
  createSoftGlowParticleTexture,
  createVolumetricShaftMaterial,
} from '../../engine/aaa-materials.js';
import { PALETTE, RENDER_GROUPS } from '../../engine/phase-materials.js';
import {
  clamp,
  createFlagshipVoyager,
  createScienceCabinCore,
  easeInOutCubic,
  easeOutExpo,
  lerp,
  smoothstep,
} from './prologue-shared.js';

// ---------------------------------------------------------------------------
// Deterministic Seeded PRNG & Zero-GC ThinInstance Matrix Helpers
// ---------------------------------------------------------------------------

function createSeededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createMatrixScratch() {
  const B = globalThis.BABYLON;
  return {
    scale: new B.Vector3(1, 1, 1),
    quat: new B.Quaternion(0, 0, 0, 1),
    pos: new B.Vector3(0, 0, 0),
    mat: B.Matrix.Identity(),
    zeroMat: B.Matrix.Scaling(0, 0, 0),
  };
}

function writeZeroMatrix(buf, index, tmp) {
  tmp.zeroMat.copyToArray(buf, index * 16);
}

/**
 * Write a world-space transform aligning a unit Y-cylinder (height = 1, diameter = 1)
 * between endpoints A and B with radius `radius`.
 */
function writeBeamMatrix(buf, index, ax, ay, az, bx, by, bz, radius, tmp) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4 || radius <= 1e-5) {
    tmp.zeroMat.copyToArray(buf, index * 16);
    return;
  }

  const invLen = 1 / len;
  const nx = dx * invLen;
  const ny = dy * invLen;
  const nz = dz * invLen;

  if (ny > 0.9999) {
    tmp.quat.set(0, 0, 0, 1);
  } else if (ny < -0.9999) {
    tmp.quat.set(1, 0, 0, 0);
  } else {
    const qw = 1 + ny;
    const qLen = Math.hypot(nz, -nx, qw) || 1;
    tmp.quat.set(nz / qLen, 0, -nx / qLen, qw / qLen);
  }

  const diam = radius * 2;
  tmp.scale.set(diam, len, diam);
  tmp.pos.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  globalThis.BABYLON.Matrix.ComposeToRef(tmp.scale, tmp.quat, tmp.pos, tmp.mat);
  tmp.mat.copyToArray(buf, index * 16);
}

function writeUniformInstanceMatrix(buf, index, px, py, pz, sx, sy, sz, rotX, rotY, rotZ, tmp) {
  if (sx <= 1e-5 || sy <= 1e-5 || sz <= 1e-5) {
    tmp.zeroMat.copyToArray(buf, index * 16);
    return;
  }
  const B = globalThis.BABYLON;
  if (rotX === 0 && rotY === 0 && rotZ === 0) {
    tmp.quat.set(0, 0, 0, 1);
  } else {
    B.Quaternion.FromEulerAnglesToRef(rotX, rotY, rotZ, tmp.quat);
  }
  tmp.scale.set(sx, sy, sz);
  tmp.pos.set(px, py, pz);
  B.Matrix.ComposeToRef(tmp.scale, tmp.quat, tmp.pos, tmp.mat);
  tmp.mat.copyToArray(buf, index * 16);
}

// ---------------------------------------------------------------------------
// Ghost-Safe Material Builders (Always disableDepthWrite=true, needDepthPrePass=false)
// ---------------------------------------------------------------------------

function createGhostAdditiveMat(scene, name, hexColor, alpha = 0.65, emissiveScale = 1.45) {
  const B = globalThis.BABYLON;
  const col = B.Color3.FromHexString(hexColor);
  const mat = new B.StandardMaterial(name, scene);
  mat.diffuseColor = col;
  mat.emissiveColor = col.scale(emissiveScale);
  mat.specularColor = B.Color3.Black();
  mat.disableLighting = true;
  mat.alpha = clamp(alpha, 0.0, 0.96);
  mat.alphaMode = B.Engine.ALPHA_ADD;
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.needDepthPrePass = false;
  mat._isPrologueTranslucent = true;
  return mat;
}

function createOpaqueEmissiveMat(scene, name, hexColor, emissiveScale = 1.6) {
  const B = globalThis.BABYLON;
  const col = B.Color3.FromHexString(hexColor);
  const mat = new B.StandardMaterial(name, scene);
  mat.diffuseColor = col;
  mat.emissiveColor = col.scale(emissiveScale);
  mat.specularColor = B.Color3.Black();
  mat.disableLighting = true;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Create a seamless 360-degree vertical-fade volumetric cone material (no cylinder seam!).
 * Strictly Ghost-safe: disableDepthWrite = true, needDepthPrePass = false, ALPHA_ADD.
 */
function createSeamlessConeVolumetricMat(scene, name, hexColor, peakOpacity = 0.24) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(`${name}_vgrad`, { width: 32, height: 128 }, scene, true);
  const ctx = tex.getContext();
  const c = B.Color3.FromHexString(hexColor);
  const cr = Math.round(c.r * 255);
  const cg = Math.round(c.g * 255);
  const cb = Math.round(c.b * 255);
  const img = ctx.createImageData(32, 128);

  for (let y = 0; y < 128; y += 1) {
    const v = y / 127; // 0 = top lamp apex, 1 = bottom tabletop fade
    const topSoft = smoothstep(0.0, 0.14, v);
    const botSoft = Math.pow(Math.max(0, 1 - v), 1.55);
    const a = Math.min(255, Math.round(topSoft * botSoft * peakOpacity * 255));
    for (let x = 0; x < 32; x += 1) {
      const idx = (y * 32 + x) * 4;
      img.data[idx] = cr;
      img.data[idx + 1] = cg;
      img.data[idx + 2] = cb;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.hasAlpha = true;
  tex.update();

  const mat = new B.StandardMaterial(name, scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.opacityTexture = tex;
  mat.emissiveColor = c;
  mat.specularColor = B.Color3.Black();
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.alphaMode = B.Engine.ALPHA_ADD;
  mat.disableDepthWrite = true;
  mat.needDepthPrePass = false;
  mat._isPrologueTranslucent = true;
  return mat;
}

// ---------------------------------------------------------------------------
// Segment P2: 《无声入海》 (26.0 – 55.0s)
// ---------------------------------------------------------------------------

export class SegmentP2Abyss {
  constructor(scene, materials, sharedRig = {}) {
    const B = globalThis.BABYLON;
    this.scene = scene;
    this.materials = materials;
    this.sharedRig = sharedRig || {};
    this.active = false;
    this._activeShotId = null;
    this._lastAlertLevel = 0;
    this._s3StarCount = 600;
    this._s3StarsRemaining = 600;

    this._ownedMats = [];
    this._clonedMats = [];
    this._ownedTex = [];
    this._ownedLights = [];
    this._particleSystems = [];
    this._disposables = [];
    this._tmp = createMatrixScratch();

    this.root = new B.TransformNode('prologue_p2_abyss_root', scene);
    if (this.sharedRig.root) {
      this.root.parent = this.sharedRig.root;
    }

    // Shared soft radial particle texture for all P2 atmospheric layers
    this._particleTex = createSoftGlowParticleTexture(scene);
    this._ownedTex.push(this._particleTex);

    // Three isolated shot sub-trees (only active shot renders!)
    this.s1Root = new B.TransformNode('p2_s1_root', scene);
    this.s1Root.parent = this.root;

    this.s2Root = new B.TransformNode('p2_s2_root', scene);
    this.s2Root.parent = this.root;

    this.s3Root = new B.TransformNode('p2_s3_root', scene);
    this.s3Root.parent = this.root;

    this._s1Lights = [];
    this._s2Lights = [];
    this._s3Lights = [];
    this._s1ThinMeshes = [];
    this._s2ThinMeshes = [];
    this._s3ThinMeshes = [];

    this._buildS1ScienceCabin();
    this._buildS2MercuryVeil();
    this._buildS3CosmicMegastructure();

    // Start cleanly disabled until PrologueScene activates P2
    this.setActive(false);
  }

  _trackMat(mat) {
    this._ownedMats.push(mat);
    return mat;
  }

  _trackClonedMat(mat) {
    mat.disableDepthWrite = false;
    mat.needDepthPrePass = false;
    this._clonedMats.push(mat);
    return mat;
  }

  _trackLight(light, shotBucket) {
    this._ownedLights.push(light);
    shotBucket.push(light);
    return light;
  }

  // -------------------------------------------------------------------------
  // Shot S1 (26.0 – 35.0s): Serene Curved Science Cabin & 07 号 Lin Xia
  // -------------------------------------------------------------------------

  _buildS1ScienceCabin() {
    const B = globalThis.BABYLON;
    const regShadow =
      typeof this.sharedRig.registerShadowCaster === 'function'
        ? this.sharedRig.registerShadowCaster
        : null;
    const regMirror =
      typeof this.sharedRig.registerMirrorMesh === 'function'
        ? this.sharedRig.registerMirrorMesh
        : null;

    // Ensure S1/S2 architectural, character, cryo-pod & hull PBR materials accept all local PointLights
    // (Deliberately excludes S3 tesseractCyanBeam / tesseractGoldBeam so S3 stays 100% untouched!)
    const p2LightMats = [
      this.materials.hullTitanium,
      this.materials.hullDarkRib,
      this.materials.hullAccentGold,
      this.materials.cryoAlloy,
      this.materials.cryoFrostedGlass,
      this.materials.cabinDeckMirror,
      this.materials.cabinDarkTitanium,
      this.materials.deskWoodBronze,
      this.materials.linXiaSuit,
      this.materials.linXiaDarkTrim,
      this.materials.linXiaSkin,
      this.materials.borosilicateGlass,
    ];
    for (const m of p2LightMats) {
      if (m && typeof m.maxSimultaneousLights === 'number' && m.maxSimultaneousLights < 12) {
        m.maxSimultaneousLights = 12;
      }
    }

    // 1. Shared hero curved-bow Science Cabin (07 号 Lin Xia + 08 号 Cryo-Bay + Mirror Deck)
    this._s1Cabin = createScienceCabinCore(this.scene, this.materials, 'p2_s1_cabin', {
      registerShadowCaster: regShadow,
      registerMirrorMesh: regMirror,
    });
    this._s1Cabin.root.parent = this.s1Root;
    this._disposables.push(this._s1Cabin);

    // Clone brighter sculpted architectural titanium & rib steel strictly for S1 cabin interior readability
    const s1WallTiMat = this._trackClonedMat(this.materials.cabinDarkTitanium.clone('p2_s1_cabin_wall_steel_pbr'));
    s1WallTiMat.albedoColor = B.Color3.FromHexString('#48607E');
    s1WallTiMat.metallic = 0.62;
    s1WallTiMat.roughness = 0.36;
    s1WallTiMat.emissiveColor = B.Color3.FromHexString('#0D1A2D');
    s1WallTiMat.clearCoat.isEnabled = true;
    s1WallTiMat.clearCoat.intensity = 0.42;
    s1WallTiMat.clearCoat.roughness = 0.2;
    s1WallTiMat.maxSimultaneousLights = 12;

    const s1RibSteelMat = this._trackClonedMat(this.materials.hullDarkRib.clone('p2_s1_cabin_rib_steel_pbr'));
    s1RibSteelMat.albedoColor = B.Color3.FromHexString('#587292');
    s1RibSteelMat.metallic = 0.68;
    s1RibSteelMat.roughness = 0.32;
    s1RibSteelMat.emissiveColor = B.Color3.FromHexString('#101F34');
    s1RibSteelMat.clearCoat.isEnabled = true;
    s1RibSteelMat.clearCoat.intensity = 0.48;
    s1RibSteelMat.clearCoat.roughness = 0.16;
    s1RibSteelMat.maxSimultaneousLights = 12;

    for (const cm of this._s1Cabin.root.getChildMeshes()) {
      if (cm.material === this.materials.cabinDarkTitanium) {
        cm.material = s1WallTiMat;
      } else if (cm.material === this.materials.hullDarkRib) {
        cm.material = s1RibSteelMat;
      }
      if (cm.material && typeof cm.material.maxSimultaneousLights === 'number' && cm.material.maxSimultaneousLights < 12) {
        cm.material.maxSimultaneousLights = 12;
      }
    }

    // Position 07 号 Lin Xia prominently beside the glowing holographic star-chart orrery (100% unobstructed at KF-07!)
    if (this._s1Cabin.linXiaRig?.root) {
      this._s1Cabin.linXiaRig.root.position.set(0.62, 0, 1.55);
      this._s1Cabin.linXiaRig.root.rotation.y = -0.58;
    }

    // Tuck desk lamp slightly toward starboard desk edge & lower console gently so Lin Xia has 100% clear camera sightline
    if (this._s1Cabin.deskRoot) {
      for (const dm of this._s1Cabin.deskRoot.getChildMeshes()) {
        if (dm.name.includes('_lamp_')) {
          dm.position.x += 0.22;
        } else if (dm.name.endsWith('_console_frame')) {
          dm.position.set(0.54, 1.0, 0.34);
          dm.rotation.set(0.46, -0.26, 0);
        }
      }
    }

    // Tune built-in cabin dual-tone lights for rich warm amber vs cool sapphire architectural contrast
    if (this._s1Cabin.deskLampLight) {
      this._s1Cabin.deskLampLight.position.set(0.98, 1.52, 1.92);
      this._s1Cabin.deskLampLight.diffuse = B.Color3.FromHexString('#FFBE6B');
      this._s1Cabin.deskLampLight.specular = B.Color3.FromHexString('#FFE8C2');
      this._s1Cabin.deskLampLight.intensity = 3.2;
      this._s1Cabin.deskLampLight.range = 8.5;
      this._s1Lights.push(this._s1Cabin.deskLampLight);
    }
    if (this._s1Cabin.cryoBayLight) {
      this._s1Cabin.cryoBayLight.position.set(-1.85, 2.35, -1.25);
      this._s1Cabin.cryoBayLight.diffuse = B.Color3.FromHexString('#6CB8FF');
      this._s1Cabin.cryoBayLight.specular = B.Color3.FromHexString('#C2E8FF');
      this._s1Cabin.cryoBayLight.intensity = 3.1;
      this._s1Cabin.cryoBayLight.range = 12.0;
      this._s1Lights.push(this._s1Cabin.cryoBayLight);
    }

    // Rich warm amber key light centered squarely on walnut-brass desk, holographic star-chart orrery & 07 号 Lin Xia
    const warmHeroKey = this._trackLight(
      new B.PointLight('p2_s1_warm_hero_key', new B.Vector3(0.48, 2.12, 2.36), this.scene),
      this._s1Lights
    );
    warmHeroKey.diffuse = B.Color3.FromHexString('#FFBE6B');
    warmHeroKey.specular = B.Color3.FromHexString('#FFECD0');
    warmHeroKey.intensity = 4.6;
    warmHeroKey.range = 9.0;
    warmHeroKey.parent = this.s1Root;
    this._s1WarmHeroKey = warmHeroKey;

    // Soft cool-sapphire vaulted rib fill lights illuminating curved titanium ribs, bow mullions & cryo-bay
    const vaultRibFillBow = this._trackLight(
      new B.PointLight('p2_s1_vault_rib_fill_bow', new B.Vector3(-0.35, 3.25, 3.25), this.scene),
      this._s1Lights
    );
    vaultRibFillBow.diffuse = B.Color3.FromHexString('#9BC4F0');
    vaultRibFillBow.specular = B.Color3.FromHexString('#E0F0FF');
    vaultRibFillBow.intensity = 2.8;
    vaultRibFillBow.range = 15.0;
    vaultRibFillBow.parent = this.s1Root;

    const vaultRibFillBay = this._trackLight(
      new B.PointLight('p2_s1_vault_rib_fill_bay', new B.Vector3(-1.65, 3.15, -1.05), this.scene),
      this._s1Lights
    );
    vaultRibFillBay.diffuse = B.Color3.FromHexString('#9BC4F0');
    vaultRibFillBay.specular = B.Color3.FromHexString('#D8ECFF');
    vaultRibFillBay.intensity = 2.95;
    vaultRibFillBay.range = 15.0;
    vaultRibFillBay.parent = this.s1Root;

    // Cool sapphire-cyan bow starlight fill sculpting panoramic bow window mullions & curved ribs
    const bowStarFill = this._trackLight(
      new B.PointLight('p2_s1_bow_star_fill', new B.Vector3(0.4, 2.45, 4.7), this.scene),
      this._s1Lights
    );
    bowStarFill.diffuse = B.Color3.FromHexString('#88D4F6');
    bowStarFill.specular = B.Color3.FromHexString('#D6F6FF');
    bowStarFill.intensity = 2.45;
    bowStarFill.range = 12.0;
    bowStarFill.parent = this.s1Root;

    // 2. Warm Amber Volumetric Desk Lamp Light Cone (positioned cleanly at starboard lamp, zero obstruction of Lin Xia)
    const warmConeMat = this._trackMat(
      createSeamlessConeVolumetricMat(this.scene, 'p2_s1_lamp_cone_mat', '#FFBE6B', 0.16)
    );
    this._s1LampConeMat = warmConeMat;
    const lampCone = B.MeshBuilder.CreateCylinder(
      'p2_s1_lamp_vol_cone',
      { diameterTop: 0.2, diameterBottom: 1.18, height: 0.92, tessellation: 32, openEnded: true },
      this.scene
    );
    lampCone.position.set(0.98, 1.06, 1.94);
    lampCone.rotation.z = 0.24;
    lampCone.material = warmConeMat;
    lampCone.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    lampCone.parent = this.s1Root;

    // 3. Cool Sapphire Cryo-Bay Volumetric Downwash Curtains & Architectural Wall Accent Rails
    const cryoConeMat = this._trackMat(
      createSeamlessConeVolumetricMat(this.scene, 'p2_s1_cryo_cone_mat', '#4DA3FF', 0.16)
    );
    for (const cz of [-1.6, 0.7]) {
      const cryoCone = B.MeshBuilder.CreateCylinder(
        `p2_s1_cryo_cone_${cz}`,
        { diameterTop: 0.78, diameterBottom: 2.45, height: 3.15, tessellation: 28, openEnded: true },
        this.scene
      );
      cryoCone.position.set(-2.35, 2.35, cz);
      cryoCone.material = cryoConeMat;
      cryoCone.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      cryoCone.parent = this.s1Root;
    }

    const sapphireRailMat = this._trackMat(
      createOpaqueEmissiveMat(this.scene, 'p2_s1_sapphire_rail_mat', '#4FA8FF', 1.15)
    );
    for (const ry of [0.35, 2.95]) {
      const rail = B.MeshBuilder.CreateBox(
        `p2_s1_port_sapphire_rail_${ry}`,
        { width: 0.04, height: 0.045, depth: 7.4 },
        this.scene
      );
      rail.position.set(-4.18, ry, -0.4);
      rail.material = sapphireRailMat;
      rail.parent = this.s1Root;
      if (regMirror) regMirror(rail);
    }

    // 4. Floating 3-Ring Holographic Star Chart Orrery hovering above central walnut desk
    const holoRoot = new B.TransformNode('p2_s1_holo_orrery_root', this.scene);
    holoRoot.position.set(-0.14, 1.34, 2.05);
    holoRoot.parent = this.s1Root;
    this._s1HoloRoot = holoRoot;

    const holoCyanMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s1_holo_cyan_mat', PALETTE.accent.cyanW0, 0.72, 1.55)
    );
    const holoGoldMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s1_holo_gold_mat', PALETTE.accent.goldWPos, 0.78, 1.65)
    );
    const holoConeMat = this._trackMat(
      createSeamlessConeVolumetricMat(this.scene, 'p2_s1_holo_proj_mat', '#4DE6D3', 0.24)
    );

    // Subtle upward emitter beam from brass specimen pad to floating star chart
    const projBeam = B.MeshBuilder.CreateCylinder(
      'p2_s1_holo_proj_beam',
      { diameterTop: 0.54, diameterBottom: 0.24, height: 0.44, tessellation: 24, openEnded: true },
      this.scene
    );
    projBeam.position.set(0.06, -0.22, 0);
    projBeam.material = holoConeMat;
    projBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    projBeam.parent = holoRoot;

    const holoOuter = B.MeshBuilder.CreateTorus(
      'p2_s1_holo_ring_outer',
      { diameter: 0.62, thickness: 0.013, tessellation: 48 },
      this.scene
    );
    holoOuter.material = holoCyanMat;
    holoOuter.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    holoOuter.parent = holoRoot;

    const holoMid = B.MeshBuilder.CreateTorus(
      'p2_s1_holo_ring_mid',
      { diameter: 0.46, thickness: 0.011, tessellation: 44 },
      this.scene
    );
    holoMid.material = holoGoldMat;
    holoMid.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    holoMid.parent = holoRoot;

    const holoInner = B.MeshBuilder.CreateTorus(
      'p2_s1_holo_ring_inner',
      { diameter: 0.3, thickness: 0.009, tessellation: 36 },
      this.scene
    );
    holoInner.material = holoCyanMat;
    holoInner.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    holoInner.parent = holoRoot;

    const holoCore = B.MeshBuilder.CreatePolyhedron(
      'p2_s1_holo_core',
      { type: 1, size: 0.045 },
      this.scene
    );
    holoCore.material = holoGoldMat;
    holoCore.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    holoCore.parent = holoRoot;

    // Orbiting holographic star waypoints around the orrery
    const holoCloud = new B.TransformNode('p2_s1_holo_stars', this.scene);
    holoCloud.parent = holoRoot;
    const rngHolo = createSeededRandom(4707);
    for (let i = 0; i < 12; i += 1) {
      const ang = (i / 12) * Math.PI * 2;
      const rad = 0.1 + rngHolo() * 0.19;
      const elev = (rngHolo() - 0.5) * 0.16;
      const wp = B.MeshBuilder.CreateSphere(
        `p2_s1_holo_wp_${i}`,
        { diameter: i % 4 === 0 ? 0.028 : 0.018, segments: 8 },
        this.scene
      );
      wp.position.set(Math.cos(ang) * rad, elev, Math.sin(ang) * rad);
      wp.material = i % 3 === 0 ? this.materials.emissiveAmber : this.materials.emissiveCyan;
      wp.parent = holoCloud;
    }

    this._s1HoloParts = { holoOuter, holoMid, holoInner, holoCore, holoCloud };

    // Lived-in scientific desk props: angled personal log slate & brass thermal cup
    const logSlate = B.MeshBuilder.CreateBox(
      'p2_s1_log_slate',
      { width: 0.28, height: 0.018, depth: 0.2 },
      this.scene
    );
    logSlate.position.set(0.38, 0.905, 1.82);
    logSlate.rotation.set(0.08, -0.22, 0);
    logSlate.material = this.materials.hullDarkRib;
    logSlate.parent = this.s1Root;
    if (regShadow) regShadow(logSlate);

    const logScreen = B.MeshBuilder.CreatePlane(
      'p2_s1_log_screen',
      { width: 0.24, height: 0.16 },
      this.scene
    );
    logScreen.rotation.x = Math.PI * 0.5;
    logScreen.position.set(0, 0.011, 0);
    logScreen.material = holoCyanMat;
    logScreen.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    logScreen.parent = logSlate;

    const thermalCup = B.MeshBuilder.CreateCylinder(
      'p2_s1_thermal_cup',
      { diameterTop: 0.075, diameterBottom: 0.068, height: 0.11, tessellation: 16 },
      this.scene
    );
    thermalCup.position.set(0.74, 0.94, 1.72);
    thermalCup.material = this.materials.hullAccentGold;
    thermalCup.parent = this.s1Root;
    if (regShadow) regShadow(thermalCup);

    // 5. Sleek Exterior Flagship Bow Cowl Framing the Panoramic Window (strictly outside aperture)
    const upperBrow = B.MeshBuilder.CreateBox(
      'p2_s1_ext_brow',
      { width: 10.6, height: 0.52, depth: 3.4 },
      this.scene
    );
    upperBrow.position.set(0, 4.46, 4.15);
    upperBrow.material = this.materials.hullTitanium;
    upperBrow.parent = this.s1Root;

    const lowerChin = B.MeshBuilder.CreateBox(
      'p2_s1_ext_chin',
      { width: 10.4, height: 0.48, depth: 3.6 },
      this.scene
    );
    lowerChin.position.set(0, -0.34, 4.25);
    lowerChin.material = this.materials.hullTitanium;
    lowerChin.parent = this.s1Root;

    for (const side of [-1, 1]) {
      const cheek = B.MeshBuilder.CreateBox(
        `p2_s1_ext_cheek_${side}`,
        { width: 0.65, height: 4.9, depth: 4.8 },
        this.scene
      );
      cheek.position.set(side * 4.78, 2.08, 3.1);
      cheek.material = this.materials.hullTitanium;
      cheek.parent = this.s1Root;

      const goldAccent = B.MeshBuilder.CreateBox(
        `p2_s1_ext_trim_${side}`,
        { width: 0.1, height: 0.12, depth: 4.6 },
        this.scene
      );
      goldAccent.position.set(side * 5.14, 2.65, 3.1);
      goldAccent.material = this.materials.hullAccentGold;
      goldAccent.parent = this.s1Root;
    }

    // 6. Exterior Serene Cyan-Blue Warp-Cruise Starlight Streaks (z > 6.5, ThinInstanced)
    const s1StreakCyanMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s1_streak_cyan', '#5AE8E0', 0.62, 1.35)
    );
    const s1StreakBlueMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s1_streak_blue', '#7CB8FF', 0.55, 1.25)
    );

    const rngS1 = createSeededRandom(2635);
    const streakCountPerMat = 48;
    this._s1StreakGroups = [s1StreakCyanMat, s1StreakBlueMat].map((mat, gIdx) => {
      const mesh = B.MeshBuilder.CreateBox(
        `p2_s1_warp_streaks_${gIdx}`,
        { width: 1, height: 1, depth: 1 },
        this.scene
      );
      mesh.material = mat;
      mesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.parent = this.s1Root;
      this._s1ThinMeshes.push(mesh);

      const items = [];
      for (let i = 0; i < streakCountPerMat; i += 1) {
        const angle = rngS1() * Math.PI * 2;
        const rad = 7.2 + rngS1() * 28.0;
        const x = Math.cos(angle) * rad * 1.35;
        const y = 2.0 + Math.sin(angle) * rad * 0.72;
        items.push({
          x,
          y,
          zPhase: rngS1(),
          speed: 9.5 + rngS1() * 14.0,
          len: 3.4 + rngS1() * 7.8,
          thick: 0.035 + rngS1() * 0.045,
        });
      }
      const buf = new Float32Array(streakCountPerMat * 16);
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      return { mesh, items, buf };
    });

    // Distant serene deep-space starfield visible outside curved bow window
    const s1StarMat = this._trackMat(
      createOpaqueEmissiveMat(this.scene, 'p2_s1_bg_star_mat', '#E4F3FF', 1.45)
    );
    const s1StarCount = 160;
    const s1StarsMesh = B.MeshBuilder.CreateIcoSphere(
      'p2_s1_bg_stars',
      { radius: 0.5, subdivisions: 1 },
      this.scene
    );
    s1StarsMesh.material = s1StarMat;
    s1StarsMesh.alwaysSelectAsActiveMesh = true;
    s1StarsMesh.parent = this.s1Root;
    this._s1ThinMeshes.push(s1StarsMesh);

    const s1StarBuf = new Float32Array(s1StarCount * 16);
    for (let i = 0; i < s1StarCount; i += 1) {
      const az = (rngS1() - 0.5) * Math.PI * 1.15;
      const el = (rngS1() - 0.45) * Math.PI * 0.52;
      const r = 110 + rngS1() * 120;
      const px = Math.sin(az) * Math.cos(el) * r;
      const py = 2.0 + Math.sin(el) * r;
      const pz = Math.cos(az) * Math.cos(el) * r + 10;
      const sz = 0.24 + rngS1() * 0.48;
      writeUniformInstanceMatrix(s1StarBuf, i, px, py, pz, sz, sz, sz, 0, 0, 0, this._tmp);
    }
    s1StarsMesh.thinInstanceSetBuffer('matrix', s1StarBuf, 16, true);

    // 7. Floating Luminous Cabin Dust Motes (ParticleSystem)
    const cabinMotes = new B.ParticleSystem('p2_s1_cabin_motes', 180, this.scene);
    cabinMotes.particleTexture = this._particleTex;
    cabinMotes.emitter = new B.Vector3(0, 1.5, 1.2);
    cabinMotes.minEmitBox = new B.Vector3(-3.4, -1.1, -3.2);
    cabinMotes.maxEmitBox = new B.Vector3(2.8, 2.0, 3.6);
    cabinMotes.color1 = new B.Color4(1.0, 0.82, 0.52, 0.52);
    cabinMotes.color2 = new B.Color4(0.45, 0.9, 0.96, 0.44);
    cabinMotes.colorDead = new B.Color4(0.55, 0.85, 0.95, 0.0);
    cabinMotes.minSize = 0.018;
    cabinMotes.maxSize = 0.056;
    cabinMotes.minLifeTime = 3.2;
    cabinMotes.maxLifeTime = 7.2;
    cabinMotes.emitRate = 32;
    cabinMotes.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    cabinMotes.gravity = new B.Vector3(0, 0.008, 0);
    cabinMotes.direction1 = new B.Vector3(-0.06, 0.02, -0.06);
    cabinMotes.direction2 = new B.Vector3(0.06, 0.1, 0.06);
    cabinMotes.minEmitPower = 0.03;
    cabinMotes.maxEmitPower = 0.11;
    cabinMotes.updateSpeed = 0.014;
    cabinMotes.preWarmCycles = 40;
    cabinMotes.preWarmStepOffset = 2;
    cabinMotes.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    cabinMotes._p2ShotId = 'S1';
    this._particleSystems.push(cabinMotes);
  }

  // -------------------------------------------------------------------------
  // Shot S2 (35.0 – 44.0s): Unaware Liquid-Mercury 4D Veil Crossing & +2s Alert
  // -------------------------------------------------------------------------

  _buildS2MercuryVeil() {
    const B = globalThis.BABYLON;

    // 1. Flagship「远航者号」gliding silently along +Z with zero jolt
    this._s2Flagship = createFlagshipVoyager(this.scene, this.materials, 'p2_s2_flagship');
    this._s2Flagship.root.scaling.setAll(0.68);
    this._s2Flagship.root.position.set(0, 0.42, -4.65);
    this._s2Flagship.root.parent = this.s2Root;
    this._disposables.push(this._s2Flagship);

    // Sculpted silver-blue metallic key + crisp cool-silver rim lights so brushed titanium gleams through mercury veil
    const s2Key = this._trackLight(
      new B.PointLight('p2_s2_hull_key', new B.Vector3(-8.4, 5.2, 6.2), this.scene),
      this._s2Lights
    );
    s2Key.diffuse = B.Color3.FromHexString('#DCEEFF');
    s2Key.specular = B.Color3.FromHexString('#FFFFFF');
    s2Key.intensity = 4.2;
    s2Key.range = 44;
    s2Key.parent = this.s2Root;
    this._s2HullKey = s2Key;

    const s2Rim = this._trackLight(
      new B.PointLight('p2_s2_hull_rim', new B.Vector3(7.5, 2.4, -3.5), this.scene),
      this._s2Lights
    );
    s2Rim.diffuse = B.Color3.FromHexString('#7AEAF0');
    s2Rim.specular = B.Color3.FromHexString('#D8FCFF');
    s2Rim.intensity = 2.4;
    s2Rim.range = 38;
    s2Rim.parent = this.s2Root;

    // Dedicated crisp cool-silver rim light hugging Flagship「远航者号」hull contours
    const s2SilverRim = this._trackLight(
      new B.PointLight('p2_s2_silver_rim', new B.Vector3(-4.2, 3.6, 2.5), this.scene),
      this._s2Lights
    );
    s2SilverRim.diffuse = B.Color3.FromHexString('#E4F2FF');
    s2SilverRim.specular = B.Color3.FromHexString('#FFFFFF');
    s2SilverRim.intensity = 5.4;
    s2SilverRim.range = 28;
    s2SilverRim.parent = this.s2Root;
    this._s2SilverRim = s2SilverRim;

    // 2. +2.0s Predictive Calm Amber Alert Instrumentation (strictly hidden when alertLevel === 0)
    const alertAmberRingMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s2_alert_arc_mat', '#F7B733', 0.0, 1.55)
    );
    this._s2AlertRingMat = alertAmberRingMat;

    this._s2AlertRings = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = B.MeshBuilder.CreateTorus(
        `p2_s2_bow_alert_ring_${i}`,
        { diameter: 1.45 + i * 0.55, thickness: 0.036, tessellation: 44 },
        this.scene
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.position.set(0, 0.14, 5.2 + i * 1.15);
      ring.material = alertAmberRingMat;
      ring.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      ring.isVisible = false;
      ring.parent = this._s2Flagship.root;
      this._s2AlertRings.push(ring);
    }

    // Subtle interior canopy amber predictive beacon halo inside bow glass
    const canopyAlertHaloMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s2_canopy_alert_mat', '#F59E0B', 0.0, 1.7)
    );
    this._s2CanopyAlertMat = canopyAlertHaloMat;
    const canopyAlertHalo = B.MeshBuilder.CreateSphere(
      'p2_s2_canopy_alert_halo',
      { diameter: 1.92, segments: 18 },
      this.scene
    );
    canopyAlertHalo.scaling.set(1.06, 0.65, 1.1);
    canopyAlertHalo.position.set(0, 0.24, 3.85);
    canopyAlertHalo.material = canopyAlertHaloMat;
    canopyAlertHalo.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    canopyAlertHalo.isVisible = false;
    canopyAlertHalo.parent = this._s2Flagship.root;
    this._s2CanopyAlertHalo = canopyAlertHalo;

    // Dedicated calm amber bow predictive warning light (intensity = 0 before t = 40.5s!)
    const s2AlertLight = this._trackLight(
      new B.PointLight('p2_s2_alert_light', new B.Vector3(0, 1.35, 3.4), this.scene),
      this._s2Lights
    );
    s2AlertLight.diffuse = B.Color3.FromHexString('#F59E0B');
    s2AlertLight.specular = B.Color3.FromHexString('#FFE19C');
    s2AlertLight.intensity = 0.0;
    s2AlertLight.range = 14.5;
    s2AlertLight.parent = this.s2Root;
    this._s2AlertLight = s2AlertLight;

    // 3. Towering Translucent Liquid-Mercury 4D Boundary Veil at z = 0
    // Built as high-subdivision CreateGround rotated into XY so vertex-shader ripples undulate cleanly!
    const mercuryVeil = B.MeshBuilder.CreateGround(
      'p2_s2_mercury_veil',
      { width: 78, height: 48, subdivisions: 64 },
      this.scene
    );
    mercuryVeil.rotation.x = -Math.PI * 0.5;
    mercuryVeil.position.set(0, 0.42, 0);
    mercuryVeil.material = this.materials.mercuryVeilShader;
    mercuryVeil.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    mercuryVeil.parent = this.s2Root;
    this._s2MercuryVeil = mercuryVeil;

    // 4. Three Expanding Dark-Chrome / Silver-Cyan Concentric Geometric Intersection Ripple Rings at z = 0
    this._s2RippleRings = [];
    const ripplePalette = ['#A8CEE8', '#78C8DE', '#4BC4C4'];
    for (let i = 0; i < 3; i += 1) {
      const rMat = this._trackMat(
        createGhostAdditiveMat(this.scene, `p2_s2_ripple_mat_${i}`, ripplePalette[i], 0.0, 0.92)
      );
      const torus = B.MeshBuilder.CreateTorus(
        `p2_s2_ripple_ring_${i}`,
        { diameter: 2.0, thickness: 0.024 - i * 0.004, tessellation: 64 },
        this.scene
      );
      torus.rotation.x = Math.PI * 0.5;
      torus.position.set(0, 0.42, 0.03 + i * 0.015);
      torus.material = rMat;
      torus.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      torus.parent = this.s2Root;
      this._s2RippleRings.push({ mesh: torus, mat: rMat, phaseOffset: i / 3 });
    }

    // Dynamic Hull-Contact Cross-Section Chrome-Silver Slice Ring right at z = 0 (restrained <= 0.38 alpha)
    const sliceMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s2_hull_slice_mat', '#B6DCF2', 0.0, 0.95)
    );
    const sliceRing = B.MeshBuilder.CreateTorus(
      'p2_s2_hull_slice_ring',
      { diameter: 2.0, thickness: 0.028, tessellation: 64 },
      this.scene
    );
    sliceRing.rotation.x = Math.PI * 0.5;
    sliceRing.position.set(0, 0.42, 0.02);
    sliceRing.material = sliceMat;
    sliceRing.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    sliceRing.parent = this.s2Root;
    this._s2HullSlice = { mesh: sliceRing, mat: sliceMat };

    // 5. S2 Deep-Space Starfield & Gentle Cruise Starlight Filaments
    const rngS2 = createSeededRandom(3544);
    const s2StarMats = [
      this._trackMat(createOpaqueEmissiveMat(this.scene, 'p2_s2_star_white', '#F0F7FF', 1.55)),
      this._trackMat(createOpaqueEmissiveMat(this.scene, 'p2_s2_star_cyan', '#9EEBFF', 1.4)),
    ];
    for (let mIdx = 0; mIdx < s2StarMats.length; mIdx += 1) {
      const count = 140;
      const starMesh = B.MeshBuilder.CreateIcoSphere(
        `p2_s2_stars_${mIdx}`,
        { radius: 0.5, subdivisions: 1 },
        this.scene
      );
      starMesh.material = s2StarMats[mIdx];
      starMesh.alwaysSelectAsActiveMesh = true;
      starMesh.parent = this.s2Root;
      this._s2ThinMeshes.push(starMesh);

      const buf = new Float32Array(count * 16);
      for (let i = 0; i < count; i += 1) {
        // Hemisphere visible to port-bow camera looking (+X, -Z)
        const theta = rngS2() * Math.PI * 2;
        const phi = Math.acos(2 * rngS2() - 1);
        const r = 135 + rngS2() * 145;
        const px = Math.sin(phi) * Math.cos(theta) * r;
        const py = Math.cos(phi) * r;
        const pz = Math.sin(phi) * Math.sin(theta) * r;
        const sz = 0.28 + rngS2() * 0.56;
        writeUniformInstanceMatrix(buf, i, px, py, pz, sz, sz, sz, 0, 0, 0, this._tmp);
      }
      starMesh.thinInstanceSetBuffer('matrix', buf, 16, true);
    }

    // Subtle serene warp-cruise streaks gliding smoothly past the flagship in S2
    const s2StreakMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s2_cruise_streak', '#7CEAE8', 0.44, 1.25)
    );
    const s2StreakCount = 46;
    const s2StreakMesh = B.MeshBuilder.CreateBox(
      'p2_s2_cruise_streaks',
      { width: 1, height: 1, depth: 1 },
      this.scene
    );
    s2StreakMesh.material = s2StreakMat;
    s2StreakMesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    s2StreakMesh.alwaysSelectAsActiveMesh = true;
    s2StreakMesh.parent = this.s2Root;
    this._s2ThinMeshes.push(s2StreakMesh);

    const s2StreakItems = [];
    for (let i = 0; i < s2StreakCount; i += 1) {
      const ang = rngS2() * Math.PI * 2;
      const rad = 6.5 + rngS2() * 24.0;
      s2StreakItems.push({
        x: Math.cos(ang) * rad + 4.0,
        y: Math.sin(ang) * rad * 0.65,
        zPhase: rngS2(),
        speed: 8.5 + rngS2() * 9.0,
        len: 2.8 + rngS2() * 5.6,
        thick: 0.032 + rngS2() * 0.036,
      });
    }
    const s2StreakBuf = new Float32Array(s2StreakCount * 16);
    s2StreakMesh.thinInstanceSetBuffer('matrix', s2StreakBuf, 16, false);
    this._s2Streaks = { mesh: s2StreakMesh, items: s2StreakItems, buf: s2StreakBuf };

    // 6. Ambient Liquid-Mercury Vertical Shimmer Particle Veil at z = 0
    const veilParticles = new B.ParticleSystem('p2_s2_veil_motes', 180, this.scene);
    veilParticles.particleTexture = this._particleTex;
    veilParticles.emitter = new B.Vector3(0, 0.4, 0);
    veilParticles.minEmitBox = new B.Vector3(-18, -10, -0.2);
    veilParticles.maxEmitBox = new B.Vector3(18, 11, 0.2);
    veilParticles.color1 = new B.Color4(0.84, 0.95, 1.0, 0.56);
    veilParticles.color2 = new B.Color4(0.32, 0.9, 0.88, 0.42);
    veilParticles.colorDead = new B.Color4(0.55, 0.85, 0.95, 0.0);
    veilParticles.minSize = 0.07;
    veilParticles.maxSize = 0.24;
    veilParticles.minLifeTime = 2.6;
    veilParticles.maxLifeTime = 5.8;
    veilParticles.emitRate = 38;
    veilParticles.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    veilParticles.gravity = new B.Vector3(0, 0.02, 0);
    veilParticles.direction1 = new B.Vector3(-0.18, -0.25, -0.02);
    veilParticles.direction2 = new B.Vector3(0.18, 0.35, 0.02);
    veilParticles.minEmitPower = 0.08;
    veilParticles.maxEmitPower = 0.26;
    veilParticles.updateSpeed = 0.015;
    veilParticles.preWarmCycles = 38;
    veilParticles.preWarmStepOffset = 2;
    veilParticles.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    veilParticles._p2ShotId = 'S2';
    this._particleSystems.push(veilParticles);
  }

  // -------------------------------------------------------------------------
  // Shot S3 (44.0 – 55.0s): 600-Star Extinction & Colossal 4D 8-Cell Megastructure
  // -------------------------------------------------------------------------

  _buildS3CosmicMegastructure() {
    const B = globalThis.BABYLON;

    // 1. Flagship「远航者号」anchored at lower-center so extreme dolly-out shrinks it into a crisp silver speck
    this._s3ShipBasePos = new B.Vector3(-4.8, -1.65, -10.5);
    this._s3Flagship = createFlagshipVoyager(this.scene, this.materials, 'p2_s3_flagship');
    this._s3Flagship.root.scaling.setAll(0.62);
    this._s3Flagship.root.position.copyFrom(this._s3ShipBasePos);
    this._s3Flagship.root.rotation.set(0.02, 0.14, -0.04);
    this._s3Flagship.root.parent = this.s3Root;
    this._disposables.push(this._s3Flagship);

    // Crisp cold-cyan & silver rim lighting on flagship so it gleams like a lone silver jewel at 66m distance
    const s3ShipRim = this._trackLight(
      new B.PointLight('p2_s3_ship_rim', new B.Vector3(-2.4, 3.4, -4.5), this.scene),
      this._s3Lights
    );
    s3ShipRim.diffuse = B.Color3.FromHexString('#BFF6FF');
    s3ShipRim.specular = B.Color3.FromHexString('#FFFFFF');
    s3ShipRim.intensity = 4.4;
    s3ShipRim.range = 26;
    s3ShipRim.parent = this.s3Root;

    const s3ShipKey = this._trackLight(
      new B.PointLight('p2_s3_ship_key', new B.Vector3(-10.2, 2.0, -14.8), this.scene),
      this._s3Lights
    );
    s3ShipKey.diffuse = B.Color3.FromHexString('#E8F3FF');
    s3ShipKey.specular = B.Color3.FromHexString('#FFFFFF');
    s3ShipKey.intensity = 2.4;
    s3ShipKey.range = 24;
    s3ShipKey.parent = this.s3Root;

    // Fading warp-freeze filaments (evaporate smoothly across 44.0 – 45.4s)
    const freezeStreakMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s3_freeze_streak', '#7AE8F0', 0.55, 1.3)
    );
    this._s3FreezeMat = freezeStreakMat;
    const freezeCount = 44;
    const freezeMesh = B.MeshBuilder.CreateBox(
      'p2_s3_warp_freeze_streaks',
      { width: 1, height: 1, depth: 1 },
      this.scene
    );
    freezeMesh.material = freezeStreakMat;
    freezeMesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    freezeMesh.alwaysSelectAsActiveMesh = true;
    freezeMesh.parent = this.s3Root;
    this._s3ThinMeshes.push(freezeMesh);

    const rngFreeze = createSeededRandom(4455);
    const freezeItems = [];
    for (let i = 0; i < freezeCount; i += 1) {
      const ang = rngFreeze() * Math.PI * 2;
      const rad = 5.5 + rngFreeze() * 24.0;
      freezeItems.push({
        x: Math.cos(ang) * rad - 2.0,
        y: Math.sin(ang) * rad * 0.65,
        z: -16 + rngFreeze() * 72,
        len: 3.5 + rngFreeze() * 7.5,
        thick: 0.04 + rngFreeze() * 0.045,
      });
    }
    const freezeBuf = new Float32Array(freezeCount * 16);
    freezeMesh.thinInstanceSetBuffer('matrix', freezeBuf, 16, false);
    this._s3FreezeStreaks = { mesh: freezeMesh, items: freezeItems, buf: freezeBuf };

    // 2. 600-Star Deterministic Sequential Extinction (3 emissive color cohorts × 200 stars = 600 stars!)
    const rngStars = createSeededRandom(60044);
    const starCohortSpecs = [
      { name: 'white', hex: '#FFFFFF', scale: 1.75, count: 200 },
      { name: 'cyan', hex: '#9EEAFF', scale: 1.65, count: 200 },
      { name: 'gold', hex: '#FFE4A6', scale: 1.6, count: 200 },
    ];

    this._s3StarCohorts = starCohortSpecs.map((spec) => {
      const mat = this._trackMat(
        createOpaqueEmissiveMat(this.scene, `p2_s3_star_${spec.name}`, spec.hex, spec.scale)
      );
      const mesh = B.MeshBuilder.CreateIcoSphere(
        `p2_s3_stars_${spec.name}`,
        { radius: 0.5, subdivisions: 1 },
        this.scene
      );
      mesh.material = mat;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.parent = this.s3Root;
      this._s3ThinMeshes.push(mesh);

      const stars = [];
      for (let i = 0; i < spec.count; i += 1) {
        // Place 72% in the forward cosmic field visible to S3 camera + 28% surrounding dome
        let px;
        let py;
        let pz;
        const r = 240 + rngStars() * 210;
        if (i < spec.count * 0.72) {
          const yaw = (rngStars() - 0.5) * 1.65 + 0.2; // centered along S3 sightline (+0.2 rad)
          const pitch = (rngStars() - 0.48) * 1.15;
          px = Math.sin(yaw) * Math.cos(pitch) * r;
          py = Math.sin(pitch) * r + 8;
          pz = Math.cos(yaw) * Math.cos(pitch) * r - 20;
        } else {
          const theta = rngStars() * Math.PI * 2;
          const phi = Math.acos(2 * rngStars() - 1);
          px = Math.sin(phi) * Math.cos(theta) * r;
          py = Math.cos(phi) * r;
          pz = Math.sin(phi) * Math.sin(theta) * r;
        }

        // Deterministic radial-outer-to-inner + jitter sequential blink-out threshold ∈ [0.02, 0.98]
        const angularDist = clamp(Math.hypot(px - 17, py - 17) / Math.max(120, r), 0, 1);
        const threshold = clamp(0.03 + (1 - angularDist * 0.55) * 0.55 + rngStars() * 0.42, 0.02, 0.98);
        const baseSize = (0.48 + Math.pow(rngStars(), 1.8) * 1.25) * (r / 300);
        const twinklePhase = rngStars() * Math.PI * 2;

        stars.push({ px, py, pz, baseSize, threshold, twinklePhase });
      }

      const buf = new Float32Array(spec.count * 16);
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      return { mesh, stars, buf };
    });

    // 3. Colossal 3-Tier Recursive 4D 8-Cell Megastructure anchored at (17, 17, 148)
    this._s3MegaCenter = new B.Vector3(17.0, 17.0, 148.0);
    const megaRoot = new B.TransformNode('p2_s3_megastructure_root', this.scene);
    megaRoot.position.copyFrom(this._s3MegaCenter);
    megaRoot.parent = this.s3Root;
    this._s3MegaRoot = megaRoot;

    // Dedicated megastructure illumination for faceted gold clasps & fractal sub-cells
    const s3MegaLight = this._trackLight(
      new B.PointLight('p2_s3_mega_core_light', new B.Vector3(17.0, 17.0, 118.0), this.scene),
      this._s3Lights
    );
    s3MegaLight.diffuse = B.Color3.FromHexString('#7EF6EC');
    s3MegaLight.specular = B.Color3.FromHexString('#FFE8A8');
    s3MegaLight.intensity = 6.5;
    s3MegaLight.range = 180;
    s3MegaLight.parent = this.s3Root;
    this._s3MegaLight = s3MegaLight;

    // 3-Tier cylindrical tubular beam meshes (32 edges per tier via ThinInstance!)
    const tierBeamSpecs = [
      { id: 'outer', mat: this.materials.tesseractCyanBeam, radius: 0.78 },
      { id: 'mid', mat: this.materials.tesseractGoldBeam, radius: 0.62 },
      { id: 'inner', mat: this.materials.tesseractCyanBeam, radius: 0.46 },
    ];
    this._s3TierBeams = tierBeamSpecs.map((spec) => {
      const cyl = B.MeshBuilder.CreateCylinder(
        `p2_s3_tess_beams_${spec.id}`,
        { diameter: 1.0, height: 1.0, tessellation: 10 },
        this.scene
      );
      cyl.material = spec.mat;
      cyl.alwaysSelectAsActiveMesh = true;
      cyl.parent = megaRoot;
      this._s3ThinMeshes.push(cyl);

      const buf = new Float32Array(32 * 16);
      cyl.thinInstanceSetBuffer('matrix', buf, 16, false);
      return { mesh: cyl, buf, radius: spec.radius };
    });

    // 16 Inter-tier 4D radial struts binding Outer <-> Mid hypercubes in sacred gold
    const bridgeStruts = B.MeshBuilder.CreateCylinder(
      'p2_s3_tess_bridge_struts',
      { diameter: 1.0, height: 1.0, tessellation: 8 },
      this.scene
    );
    bridgeStruts.material = this.materials.tesseractGoldBeam;
    bridgeStruts.alwaysSelectAsActiveMesh = true;
    bridgeStruts.parent = megaRoot;
    this._s3ThinMeshes.push(bridgeStruts);
    const bridgeBuf = new Float32Array(16 * 16);
    bridgeStruts.thinInstanceSetBuffer('matrix', bridgeBuf, 16, false);
    this._s3BridgeStruts = { mesh: bridgeStruts, buf: bridgeBuf };

    // Sculpted glowing vertex nodes across all 3 tiers (16 vertices per tier)
    const nodeSpecs = [
      { id: 'outer_clasp', mat: this.materials.hullAccentGold, size: 3.1, polyType: 1 },
      { id: 'outer_core', mat: this.materials.tesseractCyanBeam, size: 2.3, polyType: 1 },
      { id: 'mid_node', mat: this.materials.tesseractGoldBeam, size: 2.25, polyType: 1 },
      { id: 'inner_node', mat: this.materials.tesseractCyanBeam, size: 1.65, polyType: 1 },
    ];
    this._s3VertexNodes = nodeSpecs.map((spec) => {
      const nodeMesh = B.MeshBuilder.CreatePolyhedron(
        `p2_s3_tess_nodes_${spec.id}`,
        { type: spec.polyType, size: 0.5 },
        this.scene
      );
      nodeMesh.material = spec.mat;
      nodeMesh.alwaysSelectAsActiveMesh = true;
      nodeMesh.parent = megaRoot;
      this._s3ThinMeshes.push(nodeMesh);

      const buf = new Float32Array(16 * 16);
      nodeMesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      return { mesh: nodeMesh, buf, baseSize: spec.size };
    });

    // 64 Fractal Floating Cubic Micro-Cell Monoliths (2 ThinInstance cohorts × 32 cubes)
    const rngCells = createSeededRandom(8844);
    this._s3MicroCells = [
      { id: 'cyan', mat: this.materials.tesseractCyanBeam },
      { id: 'gold', mat: this.materials.tesseractGoldBeam },
    ].map((spec, cohortIdx) => {
      const count = 32;
      const box = B.MeshBuilder.CreateBox(
        `p2_s3_fractal_cells_${spec.id}`,
        { size: 1.0 },
        this.scene
      );
      box.material = spec.mat;
      box.alwaysSelectAsActiveMesh = true;
      box.parent = megaRoot;
      this._s3ThinMeshes.push(box);

      const defs = [];
      for (let i = 0; i < count; i += 1) {
        defs.push({
          edgeIdx: (i + cohortIdx * 11) % 32,
          tierIdx: i % 2, // 0 = outer, 1 = mid
          lerpT: 0.2 + rngCells() * 0.6,
          radialBoost: 1.04 + rngCells() * 0.24,
          size: 1.55 + rngCells() * 1.95,
          spinSpeed: (rngCells() - 0.5) * 0.9,
          phase: rngCells() * Math.PI * 2,
        });
      }
      const buf = new Float32Array(count * 16);
      box.thinInstanceSetBuffer('matrix', buf, 16, false);
      return { mesh: box, defs, buf };
    });

    // Central 4D Singularity Polyhedron Core + Ghost-safe Pulsing Corona Sphere
    const coreSolid = B.MeshBuilder.CreatePolyhedron(
      'p2_s3_singularity_core',
      { type: 3, size: 5.4 },
      this.scene
    );
    coreSolid.material = this.materials.tesseractGoldBeam;
    coreSolid.parent = megaRoot;

    const coreCoronaMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s3_core_corona_mat', '#7EF8EE', 0.42, 1.35)
    );
    const coreCorona = B.MeshBuilder.CreateSphere(
      'p2_s3_singularity_corona',
      { diameter: 21.0, segments: 24 },
      this.scene
    );
    coreCorona.material = coreCoronaMat;
    coreCorona.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    coreCorona.parent = megaRoot;

    const coreHaloDiscMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s3_core_disc_mat', '#F7C346', 0.34, 1.45)
    );
    const coreHaloDisc = B.MeshBuilder.CreateTorus(
      'p2_s3_singularity_ring',
      { diameter: 27.0, thickness: 0.55, tessellation: 56 },
      this.scene
    );
    coreHaloDisc.material = coreHaloDiscMat;
    coreHaloDisc.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    coreHaloDisc.parent = megaRoot;

    this._s3Core = { coreSolid, coreCorona, coreCoronaMat, coreHaloDisc, coreHaloDiscMat };

    // 4. Three Rotating Concentric Sacred Geometry Halos (Astronomical 4D Astrolabe Rings)
    const haloSpecs = [
      { id: 'outer', diameter: 126, thickness: 0.72, hex: PALETTE.accent.cyanW0, alpha: 0.48 },
      { id: 'mid', diameter: 94, thickness: 0.56, hex: PALETTE.accent.goldWPos, alpha: 0.52 },
      { id: 'inner', diameter: 66, thickness: 0.46, hex: '#C8FFF8', alpha: 0.45 },
    ];
    this._s3Halos = haloSpecs.map((spec) => {
      const hMat = this._trackMat(
        createGhostAdditiveMat(this.scene, `p2_s3_halo_mat_${spec.id}`, spec.hex, spec.alpha, 1.45)
      );
      const torus = B.MeshBuilder.CreateTorus(
        `p2_s3_sacred_halo_${spec.id}`,
        { diameter: spec.diameter, thickness: spec.thickness, tessellation: 72 },
        this.scene
      );
      torus.material = hMat;
      torus.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      torus.parent = megaRoot;
      return { mesh: torus, mat: hMat, baseAlpha: spec.alpha };
    });

    // 24 Sacred Astrolabe Cardinal Compass Ticks mounted on Outer Halo (1 ThinInstance draw call!)
    const tickMat = this._trackMat(
      createGhostAdditiveMat(this.scene, 'p2_s3_astrolabe_tick_mat', '#A5FCF2', 0.56, 1.4)
    );
    const tickMesh = B.MeshBuilder.CreateBox(
      'p2_s3_astrolabe_ticks',
      { width: 1, height: 1, depth: 1 },
      this.scene
    );
    tickMesh.material = tickMat;
    tickMesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    tickMesh.alwaysSelectAsActiveMesh = true;
    tickMesh.parent = this._s3Halos[0].mesh;
    this._s3ThinMeshes.push(tickMesh);

    const tickCount = 24;
    const tickBuf = new Float32Array(tickCount * 16);
    for (let i = 0; i < tickCount; i += 1) {
      const ang = (i / tickCount) * Math.PI * 2;
      const isCardinal = i % 6 === 0;
      const rad = 63.0 + (isCardinal ? 3.4 : 1.9);
      const px = Math.cos(ang) * rad;
      const pz = Math.sin(ang) * rad;
      const radialLen = isCardinal ? 6.8 : 3.4;
      writeUniformInstanceMatrix(
        tickBuf,
        i,
        px,
        0,
        pz,
        radialLen,
        0.45,
        isCardinal ? 0.85 : 0.45,
        0,
        -ang,
        0,
        this._tmp
      );
    }
    tickMesh.thinInstanceSetBuffer('matrix', tickBuf, 16, true);
    this._s3TickMat = tickMat;

    // 5. Six Monumental Sweeping Volumetric Light Shafts Radiating Down & Across the Cosmic Abyss
    const goldShaftMat = this._trackMat(
      createVolumetricShaftMaterial(this.scene, 'p2_s3_gold_shaft_mat', PALETTE.accent.goldWPos, 0.24)
    );
    this._s3GoldShaftMat = goldShaftMat;

    const shaftSpecs = [
      // Central downward cathedral ray washing directly from megastructure core toward lone flagship
      { dir: [-0.26, -0.78, -0.57], len: 162, w: 30, isGold: false },
      { dir: [0.36, -0.76, -0.54], len: 150, w: 24, isGold: true },
      { dir: [-0.74, -0.44, -0.51], len: 148, w: 22, isGold: false },
      { dir: [0.74, -0.36, -0.56], len: 144, w: 20, isGold: true },
      { dir: [-0.54, 0.68, -0.49], len: 136, w: 20, isGold: false },
      { dir: [0.56, 0.64, -0.52], len: 136, w: 20, isGold: true },
    ];

    this._s3Shafts = shaftSpecs.map((spec, idx) => {
      const plane = B.MeshBuilder.CreatePlane(
        `p2_s3_vol_shaft_${idx}`,
        { width: spec.w, height: spec.len },
        this.scene
      );
      const dLen = Math.hypot(spec.dir[0], spec.dir[1], spec.dir[2]) || 1;
      const dx = spec.dir[0] / dLen;
      const dy = spec.dir[1] / dLen;
      const dz = spec.dir[2] / dLen;

      // Anchor shaft so it originates near megastructure core and fans dramatically outward
      plane.position.set(dx * spec.len * 0.42, dy * spec.len * 0.42, dz * spec.len * 0.42);
      // Build orthonormal left-handed basis (right, up, normal) facing S3 camera (~(-0.2, 0.06, -0.97))
      const up = new B.Vector3(dx, dy, dz);
      const viewDir = new B.Vector3(-0.2, 0.06, -0.97).normalize();
      const right = B.Vector3.Cross(up, viewDir).normalize();
      const normal = B.Vector3.Cross(right, up).normalize();
      const rotMat = B.Matrix.FromValues(
        right.x, right.y, right.z, 0,
        up.x, up.y, up.z, 0,
        normal.x, normal.y, normal.z, 0,
        0, 0, 0, 1
      );
      plane.rotationQuaternion = B.Quaternion.FromRotationMatrix(rotMat);
      plane.material = spec.isGold ? goldShaftMat : this.materials.volumetricShaft;
      plane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      plane.parent = megaRoot;
      return plane;
    });

    // 6. Cosmic Quantum Dust ParticleSystem drifting between flagship and megastructure
    const cosmicDust = new B.ParticleSystem('p2_s3_cosmic_quantum_dust', 260, this.scene);
    cosmicDust.particleTexture = this._particleTex;
    cosmicDust.emitter = new B.Vector3(4, 6, 48);
    cosmicDust.minEmitBox = new B.Vector3(-56, -24, -56);
    cosmicDust.maxEmitBox = new B.Vector3(64, 48, 78);
    cosmicDust.color1 = new B.Color4(0.35, 0.94, 0.9, 0.56);
    cosmicDust.color2 = new B.Color4(0.98, 0.8, 0.34, 0.48);
    cosmicDust.colorDead = new B.Color4(0.3, 0.86, 0.88, 0.0);
    cosmicDust.minSize = 0.22;
    cosmicDust.maxSize = 0.72;
    cosmicDust.minLifeTime = 4.2;
    cosmicDust.maxLifeTime = 8.8;
    cosmicDust.emitRate = 48;
    cosmicDust.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    cosmicDust.gravity = new B.Vector3(0, 0.015, 0);
    cosmicDust.direction1 = new B.Vector3(-0.35, -0.18, -0.35);
    cosmicDust.direction2 = new B.Vector3(0.35, 0.32, 0.35);
    cosmicDust.minEmitPower = 0.14;
    cosmicDust.maxEmitPower = 0.52;
    cosmicDust.updateSpeed = 0.014;
    cosmicDust.preWarmCycles = 42;
    cosmicDust.preWarmStepOffset = 2;
    cosmicDust.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    cosmicDust._p2ShotId = 'S3';
    this._particleSystems.push(cosmicDust);
  }

  // -------------------------------------------------------------------------
  // Sub-Shot Activation & Deterministic Lifecycle
  // -------------------------------------------------------------------------

  _applyShotVisibility(shotId) {
    const showS1 = this.active && shotId === 'S1';
    const showS2 = this.active && shotId === 'S2';
    const showS3 = this.active && shotId === 'S3';

    this.s1Root.setEnabled(showS1);
    this.s2Root.setEnabled(showS2);
    this.s3Root.setEnabled(showS3);

    for (const m of this._s1ThinMeshes) m.isVisible = showS1;
    for (const m of this._s2ThinMeshes) m.isVisible = showS2;
    for (const m of this._s3ThinMeshes) m.isVisible = showS3;

    for (const l of this._s1Lights) l.setEnabled(showS1);
    for (const l of this._s2Lights) l.setEnabled(showS2);
    for (const l of this._s3Lights) l.setEnabled(showS3);

    for (const ps of this._particleSystems) {
      const shouldRun =
        (ps._p2ShotId === 'S1' && showS1) ||
        (ps._p2ShotId === 'S2' && showS2) ||
        (ps._p2ShotId === 'S3' && showS3);
      if (shouldRun) {
        if (!ps.isStarted()) ps.start();
      } else if (ps.isStarted()) {
        ps.stop();
        if (typeof ps.reset === 'function') ps.reset();
      }
    }
  }

  setActive(active) {
    this.active = Boolean(active);
    this.root.setEnabled(this.active);
    if (!this.active) {
      this._activeShotId = null;
      this._applyShotVisibility(null);
    } else {
      this._applyShotVisibility(this._activeShotId || 'S1');
    }
  }

  // -------------------------------------------------------------------------
  // Per-Frame Pure Deterministic Evaluator (100% Driven by snapshot.elapsedSec)
  // -------------------------------------------------------------------------

  evaluate(snapshot, _dtSec = 0) {
    if (!this.active || !snapshot) return;

    const t = Number.isFinite(snapshot.elapsedSec) ? snapshot.elapsedSec : 26.0;
    const shotId =
      snapshot.shotId === 'S1' || snapshot.shotId === 'S2' || snapshot.shotId === 'S3'
        ? snapshot.shotId
        : t < 35.0
          ? 'S1'
          : t < 44.0
            ? 'S2'
            : 'S3';

    if (this._activeShotId !== shotId) {
      this._activeShotId = shotId;
      this._applyShotVisibility(shotId);
    }

    if (shotId === 'S1') {
      this._evaluateS1(snapshot, t);
    } else if (shotId === 'S2') {
      this._evaluateS2(snapshot, t);
    } else {
      this._evaluateS3(snapshot, t);
    }
  }

  _evaluateS1(_snapshot, t) {
    // Calm serene cabin state: 07 号 Lin Xia working beside star chart, 08 号 peacefully sleeping
    this._s1Cabin.setAlertLevel(0, t);
    this._s1Cabin.setBowWindowIntact(true);
    this._s1Cabin.setLinXiaPose('working', 1.0, t);
    // Keep 07 号 Lin Xia prominently positioned at (0.62, 0, 1.55) facing the glowing holographic star chart
    if (this._s1Cabin.linXiaRig?.root) {
      this._s1Cabin.linXiaRig.root.position.set(0.62, 0, 1.55);
      this._s1Cabin.linXiaRig.root.rotation.y = -0.58;
      this._s1Cabin.linXiaRig.headPivot.rotation.set(0.14, -0.18, 0);
    }
    this._s1Cabin.setPod08State({
      mode: 'sleeping',
      openAmount: 0,
      alertPulse: 0,
      title: '08 号',
      subtitle: '冬眠中',
      accentHex: '#58A6FF',
    });

    // Subtle organic breathing of warm amber key/desk lamp & cool sapphire cryo-bay contrast
    const warmBreath = 0.96 + 0.04 * Math.sin(t * 1.4);
    if (this._s1Cabin.deskLampLight) {
      this._s1Cabin.deskLampLight.intensity = 3.2 * warmBreath;
    }
    if (this._s1WarmHeroKey) {
      this._s1WarmHeroKey.intensity = 4.6 * warmBreath;
    }
    if (this._s1Cabin.cryoBayLight) {
      this._s1Cabin.cryoBayLight.intensity = 3.1 + 0.16 * Math.sin(t * 0.9 + 1.1);
    }

    // Rotate floating 3-ring holographic star chart orrery deterministically
    const { holoOuter, holoMid, holoInner, holoCore, holoCloud } = this._s1HoloParts;
    this._s1HoloRoot.position.y = 1.34 + Math.sin(t * 1.15) * 0.016;
    holoOuter.rotation.set(0.42 + Math.sin(t * 0.35) * 0.08, t * 0.28, 0.18);
    holoMid.rotation.set(-0.62, -t * 0.44, 0.48 + Math.cos(t * 0.3) * 0.1);
    holoInner.rotation.set(t * 0.55, 0.35, -t * 0.38);
    holoCore.rotation.set(t * 0.4, t * 0.72, 0);
    holoCloud.rotation.y = t * 0.24;

    // Update serene cyan-blue warp-cruise starlight streaks strictly OUTSIDE bow window (tail z >= 6.8 > 6.2!)
    const zSpan = 74.0;
    for (const grp of this._s1StreakGroups) {
      const { mesh, items, buf } = grp;
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        const raw = ((it.zPhase - (t * it.speed) / zSpan) % 1 + 1) % 1;
        const minCenterZ = 6.8 + it.len * 0.5;
        const pz = minCenterZ + raw * zSpan;
        writeUniformInstanceMatrix(
          buf,
          i,
          it.x,
          it.y,
          pz,
          it.thick,
          it.thick,
          it.len,
          0,
          0,
          0,
          this._tmp
        );
      }
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
    }

    if (typeof this.materials.updateShaders === 'function') {
      this.materials.updateShaders(t, {
        shaftOpacity: 0.22,
        shaftColorHex: '#FFB357',
      });
    }
  }

  _evaluateS2(snapshot, t) {
    const B = globalThis.BABYLON;
    const localT = clamp(t - 35.0, 0, 9.0);

    // Smooth, constant-velocity unaware glide along +Z — strictly ZERO jolt or shudder!
    // At t=38.5s (KF-09): shipZ = +0.53 (mid-hull & fwd warp ring slicing dead-center through z = 0!)
    // At t=41.8s (KF-10): shipZ = +5.41 (entire hull + stern cleanly emerged on +Z side!)
    const shipZ = -4.65 + localT * 1.48;
    const shipY = 0.42 + Math.sin(t * 0.45) * 0.025;
    this._s2Flagship.root.position.set(0, shipY, shipZ);
    this._s2Flagship.root.rotation.set(0, 0, Math.sin(t * 0.35) * 0.015);

    // Calm steady warp ring rotation (unaware cruise)
    this._s2Flagship.setWarpPower(0.58, t);

    // Strict +2.0s predictive alert activation (alertLevel === 0 before 40.5s, > 0 at t >= 40.5s)
    const alert = clamp(Number.isFinite(snapshot.alertLevel) ? snapshot.alertLevel : 0, 0, 1);
    this._lastAlertLevel = alert;
    this._s2Flagship.setAlertLevel(alert, t);

    const alertPulse = 0.74 + 0.26 * Math.sin(t * 7.5);
    const showAlert = alert > 0.01;
    this._s2AlertRingMat.alpha = showAlert ? clamp(alert * 0.48 * alertPulse, 0, 0.54) : 0;
    this._s2CanopyAlertMat.alpha = showAlert ? clamp(alert * 0.28 * alertPulse, 0, 0.36) : 0;
    this._s2CanopyAlertHalo.isVisible = showAlert;

    for (let i = 0; i < this._s2AlertRings.length; i += 1) {
      const ring = this._s2AlertRings[i];
      ring.isVisible = showAlert;
      if (showAlert) {
        const wave = ((t * 0.95 + i / 3) % 1 + 1) % 1;
        const sc = 0.78 + wave * 0.82;
        ring.scaling.set(sc, sc, 1.0);
        ring.position.z = 4.6 + wave * 3.3;
      }
    }

    this._s2AlertLight.position.set(-0.6, shipY + 1.15, shipZ + 2.85);
    this._s2AlertLight.intensity = showAlert ? alert * 3.6 * alertPulse : 0;

    // Track crisp cool-silver hull rim & key lights along Flagship「远航者号」as it glides through the veil
    if (this._s2HullKey) {
      this._s2HullKey.position.set(-7.6, shipY + 4.8, shipZ + 3.6);
    }
    if (this._s2SilverRim) {
      this._s2SilverRim.position.set(-3.8, shipY + 3.2, shipZ + 2.2);
    }

    // Compute exact instantaneous hull cross-section piercing the Liquid-Mercury 4D Veil at z = 0
    // Ship local span scaled by 0.68: stern nozzles ~ -4.71, aft ring ~ -2.41, fwd ring ~ -0.75, canopy ~ +2.62, bow tip ~ +5.25
    const localSliceZ = (0 - shipZ) / 0.68; // ship-local Z coordinate currently crossing z = 0
    const isHullCrossing = localSliceZ >= -6.95 && localSliceZ <= 7.75;

    // Cross-sectional radius of the Voyager hull at localSliceZ (peaks at main hull & dual warp rings!)
    let crossRadius = 0.0;
    if (isHullCrossing) {
      const fuselageProfile = Math.exp(-Math.pow((localSliceZ - 0.5) / 4.2, 2)) * 1.45;
      const fwdRingBump = Math.exp(-Math.pow((localSliceZ + 1.1) / 0.85, 2)) * 1.15;
      const aftRingBump = Math.exp(-Math.pow((localSliceZ + 3.55) / 0.95, 2)) * 1.35;
      crossRadius = Math.max(0.45, (fuselageProfile + fwdRingBump + aftRingBump) * 0.88);
    }

    // Refined liquid-mercury ripple strength (dark-chrome/silver sheen without solid-white bloom blowout!)
    const entryRamp = smoothstep(35.0, 36.4, t);
    const exitDecay = 1 - smoothstep(40.2, 43.8, t) * 0.72;
    const rippleIntensity = clamp(entryRamp * exitDecay * (isHullCrossing ? 0.42 : 0.26), 0, 0.44);

    const activeCycle = ((t - 35.0) * 0.55) % 1;
    const shaderRippleRadius = isHullCrossing
      ? lerp(Math.max(1.5, crossRadius * 1.15), 7.0, activeCycle)
      : 3.6 + (t - 40.3) * 1.65;

    // Update Liquid-Mercury 4D Veil custom GLSL shader uniforms (translucent chrome-mercury, zero blown-out white disk)
    if (typeof this.materials.updateShaders === 'function') {
      this.materials.updateShaders(t, {
        rippleCenter: [0, shipY, 0],
        rippleRadius: shaderRippleRadius,
        rippleIntensity,
        veilOpacity: 0.64,
        thrusterPower: 0.58,
      });
    }

    // Update dynamic hull-contact intersection slice ring hugging the hull at z = 0 (strictly <= 0.38 alpha)
    const sliceVisible = isHullCrossing && crossRadius > 0.2;
    this._s2HullSlice.mesh.isVisible = sliceVisible;
    if (sliceVisible) {
      this._s2HullSlice.mesh.position.set(0, shipY, 0.025);
      this._s2HullSlice.mesh.scaling.set(crossRadius, crossRadius, 1.0);
      this._s2HullSlice.mat.alpha = clamp(0.36 * entryRamp, 0, 0.38);
    } else {
      this._s2HullSlice.mat.alpha = 0;
    }

    // Update 3 expanding concentric chrome-silver geometric intersection ripple rings at z = 0 (strictly <= 0.42 alpha)
    const ringStrength = clamp(entryRamp * exitDecay * (isHullCrossing ? 1.0 : 0.65), 0, 1.0);
    for (let i = 0; i < this._s2RippleRings.length; i += 1) {
      const r = this._s2RippleRings[i];
      const phase = ((localT * 0.42 + r.phaseOffset) % 1 + 1) % 1;
      const baseR = isHullCrossing ? Math.max(1.35, crossRadius * 0.96) : 2.1;
      const radius = lerp(baseR, 7.8 + i * 0.9, easeOutExpo(phase));
      const ringEnv = Math.sin(phase * Math.PI) * Math.pow(1 - phase, 0.45);
      const ringAlpha = clamp(ringEnv * ringStrength * (0.40 - i * 0.06), 0, 0.42);

      r.mesh.isVisible = ringAlpha > 0.012;
      r.mesh.position.set(0, shipY, 0.03 + i * 0.015);
      r.mesh.scaling.set(radius, radius, 1.0);
      r.mat.alpha = ringAlpha;
    }

    // Gentle serene cruise streaks drifting along -Z
    const { mesh: sMesh, items: sItems, buf: sBuf } = this._s2Streaks;
    const zMin = -32;
    const zSpan = 72;
    for (let i = 0; i < sItems.length; i += 1) {
      const it = sItems[i];
      const raw = ((it.zPhase - (t * it.speed) / zSpan) % 1 + 1) % 1;
      const pz = zMin + raw * zSpan;
      writeUniformInstanceMatrix(
        sBuf,
        i,
        it.x,
        it.y,
        pz,
        it.thick,
        it.thick,
        it.len,
        0,
        0,
        0,
        this._tmp
      );
    }
    sMesh.thinInstanceSetBuffer('matrix', sBuf, 16, false);

    // Subtle veil iridescence breathing on S2 rim light
    this._s2Lights[1].diffuse = B.Color3.Lerp(
      B.Color3.FromHexString('#7AEAF0'),
      B.Color3.FromHexString('#F7C346'),
      alert * 0.45
    );
  }

  _evaluateS3(snapshot, t) {
    const localT = clamp(t - 44.0, 0, 11.0);
    const extinction = clamp(
      Number.isFinite(snapshot.starExtinctionProgress) ? snapshot.starExtinctionProgress : 0,
      0,
      1
    );
    const specEnergy = clamp(snapshot.spectrometer?.energy ?? 0, 0, 1);

    // 1. Flagship warp freeze across 44.0 – 45.4s, settling into awestruck stillness below megastructure
    const freezeU = smoothstep(44.0, 45.5, t);
    const warpPower = lerp(0.55, 0.05, freezeU);
    this._s3Flagship.setWarpPower(warpPower, t);
    this._s3Flagship.setAlertLevel(0, t);

    // Subtle drift settling cleanly to rest as warp freezes
    const driftZ = lerp(-0.8, 0.0, easeOutExpo(freezeU));
    this._s3Flagship.root.position.set(
      this._s3ShipBasePos.x,
      this._s3ShipBasePos.y + Math.sin(t * 0.4) * 0.04,
      this._s3ShipBasePos.z + driftZ
    );

    // Fading warp-freeze streaks evaporate across 44.0 – 45.6s
    const freezeVis = 1 - smoothstep(44.0, 45.6, t);
    this._s3FreezeStreaks.mesh.isVisible = freezeVis > 0.01;
    if (freezeVis > 0.01) {
      this._s3FreezeMat.alpha = freezeVis * 0.52;
      const { mesh, items, buf } = this._s3FreezeStreaks;
      const slide = easeOutExpo(freezeU) * 6.5;
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        writeUniformInstanceMatrix(
          buf,
          i,
          it.x,
          it.y,
          it.z - slide,
          it.thick,
          it.thick,
          it.len * (0.25 + 0.75 * freezeVis),
          0,
          0,
          0,
          this._tmp
        );
      }
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
    }

    // 2. 600-Star Deterministic Sequential Extinction (blinking smoothly one by one into blackness!)
    let starsAlive = 0;
    const flashWindow = 0.045;
    for (const cohort of this._s3StarCohorts) {
      const { mesh, stars, buf } = cohort;
      let cohortAlive = 0;
      for (let i = 0; i < stars.length; i += 1) {
        const st = stars[i];
        const margin = st.threshold - extinction;
        if (margin <= 0 || extinction >= 0.995) {
          writeZeroMatrix(buf, i, this._tmp);
          continue;
        }
        cohortAlive += 1;
        // Poetic dying flare just before each star blinks out cleanly into absolute blackness
        let scaleMult = 0.88 + 0.14 * Math.sin(t * 2.1 + st.twinklePhase);
        if (margin < flashWindow) {
          const u = margin / flashWindow; // 1 -> 0 as star extinguishes
          const flashPeak = Math.sin(u * Math.PI);
          scaleMult = u * 0.85 + flashPeak * 1.45;
        }
        const s = st.baseSize * scaleMult;
        writeUniformInstanceMatrix(buf, i, st.px, st.py, st.pz, s, s, s, 0, 0, 0, this._tmp);
      }
      starsAlive += cohortAlive;
      mesh.isVisible = cohortAlive > 0;
      if (cohortAlive > 0) {
        mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      }
    }
    this._s3StarsRemaining = starsAlive;

    // 3. Colossal 3-Tier Recursive 4D 8-Cell Megastructure driven by computeRecursiveTesseract4D(t)
    const emerge = smoothstep(44.8, 49.4, t);
    const megaVisible = emerge > 0.005;
    this._s3MegaRoot.setEnabled(megaVisible);

    if (!megaVisible) {
      this._s3MegaLight.intensity = 0;
      return;
    }

    const emergeEase = easeInOutCubic(emerge);
    const megaScale = 27.8 * (0.72 + 0.28 * emergeEase); // Outer span ~115–132m at full emergence!
    const beamGrowth = 0.45 + 0.55 * emergeEase;
    const pulseBoost = 1.0 + specEnergy * 0.22;

    // True SO(4) 3-tier nested recursive 4D hypercube projection
    const tess = computeRecursiveTesseract4D(t);
    const edges = tess.edges;

    // Update all 3 tiers of cylindrical tubular beams (32 edges × 3 tiers = 96 gleaming 3D beams!)
    for (let tierIdx = 0; tierIdx < 3; tierIdx += 1) {
      const tier = tess.tiers[tierIdx];
      const beamRig = this._s3TierBeams[tierIdx];
      const verts = tier.vertices3;
      const rad = beamRig.radius * beamGrowth * (tierIdx === 2 ? pulseBoost : 1.0);

      for (let eIdx = 0; eIdx < edges.length; eIdx += 1) {
        const [aIdx, bIdx] = edges[eIdx];
        const va = verts[aIdx];
        const vb = verts[bIdx];
        writeBeamMatrix(
          beamRig.buf,
          eIdx,
          va[0] * megaScale,
          va[1] * megaScale,
          va[2] * megaScale,
          vb[0] * megaScale,
          vb[1] * megaScale,
          vb[2] * megaScale,
          rad,
          this._tmp
        );
      }
      beamRig.mesh.isVisible = true;
      beamRig.mesh.thinInstanceSetBuffer('matrix', beamRig.buf, 16, false);
    }

    // Update 16 inter-tier radial 4D bridge struts connecting Outer <-> Mid vertices
    const outerVerts = tess.tiers[0].vertices3;
    const midVerts = tess.tiers[1].vertices3;
    const innerVerts = tess.tiers[2].vertices3;
    const bridgeRad = 0.28 * beamGrowth;
    for (let vIdx = 0; vIdx < 16; vIdx += 1) {
      const vo = outerVerts[vIdx];
      const vm = midVerts[vIdx];
      writeBeamMatrix(
        this._s3BridgeStruts.buf,
        vIdx,
        vo[0] * megaScale,
        vo[1] * megaScale,
        vo[2] * megaScale,
        vm[0] * megaScale,
        vm[1] * megaScale,
        vm[2] * megaScale,
        bridgeRad,
        this._tmp
      );
    }
    this._s3BridgeStruts.mesh.isVisible = true;
    this._s3BridgeStruts.mesh.thinInstanceSetBuffer('matrix', this._s3BridgeStruts.buf, 16, false);

    // Update sculpted glowing vertex nodes across all 3 tiers
    const nodeVertSets = [outerVerts, outerVerts, midVerts, innerVerts];
    for (let nIdx = 0; nIdx < this._s3VertexNodes.length; nIdx += 1) {
      const nodeRig = this._s3VertexNodes[nIdx];
      const verts = nodeVertSets[nIdx];
      const nodeSize = nodeRig.baseSize * beamGrowth * (nIdx >= 1 ? pulseBoost : 1.0);
      const spin = t * (nIdx % 2 === 0 ? 0.35 : -0.5);
      for (let vIdx = 0; vIdx < 16; vIdx += 1) {
        const v = verts[vIdx];
        writeUniformInstanceMatrix(
          nodeRig.buf,
          vIdx,
          v[0] * megaScale,
          v[1] * megaScale,
          v[2] * megaScale,
          nodeSize,
          nodeSize,
          nodeSize,
          spin + vIdx * 0.3,
          spin * 0.7,
          0,
          this._tmp
        );
      }
      nodeRig.mesh.isVisible = true;
      nodeRig.mesh.thinInstanceSetBuffer('matrix', nodeRig.buf, 16, false);
    }

    // Update 64 Fractal Floating Cubic Micro-Cell Monoliths orbiting along outer/mid 4D edges
    const cellGrow = smoothstep(46.0, 50.2, t);
    for (const cohort of this._s3MicroCells) {
      const { mesh, defs, buf } = cohort;
      mesh.isVisible = cellGrow > 0.01;
      if (cellGrow <= 0.01) continue;

      for (let i = 0; i < defs.length; i += 1) {
        const d = defs[i];
        const verts = d.tierIdx === 0 ? outerVerts : midVerts;
        const [aIdx, bIdx] = edges[d.edgeIdx];
        const va = verts[aIdx];
        const vb = verts[bIdx];
        const u = clamp(d.lerpT + Math.sin(t * 0.45 + d.phase) * 0.14, 0.08, 0.92);
        const px = lerp(va[0], vb[0], u) * megaScale * d.radialBoost;
        const py = lerp(va[1], vb[1], u) * megaScale * d.radialBoost;
        const pz = lerp(va[2], vb[2], u) * megaScale * d.radialBoost;
        const sz = d.size * cellGrow * (0.92 + 0.16 * pulseBoost);
        const rot = t * d.spinSpeed + d.phase;
        writeUniformInstanceMatrix(buf, i, px, py, pz, sz, sz, sz, rot, rot * 0.7, rot * 0.4, this._tmp);
      }
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
    }

    // Update Central 4D Singularity Polyhedron Core & Tomb-Spectrometer-Synced Corona
    const { coreSolid, coreCorona, coreCoronaMat, coreHaloDisc, coreHaloDiscMat } = this._s3Core;
    const coreScale = emergeEase * (0.94 + 0.16 * specEnergy);
    coreSolid.scaling.setAll(coreScale);
    coreSolid.rotation.set(t * 0.32, t * 0.48, t * 0.21);

    const coronaScale = emergeEase * (0.92 + 0.24 * specEnergy + 0.06 * Math.sin(t * 2.4));
    coreCorona.scaling.setAll(coronaScale);
    coreCoronaMat.alpha = clamp(emergeEase * (0.28 + 0.26 * specEnergy), 0, 0.62);

    coreHaloDisc.scaling.setAll(emergeEase * (0.96 + 0.12 * specEnergy));
    coreHaloDisc.rotation.set(Math.PI * 0.35 + t * 0.22, -t * 0.34, 0.4);
    coreHaloDiscMat.alpha = clamp(emergeEase * (0.28 + 0.28 * specEnergy), 0, 0.68);

    // 4. Rotate 3 Concentric Sacred Geometry Halos (Cosmic 4D Astrolabe Rings)
    const haloScale = 0.78 + 0.22 * emergeEase;
    const [hOuter, hMid, hInner] = this._s3Halos;
    hOuter.mesh.scaling.setAll(haloScale);
    hOuter.mesh.rotation.set(Math.PI * 0.5 + 0.22, t * 0.09, 0.16);
    hOuter.mat.alpha = clamp(hOuter.baseAlpha * emergeEase * (0.9 + 0.22 * specEnergy), 0, 0.72);

    hMid.mesh.scaling.setAll(haloScale);
    hMid.mesh.rotation.set(Math.PI * 0.36 - 0.18 * Math.sin(t * 0.18), -t * 0.14, 0.68);
    hMid.mat.alpha = clamp(hMid.baseAlpha * emergeEase * (0.9 + 0.24 * specEnergy), 0, 0.75);

    hInner.mesh.scaling.setAll(haloScale);
    hInner.mesh.rotation.set(0.62 + t * 0.12, t * 0.19, -0.52);
    hInner.mat.alpha = clamp(hInner.baseAlpha * emergeEase * (0.88 + 0.26 * specEnergy), 0, 0.72);

    this._s3TickMat.alpha = clamp(0.56 * emergeEase, 0, 0.68);

    // 5. Volumetric Light Shafts & Megastructure Illumination breathing with Tomb energy
    const shaftOpacity = clamp(emergeEase * (0.22 + 0.14 * specEnergy), 0, 0.42);
    this._s3GoldShaftMat.alpha = clamp(emergeEase * (0.72 + 0.26 * specEnergy), 0, 0.96);
    for (let i = 0; i < this._s3Shafts.length; i += 1) {
      const sh = this._s3Shafts[i];
      sh.isVisible = emergeEase > 0.06;
      const sc = 0.75 + 0.25 * emergeEase;
      sh.scaling.set(sc * (0.94 + 0.12 * specEnergy), sc, 1.0);
    }

    this._s3MegaLight.intensity = emergeEase * (6.2 + 2.8 * specEnergy);
    this._s3Lights[0].intensity = 3.8 + 1.4 * emergeEase + 1.1 * specEnergy;

    if (typeof this.materials.updateShaders === 'function') {
      this.materials.updateShaders(t, {
        shaftOpacity,
        shaftColorHex: '#5CF0E2',
        thrusterPower: warpPower,
      });
    }

    // Touch localT cleanly for deterministic continuity telemetry
    if (localT < 0) {
      this._s3MegaLight.intensity = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Deterministic Particle Pre-Warming for Instant Crisp seekPrologue() Renders
  // -------------------------------------------------------------------------

  prewarmParticles(ticks = 18) {
    const count = Math.max(1, Math.min(64, Math.round(Number.isFinite(ticks) ? ticks : 18)));
    for (const ps of this._particleSystems) {
      if (!ps) continue;
      if (this._activeShotId && ps._p2ShotId && ps._p2ShotId !== this._activeShotId) continue;
      if (!ps.isStarted()) {
        ps.start();
      }
      const prevStep = ps.preWarmStepOffset;
      ps.preWarmStepOffset = 2;
      for (let i = 0; i < count; i += 1) {
        if (typeof ps.animate === 'function') {
          ps.animate(true);
        }
      }
      ps.preWarmStepOffset = prevStep;
    }
  }

  // -------------------------------------------------------------------------
  // Diagnostics & Zero-Leak Disposal (Contract D)
  // -------------------------------------------------------------------------

  getDiagnostics() {
    const activeHeroes = [];
    if (this.active) {
      if (this._activeShotId === 'S1') {
        activeHeroes.push(
          'science_cabin_s1',
          'linxia_07',
          'cryo_pod_08',
          'holo_star_chart',
          'warp_cruise_streaks'
        );
      } else if (this._activeShotId === 'S2') {
        activeHeroes.push(
          'flagship_voyager_s2',
          'liquid_mercury_4d_veil',
          'concentric_ripple_rings'
        );
        if (this._lastAlertLevel > 0.01) {
          activeHeroes.push('bow_predictive_alert');
        }
      } else if (this._activeShotId === 'S3') {
        activeHeroes.push(
          'flagship_voyager_s3',
          'star_extinction_600',
          'recursive_tesseract_4d_3tier',
          'sacred_halos',
          'volumetric_shafts'
        );
      }
    }

    const meshCount = this.root
      ? this.root.getChildMeshes(false).filter((m) => m.isEnabled() && m.isVisible).length
      : 0;

    return {
      segmentId: 'P2',
      active: this.active,
      shotId: this._activeShotId,
      meshCount,
      activeHeroes,
      particleSystems: this._particleSystems.length,
      starCount: this._s3StarCount,
      starsRemaining: this._s3StarsRemaining,
    };
  }

  dispose() {
    for (const ps of this._particleSystems) {
      if (ps.isStarted()) ps.stop();
      ps.dispose(false);
    }
    this._particleSystems.length = 0;

    for (const item of this._disposables) {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
    this._disposables.length = 0;

    for (const l of this._ownedLights) {
      l.dispose();
    }
    this._ownedLights.length = 0;

    if (this.root) {
      this.root.dispose();
      this.root = null;
    }

    for (const m of this._ownedMats) {
      m.dispose(false, true);
    }
    this._ownedMats.length = 0;

    for (const m of this._clonedMats) {
      m.dispose(false, false);
    }
    this._clonedMats.length = 0;

    for (const tex of this._ownedTex) {
      tex.dispose();
    }
    this._ownedTex.length = 0;
  }
}
