/**
 * Beyond 3D — Prologue Act III: Segment P3 · 空间折纸 (55.0s – 75.0s)
 *
 * Implements Contract D (`SegmentP3Origami`) for Shots S4-1, S4-2, S5, and S6:
 * - S4-1 (55.0–61.0s): Meteor dive into curved-bow Science Cabin, 6-face intact sealed
 *   borosilicate box with 4D calibration sphere wall-passage, sweeping cyan 4D X-Ray interior
 *   cutaway wave, and silent 90° orthogonal bow glass fracture into 216 weightless luminous shards.
 * - S4-2 (61.0–64.0s): Whip-pan to hero 08 号 cryo-pod emerald emergency wake-up, articulated
 *   canopy opening, pressurized cryogenic mist, and 07 号 Lin Xia turning urgently toward 08 号.
 * - S5   (64.0–71.0s): First-person 08 号 POV architectural ±90° 4D bridge origami unfolding
 *   along glowing cyan-gold hinges into pure abstract luminous polar-day geometric space.
 * - S6   (71.0–75.0s): Radiant pure-white polar-day geometric light wave domes & serene
 *   decoupled handoff (zero dialogue, zero legacy corridor geometry).
 *
 * Strictly enforces Ghost translucency invariants: every translucent/shader/glass/halo/wave
 * material explicitly sets disableDepthWrite = true and needDepthPrePass = false.
 */

import {
  computeBridgeOrigamiAngles,
  computeRecursiveTesseract4D,
  computeSealedBoxOrb4D,
} from '../../core/prologue-timeline.js';
import { PALETTE, RENDER_GROUPS } from '../../engine/phase-materials.js';
import {
  clamp,
  createScienceCabinCore,
  easeInOutCubic,
  easeOutExpo,
  lerp,
  smoothstep,
} from './prologue-shared.js';

const BOW_ARC_ROT_Y = Math.PI + (Math.PI * 0.5 - 0.32 * Math.PI);
const BOX_CENTER_WORLD = Object.freeze([0.0, 1.13, 2.05]);
const BOX_HALF = 0.22;
const POD08_POS = Object.freeze([-2.3, 0.0, -1.6]);

// ---------------------------------------------------------------------------
// Deterministic Hash & Procedural Texture Helpers (100% Offline, SwiftShader-Safe)
// ---------------------------------------------------------------------------

function hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function createSoftRadialParticleTexture(scene, name, innerRgba, midRgba, outerRgba) {
  const B = globalThis.BABYLON;
  const size = 128;
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const half = size * 0.5;
    const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
    grad.addColorStop(0.0, innerRgba);
    grad.addColorStop(0.38, midRgba);
    grad.addColorStop(0.76, outerRgba);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.update();
  }
  return tex;
}

/**
 * Generate a 512x512 crisp rectilinear 90° orthogonal 4D lattice fracture texture
 * with glowing cyan, platinum, and gold fissures plus luminous intersection nodes.
 */
