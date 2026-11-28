/**
 * Beyond 3D — Shared Hero Asset Factories & Spline Utilities for Prologue (P1, P2, P3)
 *
 * Implements Contract C of PROJECT.md:
 * - Math & Spline helpers: clamp, lerp, smoothstep, easeInOutCubic, easeOutExpo, evalCatmullRom3
 * - createFlagshipVoyager: multi-part PBR flagship「远航者号」with dual counter-rotating warp rings
 * - createEscortVessel: sleek escort frigate for deep-space fleet chevron formation
 * - createCryoPodUnit: reusable sculpted cryo-pod with articulated frosted canopy & dynamic plaque
 * - createScienceCabinCore: curved-bow Science Cabin with reflective mirror deck, warm amber lab desk,
 *   sculpted 07 号 Lin Xia figure, port cryo-bay with hero 08 号 pod, and 90° origami fold pivots
 */

import { PALETTE, RENDER_GROUPS } from '../../engine/phase-materials.js';

// ---------------------------------------------------------------------------
// Math & Catmull-Rom Spline Utilities
// ---------------------------------------------------------------------------

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

export function easeOutExpo(t) {
  const u = clamp(t, 0, 1);
  return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
}

function toTuple3(p) {
  if (Array.isArray(p)) return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
  return [p?.x ?? 0, p?.y ?? 0, p?.z ?? 0];
}

/**
 * Evaluate a smooth 3D Catmull-Rom spline over `points` at normalized parameter `u ∈ [0, 1]`.
 * Accepts either `[x, y, z]` tuples or `{ x, y, z }` objects; returns `[x, y, z]`.
 */
