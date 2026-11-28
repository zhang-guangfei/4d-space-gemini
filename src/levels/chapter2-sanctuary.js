/**
 * Beyond 3D — Chapter 2 Sanctuary (Act III) AAA 3D Landmark Builder
 * Phase 1 Vertical Slice: Level 14 "发丝裂缝" (Hairline Slit)
 *
 * AAA Visual Architecture (strictly honoring 04-visual-and-art-direction.md C-Zone palette):
 * - Procedural 6-face Cathedral IBL CubeTexture + PBRMaterial (Sobel normal maps, ORM metallic/roughness, clearcoat)
 * - Real-time MirrorTexture polished black-obsidian cathedral floor reflecting monoliths, slit & orb
 * - Real-time PCF soft shadows from clerestory key light
 * - Babylon DefaultRenderingPipeline (ACES Filmic, Calibrated Bloom, MSAA/FXAA, Sharpen, Subtle Grain)
 * - Monumental canted obsidian rib-arches, colossal kinetic bronze vault astrolabe, volumetric sun shafts,
 *   precision-machined platinum hairline slit jaws, stepped alabaster marble pedestals & GPU-style luminous motes
 * - Strictly preserves Option A (eps=0.001m pure W=0 slice default, Tab reveals XZW + 4D envelope)
 *   and Ghost Material Invariants (alpha 0.30..0.35, disableDepthWrite=true, needDepthPrePass=false)
 */

import { LEVEL14_CONFIG } from '../core/sanctuary-4d.js';
import {
  createAntiqueBronzePBR,
  createCarvedObsidianMonolithPBR,
  createPassingOrbCrystalPBR,
  createPassingOrbSlicePBR,
  createSanctuaryEnvironmentTexture,
  createSanctuaryMarblePBR,
  createSanctuaryMirrorFloorPBR,
  createSoftGlowParticleTexture,
  createVolumetricShaftMaterial,
  setupAAAPostProcessing,
} from '../engine/aaa-materials.js';
import {
  PALETTE,
  RENDER_GROUPS,
  applyPhaseToMaterial,
  configureRenderingGroups,
  createGhostMaterial,
  createSolidMaterial,
} from '../engine/phase-materials.js';

