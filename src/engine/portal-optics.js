/**
 * Beyond 3D — Chapter 1 Tesseract Portal Optics, 24m Self-Silhouette Pool & 8-Cell Hologram Map
 *
 * Implements:
 * - Exact 4D-to-3D seamless neighbor cell transform across all 48 directed tesseract face transitions
 * - Intrinsic 6-DOF Zero-G camera quaternion bridge (zero gimbal lock)
 * - Level 1 24m optical loop same-side waving Self-Silhouette Astronaut (with red left armband)
 *   + First-Person foreground left-arm wave synchronizer
 * - Sculpted Bronze/Ivory Astronaut Porthole Statues with clear facing visors & directional chevrons
 * - F-key Collapsible 8-Cell Tesseract Unfolded Holographic Topology Map
 */

import {
  ANTIPODAL_CELL,
  CELL_BASES,
  CELL_COLORS,
  CELL_IDS,
  CELL_NORMALS,
  CELL_SIZE,
  getNeighbors,
  tangent4ToCellLocal3,
  transportTangent4,
  UNFOLDED_NET_POS,
} from '../core/tesseract-boundary.js';
import { PALETTE, RENDER_GROUPS } from './phase-materials.js';

/**
 * Apply ZeroGBoundaryNavigator's exact 3D local position & positively oriented orthonormal triad
 * directly to a Babylon FreeCamera via `rotationQuaternion` (zero gimbal lock).
 */
export function applyIntrinsicFrameToCamera(camera, localPos3, localFrame3) {
  const B = globalThis.BABYLON;
  camera.position.set(localPos3[0], localPos3[1], localPos3[2]);
  const r = new B.Vector3(localFrame3.right[0], localFrame3.right[1], localFrame3.right[2]);
  const u = new B.Vector3(localFrame3.up[0], localFrame3.up[1], localFrame3.up[2]);
  const f = new B.Vector3(localFrame3.forward[0], localFrame3.forward[1], localFrame3.forward[2]);
  if (!camera.rotationQuaternion) {
    camera.rotationQuaternion = new B.Quaternion();
  }
  B.Quaternion.RotationQuaternionFromAxisToRef(r, u, f, camera.rotationQuaternion);
}

/**
 * Compute the exact 3D position and Babylon orientation quaternion of an adjacent tesseract
 * neighbor cell `neighborCellId` as seen seamlessly across its shared doorway from `currentCellId`.
 */
export function computeNeighborTransformInCell(currentCellId, neighborCellId) {
  const B = globalThis.BABYLON;
  const dirLocal = tangent4ToCellLocal3(currentCellId, CELL_NORMALS[neighborCellId]);
  const position = new B.Vector3(
    dirLocal[0] * CELL_SIZE,
    dirLocal[1] * CELL_SIZE,
    dirLocal[2] * CELL_SIZE
  );

  const [b0, b1, b2] = CELL_BASES[neighborCellId];
  const r3 = tangent4ToCellLocal3(currentCellId, transportTangent4(b0, neighborCellId, currentCellId));
  const u3 = tangent4ToCellLocal3(currentCellId, transportTangent4(b1, neighborCellId, currentCellId));
  const f3 = tangent4ToCellLocal3(currentCellId, transportTangent4(b2, neighborCellId, currentCellId));

  const rotationQuaternion = B.Quaternion.RotationQuaternionFromAxis(
    new B.Vector3(r3[0], r3[1], r3[2]),
    new B.Vector3(u3[0], u3[1], u3[2]),
    new B.Vector3(f3[0], f3[1], f3[2])
  );

  return { position, rotationQuaternion, dirLocal };
}

/**
 * Build the 24m-away Self-Silhouette Astronaut (08 号) for Level 1's straight closed corridor loop.
 * Faces +Z (away from the viewer so you see your own back, backpack, and SAME-SIDE LEFT arm waving!).
 */
