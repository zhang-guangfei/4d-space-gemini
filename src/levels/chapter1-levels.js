/**
 * Beyond 3D — Chapter 1 (Act I: 《回廊》) 3D Landmark Scenes
 * Zone A: Soft-Mist White Research Station (#ECEEF2 + #9AA5B4)
 *
 * Distinct architectural landmark scene builders for:
 * - Prologue (Level 0): 迷航 — Voyager cockpit, extinguishing stars, emerging 4D white wireframe grid
 * - Level 1: 前方的人 — 24m seamless 4-cell glass corridor, rotating bronze/ivory porthole statues,
 *                       red ribbon, 3 optional hypothesis consoles, synced 24m waving self-silhouette
 * - Level 2: 没有门通向对面 — Zero-G 6-airlock chamber, seamless adjacent rooms via 4D transport,
 *                             8-color unfolded tesseract hologram, W- Lin Xia Locator
 * - Level 3: 哪边是上 — Gyro corner chambers (W+/X+/Y+) with shared golden 1D edge, fluorescent ↑ 上
 *                       wall stencils, handheld 3D locked gyroscope, W+ resonance lock (D9 dual mode)
 * - Level 4: 一笔走完 — 8-room star-ring dome beacons, live ★/✗/◈ airlock plaques,
 *                       2.2m liquid-mercury 4D rift mirror sphere in W+
 */

import {
  CELL_COLORS,
  CELL_HALF_SIZE,
  CELL_IDS,
  CELL_NORMALS,
  CELL_SIZE,
  getCellDoorways,
  getNeighbors,
  LEVEL1_LOOP_CELLS,
  tangent4ToCellLocal3,
  UNFOLDED_NET_POS,
} from '../core/tesseract-boundary.js';
import {
  createAerospaceDeckPBR,
  createAviationPanelPBR,
  createCellPlaqueTexture,
  createFluorescentArrowTexture,
  createMercuryRiftPBR,
  createStationEnvironmentTexture,
  setupZoneAPostProcessing,
} from '../engine/aaa-materials.js';
import {
  configureRenderingGroups,
  createGhostMaterial,
  PALETTE,
  RENDER_GROUPS,
} from '../engine/phase-materials.js';
import {
  applyIntrinsicFrameToCamera,
  buildAstronautSilhouette,
  buildFirstPersonLeftArm,
  buildSculptedAstronautStatue,
  computeNeighborTransformInCell,
} from '../engine/portal-optics.js';

// ---------------------------------------------------------------------------
// Shared Zone A Environment Setup Helper
// ---------------------------------------------------------------------------

function initZoneASceneBase(scene, camera) {
  const B = globalThis.BABYLON;
  scene.clearColor = new B.Color4(0.84, 0.87, 0.91, 1.0);
  scene.ambientColor = new B.Color3(0.32, 0.35, 0.39);
  configureRenderingGroups(scene);
  createStationEnvironmentTexture(scene);

  const hemi = new B.HemisphericLight('zone_a_hemi', new B.Vector3(0, 1, 0), scene);
  hemi.intensity = 1.08;
  hemi.diffuse = new B.Color3(0.96, 0.97, 1.0);
  hemi.groundColor = new B.Color3(0.54, 0.58, 0.64);

  const keyLight = new B.DirectionalLight('zone_a_key', new B.Vector3(-0.35, -0.82, 0.44), scene);
  keyLight.intensity = 0.72;
  keyLight.diffuse = new B.Color3(0.98, 0.98, 0.96);

  const fillLight = new B.PointLight('zone_a_fill', new B.Vector3(0, 2.2, 0), scene);
  fillLight.intensity = 0.55;
  fillLight.range = 24;
  fillLight.diffuse = new B.Color3(0.9, 0.96, 1.0);

  const pipeline = setupZoneAPostProcessing(scene, camera);

  return {
    hemi,
    keyLight,
    fillLight,
    pipeline,
    wallMat: createAviationPanelPBR(scene, 'zone_a_wall_shared', 2, 2),
    deckMat: createAerospaceDeckPBR(scene, 'zone_a_deck_shared', 2, 2),
  };
}

