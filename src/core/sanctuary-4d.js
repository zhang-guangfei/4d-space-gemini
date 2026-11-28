/**
 * Beyond 3D — Chapter 2 Sanctuary (Act III, Levels 13–18) Pure Math & State Machines
 * Zero DOM / Zero WebGL dependencies.
 *
 * Phase 1 Deliverable:
 * - Complete exact geometry & puzzle state machine for Level 14 "发丝裂缝" (Hairline Slit)
 * - Analytical math kernels for Level 15 (2-Sphere rotated slices) & Level 16 (XW 180° chiral flip)
 *   so geometric invariant tests cover the full Sanctuary math foundation from Day 1.
 */

import {
  EPSILON,
  angularDistanceMod180Deg,
  clamp,
  degToRad,
  dist4,
  normalizeAngleDeg,
  qFromAxisAngle,
  qIdentity,
  qMul,
  qNormalize,
  qRotateVec3,
  rotPlane4,
  signedOrientationDet3D,
} from './math4d.js';

// ============================================================================
// Level 14: "发丝裂缝" (Hairline Slit) — 4D Oblate Spheroid Rotating Around YZ
// ============================================================================

export const LEVEL14_CONFIG = Object.freeze({
  radiusR: 1.0, // Intrinsic 3D radius (2.0 m diameter)
  wHalfThickness: 0.001, // Near-zero 4D W half-thickness (0.002 m sheet; slight tilt immediately collapses slice to 2D disc!)
  slitHalfWidth: 0.082, // Monolith slit half-width (0.164 m total clear gap)
  slitClearanceLimit: 0.078, // Required xMax(theta) <= 0.078 m (theta = 90° ± 4.4°)
  bladeAngleToleranceDeg: 4.4, // 90° ± 4.4°
  restoreAngleToleranceDeg: 5.0, // 0° or 180° ± 5°
  wallZMin: -1.2, // Monolith wall slab spans Z in [-1.2, +1.2] across ALL W slices
  wallZMax: 1.2,
  wallHeight: 13.6, // 13.6 m towering obsidian-gold sanctuary monoliths (2x expanded cathedral!)
  hallHalfX: 14.2, // 28.4 m walkable width (34 m outer walls — >2.15x wider!)
  hallMinZ: -19.5, // 35.0 m walkable length (44 m outer length — >2.2x longer!)
  hallMaxZ: 15.5,
  orbStartZ: -3.2, // South pedestal Z
  orbTargetZ: 3.2, // North destination golden pedestal Z
  orbCenterY: 1.75, // Levitation center height
  orbMinZ: -4.2,
  orbMaxZ: 3.30, // Cradles cleanly on North Golden Pedestal (Z=3.2) so holding W never overshoots!
  pedestalSnapRadiusZ: 0.55,
  teleporterZ: 11.2, // North Next-Level Teleportation Pad Z (walkable once monolith walls open!)
  teleporterRadius: 1.85,
  playerWMin: -2.2,
  playerWMax: 2.2,
  grabInteractDistance: 4.6,
});

/**
 * Exact 4D oblate spheroid X and W projection half-extents under XW rotation
 * (rotation around the YZ plane) by angle `thetaRad`.
 *
 * Formula (00-master-gdd.md §5 Level 14):
 *   xMax(theta) = sqrt(R^2 cos^2(theta) + eps^2 sin^2(theta))
 *   wMax(theta) = sqrt(R^2 sin^2(theta) + eps^2 cos^2(theta))
 *
 * Rigid-body invariant:
 *   sqrt(xMax^2 + wMax^2 - eps^2) === R (constant for all theta)
 */
export function computeOblateSpheroidExtents(
  thetaRad,
  R = LEVEL14_CONFIG.radiusR,
  eps = LEVEL14_CONFIG.wHalfThickness
) {
  const c = Math.cos(thetaRad);
  const s = Math.sin(thetaRad);
  const xMax = Math.sqrt(R * R * c * c + eps * eps * s * s);
  const wMax = Math.sqrt(R * R * s * s + eps * eps * c * c);
  const rigidRadiusInvariant = Math.sqrt(Math.max(0, xMax * xMax + wMax * wMax - eps * eps));
  return {
    xMax,
    wMax,
    yMax: R,
    zMax: R,
    rigidRadiusInvariant,
  };
}

