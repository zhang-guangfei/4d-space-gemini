/**
 * Beyond 3D — Prologue Master Scene Facade (`PrologueScene`, Contract D)
 *
 * Orchestrates the 3 independent cinema segments across the 75-second timeline:
 * - P1 (0-26s): SegmentP1Voyage  — S0A opening titles, S0B-1 cryo corridor, S0B-2 FTL warp, S0C coord card
 * - P2 (26-55s): SegmentP2Abyss  — S1 calm cabin, S2 mercury veil +2s alert, S3 star extinction & 8-cell megastructure
 * - P3 (55-75s): SegmentP3Origami — S4-1 dive/sealed box/X-ray/shards, S4-2 08 号 wake-up, S5 90° origami, S6 polar-day white
 *
 * Quality Spec v1.0 & Redline Guarantees:
 * - 3 Rendering Groups, camera.minZ = 0.08, camera.maxZ = 1200 (full S3 cosmic scale!)
 * - 3 6-face procedural IBL presets (zero crimson emergency wash), >= 20 PBR/GLSL materials
 * - DefaultRenderingPipeline (ACES Filmic, Bloom, FXAA, Sharpen, Vignette, Grain) + FOGMODE_EXP2
 * - Sculpted 3-point lighting + PCF ShadowGenerator(1024) + real-time cabin MirrorTexture(512)
 * - 100% ignores user input.yaw/input.pitch (locked to deterministic cinema spline)
 * - Strict Ghost-safe translucency verification (disableDepthWrite = true, needDepthPrePass = false)
 * - Zero-leak disposal of all 3 segments, textures, lights, shadow generator, mirror, materials, IBLs, and pipeline
 */

import { configureRenderingGroups } from '../engine/phase-materials.js';
import {
  applyCinemaGrading,
  createPrologueIBLSet,
  createPrologueMaterialBank,
  setupPrologueCinemaPipeline,
} from '../engine/prologue-materials.js';
import { SegmentP1Voyage } from './prologue/segment-p1-voyage.js';
import { SegmentP2Abyss } from './prologue/segment-p2-abyss.js';
import { SegmentP3Origami } from './prologue/segment-p3-origami.js';

