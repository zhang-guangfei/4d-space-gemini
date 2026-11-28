/**
 * Beyond 3D — Third-Person 4D Grab & Rotate Stage + Honest XZW Side-View Renderer
 *
 * Upgraded Discovery Flow:
 * 1. Progressive HUD Reveal: Side View panel opens cleanly on Tab (not dumped immediately on E grab).
 * 2. Matching △ (Left) & ○ (Right) Diameter Markers with smooth landing animation linking the 3D sphere
 *    directly to the Side View's rigid 2.00m diameter bar.
 * 3. Architectural Slit Continuity: Side View slit walls echo the 3D cathedral's brushed bronze jaws,
 *    Vernier calibration ticks, and platinum/emerald glowing lips.
 * 4. Live Collision-Layer Evidence: Tracks the player's W coordinate
 *    and illuminates the exact wall-contact point where the protruding orb body hits the solid monolith!
 */

import { lerp } from '../core/math4d.js';
import { LEVEL14_CONFIG, sampleOblateDiskXW } from '../core/sanctuary-4d.js';
import { PALETTE } from './phase-materials.js';

function drawTriangleMarker(ctx, x, y, r, fillHex, strokeHex) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.12);
  ctx.lineTo(x - r * 1.05, y + r * 0.85);
  ctx.lineTo(x + r * 1.05, y + r * 0.85);
  ctx.closePath();
  ctx.fillStyle = fillHex;
  ctx.fill();
  ctx.strokeStyle = strokeHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function drawCircleMarker(ctx, x, y, r, fillHex, strokeHex) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = fillHex;
  ctx.fill();
  ctx.strokeStyle = strokeHex;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

export class GrabStageController {
  constructor(sideViewCanvas, sideViewPanel) {
    this.canvas = sideViewCanvas;
    this.panel = sideViewPanel;
    this.ctx = sideViewCanvas ? sideViewCanvas.getContext('2d') : null;
    this.camPos = { x: 2.6, y: 1.85, z: -10.8 };
    this.camTarget = { x: 0, y: 2.2, z: -1.2 };
    this.blockFlash = 0;
    this.wasSideViewOpen = false;
    this.markerEntryProgress = 1;
    this.elapsed = 0;
  }

  triggerBlockFlash() {
    this.blockFlash = 1.0;
  }