/**
 * Exact analytical 3D cross-section of the 4D oblate spheroid (rotated by thetaRad
 * in the XW plane, centered at X=0, W=0) intersected with hyperplane W = wSlice.
 *
 * Derivation:
 *   (x cos t + w sin t)^2 / R^2 + (-x sin t + w cos t)^2 / eps^2 + (y^2 + z^2) / R^2 <= 1
 * Completing the square in x at w = wSlice gives a 3D ellipsoid centered at:
 *   xCenter = ((R^2 - eps^2) sin t cos t) / wMax^2 * wSlice
 * with semi-axes:
 *   aX = (R * eps / wMax) * sqrt(1 - (wSlice / wMax)^2)
 *   aY = aZ = R * sqrt(1 - (wSlice / wMax)^2)
 * Empty when |wSlice| > wMax.
 */
export function computeOblateSpheroidSliceAtW(
  thetaRad,
  wSlice = 0,
  R = LEVEL14_CONFIG.radiusR,
  eps = LEVEL14_CONFIG.wHalfThickness
) {
  const { xMax, wMax, rigidRadiusInvariant } = computeOblateSpheroidExtents(thetaRad, R, eps);
  const ratio = wSlice / wMax;
  const radialSq = 1 - ratio * ratio;

  if (radialSq <= 0) {
    return {
      intersects: false,
      xCenter: 0,
      semiX: 0,
      semiY: 0,
      semiZ: 0,
      xMax,
      wMax,
      rigidRadiusInvariant,
    };
  }

  const scale = Math.sqrt(radialSq);
  const s = Math.sin(thetaRad);
  const c = Math.cos(thetaRad);
  const xCenter = (((R * R - eps * eps) * s * c) / (wMax * wMax)) * wSlice;
  const semiX = ((R * eps) / wMax) * scale;
  const semiYZ = R * scale;

  return {
    intersects: true,
    xCenter,
    semiX,
    semiY: semiYZ,
    semiZ: semiYZ,
    xMax,
    wMax,
    rigidRadiusInvariant,
  };
}

/**
 * Compute exact silhouette points of the rigid oblate disk in the X-W side view plane
 * (useful both for honest XZW rendering and invariant testing).
 */
export function sampleOblateDiskXW(
  thetaRad,
  segments = 64,
  R = LEVEL14_CONFIG.radiusR,
  eps = LEVEL14_CONFIG.wHalfThickness
) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const phi = (i / segments) * Math.PI * 2;
    const local = [R * Math.cos(phi), 0, 0, eps * Math.sin(phi)];
    const rotated = rotPlane4(local, 0, 3, thetaRad);
    points.push({ x: rotated[0], w: rotated[3] });
  }
  return points;
}

/**
 * Pure deterministic Level 14 ("发丝裂缝") State Machine.
 * Handles:
 * - Player W-axis translation (revealing monolith walls exist in ALL W slices)
 * - Orb grab/release (E key)
 * - Orb 3D SO(3) rotation via mouse drag (proving 3D rotation NEVER reduces X width!)
 * - Orb 4D XW rotation via mouse wheel (narrowing 2.0m sphere -> 0.07m blade at 90°)
 * - Honest collision blocking:
 *   1. Cannot push orb into monolith slit Z in [-1.2, +1.2] if xMax(theta) > 0.082m
 *   2. Cannot un-rotate orb inside slit Z in (-1.2, +1.2) if new xMax > 0.082m
 * - Three-beat non-checklist discovery state (Beat 1: 奇观 -> Beat 2: 把玩 -> Beat 3: 运用)
 * - Honest dual-view mode ('slice' | 'side_xzw')
 */
