/**
 * Beyond 3D — Collapsible (F key) Right-Side Hyper-Holographic Console + Vertical W Phase Ruler
 *
 * Implements 03-interaction-and-ui.md §3.5:
 * - Always-visible slim vertical W-axis tri-color phase ruler (+1.8 Gold / 0.0 Cyan / -1.8 Blue)
 *   with continuous cursor tracking player's W coordinate.
 * - Collapsible 3-slice side-by-side holographic viewport (W = -1.8, 0.0, +1.8) showing:
 *   * All-W obsidian monolith walls present solidly in ALL three slices
 *   * Synchronized voxel astronaut (08) moving in (X, Z) and shifting across W slices
 *   * Exact analytical cross-section of the Passing Orb in each W slice!
 */

import { clamp } from '../core/math4d.js';
import { LEVEL14_CONFIG, computeOblateSpheroidSliceAtW } from '../core/sanctuary-4d.js';
import { PALETTE } from './phase-materials.js';

const SLICES = [
  { w: -1.8, label: 'w = −1.8', name: '星轨', color: PALETTE.accent.blueWNeg },
  { w: 0.0, label: '三维切面', name: '青苍', color: PALETTE.accent.cyanW0 },
  { w: 1.8, label: 'w = +1.8', name: '流金', color: PALETTE.accent.goldWPos },
];

export class TacticalConsole {
  constructor(elements) {
    this.wrapperEl = elements.wrapperEl;
    this.bodyEl = elements.bodyEl;
    this.canvas = elements.canvas;
    this.ctx = elements.canvas ? elements.canvas.getContext('2d') : null;
    this.rulerCursorEl = elements.rulerCursorEl;
    this.rulerReadoutEl = elements.rulerReadoutEl;
    this.collapsed = false;
  }

  toggle() {
    this.collapsed = !this.collapsed;
    if (this.wrapperEl) {
      this.wrapperEl.classList.toggle('is-collapsed', this.collapsed);
    }
    return !this.collapsed;
  }

  setCollapsed(collapsed) {
    this.collapsed = Boolean(collapsed);
    if (this.wrapperEl) {
      this.wrapperEl.classList.toggle('is-collapsed', this.collapsed);
    }
  }

  setExpanded(expanded) {
    this.setCollapsed(!expanded);
    return !this.collapsed;
  }

