/**
 * Beyond 3D — AAA Procedural PBR Material, IBL Environment & Post-Processing Pipeline
 *
 * Zero external textures or HDR downloads (100% deterministic, offline-safe, instant load):
 * - Procedural 6-face Cathedral IBL CubeTexture for realistic metallic & clearcoat reflections
 * - Heightfield -> Sobel Tangent-Space Normal Map generator for carved stone & marble relief
 * - Procedural Albedo + Metallic/Roughness (ORM) textures for Obsidian Monoliths, Antique Bronze,
 *   Sanctuary Alabaster Marble, Glossy Reflective Floor, and Passing Orb Energy Crystal
 * - Babylon DefaultRenderingPipeline (ACES Filmic, Bloom, MSAA/FXAA, Subtle Grain, Sharpen, Vignette)
 */

import { PALETTE } from './phase-materials.js';

/**
 * Generate a 6-face procedural HDR-like Cathedral IBL CubeTexture so every PBRMaterial
 * receives rich warm clerestory highlights, antique bronze horizon glow, and deep obsidian bounce.
 */
export function createSanctuaryEnvironmentTexture(scene) {
  const B = globalThis.BABYLON;
  const size = 64;

  // Direction helper for each cube face (+X, -X, +Y, -Y, +Z, -Z)
  const faceDirs = [
    (u, v) => [1, -v, -u], // +X
    (u, v) => [-1, -v, u], // -X
    (u, v) => [u, 1, v], // +Y (ceiling skylight!)
    (u, v) => [u, -1, -v], // -Y (obsidian floor bounce)
    (u, v) => [u, -v, 1], // +Z (hairline slit & sanctuary gate radiance!)
    (u, v) => [-u, -v, -1], // -Z
  ];

  const faces = faceDirs.map((dirFn) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const [dx, dy, dz] = dirFn(u, v);
        const len = Math.hypot(dx, dy, dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        // Base cathedral gradient: warm dark obsidian bottom -> bronze horizon -> bright clerestory zenith
        let r = 24;
        let g = 20;
        let b = 15;

        if (ny > 0) {
          const up = Math.pow(ny, 1.8);
          r += up * 165;
          g += up * 145;
          b += up * 112;
          // Crisp elongated clerestory skylight strip along X=0 overhead
          const skyStrip = Math.exp(-Math.pow(nx * 5.2, 2)) * Math.pow(ny, 2.2);
          r += skyStrip * 135;
          g += skyStrip * 128;
          b += skyStrip * 108;
        } else {
          // Subtle warm-gold reflected bounce from polished sanctuary floor
          const down = Math.pow(-ny, 1.4);
          r += down * 18;
          g += down * 14;
          b += down * 10;
        }

        // Luminous vertical platinum slit highlight along +Z / -Z center
        const slitRibbon = Math.exp(-Math.pow(nx * 9.0, 2)) * Math.max(0, nz) * (1 - Math.abs(ny) * 0.5);
        r += slitRibbon * 180;
        g += slitRibbon * 172;
        b += slitRibbon * 142;

        // Flanking subtle cyan/gold sanctuary rim accents on ±X horizon
        const eastGold = Math.pow(Math.max(0, nx), 4) * (1 - Math.abs(ny));
        r += eastGold * 78;
        g += eastGold * 58;
        b += eastGold * 18;

        const westCyan = Math.pow(Math.max(0, -nx), 4) * (1 - Math.abs(ny));
        r += westCyan * 22;
        g += westCyan * 58;
        b += westCyan * 68;

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, Math.round(r));
        data[idx + 1] = Math.min(255, Math.round(g));
        data[idx + 2] = Math.min(255, Math.round(b));
        data[idx + 3] = 255;
      }
    }
    return data;
  });

  const cubeTex = new B.RawCubeTexture(
    scene,
    faces,
    size,
    B.Engine.TEXTUREFORMAT_RGBA,
    B.Engine.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    B.Texture.TRILINEAR_SAMPLINGMODE
  );
  cubeTex.name = 'sanctuary_ibl_env';
  scene.environmentTexture = cubeTex;
  scene.environmentIntensity = 1.25;
  return cubeTex;
}

/**
 * Convert a grayscale architectural heightfield canvas into a true Tangent-Space Normal Map
 * using a 3x3 Sobel operator.
 */
export function buildNormalTextureFromHeightCanvas(scene, name, heightCanvas, strength = 2.6, uScale = 1, vScale = 1) {
  const B = globalThis.BABYLON;
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d');
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const tex = new B.DynamicTexture(name, { width: w, height: h }, scene, true);
  const dstCtx = tex.getContext();
  const outImg = dstCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dZ = 1.0;
      const invLen = 1 / Math.hypot(dX, dY, dZ);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dZ * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  dstCtx.putImageData(outImg, 0, 0);
  tex.update();
  tex.uScale = uScale;
  tex.vScale = vScale;
  return tex;
}

/**
 * Deterministic fast value noise for subtle stone & marble organic variation (zero dirty grime!).
 */
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Carved Obsidian-Gold Sanctuary Monolith PBR Material
 * Features honed volcanic basalt blocks, recessed architectural fluting, bronze geometric filigree,
 * matching Sobel normal relief, and per-pixel metallic/roughness (ORM) map!
 */