export class Level14HairlineSlitState {
  constructor(config = LEVEL14_CONFIG) {
    this.config = { ...LEVEL14_CONFIG, ...config };
    this.reset();
  }

  reset() {
    this.playerPos = [2.6, 1.85, -10.8, 0]; // [x, y, z, w] grand diagonal vantage of 2x cathedral nave + orb + 13.6m monolith slit
    this.orbZ = this.config.orbStartZ; // -3.2 m
    this.thetaDeg = 0; // 4D XW rotation angle around YZ plane (degrees)
    this.orbQuat3D = qIdentity(); // Pure SO(3) 3D orientation (changes meridian rings only!)
    this.grabbed = false;
    this.viewMode = 'slice'; // 'slice' | 'side_xzw'

    // Telemetry & organic discovery flags (never spoil before player witnesses evidence!)
    this.hasExploredW = false;
    this.hasDiscoveredAllWWall = false;
    this.hasBumpedWhileTilted = false;
    this.wMinVisited = 0;
    this.wMaxVisited = 0;
    this.hasBlockedAtWall = false;
    this.hasRotated3DWhileGrabbed = false;
    this.hasRotated4DWhileGrabbed = false;
    this.hasOpenedSideView = false;
    this.hasReachedBladeState = false;
    this.hasPassedSlit = false;
    this.hasAttemptedExpandInsideSlit = false;
    this.completed = false;
    this.enteredTeleporter = false;

    // 3-beat progression: 0 (initial) -> 1 (奇观) -> 2 (把玩) -> 3 (运用/通关)
    this.beat = 0;
    this.lastBlockEvent = null;
  }

  get thetaRad() {
    return degToRad(this.thetaDeg);
  }

  getExtents() {
    return computeOblateSpheroidExtents(
      this.thetaRad,
      this.config.radiusR,
      this.config.wHalfThickness
    );
  }

  getSliceAtPlayerW() {
    return computeOblateSpheroidSliceAtW(
      this.thetaRad,
      this.playerPos[3],
      this.config.radiusR,
      this.config.wHalfThickness
    );
  }

  getSliceAtW0() {
    return computeOblateSpheroidSliceAtW(
      this.thetaRad,
      0,
      this.config.radiusR,
      this.config.wHalfThickness
    );
  }

  get hasInspectableContact() {
    return this.lastBlockEvent?.type === 'too_wide_for_slit' &&
      angularDistanceMod180Deg(this.thetaDeg, 0) >= 4 &&
      this.getExtents().xMax > this.config.slitHalfWidth;
  }

  // The marked interval is the overlap in X, as seen looking toward the slit.
  getWallOverlapX(slice) {
    const outer = Math.abs(slice.xCenter) + slice.semiX;
    if (!slice.intersects || outer <= this.config.slitHalfWidth) return null;
    const inner = Math.max(this.config.slitHalfWidth, Math.abs(slice.xCenter) - slice.semiX);
    return (slice.xCenter < 0 ? -1 : 1) * (inner + outer) / 2;
  }

  get observedWallOverlapX() {
    return this.hasInspectableContact ? this.getWallOverlapX(this.getSliceAtPlayerW()) : null;
  }

  // A lightly tilted ball spans very little W. Scale hand-controlled travel
  // to its extent so one wheel notch can still reveal an intermediate slice.
  exploreOrbW(wheelUnits) {
    const step = Math.max(0.12, this.getExtents().wMax) / 8;
    return this.shiftPlayerW(wheelUnits * step);
  }

  get canReconnectAtPedestal() {
    return !this.completed && this.hasPassedSlit && this.isOnNorthPedestal();
  }

