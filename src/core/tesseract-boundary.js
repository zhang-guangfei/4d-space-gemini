/**
 * Beyond 3D — Pure 4D Tesseract Boundary Mathematics & Chapter 1 State Machines
 * Zero DOM / Zero WebGL dependencies; deterministic Node.js & browser ESM.
 *
 * Implements the 3-dimensional boundary ∂[-1, 1]^4 of the regular 4D hypercube (Tesseract {4,3,3}):
 * - 8 cubic 3-cells: W+, W-, X+, X-, Y+, Y-, Z+, Z-
 * - 24 shared square 2-faces (48 directed face-transitions, octahedral graph K_{2,2,2})
 * - Exact orthogonal tangent parallel transport across a shared face from cell n to neighbor v:
 *     T_{n -> v}(a) = a - (a · v)(v + n)
 * - Exact angular deficit holonomy (±90° around any 3-cell edge loop such as W+ -> X+ -> Y+ -> W+)
 * - Pure deterministic state machines for Prologue (0) and Chapter 1 Levels 1–4 (including D9 dual mode).
 */

import { clamp, dot4, EPSILON, norm4, normalize4 } from './math4d.js';

export const CELL_HALF_SIZE = 3.0; // 6.0m x 6.0m x 6.0m cubic cells (circumference 4a = 24.0m)
export const CELL_SIZE = CELL_HALF_SIZE * 2;

export const CELL_IDS = Object.freeze(['W+', 'W-', 'X+', 'X-', 'Y+', 'Y-', 'Z+', 'Z-']);

/**
 * Outward unit 4D normal vectors for each of the 8 cubic boundary cells.
 */
export const CELL_NORMALS = Object.freeze({
  'W+': Object.freeze([0, 0, 0, 1]),
  'W-': Object.freeze([0, 0, 0, -1]),
  'X+': Object.freeze([1, 0, 0, 0]),
  'X-': Object.freeze([-1, 0, 0, 0]),
  'Y+': Object.freeze([0, 1, 0, 0]),
  'Y-': Object.freeze([0, -1, 0, 0]),
  'Z+': Object.freeze([0, 0, 1, 0]),
  'Z-': Object.freeze([0, 0, -1, 0]),
});

/**
 * Antipodal (opposite, non-adjacent) cell for each of the 8 boundary cells.
 */
export const ANTIPODAL_CELL = Object.freeze({
  'W+': 'W-',
  'W-': 'W+',
  'X+': 'X-',
  'X-': 'X+',
  'Y+': 'Y-',
  'Y-': 'Y+',
  'Z+': 'Z-',
  'Z-': 'Z+',
});

/**
 * Distinctive subtle architectural accent color per cell (used in holograms & door beacons).
 */
export const CELL_COLORS = Object.freeze({
  'W+': '#4DE6D3', // Origin cyan
  'W-': '#A78BFA', // Antipodal astral violet
  'X+': '#F7C346', // Warm amber gold
  'X-': '#F59E0B', // Deep amber
  'Y+': '#69F0AE', // Mint emerald
  'Y-': '#34D399', // Jade
  'Z+': '#58A6FF', // Sky cobalt
  'Z-': '#60A5FA', // Ice blue
});

/**
 * 3D unfolded cross-net coordinates for the 8-cell Tesseract Hologram (Dalí / standard 3D net).
 * Used by Level 2 centerpiece hologram & F-key topological map.
 */
export const UNFOLDED_NET_POS = Object.freeze({
  'W+': Object.freeze([0, 0, 0]),
  'X+': Object.freeze([1, 0, 0]),
  'X-': Object.freeze([-1, 0, 0]),
  'Y+': Object.freeze([0, 1, 0]),
  'Y-': Object.freeze([0, -1, 0]),
  'Z+': Object.freeze([0, 0, 1]),
  'Z-': Object.freeze([0, 0, -1]),
  'W-': Object.freeze([0, -2, 0]), // Attached below Y- in standard 3D tesseract net
});

/**
 * Canonical right-handed orthonormal 3-frame [right4, up4, forward4] inside each cell's tangent space n^⊥.
 * Chosen so that in W+:
 *   right   = +Z ([0,0,1,0])  (Wait: let's check Level 1 & Level 3!)
 * Actually let's choose W+ canonical frame so:
 *   axis0 (local +X, Right)   = [0, 0, 1, 0]  (Z+ door on Right, Z- door on Left)
 *   axis1 (local +Y, Up)      = [0, 1, 0, 0]  (Y+ door on Ceiling, Y- door on Floor)
 *   axis2 (local +Z, Forward) = [1, 0, 0, 0]  (X+ door Straight Ahead, X- door Behind!)
 * Let's verify 4D orientation & Level 3!
 *   In W+:
 *     Forward = X+ ([1,0,0,0])  -> Walking straight ahead in Level 1 goes W+ -> X+ -> W- -> X- -> W+!
 *     Up      = Y+ ([0,1,0,0])  -> Ceiling door is Y+!
 *     Right   = Z+ ([0,0,1,0])  -> Left/Right portholes face Z- and Z+!
 *     And in Level 3:
 *       Initial gyro pointer = +X = [1,0,0,0] ("指北 / 正前方 X+ 方向")
 *       Target gyro pointer  = +Y = [0,1,0,0] ("指天 / 上方 Y+ 方向")
 *       Flying W+ -> X+ -> Y+ -> W+ transports [1,0,0,0] -> [0,1,0,0] (+90° exact)!
 *
 * Every cell's canonical basis is chosen to satisfy det([b0, b1, b2, normal]) = +1 or -1 consistently,
 * and orthonormal (b_i · b_j = δ_ij, b_i · normal = 0).
 */