export function buildAstronautSilhouette(scene, name = 'self_silhouette_08') {
  const B = globalThis.BABYLON;
  const root = new B.TransformNode(name, scene);

  const suitMat = new B.PBRMaterial(`${name}_suit`, scene);
  suitMat.albedoColor = B.Color3.FromHexString('#E4E9F0');
  suitMat.metallic = 0.12;
  suitMat.roughness = 0.42;
  suitMat.emissiveColor = new B.Color3(0.06, 0.08, 0.1);

  const trimMat = new B.PBRMaterial(`${name}_trim`, scene);
  trimMat.albedoColor = B.Color3.FromHexString('#4C596B');
  trimMat.metallic = 0.55;
  trimMat.roughness = 0.35;

  const cyanStripMat = new B.StandardMaterial(`${name}_cyan`, scene);
  cyanStripMat.diffuseColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
  cyanStripMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(1.1);
  cyanStripMat.disableLighting = true;

  // Bright unmistakable crimson armband on the LEFT sleeve (matches GDD #1!)
  const redBandMat = new B.StandardMaterial(`${name}_red_band`, scene);
  redBandMat.diffuseColor = B.Color3.FromHexString('#FF3B5C');
  redBandMat.emissiveColor = B.Color3.FromHexString('#FF3B5C').scale(1.25);
  redBandMat.disableLighting = true;

  const visorMat = new B.PBRMaterial(`${name}_visor`, scene);
  visorMat.albedoColor = new B.Color3(0.12, 0.22, 0.3);
  visorMat.metallic = 0.92;
  visorMat.roughness = 0.08;

  // Torso
  const torso = B.MeshBuilder.CreateBox(`${name}_torso`, { width: 0.48, height: 0.62, depth: 0.28 }, scene);
  torso.position.set(0, 1.24, 0);
  torso.material = suitMat;
  torso.parent = root;

  // Life-Support Backpack on BACK (-Z, facing the viewer!) with vertical cyan status telemetry bars
  const pack = B.MeshBuilder.CreateBox(`${name}_pack`, { width: 0.38, height: 0.5, depth: 0.18 }, scene);
  pack.position.set(0, 1.28, -0.2);
  pack.material = trimMat;
  pack.parent = root;

  const packLight = B.MeshBuilder.CreateBox(`${name}_pack_bar`, { width: 0.06, height: 0.32, depth: 0.03 }, scene);
  packLight.position.set(0, 1.28, -0.305);
  packLight.material = cyanStripMat;
  packLight.parent = root;

  // Helmet + Front Visor (facing +Z away from viewer)
  const head = B.MeshBuilder.CreateSphere(`${name}_head`, { diameter: 0.32, segments: 18 }, scene);
  head.position.set(0, 1.72, 0);
  head.material = suitMat;
  head.parent = root;

  const visor = B.MeshBuilder.CreateSphere(`${name}_visor`, { diameter: 0.27, segments: 14 }, scene);
  visor.scaling.set(0.92, 0.72, 0.65);
  visor.position.set(0, 1.72, 0.095);
  visor.material = visorMat;
  visor.parent = root;

  // Legs (articulated around hips for synced walking stride!)
  const leftHip = new B.TransformNode(`${name}_lhip`, scene);
  leftHip.position.set(-0.14, 0.92, 0);
  leftHip.parent = root;
  const leftLeg = B.MeshBuilder.CreateCylinder(`${name}_lleg`, { diameterTop: 0.17, diameterBottom: 0.14, height: 0.88, tessellation: 12 }, scene);
  leftLeg.position.set(0, -0.44, 0);
  leftLeg.material = suitMat;
  leftLeg.parent = leftHip;

  const rightHip = new B.TransformNode(`${name}_rhip`, scene);
  rightHip.position.set(0.14, 0.92, 0);
  rightHip.parent = root;
  const rightLeg = B.MeshBuilder.CreateCylinder(`${name}_rleg`, { diameterTop: 0.17, diameterBottom: 0.14, height: 0.88, tessellation: 12 }, scene);
  rightLeg.position.set(0, -0.44, 0);
  rightLeg.material = suitMat;
  rightLeg.parent = rightHip;

  // Right Arm (at +X, resting naturally)
  const rightShoulder = new B.TransformNode(`${name}_rsh`, scene);
  rightShoulder.position.set(0.32, 1.46, 0);
  rightShoulder.parent = root;
  const rightArm = B.MeshBuilder.CreateCylinder(`${name}_rarm`, { diameter: 0.13, height: 0.64, tessellation: 12 }, scene);
  rightArm.position.set(0, -0.28, 0);
  rightArm.material = suitMat;
  rightArm.parent = rightShoulder;

  // LEFT Arm (at -X, SAME LEFT SIDE as player's left arm!) with bright crimson armband
  const leftShoulder = new B.TransformNode(`${name}_lsh`, scene);
  leftShoulder.position.set(-0.32, 1.46, 0);
  leftShoulder.parent = root;
  const leftArm = B.MeshBuilder.CreateCylinder(`${name}_larm`, { diameter: 0.13, height: 0.68, tessellation: 12 }, scene);
  leftArm.position.set(0, -0.30, 0);
  leftArm.material = suitMat;
  leftArm.parent = leftShoulder;

  // Prominent glowing crimson sleeve band + bright hand beacon so it reads clearly at 24m!
  const leftBand = B.MeshBuilder.CreateCylinder(`${name}_lband`, { diameter: 0.165, height: 0.22, tessellation: 14 }, scene);
  leftBand.position.set(0, -0.36, 0);
  leftBand.material = redBandMat;
  leftBand.parent = leftShoulder;

  const leftGlove = B.MeshBuilder.CreateSphere(`${name}_lglove`, { diameter: 0.15, segments: 12 }, scene);
  leftGlove.position.set(0, -0.64, 0);
  leftGlove.material = redBandMat;
  leftGlove.parent = leftShoulder;

  for (const m of root.getChildMeshes()) {
    m.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
  }

  return {
    root,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    syncMotion(stridePhase, waveTimer) {
      // Walking stride
      const swing = Math.sin(stridePhase) * 0.34;
      leftHip.rotation.x = swing;
      rightHip.rotation.x = -swing;
      rightShoulder.rotation.x = swing * 0.55;

      // Left-arm wave (raises high to the LEFT side — unmistakable same-side real optical image!)
      if (waveTimer > 0) {
        const progress = 1 - waveTimer / 1.65;
        const env = Math.sin(Math.min(1, progress) * Math.PI);
        const flutter = Math.sin(progress * Math.PI * 5.0) * 0.24;
        // Rotate left arm OUTWARD & UPWARD on -X side (negative rotation.z in Babylon lifts -X arm outward & up!)
        leftShoulder.rotation.z = -(2.45 * env + flutter * env);
        leftShoulder.rotation.x = -0.18 * env;
      } else {
        leftShoulder.rotation.z = 0.08;
        leftShoulder.rotation.x = -swing * 0.55;
      }
    },
  };
}

