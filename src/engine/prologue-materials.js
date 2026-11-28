/**
 * Beyond 3D — Prologue AAA Procedural PBR, 3-Mood IBL, Custom GLSL Shaders & Cinema Pipeline
 *
 * Implements Contract B of PROJECT.md & Quality Spec v1.0:
 * - 3 high-contrast 6-face procedural RawCubeTexture IBL environments (zero crimson tint):
 *     IBL_DEEP_SPACE, IBL_CRYO_CABIN, IBL_POLAR_DAY
 * - 20+ Sobel-normal / ORM / Clearcoat PBR & custom GLSL Shader materials
 * - Strict Ghost-safe translucency invariants (disableDepthWrite = true, needDepthPrePass = false)
 * - Per-shot graded DefaultRenderingPipeline (ACES Filmic, Bloom, FXAA, Sharpen, Vignette, Grain)
 */

import { buildNormalTextureFromHeightCanvas } from './aaa-materials.js';
import { PALETTE } from './phase-materials.js';

const CUBE_FACE_DIRS = [
  (u, v) => [1, -v, -u], // +X
  (u, v) => [-1, -v, u], // -X
  (u, v) => [u, 1, v], // +Y
  (u, v) => [u, -1, -v], // -Y
  (u, v) => [u, -v, 1], // +Z
  (u, v) => [-u, -v, -1], // -Z
];

