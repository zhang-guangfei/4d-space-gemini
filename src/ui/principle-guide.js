/**
 * Beyond 3D — Interactive Principle Briefing ("二维硬币 → 四维圆球" 3D Perspective Dimensional Analogy)
 *
 * Strictly scoped to Level 14:
 * - Large, readable canvas with true 3D perspective projection on both panels:
 *   LEFT:  3D perspective coin on a 2D paper plane lifting into 3rd dimension height to clear a vertical slit
 *   RIGHT: True 3D perspective animation of our 3D sphere rotating off "我们所在的三维切面"
 *          along an arrowed golden number line representing "第四维度 w"
 * - NEVER displays "W=0切片" / "W=0" anywhere; always uses "我们所在的三维切面" and "第四维度 w"
 */

import { degToRad } from '../core/math4d.js';
import { PALETTE } from '../engine/phase-materials.js';

/**
 * Simple 3D perspective projector (X = right, Y = depth away/toward viewer, Z = vertical extra dimension).
 */
function makeProjector3D(cx, cy, scale, yawRad, pitchRad, camDist = 6.4) {
  const cyaw = Math.cos(yawRad);
  const syaw = Math.sin(yawRad);
  const cpitch = Math.cos(pitchRad);
  const spitch = Math.sin(pitchRad);

  return function project(x, y, z) {
    // Rotate around vertical Z axis by yaw
    const rx = x * cyaw - y * syaw;
    const ry = x * syaw + y * cyaw;
    // Tilt camera by pitch around X axis
    const py = ry * cpitch - z * spitch;
    const pz = ry * spitch + z * cpitch;

    const denom = Math.max(1.5, camDist + py);
    const persp = camDist / denom;
    return {
      sx: cx + rx * scale * persp,
      sy: cy - pz * scale * persp,
      depth: py,
      persp,
    };
  };
}

function drawPolygon3D(ctx, pts3D, project, fillStyle, strokeStyle, lineWidth = 1) {
  const pts2D = pts3D.map(([x, y, z]) => project(x, y, z));
  ctx.beginPath();
  pts2D.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  });
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  return pts2D;
}

