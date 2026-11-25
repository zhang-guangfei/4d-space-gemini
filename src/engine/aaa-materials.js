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
  const size = 512;
  const tex = new B.DynamicTexture('aaa_orb_energy_tex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext();

  // Deep luminous translucent-feel crystal core base
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#D8FFF9');
  grad.addColorStop(0.5, '#58E8D8');
  grad.addColorStop(1, '#D8FFF9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Precision sacred astronomical latitude/longitude engraving lines
  ctx.strokeStyle = 'rgba(255, 250, 232, 0.42)';
  ctx.lineWidth = 1.6;
  for (let y = 32; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 32; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Equator double calibration band
  ctx.strokeStyle = 'rgba(255, 246, 214, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5 - 6);
  ctx.lineTo(size, size * 0.5 - 6);
  ctx.moveTo(0, size * 0.5 + 6);
  ctx.lineTo(size, size * 0.5 + 6);
  ctx.stroke();

  tex.update();

  const mat = new B.PBRMaterial('aaa_orb_crystal_pbr', scene);
  mat.albedoColor = B.Color3.FromHexString(PALETTE.accent.cyanW0);
  mat.albedoTexture = tex;
  mat.metallic = 0.22;
  mat.roughness = 0.08;
  mat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(0.52);
  mat.emissiveTexture = tex;
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
 * Clean diffused aerospace laboratory 6-face IBL CubeTexture for Zone A.
 * Crisp white zenith skylight strips, soft-mist composite walls, cool steel floor bounce.
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

        // Clean soft-mist aerospace diffuse bounce
        let r = 162;
        let g = 170;
        let b = 180;

        if (ny > 0) {
          const up = Math.pow(ny, 1.3);
          r += up * 82;
          g += up * 84;
          b += up * 86;
          // Diffused laboratory skylight panel strip overhead
          const panel = Math.exp(-Math.pow(nx * 2.8, 2)) * Math.pow(ny, 1.8);
          r += panel * 45;
          g += panel * 48;
          b += panel * 52;
        } else {
          // Cool steel deck reflection below
          const down = Math.pow(-ny, 1.2);
          r -= down * 48;
          g -= down * 42;
          b -= down * 34;
        }

        // Subtle crisp cyan instrument bounce along axial corridors
        const corridorCyan = Math.pow(Math.abs(nz), 5) * (1 - Math.abs(ny) * 0.6);
        r += corridorCyan * 12;
        g += corridorCyan * 34;
        b += corridorCyan * 36;

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
  scene.environmentIntensity = 0.92;
  return cubeTex;
}

/**
 * Matte Soft-Mist White Aerospace Composite Wall Panel PBR (#ECEEF2 + #9AA5B4 seams).
 * Crisp machined panel joints, subtle beveled rivets & Sobel normal map, zero grime.
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

  // Soft-mist white matte composite base (#ECEEF2)
  const bg = aCtx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#F2F4F7');
  bg.addColorStop(0.5, '#ECEEF2');
  bg.addColorStop(1, '#E2E6EC');
  aCtx.fillStyle = bg;
  aCtx.fillRect(0, 0, size, size);

  // ORM: AO=246, Roughness=155 (~0.61 clean matte composite), Metallic=14
  oCtx.fillStyle = 'rgb(246, 155, 14)';
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(185, 185, 185)';
  hCtx.fillRect(0, 0, size, size);

  // Precision machined modular wall panel seams (2x2 aerospace grid)
  const drawSeamRect = (x, y, w, h) => {
    aCtx.strokeStyle = '#BAC3D0';
    aCtx.lineWidth = 4;
    aCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    aCtx.strokeStyle = '#9AA5B4';
    aCtx.lineWidth = 1.5;
    aCtx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    oCtx.strokeStyle = 'rgb(195, 120, 70)';
    oCtx.lineWidth = 4;
    oCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    hCtx.strokeStyle = 'rgb(95, 95, 95)';
    hCtx.lineWidth = 4;
    hCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Subtle inset aerospace alignment bar
    aCtx.fillStyle = '#DFE4EC';
    aCtx.fillRect(x + 24, y + h - 24, w - 48, 8);
    hCtx.fillStyle = 'rgb(150, 150, 150)';
    hCtx.fillRect(x + 24, y + h - 24, w - 48, 8);
  };

  drawSeamRect(0, 0, 256, 256);
  drawSeamRect(256, 0, 256, 256);
  drawSeamRect(0, 256, 256, 256);
  drawSeamRect(256, 256, 256, 256);

  // Clean light-steel structural waist rail
  aCtx.fillStyle = '#CBD2DC';
  aCtx.fillRect(0, 246, size, 20);
  oCtx.fillStyle = 'rgb(235, 110, 115)';
  oCtx.fillRect(0, 246, size, 20);
  hCtx.fillStyle = 'rgb(212, 212, 212)';
  hCtx.fillRect(0, 246, size, 20);

  albedoTex.update();
  ormTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const bumpTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 1.8, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = bumpTex;
  mat.bumpTexture.level = 0.65;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Brushed Light Steel Aerospace Decking PBR (#9AA5B4 / #C5CDD8) for Zone A floors & bulkheads.
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

  aCtx.fillStyle = '#CFD6DF';
  aCtx.fillRect(0, 0, size, size);
  oCtx.fillStyle = 'rgb(242, 115, 76)';
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(180, 180, 180)';
  hCtx.fillRect(0, 0, size, size);

  // Subtle geometric deck tiles & precision traction ribs
  const step = 128;
  for (let gx = 0; gx < size; gx += step) {
    for (let gy = 0; gy < size; gy += step) {
      aCtx.strokeStyle = '#9AA5B4';
      aCtx.lineWidth = 3;
      aCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
      hCtx.strokeStyle = 'rgb(110, 110, 110)';
      hCtx.lineWidth = 3;
      hCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);

      // Clean micro-recessed corner tabs
      aCtx.fillStyle = '#AEB8C5';
      aCtx.fillRect(gx + 10, gy + 10, 10, 10);
      aCtx.fillRect(gx + step - 20, gy + step - 20, 10, 10);
    }
  }

  // Central brushed guide stripe
  aCtx.fillStyle = '#DCE2EA';
  aCtx.fillRect(size * 0.44, 0, size * 0.12, size);
  oCtx.fillStyle = 'rgb(248, 86, 128)';
  oCtx.fillRect(size * 0.44, 0, size * 0.12, size);

  albedoTex.update();
  ormTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const bumpTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 1.5, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = bumpTex;
  mat.bumpTexture.level = 0.55;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.25;
  mat.clearCoat.roughness = 0.26;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Liquid-Mercury 4D Rift Mirror Sphere PBR (Level 4 centerpiece, 2.2m diameter).
 */
export function createMercuryRiftPBR(scene, name = 'zone_a_mercury_pbr') {
  const B = globalThis.BABYLON;
  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = new B.Color3(0.56, 0.66, 0.78);
  mat.metallic = 1.0;
  mat.roughness = 0.04;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 1.0;
  mat.clearCoat.roughness = 0.02;
  mat.emissiveColor = new B.Color3(0.03, 0.08, 0.12);
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;
  return mat;
}

/**
 * Crisp backlit bulkhead doorway plaque texture (e.g. "X+", "W− · 目标", "★ Y+").
 */
export function createCellPlaqueTexture(scene, name, title, subtitle = '', accentHex = '#4DE6D3') {
  const B = globalThis.BABYLON;
  const tex = new B.DynamicTexture(name, { width: 512, height: 192 }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = '#18202B';
  ctx.fillRect(0, 0, 512, 192);

  // Subtle brushed steel frame & accent top bar
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 176);

  ctx.fillStyle = accentHex;
  ctx.fillRect(14, 14, 484, 10);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 76px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillStyle = '#F6F8FA';
  ctx.fillText(title, 256, subtitle ? 86 : 102);

  if (subtitle) {
    ctx.font = '600 28px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif';
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

  // Hand-painted glowing arrow shaft & chevron
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

  // Hand-stenciled Chinese label underneath
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
 * restrained bloom so soft-mist white walls never clip while cyan/gold beacons gleam.
 */
export function setupZoneAPostProcessing(scene, camera) {
  const B = globalThis.BABYLON;
  const pipeline = new B.DefaultRenderingPipeline('zone_a_station_pipeline', true, scene, [camera]);

  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.82;
  pipeline.bloomWeight = 0.34;
  pipeline.bloomKernel = 48;
  pipeline.bloomScale = 0.5;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.12;
  pipeline.imageProcessing.exposure = 1.04;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 0.95;
  pipeline.imageProcessing.vignetteStretch = 0.3;
  pipeline.imageProcessing.vignetteColor = new B.Color4(0.08, 0.11, 0.15, 0);

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.14;
  pipeline.sharpen.colorAmount = 1.0;

  return pipeline;
}