function makeEmissiveMat(scene, name, hex, intensity = 1.0) {
  const B = globalThis.BABYLON;
  const mat = new B.StandardMaterial(name, scene);
  const c = B.Color3.FromHexString(hex);
  mat.diffuseColor = c;
  mat.emissiveColor = c.scale(intensity);
  mat.disableLighting = true;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

// ---------------------------------------------------------------------------
// 0. Prologue Scene: 迷航 (Voyager Cockpit -> Extinguishing Stars -> 4D Grid)
// ---------------------------------------------------------------------------

export class PrologueScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.root = new this.B.TransformNode('prologue_root', scene);
    this.stars = [];
    this.gridLines = [];
    this.alarmMats = [];
    this.time = 0;

    scene.clearColor = new this.B.Color4(0.02, 0.03, 0.06, 1.0);
    configureRenderingGroups(scene);
    camera.rotationQuaternion = null;
    camera.position.set(0, 1.55, -2.1);
    camera.setTarget(new this.B.Vector3(0, 1.45, 8));
    camera.fov = 0.96;

    const hemi = new this.B.HemisphericLight('pro_hemi', new this.B.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.42;
    this.alarmLight = new this.B.PointLight('pro_alarm', new this.B.Vector3(0, 2.3, -1.2), scene);
    this.alarmLight.diffuse = this.B.Color3.FromHexString('#FF6B6B');
    this.alarmLight.intensity = 1.4;

    this._buildCockpit();
    this._buildStarfield();
    this._buildEmerging4DGrid();
  }

  _buildCockpit() {
    const B = this.B;
    const hullMat = new B.StandardMaterial('pro_hull', this.scene);
    hullMat.diffuseColor = new B.Color3(0.11, 0.14, 0.19);
    hullMat.specularColor = new B.Color3(0.25, 0.3, 0.36);

    const consoleMat = new B.StandardMaterial('pro_console', this.scene);
    consoleMat.diffuseColor = new B.Color3(0.08, 0.1, 0.14);

    const screenLTex = createCellPlaqueTexture(
      this.scene,
      'pro_scr_l_tex',
      'WARP 4D',
      '跃迁曲率偏离 · 空间闭合',
      PALETTE.accent.cyanW0
    );
    const screenLMat = new B.StandardMaterial('pro_scr_l_mat', this.scene);
    screenLMat.diffuseTexture = screenLTex;
    screenLMat.emissiveTexture = screenLTex;
    screenLMat.disableLighting = true;

    const screenRTex = createCellPlaqueTexture(
      this.scene,
      'pro_scr_r_tex',
      'ALERT 07',
      '星光熄灭 · 林夏已出舱',
      PALETTE.accent.amberCoral
    );
    const screenRMat = new B.StandardMaterial('pro_scr_r_mat', this.scene);
    screenRMat.diffuseTexture = screenRTex;
    screenRMat.emissiveTexture = screenRTex;
    screenRMat.disableLighting = true;

    const alarmMat = makeEmissiveMat(this.scene, 'pro_alarm_mat', PALETTE.accent.amberCoral, 1.1);
    this.alarmMats.push(alarmMat);

    // Lower dashboard console
    const dash = B.MeshBuilder.CreateBox('pro_dash', { width: 4.8, height: 0.9, depth: 1.5 }, this.scene);
    dash.position.set(0, 0.65, 0.2);
    dash.material = consoleMat;
    dash.parent = this.root;

    const screenL = B.MeshBuilder.CreatePlane('pro_scr_l', { width: 1.1, height: 0.36 }, this.scene);
    screenL.position.set(-1.1, 1.14, -0.35);
    screenL.rotation.x = 0.52;
    screenL.material = screenLMat;
    screenL.parent = this.root;

    const screenR = B.MeshBuilder.CreatePlane('pro_scr_r', { width: 1.1, height: 0.36 }, this.scene);
    screenR.position.set(1.1, 1.14, -0.35);
    screenR.rotation.x = 0.52;
    screenR.material = screenRMat;
    screenR.parent = this.root;

    // Panoramic cockpit canopy struts
    const strutCoords = [
      [-2.1, 1.9, 0.75, 0.16, 2.3, 0.18, 0, 0, -0.25],
      [2.1, 1.9, 0.75, 0.16, 2.3, 0.18, 0, 0, 0.25],
      [0, 2.95, 0.55, 4.4, 0.22, 0.25, 0, 0, 0],
      [0, 0.15, -1.0, 5.2, 0.3, 4.6, 0, 0, 0],
    ];
    strutCoords.forEach(([x, y, z, w, h, d, rx, ry, rz], idx) => {
      const m = B.MeshBuilder.CreateBox(`pro_strut_${idx}`, { width: w, height: h, depth: d }, this.scene);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.material = hullMat;
      m.parent = this.root;
    });

    // Overhead warning strip
    const warnStrip = B.MeshBuilder.CreateBox('pro_warn_strip', { width: 2.2, height: 0.06, depth: 0.08 }, this.scene);
    warnStrip.position.set(0, 2.8, 0.42);
    warnStrip.material = alarmMat;
    warnStrip.parent = this.root;
  }

  _buildStarfield() {
    const B = this.B;
    const starMat = makeEmissiveMat(this.scene, 'pro_star_mat', '#EEF6FF', 1.3);
    const goldStarMat = makeEmissiveMat(this.scene, 'pro_star_gold', '#FFE9B5', 1.2);
    for (let i = 0; i < 220; i += 1) {
      // Deterministic pseudo-random star coordinates in front hemisphere
      const s1 = Math.sin(i * 12.9898 + 1.2) * 43758.5453;
      const r1 = s1 - Math.floor(s1);
      const s2 = Math.sin(i * 78.233 + 3.7) * 43758.5453;
      const r2 = s2 - Math.floor(s2);
      const s3 = Math.sin(i * 41.123 + 7.1) * 43758.5453;
      const r3 = s3 - Math.floor(s3);

      const x = (r1 - 0.5) * 68;
      const y = (r2 - 0.38) * 42;
      const z = 14 + r3 * 64;
      const size = 0.08 + (i % 5) * 0.032;

      const star = B.MeshBuilder.CreateSphere(`pro_star_${i}`, { diameter: size, segments: 6 }, this.scene);
      star.position.set(x, y, z);
      star.material = i % 7 === 0 ? goldStarMat : starMat;
      star.parent = this.root;

      // Extinguish stagger threshold between 3.2s and 8.8s
      this.stars.push({
        mesh: star,
        extinguishAt: 3.2 + (i / 220) * 5.6,
        baseScale: 1,
      });
    }
  }

  _buildEmerging4DGrid() {
    const B = this.B;
    this.gridRoot = new B.TransformNode('pro_4d_grid', this.scene);
    this.gridRoot.position.set(0, 1.5, 16);
    this.gridRoot.parent = this.root;

    // 4D Hypercube (Tesseract) projection wireframe (inner + outer cubes + 8 connecting struts)
    this.gridMat = makeEmissiveMat(this.scene, 'pro_grid_mat', '#FFFFFF', 1.0);
    this.gridMat.alpha = 0;

    const makeCubeEdges = (half, namePrefix) => {
      const pts = [];
      const signs = [-1, 1];
      for (const sy of signs) {
        for (const sz of signs) {
          pts.push([new B.Vector3(-half, sy * half, sz * half), new B.Vector3(half, sy * half, sz * half)]);
        }
      }
      for (const sx of signs) {
        for (const sz of signs) {
          pts.push([new B.Vector3(sx * half, -half, sz * half), new B.Vector3(sx * half, half, sz * half)]);
        }
      }
      for (const sx of signs) {
        for (const sy of signs) {
          pts.push([new B.Vector3(sx * half, sy * half, -half), new B.Vector3(sx * half, sy * half, half)]);
        }
      }
      const lines = B.MeshBuilder.CreateLineSystem(namePrefix, { lines: pts }, this.scene);
      lines.color = new B.Color3(0.92, 0.96, 1.0);
      lines.alpha = 0;
      lines.parent = this.gridRoot;
      this.gridLines.push(lines);
    };

    makeCubeEdges(5.2, 'pro_outer_cube');
    makeCubeEdges(2.6, 'pro_inner_cube');

    // 8 diagonal hypercube struts connecting inner & outer vertices
    const diag = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          diag.push([
            new B.Vector3(sx * 2.6, sy * 2.6, sz * 2.6),
            new B.Vector3(sx * 5.2, sy * 5.2, sz * 5.2),
          ]);
        }
      }
    }
    const diagLines = B.MeshBuilder.CreateLineSystem('pro_diag', { lines: diag }, this.scene);
    diagLines.color = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    diagLines.alpha = 0;
    diagLines.parent = this.gridRoot;
    this.gridLines.push(diagLines);

    // Infinite white geometric floor/sky lattice grid emerging behind tesseract
    const lattice = [];
    for (let i = -8; i <= 8; i += 1) {
      lattice.push([new B.Vector3(i * 2.5, -5.5, -6), new B.Vector3(i * 2.5, -5.5, 22)]);
      lattice.push([new B.Vector3(-20, -5.5, i * 2.5 + 8), new B.Vector3(20, -5.5, i * 2.5 + 8)]);
    }
    const latticeMesh = B.MeshBuilder.CreateLineSystem('pro_lattice', { lines: lattice }, this.scene);
    latticeMesh.color = new B.Color3(0.84, 0.9, 0.96);
    latticeMesh.alpha = 0;
    latticeMesh.parent = this.gridRoot;
    this.gridLines.push(latticeMesh);
  }

  syncFromState(state, input, dtSec) {
    this.time += dtSec;
    const t = state.elapsedSec;

    // Gentle cockpit look & warp shudder
    const shake = t < 8.5 ? Math.sin(this.time * 28) * 0.012 : 0;
    this.camera.position.set(shake, 1.55 + shake * 0.6, -2.1);
    const yaw = Math.max(-0.55, Math.min(0.55, input.yaw || 0));
    const pitch = Math.max(-0.35, Math.min(0.35, input.pitch || 0));
    this.camera.rotation.set(-pitch, yaw, 0);

    // Pulsing warning beacon early on, softening as stars go out
    const alarmPulse = t < 9.5 ? 0.5 + 0.5 * Math.sin(this.time * 7.2) : Math.max(0, 1 - (t - 9.5) * 0.4);
    this.alarmLight.intensity = 1.6 * alarmPulse;

    // Stars extinguish one by one (3.2s -> 8.8s)
    for (const s of this.stars) {
      if (t >= s.extinguishAt) {
        const fade = Math.max(0, 1 - (t - s.extinguishAt) * 2.4);
        s.mesh.scaling.setAll(Math.max(0.001, fade));
        s.mesh.isVisible = fade > 0.02;
      } else {
        s.mesh.isVisible = true;
        s.mesh.scaling.setAll(1);
      }
    }

    // Smooth shift from cosmic black -> radiant pure-white geometric space (7.5s -> 17.5s)
    const whiteBlend = Math.max(0, Math.min(1, (t - 8.0) / 7.2));
    const fadeFinal = Math.max(0, Math.min(1, (t - 14.5) / 3.0));
    const bgR = 0.02 + whiteBlend * 0.84 + fadeFinal * 0.14;
    const bgG = 0.03 + whiteBlend * 0.85 + fadeFinal * 0.12;
    const bgB = 0.06 + whiteBlend * 0.86 + fadeFinal * 0.08;
    this.scene.clearColor.set(Math.min(1, bgR), Math.min(1, bgG), Math.min(1, bgB), 1);

    // Rotate and reveal the 4D tesseract geometric grid
    const gridAlpha = Math.max(0, Math.min(0.92, (t - 6.8) / 3.2)) * (1 - fadeFinal * 0.5);
    this.gridRoot.rotation.y = this.time * 0.28;
    this.gridRoot.rotation.x = Math.sin(this.time * 0.2) * 0.22;
    for (const gl of this.gridLines) {
      gl.alpha = gridAlpha;
    }
  }

  dispose() {
    this.root.dispose();
  }
}

// ---------------------------------------------------------------------------
// 1. Level 1 Scene: 前方的人 (24m Straight Closed Corridor + Same-Side Silhouette)
// ---------------------------------------------------------------------------