export const CELL_BASES = Object.freeze({
  'W+': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([1, 0, 0, 0]), // local +Z (Fwd   -> X+)
  ]),
  'W-': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([-1, 0, 0, 0]), // local +Z (Fwd  -> X-)
  ]),
  'X+': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([0, 0, 0, -1]), // local +Z (Fwd  -> W-)
  ]),
  'X-': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([0, 0, 0, 1]), // local +Z (Fwd   -> W+)
  ]),
  'Y+': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 0, 0, -1]), // local +Y (Up   -> W-)
    Object.freeze([1, 0, 0, 0]), // local +Z (Fwd   -> X+)
  ]),
  'Y-': Object.freeze([
    Object.freeze([0, 0, 1, 0]), // local +X (Right -> Z+)
    Object.freeze([0, 0, 0, 1]), // local +Y (Up    -> W+)
    Object.freeze([1, 0, 0, 0]), // local +Z (Fwd   -> X+)
  ]),
  'Z+': Object.freeze([
    Object.freeze([0, 0, 0, -1]), // local +X (Right -> W-)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([1, 0, 0, 0]), // local +Z (Fwd   -> X+)
  ]),
  'Z-': Object.freeze([
    Object.freeze([0, 0, 0, 1]), // local +X (Right -> W+)
    Object.freeze([0, 1, 0, 0]), // local +Y (Up    -> Y+)
    Object.freeze([1, 0, 0, 0]), // local +Z (Fwd   -> X+)
  ]),
});

/**
 * Return the 6 face-adjacent neighbor cell IDs for a given cell.
 */
export function getNeighbors(cellId) {
  if (!(cellId in CELL_NORMALS)) {
    throw new RangeError(`Unknown tesseract cell ID: ${String(cellId)}`);
  }
  const opposite = ANTIPODAL_CELL[cellId];
  return CELL_IDS.filter((id) => id !== cellId && id !== opposite);
}

/**
 * Check whether two cells share a 2D square face (adjacent in K_{2,2,2}).
 */
export function areCellsAdjacent(fromId, toId) {
  if (!(fromId in CELL_NORMALS) || !(toId in CELL_NORMALS)) return false;
  if (fromId === toId || ANTIPODAL_CELL[fromId] === toId) return false;
  return Math.abs(dot4(CELL_NORMALS[fromId], CELL_NORMALS[toId])) < EPSILON;
}

/**
 * Find the cell ID whose outward unit normal equals `dir4` (exact ±1 axis vector).
 */
export function cellIdFromNormal(dir4) {
  for (const id of CELL_IDS) {
    if (dot4(CELL_NORMALS[id], dir4) > 0.999) return id;
  }
  return null;
}

/**
 * Exact 4D orthogonal tangent-vector parallel transport across the shared 2D face
 * from cell `fromId` (normal n) into adjacent cell `toId` (normal v):
 *
 *   a' = a - (a · v)(v + n)
 *
 * Strictly preserves 4D norm, pairwise inner products, maps n^⊥ -> v^⊥, and satisfies
 * T_{v -> n}(T_{n -> v}(a)) === a for all a ∈ n^⊥.
 */
export function transportTangent4(vec4In, fromId, toId) {
  if (!areCellsAdjacent(fromId, toId)) {
    throw new RangeError(`Cannot transport across non-adjacent cells: ${fromId} -> ${toId}`);
  }
  const n = CELL_NORMALS[fromId];
  const v = CELL_NORMALS[toId];
  const av = dot4(vec4In, v);
  return [
    vec4In[0] - av * (v[0] + n[0]),
    vec4In[1] - av * (v[1] + n[1]),
    vec4In[2] - av * (v[2] + n[2]),
    vec4In[3] - av * (v[3] + n[3]),
  ];
}

/**
 * Transport a 4D tangent vector sequentially along a path of adjacent cell IDs
 * [c_0, c_1, ..., c_k].
 */
export function transportAlongPath(vec4In, pathCellIds) {
  if (!Array.isArray(pathCellIds) || pathCellIds.length < 2) {
    return [...vec4In];
  }
  let v = [...vec4In];
  for (let i = 0; i < pathCellIds.length - 1; i += 1) {
    v = transportTangent4(v, pathCellIds[i], pathCellIds[i + 1]);
  }
  return v;
}

/**
 * Convert a 4D tangent vector (orthogonal to CELL_NORMALS[cellId]) into the cell's
 * canonical 3D local coordinates [x, y, z].
 */
export function tangent4ToCellLocal3(cellId, vec4In) {
  const [b0, b1, b2] = CELL_BASES[cellId];
  return [dot4(vec4In, b0), dot4(vec4In, b1), dot4(vec4In, b2)];
}

/**
 * Convert a cell's canonical 3D local vector [x, y, z] into its 4D tangent vector in n^⊥.
 */
export function cellLocal3ToTangent4(cellId, local3) {
  const [b0, b1, b2] = CELL_BASES[cellId];
  return [
    b0[0] * local3[0] + b1[0] * local3[1] + b2[0] * local3[2],
    b0[1] * local3[0] + b1[1] * local3[1] + b2[1] * local3[2],
    b0[2] * local3[0] + b1[2] * local3[1] + b2[2] * local3[2],
    b0[3] * local3[0] + b1[3] * local3[1] + b2[3] * local3[2],
  ];
}

/**
 * Return the 6 doorway descriptors of `cellId` in canonical local 3D axes (+X,-X,+Y,-Y,+Z,-Z).
 */