const CABIN_MIRROR_SUBBEATS = new Set(['S0B-1', 'S1', 'S4-1', 'S4-2', 'S5']);

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class PrologueScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.B = globalThis.BABYLON;
    this.disposed = false;

    const B = this.B;

    // 1. Rendering groups & cosmic-scale camera frustum (minZ 0.08, maxZ 1200)
    configureRenderingGroups(scene);
    camera.rotationQuaternion = null;
    camera.minZ = 0.08;
    camera.maxZ = 1200;
    camera.fov = 0.84;
    camera.position.set(0, 0, -12);
    camera.setTarget(new B.Vector3(0, 0, 20));

    // 2. Atmospheric EXP2 fog & deep-space clear defaults
    scene.clearColor = new B.Color4(0.008, 0.016, 0.04, 1.0);
    scene.ambientColor = new B.Color3(0.05, 0.07, 0.11);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogColor = B.Color3.FromHexString('#040710');
    scene.fogDensity = 0.0035;

    // 3. 3-Mood 6-face procedural IBL set, >= 20 PBR/Shader material bank, ACES+Bloom cinema pipeline
    this.iblSet = createPrologueIBLSet(scene);
    this.materials = createPrologueMaterialBank(scene);
    this.pipeline = setupPrologueCinemaPipeline(scene, camera);

    // 4. Root transform & sculpted 3-point cinema lighting rig
    this.root = new B.TransformNode('prologue_master_root', scene);

    this.hemiLight = new B.HemisphericLight('pro_cinema_hemi', new B.Vector3(0, 1, 0), scene);
    this.hemiLight.intensity = 0.22;
    this.hemiLight.diffuse = new B.Color3(0.76, 0.88, 1.0);
    this.hemiLight.groundColor = new B.Color3(0.06, 0.09, 0.14);

    this.keyLight = new B.DirectionalLight('pro_cinema_key', new B.Vector3(-0.34, -0.78, 0.52), scene);
    this.keyLight.position = new B.Vector3(8.0, 16.0, -8.0);
    this.keyLight.intensity = 1.35;
    this.keyLight.diffuse = new B.Color3(0.96, 0.98, 1.0);
    this.keyLight.specular = new B.Color3(1.0, 0.99, 0.96);
    this.keyLight.autoCalcShadowZBounds = true;
    this.keyLight.shadowMinZ = 0.4;
    this.keyLight.shadowMaxZ = 65;

    this.rimLight = new B.DirectionalLight('pro_cinema_rim', new B.Vector3(0.45, -0.22, -0.86), scene);
    this.rimLight.intensity = 0.62;
    this.rimLight.diffuse = B.Color3.FromHexString('#8CE8F2');
    this.rimLight.specular = B.Color3.FromHexString('#C8F6FF');

    this.heroAccentLight = new B.PointLight('pro_cinema_accent', new B.Vector3(0, 2.4, 2.2), scene);
    this.heroAccentLight.diffuse = B.Color3.FromHexString('#4DE6D3');
    this.heroAccentLight.specular = B.Color3.FromHexString('#C8F6FF');
    this.heroAccentLight.intensity = 0.0;
    this.heroAccentLight.range = 48;

    // 5. PCF Soft ShadowGenerator(1024)
    this.shadowGenerator = new B.ShadowGenerator(1024, this.keyLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
    this.shadowGenerator.bias = 0.0006;
    this.shadowGenerator.normalBias = 0.015;
    this.shadowGenerator.darkness = 0.18;

    // 6. Real-Time Cabin MirrorTexture(512) (active only during cabin/corridor shots)
    this.mirrorRenderList = [];
    this.mirrorTex = new B.MirrorTexture('prologue_cabin_mirror', 512, scene, true);
    this.mirrorTex.mirrorPlane = new B.Plane(0, -1, 0, 0);
    this.mirrorTex.level = 0.36;
    this.mirrorTex.adaptiveBlurKernel = 16;
    this.mirrorTex.renderList = [];
    this.materials.cabinDeckMirror.reflectionTexture = null;
    this._isCabinMirrorActive = false;

    // 7. Contract D sharedRig passed to all 3 segments
    this._shadowCasterSet = new Set();
    this._mirrorMeshSet = new Set();
    this.sharedRig = {
      root: this.root,
      shadowGenerator: this.shadowGenerator,
      mirrorRenderList: this.mirrorRenderList,
      registerShadowCaster: (mesh) => {
        if (!mesh || this._shadowCasterSet.has(mesh)) return;
        this._shadowCasterSet.add(mesh);
        try {
          this.shadowGenerator.addShadowCaster(mesh, false);
        } catch {
          // Ignore meshes incapable of casting shadows
        }
      },
      registerMirrorMesh: (mesh) => {
        if (!mesh || this._mirrorMeshSet.has(mesh)) return;
        this._mirrorMeshSet.add(mesh);
        this.mirrorRenderList.push(mesh);
      },
    };

    // 8. Instantiate P1, P2, P3 Visual Segments
    this.segments = {
      P1: new SegmentP1Voyage(scene, this.materials, this.sharedRig),
      P2: new SegmentP2Abyss(scene, this.materials, this.sharedRig),
      P3: new SegmentP3Origami(scene, this.materials, this.sharedRig),
    };

    this._activeSegmentId = null;
    this._lastSnapshot = null;
    this._setActiveSegment('P1');
  }

  _setActiveSegment(segmentId) {
    if (this._activeSegmentId === segmentId) return;
    this._activeSegmentId = segmentId;
    for (const [id, seg] of Object.entries(this.segments)) {
      if (seg && typeof seg.setActive === 'function') {
        seg.setActive(id === segmentId);
      }
    }
  }

  _applyCamera(snapshot) {
    const B = this.B;
    const cam = snapshot.camera;
    if (!cam) return;

    const t = snapshot.elapsedSec || 0;
    const shakeAmp = clamp(Number(cam.shake) || 0, 0, 0.025);
    const dx = shakeAmp > 0 ? shakeAmp * Math.sin(t * 9.3 + 0.4) : 0;
    const dy = shakeAmp > 0 ? shakeAmp * 0.72 * Math.cos(t * 7.7 + 1.1) : 0;
    const dz = shakeAmp > 0 ? shakeAmp * 0.45 * Math.sin(t * 5.9) : 0;

    this.camera.rotationQuaternion = null;
    this.camera.minZ = 0.08;
    this.camera.maxZ = 1200;
    this.camera.position.set(cam.pos[0] + dx, cam.pos[1] + dy, cam.pos[2] + dz);
    this.camera.setTarget(new B.Vector3(cam.target[0], cam.target[1], cam.target[2]));
    this.camera.rotation.z = cam.roll || 0;
    this.camera.fov = cam.fov || 0.86;
  }

  _applyMoodAndLighting(snapshot) {
    const B = this.B;
    const sub = snapshot.subBeatId || snapshot.shotId;

    // 1. IBL Preset & Intensity
    this.iblSet.applyPreset(snapshot.iblPreset, snapshot.iblIntensity);

    // 2. ClearColor & EXP2 Depth Fog
    if (snapshot.fog) {
      const clearCol = B.Color3.FromHexString(snapshot.fog.clearColorHex || '#02050C');
      this.scene.clearColor.set(clearCol.r, clearCol.g, clearCol.b, 1.0);
      this.scene.fogMode = B.Scene.FOGMODE_EXP2;
      this.scene.fogColor = B.Color3.FromHexString(snapshot.fog.colorHex || '#040812');
      this.scene.fogDensity = typeof snapshot.fog.density === 'number' ? snapshot.fog.density : 0.004;
    }

    // 3. Sculpted 3-Point Cinema Lighting per Sub-Beat
    if (sub === 'S0A' || sub === 'S0C') {
      this.hemiLight.intensity = 0.16;
      this.hemiLight.diffuse.set(0.55, 0.72, 0.96);
      this.hemiLight.groundColor.set(0.03, 0.05, 0.09);
      this.keyLight.intensity = 0.62;
      this.keyLight.direction.set(-0.3, -0.65, 0.7);
      this.rimLight.intensity = 0.36;
      this.heroAccentLight.intensity = 0.0;
    } else if (sub === 'S0B-1') {
      this.hemiLight.intensity = 0.34;
      this.hemiLight.diffuse.set(0.76, 0.88, 1.0);
      this.hemiLight.groundColor.set(0.09, 0.14, 0.22);
      this.keyLight.position.set(4.5, 9.5, -4.0);
      this.keyLight.direction.set(-0.28, -0.84, 0.46);
      this.keyLight.intensity = 1.42;
      this.keyLight.diffuse.set(0.92, 0.96, 1.0);
      this.rimLight.intensity = 0.56;
      this.heroAccentLight.position.set(0, 2.5, 4.5);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#58A6FF');
      this.heroAccentLight.intensity = 1.15;
      this.heroAccentLight.range = 18;
    } else if (sub === 'S0B-2') {
      this.hemiLight.intensity = 0.26;
      this.hemiLight.diffuse.set(0.68, 0.84, 1.0);
      this.hemiLight.groundColor.set(0.05, 0.08, 0.14);
      this.keyLight.position.set(-16, 18, -14);
      this.keyLight.direction.set(0.42, -0.58, 0.69);
      this.keyLight.intensity = 1.72;
      this.keyLight.diffuse.set(1.0, 0.97, 0.92);
      this.rimLight.intensity = 0.88;
      this.heroAccentLight.position.set(0, 1.2, 2.0);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#4DE6D3');
      this.heroAccentLight.intensity = 2.2;
      this.heroAccentLight.range = 42;
    } else if (sub === 'S1') {
      // Restrained base lights so cabin's warm amber desk lamp & cool ice-blue cryo-bay contrast richly!
      this.hemiLight.intensity = 0.32;
      this.hemiLight.diffuse.set(0.76, 0.86, 0.98);
      this.hemiLight.groundColor.set(0.09, 0.12, 0.18);
      this.keyLight.position.set(4.2, 8.2, 4.5);
      this.keyLight.direction.set(-0.34, -0.85, -0.4);
      this.keyLight.intensity = 1.26;
      this.keyLight.diffuse.set(0.98, 0.95, 0.9);
      this.rimLight.intensity = 0.48;
      this.heroAccentLight.position.set(0, 2.4, 5.2);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#7FD8F5');
      this.heroAccentLight.intensity = 0.62;
      this.heroAccentLight.range = 14;
    } else if (sub === 'S2') {
      const a = clamp(snapshot.alertLevel || 0, 0, 1);
      this.hemiLight.intensity = 0.24;
      this.hemiLight.diffuse.set(0.7, 0.84, 1.0);
      this.hemiLight.groundColor.set(0.05, 0.08, 0.14);
      this.keyLight.position.set(-14, 15, 6);
      this.keyLight.direction.set(0.55, -0.62, -0.56);
      this.keyLight.intensity = 1.58;
      this.keyLight.diffuse.set(0.96, 0.98, 1.0);
      this.rimLight.intensity = 0.84;
      this.heroAccentLight.position.set(0, 1.8, 4.0);
      const calmCyan = B.Color3.FromHexString('#B4E8FA');
      const alertAmber = B.Color3.FromHexString('#F59E0B');
      this.heroAccentLight.diffuse = B.Color3.Lerp(calmCyan, alertAmber, a);
      this.heroAccentLight.intensity = 1.25 + a * 1.45;
      this.heroAccentLight.range = 34;
    } else if (sub === 'S3') {
      this.hemiLight.intensity = 0.14;
      this.hemiLight.diffuse.set(0.45, 0.68, 0.9);
      this.hemiLight.groundColor.set(0.02, 0.04, 0.08);
      this.keyLight.position.set(-18, 28, -32);
      this.keyLight.direction.set(0.32, -0.55, 0.77);
      this.keyLight.intensity = 1.82;
      this.keyLight.diffuse = B.Color3.FromHexString('#D4F5FF');
      this.rimLight.intensity = 0.92;
      this.heroAccentLight.position.set(0, 16, 48);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#4DE6D3');
      this.heroAccentLight.intensity = 2.8;
      this.heroAccentLight.range = 240;
    } else if (sub === 'S4-1') {
      const xray = clamp(snapshot.xrayWaveProgress || 0, 0, 1);
      const xrayPulse = xray > 0 && xray < 1 ? Math.sin(xray * Math.PI) : 0;
      this.hemiLight.intensity = 0.35 + xrayPulse * 0.12;
      this.hemiLight.diffuse.set(0.76, 0.88, 1.0);
      this.hemiLight.groundColor.set(0.08, 0.12, 0.18);
      this.keyLight.position.set(4.0, 8.2, 4.2);
      this.keyLight.direction.set(-0.34, -0.85, -0.4);
      this.keyLight.intensity = 1.48;
      this.keyLight.diffuse.set(0.95, 0.97, 1.0);
      this.rimLight.intensity = 0.6;
      this.heroAccentLight.position.set(0, 1.8, 2.4);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#4DE6D3');
      this.heroAccentLight.intensity = 0.85 + xrayPulse * 2.1;
      this.heroAccentLight.range = 16;
    } else if (sub === 'S4-2') {
      const wake = clamp(snapshot.cryoWakeupProgress || 0, 0, 1);
      this.hemiLight.intensity = 0.32;
      this.hemiLight.diffuse.set(0.72, 0.92, 0.88);
      this.hemiLight.groundColor.set(0.07, 0.14, 0.14);
      this.keyLight.position.set(3.5, 8.0, 2.5);
      this.keyLight.direction.set(-0.42, -0.82, -0.39);
      this.keyLight.intensity = 1.35;
      this.rimLight.intensity = 0.55;
      this.heroAccentLight.position.set(-2.1, 2.1, -1.6);
      this.heroAccentLight.diffuse = B.Color3.FromHexString('#69F0AE');
      this.heroAccentLight.intensity = 1.6 + wake * 1.1;
      this.heroAccentLight.range = 12;
    } else if (sub === 'S5') {
      const f = clamp(snapshot.origamiFoldProgress || 0, 0, 1);
      this.hemiLight.intensity = lerp(0.45, 1.05, f);
      this.hemiLight.diffuse = B.Color3.Lerp(
        B.Color3.FromHexString('#A8D8F0'),
        B.Color3.FromHexString('#FFFFFF'),
        f
      );
      this.hemiLight.groundColor = B.Color3.Lerp(
        B.Color3.FromHexString('#142030'),
        B.Color3.FromHexString('#DCEAF6'),
        f
      );
      this.keyLight.position.set(4.0, 10.0, 4.0);
      this.keyLight.direction.set(-0.28, -0.86, -0.42);
      this.keyLight.intensity = lerp(1.55, 1.85, f);
      this.keyLight.diffuse.set(1.0, 0.99, 0.96);
      this.rimLight.intensity = lerp(0.68, 0.92, f);
      this.heroAccentLight.position.set(0, 2.6, 4.2);
      this.heroAccentLight.diffuse = B.Color3.Lerp(
        B.Color3.FromHexString('#4DE6D3'),
        B.Color3.FromHexString('#FFF6D6'),
        f
      );
      this.heroAccentLight.intensity = lerp(1.6, 3.2, f);
      this.heroAccentLight.range = 28;
    } else {
      // S6: Radiant polar-day pure white
      const u = clamp(snapshot.shotProgress || 0, 0, 1);
      this.hemiLight.intensity = lerp(1.05, 1.45, u);
      this.hemiLight.diffuse.set(1.0, 1.0, 1.0);
      this.hemiLight.groundColor.set(0.92, 0.96, 1.0);
      this.keyLight.intensity = 1.85;
      this.keyLight.diffuse.set(1.0, 1.0, 1.0);
      this.rimLight.intensity = 0.9;
      this.heroAccentLight.position.set(0, 2.2, 5.0);
      this.heroAccentLight.diffuse.set(1.0, 1.0, 1.0);
      this.heroAccentLight.intensity = lerp(3.2, 4.2, u);
      this.heroAccentLight.range = 40;
    }

    // 4. Advance shared shader clock & apply cinema grading
    this.materials.updateShaders(snapshot.elapsedSec || 0);
    applyCinemaGrading(this.pipeline, snapshot.post);
  }

  _syncMirrorForSnapshot(snapshot) {
    const sub = snapshot.subBeatId || snapshot.shotId;
    const wantCabinMirror = CABIN_MIRROR_SUBBEATS.has(sub);
    this._isCabinMirrorActive = wantCabinMirror;

    if (wantCabinMirror) {
      const activeMeshes = [];
      for (const m of this.mirrorRenderList) {
        if (m && !m.isDisposed?.() && m.isEnabled?.() && m.isVisible) {
          activeMeshes.push(m);
        }
      }
      this.mirrorTex.renderList = activeMeshes;
      this.mirrorTex.refreshRate = this.B.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
      if (this.materials.cabinDeckMirror.reflectionTexture !== this.mirrorTex) {
        this.materials.cabinDeckMirror.reflectionTexture = this.mirrorTex;
      }
    } else {
      this.mirrorTex.renderList = [];
      this.mirrorTex.refreshRate = this.B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      if (this.materials.cabinDeckMirror.reflectionTexture !== null) {
        this.materials.cabinDeckMirror.reflectionTexture = null;
      }
    }
  }

  /**
   * Synchronize active segment, camera, IBL, lights, fog, shadows, mirror & post-processing
   * purely from `state.getSnapshot()`. 100% ignores `input.yaw`/`input.pitch`!
   */
  syncFromState(state, input, dtSec = 0) {
    void input;
    if (this.disposed || !state) return;

    const snapshot = state.getSnapshot();
    if (!snapshot) return;
    this._lastSnapshot = snapshot;

    this._setActiveSegment(snapshot.segmentId);
    this._applyCamera(snapshot);
    this._applyMoodAndLighting(snapshot);

    const activeSeg = this.segments[snapshot.segmentId];
    if (activeSeg && typeof activeSeg.evaluate === 'function') {
      activeSeg.evaluate(snapshot, dtSec);
    }

    this._syncMirrorForSnapshot(snapshot);
  }

  /**
   * Deterministic jump to any timestamp without advancing `state.elapsedSec`.
   * Pre-warms active segment particles so the very first rendered frame is lush and full.
   */
  seekToState(state, { warmupTicks = 18 } = {}) {
    if (this.disposed || !state) return;
    const snapshot = state.getSnapshot();
    if (!snapshot) return;

    // 1. Activate target segment & configure emitters/positions
    this.syncFromState(state, null, 0);

    // 2. Deterministically pre-warm active segment particles
    const activeSeg = this.segments[snapshot.segmentId];
    if (activeSeg && typeof activeSeg.prewarmParticles === 'function' && warmupTicks > 0) {
      activeSeg.prewarmParticles(warmupTicks);
    }

    // 3. Re-sync mirror list & camera projection matrices cleanly
    this.syncFromState(state, null, 0);
    this.camera.getViewMatrix(true);
    this.camera.getProjectionMatrix(true);
  }

  _collectGhostViolations() {
    const B = this.B;
    const bankCheck = this.materials.verifyGhostInvariants();
    const violations = [...bankCheck.violations];
    const seen = new Set(this.materials._allEntries.map(([, m]) => m));

    for (const mat of this.scene.materials) {
      if (!mat || seen.has(mat)) continue;
      if (Boolean(mat.needDepthPrePass)) {
        violations.push(`${mat.name || 'unnamed'}: needDepthPrePass must be false`);
      }
      const isAlphaAdd = B?.Engine && mat.alphaMode === B.Engine.ALPHA_ADD;
      const needsBlend = typeof mat.needAlphaBlending === 'function' ? Boolean(mat.needAlphaBlending()) : false;
      const isTranslucent =
        (typeof mat.alpha === 'number' && mat.alpha < 0.99) || isAlphaAdd || needsBlend;
      if (isTranslucent && mat.disableDepthWrite !== true) {
        violations.push(`${mat.name || 'unnamed'}: translucent material must set disableDepthWrite = true`);
      }
    }
    return violations;
  }

  getPrologueDiagnostics() {
    const s = this.scene;
    const mats = s.materials.map((m) => (m?.getClassName ? m.getClassName() : 'unknown'));
    const activeMeshCount = s.meshes.filter((m) => m && !m.isDisposed?.() && m.isEnabled?.() && m.isVisible).length;
    const shadowGens = s.lights.filter((l) => l.getShadowGenerator && l.getShadowGenerator()).length;
    const mirrorTex = s.textures
      ? s.textures.filter(
          (t) => (t?.getClassName && t.getClassName().includes('Mirror')) || Boolean(t?.mirrorPlane)
        ).length
      : 0;
    const particles = s.particleSystems ? s.particleSystems.length : 0;
    const postProcs = s.postProcessRenderPipelineManager?._renderPipelines
      ? Object.keys(s.postProcessRenderPipelineManager._renderPipelines)
      : [];

    const segmentDiagnostics = {};
    for (const [id, seg] of Object.entries(this.segments)) {
      if (seg && typeof seg.getDiagnostics === 'function') {
        segmentDiagnostics[id] = seg.getDiagnostics();
      }
    }

    return {
      activeSegment: this._activeSegmentId,
      activeMeshCount,
      pbrCount: mats.filter((x) => x.includes('PBR')).length,
      envTex: Boolean(s.environmentTexture),
      fogMode: s.fogMode,
      particles,
      postProcs,
      shadowGens,
      mirrorTex,
      cabinMirrorActive: this._isCabinMirrorActive,
      ghostViolations: this._collectGhostViolations(),
      segments: segmentDiagnostics,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    for (const seg of Object.values(this.segments)) {
      try {
        seg?.dispose?.();
      } catch {
        // ignore
      }
    }

    if (this.materials?.cabinDeckMirror) {
      this.materials.cabinDeckMirror.reflectionTexture = null;
    }
    try {
      this.mirrorTex?.dispose?.();
    } catch {
      // ignore
    }
    try {
      this.shadowGenerator?.dispose?.();
    } catch {
      // ignore
    }
    try {
      this.pipeline?.dispose?.();
    } catch {
      // ignore
    }
    for (const light of [this.hemiLight, this.keyLight, this.rimLight, this.heroAccentLight]) {
      try {
        light?.dispose?.();
      } catch {
        // ignore
      }
    }
    try {
      this.materials?.dispose?.();
    } catch {
      // ignore
    }
    try {
      this.iblSet?.dispose?.();
    } catch {
      // ignore
    }
    try {
      this.root?.dispose?.();
    } catch {
      // ignore
    }
    this.mirrorRenderList.length = 0;
    this._shadowCasterSet.clear();
    this._mirrorMeshSet.clear();
  }
}