  /**
   * Returns the player's actual current puzzle phase so H-key hints always match what
   * they are solving RIGHT NOW (never giving opening coin hints when restoring on North Pedestal!).
   */
  getCurrentPuzzlePhase() {
    if (this.completed) return 'completed';
    if (!this.grabbed && this.canReconnectAtPedestal) return 'north_reconnect';
    if (!this.getSliceAtPlayerW().intersects) return 'find_orb_layer';
    if (this.isOnNorthPedestal(this.orbZ)) return 'north_restore';
    if (!this.grabbed && !this.hasRotated4DWhileGrabbed) return 'approach';
    if (this.isBladeThinEnough(this.thetaDeg)) return 'blade_ready';
    if (this.lastBlockEvent?.type === 'too_wide_for_slit' && this.hasBumpedWhileTilted) {
      if (this.getExtents().xMax <= this.config.slitHalfWidth) return 'slit_margin';
      if (this.hasInspectableContact) return 'wall_contact';
    }
    const distFrom0 = angularDistanceMod180Deg(this.thetaDeg, 0);
    if (distFrom0 >= 4) return 'tilted';
    return 'grabbed_flat';
  }

  /**
   * True when the orb's 3D/4D Z-span overlaps the monolith wall slab Z in [-1.2, +1.2].
   * Since the orb has radius R = 1.0 in Z regardless of XW rotation,
   * its Z interval is [orbZ - R, orbZ + R].
   */
  isOrbOverlappingWallZ(z = this.orbZ) {
    const rZ = this.config.radiusR;
    return z + rZ > this.config.wallZMin + 1e-6 && z - rZ < this.config.wallZMax - 1e-6;
  }

  /**
   * Strictly inside the central slit channel (strictly between the south/north faces).
   */
  isOrbInsideSlit(z = this.orbZ) {
    return z > this.config.wallZMin && z < this.config.wallZMax;
  }

  isBladeThinEnough(thetaDeg = this.thetaDeg) {
    const { xMax } = computeOblateSpheroidExtents(
      degToRad(thetaDeg),
      this.config.radiusR,
      this.config.wHalfThickness
    );
    return xMax <= this.config.slitClearanceLimit + 1e-6 && xMax < this.config.slitHalfWidth;
  }

  isRestoredFullSphere(thetaDeg = this.thetaDeg) {
    return angularDistanceMod180Deg(thetaDeg, 0) <= this.config.restoreAngleToleranceDeg;
  }

  isOnNorthPedestal(z = this.orbZ) {
    return Math.abs(z - this.config.orbTargetZ) <= this.config.pedestalSnapRadiusZ;
  }

  /**
   * Check whether a 3D player position (x, z) collides with the all-W monolith walls.
   * Monolith walls exist for ALL W slices: Z in [-1.2, +1.2], |X| >= slitHalfWidth.
   * Once the Passing Orb key is restored on the North Pedestal (`this.completed`),
   * the twin monolith walls part wide open so the player can walk straight through!
   */
  isPlayerBlockedByMonolith(x, z, playerRadius = 0.36) {
    if (this.completed) return false;
    const inWallZ = z + playerRadius > this.config.wallZMin && z - playerRadius < this.config.wallZMax;
    if (!inWallZ) return false;
    // Even centered at X=0, playerRadius (0.36m) > slitHalfWidth (0.082m), so monolith blocks player in ALL W!
    return Math.abs(x) + playerRadius > this.config.slitHalfWidth;
  }

  /**
   * Shift the observer while keeping the orb's position and orientation fixed.
   */
  shiftPlayerW(deltaW) {
    const prev = this.playerPos[3];
    const clamped = clamp(prev + deltaW, this.config.playerWMin, this.config.playerWMax);
    const next = Math.abs(clamped) < EPSILON ? 0 : clamped;
    this.playerPos[3] = next;
    this.wMinVisited = Math.min(this.wMinVisited, next);
    this.wMaxVisited = Math.max(this.wMaxVisited, next);

    if (Math.abs(next) >= 0.75 || this.wMaxVisited - this.wMinVisited >= 1.2) {
      this.hasExploredW = true;
      this._updateBeats();
    }
    if ((!this.grabbed && this.hasExploredW) || this.observedWallOverlapX !== null) {
      this.hasDiscoveredAllWWall = true;
    }
    return {
      w: next,
      hitBoundary:
        (deltaW < 0 && next <= this.config.playerWMin + 1e-6) ||
        (deltaW > 0 && next >= this.config.playerWMax - 1e-6),
      monolithStillSolid: !this.completed,
    };
  }