export function getCellDoorways(cellId) {
  const [b0, b1, b2] = CELL_BASES[cellId];
  const defs = [
    { localAxis: '+X', localDir: [1, 0, 0], dir4: b0 },
    { localAxis: '-X', localDir: [-1, 0, 0], dir4: [-b0[0], -b0[1], -b0[2], -b0[3]] },
    { localAxis: '+Y', localDir: [0, 1, 0], dir4: b1 },
    { localAxis: '-Y', localDir: [0, -1, 0], dir4: [-b1[0], -b1[1], -b1[2], -b1[3]] },
    { localAxis: '+Z', localDir: [0, 0, 1], dir4: b2 },
    { localAxis: '-Z', localDir: [0, 0, -1], dir4: [-b2[0], -b2[1], -b2[2], -b2[3]] },
  ];
  return defs.map((d) => ({
    ...d,
    targetCell: cellIdFromNormal(d.dir4),
  }));
}

/**
 * Compute shortest path(s) between two cells in the 8-cell octahedral graph K_{2,2,2}.
 */
export function findAllShortestPaths(startId, targetId) {
  if (startId === targetId) return [[startId]];
  if (areCellsAdjacent(startId, targetId)) return [[startId, targetId]];
  // Antipodal pair: all 6 common neighbors give exact length-2 paths!
  const paths = [];
  for (const mid of getNeighbors(startId)) {
    if (areCellsAdjacent(mid, targetId)) {
      paths.push([startId, mid, targetId]);
    }
  }
  return paths;
}

/**
 * Shortest graph distance between two boundary cells (0 = same, 1 = adjacent, 2 = antipodal).
 */
export function cellGraphDistance(a, b) {
  if (a === b) return 0;
  if (areCellsAdjacent(a, b)) return 1;
  return 2;
}

/**
 * Verify whether a sequence of cell IDs forms a valid Hamiltonian cycle of length 8
 * starting and ending at `startCell` (9 entries: [start, c1, c2, ..., c7, start]).
 */
export function isValidHamiltonianCycle(sequence, startCell = 'W+') {
  if (!Array.isArray(sequence) || sequence.length !== 9) return false;
  if (sequence[0] !== startCell || sequence[8] !== startCell) return false;
  const seen = new Set();
  for (let i = 0; i < 8; i += 1) {
    const curr = sequence[i];
    const next = sequence[i + 1];
    if (seen.has(curr)) return false;
    seen.add(curr);
    if (!areCellsAdjacent(curr, next)) return false;
  }
  return seen.size === 8;
}

/**
 * Rotate a 3D frame (right4, up4, forward4) in the tangent space n^⊥ using exact Rodrigues /
 * 2-plane rotation among the player's own intrinsic axes (6-DOF Zero-G yaw / pitch / roll).
 */
export function rotateIntrinsicFrame4(frame, yawRad, pitchRad, rollRad) {
  let r = [...frame.right4];
  let u = [...frame.up4];
  let f = [...frame.forward4];

  const mix = (a, b, rad) => {
    if (Math.abs(rad) <= EPSILON) return [a, b];
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [
      [
        a[0] * c + b[0] * s,
        a[1] * c + b[1] * s,
        a[2] * c + b[2] * s,
        a[3] * c + b[3] * s,
      ],
      [
        -a[0] * s + b[0] * c,
        -a[1] * s + b[1] * c,
        -a[2] * s + b[2] * c,
        -a[3] * s + b[3] * c,
      ],
    ];
  };

  // Yaw around local Up (forward -> right)
  if (Math.abs(yawRad) > EPSILON) {
    [f, r] = mix(f, r, yawRad);
  }
  // Pitch around local Right (forward -> up)
  if (Math.abs(pitchRad) > EPSILON) {
    [f, u] = mix(f, u, pitchRad);
  }
  // Roll around local Forward (right -> up)
  if (Math.abs(rollRad) > EPSILON) {
    [r, u] = mix(r, u, rollRad);
  }

  // Gram-Schmidt re-orthonormalization inside current cell tangent space
  f = normalize4(f);
  const rf = dot4(r, f);
  r = normalize4([r[0] - rf * f[0], r[1] - rf * f[1], r[2] - rf * f[2], r[3] - rf * f[3]]);
  const uf = dot4(u, f);
  const ur = dot4(u, r);
  u = normalize4([
    u[0] - uf * f[0] - ur * r[0],
    u[1] - uf * f[1] - ur * r[1],
    u[2] - uf * f[2] - ur * r[2],
    u[3] - uf * f[3] - ur * r[3],
  ]);

  return { right4: r, up4: u, forward4: f };
}

/**
 * Given a player's current cell and intrinsic 6-DOF frame (right4, up4, forward4),
 * determine which neighboring cell lies most closely in each of the 6 egocentric directions
 * (Front, Back, Right, Left, Up, Down).
 */
export function getEgocentricCompass(cellId, frame) {
  const dirs = [
    { slot: 'front', label: '前', vec4: frame.forward4 },
    { slot: 'back', label: '后', vec4: frame.forward4.map((v) => -v) },
    { slot: 'right', label: '右', vec4: frame.right4 },
    { slot: 'left', label: '左', vec4: frame.right4.map((v) => -v) },
    { slot: 'up', label: '上', vec4: frame.up4 },
    { slot: 'down', label: '下', vec4: frame.up4.map((v) => -v) },
  ];
  const neighbors = getNeighbors(cellId);
  return dirs.map((d) => {
    let bestId = neighbors[0];
    let bestDot = -2;
    for (const nId of neighbors) {
      const dp = dot4(d.vec4, CELL_NORMALS[nId]);
      if (dp > bestDot) {
        bestDot = dp;
        bestId = nId;
      }
    }
    return {
      slot: d.slot,
      label: d.label,
      cellId: bestId,
      alignment: bestDot,
    };
  });
}

// ---------------------------------------------------------------------------
// Shared Base for Zero-G 6-DOF Boundary Navigation (Levels 2, 3, 4)
// ---------------------------------------------------------------------------