export class Level1CorridorScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.base = initZoneASceneBase(scene, camera);
    this.root = new this.B.TransformNode('level1_root', scene);
    this.segments = [];
    this.time = 0;
    this.stridePhase = 0;
    this.lastUnwrappedZ = 0;

    camera.rotationQuaternion = null;
    camera.fov = 0.92;

    this._buildMaterials();
    this._buildRepeatingCorridorSegments();
    this._buildSelfSilhouettes();
  }

  _buildMaterials() {
    const B = this.B;
    this.wallMat = this.base.wallMat;
    this.deckMat = this.base.deckMat;

    this.steelMat = new B.PBRMaterial('l1_steel', this.scene);
    this.steelMat.albedoColor = B.Color3.FromHexString('#8F9BA9');
    this.steelMat.metallic = 0.65;
    this.steelMat.roughness = 0.34;

    this.glassMat = createGhostMaterial(this.scene, 'l1_glass', '#A5D8F3', 0.30);
    this.skylightMat = makeEmissiveMat(this.scene, 'l1_skylight', '#F8FBFF', 0.95);
    this.cyanMat = makeEmissiveMat(this.scene, 'l1_cyan', PALETTE.accent.cyanW0, 1.0);
    this.goldMat = makeEmissiveMat(this.scene, 'l1_gold', PALETTE.accent.goldWPos, 1.0);
    this.redRibbonMat = makeEmissiveMat(this.scene, 'l1_ribbon', '#FF3B5C', 0.9);
    this.emeraldMat = makeEmissiveMat(this.scene, 'l1_emerald', PALETTE.accent.emerald, 1.1);

    this.plaqueMats = LEVEL1_LOOP_CELLS.map((cellId, idx) => {
      const tex = createCellPlaqueTexture(
        this.scene,
        `l1_plaque_${cellId}`,
        `舱室 ${cellId}`,
        `回廊第 ${idx + 1} 段 · 周期 4`,
        CELL_COLORS[cellId]
      );
      const m = new B.StandardMaterial(`l1_plaque_mat_${cellId}`, this.scene);
      m.diffuseTexture = tex;
      m.emissiveTexture = tex;
      m.disableLighting = true;
      return m;
    });
  }

  _buildRepeatingCorridorSegments() {
    const B = this.B;
    // Render 8 seamless segments: offsets -2, -1, 0, +1, +2, +3, +4, +5 (-12m to +30m!)
    // Segment +4 is at +24.0m (EXACT optical loop return to W+ where your self-silhouette walks!)
    const offsets = [-2, -1, 0, 1, 2, 3, 4, 5];

    for (const segOffset of offsets) {
      const segRoot = new B.TransformNode(`l1_seg_${segOffset}`, this.scene);
      segRoot.position.z = segOffset * CELL_SIZE;
      segRoot.parent = this.root;

      // Floor & Ceiling (6m x 6m)
      const floor = B.MeshBuilder.CreateBox(`l1_fl_${segOffset}`, { width: 6.0, height: 0.24, depth: 6.0 }, this.scene);
      floor.position.set(0, -0.12, 0);
      floor.material = this.deckMat;
      floor.parent = segRoot;

      const ceil = B.MeshBuilder.CreateBox(`l1_cl_${segOffset}`, { width: 6.0, height: 0.24, depth: 6.0 }, this.scene);
      ceil.position.set(0, 5.12, 0);
      ceil.material = this.wallMat;
      ceil.parent = segRoot;

      // Overhead diffused linear skylight strip
      const skylight = B.MeshBuilder.CreateBox(`l1_sky_${segOffset}`, { width: 1.5, height: 0.04, depth: 4.8 }, this.scene);
      skylight.position.set(0, 4.98, 0);
      skylight.material = this.skylightMat;
      skylight.parent = segRoot;

      // Left & Right corridor walls WITH wide panoramic observation porthole cutouts (z ∈ [-1.7, +1.7], y ∈ [0.85, 3.65])
      for (const side of [-1, 1]) {
        const xWall = side * 3.0;
        const lower = B.MeshBuilder.CreateBox(`l1_wl_lo_${segOffset}_${side}`, { width: 0.22, height: 0.88, depth: 6.0 }, this.scene);
        lower.position.set(xWall, 0.44, 0);
        lower.material = this.wallMat;
        lower.parent = segRoot;

        const upper = B.MeshBuilder.CreateBox(`l1_wl_hi_${segOffset}_${side}`, { width: 0.22, height: 1.38, depth: 6.0 }, this.scene);
        upper.position.set(xWall, 4.31, 0);
        upper.material = this.wallMat;
        upper.parent = segRoot;

        for (const zSide of [-1, 1]) {
          const pillar = B.MeshBuilder.CreateBox(`l1_wl_p_${segOffset}_${side}_${zSide}`, { width: 0.26, height: 2.84, depth: 1.32 }, this.scene);
          pillar.position.set(xWall, 2.26, zSide * 2.34);
          pillar.material = this.wallMat;
          pillar.parent = segRoot;
        }

        // Brushed aerospace window sill & frame trim
        const sill = B.MeshBuilder.CreateBox(`l1_sill_${segOffset}_${side}`, { width: 0.34, height: 0.1, depth: 3.44 }, this.scene);
        sill.position.set(xWall, 0.89, 0);
        sill.material = this.steelMat;
        sill.parent = segRoot;

        // Clean outer statue alcove enclosure behind porthole (soft luminous white bay!)
        const bayBack = B.MeshBuilder.CreateBox(`l1_bay_bk_${segOffset}_${side}`, { width: 0.18, height: 4.6, depth: 5.2 }, this.scene);
        bayBack.position.set(side * 6.3, 2.3, 0);
        bayBack.material = this.wallMat;
        bayBack.parent = segRoot;

        const bayFloor = B.MeshBuilder.CreateBox(`l1_bay_fl_${segOffset}_${side}`, { width: 3.3, height: 0.2, depth: 5.2 }, this.scene);
        bayFloor.position.set(side * 4.65, -0.05, 0);
        bayFloor.material = this.deckMat;
        bayFloor.parent = segRoot;

        const bayCeil = B.MeshBuilder.CreateBox(`l1_bay_cl_${segOffset}_${side}`, { width: 3.3, height: 0.16, depth: 5.2 }, this.scene);
        bayCeil.position.set(side * 4.65, 4.6, 0);
        bayCeil.material = this.skylightMat;
        bayCeil.parent = segRoot;
      }

      // Archway bulkhead rib at front seam (+3.0m) + backlit cell plaque overhead
      const archTop = B.MeshBuilder.CreateBox(`l1_arch_t_${segOffset}`, { width: 5.8, height: 0.72, depth: 0.28 }, this.scene);
      archTop.position.set(0, 4.62, 2.86);
      archTop.material = this.steelMat;
      archTop.parent = segRoot;

      const plaque = B.MeshBuilder.CreatePlane(`l1_plaque_${segOffset}`, { width: 1.55, height: 0.56 }, this.scene);
      plaque.position.set(0, 4.58, 2.70); // 20mm proud of archTop so zero Z-fighting!
      plaque.material = this.plaqueMats[0];
      plaque.parent = segRoot;

      // Subtle floor guide rails (cyan glow)
      for (const side of [-1, 1]) {
        const rail = B.MeshBuilder.CreateBox(`l1_rail_${segOffset}_${side}`, { width: 0.05, height: 0.02, depth: 5.9 }, this.scene);
        rail.position.set(side * 2.35, 0.015, 0);
        rail.material = this.cyanMat;
        rail.parent = segRoot;
      }

      // Left Copper-Bronze Statue & Right Ivory-White Statue outside portholes!
      const leftStatue = buildSculptedAstronautStatue(this.scene, `l1_stat_l_${segOffset}`, { variant: 'copper' });
      leftStatue.root.position.set(-4.65, 0.08, 0);
      leftStatue.root.parent = segRoot;

      const rightStatue = buildSculptedAstronautStatue(this.scene, `l1_stat_r_${segOffset}`, { variant: 'ivory' });
      rightStatue.root.position.set(4.65, 0.08, 0);
      rightStatue.root.parent = segRoot;

      // W+ Origin Exclusive Landmarks (shown ONLY when this segment represents W+!)
      const wPlusGroup = new B.TransformNode(`l1_wplus_props_${segOffset}`, this.scene);
      wPlusGroup.parent = segRoot;

      // 1. Lin Xia's Crimson Red Ribbon tied to stanchion + glowing floor strip
      const ribbonPost = B.MeshBuilder.CreateCylinder(`l1_rpost_${segOffset}`, { diameter: 0.07, height: 1.05, tessellation: 12 }, this.scene);
      ribbonPost.position.set(-2.35, 0.52, -0.35);
      ribbonPost.material = this.steelMat;
      ribbonPost.parent = wPlusGroup;

      const ribbonBand = B.MeshBuilder.CreateBox(`l1_rband_${segOffset}`, { width: 0.08, height: 0.14, depth: 0.55 }, this.scene);
      ribbonBand.position.set(-2.12, 0.88, -0.35);
      ribbonBand.rotation.z = -0.25;
      ribbonBand.material = this.redRibbonMat;
      ribbonBand.parent = wPlusGroup;

      const ribbonFloor = B.MeshBuilder.CreateBox(`l1_rfloor_${segOffset}`, { width: 4.5, height: 0.018, depth: 0.14 }, this.scene);
      ribbonFloor.position.set(0, 0.016, -0.35);
      ribbonFloor.material = this.redRibbonMat;
      ribbonFloor.parent = wPlusGroup;

      // 2. Lin Xia's Audio Recorder Desk (left-front of W+)
      const recStand = B.MeshBuilder.CreateCylinder(`l1_rec_${segOffset}`, { diameterTop: 0.42, diameterBottom: 0.5, height: 0.98, tessellation: 16 }, this.scene);
      recStand.position.set(-1.65, 0.49, 1.4);
      recStand.material = this.steelMat;
      recStand.parent = wPlusGroup;

      const recOrb = B.MeshBuilder.CreateTorus(`l1_rec_ring_${segOffset}`, { diameter: 0.36, thickness: 0.04, tessellation: 20 }, this.scene);
      recOrb.position.set(-1.65, 1.16, 1.4);
      recOrb.material = this.cyanMat;
      recOrb.parent = wPlusGroup;

      // 3. Main Control Password Lock Console (right-front of W+)
      const lockBase = B.MeshBuilder.CreateBox(`l1_lock_${segOffset}`, { width: 0.72, height: 1.18, depth: 0.46 }, this.scene);
      lockBase.position.set(1.65, 0.59, 1.75);
      lockBase.rotation.y = -0.35;
      lockBase.material = this.steelMat;
      lockBase.parent = wPlusGroup;

      const lockDial = B.MeshBuilder.CreateTorus(`l1_lock_dial_${segOffset}`, { diameter: 0.44, thickness: 0.055, tessellation: 24 }, this.scene);
      lockDial.position.set(1.62, 1.38, 1.72);
      lockDial.rotation.x = Math.PI * 0.5;
      lockDial.rotation.y = -0.35;
      lockDial.material = this.goldMat;
      lockDial.parent = wPlusGroup;

      // 4. Three Optional Hypothesis Hologram Stands at south of W+
      const hypCoords = [
        [-1.85, -1.3, 'ring'],
        [0.0, -2.05, 'belt'],
        [1.85, -1.3, 'sphere'],
      ];
      hypCoords.forEach(([hx, hz, kind]) => {
        const ped = B.MeshBuilder.CreateCylinder(`l1_hyp_${segOffset}_${kind}`, { diameter: 0.36, height: 0.88, tessellation: 14 }, this.scene);
        ped.position.set(hx, 0.44, hz);
        ped.material = this.steelMat;
        ped.parent = wPlusGroup;

        let iconMesh;
        if (kind === 'ring') {
          iconMesh = B.MeshBuilder.CreateTorus(`l1_hicon_${segOffset}_${kind}`, { diameter: 0.38, thickness: 0.045, tessellation: 18 }, this.scene);
        } else if (kind === 'belt') {
          iconMesh = B.MeshBuilder.CreateBox(`l1_hicon_${segOffset}_${kind}`, { width: 0.42, height: 0.08, depth: 0.24 }, this.scene);
        } else {
          iconMesh = B.MeshBuilder.CreateSphere(`l1_hicon_${segOffset}_${kind}`, { diameter: 0.34, segments: 12 }, this.scene);
          iconMesh.material = createGhostMaterial(this.scene, `l1_hgh_${segOffset}_${kind}`, PALETTE.accent.cyanW0, 0.34);
        }
        iconMesh.position.set(hx, 1.22, hz);
        if (!iconMesh.material) iconMesh.material = this.cyanMat;
        iconMesh.parent = wPlusGroup;
      });

      // 6-way unlocked celebration portal halo (visible once password solved!)
      const unlockHalo = B.MeshBuilder.CreateTorus(`l1_uhalo_${segOffset}`, { diameter: 3.2, thickness: 0.09, tessellation: 36 }, this.scene);
      unlockHalo.rotation.x = Math.PI * 0.5;
      unlockHalo.position.set(0, 2.2, 2.74);
      unlockHalo.material = this.emeraldMat;
      unlockHalo.isVisible = false;
      unlockHalo.parent = wPlusGroup;

      this.segments.push({
        offset: segOffset,
        root: segRoot,
        plaque,
        leftStatue,
        rightStatue,
        wPlusGroup,
        lockDial,
        recOrb,
        unlockHalo,
      });
    }
  }

  _buildSelfSilhouettes() {
    // Self-image +24m straight ahead (primary wonder!) + -24m behind (if you turn around!)
    this.selfAhead = buildAstronautSilhouette(this.scene, 'l1_self_ahead_24m');
    this.selfAhead.root.parent = this.root;

    this.selfBehind = buildAstronautSilhouette(this.scene, 'l1_self_behind_24m');
    this.selfBehind.root.parent = this.root;

    // First-person foreground left arm (crimson armband) synced 1:1 with the 24m silhouette!
    this.fpLeftArm = buildFirstPersonLeftArm(this.scene, this.camera);
  }

  syncFromState(state, input, dtSec) {
    this.time += dtSec;
    const roomIdx = state.getRoomIndex();
    const localZ = state.getLocalZInCell();

    // Update walking stride phase smoothly from actual displacement
    const dzDelta = Math.abs(state.unwrappedZ - this.lastUnwrappedZ);
    this.lastUnwrappedZ = state.unwrappedZ;
    if (dzDelta > 0.0005) {
      this.stridePhase += dzDelta * 2.6;
    }

    // Camera inside segment 0 (seamlessly wrapping every 6m!)
    const headBob = dzDelta > 0.001 ? Math.sin(this.stridePhase * 2) * 0.032 : 0;
    this.camera.position.set(state.playerX, state.playerY + headBob, localZ);
    this.camera.rotation.set(-input.pitch, input.yaw, 0);

    // Optical telescope smooth FOV zoom (Tab)
    const targetFov = state.telescopeActive ? 0.30 : 0.92;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    // Update all 8 repeating corridor segments so every 4th segment is identically W+!
    // Left statue facing directions per room index (0=inward +X, 1=fwd +Z, 2=outward -X, 3=back -Z):
    const leftYawByIdx = [Math.PI * 0.5, 0, -Math.PI * 0.5, Math.PI];
    const rightYawByIdx = [-Math.PI * 0.5, Math.PI, Math.PI * 0.5, 0];

    for (const seg of this.segments) {
      const cellIdx = ((roomIdx + seg.offset) % 4 + 4) % 4;
      seg.plaque.material = this.plaqueMats[cellIdx];
      seg.leftStatue.figure.rotation.y = leftYawByIdx[cellIdx];
      seg.rightStatue.figure.rotation.y = rightYawByIdx[cellIdx];

      const isOrigin = cellIdx === 0;
      seg.wPlusGroup.setEnabled(isOrigin);
      if (isOrigin) {
        seg.recOrb.rotation.y = this.time * 1.1;
        seg.lockDial.rotation.z = this.time * (state.completed ? 1.8 : 0.45);
        seg.lockDial.material = state.completed ? this.emeraldMat : this.goldMat;
        seg.unlockHalo.isVisible = state.completed;
      }
    }

    // Position 24m Same-Side Waving Self-Silhouette at EXACT +24.0m ahead & -24.0m behind!
    this.selfAhead.root.position.set(state.playerX, 0, localZ + 24.0);
    this.selfAhead.syncMotion(this.stridePhase, state.waveTimer);

    this.selfBehind.root.position.set(state.playerX, 0, localZ - 24.0);
    this.selfBehind.syncMotion(this.stridePhase, state.waveTimer);

    this.fpLeftArm.sync(state.waveTimer);
  }

  dispose() {
    this.fpLeftArm.pivot.dispose();
    this.root.dispose();
    this.base.pipeline?.dispose();
  }
}