/**
 * First-person foreground left arm (with matching crimson armband) parented to camera in Level 1.
 * Sweeps up on the lower-left when player left-clicks / presses G / Space so player visually
 * compares THEIR left hand directly with the 24m silhouette's left hand on the SAME side!
 */
export function buildFirstPersonLeftArm(scene, camera) {
  const B = globalThis.BABYLON;
  const pivot = new B.TransformNode('fp_left_arm_pivot', scene);
  pivot.parent = camera;
  pivot.position.set(-0.48, -0.64, 0.94);

  const suitMat = new B.StandardMaterial('fp_arm_suit', scene);
  suitMat.diffuseColor = B.Color3.FromHexString('#EAEEF4');
  suitMat.emissiveColor = new B.Color3(0.18, 0.2, 0.24);
  suitMat.specularColor = new B.Color3(0.35, 0.38, 0.42);

  const cuffMat = new B.StandardMaterial('fp_arm_cuff', scene);
  cuffMat.diffuseColor = B.Color3.FromHexString('#4A5568');
  cuffMat.emissiveColor = new B.Color3(0.08, 0.1, 0.13);

  const redBandMat = new B.StandardMaterial('fp_arm_red', scene);
  redBandMat.diffuseColor = B.Color3.FromHexString('#FF3B5C');
  redBandMat.emissiveColor = B.Color3.FromHexString('#FF3B5C').scale(0.92);
  redBandMat.disableLighting = true;

  const forearm = B.MeshBuilder.CreateCylinder('fp_forearm', { diameterTop: 0.072, diameterBottom: 0.095, height: 0.46, tessellation: 16 }, scene);
  forearm.position.set(0, 0.22, 0);
  forearm.material = suitMat;
  forearm.parent = pivot;

  const band = B.MeshBuilder.CreateCylinder('fp_red_armband', { diameter: 0.088, height: 0.078, tessellation: 16 }, scene);
  band.position.set(0, 0.22, 0);
  band.material = redBandMat;
  band.parent = pivot;

  const cuff = B.MeshBuilder.CreateCylinder('fp_wrist_cuff', { diameter: 0.082, height: 0.042, tessellation: 16 }, scene);
  cuff.position.set(0, 0.42, 0);
  cuff.material = cuffMat;
  cuff.parent = pivot;

  const hand = B.MeshBuilder.CreateBox('fp_glove', { width: 0.092, height: 0.125, depth: 0.042 }, scene);
  hand.position.set(0, 0.51, 0);
  hand.material = suitMat;
  hand.parent = pivot;

  const thumb = B.MeshBuilder.CreateBox('fp_thumb', { width: 0.032, height: 0.068, depth: 0.034 }, scene);
  thumb.position.set(0.056, 0.48, 0.008);
  thumb.rotation.z = -0.35;
  thumb.material = suitMat;
  thumb.parent = pivot;

  for (const m of pivot.getChildMeshes()) {
    m.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    m.isPickable = false;
  }

  return {
    pivot,
    sync(waveTimer) {
      if (waveTimer <= 0) {
        pivot.setEnabled(false);
        return;
      }
      pivot.setEnabled(true);
      const progress = 1 - waveTimer / 1.65;
      const env = Math.sin(Math.min(1, progress) * Math.PI);
      const flutter = Math.sin(progress * Math.PI * 5.0) * 0.20;
      pivot.position.set(-0.46 + env * 0.09, -0.74 + env * 0.36, 0.94);
      pivot.rotation.set(-0.14 * env, 0.14, -0.15 + flutter * env);
    },
  };
}