export class ZeroGBoundaryNavigator {
  constructor(startCell = 'W+', options = {}) {
    this.startCell = startCell;
    this.startLocalPos3 = options.startLocalPos3 ?? [0, 0.08, -1.85];
    this.portalRadius = options.portalRadius ?? 1.25; // 2.4m circular airlock radius with comfortable margin
    this.wallMargin = options.wallMargin ?? 0.55;
    this.reset();
  }

  reset() {
    this.cellId = this.startCell;
    this.pos4 = cellLocal3ToTangent4(this.startCell, this.startLocalPos3);
    const [b0, b1, b2] = CELL_BASES[this.startCell];
    this.frame = {
      right4: [...b0],
      up4: [...b1],
      forward4: [...b2],
    };
    this.vel4 = [0, 0, 0, 0];
    this.transitCount = 0;
    this.cellHistory = [this.startCell];
    this.lastTransit = null;
  }

  getLocalPos3() {
    return tangent4ToCellLocal3(this.cellId, this.pos4);
  }

  getLocalFrame3() {
    return {
      right: tangent4ToCellLocal3(this.cellId, this.frame.right4),
      up: tangent4ToCellLocal3(this.cellId, this.frame.up4),
      forward: tangent4ToCellLocal3(this.cellId, this.frame.forward4),
    };
  }

  rotateLook(yawRad, pitchRad, rollRad = 0) {
    this.frame = rotateIntrinsicFrame4(this.frame, yawRad, pitchRad, rollRad);
    // Keep strictly orthogonal to current cell normal
    const n = CELL_NORMALS[this.cellId];
    for (const key of ['right4', 'up4', 'forward4']) {
      const v = this.frame[key];
      const dn = dot4(v, n);
      this.frame[key] = normalize4([
        v[0] - dn * n[0],
        v[1] - dn * n[1],
        v[2] - dn * n[2],
        v[3] - dn * n[3],
      ]);
    }
  }

  /**
   * Move in 6-DOF Zero-G space with seamless circular-airlock portal transitions into
   * neighboring tesseract boundary cells.
   */
  moveLocal(forwardAmt, rightAmt, upAmt, dtSec = 1 / 60, speed = 4.6) {
    const accel = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) {
      accel[i] =
        this.frame.forward4[i] * forwardAmt +
        this.frame.right4[i] * rightAmt +
        this.frame.up4[i] * upAmt;
    }
    const len = norm4(accel);
    const targetVel = len > EPSILON ? accel.map((v) => (v / len) * speed) : [0, 0, 0, 0];

    // Smooth inertial Zero-G thruster feel (responsive yet weightless)
    const damp = 1 - Math.exp(-7.5 * dtSec);
    for (let i = 0; i < 4; i += 1) {
      this.vel4[i] += (targetVel[i] - this.vel4[i]) * damp;
      this.pos4[i] += this.vel4[i] * dtSec;
    }

    // Project pos4 strictly onto current cell hyperplane n^⊥
    const n = CELL_NORMALS[this.cellId];
    const dn = dot4(this.pos4, n);
    for (let i = 0; i < 4; i += 1) {
      this.pos4[i] -= dn * n[i];
    }

    return this._resolveBoundaryOrTransit();
  }

  /**
   * Direct programmatic transit through a face doorway to an adjacent cell (useful for both
   * smooth crossing and deterministic tests).
   */
  forceTransitTo(targetCellId) {
    if (!areCellsAdjacent(this.cellId, targetCellId)) {
      return { transited: false, from: this.cellId, to: this.cellId };
    }
    const fromId = this.cellId;
    const nFrom = CELL_NORMALS[fromId];
    const vTo = CELL_NORMALS[targetCellId];

    // Place player just inside the target cell's entry face (+nFrom * (H - 0.35))
    const pDotV = dot4(this.pos4, vTo);
    const pTang = [
      this.pos4[0] - pDotV * vTo[0],
      this.pos4[1] - pDotV * vTo[1],
      this.pos4[2] - pDotV * vTo[2],
      this.pos4[3] - pDotV * vTo[3],
    ];
    const entryDist = CELL_HALF_SIZE - 0.35;
    this.pos4 = [
      pTang[0] + entryDist * nFrom[0],
      pTang[1] + entryDist * nFrom[1],
      pTang[2] + entryDist * nFrom[2],
      pTang[3] + entryDist * nFrom[3],
    ];

    this.frame = {
      right4: normalize4(transportTangent4(this.frame.right4, fromId, targetCellId)),
      up4: normalize4(transportTangent4(this.frame.up4, fromId, targetCellId)),
      forward4: normalize4(transportTangent4(this.frame.forward4, fromId, targetCellId)),
    };
    this.vel4 = transportTangent4(this.vel4, fromId, targetCellId);
    this.cellId = targetCellId;
    this.transitCount += 1;
    this.cellHistory.push(targetCellId);
    this.lastTransit = { from: fromId, to: targetCellId };
    return { transited: true, from: fromId, to: targetCellId };
  }

  _resolveBoundaryOrTransit() {
    const H = CELL_HALF_SIZE;
    const limit = H - this.wallMargin;
    const neighbors = getNeighbors(this.cellId);

    // Check if the player has flown past any face boundary through a circular airlock opening
    let bestExceed = 0;
    let targetNeighbor = null;
    for (const nId of neighbors) {
      const v = CELL_NORMALS[nId];
      const coord = dot4(this.pos4, v);
      if (coord > limit) {
        // Compute radial distance from the center of this circular airlock face
        let radialSq = 0;
        for (let i = 0; i < 4; i += 1) {
          const comp = this.pos4[i] - coord * v[i];
          radialSq += comp * comp;
        }
        const radial = Math.sqrt(radialSq);
        if (radial <= this.portalRadius) {
          // Inside airlock aperture! Allow smoothly flying all the way to H and crossing!
          if (coord >= H && coord - H > bestExceed) {
            bestExceed = coord - H;
            targetNeighbor = nId;
          }
        } else {
          // Hit bulkhead outside the circular airlock frame -> clamp cleanly
          const excess = coord - limit;
          for (let i = 0; i < 4; i += 1) {
            this.pos4[i] -= excess * v[i];
          }
          const vDot = dot4(this.vel4, v);
          if (vDot > 0) {
            for (let i = 0; i < 4; i += 1) {
              this.vel4[i] -= vDot * v[i];
            }
          }
        }
      }
    }

    if (targetNeighbor) {
      const fromId = this.cellId;
      const nFrom = CELL_NORMALS[fromId];
      const vTo = CELL_NORMALS[targetNeighbor];
      const coord = dot4(this.pos4, vTo);
      const excess = clamp(coord - H, 0.02, 0.8);

      const pTang = [
        this.pos4[0] - coord * vTo[0],
        this.pos4[1] - coord * vTo[1],
        this.pos4[2] - coord * vTo[2],
        this.pos4[3] - coord * vTo[3],
      ];

      this.pos4 = [
        pTang[0] + (H - excess) * nFrom[0],
        pTang[1] + (H - excess) * nFrom[1],
        pTang[2] + (H - excess) * nFrom[2],
        pTang[3] + (H - excess) * nFrom[3],
      ];
      this.frame = {
        right4: normalize4(transportTangent4(this.frame.right4, fromId, targetNeighbor)),
        up4: normalize4(transportTangent4(this.frame.up4, fromId, targetNeighbor)),
        forward4: normalize4(transportTangent4(this.frame.forward4, fromId, targetNeighbor)),
      };
      this.vel4 = transportTangent4(this.vel4, fromId, targetNeighbor);
      this.cellId = targetNeighbor;
      this.transitCount += 1;
      this.cellHistory.push(targetNeighbor);
      this.lastTransit = { from: fromId, to: targetNeighbor };
      return { transited: true, from: fromId, to: targetNeighbor };
    }

    return { transited: false, from: this.cellId, to: this.cellId };
  }
}