function createOrthogonalCrackTexture(scene, name) {
  const B = globalThis.BABYLON;
  const size = 512;
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  if (!ctx) return tex;

  ctx.clearRect(0, 0, size, size);

  const drawOrthoLine = (x1, y1, x2, y2, width, strokeStyle, shadowBlur = 0, shadowColor = '#4DE6D3') => {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.lineCap = 'square';
    if (shadowBlur > 0) {
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = shadowColor;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  // Recursive rectilinear 90° orthogonal subdivision cells (pure 4D hypercube fracture geometry)
  const cells = [{ x: 12, y: 12, w: size - 24, h: size - 24, depth: 0 }];
  const nodes = [];
  let idx = 0;

  while (cells.length > 0) {
    const cell = cells.pop();
    idx += 1;
    if (cell.depth >= 4 || cell.w < 34 || cell.h < 34) continue;

    const splitVert = cell.depth % 2 === 0 ? cell.w >= cell.h * 0.72 : cell.h < cell.w * 0.72;
    const ratio = 0.32 + hash01(idx * 3.7 + cell.depth * 19.1) * 0.36;
    const isGold = hash01(idx * 11.3) > 0.64;
    const glowColor = isGold ? '#F7C346' : '#4DE6D3';
    const coreColor = isGold ? '#FFF4CC' : '#E6FFFF';
    const lineW = Math.max(1.2, 4.0 - cell.depth * 0.7);

    if (splitVert) {
      const sx = Math.round(cell.x + cell.w * ratio);
      drawOrthoLine(sx, cell.y, sx, cell.y + cell.h, lineW + 2.4, glowColor, 8, glowColor);
      drawOrthoLine(sx, cell.y, sx, cell.y + cell.h, lineW * 0.65, coreColor, 0);
      nodes.push([sx, cell.y, isGold], [sx, cell.y + cell.h, isGold]);

      const leftW = sx - cell.x;
      const rightW = cell.x + cell.w - sx;
      cells.push({ x: cell.x, y: cell.y, w: leftW, h: cell.h, depth: cell.depth + 1 });
      cells.push({ x: sx, y: cell.y, w: rightW, h: cell.h, depth: cell.depth + 1 });
    } else {
      const sy = Math.round(cell.y + cell.h * ratio);
      drawOrthoLine(cell.x, sy, cell.x + cell.w, sy, lineW + 2.4, glowColor, 8, glowColor);
      drawOrthoLine(cell.x, sy, cell.x + cell.w, sy, lineW * 0.65, coreColor, 0);
      nodes.push([cell.x, sy, isGold], [cell.x + cell.w, sy, isGold]);

      const topH = sy - cell.y;
      const botH = cell.y + cell.h - sy;
      cells.push({ x: cell.x, y: cell.y, w: cell.w, h: topH, depth: cell.depth + 1 });
      cells.push({ x: cell.x, y: sy, w: cell.w, h: botH, depth: cell.depth + 1 });
    }
  }

  // Luminous crystalline intersection sparks at 90° junctions
  for (let i = 0; i < nodes.length; i += 1) {
    const [nx, ny, isGold] = nodes[i];
    const r = 3.2 + hash01(i * 5.9) * 3.8;
    const grad = ctx.createRadialGradient(nx, ny, 0.5, nx, ny, r * 2.2);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.45, isGold ? 'rgba(247,195,70,0.85)' : 'rgba(77,230,211,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(nx, ny, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  tex.update();
  return tex;
}

/**
 * Pure abstract polar-day geometric grid texture for infinite unfolded S5/S6 space
 * (zero corridor walls, zero text, pure architectural light geometry).
 */
function createPolarGeometricGridTexture(scene, name) {
  const B = globalThis.BABYLON;
  const size = 512;
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  if (!ctx) return tex;

  ctx.clearRect(0, 0, size, size);

  // Delicate luminous platinum-cyan architectural grid
  const majorStep = 128;
  const minorStep = 32;

  ctx.strokeStyle = 'rgba(130, 224, 232, 0.24)';
  ctx.lineWidth = 1.5;
  for (let p = 0; p <= size; p += minorStep) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 244, 214, 0.78)';
  ctx.lineWidth = 3.5;
  for (let p = 0; p <= size; p += majorStep) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Subtle glowing crosshairs at major vertices
  for (let x = 0; x <= size; x += majorStep) {
    for (let y = 0; y <= size; y += majorStep) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }

  tex.uScale = 6;
  tex.vScale = 6;
  tex.update();
  return tex;
}

/**
 * Build a 4x4 thin-instance column-major transformation matrix directly from
 * position, Euler rotation, and non-uniform scale using reusable scratch objects.
 */
function writeMatrixToBuffer(buffer, index, pos, rot, scale, tmpQ, tmpM, tmpPos, tmpScale) {
  const B = globalThis.BABYLON;
  B.Quaternion.FromEulerAnglesToRef(rot[0], rot[1], rot[2], tmpQ);
  tmpScale.set(scale[0], scale[1], scale[2]);
  tmpPos.set(pos[0], pos[1], pos[2]);
  B.Matrix.ComposeToRef(tmpScale, tmpQ, tmpPos, tmpM);
  tmpM.copyToArray(buffer, index * 16);
}

/**
 * Write a thin-instance matrix orienting a unit Y-aligned cylinder (height = 1, radius = 0.5)
 * between world-space points a and b with given thickness radius.
 */
function writeBeamMatrixToBuffer(buffer, index, ax, ay, az, bx, by, bz, diameter, tmpV, tmpUp, tmpQ, tmpM, tmpPos, tmpScale) {
  const B = globalThis.BABYLON;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) {
    tmpScale.set(0.0001, 0.0001, 0.0001);
    tmpPos.set(ax, ay, az);
    tmpQ.set(0, 0, 0, 1);
    B.Matrix.ComposeToRef(tmpScale, tmpQ, tmpPos, tmpM);
    tmpM.copyToArray(buffer, index * 16);
    return;
  }

  tmpV.set(dx / len, dy / len, dz / len);
  const dot = clamp(B.Vector3.Dot(tmpUp, tmpV), -1, 1);
  if (dot > 0.9999) {
    tmpQ.set(0, 0, 0, 1);
  } else if (dot < -0.9999) {
    B.Quaternion.RotationAxisToRef(B.Axis.X, Math.PI, tmpQ);
  } else {
    const axis = B.Vector3.Cross(tmpUp, tmpV).normalize();
    B.Quaternion.RotationAxisToRef(axis, Math.acos(dot), tmpQ);
  }

  tmpPos.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  tmpScale.set(diameter, len, diameter);
  B.Matrix.ComposeToRef(tmpScale, tmpQ, tmpPos, tmpM);
  tmpM.copyToArray(buffer, index * 16);
}

// ---------------------------------------------------------------------------
// Segment P3: 空间折纸 (55.0s – 75.0s)
// ---------------------------------------------------------------------------

export class SegmentP3Origami {
  constructor(scene, materials, sharedRig = {}) {
    const B = globalThis.BABYLON;
    this.scene = scene;
    this.materials = materials;
    this.sharedRig = sharedRig || {};
    this.segmentId = 'P3';
    this.active = false;
    this._lastEvaluatedSec = null;

    this.root = new B.TransformNode('prologue_p3_root', scene);
    if (this.sharedRig.root) {
      this.root.parent = this.sharedRig.root;
    }

    this._ownedMats = [];
    this._ownedTex = [];
    this._ownedLights = [];
    this._particleSystems = [];
    this._activeHeroes = ['science_cabin', 'sealed_box_orb', 'pod_08', 'lin_xia_07'];

    // Scratch math objects for zero-GC per-frame updates
    this._tmpQ = new B.Quaternion();
    this._tmpM = new B.Matrix();
    this._tmpPos = new B.Vector3();
    this._tmpScale = new B.Vector3();
    this._tmpDir = new B.Vector3();
    this._tmpUp = new B.Vector3(0, 1, 0);

    // Build all P3 cinema layers
    this._buildOwnedMaterials();
    this._buildCabinAndOrigamiExtensions();
    this._buildExteriorCosmicBackdrop();
    this._buildSealedBorosilicateBoxHero();
    this._buildXrayCutawaySystem();
    this._buildOrthogonalBowShatterSystem();
    this._buildCryoWakeupRig();
    this._buildPolarOrigamiVistaAndWaveDomes();
    this._buildParticleSystems();

    // Start disabled until PrologueScene activates P3
    this.setActive(false);
  }

  _trackMat(mat) {
    this._ownedMats.push(mat);
    return mat;
  }

  _trackTex(tex) {
    this._ownedTex.push(tex);
    return tex;
  }

  _trackLight(light) {
    this._ownedLights.push(light);
    return light;
  }

  // -------------------------------------------------------------------------
  // 1. P3-Owned Specialized PBR & Translucent Materials (Strict Ghost Safety)
  // -------------------------------------------------------------------------

  _buildOwnedMaterials() {
    const B = globalThis.BABYLON;

    // Cloned P3 cabin bulkhead PBR so S5 can smoothly brighten dark titanium into polar platinum
    // without mutating the shared materials.cabinDarkTitanium used by P2.
    this.p3BulkheadMat = this._trackMat(this.materials.cabinDarkTitanium.clone('p3_cabin_bulkhead_pbr'));
    this.p3BulkheadMat.disableDepthWrite = false;
    this.p3BulkheadMat.needDepthPrePass = false;

    // Museum-grade sealed borosilicate sample box glass (high clearcoat specular, Ghost-safe)
    this.sealedGlassMat = this._trackMat(new B.PBRMaterial('p3_sealed_box_glass_pbr', this.scene));
    this.sealedGlassMat.albedoColor = B.Color3.FromHexString('#E4FBFF');
    this.sealedGlassMat.emissiveColor = B.Color3.FromHexString('#74EBF5').scale(0.16);
    this.sealedGlassMat.metallic = 0.14;
    this.sealedGlassMat.roughness = 0.04;
    this.sealedGlassMat.clearCoat.isEnabled = true;
    this.sealedGlassMat.clearCoat.intensity = 1.0;
    this.sealedGlassMat.clearCoat.roughness = 0.02;
    this.sealedGlassMat.alpha = 0.27;
    this.sealedGlassMat.backFaceCulling = false;
    this.sealedGlassMat.disableDepthWrite = true;
    this.sealedGlassMat.needDepthPrePass = false;
    this.sealedGlassMat._isPrologueTranslucent = true;

    // 4D W-axis phase contour halo & glass wall intersection ring (ALPHA_ADD, Ghost-safe)
    this.phaseHaloMat = this._trackMat(new B.StandardMaterial('p3_phase_halo_mat', this.scene));
    this.phaseHaloMat.diffuseColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    this.phaseHaloMat.emissiveColor = B.Color3.FromHexString('#7CF8EE').scale(1.65);
    this.phaseHaloMat.disableLighting = true;
    this.phaseHaloMat.alpha = 0.85;
    this.phaseHaloMat.alphaMode = B.Engine.ALPHA_ADD;
    this.phaseHaloMat.backFaceCulling = false;
    this.phaseHaloMat.disableDepthWrite = true;
    this.phaseHaloMat.needDepthPrePass = false;
    this.phaseHaloMat._isPrologueTranslucent = true;

    // Soft phase aura shell around calibration sphere during |w| > 0
    this.phaseAuraMat = this._trackMat(new B.StandardMaterial('p3_phase_aura_mat', this.scene));
    this.phaseAuraMat.diffuseColor = B.Color3.FromHexString('#A5FCF2');
    this.phaseAuraMat.emissiveColor = B.Color3.FromHexString('#4DE6D3').scale(1.2);
    this.phaseAuraMat.disableLighting = true;
    this.phaseAuraMat.alpha = 0.28;
    this.phaseAuraMat.alphaMode = B.Engine.ALPHA_ADD;
    this.phaseAuraMat.backFaceCulling = false;
    this.phaseAuraMat.disableDepthWrite = true;
    this.phaseAuraMat.needDepthPrePass = false;
    this.phaseAuraMat._isPrologueTranslucent = true;

    // 4D wall-passage luminous wake filament & echo rings
    this.phaseWakeMat = this._trackMat(new B.StandardMaterial('p3_phase_wake_mat', this.scene));
    this.phaseWakeMat.diffuseColor = B.Color3.FromHexString('#8AF6EC');
    this.phaseWakeMat.emissiveColor = B.Color3.FromHexString('#4DE6D3').scale(1.35);
    this.phaseWakeMat.disableLighting = true;
    this.phaseWakeMat.alpha = 0.48;
    this.phaseWakeMat.alphaMode = B.Engine.ALPHA_ADD;
    this.phaseWakeMat.backFaceCulling = false;
    this.phaseWakeMat.disableDepthWrite = true;
    this.phaseWakeMat.needDepthPrePass = false;
    this.phaseWakeMat._isPrologueTranslucent = true;

    // Sweeping X-Ray planar scan curtain (Ghost-safe)
    this.xrayPlaneMat = this._trackMat(new B.StandardMaterial('p3_xray_plane_mat', this.scene));
    this.xrayPlaneMat.diffuseColor = B.Color3.FromHexString('#4DE6D3');
    this.xrayPlaneMat.emissiveColor = B.Color3.FromHexString('#6CF8ED').scale(1.3);
    this.xrayPlaneMat.disableLighting = true;
    this.xrayPlaneMat.alpha = 0.16;
    this.xrayPlaneMat.alphaMode = B.Engine.ALPHA_ADD;
    this.xrayPlaneMat.backFaceCulling = false;
    this.xrayPlaneMat.disableDepthWrite = true;
    this.xrayPlaneMat.needDepthPrePass = false;
    this.xrayPlaneMat._isPrologueTranslucent = true;

    // Internal X-Ray structural wireframe ribs (cyan) & internal quantum conduits (gold)
    this.xrayRibCyanMat = this._trackMat(new B.StandardMaterial('p3_xray_rib_cyan_mat', this.scene));
    this.xrayRibCyanMat.diffuseColor = B.Color3.FromHexString('#4DE6D3');
    this.xrayRibCyanMat.emissiveColor = B.Color3.FromHexString('#6CF5EA').scale(1.55);
    this.xrayRibCyanMat.disableLighting = true;
    this.xrayRibCyanMat.alpha = 0.72;
    this.xrayRibCyanMat.alphaMode = B.Engine.ALPHA_ADD;
    this.xrayRibCyanMat.backFaceCulling = false;
    this.xrayRibCyanMat.disableDepthWrite = true;
    this.xrayRibCyanMat.needDepthPrePass = false;
    this.xrayRibCyanMat._isPrologueTranslucent = true;

    this.xrayConduitGoldMat = this._trackMat(new B.StandardMaterial('p3_xray_conduit_gold_mat', this.scene));
    this.xrayConduitGoldMat.diffuseColor = B.Color3.FromHexString(PALETTE.accent.goldWPos);
    this.xrayConduitGoldMat.emissiveColor = B.Color3.FromHexString('#FFD46B').scale(1.55);
    this.xrayConduitGoldMat.disableLighting = true;
    this.xrayConduitGoldMat.alpha = 0.78;
    this.xrayConduitGoldMat.alphaMode = B.Engine.ALPHA_ADD;
    this.xrayConduitGoldMat.backFaceCulling = false;
    this.xrayConduitGoldMat.disableDepthWrite = true;
    this.xrayConduitGoldMat.needDepthPrePass = false;
    this.xrayConduitGoldMat._isPrologueTranslucent = true;

    // Orthogonal 90° bow glass fracture lattice material (Ghost-safe)
    this.crackTex = this._trackTex(createOrthogonalCrackTexture(this.scene, 'p3_bow_crack_tex'));
    this.crackMat = this._trackMat(new B.StandardMaterial('p3_bow_crack_mat', this.scene));
    this.crackMat.diffuseTexture = this.crackTex;
    this.crackMat.emissiveTexture = this.crackTex;
    this.crackMat.useAlphaFromDiffuseTexture = true;
    this.crackMat.emissiveColor = B.Color3.White().scale(1.45);
    this.crackMat.disableLighting = true;
    this.crackMat.alpha = 0.0;
    this.crackMat.alphaMode = B.Engine.ALPHA_ADD;
    this.crackMat.backFaceCulling = false;
    this.crackMat.disableDepthWrite = true;
    this.crackMat.needDepthPrePass = false;
    this.crackMat._isPrologueTranslucent = true;

    // Companion gold-cyan refractive crystal prism shards (Ghost-safe)
    this.shardGoldPrismMat = this._trackMat(new B.PBRMaterial('p3_shard_gold_prism_pbr', this.scene));
    this.shardGoldPrismMat.albedoColor = B.Color3.FromHexString('#FFF2CC');
    this.shardGoldPrismMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(1.25);
    this.shardGoldPrismMat.metallic = 0.65;
    this.shardGoldPrismMat.roughness = 0.08;
    this.shardGoldPrismMat.clearCoat.isEnabled = true;
    this.shardGoldPrismMat.clearCoat.intensity = 1.0;
    this.shardGoldPrismMat.alpha = 0.56;
    this.shardGoldPrismMat.backFaceCulling = false;
    this.shardGoldPrismMat.disableDepthWrite = true;
    this.shardGoldPrismMat.needDepthPrePass = false;
    this.shardGoldPrismMat._isPrologueTranslucent = true;

    // Emerald emergency wake beacon cone & halo over 08 号 cryo-pod (Ghost-safe)
    this.emeraldHaloMat = this._trackMat(new B.StandardMaterial('p3_emerald_halo_mat', this.scene));
    this.emeraldHaloMat.diffuseColor = B.Color3.FromHexString(PALETTE.accent.emerald);
    this.emeraldHaloMat.emissiveColor = B.Color3.FromHexString('#69F0AE').scale(1.55);
    this.emeraldHaloMat.disableLighting = true;
    this.emeraldHaloMat.alpha = 0.0;
    this.emeraldHaloMat.alphaMode = B.Engine.ALPHA_ADD;
    this.emeraldHaloMat.backFaceCulling = false;
    this.emeraldHaloMat.disableDepthWrite = true;
    this.emeraldHaloMat.needDepthPrePass = false;
    this.emeraldHaloMat._isPrologueTranslucent = true;

    // Infinite polar-day geometric grid floor/horizon sheet (Ghost-safe)
    this.polarGridTex = this._trackTex(createPolarGeometricGridTexture(this.scene, 'p3_polar_grid_tex'));
    this.polarGridMat = this._trackMat(new B.StandardMaterial('p3_polar_grid_mat', this.scene));
    this.polarGridMat.diffuseTexture = this.polarGridTex;
    this.polarGridMat.emissiveTexture = this.polarGridTex;
    this.polarGridMat.useAlphaFromDiffuseTexture = true;
    this.polarGridMat.emissiveColor = B.Color3.FromHexString('#EAF8FF').scale(1.25);
    this.polarGridMat.disableLighting = true;
    this.polarGridMat.alpha = 0.0;
    this.polarGridMat.alphaMode = B.Engine.ALPHA_ADD;
    this.polarGridMat.backFaceCulling = false;
    this.polarGridMat.disableDepthWrite = true;
    this.polarGridMat.needDepthPrePass = false;
    this.polarGridMat._isPrologueTranslucent = true;

    // S6 Polar-day expanding pure-white geometric wave shell material (Ghost-safe)
    this.polarWaveMat = this._trackMat(new B.StandardMaterial('p3_polar_wave_mat', this.scene));
    this.polarWaveMat.diffuseColor = B.Color3.White();
    this.polarWaveMat.emissiveColor = B.Color3.FromHexString('#F6FCFF').scale(1.65);
    this.polarWaveMat.disableLighting = true;
    this.polarWaveMat.alpha = 0.0;
    this.polarWaveMat.alphaMode = B.Engine.ALPHA_ADD;
    this.polarWaveMat.backFaceCulling = false;
    this.polarWaveMat.disableDepthWrite = true;
    this.polarWaveMat.needDepthPrePass = false;
    this.polarWaveMat._isPrologueTranslucent = true;

    // S6 Polar-day pure-white geometric rim wireframe shell (Ghost-safe)
    this.polarWaveEdgeMat = this._trackMat(new B.StandardMaterial('p3_polar_wave_edge_mat', this.scene));
    this.polarWaveEdgeMat.diffuseColor = B.Color3.FromHexString('#FFF7DF');
    this.polarWaveEdgeMat.emissiveColor = B.Color3.FromHexString('#FFFFFF').scale(1.85);
    this.polarWaveEdgeMat.disableLighting = true;
    this.polarWaveEdgeMat.wireframe = true;
    this.polarWaveEdgeMat.alpha = 0.0;
    this.polarWaveEdgeMat.alphaMode = B.Engine.ALPHA_ADD;
    this.polarWaveEdgeMat.backFaceCulling = false;
    this.polarWaveEdgeMat.disableDepthWrite = true;
    this.polarWaveEdgeMat.needDepthPrePass = false;
    this.polarWaveEdgeMat._isPrologueTranslucent = true;

    // S6 Soft pure-white polar horizon wrap veil (Ghost-safe)
    this.polarWhiteDomeMat = this._trackMat(new B.StandardMaterial('p3_polar_white_dome_mat', this.scene));
    this.polarWhiteDomeMat.diffuseColor = B.Color3.White();
    this.polarWhiteDomeMat.emissiveColor = B.Color3.White().scale(1.3);
    this.polarWhiteDomeMat.disableLighting = true;
    this.polarWhiteDomeMat.alpha = 0.0;
    this.polarWhiteDomeMat.backFaceCulling = false;
    this.polarWhiteDomeMat.disableDepthWrite = true;
    this.polarWhiteDomeMat.needDepthPrePass = false;
    this.polarWhiteDomeMat._isPrologueTranslucent = true;

    // Distant cosmic dying-star point material (Ghost-safe)
    this.distantStarMat = this._trackMat(new B.StandardMaterial('p3_distant_star_mat', this.scene));
    this.distantStarMat.diffuseColor = B.Color3.FromHexString('#CFE8FF');
    this.distantStarMat.emissiveColor = B.Color3.FromHexString('#E4F4FF').scale(1.4);
    this.distantStarMat.disableLighting = true;
    this.distantStarMat.alpha = 0.85;
    this.distantStarMat.alphaMode = B.Engine.ALPHA_ADD;
    this.distantStarMat.disableDepthWrite = true;
    this.distantStarMat.needDepthPrePass = false;
    this.distantStarMat._isPrologueTranslucent = true;
  }

  // -------------------------------------------------------------------------
  // 2. Shared Science Cabin Core + True Outward 90° Origami Repivoting
  // -------------------------------------------------------------------------

  _buildCabinAndOrigamiExtensions() {
    const B = globalThis.BABYLON;

    this.cabin = createScienceCabinCore(this.scene, this.materials, 'p3_cabin', {
      registerShadowCaster: this.sharedRig.registerShadowCaster,
      registerMirrorMesh: this.sharedRig.registerMirrorMesh,
    });
    this.cabin.root.parent = this.root;

    // Align bowWindowMesh arc concentrically onto the +Z panoramic mullions
    if (this.cabin.bowWindowMesh) {
      this.cabin.bowWindowMesh.rotation.y = BOW_ARC_ROT_Y;
    }

    // Reassign P3-owned cloned bulkhead material onto cabin walls & ceiling for S5 polar wash
    const bulkheadNames = ['p3_cabin_ceiling_slab', 'p3_cabin_wall_-1', 'p3_cabin_wall_1', 'p3_cabin_aft_wall'];
    for (const child of this.cabin.root.getChildMeshes()) {
      if (bulkheadNames.includes(child.name)) {
        child.material = this.p3BulkheadMat;
      }
    }

    // Repivot ceilingPivot to the front ceiling-bow seam (0, 4.15, +4.95) and floorPivot to rear seam (0, 0, -4.70)
    // so angle = 0 is millimeter-identical to S1/S4, while S5 unfolds OUTWARD without blocking camera POV!
    const { ceilingPivot, floorPivot, leftWallPivot, rightWallPivot, bowUpperPivot, bowLowerPivot, hingeBars } =
      this.cabin.origamiPivots;

    ceilingPivot.position.set(0, 4.15, 4.95);
    for (const child of ceilingPivot.getChildren()) {
      if (child.position) child.position.z -= 4.95;
    }

    floorPivot.position.set(0, 0, -4.7);
    for (const child of floorPivot.getChildren()) {
      if (child.position) child.position.z += 4.7;
    }

    // Add extra high-visibility architectural 4D hinge ribbons along bow corner seams (+8mm non-coplanar offset)
    this._extraHingeBars = [];
    const addHinge = (name, w, h, pos, rot, parent) => {
      const bar = B.MeshBuilder.CreatePlane(name, { width: w, height: h }, this.scene);
      bar.position.set(pos[0], pos[1], pos[2]);
      bar.rotation.set(rot[0], rot[1], rot[2]);
      bar.material = this.materials.origamiHingeGlow;
      bar.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      bar.isVisible = false;
      bar.parent = parent;
      this._extraHingeBars.push(bar);
      hingeBars.push(bar);
    };

    // Vertical port & starboard bow frame seam hinges
    addHinge('p3_hinge_vert_l', 4.2, 0.34, [0.09, 2.08, 4.88], [0, 0, Math.PI * 0.5], leftWallPivot);
    addHinge('p3_hinge_vert_r', 4.2, 0.34, [-0.09, 2.08, 4.88], [0, 0, Math.PI * 0.5], rightWallPivot);
    // Floor front seam hinge & ceiling front seam hinge
    addHinge('p3_hinge_floor_fwd', 8.7, 0.38, [0, 0.04, 9.64], [Math.PI * 0.5, 0, 0], floorPivot);
    addHinge('p3_hinge_ceil_fwd', 8.7, 0.38, [0, -0.05, -0.05], [Math.PI * 0.5, 0, 0], ceilingPivot);

    // Secondary outer luminous polar-day origami wing leaves extending from the unfolding walls & ceiling!
    this._secondaryWings = [];
    const addSecondaryWing = (name, w, h, pos, rot, parent, hingeOffset, axis) => {
      const wingPivot = new B.TransformNode(`${name}_pivot`, this.scene);
      wingPivot.position.set(pos[0], pos[1], pos[2]);
      wingPivot.parent = parent;

      const slab = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: 0.08 }, this.scene);
      slab.position.set(hingeOffset[0], hingeOffset[1], hingeOffset[2]);
      slab.rotation.set(rot[0], rot[1], rot[2]);
      slab.material = this.materials.polarWhitePanel;
      slab.isVisible = false;
      slab.parent = wingPivot;

      // Crisp brushed-gold architectural border trim around origami wing
      const frame = B.MeshBuilder.CreateBox(
        `${name}_trim`,
        { width: w + 0.06, height: 0.07, depth: 0.11 },
        this.scene
      );
      frame.position.set(hingeOffset[0], hingeOffset[1] + h * 0.5, hingeOffset[2]);
      frame.rotation.set(rot[0], rot[1], rot[2]);
      frame.material = this.materials.hullAccentGold;
      frame.isVisible = false;
      frame.parent = wingPivot;

      this._secondaryWings.push({ pivot: wingPivot, meshes: [slab, frame], axis });
    };

    // Port & Starboard outer unfolding origami wings attached to top edges of side walls
    addSecondaryWing('p3_wing_left_ext', 9.2, 3.6, [-0.14, 4.15, 0.1], [0, Math.PI * 0.5, 0], leftWallPivot, [0, 1.8, 0], 'zPos');
    addSecondaryWing('p3_wing_right_ext', 9.2, 3.6, [0.14, 4.15, 0.1], [0, -Math.PI * 0.5, 0], rightWallPivot, [0, 1.8, 0], 'zNeg');
    // Forward bow luminous wing extensions unfolding off bowUpperPivot & bowLowerPivot
    addSecondaryWing('p3_wing_bow_up_ext', 8.6, 3.2, [0, 0.12, 0.2], [0, 0, 0], bowUpperPivot, [0, 1.6, 0], 'xNeg');
    addSecondaryWing('p3_wing_bow_lo_ext', 8.6, 2.8, [0, -0.08, 0.2], [0, 0, 0], bowLowerPivot, [0, -1.4, 0], 'xPos');
  }

  // -------------------------------------------------------------------------
  // 3. Exterior Space Backdrop & Distant Looming 4D Megastructure (S4-1 Dive & Bow Vista)
  // -------------------------------------------------------------------------

  _buildExteriorCosmicBackdrop() {
    const B = globalThis.BABYLON;
    this.backdropRoot = new B.TransformNode('p3_exterior_backdrop', this.scene);
    this.backdropRoot.parent = this.root;

    // Exterior streamlined titanium bow collar visible during 55.0–56.0s meteor dive
    const bowCollar = B.MeshBuilder.CreateTorus(
      'p3_ext_bow_collar',
      { diameter: 9.8, thickness: 0.36, tessellation: 40 },
      this.scene
    );
    bowCollar.position.set(0, 2.2, 5.55);
    bowCollar.scaling.set(1.0, 0.52, 1.0);
    bowCollar.material = this.materials.hullTitanium;
    bowCollar.parent = this.backdropRoot;

    const bowCollarTrim = B.MeshBuilder.CreateTorus(
      'p3_ext_bow_trim',
      { diameter: 9.45, thickness: 0.08, tessellation: 40 },
      this.scene
    );
    bowCollarTrim.position.set(0, 2.2, 5.65);
    bowCollarTrim.scaling.set(1.0, 0.52, 1.0);
    bowCollarTrim.material = this.materials.hullAccentGold;
    bowCollarTrim.parent = this.backdropRoot;

    // Distant looming 2-tier 4D tesseract megastructure silhouette outside bow window (z = +68m)
    // Rendered via 2 thin-instanced cylinder meshes (32 outer cyan beams + 32 inner gold beams = 2 draw calls!)
    this.megastructureOrigin = [0, 8.2, 68.0];
    this.megastructureScale = 23.0;

    this.megaCyanMaster = B.MeshBuilder.CreateCylinder(
      'p3_mega_cyan_beams',
      { diameter: 1.0, height: 1.0, tessellation: 8 },
      this.scene
    );
    this.megaCyanMaster.material = this.materials.tesseractCyanBeam;
    this.megaCyanMaster.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.megaCyanMaster.parent = this.backdropRoot;
    this._megaCyanBuf = new Float32Array(32 * 16);

    this.megaGoldMaster = B.MeshBuilder.CreateCylinder(
      'p3_mega_gold_beams',
      { diameter: 1.0, height: 1.0, tessellation: 8 },
      this.scene
    );
    this.megaGoldMaster.material = this.materials.tesseractGoldBeam;
    this.megaGoldMaster.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.megaGoldMaster.parent = this.backdropRoot;
    this._megaGoldBuf = new Float32Array(32 * 16);

    // Distant glowing geometric horizon rings outside bow glass for deep 4D perspective
    this.horizonRings = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = B.MeshBuilder.CreateTorus(
        `p3_horizon_ring_${i}`,
        { diameter: 42 + i * 24, thickness: 0.16, tessellation: 48 },
        this.scene
      );
      ring.position.set(0, 5.5 + i * 2.5, 48 + i * 26);
      ring.rotation.x = 0.25 + i * 0.18;
      ring.material = i % 2 === 0 ? this.materials.tesseractCyanBeam : this.materials.tesseractGoldBeam;
      ring.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      ring.parent = this.backdropRoot;
      this.horizonRings.push(ring);
    }

    // 3 Soft Volumetric Cyan-Gold Light Shafts streaming through the panoramic bow glass (merged = 1 draw call)
    const bowShaftParts = [];
    for (const cfg of [
      { x: -1.65, y: 2.35, z: 3.9, rotY: 0.26, rotZ: -0.18, w: 2.6, h: 6.2 },
      { x: 0.0, y: 2.55, z: 4.1, rotY: 0.0, rotZ: -0.14, w: 3.2, h: 6.8 },
      { x: 1.65, y: 2.35, z: 3.9, rotY: -0.26, rotZ: -0.18, w: 2.6, h: 6.2 },
    ]) {
      const shaft = B.MeshBuilder.CreatePlane(
        `p3_bow_shaft_${cfg.x}`,
        { width: cfg.w, height: cfg.h },
        this.scene
      );
      shaft.position.set(cfg.x, cfg.y, cfg.z);
      shaft.rotation.set(0.32, cfg.rotY, cfg.rotZ);
      bowShaftParts.push(shaft);
    }
    const mergedBowShafts = B.Mesh.MergeMeshes(bowShaftParts, true, true, undefined, false, false);
    this.bowShafts = [];
    if (mergedBowShafts) {
      mergedBowShafts.name = 'p3_bow_volumetric_shafts';
      mergedBowShafts.material = this.materials.volumetricShaft;
      mergedBowShafts.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      mergedBowShafts.parent = this.backdropRoot;
      this.bowShafts.push(mergedBowShafts);
    }

    // Sparse thin-instanced cosmic stars wrapping outer abyss (96 instances = 1 draw call)
    this.starMaster = B.MeshBuilder.CreateSphere('p3_distant_stars', { diameter: 0.42, segments: 6 }, this.scene);
    this.starMaster.material = this.distantStarMat;
    this.starMaster.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    this.starMaster.parent = this.backdropRoot;

    const starCount = 96;
    const starBuf = new Float32Array(starCount * 16);
    for (let i = 0; i < starCount; i += 1) {
      const theta = hash01(i * 1.9 + 7.3) * Math.PI * 2;
      const phi = (hash01(i * 3.1 + 19.7) - 0.5) * Math.PI * 0.85;
      const r = 115 + hash01(i * 7.7 + 4.1) * 140;
      const sx = Math.cos(phi) * Math.sin(theta) * r;
      const sy = Math.sin(phi) * r + 12;
      const sz = Math.cos(phi) * Math.cos(theta) * r;
      const s = 0.55 + hash01(i * 13.3) * 1.35;
      writeMatrixToBuffer(
        starBuf,
        i,
        [sx, sy, sz],
        [0, 0, 0],
        [s, s, s],
        this._tmpQ,
        this._tmpM,
        this._tmpPos,
        this._tmpScale
      );
    }
    this.starMaster.thinInstanceSetBuffer('matrix', starBuf, 16, true);
  }

  // -------------------------------------------------------------------------
  // 4. Hero 4D Prop — 6-Face Intact Sealed Borosilicate Sample Box + Calibration Sphere
  // -------------------------------------------------------------------------

  _buildSealedBorosilicateBoxHero() {
    const B = globalThis.BABYLON;
    const half = BOX_HALF; // 0.22m -> 0.44m cube seated on specimenPad (y = 0.909..1.349)
    const size = half * 2;

    this.sealedBoxRoot = new B.TransformNode('p3_sealed_box_root', this.scene);
    this.sealedBoxRoot.position.set(BOX_CENTER_WORLD[0], BOX_CENTER_WORLD[1], BOX_CENTER_WORLD[2]);
    this.sealedBoxRoot.parent = this.root;

    // 1) 6 Individual Completely Sealed Borosilicate Glass Walls (merged into 1 Ghost-safe mesh; lidClosed === true always!)
    const paneThickness = 0.008;
    const glassSpecs = [
      { id: 'px', pos: [half, 0, 0], dims: [paneThickness, size - 0.016, size - 0.016] },
      { id: 'nx', pos: [-half, 0, 0], dims: [paneThickness, size - 0.016, size - 0.016] },
      { id: 'py', pos: [0, half, 0], dims: [size - 0.016, paneThickness, size - 0.016] },
      { id: 'ny', pos: [0, -half, 0], dims: [size - 0.016, paneThickness, size - 0.016] },
      { id: 'pz', pos: [0, 0, half], dims: [size - 0.016, size - 0.016, paneThickness] },
      { id: 'nz', pos: [0, 0, -half], dims: [size - 0.016, size - 0.016, paneThickness] },
    ];
    const glassParts = [];
    for (const g of glassSpecs) {
      const pane = B.MeshBuilder.CreateBox(
        `p3_box_glass_${g.id}`,
        { width: g.dims[0], height: g.dims[1], depth: g.dims[2] },
        this.scene
      );
      pane.position.set(g.pos[0], g.pos[1], g.pos[2]);
      glassParts.push(pane);
    }
    this.sealedGlassMesh = B.Mesh.MergeMeshes(glassParts, true, true, undefined, false, false);
    if (this.sealedGlassMesh) {
      this.sealedGlassMesh.name = 'p3_sealed_box_glass_6face';
      this.sealedGlassMesh.material = this.sealedGlassMat;
      this.sealedGlassMesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      this.sealedGlassMesh.parent = this.sealedBoxRoot;
    }

    // 2) 12 Precision Brushed-Brass Edge Rails & Dark Seal Gaskets (merged/grouped cleanly)
    const railThick = 0.017;
    const edgeRails = [];
    for (const sy of [-half, half]) {
      for (const sz of [-half, half]) {
        const railX = B.MeshBuilder.CreateBox(
          `p3_box_rx_${sy}_${sz}`,
          { width: size + 0.01, height: railThick, depth: railThick },
          this.scene
        );
        railX.position.set(0, sy, sz);
        edgeRails.push(railX);
      }
      for (const sx of [-half, half]) {
        const railZ = B.MeshBuilder.CreateBox(
          `p3_box_rz_${sy}_${sx}`,
          { width: railThick, height: railThick, depth: size + 0.01 },
          this.scene
        );
        railZ.position.set(sx, sy, 0);
        edgeRails.push(railZ);
      }
    }
    for (const sx of [-half, half]) {
      for (const sz of [-half, half]) {
        const railY = B.MeshBuilder.CreateBox(
          `p3_box_ry_${sx}_${sz}`,
          { width: railThick, height: size + 0.01, depth: railThick },
          this.scene
        );
        railY.position.set(sx, 0, sz);
        edgeRails.push(railY);
      }
    }
    // 8 Precision Corner Clamps
    for (const sx of [-half, half]) {
      for (const sy of [-half, half]) {
        for (const sz of [-half, half]) {
          const corner = B.MeshBuilder.CreateBox(
            `p3_box_corner_${sx}_${sy}_${sz}`,
            { width: 0.044, height: 0.044, depth: 0.044 },
            this.scene
          );
          corner.position.set(sx, sy, sz);
          edgeRails.push(corner);
        }
      }
    }
    const brassFrameMesh = B.Mesh.MergeMeshes(edgeRails, true, true, undefined, false, false);
    if (brassFrameMesh) {
      brassFrameMesh.name = 'p3_sealed_box_brass_frame';
      brassFrameMesh.material = this.materials.hullAccentGold;
      brassFrameMesh.parent = this.sealedBoxRoot;
      if (this.sharedRig.registerShadowCaster) this.sharedRig.registerShadowCaster(brassFrameMesh);
      if (this.sharedRig.registerMirrorMesh) this.sharedRig.registerMirrorMesh(brassFrameMesh);
    }

    // 3) Visibly CLOSED & LOCKED Top Hermetic Latch Assembly (lidClosed === true permanently!)
    const latchParts = [];
    const topBar = B.MeshBuilder.CreateBox(
      'p3_box_latch_bar',
      { width: 0.24, height: 0.022, depth: 0.046 },
      this.scene
    );
    topBar.position.set(0, half + 0.014, -half + 0.024);
    latchParts.push(topBar);

    for (const lx of [-0.09, 0.09]) {
      const clasp = B.MeshBuilder.CreateBox(
        `p3_box_clasp_${lx}`,
        { width: 0.032, height: 0.068, depth: 0.026 },
        this.scene
      );
      clasp.position.set(lx, half - 0.012, -half - 0.01);
      latchParts.push(clasp);
    }

    // Internal brushed-gold calibration pedestal cradle (clearly empty once sphere emerges!)
    const cradleBase = B.MeshBuilder.CreateTorus(
      'p3_box_cradle_ring',
      { diameter: 0.14, thickness: 0.016, tessellation: 24 },
      this.scene
    );
    cradleBase.position.set(0, -half + 0.022, 0);
    latchParts.push(cradleBase);

    const latchMesh = B.Mesh.MergeMeshes(latchParts, true, true, undefined, false, false);
    if (latchMesh) {
      latchMesh.name = 'p3_sealed_box_latch';
      latchMesh.material = this.materials.hullDarkRib;
      latchMesh.parent = this.sealedBoxRoot;
    }

    // Glowing cyan "SEALED" lock indicator bar on top front latch
    const sealLed = B.MeshBuilder.CreateBox(
      'p3_box_sealed_led',
      { width: 0.12, height: 0.012, depth: 0.012 },
      this.scene
    );
    sealLed.position.set(0, half + 0.026, -half + 0.024);
    sealLed.material = this.materials.emissiveCyan;
    sealLed.parent = this.sealedBoxRoot;

    // 4) Gleaming Cyan-Silver Metallic-Crystal Calibration Sphere (diameter = 0.16m)
    this.orbRoot = new B.TransformNode('p3_calib_orb_root', this.scene);
    this.orbRoot.parent = this.sealedBoxRoot;

    this.calibSphere = B.MeshBuilder.CreateSphere(
      'p3_calib_sphere',
      { diameter: 0.16, segments: 28 },
      this.scene
    );
    this.calibSphere.material = this.materials.calibrationSphereCrystal;
    this.calibSphere.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.calibSphere.parent = this.orbRoot;
    if (this.sharedRig.registerShadowCaster) this.sharedRig.registerShadowCaster(this.calibSphere);
    if (this.sharedRig.registerMirrorMesh) this.sharedRig.registerMirrorMesh(this.calibSphere);

    // Twin delicate gimbal orbital coordinate rings around the calibration sphere
    this.orbRingOuter = B.MeshBuilder.CreateTorus(
      'p3_orb_ring_outer',
      { diameter: 0.225, thickness: 0.008, tessellation: 36 },
      this.scene
    );
    this.orbRingOuter.material = this.materials.hullAccentGold;
    this.orbRingOuter.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.orbRingOuter.parent = this.orbRoot;

    this.orbRingInner = B.MeshBuilder.CreateTorus(
      'p3_orb_ring_inner',
      { diameter: 0.196, thickness: 0.006, tessellation: 36 },
      this.scene
    );
    this.orbRingInner.rotation.x = Math.PI * 0.35;
    this.orbRingInner.material = this.materials.emissiveCyan;
    this.orbRingInner.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.orbRingInner.parent = this.orbRoot;

    // 4D W-axis phase contour halo & translucent aura envelope around sphere
    this.orbPhaseHalo = B.MeshBuilder.CreateTorus(
      'p3_orb_phase_halo',
      { diameter: 0.28, thickness: 0.014, tessellation: 40 },
      this.scene
    );
    this.orbPhaseHalo.rotation.z = Math.PI * 0.5;
    this.orbPhaseHalo.material = this.phaseHaloMat;
    this.orbPhaseHalo.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.orbPhaseHalo.parent = this.orbRoot;

    this.orbPhaseAura = B.MeshBuilder.CreateSphere(
      'p3_orb_phase_aura',
      { diameter: 0.24, segments: 20 },
      this.scene
    );
    this.orbPhaseAura.material = this.phaseAuraMat;
    this.orbPhaseAura.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.orbPhaseAura.parent = this.orbRoot;

    // 5) Crisp Luminous Cyan 4D Intersection Ring flush on intact +X glass wall (x = +0.224)
    this.wallIntersectionRoot = new B.TransformNode('p3_wall_intersect_root', this.scene);
    this.wallIntersectionRoot.position.set(half + 0.005, 0, 0);
    this.wallIntersectionRoot.parent = this.sealedBoxRoot;

    this.wallRingPrimary = B.MeshBuilder.CreateTorus(
      'p3_wall_intersect_ring_1',
      { diameter: 0.21, thickness: 0.013, tessellation: 36 },
      this.scene
    );
    this.wallRingPrimary.rotation.z = Math.PI * 0.5;
    this.wallRingPrimary.material = this.phaseHaloMat;
    this.wallRingPrimary.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.wallRingPrimary.parent = this.wallIntersectionRoot;

    this.wallRingRipple = B.MeshBuilder.CreateTorus(
      'p3_wall_intersect_ring_2',
      { diameter: 0.31, thickness: 0.007, tessellation: 36 },
      this.scene
    );
    this.wallRingRipple.rotation.z = Math.PI * 0.5;
    this.wallRingRipple.material = this.phaseWakeMat;
    this.wallRingRipple.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.wallRingRipple.parent = this.wallIntersectionRoot;

    // Delicate 4D phase-wake filament + 3 ghost echo rings bridging intact +X wall to emerged orb
    this.phaseWakeBeam = B.MeshBuilder.CreateCylinder(
      'p3_phase_wake_beam',
      { diameter: 0.022, height: 1.0, tessellation: 12 },
      this.scene
    );
    this.phaseWakeBeam.material = this.phaseWakeMat;
    this.phaseWakeBeam.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.phaseWakeBeam.isVisible = false;
    this.phaseWakeBeam.parent = this.sealedBoxRoot;

    this.phaseEchoRings = [];
    for (let i = 0; i < 3; i += 1) {
      const echo = B.MeshBuilder.CreateTorus(
        `p3_phase_echo_${i}`,
        { diameter: 0.14 - i * 0.018, thickness: 0.006, tessellation: 28 },
        this.scene
      );
      echo.rotation.z = Math.PI * 0.5;
      echo.material = this.phaseWakeMat;
      echo.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      echo.isVisible = false;
      echo.parent = this.sealedBoxRoot;
      this.phaseEchoRings.push(echo);
    }

    // Dedicated cyan-silver hero PointLight tracking the calibration sphere
    this.orbLight = this._trackLight(
      new B.PointLight('p3_calib_orb_light', new B.Vector3(0, 0.05, 0), this.scene)
    );
    this.orbLight.diffuse = B.Color3.FromHexString('#6CF4EA');
    this.orbLight.specular = B.Color3.FromHexString('#C8FFFA');
    this.orbLight.intensity = 1.6;
    this.orbLight.range = 3.2;
    this.orbLight.parent = this.orbRoot;
  }

  // -------------------------------------------------------------------------
  // 5. Brief 4D Interior X-Ray Transparency Wave System (S4-1, xrayWaveProgress)
  // -------------------------------------------------------------------------

  _buildXrayCutawaySystem() {
    const B = globalThis.BABYLON;
    this.xrayRoot = new B.TransformNode('p3_xray_root', this.scene);
    this.xrayRoot.parent = this.root;

    // 1) Sweeping Luminous Planar Cyan 4D Scan-Wave Curtain
    this.xrayScanCurtain = new B.TransformNode('p3_xray_scan_curtain', this.scene);
    this.xrayScanCurtain.parent = this.xrayRoot;

    const curtainPlane = B.MeshBuilder.CreatePlane(
      'p3_xray_curtain_sheet',
      { width: 8.5, height: 4.05 },
      this.scene
    );
    curtainPlane.position.set(0, 2.05, 0);
    curtainPlane.material = this.xrayPlaneMat;
    curtainPlane.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    curtainPlane.parent = this.xrayScanCurtain;

    // Crisp leading laser edge framing the sweeping scan plane
    const frameParts = [];
    const topLaser = B.MeshBuilder.CreateBox('p3_xray_laser_top', { width: 8.5, height: 0.04, depth: 0.04 }, this.scene);
    topLaser.position.set(0, 4.04, 0);
    frameParts.push(topLaser);
    const botLaser = B.MeshBuilder.CreateBox('p3_xray_laser_bot', { width: 8.5, height: 0.04, depth: 0.04 }, this.scene);
    botLaser.position.set(0, 0.05, 0);
    frameParts.push(botLaser);
    for (const sx of [-4.22, 4.22]) {
      const sideLaser = B.MeshBuilder.CreateBox(
        `p3_xray_laser_side_${sx}`,
        { width: 0.04, height: 4.05, depth: 0.04 },
        this.scene
      );
      sideLaser.position.set(sx, 2.05, 0);
      frameParts.push(sideLaser);
    }
    const mergedFrame = B.Mesh.MergeMeshes(frameParts, true, true, undefined, false, false);
    if (mergedFrame) {
      mergedFrame.name = 'p3_xray_curtain_frame';
      mergedFrame.material = this.xrayRibCyanMat;
      mergedFrame.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      mergedFrame.parent = this.xrayScanCurtain;
    }

    // 2) Custom GLSL xrayCutawayGhost Overlay Shells over Desk & Side Bulkheads
    const ghostShellParts = [];
    const deskShell = B.MeshBuilder.CreateBox('p3_xray_desk_shell', { width: 2.38, height: 0.12, depth: 1.08 }, this.scene);
    deskShell.position.set(0, 0.84, 2.05);
    ghostShellParts.push(deskShell);
    for (const sx of [-0.94, 0.94]) {
      const legShell = B.MeshBuilder.CreateBox(`p3_xray_leg_shell_${sx}`, { width: 0.17, height: 0.84, depth: 0.75 }, this.scene);
      legShell.position.set(sx, 0.41, 2.05);
      ghostShellParts.push(legShell);
    }
    for (const side of [-1, 1]) {
      const wallShell = B.MeshBuilder.CreateBox(`p3_xray_wall_shell_${side}`, { width: 0.22, height: 4.1, depth: 8.6 }, this.scene);
      wallShell.position.set(side * 4.28, 2.05, 0.6);
      ghostShellParts.push(wallShell);
    }
    this.xrayGhostShell = B.Mesh.MergeMeshes(ghostShellParts, true, true, undefined, false, false);
    if (this.xrayGhostShell) {
      this.xrayGhostShell.name = 'p3_xray_ghost_shells';
      this.xrayGhostShell.material = this.materials.xrayCutawayGhost;
      this.xrayGhostShell.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      this.xrayGhostShell.parent = this.xrayRoot;
    }

    // 3) Pre-Embedded Internal Glowing Structural Ribs (Cyan) & Gold Quantum Conduits
    const cyanRibs = [];
    const goldConduits = [];

    // Internal Lab Desk X-Truss Bracing & Under-Desk Quantum Grid (world z = 2.05)
    for (let i = -3; i <= 3; i += 1) {
      const rib = B.MeshBuilder.CreateBox(`p3_desk_rib_${i}`, { width: 0.025, height: 0.06, depth: 0.96 }, this.scene);
      rib.position.set(i * 0.34, 0.84, 2.05);
      cyanRibs.push(rib);
    }
    for (const sz of [1.66, 2.05, 2.44]) {
      const beam = B.MeshBuilder.CreateBox(`p3_desk_beam_${sz}`, { width: 2.24, height: 0.024, depth: 0.024 }, this.scene);
      beam.position.set(0, 0.84, sz);
      cyanRibs.push(beam);
    }
    // Internal Gold Quantum Busbars running up both desk legs into the central specimen pad!
    for (const sx of [-0.94, 0.94]) {
      const legConduit = B.MeshBuilder.CreateCylinder(
        `p3_desk_leg_cond_${sx}`,
        { diameter: 0.036, height: 0.78, tessellation: 10 },
        this.scene
      );
      legConduit.position.set(sx, 0.42, 2.05);
      goldConduits.push(legConduit);

      const crossCond = B.MeshBuilder.CreateCylinder(
        `p3_desk_cross_cond_${sx}`,
        { diameter: 0.028, height: 0.94, tessellation: 10 },
        this.scene
      );
      crossCond.rotation.z = Math.PI * 0.5;
      crossCond.position.set(sx * 0.5, 0.84, 2.05);
      goldConduits.push(crossCond);
    }
    const coreNode = B.MeshBuilder.CreateTorus(
      'p3_desk_core_node',
      { diameter: 0.44, thickness: 0.022, tessellation: 24 },
      this.scene
    );
    coreNode.position.set(0, 0.85, 2.05);
    goldConduits.push(coreNode);

    // Internal Side Bulkhead Structural Rib-Cages & Gold Power Busbars (x = ±4.12)
    for (const side of [-1, 1]) {
      for (const rz of [-0.6, 0.6, 1.8, 3.0, 4.2]) {
        const ribV = B.MeshBuilder.CreateBox(
          `p3_bulk_rib_${side}_${rz}`,
          { width: 0.035, height: 3.7, depth: 0.045 },
          this.scene
        );
        ribV.position.set(side * 4.14, 2.05, rz);
        cyanRibs.push(ribV);
      }
      for (const ry of [0.95, 2.05, 3.15]) {
        const bus = B.MeshBuilder.CreateBox(
          `p3_bulk_bus_${side}_${ry}`,
          { width: 0.03, height: 0.04, depth: 5.6 },
          this.scene
        );
        bus.position.set(side * 4.12, ry, 1.8);
        goldConduits.push(bus);
      }
    }

    // Under-Deck Revealed Structural Grid Ribs (y = 0.025)
    for (let gx = -3.0; gx <= 3.0; gx += 1.0) {
      const fRib = B.MeshBuilder.CreateBox(`p3_deck_rib_x_${gx}`, { width: 0.024, height: 0.018, depth: 5.2 }, this.scene);
      fRib.position.set(gx, 0.02, 2.2);
      cyanRibs.push(fRib);
    }
    for (let gz = 0.0; gz <= 4.4; gz += 1.1) {
      const fRibZ = B.MeshBuilder.CreateBox(`p3_deck_rib_z_${gz}`, { width: 6.4, height: 0.018, depth: 0.024 }, this.scene);
      fRibZ.position.set(0, 0.02, gz);
      cyanRibs.push(fRibZ);
    }

    this.xrayCyanSkeleton = B.Mesh.MergeMeshes(cyanRibs, true, true, undefined, false, false);
    if (this.xrayCyanSkeleton) {
      this.xrayCyanSkeleton.name = 'p3_xray_cyan_ribs';
      this.xrayCyanSkeleton.material = this.xrayRibCyanMat;
      this.xrayCyanSkeleton.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      this.xrayCyanSkeleton.parent = this.xrayRoot;
    }

    this.xrayGoldConduits = B.Mesh.MergeMeshes(goldConduits, true, true, undefined, false, false);
    if (this.xrayGoldConduits) {
      this.xrayGoldConduits.name = 'p3_xray_gold_conduits';
      this.xrayGoldConduits.material = this.xrayConduitGoldMat;
      this.xrayGoldConduits.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      this.xrayGoldConduits.parent = this.xrayRoot;
    }

    this.xrayRoot.setEnabled(false);
  }

  // -------------------------------------------------------------------------
  // 6. Silent Orthogonal Bow Glass Shatter & 216 Weightless Beveled Shards
  // -------------------------------------------------------------------------

  _buildOrthogonalBowShatterSystem() {
    const B = globalThis.BABYLON;
    this.shatterRoot = new B.TransformNode('p3_shatter_root', this.scene);
    this.shatterRoot.parent = this.root;

    // 1) Curved Orthogonal 4D Fracture Overlay right inside bow glass (NO_CAP, 6cm radial offset = zero Z-fighting)
    this.bowCrackArc = B.MeshBuilder.CreateCylinder(
      'p3_bow_crack_arc',
      {
        diameter: 9.06,
        height: 3.16,
        tessellation: 36,
        arc: 0.32,
        cap: B.Mesh.NO_CAP,
        sideOrientation: B.Mesh.DOUBLESIDE,
      },
      this.scene
    );
    this.bowCrackArc.position.set(0, 2.22, 1.05);
    this.bowCrackArc.rotation.y = BOW_ARC_ROT_Y;
    this.bowCrackArc.material = this.crackMat;
    this.bowCrackArc.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.bowCrackArc.isVisible = false;
    this.bowCrackArc.parent = this.shatterRoot;

    // 2) 216 Weightless Beveled Luminous Geometric Glass Shards (thin-instanced = 1 draw call!)
    this.shardCount = 216;
    this.shardMaster = B.MeshBuilder.CreateCylinder(
      'p3_glass_shards_216',
      { diameter: 0.24, height: 0.022, tessellation: 6 },
      this.scene
    );
    this.shardMaster.material = this.materials.glassShardLuminous;
    this.shardMaster.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.shardMaster.isVisible = false;
    this.shardMaster.parent = this.shatterRoot;

    // 48 Companion Gold-Cyan Refractive Prism Slivers (1 draw call!)
    this.goldShardCount = 48;
    this.goldShardMaster = B.MeshBuilder.CreateCylinder(
      'p3_gold_shards_48',
      { diameter: 0.16, height: 0.018, tessellation: 4 },
      this.scene
    );
    this.goldShardMaster.material = this.shardGoldPrismMat;
    this.goldShardMaster.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.goldShardMaster.isVisible = false;
    this.goldShardMaster.parent = this.shatterRoot;

    this._shardSeeds = [];
    this._shardBuf = new Float32Array(this.shardCount * 16);

    const cols = 18;
    const rows = 12;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c;
        const u = (c + 0.5 + (hash01(idx * 2.1) - 0.5) * 0.45) / cols;
        const v = (r + 0.5 + (hash01(idx * 4.7) - 0.5) * 0.45) / rows;
        const ang = lerp(-0.66, 0.66, u);
        const rad = 4.54;
        const x0 = Math.sin(ang) * rad;
        const y0 = lerp(0.68, 3.74, v);
        const z0 = 1.05 + Math.cos(ang) * rad;

        // Inner hero shards drift gently deeper into the cabin for layered zero-G parallax
        const heroBoost = hash01(idx * 9.3) > 0.58 ? 1.85 : 1.0;
        this._shardSeeds.push({
          x0,
          y0,
          z0,
          ang,
          vx: (hash01(idx * 3.3) - 0.5) * 0.34,
          vy: 0.06 + hash01(idx * 5.1) * 0.34,
          vz: -(0.35 + hash01(idx * 7.9) * 0.72) * heroBoost,
          rx0: (hash01(idx * 11.1) - 0.5) * 0.4 + Math.PI * 0.5,
          ry0: ang,
          rz0: (hash01(idx * 13.7) - 0.5) * 0.5,
          vrx: (hash01(idx * 17.3) - 0.5) * 1.15,
          vry: (hash01(idx * 19.9) - 0.5) * 1.35,
          vrz: (hash01(idx * 23.1) - 0.5) * 1.05,
          sx: 0.65 + hash01(idx * 29.3) * 1.15,
          sy: 0.8 + hash01(idx * 31.7) * 0.55,
          sz: 0.55 + hash01(idx * 37.1) * 1.25,
          spiralR: 2.2 + hash01(idx * 41.3) * 5.8,
          spiralSpeed: 0.45 + hash01(idx * 43.9) * 0.65,
          spiralLift: 1.8 + hash01(idx * 47.1) * 4.4,
        });
      }
    }

    this._goldShardSeeds = [];
    this._goldShardBuf = new Float32Array(this.goldShardCount * 16);
    for (let i = 0; i < this.goldShardCount; i += 1) {
      const ang = lerp(-0.62, 0.62, hash01(i * 6.3 + 2.1));
      const x0 = Math.sin(ang) * 4.5;
      const y0 = lerp(0.85, 3.6, hash01(i * 8.9 + 5.4));
      const z0 = 1.05 + Math.cos(ang) * 4.5;
      this._goldShardSeeds.push({
        x0,
        y0,
        z0,
        ang,
        vx: (hash01(i * 12.1) - 0.5) * 0.4,
        vy: 0.12 + hash01(i * 14.3) * 0.42,
        vz: -(0.65 + hash01(i * 16.7) * 1.15),
        vrx: (hash01(i * 21.1) - 0.5) * 1.6,
        vry: (hash01(i * 25.3) - 0.5) * 1.8,
        vrz: (hash01(i * 27.7) - 0.5) * 1.4,
        sx: 0.75 + hash01(i * 33.1) * 1.1,
        sy: 0.9,
        sz: 1.1 + hash01(i * 39.7) * 1.4,
        spiralR: 2.6 + hash01(i * 51.3) * 6.2,
        spiralSpeed: 0.6 + hash01(i * 53.7) * 0.7,
        spiralLift: 2.4 + hash01(i * 59.1) * 4.8,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 7. Hero 08 号 Cryo-Pod Emerald Emergency Wake-up Rig (S4-2)
  // -------------------------------------------------------------------------

  _buildCryoWakeupRig() {
    const B = globalThis.BABYLON;
    this.cryoWakeRoot = new B.TransformNode('p3_cryo_wake_rig', this.scene);
    this.cryoWakeRoot.position.set(POD08_POS[0], POD08_POS[1], POD08_POS[2]);
    this.cryoWakeRoot.rotation.y = 0.48;
    this.cryoWakeRoot.parent = this.root;

    // Overhead emerald emergency wake ring framing 08 号 pod
    this.pod08BeaconRing = B.MeshBuilder.CreateTorus(
      'p3_pod08_emerald_ring',
      { diameter: 1.45, thickness: 0.045, tessellation: 32 },
      this.scene
    );
    this.pod08BeaconRing.position.set(0, 2.35, -0.15);
    this.pod08BeaconRing.material = this.emeraldHaloMat;
    this.pod08BeaconRing.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.pod08BeaconRing.parent = this.cryoWakeRoot;

    // Soft downward volumetric emerald light cone over open 08 号 berth (Ghost-safe)
    this.pod08BeaconCone = B.MeshBuilder.CreateCylinder(
      'p3_pod08_emerald_cone',
      { diameterTop: 0.9, diameterBottom: 2.15, height: 2.25, tessellation: 24, cap: B.Mesh.NO_CAP },
      this.scene
    );
    this.pod08BeaconCone.position.set(0, 1.45, -0.05);
    this.pod08BeaconCone.material = this.emeraldHaloMat;
    this.pod08BeaconCone.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.pod08BeaconCone.parent = this.cryoWakeRoot;

    // Dedicated interior emerald wake PointLight illuminating mist, canopy rim, and Lin Xia!
    this.pod08WakeLight = this._trackLight(
      new B.PointLight('p3_pod08_wake_light', new B.Vector3(0.18, 1.28, 0.25), this.scene)
    );
    this.pod08WakeLight.diffuse = B.Color3.FromHexString(PALETTE.accent.emerald);
    this.pod08WakeLight.specular = B.Color3.FromHexString('#B9FFD8');
    this.pod08WakeLight.intensity = 0.0;
    this.pod08WakeLight.range = 6.8;
    this.pod08WakeLight.parent = this.cryoWakeRoot;

    this.cryoWakeRoot.setEnabled(false);
  }

  // -------------------------------------------------------------------------
  // 8. Infinite Pure-Abstract Polar-Day Origami Space & S6 Geometric Light Waves
  // -------------------------------------------------------------------------

  _buildPolarOrigamiVistaAndWaveDomes() {
    const B = globalThis.BABYLON;
    this.polarVistaRoot = new B.TransformNode('p3_polar_vista_root', this.scene);
    this.polarVistaRoot.parent = this.root;

    // Infinite pure-abstract luminous geometric horizon grid planes (below & above unfolded cabin)
    this.polarGridFloor = B.MeshBuilder.CreatePlane('p3_polar_grid_floor', { width: 120, height: 120 }, this.scene);
    this.polarGridFloor.rotation.x = Math.PI * 0.5;
    this.polarGridFloor.position.set(0, -5.8, 36);
    this.polarGridFloor.material = this.polarGridMat;
    this.polarGridFloor.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.polarGridFloor.parent = this.polarVistaRoot;

    this.polarGridSky = B.MeshBuilder.CreatePlane('p3_polar_grid_sky', { width: 120, height: 120 }, this.scene);
    this.polarGridSky.rotation.x = -Math.PI * 0.5;
    this.polarGridSky.position.set(0, 14.5, 36);
    this.polarGridSky.material = this.polarGridMat;
    this.polarGridSky.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.polarGridSky.parent = this.polarVistaRoot;

    // 56 Thin-Instanced Floating Pure-Abstract Luminous Polar-Day Origami Planes (1 draw call!)
    this.origamiPlaneCount = 56;
    this.origamiPlaneMaster = B.MeshBuilder.CreateBox(
      'p3_polar_origami_planes',
      { width: 3.4, height: 2.2, depth: 0.08 },
      this.scene
    );
    this.origamiPlaneMaster.material = this.materials.polarWhitePanel;
    this.origamiPlaneMaster.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    this.origamiPlaneMaster.parent = this.polarVistaRoot;

    this._origamiPlaneSeeds = [];
    this._origamiPlaneBuf = new Float32Array(this.origamiPlaneCount * 16);
    for (let i = 0; i < this.origamiPlaneCount; i += 1) {
      const ring = Math.floor(i / 8); // 7 concentric architectural rings into deep polar space
      const slot = i % 8;
      const angle = (slot / 8) * Math.PI * 2 + ring * 0.22;
      const radius = 10.5 + ring * 5.2;
      const zBase = 9.5 + ring * 9.5;
      this._origamiPlaneSeeds.push({
        angle,
        radius,
        zBase,
        sx: 0.75 + hash01(i * 3.9) * 1.45,
        sy: 0.75 + hash01(i * 7.1) * 1.35,
        phase: hash01(i * 11.7) * Math.PI * 2,
        tiltSign: i % 2 === 0 ? 1 : -1,
      });
    }

    // 24 Thin-Instanced Radiant Gold-Cyan Horizon Structural Frame Bars (1 draw call!)
    this.origamiBarCount = 24;
    this.origamiBarMaster = B.MeshBuilder.CreateBox(
      'p3_polar_origami_bars',
      { width: 6.2, height: 0.09, depth: 0.09 },
      this.scene
    );
    this.origamiBarMaster.material = this.materials.hullAccentGold;
    this.origamiBarMaster.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.origamiBarMaster.parent = this.polarVistaRoot;
    this._origamiBarBuf = new Float32Array(this.origamiBarCount * 16);

    // 4 Broad Polar-Day Volumetric Light Shafts pouring through opening cabin seams (merged = 1 draw call)
    const polarShaftParts = [];
    for (const cfg of [
      { x: -6.2, y: 4.5, z: 6.5, rotY: 0.55, rotZ: 0.32, w: 4.6, h: 14.0 },
      { x: 6.2, y: 4.5, z: 6.5, rotY: -0.55, rotZ: -0.32, w: 4.6, h: 14.0 },
      { x: -2.4, y: 6.8, z: 11.0, rotY: 0.18, rotZ: 0.12, w: 5.2, h: 16.0 },
      { x: 2.4, y: 6.8, z: 11.0, rotY: -0.18, rotZ: -0.12, w: 5.2, h: 16.0 },
    ]) {
      const shaft = B.MeshBuilder.CreatePlane(
        `p3_polar_shaft_${cfg.x}_${cfg.z}`,
        { width: cfg.w, height: cfg.h },
        this.scene
      );
      shaft.position.set(cfg.x, cfg.y, cfg.z);
      shaft.rotation.set(0.24, cfg.rotY, cfg.rotZ);
      polarShaftParts.push(shaft);
    }
    const mergedPolarShafts = B.Mesh.MergeMeshes(polarShaftParts, true, true, undefined, false, false);
    this.polarShafts = [];
    if (mergedPolarShafts) {
      mergedPolarShafts.name = 'p3_polar_volumetric_shafts';
      mergedPolarShafts.material = this.materials.volumetricShaft;
      mergedPolarShafts.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      mergedPolarShafts.parent = this.polarVistaRoot;
      this.polarShafts.push(mergedPolarShafts);
    }

    // Dedicated S5/S6 Polar-Day Radiant Horizon Key PointLight
    this.polarHorizonLight = this._trackLight(
      new B.PointLight('p3_polar_horizon_light', new B.Vector3(0, 4.8, 16.0), this.scene)
    );
    this.polarHorizonLight.diffuse = B.Color3.FromHexString('#F0F8FF');
    this.polarHorizonLight.specular = B.Color3.FromHexString('#FFF9E8');
    this.polarHorizonLight.intensity = 0.0;
    this.polarHorizonLight.range = 85.0;
    this.polarHorizonLight.parent = this.polarVistaRoot;

    this.polarVistaRoot.setEnabled(false);

    // S6 Nested Expanding Pure-White Geometric Light Wave Domes (Octahedron + Icosahedron + Cube)
    this.s6WaveRoot = new B.TransformNode('p3_s6_wave_root', this.scene);
    this.s6WaveRoot.position.set(0, 1.85, 7.5);
    this.s6WaveRoot.parent = this.root;

    const waveOcta = B.MeshBuilder.CreatePolyhedron('p3_s6_wave_octa', { type: 1, size: 1.0 }, this.scene);
    waveOcta.material = this.polarWaveMat;
    waveOcta.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    waveOcta.parent = this.s6WaveRoot;

    const waveIco = B.MeshBuilder.CreatePolyhedron('p3_s6_wave_ico', { type: 3, size: 1.0 }, this.scene);
    waveIco.material = this.polarWaveEdgeMat;
    waveIco.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    waveIco.parent = this.s6WaveRoot;

    const waveCube = B.MeshBuilder.CreateBox('p3_s6_wave_cube', { size: 1.65 }, this.scene);
    waveCube.material = this.polarWaveMat;
    waveCube.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    waveCube.parent = this.s6WaveRoot;

    this.s6WaveDomes = [waveOcta, waveIco, waveCube];

    // Pure-white enveloping horizon sky dome synced with whiteoutAlpha
    this.polarWhiteDome = B.MeshBuilder.CreateSphere(
      'p3_s6_white_dome',
      { diameter: 75, segments: 20, sideOrientation: B.Mesh.BACKSIDE },
      this.scene
    );
    this.polarWhiteDome.position.set(0, 1.6, 0);
    this.polarWhiteDome.material = this.polarWhiteDomeMat;
    this.polarWhiteDome.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.polarWhiteDome.parent = this.s6WaveRoot;

    this.s6WaveRoot.setEnabled(false);
  }

  // -------------------------------------------------------------------------
  // 9. Three Layered GPU ParticleSystems (Cryo Mist, Crystal Shards, Polar Prism Motes)
  // -------------------------------------------------------------------------

  _buildParticleSystems() {
    const B = globalThis.BABYLON;

    this.mistTex = this._trackTex(
      createSoftRadialParticleTexture(
        this.scene,
        'p3_cryo_mist_tex',
        'rgba(225, 255, 245, 0.72)',
        'rgba(150, 245, 220, 0.34)',
        'rgba(105, 240, 174, 0.08)'
      )
    );
    this.sparkTex = this._trackTex(
      createSoftRadialParticleTexture(
        this.scene,
        'p3_spark_mote_tex',
        'rgba(255, 255, 255, 0.96)',
        'rgba(135, 246, 238, 0.56)',
        'rgba(247, 195, 70, 0.14)'
      )
    );

    // Layer 1: Pressurized Cryogenic Mist erupting gently from 08 号 pod during S4-2
    const cryoMist = new B.ParticleSystem('p3_cryo_mist_ps', 220, this.scene);
    cryoMist.particleTexture = this.mistTex;
    cryoMist.emitter = new B.Vector3(POD08_POS[0], 0.88, POD08_POS[2]);
    cryoMist.minEmitBox = new B.Vector3(-0.38, 0.0, -0.78);
    cryoMist.maxEmitBox = new B.Vector3(0.38, 0.24, 0.78);
    cryoMist.color1 = new B.Color4(0.84, 1.0, 0.95, 0.42);
    cryoMist.color2 = new B.Color4(0.55, 0.96, 0.82, 0.32);
    cryoMist.colorDead = new B.Color4(0.75, 0.96, 1.0, 0.0);
    cryoMist.minSize = 0.28;
    cryoMist.maxSize = 0.82;
    cryoMist.minLifeTime = 1.1;
    cryoMist.maxLifeTime = 2.1;
    cryoMist.emitRate = 0;
    cryoMist.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
    cryoMist.gravity = new B.Vector3(0.12, -0.08, 0.18);
    cryoMist.direction1 = new B.Vector3(-0.15, 0.38, -0.15);
    cryoMist.direction2 = new B.Vector3(0.55, 0.82, 0.65);
    cryoMist.minEmitPower = 0.35;
    cryoMist.maxEmitPower = 0.85;
    cryoMist.updateSpeed = 1 / 30;
    cryoMist.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.cryoMistPS = cryoMist;

    // Layer 2: Weightless Cyan-Gold Crystal Shard Sparkle Motes (S4-1 shatter -> S5)
    const shardSparkle = new B.ParticleSystem('p3_shard_sparkle_ps', 160, this.scene);
    shardSparkle.particleTexture = this.sparkTex;
    shardSparkle.emitter = new B.Vector3(0, 2.0, 3.8);
    shardSparkle.minEmitBox = new B.Vector3(-3.2, -1.2, -1.6);
    shardSparkle.maxEmitBox = new B.Vector3(3.2, 1.6, 1.8);
    shardSparkle.color1 = new B.Color4(0.68, 0.99, 0.96, 0.88);
    shardSparkle.color2 = new B.Color4(0.99, 0.84, 0.44, 0.78);
    shardSparkle.colorDead = new B.Color4(0.8, 0.98, 1.0, 0.0);
    shardSparkle.minSize = 0.04;
    shardSparkle.maxSize = 0.14;
    shardSparkle.minLifeTime = 1.4;
    shardSparkle.maxLifeTime = 2.8;
    shardSparkle.emitRate = 0;
    shardSparkle.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    shardSparkle.gravity = new B.Vector3(0, 0.08, -0.04);
    shardSparkle.direction1 = new B.Vector3(-0.3, 0.12, -0.45);
    shardSparkle.direction2 = new B.Vector3(0.3, 0.55, 0.15);
    shardSparkle.minEmitPower = 0.15;
    shardSparkle.maxEmitPower = 0.55;
    shardSparkle.updateSpeed = 1 / 30;
    shardSparkle.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.shardSparklePS = shardSparkle;

    // Layer 3: Radiant Ascending Polar-Day Prism Light Motes (S5 -> S6)
    const polarPrism = new B.ParticleSystem('p3_polar_prism_ps', 160, this.scene);
    polarPrism.particleTexture = this.sparkTex;
    polarPrism.emitter = new B.Vector3(0, 1.2, 4.5);
    polarPrism.minEmitBox = new B.Vector3(-7.5, -1.5, -4.0);
    polarPrism.maxEmitBox = new B.Vector3(7.5, 3.5, 14.0);
    polarPrism.color1 = new B.Color4(1.0, 1.0, 1.0, 0.86);
    polarPrism.color2 = new B.Color4(0.86, 0.97, 1.0, 0.72);
    polarPrism.colorDead = new B.Color4(1.0, 1.0, 1.0, 0.0);
    polarPrism.minSize = 0.08;
    polarPrism.maxSize = 0.24;
    polarPrism.minLifeTime = 1.6;
    polarPrism.maxLifeTime = 3.2;
    polarPrism.emitRate = 0;
    polarPrism.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    polarPrism.gravity = new B.Vector3(0, 0.24, 0);
    polarPrism.direction1 = new B.Vector3(-0.35, 0.5, -0.35);
    polarPrism.direction2 = new B.Vector3(0.35, 1.2, 0.35);
    polarPrism.minEmitPower = 0.25;
    polarPrism.maxEmitPower = 0.9;
    polarPrism.updateSpeed = 1 / 30;
    polarPrism.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.polarPrismPS = polarPrism;

    this._particleSystems = [cryoMist, shardSparkle, polarPrism];
  }

  // -------------------------------------------------------------------------
  // Contract D Lifecycle Methods
  // -------------------------------------------------------------------------

  setActive(active) {
    const next = Boolean(active);
    this.active = next;
    this.root.setEnabled(next);

    for (const light of this._ownedLights) {
      light.setEnabled(next);
    }
    if (this.cabin) {
      if (this.cabin.deskLampLight) this.cabin.deskLampLight.setEnabled(next);
      if (this.cabin.cryoBayLight) this.cabin.cryoBayLight.setEnabled(next);
    }

    if (!next) {
      for (const ps of this._particleSystems) {
        ps.emitRate = 0;
        ps.stop();
        ps.reset();
      }
      this._lastEvaluatedSec = null;
    } else {
      for (const ps of this._particleSystems) {
        if (!ps.isStarted()) ps.start();
      }
    }
  }

  prewarmParticles(ticks = 18) {
    if (!this.active) return;
    const count = Math.max(0, Math.min(90, Math.round(Number.isFinite(ticks) ? ticks : 18)));
    for (const ps of this._particleSystems) {
      if (ps.emitRate > 0) {
        if (!ps.isStarted()) ps.start();
        for (let i = 0; i < count; i += 1) {
          ps.animate(true);
        }
      }
    }
  }

  evaluate(snapshot, _dtSec = 0) {
    if (!this.active || !snapshot) return;

    const tSec = Number.isFinite(snapshot.elapsedSec) ? snapshot.elapsedSec : 55.0;
    const isSeekJump = this._lastEvaluatedSec === null || Math.abs(tSec - this._lastEvaluatedSec) > 0.35;
    this._lastEvaluatedSec = tSec;

    const orbData = snapshot.orbExcursion4D || computeSealedBoxOrb4D(0);
    const xrayProgress = clamp(snapshot.xrayWaveProgress ?? 0, 0, 1);
    const shatterProgress = clamp(snapshot.shatterProgress ?? 0, 0, 1);
    const cryoWakeup = clamp(snapshot.cryoWakeupProgress ?? 0, 0, 1);
    const origamiProgress = clamp(snapshot.origamiFoldProgress ?? 0, 0, 1);
    const whiteoutAlpha = clamp(snapshot.post?.whiteoutAlpha ?? 0, 0, 1);

    const origamiAngles = computeBridgeOrigamiAngles(origamiProgress);

    // 1) Update Exterior Cosmic Backdrop & Distant 4D Megastructure
    this._evaluateBackdrop(tSec, origamiProgress, whiteoutAlpha);

    // 2) Update Hero 6-Face Sealed Borosilicate Box & 4D Calibration Sphere
    this._evaluateSealedBoxAndOrb(tSec, orbData, origamiProgress);

    // 3) Update Brief 4D Interior X-Ray Transparency Wave
    this._evaluateXrayWave(tSec, xrayProgress);

    // 4) Update Silent Orthogonal Bow Glass Shatter & 216 Weightless Shards
    this._evaluateBowShatterAndShards(tSec, shatterProgress, origamiProgress, whiteoutAlpha);

    // 5) Update Hero 08 号 Cryo-Pod Emergency Wake-up & 07 号 Lin Xia Choreography
    this._evaluatePod08AndLinXia(tSec, cryoWakeup, origamiProgress, whiteoutAlpha);

    // 6) Update S5 ±90° Architectural Bridge Origami Unfolding & S6 Polar-Day Waves
    this._evaluateOrigamiAndPolarWaves(tSec, origamiProgress, origamiAngles, whiteoutAlpha);

    // 7) Update Particle System Emission Rates & Deterministic Prewarm on Seek Jump
    this._evaluateParticles(tSec, shatterProgress, cryoWakeup, origamiProgress, whiteoutAlpha, isSeekJump);

    // 8) Update Shared Prologue Shader Bank Uniforms
    const sweepZ = lerp(5.4, -1.2, xrayProgress);
    const xrayEnvelope = xrayProgress > 0.001 && xrayProgress < 0.999 ? Math.sin(xrayProgress * Math.PI) : 0;
    const shaftOpacity =
      origamiProgress > 0.05
        ? lerp(0.22, 0.42, smoothstep(0.05, 0.7, origamiProgress)) * (1 - smoothstep(0.65, 1.0, whiteoutAlpha))
        : 0.24 * (1 - 0.35 * cryoWakeup);
    const shaftColorHex = origamiProgress > 0.32 ? '#EEF8FF' : '#8CF4EC';

    if (this.materials && typeof this.materials.updateShaders === 'function') {
      this.materials.updateShaders(tSec, {
        hingeIntensity: origamiAngles.hingeGlow * 1.48 * (1 - smoothstep(0.75, 1.0, whiteoutAlpha)),
        xraySweepZ: sweepZ,
        xrayIntensity: xrayEnvelope * 1.18,
        shaftOpacity,
        shaftColorHex,
      });
    }

    // Track active heroes for telemetry diagnostics
    const heroes = ['science_cabin'];
    if (tSec < 64.5) heroes.push('sealed_box_orb');
    if (xrayProgress > 0.01) heroes.push('xray_cutaway_wave');
    if (shatterProgress > 0.01) heroes.push('orthogonal_glass_shards');
    if (cryoWakeup > 0.01 && tSec < 66.0) heroes.push('pod_08_emergency_wake', 'lin_xia_07');
    if (origamiProgress > 0.01) heroes.push('origami_bridge_90deg', 'polar_geometric_planes');
    if (tSec >= 70.8) heroes.push('polar_day_light_wave');
    this._activeHeroes = heroes;
  }

  _evaluateBackdrop(tSec, origamiProgress, whiteoutAlpha) {
    const backdropFade = 1 - smoothstep(0.28, 0.78, origamiProgress);
    const showBackdrop = backdropFade > 0.01 && whiteoutAlpha < 0.95;
    this.backdropRoot.setEnabled(showBackdrop);
    if (!showBackdrop) return;

    // Live 2-tier SO(4) rotated 4D tesseract megastructure silhouette looming outside bow glass
    const tess = computeRecursiveTesseract4D(tSec * 0.85);
    const [ox, oy, oz] = this.megastructureOrigin;
    const baseScale = this.megastructureScale;

    const outerTier = tess.tiers[0];
    const midTier = tess.tiers[1];
    const edges = tess.edges;

    for (let i = 0; i < edges.length; i += 1) {
      const [ia, ib] = edges[i];

      const va0 = outerTier.vertices3[ia];
      const vb0 = outerTier.vertices3[ib];
      writeBeamMatrixToBuffer(
        this._megaCyanBuf,
        i,
        ox + va0[0] * baseScale,
        oy + va0[1] * baseScale,
        oz + va0[2] * baseScale,
        ox + vb0[0] * baseScale,
        oy + vb0[1] * baseScale,
        oz + vb0[2] * baseScale,
        0.58 * backdropFade,
        this._tmpDir,
        this._tmpUp,
        this._tmpQ,
        this._tmpM,
        this._tmpPos,
        this._tmpScale
      );

      const va1 = midTier.vertices3[ia];
      const vb1 = midTier.vertices3[ib];
      writeBeamMatrixToBuffer(
        this._megaGoldBuf,
        i,
        ox + va1[0] * baseScale * 1.05,
        oy + va1[1] * baseScale * 1.05,
        oz + va1[2] * baseScale * 1.05,
        ox + vb1[0] * baseScale * 1.05,
        oy + vb1[1] * baseScale * 1.05,
        oz + vb1[2] * baseScale * 1.05,
        0.44 * backdropFade,
        this._tmpDir,
        this._tmpUp,
        this._tmpQ,
        this._tmpM,
        this._tmpPos,
        this._tmpScale
      );
    }

    this.megaCyanMaster.thinInstanceSetBuffer('matrix', this._megaCyanBuf, 16, false);
    this.megaGoldMaster.thinInstanceSetBuffer('matrix', this._megaGoldBuf, 16, false);

    for (let i = 0; i < this.horizonRings.length; i += 1) {
      const ring = this.horizonRings[i];
      ring.rotation.z = tSec * (0.09 + i * 0.04) * (i % 2 === 0 ? 1 : -1);
      ring.rotation.y = Math.sin(tSec * 0.14 + i) * 0.24;
      ring.scaling.setAll(Math.max(0.01, backdropFade));
    }

    this.distantStarMat.alpha = 0.78 * backdropFade;
    for (const shaft of this.bowShafts) {
      shaft.isVisible = origamiProgress < 0.35;
    }
  }

  _evaluateSealedBoxAndOrb(tSec, orbData, origamiProgress) {
    // Keep sealed box & calibration sphere cleanly mounted on the desk; smoothly lift away late in S5
    const deskFade = 1 - smoothstep(0.55, 0.92, origamiProgress);
    const visible = deskFade > 0.02;
    this.sealedBoxRoot.setEnabled(visible);
    if (!visible) {
      this.orbLight.intensity = 0;
      return;
    }

    // Subtle zero-G levitation of box assembly once bridge unfolds in S5
    const s5FloatY = origamiProgress * 0.45;
    this.sealedBoxRoot.position.set(
      BOX_CENTER_WORLD[0],
      BOX_CENTER_WORLD[1] + s5FloatY,
      BOX_CENTER_WORLD[2]
    );

    const pos3 = orbData.pos3 || [0, 0, 0];
    const w = orbData.w ?? 0;
    const haloAlpha = clamp(orbData.sliceHaloAlpha ?? 0, 0, 1);
    const glowIntensity = orbData.glowIntensity ?? 1.0;

    // Position calibration sphere directly from computeSealedBoxOrb4D trajectory
    this.orbRoot.position.set(pos3[0], pos3[1], pos3[2]);

    // Delicate astronomical gimbal rotation accelerating slightly during 4D W-excursion
    const spinBoost = 1.0 + Math.abs(w) * 4.5;
    this.calibSphere.rotation.y = tSec * 0.85 * spinBoost;
    this.calibSphere.rotation.x = Math.sin(tSec * 0.65) * 0.28;
    this.orbRingOuter.rotation.set(tSec * 1.15 * spinBoost, tSec * 0.72, 0.35);
    this.orbRingInner.rotation.set(-tSec * 1.45 * spinBoost, -tSec * 0.95, 0.92);

    // Subtle 4D cross-section scale modulation while passing through W != 0
    const sliceScale = orbData.sliceRadiusScale ?? 1.0;
    const visualScale = lerp(1.0, Math.max(0.76, sliceScale), 0.55);
    this.calibSphere.scaling.setAll(visualScale);

    // 4D W-axis phase contour halo & aura around sphere
    const haloBoost = Math.max(haloAlpha, smoothstep(55.4, 56.3, tSec) * (1 - smoothstep(59.4, 60.6, tSec)) * 0.45);
    this.phaseHaloMat.alpha = clamp(haloBoost * 0.92, 0, 0.92);
    this.phaseAuraMat.alpha = clamp(haloBoost * 0.34, 0, 0.36);

    const haloPulse = 1.0 + 0.14 * Math.sin(tSec * 9.5);
    this.orbPhaseHalo.scaling.setAll((0.88 + haloBoost * 0.42) * haloPulse);
    this.orbPhaseHalo.rotation.y = tSec * 2.1;
    this.orbPhaseHalo.isVisible = haloBoost > 0.03;
    this.orbPhaseAura.scaling.setAll(0.95 + haloBoost * 0.32);
    this.orbPhaseAura.isVisible = haloBoost > 0.03;

    // Luminous cyan 4D intersection ring right on the intact +X borosilicate wall (x = +0.225)
    // Active while |w| > 0.05 AND leaves a graceful residual memory ripple through KF-14 (58.6s)
    const wallMemory = smoothstep(55.8, 56.5, tSec) * (1 - smoothstep(59.1, 60.4, tSec));
    const wallRingStrength = Math.max(Math.abs(w) > 0.05 ? haloAlpha : 0, wallMemory * 0.68);
    const wallY = clamp(pos3[1] * 0.55, -BOX_HALF * 0.65, BOX_HALF * 0.65);
    const wallZ = clamp(pos3[2] * 0.55, -BOX_HALF * 0.65, BOX_HALF * 0.65);

    this.wallIntersectionRoot.position.set(BOX_HALF + 0.005, wallY, wallZ);
    this.wallIntersectionRoot.setEnabled(wallRingStrength > 0.03);
    if (wallRingStrength > 0.03) {
      const r1 = 0.72 + wallRingStrength * 0.52 + 0.08 * Math.sin(tSec * 11.0);
      const r2 = 0.92 + ((tSec * 0.85) % 0.65) * 0.78;
      this.wallRingPrimary.scaling.setAll(r1);
      this.wallRingRipple.scaling.setAll(r2);
    }

    // 4D phase-wake filament & 3 translucent echo rings connecting intact +X wall to emerged orb
    const emergedDist = pos3[0] - BOX_HALF;
    const wakeStrength = emergedDist > 0.02 ? wallMemory * smoothstep(0.02, 0.18, emergedDist) : 0;
    this.phaseWakeMat.alpha = clamp(wakeStrength * 0.62, 0, 0.68);

    const showWake = wakeStrength > 0.03;
    this.phaseWakeBeam.isVisible = showWake;
    if (showWake) {
      const ax = BOX_HALF + 0.005;
      const ay = wallY;
      const az = wallZ;
      const bx = pos3[0];
      const by = pos3[1];
      const bz = pos3[2];
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const len = Math.max(0.01, Math.hypot(dx, dy, dz));
      this.phaseWakeBeam.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
      this.phaseWakeBeam.scaling.set(0.65 + 0.35 * wakeStrength, len, 0.65 + 0.35 * wakeStrength);

      this._tmpDir.set(dx / len, dy / len, dz / len);
      const dot = clamp(globalThis.BABYLON.Vector3.Dot(this._tmpUp, this._tmpDir), -1, 1);
      if (!this.phaseWakeBeam.rotationQuaternion) {
        this.phaseWakeBeam.rotationQuaternion = new globalThis.BABYLON.Quaternion();
      }
      if (dot > 0.9999) {
        this.phaseWakeBeam.rotationQuaternion.set(0, 0, 0, 1);
      } else if (dot < -0.9999) {
        globalThis.BABYLON.Quaternion.RotationAxisToRef(globalThis.BABYLON.Axis.X, Math.PI, this.phaseWakeBeam.rotationQuaternion);
      } else {
        const axis = globalThis.BABYLON.Vector3.Cross(this._tmpUp, this._tmpDir).normalize();
        globalThis.BABYLON.Quaternion.RotationAxisToRef(axis, Math.acos(dot), this.phaseWakeBeam.rotationQuaternion);
      }

      for (let i = 0; i < this.phaseEchoRings.length; i += 1) {
        const frac = (i + 1) / (this.phaseEchoRings.length + 1);
        const echo = this.phaseEchoRings[i];
        echo.isVisible = true;
        echo.position.set(lerp(ax, bx, frac), lerp(ay, by, frac), lerp(az, bz, frac));
        const s = (0.85 + 0.25 * Math.sin(tSec * 6.5 - i * 1.4)) * (0.75 + 0.35 * frac);
        echo.scaling.setAll(s);
      }
    } else {
      for (const echo of this.phaseEchoRings) echo.isVisible = false;
    }

    this.orbLight.intensity = (1.15 + glowIntensity * 0.95) * deskFade;
  }

  _evaluateXrayWave(tSec, xrayProgress) {
    const active = xrayProgress > 0.002 && xrayProgress < 0.998;
    this.xrayRoot.setEnabled(active);
    if (!active) return;

    // Sweep cleanly across cabin from bow (z = +5.4) through lab desk (z = 2.05) to aft (z = -1.2)
    // At KF-14 (58.6s, xrayProgress = 0.583), sweepZ = +1.55m — right across desk & foreground bulkheads!
    const sweepZ = lerp(5.4, -1.2, xrayProgress);
    const envelope = Math.sin(xrayProgress * Math.PI);
    const shimmer = 0.86 + 0.14 * Math.sin(tSec * 22.0);

    this.xrayScanCurtain.position.z = sweepZ;
    this.xrayPlaneMat.alpha = clamp(0.22 * envelope * shimmer, 0, 0.28);
    this.xrayRibCyanMat.alpha = clamp(0.84 * envelope * shimmer, 0, 0.9);
    this.xrayConduitGoldMat.alpha = clamp(0.9 * envelope * shimmer, 0, 0.94);
  }

  _evaluateBowShatterAndShards(tSec, shatterProgress, origamiProgress, whiteoutAlpha) {
    const showCrack = shatterProgress > 0.005 && shatterProgress < 0.54;
    const shattered = shatterProgress >= 0.36;

    // Intact bow canopy stays visible until orthogonal 4D cracks complete at shatterProgress = 0.36
    this.cabin.setBowWindowIntact(!shattered && origamiProgress < 0.15);

    this.bowCrackArc.isVisible = showCrack;
    if (showCrack) {
      const crackIn = smoothstep(0.0, 0.34, shatterProgress);
      const crackOut = 1 - smoothstep(0.36, 0.52, shatterProgress);
      this.crackMat.alpha = clamp(crackIn * crackOut * 0.96, 0, 0.96);
    } else {
      this.crackMat.alpha = 0;
    }

    const showShards = shattered && whiteoutAlpha < 0.98;
    this.shardMaster.isVisible = showShards;
    this.goldShardMaster.isVisible = showShards;
    if (!showShards) return;

    // Deterministic elapsed drift since silent fracture moment (59.52s)
    const driftT = Math.max(0, tSec - 59.52);
    const spiralBlend = easeInOutCubic(smoothstep(0.02, 0.88, origamiProgress));
    const shardScaleFade = 1 - smoothstep(0.75, 1.0, whiteoutAlpha);

    // Update 216 weightless beveled luminous cyan-crystal glass shards
    for (let i = 0; i < this.shardCount; i += 1) {
      const s = this._shardSeeds[i];

      // Phase A: Serene zero-G inward & slightly upward drift (S4-1 -> S4-2)
      const driftEase = Math.min(driftT, 4.5) * 0.88 + Math.max(0, driftT - 4.5) * 0.25;
      const baseX = s.x0 + s.vx * driftEase;
      const baseY = s.y0 + s.vy * driftEase + Math.sin(tSec * 1.1 + i * 0.3) * 0.06;
      const baseZ = s.z0 + s.vz * driftEase;

      // Phase B: Graceful ascending polar-day spiral vortex (S5 -> S6)
      const theta = s.ang * 2.4 + origamiProgress * Math.PI * 2.2 * s.spiralSpeed + (i % 7) * 0.35;
      const swirlR = s.spiralR * (0.78 + origamiProgress * 0.72);
      const swirlX = Math.sin(theta) * swirlR;
      const swirlY = 0.8 + s.y0 * 0.7 + s.spiralLift * easeOutExpo(origamiProgress);
      const swirlZ = 4.2 + Math.cos(theta) * swirlR * 0.85 + origamiProgress * 6.5;

      const x = lerp(baseX, swirlX, spiralBlend);
      const y = lerp(baseY, swirlY, spiralBlend);
      const z = lerp(baseZ, swirlZ, spiralBlend);

      const rx = s.rx0 + s.vrx * driftT;
      const ry = s.ry0 + s.vry * driftT + spiralBlend * 1.4;
      const rz = s.rz0 + s.vrz * driftT;

      const sc = Math.max(0.01, shardScaleFade);
      writeMatrixToBuffer(
        this._shardBuf,
        i,
        [x, y, z],
        [rx, ry, rz],
        [s.sx * sc, s.sy * sc, s.sz * sc],
        this._tmpQ,
        this._tmpM,
        this._tmpPos,
        this._tmpScale
      );
    }
    this.shardMaster.thinInstanceSetBuffer('matrix', this._shardBuf, 16, false);

    // Update 48 companion gold-cyan refractive prism slivers
    for (let i = 0; i < this.goldShardCount; i += 1) {
      const s = this._goldShardSeeds[i];
      const driftEase = Math.min(driftT, 4.5) * 0.92 + Math.max(0, driftT - 4.5) * 0.28;
      const baseX = s.x0 + s.vx * driftEase;
      const baseY = s.y0 + s.vy * driftEase + Math.cos(tSec * 1.3 + i) * 0.07;
      const baseZ = s.z0 + s.vz * driftEase;

      const theta = -s.ang * 2.8 - origamiProgress * Math.PI * 2.6 * s.spiralSpeed + i * 0.4;
      const swirlR = s.spiralR * (0.8 + origamiProgress * 0.78);
      const swirlX = Math.sin(theta) * swirlR;
      const swirlY = 1.1 + s.y0 * 0.65 + s.spiralLift * easeOutExpo(origamiProgress);
      const swirlZ = 4.6 + Math.cos(theta) * swirlR * 0.9 + origamiProgress * 7.2;

      const x = lerp(baseX, swirlX, spiralBlend);
      const y = lerp(baseY, swirlY, spiralBlend);
      const z = lerp(baseZ, swirlZ, spiralBlend);

      const sc = Math.max(0.01, shardScaleFade);
      writeMatrixToBuffer(
        this._goldShardBuf,
        i,
        [x, y, z],
        [Math.PI * 0.5 + s.vrx * driftT, s.ang + s.vry * driftT, s.vrz * driftT],
        [s.sx * sc, s.sy * sc, s.sz * sc],
        this._tmpQ,
        this._tmpM,
        this._tmpPos,
        this._tmpScale
      );
    }
    this.goldShardMaster.thinInstanceSetBuffer('matrix', this._goldShardBuf, 16, false);
  }

  _evaluatePod08AndLinXia(tSec, cryoWakeup, origamiProgress, whiteoutAlpha) {
    // 1) Hero 08 号 Cryo-Pod Emergency Wake-up State
    if (cryoWakeup <= 0.005) {
      this.cabin.setPod08State({
        mode: 'sleeping',
        openAmount: 0,
        alertPulse: 0,
        title: '08 号',
        subtitle: '冬眠中',
        accentHex: '#58A6FF',
      });
      this.cryoWakeRoot.setEnabled(false);
      this.pod08WakeLight.intensity = 0;
    } else {
      const openAmount = easeInOutCubic(smoothstep(0.08, 0.74, cryoWakeup));
      const pulse = 0.58 + 0.42 * Math.sin((tSec - 61.0) * 9.5);
      this.cabin.setPod08State({
        mode: 'waking',
        openAmount,
        alertPulse: pulse,
        title: '08 号',
        subtitle: '紧急唤醒',
        accentHex: PALETTE.accent.emerald,
      });

      const wakeVisual = smoothstep(0.0, 0.14, cryoWakeup) * (1 - smoothstep(0.0, 0.25, origamiProgress));
      this.cryoWakeRoot.setEnabled(wakeVisual > 0.02);
      this.emeraldHaloMat.alpha = clamp(wakeVisual * (0.28 + 0.16 * pulse), 0, 0.46);
      this.pod08BeaconRing.scaling.setAll(0.92 + 0.12 * pulse);
      this.pod08WakeLight.intensity = wakeVisual * (2.6 + 1.2 * pulse);
    }

    // Subtle cabin status strip color shift (restrained amber during S4-1 anomaly, emerald during S4-2 wake)
    const anomalyAlert = smoothstep(55.5, 57.5, tSec) * (1 - smoothstep(61.0, 62.0, tSec)) * 0.55;
    this.cabin.setAlertLevel(anomalyAlert, tSec);

    // 2) Sculpted 07 号 Lin Xia Deterministic Choreography (zero crimson ribbon!)
    const lx = this.cabin.linXiaRig;
    const lxVisible = whiteoutAlpha < 0.88;
    lx.root.setEnabled(lxVisible);
    if (!lxVisible) return;

    const breath = Math.sin(tSec * 2.1) * 0.02;

    if (tSec < 59.3) {
      // S4-1: Standing beside central lab desk, astonished staring at sealed-box 4D sphere passage
      lx.root.position.set(0.45, 0, 1.48);
      lx.setPose('turning', 1.0, tSec);
    } else if (tSec < 64.0) {
      // S4-1 -> S4-2: Rushes gracefully back toward waking 08 号 pod, reaching urgently toward 08 号!
      // By KF-16 (62.6s), positioned cleanly at (-1.35, 0, -1.95) on left rule-of-thirds beside 08 号 pod!
      const moveU = easeInOutCubic(smoothstep(59.3, 61.6, tSec));
      const px = lerp(0.45, -1.35, moveU);
      const pz = lerp(1.48, -1.95, moveU);
      lx.root.position.set(px, 0, pz);

      // Deterministic urgent reaching pose facing 08 号 pod (-2.3, 1.1, -1.6)
      lx.root.rotation.y = lerp(-0.58, -1.18, moveU);
      lx.torsoPivot.rotation.set(lerp(0.06, 0.12, moveU) + breath, lerp(-0.25, -0.08, moveU), 0);
      lx.headPivot.rotation.set(lerp(0.12, -0.02, moveU), lerp(-0.32, -0.1, moveU), 0);
      lx.leftArm.shoulder.rotation.set(-0.58, 0, 0.24);
      lx.leftArm.elbow.rotation.set(-0.76, 0, 0);
      lx.rightArm.shoulder.rotation.set(lerp(-0.42, -1.28, moveU), 0.14, -0.18);
      lx.rightArm.elbow.rotation.set(lerp(-0.58, -0.26, moveU), 0, 0);
    } else {
      // S5 -> S6: Standing in foreground-right (1.28, 0, 1.25) looking upward in awe as bridge unfolds
      const s5U = easeInOutCubic(smoothstep(64.0, 66.2, tSec));
      const floatDrop = -easeInOutCubic(smoothstep(0.28, 0.9, origamiProgress)) * 0.6;
      lx.root.position.set(lerp(-1.35, 1.28, s5U), floatDrop, lerp(-1.95, 1.25, s5U));
      lx.root.rotation.y = lerp(-1.18, -0.32, s5U);
      lx.torsoPivot.rotation.set(-0.08 + breath, 0.06, 0);
      lx.headPivot.rotation.set(-0.34, -0.08, 0);
      lx.leftArm.shoulder.rotation.set(-0.36, 0, 0.18);
      lx.leftArm.elbow.rotation.set(-0.48, 0, 0);
      lx.rightArm.shoulder.rotation.set(-0.44, 0, -0.2);
      lx.rightArm.elbow.rotation.set(-0.52, 0, 0);
    }
  }

  _evaluateOrigamiAndPolarWaves(tSec, origamiProgress, angles, whiteoutAlpha) {
    const B = globalThis.BABYLON;
    const { floorPivot, ceilingPivot, leftWallPivot, rightWallPivot, bowUpperPivot, bowLowerPivot, hingeBars } =
      this.cabin.origamiPivots;

    const spread = angles.expansionSpread ?? 0;

    // Apply TRUE OUTWARD ±90° architectural origami unfolding rotations (verified in Babylon left-handed space!):
    // - Left wall (+Z rot) unfolds outward left (+Y -> -X)
    // - Right wall (-Z rot) unfolds outward right (+Y -> +X)
    // - Ceiling hinged at front z=+4.95 (+X rot) unfolds upward & forward (-Z -> +Y)
    // - Floor hinged at rear z=-4.70 (+X rot) unfolds downward & forward (+Z -> -Y)
    // - Upper bow (-X rot) unfolds upward & forward (-Y -> +Z)
    // - Lower bow (+X rot) unfolds downward & forward (+Y -> +Z)
    leftWallPivot.rotation.z = Math.abs(angles.leftBulkheadRad ?? 0);
    rightWallPivot.rotation.z = -Math.abs(angles.rightBulkheadRad ?? 0);
    ceilingPivot.rotation.x = Math.abs(angles.ceilingRad ?? 0);
    floorPivot.rotation.x = Math.abs(angles.floorRad ?? 0);
    bowUpperPivot.rotation.x = -Math.abs(angles.bowUpperRad ?? 0);
    bowLowerPivot.rotation.x = Math.abs(angles.bowLowerRad ?? 0);

    leftWallPivot.position.x = -4.35 - spread * 0.95;
    rightWallPivot.position.x = 4.35 + spread * 0.95;
    ceilingPivot.position.y = 4.15 + spread * 0.72;
    bowUpperPivot.position.y = 4.1 + spread * 0.85;
    bowLowerPivot.position.y = 0.05 - spread * 0.65;

    // Show & pulse cyan-gold 4D origami hinge light-ribbons
    const showHinges = (angles.hingeGlow ?? 0) > 0.02 && whiteoutAlpha < 0.96;
    for (const bar of hingeBars) {
      bar.isVisible = showHinges;
    }

    // Secondary outer luminous origami wing leaves blossoming outward from cabin walls
    const wingUnfold = easeInOutCubic(smoothstep(0.14, 0.88, origamiProgress));
    const showWings = wingUnfold > 0.02 && whiteoutAlpha < 0.96;
    for (const w of this._secondaryWings) {
      for (const m of w.meshes) m.isVisible = showWings;
      const a = wingUnfold * Math.PI * 0.42;
      if (w.axis === 'zPos') w.pivot.rotation.z = -a;
      else if (w.axis === 'zNeg') w.pivot.rotation.z = a;
      else if (w.axis === 'xNeg') w.pivot.rotation.x = -a;
      else if (w.axis === 'xPos') w.pivot.rotation.x = a;
    }

    // Smoothly wash P3 dark titanium cabin bulkheads into luminous polar-day platinum during S5
    const polarWash = smoothstep(0.8, 1.0, origamiProgress);
    this.p3BulkheadMat.albedoColor = B.Color3.Lerp(
      B.Color3.FromHexString('#22324A'),
      B.Color3.FromHexString('#EEF5FB'),
      polarWash
    );
    this.p3BulkheadMat.emissiveColor = B.Color3.FromHexString('#D8ECFA').scale(polarWash * 0.78);

    // Modulate interior warm desk lamp & cryo bay light gracefully as polar day takes over
    if (this.cabin.deskLampLight) {
      this.cabin.deskLampLight.intensity = lerp(2.6, 0.4, smoothstep(0.15, 0.75, origamiProgress));
    }

    // Fade desk & cryo-pods cleanly in late S5 / S6 polar whiteout so pure geometric light space dominates
    const deskActive = origamiProgress < 0.82 && whiteoutAlpha < 0.85;
    this.cabin.deskRoot.setEnabled(deskActive);
    if (deskActive && origamiProgress > 0.05) {
      this.cabin.deskRoot.position.y = -easeInOutCubic(smoothstep(0.2, 0.82, origamiProgress)) * 2.4;
    } else {
      this.cabin.deskRoot.position.y = 0;
    }

    const podsVisible = whiteoutAlpha < 0.72;
    for (const pod of this.cabin.cryoPods) {
      pod.root.setEnabled(podsVisible);
    }

    // Infinite pure-abstract polar-day geometric vista revealed as cabin unfolds (S5 -> S6)
    const vistaAlpha = smoothstep(0.04, 0.45, origamiProgress);
    const showVista = vistaAlpha > 0.01;
    this.polarVistaRoot.setEnabled(showVista);
    if (showVista) {
      this.polarGridMat.alpha = clamp(vistaAlpha * 0.72 * (1 - smoothstep(0.55, 0.98, whiteoutAlpha)), 0, 0.78);
      this.polarHorizonLight.intensity = vistaAlpha * (6.8 + 4.5 * smoothstep(0.5, 1.0, origamiProgress));

      // Update 56 floating pure-abstract polar-day origami planes unfolding into infinity
      const expand = 0.45 + 0.85 * easeInOutCubic(origamiProgress);
      for (let i = 0; i < this.origamiPlaneCount; i += 1) {
        const p = this._origamiPlaneSeeds[i];
        const ang = p.angle + origamiProgress * 0.24 * p.tiltSign;
        const rad = p.radius * expand;
        const x = Math.cos(ang) * rad;
        const y = 1.8 + Math.sin(ang) * rad * 0.72 + Math.sin(tSec * 0.7 + p.phase) * 0.35;
        const z = p.zBase + origamiProgress * 8.0;

        const foldRot = (1 - origamiProgress) * Math.PI * 0.45 * p.tiltSign;
        const sc = Math.max(0.01, vistaAlpha * (0.75 + 0.35 * origamiProgress));
        writeMatrixToBuffer(
          this._origamiPlaneBuf,
          i,
          [x, y, z],
          [foldRot * 0.5, ang + Math.PI * 0.5, foldRot],
          [p.sx * sc, p.sy * sc, sc],
          this._tmpQ,
          this._tmpM,
          this._tmpPos,
          this._tmpScale
        );
      }
      this.origamiPlaneMaster.thinInstanceSetBuffer('matrix', this._origamiPlaneBuf, 16, false);

      // Update 24 radiant brushed-gold architectural horizon bars
      for (let i = 0; i < this.origamiBarCount; i += 1) {
        const ring = Math.floor(i / 4);
        const side = i % 4;
        const z = 11.0 + ring * 10.5 + origamiProgress * 5.0;
        const r = (7.2 + ring * 3.4) * expand;
        const ang = (side * Math.PI) / 2 + Math.PI / 4 + origamiProgress * 0.18;
        const x = Math.cos(ang) * r;
        const y = 2.0 + Math.sin(ang) * r * 0.7;
        const sc = Math.max(0.01, vistaAlpha);
        writeMatrixToBuffer(
          this._origamiBarBuf,
          i,
          [x, y, z],
          [0, 0, ang + Math.PI * 0.5],
          [sc * 1.1, sc, sc],
          this._tmpQ,
          this._tmpM,
          this._tmpPos,
          this._tmpScale
        );
      }
      this.origamiBarMaster.thinInstanceSetBuffer('matrix', this._origamiBarBuf, 16, false);

      for (const shaft of this.polarShafts) {
        shaft.isVisible = whiteoutAlpha < 0.92;
      }
    } else {
      this.polarHorizonLight.intensity = 0;
    }

    // S6 Polar-Day Pure-White Expanding Geometric Light Wave Domes (70.4s – 75.0s)
    const s6WaveU = clamp((tSec - 70.4) / 4.2, 0, 1);
    const showS6Waves = s6WaveU > 0.005;
    this.s6WaveRoot.setEnabled(showS6Waves);
    if (showS6Waves) {
      const waveFadeIn = smoothstep(0.0, 0.25, s6WaveU);
      this.polarWaveMat.alpha = clamp(waveFadeIn * (0.28 + 0.52 * whiteoutAlpha), 0, 0.85);
      this.polarWaveEdgeMat.alpha = clamp(waveFadeIn * (0.55 - 0.35 * whiteoutAlpha), 0, 0.6);
      this.polarWhiteDomeMat.alpha = clamp(smoothstep(0.18, 0.92, whiteoutAlpha) * 0.96, 0, 0.96);

      const scales = [
        lerp(1.4, 34.0, easeOutExpo(clamp(s6WaveU * 1.15, 0, 1))),
        lerp(1.0, 28.0, easeOutExpo(clamp((s6WaveU - 0.08) * 1.18, 0, 1))),
        lerp(0.8, 22.0, easeOutExpo(clamp((s6WaveU - 0.16) * 1.22, 0, 1))),
      ];
      for (let i = 0; i < this.s6WaveDomes.length; i += 1) {
        const dome = this.s6WaveDomes[i];
        dome.scaling.setAll(Math.max(0.01, scales[i]));
        dome.rotation.set(tSec * (0.18 + i * 0.07), tSec * (0.24 - i * 0.06), i * 0.45);
      }
    }
  }

  _evaluateParticles(tSec, shatterProgress, cryoWakeup, origamiProgress, whiteoutAlpha, isSeekJump) {
    // 1) Pressurized Cryo Mist from 08 号 pod (peaks across S4-2 KF-16 at 62.6s, clears smoothly by 64.0s)
    const mistEnvelope =
      cryoWakeup > 0.08 && tSec < 64.6
        ? smoothstep(0.08, 0.26, cryoWakeup) * (1 - smoothstep(0.72, 1.0, cryoWakeup))
        : 0;
    const prevMist = this.cryoMistPS.emitRate;
    this.cryoMistPS.emitRate = Math.round(mistEnvelope * 165);

    // 2) Crystal Shard Sparkle Motes (active from bow fracture through S5 origami unfolding)
    const shardSparkEnvelope =
      shatterProgress >= 0.34 ? smoothstep(0.34, 0.55, shatterProgress) * (1 - smoothstep(0.65, 1.0, whiteoutAlpha)) : 0;
    const prevShard = this.shardSparklePS.emitRate;
    this.shardSparklePS.emitRate = Math.round(shardSparkEnvelope * 95);

    // 3) Polar-Day Ascending Prism Motes (active across S5 & S6, subtly present during S4-1 bow glow too)
    const polarPrismEnvelope =
      origamiProgress > 0.02
        ? smoothstep(0.02, 0.3, origamiProgress) * (1 - 0.35 * whiteoutAlpha)
        : smoothstep(55.0, 56.2, tSec) * 0.22;
    const prevPolar = this.polarPrismPS.emitRate;
    this.polarPrismPS.emitRate = Math.round(polarPrismEnvelope * 90);

    // Deterministic clean reset & prewarm on seekPrologue jumps so particles match exact timestamp
    if (isSeekJump) {
      for (const ps of this._particleSystems) {
        ps.reset();
        if (ps.emitRate > 0) {
          if (!ps.isStarted()) ps.start();
          for (let i = 0; i < 16; i += 1) {
            ps.animate(true);
          }
        }
      }
      return;
    }

    // Ensure systems start seamlessly on live transition from 0 -> >0 emitRate
    if (prevMist === 0 && this.cryoMistPS.emitRate > 0 && !this.cryoMistPS.isStarted()) {
      this.cryoMistPS.start();
    }
    if (prevShard === 0 && this.shardSparklePS.emitRate > 0 && !this.shardSparklePS.isStarted()) {
      this.shardSparklePS.start();
    }
    if (prevPolar === 0 && this.polarPrismPS.emitRate > 0 && !this.polarPrismPS.isStarted()) {
      this.polarPrismPS.start();
    }
  }

  getDiagnostics() {
    const childMeshes = this.root ? this.root.getChildMeshes(false) : [];
    const activeMeshCount = childMeshes.filter((m) => m.isEnabled() && m.isVisible).length;
    return {
      segmentId: this.segmentId,
      active: this.active,
      meshCount: activeMeshCount,
      totalMeshes: childMeshes.length,
      activeHeroes: [...this._activeHeroes],
      particleSystems: this._particleSystems.length,
    };
  }

  dispose() {
    for (const ps of this._particleSystems) {
      ps.stop();
      ps.dispose(false);
    }
    this._particleSystems = [];

    for (const light of this._ownedLights) {
      light.dispose();
    }
    this._ownedLights = [];

    if (this.cabin) {
      this.cabin.dispose();
      this.cabin = null;
    }

    if (this.root) {
      this.root.dispose();
      this.root = null;
    }

    for (const mat of this._ownedMats) {
      mat.dispose(false, false);
    }
    this._ownedMats = [];

    for (const tex of this._ownedTex) {
      tex.dispose();
    }
    this._ownedTex = [];
  }
}