function buildProceduralCubeTexture(scene, name, size, sampleRgbFn) {
  const B = globalThis.BABYLON;
  const faces = CUBE_FACE_DIRS.map((dirFn) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const [dx, dy, dz] = dirFn(u, v);
        const len = Math.hypot(dx, dy, dz) || 1;
        const [r, g, b] = sampleRgbFn(dx / len, dy / len, dz / len);
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
  cubeTex.name = name;
  return cubeTex;
}

/**
 * Create the 3 Prologue 6-face procedural IBL CubeTextures (zero crimson emergency wash).
 */
export function createPrologueIBLSet(scene) {
  const size = 64;

  // 1. IBL_DEEP_SPACE: obsidian-sapphire cosmic void + bright platinum-cyan horizon + starlight gold rim
  const IBL_DEEP_SPACE = buildProceduralCubeTexture(scene, 'prologue_ibl_deep_space', size, (nx, ny, nz) => {
    let r = 8;
    let g = 14;
    let b = 26;

    // Crisp galactic cyan-white ribbon across horizon for gleaming metallic flagship silhouettes
    const horizon = Math.exp(-Math.pow(ny * 3.8, 2));
    const fwdStarGlow = Math.pow(Math.max(0, nz), 2.4);
    const backRim = Math.pow(Math.max(0, -nz), 3.0);
    r += horizon * 44 + fwdStarGlow * 128 + backRim * 26;
    g += horizon * 76 + fwdStarGlow * 188 + backRim * 64;
    b += horizon * 108 + fwdStarGlow * 224 + backRim * 98;

    // Crisp zenith cold key strip so dorsal titanium plates catch razor specular highlights
    if (ny > 0) {
      const topStrip = Math.exp(-Math.pow(nx * 4.5, 2)) * Math.pow(ny, 2.0);
      r += topStrip * 140;
      g += topStrip * 168;
      b += topStrip * 198;
    }

    // Starboard warm astral-gold rim (+X) & port cerulean nebula fill (-X)
    const eastGold = Math.pow(Math.max(0, nx), 3.5) * (1 - Math.abs(ny) * 0.4);
    r += eastGold * 135;
    g += eastGold * 105;
    b += eastGold * 42;

    const westCyan = Math.pow(Math.max(0, -nx), 3.2) * (1 - Math.abs(ny) * 0.4);
    r += westCyan * 22;
    g += westCyan * 96;
    b += westCyan * 145;

    return [r, g, b];
  });

  // 2. IBL_CRYO_CABIN: rich warmer-balanced studio luminance with warm amber lab (+X/+Z) vs cool sapphire cryo (-X/-Z)
  const IBL_CRYO_CABIN = buildProceduralCubeTexture(scene, 'prologue_ibl_cryo_cabin', size, (nx, ny, nz) => {
    let r = 40;
    let g = 48;
    let b = 64;

    if (ny > 0) {
      // Broad, crisp overhead architectural lightboxes + warm-ivory zenith skylight for titanium rib reflections
      const stripA = Math.exp(-Math.pow((Math.abs(nx) - 0.34) * 4.4, 2)) * Math.pow(ny, 1.35);
      const centerStrip = Math.exp(-Math.pow(nx * 5.2, 2)) * Math.pow(ny, 1.5);
      const skylight = Math.pow(ny, 1.25);
      r += skylight * 102 + stripA * 168 + centerStrip * 124;
      g += skylight * 112 + stripA * 172 + centerStrip * 128;
      b += skylight * 124 + stripA * 182 + centerStrip * 134;
    } else {
      // Warm-balanced slate deck bounce underneath so lower pod bevels & rib chamfers retain sculptural definition
      const down = Math.pow(-ny, 1.15);
      r = r * (1 - down * 0.42) + 28 * down;
      g = g * (1 - down * 0.38) + 34 * down;
      b = b * (1 - down * 0.32) + 46 * down;
    }

    // Crisp horizontal architectural side-wall light panels so vertical brushed-titanium ribs gleam cleanly
    const sideBand = Math.exp(-Math.pow((ny - 0.08) * 3.0, 2));
    const sidePanels =
      (Math.exp(-Math.pow((Math.abs(nz) - 0.48) * 4.5, 2)) * 0.75 +
        Math.exp(-Math.pow(nz * 5.5, 2)) * 0.55) *
      sideBand;
    r += sidePanels * 96;
    g += sidePanels * 104;
    b += sidePanels * 118;

    // Starboard / bow warm amber-ivory architect-lamp studio bounce (+X, +Z)
    const warmDir = Math.max(0, nx * 0.74 + nz * 0.67);
    const warmPool = Math.pow(warmDir, 2.2) * (1 - Math.abs(ny) * 0.3);
    r += warmPool * 212;
    g += warmPool * 154;
    b += warmPool * 78;

    // Port / aft cool sapphire-silver cryogenic bay bounce (-X, -Z)
    const coolDir = Math.max(0, -nx * 0.76 - nz * 0.42);
    const coolPool = Math.pow(coolDir, 2.1) * (1 - Math.abs(ny) * 0.3);
    r += coolPool * 62;
    g += coolPool * 146;
    b += coolPool * 212;

    // Panoramic bow starlight cyan-ivory fill strip (+Z)
    const bowGlow = Math.pow(Math.max(0, nz), 3.2) * Math.exp(-Math.pow(ny * 2.6, 2));
    r += bowGlow * 102;
    g += bowGlow * 164;
    b += bowGlow * 204;

    return [r, g, b];
  });

  // 3. IBL_POLAR_DAY: radiant high-key Scandinavian polar-day white with delicate cyan-gold caustics
  const IBL_POLAR_DAY = buildProceduralCubeTexture(scene, 'prologue_ibl_polar_day', size, (nx, ny, nz) => {
    let r = 186;
    let g = 198;
    let b = 212;

    if (ny > 0) {
      const up = Math.pow(ny, 0.9);
      r += up * 68;
      g += up * 56;
      b += up * 42;
    } else {
      const down = Math.pow(-ny, 1.1);
      r -= down * 38;
      g -= down * 30;
      b -= down * 18;
    }

    const horizon = Math.exp(-Math.pow(ny * 3.5, 2));
    const cyanCaustic = Math.pow(Math.max(0, nz), 2.0) * horizon;
    const goldCaustic = Math.pow(Math.abs(nx), 2.5) * horizon;
    r += cyanCaustic * 28 + goldCaustic * 48;
    g += cyanCaustic * 52 + goldCaustic * 40;
    b += cyanCaustic * 58 + goldCaustic * 18;

    return [r, g, b];
  });

  const presets = { IBL_DEEP_SPACE, IBL_CRYO_CABIN, IBL_POLAR_DAY };
  let activePresetName = 'IBL_DEEP_SPACE';
  scene.environmentTexture = IBL_DEEP_SPACE;
  scene.environmentIntensity = 1.0;

  return {
    IBL_DEEP_SPACE,
    IBL_CRYO_CABIN,
    IBL_POLAR_DAY,
    applyPreset(presetName, intensity = 1.1) {
      const tex = presets[presetName] || IBL_DEEP_SPACE;
      if (activePresetName !== presetName || scene.environmentTexture !== tex) {
        activePresetName = presetName in presets ? presetName : 'IBL_DEEP_SPACE';
        scene.environmentTexture = tex;
      }
      scene.environmentIntensity = intensity;
    },
    dispose() {
      IBL_DEEP_SPACE.dispose();
      IBL_CRYO_CABIN.dispose();
      IBL_POLAR_DAY.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Custom GLSL Shader Registration (WebGL 1/2 & SwiftShader-Safe)
// ---------------------------------------------------------------------------

function registerPrologueShaders() {
  const B = globalThis.BABYLON;
  const store = B.Effect.ShadersStore;

  // 1. Liquid-Mercury 4D Spatial Veil Shader (S2) — High-contrast dark-indigo / chrome-silver / cyan standing waves
  if (!store.prologueMercuryVeilVertexShader) {
    store.prologueMercuryVeilVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      uniform float uTime;
      uniform vec3 uRippleCenter;
      uniform float uRippleRadius;
      uniform float uRippleIntensity;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying float vWave;

      void main(void) {
        vec4 wp = world * vec4(position, 1.0);
        float dist = length(wp.xy - uRippleCenter.xy);
        float ring = exp(-pow((dist - uRippleRadius) * 0.85, 2.0)) * uRippleIntensity;
        float ripple = sin(dist * 3.6 - uTime * 5.0) * ring * 0.24;
        float standing = sin(wp.x * 0.34 + uTime * 0.85) * cos(wp.y * 0.29 - uTime * 0.68) * 0.14;
        float crossWave = sin((wp.x * 0.58 - wp.y * 0.52) + uTime * 1.1) * 0.07;
        vec3 displaced = position + normal * (ripple + standing + crossWave);
        vec4 worldPos = world * vec4(displaced, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vUv = uv;
        vWave = ripple + standing + crossWave;
        gl_Position = worldViewProjection * vec4(displaced, 1.0);
      }
    `;

    store.prologueMercuryVeilFragmentShader = `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform float uTime;
      uniform vec3 uRippleCenter;
      uniform float uRippleRadius;
      uniform float uRippleIntensity;
      uniform float uOpacity;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying float vWave;

      void main(void) {
        vec2 centered = (vUv - 0.5) * 2.0;
        float radial = length(centered);
        float edgeMask = 1.0 - smoothstep(0.58, 0.99, radial);
        if (edgeMask <= 0.002) discard;

        vec2 delta = vWorldPos.xy - uRippleCenter.xy;
        float dHull = length(delta);
        vec2 radDir = delta / max(0.001, dHull);

        // Multi-frequency liquid-mercury standing waves + crisp concentric radial ripple normal slope
        float radialPhase = dHull * 4.4 - uTime * 5.2;
        float rippleEnv = exp(-dHull * 0.085) * clamp(uRippleIntensity, 0.0, 1.25);
        float standA = sin(vWorldPos.x * 0.62 + uTime * 0.95) * cos(vWorldPos.y * 0.54 - uTime * 0.72);
        float standB = sin((vWorldPos.x * 1.08 - vWorldPos.y * 0.94) + uTime * 1.35 + vWave * 5.0);
        float standC = cos((vWorldPos.x * 0.45 + vWorldPos.y * 1.18) - uTime * 1.12);
        float standingField = standA * 0.50 + standB * 0.34 + standC * 0.16;

        vec3 n = normalize(vWorldNormal + vec3(
          radDir.x * cos(radialPhase) * rippleEnv * 0.44 + cos(vWorldPos.x * 0.78 + uTime * 1.15) * 0.24 + standB * 0.12,
          radDir.y * cos(radialPhase) * rippleEnv * 0.44 + sin(vWorldPos.y * 0.72 - uTime * 0.95) * 0.24 - standC * 0.12,
          0.0
        ));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float ndotv = abs(dot(n, viewDir));
        float fresnel = pow(1.0 - ndotv, 2.35);

        // Crisp liquid-mercury chrome specular bands from perturbed normal reflections
        vec3 refl = reflect(-viewDir, n);
        float chromeBand = smoothstep(-0.32, 0.78, sin(refl.y * 5.4 + refl.x * 3.2 + standingField * 2.2 + uTime * 0.55));
        float specCrestA = pow(max(0.0, dot(n, normalize(viewDir + vec3(-0.38, 0.52, 0.76)))), 18.0);
        float specCrestB = pow(max(0.0, dot(n, normalize(viewDir + vec3(0.46, -0.34, 0.78)))), 14.0);

        // Razor-sharp concentric Fresnel ripple ridges separated by deep dark-indigo troughs (zero flat white disc!)
        float rInt = clamp(uRippleIntensity, 0.0, 1.15);
        float ringPrimary = exp(-pow((dHull - uRippleRadius) * 2.15, 2.0));
        float ringSecondary = exp(-pow((dHull - max(0.45, uRippleRadius - 1.85)) * 2.45, 2.0)) * 0.72;
        float ringTertiary = exp(-pow((dHull - max(0.25, uRippleRadius - 3.55)) * 2.7, 2.0)) * 0.48;
        float rippleComb = pow(max(0.0, sin(radialPhase)), 5.0) * exp(-abs(dHull - uRippleRadius) * 0.24) * 0.52;
        float ridgeFresnel = (0.55 + 0.45 * fresnel);
        float impactRidges = (ringPrimary * 0.76 + ringSecondary * 0.56 + ringTertiary * 0.42 + rippleComb) * rInt * ridgeFresnel;

        // Subtle dark-cyan 4D interference lattice lines
        float gridLine = pow(max(abs(sin(vWorldPos.x * 0.95 + standA * 0.25)), abs(sin(vWorldPos.y * 0.95 - standB * 0.22))), 22.0) * 0.24;

        // High-contrast metallic liquid-mercury palette: deep indigo troughs -> steel -> chrome silver -> cyan refract
        vec3 deepIndigo = vec3(0.04, 0.08, 0.20);
        vec3 indigoSteel = vec3(0.14, 0.29, 0.48);
        vec3 chromeSilver = vec3(0.76, 0.86, 0.94);
        vec3 cyanRefract = vec3(0.16, 0.80, 0.84);
        vec3 ridgePlatinum = vec3(0.86, 0.94, 0.99);

        float waveCrest = smoothstep(-0.45, 0.72, standingField);
        vec3 col = mix(deepIndigo, indigoSteel, waveCrest * 0.85);
        col = mix(col, chromeSilver, chromeBand * (0.42 + 0.36 * fresnel));
        col = mix(col, cyanRefract, clamp(fresnel * 0.52 + specCrestB * 0.45 + gridLine * 0.7, 0.0, 0.72));

        // Controlled chrome specular glints & crisp concentric Fresnel ripple crests (~55% lower additive hotspot)
        col += chromeSilver * (specCrestA * 0.44 + fresnel * 0.26);
        col += cyanRefract * (specCrestB * 0.34 + gridLine * 0.38);
        col = mix(col, ridgePlatinum, clamp(impactRidges * 0.72, 0.0, 0.82));
        col += ridgePlatinum * impactRidges * 0.32;
        col = min(col, vec3(1.16, 1.24, 1.32));

        float alpha = clamp((0.26 + fresnel * 0.34 + chromeBand * 0.12 + impactRidges * 0.46 + gridLine * 0.22) * edgeMask * uOpacity, 0.0, 0.86);
        gl_FragColor = vec4(col, alpha);
      }
    `;
  }

  // 2. Cyan-Gold 4D Origami Hinge Glow Shader (S5)
  if (!store.prologueOrigamiHingeVertexShader) {
    store.prologueOrigamiHingeVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.prologueOrigamiHingeFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main(void) {
        float core = exp(-pow((vUv.y - 0.5) * 4.4, 2.0));
        float pulse = 0.65 + 0.35 * sin(vUv.x * 16.0 - uTime * 4.8);
        float endFade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
        vec3 cyan = vec3(0.30, 0.92, 0.86);
        vec3 gold = vec3(0.99, 0.82, 0.38);
        vec3 platinum = vec3(1.0, 0.98, 0.92);
        vec3 col = mix(cyan, gold, 0.5 + 0.5 * sin(vUv.x * 6.283 + uTime * 1.8));
        col = mix(col, platinum, core * 0.72);
        float alpha = clamp(core * pulse * endFade * uIntensity, 0.0, 1.0);
        gl_FragColor = vec4(col * (1.0 + core * 0.85), alpha);
      }
    `;
  }

  // 3. Cyan X-Ray Spatial Cutaway Sweep Shader (S4-1)
  if (!store.prologueXraySweepVertexShader) {
    store.prologueXraySweepVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main(void) {
        vec4 wp = world * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize((world * vec4(normal, 0.0)).xyz);
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.prologueXraySweepFragmentShader = `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform float uTime;
      uniform float uSweepZ;
      uniform float uSweepWidth;
      uniform float uIntensity;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main(void) {
        float distZ = abs(vWorldPos.z - uSweepZ);
        float band = exp(-pow(distZ / max(0.15, uSweepWidth), 2.0));
        if (band * uIntensity <= 0.005) discard;
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 1.9);
        float scanLines = 0.65 + 0.35 * sin(vWorldPos.y * 32.0 + uTime * 12.0);
        float orthoGrid = max(
          pow(abs(sin(vWorldPos.x * 6.0)), 14.0),
          pow(abs(sin(vWorldPos.z * 6.0)), 14.0)
        );
        vec3 col = mix(vec3(0.28, 0.90, 0.86), vec3(0.86, 0.99, 1.0), fresnel * 0.65 + orthoGrid * 0.35);
        float alpha = clamp((0.22 + fresnel * 0.68 + orthoGrid * 0.38) * band * scanLines * uIntensity, 0.0, 0.92);
        gl_FragColor = vec4(col, alpha);
      }
    `;
  }

  // 4. Soft Volumetric Light Shaft Shader (S1 / S3 / S5 / S6)
  if (!store.prologueVolumetricShaftVertexShader) {
    store.prologueVolumetricShaftVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.prologueVolumetricShaftFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(void) {
        float h = (vUv.x - 0.5) * 2.0;
        float hFade = pow(max(0.0, 1.0 - h * h), 2.2);
        float vFade = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265) * (0.6 + 0.4 * vUv.y);
        float caustic = 0.86 + 0.14 * sin(vUv.x * 14.0 + uTime * 0.9) * cos(vUv.y * 6.0 - uTime * 0.6);
        float alpha = clamp(hFade * vFade * caustic * uOpacity, 0.0, 0.92);
        gl_FragColor = vec4(uColor, alpha);
      }
    `;
  }

  // 5. Ion / Warp Thruster Plume Shader (P1 & P2 Flagship/Escorts)
  if (!store.prologueThrusterPlumeVertexShader) {
    store.prologueThrusterPlumeVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUv;
      void main(void) {
        vUv = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    store.prologueThrusterPlumeFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColorCore;
      uniform vec3 uColorEdge;
      uniform float uPower;
      varying vec2 vUv;
      void main(void) {
        float lengthFade = pow(max(0.0, 1.0 - vUv.y), 1.65);
        float flicker = 0.88 + 0.12 * sin(uTime * 28.0 + vUv.y * 18.0);
        vec3 col = mix(uColorEdge, uColorCore, lengthFade);
        float alpha = clamp(lengthFade * flicker * uPower, 0.0, 0.92);
        gl_FragColor = vec4(col * (1.0 + uPower * 0.55), alpha);
      }
    `;
  }
}

// ---------------------------------------------------------------------------
// Procedural Texture Generators (Sobel Normal + ORM + Albedo)
// ---------------------------------------------------------------------------

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function createTitaniumPlatePBR(scene, name, opts = {}) {
  const B = globalThis.BABYLON;
  const size = opts.size ?? 512;
  const baseHex = opts.baseHex ?? '#BCC8D6';
  const seamHex = opts.seamHex ?? '#526174';
  const accentHex = opts.accentHex ?? null;
  const roughnessByte = opts.roughnessByte ?? 76; // ~0.30 brushed titanium
  const metallicByte = opts.metallicByte ?? 218; // ~0.85 metallic
  const uScale = opts.uScale ?? 2;
  const vScale = opts.vScale ?? 2;

  const albedoTex = new B.DynamicTexture(`${name}_albedo`, { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture(`${name}_orm`, { width: size, height: size }, scene, true);
  const heightCanvas = makeCanvas(size);

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  aCtx.fillStyle = baseHex;
  aCtx.fillRect(0, 0, size, size);
  oCtx.fillStyle = `rgb(242, ${roughnessByte}, ${metallicByte})`;
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(176, 176, 176)';
  hCtx.fillRect(0, 0, size, size);

  // Subtle anisotropic brushed aerospace grain
  for (let y = 0; y < size; y += 3) {
    aCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(10,16,28,0.04)';
    aCtx.fillRect(0, y, size, 1.5);
  }

  // Modular armored plating courses & recessed precision seams
  const step = size / 2;
  for (let gx = 0; gx < size; gx += step) {
    for (let gy = 0; gy < size; gy += step) {
      aCtx.strokeStyle = seamHex;
      aCtx.lineWidth = 4;
      aCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
      oCtx.strokeStyle = 'rgb(148, 176, 92)';
      oCtx.lineWidth = 4;
      oCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
      hCtx.strokeStyle = 'rgb(70, 70, 70)';
      hCtx.lineWidth = 5;
      hCtx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);

      // Chamfered inner inspection hatch
      aCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      aCtx.lineWidth = 2;
      aCtx.strokeRect(gx + 20, gy + 20, step - 40, step - 40);
      hCtx.strokeStyle = 'rgb(198, 198, 198)';
      hCtx.lineWidth = 2;
      hCtx.strokeRect(gx + 20, gy + 20, step - 40, step - 40);

      // Corner micro-fasteners
      for (const [rx, ry] of [
        [gx + 12, gy + 12],
        [gx + step - 12, gy + 12],
        [gx + 12, gy + step - 12],
        [gx + step - 12, gy + step - 12],
      ]) {
        aCtx.fillStyle = seamHex;
        aCtx.beginPath();
        aCtx.arc(rx, ry, 2.8, 0, Math.PI * 2);
        aCtx.fill();
        hCtx.fillStyle = 'rgb(100, 100, 100)';
        hCtx.beginPath();
        hCtx.arc(rx, ry, 2.8, 0, Math.PI * 2);
        hCtx.fill();
      }
    }
  }

  if (accentHex) {
    aCtx.fillStyle = accentHex;
    aCtx.fillRect(0, size * 0.48, size, 8);
    oCtx.fillStyle = 'rgb(255, 58, 240)';
    oCtx.fillRect(0, size * 0.48, size, 8);
    hCtx.fillStyle = 'rgb(218, 218, 218)';
    hCtx.fillRect(0, size * 0.48, size, 8);
  }

  albedoTex.update();
  ormTex.update();
  albedoTex.uScale = uScale;
  albedoTex.vScale = vScale;
  ormTex.uScale = uScale;
  ormTex.vScale = vScale;

  const normalTex = buildNormalTextureFromHeightCanvas(scene, `${name}_normal`, heightCanvas, 2.3, uScale, vScale);

  const mat = new B.PBRMaterial(name, scene);
  mat.albedoColor = B.Color3.White();
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = opts.bumpLevel ?? 0.72;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = opts.clearCoatIntensity ?? 0.28;
  mat.clearCoat.roughness = opts.clearCoatRoughness ?? 0.22;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;

  return { mat, textures: [albedoTex, ormTex, normalTex] };
}

function createDeskWoodBronzePBR(scene) {
  const B = globalThis.BABYLON;
  const size = 512;
  const albedoTex = new B.DynamicTexture('pro_desk_walnut_albedo', { width: size, height: size }, scene, true);
  const ormTex = new B.DynamicTexture('pro_desk_walnut_orm', { width: size, height: size }, scene, true);
  const heightCanvas = makeCanvas(size);

  const aCtx = albedoTex.getContext();
  const oCtx = ormTex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  // Rich warm architectural walnut base
  const grad = aCtx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#4E3828');
  grad.addColorStop(0.5, '#5C4330');
  grad.addColorStop(1, '#473324');
  aCtx.fillStyle = grad;
  aCtx.fillRect(0, 0, size, size);

  // Satin varnished wood: AO=244, Roughness=96 (~0.38), Metallic=14
  oCtx.fillStyle = 'rgb(244, 96, 14)';
  oCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = 'rgb(168, 168, 168)';
  hCtx.fillRect(0, 0, size, size);

  // Organic fine walnut grain
  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin(y * 0.055) * 0.5 + Math.cos(y * 0.14) * 0.5;
    aCtx.fillStyle = wave > 0 ? 'rgba(135, 96, 62, 0.12)' : 'rgba(28, 18, 12, 0.16)';
    aCtx.fillRect(0, y, size, 2);
    hCtx.fillStyle = wave > 0 ? 'rgba(186,186,186,0.22)' : 'rgba(148,148,148,0.22)';
    hCtx.fillRect(0, y, size, 2);
  }

  // Precision inlaid brushed-brass instrumentation perimeter strips
  aCtx.strokeStyle = '#C99E4E';
  aCtx.lineWidth = 10;
  aCtx.strokeRect(18, 18, size - 36, size - 36);
  oCtx.strokeStyle = 'rgb(255, 58, 236)';
  oCtx.lineWidth = 10;
  oCtx.strokeRect(18, 18, size - 36, size - 36);
  hCtx.strokeStyle = 'rgb(218, 218, 218)';
  hCtx.lineWidth = 10;
  hCtx.strokeRect(18, 18, size - 36, size - 36);

  albedoTex.update();
  ormTex.update();
  const normalTex = buildNormalTextureFromHeightCanvas(scene, 'pro_desk_walnut_normal', heightCanvas, 1.8, 1, 1);

  const mat = new B.PBRMaterial('pro_desk_wood_bronze_pbr', scene);
  mat.albedoColor = B.Color3.White();
  mat.albedoTexture = albedoTex;
  mat.metallicTexture = ormTex;
  mat.useAmbientOcclusionFromMetallicTextureRed = true;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.useMetallnessFromMetallicTextureBlue = true;
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = 0.58;
  mat.metallic = 1.0;
  mat.roughness = 1.0;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.42;
  mat.clearCoat.roughness = 0.2;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;

  return { mat, textures: [albedoTex, ormTex, normalTex] };
}

function createCalibrationSpherePBR(scene) {
  const B = globalThis.BABYLON;
  const size = 512;
  const tex = new B.DynamicTexture('pro_calib_orb_tex', { width: size, height: size }, scene, true);
  const heightCanvas = makeCanvas(size);
  const ctx = tex.getContext();
  const hCtx = heightCanvas.getContext('2d');

  // High-contrast silver-cyan metallic calibration sphere
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#EBF9FF');
  grad.addColorStop(0.45, '#86DDF2');
  grad.addColorStop(0.55, '#54C5E0');
  grad.addColorStop(1, '#EBF9FF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = 'rgb(176, 176, 176)';
  hCtx.fillRect(0, 0, size, size);

  // Precision astronomical latitude & longitude calibration engravings
  ctx.strokeStyle = 'rgba(255, 248, 224, 0.82)';
  ctx.lineWidth = 2.6;
  hCtx.strokeStyle = 'rgb(96, 96, 96)';
  hCtx.lineWidth = 3;
  for (let y = 64; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(size, y);
    hCtx.stroke();
  }
  for (let x = 64; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
    hCtx.beginPath();
    hCtx.moveTo(x, 0);
    hCtx.lineTo(x, size);
    hCtx.stroke();
  }

  // Twin gleaming gold-cyan equator bands
  ctx.strokeStyle = '#FFF5D0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5 - 10);
  ctx.lineTo(size, size * 0.5 - 10);
  ctx.moveTo(0, size * 0.5 + 10);
  ctx.lineTo(size, size * 0.5 + 10);
  ctx.stroke();

  tex.update();
  const normalTex = buildNormalTextureFromHeightCanvas(scene, 'pro_calib_orb_normal', heightCanvas, 1.9, 1, 1);

  const mat = new B.PBRMaterial('pro_calib_sphere_pbr', scene);
  mat.albedoColor = B.Color3.FromHexString('#DDF8FF');
  mat.albedoTexture = tex;
  mat.emissiveTexture = tex;
  mat.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(0.55);
  mat.bumpTexture = normalTex;
  mat.bumpTexture.level = 0.55;
  mat.metallic = 0.92;
  mat.roughness = 0.08;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 1.0;
  mat.clearCoat.roughness = 0.04;
  mat.disableDepthWrite = false;
  mat.needDepthPrePass = false;

  return { mat, textures: [tex, normalTex] };
}

function createCryoFrostGlassPBR(scene) {
  const B = globalThis.BABYLON;
  const size = 256;
  const frostCanvas = makeCanvas(size);
  const fCtx = frostCanvas.getContext('2d');
  fCtx.fillStyle = 'rgb(142, 142, 142)';
  fCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i += 1) {
    const s1 = Math.sin(i * 12.9898 + 1.1) * 43758.5453;
    const s2 = Math.sin(i * 78.233 + 2.7) * 43758.5453;
    const x = (s1 - Math.floor(s1)) * size;
    const y = (s2 - Math.floor(s2)) * size;
    const edgeFactor = Math.max(Math.abs(x / size - 0.5), Math.abs(y / size - 0.5)) * 2;
    const bright = edgeFactor > 0.5 ? 210 : 165;
    fCtx.fillStyle = `rgba(${bright},${bright},${bright},0.28)`;
    fCtx.fillRect(x, y, 4, 4);
  }
  const frostNormal = buildNormalTextureFromHeightCanvas(scene, 'pro_cryo_frost_normal', frostCanvas, 1.4, 2, 2);

  const mat = new B.PBRMaterial('pro_cryo_frosted_glass_pbr', scene);
  mat.albedoColor = B.Color3.FromHexString('#AEDEF8');
  mat.emissiveColor = B.Color3.FromHexString('#58A6FF').scale(0.22);
  mat.bumpTexture = frostNormal;
  mat.bumpTexture.level = 0.35;
  mat.metallic = 0.14;
  mat.roughness = 0.24;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.85;
  mat.clearCoat.roughness = 0.1;
  mat.alpha = 0.34;
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.needDepthPrePass = false;
  mat._isPrologueTranslucent = true;

  return { mat, textures: [frostNormal] };
}

// ---------------------------------------------------------------------------
// Material Bank & Ghost Invariant Verifier
// ---------------------------------------------------------------------------

/**
 * Verify that EVERY translucent / Ghost / shader / glass / volumetric material
 * sets disableDepthWrite = true and needDepthPrePass = false, and NO material
 * anywhere enables needDepthPrePass.
 */
export function verifyGhostInvariants(bank) {
  const B = globalThis.BABYLON;
  const violations = [];
  let checkedCount = 0;

  if (!bank || typeof bank !== 'object') {
    return { ok: false, checkedCount: 0, violations: ['Material bank is null or invalid.'] };
  }

  const entries = Array.isArray(bank._allEntries)
    ? bank._allEntries
    : Object.entries(bank).filter(([, v]) => v && typeof v === 'object' && 'needDepthPrePass' in v);

  for (const [key, mat] of entries) {
    if (!mat || typeof mat !== 'object') continue;
    checkedCount += 1;

    if (Boolean(mat.needDepthPrePass)) {
      violations.push(`${key}: needDepthPrePass must be false`);
    }

    const isAlphaAdd = B && B.Engine && mat.alphaMode === B.Engine.ALPHA_ADD;
    const needsBlend = typeof mat.needAlphaBlending === 'function' ? Boolean(mat.needAlphaBlending()) : false;
    const isTranslucent =
      Boolean(mat._isPrologueTranslucent) ||
      (typeof mat.alpha === 'number' && mat.alpha < 0.99) ||
      isAlphaAdd ||
      needsBlend;

    if (isTranslucent && mat.disableDepthWrite !== true) {
      violations.push(`${key}: translucent/shader material must set disableDepthWrite = true`);
    }
  }

  return {
    ok: violations.length === 0,
    checkedCount,
    violations,
  };
}

/**
 * Build the complete Prologue material bank (>= 20 PBR & custom GLSL shader materials).
 */
export function createPrologueMaterialBank(scene) {
  const B = globalThis.BABYLON;
  registerPrologueShaders();

  const textures = [];
  const track = (pack) => {
    if (pack.textures) textures.push(...pack.textures);
    return pack.mat;
  };

  // 1. Flagship Brushed Silver-Titanium Hull Armor
  const hullTitanium = track(
    createTitaniumPlatePBR(scene, 'pro_hull_titanium_pbr', {
      baseHex: '#C6D1DE',
      seamHex: '#56667A',
      accentHex: '#C9A152',
      roughnessByte: 68,
      metallicByte: 224,
      clearCoatIntensity: 0.36,
      uScale: 3,
      vScale: 2,
    })
  );

  // 2. Flagship & Cabin Dark Gunmetal Structural Ribs (rich satin titanium catching IBL speculars)
  const hullDarkRib = track(
    createTitaniumPlatePBR(scene, 'pro_hull_dark_rib_pbr', {
      baseHex: '#2E3D52',
      seamHex: '#121A26',
      roughnessByte: 82,
      metallicByte: 204,
      clearCoatIntensity: 0.3,
      uScale: 2,
      vScale: 2,
    })
  );

  // 3. Aerospace Brushed Gold-Brass Accent Trim
  const hullAccentGold = new B.PBRMaterial('pro_hull_accent_gold_pbr', scene);
  hullAccentGold.albedoColor = B.Color3.FromHexString('#D8AB52');
  hullAccentGold.metallic = 0.94;
  hullAccentGold.roughness = 0.2;
  hullAccentGold.emissiveColor = B.Color3.FromHexString('#8A6A2F').scale(0.14);
  hullAccentGold.clearCoat.isEnabled = true;
  hullAccentGold.clearCoat.intensity = 0.48;
  hullAccentGold.clearCoat.roughness = 0.16;
  hullAccentGold.disableDepthWrite = false;
  hullAccentGold.needDepthPrePass = false;

  // 4. Cryo-Corridor Clinical Ice-Silver Alloy
  const cryoAlloy = track(
    createTitaniumPlatePBR(scene, 'pro_cryo_alloy_pbr', {
      baseHex: '#CAD6E4',
      seamHex: '#7A8BA0',
      roughnessByte: 80,
      metallicByte: 178,
      clearCoatIntensity: 0.34,
      uScale: 2,
      vScale: 2,
    })
  );

  // 4B. Cryo-Pod Brushed Satin Titanium Chassis Shell (#5D718C)
  const cryoSatinTitanium = track(
    createTitaniumPlatePBR(scene, 'pro_cryo_satin_ti_pbr', {
      baseHex: '#5D718C',
      seamHex: '#2B3A4E',
      roughnessByte: 74,
      metallicByte: 208,
      clearCoatIntensity: 0.36,
      uScale: 2,
      vScale: 2,
    })
  );

  // 5. Cryo-Pod Frosted Canopy Glass (Translucent, Ghost-safe)
  const cryoFrostedGlass = track(createCryoFrostGlassPBR(scene));

  // 6. Science Cabin Polished Dark-Titanium Reflective Deck (MirrorTexture-ready!)
  const cabinDeckMirror = track(
    createTitaniumPlatePBR(scene, 'pro_cabin_deck_mirror_pbr', {
      baseHex: '#18212E',
      seamHex: '#0D131C',
      accentHex: '#426B7A',
      roughnessByte: 46,
      metallicByte: 164,
      clearCoatIntensity: 0.58,
      clearCoatRoughness: 0.12,
      bumpLevel: 0.45,
      uScale: 4,
      vScale: 4,
    })
  );

  // 7. Science Cabin Dark-Titanium Arched Bulkheads
  const cabinDarkTitanium = track(
    createTitaniumPlatePBR(scene, 'pro_cabin_dark_ti_pbr', {
      baseHex: '#253447',
      seamHex: '#111925',
      roughnessByte: 86,
      metallicByte: 192,
      clearCoatIntensity: 0.32,
      uScale: 2,
      vScale: 2,
    })
  );

  // 8. Science Desk Warm Walnut & Inlaid Brass PBR
  const deskWoodBronze = track(createDeskWoodBronzePBR(scene));

  // 9. Lin Xia (07 号) Tailored Slate-Ivory Flight Suit PBR (zero forbidden crimson motif)
  const linXiaSuit = new B.PBRMaterial('pro_linxia_suit_pbr', scene);
  linXiaSuit.albedoColor = B.Color3.FromHexString('#DDE4EE');
  linXiaSuit.metallic = 0.14;
  linXiaSuit.roughness = 0.46;
  linXiaSuit.clearCoat.isEnabled = true;
  linXiaSuit.clearCoat.intensity = 0.14;
  linXiaSuit.disableDepthWrite = false;
  linXiaSuit.needDepthPrePass = false;

  // 10. Lin Xia Accent Slate Collar / Hair & Skin PBR
  const linXiaDarkTrim = new B.PBRMaterial('pro_linxia_trim_pbr', scene);
  linXiaDarkTrim.albedoColor = B.Color3.FromHexString('#2A3648');
  linXiaDarkTrim.metallic = 0.28;
  linXiaDarkTrim.roughness = 0.42;
  linXiaDarkTrim.disableDepthWrite = false;
  linXiaDarkTrim.needDepthPrePass = false;

  const linXiaSkin = new B.PBRMaterial('pro_linxia_skin_pbr', scene);
  linXiaSkin.albedoColor = B.Color3.FromHexString('#E5C5AE');
  linXiaSkin.metallic = 0.02;
  linXiaSkin.roughness = 0.54;
  linXiaSkin.disableDepthWrite = false;
  linXiaSkin.needDepthPrePass = false;

  // 11. Ultra-Clean Scientific Borosilicate Glass (6-face sealed box & panoramic bow glass)
  const borosilicateGlass = new B.PBRMaterial('pro_borosilicate_glass_pbr', scene);
  borosilicateGlass.albedoColor = B.Color3.FromHexString('#D6F6FF');
  borosilicateGlass.emissiveColor = B.Color3.FromHexString('#7ADCF2').scale(0.14);
  borosilicateGlass.metallic = 0.12;
  borosilicateGlass.roughness = 0.05;
  borosilicateGlass.clearCoat.isEnabled = true;
  borosilicateGlass.clearCoat.intensity = 1.0;
  borosilicateGlass.clearCoat.roughness = 0.03;
  borosilicateGlass.alpha = 0.24;
  borosilicateGlass.backFaceCulling = false;
  borosilicateGlass.disableDepthWrite = true;
  borosilicateGlass.needDepthPrePass = false;
  borosilicateGlass._isPrologueTranslucent = true;

  // 12. High-Contrast Silver-Cyan Metallic Calibration Sphere PBR
  const calibrationSphereCrystal = track(createCalibrationSpherePBR(scene));

  // 13. Custom GLSL Liquid-Mercury 4D Spatial Veil Shader (S2)
  const mercuryVeilShader = new B.ShaderMaterial(
    'pro_mercury_veil_shader',
    scene,
    { vertex: 'prologueMercuryVeil', fragment: 'prologueMercuryVeil' },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: [
        'world',
        'worldViewProjection',
        'cameraPosition',
        'uTime',
        'uRippleCenter',
        'uRippleRadius',
        'uRippleIntensity',
        'uOpacity',
      ],
      needAlphaBlending: true,
    }
  );
  mercuryVeilShader.setFloat('uTime', 0);
  mercuryVeilShader.setVector3('uRippleCenter', new B.Vector3(0, 0.4, 0));
  mercuryVeilShader.setFloat('uRippleRadius', 2.0);
  mercuryVeilShader.setFloat('uRippleIntensity', 0.0);
  mercuryVeilShader.setFloat('uOpacity', 0.92);
  mercuryVeilShader.alpha = 0.88;
  mercuryVeilShader.backFaceCulling = false;
  mercuryVeilShader.disableDepthWrite = true;
  mercuryVeilShader.needDepthPrePass = false;
  mercuryVeilShader._isPrologueTranslucent = true;

  // 14. Cold-Cyan 4D Megastructure Beam PBR (S3)
  const tesseractCyanBeam = new B.PBRMaterial('pro_tesseract_cyan_pbr', scene);
  tesseractCyanBeam.albedoColor = B.Color3.FromHexString('#B4FAF2');
  tesseractCyanBeam.emissiveColor = B.Color3.FromHexString(PALETTE.accent.cyanW0).scale(1.55);
  tesseractCyanBeam.metallic = 0.65;
  tesseractCyanBeam.roughness = 0.14;
  tesseractCyanBeam.disableDepthWrite = false;
  tesseractCyanBeam.needDepthPrePass = false;

  // 15. Sacred Astral-Gold 4D Megastructure Beam PBR (S3)
  const tesseractGoldBeam = new B.PBRMaterial('pro_tesseract_gold_pbr', scene);
  tesseractGoldBeam.albedoColor = B.Color3.FromHexString('#FFF0C2');
  tesseractGoldBeam.emissiveColor = B.Color3.FromHexString(PALETTE.accent.goldWPos).scale(1.48);
  tesseractGoldBeam.metallic = 0.82;
  tesseractGoldBeam.roughness = 0.14;
  tesseractGoldBeam.disableDepthWrite = false;
  tesseractGoldBeam.needDepthPrePass = false;

  // 16. Weightless Luminous Glass Shards PBR (S4-1 & S5)
  const glassShardLuminous = new B.PBRMaterial('pro_glass_shard_luminous_pbr', scene);
  glassShardLuminous.albedoColor = B.Color3.FromHexString('#D8FCFA');
  glassShardLuminous.emissiveColor = B.Color3.FromHexString('#6CF0E4').scale(0.95);
  glassShardLuminous.metallic = 0.45;
  glassShardLuminous.roughness = 0.08;
  glassShardLuminous.clearCoat.isEnabled = true;
  glassShardLuminous.clearCoat.intensity = 1.0;
  glassShardLuminous.alpha = 0.62;
  glassShardLuminous.backFaceCulling = false;
  glassShardLuminous.disableDepthWrite = true;
  glassShardLuminous.needDepthPrePass = false;
  glassShardLuminous._isPrologueTranslucent = true;

  // 17. Custom GLSL Cyan-Gold 4D Origami Hinge Glow Shader (S5)
  const origamiHingeGlow = new B.ShaderMaterial(
    'pro_origami_hinge_shader',
    scene,
    { vertex: 'prologueOrigamiHinge', fragment: 'prologueOrigamiHinge' },
    {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uTime', 'uIntensity'],
      needAlphaBlending: true,
    }
  );
  origamiHingeGlow.setFloat('uTime', 0);
  origamiHingeGlow.setFloat('uIntensity', 0);
  origamiHingeGlow.alpha = 0.85;
  origamiHingeGlow.alphaMode = B.Engine.ALPHA_ADD;
  origamiHingeGlow.backFaceCulling = false;
  origamiHingeGlow.disableDepthWrite = true;
  origamiHingeGlow.needDepthPrePass = false;
  origamiHingeGlow._isPrologueTranslucent = true;

  // 18. Custom GLSL Cyan X-Ray Spatial Sweep Shader (S4-1)
  const xrayCutawayGhost = new B.ShaderMaterial(
    'pro_xray_cutaway_shader',
    scene,
    { vertex: 'prologueXraySweep', fragment: 'prologueXraySweep' },
    {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'worldViewProjection', 'cameraPosition', 'uTime', 'uSweepZ', 'uSweepWidth', 'uIntensity'],
      needAlphaBlending: true,
    }
  );
  xrayCutawayGhost.setFloat('uTime', 0);
  xrayCutawayGhost.setFloat('uSweepZ', 2.0);
  xrayCutawayGhost.setFloat('uSweepWidth', 0.9);
  xrayCutawayGhost.setFloat('uIntensity', 0);
  xrayCutawayGhost.alpha = 0.78;
  xrayCutawayGhost.alphaMode = B.Engine.ALPHA_ADD;
  xrayCutawayGhost.backFaceCulling = false;
  xrayCutawayGhost.disableDepthWrite = true;
  xrayCutawayGhost.needDepthPrePass = false;
  xrayCutawayGhost._isPrologueTranslucent = true;

  // 19. Custom GLSL Volumetric Light Shaft Shader (S1 / S3 / S5 / S6)
  const volumetricShaft = new B.ShaderMaterial(
    'pro_volumetric_shaft_shader',
    scene,
    { vertex: 'prologueVolumetricShaft', fragment: 'prologueVolumetricShaft' },
    {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uTime', 'uColor', 'uOpacity'],
      needAlphaBlending: true,
    }
  );
  volumetricShaft.setFloat('uTime', 0);
  volumetricShaft.setColor3('uColor', B.Color3.FromHexString('#9AF4EC'));
  volumetricShaft.setFloat('uOpacity', 0.24);
  volumetricShaft.alpha = 0.5;
  volumetricShaft.alphaMode = B.Engine.ALPHA_ADD;
  volumetricShaft.backFaceCulling = false;
  volumetricShaft.disableDepthWrite = true;
  volumetricShaft.needDepthPrePass = false;
  volumetricShaft._isPrologueTranslucent = true;

  // 20. Custom GLSL Ion / Warp Engine Plume Shader (P1 / P2)
  const thrusterPlume = new B.ShaderMaterial(
    'pro_thruster_plume_shader',
    scene,
    { vertex: 'prologueThrusterPlume', fragment: 'prologueThrusterPlume' },
    {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uTime', 'uColorCore', 'uColorEdge', 'uPower'],
      needAlphaBlending: true,
    }
  );
  thrusterPlume.setFloat('uTime', 0);
  thrusterPlume.setColor3('uColorCore', B.Color3.FromHexString('#FFF2C6'));
  thrusterPlume.setColor3('uColorEdge', B.Color3.FromHexString('#4DE6D3'));
  thrusterPlume.setFloat('uPower', 0.65);
  thrusterPlume.alpha = 0.72;
  thrusterPlume.alphaMode = B.Engine.ALPHA_ADD;
  thrusterPlume.backFaceCulling = false;
  thrusterPlume.disableDepthWrite = true;
  thrusterPlume.needDepthPrePass = false;
  thrusterPlume._isPrologueTranslucent = true;

  // 21. Polar-Day Pure Alabaster Panel PBR (S5 / S6 unfolded luminous architecture)
  const polarWhitePanel = new B.PBRMaterial('pro_polar_white_pbr', scene);
  polarWhitePanel.albedoColor = B.Color3.FromHexString('#F4F8FC');
  polarWhitePanel.emissiveColor = B.Color3.FromHexString('#E6F2FA').scale(0.35);
  polarWhitePanel.metallic = 0.08;
  polarWhitePanel.roughness = 0.22;
  polarWhitePanel.clearCoat.isEnabled = true;
  polarWhitePanel.clearCoat.intensity = 0.45;
  polarWhitePanel.disableDepthWrite = false;
  polarWhitePanel.needDepthPrePass = false;

  // 22-25. Calibrated Emissive Indicator Accents
  const makeBeaconMat = (name, hex, scale = 1.25) => {
    const m = new B.StandardMaterial(name, scene);
    const c = B.Color3.FromHexString(hex);
    m.diffuseColor = c;
    m.emissiveColor = c.scale(scale);
    m.disableLighting = true;
    m.disableDepthWrite = false;
    m.needDepthPrePass = false;
    return m;
  };
  const emissiveCyan = makeBeaconMat('pro_emissive_cyan', PALETTE.accent.cyanW0, 1.35);
  const emissiveIceBlue = makeBeaconMat('pro_emissive_iceblue', '#58A6FF', 1.25);
  const emissiveAmber = makeBeaconMat('pro_emissive_amber', '#F7B733', 1.35);
  const emissiveEmerald = makeBeaconMat('pro_emissive_emerald', PALETTE.accent.emerald, 1.45);
  const emissiveWarmLamp = makeBeaconMat('pro_emissive_warm_lamp', '#FFD28A', 1.6);

  const namedMaterials = {
    hullTitanium,
    hullDarkRib,
    hullAccentGold,
    cryoAlloy,
    cryoSatinTitanium,
    cryoFrostedGlass,
    cabinDeckMirror,
    cabinDarkTitanium,
    deskWoodBronze,
    linXiaSuit,
    linXiaDarkTrim,
    linXiaSkin,
    borosilicateGlass,
    calibrationSphereCrystal,
    mercuryVeilShader,
    tesseractCyanBeam,
    tesseractGoldBeam,
    glassShardLuminous,
    origamiHingeGlow,
    xrayCutawayGhost,
    volumetricShaft,
    thrusterPlume,
    polarWhitePanel,
    emissiveCyan,
    emissiveIceBlue,
    emissiveAmber,
    emissiveEmerald,
    emissiveWarmLamp,
  };

  const allEntries = Object.entries(namedMaterials);

  const bank = {
    ...namedMaterials,
    _allEntries: allEntries,
    _textures: textures,

    updateShaders(timeSec, opts = {}) {
      const t = Number.isFinite(timeSec) ? timeSec : 0;
      mercuryVeilShader.setFloat('uTime', t);
      origamiHingeGlow.setFloat('uTime', t);
      xrayCutawayGhost.setFloat('uTime', t);
      volumetricShaft.setFloat('uTime', t);
      thrusterPlume.setFloat('uTime', t);

      if (opts.rippleCenter) {
        mercuryVeilShader.setVector3(
          'uRippleCenter',
          new B.Vector3(opts.rippleCenter[0], opts.rippleCenter[1], opts.rippleCenter[2])
        );
      }
      if (typeof opts.rippleRadius === 'number') {
        mercuryVeilShader.setFloat('uRippleRadius', opts.rippleRadius);
      }
      if (typeof opts.rippleIntensity === 'number') {
        mercuryVeilShader.setFloat('uRippleIntensity', opts.rippleIntensity);
      }
      if (typeof opts.veilOpacity === 'number') {
        mercuryVeilShader.setFloat('uOpacity', opts.veilOpacity);
      }
      if (typeof opts.hingeIntensity === 'number') {
        origamiHingeGlow.setFloat('uIntensity', opts.hingeIntensity);
      }
      if (typeof opts.xraySweepZ === 'number') {
        xrayCutawayGhost.setFloat('uSweepZ', opts.xraySweepZ);
      }
      if (typeof opts.xrayIntensity === 'number') {
        xrayCutawayGhost.setFloat('uIntensity', opts.xrayIntensity);
      }
      if (typeof opts.shaftOpacity === 'number') {
        volumetricShaft.setFloat('uOpacity', opts.shaftOpacity);
      }
      if (opts.shaftColorHex) {
        volumetricShaft.setColor3('uColor', B.Color3.FromHexString(opts.shaftColorHex));
      }
      if (typeof opts.thrusterPower === 'number') {
        thrusterPlume.setFloat('uPower', opts.thrusterPower);
      }
    },

    verifyGhostInvariants() {
      return verifyGhostInvariants(bank);
    },

    dispose() {
      for (const [, mat] of allEntries) {
        mat.dispose(false, false);
      }
      for (const tex of textures) {
        tex.dispose();
      }
    },
  };

  // Hard self-verification at construction time
  const check = bank.verifyGhostInvariants();
  if (!check.ok) {
    throw new Error(`Prologue material bank Ghost invariant failure: ${check.violations.join('; ')}`);
  }

  return bank;
}

// ---------------------------------------------------------------------------
// Cinema DefaultRenderingPipeline (ACES Filmic + Bloom + FXAA + Sharpen + Grain)
// ---------------------------------------------------------------------------

export function setupPrologueCinemaPipeline(scene, camera) {
  const B = globalThis.BABYLON;
  const pipeline = new B.DefaultRenderingPipeline('prologue_cinema_pipeline', true, scene, [camera]);

  pipeline.samples = 2;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.5;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.18;
  pipeline.imageProcessing.exposure = 1.1;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.85;
  pipeline.imageProcessing.vignetteStretch = 0.36;
  pipeline.imageProcessing.vignetteColor = new B.Color4(0.01, 0.02, 0.045, 0);

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.16;
  pipeline.sharpen.colorAmount = 1.0;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 3.2;
  pipeline.grain.animated = true;

  return pipeline;
}

export function applyCinemaGrading(pipeline, postSpec) {
  if (!pipeline || !postSpec) return;

  if (pipeline.imageProcessing) {
    if (typeof postSpec.exposure === 'number') {
      pipeline.imageProcessing.exposure = postSpec.exposure;
    }
    if (typeof postSpec.contrast === 'number') {
      pipeline.imageProcessing.contrast = postSpec.contrast;
    }
    if (typeof postSpec.vignetteWeight === 'number') {
      pipeline.imageProcessing.vignetteWeight = postSpec.vignetteWeight;
      pipeline.imageProcessing.vignetteEnabled = postSpec.vignetteWeight > 0.02;
    }
  }

  if (typeof postSpec.bloomWeight === 'number') {
    pipeline.bloomWeight = postSpec.bloomWeight;
  }
  if (typeof postSpec.bloomThreshold === 'number') {
    pipeline.bloomThreshold = postSpec.bloomThreshold;
  }
  if (pipeline.grain && typeof postSpec.grainIntensity === 'number') {
    pipeline.grain.intensity = postSpec.grainIntensity;
    pipeline.grainEnabled = postSpec.grainIntensity > 0.05;
  }
}