// ---------------------------------------------------------------------------
// Prologue State (Level 0: 迷航)
// ---------------------------------------------------------------------------

export class PrologueVoyagerState {
  constructor() {
    this.reset();
  }

  reset() {
    this.levelId = 0;
    this.elapsedSec = 0;
    this.totalDurationSec = 17.5;
    this.completed = false;
    this.skipped = false;
    this.beat = 1;
    this.voiceTriggered = false;
  }

  update(dtSec) {
    if (this.completed) return { phase: 'done', justCompleted: false, triggerVoice: false };
    this.elapsedSec += dtSec;
    let triggerVoice = false;
    if (!this.voiceTriggered && this.elapsedSec >= 6.8) {
      this.voiceTriggered = true;
      triggerVoice = true;
    }
    if (this.elapsedSec >= this.totalDurationSec) {
      this.completed = true;
      return { phase: 'done', justCompleted: true, triggerVoice };
    }
    const phase =
      this.elapsedSec < 3.5
        ? 'warp_alarm'
        : this.elapsedSec < 9.0
          ? 'stars_extinguish'
          : this.elapsedSec < 14.5
            ? 'white_grid'
            : 'fade_in_corridor';
    return { phase, justCompleted: false, triggerVoice };
  }

  skip() {
    this.skipped = true;
    this.completed = true;
    this.elapsedSec = this.totalDurationSec;
  }
}

// ---------------------------------------------------------------------------
// Level 1 State: 前方的人 (Idea #1 — 4-Cell Straight Loop & Same-Side Self-Silhouette)
// ---------------------------------------------------------------------------

export const LEVEL1_LOOP_CELLS = Object.freeze(['W+', 'X+', 'W-', 'X-']);
export const LEVEL1_STATUE_DIRECTIONS = Object.freeze([
  { id: 0, label: '正面朝内', arrow: '↓ 面对走廊', angleDeg: 0 },
  { id: 1, label: '朝向前方', arrow: '→ 顺时针 90°', angleDeg: 90 },
  { id: 2, label: '背面朝外', arrow: '↑ 顺时针 180°', angleDeg: 180 },
  { id: 3, label: '朝向后方', arrow: '← 顺时针 270°', angleDeg: 270 },
]);

export class Level1CorridorState {
  constructor() {
    this.circumference = CELL_SIZE * 4; // 24.0m
    this.reset();
  }

  reset() {
    this.levelId = 1;
    // Continuous loop position zLoop ∈ [0, 24) m, where 0 is center of W+, 6 is X+, 12 is W-, 18 is X-
    this.loopZ = 0.0;
    this.unwrappedZ = 0.0; // Total forward progress (m)
    this.playerX = 0.0; // Lateral offset inside corridor [-2.2, +2.2]
    this.playerY = 1.72;
    this.waveTimer = 0; // >0 while waving left hand (red armband)
    this.hasWaved = false;
    this.hasLoopedBackToOrigin = false;
    this.visitedRoomIndices = new Set([0]);
    this.maxRoomIndexReached = 0;
    this.listenedRecorder = false;
    this.viewedHypotheses = new Set();
    this.dialSelection = 1; // Deliberately starts off the answer (0) so player consciously picks
    this.lockAttempts = 0;
    this.completed = false;
    this.beat = 0; // 0 -> 1 (wonder) -> 2 (play/loop) -> 3 (solved)
    this.telescopeActive = false;
  }

