/**
 * Beyond 3D — Level 14 "发丝裂缝" State Machine, Tiered Hints (All 18 Levels), & Render Invariant Tests
 * Enforces 05-from-zero-build-plan.md §1.3 & §3.3.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEVEL14_CONFIG,
  Level14HairlineSlitState,
} from '../src/core/sanctuary-4d.js';
import {
  LEVEL_HINTS,
  STAGNATION_THRESHOLD_SEC,
  TieredHintController,
} from '../src/core/tiered-hints.js';
import {
  assertGhostMaterialInvariants,
  getGhostMaterialSpec,
  getSolidMaterialSpec,
} from '../src/engine/phase-materials.js';

test('Level 14 Beat 1 (奇观): monolith wall blocks player in ALL W slices', () => {
  const s = new Level14HairlineSlitState();
  assert.equal(s.beat, 0);

  // Shift player along W to +1.8 and -1.8: monolith remains solid across ALL W!
  const wPos = s.shiftPlayerW(1.8);
  assert.equal(wPos.monolithStillSolid, true);
  assert.equal(s.hasExploredW, true);
  assert.equal(s.beat, 1, 'Exploring W axis should naturally light Beat 1 (奇观)');

  // Even at W = +1.8, player cannot walk through Z in [-1.2, +1.2]
  s.playerPos = [0, 1.7, -1.6, 1.8];
  const move = s.movePlayerXZ(0, 1.0);
  assert.equal(move.blockedByWall, true, 'All-W monolith wall must block player at W = +1.8');
  assert.ok(move.z < LEVEL14_CONFIG.wallZMin);

  s.playerPos = [0, 1.7, -1.6, -1.8];
  const moveNeg = s.movePlayerXZ(0, 1.0);
  assert.equal(moveNeg.blockedByWall, true, 'All-W monolith wall must block player at W = -1.8');
});

test('Level 14 Beat 2 & 3 (把玩 → 运用): 3D drag never narrows orb, 90° blade passes slit, expanding inside slit is honestly blocked, north restore wins', () => {
  const s = new Level14HairlineSlitState();

  // Move close to orb on South Pedestal (Z = -3.2) and grab it
  s.playerPos = [0, 1.7, -4.4, 0];
  assert.equal(s.canGrabOrb(), true);
  const grab = s.setGrabbed(true);
  assert.equal(grab.grabbed, true);

  // 1. Pure 3D SO(3) mouse drag NEVER reduces xMax!
  const dragRes = s.rotateOrb3D(1.3, -0.9);
  assert.equal(dragRes.rotated, true);
  assert.ok(Math.abs(dragRes.xMax - 1.0) < 1e-12, '3D rotation must NEVER alter sphere X half-width');

  // 2. Pushing 2.0m sphere into 0.164m slit is blocked cleanly
  const blockedPush = s.pushOrbZ(2.5);
  assert.equal(blockedPush.blocked, true);
  assert.equal(blockedPush.reason, 'too_wide_for_slit');
  assert.ok(s.orbZ <= LEVEL14_CONFIG.wallZMin - LEVEL14_CONFIG.radiusR + 1e-6);

  // 3. Scroll wheel 4D rotation around YZ plane to 90° narrows orb to 0.035m half-width blade!
  const rotRes = s.rotateOrb4D(90);
  assert.equal(rotRes.applied, true);
  assert.equal(rotRes.isBlade, true);
  assert.ok(rotRes.extents.xMax <= 0.036);
  assert.equal(s.beat, 2, 'Rotating into blade state should naturally light Beat 2 (把玩)');

  // Verify Honest Dual View toggle (Tab) and clean Level 14 terminology (zero "W=0" jargon)
  const sliceBadge = s.getHonestViewBadge();
  assert.equal(sliceBadge.mode, 'slice');
  assert.doesNotMatch(sliceBadge.title + sliceBadge.detail, /W\s*=\s*0/i);
  s.toggleViewMode();
  const sideBadge = s.getHonestViewBadge();
  assert.equal(sideBadge.mode, 'side_xzw');
  assert.match(sideBadge.title, /1\.00m/);
  assert.doesNotMatch(sideBadge.title + sideBadge.detail, /W\s*=\s*0/i);
  s.toggleViewMode();

  // 4. Push thin blade into the middle of the hairline slit (Z = 0.0)
  const intoSlit = s.pushOrbZ(2.2); // from -2.2 -> 0.0
  assert.equal(intoSlit.blocked, false);
  assert.equal(s.isOrbInsideSlit(), true);

  // 5. HONEST COLLISION RULE: trying to un-rotate toward 0° while INSIDE slit must be blocked!
  const expandAttempt = s.rotateOrb4D(-30); // 90° -> 60°, xMax = 0.50m >> 0.082m
  assert.equal(expandAttempt.blocked, true);
  assert.equal(expandAttempt.reason, 'slit_expand_blocked');
  assert.equal(s.thetaDeg, 90, 'Theta must remain safely unchanged when blocked by slit walls');

  // 6. Push blade all the way out to North Golden Pedestal (Z = +3.2)
  const toNorth = s.pushOrbZ(3.2);
  assert.equal(toNorth.blocked, false);
  assert.equal(s.isOnNorthPedestal(), true);
  assert.equal(s.completed, false, 'Still thin blade — must rotate back to 0°/180° to complete!');

  // 7. Rotate back to 0° (or 180°) on North Pedestal -> Victory (Key unlocks walls!)
  const restore = s.rotateOrb4D(-90);
  assert.equal(restore.applied, true);
  assert.equal(restore.completed, true);
  assert.equal(s.completed, true);
  assert.equal(s.beat, 3, 'Restoring full sphere on North Pedestal completes Beat 3 (运用)');

  // 8. Regression test: releasing grab (E) AFTER victory must ALWAYS succeed & never trap player behind wall!
  const release = s.setGrabbed(false);
  assert.equal(release.grabbed, false);
  assert.equal(s.grabbed, false);
  assert.ok(s.playerPos[2] < LEVEL14_CONFIG.wallZMin, 'Released player must return cleanly to South side');

  // 9. Key-opens-wall & Teleporter progression: monolith opens so player walks through Z=0 onto Teleporter (Z=11.2) in 2x hall!
  assert.ok(LEVEL14_CONFIG.hallHalfX >= 14.0, 'Expanded hall must be >= 2x wider');
  assert.ok(LEVEL14_CONFIG.hallMaxZ - LEVEL14_CONFIG.hallMinZ >= 34.0, 'Expanded hall must be >= 2x longer');
  assert.equal(s.isPlayerBlockedByMonolith(0, 0), false, 'Monolith wall must open automatically after victory');
  s.playerPos = [0, 1.85, -3.5, 0];
  let reachedPortal = false;
  for (let step = 0; step < 45; step += 1) {
    const walkRes = s.movePlayerXZ(0, 0.45);
    assert.equal(walkRes.blockedByWall, false, 'Opened monolith must allow unobstructed passage');
    if (walkRes.justEnteredTeleporter) {
      reachedPortal = true;
      break;
    }
  }
  assert.equal(reachedPortal, true, 'Walking north past opened walls must trigger North Teleportation Pad');
  assert.equal(s.enteredTeleporter, true);
});

test('TieredHintController: all 18 levels have complete 3-tier oral hints & 45s stagnation timer works', () => {
  // Every single level 1..18 must have opening + 3 distinct non-empty tiers with valid speaker
  for (let id = 1; id <= 18; id += 1) {
    const entry = LEVEL_HINTS[id];
    assert.ok(entry, `Missing hint script for level ${id}`);
    assert.ok(entry.opening && entry.opening.text.length > 0);
    assert.equal(entry.tiers.length, 3, `Level ${id} must have exactly 3 progressive hint tiers`);
    for (const t of entry.tiers) {
      assert.ok(t.speaker === 'linxia' || t.speaker === 'tomb');
      assert.ok(t.text.trim().length >= 10);
    }
  }

  // Test 45s stagnation timer & H-key 1 -> 2 -> 3 progression on Level 14
  const ctrl = new TieredHintController(14);
  assert.equal(ctrl.stagnationThresholdSec, STAGNATION_THRESHOLD_SEC);
  assert.equal(ctrl.getSnapshot().pulseSuggested, false);

  ctrl.update(44.5, 0, false);
  assert.equal(ctrl.getSnapshot().pulseSuggested, false);

  const hit45 = ctrl.update(1.0, 0, false);
  assert.equal(hit45.pulseSuggested, true);
  assert.equal(hit45.justBecameSuggested, true);

  // Beat advancement resets stagnation cleanly without interrupting player
  ctrl.update(0.1, 1, false);
  assert.equal(ctrl.getSnapshot().pulseSuggested, false);
  assert.equal(ctrl.getSnapshot().stagnationSec, 0.1);

  // H key triggers Tier 1 -> Tier 2 -> Tier 3 (Tomb on Level 14)
  const h1 = ctrl.requestNextHint();
  assert.equal(h1.tier, 1);
  assert.equal(h1.speaker, 'tomb');
  assert.equal(h1.shouldHighlightTarget, false);

  const h2 = ctrl.requestNextHint();
  assert.equal(h2.tier, 2);
  assert.equal(h2.shouldHighlightTarget, false);

  const h3 = ctrl.requestNextHint();
  assert.equal(h3.tier, 3);
  assert.equal(h3.shouldHighlightTarget, true);
});

test('Rendering anti-regression invariants: Ghost material strictly disables depthWrite & depthPrePass', () => {
  const solid = getSolidMaterialSpec();
  assert.equal(solid.alpha, 1.0);
  assert.equal(solid.disableDepthWrite, false);
  assert.equal(solid.needDepthPrePass, false);

  const ghost = getGhostMaterialSpec('#F7C346', 0.34);
  assert.equal(assertGhostMaterialInvariants(ghost), true);
  assert.equal(ghost.disableDepthWrite, true);
  assert.equal(ghost.needDepthPrePass, false);

  // Negative check: violating invariants throws immediately
  assert.throws(() =>
    assertGhostMaterialInvariants({ alpha: 0.34, disableDepthWrite: false, needDepthPrePass: false })
  );
  assert.throws(() =>
    assertGhostMaterialInvariants({ alpha: 0.34, disableDepthWrite: true, needDepthPrePass: true })
  );
});

test('Level 14 discovery-first guidance: opening and context-aware H hints', () => {
  const s = new Level14HairlineSlitState();
  const ctrl = new TieredHintController(14);

  // 1. Opening phase & non-spoiling initial badge
  assert.equal(s.getCurrentPuzzlePhase(), 'approach');
  assert.equal(s.hasDiscoveredAllWWall, false);
  assert.doesNotMatch(s.getHonestViewBadge().detail, /贯穿整个/);

  // 2. Phase progression & context-aware H hints on North Pedestal (never repeats opening coin hint!)
  s.playerPos = [0, 1.85, -4.8, 0];
  s.setGrabbed(true);
  assert.equal(s.getCurrentPuzzlePhase(), 'grabbed_flat');
  s.rotateOrb4D(15);
  assert.equal(s.getCurrentPuzzlePhase(), 'tilted');
  const tiltedHint = ctrl.requestContextHint('tilted', { sideViewOpen: true });
  assert.match(tiltedHint.text, /？$/, 'Coin analogy hint must stop cleanly at the question mark');

  s.rotateOrb4D(75); // 90° blade
  assert.equal(s.getCurrentPuzzlePhase(), 'blade_ready');
  s.pushOrbZ(6.4); // Arrive on North Pedestal
  assert.equal(s.getCurrentPuzzlePhase(), 'north_restore');

  // Pressing H for the VERY FIRST time at North Pedestal must address restoration!
  const freshCtrl = new TieredHintController(14);
  const northH1 = freshCtrl.requestContextHint(s.getCurrentPuzzlePhase());
  assert.equal(northH1.tier, 1);
  assert.match(northH1.text, /底座|立起来/, 'North Pedestal Tier 1 hint must guide restoration, not opening coin analogy');
  const northH3 = freshCtrl.requestContextHint(s.getCurrentPuzzlePhase());
  const northH3Final = freshCtrl.requestContextHint(s.getCurrentPuzzlePhase());
  assert.equal(northH3.tier, 2);
  assert.equal(northH3Final.tier, 3);
  assert.match(northH3Final.text, /反向/);
});

test('碰壁与 Tab 保持当前 W；玩家能在固定倾角下逐层查看两侧并原路返回', () => {
  for (const openFirst of [true, false]) {
    const state = new Level14HairlineSlitState();
    state.playerPos = [0, 1.85, -4.8, 0];
    state.setGrabbed(true);
    state.rotateOrb4D(84);
    if (openFirst) state.toggleViewMode();
    assert.equal(state.pushOrbZ(1.1).blocked, true);
    if (!openFirst) state.toggleViewMode();
    const z = state.orbZ;
    const xyz = state.playerPos.slice(0, 3);
    assert.equal(state.hasInspectableContact, true);
    assert.equal(state.playerPos[3], 0);
    assert.equal(state.getSliceAtPlayerW().xCenter, 0);
    assert.equal(state.hasDiscoveredAllWWall, false);
    assert.match(state.getHonestViewBadge().title, /原层.*缝内/);

    for (const direction of [1, -1]) {
      state.exploreOrbW(direction);
      const firstW = state.playerPos[3];
      assert.equal(Math.sign(firstW), direction);
      assert.equal(state.observedWallOverlapX, null);
      assert.match(state.getHonestViewBadge().title, /缝内/);
      for (let i = 0; i < 6; i++) state.exploreOrbW(direction);
      const overlap = state.observedWallOverlapX;
      const slice = state.getSliceAtPlayerW();
      assert.ok(overlap * direction > state.config.slitHalfWidth);
      assert.ok(Math.abs(overlap - slice.xCenter) <= slice.semiX);
      assert.equal(state.hasDiscoveredAllWWall, true);
      assert.match(state.getHonestViewBadge().title, /越过/);

      const w = state.playerPos[3];
      state.toggleViewMode();
      state.toggleViewMode();
      state.pushOrbZ(0.1);
      assert.equal(state.playerPos[3], w);
      assert.equal(state.observedWallOverlapX, overlap);
      state.exploreOrbW(2 * direction);
      assert.equal(state.getSliceAtPlayerW().intersects, false);
      assert.equal(state.observedWallOverlapX, null);
      assert.match(state.getHonestViewBadge().detail, /C 回原层/);
      state.exploreOrbW(-9 * direction);
      assert.equal(state.playerPos[3], 0);
      assert.equal(state.getSliceAtPlayerW().xCenter, 0);
      assert.equal(state.orbZ, z);
      assert.equal(state.thetaDeg, 84);
      assert.deepEqual(state.playerPos.slice(0, 3), xyz);
    }

    state.pushOrbZ(-0.25);
    assert.equal(state.hasInspectableContact, false);
    state.pushOrbZ(0.4);
    state.rotateOrb4D(1.4);
    assert.equal(state.pushOrbZ(0.2).blocked, true);
    assert.equal(state.getCurrentPuzzlePhase(), 'slit_margin');
    assert.equal(state.hasInspectableContact, false);
    assert.equal(state.observedWallOverlapX, null);
  }
});

test('越界标记落在当前真实截面，负方向、反转和刚好擦边的倾角都成立', () => {
  for (const angle of [7, -7, 10, 20, 35, 50, 65, 78, 84, -84, 85.29, 94.71, 96, 173, 264, 276]) {
    const state = new Level14HairlineSlitState();
    state.playerPos = [0, 1.85, -4.8, 0];
    state.setGrabbed(true);
    state.rotateOrb4D(angle);
    state.pushOrbZ(1.1);
    assert.equal(state.observedWallOverlapX, null, String(angle));
    for (const sign of [1, -1]) {
      const w = sign * 0.999 * state.getExtents().wMax;
      state.shiftPlayerW(w - state.playerPos[3]);
      const slice = state.getSliceAtPlayerW();
      const x = state.observedWallOverlapX;
      assert.ok(Math.abs(x) > state.config.slitHalfWidth, String(angle));
      assert.ok(Math.abs(x - slice.xCenter) <= slice.semiX, String(angle));
    }
  }
});

test('轻转后一次滚轮仍能看到球身；抓放、推拉、旋转保留玩家所选的观察层', () => {
  const s = new Level14HairlineSlitState();
  s.playerPos = [0, 1.85, -4.8, 0];
  s.setGrabbed(true);
  s.rotateOrb4D(7);
  s.exploreOrbW(1.4);
  const w = s.playerPos[3];
  const slice = s.getSliceAtPlayerW();
  assert.ok(slice.intersects && slice.xCenter > s.config.slitHalfWidth);
  s.setGrabbed(false);
  s.setGrabbed(true);
  s.pushOrbZ(0.1);
  s.rotateOrb4D(7);
  assert.equal(s.playerPos[3], w);
  assert.equal(s.observedWallOverlapX, null);
  s.pushOrbZ(1.1);
  assert.equal(s.playerPos[3], w);
  assert.ok(s.observedWallOverlapX > s.config.slitHalfWidth);
  assert.equal(s.hasDiscoveredAllWWall, true);
  s.reset();
  assert.equal(s.playerPos[3], 0);
});

test('开场走到空层可回原层；北台松手后可原地重新操控并完成', () => {
  const s = new Level14HairlineSlitState();
  s.playerPos = [0, 1.85, -5, 0];
  s.shiftPlayerW(0.392);
  assert.equal(s.getCurrentPuzzlePhase(), 'find_orb_layer');
  assert.equal(s.canGrabOrb(), false);
  s.shiftPlayerW(-s.playerPos[3]);
  assert.equal(s.setGrabbed(true).grabbed, true);
  s.rotateOrb4D(91);
  s.pushOrbZ(3);
  s.pushOrbZ(3.5);
  assert.equal(s.isOnNorthPedestal(), true);
  s.setGrabbed(false);
  assert.equal(s.getCurrentPuzzlePhase(), 'north_reconnect');
  assert.match(s.getHonestViewBadge().detail, /按 E/);
  assert.equal(s.setGrabbed(true).grabbed, true);
  assert.equal(s.rotateOrb4D(-91).completed, true);
});
