/**
 * Beyond 3D — Chapter 1 (Tesseract 3D Boundary Shell) Automated Geometry & State Tests
 * Verifies 05-from-zero-build-plan.md §3.2 hard acceptance invariants:
 * - 8 cells, 48 directed face-transitions strictly invertible & orthogonal (< 1e-12)
 * - Antipodal graph distance = 2 with exactly 6 length-2 paths
 * - 3-cell edge holonomy loop W+ -> X+ -> Y+ -> W+ rotates tangent vectors by exactly +90°
 * - 4-cell great circle & 2-step out-and-back have 0° holonomy
 * - Hamiltonian cycle length 8 returning cleanly to W+
 * - Full deterministic puzzle verification for Prologue & Levels 1–4 (including D9 dual mode)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { det3, dist4, dot4, norm4 } from '../src/core/math4d.js';
import {
  ANTIPODAL_CELL,
  areCellsAdjacent,
  CELL_BASES,
  CELL_IDS,
  CELL_NORMALS,
  cellGraphDistance,
  findAllShortestPaths,
  getCellDoorways,
  getNeighbors,
  isValidHamiltonianCycle,
  Level1CorridorState,
  Level2AntipodalState,
  Level3HolonomyState,
  Level4HamiltonianState,
  PrologueVoyagerState,
  RECOMMENDED_HAMILTONIAN_CYCLE,
  tangent4ToCellLocal3,
  transportAlongPath,
  transportTangent4,
  ZeroGBoundaryNavigator,
} from '../src/core/tesseract-boundary.js';

const TOL = 1e-12;

test('Tesseract boundary topology: 8 cells, 48 directed invertible face-transitions, exact orthogonality', () => {
  assert.equal(CELL_IDS.length, 8);
  let directedCount = 0;

  for (const fromId of CELL_IDS) {
    const n = CELL_NORMALS[fromId];
    const [b0, b1, b2] = CELL_BASES[fromId];

    // Canonical basis is strictly orthonormal and tangent to cell normal n
    for (const b of [b0, b1, b2]) {
      assert.ok(Math.abs(norm4(b) - 1) < TOL);
      assert.ok(Math.abs(dot4(b, n)) < TOL);
    }
    assert.ok(Math.abs(dot4(b0, b1)) < TOL);
    assert.ok(Math.abs(dot4(b1, b2)) < TOL);
    assert.ok(Math.abs(dot4(b2, b0)) < TOL);

    const neighbors = getNeighbors(fromId);
    assert.equal(neighbors.length, 6);
    assert.equal(neighbors.includes(fromId), false);
    assert.equal(neighbors.includes(ANTIPODAL_CELL[fromId]), false);

    const doorways = getCellDoorways(fromId);
    assert.equal(doorways.length, 6);
    assert.equal(new Set(doorways.map((d) => d.targetCell)).size, 6);

    for (const toId of neighbors) {
      directedCount += 1;
      assert.equal(areCellsAdjacent(fromId, toId), true);
      assert.equal(areCellsAdjacent(toId, fromId), true);

      // Test arbitrary tangent vectors in fromId's tangent space
      const sampleVecs = [
        b0,
        b1,
        b2,
        [
          0.3 * b0[0] - 0.7 * b1[0] + 0.5 * b2[0],
          0.3 * b0[1] - 0.7 * b1[1] + 0.5 * b2[1],
          0.3 * b0[2] - 0.7 * b1[2] + 0.5 * b2[2],
          0.3 * b0[3] - 0.7 * b1[3] + 0.5 * b2[3],
        ],
      ];

      for (const a of sampleVecs) {
        const transported = transportTangent4(a, fromId, toId);
        // Must lie strictly in toId's tangent space
        assert.ok(Math.abs(dot4(transported, CELL_NORMALS[toId])) < TOL);
        // Must preserve 4D norm exactly
        assert.ok(Math.abs(norm4(transported) - norm4(a)) < TOL);
        // Inverse transit toId -> fromId must recover a to machine precision
        const roundTrip = transportTangent4(transported, toId, fromId);
        assert.ok(dist4(roundTrip, a) < TOL, `Inverse transport failed for ${fromId} -> ${toId}`);
      }
      // Positive 3D handedness across every face transition (never mirrors the camera/room!)
      const r3 = tangent4ToCellLocal3(toId, transportTangent4(b0, fromId, toId));
      const u3 = tangent4ToCellLocal3(toId, transportTangent4(b1, fromId, toId));
      const f3 = tangent4ToCellLocal3(toId, transportTangent4(b2, fromId, toId));
      assert.ok(Math.abs(det3(r3, u3, f3) - 1) < TOL, `Handedness flipped on ${fromId} -> ${toId}`);
    }
  }

  assert.equal(directedCount, 48, 'Tesseract boundary must have exactly 48 directed face transitions');
});

test('Antipodal distance is strictly 2 with exactly 6 length-2 paths for every opposite pair', () => {
  for (const cellId of CELL_IDS) {
    const opp = ANTIPODAL_CELL[cellId];
    assert.equal(areCellsAdjacent(cellId, opp), false);
    assert.equal(cellGraphDistance(cellId, opp), 2);

    const paths = findAllShortestPaths(cellId, opp);
    assert.equal(paths.length, 6, `Expected 6 length-2 paths from ${cellId} to ${opp}`);
    for (const p of paths) {
      assert.equal(p.length, 3);
      assert.equal(p[0], cellId);
      assert.equal(p[2], opp);
      assert.equal(areCellsAdjacent(p[0], p[1]), true);
      assert.equal(areCellsAdjacent(p[1], p[2]), true);
    }
  }
});

test('Holonomy: 3-cell edge loop W+ -> X+ -> Y+ -> W+ rotates tangent frame by exact +90°', () => {
  const loopCW = ['W+', 'X+', 'Y+', 'W+'];
  const loopCCW = ['W+', 'Y+', 'X+', 'W+'];
  const greatCircle = ['W+', 'X+', 'W-', 'X-', 'W+'];
  const outAndBack = ['W+', 'X+', 'W+'];

  const ex = [1, 0, 0, 0];
  const ey = [0, 1, 0, 0];
  const ez = [0, 0, 1, 0];

  // W+ -> X+ -> Y+ -> W+ : ex -> +ey, ey -> -ex, ez -> +ez (+90° around shared edge Z)
  assert.ok(dist4(transportAlongPath(ex, loopCW), [0, 1, 0, 0]) < TOL);
  assert.ok(dist4(transportAlongPath(ey, loopCW), [-1, 0, 0, 0]) < TOL);
  assert.ok(dist4(transportAlongPath(ez, loopCW), [0, 0, 1, 0]) < TOL);

  // Reverse loop W+ -> Y+ -> X+ -> W+ : ex -> -ey (-90°)
  assert.ok(dist4(transportAlongPath(ex, loopCCW), [0, -1, 0, 0]) < TOL);
  assert.ok(dist4(transportAlongPath(ey, loopCCW), [1, 0, 0, 0]) < TOL);

  // 4-cell great circle: 4 x 90° = 360° => exact identity
  assert.ok(dist4(transportAlongPath(ex, greatCircle), ex) < TOL);
  assert.ok(dist4(transportAlongPath(ey, greatCircle), ey) < TOL);
  assert.ok(dist4(transportAlongPath(ez, greatCircle), ez) < TOL);

  // 2-step out-and-back => exact identity
  assert.ok(dist4(transportAlongPath(ex, outAndBack), ex) < TOL);
  assert.ok(dist4(transportAlongPath(ey, outAndBack), ey) < TOL);
});

test('Hamiltonian cycle verifier validates 8-cell closed cycles and rejects invalid paths', () => {
  assert.equal(isValidHamiltonianCycle(RECOMMENDED_HAMILTONIAN_CYCLE, 'W+'), true);
  assert.equal(RECOMMENDED_HAMILTONIAN_CYCLE.length, 9);

  // Antipodal final step W- -> W+ is illegal!
  const antipodeTrap = ['W+', 'X+', 'Y+', 'Z+', 'X-', 'Y-', 'Z-', 'W-', 'W+'];
  assert.equal(isValidHamiltonianCycle(antipodeTrap, 'W+'), false);

  // Repeated cell is illegal
  const repeated = ['W+', 'X+', 'Y+', 'X+', 'W-', 'X-', 'Y-', 'Z-', 'W+'];
  assert.equal(isValidHamiltonianCycle(repeated, 'W+'), false);
});

test('Level 1 Corridor state machine: 24m 4-room loop, wave wonder, 9th room statue lock', () => {
  const s = new Level1CorridorState();
  assert.equal(s.getCellId(), 'W+');
  assert.equal(s.getStatueDirectionForRoom(1).id, 0);
  assert.equal(s.getStatueDirectionForRoom(5).id, 0);
  assert.equal(s.getStatueDirectionForRoom(9).id, 0);
  assert.equal(s.getStatueDirectionForRoom(2).id, 1);

  s.triggerLeftHandWave();
  assert.equal(s.hasWaved, true);
  assert.equal(s.beat, 1);

  // Walk straight forward 24m across W+ -> X+ -> W- -> X- -> W+
  const seen = [s.getCellId()];
  for (let i = 0; i < 24; i += 1) {
    const step = s.moveXZ(0, 1.0);
    if (step.roomChanged) seen.push(step.cellId);
  }
  assert.deepEqual(seen, ['W+', 'X+', 'W-', 'X-', 'W+']);
  assert.equal(s.hasLoopedBackToOrigin, true);
  assert.equal(s.beat, 2);

  // Wrong answer does not unlock; Room 9 == Room 1 (id 0) unlocks!
  assert.equal(s.submitLockAnswer(2).correct, false);
  assert.equal(s.completed, false);
  assert.equal(s.submitLockAnswer(0).correct, true);
  assert.equal(s.completed, true);
  assert.equal(s.beat, 3);
});

test('Level 2 Antipodal state machine: 2-step transit to W-, pickup locator, 6-path lock', () => {
  const s = new Level2AntipodalState();
  assert.equal(s.cellId, 'W+');
  // Cannot jump directly from W+ to W-
  assert.equal(s.forceTransitTo('W-').transited, false);

  // Step 1: enter neighbor X+
  assert.equal(s.forceTransitTo('X+').transited, true);
  assert.equal(s.beat, 1);
  // Step 2: enter antipode W-
  assert.equal(s.forceTransitTo('W-').transited, true);
  assert.equal(s.hasEnteredAntipode, true);

  assert.equal(s.pickupLocator().picked, true);
  assert.equal(s.beat, 2);

  assert.equal(s.submitPathCountAnswer(4).correct, false);
  assert.equal(s.submitPathCountAnswer(6).correct, true);
  assert.equal(s.completed, true);
  assert.equal(s.beat, 3);
});

test('Level 3 Holonomy state machine: primary +90° loop, reverse -90° feedback, and D9 fallback mode', () => {
  // Primary Mode (Holonomy Gyroscope)
  const s = new Level3HolonomyState({ holonomyFallback: false });
  assert.equal(s.getGyroAngleInWPlusDeg(), 0);
  assert.equal(s.tryEmbedGyroInLock().unlocked, false);

  // Reverse loop W+ -> Y+ -> X+ -> W+ gives -90° (clearly detected!)
  s.forceTransitTo('Y+');
  s.forceTransitTo('X+');
  s.forceTransitTo('W+');
  assert.equal(s.getGyroAngleInWPlusDeg(), -90);
  assert.equal(s.isGyroReversedInWPlus(), true);
  assert.equal(s.tryEmbedGyroInLock().reason, 'reversed_90');

  // Reset and run canonical +90° loop W+ -> X+ -> Y+ -> W+
  s.reset();
  s.forceTransitTo('X+');
  s.forceTransitTo('Y+');
  s.forceTransitTo('W+');
  assert.equal(s.getGyroAngleInWPlusDeg(), 90);
  assert.equal(s.isGyroAlignedForLock(), true);
  assert.equal(s.tryEmbedGyroInLock().unlocked, true);
  assert.equal(s.completed, true);
  assert.equal(s.beat, 3);

  // D9 Fallback Mode (HOLONOMY_SIMPLE_FALLBACK): following 3-room arrow loop unlocks directly
  const fb = new Level3HolonomyState({ holonomyFallback: true });
  fb.forceTransitTo('Y+');
  fb.forceTransitTo('X+');
  fb.forceTransitTo('W+');
  assert.equal(fb.fallbackLoopCompleted, true);
  assert.equal(fb.isGyroAlignedForLock(), true);
  assert.equal(fb.tryEmbedGyroInLock().unlocked, true);
});

test('Level 4 Hamiltonian state machine: trap detection, graceful reset, 8-cell cycle & rift sphere', () => {
  const s = new Level4HamiltonianState();
  assert.equal(s.litBeaconCount, 1);

  // Revisiting W+ immediately triggers graceful trail reset
  s.forceTransitTo('X+');
  assert.equal(s.litBeaconCount, 2);
  const revisit = s.forceTransitTo('W+');
  assert.equal(revisit.event.type, 'trail_reset');
  assert.equal(s.litBeaconCount, 1);

  // Antipode trap: leaving W- as 8th cell
  for (const next of ['X+', 'Y+', 'Z+', 'X-', 'Y-', 'Z-', 'W-']) {
    s.forceTransitTo(next);
  }
  assert.equal(s.litBeaconCount, 8);
  assert.equal(s.isAntipodeTrapState(), true);

  // Reset and fly valid Hamiltonian cycle W+ -> X+ -> Y+ -> Z+ -> W- -> X- -> Y- -> Z- -> W+
  s.reset();
  for (let i = 1; i < RECOMMENDED_HAMILTONIAN_CYCLE.length; i += 1) {
    const res = s.forceTransitTo(RECOMMENDED_HAMILTONIAN_CYCLE[i]);
    assert.equal(res.transited, true);
    if (i === RECOMMENDED_HAMILTONIAN_CYCLE.length - 1) {
      assert.equal(res.event.type, 'cycle_complete');
    }
  }
  assert.equal(s.riftSphereAwakened, true);
  assert.equal(s.enterRiftSphere().entered, true);
  assert.equal(s.completed, true);
  assert.equal(s.beat, 3);
});

test('ZeroGBoundaryNavigator continuous movement crosses circular airlock smoothly & preserves orthonormality', () => {
  const nav = new ZeroGBoundaryNavigator('W+');
  // Move straight forward (+X+ doorway in W+) until crossing into X+
  let crossed = false;
  for (let i = 0; i < 120; i += 1) {
    const res = nav.moveLocal(1, 0, 0, 1 / 60, 5.0);
    if (res.transited) {
      assert.equal(res.from, 'W+');
      assert.equal(res.to, 'X+');
      crossed = true;
      break;
    }
  }
  assert.equal(crossed, true);
  assert.equal(nav.cellId, 'X+');
  // Orthonormal tangent frame invariant after crossing
  const n = CELL_NORMALS['X+'];
  assert.ok(Math.abs(dot4(nav.frame.forward4, n)) < TOL);
  assert.ok(Math.abs(dot4(nav.frame.up4, n)) < TOL);
  assert.ok(Math.abs(dot4(nav.frame.right4, n)) < TOL);
  assert.ok(Math.abs(norm4(nav.frame.forward4) - 1) < TOL);
  // Prologue state completes cleanly on skip
  const p = new PrologueVoyagerState();
  p.update(7.0);
  assert.equal(p.voiceTriggered, true);
  p.skip();
  assert.equal(p.completed, true);
});

test('Zero-G anti-wall-snag airlock funnel: continuous W -> Space -> S flight completes W+ -> X+ -> Y+ -> W+ (+90°)', () => {
  const s = new Level3HolonomyState();
  // Step 1: Fly forward (+W) from W+ into X+
  for (let i = 0; i < 160 && s.cellId === 'W+'; i += 1) {
    s.stepMove(1, 0, 0, 1 / 60);
  }
  assert.equal(s.cellId, 'X+');

  // Step 2: Fly up (+Space) from X+ into Y+
  for (let i = 0; i < 160 && s.cellId === 'X+'; i += 1) {
    s.stepMove(0, 0, 1, 1 / 60);
  }
  assert.equal(s.cellId, 'Y+');

  // Step 3: Fly backward (-W / KeyS) toward W+ from Y+ entry corner (relies on magnetic airlock funnel!)
  for (let i = 0; i < 200 && s.cellId === 'Y+'; i += 1) {
    s.stepMove(-1, 0, 0, 1 / 60);
  }
  assert.equal(s.cellId, 'W+', 'Player must smoothly funnel back into W+ without getting snagged on wall rim');
  assert.equal(s.getGyroAngleInWPlusDeg(), 90);
  assert.equal(s.isGyroAlignedForLock(), true);
  assert.equal(s.tryEmbedGyroInLock().unlocked, true);
});

test('Quality Spec v1.0: Chapter 1 context-aware puzzle phases, clean L3 Frame-1 reticle & L1 portal traversal', async () => {
  const { TieredHintController } = await import('../src/core/tiered-hints.js');

  // Level 1 phases & context-aware H hints + victory portal traversal
  const s1 = new Level1CorridorState();
  const h1 = new TieredHintController(1);
  assert.equal(s1.getCurrentPuzzlePhase(), 'initial');
  assert.match(h1.requestContextHint(s1.getCurrentPuzzlePhase()).text, /挥挥左手|24/);
  for (let i = 0; i < 4; i += 1) s1.moveXZ(0, 6.0);
  assert.equal(s1.getCurrentPuzzlePhase(), 'looped_at_origin');
  assert.match(h1.requestContextHint(s1.getCurrentPuzzlePhase()).text, /第 9 间|第几间/);
  assert.equal(s1.submitLockAnswer(0).correct, true);
  const portalRes = s1.moveXZ(0, 2.3);
  assert.equal(portalRes.enteredPortal, true);

  // Level 2 phases: in_wplus -> in_neighbor -> in_wminus -> has_locator
  const s2 = new Level2AntipodalState();
  const h2 = new TieredHintController(2);
  assert.equal(s2.getCurrentPuzzlePhase(), 'in_wplus');
  assert.match(h2.requestContextHint(s2.getCurrentPuzzlePhase()).text, /6 个面|几扇门/);
  s2.forceTransitTo('X+');
  assert.equal(s2.getCurrentPuzzlePhase(), 'in_neighbor');
  s2.forceTransitTo('W-');
  assert.equal(s2.getCurrentPuzzlePhase(), 'in_wminus');
  s2.pickupLocator();
  assert.equal(s2.getCurrentPuzzlePhase(), 'has_locator');
  assert.match(h2.requestContextHint(s2.getCurrentPuzzlePhase()).text, /定位器已连接|几扇门/);

  // Level 3 clean Frame-1 reticle (not prematurely prompting lock at spawn) + aligned context hint
  const s3 = new Level3HolonomyState();
  const h3 = new TieredHintController(3);
  assert.equal(s3.canInteractLock(), false, 'Frame 1 spawn must not prematurely show lock prompt');
  assert.equal(s3.getCurrentPuzzlePhase(), 'initial');
  s3.forceTransitTo('X+');
  s3.forceTransitTo('Y+');
  s3.forceTransitTo('W+');
  assert.equal(s3.getCurrentPuzzlePhase(), 'returned_aligned');
  assert.equal(s3.canInteractLock(), true);
  assert.match(h3.requestContextHint(s3.getCurrentPuzzlePhase()).text, /嵌入|\+90°/);

  // Level 4 antipode trap phase hint
  const s4 = new Level4HamiltonianState();
  const h4 = new TieredHintController(4);
  for (const id of ['X+', 'Y+', 'Z+', 'X-', 'Y-', 'Z-', 'W-']) {
    s4.forceTransitTo(id);
  }
  assert.equal(s4.getCurrentPuzzlePhase(), 'antipode_trap');
  assert.match(h4.requestContextHint(s4.getCurrentPuzzlePhase()).text, /按 R|对跖室/);
});