  getRoomIndex() {
    // Center of room k is at k * 6.0m; boundary between room k and k+1 is at k*6 + 3
    const shifted = ((this.loopZ + CELL_HALF_SIZE) % this.circumference + this.circumference) % this.circumference;
    return Math.floor(shifted / CELL_SIZE) % 4;
  }

  getCellId() {
    return LEVEL1_LOOP_CELLS[this.getRoomIndex()];
  }

  getLocalZInCell() {
    const idx = this.getRoomIndex();
    let dz = this.loopZ - idx * CELL_SIZE;
    if (dz > this.circumference * 0.5) dz -= this.circumference;
    if (dz < -this.circumference * 0.5) dz += this.circumference;
    return dz;
  }

  /**
   * Orientation index (0..3) of the bronze statue outside the left porthole of room number `roomNum` (1-indexed).
   * Period = 4: room 1, 5, 9 all share direction 0!
   */
  getStatueDirectionForRoom(roomNumber1Indexed) {
    const idx = ((roomNumber1Indexed - 1) % 4 + 4) % 4;
    return LEVEL1_STATUE_DIRECTIONS[idx];
  }

  triggerLeftHandWave() {
    this.waveTimer = 1.65;
    this.hasWaved = true;
    this._recomputeBeat();
    return { waving: true };
  }

  stepWave(dtSec) {
    if (this.waveTimer > 0) {
      this.waveTimer = Math.max(0, this.waveTimer - dtSec);
    }
  }

  moveXZ(dx, dz) {
    const prevIdx = this.getRoomIndex();
    this.playerX = clamp(this.playerX + dx, -2.1, 2.1);
    this.unwrappedZ += dz;
    this.loopZ = ((this.loopZ + dz) % this.circumference + this.circumference) % this.circumference;
    const nextIdx = this.getRoomIndex();
    this.visitedRoomIndices.add(nextIdx);

    if (Math.abs(this.unwrappedZ) >= this.circumference - 2.0 && nextIdx === 0 && this.visitedRoomIndices.size >= 4) {
      this.hasLoopedBackToOrigin = true;
    }
    this._recomputeBeat();
    return {
      roomChanged: prevIdx !== nextIdx,
      prevCell: LEVEL1_LOOP_CELLS[prevIdx],
      cellId: LEVEL1_LOOP_CELLS[nextIdx],
      roomIndex: nextIdx,
      justLooped: this.hasLoopedBackToOrigin && prevIdx !== nextIdx && nextIdx === 0,
    };
  }

