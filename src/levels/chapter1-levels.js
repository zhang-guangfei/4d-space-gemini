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
  createCockpitTitaniumPBR,
  createFluorescentArrowTexture,
  createGyroDialTexture,
  createMercuryRiftPBR,
  createPrologueEnvironmentTexture,
  createSoftGlowParticleTexture,
  createStationEnvironmentTexture,
  createStationMirrorFloorPBR,
  createVolumetricShaftMaterial,
  setupProloguePostProcessing,
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
// Shared Zone A AAA Environment, Screen-Anchor Projection & Particle Helpers
// ---------------------------------------------------------------------------

function projectWorldToScreen(scene, camera, worldPos) {
  if (!scene || !camera || !worldPos) return null;
  const B = globalThis.BABYLON;
  const engine = scene.getEngine();
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  if (!w || !h) return null;
  const viewport = camera.viewport.toGlobal(w, h);
  const projected = B.Vector3.Project(
    worldPos,
    B.Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport
  );
  const dpr = engine.getHardwareScalingLevel ? 1 / engine.getHardwareScalingLevel() : 1;
  return {
    x: projected.x / dpr,
    y: projected.y / dpr,
    inFront: projected.z >= 0 && projected.z <= 1,
  };
}

function createZoneAMotesParticleSystem(scene, name, { minBox, maxBox, capacity = 160, emitRate = 24, tintHex = '#D4F5F2' } = {}) {
  const B = globalThis.BABYLON;
  const ps = new B.ParticleSystem(name, capacity, scene);
  ps.particleTexture = createSoftGlowParticleTexture(scene);
  ps.emitter = new B.Vector3(0, 0, 0);
  ps.minEmitBox = minBox || new B.Vector3(-2.6, -2.4, -2.6);
  ps.maxEmitBox = maxBox || new B.Vector3(2.6, 2.4, 2.6);

  const c = B.Color3.FromHexString(tintHex);
  ps.color1 = new B.Color4(c.r, c.g, c.b, 0.52);
  ps.color2 = new B.Color4(1.0, 0.96, 0.85, 0.36);
  ps.colorDead = new B.Color4(c.r, c.g, c.b, 0.0);

  ps.minSize = 0.025;
  ps.maxSize = 0.072;
  ps.minLifeTime = 3.2;
  ps.maxLifeTime = 7.4;
  ps.emitRate = emitRate;
  ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
  ps.gravity = new B.Vector3(0, 0.012, 0);
  ps.direction1 = new B.Vector3(-0.08, 0.04, -0.08);
  ps.direction2 = new B.Vector3(0.08, 0.14, 0.08);
  ps.minEmitPower = 0.06;
  ps.maxEmitPower = 0.2;
  ps.updateSpeed = 0.014;
  ps.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
  ps.start();
  return ps;
}