function drawBox3D(ctx, x0, x1, y0, y1, z0, z1, project, colors) {
  // Painter's order for camera looking from (-Y, +Z, +X)
  const faces = [
    // Bottom
    {
      pts: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      fill: colors.side,
    },
    // Back (+Y)
    {
      pts: [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      fill: colors.side,
    },
    // Left (-X)
    {
      pts: [
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
      fill: colors.inner,
    },
    // Right (+X)
    {
      pts: [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      fill: colors.inner,
    },
    // Front (-Y)
    {
      pts: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      fill: colors.front,
    },
    // Top (+Z)
    {
      pts: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      fill: colors.top,
    },
  ];

  // Sort back-to-front by average projected depth
  faces
    .map((f) => {
      const proj = f.pts.map(([x, y, z]) => project(x, y, z));
      const avgDepth = proj.reduce((acc, p) => acc + p.depth, 0) / proj.length;
      return { ...f, proj, avgDepth };
    })
    .sort((a, b) => b.avgDepth - a.avgDepth)
    .forEach((f) => {
      ctx.beginPath();
      f.proj.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      });
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      if (colors.stroke) {
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
}

function drawArrowedNumberLine3D(ctx, project, axisLabel, zMin = -1.48, zMax = 1.56) {
  const pBot = project(0, 0, zMin);
  const pTop = project(0, 0, zMax);

  // Subtle glow underlay
  ctx.save();
  ctx.strokeStyle = 'rgba(247, 195, 70, 0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pBot.sx, pBot.sy);
  ctx.lineTo(pTop.sx, pTop.sy);
  ctx.stroke();

  // Crisp golden axis shaft
  ctx.strokeStyle = PALETTE.accent.goldWPos;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(pBot.sx, pBot.sy);
  ctx.lineTo(pTop.sx, pTop.sy);
  ctx.stroke();

  // Directional arrowhead at +axis tip
  const dx = pTop.sx - pBot.sx;
  const dy = pTop.sy - pBot.sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  ctx.fillStyle = PALETTE.accent.goldWPos;
  ctx.beginPath();
  ctx.moveTo(pTop.sx + ux * 7, pTop.sy + uy * 7);
  ctx.lineTo(pTop.sx - ux * 8 + px * 6, pTop.sy - uy * 8 + py * 6);
  ctx.lineTo(pTop.sx - ux * 8 - px * 6, pTop.sy - uy * 8 - py * 6);
  ctx.closePath();
  ctx.fill();

  // Number-line scale ticks: -1, 0, +1
  ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'left';
  for (const tick of [
    { v: -1.0, label: '−1' },
    { v: 0.0, label: '0' },
    { v: 1.0, label: '+1' },
  ]) {
    const tL = project(-0.08, 0, tick.v);
    const tR = project(0.08, 0, tick.v);
    ctx.strokeStyle = PALETTE.accent.goldWPos;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tL.sx, tL.sy);
    ctx.lineTo(tR.sx, tR.sy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 246, 214, 0.85)';
    ctx.fillText(tick.label, tR.sx + 5, tR.sy + 4);
  }

  // Axis Title right beside arrowhead
  ctx.font = '700 13px "Inter", "PingFang SC", sans-serif';
  ctx.fillStyle = PALETTE.accent.goldWPos;
  ctx.textAlign = 'left';
  ctx.fillText(axisLabel, pTop.sx + 12, pTop.sy + 4);
  ctx.restore();
}

const PRINCIPLE_LEVEL_DOCS = Object.freeze({
  1: {
    eyebrow: 'A 区 · 回廊科研站 · 3D 原理动画（第 1 关）',
    title: '为什么笔直往前走，却看见了自己的后背并绕回起点？',
    sliderLabel: '拖动滑块沿直线走过回廊（第 1 → 第 9 间）：',
    min: 1,
    max: 9,
    step: 0.05,
    points: [
      {
        head: '1. 降维类比：一维圆环上的观察者',
        body: '假如一个小人住在闭合圆环线上，光线绕圆一圈传回他眼里，他正前方看到的其实就是自己的后背——举起左手，前方背影也在<strong>同一侧</strong>举左手（与照镜子左右相反截然不同）。',
      },
      {
        head: '2. 四维正八胞体的三维外壳',
        body: '正八胞体的三维边界由 <strong>8 个立方体房间</strong>首尾无缝相接构成；沿任意一条主轴笔直穿越 <code>4</code> 间房（<code>W+ → X+ → W− → X− → W+</code>）就会精确绕回原点，周长 <code>24m</code>。',
      },
      {
        head: '3. 周期为 4 的雕像旋转',
        body: '每跨过一扇门，窗外空间刚性转过 <code>90°</code>，走满 4 间刚好转满 <code>360°</code> 回到初始朝向——因此第 <code>5</code> 间、第 <code>9</code> 间与第 <code>1</code> 间完全一致！',
      },
    ],
  },
  2: {
    eyebrow: 'A 区 · 回廊科研站 · 3D 原理动画（第 2 关）',
    title: '8 个房间为什么只有 6 扇门，且必有 6 条两步路径通向对面？',
    sliderLabel: '拖动滑块观察从 W+ 抵达对跖室 W− 的两步路径：',
    min: 0,
    max: 2,
    step: 0.02,
    points: [
      {
        head: '1. 降维类比：正方形的 4 条边',
        body: '二维正方形的每条边只连接左右 <code>2</code> 条相邻边，唯独没有门直通正对面那条边；但借道任意一条相邻边，都只需 <code>2</code> 步到达对面。',
      },
      {
        head: '2. 立方体最多开 6 扇门',
        body: '一个三维立方体房间（<code>W+</code>）只有上下左右前后 <code>6</code> 个面，最多直接连通 <code>6</code> 个相邻房间（<code>X±、Y±、Z±</code>），唯独对跖室 <code>W−</code> 是直达盲区。',
      },
      {
        head: '3. 全部 6 个邻居一步直通 W−',
        body: '在正八胞体外壳上，<code>W+</code> 的 <code>6</code> 个邻居各自都与正对面的 <code>W−</code> 共享一面墙，因此从 <code>W+</code> 跨两扇门到达 <code>W−</code> 共有 <strong>6 条最短路径</strong>。',
      },
    ],
  },
  3: {
    eyebrow: 'A 区 · 回廊科研站 · 3D 原理动画（第 3 关）',
    title: '明明没转过身，为什么绕三间房飞一圈陀螺自己转了 90°？',
    sliderLabel: '拖动滑块携锁死陀螺绕共棱三房飞行（0% → 100%）：',
    min: 0,
    max: 100,
    step: 1,
    points: [
      {
        head: '1. 降维类比：三张正方形围成的 270° 圆锥角亏',
        body: '平铺桌面时，一个顶点周围围着 <code>4</code> 张正方形（<code>360°</code>）；若只用 <code>3</code> 张正方形折成纸盒角（<code>3 × 90° = 270°</code>），顶点处就缺少了 <code>90°</code>（角亏）。',
      },
      {
        head: '2. 沿曲面平行移动产生的「空间和乐」',
        body: '把一枚锁死不准自转的指针紧贴纸盒角绕顶点平移一圈回到原点，它会因为空间自身的曲率<strong>凭空偏转 90°</strong>！',
      },
      {
        head: '3. 共棱三胞 W+ → X+ → Y+ → W+',
        body: '正八胞体的每条金色公共棱周围只围着 <code>3</code> 个立方体房间（同样角亏 <code>90°</code>）。携锁死陀螺顺次飞过这三间房回到 <code>W+</code>，指针便精确偏转 <code>+90°</code> 指天！',
      },
    ],
  },
  4: {
    eyebrow: 'A 区 · 回廊科研站 · 3D 原理动画（第 4 关）',
    title: '如何一笔不重复走遍 8 个房间并顺利回到起点 W+？',
    sliderLabel: '拖动滑块演练 8 室哈密顿一笔画闭环（步数 0 → 8）：',
    min: 0,
    max: 8,
    step: 0.05,
    points: [
      {
        head: '1. 致命陷阱：绝不能把对跖室 W− 留到最后',
        body: '因为 <code>W−</code> 与起点 <code>W+</code> 是对跖盲区（没有门直连），若第 8 间才走进 <code>W−</code>，就绝对无法一步闭环回到 <code>W+</code>！',
      },
      {
        head: '2. 破局关键：在中途顺路走掉 W−',
        body: '在第 <code>4</code> 或第 <code>5</code> 步提前借道穿过 <code>W−</code>，之后剩余的 <code>X−、Y−、Z−</code> 全部都是 <code>W+</code> 的直达邻居，最后一步必定轻松闭环！',
      },
      {
        head: '3. 典型哈密顿闭环路线',
        body: '例如 <code>W+ → X+ → Y+ → Z+ → W− → X− → Y− → Z− → W+</code>，8 盏穹顶星环一笔全亮，唤醒中央液态水银裂隙球冲破三维外壳！',
      },
    ],
  },
  14: {
    eyebrow: '几何圣殿 · 四维空间 3D 原理动画（第 14 关）',
    title: '如何让三维的球，像立起的硬币一样穿过四维狭缝？',
    sliderLabel: '拖动滑块观察 3D 旋转过程：',
    min: 0,
    max: 90,
    step: 1,
    points: [
      {
        head: '1. 从二维硬币类比到三维圆球',
        body: '想让平放在纸面上的硬币通过竖直狭缝，只要旋转硬币让它在第三维立起来；同理，现在的球就像平放的硬币，我们要让它在<strong>第四维度 w</strong> 里立起来。',
      },
      {
        head: '2. 为什么转一点点就变扁，却仍撞墙？',
        body: '球转出当前三维空间后，只在<strong>我们所在的三维切面</strong>留下一层圆切面（就像倾斜的硬币在纸面只留一条直径），但球其余部分跨在第四维度 w 轴上，必须转满 <code>90°</code> 完全立直才能穿过狭缝。',
      },
      {
        head: '3. 沿 w 轴看球的不同切面',
        body: '按 <code>Tab</code> 打开第四维度侧视图看清球的真实姿态；当你沿 <code>w</code> 轴前后移动时，看到的其实是球被切成的不同圆面，它们沿 <code>w</code> 轴拼接起来就是完整的三维圆球。',
      },
    ],
  },
});

export class PrincipleGuideController {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.modalEl = document.getElementById('principle-modal');
    this.eyebrowEl = this.modalEl?.querySelector('.modal-eyebrow') || null;
    this.titleEl = document.getElementById('principle-title');
    this.sliderLabelEl = this.modalEl?.querySelector('.principle-slider-row > span:first-child') || null;
    this.pointsEl = this.modalEl?.querySelector('.principle-points') || null;
    this.canvas = document.getElementById('principle-analogy-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.sliderEl = document.getElementById('principle-theta-slider');
    this.angleReadoutEl = document.getElementById('principle-theta-readout');
    this.btnStartEl = document.getElementById('btn-start-sanctuary');
    this.btnCloseEl = document.getElementById('btn-close-principle');

    this.levelId = 14;
    this.visible = false;
    this.autoPlay = true;
    this.animPhase = 0;
    this.orbitPhase = 0;
    this.thetaDeg = 0;
    this.sliderVal = 0;
    this.rafId = null;

    this._bindEvents();
  }

  setLevel(levelId) {
    const resolved = PRINCIPLE_LEVEL_DOCS[levelId] ? levelId : 14;
    this.levelId = resolved;
    const doc = PRINCIPLE_LEVEL_DOCS[resolved];

    if (this.eyebrowEl) this.eyebrowEl.textContent = doc.eyebrow;
    if (this.titleEl) this.titleEl.textContent = doc.title;
    if (this.sliderLabelEl) this.sliderLabelEl.textContent = doc.sliderLabel;
    if (this.sliderEl) {
      this.sliderEl.min = String(doc.min);
      this.sliderEl.max = String(doc.max);
      this.sliderEl.step = String(doc.step);
      this.sliderEl.value = String(doc.min);
    }
    this.sliderVal = doc.min;
    this.thetaDeg = 0;
    this.animPhase = 0;

    if (this.pointsEl) {
      this.pointsEl.innerHTML = doc.points
        .map(
          (pt) => `
          <div class="principle-point">
            <strong>${pt.head}</strong>
            <span>${pt.body}</span>
          </div>`
        )
        .join('');
    }
    if (this.visible) {
      this._renderDiagram();
    }
  }

  _bindEvents() {
    this.sliderEl?.addEventListener('input', (e) => {
      this.autoPlay = false;
      this.sliderVal = parseFloat(e.target.value);
      if (this.levelId === 14) {
        this.thetaDeg = this.sliderVal;
      }
      this._renderDiagram();
    });

    const close = () => this.hide();
    this.btnStartEl?.addEventListener('click', close);
    this.btnCloseEl?.addEventListener('click', close);

    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.hide();
      }
    });
  }

  show() {
    if (!this.modalEl) return;
    this.visible = true;
    this.autoPlay = true;
    this.modalEl.hidden = false;
    this.cb.onVisibilityChange?.(true);
    this._renderDiagram();
    this._startLoop();
  }

  hide() {
    if (!this.modalEl || !this.visible) return;
    this.visible = false;
    this.modalEl.hidden = true;
    this._stopLoop();
    this.cb.onVisibilityChange?.(false);
    this.cb.onDismissed?.();
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  _startLoop() {
    this._stopLoop();
    let prev = performance.now();
    const tick = (now) => {
      if (!this.visible) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      this.orbitPhase += dt * 0.45;
      if (this.autoPlay) {
        const doc = PRINCIPLE_LEVEL_DOCS[this.levelId] || PRINCIPLE_LEVEL_DOCS[14];
        this.animPhase = (this.animPhase + dt * 0.44) % (Math.PI * 2);
        const s = 0.5 - 0.5 * Math.cos(this.animPhase);
        this.sliderVal = doc.min + s * (doc.max - doc.min);
        if (this.levelId === 14) {
          this.thetaDeg = Math.round(s * 900) / 10;
        }
        if (this.sliderEl) this.sliderEl.value = String(this.sliderVal);
      }
      this._renderDiagram();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _renderDiagram() {
    if (!this.canvas || !this.ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(760, Math.round(rect.width));
    const cssH = Math.max(360, Math.round(rect.height));
    if (this.canvas.width !== cssW * dpr || this.canvas.height !== cssH * dpr) {
      this.canvas.width = cssW * dpr;
      this.canvas.height = cssH * dpr;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Rich dark backdrop tailored cleanly to Zone A (sleek aerospace sapphire) or Zone C (warm obsidian)
    const isZoneA = this.levelId !== 14;
    const bgGrad = ctx.createRadialGradient(
      cssW * 0.5,
      cssH * 0.45,
      30,
      cssW * 0.5,
      cssH * 0.5,
      cssW * 0.65
    );
    bgGrad.addColorStop(0, isZoneA ? '#142030' : '#1B1610');
    bgGrad.addColorStop(1, isZoneA ? '#0A1019' : '#0F0C08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    const halfW = cssW * 0.5;
    ctx.strokeStyle = isZoneA ? 'rgba(77, 230, 211, 0.28)' : 'rgba(138, 106, 47, 0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW, 16);
    ctx.lineTo(halfW, cssH - 16);
    ctx.stroke();

    const sway = Math.sin(this.orbitPhase) * 0.14;

    if (this.levelId === 1) {
      this._renderLevel1Diagram(ctx, cssW, cssH, halfW, sway);
      ctx.restore();
      return;
    }
    if (this.levelId === 2) {
      this._renderLevel2Diagram(ctx, cssW, cssH, halfW, sway);
      ctx.restore();
      return;
    }
    if (this.levelId === 3) {
      this._renderLevel3Diagram(ctx, cssW, cssH, halfW, sway);
      ctx.restore();
      return;
    }
    if (this.levelId === 4) {
      this._renderLevel4Diagram(ctx, cssW, cssH, halfW, sway);
      ctx.restore();
      return;
    }

    const thetaRad = degToRad(this.thetaDeg);
    const eps = 0.001;
    const xMax = Math.sqrt(Math.cos(thetaRad) ** 2 + eps * eps * Math.sin(thetaRad) ** 2);
    const wMax = Math.sqrt(Math.sin(thetaRad) ** 2 + eps * eps * Math.cos(thetaRad) ** 2);
    const sliceSemiX = Math.min(1.0, eps / Math.max(eps, wMax));
    const canPass = xMax <= 0.082;

    if (this.angleReadoutEl) {
      this.angleReadoutEl.textContent = `当前旋转角 θ = ${this.thetaDeg.toFixed(0)}° · 切面厚度 ${sliceSemiX.toFixed(3)}m · 四维总半宽 ${xMax.toFixed(3)}m ${
        canPass ? '✓ 已立直，可穿过狭缝' : '✗ 仍宽于狭缝'
      }`;
      this.angleReadoutEl.style.color = canPass ? PALETTE.accent.emerald : PALETTE.accent.goldWPos;
    }

    this._drawLeftCoin3D(ctx, {
      x0: 0,
      width: halfW,
      height: cssH,
      thetaRad,
      canPass,
      yaw: -0.46 + sway * 0.6,
      pitch: 0.44,
    });

    this._drawRightSphere4D3D(ctx, {
      x0: halfW,
      width: halfW,
      height: cssH,
      thetaRad,
      xMax,
      sliceSemiX,
      canPass,
      yaw: -0.52 + sway,
      pitch: 0.40,
    });

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Level 1 Interactive 3D Principle Diagram: 1D Ring Loop -> 4-Cell Corridor
  // -------------------------------------------------------------------------
  _renderLevel1Diagram(ctx, cssW, cssH, halfW, sway) {
    const roomFloat = Math.max(1, Math.min(9, this.sliderVal || 1));
    const roomNum = Math.round(roomFloat);
    const phaseIdx = (roomNum - 1) % 4;
    const cellNames = ['W+', 'X+', 'W−', 'X−'];
    const dirNames = ['面向走廊内侧 →', '面向前方 ↑', '面向外侧 ←', '面向后方 ↓'];
    const isOrigin = phaseIdx === 0;

    if (this.angleReadoutEl) {
      this.angleReadoutEl.textContent = `第 ${roomNum} 间房 · 对应舱室 ${cellNames[phaseIdx]} · 雕像累积旋转 ${(roomNum - 1) * 90}° (${dirNames[phaseIdx]}) ${
        roomNum === 9 ? '✓ 第 9 间 = 第 1 间！' : ''
      }`;
      this.angleReadoutEl.style.color = isOrigin ? PALETTE.accent.emerald : PALETTE.accent.cyanW0;
    }

    // LEFT: 1D closed ring light loop
    const cxL = halfW * 0.5;
    const cyL = cssH * 0.54;
    const projectL = makeProjector3D(cxL, cyL, Math.min(halfW * 0.27, cssH * 0.30), -0.35 + sway, 0.58, 6.2);

    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    ctx.fillText('① 降维类比：闭合圆环上的光线与同侧背影', cxL, 28);

    const ringPts = [];
    for (let i = 0; i < 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      ringPts.push([Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0]);
    }
    drawPolygon3D(ctx, ringPts, projectL, 'rgba(77, 230, 211, 0.06)', PALETTE.accent.cyanW0, 2.2);

    const walkerAng = ((roomFloat - 1) / 4) * Math.PI * 2 - Math.PI * 0.5;
    const wp = projectL(Math.cos(walkerAng) * 1.45, Math.sin(walkerAng) * 1.45, 0.08);
    // Light ray hugging the ring back to walker's eyes
    ctx.strokeStyle = 'rgba(247, 195, 70, 0.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let k = 0; k <= 36; k += 1) {
      const a = walkerAng + (k / 36) * Math.PI * 2;
      const p = projectL(Math.cos(a) * 1.56, Math.sin(a) * 1.56, 0.22);
      if (k === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.beginPath();
    ctx.arc(wp.sx, wp.sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('你（举左手）', wp.sx, wp.sy - 14);
    ctx.fillStyle = 'rgba(247, 195, 70, 0.9)';
    ctx.fillText('光线绕环一圈 → 看见自己的同侧背影', cxL, cssH - 16);

    // RIGHT: 3D 4-Cell Closed Corridor Ring + Live 90° Statue Rotation
    const cxR = halfW + halfW * 0.5;
    const cyR = cssH * 0.54;
    const projectR = makeProjector3D(cxR, cyR, Math.min(halfW * 0.26, cssH * 0.29), -0.45 + sway, 0.52, 6.4);

    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.fillText('② 本关 3D 原理动画：4 间回廊闭环与雕像 90° 周期', cxR, 28);

    const cellCoords = [
      { id: 'W+', pos: [0, -1.25, 0], color: '#4DE6D3' },
      { id: 'X+', pos: [1.25, 0, 0], color: '#F7C346' },
      { id: 'W−', pos: [0, 1.25, 0], color: '#A78BFA' },
      { id: 'X−', pos: [-1.25, 0, 0], color: '#FF9F68' },
    ];

    cellCoords.forEach((c, idx) => {
      const active = idx === phaseIdx;
      const [x, y, z] = c.pos;
      const h = active ? 0.44 : 0.34;
      drawBox3D(ctx, x - h, x + h, y - h, y + h, z - h * 0.6, z + h * 0.6, projectR, {
        top: active ? 'rgba(77, 230, 211, 0.48)' : 'rgba(130, 155, 185, 0.16)',
        front: active ? 'rgba(77, 230, 211, 0.34)' : 'rgba(100, 125, 155, 0.12)',
        side: 'rgba(60, 80, 108, 0.14)',
        inner: 'rgba(60, 80, 108, 0.14)',
        stroke: active ? PALETTE.accent.emerald : c.color,
      });
      const lp = projectR(x, y, 0.62);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = active ? PALETTE.accent.emerald : c.color;
      ctx.fillText(`${c.id} (#${idx + 1}/#${idx + 5})`, lp.sx, lp.sy);
    });

    // Live rotating bronze statue directional arrow in center
    const arrowAngle = ((roomFloat - 1) * Math.PI) / 2;
    const p0 = projectR(0, 0, 0.1);
    const p1 = projectR(Math.cos(arrowAngle) * 0.65, Math.sin(arrowAngle) * 0.65, 0.1);
    ctx.strokeStyle = PALETTE.accent.goldWPos;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p0.sx, p0.sy);
    ctx.lineTo(p1.sx, p1.sy);
    ctx.stroke();
    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.beginPath();
    ctx.arc(p1.sx, p1.sy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = isOrigin ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText(
      roomNum === 9 ? '第 9 间 = 4×2 + 1，已精确回到红丝带起点 W+！' : `每跨 1 间房顺时针转 90° · 当前对应 ${cellNames[phaseIdx]}`,
      cxR,
      cssH - 16
    );
  }

  // -------------------------------------------------------------------------
  // Level 2 Interactive 3D Principle Diagram: 2D Square -> 8-Cell 6-Path Net
  // -------------------------------------------------------------------------
  _renderLevel2Diagram(ctx, cssW, cssH, halfW, sway) {
    const stepVal = Math.max(0, Math.min(2, this.sliderVal || 0));
    if (this.angleReadoutEl) {
      this.angleReadoutEl.textContent =
        stepVal < 0.5
          ? '第 0 步：身处 W+，四周有 6 扇门（没有 W−）'
          : stepVal < 1.5
            ? '第 1 步：跨入任意 1 个邻居（X±/Y±/Z±），立刻看见 W− 舱门！'
            : '第 2 步：6 个邻居全部一步直通 W− → 共 6 条两步路径！';
      this.angleReadoutEl.style.color = stepVal >= 1.5 ? PALETTE.accent.emerald : PALETTE.accent.goldWPos;
    }

    // LEFT: 2D Square analogy
    const cxL = halfW * 0.5;
    const cyL = cssH * 0.54;
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    ctx.fillText('① 降维类比：二维正方形的 4 条边（对面需 2 步）', cxL, 28);

    const sqNodes = [
      { label: '起边', x: cxL, y: cyL + 84, col: PALETTE.accent.cyanW0, active: true },
      { label: '左邻', x: cxL - 92, y: cyL, col: PALETTE.accent.goldWPos, active: stepVal >= 0.6 },
      { label: '右邻', x: cxL + 92, y: cyL, col: PALETTE.accent.goldWPos, active: stepVal >= 0.6 },
      { label: '对面边', x: cxL, y: cyL - 84, col: '#A78BFA', active: stepVal >= 1.5 },
    ];
    const sqPairs = [[0, 1], [0, 2], [1, 3], [2, 3]];
    sqPairs.forEach(([a, b], idx) => {
      const lit = idx < 2 ? stepVal >= 0.4 : stepVal >= 1.4;
      ctx.strokeStyle = lit ? PALETTE.accent.emerald : 'rgba(180, 198, 220, 0.25)';
      ctx.lineWidth = lit ? 3.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(sqNodes[a].x, sqNodes[a].y);
      ctx.lineTo(sqNodes[b].x, sqNodes[b].y);
      ctx.stroke();
    });
    // Dashed forbidden direct diagonal
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.55)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(sqNodes[0].x, sqNodes[0].y);
    ctx.lineTo(sqNodes[3].x, sqNodes[3].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '600 11px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('无直达门', cxL + 34, cyL + 4);

    for (const n of sqNodes) {
      ctx.fillStyle = n.active ? n.col : '#253244';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0A1019';
      ctx.font = '700 11px "Inter", "PingFang SC", sans-serif';
      ctx.fillText(n.label, n.x, n.y + 4);
    }
    ctx.fillStyle = 'rgba(232, 240, 250, 0.8)';
    ctx.font = '500 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('2 个邻居 → 2 条两步路径', cxL, cssH - 16);

    // RIGHT: 3D 8-cell Tesseract neighbor star (W+ -> 6 neighbors -> W-)
    const cxR = halfW + halfW * 0.5;
    const cyR = cssH * 0.54;
    const projectR = makeProjector3D(cxR, cyR, Math.min(halfW * 0.24, cssH * 0.27), this.orbitPhase * 0.55 + sway, 0.32, 6.2);
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.fillText('② 本关 3D 原理动画：W+ 的 6 扇门汇聚对跖室 W−', cxR, 28);

    const pWPlus = projectR(0, 0, -1.35);
    const pWMinus = projectR(0, 0, 1.35);
    const nbrs = [
      { id: 'X+', p: [1.35, 0, 0], c: '#F7C346' },
      { id: 'X−', p: [-1.35, 0, 0], c: '#FF9F68' },
      { id: 'Y+', p: [0.68, 1.15, 0], c: '#69F0AE' },
      { id: 'Y−', p: [-0.68, -1.15, 0], c: '#58A6FF' },
      { id: 'Z+', p: [-0.68, 1.15, 0], c: '#7EE8FA' },
      { id: 'Z−', p: [0.68, -1.15, 0], c: '#F472B6' },
    ];

    for (const nb of nbrs) {
      const pn = projectR(nb.p[0], nb.p[1], nb.p[2]);
      // Step 1 edge (W+ -> neighbor)
      ctx.strokeStyle = stepVal >= 0.4 ? nb.c : 'rgba(180,198,220,0.22)';
      ctx.lineWidth = stepVal >= 0.4 ? 2.4 : 1.1;
      ctx.beginPath();
      ctx.moveTo(pWPlus.sx, pWPlus.sy);
      ctx.lineTo(pn.sx, pn.sy);
      ctx.stroke();

      // Step 2 edge (neighbor -> W-)
      ctx.strokeStyle = stepVal >= 1.4 ? PALETTE.accent.emerald : 'rgba(180,198,220,0.18)';
      ctx.lineWidth = stepVal >= 1.4 ? 2.6 : 1.0;
      ctx.beginPath();
      ctx.moveTo(pn.sx, pn.sy);
      ctx.lineTo(pWMinus.sx, pWMinus.sy);
      ctx.stroke();

      ctx.fillStyle = stepVal >= 0.6 ? nb.c : '#28364A';
      ctx.beginPath();
      ctx.arc(pn.sx, pn.sy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0A1019';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(nb.id, pn.sx, pn.sy + 3.5);
    }

    for (const [pt, lbl, col] of [
      [pWPlus, 'W+', PALETTE.accent.cyanW0],
      [pWMinus, 'W−', stepVal >= 1.5 ? PALETTE.accent.emerald : '#A78BFA'],
    ]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0A1019';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(lbl, pt.sx, pt.sy + 4);
    }

    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = stepVal >= 1.5 ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText('6 个面邻接邻居各自直通 W− → 共 6 条两步最短路径', cxR, cssH - 16);
  }

  // -------------------------------------------------------------------------
  // Level 3 Interactive 3D Principle Diagram: 270° Cone Deficit -> +90° Holonomy
  // -------------------------------------------------------------------------
  _renderLevel3Diagram(ctx, cssW, cssH, halfW, sway) {
    const pct = Math.max(0, Math.min(100, this.sliderVal || 0));
    const t = pct / 100;
    const rotDeg = Math.round(t * 90);
    if (this.angleReadoutEl) {
      this.angleReadoutEl.textContent = `绕共棱三胞进度 ${Math.round(pct)}% · 陀螺累积和乐偏转 +${rotDeg}° ${
        rotDeg >= 88 ? '✓ 已精准对准 +90° 指天！' : '（沿 W+ → X+ → Y+ → W+ 平行移动）'
      }`;
      this.angleReadoutEl.style.color = rotDeg >= 88 ? PALETTE.accent.emerald : PALETTE.accent.goldWPos;
    }

    // LEFT: 2D Paper Cone (3 right-angle squares = 270°, missing 90° wedge)
    const cxL = halfW * 0.5;
    const cyL = cssH * 0.55;
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    ctx.fillText('① 降维类比：3 张正方形围一圈 = 270°（缺 90° 角亏）', cxL, 28);

    const r = 92;
    const quads = [
      { a0: 0, a1: Math.PI * 0.5, label: 'W+', fill: 'rgba(77, 230, 211, 0.22)', stroke: '#4DE6D3' },
      { a0: Math.PI * 0.5, a1: Math.PI, label: 'X+', fill: 'rgba(247, 195, 70, 0.22)', stroke: '#F7C346' },
      { a0: Math.PI, a1: Math.PI * 1.5, label: 'Y+', fill: 'rgba(105, 240, 174, 0.22)', stroke: '#69F0AE' },
    ];
    for (const q of quads) {
      ctx.beginPath();
      ctx.moveTo(cxL, cyL);
      ctx.arc(cxL, cyL, r, q.a0, q.a1);
      ctx.closePath();
      ctx.fillStyle = q.fill;
      ctx.fill();
      ctx.strokeStyle = q.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      const mid = (q.a0 + q.a1) * 0.5;
      ctx.fillStyle = q.stroke;
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillText(q.label, cxL + Math.cos(mid) * 56, cyL + Math.sin(mid) * 56 + 4);
    }
    // Missing 90° angular deficit wedge
    ctx.beginPath();
    ctx.moveTo(cxL, cyL);
    ctx.arc(cxL, cyL, r, Math.PI * 1.5, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 107, 107, 0.14)';
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#FF6B6B';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '700 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('缺口 90°', cxL + 46, cyL - 36);

    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.beginPath();
    ctx.arc(cxL, cyL, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 240, 250, 0.85)';
    ctx.font = '500 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('粘合缺口成圆锥 → 绕顶点一圈指针必转 90°', cxL, cssH - 16);

    // RIGHT: 3D Shared Golden 1D Edge + Live Gyro Needle Rotation
    const cxR = halfW + halfW * 0.5;
    const cyR = cssH * 0.54;
    const projectR = makeProjector3D(cxR, cyR, Math.min(halfW * 0.27, cssH * 0.30), -0.45 + sway, 0.44, 6.2);

    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.fillText('② 本关 3D 原理动画：绕金色共享棱飞 3 间房 → +90°', cxR, 28);

    // Shared Golden 1D Edge along vertical Z
    const eBot = projectR(0, 0, -1.25);
    const eTop = projectR(0, 0, 1.25);
    ctx.strokeStyle = PALETTE.accent.goldWPos;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(eBot.sx, eBot.sy);
    ctx.lineTo(eTop.sx, eTop.sy);
    ctx.stroke();

    // 3 rooms orbiting the golden edge (120° apart in visual projection)
    const loopPts = [];
    for (let i = 0; i <= 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      loopPts.push([Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0]);
    }
    drawPolygon3D(ctx, loopPts, projectR, null, 'rgba(77, 230, 211, 0.45)', 2);

    const curAng = t * Math.PI * 2;
    const gx = Math.cos(curAng) * 1.15;
    const gy = Math.sin(curAng) * 1.15;
    const gp = projectR(gx, gy, 0);

    // Gyro needle vector tilting smoothly from horizontal (0°) to skyward (+90°) as t goes 0 -> 1!
    const needlePitch = t * (Math.PI * 0.5);
    const nTip = projectR(gx + Math.cos(needlePitch) * 0.55, gy, Math.sin(needlePitch) * 0.72);
    ctx.strokeStyle = rotDeg >= 88 ? PALETTE.accent.emerald : PALETTE.accent.cyanW0;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gp.sx, gp.sy);
    ctx.lineTo(nTip.sx, nTip.sy);
    ctx.stroke();
    ctx.fillStyle = rotDeg >= 88 ? PALETTE.accent.emerald : PALETTE.accent.cyanW0;
    ctx.beginPath();
    ctx.arc(nTip.sx, nTip.sy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.font = '700 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('金色共享棱', eTop.sx + 48, eTop.sy + 6);

    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = rotDeg >= 88 ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText(`W+ → X+ → Y+ → W+ 闭环完成时指针刚性偏转 +${rotDeg}°`, cxR, cssH - 16);
  }

  // -------------------------------------------------------------------------
  // Level 4 Interactive 3D Principle Diagram: Antipode Trap vs 8-Cell Hamiltonian
  // -------------------------------------------------------------------------
  _renderLevel4Diagram(ctx, cssW, cssH, halfW, sway) {
    const stepF = Math.max(0, Math.min(8, this.sliderVal || 0));
    const stepIdx = Math.floor(stepF);
    const cycle = ['W+', 'X+', 'Y+', 'Z+', 'W−', 'X−', 'Y−', 'Z−', 'W+'];
    if (this.angleReadoutEl) {
      this.angleReadoutEl.textContent = `哈密顿一笔画：第 ${stepIdx}/8 步 · 当前 ${cycle[stepIdx]} ${
        stepIdx === 8 ? '✓ 8 室全亮并闭环回到 W+，裂隙球苏醒！' : stepIdx === 4 ? '★ 中途提前穿过对跖室 W−！' : ''
      }`;
      this.angleReadoutEl.style.color = stepIdx === 8 ? PALETTE.accent.emerald : PALETTE.accent.cyanW0;
    }

    // LEFT: Antipode Trap Warning
    const cxL = halfW * 0.5;
    const cyL = cssH * 0.54;
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = '#FF8A8A';
    ctx.textAlign = 'center';
    ctx.fillText('① 常见死局：把对跖室 W− 留到第 8 间', cxL, 28);

    ctx.fillStyle = 'rgba(255, 107, 107, 0.12)';
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cxL, cyL, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#A78BFA';
    ctx.beginPath();
    ctx.arc(cxL - 60, cyL, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.accent.cyanW0;
    ctx.beginPath();
    ctx.arc(cxL + 60, cyL, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0A1019';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('W−', cxL - 60, cyL + 4);
    ctx.fillText('W+', cxL + 60, cyL + 4);

    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cxL - 36, cyL);
    ctx.lineTo(cxL + 36, cyL);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '700 15px sans-serif';
    ctx.fillText('✗ 无法一步回 W+', cxL, cyL - 32);
    ctx.fillStyle = 'rgba(232, 240, 250, 0.85)';
    ctx.font = '500 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillText('策略：第 4 或第 5 步中途先把 W− 走掉！', cxL, cssH - 16);

    // RIGHT: 3D Rotating 8-Cell Hamiltonian Cycle Animation
    const cxR = halfW + halfW * 0.5;
    const cyR = cssH * 0.54;
    const projectR = makeProjector3D(cxR, cyR, Math.min(halfW * 0.25, cssH * 0.28), this.orbitPhase * 0.5 + sway, 0.34, 6.2);

    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.fillText('② 本关 3D 原理动画：8 胞哈密顿一笔画回路', cxR, 28);

    const coords3D = {
      'W+': [0, 0, -1.25],
      'X+': [1.25, -0.4, -0.4],
      'Y+': [0.5, 1.15, -0.2],
      'Z+': [-0.95, 0.85, 0.3],
      'W−': [0, 0, 1.25],
      'X−': [-1.25, -0.4, 0.4],
      'Y−': [-0.5, -1.15, 0.1],
      'Z−': [0.95, -0.85, -0.3],
    };

    const proj = {};
    for (const [k, v] of Object.entries(coords3D)) {
      proj[k] = projectR(v[0], v[1], v[2]);
    }

    // Draw Hamiltonian trail edges up to stepIdx
    for (let i = 0; i < 8; i += 1) {
      const a = proj[cycle[i]];
      const b = proj[cycle[i + 1]];
      const lit = i < stepIdx;
      ctx.strokeStyle = lit ? (stepIdx === 8 ? PALETTE.accent.emerald : PALETTE.accent.goldWPos) : 'rgba(180,198,220,0.18)';
      ctx.lineWidth = lit ? 3.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }

    for (let i = 0; i < 8; i += 1) {
      const id = cycle[i];
      const p = proj[id];
      const lit = i <= stepIdx;
      ctx.fillStyle = lit ? (id === 'W−' ? '#A78BFA' : stepIdx === 8 ? PALETTE.accent.emerald : PALETTE.accent.cyanW0) : '#263448';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, lit ? 14 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lit ? '#0A1019' : 'rgba(232,240,250,0.6)';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillText(id, p.sx, p.sy + 3.5);
    }

    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = stepIdx === 8 ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText('W+ → X+ → Y+ → Z+ → W− → X− → Y− → Z− → W+', cxR, cssH - 16);
  }

  _drawLeftCoin3D(ctx, cfg) {
    const cx = cfg.x0 + cfg.width * 0.5;
    const cy = cfg.height * 0.55;
    const scale = Math.min(cfg.width * 0.25, cfg.height * 0.30);
    const project = makeProjector3D(cx, cy, scale, cfg.yaw, cfg.pitch, 6.2);

    // Panel Header
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    ctx.fillText('① 降维类比：二维纸面硬币 → 在第三维立起来', cx, 28);

    // 1. 2D Paper Plane (horizontal translucent cyan-ivory sheet at z = 0)
    const planeR = 1.68;
    drawPolygon3D(
      ctx,
      [
        [-planeR, -1.28, 0],
        [planeR, -1.28, 0],
        [planeR, 1.28, 0],
        [-planeR, 1.28, 0],
      ],
      project,
      'rgba(77, 230, 211, 0.11)',
      'rgba(77, 230, 211, 0.62)',
      1.5
    );

    // Paper subtle grid lines
    ctx.strokeStyle = 'rgba(77, 230, 211, 0.16)';
    ctx.lineWidth = 1;
    for (const g of [-1.0, -0.5, 0.5, 1.0]) {
      const a = project(g, -1.28, 0);
      const b = project(g, 1.28, 0);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();

      const c = project(-planeR, g, 0);
      const d = project(planeR, g, 0);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.stroke();
    }

    // 2. Vertical 3D Slit Walls rising across the paper (leaving a narrow central slit!)
    const slitGap = 0.17;
    const wallColors = {
      front: cfg.canPass ? 'rgba(105, 240, 174, 0.14)' : 'rgba(138, 106, 47, 0.22)',
      top: cfg.canPass ? 'rgba(105, 240, 174, 0.22)' : 'rgba(196, 152, 68, 0.28)',
      side: 'rgba(84, 64, 28, 0.16)',
      inner: cfg.canPass ? 'rgba(105, 240, 174, 0.34)' : 'rgba(255, 246, 214, 0.24)',
      stroke: cfg.canPass ? 'rgba(105, 240, 174, 0.65)' : 'rgba(218, 178, 96, 0.5)',
    };
    drawBox3D(ctx, -1.55, -slitGap, 0.36, 0.62, -0.95, 1.15, project, wallColors);
    drawBox3D(ctx, slitGap, 1.55, 0.36, 0.62, -0.95, 1.15, project, wallColors);

    // 3. Golden Arrowed Number Line for 3rd dimension (height)
    drawArrowedNumberLine3D(ctx, project, '第三维高度', -1.28, 1.42);

    // 4. 3D Tilted Golden Coin (radius R = 0.94 rotated around Y axis by thetaRad)
    const R = 0.94;
    const cosT = Math.cos(cfg.thetaRad);
    const sinT = Math.sin(cfg.thetaRad);
    const coinPts = [];
    const segs = 48;
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const lx = R * Math.cos(a);
      const ly = R * Math.sin(a);
      // Rotate around Y: x' = lx * cosT, z' = lx * sinT
      coinPts.push([lx * cosT, ly, lx * sinT]);
    }

    // Coin subtle thickness rim
    const rimPts = coinPts.map(([x, y, z]) => [x + sinT * 0.045, y, z - cosT * 0.045]);
    drawPolygon3D(
      ctx,
      rimPts,
      project,
      cfg.canPass ? 'rgba(64, 185, 130, 0.45)' : 'rgba(166, 122, 36, 0.62)',
      null
    );

    // Main gleaming coin face
    const coinFill = cfg.canPass
      ? 'rgba(105, 240, 174, 0.36)'
      : 'rgba(247, 195, 70, 0.36)';
    const coinStroke = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.goldWPos;
    drawPolygon3D(ctx, coinPts, project, coinFill, coinStroke, 2.2);

    // Coin inner decorative emboss ring
    const innerCoinPts = [];
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const lx = R * 0.72 * Math.cos(a);
      const ly = R * 0.72 * Math.sin(a);
      innerCoinPts.push([lx * cosT, ly, lx * sinT]);
    }
    drawPolygon3D(ctx, innerCoinPts, project, null, 'rgba(255, 246, 214, 0.5)', 1.1);

    // 5. Highlight Intersection Line on the 2D Paper Plane (z = 0)!
    // When theta > 2°, the tilted coin intersects the paper along a single glowing diameter line (x=0, y in [-R, R])!
    if (this.thetaDeg >= 2) {
      const iA = project(0, -R, 0);
      const iB = project(0, R, 0);
      ctx.strokeStyle = PALETTE.accent.cyanW0;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(iA.sx, iA.sy);
      ctx.lineTo(iB.sx, iB.sy);
      ctx.stroke();
    }

    // Matching △ and ○ diameter endpoint markers on the 3D coin
    const cTri = project(-R * cosT, 0, -R * sinT);
    const cCirc = project(R * cosT, 0, R * sinT);
    ctx.font = '700 13px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : '#FFB84D';
    ctx.fillText('△', cTri.sx, cTri.sy + 4);
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText('○', cCirc.sx, cCirc.sy + 4);

    // Plane label
    const pPlaneTag = project(1.58, -1.18, 0);
    ctx.font = '600 12px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.cyanW0;
    ctx.textAlign = 'right';
    ctx.fillText('二维纸面', pPlaneTag.sx, pPlaneTag.sy + 14);

    // Bottom caption
    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    const caption =
      this.thetaDeg < 2
        ? '平放时：硬币完整落在二维纸面内，太宽过不去'
        : cfg.canPass
          ? '旋转 90° 立直：硬币竖直穿过竖直狭缝！'
          : '刚转几度：纸面只剩一条直径，但翘起的硬币仍撞墙';
    ctx.fillText(caption, cx, cfg.height - 14);
  }

  _drawRightSphere4D3D(ctx, cfg) {
    const cx = cfg.x0 + cfg.width * 0.5;
    const cy = cfg.height * 0.55;
    const scale = Math.min(cfg.width * 0.25, cfg.height * 0.30);
    const project = makeProjector3D(cx, cy, scale, cfg.yaw, cfg.pitch, 6.2);

    // Panel Header
    ctx.font = '700 14px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    ctx.fillText('② 本关 3D 原理动画：圆球沿第四维度 w 立起来', cx, 28);

    // 1. Translucent Glowing 3D Slab representing "我们所在的三维切面" (at w = 0)
    const planeR = 1.68;
    const slabThickness = 0.055;
    drawBox3D(ctx, -planeR, planeR, -1.26, 1.26, -slabThickness, slabThickness, project, {
      front: 'rgba(77, 230, 211, 0.22)',
      top: 'rgba(77, 230, 211, 0.13)',
      side: 'rgba(77, 230, 211, 0.10)',
      inner: 'rgba(77, 230, 211, 0.18)',
      stroke: 'rgba(77, 230, 211, 0.68)',
    });

    // Subtle spatial lattice on our 3D slice slab
    ctx.strokeStyle = 'rgba(77, 230, 211, 0.18)';
    ctx.lineWidth = 1;
    for (const g of [-1.0, -0.5, 0.5, 1.0]) {
      const a = project(g, -1.26, slabThickness);
      const b = project(g, 1.26, slabThickness);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();

      const c = project(-planeR, g, slabThickness);
      const d = project(planeR, g, slabThickness);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.stroke();
    }

    // 2. 3D Four-Dimensional Monolith Walls spanning vertically along the ENTIRE w number line!
    const slitGap = 0.17;
    const wallColors = {
      front: cfg.canPass ? 'rgba(105, 240, 174, 0.15)' : 'rgba(138, 106, 47, 0.24)',
      top: cfg.canPass ? 'rgba(105, 240, 174, 0.24)' : 'rgba(196, 152, 68, 0.30)',
      side: 'rgba(84, 64, 28, 0.18)',
      inner: cfg.canPass ? 'rgba(105, 240, 174, 0.38)' : 'rgba(255, 246, 214, 0.26)',
      stroke: cfg.canPass ? 'rgba(105, 240, 174, 0.72)' : 'rgba(225, 185, 105, 0.55)',
    };
    drawBox3D(ctx, -1.58, -slitGap, 0.42, 0.68, -1.12, 1.22, project, wallColors);
    drawBox3D(ctx, slitGap, 1.58, 0.42, 0.68, -1.12, 1.22, project, wallColors);

    // 3. Bold Golden Arrowed Number Line representing "第四维度 w"
    drawArrowedNumberLine3D(ctx, project, '第四维度 w', -1.24, 1.32);

    // 4. True 3D Shaded Sphere rotating rigidly from our 3D slice into Fourth Dimension w!
    // Visualized in (X, Y_3d, W_vertical):
    // Local sphere has radius R along (X_local, Y_local) and subtle thickness along W_local,
    // rotating rigidly around Y by thetaRad into the W axis — NEVER squashed!
    const R = 0.96;
    const cosT = Math.cos(cfg.thetaRad);
    const sinT = Math.sin(cfg.thetaRad);
    // Gentle pass-through glide along +Y toward the slit when standing cleanly vertical at 90°!
    const glideY = cfg.canPass ? Math.sin(this.orbitPhase * 1.9) * 0.24 + 0.16 : 0;

    // 4a. Draw 3D Volumetric Shaded Sphere / Oblate Body (meridian & latitude ribs + glowing radial body)
    // Compute 3D points of latitude rings of the rotated 3D sphere in (X, Y, W)
    const bodyColor = cfg.canPass ? '105, 240, 174' : '247, 195, 70';
    const coreColor = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.goldWPos;

    // Outer silhouette ellipse of the rotated 3D sphere projected into screen space
    const center2D = project(0, glideY, 0);
    const outerLoop = [];
    const segs = 56;
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const lx = R * Math.cos(a);
      const ly = R * Math.sin(a);
      outerLoop.push([lx * cosT, ly + glideY, lx * sinT]);
    }

    // Soft 3D spherical volume glow centered at sphere origin
    const rxProj = Math.max(26, R * scale * (0.28 + 0.72 * Math.abs(cosT)));
    const ryProj = Math.max(26, R * scale * (0.48 + 0.52 * Math.abs(sinT)));
    const radGlow = ctx.createRadialGradient(
      center2D.sx - rxProj * 0.22,
      center2D.sy - ryProj * 0.22,
      4,
      center2D.sx,
      center2D.sy,
      Math.max(rxProj, ryProj) * 1.05
    );
    radGlow.addColorStop(0, `rgba(255, 250, 232, 0.55)`);
    radGlow.addColorStop(0.45, `rgba(${bodyColor}, 0.28)`);
    radGlow.addColorStop(1, `rgba(${bodyColor}, 0.04)`);

    // Draw 3D wireframe latitude/longitude shells that genuinely look like a 3D sphere turning into W!
    // We embed a true 3D sphere (radius R in X_local, Y_local, and visual 3D thickness factor 0.42 in Z_local
    // that tapers smoothly as it turns into W, while preserving full circular R in all cross-sections!).
    const visualThick = 0.52 * Math.cos(cfg.thetaRad) ** 2 + 0.14 * Math.sin(cfg.thetaRad) ** 2;

    // Stacked circular cross-section slices along the sphere's tilted axis — visually illustrates
    // "球被切成了不同的圆被分散放在了 w 轴上"!
    const sliceLevels = [-0.78, -0.45, 0, 0.45, 0.78];
    sliceLevels.forEach((u) => {
      const sliceR = R * Math.sqrt(Math.max(0.02, 1 - u * u));
      const pts = [];
      for (let i = 0; i < 40; i += 1) {
        const a = (i / 40) * Math.PI * 2;
        const lx = u * R;
        const ly = sliceR * Math.cos(a);
        const lz = sliceR * visualThick * Math.sin(a);
        // Rotate (lx, lz) into (X, W) by thetaRad!
        const wx = lx * cosT - lz * sinT;
        const ww = lx * sinT + lz * cosT;
        pts.push([wx, ly + glideY, ww]);
      }
      const isCenterSlice = u === 0;
      drawPolygon3D(
        ctx,
        pts,
        project,
        isCenterSlice ? `rgba(77, 230, 211, 0.22)` : `rgba(${bodyColor}, 0.11)`,
        isCenterSlice ? PALETTE.accent.cyanW0 : `rgba(${bodyColor}, 0.58)`,
        isCenterSlice ? 2.4 : 1.2
      );
    });

    // Equatorial + Meridian 3D rings for unmistakable spherical volume
    for (const phi of [0, Math.PI * 0.5]) {
      const mPts = [];
      for (let i = 0; i < 48; i += 1) {
        const a = (i / 48) * Math.PI * 2;
        const lx = R * Math.cos(a);
        const ly = R * Math.sin(a) * Math.cos(phi);
        const lz = R * visualThick * Math.sin(a) * Math.sin(phi);
        const wx = lx * cosT - lz * sinT;
        const ww = lx * sinT + lz * cosT;
        mPts.push([wx, ly + glideY, ww]);
      }
      drawPolygon3D(ctx, mPts, project, phi === 0 ? radGlow : null, coreColor, phi === 0 ? 2.2 : 1.4);
    }

    // 4b. Highlight the bright Cyan Cross-Section sitting RIGHT inside "我们所在的三维切面" (w = 0)!
    const slicePts = [];
    const sliceXHalf = Math.max(0.04, cfg.sliceSemiX * R);
    for (let i = 0; i < 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      slicePts.push([sliceXHalf * Math.cos(a), R * Math.sin(a) + glideY, slabThickness + 0.01]);
    }
    drawPolygon3D(
      ctx,
      slicePts,
      project,
      'rgba(77, 230, 211, 0.42)',
      PALETTE.accent.cyanW0,
      2.6
    );

    // 4c. Outer 4D X-extent indicator ticks showing collision vs clear slit
    const xSpan = cfg.xMax * R;
    ctx.strokeStyle = cfg.canPass ? PALETTE.accent.emerald : 'rgba(255, 107, 107, 0.78)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    for (const s of [-1, 1]) {
      const dTop = project(s * xSpan, glideY, 1.05);
      const dBot = project(s * xSpan, glideY, -1.05);
      ctx.beginPath();
      ctx.moveTo(dTop.sx, dTop.sy);
      ctx.lineTo(dBot.sx, dBot.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Matching △ and ○ diameter endpoint markers on the 3D sphere
    const sTri = project(-R * cosT, glideY, -R * sinT);
    const sCirc = project(R * cosT, glideY, R * sinT);
    ctx.font = '700 13px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : '#FFB84D';
    ctx.fillText('△', sTri.sx, sTri.sy + 4);
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.fillText('○', sCirc.sx, sCirc.sy + 4);

    // 5. Crisp Slab Label: "我们所在的三维切面" (NEVER "W=0 切片"!)
    const pSlabLabel = project(1.66, -1.24, 0.06);
    ctx.font = '700 13px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.cyanW0;
    ctx.textAlign = 'right';
    ctx.fillText('我们所在的三维切面', pSlabLabel.sx + 28, pSlabLabel.sy + 14);

    // Bottom intuitive caption
    ctx.font = '500 12.5px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = cfg.canPass ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.textAlign = 'center';
    const caption =
      this.thetaDeg < 2
        ? '未旋转时：圆球完整平放在我们所在的三维切面中'
        : cfg.canPass
          ? '旋转 90° 立入第四维度 w：球体完整未压扁，轻松滑过狭缝！'
          : `倾斜中：切面只剩薄圆，但球本体跨度仍有 ${cfg.xMax.toFixed(2)}m 会撞墙`;
    ctx.fillText(caption, cx, cfg.height - 14);
  }
}