/**
 * Sculpted Astronaut Statue placed outside Level 1's left (copper-bronze) and right (ivory) portholes.
 * Includes an unmistakable glossy front visor, front chest beacon, and a glowing directional base arrow
 * so players immediately recognize its exact 90° clockwise rotation in each of the 4 rooms!
 */
export function buildSculptedAstronautStatue(scene, name, options = {}) {
  const B = globalThis.BABYLON;
  const isCopper = options.variant === 'copper';
  const root = new B.TransformNode(name, scene);

  const statueMat = new B.PBRMaterial(`${name}_mat`, scene);
  statueMat.albedoColor = B.Color3.FromHexString(isCopper ? '#C87D4B' : '#F3F0E8');
  statueMat.metallic = isCopper ? 0.78 : 0.15;
  statueMat.roughness = isCopper ? 0.28 : 0.38;

  const plinthMat = new B.PBRMaterial(`${name}_plinth`, scene);
  plinthMat.albedoColor = B.Color3.FromHexString('#9AA5B4');
  plinthMat.metallic = 0.42;
  plinthMat.roughness = 0.38;

  const visorMat = new B.PBRMaterial(`${name}_visor`, scene);
  visorMat.albedoColor = B.Color3.FromHexString(isCopper ? '#182433' : '#2C3C4E');
  visorMat.metallic = 0.95;
  visorMat.roughness = 0.06;
  visorMat.emissiveColor = B.Color3.FromHexString(isCopper ? '#4DE6D3' : '#F7C346').scale(0.32);

  const arrowMat = new B.StandardMaterial(`${name}_arrow`, scene);
  const arrowHex = isCopper ? PALETTE.accent.goldWPos : PALETTE.accent.cyanW0;
  arrowMat.diffuseColor = B.Color3.FromHexString(arrowHex);
  arrowMat.emissiveColor = B.Color3.FromHexString(arrowHex).scale(1.1);
  arrowMat.disableLighting = true;

  // Pedestal base + glowing calibrated compass ring
  const plinth = B.MeshBuilder.CreateCylinder(`${name}_base`, { diameter: 1.48, height: 0.55, tessellation: 28 }, scene);
  plinth.position.y = 0.275;
  plinth.material = plinthMat;
  plinth.parent = root;

  const plinthRing = B.MeshBuilder.CreateTorus(`${name}_pring`, { diameter: 1.52, thickness: 0.045, tessellation: 32 }, scene);
  plinthRing.position.y = 0.54;
  plinthRing.material = arrowMat;
  plinthRing.parent = root;

  // Rotating upper statue group (rotates 90° per room!)
  const figure = new B.TransformNode(`${name}_fig`, scene);
  figure.position.y = 0.55;
  figure.parent = root;

  // Glowing front-facing directional pointer chevron on pedestal top (+Z = statue front!)
  const arrowShaft = B.MeshBuilder.CreateBox(`${name}_arr_shaft`, { width: 0.16, height: 0.04, depth: 0.72 }, scene);
  arrowShaft.position.set(0, 0.04, 0.36);
  arrowShaft.material = arrowMat;
  arrowShaft.parent = figure;

  const arrowTip = B.MeshBuilder.CreateCylinder(`${name}_arr_tip`, { diameterTop: 0, diameterBottom: 0.46, height: 0.42, tessellation: 3 }, scene);
  arrowTip.rotation.x = Math.PI * 0.5;
  arrowTip.position.set(0, 0.05, 0.84);
  arrowTip.material = arrowMat;
  arrowTip.parent = figure;

  // Statue body (sculpted 2.15m aerospace monument)
  const legs = B.MeshBuilder.CreateCylinder(`${name}_legs`, { diameterTop: 0.54, diameterBottom: 0.64, height: 0.90, tessellation: 20 }, scene);
  legs.position.y = 0.47;
  legs.material = statueMat;
  legs.parent = figure;

  const belt = B.MeshBuilder.CreateTorus(`${name}_belt`, { diameter: 0.60, thickness: 0.09, tessellation: 22 }, scene);
  belt.position.y = 0.92;
  belt.material = plinthMat;
  belt.parent = figure;

  const chest = B.MeshBuilder.CreateBox(`${name}_chest`, { width: 0.72, height: 0.70, depth: 0.42 }, scene);
  chest.position.y = 1.28;
  chest.material = statueMat;
  chest.parent = figure;

  // Sculpted shoulder pauldrons & neck collar ring
  for (const s of [-1, 1]) {
    const sh = B.MeshBuilder.CreateSphere(`${name}_sh_${s}`, { diameter: 0.32, segments: 14 }, scene);
    sh.position.set(s * 0.42, 1.54, 0);
    sh.material = statueMat;
    sh.parent = figure;
  }
  const collar = B.MeshBuilder.CreateTorus(`${name}_collar`, { diameter: 0.44, thickness: 0.08, tessellation: 22 }, scene);
  collar.position.y = 1.66;
  collar.material = plinthMat;
  collar.parent = figure;

  // Glowing front chest diamond emblem (always on +Z front!)
  const chestBadge = B.MeshBuilder.CreateBox(`${name}_badge`, { width: 0.24, height: 0.24, depth: 0.08 }, scene);
  chestBadge.position.set(0, 1.32, 0.23);
  chestBadge.rotation.z = Math.PI / 4;
  chestBadge.material = arrowMat;
  chestBadge.parent = figure;

  // Backpack strictly on BACK (-Z)
  const pack = B.MeshBuilder.CreateBox(`${name}_back`, { width: 0.52, height: 0.62, depth: 0.28 }, scene);
  pack.position.set(0, 1.3, -0.34);
  pack.material = plinthMat;
  pack.parent = figure;

  // Pointing forward forearm (+Z) so silhouette immediately reveals facing direction!
  const arm = B.MeshBuilder.CreateCylinder(`${name}_arm`, { diameter: 0.16, height: 0.74, tessellation: 14 }, scene);
  arm.rotation.x = Math.PI * 0.44;
  arm.position.set(0.45, 1.40, 0.34);
  arm.material = statueMat;
  arm.parent = figure;

  // Helmet + unmistakable protruding front visor (+Z)
  const helmet = B.MeshBuilder.CreateSphere(`${name}_helm`, { diameter: 0.48, segments: 20 }, scene);
  helmet.position.y = 1.90;
  helmet.material = statueMat;
  helmet.parent = figure;

  const visor = B.MeshBuilder.CreateSphere(`${name}_vis`, { diameter: 0.40, segments: 16 }, scene);
  visor.scaling.set(0.95, 0.72, 0.72);
  visor.position.set(0, 1.90, 0.14);
  visor.material = visorMat;
  visor.parent = figure;

  for (const m of root.getChildMeshes()) {
    m.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
  }

  return { root, figure };
}