// ---------------------------------------------------------------------------
// Shared Builder for Seamless 6-Airlock Zero-G Cubic Chamber (Levels 2, 3, 4)
// ---------------------------------------------------------------------------

/**
 * Construct a single 6m x 6m x 6m Zone A Zero-G cubic chamber with 6 TRUE OPEN circular
 * airlock hatches (±X, ±Y, ±Z), non-coplanar beveled frames, destination plaques, and
 * optional level-specific interior props.
 */
function buildSixAirlockCellMesh(scene, namePrefix, sharedMats, options = {}) {
  const B = globalThis.BABYLON;
  const root = new B.TransformNode(namePrefix, scene);
  const H = CELL_HALF_SIZE; // 3.0m
  const openHalf = 1.22; // 2.44m clear opening for 2.4m circular hatch
  const wallThick = 0.14;
  const wallOffset = H - wallThick * 0.5; // 2.93m (outer skin sits cleanly at 3.00m!)
  const plaques = {};
  const rings = {};

  // Build 6 perforated walls using 4 clean spandrel slabs around each 2.44m x 2.44m hatch
  const faceDefs = [
    { axis: '+X', rot: [0, Math.PI * 0.5, 0], pos: [wallOffset, 0, 0] },
    { axis: '-X', rot: [0, -Math.PI * 0.5, 0], pos: [-wallOffset, 0, 0] },
    { axis: '+Y', rot: [-Math.PI * 0.5, 0, 0], pos: [0, wallOffset, 0] },
    { axis: '-Y', rot: [Math.PI * 0.5, 0, 0], pos: [0, -wallOffset, 0] },
    { axis: '+Z', rot: [0, 0, 0], pos: [0, 0, wallOffset] },
    { axis: '-Z', rot: [0, Math.PI, 0], pos: [0, 0, -wallOffset] },
  ];

  const bandSpan = H - openHalf; // 1.78m
  const bandCenter = openHalf + bandSpan * 0.5; // 2.11m

  for (const fd of faceDefs) {
    const faceNode = new B.TransformNode(`${namePrefix}_f_${fd.axis}`, scene);
    faceNode.position.set(fd.pos[0], fd.pos[1], fd.pos[2]);
    faceNode.rotation.set(fd.rot[0], fd.rot[1], fd.rot[2]);
    faceNode.parent = root;

    // Top & bottom spandrel panels (full 6m width, height 1.78m)
    const topBar = B.MeshBuilder.CreateBox(`${namePrefix}_t_${fd.axis}`, { width: 6.0, height: bandSpan, depth: wallThick }, scene);
    topBar.position.set(0, bandCenter, 0);
    topBar.material = sharedMats.wallMat;
    topBar.parent = faceNode;

    const botBar = B.MeshBuilder.CreateBox(`${namePrefix}_b_${fd.axis}`, { width: 6.0, height: bandSpan, depth: wallThick }, scene);
    botBar.position.set(0, -bandCenter, 0);
    botBar.material = sharedMats.wallMat;
    botBar.parent = faceNode;

    // Left & right side spandrels between top & bottom bars
    const leftBar = B.MeshBuilder.CreateBox(`${namePrefix}_l_${fd.axis}`, { width: bandSpan, height: openHalf * 2, depth: wallThick }, scene);
    leftBar.position.set(-bandCenter, 0, 0);
    leftBar.material = sharedMats.wallMat;
    leftBar.parent = faceNode;

    const rightBar = B.MeshBuilder.CreateBox(`${namePrefix}_r_${fd.axis}`, { width: bandSpan, height: openHalf * 2, depth: wallThick }, scene);
    rightBar.position.set(bandCenter, 0, 0);
    rightBar.material = sharedMats.wallMat;
    rightBar.parent = faceNode;

    // Circular brushed-steel 2.4m airlock frame ring (offset inward by 0.04m -> zero Z-fighting!)
    const ringFrame = B.MeshBuilder.CreateTorus(`${namePrefix}_rf_${fd.axis}`, { diameter: 2.48, thickness: 0.16, tessellation: 32 }, scene);
    ringFrame.rotation.x = Math.PI * 0.5;
    ringFrame.position.set(0, 0, -0.05);
    ringFrame.material = sharedMats.steelMat;
    ringFrame.parent = faceNode;

    // Glowing inner accent ring around circular hatch
    const glowRing = B.MeshBuilder.CreateTorus(`${namePrefix}_rg_${fd.axis}`, { diameter: 2.34, thickness: 0.045, tessellation: 32 }, scene);
    glowRing.rotation.x = Math.PI * 0.5;
    glowRing.position.set(0, 0, -0.09);
    glowRing.material = sharedMats.defaultRingMat;
    glowRing.parent = faceNode;
    rings[fd.axis] = glowRing;

    // Backlit doorway destination plaque (center cell) OR deep atmospheric corridor disc (neighbor far hatches)
    if (!options.minimalNeighbor) {
      const plaque = B.MeshBuilder.CreatePlane(`${namePrefix}_plq_${fd.axis}`, { width: 1.32, height: 0.48 }, scene);
      plaque.position.set(0, 1.62, -0.10);
      plaque.parent = faceNode;
      plaques[fd.axis] = plaque;
    } else if (sharedMats.farDepthMat) {
      const depthDisc = B.MeshBuilder.CreateDisc(`${namePrefix}_depth_${fd.axis}`, { radius: 1.24, tessellation: 28 }, scene);
      depthDisc.position.set(0, 0, 0.08); // Behind neighbor outer bulkhead, facing strictly inward (-Z)!
      depthDisc.material = sharedMats.farDepthMat;
      depthDisc.parent = faceNode;
      plaques[fd.axis] = depthDisc; // Store depth discs on neighbor shells keyed by localAxis
    }
  }

  // Subtle architectural corner trim beams (12 edges of the 6m cube, inset cleanly by 4cm)
  const edgeLen = 5.76;
  const ePos = H - 0.14;
  const edgeMat = sharedMats.steelMat;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bz = B.MeshBuilder.CreateBox(`${namePrefix}_ez_${sx}_${sy}`, { width: 0.12, height: 0.12, depth: edgeLen }, scene);
      bz.position.set(sx * ePos, sy * ePos, 0);
      bz.material = edgeMat;
      bz.parent = root;
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const by = B.MeshBuilder.CreateBox(`${namePrefix}_ey_${sx}_${sz}`, { width: 0.12, height: edgeLen, depth: 0.12 }, scene);
      by.position.set(sx * ePos, 0, sz * ePos);
      by.material = edgeMat;
      by.parent = root;
    }
  }

  return { root, plaques, rings };
}