export class Level14SanctuaryScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.root = new this.B.TransformNode('level14_root', scene);
    this.mirrorRenderList = [];
    this.shadowCasters = [];
    this.vaultAstrolabeRings = [];
    this.elapsed = 0;
    this.barrierFlash = 0;
    this.sliceConfirmPulse = 0;
    this.contactHighlight = 0;
    this.openingPulseTimer = 4.2;
    this.hintHighlight = false;
    this.gateOpenProgress = 0;
    this.monolithOpenProgress = 0;

    configureRenderingGroups(scene);
    this._setupAtmosphereAndLighting();
    this._initSharedPBRMaterials();
    this._buildSanctuaryArchitecture();
    this._buildKineticVaultAstrolabe();
    this._buildLayerReferenceArches();
    this._buildHairlineMonoliths();
    this._buildPedestalsAndGate();
    this._buildTeleportationPad();
    this._buildPassingOrb();
    this._buildAstronaut08();
    this._buildVolumetricLightShafts();
    this._buildSanctuaryParticles();
    this._finalizeMirrorAndShadows();
  }

  _setupAtmosphereAndLighting() {
    const B = this.B;
    const s = this.scene;

    s.clearColor = B.Color4.FromHexString('#0D0A07FF');
    s.fogMode = B.Scene.FOGMODE_EXP2;
    s.fogColor = B.Color3.FromHexString('#110E0A');
    s.fogDensity = 0.0068; // Calibrated for 44m-long 2x grand cathedral clarity

    // 1. Procedural Cathedral IBL Environment Map (instant metallic/clearcoat speculars!)
    createSanctuaryEnvironmentTexture(s);

    // 2. AAA DefaultRenderingPipeline (ACES + Bloom + MSAA/FXAA + Sharpen + Subtle Grain)
    if (this.camera) {
      this.pipeline = setupAAAPostProcessing(s, this.camera);
    }

    // 3. Sculpted Cathedral Lighting Rig (scaled for 34m x 44m x 22m grand sanctuary)
    const hemi = new B.HemisphericLight('sanctuary_hemi', new B.Vector3(0, 1, -0.2), s);
    hemi.intensity = 0.48;
    hemi.diffuse = B.Color3.FromHexString('#F0E5CF');
    hemi.groundColor = B.Color3.FromHexString('#18130C');

    // Key Clerestory Sunlight (casts soft PCF shadows across the 2x nave!)
    this.keyLight = new B.DirectionalLight('sanctuary_key_dir', new B.Vector3(-0.26, -0.92, 0.28), s);
    this.keyLight.position = new B.Vector3(9.5, 24.0, -9.5);
    this.keyLight.intensity = 1.75;
    this.keyLight.diffuse = B.Color3.FromHexString('#FFE8BA');
    this.keyLight.specular = B.Color3.FromHexString('#FFD98A');

    // Dynamic Passing Orb Reactive Energy Light
    this.orbLight = new B.PointLight(
      'orb_point_light',
      new B.Vector3(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbStartZ),
      s
    );
    this.orbLight.diffuse = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    this.orbLight.intensity = 2.2;
    this.orbLight.range = 24.0;
  }

  _initSharedPBRMaterials() {
    const s = this.scene;
    const B = this.B;

    this.obsidianPBR = createCarvedObsidianMonolithPBR(s, 'aaa_obsidian_wall_pbr', 4, 4);
    this.pillarObsidianPBR = createCarvedObsidianMonolithPBR(s, 'aaa_obsidian_pillar_pbr', 2, 5);
    this.bronzePBR = createAntiqueBronzePBR(s, 'aaa_antique_bronze_pbr', 0.14);
    this.darkBronzePBR = createAntiqueBronzePBR(s, 'aaa_dark_bronze_pbr', 0.06);
    this.darkBronzePBR.albedoColor = B.Color3.FromHexString('#7A5C28');
    this.darkBronzePBR.roughness = 0.34;
    this.marblePBR = createSanctuaryMarblePBR(s, 'aaa_sanctuary_marble_pbr');

    this.emissivePlatinumMat = new B.PBRMaterial('aaa_platinum_emitter', s);
    this.emissivePlatinumMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.platinum);
    this.emissivePlatinumMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.platinum).scale(1.65);
    this.emissivePlatinumMat.metallic = 0.1;
    this.emissivePlatinumMat.roughness = 0.2;
    this.emissivePlatinumMat.disableDepthWrite = false;
    this.emissivePlatinumMat.needDepthPrePass = false;

    this.emissiveGoldTrimMat = new B.PBRMaterial('aaa_gold_trim_emitter', s);
    this.emissiveGoldTrimMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.goldWPos);
    this.emissiveGoldTrimMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(1.25);
    this.emissiveGoldTrimMat.metallic = 0.85;
    this.emissiveGoldTrimMat.roughness = 0.18;
    this.emissiveGoldTrimMat.disableDepthWrite = false;
    this.emissiveGoldTrimMat.needDepthPrePass = false;
  }

  _registerMesh(mesh, { freeze = true, mirror = false, shadow = false, receiveShadow = false } = {}) {
    mesh.isPickable = false;
    if (receiveShadow) mesh.receiveShadows = true;
    if (mirror) this.mirrorRenderList.push(mesh);
    if (shadow) this.shadowCasters.push(mesh);
    if (freeze) mesh.freezeWorldMatrix();
    return mesh;
  }

  _buildSanctuaryArchitecture() {
    const B = this.B;
    const s = this.scene;

    // 1. Glossy Reflective Obsidian Floor (40m x 50m for 2.2x expanded grand cathedral!)
    const { mat: floorMat, mirrorTex } = createSanctuaryMirrorFloorPBR(s, this.mirrorRenderList, 11, 14);
    this.floorMirrorTex = mirrorTex;

    const floor = B.MeshBuilder.CreateGround('sanctuary_floor', { width: 40, height: 50 }, s);
    floor.position.set(0, 0, -1.5);
    floor.material = floorMat;
    floor.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    floor.parent = this.root;
    this._registerMesh(floor, { freeze: true, receiveShadow: true });

    // Central raised brushed-bronze ceremonial runway (strictly 6mm clear above floor -> zero Z-fighting!)
    const runway = B.MeshBuilder.CreateBox('orb_runway', { width: 1.05, height: 0.04, depth: 27.6 }, s);
    runway.position.set(0, 0.026, -1.6);
    runway.material = this.darkBronzePBR;
    runway.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    runway.parent = this.root;
    this._registerMesh(runway, { freeze: true, receiveShadow: true });

    // Exact 0.164m luminous platinum floor rails (mounted cleanly proud above runway top at y=0.046!)
    for (const sign of [-1, 1]) {
      const rail = B.MeshBuilder.CreateBox(
        `slit_floor_rail_${sign}`,
        { width: 0.018, height: 0.024, depth: 22.8 },
        s
      );
      rail.position.set(sign * LEVEL14_CONFIG.slitHalfWidth, 0.06, -0.4);
      rail.material = this.emissivePlatinumMat;
      rail.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      rail.parent = this.root;
      this._registerMesh(rail, { freeze: true, mirror: true });
    }

    // 2. Monumental Canted Brutalist Obsidian Rib-Arches & Stepped Colonnade (8 bays soaring 22m high!)
    const bayZs = [-18.5, -13.5, -8.5, -3.5, 4.5, 9.5, 14.5, 18.8];
    bayZs.forEach((bz, idx) => {
      for (const side of [-1, 1]) {
        // Heavy stepped obsidian plinth base at X = ±15.2m
        const plinth = B.MeshBuilder.CreateBox(
          `col_plinth_${idx}_${side}`,
          { width: 2.4, height: 1.6, depth: 2.3 },
          s
        );
        plinth.position.set(side * 15.2, 0.82, bz);
        plinth.material = this.darkBronzePBR;
        plinth.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        plinth.parent = this.root;
        this._registerMesh(plinth, { freeze: true, mirror: true, shadow: true, receiveShadow: true });

        // Towering 19.4m carved obsidian pier
        const pier = B.MeshBuilder.CreateBox(
          `col_pier_${idx}_${side}`,
          { width: 1.85, height: 19.4, depth: 1.8 },
          s
        );
        pier.position.set(side * 15.2, 10.6, bz);
        pier.material = this.pillarObsidianPBR;
        pier.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        pier.parent = this.root;
        this._registerMesh(pier, { freeze: true, mirror: true, shadow: true });

        // Recessed metallic antique-bronze vertical flute inlay (cleanly 4cm proud of pier inner face!)
        const inlay = B.MeshBuilder.CreateBox(
          `col_inlay_${idx}_${side}`,
          { width: 0.14, height: 18.0, depth: 0.24 },
          s
        );
        inlay.position.set(side * 14.2, 10.5, bz);
        inlay.material = this.bronzePBR;
        inlay.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        inlay.parent = this.root;
        this._registerMesh(inlay, { freeze: true, mirror: true });

        // Monumental angled brutalist cathedral corbel rib arching inward toward the 22m high vault
        const rib = B.MeshBuilder.CreateBox(
          `vault_rib_${idx}_${side}`,
          { width: 10.4, height: 0.85, depth: 1.15 },
          s
        );
        rib.position.set(side * 10.1, 19.8, bz);
        rib.rotation.z = side * -0.28;
        rib.material = this.pillarObsidianPBR;
        rib.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        rib.parent = this.root;
        this._registerMesh(rib, { freeze: true, mirror: true });

        // Illuminated golden soffit trim under each cathedral arch rib (cleanly proud beneath rib!)
        const soffit = B.MeshBuilder.CreateBox(
          `vault_soffit_${idx}_${side}`,
          { width: 9.8, height: 0.14, depth: 0.22 },
          s
        );
        soffit.position.set(side * 10.0, 19.3, bz);
        soffit.rotation.z = side * -0.28;
        soffit.material = this.emissiveGoldTrimMat;
        soffit.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        soffit.parent = this.root;
        this._registerMesh(soffit, { freeze: true, mirror: true });
      }

      // High transverse vault lintel framing the 4.6m-wide pure-white clerestory skylight
      const lintel = B.MeshBuilder.CreateBox(
        `vault_lintel_${idx}`,
        { width: 11.4, height: 0.9, depth: 1.2 },
        s
      );
      lintel.position.set(0, 21.2, bz);
      lintel.material = this.darkBronzePBR;
      lintel.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      lintel.parent = this.root;
      this._registerMesh(lintel, { freeze: true });
    });

    // Outer vaulted obsidian sanctuary walls (34m span: X = ±17.0m) & coffered 22m ceiling wings
    for (const side of [-1, 1]) {
      const wall = B.MeshBuilder.CreateBox(
        `sanctuary_outer_wall_${side}`,
        { width: 1.2, height: 22.8, depth: 48 },
        s
      );
      wall.position.set(side * 17.0, 11.4, -1.5);
      wall.material = this.obsidianPBR;
      wall.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      wall.parent = this.root;
      this._registerMesh(wall, { freeze: true });

      const ceilingWing = B.MeshBuilder.CreateBox(
        `sanctuary_ceiling_${side}`,
        { width: 13.6, height: 0.7, depth: 48 },
        s
      );
      ceilingWing.position.set(side * 10.2, 22.0, -1.5);
      ceilingWing.material = this.obsidianPBR;
      ceilingWing.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      ceilingWing.parent = this.root;
      this._registerMesh(ceilingWing, { freeze: true });
    }

    // South rear monumental wall (Z = -23.0m)
    const southWall = B.MeshBuilder.CreateBox('sanctuary_south_wall', { width: 35.6, height: 22.8, depth: 1.2 }, s);
    southWall.position.set(0, 11.4, -23.0);
    southWall.material = this.obsidianPBR;
    southWall.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    southWall.parent = this.root;
    this._registerMesh(southWall, { freeze: true });

    // Pure-White Clerestory Skylight Strip pouring luminous sanctuary light down the 44m central nave
    const skylight = B.MeshBuilder.CreateBox('clerestory_skylight', { width: 4.8, height: 0.22, depth: 43 }, s);
    skylight.position.set(0, 22.25, -1.5);
    skylight.material = this.emissivePlatinumMat;
    skylight.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    skylight.parent = this.root;
    this._registerMesh(skylight, { freeze: true, mirror: true });
  }

  /**
   * Colossal slow-counter-rotating Antique Bronze Kinetic Astrolabe suspended high in the 22m vault
   * above the South Nave — delivers awe-inspiring cosmic scale across the 2x expanded cathedral.
   */
  _buildKineticVaultAstrolabe() {
    const B = this.B;
    const s = this.scene;

    const specs = [
      { diam: 11.4, thick: 0.16, y: 15.6, z: -6.2, tiltX: 0.25, speedY: 0.12, speedZ: 0.04 },
      { diam: 8.8, thick: 0.13, y: 15.6, z: -6.2, tiltX: -0.42, speedY: -0.18, speedZ: 0.07 },
      { diam: 6.4, thick: 0.10, y: 15.6, z: -6.2, tiltX: 0.68, speedY: 0.25, speedZ: -0.09 },
    ];

    specs.forEach((sp, i) => {
      const ring = B.MeshBuilder.CreateTorus(
        `vault_astrolabe_${i}`,
        { diameter: sp.diam, thickness: sp.thick, tessellation: 56 },
        s
      );
      ring.position.set(0, sp.y, sp.z);
      ring.rotation.x = sp.tiltX;
      ring.material = i === 1 ? this.emissiveGoldTrimMat : this.bronzePBR;
      ring.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      ring.parent = this.root;
      this._registerMesh(ring, { freeze: false, mirror: true });
      this.vaultAstrolabeRings.push({ mesh: ring, speedY: sp.speedY, speedZ: sp.speedZ });
    });
  }

  /**
   * Flanking W-layer architectural reference wings (w = +1.8 Gold on East, w = -1.8 Blue on West).
   * Positioned gracefully wide at X = ±9.2m along both South & North halves of the 34m cathedral!
   */
  _buildLayerReferenceArches() {
    const B = this.B;
    const s = this.scene;

    this.wLayerGroups = [];
    const defs = [
      { w: 1.8, hex: PALETTE.accent.goldWPos, xOffset: 9.2, zPositions: [-12.2, -7.4, -2.8, 6.8, 11.8] },
      { w: -1.8, hex: PALETTE.accent.blueWNeg, xOffset: -9.2, zPositions: [-12.2, -7.4, -2.8, 6.8, 11.8] },
    ];

    defs.forEach((def, idx) => {
      const mat = createGhostMaterial(s, `w_ref_arch_mat_${idx}`, def.hex, 0.34);
      const meshes = [];
      def.zPositions.forEach((zPos, j) => {
        const ring = B.MeshBuilder.CreateTorus(
          `w_ref_ring_${idx}_${j}`,
          { diameter: 4.1, thickness: 0.12, tessellation: 36 },
          s
        );
        ring.position.set(def.xOffset, 4.9, zPos);
        ring.rotation.z = Math.PI * 0.5;
        ring.material = mat;
        ring.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
        ring.parent = this.root;
        this._registerMesh(ring, { freeze: true, mirror: true });
        meshes.push(ring);

        const stela = B.MeshBuilder.CreateBox(
          `w_ref_stela_${idx}_${j}`,
          { width: 0.24, height: 6.4, depth: 0.65 },
          s
        );
        stela.position.set(def.xOffset + (def.xOffset > 0 ? 1.15 : -1.15), 3.22, zPos);
        stela.material = mat;
        stela.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
        stela.parent = this.root;
        this._registerMesh(stela, { freeze: true, mirror: true });
        meshes.push(stela);
      });
      this.wLayerGroups.push({ w: def.w, mat, meshes });
    });
  }

  /**
   * Hero Landmark: 「一线天石碑」 — Monumental 13.6m × 34.4m Obsidian-Gold Twin Monoliths
   * with precision-machined 0.164m hairline slit jaws & Vernier calibration marks.
   *
   * STRICT ANTI-Z-FIGHTING GEOMETRY:
   * Every sub-mesh face (slab, dark-bronze inner throat, vertical laser ribs, front/back platinum lips,
   * aperture jaws, Vernier ticks, horizontal moldings, base skirt, crown, top seal) has explicit
   * non-coplanar clearance (>= 4mm–50mm) so the slit NEVER flickers at any angle or distance!
   */
  _buildHairlineMonoliths() {
    const B = this.B;
    const s = this.scene;

    const wallH = LEVEL14_CONFIG.wallHeight; // 13.6 m (2x taller!)
    const wallDepth = LEVEL14_CONFIG.wallZMax - LEVEL14_CONFIG.wallZMin; // 2.4 m
    const halfGap = LEVEL14_CONFIG.slitHalfWidth; // 0.082 m
    const wallWidth = 17.2; // Seals wall-to-wall past outer walls at ±17.0 m

    this.slitLipMat = new B.PBRMaterial('aaa_slit_platinum_lip', s);
    this.slitLipMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.platinum);
    this.slitLipMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.platinum).scale(1.65);
    this.slitLipMat.metallic = 0.22;
    this.slitLipMat.roughness = 0.16;
    this.slitLipMat.disableDepthWrite = false;
    this.slitLipMat.needDepthPrePass = false;

    this.monolithLeftGroup = new B.TransformNode('monolith_left_group', s);
    this.monolithLeftGroup.parent = this.root;
    this.monolithRightGroup = new B.TransformNode('monolith_right_group', s);
    this.monolithRightGroup.parent = this.root;

    for (const side of [-1, 1]) {
      // Primary obsidian slab starts cleanly recessed at |X| = 0.108m (26mm behind the 0.082m slit throat!)
      const slabInnerX = halfGap + 0.026; // 0.108 m
      const centerX = side * (slabInnerX + wallWidth * 0.5);
      const group = side < 0 ? this.monolithLeftGroup : this.monolithRightGroup;

      // 1. Primary 13.6m Carved Normal-Mapped Obsidian Monolith Slab (|X| in [0.108, 17.308], Z in [-1.20, +1.20])
      const slab = B.MeshBuilder.CreateBox(
        `hairline_monolith_${side}`,
        { width: wallWidth, height: wallH, depth: wallDepth },
        s
      );
      slab.position.set(centerX, wallH * 0.5, 0);
      slab.material = this.obsidianPBR;
      slab.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      slab.parent = group;
      this._registerMesh(slab, { freeze: false, mirror: true, shadow: true, receiveShadow: true });

      // 1b. Precision Machined Dark-Bronze Inner Slit Throat (|X| in [0.090, 0.104], Z in [-1.16, +1.16])
      // Strictly separated from slab (4mm gap) & front/back faces (40mm recessed) -> ZERO Z-fighting!
      const innerThroat = B.MeshBuilder.CreateBox(
        `slit_inner_throat_${side}`,
        { width: 0.014, height: wallH - 0.08, depth: wallDepth - 0.08 },
        s
      );
      innerThroat.position.set(side * (halfGap + 0.015), wallH * 0.5, 0);
      innerThroat.material = this.darkBronzePBR;
      innerThroat.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      innerThroat.parent = group;
      this._registerMesh(innerThroat, { freeze: false, mirror: true });

      // 1c. Three Sleek Recessed Vertical Luminous Calibration Ribs inside the 2.4m slit throat
      // Strictly proud of innerThroat (|X| in [0.082, 0.088], 2mm clear of throat -> crisp non-flickering laser ribs!)
      for (const ribZ of [-0.78, 0.0, 0.78]) {
        const innerRib = B.MeshBuilder.CreateBox(
          `slit_inner_rib_${side}_${ribZ}`,
          { width: 0.006, height: wallH - 0.16, depth: 0.065 },
          s
        );
        innerRib.position.set(side * (halfGap + 0.003), wallH * 0.5, ribZ);
        innerRib.material = this.slitLipMat;
        innerRib.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        innerRib.parent = group;
        this._registerMesh(innerRib, { freeze: false, mirror: true });
      }

      // 2. Stepped Monumental Buttress Piers flanking the wide 17.2m face for deep brutalist shadow relief
      for (const bx of [5.8, 11.8]) {
        const buttress = B.MeshBuilder.CreateBox(
          `monolith_buttress_${side}_${bx}`,
          { width: 2.2, height: wallH - 0.4, depth: wallDepth + 0.76 },
          s
        );
        buttress.position.set(side * bx, (wallH - 0.4) * 0.5, 0);
        buttress.material = this.pillarObsidianPBR;
        buttress.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        buttress.parent = group;
        this._registerMesh(buttress, { freeze: false, mirror: true, shadow: true, receiveShadow: true });
      }

      // Stepped Bronze Plinth Skirt along base of monolith (cleanly proud of floor & slab!)
      const baseSkirt = B.MeshBuilder.CreateBox(
        `monolith_skirt_${side}`,
        { width: wallWidth - 0.5, height: 0.34, depth: wallDepth + 0.32 },
        s
      );
      baseSkirt.position.set(centerX + side * 0.25, 0.18, 0);
      baseSkirt.material = this.darkBronzePBR;
      baseSkirt.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      baseSkirt.parent = group;
      this._registerMesh(baseSkirt, { freeze: false, mirror: true, receiveShadow: true });

      // Cantilevered Antique-Bronze Architectural Crown Cornice (cleanly 30mm above slab top!)
      const crown = B.MeshBuilder.CreateBox(
        `monolith_crown_${side}`,
        { width: wallWidth - 0.06, height: 0.52, depth: wallDepth + 0.48 },
        s
      );
      crown.position.set(centerX + side * 0.03, wallH + 0.29, 0);
      crown.material = this.bronzePBR;
      crown.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      crown.parent = group;
      this._registerMesh(crown, { freeze: false, mirror: true });

      // Horizontal machined bronze frieze moldings on South & North monolith faces (strictly proud in Z!)
      [2.4, 5.8, 9.2, 12.2].forEach((bandY, bIdx) => {
        for (const zFace of [-1, 1]) {
          const band = B.MeshBuilder.CreateBox(
            `monolith_band_${side}_${bIdx}_${zFace}`,
            { width: wallWidth - 0.7, height: 0.14, depth: 0.10 },
            s
          );
          band.position.set(centerX + side * 0.35, bandY, zFace * (wallDepth * 0.5 + 0.07));
          band.material = this.bronzePBR;
          band.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
          band.parent = group;
          this._registerMesh(band, { freeze: false, mirror: true });
        }
      });

      // 3. Precision Machined Aperture Jaw Pylons framing the 0.164m Hairline Slit (strictly outside slab Z!)
      for (const zFace of [-1, 1]) {
        // Dazzling Platinum Vertical Slit Lip Emitter strictly clear of slab Z (±1.208..±1.268) & X (±0.082..±0.126)!
        const lip = B.MeshBuilder.CreateBox(
          `slit_platinum_lip_${side}_${zFace}`,
          { width: 0.044, height: wallH - 0.08, depth: 0.06 },
          s
        );
        lip.position.set(side * (halfGap + 0.022), wallH * 0.5, zFace * (wallDepth * 0.5 + 0.04));
        lip.material = this.slitLipMat;
        lip.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        lip.parent = group;
        this._registerMesh(lip, { freeze: false, mirror: true });

        // Bronze Aperture Jaw strictly outside lip in X (|X| in [0.16, 0.46]) & proud of slab in Z (±1.21..±1.43)
        const jaw = B.MeshBuilder.CreateBox(
          `monolith_aperture_jaw_${side}_${zFace}`,
          { width: 0.30, height: wallH - 0.06, depth: 0.22 },
          s
        );
        jaw.position.set(side * (halfGap + 0.23), wallH * 0.5, zFace * (wallDepth * 0.5 + 0.12));
        jaw.material = this.bronzePBR;
        jaw.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
        jaw.parent = group;
        this._registerMesh(jaw, { freeze: false, mirror: true, shadow: true });

        // Cosmic Vernier Calibration Hash Marks cleanly proud of jaw front face (|Z| in [1.44, 1.49])
        for (let ty = 0.85; ty <= wallH - 0.75; ty += 0.75) {
          const tick = B.MeshBuilder.CreateBox(
            `slit_vernier_${side}_${zFace}_${ty}`,
            { width: 0.18, height: 0.028, depth: 0.05 },
            s
          );
          tick.position.set(side * (halfGap + 0.20), ty, zFace * (wallDepth * 0.5 + 0.26));
          tick.material = this.emissiveGoldTrimMat;
          tick.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
          tick.parent = group;
          this._registerMesh(tick, { freeze: false });
        }
      }
    }

    // Heavy overhead sanctuary lintel sealing cleanly above crown (Y in [14.20, 22.40] -> 50mm gap from crown!)
    const topSeal = B.MeshBuilder.CreateBox(
      'monolith_top_seal',
      { width: 35.4, height: 8.2, depth: wallDepth + 0.16 },
      s
    );
    topSeal.position.set(0, wallH + 4.7, 0);
    topSeal.material = this.obsidianPBR;
    topSeal.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    topSeal.parent = this.root;
    this._registerMesh(topSeal, { freeze: true, mirror: true });

    // Amber-coral collision feedback barrier plane at the slit entrance
    this.barrierMat = createGhostMaterial(s, 'slit_barrier_flash_mat', PALETTE.accent.amberCoral, 0.34);
    this.barrierMat.alpha = 0.0;
    this.barrierPlane = B.MeshBuilder.CreatePlane('slit_barrier_plane', { width: 3.4, height: 5.2 }, s);
    this.barrierPlane.position.set(0, LEVEL14_CONFIG.orbCenterY + 0.6, LEVEL14_CONFIG.wallZMin - 0.14);
    this.barrierPlane.material = this.barrierMat;
    this.barrierPlane.isPickable = false;
    this.barrierPlane.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.barrierPlane.parent = this.root;
  }

  _buildSteppedPedestal(prefix, zPos, ringMat) {
    const B = this.B;
    const s = this.scene;

    // Tier 1: Outer bronze base plinth
    const tier1 = B.MeshBuilder.CreateCylinder(
      `${prefix}_tier1`,
      { diameterTop: 2.95, diameterBottom: 3.25, height: 0.16, tessellation: 40 },
      s
    );
    tier1.position.set(0, 0.08, zPos);
    tier1.material = this.darkBronzePBR;
    tier1.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    tier1.parent = this.root;
    this._registerMesh(tier1, { freeze: true, mirror: true, shadow: true, receiveShadow: true });

    // Tier 2: Honed Sanctuary Alabaster Marble step
    const tier2 = B.MeshBuilder.CreateCylinder(
      `${prefix}_tier2`,
      { diameterTop: 2.35, diameterBottom: 2.65, height: 0.2, tessellation: 40 },
      s
    );
    tier2.position.set(0, 0.26, zPos);
    tier2.material = this.marblePBR;
    tier2.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    tier2.parent = this.root;
    this._registerMesh(tier2, { freeze: true, mirror: true, shadow: true, receiveShadow: true });

    // Tier 3: Inner bronze energy focus collar
    const collar = B.MeshBuilder.CreateCylinder(
      `${prefix}_collar`,
      { diameterTop: 1.55, diameterBottom: 1.75, height: 0.08, tessellation: 32 },
      s
    );
    collar.position.set(0, 0.4, zPos);
    collar.material = this.bronzePBR;
    collar.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    collar.parent = this.root;
    this._registerMesh(collar, { freeze: true, mirror: true, receiveShadow: true });

    // Sleek Horizontal Luminous Calibration Ring (CreateTorus lies flat in XZ!)
    const ring = B.MeshBuilder.CreateTorus(
      `${prefix}_ring`,
      { diameter: 2.46, thickness: 0.06, tessellation: 48 },
      s
    );
    ring.position.set(0, 0.37, zPos);
    ring.material = ringMat;
    ring.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    ring.parent = this.root;
    this._registerMesh(ring, { freeze: true, mirror: true });

    // Four sleek architectural containment fins at 45° diagonals
    for (let k = 0; k < 4; k += 1) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const fin = B.MeshBuilder.CreateBox(
        `${prefix}_fin_${k}`,
        { width: 0.1, height: 0.54, depth: 0.28 },
        s
      );
      fin.position.set(Math.cos(ang) * 1.48, 0.27, zPos + Math.sin(ang) * 1.48);
      fin.rotation.y = -ang + Math.PI / 2;
      fin.material = this.bronzePBR;
      fin.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
      fin.parent = this.root;
      this._registerMesh(fin, { freeze: true, mirror: true, shadow: true });
    }

    return ring;
  }

  _buildPedestalsAndGate() {
    const B = this.B;
    const s = this.scene;

    const cyanRingMat = new B.PBRMaterial('aaa_south_ring_mat', s);
    cyanRingMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    cyanRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(1.4);
    cyanRingMat.metallic = 0.2;
    cyanRingMat.roughness = 0.18;

    this.northRingMat = new B.PBRMaterial('aaa_north_ring_mat', s);
    this.northRingMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.goldWPos);
    this.northRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(1.45);
    this.northRingMat.metallic = 0.3;
    this.northRingMat.roughness = 0.18;

    this._buildSteppedPedestal('south_pedestal', LEVEL14_CONFIG.orbStartZ, cyanRingMat);
    this.northRing = this._buildSteppedPedestal('north_pedestal', LEVEL14_CONFIG.orbTargetZ, this.northRingMat);

    // North Target Ghost Sphere Silhouette (strict Ghost invariants: alpha=0.32, disableDepthWrite=true!)
    this.northTargetGhostMat = createGhostMaterial(s, 'north_target_ghost_mat', PALETTE.accent.goldWPos, 0.32);
    this.northTargetGhost = B.MeshBuilder.CreateSphere(
      'north_target_ghost_sphere',
      { diameter: LEVEL14_CONFIG.radiusR * 2, segments: 24 },
      s
    );
    this.northTargetGhost.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbTargetZ);
    this.northTargetGhost.material = this.northTargetGhostMat;
    this.northTargetGhost.isPickable = false;
    this.northTargetGhost.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.northTargetGhost.parent = this.root;

    // Victory Radiant Light Pillar (soaring to 22m cathedral skylight!)
    this.victoryBeamMat = createGhostMaterial(s, 'victory_beam_mat', PALETTE.accent.platinum, 0.34);
    this.victoryBeam = B.MeshBuilder.CreateCylinder(
      'victory_beam',
      { diameter: 2.3, height: 22.0, tessellation: 32 },
      s
    );
    this.victoryBeam.position.set(0, 11.0, LEVEL14_CONFIG.orbTargetZ);
    this.victoryBeam.material = this.victoryBeamMat;
    this.victoryBeam.isVisible = false;
    this.victoryBeam.isPickable = false;
    this.victoryBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.victoryBeam.parent = this.root;

    // 3-Second Key-In-Keyhole Unlock Resonance VFX (dual gyroscopic halos + expanding shockwave rings)
    this.unlockHaloAMat = createGhostMaterial(s, 'unlock_halo_a_mat', PALETTE.accent.goldWPos, 0.34);
    this.unlockHaloA = B.MeshBuilder.CreateTorus(
      'unlock_halo_a',
      { diameter: 2.9, thickness: 0.08, tessellation: 48 },
      s
    );
    this.unlockHaloA.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbTargetZ);
    this.unlockHaloA.material = this.unlockHaloAMat;
    this.unlockHaloA.isVisible = false;
    this.unlockHaloA.isPickable = false;
    this.unlockHaloA.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.unlockHaloA.parent = this.root;

    this.unlockHaloBMat = createGhostMaterial(s, 'unlock_halo_b_mat', PALETTE.accent.emerald, 0.34);
    this.unlockHaloB = B.MeshBuilder.CreateTorus(
      'unlock_halo_b',
      { diameter: 3.6, thickness: 0.07, tessellation: 48 },
      s
    );
    this.unlockHaloB.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbTargetZ);
    this.unlockHaloB.material = this.unlockHaloBMat;
    this.unlockHaloB.isVisible = false;
    this.unlockHaloB.isPickable = false;
    this.unlockHaloB.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.unlockHaloB.parent = this.root;

    this.unlockShockMat = createGhostMaterial(s, 'unlock_shock_mat', PALETTE.accent.platinum, 0.34);
    this.unlockShockRing = B.MeshBuilder.CreateTorus(
      'unlock_shock_ring',
      { diameter: 2.4, thickness: 0.12, tessellation: 56 },
      s
    );
    this.unlockShockRing.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbTargetZ);
    this.unlockShockRing.material = this.unlockShockMat;
    this.unlockShockRing.isVisible = false;
    this.unlockShockRing.isPickable = false;
    this.unlockShockRing.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.unlockShockRing.parent = this.root;

    this.slitShockMat = createGhostMaterial(s, 'slit_shock_mat', PALETTE.accent.emerald, 0.34);
    this.slitShockRing = B.MeshBuilder.CreateTorus(
      'slit_shock_ring',
      { diameter: 2.2, thickness: 0.1, tessellation: 56 },
      s
    );
    this.slitShockRing.rotation.x = Math.PI * 0.5;
    this.slitShockRing.position.set(0, LEVEL14_CONFIG.orbCenterY + 0.6, LEVEL14_CONFIG.wallZMin - 0.18);
    this.slitShockRing.material = this.slitShockMat;
    this.slitShockRing.isVisible = false;
    this.slitShockRing.isPickable = false;
    this.slitShockRing.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.slitShockRing.parent = this.root;

    // Sanctuary Monumental Inner Gate at North Wall Z = +19.6m (spans full 35.6m x 22.8m hall!)
    const gateFrame = B.MeshBuilder.CreateBox('sanctuary_gate_frame', { width: 35.6, height: 22.8, depth: 1.2 }, s);
    gateFrame.position.set(0, 11.4, 19.6);
    gateFrame.material = this.obsidianPBR;
    gateFrame.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    gateFrame.parent = this.root;
    this._registerMesh(gateFrame, { freeze: true });

    this.gateLeft = B.MeshBuilder.CreateBox('gate_door_left', { width: 4.4, height: 11.2, depth: 0.65 }, s);
    this.gateLeft.position.set(-2.22, 5.62, 18.0);
    this.gateLeft.material = this.pillarObsidianPBR;
    this.gateLeft.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    this.gateLeft.parent = this.root;
    this._registerMesh(this.gateLeft, { freeze: false, mirror: true });

    this.gateRight = B.MeshBuilder.CreateBox('gate_door_right', { width: 4.4, height: 11.2, depth: 0.65 }, s);
    this.gateRight.position.set(2.22, 5.62, 18.0);
    this.gateRight.material = this.pillarObsidianPBR;
    this.gateRight.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    this.gateRight.parent = this.root;
    this._registerMesh(this.gateRight, { freeze: false, mirror: true });

    // Golden Sacred Gate Seal Ring (cleanly 45cm proud of gate doors!)
    this.gateEmblem = B.MeshBuilder.CreateTorus(
      'gate_emblem_ring',
      { diameter: 4.8, thickness: 0.14, tessellation: 48 },
      s
    );
    this.gateEmblem.position.set(0, 5.62, 17.55);
    this.gateEmblem.rotation.x = Math.PI * 0.5;
    this.gateEmblem.material = this.emissiveGoldTrimMat;
    this.gateEmblem.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.gateEmblem.parent = this.root;
    this._registerMesh(this.gateEmblem, { freeze: false, mirror: true });

    // Behind-gate radiance plane strictly 35cm clear of gateFrame front face (Z=19.0) & 65cm behind doors (Z=18.0)
    const behindGlow = B.MeshBuilder.CreatePlane('behind_gate_radiance', { width: 8.6, height: 11.2 }, s);
    behindGlow.position.set(0, 5.62, 18.65);
    behindGlow.material = this.emissivePlatinumMat;
    behindGlow.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    behindGlow.parent = this.root;
    this._registerMesh(behindGlow, { freeze: true, mirror: true });
  }

  /**
   * AAA North Teleportation Pad (Z = +11.2m in the 2x expanded North Sanctuary Nave):
   * Dormant behind the monolith until the Passing Orb key restores on the North Pedestal.
   * Upon victory, the twin 13.6m monolith walls slide wide open and the Teleportation Pad ignites
   * with monumental counter-rotating emerald-platinum energy rings and a rising warp light column!
   */
  _buildTeleportationPad() {
    const B = this.B;
    const s = this.scene;
    const pz = LEVEL14_CONFIG.teleporterZ;

    this.portalCoreMat = new B.PBRMaterial('aaa_portal_core_mat', s);
    this.portalCoreMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.emerald);
    this.portalCoreMat.emissiveColor = B.Color3.FromHexString('#1E3A2F');
    this.portalCoreMat.metallic = 0.35;
    this.portalCoreMat.roughness = 0.16;
    this.portalCoreMat.disableDepthWrite = false;
    this.portalCoreMat.needDepthPrePass = false;

    // Monumental stepped walkable circular dais (clean vertical separation from floor -> zero Z-fighting!)
    const outerStep = B.MeshBuilder.CreateCylinder(
      'teleporter_outer_step',
      { diameterTop: 4.5, diameterBottom: 4.85, height: 0.10, tessellation: 48 },
      s
    );
    outerStep.position.set(0, 0.056, pz);
    outerStep.material = this.darkBronzePBR;
    outerStep.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    outerStep.parent = this.root;
    this._registerMesh(outerStep, { freeze: true, mirror: true, receiveShadow: true });

    const innerDeck = B.MeshBuilder.CreateCylinder(
      'teleporter_inner_deck',
      { diameterTop: 3.7, diameterBottom: 3.95, height: 0.12, tessellation: 48 },
      s
    );
    innerDeck.position.set(0, 0.14, pz);
    innerDeck.material = this.marblePBR;
    innerDeck.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    innerDeck.parent = this.root;
    this._registerMesh(innerDeck, { freeze: true, mirror: true, receiveShadow: true });

    // Flush glowing teleport deck ring
    this.portalDeckRing = B.MeshBuilder.CreateTorus(
      'teleporter_deck_ring',
      { diameter: 3.35, thickness: 0.095, tessellation: 48 },
      s
    );
    this.portalDeckRing.position.set(0, 0.23, pz);
    this.portalDeckRing.material = this.portalCoreMat;
    this.portalDeckRing.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.portalDeckRing.parent = this.root;
    this._registerMesh(this.portalDeckRing, { freeze: true, mirror: true });

    // Grand upright 5.4m bronze portal archway framing the Teleportation Pad
    const archOuter = B.MeshBuilder.CreateTorus(
      'teleporter_arch_outer',
      { diameter: 5.4, thickness: 0.18, tessellation: 56 },
      s
    );
    archOuter.position.set(0, 3.05, pz);
    archOuter.rotation.x = Math.PI * 0.5;
    archOuter.material = this.bronzePBR;
    archOuter.renderingGroupId = RENDER_GROUPS.ENVIRONMENT;
    archOuter.parent = this.root;
    this._registerMesh(archOuter, { freeze: true, mirror: true, shadow: true });

    // Counter-rotating kinetic energy halo rings suspended inside the portal archway
    this.portalHaloOuter = B.MeshBuilder.CreateTorus(
      'teleporter_halo_outer',
      { diameter: 4.65, thickness: 0.075, tessellation: 56 },
      s
    );
    this.portalHaloOuter.position.set(0, 3.05, pz);
    this.portalHaloOuter.rotation.x = Math.PI * 0.5;
    this.portalHaloOuter.material = this.portalCoreMat;
    this.portalHaloOuter.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.portalHaloOuter.parent = this.root;
    this._registerMesh(this.portalHaloOuter, { freeze: false, mirror: true });

    this.portalHaloInner = B.MeshBuilder.CreateTorus(
      'teleporter_halo_inner',
      { diameter: 3.65, thickness: 0.06, tessellation: 56 },
      s
    );
    this.portalHaloInner.position.set(0, 3.05, pz);
    this.portalHaloInner.rotation.x = Math.PI * 0.5;
    this.portalHaloInner.material = this.emissivePlatinumMat;
    this.portalHaloInner.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.portalHaloInner.parent = this.root;
    this._registerMesh(this.portalHaloInner, { freeze: false, mirror: true });

    // Translucent vertical warp beacon column soaring to the cathedral vault (strict Ghost invariants!)
    this.portalBeamMat = createGhostMaterial(s, 'teleporter_beam_mat', PALETTE.accent.emerald, 0.31);
    this.portalBeam = B.MeshBuilder.CreateCylinder(
      'teleporter_beam',
      { diameter: 3.0, height: 18.0, tessellation: 32 },
      s
    );
    this.portalBeam.position.set(0, 9.2, pz);
    this.portalBeam.material = this.portalBeamMat;
    this.portalBeam.isVisible = false;
    this.portalBeam.isPickable = false;
    this.portalBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.portalBeam.parent = this.root;

    // Dedicated reactive emerald-gold point light illuminating the opened North Portal
    this.portalLight = new B.PointLight('teleporter_point_light', new B.Vector3(0, 3.4, pz), s);
    this.portalLight.diffuse = B.Color3.FromHexString(PALETTE.accent.emerald);
    this.portalLight.intensity = 0.0;
    this.portalLight.range = 28.0;
  }

  /**
   * Build the AAA Crystalline 2.0m Passing Orb (通行珠):
   * - Clearcoat engraved energy crystal PBR core (`orbSliceCore`) — the solid cyan part staying in our 3D layer
   * - Dedicated dimmable meridian rings (`orbMeridianRoot`) that soften when tilted so they never read as an outer hoop
   * - Matching △ (left -X) and ○ (right +X) horizontal diameter markers linking the 3D sphere directly to the Side View!
   * - Translucent 4D projection envelope (`orbProjShell` + △/○ beacons, shown in Tab Side View)
   * - Focused wall-contact highlight patch (`contactPatchMesh`) lighting up the exact protruding collision spot!
   */
  _buildPassingOrb() {
    const B = this.B;
    const s = this.scene;

    this.orbRoot = new B.TransformNode('passing_orb_root', s);
    this.orbRoot.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbStartZ);
    this.orbRoot.parent = this.root;

    // 1. Full 3D Alien Relic Crystal Sphere (shown when flat in our 3D layer; zero external rings/handles!)
    this.orbCoreMat = createPassingOrbCrystalPBR(s);
    this.orbSliceCore = B.MeshBuilder.CreateSphere('orb_slice_core', { diameter: 2.0, segments: 48 }, s);
    this.orbSliceCore.material = this.orbCoreMat;
    this.orbSliceCore.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.orbSliceCore.parent = this.orbRoot;
    this._registerMesh(this.orbSliceCore, { freeze: false, mirror: true, shadow: true });

    // 1b. Dedicated High-Dimensional Astrolabe Interior Cross-Section Disc (Slice Concept 2)
    // Shown whenever the 4D sphere is sliced (tilted or viewed from another W layer) so the cut face
    // reveals the true interior astrolabe crystal core + brushed-gold shell rim!
    this.orbSliceDiscRoot = new B.TransformNode('orb_slice_disc_root', s);
    this.orbSliceDiscRoot.parent = this.orbRoot;

    this.orbSliceMat = createPassingOrbSlicePBR(s);
    this.orbSliceRimMat = new B.PBRMaterial('aaa_orb_slice_rim_mat', s);
    this.orbSliceRimMat.albedoColor = B.Color3.FromHexString('#FFE294');
    this.orbSliceRimMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(0.95);
    this.orbSliceRimMat.metallic = 0.88;
    this.orbSliceRimMat.roughness = 0.22;
    this.orbSliceRimMat.needDepthPrePass = false;

    const sliceRim = B.MeshBuilder.CreateCylinder(
      'orb_slice_rim',
      { diameter: 2.0, height: 2.0, tessellation: 48, hasRings: false },
      s
    );
    sliceRim.rotation.z = Math.PI * 0.5;
    sliceRim.material = this.orbSliceRimMat;
    sliceRim.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    sliceRim.parent = this.orbSliceDiscRoot;
    this._registerMesh(sliceRim, { freeze: false, mirror: true });

    const sliceFacePos = B.MeshBuilder.CreateDisc(
      'orb_slice_face_pos',
      { radius: 0.995, tessellation: 48 },
      s
    );
    sliceFacePos.position.set(1.005, 0, 0);
    sliceFacePos.rotation.y = -Math.PI * 0.5;
    sliceFacePos.material = this.orbSliceMat;
    sliceFacePos.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    sliceFacePos.parent = this.orbSliceDiscRoot;
    this._registerMesh(sliceFacePos, { freeze: false, mirror: true });

    const sliceFaceNeg = B.MeshBuilder.CreateDisc(
      'orb_slice_face_neg',
      { radius: 0.995, tessellation: 48 },
      s
    );
    sliceFaceNeg.position.set(-1.005, 0, 0);
    sliceFaceNeg.rotation.y = Math.PI * 0.5;
    sliceFaceNeg.material = this.orbSliceMat;
    sliceFaceNeg.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    sliceFaceNeg.parent = this.orbSliceDiscRoot;
    this._registerMesh(sliceFaceNeg, { freeze: false, mirror: true });

    this.orbSliceDiscRoot.setEnabled(false);

    // 2. 4D Projection Envelope (hidden by default; visible ONLY in Tab Side View — zero △/○ beacons!)
    this.orbProjRoot = new B.TransformNode('orb_4d_projection_root', s);
    this.orbProjRoot.parent = this.orbRoot;

    this.orbProjShellMat = createGhostMaterial(s, 'orb_proj_shell_mat', PALETTE.accent.goldWPos, 0.30);
    this.orbProjShell = B.MeshBuilder.CreateSphere('orb_proj_shell', { diameter: 2.02, segments: 24 }, s);
    this.orbProjShell.material = this.orbProjShellMat;
    this.orbProjShell.isPickable = false;
    this.orbProjShell.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    this.orbProjShell.parent = this.orbProjRoot;

    // Focused Wall-Contact Collision Highlight Patch (lights up ONLY the protruding contact region on the wall!)
    this.contactPatchMat = createGhostMaterial(s, 'wall_contact_patch_mat', PALETTE.accent.amberCoral, 0.34);
    this.contactPatchMesh = B.MeshBuilder.CreateDisc(
      'wall_contact_patch',
      { radius: 1, tessellation: 32, sideOrientation: B.Mesh.DOUBLESIDE },
      s
    );
    this.contactPatchMesh.position.set(0.55, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.wallZMin - 0.09);
    this.contactPatchMesh.material = this.contactPatchMat;
    this.contactPatchMesh.isVisible = false;
    this.contactPatchMesh.isPickable = false;
    this.contactPatchMesh.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.contactPatchMesh.parent = this.root;

    // Crisp Equatorial Contour Ring around North Target Silhouette (makes full-sphere goal shape unmistakable!)
    this.northTargetContour = B.MeshBuilder.CreateTorus(
      'north_target_contour',
      { diameter: 2.04, thickness: 0.032, tessellation: 48 },
      s
    );
    this.northTargetContour.position.set(0, LEVEL14_CONFIG.orbCenterY, LEVEL14_CONFIG.orbTargetZ);
    this.northTargetContour.material = this.emissiveGoldTrimMat;
    this.northTargetContour.isPickable = false;
    this.northTargetContour.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    this.northTargetContour.parent = this.root;
  }

  _buildAstronaut08() {
    const B = this.B;
    const s = this.scene;

    this.astronaut = new B.TransformNode('astronaut_08', s);
    this.astronaut.parent = this.root;

    const visorMat = new B.PBRMaterial('aaa_visor_pbr', s);
    visorMat.albedoColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    visorMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(1.2);
    visorMat.metallic = 0.85;
    visorMat.roughness = 0.08;

    const trimMat = createSolidMaterial(s, 'suit_trim_mat', { diffuseHex: '#252A33' });

    const torso = B.MeshBuilder.CreateCylinder(
      'astro_torso',
      { diameterTop: 0.44, diameterBottom: 0.36, height: 0.72, tessellation: 18 },
      s
    );
    torso.position.y = 1.08;
    torso.material = this.marblePBR;
    torso.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    torso.parent = this.astronaut;
    this._registerMesh(torso, { freeze: false, mirror: true, shadow: true });

    const pack = B.MeshBuilder.CreateBox('astro_pack', { width: 0.34, height: 0.46, depth: 0.18 }, s);
    pack.position.set(0, 1.12, -0.24);
    pack.material = trimMat;
    pack.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    pack.parent = this.astronaut;

    const helmet = B.MeshBuilder.CreateSphere('astro_helmet', { diameter: 0.36, segments: 18 }, s);
    helmet.position.y = 1.62;
    helmet.material = this.marblePBR;
    helmet.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    helmet.parent = this.astronaut;
    this._registerMesh(helmet, { freeze: false, mirror: true, shadow: true });

    const visor = B.MeshBuilder.CreateSphere('astro_visor', { diameter: 0.28, segments: 16 }, s);
    visor.position.set(0, 1.62, 0.08);
    visor.scaling.set(1.0, 0.72, 0.7);
    visor.material = visorMat;
    visor.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
    visor.parent = this.astronaut;

    for (const side of [-1, 1]) {
      const leg = B.MeshBuilder.CreateCylinder(
        `astro_leg_${side}`,
        { diameter: 0.15, height: 0.74, tessellation: 12 },
        s
      );
      leg.position.set(side * 0.12, 0.37, 0);
      leg.material = trimMat;
      leg.renderingGroupId = RENDER_GROUPS.CHARACTERS_AND_WIREFRAMES;
      leg.parent = this.astronaut;
    }

    this.astronaut.setEnabled(false);
  }

  /**
   * Volumetric Clerestory Light Shafts & Radiant Slit Light Curtain (scaled for 22m high cathedral!).
   */
  _buildVolumetricLightShafts() {
    const B = this.B;
    const s = this.scene;

    const goldShaftMat = createVolumetricShaftMaterial(s, 'aaa_clerestory_shaft', '#FFE6B0', 0.11);
    [-11.0, -3.2, 3.2, 11.2].forEach((zPos, i) => {
      for (const rotY of [0.38, -0.38]) {
        const sheet = B.MeshBuilder.CreatePlane(`sun_shaft_${i}_${rotY}`, { width: 5.8, height: 21.6 }, s);
        sheet.position.set(0, 10.9, zPos);
        sheet.rotation.y = rotY;
        sheet.rotation.z = -0.13; // Matches directional clerestory sun angle!
        sheet.material = goldShaftMat;
        sheet.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
        sheet.parent = this.root;
        this._registerMesh(sheet, { freeze: true });
      }
    });

    // Razor-thin vertical platinum light curtain pouring south out of the 13.6m Hairline Slit (strictly clear of slit jaws!)
    const slitCurtainMat = createVolumetricShaftMaterial(s, 'aaa_slit_light_curtain', '#FFF6D6', 0.24);
    const slitBeam = B.MeshBuilder.CreatePlane('slit_volumetric_curtain', { width: 2.8, height: 13.4 }, s);
    slitBeam.position.set(0, 6.75, -2.75);
    slitBeam.rotation.y = Math.PI * 0.5;
    slitBeam.material = slitCurtainMat;
    slitBeam.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    slitBeam.parent = this.root;
    this._registerMesh(slitBeam, { freeze: false, mirror: true });
    this.slitVolumetricCurtain = slitBeam;
  }

  /**
   * GPU-style Soft Radial Golden Sanctuary Dust Motes drifting across the entire 34m x 44m x 22m cathedral.
   */
  _buildSanctuaryParticles() {
    const B = this.B;
    const s = this.scene;

    const ps = new B.ParticleSystem('sanctuary_motes_ps', 220, s);
    ps.particleTexture = createSoftGlowParticleTexture(s);
    ps.emitter = new B.Vector3(0, 1.0, -1.5);
    ps.minEmitBox = new B.Vector3(-14.0, 0, -19.0);
    ps.maxEmitBox = new B.Vector3(14.0, 15.0, 16.0);

    ps.color1 = new B.Color4(1.0, 0.94, 0.76, 0.72);
    ps.color2 = new B.Color4(0.97, 0.76, 0.27, 0.48);
    ps.colorDead = new B.Color4(0.97, 0.76, 0.27, 0.0);

    ps.minSize = 0.05;
    ps.maxSize = 0.14;
    ps.minLifeTime = 4.5;
    ps.maxLifeTime = 9.5;
    ps.emitRate = 32;
    ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new B.Vector3(0, 0.04, 0);
    ps.direction1 = new B.Vector3(-0.1, 0.16, -0.1);
    ps.direction2 = new B.Vector3(0.1, 0.34, 0.1);
    ps.minEmitPower = 0.18;
    ps.maxEmitPower = 0.48;
    ps.updateSpeed = 0.014;
    ps.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    ps.start();
    this.particleSystem = ps;
  }

  _finalizeMirrorAndShadows() {
    const B = this.B;
    const sg = new B.ShadowGenerator(1024, this.keyLight);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = B.ShadowGenerator.QUALITY_LOW;
    sg.bias = 0.0012;
    sg.darkness = 0.35;
    for (const m of this.shadowCasters) {
      sg.addShadowCaster(m, false);
    }
    this.shadowGenerator = sg;
  }

  triggerBarrierFlash() {
    this.barrierFlash = 1.0;
  }

  /**
   * Focused visual feedback when a tilted thin slice bumps the wall:
   * 1. Flashes the thin cyan slice & both slit lips cyan-platinum ("this slice IS thin enough!")
   * 2. Highlights the exact protruding 4D wing + wall contact area instead of the whole wall!
   */
  triggerTiltedBump() {
    this.sliceConfirmPulse = 1.0;
    this.contactHighlight = 1.0;
  }

  triggerOpeningPedestalSpotlight() {
    this.openingPulseTimer = 4.2;
  }

  setHintHighlight(active) {
    this.hintHighlight = Boolean(active);
  }

  /**
   * Project a scene landmark into CSS pixels for its HUD callout.
   */
  getScreenAnchor(mesh) {
    const B = this.B;
    const rect = this.scene.getEngine().getRenderingCanvas().getBoundingClientRect();
    const viewport = this.camera.viewport.toGlobal(rect.width, rect.height);
    const projected = B.Vector3.Project(
      mesh.getAbsolutePosition(),
      B.Matrix.Identity(),
      this.camera.getTransformationMatrix(),
      viewport
    );
    return {
      x: projected.x + rect.left,
      y: projected.y + rect.top,
      inFront: projected.z >= 0 && projected.z <= 1,
    };
  }

  syncFromState(state, dtSec) {
    const B = this.B;
    this.elapsed += dtSec;
    this.barrierFlash = Math.max(0, this.barrierFlash - dtSec * 2.4);
    this.sliceConfirmPulse = Math.max(0, this.sliceConfirmPulse - dtSec * 1.15);
    this.contactHighlight = Math.max(0, this.contactHighlight - dtSec * 0.9);
    this.openingPulseTimer = Math.max(0, this.openingPulseTimer - dtSec);

    // 0. Majestic slow counter-rotation of the high vault astrolabe rings
    for (const r of this.vaultAstrolabeRings) {
      r.mesh.rotation.y += dtSec * r.speedY;
      r.mesh.rotation.z += dtSec * r.speedZ;
    }

    // Staged ending choreography:
    // 'awaiting_release' -> 'unlocking' (3.0s) -> 'opening_door' (5.0s) -> 'door_open'
    const stage = state.unlockStage || (state.completed ? 'door_open' : 'locked');
    const isUnlocking = stage === 'unlocking';
    const isOpeningOrOpen = stage === 'opening_door' || stage === 'door_open';
    const unlockP = state.unlockAnimProgress ?? 0;
    const doorP = stage === 'door_open' ? 1 : stage === 'opening_door' ? (state.doorOpenProgress ?? 0) : 0;
    this.monolithOpenProgress = doorP;
    const monolithEased =
      doorP < 0.5 ? 4 * doorP * doorP * doorP : 1 - Math.pow(-2 * doorP + 2, 3) / 2;

    const ext = state.getExtents();
    const slice = state.getSliceAtPlayerW();
    const isBlade = state.isBladeThinEnough();
    const distFrom0 = Math.min(
      Math.abs(state.thetaDeg % 180),
      Math.abs(180 - (state.thetaDeg % 180))
    );
    const isTilted = distFrom0 > 3.0;
    const activeW = state.playerPos[3];
    const isInspectingOtherW = activeW !== 0;

    // 1. Flanking W-layer reference arches (solid when player W matches, ghost otherwise)
    for (const grp of this.wLayerGroups) {
      applyPhaseToMaterial(grp.mat, activeW - grp.w, { solidThreshold: 0.55, ghostAlpha: 0.34 });
    }

    // 2. Passing Orb exact 4D geometry (Option A: eps=0.001m pure 3D slice default!)
    let hoverOffset = state.grabbed || state.hasInspectableContact ? 0 : Math.sin(this.elapsed * 2.0) * 0.04;
    if (stage === 'awaiting_release') {
      hoverOffset = Math.sin(this.elapsed * 3.2) * 0.03;
    } else if (isUnlocking) {
      const rise = 1 - Math.pow(1 - unlockP, 2);
      hoverOffset = rise * 1.55 + Math.sin(this.elapsed * (4.0 + unlockP * 10.0)) * 0.04;
    } else if (isOpeningOrOpen) {
      hoverOffset = 1.55 + monolithEased * 0.65 + Math.sin(this.elapsed * 2.2) * 0.06;
    }
    this.orbRoot.position.set(0, LEVEL14_CONFIG.orbCenterY + hoverOffset, state.orbZ);
    this.orbLight.position.set(0, LEVEL14_CONFIG.orbCenterY + hoverOffset + 0.25, state.orbZ);

    const isSlicedView = isTilted || isInspectingOtherW;
    if (slice.intersects) {
      const sx = Math.max(0.006, slice.semiX);
      const sy = Math.max(0.05, slice.semiY);
      const sz = Math.max(0.05, slice.semiZ);
      if (isSlicedView) {
        this.orbSliceCore.setEnabled(false);
        this.orbSliceDiscRoot.setEnabled(true);
        this.orbSliceDiscRoot.position.set(slice.xCenter, 0, 0);
        this.orbSliceDiscRoot.scaling.set(sx, sy, sz);
        this.orbSliceMat.emissiveColor = new B.Color3(1, 1, 1).scale(1.05 + this.sliceConfirmPulse * 0.75);
      } else {
        this.orbSliceDiscRoot.setEnabled(false);
        this.orbSliceCore.setEnabled(true);
        this.orbSliceCore.position.set(slice.xCenter, 0, 0);
        this.orbSliceCore.scaling.set(sx, sy, sz);
      }
    } else {
      this.orbSliceCore.setEnabled(false);
      this.orbSliceDiscRoot.setEnabled(false);
    }

    // 2c. Tab Side View 4D Projection Envelope (clean golden silhouette — no △/○ beacons!)
    const show4DProjection = state.viewMode === 'side_xzw' && !state.keyInserted && !state.completed;
    this.orbProjShell.setEnabled(show4DProjection);
    if (show4DProjection) {
      this.orbProjRoot.scaling.set(ext.xMax, 1.0, 1.0);
      this.orbProjShellMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(0.85);
    } else {
      this.orbProjRoot.scaling.set(1.0, 1.0, 1.0);
    }

    // Rotate the engraved alien relic sphere itself for SO(3) drag & 3s unlock spin!
    if (isUnlocking) {
      const spinAngle = unlockP * unlockP * Math.PI * 8.0;
      const tiltAngle = Math.sin(unlockP * Math.PI * 3.0) * 0.45;
      this.orbSliceCore.rotationQuaternion = B.Quaternion.FromEulerAngles(tiltAngle, spinAngle, spinAngle * 0.35);
    } else if (!isTilted && !isInspectingOtherW) {
      const [qx, qy, qz, qw] = state.orbQuat3D;
      if (!this.orbSliceCore.rotationQuaternion) {
        this.orbSliceCore.rotationQuaternion = new B.Quaternion(qx, qy, qz, qw);
      } else {
        this.orbSliceCore.rotationQuaternion.set(qx, qy, qz, qw);
      }
    } else {
      // Keep thin 4D slice aligned orthogonally to the X slit plane so semiX scaling stays exact!
      if (!this.orbSliceCore.rotationQuaternion) {
        this.orbSliceCore.rotationQuaternion = B.Quaternion.Identity();
      } else {
        this.orbSliceCore.rotationQuaternion.set(0, 0, 0, 1);
      }
    }

    // Preserve rich jade-cyan + brushed-gold inlaid texture colors during normal play;
    // ramp emissive brilliance during key insertion, 3s unlock resonance, and victory!
    let albedoTint = new B.Color3(1, 1, 1);
    let emissiveTint = new B.Color3(1, 1, 1).scale(1.05 + this.sliceConfirmPulse * 0.75);
    let lightColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
    if (stage === 'awaiting_release') {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4.2);
      emissiveTint = B.Color3.Lerp(
        new B.Color3(1, 1, 1),
        B.Color3.FromHexString(PALETTE.accent.goldWPos),
        0.35 + 0.25 * pulse
      ).scale(1.35 + 0.35 * pulse);
      lightColor = B.Color3.FromHexString(PALETTE.accent.goldWPos);
    } else if (isUnlocking) {
      const gold = B.Color3.FromHexString(PALETTE.accent.goldWPos);
      const emerald = B.Color3.FromHexString(PALETTE.accent.emerald);
      const platinum = B.Color3.FromHexString(PALETTE.accent.platinum);
      lightColor = unlockP < 0.55
        ? B.Color3.Lerp(gold, emerald, unlockP / 0.55)
        : B.Color3.Lerp(emerald, platinum, (unlockP - 0.55) / 0.45);
      emissiveTint = lightColor.scale(1.45 + unlockP * 1.65);
    } else if (isOpeningOrOpen) {
      lightColor = B.Color3.FromHexString(PALETTE.accent.platinum);
      emissiveTint = new B.Color3(1.15, 1.25, 1.22).scale(1.35);
    }
    this.orbCoreMat.albedoColor = albedoTint;
    this.orbCoreMat.emissiveColor = emissiveTint;
    this.orbLight.diffuse = lightColor;

    // 3. Third-person Astronaut 08 placement
    this.astronaut.setEnabled(state.grabbed);
    if (state.grabbed) {
      const astroZ = Math.min(LEVEL14_CONFIG.wallZMin - 0.9, state.orbZ - 1.85);
      this.astronaut.position.set(-1.05, 0, astroZ);
      this.astronaut.rotation.y = 0.42;
    }

    // 4. Focused Collision Contact Patch + Slit Edge Feedback (never blind the player with a whole-wall flash!)
    const contactX = state.observedWallOverlapX;
    this.contactPatchMesh.isVisible = contactX !== null;
    if (contactX !== null) {
      const northFace = state.orbZ > 0;
      this.contactPatchMesh.scaling.set(Math.min(0.06, Math.abs(contactX) - state.config.slitHalfWidth), 0.14, 1);
      this.contactPatchMesh.position.set(
        contactX,
        LEVEL14_CONFIG.orbCenterY,
        northFace ? LEVEL14_CONFIG.wallZMax + 0.09 : LEVEL14_CONFIG.wallZMin - 0.09
      );
      const pulse = 0.30 + 0.05 * Math.sin(this.elapsed * 6.5);
      this.contactPatchMat.alpha = Math.min(0.35, Math.max(0.30, pulse));
    }

    if (this.barrierFlash > 0.02) {
      this.barrierPlane.setEnabled(true);
      this.barrierPlane.position.z =
        state.isOrbOverlappingWallZ() ? state.orbZ : LEVEL14_CONFIG.wallZMin - 0.14;
      this.barrierMat.alpha = Math.min(0.35, this.barrierFlash * 0.34);
      this.slitLipMat.emissiveColor = B.Color3.Lerp(
        B.Color3.FromHexString(PALETTE.accent.platinum),
        B.Color3.FromHexString(PALETTE.accent.amberCoral),
        this.barrierFlash
      ).scale(1.65);
    } else if (this.sliceConfirmPulse > 0.02) {
      // Confirm thin slice fits inside the two glowing cyan-platinum slit lips!
      this.barrierPlane.setEnabled(false);
      this.slitLipMat.emissiveColor = B.Color3.Lerp(
        B.Color3.FromHexString(PALETTE.accent.platinum),
        B.Color3.FromHexString(PALETTE.accent.cyanW0),
        this.sliceConfirmPulse
      ).scale(1.65 + this.sliceConfirmPulse * 0.55);
    } else if (isUnlocking) {
      // Traveling resonance charge along both 13.6m monolith slit lips during 3s unlock!
      this.barrierPlane.setEnabled(false);
      const chargeWave = 0.5 + 0.5 * Math.sin(this.elapsed * (6.0 + unlockP * 14.0));
      const lipColor = B.Color3.Lerp(
        B.Color3.FromHexString(PALETTE.accent.goldWPos),
        B.Color3.FromHexString(PALETTE.accent.emerald),
        unlockP
      );
      this.slitLipMat.emissiveColor = lipColor.scale(1.8 + unlockP * 1.4 + chargeWave * 0.65);
    } else {
      this.barrierPlane.setEnabled(false);
      const slitColor = isBlade || isOpeningOrOpen || stage === 'awaiting_release'
        ? B.Color3.FromHexString(PALETTE.accent.emerald)
        : B.Color3.FromHexString(PALETTE.accent.platinum);
      this.slitLipMat.emissiveColor = slitColor.scale(1.65);
    }

    // 5. North target full-sphere silhouette & contour (pulses brightly on opening AND upon North arrival!)
    const showNorthTarget = !state.keyInserted && !state.completed;
    this.northTargetGhost.setEnabled(showNorthTarget);
    this.northTargetContour.setEnabled(showNorthTarget);
    if (showNorthTarget) {
      const openingBoost = this.openingPulseTimer > 0 ? 0.5 + 0.5 * Math.sin(this.elapsed * 5.2) : 0;
      const arrivalBoost = state.isOnNorthPedestal() ? 0.5 + 0.5 * Math.sin(this.elapsed * 4.5) : 0;
      const pulse = Math.max(openingBoost, arrivalBoost, this.hintHighlight ? 0.7 : 0);
      this.northTargetGhostMat.alpha = Math.min(0.35, Math.max(0.30, 0.30 + pulse * 0.05));
      this.northTargetContour.rotation.y += dtSec * (0.4 + pulse * 0.9);
      this.northRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(
        1.45 + pulse * 1.1
      );
    }

    // 5b. 3-Second Key-In-Keyhole Unlock Resonance VFX
    if (isUnlocking) {
      const orbY = LEVEL14_CONFIG.orbCenterY + hoverOffset;
      this.unlockHaloA.isVisible = true;
      this.unlockHaloB.isVisible = true;
      this.unlockHaloA.position.set(0, orbY, LEVEL14_CONFIG.orbTargetZ);
      this.unlockHaloB.position.set(0, orbY, LEVEL14_CONFIG.orbTargetZ);
      const haloScale = 0.65 + unlockP * 0.85;
      this.unlockHaloA.scaling.setAll(haloScale);
      this.unlockHaloB.scaling.setAll(haloScale * 1.12);
      this.unlockHaloA.rotation.set(unlockP * Math.PI * 5.0, unlockP * Math.PI * 3.5, 0.4);
      this.unlockHaloB.rotation.set(-unlockP * Math.PI * 4.0, unlockP * Math.PI * 6.0, -0.5);
      this.unlockHaloAMat.alpha = Math.min(0.34, 0.12 + unlockP * 0.22);
      this.unlockHaloBMat.alpha = Math.min(0.34, 0.10 + unlockP * 0.24);

      // Skyward resonance pillar shoots up during 0.25..1.0 of the 3s unlock
      const beamP = Math.max(0, Math.min(1, (unlockP - 0.18) / 0.62));
      this.victoryBeam.isVisible = beamP > 0.01;
      this.victoryBeam.scaling.set(0.55 + beamP * 0.65, Math.max(0.02, beamP), 0.55 + beamP * 0.65);
      this.victoryBeamMat.alpha = Math.min(0.34, 0.14 + beamP * 0.20);

      // Climax shockwave ring expands from keyhole & across monolith slit face (t = 1.95s..3.0s)
      const shockP = Math.max(0, (unlockP - 0.62) / 0.38);
      if (shockP > 0) {
        this.unlockShockRing.isVisible = true;
        this.unlockShockRing.position.set(0, orbY, LEVEL14_CONFIG.orbTargetZ);
        this.unlockShockRing.scaling.setAll(1.0 + shockP * 4.2);
        this.unlockShockMat.alpha = Math.max(0.02, 0.34 * (1 - shockP));

        this.slitShockRing.isVisible = true;
        this.slitShockRing.scaling.setAll(0.7 + shockP * 5.6);
        this.slitShockMat.alpha = Math.max(0.02, 0.34 * (1 - shockP));
      } else {
        this.unlockShockRing.isVisible = false;
        this.slitShockRing.isVisible = false;
      }

      const ringPulse = 1.8 + unlockP * 1.8 + Math.sin(this.elapsed * 12) * 0.4;
      this.northRingMat.emissiveColor = B.Color3.Lerp(
        B.Color3.FromHexString(PALETTE.accent.goldWPos),
        B.Color3.FromHexString(PALETTE.accent.emerald),
        unlockP
      ).scale(ringPulse);
      this.orbLight.intensity = 2.4 + unlockP * 3.2;
    } else {
      this.unlockHaloA.isVisible = false;
      this.unlockHaloB.isVisible = false;
      this.unlockShockRing.isVisible = false;
      this.slitShockRing.isVisible = false;
    }

    // 6. Monumental 5-Second Door Opening: Twin 13.6m Monoliths slide wide open (±3.85m -> 7.86m grand gateway!)
    this.monolithLeftGroup.position.x = -monolithEased * 3.85;
    this.monolithRightGroup.position.x = monolithEased * 3.85;
    if (this.slitVolumetricCurtain) {
      this.slitVolumetricCurtain.isVisible = this.monolithOpenProgress < 0.12;
    }

    if (isOpeningOrOpen) {
      this.victoryBeam.isVisible = true;
      this.victoryBeam.scaling.set(1, 1, 1);
      this.victoryBeamMat.alpha = 0.30;
      this.gateOpenProgress = doorP;
      this.gateLeft.position.x = -2.22 - monolithEased * 3.8;
      this.gateRight.position.x = 2.22 + monolithEased * 3.8;
      this.gateEmblem.scaling.setAll(1 + monolithEased * 0.25);
      this.gateEmblem.isVisible = doorP < 0.7;
      this.northRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.platinum).scale(1.8);
      this.orbLight.intensity = 3.2;

      // Ignite North Teleportation Pad rings & emerald warp column as the walls part
      this.portalBeam.isVisible = doorP > 0.1;
      this.portalHaloOuter.rotation.z += dtSec * 0.95;
      this.portalHaloOuter.rotation.y = Math.sin(this.elapsed * 0.8) * 0.22;
      this.portalHaloInner.rotation.z -= dtSec * 1.45;
      this.portalHaloInner.rotation.y = -Math.sin(this.elapsed * 1.1) * 0.28;
      const portalPulse = 1.45 + 0.35 * Math.sin(this.elapsed * 3.4);
      this.portalCoreMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.emerald).scale(portalPulse * Math.max(0.25, monolithEased));
      this.portalLight.intensity = 3.2 * monolithEased;
    } else if (!isUnlocking) {
      this.victoryBeam.isVisible = false;
      this.gateOpenProgress = 0;
      this.gateLeft.position.x = -2.22;
      this.gateRight.position.x = 2.22;
      this.gateEmblem.scaling.setAll(1);
      this.gateEmblem.isVisible = true;
      if (stage === 'awaiting_release') {
        const pulse = 1.65 + 0.55 * Math.sin(this.elapsed * 4.5);
        this.northRingMat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.emerald).scale(pulse);
        this.orbLight.intensity = 2.8;
      } else {
        this.orbLight.intensity = 2.2;
      }

      // Dormant Teleportation Pad
      this.portalBeam.isVisible = false;
      this.portalHaloOuter.rotation.set(Math.PI * 0.5, 0, 0);
      this.portalHaloInner.rotation.set(Math.PI * 0.5, 0, 0);
      this.portalCoreMat.emissiveColor = B.Color3.FromHexString('#1B3026');
      this.portalLight.intensity = 0.0;
    }
  }
}