export function createCarvedObsidianMonolithPBR(scene, name = 'aaa_monolith_pbr', uScale = 2, vScale = 2) {
  const B = globalThis.BABYLON;
  const size = 512;

  const albedoTex = new B.DynamicTexture(`${name}_albedo`, { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture(`${name}_orm`, { width: size, height: size }, scene, true);
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  // 1. Honed Obsidian Basalt Base (subtle architectural tonal variation)
  const bg = aCtx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#272219');
  bg.addColorStop(0.5, '#1D1912');
  bg.addColorStop(1, '#14110C');
  aCtx.fillStyle = bg;
  aCtx.fillRect(0, 0, size, size);

  // ORM channel map (Babylon convention: R=AO, G=Roughness, B=Metallic)
  // Base stone: AO=240, Roughness=105 (~0.41 semi-honed sheen), Metallic=20
  oCtx.fillStyle = 'rgb(240, 108, 22)';
  oCtx.fillRect(0, 0, size, size);

  // Neutral raised heightfield
  hCtx.fillStyle = 'rgb(168, 168, 168)';
  hCtx.fillRect(0, 0, size, size);

  // Subtle crystalline mineral micro-variation
  for (let i = 0; i < 1600; i += 1) {
    const x = Math.floor(hash2(i, 1.3) * size);
    const y = Math.floor(hash2(i, 7.9) * size);
    const r = 1 + hash2(i, 3.7) * 2.5;
    const bright = hash2(i, 9.1) > 0.5;
    aCtx.fillStyle = bright ? 'rgba(255, 244, 214, 0.025)' : 'rgba(6, 5, 3, 0.06)';
    aCtx.fillRect(x, y, r, r);
    hCtx.fillStyle = bright ? 'rgba(195,195,195,0.18)' : 'rgba(140,140,140,0.18)';
    hCtx.fillRect(x, y, r, r);
  }

  // 2. Monumental Recessed Stone Block Courses & Vertical Architectural Fluting
  for (let x = 0; x < size; x += 64) {
    // Deep recessed vertical flute
    aCtx.fillStyle = '#0F0C08';
    aCtx.fillRect(x, 0, 4, size);
    oCtx.fillStyle = 'rgb(140, 215, 10)'; // Occluded matte groove
    oCtx.fillRect(x, 0, 4, size);
    hCtx.fillStyle = 'rgb(55, 55, 55)';
    hCtx.fillRect(x, 0, 4, size);

    // Subtle beveled highlight shoulder next to flute
    aCtx.fillStyle = 'rgba(246, 236, 208, 0.045)';
    aCtx.fillRect(x + 4, 0, 6, size);
    oCtx.fillStyle = 'rgb(255, 76, 35)'; // Slightly smoother honed bevel
    oCtx.fillRect(x + 4, 0, 6, size);
    hCtx.fillStyle = 'rgb(198, 198, 198)';
    hCtx.fillRect(x + 4, 0, 6, size);
  }

  for (let y = 0; y < size; y += 128) {
    aCtx.fillStyle = '#0E0B08';
    aCtx.fillRect(0, y, size, 4);
    oCtx.fillStyle = 'rgb(140, 215, 10)';
    oCtx.fillRect(0, y, size, 4);
    hCtx.fillStyle = 'rgb(48, 48, 48)';
    hCtx.fillRect(0, y, size, 4);
  }

  // 3. Inlaid Antique-Bronze Geometric Sanctuary Filigree (True High-Metallic PBR!)
  const drawFiligree = (ctx, stroke, width) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    for (let y = 64; y < size; y += 128) {
      for (let x = 64; x < size; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y - 34);
        ctx.lineTo(x + 34, y);
        ctx.lineTo(x, y + 34);
        ctx.lineTo(x - 34, y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Horizontal hairline brass datum strips
    for (let y = 128; y <= size; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y - 8);
      ctx.lineTo(size, y - 8);
      ctx.stroke();
    }
  };

  drawFiligree(aCtx, '#A8823B', 2.2);
  drawFiligree(oCtx, 'rgb(255, 62, 238)', 2.8); // Metallic=0.93, Roughness=0.24 gleaming inlaid gold!
  drawFiligree(hCtx, 'rgb(230, 230, 230)', 2.4); // Slightly raised inlaid brass trim

  albedoTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;

  ormTex.update();
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const normalTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 2.8, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = B.Color3.White();
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = 0.85;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.22;
  mat.clearCoat.roughness = 0.28;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Polished Obsidian Sanctuary Floor with Real-Time MirrorTexture Reflection + Inlaid Bronze Tiles.
 */
export function createSanctuaryMirrorFloorPBR(scene, mirrorRenderList, uScale = 11, vScale = 14) {
  const B = globalThis.BABYLON;
  const size = 512;

  const albedoTex = new B.DynamicTexture('aaa_floor_albedo', { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture('aaa_floor_orm', { width: size, height: size }, scene, true);
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  // Deep mirror-honed black-obsidian floor
  aCtx.fillStyle = '#15120D';
  aCtx.fillRect(0, 0, size, size);
  oCtx.fillStyle = 'rgb(245, 58, 40)'; // Glossy honed obsidian (roughness ~0.22)
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(180, 180, 180)';
  hCtx.fillRect(0, 0, size, size);

  // Large monumental basalt paving slabs with brushed bronze grout inlays
  const step = 128;
  for (let i = 0; i <= size; i += step) {
    aCtx.fillStyle = '#8F6D31';
    aCtx.fillRect(i, 0, 3, size);
    aCtx.fillRect(0, i, size, 3);

    oCtx.fillStyle = 'rgb(255, 72, 232)'; // Metallic bronze grout
    oCtx.fillRect(i, 0, 3, size);
    oCtx.fillRect(0, i, size, 3);

    hCtx.fillStyle = 'rgb(95, 95, 95)'; // Recessed precision inlay seam
    hCtx.fillRect(i, 0, 3, size);
    hCtx.fillRect(0, i, size, 3);
  }

  // Subtle corner square inlays inside each slab
  aCtx.strokeStyle = 'rgba(138, 106, 47, 0.28)';
  aCtx.lineWidth = 1.5;
  oCtx.strokeStyle = 'rgb(255, 84, 210)';
  oCtx.lineWidth = 2;
  hCtx.strokeStyle = 'rgb(135, 135, 135)';
  hCtx.lineWidth = 1.5;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      aCtx.strokeRect(x + 14, y + 14, step - 28, step - 28);
      oCtx.strokeRect(x + 14, y + 14, step - 28, step - 28);
      hCtx.strokeRect(x + 14, y + 14, step - 28, step - 28);
    }
  }

  albedoTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.update();
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const normalTex = buildNormalTextureFromHeightCanvas(
    scene,
    'aaa_floor_normal',
    heightCanvas,
    1.9,
    uScale,
    vScale
  );

  // Real-time blurred MirrorTexture reflecting monoliths, glowing slit, and floating orb!
  const mirrorTex = new B.MirrorTexture('sanctuary_floor_mirror', 512, scene, true);
  mirrorTex.mirrorPlane = new B.Plane(0, -1, 0, 0);
  mirrorTex.level = 0.42;
  mirrorTex.adaptiveBlurKernel = 18;
  mirrorTex.renderList = mirrorRenderList;

  const mat = new B.PBRMaterial('aaa_sanctuary_floor_pbr', scene);
  mat.albedoColor = B.Color3.White();
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = 0.55;
  mat.reflectionTexture = mirrorTex;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.48;
  mat.clearCoat.roughness = 0.16;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;

  return { mat, mirrorTex };
}

/**
 * Brushed Antique Sanctuary Bronze PBR Material (#8A6A2F / #B89146 metallic luster).
 */
export function createAntiqueBronzePBR(scene, name = 'aaa_bronze_pbr', emissiveBoost = 0.12) {
  const B = globalThis.BABYLON;
  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = B.Color3.FromHexString('#B58C42');
  mat.metallic = 0.92;
  mat.roughness = 0.26;
  mat.emissiveColor = B.Color3.FromHexString(PALETTE.zoneC.bronze).scale(emissiveBoost);
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.3;
  mat.clearCoat.roughness = 0.22;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Sanctuary Pure White Honed Alabaster Marble PBR Material (#F6F4EE) with delicate gold mineral veining.
 */
export function createSanctuaryMarblePBR(scene, name = 'aaa_marble_pbr') {
  const B = globalThis.BABYLON;
  const size = 256;
  const tex = new B.DynamicTexture(`${name}_tex`, { width: size, height: size }, scene, true);
  const ctx = tex.getContext();

  ctx.fillStyle = PALETTE.zoneC.sanctuaryWhite;
  ctx.fillRect(0, 0, size, size);

  // Subtle warm alabaster-gold marble veins
  ctx.strokeStyle = 'rgba(180, 152, 102, 0.22)';
  ctx.lineWidth = 1.4;
  for (let v = 0; v < 9; v += 1) {
    ctx.beginPath();
    let y = (v / 9) * size;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      y += Math.sin(x * 0.045 + v * 1.9) * 3.5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  tex.update();

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = B.Color3.White();
  mat.albedoTexture = tex;
  mat.metallic = 0.06;
  mat.roughness = 0.22;
  mat.emissiveColor = B.Color3.FromHexString('#FFF6E0').scale(0.06);
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.58;
  mat.clearCoat.roughness = 0.12;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Crystalline High-Dimensional Passing Orb PBR Material
 * Polished clearcoat glass-crystal energy sphere with engraved sacred meridian lattice emissive map.
 */
export function createPassingOrbCrystalPBR(scene) {
  const B = globalThis.BABYLON;
  const w = 1024;
  const h = 512;
  const albedoTex = new B.DynamicTexture('aaa_orb_alien_albedo', { width: w, height: h }, scene, true);
  const emissiveTex = new B.DynamicTexture('aaa_orb_alien_emissive', { width: w, height: h }, scene, true);
  const aCtx = albedoTex.getContext();
  const eCtx = emissiveTex.getContext();

  // 1. Deep translucent alien jade-teal crystal base (albedo + internal cosmic energy glow)
  const baseGrad = aCtx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0, '#0C3E40');
  baseGrad.addColorStop(0.25, '#125F5D');
  baseGrad.addColorStop(0.5, '#187C76');
  baseGrad.addColorStop(0.75, '#125F5D');
  baseGrad.addColorStop(1, '#0C3E40');
  aCtx.fillStyle = baseGrad;
  aCtx.fillRect(0, 0, w, h);

  const emBase = eCtx.createLinearGradient(0, 0, 0, h);
  emBase.addColorStop(0, '#041C1E');
  emBase.addColorStop(0.5, '#0B3A3A');
  emBase.addColorStop(1, '#041C1E');
  eCtx.fillStyle = emBase;
  eCtx.fillRect(0, 0, w, h);

  // 2. Cosmic-cube style internal plasma/energy clouds & luminous cyan veins
  const drawGlowBlob = (ctx, cx, cy, r, colorInner, colorOuter) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    g.addColorStop(0, colorInner);
    g.addColorStop(1, colorOuter);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (let i = 0; i < 28; i += 1) {
    const px = ((i * 197 + 61) % w);
    const py = 70 + ((i * 131 + 43) % (h - 140));
    const pr = 42 + ((i * 29) % 76);
    drawGlowBlob(aCtx, px, py, pr, 'rgba(72, 240, 220, 0.24)', 'rgba(20, 120, 115, 0)');
    drawGlowBlob(eCtx, px, py, pr * 0.9, 'rgba(77, 238, 220, 0.34)', 'rgba(10, 60, 60, 0)');
  }

  // Organic glowing cosmic energy filaments
  const drawEnergyVein = (ctx, startX, startY, seed, color, lineW) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let x = startX;
    let y = startY;
    ctx.moveTo(x, y);
    for (let s = 1; s <= 18; s += 1) {
      x += 22 + Math.sin(seed + s * 1.3) * 14;
      y += Math.cos(seed * 1.7 + s * 0.9) * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  for (let i = 0; i < 12; i += 1) {
    const sx = (i * 93) % w;
    const sy = 96 + ((i * 71) % (h - 192));
    drawEnergyVein(aCtx, sx, sy, i * 2.1, 'rgba(128, 255, 240, 0.22)', 2.4);
    drawEnergyVein(eCtx, sx, sy, i * 2.1, 'rgba(110, 255, 238, 0.42)', 1.8);
  }

  // 3. Recessed alien geometric conduit channels (dark carved groove + brushed gold inlay)
  const strokeBoth = (drawFn, goldWidth, goldColor, emGoldColor) => {
    // Dark recessed groove on albedo
    aCtx.save();
    aCtx.strokeStyle = 'rgba(5, 22, 24, 0.72)';
    aCtx.lineWidth = goldWidth + 3.2;
    drawFn(aCtx);
    aCtx.stroke();
    // Brushed gold inlay on albedo
    aCtx.strokeStyle = goldColor;
    aCtx.lineWidth = goldWidth;
    drawFn(aCtx);
    aCtx.stroke();
    aCtx.restore();

    // Soft warm-gold emission
    eCtx.save();
    eCtx.strokeStyle = emGoldColor;
    eCtx.lineWidth = goldWidth * 0.9;
    drawFn(eCtx);
    eCtx.stroke();
    eCtx.restore();
  };

  const cy = h * 0.5;

  // Dual equatorial golden energy conduits with delicate diamond nodes
  strokeBoth(
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, cy - 10);
      ctx.lineTo(w, cy - 10);
      ctx.moveTo(0, cy + 10);
      ctx.lineTo(w, cy + 10);
    },
    2.2,
    '#F5D276',
    'rgba(247, 198, 84, 0.65)'
  );

  // Subtle polar latitude harmonic rings + alien micro-ticks
  for (const latY of [96, 152, h - 152, h - 96]) {
    strokeBoth(
      (ctx) => {
        ctx.beginPath();
        ctx.moveTo(0, latY);
        ctx.lineTo(w, latY);
        for (let x = 16; x < w; x += 32) {
          ctx.moveTo(x, latY - 5);
          ctx.lineTo(x, latY + 5);
        }
      },
      1.3,
      'rgba(245, 210, 118, 0.72)',
      'rgba(247, 198, 84, 0.36)'
    );
  }

  // Sweeping meridian sacred arcs connecting the 4 cardinal medallions
  for (const mx of [0, w * 0.25, w * 0.5, w * 0.75, w]) {
    strokeBoth(
      (ctx) => {
        ctx.beginPath();
        ctx.moveTo(mx, 44);
        ctx.lineTo(mx, h - 44);
      },
      1.8,
      'rgba(245, 210, 118, 0.8)',
      'rgba(247, 198, 84, 0.45)'
    );
  }

  // 4. Flush Alien Polar Totem Medallions (ZERO protrusion — etched right into the sphere skin!)
  const drawMedallionBase = (cx, radius) => {
    // Dark carved recess + glowing inner backdrop
    drawGlowBlob(aCtx, cx, cy, radius * 1.12, 'rgba(6, 28, 30, 0.85)', 'rgba(6, 28, 30, 0)');
    drawGlowBlob(eCtx, cx, cy, radius * 1.05, 'rgba(92, 255, 238, 0.55)', 'rgba(12, 60, 62, 0)');

    strokeBoth(
      (ctx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.moveTo(cx + radius * 0.82, cy);
        ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
        // Alien radial astronomical ticks between outer & inner rings
        for (let k = 0; k < 16; k += 1) {
          const ang = (k / 16) * Math.PI * 2;
          const r0 = radius * (k % 2 === 0 ? 0.83 : 0.88);
          const r1 = radius * 0.98;
          ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        }
      },
      2.6,
      '#FFE08A',
      'rgba(255, 215, 110, 0.85)'
    );
  };

  // Left Pole (-X) & Right Pole (+X) sit at u = 0.0 (wraps at 0 & w) and u = 0.5 on Babylon spheres;
  // Front (-Z) & Back (+Z) sit at u = 0.25 and u = 0.75.
  // Draw Star-Chevron Totem at u = 0.0 (both 0 and w for seamless wrap) and Concentric Eclipse Totem at u = 0.5!
  const drawStarChevronTotem = (cx, r) => {
    drawMedallionBase(cx, r);
    const drawGlyph = (ctx) => {
      ctx.beginPath();
      // 6-point sharp alien star-chevron
      for (let i = 0; i < 6; i += 1) {
        const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 0.5) / 6) * Math.PI * 2 - Math.PI / 2;
        const rOut = i % 2 === 0 ? r * 0.68 : r * 0.46;
        const rIn = r * 0.22;
        if (i === 0) ctx.moveTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        else ctx.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        ctx.lineTo(cx + Math.cos(a2) * rIn, cy + Math.sin(a2) * rIn);
      }
      ctx.closePath();
      // Inner triangle core
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * r * 0.34;
        const py = cy + Math.sin(a) * r * 0.34;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    strokeBoth(drawGlyph, 3.0, '#D6FFF8', 'rgba(145, 255, 240, 0.98)');
  };

  const drawEclipseRingTotem = (cx, r) => {
    drawMedallionBase(cx, r);
    const drawGlyph = (ctx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
      ctx.moveTo(cx + r * 0.28, cy);
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      // Four alien crescent arcs
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.moveTo(cx + Math.cos(a) * r * 0.30, cy + Math.sin(a) * r * 0.30);
        ctx.lineTo(cx + Math.cos(a) * r * 0.68, cy + Math.sin(a) * r * 0.68);
      }
    };
    strokeBoth(drawGlyph, 3.0, '#D6FFF8', 'rgba(145, 255, 240, 0.98)');
  };

  const drawCentralSeal = (cx, r) => {
    drawMedallionBase(cx, r);
    const drawGlyph = (ctx) => {
      ctx.beginPath();
      // Diamond + inner ring alien lock core
      ctx.moveTo(cx, cy - r * 0.62);
      ctx.lineTo(cx + r * 0.62, cy);
      ctx.lineTo(cx, cy + r * 0.62);
      ctx.lineTo(cx - r * 0.62, cy);
      ctx.closePath();
      ctx.moveTo(cx + r * 0.26, cy);
      ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
    };
    strokeBoth(drawGlyph, 2.5, '#FFE8A0', 'rgba(255, 224, 130, 0.9)');
  };

  drawStarChevronTotem(0, 74);
  drawStarChevronTotem(w, 74);
  drawEclipseRingTotem(w * 0.5, 74);
  drawCentralSeal(w * 0.25, 56);
  drawCentralSeal(w * 0.75, 56);

  albedoTex.update();
  emissiveTex.update();

  const mat = new B.PBRMaterial('aaa_orb_crystal_pbr', scene);
  mat.albedoColor = new B.Color3(1, 1, 1);
  mat.albedoTexture = albedoTex;
  mat.metallic = 0.28;
  mat.roughness = 0.10;
  mat.emissiveColor = new B.Color3(1, 1, 1);
  mat.emissiveTexture = emissiveTex;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 1.0;
  mat.clearCoat.roughness = 0.04;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Soft Volumetric Light Shaft Curtain Material (vertical alpha falloff, zero depthWrite, additive glow).
 */
export function createVolumetricShaftMaterial(scene, name, hexColor = '#FFE9B8', opacity = 0.16) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(`${name}_grad`, { width: 128, height: 256 }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 128, 256);

  // Horizontal Gaussian-like soft column + vertical fade from skylight down to floor
  const img = ctx.createImageData(128, 256);
  const c = B.Color3.FromHexString(hexColor);
  const cr = Math.round(c.r * 255);
  const cg = Math.round(c.g * 255);
  const cb = Math.round(c.b * 255);

  for (let y = 0; y < 256; y += 1) {
    const v = y / 255; // 0 = top skylight, 1 = floor
    const vFade = Math.sin(v * Math.PI) * (1 - v * 0.45);
    for (let x = 0; x < 128; x += 1) {
      const u = (x / 127) * 2 - 1;
      const hFade = Math.pow(Math.max(0, 1 - u * u), 2.2);
      const a = Math.min(255, Math.round(hFade * vFade * opacity * 255));
      const idx = (y * 128 + x) * 4;
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
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.alphaMode = B.Engine.ALPHA_ADD;
  mat.disableDepthWrite = true;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Create a crisp radial soft glow sprite texture for floating sanctuary dust motes.
 */
export function createSoftGlowParticleTexture(scene) {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture('aaa_mote_particle_tex', { width: 64, height: 64 }, scene, true);
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 250, 228, 1.0)');
  grad.addColorStop(0.35, 'rgba(247, 205, 96, 0.72)');
  grad.addColorStop(0.75, 'rgba(247, 195, 70, 0.16)');
  grad.addColorStop(1, 'rgba(247, 195, 70, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

/**
 * Configure Babylon AAA DefaultRenderingPipeline (ACES Filmic + Bloom + MSAA/FXAA + Sharpen + Subtle Grain).
 */
export function setupAAAPostProcessing(scene, camera) {
  const B = globalThis.BABYLON;
  const pipeline = new B.DefaultRenderingPipeline('sanctuary_aaa_pipeline', true, scene, [camera]);

  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  // Calibrated Sanctuary Bloom (illuminates platinum slit, passing orb, and pedestal rings cleanly)
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.56;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  // ACES Filmic Tone Mapping + Dramatic Sanctuary Contrast & Vignette
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.2;
  pipeline.imageProcessing.exposure = 1.12;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.65;
  pipeline.imageProcessing.vignetteStretch = 0.45;
  pipeline.imageProcessing.vignetteColor = new B.Color4(0.025, 0.02, 0.014, 0);

  // Subtle cinema sharpening & organic micro-grain
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.16;
  pipeline.sharpen.colorAmount = 1.0;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 4.2;
  pipeline.grain.animated = true;

  return pipeline;
}

// ---------------------------------------------------------------------------
// Zone A: Corridor Research Station (Levels 1–4) AAA Procedural PBR Suite
// Soft-Mist White #ECEEF2 + Light Steel Grey #9AA5B4 (04-visual-and-art-direction.md)
// ---------------------------------------------------------------------------

/**
 * High-contrast architectural aerospace laboratory 6-face IBL CubeTexture for Zone A.
 * Rich contrast between deep titanium bulkhead horizons, crisp overhead daylight skylight ribbons,
 * and subtle cyan/gold instrument reflections makes brushed steel, brass, and Liquid-Mercury gleam!
 */
export function createStationEnvironmentTexture(scene) {
  const B = globalThis.BABYLON;
  const size = 64;
  const faceDirs = [
    (u, v) => [1, -v, -u],
    (u, v) => [-1, -v, u],
    (u, v) => [u, 1, v],
    (u, v) => [u, -1, -v],
    (u, v) => [u, -v, 1],
    (u, v) => [-u, -v, -1],
  ];

  const faces = faceDirs.map((dirFn) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const [dx, dy, dz] = dirFn(u, v);
        const len = Math.hypot(dx, dy, dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        // Sculpted aerospace studio contrast (avoids flat grey reflections on liquid mercury!)
        let r = 68;
        let g = 78;
        let b = 94;

        if (ny > 0) {
          const up = Math.pow(ny, 1.35);
          r += up * 112;
          g += up * 118;
          b += up * 126;
          // Razor-sharp dual linear skylight lightboxes overhead
          const stripA = Math.exp(-Math.pow((Math.abs(nx) - 0.34) * 7.5, 2)) * Math.pow(ny, 1.4);
          const stripCenter = Math.exp(-Math.pow(nx * 5.2, 2)) * Math.pow(ny, 2.0);
          r += (stripA * 125 + stripCenter * 145);
          g += (stripA * 132 + stripCenter * 150);
          b += (stripA * 142 + stripCenter * 158);
        } else {
          // Deep brushed-titanium deck bounce underneath for strong chrome contrast
          const down = Math.pow(-ny, 1.15);
          r = r * (1 - down * 0.62) + 18 * down;
          g = g * (1 - down * 0.58) + 24 * down;
          b = b * (1 - down * 0.50) + 34 * down;
        }

        // Crisp cyan & warm-gold architectural rim ribbons at horizon (gives liquid mercury iridescent magic!)
        const horizonBand = Math.exp(-Math.pow(ny * 4.2, 2));
        const cyanRing = Math.pow(Math.max(0, nz), 3) * horizonBand;
        const backCyan = Math.pow(Math.max(0, -nz), 4) * horizonBand;
        const goldRim = Math.pow(Math.abs(nx), 4) * horizonBand;

        r += cyanRing * 32 + backCyan * 18 + goldRim * 92;
        g += cyanRing * 128 + backCyan * 68 + goldRim * 76;
        b += cyanRing * 132 + backCyan * 86 + goldRim * 36;

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, Math.max(0, Math.round(r)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        data[idx + 3] = 255;
      }
    }
    return data;
  });

  const cubeTex = new B.RawCubeTexture(
    scene,
    faces,
    size,
    B.Engine.TEXTUREFORMAT_RGBA,
    B.Engine.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    B.Texture.TRILINEAR_SAMPLINGMODE
  );
  cubeTex.name = 'zone_a_station_ibl_env';
  scene.environmentTexture = cubeTex;
  scene.environmentIntensity = 1.05;
  return cubeTex;
}

/**
 * Matte Soft-Mist White Aerospace Composite Wall Panel PBR (#ECEEF2 + #9AA5B4 seams).
 * Bloom-safe calibrated reflectance + precision recessed seams, rivets, & Sobel normal relief.
 */
export function createAviationPanelPBR(scene, name = 'zone_a_wall_pbr', uScale = 2, vScale = 2) {
  const B = globalThis.BABYLON;
  const size = 512;
  const albedoTex = new B.DynamicTexture(`${name}_albedo`, { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture(`${name}_orm`, { width: size, height: size }, scene, true);
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  // Calibrated soft-mist white matte composite (reads crisp white under ACES, never clips bloom!)
  const bg = aCtx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#E3E7EE');
  bg.addColorStop(0.5, '#DCE2EA');
  bg.addColorStop(1, '#CFD7E2');
  aCtx.fillStyle = bg;
  aCtx.fillRect(0, 0, size, size);

  // ORM: AO=244, Roughness=198 (~0.78 smooth satin-matte composite -> zero harsh white glare blocks!), Metallic=16
  oCtx.fillStyle = 'rgb(244, 198, 16)';
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(185, 185, 185)';
  hCtx.fillRect(0, 0, size, size);

  // Subtle architectural aerospace micro-grid & precision recessed modular seams
  const drawSeamRect = (x, y, w, h) => {
    aCtx.strokeStyle = '#AEB8C7';
    aCtx.lineWidth = 4;
    aCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    aCtx.strokeStyle = '#8895A8';
    aCtx.lineWidth = 1.6;
    aCtx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    oCtx.strokeStyle = 'rgb(175, 145, 76)';
    oCtx.lineWidth = 4;
    oCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    hCtx.strokeStyle = 'rgb(88, 88, 88)';
    hCtx.lineWidth = 4;
    hCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Subtle inset structural chamfer panel inside each modular bay
    aCtx.strokeStyle = 'rgba(148, 160, 178, 0.45)';
    aCtx.lineWidth = 1.5;
    aCtx.strokeRect(x + 18, y + 18, w - 36, h - 36);
    hCtx.strokeStyle = 'rgb(156, 156, 156)';
    hCtx.lineWidth = 2;
    hCtx.strokeRect(x + 18, y + 18, w - 36, h - 36);

    // Precision micro-fasteners at panel corners
    for (const [rx, ry] of [
      [x + 11, y + 11],
      [x + w - 11, y + 11],
      [x + 11, y + h - 11],
      [x + w - 11, y + h - 11],
    ]) {
      aCtx.fillStyle = '#96A3B5';
      aCtx.beginPath();
      aCtx.arc(rx, ry, 2.6, 0, Math.PI * 2);
      aCtx.fill();
      hCtx.fillStyle = 'rgb(110, 110, 110)';
      hCtx.beginPath();
      hCtx.arc(rx, ry, 2.6, 0, Math.PI * 2);
      hCtx.fill();
    }
  };

  drawSeamRect(0, 0, 256, 256);
  drawSeamRect(256, 0, 256, 256);
  drawSeamRect(0, 256, 256, 256);
  drawSeamRect(256, 256, 256, 256);

  // Brushed light-titanium structural datum channel across mid-wall
  aCtx.fillStyle = '#B8C2D0';
  aCtx.fillRect(0, 244, size, 24);
  aCtx.fillStyle = '#92A0B4';
  aCtx.fillRect(0, 244, size, 3);
  aCtx.fillRect(0, 265, size, 3);
  oCtx.fillStyle = 'rgb(232, 118, 138)';
  oCtx.fillRect(0, 244, size, 24);
  hCtx.fillStyle = 'rgb(218, 218, 218)';
  hCtx.fillRect(0, 244, size, 24);

  albedoTex.update();
  ormTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const bumpTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 2.1, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = bumpTex;
  mat.bumpTexture.level = 0.72;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Brushed Light Steel Aerospace Decking PBR (#9AA5B4 / #C5CDD8) for Zone A decks & bulkheads.
 */
export function createAerospaceDeckPBR(scene, name = 'zone_a_deck_pbr', uScale = 2, vScale = 2) {
  const B = globalThis.BABYLON;
  const size = 512;
  const albedoTex = new B.DynamicTexture(`${name}_albedo`, { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture(`${name}_orm`, { width: size, height: size }, scene, true);
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  aCtx.fillStyle = '#C2CBD6';
  aCtx.fillRect(0, 0, size, size);
  oCtx.fillStyle = 'rgb(240, 132, 82)';
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(180, 180, 180)';
  hCtx.fillRect(0, 0, size, size);

  const step = 128;
  for (let gx = 0; gx < size; gx += step) {
    for (let gy = 0; gy < size; gy += step) {
      aCtx.strokeStyle = '#8C98A9';
      aCtx.lineWidth = 3;
      aCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
      hCtx.strokeStyle = 'rgb(102, 102, 102)';
      hCtx.lineWidth = 3;
      hCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);

      aCtx.fillStyle = '#A3AEBD';
      aCtx.fillRect(gx + 10, gy + 10, 10, 10);
      aCtx.fillRect(gx + step - 20, gy + step - 20, 10, 10);
    }
  }

  // Central brushed titanium guide channel
  aCtx.fillStyle = '#D0D8E2';
  aCtx.fillRect(size * 0.44, 0, size * 0.12, size);
  oCtx.fillStyle = 'rgb(248, 96, 132)';
  oCtx.fillRect(size * 0.44, 0, size * 0.12, size);

  albedoTex.update();
  ormTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const bumpTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 1.7, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = bumpTex;
  mat.bumpTexture.level = 0.6;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.28;
  mat.clearCoat.roughness = 0.24;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Polished Zone A Clean-Room Reflective Laboratory Floor PBR with Real-Time MirrorTexture!
 * Matches Level 14's mirror-floor craft adapted to Zone A soft-mist aerospace steel palette.
 */
export function createStationMirrorFloorPBR(scene, mirrorRenderList, uScale = 2, vScale = 2) {
  const B = globalThis.BABYLON;
  const mat = createAerospaceDeckPBR(scene, 'zone_a_mirror_deck_pbr', uScale, vScale);

  const mirrorTex = new B.MirrorTexture('zone_a_floor_mirror', 512, scene, true);
  mirrorTex.mirrorPlane = new B.Plane(0, -1, 0, 0);
  mirrorTex.level = 0.34;
  mirrorTex.adaptiveBlurKernel = 16;
  mirrorTex.renderList = mirrorRenderList;

  mat.reflectionTexture = mirrorTex;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.52;
  mat.clearCoat.roughness = 0.14;
  return { mat, mirrorTex };
}

/**
 * High-Contrast Liquid-Mercury 4D Rift Mirror Sphere PBR (Level 4 centerpiece).
 * Features micro-ripple normal texture + chrome clearcoat so it gleams like true liquid silver!
 */
export function createMercuryRiftPBR(scene, name = 'zone_a_mercury_pbr') {
  const B = globalThis.BABYLON;
  const size = 256;
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d');
  const img = hCtx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      // Subtle periodic standing-wave mercury surface micro-ripples
      const wave =
        Math.sin(u * 4 + Math.cos(v * 3)) * 0.45 +
        Math.cos(v * 5 - Math.sin(u * 2)) * 0.35 +
        Math.sin((u + v) * 6) * 0.2;
      const val = Math.round(128 + wave * 34);
      const idx = (y * size + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  hCtx.putImageData(img, 0, 0);
  const rippleNormal = buildNormalTextureFromHeightCanvas(scene, `${name}_ripple_n`, heightCanvas, 1.4, 2, 2);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = new B.Color3(0.76, 0.85, 0.96);
  mat.metallic = 1.0;
  mat.roughness = 0.05;
  mat.bumpTexture = rippleNormal;
  mat.bumpTexture.level = 0.28;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 1.0;
  mat.clearCoat.roughness = 0.03;
  mat.clearCoat.isTintEnabled = true;
  mat.clearCoat.tintColor = B.Color3.FromHexString('#B8F6EE');
  mat.emissiveColor = new B.Color3(0.05, 0.14, 0.20);
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Precision engraved scientific 360° degree-tick compass faceplate texture for Level 3 Gyroscope!
 */
export function createGyroDialTexture(scene, name = 'l3_gyro_dial_tex') {
  const B = globalThis.BABYLON;
  const size = 512;
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Deep sapphire-obsidian instrument glass backing
  const bg = ctx.createRadialGradient(cx, cy, 24, cx, cy, 246);
  bg.addColorStop(0, 'rgba(18, 30, 46, 0.88)');
  bg.addColorStop(0.82, 'rgba(11, 20, 32, 0.94)');
  bg.addColorStop(1, 'rgba(77, 230, 211, 0.35)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, 246, 0, Math.PI * 2);
  ctx.fill();

  // Concentric precision reticle rings
  ctx.strokeStyle = 'rgba(216, 174, 86, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 212, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(77, 230, 211, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 146, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle crosshairs
  ctx.strokeStyle = 'rgba(246, 244, 238, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 210, cy);
  ctx.lineTo(cx + 210, cy);
  ctx.moveTo(cx, cy - 210);
  ctx.lineTo(cx, cy + 210);
  ctx.stroke();

  // 24 precision degree ticks (every 15°)
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 90 === 0;
    const r0 = isMajor ? 182 : 196;
    const r1 = 216;
    ctx.strokeStyle = deg === 270 ? '#69F0AE' : isMajor ? '#F7C346' : 'rgba(232, 240, 250, 0.55)';
    ctx.lineWidth = isMajor ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
    ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.stroke();
  }

  // Luminous "+90° ▲" top calibration arc & label
  ctx.strokeStyle = '#69F0AE';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, 228, -Math.PI * 0.5 - 0.22, -Math.PI * 0.5 + 0.22);
  ctx.stroke();

  ctx.font = '700 32px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#69F0AE';
  ctx.fillText('+90°', cx, cy - 154);

  ctx.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(247, 195, 70, 0.85)';
  ctx.fillText('0°', cx + 166, cy + 2);
  ctx.fillStyle = 'rgba(255, 107, 107, 0.72)';
  ctx.fillText('−90°', cx, cy + 162);

  tex.hasAlpha = true;
  tex.update(false);
  return tex;
}

/**
 * Crisp backlit bulkhead doorway plaque texture (frosted sapphire-obsidian glass aerospace readout).
 */
export function createCellPlaqueTexture(scene, name, title, subtitle = '', accentHex = '#4DE6D3') {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(name, { width: 512, height: 192 }, scene, true);
  const ctx = tex.getContext();

  const grad = ctx.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, '#162130');
  grad.addColorStop(1, '#0F1722');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 192);

  // Subtle corner technical brackets + accent header line
  ctx.strokeStyle = 'rgba(180, 198, 220, 0.26)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 176);

  ctx.fillStyle = accentHex;
  ctx.fillRect(10, 10, 492, 10);

  // Crisp glowing corner chevrons
  ctx.fillStyle = accentHex;
  ctx.fillRect(10, 170, 38, 8);
  ctx.fillRect(464, 170, 38, 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 78px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillStyle = '#F6F9FC';
  ctx.fillText(title, 256, subtitle ? 84 : 102);

  if (subtitle) {
    ctx.font = '600 30px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = accentHex;
    ctx.fillText(subtitle, 256, 148);
  }
  tex.update();
  return tex;
}

/**
 * Lin Xia's glowing hand-painted fluorescent "↑ 上" wall stencil texture for Level 3.
 */
export function createFluorescentArrowTexture(scene, name, label = '↑ 上', hexColor = '#4DE6D3') {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(name, { width: 512, height: 512 }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 512, 512);

  ctx.strokeStyle = hexColor;
  ctx.fillStyle = hexColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = hexColor;
  ctx.shadowBlur = 18;

  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(256, 396);
  ctx.lineTo(256, 112);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(156, 206);
  ctx.lineTo(256, 98);
  ctx.lineTo(356, 206);
  ctx.stroke();

  ctx.font = '700 66px "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 456);

  tex.hasAlpha = true;
  tex.update();
  return tex;
}

/**
 * Zone A Post-Processing Pipeline: clean crisp research station daylight exposure,
 * bloom threshold calibrated at 1.12 so matte white walls NEVER glow while cyan/gold beacons gleam!
 */
export function setupZoneAPostProcessing(scene, camera) {
  const B = globalThis.BABYLON;
  const pipeline = new B.DefaultRenderingPipeline('zone_a_station_pipeline', true, scene, [camera]);

  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 1.12;
  pipeline.bloomWeight = 0.36;
  pipeline.bloomKernel = 52;
  pipeline.bloomScale = 0.5;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.16;
  pipeline.imageProcessing.exposure = 1.0;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.15;
  pipeline.imageProcessing.vignetteStretch = 0.25;
  pipeline.imageProcessing.vignetteColor = new B.Color4(0.06, 0.09, 0.14, 0);

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.16;
  pipeline.sharpen.colorAmount = 1.0;

  return pipeline;
}

// ---------------------------------------------------------------------------
// Prologue Cinematic Deep-Space Cockpit AAA PBR + IBL + Post-Processing Suite
// ---------------------------------------------------------------------------

/**
 * Deep-space Voyager cockpit 6-face procedural IBL CubeTexture (nebula cyan-indigo + red alert bounce).
 */
export function createPrologueEnvironmentTexture(scene) {
  const B = globalThis.BABYLON;
  const size = 64;
  const faceDirs = [
    (u, v) => [1, -v, -u],
    (u, v) => [-1, -v, u],
    (u, v) => [u, 1, v],
    (u, v) => [u, -1, -v],
    (u, v) => [u, -v, 1],
    (u, v) => [-u, -v, -1],
  ];

  const faces = faceDirs.map((dirFn) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const [dx, dy, dz] = dirFn(u, v);
        const len = Math.hypot(dx, dy, dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        let r = 10;
        let g = 16;
        let b = 28;

        // Forward cosmic cyan-white warp core glow
        const fwd = Math.pow(Math.max(0, nz), 3.0);
        r += fwd * 120;
        g += fwd * 185;
        b += fwd * 225;

        // Overhead warm-crimson cockpit emergency beacon bounce
        const overhead = Math.pow(Math.max(0, ny), 2.5);
        r += overhead * 92;
        g += overhead * 30;
        b += overhead * 34;

        // Flanking cyan dashboard reflection
        const side = Math.pow(Math.abs(nx), 3) * (1 - Math.abs(ny) * 0.5);
        r += side * 14;
        g += side * 52;
        b += side * 66;

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, Math.round(r));
        data[idx + 1] = Math.min(255, Math.round(g));
        data[idx + 2] = Math.min(255, Math.round(b));
        data[idx + 3] = 255;
      }
    }
    return data;
  });

  const cubeTex = new B.RawCubeTexture(
    scene,
    faces,
    size,
    B.Engine.TEXTUREFORMAT_RGBA,
    B.Engine.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    B.Texture.TRILINEAR_SAMPLINGMODE
  );
  cubeTex.name = 'prologue_voyager_ibl';
  scene.environmentTexture = cubeTex;
  scene.environmentIntensity = 1.25;
  return cubeTex;
}

/**
 * Brushed Dark-Titanium Spacecraft Cockpit Hull PBR with Sobel panel relief.
 */
export function createCockpitTitaniumPBR(scene, name = 'pro_titanium_pbr') {
  const B = globalThis.BABYLON;
  const size = 256;
  const albedoTex = new B.DynamicTexture(`${name}_albedo`, { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture(`${name}_orm`, { width: size, height: size }, scene, true);
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  aCtx.fillStyle = '#1B2330';
  aCtx.fillRect(0, 0, size, size);
  oCtx.fillStyle = 'rgb(236, 98, 208)'; // Metallic ~0.82, Roughness ~0.38 brushed gunmetal titanium
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(165, 165, 165)';
  hCtx.fillRect(0, 0, size, size);

  // Machined cockpit rib seams & subtle brushed grain
  for (let y = 0; y < size; y += 4) {
    aCtx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.035)';
    aCtx.fillRect(0, y, size, 2);
  }
  aCtx.strokeStyle = '#0D131B';
  aCtx.lineWidth = 3;
  aCtx.strokeRect(4, 4, size - 8, size - 8);
  hCtx.strokeStyle = 'rgb(75, 75, 75)';
  hCtx.lineWidth = 4;
  hCtx.strokeRect(4, 4, size - 8, size - 8);

  albedoTex.update();
  ormTex.update();
  const normalTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 2.2, 2, 2);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = 0.7;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.25;
  mat.clearCoat.roughness = 0.22;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Prologue Cinematic Post-Processing Pipeline (ACES Filmic + lush warp Bloom + subtle film grain).
 */
export function setupProloguePostProcessing(scene, camera) {
  const B = globalThis.BABYLON;
  const pipeline = new B.DefaultRenderingPipeline('prologue_cinema_pipeline', true, scene, [camera]);

  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.56;
  pipeline.bloomKernel = 68;
  pipeline.bloomScale = 0.5;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.2;
  pipeline.imageProcessing.exposure = 1.08;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 2.0;
  pipeline.imageProcessing.vignetteStretch = 0.35;
  pipeline.imageProcessing.vignetteColor = new B.Color4(0.01, 0.02, 0.05, 0);

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.16;
  pipeline.sharpen.colorAmount = 1.0;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 3.8;
  pipeline.grain.animated = true;

  return pipeline;
}