  /**
   * Move player in XZ plane (walk mode), respecting monolith all-W wall collision & hall bounds.
   * After victory, monolith opens so player can walk north straight onto the Teleportation Pad!
   */
  movePlayerXZ(
    dx,
    dz,
    hallHalfX = this.config.hallHalfX,
    hallMinZ = this.config.hallMinZ,
    hallMaxZ = this.config.hallMaxZ
  ) {
    const currX = this.playerPos[0];
    const currZ = this.playerPos[2];
    let targetX = clamp(currX + dx, -hallHalfX, hallHalfX);
    let targetZ = clamp(currZ + dz, hallMinZ, hallMaxZ);
    let blockedByWall = false;

    if (this.isPlayerBlockedByMonolith(targetX, targetZ)) {
      // Try sliding along X only or Z only
      if (!this.isPlayerBlockedByMonolith(targetX, currZ)) {
        targetZ = currZ;
      } else if (!this.isPlayerBlockedByMonolith(currX, targetZ)) {
        targetX = currX;
      } else {
        targetX = currX;
        targetZ = currZ;
      }
      blockedByWall = true;
      this.hasBlockedAtWall = true;
      this.lastBlockEvent = {
        type: 'all_w_wall',
        message: this.hasDiscoveredAllWWall
          ? '这堵墙沿第四维也一直延伸，人无法绕过去'
          : '墙缝只有 16 厘米宽，人穿不过去',
      };
      this._updateBeats();
    }

    this.playerPos[0] = targetX;
    this.playerPos[2] = targetZ;

    let justEnteredTeleporter = false;
    if (this.completed) {
      const distToPortal = Math.hypot(targetX, targetZ - this.config.teleporterZ);
      if (distToPortal <= this.config.teleporterRadius) {
        if (!this.enteredTeleporter) {
          this.enteredTeleporter = true;
          justEnteredTeleporter = true;
        }
      }
    }

    return {
      x: targetX,
      z: targetZ,
      blockedByWall,
      enteredTeleporter: this.enteredTeleporter,
      justEnteredTeleporter,
    };
  }

  canGrabOrb() {
    if (this.canReconnectAtPedestal) return true;
    if (!this.getSliceAtPlayerW().intersects) return false;
    const dx = this.playerPos[0] - 0;
    const dz = this.playerPos[2] - this.orbZ;
    const dist = Math.hypot(dx, dz);
    return dist <= this.config.grabInteractDistance;
  }

  setGrabbed(shouldGrab) {
    if (shouldGrab) {
      if (this.completed) {
        return { grabbed: false, reason: 'already_completed' };
      }
      if (!this.canGrabOrb()) {
        return { grabbed: false, reason: this.getSliceAtPlayerW().intersects ? 'too_far' : 'other_layer' };
      }
      this.grabbed = true;
      if (this.beat < 1) {
        this.beat = 1;
      }
      return { grabbed: true, reason: 'ok' };
    }

    // Releasing grab MUST ALWAYS succeed (including after victory!) so camera is never trapped
    this.grabbed = false;
    if (this.playerPos[2] > this.config.wallZMin - 1.2) {
      this.playerPos = [0, 1.85, -6.2, this.playerPos[3]];
    }
    return { grabbed: false, reason: 'released' };
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'slice' ? 'side_xzw' : 'slice';
    if (this.viewMode === 'side_xzw') {
      this.hasOpenedSideView = true;
      this._updateBeats();
    }
    return this.viewMode;
  }