/**
 * F-Key Collapsible 8-Cell Tesseract Unfolded Holographic Topology Map (Chapter 1 Levels 1–4).
 * Renders a crisp real-time rotating 3D cross-net projection of all 8 boundary cells,
 * 24 adjacency edges, current room highlight, antipodal blind spot, Level 3 golden edge loop,
 * and Level 4 live Hamiltonian beacon trail.
 */
export class TesseractTopologyMap {
  constructor({ wrapperEl, bodyEl, canvas, titleEl, subEl }) {
    this.wrapperEl = wrapperEl;
    this.bodyEl = bodyEl;
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.titleEl = titleEl;
    this.subEl = subEl;
    this.expanded = true;
    this.spinAngle = 0.55;
  }

  setExpanded(expanded) {
    this.expanded = Boolean(expanded);
    if (this.bodyEl) {
      this.bodyEl.classList.toggle('is-collapsed', !this.expanded);
    }
    return this.expanded;
  }

  toggle() {
    return this.setExpanded(!this.expanded);
  }

  render(snapshot, dtSec = 1 / 60) {
    if (!this.expanded || !this.canvas || !this.ctx) return;
    this.spinAngle += dtSec * 0.32;

    if (this.titleEl) this.titleEl.textContent = '八胞体全息拓扑图';
    if (this.subEl) {
      this.subEl.textContent = snapshot.subLabel || `当前 ${snapshot.currentCell} · 对跖 ${ANTIPODAL_CELL[snapshot.currentCell]}`;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 220;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Clean aerospace slate-glass backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#131A24');
    bg.addColorStop(1, '#0D131B');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Project 3D unfolded cross-net nodes with gentle orbit perspective
    const cosY = Math.cos(this.spinAngle);
    const sinY = Math.sin(this.spinAngle);
    const cosP = Math.cos(0.42);
    const sinP = Math.sin(0.42);
    const cx = w * 0.5;
    const cy = h * 0.44;
    const scale = Math.min(w, h) * 0.21;

    const proj = {};
    for (const id of CELL_IDS) {
      const [nx, ny, nz] = UNFOLDED_NET_POS[id];
      const rx = nx * cosY - nz * sinY;
      const rz = nx * sinY + nz * cosY;
      const ry = ny * cosP - rz * sinP;
      const depth = ny * sinP + rz * cosP;
      const persp = 4.6 / (4.6 - depth * 0.65);
      proj[id] = {
        id,
        x: cx + rx * scale * persp,
        y: cy - (ry + 0.28) * scale * persp,
        depth,
        persp,
      };
    }

    const current = snapshot.currentCell || 'W+';
    const antipode = ANTIPODAL_CELL[current];
    const visited = snapshot.visitedSet || new Set([current]);
    const trail = snapshot.trail || [];

    // 1. Draw subtle 24 face-adjacency graph filaments (brightened when L2 unlocked!)
    const showAllEdges = Boolean(snapshot.highlightAll24Edges);
    for (let i = 0; i < CELL_IDS.length; i += 1) {
      for (let j = i + 1; j < CELL_IDS.length; j += 1) {
        const a = CELL_IDS[i];
        const b = CELL_IDS[j];
        if (ANTIPODAL_CELL[a] === b) continue;
        const pa = proj[a];
        const pb = proj[b];
        const touchesCurrent = a === current || b === current;
        ctx.strokeStyle = showAllEdges
          ? 'rgba(77, 230, 211, 0.46)'
          : touchesCurrent
            ? 'rgba(77, 230, 211, 0.34)'
            : 'rgba(154, 165, 180, 0.14)';
        ctx.lineWidth = showAllEdges ? 1.5 : touchesCurrent ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    // 2. Highlight Level 3 shared golden holonomy triangle (W+ -> X+ -> Y+ -> W+)
    if (snapshot.highlightHolonomyTriangle) {
      const tri = ['W+', 'X+', 'Y+', 'W+'];
      ctx.strokeStyle = 'rgba(247, 195, 70, 0.92)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      tri.forEach((id, idx) => {
        const p = proj[id];
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 3. Highlight Level 1 4-cell great circle or Level 4 live Hamiltonian trail
    if (trail.length >= 2) {
      ctx.strokeStyle = '#F7C346';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 1) {
        const p = proj[trail[i]];
        if (!p) continue;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // 4. Draw depth-sorted 8 cell nodes
    const sorted = Object.values(proj).sort((a, b) => a.depth - b.depth);
    for (const node of sorted) {
      const isCurr = node.id === current;
      const isOpp = node.id === antipode;
      const isLit = visited.has(node.id);
      const isTarget = snapshot.targetCell && node.id === snapshot.targetCell;
      const r = (isCurr ? 14 : 11) * node.persp;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      if (isCurr) {
        ctx.fillStyle = PALETTE.accent.cyanW0;
      } else if (isTarget) {
        ctx.fillStyle = PALETTE.accent.goldWPos;
      } else if (isLit && snapshot.levelId === 4) {
        ctx.fillStyle = 'rgba(247, 195, 70, 0.85)';
      } else if (isOpp) {
        ctx.fillStyle = 'rgba(167, 139, 250, 0.32)';
      } else {
        ctx.fillStyle = 'rgba(42, 54, 72, 0.88)';
      }
      ctx.fill();

      ctx.lineWidth = isCurr ? 2.6 : isOpp ? 1.8 : 1.3;
      ctx.strokeStyle = isCurr
        ? '#FFFFFF'
        : isOpp
          ? '#A78BFA'
          : CELL_COLORS[node.id];
      if (isOpp) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Node cell label
      ctx.font = `700 ${Math.round(9.5 * node.persp)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isCurr || (isLit && snapshot.levelId === 4) ? '#0B1117' : '#ECF1F8';
      ctx.fillText(node.id, node.x, node.y + 0.5);
    }

    // Footer legend
    ctx.font = '600 10px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(236, 241, 248, 0.72)';
    const neighborsList = getNeighbors(current).join(' ');
    ctx.fillText(`6 邻室: ${neighborsList}`, 10, h - 22);
    ctx.fillStyle = '#C4B5FD';
    ctx.fillText(`◎ 对跖盲区（无直达门）: ${antipode}`, 10, h - 8);

    ctx.restore();
  }
}