export function evalCatmullRom3(points, u) {
  if (!Array.isArray(points) || points.length === 0) return [0, 0, 0];
  if (points.length === 1) return toTuple3(points[0]);

  const t = clamp(Number.isFinite(u) ? u : 0, 0, 1);
  const segCount = points.length - 1;
  const scaled = t * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - i;

  const p0 = toTuple3(points[Math.max(0, i - 1)]);
  const p1 = toTuple3(points[i]);
  const p2 = toTuple3(points[Math.min(segCount, i + 1)]);
  const p3 = toTuple3(points[Math.min(segCount, i + 2)]);

  const tt = localT * localT;
  const ttt = tt * localT;

  const out = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    out[axis] =
      0.5 *
      (2 * p1[axis] +
        (-p0[axis] + p2[axis]) * localT +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * tt +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * ttt);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal Dynamic Texture Helpers (Cryo Pod Plaques & Star-Chart Console)
// ---------------------------------------------------------------------------

function paintCryoPlaque(tex, title, subtitle, accentHex) {
  const ctx = tex.getContext();
  const w = 512;
  const h = 192;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0E1C2F');
  grad.addColorStop(0.55, '#091423');
  grad.addColorStop(1, '#060D18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle backlit glass micro-scanlines
  ctx.fillStyle = 'rgba(200, 232, 255, 0.035)';
  for (let sy = 16; sy < h - 16; sy += 6) {
    ctx.fillRect(12, sy, w - 24, 1.5);
  }

  // Crisp illuminated metallic bezel border & corner HUD brackets
  ctx.strokeStyle = 'rgba(196, 224, 248, 0.42)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = accentHex;
  ctx.fillRect(10, 10, w - 20, 11);
  ctx.fillRect(10, h - 22, 62, 10);
  ctx.fillRect(w - 72, h - 22, 62, 10);

  // Corner precision fiducial ticks
  ctx.fillStyle = 'rgba(244, 248, 253, 0.72)';
  ctx.fillRect(18, 28, 16, 3);
  ctx.fillRect(18, 28, 3, 16);
  ctx.fillRect(w - 34, 28, 16, 3);
  ctx.fillRect(w - 21, 28, 3, 16);

  // Subtle vital-sign waveform trace in lower band
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.6;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(84, h - 18);
  ctx.lineTo(172, h - 18);
  ctx.lineTo(192, h - 40);
  ctx.lineTo(212, h - 8);
  ctx.lineTo(232, h - 25);
  ctx.lineTo(256, h - 18);
  ctx.lineTo(428, h - 18);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // High-contrast backlit typography with subtle phosphor bloom
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 12;
  ctx.font = '700 76px "JetBrains Mono", "PingFang SC", ui-monospace, sans-serif';
  ctx.fillStyle = '#F7FBFF';
  ctx.fillText(title, w * 0.5, 78);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 8;
  ctx.font = '700 35px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = accentHex;
  ctx.fillText(subtitle, w * 0.5, 138);
  ctx.restore();

  tex.update();
}

function createStarChartConsoleTexture(scene, name) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(name, { width: 512, height: 320 }, scene, true);
  const ctx = tex.getContext();

  const bg = ctx.createLinearGradient(0, 0, 0, 320);
  bg.addColorStop(0, '#0C1826');
  bg.addColorStop(1, '#08101A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = 'rgba(77, 230, 211, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 492, 300);

  // Polar astronomical grid
  const cx = 190;
  const cy = 172;
  for (const r of [42, 82, 118]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 130, cy);
  ctx.lineTo(cx + 130, cy);
  ctx.moveTo(cx, cy - 125);
  ctx.lineTo(cx, cy + 125);
  ctx.stroke();

  // Golden trajectory arc of 7th FTL cruise
  ctx.strokeStyle = '#F7C346';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - 18, cy + 12, 92, -1.25, 0.45);
  ctx.stroke();

  // Star waypoints
  const stars = [
    [130, 120, '#A5FCF2', 4],
    [190, 172, '#F7C346', 5],
    [248, 106, '#4DE6D3', 4],
    [275, 198, '#E8EFF8', 3],
    [115, 226, '#58A6FF', 3.5],
  ];
  for (const [sx, sy, col, rad] of stars) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Right-hand clean navigation telemetry column
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#4DE6D3';
  ctx.fillText('VOYAGER · LOG 47', 330, 32);

  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillStyle = '#E8EFF8';
  ctx.fillText('DIST : 412.0 LY', 330, 74);
  ctx.fillText('WARP : #07 CRUISE', 330, 104);
  ctx.fillStyle = '#F7C346';
  ctx.fillText('CREW : 07 ACTIVE', 330, 134);
  ctx.fillStyle = '#58A6FF';
  ctx.fillText('CRYO : 08 STASIS', 330, 164);

  // Subtle bar readout
  for (let i = 0; i < 10; i += 1) {
    const bh = 16 + ((i * 19) % 44);
    ctx.fillStyle = i % 3 === 0 ? '#F7C346' : '#4DE6D3';
    ctx.fillRect(332 + i * 15, 278 - bh, 9, bh);
  }

  tex.update();
  return tex;
}

// ---------------------------------------------------------------------------
// 1. Flagship「远航者号」Hero Factory (Length ~14m along +Z)
// ---------------------------------------------------------------------------

export function createFlagshipVoyager(scene, materials, namePrefix = 'voyager') {
  const B = globalThis.BABYLON;
  const root = new B.TransformNode(`${namePrefix}_root`, scene);
  const ownedMats = [];

  const trackMat = (mat) => {
    ownedMats.push(mat);
    return mat;
  };

  // Dedicated warm cabin interior core glow (visible inside recessed panoramic bow dome)
  const cabinWarmCoreMat = trackMat(new B.StandardMaterial(`${namePrefix}_cabin_glow`, scene));
  cabinWarmCoreMat.diffuseColor = B.Color3.FromHexString('#FFC67A');
  cabinWarmCoreMat.emissiveColor = B.Color3.FromHexString('#FFB85C').scale(1.25);
  cabinWarmCoreMat.disableLighting = true;
  cabinWarmCoreMat.disableDepthWrite = false;
  cabinWarmCoreMat.needDepthPrePass = false;

  // Dedicated dynamic alert beacon material for bow crown & wingtip strobes
  const alertBeaconMat = trackMat(new B.StandardMaterial(`${namePrefix}_alert_beacon`, scene));
  alertBeaconMat.diffuseColor = B.Color3.FromHexString('#4DE6D3');
  alertBeaconMat.emissiveColor = B.Color3.FromHexString('#4DE6D3').scale(1.1);
  alertBeaconMat.disableLighting = true;
  alertBeaconMat.disableDepthWrite = false;
  alertBeaconMat.needDepthPrePass = false;

  // 1) Sculpted Forward Bow Needle & Sensor Probe (z = +5.0 .. +7.4)
  const bowCone = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_bow_cone`,
    { diameterTop: 0.14, diameterBottom: 1.92, height: 2.4, tessellation: 24 },
    scene
  );
  bowCone.rotation.x = Math.PI * 0.5;
  bowCone.scaling.set(1.08, 1.0, 0.78);
  bowCone.position.set(0, 0.02, 5.85);
  bowCone.material = materials.hullTitanium;
  bowCone.parent = root;

  const sensorProbe = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_sensor_mast`,
    { diameterTop: 0.03, diameterBottom: 0.11, height: 1.15, tessellation: 12 },
    scene
  );
  sensorProbe.rotation.x = Math.PI * 0.5;
  sensorProbe.position.set(0, 0.02, 7.15);
  sensorProbe.material = materials.hullAccentGold;
  sensorProbe.parent = root;

  const bowBeacon = B.MeshBuilder.CreateSphere(`${namePrefix}_bow_beacon`, { diameter: 0.14, segments: 12 }, scene);
  bowBeacon.position.set(0, 0.02, 7.72);
  bowBeacon.material = alertBeaconMat;
  bowBeacon.parent = root;

  // 2) Recessed Curved Panoramic Observation Canopy (z = +3.2 .. +5.1) + Warm Interior Glow
  const bowGlass = B.MeshBuilder.CreateSphere(
    `${namePrefix}_bow_glass`,
    { diameter: 2.08, segments: 24, slice: 0.58 },
    scene
  );
  bowGlass.rotation.x = Math.PI * 0.5;
  bowGlass.scaling.set(1.06, 1.12, 0.72);
  bowGlass.position.set(0, 0.24, 3.85);
  bowGlass.material = materials.borosilicateGlass;
  bowGlass.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
  bowGlass.parent = root;

  const warmCabinCore = B.MeshBuilder.CreateSphere(
    `${namePrefix}_warm_cabin_core`,
    { diameter: 1.48, segments: 16 },
    scene
  );
  warmCabinCore.scaling.set(1.0, 0.58, 1.05);
  warmCabinCore.position.set(0, 0.18, 3.85);
  warmCabinCore.material = cabinWarmCoreMat;
  warmCabinCore.parent = root;

  // Canopy titanium mullion ribs
  for (const angle of [-0.55, 0, 0.55]) {
    const mullion = B.MeshBuilder.CreateTorus(
      `${namePrefix}_mullion_${angle}`,
      { diameter: 2.06, thickness: 0.055, tessellation: 28 },
      scene
    );
    mullion.rotation.z = angle;
    mullion.scaling.set(1.04, 0.72, 1.08);
    mullion.position.set(0, 0.24, 3.85);
    mullion.material = materials.hullDarkRib;
    mullion.parent = root;
  }

  // 3) Tiered Primary Fuselage Spine, Dorsal Crest & Flank Sponsons (z = -5.8 .. +4.5)
  const mainHull = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_main_hull`,
    { diameterTop: 2.1, diameterBottom: 2.45, height: 8.6, tessellation: 28 },
    scene
  );
  mainHull.rotation.x = Math.PI * 0.5;
  mainHull.scaling.set(1.08, 1.0, 0.78);
  mainHull.position.set(0, 0.0, 0.15);
  mainHull.material = materials.hullTitanium;
  mainHull.parent = root;

  const sternTaper = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_stern_taper`,
    { diameterTop: 2.38, diameterBottom: 1.48, height: 2.5, tessellation: 24 },
    scene
  );
  sternTaper.rotation.x = Math.PI * 0.5;
  sternTaper.scaling.set(1.04, 1.0, 0.78);
  sternTaper.position.set(0, 0.0, -5.2);
  sternTaper.material = materials.hullDarkRib;
  sternTaper.parent = root;

  // Dorsal & ventral structural keel spines
  const dorsalSpine = B.MeshBuilder.CreateBox(
    `${namePrefix}_dorsal_spine`,
    { width: 0.42, height: 0.48, depth: 8.4 },
    scene
  );
  dorsalSpine.position.set(0, 0.94, -0.35);
  dorsalSpine.material = materials.hullDarkRib;
  dorsalSpine.parent = root;

  const dorsalGoldTrim = B.MeshBuilder.CreateBox(
    `${namePrefix}_dorsal_gold`,
    { width: 0.14, height: 0.08, depth: 7.8 },
    scene
  );
  dorsalGoldTrim.position.set(0, 1.21, -0.35);
  dorsalGoldTrim.material = materials.hullAccentGold;
  dorsalGoldTrim.parent = root;

  const ventralKeel = B.MeshBuilder.CreateBox(
    `${namePrefix}_ventral_keel`,
    { width: 0.52, height: 0.36, depth: 7.8 },
    scene
  );
  ventralKeel.position.set(0, -0.88, -0.2);
  ventralKeel.material = materials.hullDarkRib;
  ventralKeel.parent = root;

  // Port & Starboard armored flank sponsons with gold datum strips & alert strips
  for (const side of [-1, 1]) {
    const sponson = B.MeshBuilder.CreateBox(
      `${namePrefix}_sponson_${side}`,
      { width: 0.54, height: 0.72, depth: 7.2 },
      scene
    );
    sponson.position.set(side * 1.32, -0.06, -0.15);
    sponson.material = materials.hullTitanium;
    sponson.parent = root;

    const goldLine = B.MeshBuilder.CreateBox(
      `${namePrefix}_sponson_gold_${side}`,
      { width: 0.06, height: 0.1, depth: 6.8 },
      scene
    );
    goldLine.position.set(side * 1.61, 0.06, -0.15);
    goldLine.material = materials.hullAccentGold;
    goldLine.parent = root;

    const flankStrip = B.MeshBuilder.CreateBox(
      `${namePrefix}_flank_light_${side}`,
      { width: 0.04, height: 0.07, depth: 4.8 },
      scene
    );
    flankStrip.position.set(side * 1.61, -0.16, 0.35);
    flankStrip.material = alertBeaconMat;
    flankStrip.parent = root;
  }

  // 4) Dual Counter-Rotating Glowing Cyan-Gold Curvature Warp Rings
  const warpRings = [];
  const ringConfigs = [
    { id: 'fwd', z: -1.1, diameter: 5.4, coreMat: materials.tesseractCyanBeam, dir: 1 },
    { id: 'aft', z: -3.55, diameter: 6.2, coreMat: materials.tesseractGoldBeam, dir: -1 },
  ];

  for (const cfg of ringConfigs) {
    const ringNode = new B.TransformNode(`${namePrefix}_warp_ring_${cfg.id}`, scene);
    ringNode.position.set(0, 0, cfg.z);
    ringNode.parent = root;

    const outerTorus = B.MeshBuilder.CreateTorus(
      `${namePrefix}_ring_outer_${cfg.id}`,
      { diameter: cfg.diameter, thickness: 0.24, tessellation: 48 },
      scene
    );
    outerTorus.rotation.x = Math.PI * 0.5;
    outerTorus.material = materials.hullDarkRib;
    outerTorus.parent = ringNode;

    const innerGlow = B.MeshBuilder.CreateTorus(
      `${namePrefix}_ring_glow_${cfg.id}`,
      { diameter: cfg.diameter - 0.22, thickness: 0.09, tessellation: 48 },
      scene
    );
    innerGlow.rotation.x = Math.PI * 0.5;
    innerGlow.material = cfg.coreMat;
    innerGlow.parent = ringNode;

    // 4 Radial structural pylons anchoring ring to hull
    const radius = cfg.diameter * 0.5;
    for (let k = 0; k < 4; k += 1) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const strutLen = radius - 1.05;
      const strut = B.MeshBuilder.CreateBox(
        `${namePrefix}_pylon_${cfg.id}_${k}`,
        { width: 0.14, height: strutLen, depth: 0.26 },
        scene
      );
      const midR = 1.05 + strutLen * 0.5;
      strut.position.set(Math.cos(ang) * midR, Math.sin(ang) * midR, 0);
      strut.rotation.z = ang - Math.PI * 0.5;
      strut.material = materials.hullTitanium;
      strut.parent = ringNode;
    }

    // 8 Phase-coil emitter nodes around perimeter
    for (let n = 0; n < 8; n += 1) {
      const ang = (n * Math.PI) / 4;
      const node = B.MeshBuilder.CreateSphere(
        `${namePrefix}_coil_${cfg.id}_${n}`,
        { diameter: 0.22, segments: 10 },
        scene
      );
      node.position.set(Math.cos(ang) * radius, Math.sin(ang) * radius, 0);
      node.material = n % 2 === 0 ? materials.hullAccentGold : cfg.coreMat;
      node.parent = ringNode;
    }

    warpRings.push({ node: ringNode, dir: cfg.dir, baseScale: 1.0 });
  }

  // 5) Triple Stern Stabilizer Fins + Wingtip Navigation Strobes
  const navLights = [bowBeacon];

  const dorsalFin = B.MeshBuilder.CreateBox(
    `${namePrefix}_fin_dorsal`,
    { width: 0.14, height: 1.85, depth: 2.35 },
    scene
  );
  dorsalFin.position.set(0, 1.52, -4.85);
  dorsalFin.rotation.x = -0.26;
  dorsalFin.material = materials.hullTitanium;
  dorsalFin.parent = root;

  const dorsalStrobe = B.MeshBuilder.CreateSphere(`${namePrefix}_nav_top`, { diameter: 0.14, segments: 10 }, scene);
  dorsalStrobe.position.set(0, 2.45, -5.2);
  dorsalStrobe.material = alertBeaconMat;
  dorsalStrobe.parent = root;
  navLights.push(dorsalStrobe);

  for (const side of [-1, 1]) {
    const wing = B.MeshBuilder.CreateBox(
      `${namePrefix}_wing_${side}`,
      { width: 2.25, height: 0.13, depth: 2.2 },
      scene
    );
    wing.position.set(side * 1.85, -0.58, -4.85);
    wing.rotation.z = -side * 0.34;
    wing.rotation.y = side * 0.18;
    wing.material = materials.hullTitanium;
    wing.parent = root;

    const tip = B.MeshBuilder.CreateSphere(`${namePrefix}_nav_${side}`, { diameter: 0.14, segments: 10 }, scene);
    tip.position.set(side * 2.9, -0.96, -5.15);
    tip.material = alertBeaconMat;
    tip.parent = root;
    navLights.push(tip);
  }

  // 6) Twin Ion/Warp Engine Nozzles & Dynamic Plume Cones (z = -6.2 .. -9.2)
  const plumes = [];
  for (const side of [-1, 1]) {
    const nozzle = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_nozzle_${side}`,
      { diameterTop: 0.72, diameterBottom: 0.56, height: 0.95, tessellation: 20 },
      scene
    );
    nozzle.rotation.x = Math.PI * 0.5;
    nozzle.position.set(side * 0.56, -0.04, -6.45);
    nozzle.material = materials.hullDarkRib;
    nozzle.parent = root;

    const coreGlow = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_nozzle_core_${side}`,
      { diameter: 0.48, height: 0.12, tessellation: 16 },
      scene
    );
    coreGlow.rotation.x = Math.PI * 0.5;
    coreGlow.position.set(side * 0.56, -0.04, -6.92);
    coreGlow.material = materials.emissiveCyan;
    coreGlow.parent = root;

    const plume = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_plume_${side}`,
      { diameterTop: 0.04, diameterBottom: 0.66, height: 3.2, tessellation: 20, hasRings: false },
      scene
    );
    plume.rotation.x = -Math.PI * 0.5;
    plume.position.set(side * 0.56, -0.04, -8.55);
    plume.material = materials.thrusterPlume;
    plume.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    plume.parent = root;
    plumes.push(plume);
  }

  return {
    root,
    warpRings: warpRings.map((w) => w.node),
    navLights,
    bowGlass,
    setWarpPower(power01 = 0.4, timeSec = 0) {
      const p = clamp(Number.isFinite(power01) ? power01 : 0, 0, 1.5);
      const speed = 0.55 + p * 3.8;
      for (const item of warpRings) {
        item.node.rotation.z = timeSec * speed * item.dir;
        const s = 1.0 + p * 0.08;
        item.node.scaling.set(s, s, 1.0);
      }
      for (const plume of plumes) {
        const lenScale = 0.45 + p * 1.85;
        plume.scaling.set(0.85 + p * 0.35, lenScale, 0.85 + p * 0.35);
        plume.position.z = -6.95 - 1.6 * lenScale;
        plume.isVisible = p > 0.02;
      }
    },
    setAlertLevel(alert01 = 0, timeSec = 0) {
      const a = clamp(Number.isFinite(alert01) ? alert01 : 0, 0, 1);
      const pulse = 0.72 + 0.28 * Math.sin(timeSec * 8.0);
      const cyan = B.Color3.FromHexString(PALETTE.accent.cyanW0);
      const amber = B.Color3.FromHexString('#F7B733');
      const col = B.Color3.Lerp(cyan, amber, a);
      alertBeaconMat.diffuseColor = col;
      alertBeaconMat.emissiveColor = col.scale(1.1 + a * 0.85 * pulse);
    },
    dispose() {
      root.dispose();
      for (const m of ownedMats) m.dispose(false, false);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Escort Frigate Vessel Factory (Fleet Chevron Formation)
// ---------------------------------------------------------------------------

export function createEscortVessel(scene, materials, namePrefix = 'escort', scale = 0.48) {
  const B = globalThis.BABYLON;
  const root = new B.TransformNode(`${namePrefix}_root`, scene);
  root.scaling.setAll(scale);

  const fuselage = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_body`,
    { diameterTop: 0.22, diameterBottom: 1.65, height: 8.2, tessellation: 18 },
    scene
  );
  fuselage.rotation.x = Math.PI * 0.5;
  fuselage.scaling.set(1.1, 1.0, 0.65);
  fuselage.position.set(0, 0, 0.4);
  fuselage.material = materials.hullTitanium;
  fuselage.parent = root;

  const spine = B.MeshBuilder.CreateBox(
    `${namePrefix}_spine`,
    { width: 0.34, height: 0.42, depth: 5.8 },
    scene
  );
  spine.position.set(0, 0.45, -0.6);
  spine.material = materials.hullDarkRib;
  spine.parent = root;

  // Swept delta chevron wings
  for (const side of [-1, 1]) {
    const wing = B.MeshBuilder.CreateBox(
      `${namePrefix}_wing_${side}`,
      { width: 3.1, height: 0.14, depth: 2.2 },
      scene
    );
    wing.position.set(side * 1.9, -0.1, -2.2);
    wing.rotation.y = side * 0.38;
    wing.rotation.z = -side * 0.12;
    wing.material = materials.hullTitanium;
    wing.parent = root;

    const trim = B.MeshBuilder.CreateBox(
      `${namePrefix}_wtrim_${side}`,
      { width: 2.7, height: 0.06, depth: 0.14 },
      scene
    );
    trim.position.set(side * 1.9, -0.02, -1.35);
    trim.rotation.y = side * 0.38;
    trim.rotation.z = -side * 0.12;
    trim.material = materials.hullAccentGold;
    trim.parent = root;
  }

  // Single glowing warp ring
  const warpRing = new B.TransformNode(`${namePrefix}_wring`, scene);
  warpRing.position.set(0, 0, -2.35);
  warpRing.parent = root;

  const outerRing = B.MeshBuilder.CreateTorus(
    `${namePrefix}_ring_out`,
    { diameter: 3.9, thickness: 0.18, tessellation: 32 },
    scene
  );
  outerRing.rotation.x = Math.PI * 0.5;
  outerRing.material = materials.hullDarkRib;
  outerRing.parent = warpRing;

  const innerRing = B.MeshBuilder.CreateTorus(
    `${namePrefix}_ring_in`,
    { diameter: 3.7, thickness: 0.08, tessellation: 32 },
    scene
  );
  innerRing.rotation.x = Math.PI * 0.5;
  innerRing.material = materials.tesseractCyanBeam;
  innerRing.parent = warpRing;

  // Thruster plume
  const thrusterPlume = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_plume`,
    { diameterTop: 0.04, diameterBottom: 0.62, height: 2.8, tessellation: 16 },
    scene
  );
  thrusterPlume.rotation.x = -Math.PI * 0.5;
  thrusterPlume.position.set(0, 0, -5.2);
  thrusterPlume.material = materials.thrusterPlume;
  thrusterPlume.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
  thrusterPlume.parent = root;

  return {
    root,
    warpRing,
    thrusterPlume,
    setWarpPower(power01 = 0.4, timeSec = 0) {
      const p = clamp(Number.isFinite(power01) ? power01 : 0, 0, 1.5);
      warpRing.rotation.z = timeSec * (0.7 + p * 3.4);
      const lenScale = 0.4 + p * 1.9;
      thrusterPlume.scaling.set(0.8 + p * 0.3, lenScale, 0.8 + p * 0.3);
      thrusterPlume.position.z = -3.8 - 1.4 * lenScale;
      thrusterPlume.isVisible = p > 0.02;
    },
    dispose() {
      root.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Reusable Sculpted Cryogenic Pod Unit (Shared Across P1 S0B-1, P2 S1, P3 S4-2)
// ---------------------------------------------------------------------------

export function createCryoPodUnit(scene, materials, namePrefix = 'cryo_pod', opts = {}) {
  const B = globalThis.BABYLON;
  const podCode = opts.podCode ?? '08 号';
  const statusLabel = opts.statusLabel ?? '冬眠中';
  const accentHex = opts.accentHex ?? '#58A6FF';

  const root = new B.TransformNode(`${namePrefix}_root`, scene);
  const ownedMats = [];
  const ownedTex = [];

  // Brushed satin titanium #5D718C shell (uses shared bank material when available)
  let satinShellMat = materials.cryoSatinTitanium;
  if (!satinShellMat) {
    satinShellMat = new B.PBRMaterial(`${namePrefix}_satin_ti_pbr`, scene);
    satinShellMat.albedoColor = B.Color3.FromHexString('#5D718C');
    satinShellMat.metallic = 0.82;
    satinShellMat.roughness = 0.3;
    satinShellMat.clearCoat.isEnabled = true;
    satinShellMat.clearCoat.intensity = 0.34;
    satinShellMat.disableDepthWrite = false;
    satinShellMat.needDepthPrePass = false;
    ownedMats.push(satinShellMat);
  }

  const vitalMat = new B.StandardMaterial(`${namePrefix}_vital_mat`, scene);
  const initCol = B.Color3.FromHexString(accentHex);
  vitalMat.diffuseColor = initCol;
  vitalMat.emissiveColor = initCol.scale(1.3);
  vitalMat.disableLighting = true;
  vitalMat.disableDepthWrite = false;
  vitalMat.needDepthPrePass = false;
  ownedMats.push(vitalMat);

  // Soft translucent interior berth glow strip synced with vital status (Ghost-safe)
  const berthGlowMat = new B.StandardMaterial(`${namePrefix}_berth_glow_mat`, scene);
  berthGlowMat.diffuseColor = initCol;
  berthGlowMat.emissiveColor = initCol.scale(0.85);
  berthGlowMat.disableLighting = true;
  berthGlowMat.alpha = 0.28;
  berthGlowMat.alphaMode = B.Engine.ALPHA_ADD;
  berthGlowMat.backFaceCulling = false;
  berthGlowMat.disableDepthWrite = true;
  berthGlowMat.needDepthPrePass = false;
  berthGlowMat._isPrologueTranslucent = true;
  ownedMats.push(berthGlowMat);

  // Recessed translucent sleeping-occupant silhouette visible inside frosted canopy (Ghost-safe)
  const sleeperMat = new B.PBRMaterial(`${namePrefix}_sleeper_silhouette_pbr`, scene);
  sleeperMat.albedoColor = B.Color3.FromHexString('#C8E2F6');
  sleeperMat.emissiveColor = initCol.scale(0.32);
  sleeperMat.metallic = 0.16;
  sleeperMat.roughness = 0.36;
  sleeperMat.alpha = 0.64;
  sleeperMat.backFaceCulling = false;
  sleeperMat.disableDepthWrite = true;
  sleeperMat.needDepthPrePass = false;
  sleeperMat._isPrologueTranslucent = true;
  ownedMats.push(sleeperMat);

  // 1) Heavy grounded armored plinth + sculpted brushed satin titanium (#5D718C) chassis shell
  const plinth = B.MeshBuilder.CreateBox(
    `${namePrefix}_plinth`,
    { width: 0.98, height: 0.2, depth: 2.26 },
    scene
  );
  plinth.position.set(0, 0.1, 0);
  plinth.material = materials.hullDarkRib;
  plinth.parent = root;

  const shellBody = B.MeshBuilder.CreateBox(
    `${namePrefix}_shell_body`,
    { width: 0.96, height: 0.32, depth: 2.18 },
    scene
  );
  shellBody.position.set(0, 0.36, 0);
  shellBody.material = satinShellMat;
  shellBody.parent = root;

  // Sculpted upper brushed ice-silver alloy cradle rim
  const cradle = B.MeshBuilder.CreateBox(
    `${namePrefix}_cradle`,
    { width: 0.94, height: 0.18, depth: 2.12 },
    scene
  );
  cradle.position.set(0, 0.6, 0);
  cradle.material = materials.cryoAlloy;
  cradle.parent = root;

  // Lateral metallic chassis bumper ribs & brushed-gold datum mounts
  for (const side of [-1, 1]) {
    for (const rz of [-0.66, 0.0, 0.66]) {
      const rib = B.MeshBuilder.CreateBox(
        `${namePrefix}_side_rib_${side}_${rz}`,
        { width: 0.06, height: 0.44, depth: 0.16 },
        scene
      );
      rib.position.set(side * 0.49, 0.36, rz);
      rib.material = materials.cryoAlloy;
      rib.parent = root;
    }

    const trimRail = B.MeshBuilder.CreateBox(
      `${namePrefix}_trim_rail_${side}`,
      { width: 0.035, height: 0.04, depth: 2.02 },
      scene
    );
    trimRail.position.set(side * 0.49, 0.24, 0);
    trimRail.material = materials.hullAccentGold;
    trimRail.parent = root;
  }

  // Foot-end satin titanium cowling cap & front vital status bar
  const footCap = B.MeshBuilder.CreateBox(
    `${namePrefix}_foot_cap`,
    { width: 0.92, height: 0.56, depth: 0.22 },
    scene
  );
  footCap.position.set(0, 0.44, 1.04);
  footCap.material = satinShellMat;
  footCap.parent = root;

  const footTrim = B.MeshBuilder.CreateBox(
    `${namePrefix}_foot_trim`,
    { width: 0.78, height: 0.06, depth: 0.05 },
    scene
  );
  footTrim.position.set(0, 0.66, 1.15);
  footTrim.material = materials.cryoAlloy;
  footTrim.parent = root;

  const footVital = B.MeshBuilder.CreateBox(
    `${namePrefix}_foot_vital`,
    { width: 0.64, height: 0.045, depth: 0.04 },
    scene
  );
  footVital.position.set(0, 0.56, 1.16);
  footVital.material = vitalMat;
  footVital.parent = root;

  // 2) Interior recessed berth & translucent sleeping-occupant silhouette (draws before frosted glass!)
  const berth = B.MeshBuilder.CreateBox(
    `${namePrefix}_berth`,
    { width: 0.7, height: 0.09, depth: 1.88 },
    scene
  );
  berth.position.set(0, 0.67, 0);
  berth.material = materials.linXiaDarkTrim;
  berth.parent = root;

  const pillow = B.MeshBuilder.CreateBox(
    `${namePrefix}_pillow`,
    { width: 0.42, height: 0.08, depth: 0.28 },
    scene
  );
  pillow.position.set(0, 0.73, -0.68);
  pillow.material = materials.hullDarkRib;
  pillow.parent = root;

  const berthGlow = B.MeshBuilder.CreatePlane(
    `${namePrefix}_berth_glow`,
    { width: 0.6, height: 1.72 },
    scene
  );
  berthGlow.rotation.x = Math.PI * 0.5;
  berthGlow.position.set(0, 0.722, 0.02);
  berthGlow.material = berthGlowMat;
  berthGlow.parent = root;

  // Sculpted translucent sleeping occupant silhouette (head, shoulders, tapered torso/legs)
  const sleeperHead = B.MeshBuilder.CreateSphere(
    `${namePrefix}_sleeper_head`,
    { diameter: 0.21, segments: 14 },
    scene
  );
  sleeperHead.scaling.set(0.92, 0.88, 1.02);
  sleeperHead.position.set(0, 0.84, -0.64);
  sleeperHead.material = sleeperMat;
  sleeperHead.parent = root;

  const sleeperShoulders = B.MeshBuilder.CreateSphere(
    `${namePrefix}_sleeper_shoulders`,
    { diameter: 0.42, segments: 14 },
    scene
  );
  sleeperShoulders.scaling.set(1.04, 0.46, 0.68);
  sleeperShoulders.position.set(0, 0.8, -0.35);
  sleeperShoulders.material = sleeperMat;
  sleeperShoulders.parent = root;

  const sleeperTorso = B.MeshBuilder.CreateCapsule(
    `${namePrefix}_sleeper_body`,
    { radius: 0.175, height: 1.24, tessellation: 14 },
    scene
  );
  sleeperTorso.rotation.x = Math.PI * 0.5;
  sleeperTorso.scaling.set(1.08, 1.0, 0.55);
  sleeperTorso.position.set(0, 0.79, 0.14);
  sleeperTorso.material = sleeperMat;
  sleeperTorso.parent = root;

  // Subtle biometric chest sensor strip across occupant
  const sleeperVital = B.MeshBuilder.CreateBox(
    `${namePrefix}_sleeper_vital`,
    { width: 0.22, height: 0.02, depth: 0.04 },
    scene
  );
  sleeperVital.position.set(0, 0.89, -0.2);
  sleeperVital.material = vitalMat;
  sleeperVital.parent = root;

  // 3) Sculpted Head-End Brushed Satin Titanium Arch & Alloy Pilasters
  const headArch = B.MeshBuilder.CreateBox(
    `${namePrefix}_head_arch`,
    { width: 0.98, height: 1.22, depth: 0.34 },
    scene
  );
  headArch.position.set(0, 0.61, -1.04);
  headArch.material = satinShellMat;
  headArch.parent = root;

  for (const side of [-1, 1]) {
    const headPilaster = B.MeshBuilder.CreateBox(
      `${namePrefix}_head_pil_${side}`,
      { width: 0.1, height: 1.18, depth: 0.38 },
      scene
    );
    headPilaster.position.set(side * 0.47, 0.62, -1.02);
    headPilaster.material = materials.cryoAlloy;
    headPilaster.parent = root;
  }

  // Fixed head-end curved metallic trim arch crowning the canopy opening
  const headCrownRing = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_head_crown_ring`,
    { diameter: 0.92, height: 0.1, tessellation: 24, arc: 0.5 },
    scene
  );
  headCrownRing.rotation.z = Math.PI * 0.5;
  headCrownRing.rotation.y = Math.PI * 0.5;
  headCrownRing.position.set(0, 0.68, -0.84);
  headCrownRing.material = materials.cryoAlloy;
  headCrownRing.parent = root;

  // Vital-sign LED strips flanking the pod chassis
  for (const side of [-1, 1]) {
    const led = B.MeshBuilder.CreateBox(
      `${namePrefix}_led_${side}`,
      { width: 0.045, height: 0.06, depth: 1.92 },
      scene
    );
    led.position.set(side * 0.485, 0.58, 0);
    led.material = vitalMat;
    led.parent = root;
  }

  // 4) Articulated Curved Frosted-Glass Canopy with Metallic Trim Rings (hinged along -X side!)
  const canopyPivot = new B.TransformNode(`${namePrefix}_canopy_pivot`, scene);
  canopyPivot.position.set(-0.44, 0.68, 0);
  canopyPivot.parent = root;

  const canopyGlass = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_canopy_glass`,
    { diameter: 0.84, height: 1.86, tessellation: 24, arc: 0.5 },
    scene
  );
  canopyGlass.rotation.z = Math.PI * 0.5;
  canopyGlass.rotation.y = Math.PI * 0.5;
  canopyGlass.position.set(0.44, 0.0, 0.02);
  canopyGlass.material = materials.cryoFrostedGlass;
  canopyGlass.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
  canopyGlass.parent = canopyPivot;

  // Twin curved brushed-alloy metallic trim rings + subtle gold crest accents arching over the canopy
  for (const rz of [-0.56, 0.56]) {
    const trimArch = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_canopy_trim_${rz}`,
      { diameter: 0.885, height: 0.065, tessellation: 24, arc: 0.5 },
      scene
    );
    trimArch.rotation.z = Math.PI * 0.5;
    trimArch.rotation.y = Math.PI * 0.5;
    trimArch.position.set(0.44, 0.0, rz);
    trimArch.material = materials.cryoAlloy;
    trimArch.parent = canopyPivot;

    const goldRing = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_canopy_gold_${rz}`,
      { diameter: 0.896, height: 0.018, tessellation: 24, arc: 0.5 },
      scene
    );
    goldRing.rotation.z = Math.PI * 0.5;
    goldRing.rotation.y = Math.PI * 0.5;
    goldRing.position.set(0.44, 0.0, rz);
    goldRing.material = materials.hullAccentGold;
    goldRing.parent = canopyPivot;
  }

  // Precision metallic canopy seal frame & twin brushed-gold locking clamps
  const sealRim = B.MeshBuilder.CreateBox(
    `${namePrefix}_seal_rim`,
    { width: 0.88, height: 0.065, depth: 1.9 },
    scene
  );
  sealRim.position.set(0.44, 0.02, 0.02);
  sealRim.material = materials.cryoAlloy;
  sealRim.parent = canopyPivot;

  for (const lz of [-0.55, 0.55]) {
    const clampMesh = B.MeshBuilder.CreateBox(
      `${namePrefix}_clamp_${lz}`,
      { width: 0.1, height: 0.15, depth: 0.18 },
      scene
    );
    clampMesh.position.set(0.86, 0.05, lz);
    clampMesh.material = materials.hullAccentGold;
    clampMesh.parent = canopyPivot;
  }

  // 5) Crisp Backlit Status Plaque (mounted above head-end arch facing +Z inside metallic bezel)
  const plaqueTex = new B.DynamicTexture(`${namePrefix}_plaque_tex`, { width: 512, height: 192 }, scene, true);
  ownedTex.push(plaqueTex);
  paintCryoPlaque(plaqueTex, podCode, statusLabel, accentHex);

  const plaqueMat = new B.StandardMaterial(`${namePrefix}_plaque_mat`, scene);
  plaqueMat.diffuseTexture = plaqueTex;
  plaqueMat.emissiveTexture = plaqueTex;
  plaqueMat.emissiveColor = B.Color3.White().scale(1.12);
  plaqueMat.disableLighting = true;
  plaqueMat.disableDepthWrite = false;
  plaqueMat.needDepthPrePass = false;
  ownedMats.push(plaqueMat);

  const plaquePanel = B.MeshBuilder.CreatePlane(
    `${namePrefix}_plaque`,
    { width: 0.86, height: 0.32 },
    scene
  );
  plaquePanel.position.set(0, 1.38, -0.835);
  plaquePanel.rotation.y = Math.PI;
  plaquePanel.material = plaqueMat;
  plaquePanel.parent = root;

  const plaqueBezel = B.MeshBuilder.CreateBox(
    `${namePrefix}_plaque_bezel`,
    { width: 0.94, height: 0.4, depth: 0.055 },
    scene
  );
  plaqueBezel.position.set(0, 1.38, -0.87);
  plaqueBezel.material = materials.cryoAlloy;
  plaqueBezel.parent = root;

  const plaqueBack = B.MeshBuilder.CreateBox(
    `${namePrefix}_plaque_frame`,
    { width: 0.98, height: 0.44, depth: 0.04 },
    scene
  );
  plaqueBack.position.set(0, 1.38, -0.9);
  plaqueBack.material = satinShellMat;
  plaqueBack.parent = root;

  let lastModeKey = `${podCode}|${statusLabel}|${accentHex}`;

  return {
    root,
    canopyPivot,
    plaquePanel,
    vitalMat,
    setStatus({ mode = 'sleeping', openAmount = 0, alertPulse = 0, title, subtitle, accentHex: nextHex } = {}) {
      const openClamped = clamp(Number.isFinite(openAmount) ? openAmount : 0, 0, 1);
      // Hinges cleanly upward & outward around -X edge
      canopyPivot.rotation.z = openClamped * 1.18;

      const resolvedTitle = title ?? podCode;
      const resolvedSub =
        subtitle ?? (mode === 'waking' || mode === 'open' ? '紧急唤醒' : '冬眠中');
      const resolvedHex =
        nextHex ?? (mode === 'waking' || mode === 'open' ? PALETTE.accent.emerald : '#58A6FF');

      const key = `${resolvedTitle}|${resolvedSub}|${resolvedHex}`;
      if (key !== lastModeKey) {
        lastModeKey = key;
        paintCryoPlaque(plaqueTex, resolvedTitle, resolvedSub, resolvedHex);
      }

      const col = B.Color3.FromHexString(resolvedHex);
      const boost = 1.2 + clamp(alertPulse, 0, 1) * 1.15;
      vitalMat.diffuseColor = col;
      vitalMat.emissiveColor = col.scale(boost);
      berthGlowMat.diffuseColor = col;
      berthGlowMat.emissiveColor = col.scale(0.85 + clamp(alertPulse, 0, 1) * 0.45);
      sleeperMat.emissiveColor = col.scale(0.32 + clamp(alertPulse, 0, 1) * 0.22);
    },
    dispose() {
      root.dispose();
      for (const m of ownedMats) m.dispose(false, false);
      for (const t of ownedTex) t.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Sculpted 07 号 Lin Xia Articulated Aerospace Scientist Silhouette
// ---------------------------------------------------------------------------

function createLinXiaBadgeTexture(scene, name) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(name, { width: 128, height: 64 }, scene, true);
  const ctx = tex.getContext();

  ctx.fillStyle = '#121D2E';
  ctx.fillRect(0, 0, 128, 64);

  ctx.strokeStyle = '#D8AB52';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 56);

  ctx.fillStyle = '#4DE6D3';
  ctx.fillRect(10, 48, 108, 6);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillStyle = '#F7E2A8';
  ctx.fillText('07', 64, 27);

  tex.update();
  return tex;
}

function createLinXiaFigure(scene, materials, namePrefix = 'linxia') {
  const B = globalThis.BABYLON;
  const root = new B.TransformNode(`${namePrefix}_root`, scene);
  const ownedMats = [];
  const ownedTex = [];

  const trackMat = (mat) => {
    ownedMats.push(mat);
    return mat;
  };

  // Sleek deep dark-navy hair PBR with subtle sheen to catch rim lighting cleanly
  const hairMat = trackMat(new B.PBRMaterial(`${namePrefix}_hair_pbr`, scene));
  hairMat.albedoColor = B.Color3.FromHexString('#141B2B');
  hairMat.metallic = 0.14;
  hairMat.roughness = 0.34;
  hairMat.clearCoat.isEnabled = true;
  hairMat.clearCoat.intensity = 0.26;
  hairMat.clearCoat.roughness = 0.3;
  hairMat.disableDepthWrite = false;
  hairMat.needDepthPrePass = false;

  // Ergonomic dark-navy polymer gloves & aerospace boots PBR
  const gloveMat = trackMat(new B.PBRMaterial(`${namePrefix}_glove_pbr`, scene));
  gloveMat.albedoColor = B.Color3.FromHexString('#1E293B');
  gloveMat.metallic = 0.24;
  gloveMat.roughness = 0.38;
  gloveMat.clearCoat.isEnabled = true;
  gloveMat.clearCoat.intensity = 0.18;
  gloveMat.disableDepthWrite = false;
  gloveMat.needDepthPrePass = false;

  // Crisp gold/cyan 07 chest telemetry badge texture
  const badgeTex = createLinXiaBadgeTexture(scene, `${namePrefix}_badge07_tex`);
  ownedTex.push(badgeTex);
  const badgeMat = trackMat(new B.StandardMaterial(`${namePrefix}_badge07_mat`, scene));
  badgeMat.diffuseTexture = badgeTex;
  badgeMat.emissiveTexture = badgeTex;
  badgeMat.emissiveColor = B.Color3.White().scale(0.92);
  badgeMat.disableLighting = true;
  badgeMat.disableDepthWrite = false;
  badgeMat.needDepthPrePass = false;

  // 1) Grounded Ergonomic Aerospace Boots, Articulated Knees, Tapered Legs & Pelvis (y = 0 .. 0.90)
  for (const side of [-1, 1]) {
    const lx = side * 0.105;

    const bootShaft = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_boot_${side}`,
      { diameterTop: 0.108, diameterBottom: 0.118, height: 0.18, tessellation: 16 },
      scene
    );
    bootShaft.position.set(lx, 0.09, 0.005);
    bootShaft.material = gloveMat;
    bootShaft.parent = root;

    const bootToe = B.MeshBuilder.CreateSphere(
      `${namePrefix}_boot_toe_${side}`,
      { diameter: 0.12, segments: 12 },
      scene
    );
    bootToe.scaling.set(0.92, 0.7, 1.55);
    bootToe.position.set(lx, 0.042, 0.06);
    bootToe.material = gloveMat;
    bootToe.parent = root;

    const ankleCuff = B.MeshBuilder.CreateTorus(
      `${namePrefix}_ankle_${side}`,
      { diameter: 0.112, thickness: 0.022, tessellation: 16 },
      scene
    );
    ankleCuff.position.set(lx, 0.18, 0.004);
    ankleCuff.material = materials.linXiaDarkTrim;
    ankleCuff.parent = root;

    const shin = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_shin_${side}`,
      { diameterTop: 0.128, diameterBottom: 0.102, height: 0.34, tessellation: 16 },
      scene
    );
    shin.position.set(lx, 0.33, 0);
    shin.material = materials.linXiaSuit;
    shin.parent = root;

    const kneeJoint = B.MeshBuilder.CreateSphere(
      `${namePrefix}_knee_${side}`,
      { diameter: 0.126, segments: 12 },
      scene
    );
    kneeJoint.position.set(lx, 0.495, 0.006);
    kneeJoint.material = materials.linXiaDarkTrim;
    kneeJoint.parent = root;

    const thigh = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_thigh_${side}`,
      { diameterTop: 0.166, diameterBottom: 0.124, height: 0.4, tessellation: 16 },
      scene
    );
    thigh.position.set(lx, 0.685, 0);
    thigh.material = materials.linXiaSuit;
    thigh.parent = root;

    const hipJoint = B.MeshBuilder.CreateSphere(
      `${namePrefix}_hip_${side}`,
      { diameter: 0.162, segments: 12 },
      scene
    );
    hipJoint.position.set(lx, 0.87, 0);
    hipJoint.material = materials.linXiaSuit;
    hipJoint.parent = root;
  }

  const pelvis = B.MeshBuilder.CreateSphere(`${namePrefix}_pelvis`, { diameter: 0.34, segments: 16 }, scene);
  pelvis.scaling.set(1.02, 0.62, 0.68);
  pelvis.position.set(0, 0.87, 0);
  pelvis.material = materials.linXiaSuit;
  pelvis.parent = root;

  // 2) Contoured Tapered Flight-Suit Torso, Utility Belt, 07 Badge & Back Pack (torsoPivot at y = 0.90)
  const torsoPivot = new B.TransformNode(`${namePrefix}_torso_pivot`, scene);
  torsoPivot.position.set(0, 0.9, 0);
  torsoPivot.parent = root;

  // Narrower tapered waist + sculpted dark-navy utility belt
  const waist = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_waist`,
    { diameterTop: 0.275, diameterBottom: 0.305, height: 0.18, tessellation: 20 },
    scene
  );
  waist.scaling.set(1.02, 1.0, 0.7);
  waist.position.set(0, 0.06, 0);
  waist.material = materials.linXiaDarkTrim;
  waist.parent = torsoPivot;

  const utilityBelt = B.MeshBuilder.CreateTorus(
    `${namePrefix}_belt`,
    { diameter: 0.3, thickness: 0.04, tessellation: 22 },
    scene
  );
  utilityBelt.scaling.set(1.03, 1.0, 0.72);
  utilityBelt.position.set(0, 0.02, 0);
  utilityBelt.material = gloveMat;
  utilityBelt.parent = torsoPivot;

  const beltBuckle = B.MeshBuilder.CreateBox(
    `${namePrefix}_buckle`,
    { width: 0.072, height: 0.044, depth: 0.024 },
    scene
  );
  beltBuckle.position.set(0, 0.02, 0.122);
  beltBuckle.material = materials.hullAccentGold;
  beltBuckle.parent = torsoPivot;

  for (const side of [-1, 1]) {
    const pouch = B.MeshBuilder.CreateBox(
      `${namePrefix}_pouch_${side}`,
      { width: 0.042, height: 0.068, depth: 0.062 },
      scene
    );
    pouch.position.set(side * 0.162, 0.025, 0.015);
    pouch.material = gloveMat;
    pouch.parent = torsoPivot;
  }

  // Tapered flight-suit ribcage smoothly merging into contoured upper sculpted chest dome
  const ribcage = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_ribcage`,
    { diameterTop: 0.39, diameterBottom: 0.268, height: 0.29, tessellation: 22 },
    scene
  );
  ribcage.scaling.set(1.02, 1.0, 0.66);
  ribcage.position.set(0, 0.265, 0);
  ribcage.material = materials.linXiaSuit;
  ribcage.parent = torsoPivot;

  const chestDome = B.MeshBuilder.CreateSphere(
    `${namePrefix}_chest_dome`,
    { diameter: 0.42, segments: 20 },
    scene
  );
  chestDome.scaling.set(1.06, 0.62, 0.64);
  chestDome.position.set(0, 0.43, 0);
  chestDome.material = materials.linXiaSuit;
  chestDome.parent = torsoPivot;

  // Sculpted dark-navy clavicle/shoulder yoke overlay
  const shoulderYoke = B.MeshBuilder.CreateSphere(
    `${namePrefix}_shoulder_yoke`,
    { diameter: 0.38, segments: 18 },
    scene
  );
  shoulderYoke.scaling.set(1.06, 0.3, 0.64);
  shoulderYoke.position.set(0, 0.498, -0.004);
  shoulderYoke.material = materials.linXiaDarkTrim;
  shoulderYoke.parent = torsoPivot;

  // Subtle vertical front flight-suit center placket seam
  const frontSeam = B.MeshBuilder.CreateBox(
    `${namePrefix}_front_seam`,
    { width: 0.03, height: 0.35, depth: 0.024 },
    scene
  );
  frontSeam.position.set(0, 0.295, 0.125);
  frontSeam.material = materials.linXiaDarkTrim;
  frontSeam.parent = torsoPivot;

  // Subtle gold/cyan 07 chest telemetry badge seated flush on sculpted upper chest
  const badgeMount = new B.TransformNode(`${namePrefix}_badge_mount`, scene);
  badgeMount.position.set(0.088, 0.402, 0.13);
  badgeMount.rotation.set(-0.18, 0.24, 0);
  badgeMount.parent = torsoPivot;

  const badgePlate = B.MeshBuilder.CreatePlane(
    `${namePrefix}_badge07`,
    { width: 0.082, height: 0.042 },
    scene
  );
  badgePlate.rotation.y = Math.PI;
  badgePlate.material = badgeMat;
  badgePlate.parent = badgeMount;

  const badgeBacking = B.MeshBuilder.CreateBox(
    `${namePrefix}_badge_back`,
    { width: 0.088, height: 0.048, depth: 0.012 },
    scene
  );
  badgeBacking.position.set(0, 0, -0.008);
  badgeBacking.material = materials.hullAccentGold;
  badgeBacking.parent = badgeMount;

  // Slim Aerospace Dorsal Life-Support Pack (sculpted back profile for all camera angles)
  const backPack = B.MeshBuilder.CreateBox(
    `${namePrefix}_backpack`,
    { width: 0.22, height: 0.27, depth: 0.082 },
    scene
  );
  backPack.position.set(0, 0.345, -0.145);
  backPack.material = materials.linXiaDarkTrim;
  backPack.parent = torsoPivot;

  const backCowling = B.MeshBuilder.CreateBox(
    `${namePrefix}_pack_cowl`,
    { width: 0.185, height: 0.062, depth: 0.072 },
    scene
  );
  backCowling.position.set(0, 0.472, -0.138);
  backCowling.material = materials.cryoAlloy;
  backCowling.parent = torsoPivot;

  for (const side of [-1, 1]) {
    const canister = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_pack_can_${side}`,
      { diameter: 0.048, height: 0.22, tessellation: 12 },
      scene
    );
    canister.position.set(side * 0.068, 0.34, -0.175);
    canister.material = materials.cryoAlloy;
    canister.parent = torsoPivot;
  }

  const packStrip = B.MeshBuilder.CreateBox(
    `${namePrefix}_pack_led`,
    { width: 0.018, height: 0.14, depth: 0.016 },
    scene
  );
  packStrip.position.set(0, 0.345, -0.19);
  packStrip.material = materials.emissiveCyan;
  packStrip.parent = torsoPivot;

  // 3) Flush-Seated Dark-Titanium & Cyan-Trimmed Collar / Gorget Ring (ZERO air gap!)
  const gorgetBase = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_gorget_base`,
    { diameterTop: 0.156, diameterBottom: 0.228, height: 0.084, tessellation: 22 },
    scene
  );
  gorgetBase.position.set(0, 0.556, 0);
  gorgetBase.material = materials.linXiaDarkTrim;
  gorgetBase.parent = torsoPivot;

  const collarRing = B.MeshBuilder.CreateTorus(
    `${namePrefix}_collar_ring`,
    { diameter: 0.174, thickness: 0.034, tessellation: 24 },
    scene
  );
  collarRing.position.set(0, 0.586, 0);
  collarRing.material = materials.linXiaDarkTrim;
  collarRing.parent = torsoPivot;

  const collarCyanTrim = B.MeshBuilder.CreateTorus(
    `${namePrefix}_collar_cyan`,
    { diameter: 0.168, thickness: 0.011, tessellation: 24 },
    scene
  );
  collarCyanTrim.position.set(0, 0.598, 0);
  collarCyanTrim.material = materials.emissiveCyan;
  collarCyanTrim.parent = torsoPivot;

  // 4) Sculpted Neck, Soft Ivory Head, Sleek Dark-Navy Hair Cap & Rear Bun (seated flush inside gorget!)
  const headPivot = new B.TransformNode(`${namePrefix}_head_pivot`, scene);
  headPivot.position.set(0, 0.59, 0);
  headPivot.parent = torsoPivot;

  // Neck extends deeply below collar (-0.03) and deeply into head (+0.10) -> ZERO gap in any pose!
  const neck = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_neck`,
    { diameterTop: 0.094, diameterBottom: 0.114, height: 0.13, tessellation: 16 },
    scene
  );
  neck.position.set(0, 0.035, 0);
  neck.material = materials.linXiaSkin;
  neck.parent = headPivot;

  const head = B.MeshBuilder.CreateSphere(`${namePrefix}_head`, { diameter: 0.215, segments: 20 }, scene);
  head.scaling.set(0.88, 1.04, 0.96);
  head.position.set(0, 0.155, 0.008);
  head.material = materials.linXiaSkin;
  head.parent = headPivot;

  const jawContour = B.MeshBuilder.CreateSphere(`${namePrefix}_jaw`, { diameter: 0.132, segments: 14 }, scene);
  jawContour.scaling.set(0.82, 0.72, 0.88);
  jawContour.position.set(0, 0.094, 0.022);
  jawContour.material = materials.linXiaSkin;
  jawContour.parent = headPivot;

  // Sleek aerospace comm earpieces (subtle detail framing jawline)
  for (const side of [-1, 1]) {
    const earComm = B.MeshBuilder.CreateSphere(
      `${namePrefix}_comm_${side}`,
      { diameter: 0.034, segments: 10 },
      scene
    );
    earComm.scaling.set(0.55, 1.15, 0.95);
    earComm.position.set(side * 0.094, 0.152, -0.006);
    earComm.material = materials.linXiaDarkTrim;
    earComm.parent = headPivot;
  }

  const commLed = B.MeshBuilder.CreateSphere(`${namePrefix}_comm_led`, { diameter: 0.012, segments: 8 }, scene);
  commLed.position.set(0.102, 0.154, 0.004);
  commLed.material = materials.emissiveCyan;
  commLed.parent = headPivot;

  // Sleek sculpted dark-navy hair cap + temple contour + nape + rear bun with brushed-gold clasp
  const hairCap = B.MeshBuilder.CreateSphere(`${namePrefix}_hair`, { diameter: 0.228, segments: 18 }, scene);
  hairCap.scaling.set(0.93, 1.02, 1.01);
  hairCap.position.set(0, 0.178, -0.022);
  hairCap.material = hairMat;
  hairCap.parent = headPivot;

  for (const side of [-1, 1]) {
    const templeSweep = B.MeshBuilder.CreateSphere(
      `${namePrefix}_hair_temple_${side}`,
      { diameter: 0.088, segments: 12 },
      scene
    );
    templeSweep.scaling.set(0.74, 0.56, 0.92);
    templeSweep.position.set(side * 0.064, 0.205, 0.036);
    templeSweep.rotation.z = -side * 0.28;
    templeSweep.material = hairMat;
    templeSweep.parent = headPivot;
  }

  const hairNape = B.MeshBuilder.CreateSphere(`${namePrefix}_hair_nape`, { diameter: 0.142, segments: 14 }, scene);
  hairNape.scaling.set(0.92, 0.72, 0.68);
  hairNape.position.set(0, 0.122, -0.072);
  hairNape.material = hairMat;
  hairNape.parent = headPivot;

  const hairBun = B.MeshBuilder.CreateSphere(`${namePrefix}_hair_bun`, { diameter: 0.104, segments: 14 }, scene);
  hairBun.scaling.set(0.96, 0.92, 0.88);
  hairBun.position.set(0, 0.176, -0.14);
  hairBun.material = hairMat;
  hairBun.parent = headPivot;

  const hairClasp = B.MeshBuilder.CreateTorus(
    `${namePrefix}_hair_clasp`,
    { diameter: 0.088, thickness: 0.013, tessellation: 18 },
    scene
  );
  hairClasp.rotation.x = Math.PI * 0.5;
  hairClasp.position.set(0, 0.176, -0.106);
  hairClasp.material = materials.hullAccentGold;
  hairClasp.parent = headPivot;

  // 5) Spherical Articulated Arms: Shoulders, Elbows, Wrists, Instrument Cuff & Gloved Hands (ZERO disconnected ends!)
  const makeArm = (side) => {
    const sh = new B.TransformNode(`${namePrefix}_sh_${side}`, scene);
    sh.position.set(side * 0.214, 0.472, 0);
    sh.parent = torsoPivot;

    // Spherical shoulder joint + contoured flight-suit pauldron dome
    const shoulderBall = B.MeshBuilder.CreateSphere(
      `${namePrefix}_sh_ball_${side}`,
      { diameter: 0.118, segments: 14 },
      scene
    );
    shoulderBall.material = materials.linXiaDarkTrim;
    shoulderBall.parent = sh;

    const pauldron = B.MeshBuilder.CreateSphere(
      `${namePrefix}_pauldron_${side}`,
      { diameter: 0.132, segments: 14, slice: 0.58 },
      scene
    );
    pauldron.position.set(side * 0.006, 0.006, 0);
    pauldron.rotation.z = -side * 0.25;
    pauldron.material = materials.linXiaSuit;
    pauldron.parent = sh;

    // Tapered upper arm cleanly seated inside both shoulder ball and elbow ball
    const upper = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_uarm_${side}`,
      { diameterTop: 0.106, diameterBottom: 0.088, height: 0.264, tessellation: 16 },
      scene
    );
    upper.position.set(0, -0.132, 0);
    upper.material = materials.linXiaSuit;
    upper.parent = sh;

    // Spherical elbow joint (zero seam gap even at deep flexion!)
    const elbow = new B.TransformNode(`${namePrefix}_elb_${side}`, scene);
    elbow.position.set(0, -0.26, 0);
    elbow.parent = sh;

    const elbowBall = B.MeshBuilder.CreateSphere(
      `${namePrefix}_elb_ball_${side}`,
      { diameter: 0.094, segments: 14 },
      scene
    );
    elbowBall.material = materials.linXiaDarkTrim;
    elbowBall.parent = elbow;

    // Tapered forearm cleanly seated between elbow ball and wrist ball
    const fore = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_farm_${side}`,
      { diameterTop: 0.086, diameterBottom: 0.066, height: 0.236, tessellation: 16 },
      scene
    );
    fore.position.set(0, -0.118, 0);
    fore.material = materials.linXiaSuit;
    fore.parent = elbow;

    // Slim dark-titanium instrument cuff + gold bezel ring
    const cuff = B.MeshBuilder.CreateCylinder(
      `${namePrefix}_cuff_${side}`,
      { diameterTop: 0.076, diameterBottom: 0.07, height: 0.052, tessellation: 16 },
      scene
    );
    cuff.position.set(0, -0.205, 0);
    cuff.material = materials.linXiaDarkTrim;
    cuff.parent = elbow;

    const cuffGold = B.MeshBuilder.CreateTorus(
      `${namePrefix}_cuff_gold_${side}`,
      { diameter: 0.073, thickness: 0.01, tessellation: 16 },
      scene
    );
    cuffGold.position.set(0, -0.18, 0);
    cuffGold.material = materials.hullAccentGold;
    cuffGold.parent = elbow;

    // Subtle recessed cyan holo-datapad on left forearm cuff
    if (side === -1) {
      const wristPad = B.MeshBuilder.CreateBox(
        `${namePrefix}_wristpad`,
        { width: 0.044, height: 0.052, depth: 0.018 },
        scene
      );
      wristPad.position.set(-0.022, -0.205, 0.03);
      wristPad.rotation.y = -0.45;
      wristPad.material = materials.emissiveCyan;
      wristPad.parent = elbow;
    }

    // Spherical wrist joint + sculpted ergonomic rounded gloved hand
    const wristBall = B.MeshBuilder.CreateSphere(
      `${namePrefix}_wrist_${side}`,
      { diameter: 0.064, segments: 12 },
      scene
    );
    wristBall.position.set(0, -0.236, 0);
    wristBall.material = gloveMat;
    wristBall.parent = elbow;

    const palm = B.MeshBuilder.CreateSphere(
      `${namePrefix}_hand_palm_${side}`,
      { diameter: 0.074, segments: 12 },
      scene
    );
    palm.scaling.set(0.82, 1.12, 0.56);
    palm.position.set(0, -0.276, 0.006);
    palm.material = gloveMat;
    palm.parent = elbow;

    const fingers = B.MeshBuilder.CreateSphere(
      `${namePrefix}_hand_fingers_${side}`,
      { diameter: 0.056, segments: 10 },
      scene
    );
    fingers.scaling.set(0.84, 0.96, 0.56);
    fingers.position.set(0, -0.31, 0.018);
    fingers.material = gloveMat;
    fingers.parent = elbow;

    const thumb = B.MeshBuilder.CreateSphere(
      `${namePrefix}_hand_thumb_${side}`,
      { diameter: 0.032, segments: 8 },
      scene
    );
    thumb.scaling.set(0.8, 1.35, 0.8);
    thumb.position.set(-side * 0.028, -0.274, 0.024);
    thumb.rotation.z = side * 0.35;
    thumb.material = gloveMat;
    thumb.parent = elbow;

    return { shoulder: sh, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const setPose = (pose = 'working', blend = 1.0, timeSec = 0) => {
    const b = clamp(Number.isFinite(blend) ? blend : 1, 0, 1);
    const breath = Math.sin(timeSec * 1.8) * 0.016;

    if (pose === 'working') {
      // Calmly facing desk & glowing holographic orrery, leaning gently forward recording logs
      root.rotation.y = lerp(root.rotation.y, -0.08, b);
      torsoPivot.rotation.x = lerp(torsoPivot.rotation.x, 0.13 + breath, b);
      torsoPivot.rotation.y = lerp(torsoPivot.rotation.y, -0.1, b);
      headPivot.rotation.x = lerp(headPivot.rotation.x, 0.18, b);
      headPivot.rotation.y = lerp(headPivot.rotation.y, -0.2, b);
      leftArm.shoulder.rotation.set(-0.64, 0, 0.12);
      leftArm.elbow.rotation.set(-0.76, 0, 0);
      rightArm.shoulder.rotation.set(-0.72, 0, -0.12);
      rightArm.elbow.rotation.set(-0.7, 0, 0);
    } else if (pose === 'turning') {
      // Astonished turn toward sealed glass box on desk center
      root.rotation.y = lerp(root.rotation.y, -0.58, b);
      torsoPivot.rotation.x = lerp(torsoPivot.rotation.x, 0.06 + breath, b);
      torsoPivot.rotation.y = lerp(torsoPivot.rotation.y, -0.25, b);
      headPivot.rotation.x = lerp(headPivot.rotation.x, 0.12, b);
      headPivot.rotation.y = lerp(headPivot.rotation.y, -0.32, b);
      leftArm.shoulder.rotation.set(-0.52, 0, 0.24);
      leftArm.elbow.rotation.set(-0.88, 0, 0);
      rightArm.shoulder.rotation.set(-0.36, 0, -0.2);
      rightArm.elbow.rotation.set(-0.56, 0, 0);
    } else if (pose === 'alarmed') {
      // Urgent turn back toward waking 08 号 cryo-pod (-2.3, 1.25, -1.6)
      root.rotation.y = lerp(root.rotation.y, -2.42, b);
      torsoPivot.rotation.x = lerp(torsoPivot.rotation.x, -0.04 + breath, b);
      torsoPivot.rotation.y = lerp(torsoPivot.rotation.y, -0.18, b);
      headPivot.rotation.x = lerp(headPivot.rotation.x, -0.04, b);
      headPivot.rotation.y = lerp(headPivot.rotation.y, -0.12, b);
      leftArm.shoulder.rotation.set(-0.42, 0, 0.22);
      leftArm.elbow.rotation.set(-0.64, 0, 0);
      rightArm.shoulder.rotation.set(-1.18, 0, -0.24);
      rightArm.elbow.rotation.set(-0.42, 0, 0);
    }
  };

  setPose('working', 1.0, 0);

  return {
    root,
    torsoPivot,
    headPivot,
    leftArm,
    rightArm,
    setPose,
    dispose() {
      root.dispose();
      for (const m of ownedMats) m.dispose(false, false);
      for (const t of ownedTex) t.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Curved-Bow Science Cabin Core Factory (Shared Across P2 S1 & P3 S4-S6)
// ---------------------------------------------------------------------------

export function createScienceCabinCore(scene, materials, namePrefix = 'cabin', opts = {}) {
  const B = globalThis.BABYLON;
  const registerShadowCaster = typeof opts.registerShadowCaster === 'function' ? opts.registerShadowCaster : null;
  const registerMirrorMesh = typeof opts.registerMirrorMesh === 'function' ? opts.registerMirrorMesh : null;

  const root = new B.TransformNode(`${namePrefix}_root`, scene);
  const ownedMats = [];
  const ownedTex = [];
  const ownedLights = [];
  const statusLights = [];
  const hingeBars = [];
  const cryoPods = [];

  const alertStripMat = new B.StandardMaterial(`${namePrefix}_alert_strip_mat`, scene);
  alertStripMat.diffuseColor = B.Color3.FromHexString('#58A6FF');
  alertStripMat.emissiveColor = B.Color3.FromHexString('#58A6FF').scale(0.85);
  alertStripMat.disableLighting = true;
  alertStripMat.disableDepthWrite = false;
  alertStripMat.needDepthPrePass = false;
  ownedMats.push(alertStripMat);

  // -------------------------------------------------------------------------
  // Origami-Ready Architectural Pivots (angle = 0 in S1/S4, unfolds ±90° in S5)
  // -------------------------------------------------------------------------
  const floorPivot = new B.TransformNode(`${namePrefix}_floor_pivot`, scene);
  floorPivot.position.set(0, 0, 0);
  floorPivot.parent = root;

  const ceilingPivot = new B.TransformNode(`${namePrefix}_ceiling_pivot`, scene);
  ceilingPivot.position.set(0, 4.15, 0);
  ceilingPivot.parent = root;

  const leftWallPivot = new B.TransformNode(`${namePrefix}_left_wall_pivot`, scene);
  leftWallPivot.position.set(-4.35, 0, 0);
  leftWallPivot.parent = root;

  const rightWallPivot = new B.TransformNode(`${namePrefix}_right_wall_pivot`, scene);
  rightWallPivot.position.set(4.35, 0, 0);
  rightWallPivot.parent = root;

  const bowUpperPivot = new B.TransformNode(`${namePrefix}_bow_upper_pivot`, scene);
  bowUpperPivot.position.set(0, 4.1, 4.95);
  bowUpperPivot.parent = root;

  const bowLowerPivot = new B.TransformNode(`${namePrefix}_bow_lower_pivot`, scene);
  bowLowerPivot.position.set(0, 0.05, 4.95);
  bowLowerPivot.parent = root;

  // 1) Polished Reflective Deck Floor (y = 0)
  const mirrorFloor = B.MeshBuilder.CreateBox(
    `${namePrefix}_mirror_deck`,
    { width: 8.8, height: 0.14, depth: 10.2 },
    scene
  );
  mirrorFloor.position.set(0, -0.07, 0.25);
  mirrorFloor.material = materials.cabinDeckMirror;
  mirrorFloor.receiveShadows = true;
  mirrorFloor.parent = floorPivot;

  // Polar-day luminous outer backing on underside of floor (revealed when floor flips in S5)
  const floorLuminousBack = B.MeshBuilder.CreatePlane(
    `${namePrefix}_floor_polar_back`,
    { width: 8.7, height: 10.1 },
    scene
  );
  floorLuminousBack.rotation.x = -Math.PI * 0.5;
  floorLuminousBack.position.set(0, -0.15, 0.25);
  floorLuminousBack.material = materials.polarWhitePanel;
  floorLuminousBack.parent = floorPivot;

  // Recessed cyan floor guide tracks leading toward bow dome
  for (const gx of [-1.45, 1.45]) {
    const track = B.MeshBuilder.CreateBox(
      `${namePrefix}_deck_track_${gx}`,
      { width: 0.045, height: 0.015, depth: 8.6 },
      scene
    );
    track.position.set(gx, 0.006, 0.35);
    track.material = alertStripMat;
    track.parent = floorPivot;
  }

  // 2) Sculpted Ceiling Vault & Linear Overhead Skylight Ribs
  const ceilingSlab = B.MeshBuilder.CreateBox(
    `${namePrefix}_ceiling_slab`,
    { width: 8.8, height: 0.16, depth: 9.8 },
    scene
  );
  ceilingSlab.position.set(0, 0.08, 0.1);
  ceilingSlab.material = materials.cabinDarkTitanium;
  ceilingSlab.parent = ceilingPivot;
  if (registerMirrorMesh) registerMirrorMesh(ceilingSlab);

  for (const rz of [-3.6, -1.5, 0.6, 2.7, 4.6]) {
    const beam = B.MeshBuilder.CreateBox(
      `${namePrefix}_ceil_rib_${rz}`,
      { width: 8.6, height: 0.22, depth: 0.26 },
      scene
    );
    beam.position.set(0, -0.1, rz);
    beam.material = materials.hullDarkRib;
    beam.parent = ceilingPivot;
    if (registerShadowCaster) registerShadowCaster(beam);
    if (registerMirrorMesh) registerMirrorMesh(beam);

    const statusBar = B.MeshBuilder.CreateBox(
      `${namePrefix}_status_bar_${rz}`,
      { width: 4.8, height: 0.036, depth: 0.06 },
      scene
    );
    statusBar.position.set(0, -0.22, rz);
    statusBar.material = alertStripMat;
    statusBar.parent = ceilingPivot;
    statusLights.push(statusBar);
    if (registerMirrorMesh) registerMirrorMesh(statusBar);
  }

  // 3) Curved Port & Starboard Dark-Titanium Bulkheads + Arched Wall Ribs
  const buildSideWall = (pivot, side) => {
    const wall = B.MeshBuilder.CreateBox(
      `${namePrefix}_wall_${side}`,
      { width: 0.18, height: 4.15, depth: 9.8 },
      scene
    );
    wall.position.set(0, 2.08, 0.1);
    wall.material = materials.cabinDarkTitanium;
    wall.receiveShadows = true;
    wall.parent = pivot;
    if (registerMirrorMesh) registerMirrorMesh(wall);

    // Outer polar-white face revealed as walls fold outward 90° in S5
    const outerWhite = B.MeshBuilder.CreatePlane(
      `${namePrefix}_wall_white_${side}`,
      { width: 9.6, height: 4.05 },
      scene
    );
    outerWhite.rotation.y = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    outerWhite.position.set(side * 0.105, 2.08, 0.1);
    outerWhite.material = materials.polarWhitePanel;
    outerWhite.parent = pivot;

    for (const rz of [-3.6, -1.5, 0.6, 2.7, 4.6]) {
      const col = B.MeshBuilder.CreateBox(
        `${namePrefix}_pillar_${side}_${rz}`,
        { width: 0.28, height: 4.1, depth: 0.28 },
        scene
      );
      col.position.set(-side * 0.16, 2.05, rz);
      col.material = materials.hullDarkRib;
      col.parent = pivot;
      if (registerShadowCaster) registerShadowCaster(col);
      if (registerMirrorMesh) registerMirrorMesh(col);
    }

    // Horizontal brushed-gold architectural datum rail
    const rail = B.MeshBuilder.CreateBox(
      `${namePrefix}_rail_${side}`,
      { width: 0.08, height: 0.07, depth: 9.2 },
      scene
    );
    rail.position.set(-side * 0.14, 1.32, 0.1);
    rail.material = materials.hullAccentGold;
    rail.parent = pivot;
    if (registerMirrorMesh) registerMirrorMesh(rail);
  };

  buildSideWall(leftWallPivot, -1);
  buildSideWall(rightWallPivot, 1);

  // Aft bulkhead closing rear cabin cleanly behind cryo-bay (z = -4.65)
  const aftWall = B.MeshBuilder.CreateBox(
    `${namePrefix}_aft_wall`,
    { width: 8.8, height: 4.2, depth: 0.2 },
    scene
  );
  aftWall.position.set(0, 2.1, -4.7);
  aftWall.material = materials.cabinDarkTitanium;
  aftWall.receiveShadows = true;
  aftWall.parent = root;
  if (registerMirrorMesh) registerMirrorMesh(aftWall);

  // 4) Curved Panoramic Bow Observation Canopy (z = +5.2) + Upper/Lower Bow Frames
  const bowUpperFrame = B.MeshBuilder.CreateBox(
    `${namePrefix}_bow_upper_frame`,
    { width: 8.8, height: 0.52, depth: 0.34 },
    scene
  );
  bowUpperFrame.position.set(0, -0.22, 0.18);
  bowUpperFrame.material = materials.hullDarkRib;
  bowUpperFrame.parent = bowUpperPivot;

  const bowLowerSill = B.MeshBuilder.CreateBox(
    `${namePrefix}_bow_lower_sill`,
    { width: 8.8, height: 0.62, depth: 0.42 },
    scene
  );
  bowLowerSill.position.set(0, 0.31, 0.18);
  bowLowerSill.material = materials.hullDarkRib;
  bowLowerSill.parent = bowLowerPivot;

  // Curved Panoramic Bow Glass (arc around z = 5.2)
  const bowWindowMesh = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_bow_window`,
    { diameter: 9.2, height: 3.18, tessellation: 32, arc: 0.32, sideOrientation: B.Mesh.DOUBLESIDE },
    scene
  );
  bowWindowMesh.position.set(0, 2.22, 1.05);
  bowWindowMesh.rotation.y = Math.PI * 0.5 - 0.32 * Math.PI;
  bowWindowMesh.material = materials.borosilicateGlass;
  bowWindowMesh.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
  bowWindowMesh.parent = root;

  // Slender curved titanium vertical mullions framing bow window
  for (const ang of [-0.46, -0.16, 0.16, 0.46]) {
    const mullion = B.MeshBuilder.CreateBox(
      `${namePrefix}_bow_mullion_${ang}`,
      { width: 0.1, height: 3.22, depth: 0.14 },
      scene
    );
    mullion.position.set(Math.sin(ang) * 4.55, 2.22, 1.05 + Math.cos(ang) * 4.55);
    mullion.rotation.y = ang;
    mullion.material = materials.hullDarkRib;
    mullion.parent = bowUpperPivot;
    // Offset relative to bowUpperPivot (0, 4.1, 4.95)
    mullion.position.y -= 4.1;
    mullion.position.z -= 4.95;
  }

  // 5) Glowing Cyan-Gold 4D Origami Hinge Seam Strips (hidden at hingeGlow=0, blooming in S5!)
  const addHingeBar = (name, width, height, pos, rot, parent) => {
    const bar = B.MeshBuilder.CreatePlane(name, { width, height }, scene);
    bar.position.set(pos[0], pos[1], pos[2]);
    bar.rotation.set(rot[0], rot[1], rot[2]);
    bar.material = materials.origamiHingeGlow;
    bar.renderingGroupId = RENDER_GROUPS.PUZZLE_AND_GHOSTS;
    bar.isVisible = false;
    bar.parent = parent;
    hingeBars.push(bar);
  };
  addHingeBar(`${namePrefix}_hinge_left_bot`, 9.8, 0.36, [0.06, 0.06, 0.1], [0, Math.PI * 0.5, 0], leftWallPivot);
  addHingeBar(`${namePrefix}_hinge_right_bot`, 9.8, 0.36, [-0.06, 0.06, 0.1], [0, -Math.PI * 0.5, 0], rightWallPivot);
  addHingeBar(`${namePrefix}_hinge_left_top`, 9.8, 0.36, [-4.3, -0.04, 0.1], [0, Math.PI * 0.5, 0], ceilingPivot);
  addHingeBar(`${namePrefix}_hinge_right_top`, 9.8, 0.36, [4.3, -0.04, 0.1], [0, -Math.PI * 0.5, 0], ceilingPivot);
  addHingeBar(`${namePrefix}_hinge_bow_top`, 8.6, 0.38, [0, -0.04, 0.02], [0, 0, 0], bowUpperPivot);
  addHingeBar(`${namePrefix}_hinge_bow_bot`, 8.6, 0.38, [0, 0.04, 0.02], [0, 0, 0], bowLowerPivot);

  // 6) Central Scientific Desk at (0, 0, 2.05) + Warm Amber Lamp + Star-Chart Console
  const deskRoot = new B.TransformNode(`${namePrefix}_desk_root`, scene);
  deskRoot.position.set(0, 0, 2.05);
  deskRoot.parent = root;

  const tabletop = B.MeshBuilder.CreateBox(
    `${namePrefix}_desk_top`,
    { width: 2.35, height: 0.09, depth: 1.05 },
    scene
  );
  tabletop.position.set(0, 0.84, 0);
  tabletop.material = materials.deskWoodBronze;
  tabletop.receiveShadows = true;
  tabletop.parent = deskRoot;
  if (registerShadowCaster) registerShadowCaster(tabletop);
  if (registerMirrorMesh) registerMirrorMesh(tabletop);

  for (const sx of [-0.94, 0.94]) {
    const leg = B.MeshBuilder.CreateBox(
      `${namePrefix}_desk_leg_${sx}`,
      { width: 0.14, height: 0.82, depth: 0.72 },
      scene
    );
    leg.position.set(sx, 0.41, 0);
    leg.material = materials.hullDarkRib;
    leg.parent = deskRoot;
    if (registerShadowCaster) registerShadowCaster(leg);
    if (registerMirrorMesh) registerMirrorMesh(leg);
  }

  // Precision brass specimen pad centered at desk top (0, 0.89, 2.05) for sealed borosilicate box
  const specimenPad = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_specimen_pad`,
    { diameter: 0.58, height: 0.028, tessellation: 32 },
    scene
  );
  specimenPad.position.set(0, 0.895, 0);
  specimenPad.material = materials.hullAccentGold;
  specimenPad.parent = deskRoot;

  // Star-Chart Scientific Console Screen (starboard side in front of Lin Xia)
  const chartTex = createStarChartConsoleTexture(scene, `${namePrefix}_starchart_tex`);
  ownedTex.push(chartTex);
  const chartMat = new B.StandardMaterial(`${namePrefix}_starchart_mat`, scene);
  chartMat.diffuseTexture = chartTex;
  chartMat.emissiveTexture = chartTex;
  chartMat.emissiveColor = B.Color3.White().scale(0.95);
  chartMat.disableLighting = true;
  chartMat.disableDepthWrite = false;
  chartMat.needDepthPrePass = false;
  ownedMats.push(chartMat);

  const consoleFrame = B.MeshBuilder.CreateBox(
    `${namePrefix}_console_frame`,
    { width: 0.64, height: 0.4, depth: 0.04 },
    scene
  );
  consoleFrame.position.set(0.58, 1.09, 0.24);
  consoleFrame.rotation.set(0.32, -0.24, 0);
  consoleFrame.material = materials.hullDarkRib;
  consoleFrame.parent = deskRoot;
  if (registerShadowCaster) registerShadowCaster(consoleFrame);

  const consoleScreen = B.MeshBuilder.CreatePlane(
    `${namePrefix}_console_screen`,
    { width: 0.58, height: 0.34 },
    scene
  );
  consoleScreen.position.set(0, 0, -0.024);
  consoleScreen.material = chartMat;
  consoleScreen.parent = consoleFrame;

  // Articulated Warm Amber Architect Desk Lamp (right corner of desk)
  const lampBase = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_lamp_base`,
    { diameter: 0.18, height: 0.04, tessellation: 20 },
    scene
  );
  lampBase.position.set(0.94, 0.9, -0.14);
  lampBase.material = materials.hullAccentGold;
  lampBase.parent = deskRoot;

  const lampStem = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_lamp_stem`,
    { diameter: 0.026, height: 0.52, tessellation: 12 },
    scene
  );
  lampStem.position.set(0.92, 1.15, -0.14);
  lampStem.rotation.z = 0.16;
  lampStem.material = materials.hullAccentGold;
  lampStem.parent = deskRoot;

  const lampShade = B.MeshBuilder.CreateCylinder(
    `${namePrefix}_lamp_shade`,
    { diameterTop: 0.08, diameterBottom: 0.26, height: 0.16, tessellation: 20 },
    scene
  );
  lampShade.position.set(0.8, 1.38, -0.12);
  lampShade.rotation.z = 0.36;
  lampShade.material = materials.hullAccentGold;
  lampShade.parent = deskRoot;
  if (registerShadowCaster) registerShadowCaster(lampShade);

  const lampBulb = B.MeshBuilder.CreateSphere(
    `${namePrefix}_lamp_bulb`,
    { diameter: 0.11, segments: 12 },
    scene
  );
  lampBulb.position.set(0.78, 1.33, -0.12);
  lampBulb.material = materials.emissiveWarmLamp;
  lampBulb.parent = deskRoot;

  // Dedicated Warm Amber Local PointLight casting human warmth across Lin Xia & desk
  const deskLampLight = new B.PointLight(
    `${namePrefix}_desk_lamp_light`,
    new B.Vector3(0.76, 1.48, 1.92),
    scene
  );
  deskLampLight.diffuse = B.Color3.FromHexString('#FFB862');
  deskLampLight.specular = B.Color3.FromHexString('#FFD699');
  deskLampLight.intensity = 2.6;
  deskLampLight.range = 8.5;
  deskLampLight.parent = root;
  ownedLights.push(deskLampLight);

  // 7) Sculpted 07 号 Lin Xia Figure at (0.45, 0, 1.8) -> slightly behind/beside desk
  const linXiaRig = createLinXiaFigure(scene, materials, `${namePrefix}_linxia`);
  linXiaRig.root.position.set(0.45, 0, 1.48);
  linXiaRig.root.parent = root;
  for (const m of linXiaRig.root.getChildMeshes()) {
    if (registerShadowCaster) registerShadowCaster(m);
    if (registerMirrorMesh) registerMirrorMesh(m);
  }

  // 8) Recessed Port Cryo-Bay (x = -2.3) with 4 Cryo Pods (Hero 08 号 at (-2.3, 0, -1.6))
  const cryoPositions = [
    { code: '06 号', z: -3.15, isHero: false },
    { code: '08 号', z: -1.6, isHero: true },
    { code: '09 号', z: -0.05, isHero: false },
    { code: '10 号', z: 1.5, isHero: false },
  ];

  let pod08Rig = null;
  for (const cfg of cryoPositions) {
    const pod = createCryoPodUnit(scene, materials, `${namePrefix}_pod_${cfg.code.replace(/\s+/g, '')}`, {
      podCode: cfg.code,
      statusLabel: '冬眠中',
      accentHex: '#58A6FF',
    });
    pod.root.position.set(-2.3, 0, cfg.z);
    pod.root.rotation.y = 0.48; // Angled gracefully toward cabin center & bow camera!
    pod.root.parent = root;
    cryoPods.push(pod);

    for (const m of pod.root.getChildMeshes()) {
      if (registerShadowCaster) registerShadowCaster(m);
      if (registerMirrorMesh) registerMirrorMesh(m);
    }
    if (cfg.isHero) {
      pod08Rig = pod;
    }
  }

  // Dedicated Cool Ice-Blue Cryo-Bay Fill Light contrasting the warm amber desk pool!
  const cryoBayLight = new B.PointLight(
    `${namePrefix}_cryo_bay_light`,
    new B.Vector3(-2.1, 2.55, -1.2),
    scene
  );
  cryoBayLight.diffuse = B.Color3.FromHexString('#58A6FF');
  cryoBayLight.specular = B.Color3.FromHexString('#9ED8FF');
  cryoBayLight.intensity = 2.15;
  cryoBayLight.range = 10.0;
  cryoBayLight.parent = root;
  ownedLights.push(cryoBayLight);

  return {
    root,
    deskRoot,
    bowWindowMesh,
    linXiaRig,
    pod08Rig,
    cryoPods,
    statusLights,
    mirrorFloor,
    deskLampLight,
    cryoBayLight,
    origamiPivots: {
      floorPivot,
      ceilingPivot,
      leftWallPivot,
      rightWallPivot,
      bowUpperPivot,
      bowLowerPivot,
      hingeBars,
    },

    setAlertLevel(alert01 = 0, timeSec = 0) {
      const a = clamp(Number.isFinite(alert01) ? alert01 : 0, 0, 1);
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 7.5);
      const cool = B.Color3.FromHexString('#58A6FF');
      const amber = B.Color3.FromHexString('#F7B733');
      const col = B.Color3.Lerp(cool, amber, a);
      alertStripMat.diffuseColor = col;
      alertStripMat.emissiveColor = col.scale(0.85 + a * 1.1 * pulse);
    },

    setLinXiaPose(pose, blend = 1.0, timeSec = 0) {
      linXiaRig.setPose(pose, blend, timeSec);
    },

    setPod08State(state) {
      if (pod08Rig) {
        pod08Rig.setStatus(state);
        if (state && (state.mode === 'waking' || state.mode === 'open')) {
          const pulse = 0.7 + 0.3 * (state.alertPulse ?? 0.5);
          cryoBayLight.diffuse = B.Color3.FromHexString(PALETTE.accent.emerald);
          cryoBayLight.intensity = 2.4 * pulse;
        } else {
          cryoBayLight.diffuse = B.Color3.FromHexString('#58A6FF');
          cryoBayLight.intensity = 2.15;
        }
      }
    },

    setBowWindowIntact(intact) {
      bowWindowMesh.isVisible = Boolean(intact);
    },

    setOrigamiState(angles) {
      if (!angles) return;
      leftWallPivot.rotation.z = angles.leftBulkheadRad ?? 0;
      rightWallPivot.rotation.z = angles.rightBulkheadRad ?? 0;
      ceilingPivot.rotation.x = angles.ceilingRad ?? 0;
      floorPivot.rotation.x = angles.floorRad ?? 0;
      bowUpperPivot.rotation.x = angles.bowUpperRad ?? 0;
      bowLowerPivot.rotation.x = angles.bowLowerRad ?? 0;

      const spread = angles.expansionSpread ?? 0;
      leftWallPivot.position.x = -4.35 - spread * 1.25;
      rightWallPivot.position.x = 4.35 + spread * 1.25;
      ceilingPivot.position.y = 4.15 + spread * 1.1;

      const glow = angles.hingeGlow ?? 0;
      for (const bar of hingeBars) {
        bar.isVisible = glow > 0.02;
      }
    },

    dispose() {
      for (const pod of cryoPods) pod.dispose();
      linXiaRig.dispose();
      for (const l of ownedLights) l.dispose();
      root.dispose();
      for (const m of ownedMats) m.dispose(false, false);
      for (const t of ownedTex) t.dispose();
    },
  };
}