  render(state) {
    // 1. Update Vertical W Phase Ruler (always visible)
    const w = state.playerPos[3];
    const norm = clamp((w - LEVEL14_CONFIG.playerWMin) / (LEVEL14_CONFIG.playerWMax - LEVEL14_CONFIG.playerWMin), 0, 1);
    const pctFromTop = (1 - norm) * 100;
    if (this.rulerCursorEl) {
      this.rulerCursorEl.style.top = `${pctFromTop.toFixed(1)}%`;
      const color =
        w > 0.6
          ? PALETTE.accent.goldWPos
          : w < -0.6
            ? PALETTE.accent.blueWNeg
            : PALETTE.accent.cyanW0;
      this.rulerCursorEl.style.setProperty('--cursor-color', color);
    }
    if (this.rulerReadoutEl) {
      const sign = w >= 0 ? '+' : '';
      this.rulerReadoutEl.textContent = `w ${sign}${w.toFixed(2)}`;
    }

    if (this.collapsed || !this.canvas || !this.ctx) return;

    // 2. Render 3-Slice Side-by-Side Holographic Viewport
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(240, Math.round(rect.width));
    const cssH = Math.max(150, Math.round(rect.height));
    if (this.canvas.width !== cssW * dpr || this.canvas.height !== cssH * dpr) {
      this.canvas.width = cssW * dpr;
      this.canvas.height = cssH * dpr;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#120F0B';
    ctx.fillRect(0, 0, cssW, cssH);

    const padX = 8;
    const gap = 6;
    const cardW = (cssW - padX * 2 - gap * 2) / 3;
    const cardY = 22;
    const cardH = cssH - 36;

    // Map 2x expanded hall X in [-15.0, +15.0], Z in [-20.5, +16.5] into card coordinates
    const zMin = -20.5;
    const zMax = 16.5;
    const xSpan = 30.0;

    SLICES.forEach((slice, idx) => {
      const x0 = padX + idx * (cardW + gap);
      const distW = Math.abs(w - slice.w);
      const isActive = distW <= 0.72;

      // Slice card background
      ctx.fillStyle = isActive ? 'rgba(43, 37, 27, 0.92)' : 'rgba(24, 20, 15, 0.78)';
      ctx.fillRect(x0, cardY, cardW, cardH);

      ctx.strokeStyle = isActive ? slice.color : 'rgba(138, 106, 47, 0.28)';
      ctx.lineWidth = isActive ? 1.6 : 1;
      ctx.strokeRect(x0 + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

      // Header label
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = isActive ? slice.color : 'rgba(246, 244, 238, 0.55)';
      ctx.textAlign = 'center';
      ctx.fillText(`${slice.label}`, x0 + cardW * 0.5, 14);

      const mapX = (wx) => x0 + cardW * 0.5 + (wx / xSpan) * (cardW - 8);
      const mapZ = (wz) => cardY + cardH - ((wz - zMin) / (zMax - zMin)) * (cardH - 8) - 4;

      // North & South Pedestals + North Teleportation Pad
      const southY = mapZ(LEVEL14_CONFIG.orbStartZ);
      const northY = mapZ(LEVEL14_CONFIG.orbTargetZ);
      const portalY = mapZ(LEVEL14_CONFIG.teleporterZ);
      ctx.fillStyle = 'rgba(77, 230, 211, 0.32)';
      ctx.beginPath();
      ctx.arc(mapX(0), southY, 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = state.completed ? PALETTE.accent.platinum : 'rgba(247, 195, 70, 0.45)';
      ctx.beginPath();
      ctx.arc(mapX(0), northY, 4.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = state.completed ? PALETTE.accent.emerald : 'rgba(105, 240, 174, 0.28)';
      ctx.lineWidth = state.completed ? 1.6 : 1;
      ctx.beginPath();
      ctx.arc(mapX(0), portalY, 5.2, 0, Math.PI * 2);
      ctx.stroke();
      if (state.completed) {
        ctx.fillStyle = 'rgba(105, 240, 174, 0.35)';
        ctx.fill();
      }

      // All-W Monolith Walls (part wide open once unlocked by Passing Orb key!)
      const wallTop = mapZ(LEVEL14_CONFIG.wallZMax);
      const wallBot = mapZ(LEVEL14_CONFIG.wallZMin);
      const wallH = Math.max(4, wallBot - wallTop);
      const slitGapPx = state.completed ? cardW * 0.42 : 3;

      ctx.fillStyle = isActive ? '#6A5328' : '#4A3B1E';
      const leftWallW = Math.max(2, cardW * 0.5 - slitGapPx * 0.5 - 3);
      ctx.fillRect(x0 + 3, wallTop, leftWallW, wallH);
      ctx.fillRect(
        x0 + cardW * 0.5 + slitGapPx * 0.5,
        wallTop,
        leftWallW,
        wallH
      );
      if (!state.completed) {
        // Platinum hairline slit seam
        ctx.fillStyle = PALETTE.accent.platinum;
        ctx.fillRect(x0 + cardW * 0.5 - 0.6, wallTop, 1.2, wallH);
      }

      // Exact Orb Cross-Section in this W slice!
      const orbSlice = computeOblateSpheroidSliceAtW(state.thetaRad, slice.w);
      const orbPy = mapZ(state.orbZ);
      if (orbSlice.intersects) {
        const rx = Math.max(1.5, (orbSlice.semiX / xSpan) * (cardW - 8));
        const rz = Math.max(2.0, (orbSlice.semiZ / (zMax - zMin)) * (cardH - 8));
        ctx.fillStyle = state.completed
          ? PALETTE.accent.emerald
          : state.isBladeThinEnough()
            ? PALETTE.accent.emerald
            : slice.color;
        ctx.beginPath();
        ctx.ellipse(mapX(orbSlice.xCenter), orbPy, rx, rz, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (slice.w !== 0) {
        // Subtle dotted ghost ring if orb is at W=0 and not reaching this slice
        ctx.strokeStyle = 'rgba(247, 195, 70, 0.25)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(mapX(0), orbPy, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Synchronized Voxel Astronaut (08)
      const px = mapX(state.playerPos[0]);
      const pz = mapZ(state.playerPos[2]);
      if (isActive) {
        ctx.fillStyle = PALETTE.accent.platinum;
        ctx.fillRect(px - 3, pz - 3, 6, 6);
        ctx.strokeStyle = slice.color;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px - 4.5, pz - 4.5, 9, 9);
      } else {
        ctx.fillStyle = 'rgba(255, 246, 214, 0.24)';
        ctx.fillRect(px - 2, pz - 2, 4, 4);
      }

      // Footer tag
      ctx.font = '500 9px "Inter", "PingFang SC", sans-serif';
      ctx.fillStyle = isActive ? PALETTE.accent.platinum : 'rgba(246, 244, 238, 0.42)';
      ctx.fillText(isActive ? `${slice.name} · 实` : `${slice.name} · 虚`, x0 + cardW * 0.5, cssH - 4);
    });

    ctx.textAlign = 'left';
    ctx.restore();
  }
}