  /**
   * Apply pure 3D SO(3) rotation while grabbed (mouse left-drag).
   * Mathematically proves that 3D rotation NEVER alters xMax(theta) or wMax(theta)!
   */
  rotateOrb3D(deltaYawRad, deltaPitchRad) {
    if (!this.grabbed) return { rotated: false, xMax: this.getExtents().xMax };
    const qYaw = qFromAxisAngle([0, 1, 0], deltaYawRad);
    const qPitch = qFromAxisAngle([1, 0, 0], deltaPitchRad);
    this.orbQuat3D = qNormalize(qMul(qYaw, qMul(qPitch, this.orbQuat3D)));
    if (Math.abs(deltaYawRad) + Math.abs(deltaPitchRad) > 0.02) {
      this.hasRotated3DWhileGrabbed = true;
    }
    return {
      rotated: true,
      quat: [...this.orbQuat3D],
      xMax: this.getExtents().xMax,
    };
  }

  /**
   * Apply 4D XW rotation (rotation around YZ plane) via mouse wheel while grabbed.
   * Honestly blocks expanding the orb wider than the slit while inside Z in [-1.2, +1.2]!
   */
  rotateOrb4D(deltaDeg) {
    if (!this.grabbed) {
      return {
        applied: false,
        blocked: false,
        thetaDeg: this.thetaDeg,
        extents: this.getExtents(),
      };
    }

    const candidateDeg = normalizeAngleDeg(this.thetaDeg + deltaDeg);
    const candidateExtents = computeOblateSpheroidExtents(
      degToRad(candidateDeg),
      this.config.radiusR,
      this.config.wHalfThickness
    );

    // Honest collision rule: while the orb overlaps the monolith wall slab,
    // it CANNOT expand wider than the slit half-width!
    if (
      this.isOrbOverlappingWallZ(this.orbZ) &&
      candidateExtents.xMax > this.config.slitHalfWidth - 0.002
    ) {
      this.hasAttemptedExpandInsideSlit = true;
      this.lastBlockEvent = {
        type: 'slit_expand_blocked',
        message: '窄缝内空间不足，无法提前展开圆球，请先推至北侧基座',
      };
      return {
        applied: false,
        blocked: true,
        reason: 'slit_expand_blocked',
        thetaDeg: this.thetaDeg,
        extents: this.getExtents(),
      };
    }

    if (candidateDeg !== this.thetaDeg) {
      this.lastBlockEvent = null;
    }
    this.thetaDeg = candidateDeg;
    if (Math.abs(deltaDeg) > 0.01) {
      this.hasRotated4DWhileGrabbed = true;
    }
    if (this.isBladeThinEnough(this.thetaDeg)) {
      this.hasReachedBladeState = true;
    }

    this._checkVictory();
    this._updateBeats();

    return {
      applied: true,
      blocked: false,
      thetaDeg: this.thetaDeg,
      extents: candidateExtents,
      isBlade: this.isBladeThinEnough(this.thetaDeg),
      completed: this.completed,
    };
  }

  /**
   * Push or pull the grabbed orb along the Z sanctuary axis (W / S keys in Grab Stage).
   * Blocks entry into the monolith wall slab Z in [-1.2, +1.2] unless xMax(theta) fits through the 0.164m slit!
   */
  pushOrbZ(deltaZ) {
    if (!this.grabbed) {
      return { applied: false, blocked: false, orbZ: this.orbZ };
    }

    const prevZ = this.orbZ;
    let targetZ = clamp(prevZ + deltaZ, this.config.orbMinZ, this.config.orbMaxZ);
    const extents = this.getExtents();

    const wouldOverlapWall = this.isOrbOverlappingWallZ(targetZ);
    if (wouldOverlapWall && !this.isBladeThinEnough(this.thetaDeg)) {
      // Stop cleanly flush with the south or north monolith wall face
      const southStop = this.config.wallZMin - this.config.radiusR; // -2.2m
      const northStop = this.config.wallZMax + this.config.radiusR; // +2.2m
      if (prevZ <= southStop + 1e-4 && deltaZ > 0) {
        targetZ = Math.min(targetZ, southStop);
      } else if (prevZ >= northStop - 1e-4 && deltaZ < 0) {
        targetZ = Math.max(targetZ, northStop);
      } else {
        targetZ = prevZ;
      }

      this.orbZ = targetZ;
      this.hasBlockedAtWall = true;
      const distFrom0 = angularDistanceMod180Deg(this.thetaDeg, 0);
      if (distFrom0 >= 4) {
        this.hasBumpedWhileTilted = true;
      }
      this.lastBlockEvent = {
        type: 'too_wide_for_slit',
        message:
          extents.xMax <= this.config.slitHalfWidth
            ? '球身贴着缝边，再转一点，给两边留出空隙'
            : distFrom0 >= 4 ? '整颗球在缝口停住了' : '球比缝宽，推不进去',
      };
      if (this.observedWallOverlapX !== null) this.hasDiscoveredAllWWall = true;
      this._updateBeats();
      return {
        applied: targetZ !== prevZ,
        blocked: true,
        reason: 'too_wide_for_slit',
        orbZ: this.orbZ,
        xMax: extents.xMax,
      };
    }

    this.orbZ = targetZ;
    if (targetZ !== prevZ) {
      this.lastBlockEvent = null;
    }
    if (this.orbZ >= this.config.wallZMax + this.config.radiusR * 0.6) {
      this.hasPassedSlit = true;
    }

    // Keep player smoothly following behind or beside orb when on north/south
    this._checkVictory();
    this._updateBeats();

    return {
      applied: true,
      blocked: false,
      orbZ: this.orbZ,
      insideSlit: this.isOrbOverlappingWallZ(this.orbZ),
      onNorthPedestal: this.isOnNorthPedestal(this.orbZ),
      completed: this.completed,
    };
  }