  /**
   * Check nearest interactable in W+ cabin (Recorder, Lock Console, or 3 Optional Hypothesis Stands).
   */
  getNearestInteractable() {
    if (this.getRoomIndex() !== 0) return null;
    const lx = this.playerX;
    const lz = this.getLocalZInCell();
    const candidates = [
      { id: 'lock', label: '[E] 操控主控密码锁', x: 1.65, z: 1.75, radius: 1.85 },
      { id: 'recorder', label: '[E] 播放林夏全息录音', x: -1.65, z: 1.4, radius: 1.85 },
      { id: 'hyp_ring', label: '[E] 猜想笔记 A：环形大厅', x: -1.85, z: -1.3, radius: 1.55 },
      { id: 'hyp_belt', label: '[E] 猜想笔记 B：跑步机传送带', x: 0.0, z: -2.05, radius: 1.55 },
      { id: 'hyp_sphere', label: '[E] 猜想笔记 C：闭合三维边界', x: 1.85, z: -1.3, radius: 1.55 },
    ];
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(lx - c.x, lz - c.z);
      if (d <= c.radius && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  submitLockAnswer(directionId) {
    this.dialSelection = directionId;
    this.lockAttempts += 1;
    // Room 9 => (9 - 1) % 4 = 0 (same as Room 1 W+)
    const expected = this.getStatueDirectionForRoom(9).id;
    if (directionId === expected) {
      this.completed = true;
      this.beat = 3;
      return { correct: true, expected };
    }
    return { correct: false, expected };
  }

  _recomputeBeat() {
    if (this.completed) {
      this.beat = 3;
      return;
    }
    if (this.hasLoopedBackToOrigin || this.visitedRoomIndices.size >= 3) {
      this.beat = Math.max(this.beat, 2);
    } else if (this.hasWaved || Math.abs(this.unwrappedZ) >= 3.2) {
      this.beat = Math.max(this.beat, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Level 2 State: 没有门通向对面 (Idea #2 — 6 Neighbors & Antipodal Blind Spot)
// ---------------------------------------------------------------------------

export class Level2AntipodalState {
  constructor() {
    this.nav = new ZeroGBoundaryNavigator('W+');
    this.reset();
  }

  reset() {
    this.levelId = 2;
    this.nav.reset();
    this.visitedCells = new Set(['W+']);
    this.hasEnteredNeighbor = false;
    this.hasEnteredAntipode = false;
    this.hasPickedLocator = false;
    this.lockUnlocked = false;
    this.completed = false;
    this.beat = 0;
    this.telescopeActive = false;
  }

  get cellId() {
    return this.nav.cellId;
  }

  stepMove(forward, right, up, dtSec) {
    const res = this.nav.moveLocal(forward, right, up, dtSec);
    if (res.transited) {
      this._onCellEnter(res.to);
    }
    return res;
  }

  forceTransitTo(cellId) {
    const res = this.nav.forceTransitTo(cellId);
    if (res.transited) {
      this._onCellEnter(res.to);
    }
    return res;
  }

  _onCellEnter(cellId) {
    this.visitedCells.add(cellId);
    if (cellId !== 'W+' && cellId !== 'W-') {
      this.hasEnteredNeighbor = true;
    }
    if (cellId === 'W-') {
      this.hasEnteredAntipode = true;
    }
    this._recomputeBeat();
  }

  canPickupLocator() {
    if (this.hasPickedLocator || this.cellId !== 'W-') return false;
    const [x, y, z] = this.nav.getLocalPos3();
    return Math.hypot(x, y, z) <= 2.35;
  }

  pickupLocator() {
    if (this.cellId !== 'W-') return { picked: false };
    this.hasPickedLocator = true;
    this._recomputeBeat();
    return { picked: true };
  }

  canOpenTopologyLock() {
    if (!this.hasPickedLocator || this.completed) return false;
    // Allow answering immediately via locator hologram OR back at W+ central console!
    return true;
  }

  submitPathCountAnswer(count) {
    const exactPaths = findAllShortestPaths('W+', 'W-');
    if (Number(count) === exactPaths.length) {
      this.lockUnlocked = true;
      this.completed = true;
      this.beat = 3;
      return { correct: true, expected: exactPaths.length };
    }
    return { correct: false, expected: exactPaths.length };
  }

  _recomputeBeat() {
    if (this.completed) {
      this.beat = 3;
      return;
    }
    if (this.hasPickedLocator || this.hasEnteredAntipode) {
      this.beat = Math.max(this.beat, 2);
    } else if (this.hasEnteredNeighbor || this.nav.transitCount >= 1) {
      this.beat = Math.max(this.beat, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Level 3 State: 哪边是上 (Idea #3 — 3-Cell Edge Holonomy ±90° & D9 Dual Mode)
// ---------------------------------------------------------------------------

export const HOLONOMY_SIMPLE_FALLBACK_DEFAULT = false;

export class Level3HolonomyState {
  constructor(options = {}) {
    this.nav = new ZeroGBoundaryNavigator('W+');
    this.holonomyFallback = Boolean(options.holonomyFallback ?? HOLONOMY_SIMPLE_FALLBACK_DEFAULT);
    this.reset();
  }

  setFallbackMode(enabled) {
    this.holonomyFallback = Boolean(enabled);
  }

  reset() {
    this.levelId = 3;
    this.nav.reset();
    // Initial locked gyroscope pointer in W+: points along +X ([1,0,0,0], local Forward / North)
    this.initialGyro4 = [1, 0, 0, 0];
    this.targetGyro4InWPlus = [0, 1, 0, 0]; // Target in W+: +Y (Up / "指天", +90° holonomy!)
    this.gyro4 = [...this.initialGyro4];
    this.loopTrail = ['W+'];
    this.hasObservedShift = false;
    this.fallbackLoopCompleted = false;
    this.completed = false;
    this.beat = 0;
    this.telescopeActive = false;
  }

  get cellId() {
    return this.nav.cellId;
  }

  /**
   * Gyro pointer in the current cell's canonical 3D basis [x, y, z].
   */
  getGyroLocal3() {
    return tangent4ToCellLocal3(this.cellId, this.gyro4);
  }

  /**
   * Signed calibration angle in W+ relative to initial pointer +X in the XY plane:
   *  +X -> 0°, +Y -> +90° (ALIGNED!), -X -> 180°, -Y -> -90° (reversed loop!).
   */
  getGyroAngleInWPlusDeg() {
    if (this.cellId !== 'W+') return null;
    const xComp = dot4(this.gyro4, [1, 0, 0, 0]);
    const yComp = dot4(this.gyro4, [0, 1, 0, 0]);
    const zComp = dot4(this.gyro4, [0, 0, 1, 0]);
    if (Math.abs(zComp) > 0.7) {
      return zComp > 0 ? 90 : -90; // Out-of-plane 90° rotation
    }
    return Math.round((Math.atan2(yComp, xComp) * 180) / Math.PI);
  }

  isGyroAlignedForLock() {
    if (this.cellId !== 'W+') return false;
    if (this.holonomyFallback && this.fallbackLoopCompleted) return true;
    return dot4(this.gyro4, this.targetGyro4InWPlus) > 0.98;
  }

  isGyroReversedInWPlus() {
    if (this.cellId !== 'W+') return false;
    return dot4(this.gyro4, [0, -1, 0, 0]) > 0.98;
  }

  stepMove(forward, right, up, dtSec) {
    const res = this.nav.moveLocal(forward, right, up, dtSec);
    if (res.transited) {
      this._onTransit(res.from, res.to);
    }
    return res;
  }

  forceTransitTo(targetCellId) {
    const res = this.nav.forceTransitTo(targetCellId);
    if (res.transited) {
      this._onTransit(res.from, res.to);
    }
    return res;
  }

  _onTransit(fromId, toId) {
    // EXACT 4D parallel transport of the magnetically locked gyroscope pointer!
    this.gyro4 = normalize4(transportTangent4(this.gyro4, fromId, toId));
    this.loopTrail.push(toId);
    if (this.loopTrail.length > 16) this.loopTrail.shift();

    // Detect completion of the canonical 3-room fluorescent arrow loop W+ -> X+ -> Y+ -> W+
    const recent4 = this.loopTrail.slice(-4).join('>');
    if (recent4 === 'W+>X+>Y+>W+' || recent4 === 'W+>Y+>X+>W+') {
      this.fallbackLoopCompleted = true;
    }

    if (toId === 'W+' && dot4(this.gyro4, this.initialGyro4) < 0.95) {
      this.hasObservedShift = true;
    }
    this._recomputeBeat();
  }

  canInteractLock() {
    if (this.cellId !== 'W+' || this.completed) return false;
    const [x, y, z] = this.nav.getLocalPos3();
    return Math.hypot(x, y, z) <= 2.4;
  }

  tryEmbedGyroInLock() {
    if (this.cellId !== 'W+') {
      return { unlocked: false, reason: 'not_in_w_plus' };
    }
    if (this.isGyroAlignedForLock()) {
      this.completed = true;
      this.beat = 3;
      return { unlocked: true, reason: 'aligned' };
    }
    if (this.isGyroReversedInWPlus()) {
      return { unlocked: false, reason: 'reversed_90' };
    }
    return { unlocked: false, reason: 'not_aligned' };
  }

  _recomputeBeat() {
    if (this.completed) {
      this.beat = 3;
      return;
    }
    if (this.isGyroAlignedForLock() || this.hasObservedShift || this.fallbackLoopCompleted) {
      this.beat = Math.max(this.beat, 2);
    } else if (this.nav.transitCount >= 1) {
      this.beat = Math.max(this.beat, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Level 4 State: 一笔走完 (Idea #4 — 8-Cell Hamiltonian Cycle & Mercury Rift Sphere)
// ---------------------------------------------------------------------------

export const RECOMMENDED_HAMILTONIAN_CYCLE = Object.freeze([
  'W+',
  'X+',
  'Y+',
  'Z+',
  'W-',
  'X-',
  'Y-',
  'Z-',
  'W+',
]);

export class Level4HamiltonianState {
  constructor() {
    this.nav = new ZeroGBoundaryNavigator('W+', { startLocalPos3: [0, 0.24, -2.38] });
    this.reset();
  }

  reset() {
    this.levelId = 4;
    this.nav.reset();
    this.trail = ['W+'];
    this.visited = new Set(['W+']);
    this.riftSphereAwakened = false;
    this.completed = false;
    this.resetCount = 0;
    this.lastEvent = null;
    this.beat = 0;
    this.telescopeActive = false;
  }

  get cellId() {
    return this.nav.cellId;
  }

  get litBeaconCount() {
    return this.visited.size;
  }

  /**
   * Status of a neighboring cell for doorway compass plaques:
   *  - 'unvisited' (★)
   *  - 'visited'   (✗)
   *  - 'finish'    (◈ Return to W+ to complete 8-cell cycle!)
   */
  getDoorwayStatus(targetCellId) {
    if (this.riftSphereAwakened) return 'awakened';
    if (this.visited.size === 8 && targetCellId === 'W+') return 'finish';
    return this.visited.has(targetCellId) ? 'visited' : 'unvisited';
  }

  /**
   * True when the player made the classic trap mistake of leaving W- as the 8th room
   * (cannot step directly from W- back to W+!).
   */
  isAntipodeTrapState() {
    return !this.riftSphereAwakened && this.visited.size === 8 && this.cellId === 'W-';
  }

  stepMove(forward, right, up, dtSec) {
    const res = this.nav.moveLocal(forward, right, up, dtSec);
    let event = null;
    if (res.transited) {
      event = this._onCellEntered(res.to);
    }
    // Check flying into awakened 2.2m Mercury Rift Sphere at center of W+
    let enteredRift = false;
    if (this.riftSphereAwakened && !this.completed && this.cellId === 'W+') {
      const [x, y, z] = this.nav.getLocalPos3();
      if (Math.hypot(x, y, z) <= 1.45) {
        this.completed = true;
        this.beat = 3;
        enteredRift = true;
      }
    }
    return { ...res, event, enteredRift };
  }

  forceTransitTo(targetCellId) {
    const res = this.nav.forceTransitTo(targetCellId);
    let event = null;
    if (res.transited) {
      event = this._onCellEntered(res.to);
    }
    return { ...res, event };
  }

  enterRiftSphere() {
    if (!this.riftSphereAwakened || this.cellId !== 'W+') return { entered: false };
    this.completed = true;
    this.beat = 3;
    return { entered: true };
  }

  _onCellEntered(cellId) {
    if (this.riftSphereAwakened) {
      this.lastEvent = { type: 'roam', cellId };
      return this.lastEvent;
    }

    // Victory condition: all 8 rooms lit and stepping back into W+ on step 8!
    if (this.visited.size === 8 && cellId === 'W+') {
      this.trail.push('W+');
      if (isValidHamiltonianCycle(this.trail, 'W+')) {
        this.riftSphereAwakened = true;
        this.beat = Math.max(this.beat, 2);
        this.lastEvent = { type: 'cycle_complete', cellId: 'W+' };
        return this.lastEvent;
      }
    }

    // Revisiting an already-lit room -> graceful zero-punishment reset of Hamiltonian trail
    if (this.visited.has(cellId)) {
      this.resetCount += 1;
      // Keep player seamlessly where they are? Wait: start fresh from W+ if they returned to W+,
      // or reset beacons so player starts a clean cycle from W+!
      this.trail = [cellId];
      this.visited = new Set([cellId]);
      // If they reset inside a non-W+ cell, teleport cleanly back to W+ origin so cycle always starts at W+
      if (cellId !== 'W+') {
        this.nav.reset();
        this.trail = ['W+'];
        this.visited = new Set(['W+']);
      }
      this.lastEvent = { type: 'trail_reset', revisited: cellId };
      this._recomputeBeat();
      return this.lastEvent;
    }

    // New unvisited room! Light its dome Star-Ring beacon!
    this.visited.add(cellId);
    this.trail.push(cellId);
    const trap = this.isAntipodeTrapState();
    this.lastEvent = {
      type: trap ? 'antipode_trap' : 'beacon_lit',
      cellId,
      litCount: this.visited.size,
    };
    this._recomputeBeat();
    return this.lastEvent;
  }

  _recomputeBeat() {
    if (this.completed) {
      this.beat = 3;
      return;
    }
    if (this.riftSphereAwakened || this.visited.size >= 5) {
      this.beat = Math.max(this.beat, 2);
    } else if (this.visited.size >= 2) {
      this.beat = Math.max(this.beat, 1);
    }
  }
}
