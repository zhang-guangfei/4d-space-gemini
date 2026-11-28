/**
 * Beyond 3D — Prologue Pure-Core Timeline, 4D Math, Continuity Helpers & Redline Unit Tests
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { dist4 } from '../src/core/math4d.js';
import {
  computeBridgeOrigamiAngles,
  computeRecursiveTesseract4D,
  computeSealedBoxOrb4D,
  evaluatePrologueAt,
  PROLOGUE_COORD_CARD_LINES,
  PROLOGUE_CUES,
  PROLOGUE_FORBIDDEN_PATTERNS,
  PROLOGUE_KEYFRAMES,
  PROLOGUE_OPENING_LINES,
  PROLOGUE_SEGMENTS,
  PROLOGUE_SHOTS,
  PROLOGUE_SPEAKERS,
  PROLOGUE_TOMB_DECODE_TEXT,
  PROLOGUE_TOTAL_DURATION_SEC,
  PrologueDirectorState,
  scanForbiddenPatterns,
} from '../src/core/prologue-timeline.js';
import { PrologueVoyagerState } from '../src/core/tesseract-boundary.js';
import { verifyGhostInvariants } from '../src/engine/prologue-materials.js';
import {
  clamp,
  easeInOutCubic,
  easeOutExpo,
  evalCatmullRom3,
  lerp,
  smoothstep,
} from '../src/levels/prologue/prologue-shared.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOL = 1e-12;

test('Timeline bounds: 75.0s total, 3 contiguous segments, 9 contiguous shots & sub-beats with zero gaps/overlaps', () => {
  assert.equal(PROLOGUE_TOTAL_DURATION_SEC, 75.0);
  assert.equal(PROLOGUE_SEGMENTS.length, 3);
  assert.equal(PROLOGUE_SEGMENTS[0].startSec, 0);
  assert.equal(PROLOGUE_SEGMENTS[PROLOGUE_SEGMENTS.length - 1].endSec, 75.0);

  for (let i = 0; i < PROLOGUE_SEGMENTS.length - 1; i += 1) {
    assert.equal(PROLOGUE_SEGMENTS[i].endSec, PROLOGUE_SEGMENTS[i + 1].startSec);
  }

  assert.equal(PROLOGUE_SHOTS.length, 9);
  assert.equal(PROLOGUE_SHOTS[0].startSec, 0);
  assert.equal(PROLOGUE_SHOTS[PROLOGUE_SHOTS.length - 1].endSec, 75.0);

  for (let i = 0; i < PROLOGUE_SHOTS.length; i += 1) {
    const shot = PROLOGUE_SHOTS[i];
    assert.ok(shot.endSec > shot.startSec, `Shot ${shot.id} must have positive duration`);
    if (i < PROLOGUE_SHOTS.length - 1) {
      assert.equal(shot.endSec, PROLOGUE_SHOTS[i + 1].startSec, `Gap/overlap after shot ${shot.id}`);
    }
    assert.ok(shot.subBeats.length >= 1);
    assert.equal(shot.subBeats[0].startSec, shot.startSec);
    assert.equal(shot.subBeats[shot.subBeats.length - 1].endSec, shot.endSec);
    for (let j = 0; j < shot.subBeats.length - 1; j += 1) {
      assert.equal(shot.subBeats[j].endSec, shot.subBeats[j + 1].startSec);
    }
  }
});

test('18 authoritative keyframes (KF-01..KF-18): 6 per segment, strictly increasing, accurate beat states', () => {
  assert.equal(PROLOGUE_KEYFRAMES.length, 18);

  const expectedTimes = [
    2.5, 8.0, 12.8, 17.5, 20.2, 24.0,
    28.5, 33.0, 38.5, 41.8, 47.0, 52.0,
    56.5, 58.6, 60.2, 62.6, 67.5, 73.8,
  ];
  const segCounts = { P1: 0, P2: 0, P3: 0 };

  for (let i = 0; i < PROLOGUE_KEYFRAMES.length; i += 1) {
    const kf = PROLOGUE_KEYFRAMES[i];
    assert.equal(kf.id, `KF-${String(i + 1).padStart(2, '0')}`);
    assert.equal(kf.tSec, expectedTimes[i]);
    if (i > 0) {
      assert.ok(kf.tSec > PROLOGUE_KEYFRAMES[i - 1].tSec);
    }
    segCounts[kf.segmentId] += 1;

    const snap = evaluatePrologueAt(kf.tSec);
    assert.equal(snap.segmentId, kf.segmentId);
    assert.equal(snap.shotId, kf.shotId);
    assert.equal(snap.subBeatId, kf.subBeatId);
    assert.equal(snap.camera.pos.length, 3);
    assert.equal(snap.camera.target.length, 3);
    assert.ok(snap.camera.pos.every(Number.isFinite));
    assert.ok(snap.camera.target.every(Number.isFinite));
    assert.ok(Number.isFinite(snap.camera.fov) && snap.camera.fov > 0.4 && snap.camera.fov < 2.0);
  }

  assert.deepEqual(segCounts, { P1: 6, P2: 6, P3: 6 });

  // Keyframe-specific cinema assertions
  const kf01 = evaluatePrologueAt(2.5);
  assert.ok(kf01.openingLinesAlpha[0] > 0.9);
  assert.equal(kf01.openingLinesAlpha[1], 0);
  assert.equal(kf01.letterboxRatio, 1.0);

  const kf02 = evaluatePrologueAt(8.0);
  assert.ok(kf02.openingLinesAlpha.every((a) => a > 0.9));

  const kf05 = evaluatePrologueAt(20.2);
  assert.ok(kf05.camera.fov > 1.0, 'S0B-2 warp burst must widen FOV noticeably');

  const kf06 = evaluatePrologueAt(24.0);
  assert.equal(kf06.coordCardAlpha, 1.0);
  assert.equal(kf06.coordCardLines.length, 2);

  // S2 unaware veil crossing (t=38.5s) MUST have alertLevel === 0; +2s later (t=41.8s) MUST be active!
  const kf09 = evaluatePrologueAt(38.5);
  assert.equal(kf09.alertLevel, 0, 'Unaware veil crossing at 38.5s must not trigger alert prematurely');
  const kf10 = evaluatePrologueAt(41.8);
  assert.ok(kf10.alertLevel > 0.5, 'Predictive alert must be active +2s after veil immersion');
  assert.equal(kf10.activeSubtitle?.speakerId, 'ship_ai');

  // S3 star extinction + Tomb spectrometer at 52.0s
  const kf11 = evaluatePrologueAt(47.0);
  assert.ok(kf11.starExtinctionProgress > 0.4 && kf11.starExtinctionProgress < 0.95);
  const kf12 = evaluatePrologueAt(52.0);
  assert.equal(kf12.starExtinctionProgress, 1.0);
  assert.equal(kf12.spectrometer.active, true);
  assert.equal(kf12.spectrometer.parsePct, 14);
  assert.equal(kf12.spectrometer.bars.length, 48);
  assert.equal(kf12.spectrometer.text, PROLOGUE_TOMB_DECODE_TEXT);

  // S4-1 orb passage, X-ray wave, bow glass shatter
  const s4Start = evaluatePrologueAt(55.1);
  assert.equal(s4Start.orbExcursion4D.boxIntact, true);
  assert.equal(s4Start.orbExcursion4D.insideBox, true);
  const s4Halo = evaluatePrologueAt(56.2);
  assert.ok(s4Halo.orbExcursion4D.sliceHaloAlpha > 0.1, '4D contour halo must be visible by 56.2s');
  const kf13 = evaluatePrologueAt(56.5);
  assert.equal(kf13.orbExcursion4D.boxIntact, true);
  assert.ok(kf13.orbExcursion4D.w > 0.1);
  const s4Xray = evaluatePrologueAt(58.0);
  assert.ok(s4Xray.xrayWaveProgress > 0.3, 'X-ray wave must exceed 0.3 by 58.0s');
  const kf14 = evaluatePrologueAt(58.6);
  assert.ok(kf14.orbExcursion4D.pos3[0] > kf14.orbExcursion4D.boxHalf, 'Orb must emerge outside intact box by 58.6s');
  assert.ok(kf14.xrayWaveProgress > 0.3 && kf14.xrayWaveProgress < 0.9);
  const s4Shatter = evaluatePrologueAt(59.8);
  assert.ok(s4Shatter.shatterProgress > 0.4);
  assert.equal(s4Shatter.activeSubtitle?.speakerId, 'linxia');
  const kf15 = evaluatePrologueAt(60.2);
  assert.ok(kf15.shatterProgress > 0.5);

  // S4-2 08 号 wake-up
  const kf16 = evaluatePrologueAt(62.6);
  assert.ok(kf16.cryoWakeupProgress > 0.4);
  assert.equal(kf16.activeSubtitle?.speakerId, 'linxia');

  // S5 90° origami
  const kf17 = evaluatePrologueAt(67.5);
  assert.ok(Math.abs(kf17.origamiFoldProgress - 0.5) < 1e-6);

  // S6 polar-day whiteout, retracting letterbox, ZERO dialogue
  const kf18 = evaluatePrologueAt(73.8);
  assert.ok(kf18.post.whiteoutAlpha > 0.8);
  assert.ok(kf18.letterboxRatio > 0 && kf18.letterboxRatio < 0.5);
  assert.equal(kf18.activeSubtitle, null);
  assert.equal(kf18.iblPreset, 'IBL_POLAR_DAY');
  assert.ok(evaluatePrologueAt(74.6).letterboxRatio < 0.1);
});

test('4D Math: computeRecursiveTesseract4D preserves exact SO(4) edge lengths under rotPlane4', () => {
  for (const t of [0, 3.7, 48.5, 52.0, 117.25]) {
    const res = computeRecursiveTesseract4D(t);
    assert.equal(res.tiers.length, 3);
    assert.deepEqual(res.tiers.map((x) => x.id), ['outer', 'mid', 'inner']);
    assert.equal(res.edges.length, 32);

    for (const tier of res.tiers) {
      assert.equal(tier.vertices4.length, 16);
      assert.equal(tier.vertices3.length, 16);
      for (const [a, b] of tier.edges) {
        const edgeLen4 = dist4(tier.vertices4[a], tier.vertices4[b]);
        assert.ok(
          Math.abs(edgeLen4 - 2.0) < TOL,
          `4D edge length distorted in tier ${tier.id} at t=${t}: got ${edgeLen4}`
        );
      }
      for (const v3 of tier.vertices3) {
        assert.equal(v3.length, 3);
        assert.ok(v3.every(Number.isFinite));
      }
    }
  }
});

test('4D Math: computeSealedBoxOrb4D slips through W != 0 to exit intact 6-face sealed box cleanly', () => {
  const start = computeSealedBoxOrb4D(0);
  assert.equal(start.boxIntact, true);
  assert.equal(start.insideBox, true);
  assert.equal(start.outsideBox, false);
  assert.equal(start.w, 0);
  assert.equal(start.pos3[0], 0);

  // Sample finely across trajectory to find wall-crossing moment (|x - boxHalf| minimal)
  let closestToWall = null;
  let minWallDelta = Infinity;
  let maxW = 0;
  for (let i = 0; i <= 200; i += 1) {
    const sample = computeSealedBoxOrb4D(i / 200);
    assert.equal(sample.boxIntact, true);
    maxW = Math.max(maxW, Math.abs(sample.w));
    const delta = Math.abs(sample.pos3[0] - sample.boxHalf);
    if (delta < minWallDelta) {
      minWallDelta = delta;
      closestToWall = sample;
    }
  }

  assert.ok(closestToWall !== null);
  assert.ok(
    Math.abs(closestToWall.w) > 0.25,
    `Sphere must bypass intact box wall via strictly non-zero 4D W displacement (got w=${closestToWall.w})`
  );
  assert.equal(closestToWall.crossingWall, true);
  assert.ok(maxW >= 0.4);

  const end = computeSealedBoxOrb4D(1);
  assert.equal(end.boxIntact, true);
  assert.equal(end.insideBox, false);
  assert.equal(end.outsideBox, true);
  assert.ok(end.pos3[0] > end.boxHalf + end.orbRadius);
  assert.ok(Math.abs(end.w) < 1e-9);
});

test('4D Math: computeBridgeOrigamiAngles unfolds smoothly from exact 0 to exact ±90° (±π/2 rad)', () => {
  const start = computeBridgeOrigamiAngles(0);
  assert.equal(start.leftBulkheadRad, 0);
  assert.equal(start.rightBulkheadRad, 0);
  assert.equal(start.ceilingRad, 0);
  assert.equal(start.floorRad, 0);
  assert.equal(start.bowUpperRad, 0);
  assert.equal(start.bowLowerRad, 0);

  const mid = computeBridgeOrigamiAngles(0.5);
  assert.ok(mid.leftBulkheadRad < -0.5 && mid.leftBulkheadRad > -Math.PI * 0.5);
  assert.ok(mid.rightBulkheadRad > 0.5 && mid.rightBulkheadRad < Math.PI * 0.5);
  assert.ok(mid.hingeGlow > 0.8);

  const end = computeBridgeOrigamiAngles(1);
  const HALF_PI = Math.PI * 0.5;
  assert.ok(Math.abs(end.leftBulkheadRad - -HALF_PI) < TOL);
  assert.ok(Math.abs(end.rightBulkheadRad - HALF_PI) < TOL);
  assert.ok(Math.abs(end.ceilingRad - HALF_PI) < TOL);
  assert.ok(Math.abs(end.floorRad - -HALF_PI) < TOL);
  assert.ok(Math.abs(end.bowUpperRad - HALF_PI) < TOL);
  assert.ok(Math.abs(end.bowLowerRad - -HALF_PI) < TOL);
});

test('PrologueDirectorState & PrologueVoyagerState: deterministic seek, NaN/negative guards, unique cue emission, skip', () => {
  const dir = new PrologueDirectorState();
  assert.equal(dir.levelId, 0);
  assert.equal(dir.elapsedSec, 0);
  assert.equal(dir.totalDurationSec, 75.0);
  assert.equal(dir.beat, 1);
  assert.equal(dir.voiceTriggered, false);

  // Guard negative / NaN / Infinity dtSec
  const g1 = dir.update(-5.0);
  assert.equal(dir.elapsedSec, 0);
  assert.equal(g1.justCompleted, false);
  dir.update(Number.NaN);
  dir.update(Number.POSITIVE_INFINITY);
  assert.equal(dir.elapsedSec, 0);

  // Step full 75s in 0.25s increments and ensure every cue fires strictly ONCE
  const seenCues = [];
  let completedEvents = 0;
  let voiceTriggers = 0;
  for (let i = 0; i < 310; i += 1) {
    const res = dir.update(0.25);
    seenCues.push(...res.firedCues.map((c) => c.id));
    if (res.justCompleted) completedEvents += 1;
    if (res.triggerVoice) voiceTriggers += 1;
  }

  assert.equal(dir.completed, true);
  assert.equal(dir.elapsedSec, 75.0);
  assert.equal(dir.beat, 3);
  assert.equal(completedEvents, 1, 'justCompleted must fire exactly once');
  assert.equal(voiceTriggers, 1, 'triggerVoice must fire exactly once');
  assert.equal(seenCues.length, PROLOGUE_CUES.length, 'Every scheduled cue must fire exactly once');
  assert.equal(new Set(seenCues).size, PROLOGUE_CUES.length, 'No duplicate cue firing permitted');

  // seek() determinism & clamping
  const sA = dir.seek(52.0);
  const sB = dir.seek(12.8);
  const sA2 = dir.seek(52.0);
  assert.deepEqual(sA, sA2);
  assert.equal(sB.subBeatId, 'S0B-1');
  assert.equal(dir.seek(-10).elapsedSec, 0);
  assert.equal(dir.seek(999).elapsedSec, 75.0);
  assert.equal(dir.seek(Number.NaN).elapsedSec, 0);

  // Backward-compatible PrologueVoyagerState subclass
  const legacy = new PrologueVoyagerState();
  assert.ok(legacy instanceof PrologueDirectorState);
  legacy.update(7.0);
  assert.equal(legacy.voiceTriggered, true);
  assert.equal(legacy.beat, 1);
  legacy.seek(32.0);
  assert.equal(legacy.beat, 2);
  legacy.skip();
  assert.equal(legacy.skipped, true);
  assert.equal(legacy.completed, true);
  assert.equal(legacy.elapsedSec, 75.0);
});

test('FORBID-01..06 Redline Audit: zero forbidden strings in cues, copy, and M2 source files; zero S6 dialogue; zero Tomb TTS', () => {
  assert.equal(PROLOGUE_FORBIDDEN_PATTERNS.length, 6);

  // Verify S6 emits strictly ZERO voice/dialogue cues and zero subtitles
  for (const cue of PROLOGUE_CUES) {
    if (cue.shotId === 'S6' || cue.atSec >= 71.0) {
      assert.notEqual(cue.kind, 'voice', `S6 must not emit voice cue: ${cue.id}`);
    }
    if (cue.speaker === 'tomb_signal') {
      assert.notEqual(cue.kind, 'voice', 'Tomb signal must NEVER use human voice/TTS cue kind');
      assert.equal(cue.meta?.skipSpeechSynthesis, true);
    }
    if (cue.text) {
      assert.deepEqual(scanForbiddenPatterns(cue.text), [], `Forbidden text in cue ${cue.id}`);
    }
  }

  for (let t = 71.0; t <= 75.0; t += 0.25) {
    assert.equal(evaluatePrologueAt(t).activeSubtitle, null, `S6 subtitle must be null at t=${t}`);
  }

  for (const line of [...PROLOGUE_OPENING_LINES, ...PROLOGUE_COORD_CARD_LINES, PROLOGUE_TOMB_DECODE_TEXT]) {
    assert.deepEqual(scanForbiddenPatterns(line), [], `Forbidden copy in line: ${line}`);
  }

  for (const sp of Object.values(PROLOGUE_SPEAKERS)) {
    assert.deepEqual(scanForbiddenPatterns(sp.speakerLabel), []);
  }

  // Raw source scan across all M2 Prologue files
  const m2Files = [
    'src/core/prologue-timeline.js',
    'src/engine/prologue-materials.js',
    'src/levels/prologue/prologue-shared.js',
  ];
  for (const rel of m2Files) {
    const src = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
    assert.deepEqual(scanForbiddenPatterns(src), [], `Forbidden pattern matched in ${rel}`);
  }
});

test('Shared utilities & verifyGhostInvariants contract validation', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeOutExpo(0), 0);
  assert.equal(easeOutExpo(1), 1);

  const pts = [
    [0, 0, 0],
    [1, 2, 3],
    [4, 2, 6],
    [8, 0, 10],
  ];
  assert.deepEqual(evalCatmullRom3(pts, 0), [0, 0, 0]);
  assert.deepEqual(evalCatmullRom3(pts, 1), [8, 0, 10]);
  const mid = evalCatmullRom3(pts, 0.5);
  assert.ok(mid.every(Number.isFinite));

  // Ghost invariant verifier passes valid opaque + translucent materials and catches violations
  const validBank = {
    opaqueMat: { alpha: 1.0, disableDepthWrite: false, needDepthPrePass: false },
    ghostMat: { alpha: 0.34, disableDepthWrite: true, needDepthPrePass: false },
    shaderMat: { alpha: 0.85, disableDepthWrite: true, needDepthPrePass: false, _isPrologueTranslucent: true },
  };
  const okRes = verifyGhostInvariants(validBank);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.checkedCount, 3);
  assert.deepEqual(okRes.violations, []);

  const badBank = {
    badGhost: { alpha: 0.32, disableDepthWrite: false, needDepthPrePass: false },
    badPrepass: { alpha: 1.0, disableDepthWrite: false, needDepthPrePass: Boolean(1) },
  };
  const failRes = verifyGhostInvariants(badBank);
  assert.equal(failRes.ok, false);
  assert.equal(failRes.violations.length, 2);
});