  _checkVictory() {
    if (this.completed) return true;
    if (this.isOnNorthPedestal(this.orbZ) && this.isRestoredFullSphere(this.thetaDeg)) {
      this.completed = true;
      this.orbZ = this.config.orbTargetZ;
      this.beat = 3;
      return true;
    }
    return false;
  }

  _updateBeats() {
    if (this.completed) {
      this.beat = 3;
      return;
    }
    // Beat 1 (奇观): discovered all-W wall persistence OR hit slit width barrier
    if (this.beat < 1 && (this.hasExploredW || this.hasBlockedAtWall)) {
      this.beat = 1;
    }
    // Beat 2 (把玩): grabbed orb and rotated into thin blade state (or opened side view after rotating 4D)
    if (
      this.beat < 2 &&
      (this.hasReachedBladeState || (this.hasRotated4DWhileGrabbed && this.hasOpenedSideView))
    ) {
      this.beat = 2;
    }
  }

  getHonestViewBadge() {
    const w = this.playerPos[3];
    const layer = w === 0 ? '原层' : `观察层 W ${w > 0 ? '+' : ''}${w.toFixed(2)}`;
    const mode = this.viewMode === 'side_xzw' ? 'side_xzw' : this.grabbed ? 'slice' : 'walk';
    if (!this.grabbed && this.canReconnectAtPedestal) {
      return { mode, title: '球已放在墙后的金色底座上', detail: '按 E 重新操控底座上的球。' };
    }
    if (!this.completed && !this.getSliceAtPlayerW().intersects) {
      return { mode, title: `${layer} · 这里没有球身`, detail: '反向拨滚轮，或按 C 回原层找到青色球。' };
    }
    if (this.hasInspectableContact) {
      return this.observedWallOverlapX !== null
        ? { mode, title: `${layer} · 球身越过了缝边`, detail: '对照同一条缝边。反向换层，看青色圆会回到哪里。' }
        : { mode, title: `${layer} · 青色截面落在缝内`, detail: '拨动滚轮沿 W 轴走，看看别处的青色圆在哪。' };
    }
    if (this.viewMode === 'side_xzw') {
      return {
        mode: 'side_xzw',
        title: `第四维侧视 · 球的半径始终是 ${this.config.radiusR.toFixed(2)}m`,
        detail: '金色外轮廓把球在各层占的位置叠在了一起。',
      };
    }
    if (this.grabbed) {
      return {
        mode: 'slice',
        title: '我们所在的三维切面 · 正在操控圆球',
        detail: w === 0 ? 'Shift + 滚轮转球 · W/S 推拉 · Tab 看侧视' : `${layer} · 滚轮沿 W 轴移动 · C 回原层`,
      };
    }
    const sign = w >= 0 ? '+' : '';
    return {
      mode: 'walk',
      title: `我们所在的三维切面 · 第四维坐标 w = ${sign}${w.toFixed(2)}`,
      detail: this.completed
        ? '巨墙已敞开，请前行踏上北侧传送台进入下一关'
        : this.hasDiscoveredAllWWall
          ? '这堵墙沿第四维 w 轴也一直延伸'
          : '把前方的青色圆球送到墙后方的金色底座上',
    };
  }
}