function initZoneASceneBase(scene, camera, { fogDensity = 0.011 } = {}) {
  const B = globalThis.BABYLON;
  scene.clearColor = new B.Color4(0.81, 0.85, 0.90, 1.0);
  scene.ambientColor = new B.Color3(0.22, 0.25, 0.30);

  // Soft-mist aerospace atmospheric depth fog (matches Level 14 EXP2 depth standard!)
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogColor = B.Color3.FromHexString('#D7DFEA');
  scene.fogDensity = fogDensity;

  configureRenderingGroups(scene);
  createStationEnvironmentTexture(scene);

  // Sculpted 3-point clean-room daylight hierarchy (rich shadows + crisp specular modeling!)
  const hemi = new B.HemisphericLight('zone_a_hemi', new B.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.58;
  hemi.diffuse = new B.Color3(0.95, 0.97, 1.0);
  hemi.groundColor = new B.Color3(0.36, 0.42, 0.50);

  const keyLight = new B.DirectionalLight('zone_a_key', new B.Vector3(-0.32, -0.86, 0.39), scene);
  keyLight.position = new B.Vector3(6.0, 14.0, -6.0);
  keyLight.intensity = 1.15;
  keyLight.diffuse = new B.Color3(1.0, 0.99, 0.96);
  keyLight.specular = new B.Color3(0.96, 0.98, 1.0);

  const fillLight = new B.PointLight('zone_a_fill', new B.Vector3(0, 2.2, -1.0), scene);
  fillLight.intensity = 0.62;
  fillLight.range = 20;
  fillLight.diffuse = new B.Color3(0.84, 0.95, 1.0);

  const pipeline = setupZoneAPostProcessing(scene, camera);

  // Shared high-craft PBR trim materials
  const darkTitaniumMat = new B.PBRMaterial('zone_a_dark_ti_pbr', scene);
  darkTitaniumMat.albedoColor = B.Color3.FromHexString('#364150');
  darkTitaniumMat.metallic = 0.84;
  darkTitaniumMat.roughness = 0.28;
  darkTitaniumMat.clearCoat.isEnabled = true;
  darkTitaniumMat.clearCoat.intensity = 0.3;

  const brushedSteelMat = new B.PBRMaterial('zone_a_steel_pbr', scene);
  brushedSteelMat.albedoColor = B.Color3.FromHexString('#8C99AA');
  brushedSteelMat.metallic = 0.78;
  brushedSteelMat.roughness = 0.28;
  brushedSteelMat.clearCoat.isEnabled = true;
  brushedSteelMat.clearCoat.intensity = 0.25;

  const warmBrassMat = new B.PBRMaterial('zone_a_brass_pbr', scene);
  warmBrassMat.albedoColor = B.Color3.FromHexString('#CCA152');
  warmBrassMat.metallic = 0.9;
  warmBrassMat.roughness = 0.24;
  warmBrassMat.clearCoat.isEnabled = true;
  warmBrassMat.clearCoat.intensity = 0.35;

  return {
    hemi,
    keyLight,
    fillLight,
    pipeline,
    wallMat: createAviationPanelPBR(scene, 'zone_a_wall_shared', 2, 2),
    deckMat: createAerospaceDeckPBR(scene, 'zone_a_deck_shared', 2, 2),
    darkTitaniumMat,
    brushedSteelMat,
    warmBrassMat,
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
// 0. Prologue Scene: 迷航 (AAA Voyager Cockpit -> Warp Collapse -> 4D Tesseract)
// ---------------------------------------------------------------------------

export class PrologueScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.root = new this.B.TransformNode('prologue_root', scene);
    this.stars = [];
    this.gridMeshes = [];
    this.warpRings = [];
    this.alarmMats = [];
    this.time = 0;

    scene.clearColor = new this.B.Color4(0.015, 0.024, 0.052, 1.0);
    scene.fogMode = this.B.Scene.FOGMODE_EXP2;
    scene.fogColor = this.B.Color3.FromHexString('#050914');
    scene.fogDensity = 0.0085;

    configureRenderingGroups(scene);
    createPrologueEnvironmentTexture(scene);

    camera.rotationQuaternion = null;
    camera.position.set(0, 1.56, -2.25);
    camera.setTarget(new this.B.Vector3(0, 1.48, 12));
    camera.fov = 0.94;

    this.pipeline = setupProloguePostProcessing(scene, camera);

    const hemi = new this.B.HemisphericLight('pro_hemi', new this.B.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.46;
    hemi.diffuse = new this.B.Color3(0.68, 0.84, 1.0);
    hemi.groundColor = new this.B.Color3(0.08, 0.12, 0.18);

    this.keyLight = new this.B.DirectionalLight('pro_key', new this.B.Vector3(0.15, -0.5, 0.85), scene);
    this.keyLight.intensity = 1.1;
    this.keyLight.diffuse = new this.B.Color3(0.75, 0.92, 1.0);

    this.alarmLight = new this.B.PointLight('pro_alarm', new this.B.Vector3(0, 2.55, -0.8), scene);
    this.alarmLight.diffuse = this.B.Color3.FromHexString('#FF5B5B');
    this.alarmLight.intensity = 1.6;
    this.alarmLight.range = 10;

    this.coreGlowLight = new this.B.PointLight('pro_core_glow', new this.B.Vector3(0, 1.6, 9.0), scene);
    this.coreGlowLight.diffuse = this.B.Color3.FromHexString(PALETTE.accent.cyanW0);
    this.coreGlowLight.intensity = 2.4;
    this.coreGlowLight.range = 36;

    this._buildCockpit();
    this._buildStarfieldAndWarpTunnel();
    this._buildEmerging4DTesseract();
    this._buildWarpParticles();
  }

  _buildCockpit() {
    const B = this.B;
    this.hullMat = createCockpitTitaniumPBR(this.scene, 'pro_hull_ti_pbr');

    this.consoleTrimMat = new B.PBRMaterial('pro_trim_pbr', this.scene);
    this.consoleTrimMat.albedoColor = B.Color3.FromHexString('#4A596E');
    this.consoleTrimMat.metallic = 0.88;
    this.consoleTrimMat.roughness = 0.24;

    this.canopyGlassMat = createGhostMaterial(this.scene, 'pro_canopy_glass', '#7BDFF2', 0.30);

    const screenLTex = createCellPlaqueTexture(
      this.scene,
      'pro_scr_l_tex',
      'CURVATURE',
      '跃迁曲率偏离 · 空间闭合',
      PALETTE.accent.cyanW0
    );
    const screenLMat = new B.PBRMaterial('pro_scr_l_mat', this.scene);
    screenLMat.albedoTexture = screenLTex;
    screenLMat.emissiveTexture = screenLTex;
    screenLMat.emissiveColor = B.Color3.White().scale(0.95);
    screenLMat.metallic = 0.1;
    screenLMat.roughness = 0.2;

    const screenRTex = createCellPlaqueTexture(
      this.scene,
      'pro_scr_r_tex',
      'EVA · 07',
      '林夏已出舱 · 信号偏移',
      PALETTE.accent.amberCoral
    );
    const screenRMat = new B.PBRMaterial('pro_scr_r_mat', this.scene);
    screenRMat.albedoTexture = screenRTex;
    screenRMat.emissiveTexture = screenRTex;
    screenRMat.emissiveColor = B.Color3.White().scale(0.95);
    screenRMat.metallic = 0.1;
    screenRMat.roughness = 0.2;

    const cyanTrimMat = makeEmissiveMat(this.scene, 'pro_cyan_trim', PALETTE.accent.cyanW0, 1.35);
    const alarmMat = makeEmissiveMat(this.scene, 'pro_alarm_mat', PALETTE.accent.amberCoral, 1.45);
    this.alarmMats.push(alarmMat);

    // Sculpted lower instrument deck (tucked cleanly so 75%+ viewport is deep-space panorama!)
    const dash = B.MeshBuilder.CreateBox('pro_dash', { width: 5.4, height: 0.62, depth: 1.4 }, this.scene);
    dash.position.set(0, 0.50, 0.25);
    dash.material = this.hullMat;
    dash.parent = this.root;

    const dashLip = B.MeshBuilder.CreateBox('pro_dash_lip', { width: 5.2, height: 0.06, depth: 0.18 }, this.scene);
    dashLip.position.set(0, 0.83, -0.34);
    dashLip.material = this.consoleTrimMat;
    dashLip.parent = this.root;

    const dashGlow = B.MeshBuilder.CreateBox('pro_dash_glow', { width: 4.8, height: 0.018, depth: 0.04 }, this.scene);
    dashGlow.position.set(0, 0.87, -0.35);
    dashGlow.material = cyanTrimMat;
    dashGlow.parent = this.root;

    // Sleek angled glass instrument screens recessed cleanly on left & right wings of dash
    const screenL = B.MeshBuilder.CreatePlane('pro_scr_l', { width: 0.72, height: 0.25 }, this.scene);
    screenL.position.set(-1.38, 0.94, -0.22);
    screenL.rotation.set(0.36, 0.24, 0);
    screenL.material = screenLMat;
    screenL.parent = this.root;

    const screenR = B.MeshBuilder.CreatePlane('pro_scr_r', { width: 0.72, height: 0.25 }, this.scene);
    screenR.position.set(1.38, 0.94, -0.22);
    screenR.rotation.set(0.36, -0.24, 0);
    screenR.material = screenRMat;
    screenR.parent = this.root;

    // Sculpted panoramic spacecraft canopy ribs (wide open glass vista!)
    const strutCoords = [
      [-2.35, 1.92, 0.68, 0.14, 2.5, 0.22, 0, 0, -0.26],
      [2.35, 1.92, 0.68, 0.14, 2.5, 0.22, 0, 0, 0.26],
      [-1.72, 2.98, 0.56, 1.5, 0.14, 0.22, 0, 0, 0.14],
      [1.72, 2.98, 0.56, 1.5, 0.14, 0.22, 0, 0, -0.14],
      [0, 3.08, 0.56, 2.2, 0.16, 0.24, 0, 0, 0],
      [0, 0.12, -1.0, 5.8, 0.26, 4.8, 0, 0, 0],
    ];
    strutCoords.forEach(([x, y, z, w, h, d, rx, ry, rz], idx) => {
      const m = B.MeshBuilder.CreateBox(`pro_strut_${idx}`, { width: w, height: h, depth: d }, this.scene);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.material = this.hullMat;
      m.parent = this.root;
    });

    // Subtle glowing cyan side-canopy light tubes
    for (const s of [-1, 1]) {
      const tube = B.MeshBuilder.CreateCylinder(`pro_ctube_${s}`, { diameter: 0.026, height: 2.2, tessellation: 10 }, this.scene);
      tube.position.set(s * 2.24, 1.92, 0.56);
      tube.rotation.z = s * 0.26;
      tube.material = cyanTrimMat;
      tube.parent = this.root;
    }

    // Precision compact overhead warning beacon strip (sleek, never huge cartoon bar!)
    const warnHousing = B.MeshBuilder.CreateBox('pro_warn_house', { width: 1.25, height: 0.09, depth: 0.14 }, this.scene);
    warnHousing.position.set(0, 2.96, 0.44);
    warnHousing.material = this.consoleTrimMat;
    warnHousing.parent = this.root;

    const warnStrip = B.MeshBuilder.CreateBox('pro_warn_strip', { width: 1.06, height: 0.028, depth: 0.04 }, this.scene);
    warnStrip.position.set(0, 2.93, 0.36);
    warnStrip.material = alarmMat;
    warnStrip.parent = this.root;
  }

  _buildStarfieldAndWarpTunnel() {
    const B = this.B;
    const starMat = makeEmissiveMat(this.scene, 'pro_star_mat', '#F0F8FF', 1.6);
    const goldStarMat = makeEmissiveMat(this.scene, 'pro_star_gold', '#FFE6A8', 1.5);
    const cyanStarMat = makeEmissiveMat(this.scene, 'pro_star_cyan', PALETTE.accent.cyanW0, 1.5);

    for (let i = 0; i < 240; i += 1) {
      const s1 = Math.sin(i * 12.9898 + 1.2) * 43758.5453;
      const r1 = s1 - Math.floor(s1);
      const s2 = Math.sin(i * 78.233 + 3.7) * 43758.5453;
      const r2 = s2 - Math.floor(s2);
      const s3 = Math.sin(i * 41.123 + 7.1) * 43758.5453;
      const r3 = s3 - Math.floor(s3);

      const x = (r1 - 0.5) * 76;
      const y = (r2 - 0.36) * 46;
      const z = 14 + r3 * 68;
      const size = 0.08 + (i % 5) * 0.036;

      const star = B.MeshBuilder.CreateSphere(`pro_star_${i}`, { diameter: size, segments: 6 }, this.scene);
      star.position.set(x, y, z);
      star.material = i % 9 === 0 ? cyanStarMat : i % 7 === 0 ? goldStarMat : starMat;
      star.parent = this.root;

      this.stars.push({
        mesh: star,
        extinguishAt: 3.2 + (i / 240) * 5.6,
      });
    }

    // Volumetric collapsing warp-anomaly halos framing the horizon
    const warpShaftMat = createVolumetricShaftMaterial(this.scene, 'pro_warp_shaft', '#52E5FF', 0.22);
    for (let k = 0; k < 5; k += 1) {
      const ring = B.MeshBuilder.CreateTorus(
        `pro_warp_ring_${k}`,
        { diameter: 7.5 + k * 4.2, thickness: 0.06, tessellation: 48 },
        this.scene
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.position.set(0, 1.55, 11 + k * 6.5);
      ring.material = makeEmissiveMat(
        this.scene,
        `pro_wring_m_${k}`,
        k % 2 === 0 ? PALETTE.accent.cyanW0 : '#7BA6FF',
        1.1 - k * 0.14
      );
      ring.material.alpha = 0.34;
      ring.parent = this.root;
      this.warpRings.push(ring);
    }

    // Subtle volumetric emergence light curtain behind the tesseract
    this.emergenceBeam = B.MeshBuilder.CreatePlane('pro_emergence_shaft', { width: 16, height: 18 }, this.scene);
    this.emergenceBeam.position.set(0, 1.6, 20.5);
    this.emergenceBeam.material = warpShaftMat;
    this.emergenceBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.emergenceBeam.parent = this.root;
  }

  _buildEmerging4DTesseract() {
    const B = this.B;
    this.gridRoot = new B.TransformNode('pro_4d_grid', this.scene);
    this.gridRoot.position.set(0, 1.62, 14.5);
    this.gridRoot.parent = this.root;

    // Gleaming 3D Tubular 4D Tesseract (Schlegel Projection — true 3D metallic-emissive struts!)
    this.outerStrutMat = new B.PBRMaterial('pro_tess_outer_pbr', this.scene);
    this.outerStrutMat.albedoColor = B.Color3.FromHexString('#EEF6FF');
    this.outerStrutMat.emissiveColor = B.Color3.FromHexString('#CFE9FF').scale(1.45);
    this.outerStrutMat.metallic = 0.7;
    this.outerStrutMat.roughness = 0.18;
    this.outerStrutMat.alpha = 0.0;

    this.innerStrutMat = new B.PBRMaterial('pro_tess_inner_pbr', this.scene);
    this.innerStrutMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    this.innerStrutMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(1.65);
    this.innerStrutMat.metallic = 0.6;
    this.innerStrutMat.roughness = 0.16;
    this.innerStrutMat.alpha = 0.0;

    const addTube = (pA, pB, diam, mat, name) => {
      const mesh = B.MeshBuilder.CreateTube(name, { path: [pA, pB], radius: diam * 0.5, tessellation: 8 }, this.scene);
      mesh.material = mat;
      mesh.parent = this.gridRoot;
      this.gridMeshes.push(mesh);
    };

    const buildCubeTubes = (half, diam, mat, prefix) => {
      const signs = [-1, 1];
      let idx = 0;
      for (const sy of signs) {
        for (const sz of signs) {
          addTube(new B.Vector3(-half, sy * half, sz * half), new B.Vector3(half, sy * half, sz * half), diam, mat, `${prefix}_x_${idx++}`);
        }
      }
      for (const sx of signs) {
        for (const sz of signs) {
          addTube(new B.Vector3(sx * half, -half, sz * half), new B.Vector3(sx * half, half, sz * half), diam, mat, `${prefix}_y_${idx++}`);
        }
      }
      for (const sx of signs) {
        for (const sy of signs) {
          addTube(new B.Vector3(sx * half, sy * half, -half), new B.Vector3(sx * half, sy * half, half), diam, mat, `${prefix}_z_${idx++}`);
        }
      }
    };

    buildCubeTubes(4.4, 0.085, this.outerStrutMat, 'pro_t_out');
    buildCubeTubes(2.15, 0.075, this.innerStrutMat, 'pro_t_in');

    // 8 diagonal hypercube struts + luminous corner vertex nodes
    let dIdx = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const pIn = new B.Vector3(sx * 2.15, sy * 2.15, sz * 2.15);
          const pOut = new B.Vector3(sx * 4.4, sy * 4.4, sz * 4.4);
          addTube(pIn, pOut, 0.06, this.innerStrutMat, `pro_t_diag_${dIdx++}`);

          const node = B.MeshBuilder.CreateSphere(`pro_t_node_${dIdx}`, { diameter: 0.22, segments: 10 }, this.scene);
          node.position.copyFrom(pOut);
          node.material = this.outerStrutMat;
          node.parent = this.gridRoot;
          this.gridMeshes.push(node);
        }
      }
    }

    // Translucent crystal inner hypercube core (strict ghost invariants!)
    this.coreCube = B.MeshBuilder.CreateBox('pro_tess_core_ghost', { size: 4.18 }, this.scene);
    this.coreCube.material = createGhostMaterial(this.scene, 'pro_tess_core_mat', PALETTE.accent.cyanW0, 0.30);
    this.coreCube.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.coreCube.parent = this.gridRoot;
  }

  _buildWarpParticles() {
    const B = this.B;
    const ps = new B.ParticleSystem('prologue_warp_ps', 280, this.scene);
    ps.particleTexture = createSoftGlowParticleTexture(this.scene);
    ps.emitter = new B.Vector3(0, 1.5, 28);
    ps.minEmitBox = new B.Vector3(-12, -8, -4);
    ps.maxEmitBox = new B.Vector3(12, 8, 12);

    ps.color1 = new B.Color4(0.75, 0.96, 1.0, 0.85);
    ps.color2 = new B.Color4(0.30, 0.90, 0.83, 0.65);
    ps.colorDead = new B.Color4(0.30, 0.90, 0.83, 0.0);

    ps.minSize = 0.08;
    ps.maxSize = 0.26;
    ps.minLifeTime = 1.6;
    ps.maxLifeTime = 3.2;
    ps.emitRate = 68;
    ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    ps.direction1 = new B.Vector3(-0.3, -0.3, -14);
    ps.direction2 = new B.Vector3(0.3, 0.3, -20);
    ps.minEmitPower = 1.0;
    ps.maxEmitPower = 1.8;
    ps.updateSpeed = 0.016;
    ps.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    ps.start();
    this.particleSystem = ps;
  }

  syncFromState(state, input, dtSec) {
    this.time += dtSec;
    const t = state.elapsedSec;

    // Gentle cockpit look & decaying warp shudder
    const shake = t < 8.5 ? Math.sin(this.time * 26) * 0.011 : 0;
    this.camera.position.set(shake, 1.56 + shake * 0.5, -2.25);
    const yaw = Math.max(-0.55, Math.min(0.55, input.yaw || 0));
    const pitch = Math.max(-0.35, Math.min(0.35, input.pitch || 0));
    this.camera.rotation.set(-pitch, yaw, 0);

    // Pulsing warning beacon early on, softening as stars go out
    const alarmPulse = t < 9.5 ? 0.45 + 0.55 * Math.sin(this.time * 6.8) : Math.max(0, 1 - (t - 9.5) * 0.4);
    this.alarmLight.intensity = 1.8 * alarmPulse;

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

    // Rotate & breathe collapsing warp rings
    this.warpRings.forEach((r, idx) => {
      r.rotation.y = this.time * (0.28 + idx * 0.09) * (idx % 2 === 0 ? 1 : -1);
      r.scaling.setAll(1 + Math.sin(this.time * 1.6 + idx) * 0.04);
    });

    // Smooth shift from cosmic indigo -> luminous pure-white geometric space (7.5s -> 17.5s)
    const whiteBlend = Math.max(0, Math.min(1, (t - 8.2) / 7.2));
    const fadeFinal = Math.max(0, Math.min(1, (t - 14.5) / 3.0));
    const bgR = 0.015 + whiteBlend * 0.84 + fadeFinal * 0.14;
    const bgG = 0.024 + whiteBlend * 0.85 + fadeFinal * 0.12;
    const bgB = 0.052 + whiteBlend * 0.85 + fadeFinal * 0.09;
    this.scene.clearColor.set(Math.min(1, bgR), Math.min(1, bgG), Math.min(1, bgB), 1);
    this.scene.fogColor.set(Math.min(1, bgR), Math.min(1, bgG), Math.min(1, bgB));

    // Reveal the 3D tubular 4D tesseract cleanly right from the start (subtle ghost -> radiant crystal!)
    const tessAlpha = Math.max(0.42, Math.min(1.0, 0.42 + (t - 2.0) / 5.5)) * (1 - fadeFinal * 0.35);
    this.gridRoot.rotation.y = this.time * 0.34;
    this.gridRoot.rotation.x = 0.24 + Math.sin(this.time * 0.25) * 0.18;
    this.outerStrutMat.alpha = tessAlpha;
    this.innerStrutMat.alpha = tessAlpha;
    this.coreCube.setEnabled(tessAlpha > 0.35);
  }

  dispose() {
    this.particleSystem?.dispose();
    this.pipeline?.dispose();
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
    this.base = initZoneASceneBase(scene, camera, { fogDensity: 0.014 });
    this.root = new this.B.TransformNode('level1_root', scene);
    this.segments = [];
    this.mirrorRenderList = [];
    this.shadowCasters = [];
    this.time = 0;
    this.stridePhase = 0;
    this.lastUnwrappedZ = 0;
    this.portalOpenProgress = 0;

    camera.rotationQuaternion = null;
    camera.fov = 0.92;

    this._buildMaterials();
    this._buildRepeatingCorridorSegments();
    this._buildSelfSilhouettes();
    this._finalizeShadowsAndParticles();
  }

  _buildMaterials() {
    const B = this.B;
    this.wallMat = this.base.wallMat;
    this.steelMat = this.base.brushedSteelMat;
    this.darkTiMat = this.base.darkTitaniumMat;
    this.brassMat = this.base.warmBrassMat;

    // Real-time MirrorTexture polished laboratory deck (matches Level 14 mirror-floor craft!)
    const { mat: mirrorDeckMat, mirrorTex } = createStationMirrorFloorPBR(this.scene, this.mirrorRenderList, 2, 2);
    this.deckMat = mirrorDeckMat;
    this.floorMirrorTex = mirrorTex;

    this.glassMat = createGhostMaterial(this.scene, 'l1_glass', '#A5D8F3', 0.30);
    this.skylightMat = makeEmissiveMat(this.scene, 'l1_skylight', '#F8FBFF', 1.35);
    this.cyanMat = makeEmissiveMat(this.scene, 'l1_cyan', PALETTE.accent.cyanW0, 1.25);
    this.goldMat = makeEmissiveMat(this.scene, 'l1_gold', PALETTE.accent.goldWPos, 1.3);
    this.redRibbonMat = makeEmissiveMat(this.scene, 'l1_ribbon', '#FF3B5C', 1.15);
    this.emeraldMat = makeEmissiveMat(this.scene, 'l1_emerald', PALETTE.accent.emerald, 1.4);
    this.shaftMat = createVolumetricShaftMaterial(this.scene, 'l1_skylight_shaft', '#E8F6FF', 0.14);
    this.portalShaftMat = createVolumetricShaftMaterial(this.scene, 'l1_portal_shaft', PALETTE.accent.emerald, 0.34);

    // Zero-spoiler sleek aerospace plaques (NO "周期 4" spoiler on frame 1!)
    const segTags = ['观测段 · α', '观测段 · β', '观测段 · γ', '观测段 · δ'];
    this.plaqueMats = LEVEL1_LOOP_CELLS.map((cellId, idx) => {
      const tex = createCellPlaqueTexture(
        this.scene,
        `l1_plaque_${cellId}`,
        `舱室 ${cellId}`,
        segTags[idx],
        CELL_COLORS[cellId]
      );
      const m = new B.PBRMaterial(`l1_plaque_mat_${cellId}`, this.scene);
      m.albedoTexture = tex;
      m.emissiveTexture = tex;
      m.emissiveColor = B.Color3.White().scale(0.96);
      m.metallic = 0.15;
      m.roughness = 0.25;
      return m;
    });
  }

  _buildRepeatingCorridorSegments() {
    const B = this.B;
    const offsets = [-2, -1, 0, 1, 2, 3, 4, 5];

    for (const segOffset of offsets) {
      const segRoot = new B.TransformNode(`l1_seg_${segOffset}`, this.scene);
      segRoot.position.z = segOffset * CELL_SIZE;
      segRoot.parent = this.root;

      // Reflective Aerospace Laboratory Floor & Ceiling (6m x 6m)
      const floor = B.MeshBuilder.CreateBox(`l1_fl_${segOffset}`, { width: 6.0, height: 0.24, depth: 6.0 }, this.scene);
      floor.position.set(0, -0.12, 0);
      floor.material = this.deckMat;
      floor.receiveShadows = true;
      floor.parent = segRoot;

      const ceil = B.MeshBuilder.CreateBox(`l1_cl_${segOffset}`, { width: 6.0, height: 0.24, depth: 6.0 }, this.scene);
      ceil.position.set(0, 5.12, 0);
      ceil.material = this.wallMat;
      ceil.parent = segRoot;

      // Overhead diffused linear skylight lightbox + recessed dark-titanium frame
      const skyFrame = B.MeshBuilder.CreateBox(`l1_skyf_${segOffset}`, { width: 1.72, height: 0.08, depth: 5.0 }, this.scene);
      skyFrame.position.set(0, 4.97, 0);
      skyFrame.material = this.darkTiMat;
      skyFrame.parent = segRoot;

      const skylight = B.MeshBuilder.CreateBox(`l1_sky_${segOffset}`, { width: 1.48, height: 0.04, depth: 4.78 }, this.scene);
      skylight.position.set(0, 4.94, 0);
      skylight.material = this.skylightMat;
      skylight.parent = segRoot;
      if (segOffset >= -1 && segOffset <= 4) this.mirrorRenderList.push(skylight);

      // Delicate volumetric daylight shaft pouring from overhead skylight on near segments
      if (segOffset >= 0 && segOffset <= 3) {
        const shaft = B.MeshBuilder.CreatePlane(`l1_shaft_${segOffset}`, { width: 2.3, height: 4.8 }, this.scene);
        shaft.position.set(0, 2.5, 0);
        shaft.rotation.y = segOffset % 2 === 0 ? 0.28 : -0.28;
        shaft.material = this.shaftMat;
        shaft.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
        shaft.parent = segRoot;
      }

      // Left & Right corridor walls WITH wide panoramic observation porthole cutouts
      for (const side of [-1, 1]) {
        const xWall = side * 3.0;
        const lower = B.MeshBuilder.CreateBox(`l1_wl_lo_${segOffset}_${side}`, { width: 0.22, height: 0.88, depth: 6.0 }, this.scene);
        lower.position.set(xWall, 0.44, 0);
        lower.material = this.wallMat;
        lower.receiveShadows = true;
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

          // Brushed dark-titanium vertical structural mullion strip
          const mullion = B.MeshBuilder.CreateBox(`l1_mull_${segOffset}_${side}_${zSide}`, { width: 0.30, height: 2.86, depth: 0.12 }, this.scene);
          mullion.position.set(xWall, 2.26, zSide * 1.72);
          mullion.material = this.darkTiMat;
          mullion.parent = segRoot;
        }

        // Brushed aerospace window sill & top header trim
        const sill = B.MeshBuilder.CreateBox(`l1_sill_${segOffset}_${side}`, { width: 0.36, height: 0.10, depth: 3.54 }, this.scene);
        sill.position.set(xWall, 0.89, 0);
        sill.material = this.darkTiMat;
        sill.parent = segRoot;

        const header = B.MeshBuilder.CreateBox(`l1_head_${segOffset}_${side}`, { width: 0.34, height: 0.09, depth: 3.54 }, this.scene);
        header.position.set(xWall, 3.66, 0);
        header.material = this.darkTiMat;
        header.parent = segRoot;

        // Clean outer statue alcove enclosure behind porthole
        const bayBack = B.MeshBuilder.CreateBox(`l1_bay_bk_${segOffset}_${side}`, { width: 0.18, height: 4.6, depth: 5.2 }, this.scene);
        bayBack.position.set(side * 6.3, 2.3, 0);
        bayBack.material = this.wallMat;
        bayBack.parent = segRoot;

        const bayFloor = B.MeshBuilder.CreateBox(`l1_bay_fl_${segOffset}_${side}`, { width: 3.3, height: 0.2, depth: 5.2 }, this.scene);
        bayFloor.position.set(side * 4.65, -0.05, 0);
        bayFloor.material = this.base.deckMat;
        bayFloor.parent = segRoot;

        const bayCeil = B.MeshBuilder.CreateBox(`l1_bay_cl_${segOffset}_${side}`, { width: 3.3, height: 0.16, depth: 5.2 }, this.scene);
        bayCeil.position.set(side * 4.65, 4.6, 0);
        bayCeil.material = this.skylightMat;
        bayCeil.parent = segRoot;
      }

      // Sculpted Archway bulkhead frame at front seam (+3.0m) + backlit cell plaque overhead
      const archTop = B.MeshBuilder.CreateBox(`l1_arch_t_${segOffset}`, { width: 5.8, height: 0.72, depth: 0.32 }, this.scene);
      archTop.position.set(0, 4.62, 2.86);
      archTop.material = this.darkTiMat;
      archTop.parent = segRoot;
      if (segOffset >= 0 && segOffset <= 2) this.shadowCasters.push(archTop);

      for (const side of [-1, 1]) {
        const archCol = B.MeshBuilder.CreateBox(`l1_arch_c_${segOffset}_${side}`, { width: 0.24, height: 4.85, depth: 0.32 }, this.scene);
        archCol.position.set(side * 2.84, 2.42, 2.86);
        archCol.material = this.steelMat;
        archCol.parent = segRoot;
      }

      const plaque = B.MeshBuilder.CreatePlane(`l1_plaque_${segOffset}`, { width: 1.56, height: 0.56 }, this.scene);
      plaque.position.set(0, 4.58, 2.68);
      plaque.material = this.plaqueMats[0];
      plaque.parent = segRoot;
      if (segOffset >= 0 && segOffset <= 4) this.mirrorRenderList.push(plaque);

      // Luminous recessed floor guide rails + dark-steel baseboard channels
      for (const side of [-1, 1]) {
        const channel = B.MeshBuilder.CreateBox(`l1_chan_${segOffset}_${side}`, { width: 0.14, height: 0.018, depth: 5.96 }, this.scene);
        channel.position.set(side * 2.35, 0.01, 0);
        channel.material = this.darkTiMat;
        channel.parent = segRoot;

        const rail = B.MeshBuilder.CreateBox(`l1_rail_${segOffset}_${side}`, { width: 0.045, height: 0.022, depth: 5.94 }, this.scene);
        rail.position.set(side * 2.35, 0.022, 0);
        rail.material = this.cyanMat;
        rail.parent = segRoot;
        if (segOffset >= -1 && segOffset <= 4) this.mirrorRenderList.push(rail);
      }

      // Museum-grade Sculpted Left Copper-Bronze Statue & Right Ivory-White Statue outside portholes!
      const leftStatue = buildSculptedAstronautStatue(this.scene, `l1_stat_l_${segOffset}`, { variant: 'copper' });
      leftStatue.root.position.set(-4.65, 0.08, 0);
      leftStatue.root.parent = segRoot;

      const rightStatue = buildSculptedAstronautStatue(this.scene, `l1_stat_r_${segOffset}`, { variant: 'ivory' });
      rightStatue.root.position.set(4.65, 0.08, 0);
      rightStatue.root.parent = segRoot;

      if (segOffset >= 0 && segOffset <= 2) {
        this.mirrorRenderList.push(...leftStatue.root.getChildMeshes().slice(0, 6));
        this.mirrorRenderList.push(...rightStatue.root.getChildMeshes().slice(0, 6));
      }

      // W+ Origin Exclusive Landmarks (shown ONLY when this segment represents W+!)
      const wPlusGroup = new B.TransformNode(`l1_wplus_props_${segOffset}`, this.scene);
      wPlusGroup.parent = segRoot;

      // 1. Lin Xia's Crimson Red Ribbon tied to brushed stanchion + glowing floor strip
      const ribbonPost = B.MeshBuilder.CreateCylinder(`l1_rpost_${segOffset}`, { diameterTop: 0.06, diameterBottom: 0.09, height: 1.08, tessellation: 14 }, this.scene);
      ribbonPost.position.set(-2.35, 0.54, -0.35);
      ribbonPost.material = this.darkTiMat;
      ribbonPost.parent = wPlusGroup;

      const ribbonBand = B.MeshBuilder.CreateBox(`l1_rband_${segOffset}`, { width: 0.06, height: 0.14, depth: 0.58 }, this.scene);
      ribbonBand.position.set(-2.10, 0.90, -0.35);
      ribbonBand.rotation.z = -0.25;
      ribbonBand.material = this.redRibbonMat;
      ribbonBand.parent = wPlusGroup;

      const ribbonFloor = B.MeshBuilder.CreateBox(`l1_rfloor_${segOffset}`, { width: 4.5, height: 0.02, depth: 0.14 }, this.scene);
      ribbonFloor.position.set(0, 0.018, -0.35);
      ribbonFloor.material = this.redRibbonMat;
      ribbonFloor.parent = wPlusGroup;
      if (segOffset === 0 || segOffset === 4) this.mirrorRenderList.push(ribbonFloor, ribbonBand);

      // 2. Sculpted Lin Xia Audio Recorder Holo-Desk (left-front of W+)
      const recStand = B.MeshBuilder.CreateCylinder(`l1_rec_${segOffset}`, { diameterTop: 0.36, diameterBottom: 0.54, height: 0.96, tessellation: 20 }, this.scene);
      recStand.position.set(-1.65, 0.48, 1.4);
      recStand.material = this.darkTiMat;
      recStand.parent = wPlusGroup;
      if (segOffset === 0) this.shadowCasters.push(recStand);

      const recCollar = B.MeshBuilder.CreateTorus(`l1_rec_col_${segOffset}`, { diameter: 0.42, thickness: 0.04, tessellation: 24 }, this.scene);
      recCollar.position.set(-1.65, 0.96, 1.4);
      recCollar.material = this.steelMat;
      recCollar.parent = wPlusGroup;

      const recOrb = B.MeshBuilder.CreateTorus(`l1_rec_ring_${segOffset}`, { diameter: 0.38, thickness: 0.042, tessellation: 24 }, this.scene);
      recOrb.position.set(-1.65, 1.24, 1.4);
      recOrb.material = this.cyanMat;
      recOrb.parent = wPlusGroup;

      // 3. Sculpted Main Control Password Lock Console (right-front of W+)
      const lockBase = B.MeshBuilder.CreateCylinder(`l1_lock_${segOffset}`, { diameterTop: 0.56, diameterBottom: 0.72, height: 1.12, tessellation: 8 }, this.scene);
      lockBase.position.set(1.65, 0.56, 1.75);
      lockBase.rotation.y = -0.35;
      lockBase.material = this.darkTiMat;
      lockBase.parent = wPlusGroup;
      if (segOffset === 0) this.shadowCasters.push(lockBase);

      const lockTrim = B.MeshBuilder.CreateTorus(`l1_lock_trim_${segOffset}`, { diameter: 0.58, thickness: 0.045, tessellation: 24 }, this.scene);
      lockTrim.position.set(1.65, 1.12, 1.75);
      lockTrim.material = this.brassMat;
      lockTrim.parent = wPlusGroup;

      const lockDial = B.MeshBuilder.CreateTorus(`l1_lock_dial_${segOffset}`, { diameter: 0.46, thickness: 0.052, tessellation: 28 }, this.scene);
      lockDial.position.set(1.62, 1.42, 1.72);
      lockDial.rotation.x = Math.PI * 0.5;
      lockDial.rotation.y = -0.35;
      lockDial.material = this.goldMat;
      lockDial.parent = wPlusGroup;

      // 4. Three Sculpted Optional Hypothesis Hologram Stands at south of W+
      const hypCoords = [
        [-1.85, -1.3, 'ring'],
        [0.0, -2.05, 'belt'],
        [1.85, -1.3, 'sphere'],
      ];
      hypCoords.forEach(([hx, hz, kind]) => {
        const ped = B.MeshBuilder.CreateCylinder(`l1_hyp_${segOffset}_${kind}`, { diameterTop: 0.32, diameterBottom: 0.46, height: 0.88, tessellation: 16 }, this.scene);
        ped.position.set(hx, 0.44, hz);
        ped.material = this.darkTiMat;
        ped.parent = wPlusGroup;

        let iconMesh;
        if (kind === 'ring') {
          iconMesh = B.MeshBuilder.CreateTorus(`l1_hicon_${segOffset}_${kind}`, { diameter: 0.38, thickness: 0.042, tessellation: 22 }, this.scene);
        } else if (kind === 'belt') {
          iconMesh = B.MeshBuilder.CreateBox(`l1_hicon_${segOffset}_${kind}`, { width: 0.42, height: 0.08, depth: 0.24 }, this.scene);
        } else {
          iconMesh = B.MeshBuilder.CreateSphere(`l1_hicon_${segOffset}_${kind}`, { diameter: 0.34, segments: 14 }, this.scene);
          iconMesh.material = createGhostMaterial(this.scene, `l1_hgh_${segOffset}_${kind}`, PALETTE.accent.cyanW0, 0.34);
        }
        iconMesh.position.set(hx, 1.24, hz);
        if (!iconMesh.material) iconMesh.material = this.cyanMat;
        iconMesh.parent = wPlusGroup;
      });

      // 5. Physical Victory Ritual Portal (6-leaf mechanical iris + volumetric emerald portal column!)
      const portalGroup = new B.TransformNode(`l1_portal_grp_${segOffset}`, this.scene);
      portalGroup.position.set(0, 2.15, 2.74);
      portalGroup.parent = wPlusGroup;

      const unlockHaloOuter = B.MeshBuilder.CreateTorus(`l1_uhalo_o_${segOffset}`, { diameter: 3.5, thickness: 0.09, tessellation: 40 }, this.scene);
      unlockHaloOuter.rotation.x = Math.PI * 0.5;
      unlockHaloOuter.material = this.emeraldMat;
      unlockHaloOuter.parent = portalGroup;

      const unlockHaloInner = B.MeshBuilder.CreateTorus(`l1_uhalo_i_${segOffset}`, { diameter: 2.75, thickness: 0.055, tessellation: 36 }, this.scene);
      unlockHaloInner.rotation.x = Math.PI * 0.5;
      unlockHaloInner.material = this.cyanMat;
      unlockHaloInner.parent = portalGroup;

      const portalBeam = B.MeshBuilder.CreateCylinder(`l1_pbeam_${segOffset}`, { diameter: 2.4, height: 4.5, tessellation: 24, openEnded: true }, this.scene);
      portalBeam.position.set(0, 0.1, 0);
      portalBeam.material = this.portalShaftMat;
      portalBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      portalBeam.parent = portalGroup;

      portalGroup.setEnabled(false);

      this.segments.push({
        offset: segOffset,
        root: segRoot,
        plaque,
        leftStatue,
        rightStatue,
        wPlusGroup,
        lockDial,
        recOrb,
        portalGroup,
        unlockHaloOuter,
        unlockHaloInner,
        portalBeam,
      });
    }
  }

  _buildSelfSilhouettes() {
    this.selfAhead = buildAstronautSilhouette(this.scene, 'l1_self_ahead_24m');
    this.selfAhead.root.parent = this.root;

    this.selfBehind = buildAstronautSilhouette(this.scene, 'l1_self_behind_24m');
    this.selfBehind.root.parent = this.root;

    this.mirrorRenderList.push(...this.selfAhead.root.getChildMeshes());
    this.shadowCasters.push(...this.selfAhead.root.getChildMeshes().slice(0, 3));

    this.fpLeftArm = buildFirstPersonLeftArm(this.scene, this.camera);
  }

  _finalizeShadowsAndParticles() {
    const B = this.B;
    const sg = new B.ShadowGenerator(1024, this.base.keyLight);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = B.ShadowGenerator.QUALITY_LOW;
    sg.bias = 0.0014;
    sg.darkness = 0.42;
    for (const m of this.shadowCasters) {
      sg.addShadowCaster(m, false);
    }
    this.shadowGenerator = sg;

    this.particleSystem = createZoneAMotesParticleSystem(this.scene, 'l1_cleanroom_motes', {
      minBox: new B.Vector3(-2.6, 0.4, -4.0),
      maxBox: new B.Vector3(2.6, 4.4, 24.0),
      capacity: 180,
      emitRate: 26,
      tintHex: '#D8F8F4',
    });
  }

  getAnchorScreenPos(kind, camera = this.camera) {
    const B = this.B;
    if (kind === 'silhouette' && this.selfAhead) {
      const p = this.selfAhead.root.getAbsolutePosition().add(new B.Vector3(0, 1.95, 0));
      return projectWorldToScreen(this.scene, camera, p);
    }
    if (kind === 'leftStatue') {
      const seg0 = this.segments.find((s) => s.offset === 0);
      if (seg0) {
        const p = seg0.leftStatue.root.getAbsolutePosition().add(new B.Vector3(0.4, 2.2, 0));
        return projectWorldToScreen(this.scene, camera, p);
      }
    }
    return null;
  }

  syncFromState(state, input, dtSec) {
    this.time += dtSec;
    const roomIdx = state.getRoomIndex();
    const localZ = state.getLocalZInCell();

    const dzDelta = Math.abs(state.unwrappedZ - this.lastUnwrappedZ);
    this.lastUnwrappedZ = state.unwrappedZ;
    if (dzDelta > 0.0005) {
      this.stridePhase += dzDelta * 2.6;
    }

    const headBob = dzDelta > 0.001 ? Math.sin(this.stridePhase * 2) * 0.032 : 0;
    this.camera.position.set(state.playerX, state.playerY + headBob, localZ);
    this.camera.rotation.set(-input.pitch, input.yaw, 0);

    const targetFov = state.telescopeActive ? 0.30 : 0.92;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    if (state.completed) {
      this.portalOpenProgress = Math.min(1, this.portalOpenProgress + dtSec * 0.95);
    } else {
      this.portalOpenProgress = 0;
    }
    const easedPortal = 1 - Math.pow(1 - this.portalOpenProgress, 3);

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
        seg.lockDial.rotation.z = this.time * (state.completed ? 2.2 : 0.5);
        seg.lockDial.material = state.completed ? this.emeraldMat : this.goldMat;

        seg.portalGroup.setEnabled(state.completed);
        if (state.completed) {
          seg.portalGroup.scaling.setAll(Math.max(0.05, easedPortal));
          seg.unlockHaloOuter.rotation.y = this.time * 0.9;
          seg.unlockHaloInner.rotation.y = -this.time * 1.45;
          seg.unlockHaloInner.rotation.z = Math.sin(this.time * 1.2) * 0.22;
        }
      }
    }

    this.selfAhead.root.position.set(state.playerX, 0, localZ + 24.0);
    this.selfAhead.syncMotion(this.stridePhase, state.waveTimer);

    this.selfBehind.root.position.set(state.playerX, 0, localZ - 24.0);
    this.selfBehind.syncMotion(this.stridePhase, state.waveTimer);

    this.fpLeftArm.sync(state.waveTimer);
  }

  dispose() {
    this.particleSystem?.dispose();
    this.shadowGenerator?.dispose();
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

    // 4 clean perforated aerospace spandrel panels around each circular hatch
    const topBar = B.MeshBuilder.CreateBox(`${namePrefix}_t_${fd.axis}`, { width: 6.0, height: bandSpan, depth: wallThick }, scene);
    topBar.position.set(0, bandCenter, 0);
    topBar.material = sharedMats.wallMat;
    topBar.parent = faceNode;

    const botBar = B.MeshBuilder.CreateBox(`${namePrefix}_b_${fd.axis}`, { width: 6.0, height: bandSpan, depth: wallThick }, scene);
    botBar.position.set(0, -bandCenter, 0);
    botBar.material = sharedMats.wallMat;
    botBar.parent = faceNode;

    const leftBar = B.MeshBuilder.CreateBox(`${namePrefix}_l_${fd.axis}`, { width: bandSpan, height: openHalf * 2, depth: wallThick }, scene);
    leftBar.position.set(-bandCenter, 0, 0);
    leftBar.material = sharedMats.wallMat;
    leftBar.parent = faceNode;

    const rightBar = B.MeshBuilder.CreateBox(`${namePrefix}_r_${fd.axis}`, { width: bandSpan, height: openHalf * 2, depth: wallThick }, scene);
    rightBar.position.set(bandCenter, 0, 0);
    rightBar.material = sharedMats.wallMat;
    rightBar.parent = faceNode;

    // Outer recessed dark-titanium bulkhead housing bezel (adds crisp aerospace architectural depth!)
    const outerCollar = B.MeshBuilder.CreateTorus(`${namePrefix}_oc_${fd.axis}`, { diameter: 2.68, thickness: 0.14, tessellation: 36 }, scene);
    outerCollar.rotation.x = Math.PI * 0.5;
    outerCollar.position.set(0, 0, -0.04);
    outerCollar.material = sharedMats.darkTiMat;
    outerCollar.parent = faceNode;

    // Circular brushed-steel 2.4m airlock frame ring (offset cleanly inward -> zero Z-fighting!)
    const ringFrame = B.MeshBuilder.CreateTorus(`${namePrefix}_rf_${fd.axis}`, { diameter: 2.46, thickness: 0.14, tessellation: 36 }, scene);
    ringFrame.rotation.x = Math.PI * 0.5;
    ringFrame.position.set(0, 0, -0.08);
    ringFrame.material = sharedMats.steelMat;
    ringFrame.parent = faceNode;

    // Glowing inner accent ring around circular hatch
    const glowRing = B.MeshBuilder.CreateTorus(`${namePrefix}_rg_${fd.axis}`, { diameter: 2.34, thickness: 0.045, tessellation: 36 }, scene);
    glowRing.rotation.x = Math.PI * 0.5;
    glowRing.position.set(0, 0, -0.11);
    glowRing.material = sharedMats.defaultRingMat;
    glowRing.parent = faceNode;
    rings[fd.axis] = glowRing;

    // Center cell extras: Zero-G crew handrails flanking airlock + backlit PBR destination plaque
    if (!options.minimalNeighbor) {
      for (const s of [-1, 1]) {
        const rail = B.MeshBuilder.CreateCylinder(`${namePrefix}_gr_${fd.axis}_${s}`, { diameter: 0.045, height: 1.08, tessellation: 10 }, scene);
        rail.position.set(s * 1.62, 0, -0.16);
        rail.material = sharedMats.darkTiMat;
        rail.parent = faceNode;
      }

      const plaqueHousing = B.MeshBuilder.CreateBox(`${namePrefix}_plqh_${fd.axis}`, { width: 1.38, height: 0.54, depth: 0.05 }, scene);
      plaqueHousing.position.set(0, 1.64, -0.09);
      plaqueHousing.material = sharedMats.darkTiMat;
      plaqueHousing.parent = faceNode;

      const plaque = B.MeshBuilder.CreatePlane(`${namePrefix}_plq_${fd.axis}`, { width: 1.32, height: 0.48 }, scene);
      plaque.position.set(0, 1.64, -0.125);
      plaque.parent = faceNode;
      plaques[fd.axis] = plaque;
    } else if (sharedMats.farDepthMat) {
      const depthDisc = B.MeshBuilder.CreateDisc(`${namePrefix}_depth_${fd.axis}`, { radius: 1.24, tessellation: 28 }, scene);
      depthDisc.position.set(0, 0, 0.08);
      depthDisc.material = sharedMats.farDepthMat;
      depthDisc.parent = faceNode;
      plaques[fd.axis] = depthDisc;
    }
  }

  // Sculpted dark-titanium structural corner frame ribs along all 12 cube edges (inset cleanly by 4cm)
  const edgeLen = 5.76;
  const ePos = H - 0.14;
  const edgeMat = sharedMats.darkTiMat;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bz = B.MeshBuilder.CreateBox(`${namePrefix}_ez_${sx}_${sy}`, { width: 0.14, height: 0.14, depth: edgeLen }, scene);
      bz.position.set(sx * ePos, sy * ePos, 0);
      bz.material = edgeMat;
      bz.parent = root;
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const by = B.MeshBuilder.CreateBox(`${namePrefix}_ey_${sx}_${sz}`, { width: 0.14, height: edgeLen, depth: 0.14 }, scene);
      by.position.set(sx * ePos, 0, sz * ePos);
      by.material = edgeMat;
      by.parent = root;
    }
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bx = B.MeshBuilder.CreateBox(`${namePrefix}_ex_${sy}_${sz}`, { width: edgeLen, height: 0.14, depth: 0.14 }, scene);
      bx.position.set(0, sy * ePos, sz * ePos);
      bx.material = edgeMat;
      bx.parent = root;
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
  grad.addColorStop(0.0, '#141F2E');
  grad.addColorStop(0.38, '#364A63');
  grad.addColorStop(0.72, '#8093AA');
  grad.addColorStop(1.0, '#C0CBD8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (const [r, alpha] of [[94, 0.4], [64, 0.35], [38, 0.3], [18, 0.25]]) {
    ctx.strokeStyle = `rgba(216, 236, 250, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  tex.update();

  const mat = new B.PBRMaterial('rig_far_tunnel_mat', scene);
  mat.albedoTexture = tex;
  mat.emissiveTexture = tex;
  mat.emissiveColor = B.Color3.White().scale(0.9);
  mat.metallic = 0.2;
  mat.roughness = 0.5;
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
    this.base = initZoneASceneBase(scene, camera, { fogDensity: 0.010 });
    this.root = new this.B.TransformNode('tesseract_rig_root', scene);

    this.steelMat = this.base.brushedSteelMat;
    this.darkTiMat = this.base.darkTitaniumMat;
    this.brassMat = this.base.warmBrassMat;

    // Dynamic per-cell subtle atmospheric dome glow light
    this.cellMoodLight = new this.B.PointLight('rig_cell_mood_light', new this.B.Vector3(0, 0.8, 0), scene);
    this.cellMoodLight.intensity = 0.72;
    this.cellMoodLight.range = 14;

    this.farDepthMat = createFarTunnelMaterial(scene);
    this.defaultRingMat = makeEmissiveMat(scene, 'rig_default_ring', PALETTE.accent.cyanW0, 1.15);
    this.cellRingMats = {};
    this.cellPlaqueMats = {};
    for (const id of CELL_IDS) {
      this.cellRingMats[id] = makeEmissiveMat(scene, `rig_ring_${id}`, CELL_COLORS[id], 1.2);
      const sub = id === 'W-' && options.markWMinusTarget ? '林夏定位信号' : '相邻三维胞';
      const tex = createCellPlaqueTexture(scene, `rig_plq_${id}`, id, sub, CELL_COLORS[id]);
      const pm = new this.B.PBRMaterial(`rig_plq_mat_${id}`, scene);
      pm.albedoTexture = tex;
      pm.emissiveTexture = tex;
      pm.emissiveColor = this.B.Color3.White().scale(0.98);
      pm.metallic = 0.15;
      pm.roughness = 0.22;
      this.cellPlaqueMats[id] = pm;
    }

    const sharedMats = {
      wallMat: this.base.wallMat,
      deckMat: this.base.deckMat,
      steelMat: this.steelMat,
      darkTiMat: this.darkTiMat,
      defaultRingMat: this.defaultRingMat,
      farDepthMat: this.farDepthMat,
    };

    // Center active cell (full detail + plaques + zero-G grab-rails)
    this.centerCell = buildSixAirlockCellMesh(scene, 'center_cell', sharedMats, { minimalNeighbor: false });
    this.centerCell.root.parent = this.root;

    // 6 seamless adjacent neighbor shells (visible right through the 6 circular airlocks!)
    this.neighborShells = [];
    for (let i = 0; i < 6; i += 1) {
      const shell = buildSixAirlockCellMesh(scene, `nbr_cell_${i}`, sharedMats, { minimalNeighbor: true });
      shell.root.parent = this.root;
      this.neighborShells.push(shell);
    }

    // Per-cell prop containers + architectural corner identity cove strips
    this.cellPropRoots = {};
    for (const id of CELL_IDS) {
      const node = new this.B.TransformNode(`cell_props_${id}`, scene);
      node.parent = this.root;
      node.setEnabled(false);
      this.cellPropRoots[id] = node;

      const stripMat = makeEmissiveMat(scene, `cell_id_strip_${id}`, CELL_COLORS[id], 1.05);
      const cOff = CELL_HALF_SIZE - 0.24;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const rail = this.B.MeshBuilder.CreateBox(
            `cell_id_rail_${id}_${sx}_${sz}`,
            { width: 0.042, height: 3.6, depth: 0.042 },
            scene
          );
          rail.position.set(sx * cOff, 0, sz * cOff);
          rail.material = stripMat;
          rail.parent = node;
        }
      }
    }

    // Zero-G luminous floating micro-dust motes across the chamber
    this.particleSystem = createZoneAMotesParticleSystem(scene, 'rig_zerog_motes', {
      minBox: new this.B.Vector3(-2.6, -2.5, -2.6),
      maxBox: new this.B.Vector3(2.6, 2.5, 2.6),
      capacity: 150,
      emitRate: 22,
      tintHex: '#CCF4F0',
    });

    this.lastRenderedCell = null;
  }

  syncRigForCell(currentCellId, customDoorwayStyleFn = null) {
    const B = this.B;
    const doorways = getCellDoorways(currentCellId);

    this.cellMoodLight.diffuse = B.Color3.Lerp(
      B.Color3.White(),
      B.Color3.FromHexString(CELL_COLORS[currentCellId] || PALETTE.accent.cyanW0),
      0.35
    );

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

    for (const id of CELL_IDS) {
      this.cellPropRoots[id].setEnabled(false);
    }

    const centerProps = this.cellPropRoots[currentCellId];
    centerProps.setEnabled(true);
    centerProps.position.set(0, 0, 0);
    centerProps.rotationQuaternion = B.Quaternion.Identity();

    const neighbors = getNeighbors(currentCellId);
    neighbors.forEach((nId, idx) => {
      const tf = computeNeighborTransformInCell(currentCellId, nId);
      const shell = this.neighborShells[idx];
      shell.root.position.copyFrom(tf.position);
      shell.root.rotationQuaternion = tf.rotationQuaternion.clone();

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
    this.particleSystem?.dispose();
    this.root.dispose();
    this.base.pipeline?.dispose();
  }
}

// ---------------------------------------------------------------------------
// 2. Level 2 Scene: 没有门通向对面 (Sculpted 8-Color Tesseract + W- Locator)
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
    // Lowered cleanly to y = -0.88 so the forward X+ circular airlock & plaque stay crystal clear!
    this.holoAnchor = new B.TransformNode('l2_holo_anchor', this.scene);
    this.holoAnchor.position.set(0, -0.88, 0.22);
    this.holoAnchor.parent = parent;

    // Sleek floating brushed-titanium & brass holographic projector ring beneath cross-net
    const emitBase = B.MeshBuilder.CreateTorus('l2_holo_emit_base', { diameter: 1.52, thickness: 0.055, tessellation: 36 }, this.scene);
    emitBase.position.set(0, -0.46, 0);
    emitBase.material = this.rig.darkTiMat;
    emitBase.parent = this.holoAnchor;

    const emitBrass = B.MeshBuilder.CreateTorus('l2_holo_emit_brass', { diameter: 1.38, thickness: 0.028, tessellation: 36 }, this.scene);
    emitBrass.position.set(0, -0.44, 0);
    emitBrass.material = this.rig.brassMat;
    emitBrass.parent = this.holoAnchor;

    this.holoRoot = new B.TransformNode('l2_tesseract_holo', this.scene);
    this.holoRoot.parent = this.holoAnchor;

    // 8-color 3D unfolded cross-net of translucent crystal cubes
    const cubeSize = 0.29;
    const spacing = 0.36;
    const nodePositions = {};
    for (const id of CELL_IDS) {
      const [nx, ny, nz] = UNFOLDED_NET_POS[id];
      const pos = new B.Vector3(nx * spacing, (ny + 0.35) * spacing, nz * spacing);
      nodePositions[id] = pos;

      const cube = B.MeshBuilder.CreateBox(`l2_holo_cube_${id}`, { size: cubeSize }, this.scene);
      cube.position.copyFrom(pos);
      cube.material = createGhostMaterial(this.scene, `l2_holo_mat_${id}`, CELL_COLORS[id], 0.34);
      cube.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
      cube.parent = this.holoRoot;

      const coreNode = B.MeshBuilder.CreatePolyhedron(`l2_holo_core_${id}`, { type: 1, size: 0.06 }, this.scene);
      coreNode.position.copyFrom(pos);
      coreNode.material = makeEmissiveMat(this.scene, `l2_holo_core_m_${id}`, CELL_COLORS[id], 1.3);
      coreNode.parent = this.holoRoot;

      const frame = B.MeshBuilder.CreateBox(`l2_holo_edge_${id}`, { size: cubeSize + 0.01 }, this.scene);
      frame.position.copyFrom(pos);
      frame.material = makeEmissiveMat(this.scene, `l2_holo_em_${id}`, CELL_COLORS[id], 0.9);
      frame.material.wireframe = true;
      frame.parent = this.holoRoot;
    }

    // All 24 face-adjacency filaments (ignite radiantly upon solving "6 paths"!)
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
    this.edgeWebLines.alpha = 0.25;
    this.edgeWebLines.parent = this.holoRoot;

    // Victory celebration quantum portal halo in front of W+
    this.victoryPortalRing = B.MeshBuilder.CreateTorus('l2_vic_ring', { diameter: 2.15, thickness: 0.07, tessellation: 40 }, this.scene);
    this.victoryPortalRing.rotation.x = Math.PI * 0.5;
    this.victoryPortalRing.position.set(0, 0, 2.72);
    this.victoryPortalRing.material = makeEmissiveMat(this.scene, 'l2_vic_ring_m', PALETTE.accent.emerald, 1.5);
    this.victoryPortalRing.isVisible = false;
    this.victoryPortalRing.parent = parent;
  }

  _buildWMinusLocator() {
    const B = this.B;
    const parent = this.rig.cellPropRoots['W-'];
    this.locatorRoot = new B.TransformNode('l2_locator_root', this.scene);
    this.locatorRoot.position.set(0, -0.18, 0);
    this.locatorRoot.parent = parent;

    const core = B.MeshBuilder.CreatePolyhedron('l2_locator_core', { type: 1, size: 0.23 }, this.scene);
    core.material = makeEmissiveMat(this.scene, 'l2_loc_core_mat', PALETTE.accent.goldWPos, 1.45);
    core.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    core.parent = this.locatorRoot;

    this.locRingA = B.MeshBuilder.CreateTorus('l2_loc_ring_a', { diameter: 0.68, thickness: 0.036, tessellation: 32 }, this.scene);
    this.locRingA.material = this.rig.brassMat;
    this.locRingA.parent = this.locatorRoot;

    this.locRingB = B.MeshBuilder.CreateTorus('l2_loc_ring_b', { diameter: 0.90, thickness: 0.030, tessellation: 32 }, this.scene);
    this.locRingB.material = makeEmissiveMat(this.scene, 'l2_loc_rb', PALETTE.accent.cyanW0, 1.35);
    this.locRingB.parent = this.locatorRoot;

    // Volumetric locator signal beam spanning vertical axis inside W-
    const beamMat = createVolumetricShaftMaterial(this.scene, 'l2_loc_beam_m', '#C4B5FD', 0.26);
    const beam = B.MeshBuilder.CreateCylinder('l2_loc_beam', { diameter: 0.65, height: 5.2, tessellation: 20, openEnded: true }, this.scene);
    beam.material = beamMat;
    beam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    beam.parent = this.locatorRoot;

    const wMinusLight = new B.PointLight('l2_wminus_light', new B.Vector3(0, 0, 0), this.scene);
    wMinusLight.diffuse = B.Color3.FromHexString('#D8C8FF');
    wMinusLight.intensity = 1.2;
    wMinusLight.range = 9;
    wMinusLight.parent = parent;
  }

  getAnchorScreenPos(kind, camera = this.camera) {
    if (kind === 'locator' && this.locatorRoot && this.locatorRoot.isEnabled()) {
      return projectWorldToScreen(this.scene, camera, this.locatorRoot.getAbsolutePosition());
    }
    if (kind === 'wMinusDoor') {
      const dw = getCellDoorways(this.rig.lastRenderedCell || 'W+').find((d) => d.targetCell === 'W-');
      if (dw && this.rig.centerCell.plaques[dw.localAxis]) {
        return projectWorldToScreen(this.scene, camera, this.rig.centerCell.plaques[dw.localAxis].getAbsolutePosition());
      }
    }
    return null;
  }

  syncFromState(state, dtSec) {
    this.time += dtSec;
    this.rig.syncRigForCell(state.cellId);
    applyIntrinsicFrameToCamera(this.camera, state.nav.getLocalPos3(), state.nav.getLocalFrame3());

    const targetFov = state.telescopeActive ? 0.32 : 0.94;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

    this.holoRoot.rotation.y = this.time * (state.completed ? 1.1 : 0.45);
    if (this.edgeWebLines) {
      this.edgeWebLines.alpha = state.completed ? 0.98 : 0.25;
      this.edgeWebLines.color = this.B.Color3.FromHexString(
        state.completed ? PALETTE.accent.emerald : PALETTE.accent.cyanW0
      );
    }
    if (this.victoryPortalRing) {
      this.victoryPortalRing.isVisible = state.completed;
      if (state.completed) {
        this.victoryPortalRing.rotation.y = this.time * 1.4;
      }
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
// 3. Level 3 Scene: 哪边是上 (Golden Shared Edge + Engraved 360° 3D Gyroscope)
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
    const goldEdgeMat = makeEmissiveMat(this.scene, 'l3_gold_edge_mat', PALETTE.accent.goldWPos, 1.45);
    const arrowTex = createFluorescentArrowTexture(this.scene, 'l3_arrow_tex', '↑ 上', PALETTE.accent.cyanW0);
    const arrowMat = new B.StandardMaterial('l3_arrow_mat', this.scene);
    arrowMat.diffuseTexture = arrowTex;
    arrowMat.emissiveTexture = arrowTex;
    arrowMat.opacityTexture = arrowTex;
    arrowMat.disableLighting = true;
    arrowMat.backFaceCulling = false;
    arrowMat.disableDepthWrite = true;
    arrowMat.needDepthPrePass = false;

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
      const ex = (d1[0] + d2[0]) * (CELL_HALF_SIZE - 0.18);
      const ey = (d1[1] + d2[1]) * (CELL_HALF_SIZE - 0.18);
      const ez = (d1[2] + d2[2]) * (CELL_HALF_SIZE - 0.18);

      const beam = B.MeshBuilder.CreateCylinder(
        `l3_gold_edge_${cfg.id}`,
        { diameter: 0.22, height: 5.56, tessellation: 18 },
        this.scene
      );
      beam.rotation.z = Math.PI * 0.5;
      beam.position.set(ex, ey, ez);
      beam.material = goldEdgeMat;
      beam.parent = parent;
      this.goldenEdges.push(beam);

      // Machined dark-titanium end-clamps & node collars framing the luminous golden edge
      for (const sx of [-2.4, 0, 2.4]) {
        const collar = B.MeshBuilder.CreateTorus(`l3_gcol_${cfg.id}_${sx}`, { diameter: 0.34, thickness: 0.055, tessellation: 18 }, this.scene);
        collar.rotation.z = Math.PI * 0.5;
        collar.position.set(sx, ey, ez);
        collar.material = this.rig.darkTiMat;
        collar.parent = parent;
      }

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

      const nextDir = tangent4ToCellLocal3(cfg.id, CELL_NORMALS[cfg.nextDoor]);
      const guideRing = B.MeshBuilder.CreateTorus(`l3_guide_${cfg.id}`, { diameter: 2.15, thickness: 0.08, tessellation: 32 }, this.scene);
      guideRing.position.set(nextDir[0] * 2.74, nextDir[1] * 2.74, nextDir[2] * 2.74);
      if (Math.abs(nextDir[0]) > 0.5) guideRing.rotation.z = Math.PI * 0.5;
      else if (Math.abs(nextDir[2]) > 0.5) guideRing.rotation.x = Math.PI * 0.5;
      guideRing.material = makeEmissiveMat(this.scene, `l3_guide_mat_${cfg.id}`, PALETTE.accent.goldWPos, 1.35);
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

    const ped = B.MeshBuilder.CreateCylinder('l3_lock_ped', { diameterTop: 0.65, diameterBottom: 0.88, height: 0.82, tessellation: 24 }, this.scene);
    ped.position.y = -0.35;
    ped.material = this.rig.darkTiMat;
    ped.parent = this.lockRoot;

    const pedTrim = B.MeshBuilder.CreateTorus('l3_lock_ptrim', { diameter: 0.72, thickness: 0.05, tessellation: 24 }, this.scene);
    pedTrim.position.y = 0.04;
    pedTrim.material = this.rig.brassMat;
    pedTrim.parent = this.lockRoot;

    this.lockSlotMat = makeEmissiveMat(this.scene, 'l3_lock_slot_mat', PALETTE.accent.goldWPos, 1.25);
    this.lockEmeraldMat = makeEmissiveMat(this.scene, 'l3_lock_em_mat', PALETTE.accent.emerald, 1.5);

    const targetShaft = B.MeshBuilder.CreateCylinder('l3_tgt_shaft', { diameter: 0.075, height: 0.72, tessellation: 12 }, this.scene);
    targetShaft.position.y = 0.42;
    targetShaft.material = this.lockSlotMat;
    targetShaft.parent = this.lockRoot;

    const targetCone = B.MeshBuilder.CreateCylinder('l3_tgt_cone', { diameterTop: 0, diameterBottom: 0.24, height: 0.26, tessellation: 12 }, this.scene);
    targetCone.position.y = 0.88;
    targetCone.material = this.lockSlotMat;
    targetCone.parent = this.lockRoot;

    this.lockHalo = B.MeshBuilder.CreateTorus('l3_lock_halo', { diameter: 0.94, thickness: 0.048, tessellation: 32 }, this.scene);
    this.lockHalo.position.y = 0.35;
    this.lockHalo.material = this.lockSlotMat;
    this.lockHalo.parent = this.lockRoot;

    // Victory ritual: rising volumetric holonomy energy beam linking pedestal up toward ceiling golden edge!
    const vBeamMat = createVolumetricShaftMaterial(this.scene, 'l3_vic_beam_m', PALETTE.accent.emerald, 0.38);
    this.victoryBeam = B.MeshBuilder.CreateCylinder('l3_vic_beam', { diameter: 0.85, height: 5.2, tessellation: 24, openEnded: true }, this.scene);
    this.victoryBeam.position.set(0, 2.5, 0);
    this.victoryBeam.material = vBeamMat;
    this.victoryBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.victoryBeam.isVisible = false;
    this.victoryBeam.parent = this.lockRoot;
  }

  _buildHandheldGyroscope() {
    const B = this.B;
    this.gyroAnchor = new B.TransformNode('l3_gyro_anchor', this.scene);
    this.gyroAnchor.parent = this.camera;
    this.gyroAnchor.position.set(0.22, -0.23, 0.88);

    const brassMat = this.rig.brassMat;
    const tiMat = this.rig.darkTiMat;

    // Engraved 360° degree-tick sapphire instrument faceplate!
    const dialTex = createGyroDialTexture(this.scene, 'l3_gyro_dial_face_tex');
    const dialMat = new B.StandardMaterial('l3_gyro_dial_face_mat', this.scene);
    dialMat.diffuseTexture = dialTex;
    dialMat.emissiveTexture = dialTex;
    dialMat.opacityTexture = dialTex;
    dialMat.disableLighting = true;
    dialMat.backFaceCulling = false;
    dialMat.disableDepthWrite = true;
    dialMat.needDepthPrePass = false;

    const dialFace = B.MeshBuilder.CreateDisc('l3_gyro_dial_back', { radius: 0.135, tessellation: 36 }, this.scene);
    dialFace.position.set(0, 0, 0.036);
    dialFace.rotation.y = 0; // Front normal faces -Z straight toward player, un-mirrored!
    dialFace.material = dialMat;
    dialFace.parent = this.gyroAnchor;

    const outerBezel = B.MeshBuilder.CreateTorus('l3_gyro_bezel', { diameter: 0.295, thickness: 0.016, tessellation: 36 }, this.scene);
    outerBezel.rotation.x = Math.PI * 0.5;
    outerBezel.material = tiMat;
    outerBezel.parent = this.gyroAnchor;

    const outerRing = B.MeshBuilder.CreateTorus('l3_gyro_outer', { diameter: 0.275, thickness: 0.012, tessellation: 36 }, this.scene);
    outerRing.rotation.x = Math.PI * 0.5;
    outerRing.material = brassMat;
    outerRing.parent = this.gyroAnchor;

    const innerRing = B.MeshBuilder.CreateTorus('l3_gyro_inner', { diameter: 0.21, thickness: 0.01, tessellation: 28 }, this.scene);
    innerRing.material = brassMat;
    innerRing.parent = this.gyroAnchor;

    const hub = B.MeshBuilder.CreateSphere('l3_gyro_hub', { diameter: 0.036, segments: 14 }, this.scene);
    hub.material = brassMat;
    hub.parent = this.gyroAnchor;

    this.gyroNeedlePivot = new B.TransformNode('l3_gyro_needle_pivot', this.scene);
    this.gyroNeedlePivot.parent = this.gyroAnchor;

    this.needleMat = makeEmissiveMat(this.scene, 'l3_needle_mat', PALETTE.accent.cyanW0, 1.5);
    this.needleAlignedMat = makeEmissiveMat(this.scene, 'l3_needle_ok_mat', PALETTE.accent.emerald, 1.6);

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

    this.targetNeedlePivot = new B.TransformNode('l3_gyro_target_pivot', this.scene);
    this.targetNeedlePivot.parent = this.gyroAnchor;
    const tMat = makeEmissiveMat(this.scene, 'l3_tneedle_mat', PALETTE.accent.goldWPos, 1.2);
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

  getAnchorScreenPos(kind, camera = this.camera) {
    if (kind === 'goldEdge' && this.goldenEdges[0]) {
      return projectWorldToScreen(this.scene, camera, this.goldenEdges[0].getAbsolutePosition());
    }
    if (kind === 'gyro' && this.gyroAnchor) {
      return projectWorldToScreen(this.scene, camera, this.gyroAnchor.getAbsolutePosition());
    }
    return null;
  }

  syncFromState(state, dtSec) {
    this.time += dtSec;
    this.rig.syncRigForCell(state.cellId);
    applyIntrinsicFrameToCamera(this.camera, state.nav.getLocalPos3(), state.nav.getLocalFrame3());

    const targetFov = state.telescopeActive ? 0.32 : 0.94;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dtSec * 12);

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

    this.targetNeedlePivot.setEnabled(state.cellId === 'W+');
    if (state.cellId === 'W+') {
      const targetLocal = [0, 1, 0];
      this._orientYNodeToCameraSpaceDir(this.targetNeedlePivot, [
        dot3(targetLocal, f.right),
        dot3(targetLocal, f.up),
        dot3(targetLocal, f.forward),
      ]);
    }

    const pulse = 0.85 + 0.25 * Math.sin(this.time * 3.4);
    for (const g of this.fallbackGuides) {
      g.isVisible = state.holonomyFallback || state.beat < 2;
      g.scaling.setAll(state.holonomyFallback ? pulse : 0.96);
    }

    this.lockHalo.rotation.y = this.time * (aligned || state.completed ? 2.4 : 0.6);
    this.lockHalo.material = aligned || state.completed ? this.lockEmeraldMat : this.lockSlotMat;
    if (this.victoryBeam) {
      this.victoryBeam.isVisible = state.completed;
    }
  }

  dispose() {
    this.gyroAnchor.dispose();
    this.rig.dispose();
  }
}

// ---------------------------------------------------------------------------
// 4. Level 4 Scene: 一笔走完 (8 Star-Ring Chandeliers + Gleaming Mercury Rift)
// ---------------------------------------------------------------------------

export class Level4HamiltonianScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.rig = new SeamlessTesseractChamberRig(scene, camera);
    this.time = 0;

    this.beaconMats = {
      dormant: makeEmissiveMat(scene, 'l4_b_off', '#6E95B8', 0.8),
      lit: makeEmissiveMat(scene, 'l4_b_on', PALETTE.accent.goldWPos, 1.45),
      complete: makeEmissiveMat(scene, 'l4_b_win', PALETTE.accent.platinum, 1.6),
    };
    this.statusRingMats = {
      unvisited: makeEmissiveMat(scene, 'l4_ring_unv', PALETTE.accent.cyanW0, 1.25),
      visited: makeEmissiveMat(scene, 'l4_ring_vis', PALETTE.accent.amberCoral, 1.15),
      finish: makeEmissiveMat(scene, 'l4_ring_fin', PALETTE.accent.emerald, 1.55),
      awakened: makeEmissiveMat(scene, 'l4_ring_awk', PALETTE.accent.platinum, 1.4),
    };

    this.statusPlaques = {};
    for (const id of CELL_IDS) {
      const makeP = (key, title, sub, hex) => {
        const tex = createCellPlaqueTexture(scene, `l4_p_${id}_${key}`, title, sub, hex);
        const m = new this.B.PBRMaterial(`l4_pm_${id}_${key}`, scene);
        m.albedoTexture = tex;
        m.emissiveTexture = tex;
        m.emissiveColor = this.B.Color3.White().scale(0.98);
        m.metallic = 0.15;
        m.roughness = 0.22;
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
      // Sculpted twin-tier aerospace dome star-ring chandelier
      const frame = B.MeshBuilder.CreateTorus(
        `l4_bframe_${id}`,
        { diameter: 3.48, thickness: 0.08, tessellation: 36 },
        this.scene
      );
      frame.position.set(0, 2.58, 0);
      frame.material = this.rig.darkTiMat;
      frame.parent = parent;

      const ring = B.MeshBuilder.CreateTorus(
        `l4_beacon_${id}`,
        { diameter: 3.32, thickness: 0.13, tessellation: 36 },
        this.scene
      );
      ring.position.set(0, 2.52, 0);
      ring.material = this.beaconMats.dormant;
      ring.parent = parent;

      const nodes = [];
      for (let k = 0; k < 4; k += 1) {
        const ang = (k * Math.PI) / 2 + Math.PI / 4;
        const d = B.MeshBuilder.CreatePolyhedron(`l4_bnode_${id}_${k}`, { type: 1, size: 0.16 }, this.scene);
        d.position.set(Math.cos(ang) * 1.66, 2.52, Math.sin(ang) * 1.66);
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
    this.riftRoot.position.set(0, -0.62, 0);
    this.riftRoot.parent = parent;

    // Gleaming high-contrast liquid-mercury mirror sphere with animated micro-ripples!
    this.mercuryMat = createMercuryRiftPBR(this.scene, 'l4_mercury_mat');
    this.riftSphere = B.MeshBuilder.CreateSphere('l4_rift_sphere', { diameter: 1.56, segments: 48 }, this.scene);
    this.riftSphere.material = this.mercuryMat;
    this.riftSphere.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.riftSphere.parent = this.riftRoot;

    // Subtle luminous cyan-platinum plasma rim aura hugging the liquid-mercury sphere
    this.riftAuraMat = createGhostMaterial(this.scene, 'l4_rift_aura', PALETTE.accent.cyanW0, 0.30);
    this.riftAura = B.MeshBuilder.CreateSphere('l4_rift_aura_s', { diameter: 1.66, segments: 32 }, this.scene);
    this.riftAura.material = this.riftAuraMat;
    this.riftAura.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.riftAura.parent = this.riftRoot;

    // Dedicated glowing light right beside the sphere so its chrome/ripple reflections gleam!
    this.riftLight = new B.PointLight('l4_rift_pt_light', new B.Vector3(0, 0.9, -0.9), this.scene);
    this.riftLight.diffuse = B.Color3.FromHexString('#9AF4EC');
    this.riftLight.intensity = 1.45;
    this.riftLight.range = 8.5;
    this.riftLight.parent = this.riftRoot;

    // Triple luxury metallic-titanium + luminous cyan/gold PBR gimbal containment rings (NO dull flat grey hoops!)
    this.riftRings = [];
    this.riftDormantRingMat = new B.PBRMaterial('l4_rift_ring_pbr', this.scene);
    this.riftDormantRingMat.albedoColor = B.Color3.FromHexString('#C2D4E6');
    this.riftDormantRingMat.metallic = 0.92;
    this.riftDormantRingMat.roughness = 0.14;
    this.riftDormantRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(0.32);

    this.riftAwakeRingMat = makeEmissiveMat(this.scene, 'l4_rift_ring_awake', PALETTE.accent.cyanW0, 1.55);

    [1.78, 1.94, 2.10].forEach((diam, idx) => {
      const r = B.MeshBuilder.CreateTorus(`l4_rring_${idx}`, { diameter: diam, thickness: 0.036, tessellation: 48 }, this.scene);
      r.material = idx === 1 ? this.rig.brassMat : this.riftDormantRingMat;
      r.parent = this.riftRoot;
      this.riftRings.push(r);
    });
  }

  getAnchorScreenPos(kind, camera = this.camera) {
    if (kind === 'riftSphere' && this.riftRoot) {
      return projectWorldToScreen(this.scene, camera, this.riftRoot.getAbsolutePosition());
    }
    return null;
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

    const awake = state.riftSphereAwakened;
    const targetY = awake ? 0.05 : -0.62;
    this.riftRoot.position.y += (targetY - this.riftRoot.position.y) * Math.min(1, dtSec * 4.5);

    // Subtle standing-wave liquid-mercury UV drift
    if (this.mercuryMat.bumpTexture) {
      this.mercuryMat.bumpTexture.uOffset = this.time * (awake ? 0.24 : 0.07);
      this.mercuryMat.bumpTexture.vOffset = this.time * (awake ? 0.16 : 0.05);
    }

    const speed = awake ? 1.9 : 0.32;
    this.riftRings[0].rotation.set(0.55 + this.time * speed, this.time * speed * 0.7, 0.2);
    this.riftRings[1].rotation.set(-0.45 - this.time * speed * 0.8, 0.3, 0.75 + this.time * speed);
    this.riftRings[2].rotation.set(1.05, 0.2 + this.time * speed * 1.1, -0.35 - this.time * speed * 0.6);

    const baseScale = awake ? 1.24 : 1.0;
    const pulse = awake ? baseScale + Math.sin(this.time * 4.2) * 0.045 : 1.0;
    this.riftSphere.scaling.setAll(pulse);
    this.riftAura.scaling.setAll(pulse * (awake ? 1.09 : 1.03));
    this.riftAura.setEnabled(awake || state.litBeaconCount >= 5);

    this.mercuryMat.emissiveColor = awake
      ? this.B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(0.45)
      : new this.B.Color3(0.05, 0.14, 0.20);
    this.riftLight.intensity = awake ? 2.8 : 1.45;

    this.riftRings.forEach((r, idx) => {
      r.material = awake ? this.riftAwakeRingMat : idx === 1 ? this.rig.brassMat : this.riftDormantRingMat;
    });
  }

  dispose() {
    this.rig.dispose();
  }
}