  /**
   * Smoothly interpolate Babylon FreeCamera pose for Walk / Grab / Tab Side View.
   */
  updateCamera(camera, state, input, dtSec) {
    this.elapsed += dtSec;
    const smooth = Math.min(1, dtSec * 8.5);
    this.blockFlash = Math.max(0, this.blockFlash - dtSec * 2.0);

    // Track Tab Side View open transition to play smooth △ / ○ fly-in landing animation
    const isSideOpen = state.viewMode === 'side_xzw';
    if (isSideOpen && !this.wasSideViewOpen) {
      this.markerEntryProgress = 0;
    }
    this.wasSideViewOpen = isSideOpen;
    if (isSideOpen && this.markerEntryProgress < 1) {
      this.markerEntryProgress = Math.min(1, this.markerEntryProgress + dtSec * 2.35);
    }

    let desiredPos;
    let desiredTarget;

    if (!state.grabbed) {
      // First-person sanctuary exploration
      desiredPos = {
        x: state.playerPos[0],
        y: state.playerPos[1],
        z: state.playerPos[2],
      };
      const lookDist = 6.5;
      const cosP = Math.cos(input.pitch);
      desiredTarget = {
        x: desiredPos.x + Math.sin(input.yaw) * cosP * lookDist,
        y: desiredPos.y + Math.sin(input.pitch) * lookDist,
        z: desiredPos.z + Math.cos(input.yaw) * cosP * lookDist,
      };
      const fpSmooth = Math.min(1, dtSec * 18);
      this.camPos.x = lerp(this.camPos.x, desiredPos.x, fpSmooth);
      this.camPos.y = lerp(this.camPos.y, desiredPos.y, fpSmooth);
      this.camPos.z = lerp(this.camPos.z, desiredPos.z, fpSmooth);
      this.camTarget.x = lerp(this.camTarget.x, desiredTarget.x, fpSmooth);
      this.camTarget.y = lerp(this.camTarget.y, desiredTarget.y, fpSmooth);
      this.camTarget.z = lerp(this.camTarget.z, desiredTarget.z, fpSmooth);
    } else {
      // Zero-Occlusion 3-Zone Slit Camera Choreography
      if (state.orbZ <= -1.05) {
        desiredPos = {
          x: 2.15,
          y: 2.55,
          z: state.orbZ - 4.35,
        };
        desiredTarget = {
          x: 0,
          y: LEVEL14_CONFIG.orbCenterY + 0.18,
          z: Math.min(2.6, state.orbZ + 1.6),
        };
      } else if (state.orbZ < 1.15) {
        desiredPos = {
          x: 0.0,
          y: 2.08,
          z: -2.85,
        };
        desiredTarget = {
          x: 0.0,
          y: LEVEL14_CONFIG.orbCenterY,
          z: state.orbZ + 0.9,
        };
      } else {
        desiredPos = {
          x: 2.35,
          y: 2.6,
          z: Math.max(2.3, state.orbZ + 3.45),
        };
        desiredTarget = {
          x: 0,
          y: LEVEL14_CONFIG.orbCenterY + 0.12,
          z: state.orbZ - 0.35,
        };
      }
      this.camPos.x = lerp(this.camPos.x, desiredPos.x, smooth);
      this.camPos.y = lerp(this.camPos.y, desiredPos.y, smooth);
      this.camPos.z = lerp(this.camPos.z, desiredPos.z, smooth);
      this.camTarget.x = lerp(this.camTarget.x, desiredTarget.x, smooth);
      this.camTarget.y = lerp(this.camTarget.y, desiredTarget.y, smooth);
      this.camTarget.z = lerp(this.camTarget.z, desiredTarget.z, smooth);
    }

    camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z);
    camera.setTarget(new globalThis.BABYLON.Vector3(this.camTarget.x, this.camTarget.y, this.camTarget.z));
  }

  /**
   * Render the mathematically exact X-W Side View diagram with matching △ / ○ diameter markers,
   * architectural 3D-matched slit walls, and live neighboring-layer collision evidence!
   */
  renderSideView(state) {
    if (!this.canvas || !this.ctx || !this.panel) return;

    // Progressive Reveal: only open the full Side View panel when Tab Side View is active!
    const isExpanded = state.viewMode === 'side_xzw';
    this.panel.classList.toggle('is-visible', isExpanded);
    this.panel.classList.toggle('is-expanded', isExpanded);
    if (!isExpanded) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    if (this.canvas.width !== cssW * dpr || this.canvas.height !== cssH * dpr) {
      this.canvas.width = cssW * dpr;
      this.canvas.height = cssH * dpr;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark obsidian scientific backdrop
    ctx.fillStyle = '#120F0B';
    ctx.fillRect(0, 0, cssW, cssH);

    const cx = cssW * 0.5;
    const cy = cssH * 0.52;
    const scale = Math.min(cssW, cssH) * 0.34;
    const toPxX = (x) => cx + x * scale;
    const toPxW = (w) => cy - w * scale;

    const activeW = state.playerPos[3];
    const activeSlice = state.getSliceAtPlayerW();
    const overlapX = state.observedWallOverlapX;
    const activeSliceY = Math.max(24, Math.min(cssH - 28, toPxW(activeW)));
    const isBlade = state.isBladeThinEnough();
    const inWallZ = state.isOrbOverlappingWallZ();
    const isInspectingOtherW = activeW !== 0;

    // 1. Subtle coordinate grid
    ctx.strokeStyle = 'rgba(138, 106, 47, 0.13)';
    ctx.lineWidth = 1;
    for (const v of [-1.0, -0.5, 0.5, 1.0]) {
      ctx.beginPath();
      ctx.moveTo(toPxX(v), 18);
      ctx.lineTo(toPxX(v), cssH - 24);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(16, toPxW(v));
      ctx.lineTo(cssW - 16, toPxW(v));
      ctx.stroke();
    }

    // 2. Architectural Monolith Walls matching the 3D cathedral's brushed bronze jaws & Vernier ticks!
    const slitHalfPx = LEVEL14_CONFIG.slitHalfWidth * scale;
    const wallTop = 18;
    const wallBot = cssH - 24;
    const wallAlpha = isInspectingOtherW ? 0.28 : inWallZ ? 0.32 : 0.18;

    ctx.fillStyle = `rgba(116, 88, 38, ${wallAlpha})`;
    ctx.fillRect(16, wallTop, Math.max(0, cx - slitHalfPx - 16), wallBot - wallTop);
    ctx.fillRect(cx + slitHalfPx, wallTop, Math.max(0, cssW - 16 - (cx + slitHalfPx)), wallBot - wallTop);

    // Matching brushed-bronze aperture jaw strips flanking the slit edges
    ctx.fillStyle = 'rgba(164, 126, 54, 0.34)';
    ctx.fillRect(cx - slitHalfPx - 7, wallTop, 7, wallBot - wallTop);
    ctx.fillRect(cx + slitHalfPx, wallTop, 7, wallBot - wallTop);

    // Matching Golden Vernier calibration hash ticks along both slit jaws
    ctx.strokeStyle = 'rgba(247, 195, 70, 0.55)';
    ctx.lineWidth = 1.2;
    for (let ty = wallTop + 14; ty <= wallBot - 12; ty += 18) {
      ctx.beginPath();
      ctx.moveTo(cx - slitHalfPx - 6, ty);
      ctx.lineTo(cx - slitHalfPx - 1.5, ty);
      ctx.moveTo(cx + slitHalfPx + 1.5, ty);
      ctx.lineTo(cx + slitHalfPx + 6, ty);
      ctx.stroke();
    }

    // Glowing vertical Slit Lips (Platinum default -> Emerald when △ & ○ tuck inside -> Coral highlight on bump!)
    const lipColor = isBlade
      ? PALETTE.accent.emerald
      : this.blockFlash > 0.05
        ? PALETTE.accent.cyanW0
        : PALETTE.accent.platinum;
    ctx.strokeStyle = lipColor;
    ctx.lineWidth = isBlade ? 2.6 : 2.0;
    for (const sign of [-1, 1]) {
      const lx = cx + sign * slitHalfPx;
      ctx.beginPath();
      ctx.moveTo(lx, wallTop);
      ctx.lineTo(lx, wallBot);
      ctx.stroke();
    }

    // 3. Unit Reference Circle R = 1.00 m (honest geometric proof that △—○ diameter never shrinks!)
    ctx.strokeStyle = 'rgba(247, 195, 70, 0.28)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, LEVEL14_CONFIG.radiusR * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Current observation layer and orthogonal W axis.
    if (Math.abs(activeW) > 0.02) {
      // Faint original layer line at center
      ctx.strokeStyle = 'rgba(77, 230, 211, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(cssW - 16, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(77, 230, 211, 0.88)';
    ctx.lineWidth = isInspectingOtherW ? 2.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(16, activeSliceY);
    ctx.lineTo(cssW - 16, activeSliceY);
    ctx.stroke();

    // Vertical Fourth-Dimension w Arrowed Number Line
    const axisTop = 20;
    const axisBot = cssH - 26;
    ctx.strokeStyle = PALETTE.accent.goldWPos;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, axisBot);
    ctx.lineTo(cx, axisTop);
    ctx.stroke();

    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.beginPath();
    ctx.moveTo(cx, axisTop - 4);
    ctx.lineTo(cx - 5, axisTop + 6);
    ctx.lineTo(cx + 5, axisTop + 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(247, 195, 70, 0.72)';
    ctx.lineWidth = 1.2;
    for (const wTick of [-1, 1]) {
      const ty = toPxW(wTick);
      ctx.beginPath();
      ctx.moveTo(cx - 4, ty);
      ctx.lineTo(cx + 4, ty);
      ctx.stroke();
    }

    // 5. Rigid 4D Sphere Cross-Section in X-W rotated by exact thetaRad
    const tipX = Math.cos(state.thetaRad) * LEVEL14_CONFIG.radiusR;
    const tipW = Math.sin(state.thetaRad) * LEVEL14_CONFIG.radiusR;

    // Horizontal span vertical drop guides from △ and ○ down toward the slit gap!
    const triTargetX = toPxX(-tipX);
    const triTargetY = toPxW(-tipW);
    const circTargetX = toPxX(tipX);
    const circTargetY = toPxW(tipW);

    ctx.strokeStyle = isBlade
      ? 'rgba(105, 240, 174, 0.68)'
      : this.blockFlash > 0.05 || overlapX !== null
        ? 'rgba(255, 107, 107, 0.78)'
        : 'rgba(247, 195, 70, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(triTargetX, triTargetY);
    ctx.lineTo(triTargetX, wallBot);
    ctx.moveTo(circTargetX, circTargetY);
    ctx.lineTo(circTargetX, wallBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // Rigid disk body
    const diskPts = sampleOblateDiskXW(state.thetaRad, 72);
    ctx.beginPath();
    diskPts.forEach((pt, idx) => {
      const px = toPxX(pt.x);
      const py = toPxW(pt.w);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(247, 195, 70, 0.22)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.accent.goldWPos;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Rigid △ — ○ diameter spine (constant 2.00m length!)
    ctx.strokeStyle = isBlade ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(triTargetX, triTargetY);
    ctx.lineTo(circTargetX, circTargetY);
    ctx.stroke();

    // 6. Highlight the segment intersected by the player's current layer.
    if (activeSlice.intersects) {
      ctx.strokeStyle = PALETTE.accent.cyanW0;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(toPxX(activeSlice.xCenter - activeSlice.semiX), activeSliceY);
      ctx.lineTo(toPxX(activeSlice.xCenter + activeSlice.semiX), activeSliceY);
      ctx.stroke();

      // If inspecting neighboring layer OR bumping wall: highlight the EXACT wall contact spot!
      if (overlapX !== null && !isBlade) {
        const hitX = toPxX(overlapX);
        const pulseR = 9 + Math.sin(this.elapsed * 8) * 3;
        ctx.strokeStyle = PALETTE.accent.amberCoral;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(hitX, activeSliceY, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 107, 107, 0.26)';
        ctx.beginPath();
        ctx.arc(hitX, activeSliceY, pulseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 10.5px "Inter", "PingFang SC", sans-serif';
        ctx.fillStyle = '#FFD1D1';
        ctx.textAlign = hitX > cx ? 'left' : 'right';
        ctx.fillText('越过缝边的部分', hitX + (hitX > cx ? 13 : -13), activeSliceY + 19);
      }
    }

    // 7. Matching Hollow △ (Left) & ○ (Right) Diameter Markers with smooth fly-in landing animation!
    const tEase = 1 - Math.pow(1 - this.markerEntryProgress, 3);
    const triX = lerp(cx - 46, triTargetX, tEase);
    const triY = lerp(16, triTargetY, tEase);
    const circX = lerp(cx + 46, circTargetX, tEase);
    const circY = lerp(16, circTargetY, tEase);

    const triStroke = isBlade ? PALETTE.accent.emerald : '#FFB84D';
    const circStroke = isBlade ? PALETTE.accent.emerald : PALETTE.accent.platinum;
    drawTriangleMarker(ctx, triX, triY, 7.6, '#14100A', triStroke);
    drawCircleMarker(ctx, circX, circY, 7.0, '#14100A', circStroke);

    // 8. Clear Human-Readable Labels (ZERO "W=0切片" jargon!)
    ctx.font = '600 11px "Inter", "PingFang SC", sans-serif';
    ctx.fillStyle = PALETTE.accent.goldWPos;
    ctx.textAlign = 'left';
    ctx.fillText('第四维度 w ↑', cx + 8, axisTop + 10);

    ctx.fillStyle = PALETTE.accent.cyanW0;
    ctx.textAlign = 'right';
    ctx.fillText(
      isInspectingOtherW ? `当前 W ${activeW.toFixed(2)}` : '原层',
      cssW - 12,
      Math.max(36, activeSliceY - 9)
    );

    // Bottom status guidance — human intuition first!
    ctx.font = '600 11px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isBlade
      ? PALETTE.accent.emerald
      : overlapX !== null
        ? '#FFD1D1'
        : PALETTE.accent.platinum;
    const footerMsg = isBlade
      ? '两端都已收进缝内，可以往前推了'
      : overlapX !== null
        ? '红圈标出这一层越过缝边的球身'
        : !activeSlice.intersects ? '这一层没有切到球身' : '△ 和 ○ 标出同一颗球的两端';
    ctx.fillText(footerMsg, cx, cssH - 8);
    ctx.textAlign = 'left';

    ctx.restore();
  }
}