// ============================================================================
// Level 15 Analytical Kernel: 2-Sphere S^2 Rotated in XW & Sliced at W = c
// ============================================================================

/**
 * Exact intersection of a 2-sphere (X0^2 + Y0^2 + Z0^2 = R^2, W0 = 0)
 * rotated by angle thetaRad in the XW plane with hyperplane W = c.
 *
 * Returns null if no intersection (or if thetaRad === 0 and c !== 0).
 * When sin(thetaRad) != 0 and |c| <= R |sin(thetaRad)|:
 *   centerX = c * cot(thetaRad)
 *   radius  = sqrt(R^2 - c^2 / sin^2(thetaRad))
 */
export function computeLevel15SphereSliceCircle(thetaRad, wSlice, R = 3.0) {
  const sinT = Math.sin(thetaRad);
  const cosT = Math.cos(thetaRad);

  if (Math.abs(sinT) <= EPSILON) {
    // Sphere lies completely inside W = 0
    if (Math.abs(wSlice) <= EPSILON) {
      return { type: 'full_sphere', centerX: 0, radius: R };
    }
    return null;
  }

  const ratio = wSlice / sinT;
  const rSq = R * R - ratio * ratio;
  if (rSq < -EPSILON) {
    return null;
  }

  const centerX = (wSlice * cosT) / sinT;
  const radius = Math.sqrt(Math.max(0, rSq));
  return {
    type: 'circle',
    centerX,
    radius,
  };
}

// ============================================================================
// Level 16 Analytical Kernel: Chiral 6-Vertex Key & XW 180° Chirality Flip
// ============================================================================

/**
 * Right-handed asymmetric 6-vertex 3D key embedded in R^4 (W = 0).
 * Core tetrahedron (v0, v1, v2, v3) has signed orientation det = +1.68 > 0.
 */
export function createLevel16ChiralKeyVertices() {
  // v0 = origin, v1 = (1.4, 0, 0, 0), v2 = (0, 1.2, 0, 0), v3 = (0, 0, 1.0, 0)
  // det([v1-v0, v2-v0, v3-v0]) = 1.4 * 1.2 * 1.0 = +1.68 exactly!
  return [
    [0.0, 0.0, 0.0, 0.0], // v0: core hub
    [1.4, 0.0, 0.0, 0.0], // v1: long red +X arm
    [0.0, 1.2, 0.0, 0.0], // v2: blue +Y arm
    [0.0, 0.0, 1.0, 0.0], // v3: green +Z vertical handle
    [-0.65, 0.0, 0.0, 0.0], // v4: short red -X counter-arm (asymmetry)
    [0.0, -0.55, 0.0, 0.0], // v5: short blue -Y counter-arm (asymmetry)
  ];
}

export function transformKeySO3(verts, quat) {
  return verts.map((v) => qRotateVec3(quat, v));
}

export function transformKeyXW(verts, thetaRad) {
  return verts.map((v) => rotPlane4(v, 0, 3, thetaRad));
}

export function computeKeyChiralityDet(verts) {
  return signedOrientationDet3D([verts[0], verts[1], verts[2], verts[3]]);
}

export function computePairwiseDistances4D(verts) {
  const distances = [];
  for (let i = 0; i < verts.length; i += 1) {
    for (let j = i + 1; j < verts.length; j += 1) {
      distances.push(dist4(verts[i], verts[j]));
    }
  }
  return distances;
}