/**
 * Procedural deep-corridor atmospheric depth gradient disc texture for far neighbor hatches,
 * giving clean recursive aerospace station depth instead of flat grey clearColor sky.
 */
function createFarTunnelMaterial(scene) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture('rig_far_tunnel_tex', { width: 256, height: 256 }, scene, true);
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0.0, '#1B283A');
  grad.addColorStop(0.38, '#41556E');
  grad.addColorStop(0.72, '#8D9EB2');
  grad.addColorStop(1.0, '#C5D0DC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle recursive circular hatch rings receding into atmospheric depth
  for (const [r, alpha] of [[92, 0.35], [62, 0.32], [36, 0.28], [18, 0.25]]) {
    ctx.strokeStyle = `rgba(220, 236, 248, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  tex.update();

  const mat = new B.StandardMaterial('rig_far_tunnel_mat', scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = true;
  return mat;
}

/**
 * Shared manager that keeps the current cell at (0,0,0) and ALL 6 seamless neighbor cells
 * transformed around it via exact 4D parallel transport (`computeNeighborTransformInCell`).
 */
class SeamlessTesseractChamberRig {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.base = initZoneASceneBase(scene, camera);
    this.root = new this.B.TransformNode('tesseract_rig_root', scene);

    this.steelMat = new this.B.PBRMaterial('rig_steel', scene);
    this.steelMat.albedoColor = this.B.Color3.FromHexString('#8A96A6');
    this.steelMat.metallic = 0.68;
    this.steelMat.roughness = 0.32;

    this.farDepthMat = createFarTunnelMaterial(scene);
    this.defaultRingMat = makeEmissiveMat(scene, 'rig_default_ring', PALETTE.accent.cyanW0, 0.9);
    this.cellRingMats = {};
    this.cellPlaqueMats = {};
    for (const id of CELL_IDS) {
      this.cellRingMats[id] = makeEmissiveMat(scene, `rig_ring_${id}`, CELL_COLORS[id], 0.95);
      const sub = id === 'W-' && options.markWMinusTarget ? '林夏定位信号' : '相邻三维胞';
      const tex = createCellPlaqueTexture(scene, `rig_plq_${id}`, id, sub, CELL_COLORS[id]);
      const pm = new this.B.StandardMaterial(`rig_plq_mat_${id}`, scene);
      pm.diffuseTexture = tex;
      pm.emissiveTexture = tex;
      pm.disableLighting = true;
      this.cellPlaqueMats[id] = pm;
    }

    const sharedMats = {
      wallMat: this.base.wallMat,
      deckMat: this.base.deckMat,
      steelMat: this.steelMat,
      defaultRingMat: this.defaultRingMat,
      farDepthMat: this.farDepthMat,
    };

    // Center active cell (full detail + plaques)
    this.centerCell = buildSixAirlockCellMesh(scene, 'center_cell', sharedMats, { minimalNeighbor: false });
    this.centerCell.root.parent = this.root;

    // 6 seamless adjacent neighbor shells (visible right through the 6 circular airlocks!)
    this.neighborShells = [];
    for (let i = 0; i < 6; i += 1) {
      const shell = buildSixAirlockCellMesh(scene, `nbr_cell_${i}`, sharedMats, { minimalNeighbor: true });
      shell.root.parent = this.root;
      this.neighborShells.push(shell);
    }

    // Per-cell prop containers + subtle color-coded architectural corner identity strips
    this.cellPropRoots = {};
    for (const id of CELL_IDS) {
      const node = new this.B.TransformNode(`cell_props_${id}`, scene);
      node.parent = this.root;
      node.setEnabled(false);
      this.cellPropRoots[id] = node;

      // Subtle vertical identity accent light rails along the 4 vertical chamber corners
      const stripMat = makeEmissiveMat(scene, `cell_id_strip_${id}`, CELL_COLORS[id], 0.72);
      const cOff = CELL_HALF_SIZE - 0.22;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const rail = this.B.MeshBuilder.CreateBox(
            `cell_id_rail_${id}_${sx}_${sz}`,
            { width: 0.045, height: 3.4, depth: 0.045 },
            scene
          );
          rail.position.set(sx * cOff, 0, sz * cOff);
          rail.material = stripMat;
          rail.parent = node;
        }
      }
    }

    this.lastRenderedCell = null;
  }

  /**
   * Re-anchor center cell, all 6 neighbor cells, doorway plaques, and per-cell 3D props
   * seamlessly using exact 4D transport math whenever the player enters a new cell!
   */
  syncRigForCell(currentCellId, customDoorwayStyleFn = null) {
    const B = this.B;
    const doorways = getCellDoorways(currentCellId);

    // Update doorway plaques & rings on center cell
    for (const dw of doorways) {
      const plaque = this.centerCell.plaques[dw.localAxis];
      const ring = this.centerCell.rings[dw.localAxis];
      if (customDoorwayStyleFn) {
        customDoorwayStyleFn(dw, plaque, ring, this.cellPlaqueMats, this.cellRingMats);
      } else {
        if (plaque) plaque.material = this.cellPlaqueMats[dw.targetCell];
        if (ring) ring.material = this.cellRingMats[dw.targetCell];
      }
    }

    // Disable all prop roots first, then enable center + its 6 visible neighbors at exact transforms!
    for (const id of CELL_IDS) {
      this.cellPropRoots[id].setEnabled(false);
    }

    // Center cell props sit cleanly at identity (0,0,0)
    const centerProps = this.cellPropRoots[currentCellId];
    centerProps.setEnabled(true);
    centerProps.position.set(0, 0, 0);
    centerProps.rotationQuaternion = B.Quaternion.Identity();

    // 6 adjacent neighbor shells & their props attach at exact 4D-transported transforms!
    const neighbors = getNeighbors(currentCellId);
    neighbors.forEach((nId, idx) => {
      const tf = computeNeighborTransformInCell(currentCellId, nId);
      const shell = this.neighborShells[idx];
      shell.root.position.copyFrom(tf.position);
      shell.root.rotationQuaternion = tf.rotationQuaternion.clone();

      // Tint neighbor's inner rings & toggle far-corridor depth discs (hide ONLY the connecting doorway!)
      const nDoors = getCellDoorways(nId);
      for (const nd of nDoors) {
        const nr = shell.rings[nd.localAxis];
        if (nr) nr.material = this.cellRingMats[nd.targetCell];
        const depthDisc = shell.plaques[nd.localAxis];
        if (depthDisc) {
          depthDisc.setEnabled(nd.targetCell !== currentCellId);
        }
      }

      const nProps = this.cellPropRoots[nId];
      nProps.setEnabled(true);
      nProps.position.copyFrom(tf.position);
      nProps.rotationQuaternion = tf.rotationQuaternion.clone();
    });

    this.lastRenderedCell = currentCellId;
  }

  dispose() {
    this.root.dispose();
    this.base.pipeline?.dispose();
  }
}

// ---------------------------------------------------------------------------
// 2. Level 2 Scene: 没有门通向对面 (8-Color Unfolded Tesseract + W- Locator)
// ---------------------------------------------------------------------------

export class Level2AntipodalScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.rig = new SeamlessTesseractChamberRig(scene, camera, { markWMinusTarget: true });
    this.time = 0;
    this.edgeWebLines = null;

    this._buildWPlusTesseractHologram();
    this._buildWMinusLocator();
  }

  _buildWPlusTesseractHologram() {
    const B = this.B;
    const parent = this.rig.cellPropRoots['W+'];
    this.holoRoot = new B.TransformNode('l2_tesseract_holo', this.scene);
    this.holoRoot.position.set(0, -0.55, 0);
    this.holoRoot.parent = parent;

    // 8-color 3D unfolded cross-net of translucent colored cubes (00-master-gdd.md #2!)
    this.holoRoot.position.set(0, -0.25, 0.35);
    const cubeSize = 0.34;
    const spacing = 0.42;
    const nodePositions = {};
    for (const id of CELL_IDS) {
      const [nx, ny, nz] = UNFOLDED_NET_POS[id];
      const pos = new B.Vector3(nx * spacing, (ny + 0.4) * spacing, nz * spacing);
      nodePositions[id] = pos;

      const cube = B.MeshBuilder.CreateBox(`l2_holo_cube_${id}`, { size: cubeSize }, this.scene);
      cube.position.copyFrom(pos);
      cube.material = createGhostMaterial(this.scene, `l2_holo_mat_${id}`, CELL_COLORS[id], 0.34);
      cube.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      cube.parent = this.holoRoot;

      // Crisp wireframe outline around each holographic cube
      const frame = B.MeshBuilder.CreateBox(`l2_holo_edge_${id}`, { size: cubeSize + 0.01 }, this.scene);
      frame.position.copyFrom(pos);
      frame.material = makeEmissiveMat(this.scene, `l2_holo_em_${id}`, CELL_COLORS[id], 0.8);
      frame.material.wireframe = true;
      frame.parent = this.holoRoot;
    }

    // All 24 face-adjacency filaments (ignite brightly when player answers "6 paths"!)
    const edges = [];
    for (let i = 0; i < CELL_IDS.length; i += 1) {
      for (let j = i + 1; j < CELL_IDS.length; j += 1) {
        const a = CELL_IDS[i];
        const b = CELL_IDS[j];
        if (Math.abs(CELL_NORMALS[a][0] * CELL_NORMALS[b][0] + CELL_NORMALS[a][1] * CELL_NORMALS[b][1] + CELL_NORMALS[a][2] * CELL_NORMALS[b][2] + CELL_NORMALS[a][3] * CELL_NORMALS[b][3]) < 0.01) {
          edges.push([nodePositions[a], nodePositions[b]]);
        }
      }
    }
    this.edgeWebLines = B.MeshBuilder.CreateLineSystem('l2_24_edges', { lines: edges }, this.scene);
    this.edgeWebLines.color = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    this.edgeWebLines.alpha = 0.22;
    this.edgeWebLines.parent = this.holoRoot;
  }

  _buildWMinusLocator() {
    const B = this.B;
    const parent = this.rig.cellPropRoots['W-'];
    this.locatorRoot = new B.TransformNode('l2_locator_root', this.scene);
    this.locatorRoot.parent = parent;

    const core = B.MeshBuilder.CreatePolyhedron('l2_locator_core', { type: 1, size: 0.34 }, this.scene);
    core.material = makeEmissiveMat(this.scene, 'l2_loc_core_mat', PALETTE.accent.goldWPos, 1.15);
    core.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    core.parent = this.locatorRoot;

    this.locRingA = B.MeshBuilder.CreateTorus('l2_loc_ring_a', { diameter: 0.96, thickness: 0.04, tessellation: 28 }, this.scene);
    this.locRingA.material = makeEmissiveMat(this.scene, 'l2_loc_ra', PALETTE.accent.cyanW0, 1.1);
    this.locRingA.parent = this.locatorRoot;

    this.locRingB = B.MeshBuilder.CreateTorus('l2_loc_ring_b', { diameter: 1.24, thickness: 0.032, tessellation: 28 }, this.scene);
    this.locRingB.material = makeEmissiveMat(this.scene, 'l2_loc_rb', '#A78BFA', 1.0);
    this.locRingB.parent = this.locatorRoot;

    // Distinct violet-cyan glow light inside antipodal W- room
    const wMinusLight = new B.PointLight('l2_wminus_light', new B.Vector3(0, 0, 0), this.scene);
    wMinusLight.diffuse = B.Color3.FromHexString('#C4B5FD');
    wMinusLight.intensity = 0.95;
    wMinusLight.range = 8;
    wMinusLight.parent = parent;
  }

  syncFromState(state, dtSec) {
    this.time += dtSec;
    this.rig.syncRigForCell(state.cellId);
    applyIntrinsicFrameToCamera(this.camera, state.nav.getLocalPos3(), state.nav.getLocalFrame3());

    const targetFov = state.telescopeActive ? 0.32 : 0.94;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    this.holoRoot.rotation.y = this.time * 0.45;
    if (this.edgeWebLines) {
      this.edgeWebLines.alpha = state.completed ? 0.95 : 0.22;
      this.edgeWebLines.color = this.B.Color3.FromHexString(
        state.completed ? PALETTE.accent.emerald : PALETTE.accent.cyanW0
      );
    }

    this.locatorRoot.setEnabled(!state.hasPickedLocator);
    if (!state.hasPickedLocator) {
      this.locatorRoot.position.y = Math.sin(this.time * 2.1) * 0.14;
      this.locRingA.rotation.set(this.time * 1.1, this.time * 0.7, 0);
      this.locRingB.rotation.set(-this.time * 0.8, 0, this.time * 1.0);
    }
  }

  dispose() {
    this.rig.dispose();
  }
}

// ---------------------------------------------------------------------------
// 3. Level 3 Scene: 哪边是上 (Golden Shared 1D Edge + Fluorescent Arrows + 3D Gyro)
// ---------------------------------------------------------------------------

export class Level3HolonomyScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.rig = new SeamlessTesseractChamberRig(scene, camera);
    this.time = 0;

    this._buildSharedGoldenEdgeAndArrows();
    this._buildResonanceLockInWPlus();
    this._buildHandheldGyroscope();
  }

  _buildSharedGoldenEdgeAndArrows() {
    const B = this.B;
    const goldEdgeMat = makeEmissiveMat(this.scene, 'l3_gold_edge_mat', PALETTE.accent.goldWPos, 1.35);
    const arrowTex = createFluorescentArrowTexture(this.scene, 'l3_arrow_tex', '↑ 上', PALETTE.accent.cyanW0);
    const arrowMat = new B.StandardMaterial('l3_arrow_mat', this.scene);
    arrowMat.diffuseTexture = arrowTex;
    arrowMat.emissiveTexture = arrowTex;
    arrowMat.opacityTexture = arrowTex;
    arrowMat.disableLighting = true;
    arrowMat.backFaceCulling = false;
    arrowMat.disableDepthWrite = true;
    arrowMat.needDepthPrePass = false;

    const fbTex = createFluorescentArrowTexture(this.scene, 'l3_fb_arrow_tex', '→ 沿箭头飞', PALETTE.accent.goldWPos);
    const fbArrowMat = new B.StandardMaterial('l3_fb_arrow_mat', this.scene);
    fbArrowMat.diffuseTexture = fbTex;
    fbArrowMat.emissiveTexture = fbTex;
    fbArrowMat.opacityTexture = fbTex;
    fbArrowMat.disableLighting = true;
    fbArrowMat.backFaceCulling = false;
    fbArrowMat.disableDepthWrite = true;
    fbArrowMat.needDepthPrePass = false;

    // Exact shared 1D edge of the 3-cell corner {W+, X+, Y+}:
    // Lies at the intersection of the two faces pointing to the OTHER TWO cells in {W+, X+, Y+}!
    const edgeCells = [
      { id: 'W+', others: ['X+', 'Y+'], nextDoor: 'X+' },
      { id: 'X+', others: ['W+', 'Y+'], nextDoor: 'Y+' },
      { id: 'Y+', others: ['W+', 'X+'], nextDoor: 'W+' },
    ];
    this.goldenEdges = [];
    this.fallbackGuides = [];

    for (const cfg of edgeCells) {
      const parent = this.rig.cellPropRoots[cfg.id];
      const d1 = tangent4ToCellLocal3(cfg.id, CELL_NORMALS[cfg.others[0]]);
      const d2 = tangent4ToCellLocal3(cfg.id, CELL_NORMALS[cfg.others[1]]);
      // Shared edge center lies at (d1 + d2) * (CELL_HALF_SIZE - 0.16), running along local X axis!
      const ex = (d1[0] + d2[0]) * (CELL_HALF_SIZE - 0.16);
      const ey = (d1[1] + d2[1]) * (CELL_HALF_SIZE - 0.16);
      const ez = (d1[2] + d2[2]) * (CELL_HALF_SIZE - 0.16);

      const beam = B.MeshBuilder.CreateCylinder(
        `l3_gold_edge_${cfg.id}`,
        { diameter: 0.24, height: 5.72, tessellation: 16 },
        this.scene
      );
      beam.rotation.z = Math.PI * 0.5; // Runs along local X (the Z-axis in 4D, shared by W+, X+, Y+!)
      beam.position.set(ex, ey, ez);
      beam.material = goldEdgeMat;
      beam.parent = parent;
      this.goldenEdges.push(beam);

      // Hand-painted fluorescent "↑ 上" wall stencils mounted squarely on solid ±X spandrel panels
      for (const side of [-1, 1]) {
        for (const zSign of [-1, 1]) {
          const decal = B.MeshBuilder.CreatePlane(`l3_arr_${cfg.id}_${side}_${zSign}`, { width: 1.12, height: 1.38 }, this.scene);
          decal.position.set(side * (CELL_HALF_SIZE - 0.17), 0.0, zSign * 2.08);
          decal.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
          decal.material = arrowMat;
          decal.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
          decal.parent = parent;
        }
      }

      // Highlight ring around the canonical 3-room loop next doorway (emphasized in D9 fallback mode)
      const nextDir = tangent4ToCellLocal3(cfg.id, CELL_NORMALS[cfg.nextDoor]);
      const guideRing = B.MeshBuilder.CreateTorus(`l3_guide_${cfg.id}`, { diameter: 2.15, thickness: 0.08, tessellation: 32 }, this.scene);
      guideRing.position.set(nextDir[0] * 2.74, nextDir[1] * 2.74, nextDir[2] * 2.74);
      if (Math.abs(nextDir[0]) > 0.5) guideRing.rotation.z = Math.PI * 0.5;
      else if (Math.abs(nextDir[2]) > 0.5) guideRing.rotation.x = Math.PI * 0.5;
      guideRing.material = makeEmissiveMat(this.scene, `l3_guide_mat_${cfg.id}`, PALETTE.accent.goldWPos, 1.25);
      guideRing.parent = parent;
      this.fallbackGuides.push(guideRing);
    }
  }

  _buildResonanceLockInWPlus() {
    const B = this.B;
    const parent = this.rig.cellPropRoots['W+'];
    this.lockRoot = new B.TransformNode('l3_res_lock', this.scene);
    this.lockRoot.position.set(0, -1.55, 1.1);
    this.lockRoot.parent = parent;

    const ped = B.MeshBuilder.CreateCylinder('l3_lock_ped', { diameterTop: 0.65, diameterBottom: 0.85, height: 0.8, tessellation: 20 }, this.scene);
    ped.position.y = -0.35;
    ped.material = this.rig.steelMat;
    ped.parent = this.lockRoot;

    this.lockSlotMat = makeEmissiveMat(this.scene, 'l3_lock_slot_mat', PALETTE.accent.goldWPos, 1.05);
    this.lockEmeraldMat = makeEmissiveMat(this.scene, 'l3_lock_em_mat', PALETTE.accent.emerald, 1.3);

    // Vertical +Y target notch arrow above the resonance socket (clearly shows "目标: +Y 指天!")
    const targetShaft = B.MeshBuilder.CreateCylinder('l3_tgt_shaft', { diameter: 0.07, height: 0.72, tessellation: 12 }, this.scene);
    targetShaft.position.y = 0.42;
    targetShaft.material = this.lockSlotMat;
    targetShaft.parent = this.lockRoot;

    const targetCone = B.MeshBuilder.CreateCylinder('l3_tgt_cone', { diameterTop: 0, diameterBottom: 0.24, height: 0.26, tessellation: 12 }, this.scene);
    targetCone.position.y = 0.88;
    targetCone.material = this.lockSlotMat;
    targetCone.parent = this.lockRoot;

    this.lockHalo = B.MeshBuilder.CreateTorus('l3_lock_halo', { diameter: 0.92, thickness: 0.045, tessellation: 28 }, this.scene);
    this.lockHalo.position.y = 0.35;
    this.lockHalo.material = this.lockSlotMat;
    this.lockHalo.parent = this.lockRoot;
  }

  _buildHandheldGyroscope() {
    const B = this.B;
    // Attached to open lower-center-right of first-person camera (clear of both compass & F-map!)
    this.gyroAnchor = new B.TransformNode('l3_gyro_anchor', this.scene);
    this.gyroAnchor.parent = this.camera;
    this.gyroAnchor.position.set(0.20, -0.24, 0.88);

    const brassMat = new B.PBRMaterial('l3_gyro_brass', this.scene);
    brassMat.albedoColor = B.Color3.FromHexString('#D8AE56');
    brassMat.metallic = 0.88;
    brassMat.roughness = 0.22;

    const dialBack = B.MeshBuilder.CreateDisc('l3_gyro_dial_back', { radius: 0.132, tessellation: 28 }, this.scene);
    dialBack.position.set(0, 0, 0.035);
    dialBack.material = createGhostMaterial(this.scene, 'l3_gyro_back_mat', '#162231', 0.34);
    dialBack.parent = this.gyroAnchor;

    const outerRing = B.MeshBuilder.CreateTorus('l3_gyro_outer', { diameter: 0.28, thickness: 0.017, tessellation: 32 }, this.scene);
    outerRing.rotation.x = Math.PI * 0.5;
    outerRing.material = brassMat;
    outerRing.parent = this.gyroAnchor;

    const innerRing = B.MeshBuilder.CreateTorus('l3_gyro_inner', { diameter: 0.22, thickness: 0.012, tessellation: 24 }, this.scene);
    innerRing.material = brassMat;
    innerRing.parent = this.gyroAnchor;

    const hub = B.MeshBuilder.CreateSphere('l3_gyro_hub', { diameter: 0.036, segments: 12 }, this.scene);
    hub.material = brassMat;
    hub.parent = this.gyroAnchor;

    // Rotating 4D-transported locked needle node (local +Y = needle tip!)
    this.gyroNeedlePivot = new B.TransformNode('l3_gyro_needle_pivot', this.scene);
    this.gyroNeedlePivot.parent = this.gyroAnchor;

    this.needleMat = makeEmissiveMat(this.scene, 'l3_needle_mat', PALETTE.accent.cyanW0, 1.35);
    this.needleAlignedMat = makeEmissiveMat(this.scene, 'l3_needle_ok_mat', PALETTE.accent.emerald, 1.45);

    const shaft = B.MeshBuilder.CreateCylinder('l3_needle_shaft', { diameter: 0.022, height: 0.18, tessellation: 12 }, this.scene);
    shaft.position.y = 0.025;
    shaft.material = this.needleMat;
    shaft.parent = this.gyroNeedlePivot;
    this.needleShaft = shaft;

    const tip = B.MeshBuilder.CreateCylinder('l3_needle_tip', { diameterTop: 0, diameterBottom: 0.064, height: 0.082, tessellation: 12 }, this.scene);
    tip.position.y = 0.145;
    tip.material = this.needleMat;
    tip.parent = this.gyroNeedlePivot;
    this.needleTip = tip;

    // Target reference needle (shows where +Y "指天" points in W+!)
    this.targetNeedlePivot = new B.TransformNode('l3_gyro_target_pivot', this.scene);
    this.targetNeedlePivot.parent = this.gyroAnchor;
    const tMat = makeEmissiveMat(this.scene, 'l3_tneedle_mat', PALETTE.accent.goldWPos, 1.0);
    const tShaft = B.MeshBuilder.CreateCylinder('l3_tneedle', { diameter: 0.010, height: 0.13, tessellation: 8 }, this.scene);
    tShaft.position.y = 0.065;
    tShaft.material = tMat;
    tShaft.parent = this.targetNeedlePivot;
    const tTip = B.MeshBuilder.CreateCylinder('l3_tneedle_tip', { diameterTop: 0, diameterBottom: 0.036, height: 0.044, tessellation: 8 }, this.scene);
    tTip.position.y = 0.145;
    tTip.material = tMat;
    tTip.parent = this.targetNeedlePivot;

    for (const m of this.gyroAnchor.getChildMeshes()) {
      m.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      m.isPickable = false;
    }
  }

  _orientYNodeToCameraSpaceDir(node, dirCamSpace) {
    const B = this.B;
    const v = new B.Vector3(dirCamSpace[0], dirCamSpace[1], dirCamSpace[2]);
    if (v.lengthSquared() < 1e-6) return;
    v.normalize();
    const up = new B.Vector3(0, 1, 0);
    const dot = Math.max(-1, Math.min(1, B.Vector3.Dot(up, v)));
    if (dot > 0.9999) {
      node.rotationQuaternion = B.Quaternion.Identity();
    } else if (dot < -0.9999) {
      node.rotationQuaternion = B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI);
    } else {
      const axis = B.Vector3.Cross(up, v).normalize();
      node.rotationQuaternion = B.Quaternion.RotationAxis(axis, Math.acos(dot));
    }
  }

  syncFromState(state, dtSec) {
    this.time += dtSec;
    this.rig.syncRigForCell(state.cellId);
    applyIntrinsicFrameToCamera(this.camera, state.nav.getLocalPos3(), state.nav.getLocalFrame3());

    const targetFov = state.telescopeActive ? 0.32 : 0.94;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    // Express 4D-transported gyro pointer directly in camera-local space [dot(g, right), dot(g, up), dot(g, forward)]!
    const g3 = state.getGyroLocal3();
    const f = state.nav.getLocalFrame3();
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    this._orientYNodeToCameraSpaceDir(this.gyroNeedlePivot, [
      dot3(g3, f.right),
      dot3(g3, f.up),
      dot3(g3, f.forward),
    ]);

    const aligned = state.isGyroAlignedForLock();
    this.needleShaft.material = aligned ? this.needleAlignedMat : this.needleMat;
    this.needleTip.material = aligned ? this.needleAlignedMat : this.needleMat;

    // Show target +Y reference vector when inside W+
    this.targetNeedlePivot.setEnabled(state.cellId === 'W+');
    if (state.cellId === 'W+') {
      const targetLocal = [0, 1, 0]; // +Y in W+
      this._orientYNodeToCameraSpaceDir(this.targetNeedlePivot, [
        dot3(targetLocal, f.right),
        dot3(targetLocal, f.up),
        dot3(targetLocal, f.forward),
      ]);
    }

    // Pulse golden edge & D9 fallback doorway guide rings
    const pulse = 0.85 + 0.25 * Math.sin(this.time * 3.4);
    for (const g of this.fallbackGuides) {
      g.isVisible = state.holonomyFallback || state.beat < 2;
      g.scaling.setAll(state.holonomyFallback ? pulse : 0.96);
    }

    // Resonance lock status visuals
    this.lockHalo.rotation.y = this.time * (aligned || state.completed ? 2.2 : 0.6);
    this.lockHalo.material = aligned || state.completed ? this.lockEmeraldMat : this.lockSlotMat;
  }

  dispose() {
    this.gyroAnchor.dispose();
    this.rig.dispose();
  }
}

// ---------------------------------------------------------------------------
// 4. Level 4 Scene: 一笔走完 (8 Star-Ring Dome Beacons + 2.2m Mercury Rift Sphere)
// ---------------------------------------------------------------------------

export class Level4HamiltonianScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.rig = new SeamlessTesseractChamberRig(scene, camera);
    this.time = 0;

    this.beaconMats = {
      dormant: makeEmissiveMat(scene, 'l4_b_off', '#6E95B8', 0.65),
      lit: makeEmissiveMat(scene, 'l4_b_on', PALETTE.accent.goldWPos, 1.35),
      complete: makeEmissiveMat(scene, 'l4_b_win', PALETTE.accent.platinum, 1.45),
    };
    this.statusRingMats = {
      unvisited: makeEmissiveMat(scene, 'l4_ring_unv', PALETTE.accent.cyanW0, 1.05),
      visited: makeEmissiveMat(scene, 'l4_ring_vis', PALETTE.accent.amberCoral, 0.95),
      finish: makeEmissiveMat(scene, 'l4_ring_fin', PALETTE.accent.emerald, 1.4),
      awakened: makeEmissiveMat(scene, 'l4_ring_awk', PALETTE.accent.platinum, 1.2),
    };

    // Pre-generate crisp dynamic plaques for each (cellId, status) pair!
    this.statusPlaques = {};
    for (const id of CELL_IDS) {
      const makeP = (key, title, sub, hex) => {
        const tex = createCellPlaqueTexture(scene, `l4_p_${id}_${key}`, title, sub, hex);
        const m = new this.B.StandardMaterial(`l4_pm_${id}_${key}`, scene);
        m.diffuseTexture = tex;
        m.emissiveTexture = tex;
        m.disableLighting = true;
        return m;
      };
      this.statusPlaques[id] = {
        unvisited: makeP('u', `★ ${id}`, '未访问信标', PALETTE.accent.cyanW0),
        visited: makeP('v', `✗ ${id}`, '已访问（重进重置）', PALETTE.accent.amberCoral),
        finish: makeP('f', `◈ ${id}`, '8/8 闭环终点！', PALETTE.accent.emerald),
        awakened: makeP('a', `◈ ${id}`, '裂隙球已苏醒', PALETTE.accent.platinum),
      };
    }

    this._buildEightDomeBeacons();
    this._buildMercuryRiftSphere();
  }

  _buildEightDomeBeacons() {
    const B = this.B;
    this.beacons = {};
    for (const id of CELL_IDS) {
      const parent = this.rig.cellPropRoots[id];
      // Monumental Star-Ring Chandelier encircling the +Y ceiling airlock (diameter 3.4m -> clear passage!)
      const ring = B.MeshBuilder.CreateTorus(
        `l4_beacon_${id}`,
        { diameter: 3.35, thickness: 0.14, tessellation: 36 },
        this.scene
      );
      ring.position.set(0, 2.52, 0);
      ring.material = this.beaconMats.dormant;
      ring.parent = parent;

      // 4 glowing star-node diamonds around the beacon ring
      const nodes = [];
      for (let k = 0; k < 4; k += 1) {
        const ang = (k * Math.PI) / 2 + Math.PI / 4;
        const d = B.MeshBuilder.CreatePolyhedron(`l4_bnode_${id}_${k}`, { type: 1, size: 0.16 }, this.scene);
        d.position.set(Math.cos(ang) * 1.68, 2.52, Math.sin(ang) * 1.68);
        d.material = this.beaconMats.dormant;
        d.parent = parent;
        nodes.push(d);
      }

      this.beacons[id] = { ring, nodes };
    }
  }

  _buildMercuryRiftSphere() {
    const B = this.B;
    const parent = this.rig.cellPropRoots['W+'];
    this.riftRoot = new B.TransformNode('l4_mercury_rift', this.scene);
    this.riftRoot.position.set(0, -0.56, 0);
    this.riftRoot.parent = parent;

    // Monumental liquid-mercury mirror sphere (suspended slightly low when dormant so ★ X+ airlock is completely visible!)
    this.mercuryMat = createMercuryRiftPBR(this.scene, 'l4_mercury_mat');
    this.riftSphere = B.MeshBuilder.CreateSphere('l4_rift_sphere', { diameter: 1.56, segments: 40 }, this.scene);
    this.riftSphere.material = this.mercuryMat;
    this.riftSphere.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.riftSphere.parent = this.riftRoot;

    // Triple precision orbital rift containment rings
    this.riftRings = [];
    const ringMat = makeEmissiveMat(this.scene, 'l4_rift_ring_dormant', '#7B8FA6', 0.65);
    this.riftAwakeRingMat = makeEmissiveMat(this.scene, 'l4_rift_ring_awake', PALETTE.accent.cyanW0, 1.35);
    this.riftDormantRingMat = ringMat;

    [1.76, 1.90, 2.04].forEach((diam, idx) => {
      const r = B.MeshBuilder.CreateTorus(`l4_rring_${idx}`, { diameter: diam, thickness: 0.04, tessellation: 44 }, this.scene);
      r.material = ringMat;
      r.parent = this.riftRoot;
      this.riftRings.push(r);
    });
  }

  syncFromState(state, dtSec) {
    this.time += dtSec;

    this.rig.syncRigForCell(state.cellId, (dw, plaque, ring) => {
      const status = state.getDoorwayStatus(dw.targetCell);
      if (plaque) plaque.material = this.statusPlaques[dw.targetCell][status];
      if (ring) ring.material = this.statusRingMats[status];
    });

    applyIntrinsicFrameToCamera(this.camera, state.nav.getLocalPos3(), state.nav.getLocalFrame3());
    const targetFov = state.telescopeActive ? 0.32 : 0.94;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    // Update all 8 dome Star-Ring beacons
    for (const id of CELL_IDS) {
      const b = this.beacons[id];
      const mat = state.riftSphereAwakened
        ? this.beaconMats.complete
        : state.visited.has(id)
          ? this.beaconMats.lit
          : this.beaconMats.dormant;
      b.ring.material = mat;
      for (const n of b.nodes) {
        n.material = mat;
        n.rotation.y = this.time * 1.4;
      }
    }

    // Animate Liquid-Mercury Rift Mirror Sphere (rises to center & expands to full ~2m portal when awakened!)
    const awake = state.riftSphereAwakened;
    const targetY = awake ? 0.05 : -0.56;
    this.riftRoot.position.y += (targetY - this.riftRoot.position.y) * Math.min(1, dtSec * 4.5);

    const speed = awake ? 1.8 : 0.25;
    this.riftRings[0].rotation.set(0.55 + this.time * speed, this.time * speed * 0.7, 0.2);
    this.riftRings[1].rotation.set(-0.45 - this.time * speed * 0.8, 0.3, 0.75 + this.time * speed);
    this.riftRings[2].rotation.set(1.05, 0.2 + this.time * speed * 1.1, -0.35 - this.time * speed * 0.6);

    const baseScale = awake ? 1.24 : 1.0;
    const pulse = awake ? baseScale + Math.sin(this.time * 4.2) * 0.045 : 1.0;
    this.riftSphere.scaling.setAll(pulse);
    this.mercuryMat.emissiveColor = awake
      ? this.B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(0.28)
      : new this.B.Color3(0.03, 0.08, 0.12);

    for (const r of this.riftRings) {
      r.material = awake ? this.riftAwakeRingMat : this.riftDormantRingMat;
    }
  }

  dispose() {
    this.rig.dispose();
  }
}
