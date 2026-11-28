/**
 * Beyond 3D — Pure-Core 75-Second Prologue Director Timeline & 4D Mathematics
 *
 * Strictly zero browser/engine dependencies; 100% deterministic in Node.js & browser ESM.
 * Implements Contract A of PROJECT.md:
 * - 3 Acts (P1 0-26s, P2 26-55s, P3 55-75s), 9 Shots (S0A-S6), 18 Authoritative Keyframes (KF-01..KF-18)
 * - Deterministic spline camera, cinema grading, fog, IBL, subtitle, card & spectrometer evaluation
 * - Exact SO(4) recursive 8-cell tesseract projection, 4D sealed-box orb excursion, and 90° bridge origami
 * - PrologueDirectorState (extended by PrologueVoyagerState for backward compatibility)
 */

import { clamp, lerp, rotPlane4 } from './math4d.js';

export const PROLOGUE_TOTAL_DURATION_SEC = 75.0;

// ---------------------------------------------------------------------------
// Segments, Shots, Keyframes, Copy & Speaker Tables
// ---------------------------------------------------------------------------

export const PROLOGUE_SEGMENTS = Object.freeze([
  Object.freeze({
    id: 'P1',
    name: '文明远航',
    startSec: 0,
    endSec: 26,
    shots: Object.freeze(['S0A', 'S0B', 'S0C']),
  }),
  Object.freeze({
    id: 'P2',
    name: '无声入海',
    startSec: 26,
    endSec: 55,
    shots: Object.freeze(['S1', 'S2', 'S3']),
  }),
  Object.freeze({
    id: 'P3',
    name: '空间折纸',
    startSec: 55,
    endSec: 75,
    shots: Object.freeze(['S4', 'S5', 'S6']),
  }),
]);

export const PROLOGUE_SHOTS = Object.freeze([
  Object.freeze({
    id: 'S0A',
    segmentId: 'P1',
    startSec: 0,
    endSec: 11,
    title: '开场极简字幕与星舰文明旁白',
    subBeats: Object.freeze([Object.freeze({ id: 'S0A', startSec: 0, endSec: 11 })]),
  }),
  Object.freeze({
    id: 'S0B',
    segmentId: 'P1',
    startSec: 11,
    endSec: 22,
    title: '全员冬眠与第 7 次超光速跃迁',
    subBeats: Object.freeze([
      Object.freeze({ id: 'S0B-1', startSec: 11, endSec: 15 }),
      Object.freeze({ id: 'S0B-2', startSec: 15, endSec: 22 }),
    ]),
  }),
  Object.freeze({
    id: 'S0C',
    segmentId: 'P1',
    startSec: 22,
    endSec: 26,
    title: '时空跨越坐标字幕卡',
    subBeats: Object.freeze([Object.freeze({ id: 'S0C', startSec: 22, endSec: 26 })]),
  }),
  Object.freeze({
    id: 'S1',
    segmentId: 'P2',
    startSec: 26,
    endSec: 35,
    title: '47 年后静默航行与 07 号林夏轮值',
    subBeats: Object.freeze([Object.freeze({ id: 'S1', startSec: 26, endSec: 35 })]),
  }),
  Object.freeze({
    id: 'S2',
    segmentId: 'P2',
    startSec: 35,
    endSec: 44,
    title: '无察觉滑入液态水银四维光幕',
    subBeats: Object.freeze([Object.freeze({ id: 'S2', startSec: 35, endSec: 44 })]),
  }),
  Object.freeze({
    id: 'S3',
    segmentId: 'P2',
    startSec: 44,
    endSec: 55,
    title: '星辰归零、八胞巨构与墓地异星声学',
    subBeats: Object.freeze([Object.freeze({ id: 'S3', startSec: 44, endSec: 55 })]),
  }),
  Object.freeze({
    id: 'S4',
    segmentId: 'P3',
    startSec: 55,
    endSec: 64,
    title: '俯冲入舱、密封穿壁与 08 号紧急唤醒',
    subBeats: Object.freeze([
      Object.freeze({ id: 'S4-1', startSec: 55, endSec: 61 }),
      Object.freeze({ id: 'S4-2', startSec: 61, endSec: 64 }),
    ]),
  }),
  Object.freeze({
    id: 'S5',
    segmentId: 'P3',
    startSec: 64,
    endSec: 71,
    title: '舰桥 90° 四维折纸展开重构',
    subBeats: Object.freeze([Object.freeze({ id: 'S5', startSec: 64, endSec: 71 })]),
  }),
  Object.freeze({
    id: 'S6',
    segmentId: 'P3',
    startSec: 71,
    endSec: 75,
    title: '极昼留白与电影黑边退场',
    subBeats: Object.freeze([Object.freeze({ id: 'S6', startSec: 71, endSec: 75 })]),
  }),
]);

export const PROLOGUE_KEYFRAMES = Object.freeze([
  // Segment P1 (6 keyframes)
  Object.freeze({ id: 'KF-01', tSec: 2.5, segmentId: 'P1', shotId: 'S0A', subBeatId: 'S0A', label: '开场星尘与首行字幕淡入' }),
  Object.freeze({ id: 'KF-02', tSec: 8.0, segmentId: 'P1', shotId: 'S0A', subBeatId: 'S0A', label: '三行极简文明字幕齐显与旁白' }),
  Object.freeze({ id: 'KF-03', tSec: 12.8, segmentId: 'P1', shotId: 'S0B', subBeatId: 'S0B-1', label: '冬眠长廊闭合与 08 号舱特写' }),
  Object.freeze({ id: 'KF-04', tSec: 17.5, segmentId: 'P1', shotId: 'S0B', subBeatId: 'S0B-2', label: '远航者编队深空曲率环展开' }),
  Object.freeze({ id: 'KF-05', tSec: 20.2, segmentId: 'P1', shotId: 'S0B', subBeatId: 'S0B-2', label: '第 7 次超光速跃迁青金流光爆发' }),
  Object.freeze({ id: 'KF-06', tSec: 24.0, segmentId: 'P1', shotId: 'S0C', subBeatId: 'S0C', label: '47 年后时空跨越坐标字幕卡' }),
  // Segment P2 (6 keyframes)
  Object.freeze({ id: 'KF-07', tSec: 28.5, segmentId: 'P2', shotId: 'S1', subBeatId: 'S1', label: '弧形舰首窗掠入科研舱冷暖双色' }),
  Object.freeze({ id: 'KF-08', tSec: 33.0, segmentId: 'P2', shotId: 'S1', subBeatId: 'S1', label: '07 号林夏伏案日志与沉睡 08 号舱' }),
  Object.freeze({ id: 'KF-09', tSec: 38.5, segmentId: 'P2', shotId: 'S2', subBeatId: 'S2', label: '领航舰无察觉穿透液态水银四维光幕' }),
  Object.freeze({ id: 'KF-10', tSec: 41.8, segmentId: 'P2', shotId: 'S2', subBeatId: 'S2', label: '没入 2 秒后舰载非欧曲率预警激活' }),
  Object.freeze({ id: 'KF-11', tSec: 47.0, segmentId: 'P2', shotId: 'S3', subBeatId: 'S3', label: '群星依次熄灭与八胞巨构初现' }),
  Object.freeze({ id: 'KF-12', tSec: 52.0, segmentId: 'P2', shotId: 'S3', subBeatId: 'S3', label: '宇宙级八胞巨构与量子频谱仪 14% 破译' }),
  // Segment P3 (6 keyframes)
  Object.freeze({ id: 'KF-13', tSec: 56.5, segmentId: 'P3', shotId: 'S4', subBeatId: 'S4-1', label: '流星俯冲入舱与密封硼硅实验盒完整状态' }),
  Object.freeze({ id: 'KF-14', tSec: 58.6, segmentId: 'P3', shotId: 'S4', subBeatId: 'S4-1', label: '校准球四维穿壁飘出与苍青 X-Ray 透视波' }),
  Object.freeze({ id: 'KF-15', tSec: 60.2, segmentId: 'P3', shotId: 'S4', subBeatId: 'S4-1', label: '全景舰首窗青金正交裂纹与失重碎晶' }),
  Object.freeze({ id: 'KF-16', tSec: 62.6, segmentId: 'P3', shotId: 'S4', subBeatId: 'S4-2', label: '08 号冬眠舱应急绿光开启切入第一人称' }),
  Object.freeze({ id: 'KF-17', tSec: 67.5, segmentId: 'P3', shotId: 'S5', subBeatId: 'S5', label: '舰桥 90° 四维铰链折纸展开重构' }),
  Object.freeze({ id: 'KF-18', tSec: 73.8, segmentId: 'P3', shotId: 'S6', subBeatId: 'S6', label: '极昼纯白几何留白与电影黑边退场' }),
]);

export const PROLOGUE_OPENING_LINES = Object.freeze([
  '离开太阳系后，我们再也没有了归途。',
  '没有母星，舰队便是人类最后的故乡。',
  '在危机四伏的未知深空里，唯有继续向前。',
]);

export const PROLOGUE_COORD_CARD_LINES = Object.freeze([
  '星舰纪元 47 年 · 距太阳系 412 光年',
  '人马座旋臂外缘 · 未知空洞星域（第 7 次跃迁巡航途中）',
]);

export const PROLOGUE_TOMB_DECODE_TEXT =
  '[未知高维引力波频谱 · 语义解析率 14%]：……干涸……海……新的访客……';

export const PROLOGUE_SPEAKERS = Object.freeze({
  narrator: Object.freeze({
    speakerId: 'narrator',
    speakerLabel: '旁白',
    color: '#E8EFF8',
  }),
  broadcast: Object.freeze({
    speakerId: 'broadcast',
    speakerLabel: '舰桥广播',
    color: '#A5FCF2',
  }),
  linxia: Object.freeze({
    speakerId: 'linxia',
    speakerLabel: '07 号 · 林夏',
    color: '#F7D794',
  }),
  ship_ai: Object.freeze({
    speakerId: 'ship_ai',
    speakerLabel: '远航者号 · 舰载系统',
    color: '#F7C346',
  }),
  tomb_signal: Object.freeze({
    speakerId: 'tomb_signal',
    speakerLabel: '舰载量子频谱仪',
    color: '#4DE6D3',
    skipSpeechSynthesis: true,
  }),
});

/**
 * Redline patterns (FORBID-01..06) constructed dynamically from code points / fragments
 * so this pure-core module itself contains zero raw forbidden literal substrings.
 */
function fromCodes(codes) {
  return String.fromCharCode(...codes);
}

export const PROLOGUE_FORBIDDEN_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'FORBID-01',
    rule: 'Deleted legacy closing lines & EVA status',
    terms: Object.freeze([
      fromCodes([48, 56, 32, 21495, 65292, 31354, 38388, 25226, 25105, 38548, 21040, 21069, 38754, 21435, 20102]),
      fromCodes([21035, 36319, 20002, 20102]),
      fromCodes([25105, 20808, 20986, 33329, 30475, 30475]),
      ['EV', 'A · 07'].join(''),
      fromCodes([26519, 22799, 24050, 20986, 33329]),
    ]),
    regex: new RegExp(
      [
        fromCodes([48, 56, 32, 21495, 65292, 31354, 38388, 25226, 25105, 38548, 21040, 21069, 38754, 21435, 20102]),
        fromCodes([21035, 36319, 20002, 20102]),
        fromCodes([25105, 20808, 20986, 33329, 30475, 30475]),
        ['EV', 'A\\s*·\\s*07'].join(''),
        fromCodes([26519, 22799, 24050, 20986, 33329]),
      ].join('|')
    ),
  }),
  Object.freeze({
    id: 'FORBID-02',
    rule: 'No crimson-ribbon motif in Prologue',
    terms: Object.freeze([
      fromCodes([32418, 19997, 24102]),
      ['red', 'Ribbon'].join(''),
      ['red', '_ribbon'].join(''),
    ]),
    regex: new RegExp(
      [
        fromCodes([32418, 19997, 24102]),
        ['red', 'Ribbon'].join(''),
        ['red', '_ribbon'].join(''),
      ].join('|'),
      'i'
    ),
  }),
  Object.freeze({
    id: 'FORBID-03',
    rule: 'No delayed/lagging reflection gimmick in Prologue',
    terms: Object.freeze([
      fromCodes([20498, 24433, 24930, 21322, 25293]),
      ['delayed', 'Reflection'].join(''),
      ['lag', 'Reflection'].join(''),
    ]),
    regex: new RegExp(
      [
        fromCodes([20498, 24433, 24930, 21322, 25293]),
        ['delayed', 'Reflection'].join(''),
        ['lag', 'Reflection'].join(''),
      ].join('|'),
      'i'
    ),
  }),
  Object.freeze({
    id: 'FORBID-04',
    rule: 'No low-frequency station cruise hum on Prologue',
    terms: Object.freeze([
      ['startStation', 'Ambience'].join(''),
      ['startSanctuary', 'Ambience'].join(''),
    ]),
    regex: new RegExp(
      [
        ['startStation', 'Ambience'].join(''),
        ['startSanctuary', 'Ambience'].join(''),
      ].join('|')
    ),
  }),
  Object.freeze({
    id: 'FORBID-05',
    rule: 'No human speech synthesis for Tomb entity',
    terms: Object.freeze([['tomb', '_tts'].join('')]),
    regex: new RegExp(['tomb', '_tts'].join(''), 'i'),
  }),
  Object.freeze({
    id: 'FORBID-06',
    rule: 'Decoupled from legacy Chapter 1 corridor & migration path',
    terms: Object.freeze([
      ['migration/', 'chapter1-4d-space'].join(''),
      fromCodes([36827, 20837, 31532, 32, 49, 32, 20851]),
      fromCodes([22238, 24266]),
    ]),
    regex: new RegExp(
      [
        ['migration/', 'chapter1-4d-space'].join(''),
        fromCodes([36827, 20837, 31532, 32, 49, 32, 20851]),
        fromCodes([22238, 24266]),
      ].join('|')
    ),
  }),
]);

export function scanForbiddenPatterns(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const hits = [];
  for (const entry of PROLOGUE_FORBIDDEN_PATTERNS) {
    const match = entry.regex.exec(text);
    if (match) {
      hits.push({ id: entry.id, rule: entry.rule, match: match[0] });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Authoritative 75s Cue Schedule (Zero Forbidden Copy, Zero S6 Voice, Zero Tomb TTS)
// ---------------------------------------------------------------------------

export const PROLOGUE_CUES = Object.freeze([
  // P1: S0A (0 - 11s)
  Object.freeze({
    id: 'cue_music_s0a_piano_cello',
    atSec: 0.0,
    endSec: 11.2,
    shotId: 'S0A',
    segmentId: 'P1',
    kind: 'music',
    meta: Object.freeze({ theme: 'd_dorian_piano_cello', key: 'D_dorian', minFreqHz: 110 }),
  }),
  Object.freeze({
    id: 'cue_card_s0a_titles',
    atSec: 0.8,
    endSec: 10.8,
    shotId: 'S0A',
    segmentId: 'P1',
    kind: 'card',
    meta: Object.freeze({ cardType: 'opening_titles' }),
  }),
  Object.freeze({
    id: 'cue_vo_s0a_narrator',
    atSec: 0.8,
    endSec: 10.6,
    shotId: 'S0A',
    segmentId: 'P1',
    kind: 'voice',
    speaker: 'narrator',
    text: '告别太阳系的那一天，逃亡舰队失去了母星，也失去了归途。茫茫星海里，这支舰队就是人类唯一的家。前方潜伏着难以想象的宇宙变数，但为了替文明找到下一片宜居的星空，我们别无选择——只能带着希望，一直航行下去。',
  }),

  // P1: S0B (11 - 22s)
  Object.freeze({
    id: 'cue_sfx_s0b1_cryo_latches',
    atSec: 11.2,
    endSec: 14.9,
    shotId: 'S0B',
    segmentId: 'P1',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'cryo_latches' }),
  }),
  Object.freeze({
    id: 'cue_music_s0b2_strings_swell',
    atSec: 14.8,
    endSec: 22.0,
    shotId: 'S0B',
    segmentId: 'P1',
    kind: 'music',
    meta: Object.freeze({ theme: 'dmaj9_strings_swell', key: 'Dmaj9', minFreqHz: 110 }),
  }),
  Object.freeze({
    id: 'cue_vo_s0b2_broadcast',
    atSec: 15.2,
    endSec: 21.3,
    shotId: 'S0B',
    segmentId: 'P1',
    kind: 'voice',
    speaker: 'broadcast',
    text: '全员低温冬眠确认，仅保留轮值科研组在线。远航者编队——开启第 7 次深空超光速跃迁。',
  }),
  Object.freeze({
    id: 'cue_sfx_s0b2_warp_glissando',
    atSec: 18.6,
    endSec: 22.0,
    shotId: 'S0B',
    segmentId: 'P1',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'crystal_warp_glissando' }),
  }),

  // P1: S0C (22 - 26s)
  Object.freeze({
    id: 'cue_card_s0c_coord',
    atSec: 22.2,
    endSec: 25.8,
    shotId: 'S0C',
    segmentId: 'P1',
    kind: 'card',
    meta: Object.freeze({ cardType: 'coord_card' }),
  }),

  // P2: S1 (26 - 35s)
  Object.freeze({
    id: 'cue_music_s1_piano_harp',
    atSec: 26.2,
    endSec: 38.2,
    shotId: 'S1',
    segmentId: 'P2',
    kind: 'music',
    meta: Object.freeze({ theme: 'minimalist_piano_harp', key: 'Dmaj9', minFreqHz: 146.8 }),
  }),
  Object.freeze({
    id: 'cue_vo_s1_linxia_log',
    atSec: 27.6,
    endSec: 34.6,
    shotId: 'S1',
    segmentId: 'P2',
    kind: 'voice',
    speaker: 'linxia',
    text: '第 47 年巡航日志。全舰冬眠体征平稳，距目标星域只剩最后一段跃迁——08 号，等抵达那片新的星空，就叫醒大家。',
  }),

  // P2: S2 (35 - 44s)
  Object.freeze({
    id: 'cue_sfx_s2_veil_crystal',
    atSec: 37.8,
    endSec: 40.4,
    shotId: 'S2',
    segmentId: 'P2',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'crystal_veil_sustain' }),
  }),
  Object.freeze({
    id: 'cue_sfx_s2_scientific_alert',
    atSec: 40.5,
    endSec: 43.9,
    shotId: 'S2',
    segmentId: 'P2',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'scientific_chime_alert' }),
  }),
  Object.freeze({
    id: 'cue_vo_s2_ship_ai',
    atSec: 40.6,
    endSec: 44.0,
    shotId: 'S2',
    segmentId: 'P2',
    kind: 'voice',
    speaker: 'ship_ai',
    text: '预警：跃迁通道前方监测到非欧几里得空间曲率异动……未知高频翘曲边界已接触船体。',
  }),

  // P2: S3 (44 - 55s)
  Object.freeze({
    id: 'cue_sfx_s3_star_extinction',
    atSec: 44.2,
    endSec: 48.6,
    shotId: 'S3',
    segmentId: 'P2',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'star_extinction_silence' }),
  }),
  Object.freeze({
    id: 'cue_sfx_s3_tomb_nonhuman',
    atSec: 48.2,
    endSec: 54.9,
    shotId: 'S3',
    segmentId: 'P2',
    kind: 'sfx',
    speaker: 'tomb_signal',
    meta: Object.freeze({
      sfxType: 'tomb_nonhuman_resonance',
      nonHuman: true,
      skipSpeechSynthesis: true,
    }),
  }),
  Object.freeze({
    id: 'cue_spec_s3_tomb_decode',
    atSec: 48.4,
    endSec: 54.9,
    shotId: 'S3',
    segmentId: 'P2',
    kind: 'spectrometer',
    speaker: 'tomb_signal',
    text: PROLOGUE_TOMB_DECODE_TEXT,
    meta: Object.freeze({
      parsePct: 14,
      nonHuman: true,
      skipSpeechSynthesis: true,
    }),
  }),

  // P3: S4 (55 - 64s)
  Object.freeze({
    id: 'cue_sfx_s4_orb_phase_slip',
    atSec: 55.2,
    endSec: 58.6,
    shotId: 'S4',
    segmentId: 'P3',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'orb_4d_phase_slip' }),
  }),
  Object.freeze({
    id: 'cue_sfx_s4_glass_shards',
    atSec: 58.8,
    endSec: 61.0,
    shotId: 'S4',
    segmentId: 'P3',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'crystal_shard_chimes' }),
  }),
  Object.freeze({
    id: 'cue_vo_s4_linxia_alarm',
    atSec: 59.0,
    endSec: 63.9,
    shotId: 'S4',
    segmentId: 'P3',
    kind: 'voice',
    speaker: 'linxia',
    text: '密封箱根本没开……它直接从里面穿出来了！08 号，快醒醒——空间正在把船体折进去！',
  }),
  Object.freeze({
    id: 'cue_sfx_s4_cryo_emergency',
    atSec: 61.1,
    endSec: 63.9,
    shotId: 'S4',
    segmentId: 'P3',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'cryo_emergency_open' }),
  }),

  // P3: S5 (64 - 71s)
  Object.freeze({
    id: 'cue_sfx_s5_origami_interlock',
    atSec: 64.1,
    endSec: 70.9,
    shotId: 'S5',
    segmentId: 'P3',
    kind: 'sfx',
    meta: Object.freeze({ sfxType: 'origami_interlock_harp' }),
  }),
  Object.freeze({
    id: 'cue_music_s5_harp_gliss',
    atSec: 64.3,
    endSec: 71.1,
    shotId: 'S5',
    segmentId: 'P3',
    kind: 'music',
    meta: Object.freeze({ theme: 'ascending_harp_glissando', key: 'Dmaj9', minFreqHz: 146.8 }),
  }),

  // P3: S6 (71 - 75s) — Pure polar-day silence, ZERO voice / dialogue!
  Object.freeze({
    id: 'cue_music_s6_polar_silence',
    atSec: 71.0,
    endSec: 75.0,
    shotId: 'S6',
    segmentId: 'P3',
    kind: 'music',
    meta: Object.freeze({ theme: 'polar_day_silence', minFreqHz: 220 }),
  }),
]);

// ---------------------------------------------------------------------------
// Internal Math & Spline Helpers
// ---------------------------------------------------------------------------

function smoothstep(edge0, edge1, x) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOutCubic(t) {
  const u = clamp(t, 0, 1);
  return 1 - Math.pow(1 - u, 3);
}

function lerpVec3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function evalCatmullRom3Pure(points, u) {
  if (!points || points.length === 0) return [0, 0, 0];
  if (points.length === 1) return [...points[0]];
  const t = clamp(u, 0, 1);
  const segCount = points.length - 1;
  const scaled = t * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - i;

  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(segCount, i + 1)];
  const p3 = points[Math.min(segCount, i + 2)];

  const tt = localT * localT;
  const ttt = tt * localT;

  const out = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    out[axis] =
      0.5 *
      (2 * p1[axis] +
        (-p0[axis] + p2[axis]) * localT +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * tt +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * ttt);
  }
  return out;
}

function parseHexRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpHex(hexA, hexB, t) {
  const u = clamp(t, 0, 1);
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  const r = Math.round(lerp(a[0], b[0], u));
  const g = Math.round(lerp(a[1], b[1], u));
  const bl = Math.round(lerp(a[2], b[2], u));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// 4D Mathematical Kernels (True SO(4) Tesseract, 4D Sealed-Box Orb, 90° Origami)
// ---------------------------------------------------------------------------

const TESSERACT_BASE_VERTS4 = Object.freeze(
  Array.from({ length: 16 }, (_, idx) =>
    Object.freeze([
      idx & 1 ? 1 : -1,
      idx & 2 ? 1 : -1,
      idx & 4 ? 1 : -1,
      idx & 8 ? 1 : -1,
    ])
  )
);

const TESSERACT_EDGES = Object.freeze(
  (() => {
    const edges = [];
    for (let a = 0; a < 16; a += 1) {
      for (let bit = 0; bit < 4; bit += 1) {
        const b = a ^ (1 << bit);
        if (b > a) {
          edges.push(Object.freeze([a, b]));
        }
      }
    }
    return edges;
  })()
);

/**
 * Compute 3 nested recursive 4D tesseracts (outer, mid, inner) rotated in true SO(4)
 * planes (XW, YW, ZW) via `rotPlane4` and stereographically projected into 3D space.
 */
export function computeRecursiveTesseract4D(timeSec = 0) {
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  const projDist = 3.6;

  const tierSpecs = [
    { id: 'outer', scale: 1.0, xw: t * 0.14 + 0.25, yw: t * 0.09 + 0.18, zw: t * 0.06 },
    { id: 'mid', scale: 0.58, xw: -t * 0.22 + 0.52, yw: t * 0.17 + 0.35, zw: -t * 0.13 + 0.31 },
    { id: 'inner', scale: 0.3, xw: t * 0.34 + 1.05, yw: -t * 0.27 + 0.62, zw: t * 0.21 + 0.78 },
  ];

  const tiers = tierSpecs.map((spec) => {
    const vertices4 = [];
    const vertices3 = [];
    for (let i = 0; i < 16; i += 1) {
      let v = TESSERACT_BASE_VERTS4[i];
      v = rotPlane4(v, 'X', 'W', spec.xw);
      v = rotPlane4(v, 'Y', 'W', spec.yw);
      v = rotPlane4(v, 'Z', 'W', spec.zw);
      vertices4.push(v);

      const factor = (projDist / (projDist - v[3])) * spec.scale;
      vertices3.push([v[0] * factor, v[1] * factor, v[2] * factor]);
    }
    return {
      id: spec.id,
      scale: spec.scale,
      vertices4,
      vertices3,
      edges: TESSERACT_EDGES,
    };
  });

  return {
    timeSec: t,
    edges: TESSERACT_EDGES,
    tiers,
  };
}

/**
 * Compute the 4D (x, y, z, w) trajectory of the metallic calibration sphere passing
 * silently out of the 6-face intact sealed borosilicate box via the 4th spatial axis W.
 *
 * At localT = 0: sphere rests inside sealed box (x = 0, w = 0).
 * While crossing the intact glass wall (|x| = boxHalf): |w| peaks strictly non-zero (~0.42).
 * At localT = 1: sphere floats outside the intact box (x > boxHalf + radius, w = 0).
 */
export function computeSealedBoxOrb4D(localT = 0, options = {}) {
  const u = clamp(Number.isFinite(localT) ? localT : 0, 0, 1);
  const boxHalf = typeof options.boxHalf === 'number' && options.boxHalf > 0 ? options.boxHalf : 0.22;
  const orbRadius = typeof options.orbRadius === 'number' && options.orbRadius > 0 ? options.orbRadius : 0.068;

  const travelU = smoothstep(0.05, 0.92, u);
  const targetX = boxHalf * 2.45; // 0.539m, clearly outside intact 0.22m box wall!
  const x = lerp(0, targetX, easeInOutCubic(travelU));

  const liftU = smoothstep(0.28, 0.96, u);
  const hover = Math.sin(u * Math.PI * 3.0) * 0.012 * smoothstep(0.5, 1.0, u);
  const y = lerp(0, 0.16, easeOutCubic(liftU)) + hover;
  const z = lerp(0, -0.09, easeInOutCubic(smoothstep(0.32, 0.95, u)));

  // Smooth bell curve peaking right as x crosses boxHalf (~u = 0.46)
  const wPhase = smoothstep(0.12, 0.84, u);
  const wBell = Math.sin(wPhase * Math.PI);
  const w = Math.pow(Math.max(0, wBell), 1.35) * 0.42;

  const sliceHaloAlpha = clamp(Math.abs(w) / 0.36, 0, 1);
  const glowIntensity = 0.55 + 1.45 * sliceHaloAlpha;
  const sliceRadiusScale = Math.sqrt(Math.max(0.22, 1 - Math.min(0.78, Math.pow(w / 0.48, 2))));

  const insideBox = Math.abs(x) < boxHalf - orbRadius * 0.5 && Math.abs(w) < 0.05;
  const outsideBox = Math.abs(x) > boxHalf + orbRadius && Math.abs(w) < 0.05;
  const crossingWall = Math.abs(w) >= 0.05;

  return {
    localT: u,
    pos3: [x, y, z],
    pos4: [x, y, z, w],
    w,
    boxHalf,
    orbRadius,
    boxIntact: true,
    insideBox,
    outsideBox,
    crossingWall,
    sliceRadiusScale,
    sliceHaloAlpha,
    glowIntensity,
  };
}

/**
 * Compute staggered ±90° (±π/2 rad) smooth 4D origami fold angles for the Science Cabin
 * panels in Shot S5 (64 - 71s). Reaches exact 0 at localT = 0 and exact ±π/2 at localT = 1.
 */
export function computeBridgeOrigamiAngles(localT = 0) {
  const u = clamp(Number.isFinite(localT) ? localT : 0, 0, 1);
  const HALF_PI = Math.PI * 0.5;

  const leftBulkheadRad = -HALF_PI * easeInOutCubic(smoothstep(0.02, 0.62, u)) || 0;
  const rightBulkheadRad = HALF_PI * easeInOutCubic(smoothstep(0.08, 0.68, u)) || 0;
  const ceilingRad = HALF_PI * easeInOutCubic(smoothstep(0.16, 0.78, u)) || 0;
  const floorRad = -HALF_PI * easeInOutCubic(smoothstep(0.24, 0.86, u)) || 0;
  const bowUpperRad = HALF_PI * easeInOutCubic(smoothstep(0.12, 0.74, u)) || 0;
  const bowLowerRad = -HALF_PI * easeInOutCubic(smoothstep(0.2, 0.82, u)) || 0;

  const hingeGlow = smoothstep(0.0, 0.18, u) * (1 - 0.12 * smoothstep(0.9, 1.0, u));
  const expansionSpread = easeInOutCubic(smoothstep(0.14, 0.96, u));

  return {
    localT: u,
    leftBulkheadRad,
    rightBulkheadRad,
    ceilingRad,
    floorRad,
    bowUpperRad,
    bowLowerRad,
    hingeGlow,
    expansionSpread,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Spectrometer Evaluation (S3 Tomb Non-Human Signal)
// ---------------------------------------------------------------------------

function evaluateSpectrometerAt(tSec) {
  const barCount = 48;
  const active = tSec >= 48.2 && tSec <= 55.0;
  if (!active) {
    return {
      active: false,
      alpha: 0,
      progress: 0,
      parsePct: 0,
      text: '',
      energy: 0,
      bars: new Array(barCount).fill(0),
    };
  }

  const fadeIn = smoothstep(48.2, 49.0, tSec);
  const fadeOut = 1 - smoothstep(54.3, 55.0, tSec);
  const alpha = clamp(fadeIn * fadeOut, 0, 1);
  const progress = clamp((tSec - 48.2) / (55.0 - 48.2), 0, 1);
  const parsePct = Math.round(lerp(3, 14, smoothstep(48.4, 51.4, tSec)));

  // Non-human pulsar + crystal lattice + whale formant analytical 48-bar spectrum
  const dt = tSec - 48.2;
  const pulsarBeat = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(dt * Math.PI * 2.7), 2);
  const whaleCenter = 12 + 10 * Math.sin(dt * 0.78);
  const crystalCenter = 34 + 6 * Math.cos(dt * 1.35);

  const bars = new Array(barCount);
  let sum = 0;
  for (let i = 0; i < barCount; i += 1) {
    const norm = i / (barCount - 1);
    const whaleFormant = Math.exp(-Math.pow((i - whaleCenter) / 5.5, 2)) * 0.72;
    const crystalOvertone = Math.exp(-Math.pow((i - crystalCenter) / 3.8, 2)) * 0.62;
    const latticeRipple =
      (0.16 + 0.14 * Math.sin(i * 1.45 - dt * 5.2) + 0.1 * Math.cos(i * 2.3 + dt * 3.1)) *
      (0.65 + 0.35 * Math.sin(norm * Math.PI));
    const harmonicSpike = i % 6 === 2 ? 0.18 * pulsarBeat : 0;
    const raw = (whaleFormant * pulsarBeat + crystalOvertone + latticeRipple + harmonicSpike) * alpha;
    const clamped = clamp(raw, 0.04 * alpha, 1.0);
    bars[i] = Number(clamped.toFixed(4));
    sum += clamped;
  }

  return {
    active: true,
    alpha,
    progress,
    parsePct,
    text: PROLOGUE_TOMB_DECODE_TEXT,
    energy: Number((sum / barCount).toFixed(4)),
    bars,
  };
}

// ---------------------------------------------------------------------------
// Shot / Segment Lookup & Master Frame Evaluator
// ---------------------------------------------------------------------------

function locateShotAndSegment(tSec) {
  const clamped = clamp(tSec, 0, PROLOGUE_TOTAL_DURATION_SEC);
  let segment = PROLOGUE_SEGMENTS[PROLOGUE_SEGMENTS.length - 1];
  for (const seg of PROLOGUE_SEGMENTS) {
    if (clamped >= seg.startSec && clamped < seg.endSec) {
      segment = seg;
      break;
    }
  }

  let shot = PROLOGUE_SHOTS[PROLOGUE_SHOTS.length - 1];
  for (const sh of PROLOGUE_SHOTS) {
    if (clamped >= sh.startSec && clamped < sh.endSec) {
      shot = sh;
      break;
    }
  }

  let subBeat = shot.subBeats[shot.subBeats.length - 1];
  for (const sb of shot.subBeats) {
    if (clamped >= sb.startSec && clamped < sb.endSec) {
      subBeat = sb;
      break;
    }
  }

  const shotProgress = clamp((clamped - shot.startSec) / Math.max(0.001, shot.endSec - shot.startSec), 0, 1);
  const segmentProgress = clamp(
    (clamped - segment.startSec) / Math.max(0.001, segment.endSec - segment.startSec),
    0,
    1
  );

  return { segment, shot, subBeat, shotProgress, segmentProgress };
}

function evaluateOpeningLinesAlpha(tSec) {
  if (tSec > 11.2) return [0, 0, 0];
  const a0 = smoothstep(0.8, 1.8, tSec) * (1 - smoothstep(9.5, 10.6, tSec));
  const a1 = smoothstep(3.4, 4.4, tSec) * (1 - smoothstep(9.7, 10.7, tSec));
  const a2 = smoothstep(6.2, 7.2, tSec) * (1 - smoothstep(9.9, 10.8, tSec));
  return [clamp(a0, 0, 1), clamp(a1, 0, 1), clamp(a2, 0, 1)];
}

function evaluateCameraAndMood(tSec, subBeatId) {
  // Default values overridden cleanly per sub-beat
  let pos = [0, 0, -12];
  let target = [0, 0, 20];
  let fov = 0.86;
  let roll = 0;
  let shake = 0;

  let iblPreset = 'IBL_DEEP_SPACE';
  let iblIntensity = 1.0;

  let fog = { colorHex: '#040812', density: 0.0032, clearColorHex: '#02050C' };
  let post = {
    exposure: 1.08,
    contrast: 1.16,
    bloomWeight: 0.44,
    bloomThreshold: 0.65,
    vignetteWeight: 1.85,
    grainIntensity: 3.2,
    whiteoutAlpha: 0,
  };

  if (subBeatId === 'S0A') {
    const u = clamp(tSec / 11.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = lerpVec3([0, 0, -12], [0, 0.3, -8], e);
    target = [0, 0, 20];
    fov = lerp(0.84, 0.88, e);
    iblPreset = 'IBL_DEEP_SPACE';
    iblIntensity = 0.8;
    fog = { colorHex: '#040710', density: 0.0035, clearColorHex: '#02040A' };
    post = {
      exposure: 1.04,
      contrast: 1.16,
      bloomWeight: 0.42,
      bloomThreshold: 0.68,
      vignetteWeight: 2.05,
      grainIntensity: 3.4,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S0B-1') {
    const u = clamp((tSec - 11.0) / 4.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = evalCatmullRom3Pure(
      [
        [0, 1.55, 0.2],
        [0.18, 1.53, 1.45],
        [0.42, 1.5, 2.75],
        [0.55, 1.48, 3.8],
      ],
      e
    );
    target = lerpVec3([0.55, 1.32, 8.2], [1.55, 1.25, 5.2], smoothstep(0.15, 0.88, u));
    fov = lerp(0.86, 0.76, e);
    iblPreset = 'IBL_CRYO_CABIN';
    iblIntensity = 1.1;
    fog = { colorHex: '#0B1626', density: 0.017, clearColorHex: '#060D18' };
    post = {
      exposure: 1.12,
      contrast: 1.18,
      bloomWeight: 0.48,
      bloomThreshold: 0.62,
      vignetteWeight: 1.72,
      grainIntensity: 3.2,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S0B-2') {
    const u = clamp((tSec - 15.0) / 7.0, 0, 1);
    const e = easeInOutCubic(u);
    const warpU = smoothstep(18.5, 21.8, tSec);
    pos = evalCatmullRom3Pure(
      [
        [-14, 4.5, -16],
        [-12.2, 3.8, -18.2],
        [-10.2, 3.0, -20.8],
        [-8, 2.2, -24],
      ],
      e
    );
    target = lerpVec3([0, 0.25, 1.5], [0, 0.15, 6.2], e);
    fov = lerp(0.8, 0.9, smoothstep(15.0, 18.5, tSec)) + 0.42 * easeInOutCubic(warpU);
    roll = lerp(-0.04, 0.03, e);
    shake = 0.022 * smoothstep(18.6, 20.3, tSec) * (1 - smoothstep(21.2, 22.0, tSec));
    iblPreset = 'IBL_DEEP_SPACE';
    iblIntensity = lerp(1.18, 1.35, warpU);
    fog = { colorHex: '#061120', density: 0.0026, clearColorHex: '#030812' };
    post = {
      exposure: lerp(1.12, 1.28, warpU),
      contrast: 1.22,
      bloomWeight: lerp(0.54, 0.78, warpU),
      bloomThreshold: lerp(0.6, 0.5, warpU),
      vignetteWeight: 1.82,
      grainIntensity: 3.5,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S0C') {
    const u = clamp((tSec - 22.0) / 4.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = lerpVec3([0, 0.5, -10], [0, 0.2, -14], e);
    target = [0, 0, 30];
    fov = 0.86;
    iblPreset = 'IBL_DEEP_SPACE';
    iblIntensity = 0.86;
    fog = { colorHex: '#040812', density: 0.003, clearColorHex: '#02050C' };
    post = {
      exposure: 1.04,
      contrast: 1.15,
      bloomWeight: 0.42,
      bloomThreshold: 0.68,
      vignetteWeight: 2.0,
      grainIntensity: 3.0,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S1') {
    const u = clamp((tSec - 26.0) / 9.0, 0, 1);
    const e = easeInOutCubic(u);
    // Smooth glide from exterior bow canopy into warm cabin, framing BOTH sleeping cryo-bay (08 号)
    // and warm-lit Lin Xia (07 号) at desk cleanly across KF-07 (28.5s) and KF-08 (33.0s).
    pos = evalCatmullRom3Pure(
      [
        [2.8, 2.1, 8.6],
        [1.9, 1.9, 5.2],
        [0.95, 1.74, 2.95],
        [-1.6, 1.72, -0.4],
      ],
      e
    );
    target = evalCatmullRom3Pure(
      [
        [0.0, 1.28, 1.4],
        [-0.3, 1.22, 0.55],
        [-0.45, 1.2, 0.35],
        [0.25, 1.26, 1.7],
      ],
      e
    );
    fov = lerp(0.84, 0.88, e);
    iblPreset = 'IBL_CRYO_CABIN';
    iblIntensity = 1.18;
    fog = { colorHex: '#0A1320', density: 0.0115, clearColorHex: '#050A14' };
    post = {
      exposure: 1.12,
      contrast: 1.16,
      bloomWeight: 0.44,
      bloomThreshold: 0.65,
      vignetteWeight: 1.58,
      grainIntensity: 3.0,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S2') {
    const u = clamp((tSec - 35.0) / 9.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = lerpVec3([-11, 3.2, 6.5], [-12.5, 2.6, 10.5], e);
    target = lerpVec3([0, 0.5, 0], [0, 0.5, 4.0], e);
    fov = lerp(0.86, 0.82, e);
    iblPreset = 'IBL_DEEP_SPACE';
    iblIntensity = 1.22;
    fog = { colorHex: '#050C18', density: 0.0026, clearColorHex: '#02060E' };
    post = {
      exposure: 1.14,
      contrast: 1.2,
      bloomWeight: 0.54,
      bloomThreshold: 0.58,
      vignetteWeight: 1.78,
      grainIntensity: 3.3,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S3') {
    const u = clamp((tSec - 44.0) / 11.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = evalCatmullRom3Pure(
      [
        [-9, 1.5, -24],
        [-13.5, 5.2, -39],
        [-19.0, 9.8, -58],
        [-24, 14, -76],
      ],
      e
    );
    target = lerpVec3([0, 1.5, 16], [0, 6.0, 40], e);
    fov = lerp(0.84, 0.98, e);
    iblPreset = 'IBL_DEEP_SPACE';
    iblIntensity = 1.28;
    fog = { colorHex: '#030812', density: 0.0014, clearColorHex: '#01040A' };
    post = {
      exposure: 1.16,
      contrast: 1.24,
      bloomWeight: 0.64,
      bloomThreshold: 0.52,
      vignetteWeight: 2.02,
      grainIntensity: 3.6,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S4-1') {
    // Meteor dive from (0, 2.4, 15) piercing bow canopy (z=5.2) straight to sealed box close-up
    const diveU = easeOutCubic(clamp((tSec - 55.0) / 1.45, 0, 1));
    const inspectU = easeInOutCubic(clamp((tSec - 56.45) / 2.25, 0, 1));
    const shatterTiltU = easeInOutCubic(clamp((tSec - 58.7) / 2.3, 0, 1));

    if (tSec < 56.45) {
      pos = evalCatmullRom3Pure(
        [
          [0, 2.4, 15.0],
          [-0.22, 2.05, 8.2],
          [-0.58, 1.78, 3.2],
          [-0.86, 1.66, 0.72],
        ],
        diveU
      );
      target = lerpVec3([0, 1.35, 3.2], [0, 1.14, 2.05], diveU);
      fov = lerp(1.12, 0.86, diveU);
      shake = 0.028 * (1 - diveU);
    } else {
      pos = lerpVec3([-0.86, 1.66, 0.72], [-1.15, 1.62, 0.45], inspectU);
      const boxTarget = lerpVec3([0.0, 1.14, 2.05], [0.2, 1.2, 2.05], inspectU);
      target = lerpVec3(boxTarget, [0.05, 1.52, 4.4], shatterTiltU * 0.72);
      fov = lerp(0.86, 0.84, inspectU) + 0.05 * shatterTiltU;
      shake = 0.012 * Math.sin(clamp((tSec - 59.0) / 1.8, 0, 1) * Math.PI);
    }
    iblPreset = 'IBL_CRYO_CABIN';
    iblIntensity = 1.18;
    fog = { colorHex: '#0A1524', density: 0.011, clearColorHex: '#050B15' };
    post = {
      exposure: 1.14,
      contrast: 1.2,
      bloomWeight: 0.56,
      bloomThreshold: 0.56,
      vignetteWeight: 1.68,
      grainIntensity: 3.2,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S4-2') {
    // Crisp whip-pan to rear 08 号 cryo-pod at (-2.3, 1.25, -1.6), then into waking 08 号 POV
    const panU = easeInOutCubic(clamp((tSec - 61.0) / 1.4, 0, 1));
    const povU = easeInOutCubic(clamp((tSec - 62.4) / 1.6, 0, 1));

    if (tSec < 62.4) {
      pos = lerpVec3([-1.15, 1.62, 0.45], [-0.5, 1.56, 0.25], panU);
      target = lerpVec3([0.0, 1.2, 2.1], [-2.3, 1.25, -1.6], panU);
      fov = lerp(0.89, 0.84, panU);
    } else {
      pos = lerpVec3([-0.5, 1.56, 0.25], [-1.4, 1.58, -1.2], povU);
      target = lerpVec3([-2.3, 1.25, -1.6], [0, 1.5, 3.5], povU);
      fov = lerp(0.84, 0.9, povU);
    }
    iblPreset = 'IBL_CRYO_CABIN';
    iblIntensity = 1.14;
    fog = { colorHex: '#0B1826', density: 0.0135, clearColorHex: '#060E18' };
    post = {
      exposure: 1.15,
      contrast: 1.18,
      bloomWeight: 0.54,
      bloomThreshold: 0.58,
      vignetteWeight: 1.62,
      grainIntensity: 3.0,
      whiteoutAlpha: 0,
    };
  } else if (subBeatId === 'S5') {
    const u = clamp((tSec - 64.0) / 7.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = lerpVec3([-1.4, 1.58, -1.2], [0, 1.62, -2.6], e);
    target = lerpVec3([0, 1.5, 3.5], [0, 1.6, 5.0], e);
    fov = lerp(0.9, 0.96, e);
    iblPreset = tSec < 67.0 ? 'IBL_CRYO_CABIN' : 'IBL_POLAR_DAY';
    iblIntensity = lerp(1.16, 1.48, e);
    const brighten = smoothstep(0.84, 1.0, u);
    fog = {
      colorHex: lerpHex('#0A1628', '#CFE0EE', brighten),
      density: lerp(0.004, 0.0075, brighten),
      clearColorHex: lerpHex('#050C18', '#E6EFF7', brighten),
    };
    post = {
      exposure: lerp(1.15, 1.38, brighten),
      contrast: lerp(1.18, 1.08, brighten),
      bloomWeight: lerp(0.56, 0.72, brighten),
      bloomThreshold: lerp(0.56, 0.46, brighten),
      vignetteWeight: lerp(1.55, 0.55, brighten),
      grainIntensity: lerp(3.0, 1.4, brighten),
      whiteoutAlpha: lerp(0, 0.14, smoothstep(0.72, 1.0, u)),
    };
  } else {
    // S6 (71 - 75s): Polar-day pure-white geometric wave & tranquil drift
    const u = clamp((tSec - 71.0) / 4.0, 0, 1);
    const e = easeInOutCubic(u);
    pos = lerpVec3([0, 1.62, -2.6], [0, 1.65, -1.8], e);
    target = [0, 1.6, 6.0];
    fov = lerp(0.96, 0.92, e);
    iblPreset = 'IBL_POLAR_DAY';
    iblIntensity = 1.55;
    const whiteout = lerp(0.14, 1.0, smoothstep(71.0, 74.3, tSec));
    fog = {
      colorHex: lerpHex('#CFE0EE', '#FFFFFF', e),
      density: lerp(0.0075, 0.004, e),
      clearColorHex: lerpHex('#E6EFF7', '#FFFFFF', e),
    };
    post = {
      exposure: lerp(1.38, 1.65, e),
      contrast: lerp(1.08, 1.0, e),
      bloomWeight: lerp(0.72, 0.84, e),
      bloomThreshold: lerp(0.46, 0.34, e),
      vignetteWeight: lerp(0.55, 0.0, e),
      grainIntensity: lerp(1.4, 0.0, e),
      whiteoutAlpha: clamp(whiteout, 0, 1),
    };
  }

  return {
    camera: { pos, target, fov, roll, shake },
    iblPreset,
    iblIntensity,
    fog,
    post,
  };
}

function evaluateActiveSubtitle(tSec) {
  // Strictly ZERO subtitle in S6 (71 - 75s)
  if (tSec >= 71.0) return null;
  for (const cue of PROLOGUE_CUES) {
    if (cue.kind !== 'voice') continue;
    if (tSec >= cue.atSec && tSec <= cue.endSec) {
      const sp = PROLOGUE_SPEAKERS[cue.speaker] || PROLOGUE_SPEAKERS.narrator;
      const fadeIn = smoothstep(cue.atSec, cue.atSec + 0.35, tSec);
      const fadeOut = 1 - smoothstep(cue.endSec - 0.35, cue.endSec, tSec);
      return {
        speakerId: sp.speakerId,
        speakerLabel: sp.speakerLabel,
        text: cue.text,
        color: sp.color,
        alpha: clamp(fadeIn * fadeOut, 0, 1),
      };
    }
  }
  return null;
}

/**
 * Pure immutable evaluator for any timestamp tSec ∈ [0, 75.0].
 * Returns exact Contract A snapshot consumed by scene facade, segments, audio, and cinema overlay.
 */
export function evaluatePrologueAt(tSec = 0) {
  const safeT = clamp(Number.isFinite(tSec) ? tSec : 0, 0, PROLOGUE_TOTAL_DURATION_SEC);
  const { segment, shot, subBeat, shotProgress, segmentProgress } = locateShotAndSegment(safeT);
  const { camera, iblPreset, iblIntensity, fog, post } = evaluateCameraAndMood(safeT, subBeat.id);

  // 2.35:1 letterbox: 1.0 across [0, 71.5], eases smoothly 1.0 -> 0.0 across [71.5, 74.8]
  const letterboxRatio = safeT <= 71.5 ? 1.0 : 1.0 - easeInOutCubic(clamp((safeT - 71.5) / 3.3, 0, 1));

  // S0A opening lines & S0C coordinate card
  const openingLinesAlpha = evaluateOpeningLinesAlpha(safeT);
  const coordCardAlpha =
    safeT >= 22.0 && safeT <= 26.0
      ? clamp(smoothstep(22.25, 22.95, safeT) * (1 - smoothstep(25.0, 25.8, safeT)), 0, 1)
      : 0;

  // S2 alert: strictly 0 during unaware crossing (35 - 40.5s), activates cleanly +2.0s after full immersion (t >= 40.5s)
  let alertLevel = 0;
  if (safeT >= 40.5 && safeT < 44.2) {
    const ramp = smoothstep(40.5, 41.3, safeT);
    const pulse = 0.72 + 0.28 * Math.sin((safeT - 40.5) * Math.PI * 2.2);
    const fadeOut = 1 - smoothstep(43.7, 44.2, safeT);
    alertLevel = clamp(ramp * pulse * fadeOut, 0, 1);
  }

  // S3 star extinction & Tomb spectrometer
  const starExtinctionProgress =
    safeT < 44.0 ? 0 : safeT <= 55.0 ? smoothstep(44.2, 48.8, safeT) : 1;
  const spectrometer = evaluateSpectrometerAt(safeT);

  // S4-1 4D sealed-box orb passage (55.2 - 58.6s), X-ray wave (57.2 - 59.6s), glass shatter (58.8 - 60.8s)
  const orbLocalT = safeT < 55.2 ? 0 : clamp((safeT - 55.2) / (58.6 - 55.2), 0, 1);
  const orbExcursion4D = computeSealedBoxOrb4D(orbLocalT);
  const xrayWaveProgress =
    safeT >= 57.2 && safeT <= 59.6 ? clamp((safeT - 57.2) / (59.6 - 57.2), 0, 1) : 0;
  const shatterProgress =
    safeT < 58.8 ? 0 : safeT < 60.8 ? clamp((safeT - 58.8) / (60.8 - 58.8), 0, 1) : 1;

  // S4-2 08 号 cryo-pod emergency wake-up (61.0 - 64.0s)
  const cryoWakeupProgress =
    safeT < 61.0 ? 0 : safeT < 64.0 ? clamp((safeT - 61.0) / 3.0, 0, 1) : 1;

  // S5 bridge 90° origami unfolding (64.0 - 71.0s)
  const origamiFoldProgress =
    safeT < 64.0 ? 0 : safeT < 71.0 ? clamp((safeT - 64.0) / 7.0, 0, 1) : 1;

  const activeSubtitle = evaluateActiveSubtitle(safeT);
  const activeCues = PROLOGUE_CUES.filter((c) => safeT >= c.atSec && safeT <= c.endSec);

  return {
    elapsedSec: safeT,
    totalDurationSec: PROLOGUE_TOTAL_DURATION_SEC,
    segmentId: segment.id,
    shotId: shot.id,
    subBeatId: subBeat.id,
    shotProgress,
    segmentProgress,
    camera,
    post,
    fog,
    iblPreset,
    iblIntensity,
    letterboxRatio,
    openingLinesAlpha,
    openingLinesText: PROLOGUE_OPENING_LINES,
    coordCardAlpha,
    coordCardLines: PROLOGUE_COORD_CARD_LINES,
    alertLevel,
    starExtinctionProgress,
    spectrometer,
    orbExcursion4D,
    xrayWaveProgress,
    shatterProgress,
    cryoWakeupProgress,
    origamiFoldProgress,
    activeSubtitle,
    activeCues,
  };
}

// ---------------------------------------------------------------------------
// Stateful Deterministic Prologue Director
// ---------------------------------------------------------------------------

export class PrologueDirectorState {
  constructor() {
    this.reset();
  }

  reset() {
    this.levelId = 0;
    this.elapsedSec = 0;
    this.totalDurationSec = PROLOGUE_TOTAL_DURATION_SEC;
    this.completed = false;
    this.skipped = false;
    this.beat = 1;
    this.voiceTriggered = false;
    this.firedCueIds = new Set();
    this._snapshot = evaluatePrologueAt(0);
    return this._snapshot;
  }

  _syncBeatFromSnapshot() {
    const seg = this._snapshot.segmentId;
    this.beat = seg === 'P1' ? 1 : seg === 'P2' ? 2 : 3;
  }

  update(dtSec) {
    const safeDt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
    if (this.completed || safeDt === 0) {
      return {
        phase: this.completed ? 'done' : this._snapshot.shotId,
        shotId: this._snapshot.shotId,
        subBeatId: this._snapshot.subBeatId,
        segmentId: this._snapshot.segmentId,
        justCompleted: false,
        triggerVoice: false,
        firedCues: [],
        snapshot: this._snapshot,
      };
    }

    this.elapsedSec = Math.min(this.totalDurationSec, this.elapsedSec + safeDt);

    const firedCues = [];
    for (const cue of PROLOGUE_CUES) {
      if (cue.atSec <= this.elapsedSec && !this.firedCueIds.has(cue.id)) {
        this.firedCueIds.add(cue.id);
        firedCues.push(cue);
      }
    }

    let triggerVoice = false;
    if (!this.voiceTriggered && this.elapsedSec >= 0.8) {
      this.voiceTriggered = true;
      triggerVoice = true;
    }

    this._snapshot = evaluatePrologueAt(this.elapsedSec);
    this._syncBeatFromSnapshot();

    let justCompleted = false;
    if (this.elapsedSec >= this.totalDurationSec) {
      this.completed = true;
      justCompleted = true;
    }

    return {
      phase: this.completed ? 'done' : this._snapshot.shotId,
      shotId: this._snapshot.shotId,
      subBeatId: this._snapshot.subBeatId,
      segmentId: this._snapshot.segmentId,
      justCompleted,
      triggerVoice,
      firedCues,
      snapshot: this._snapshot,
    };
  }

  seek(tSec) {
    const target = clamp(Number.isFinite(tSec) ? tSec : 0, 0, this.totalDurationSec);
    this.elapsedSec = target;
    this.skipped = false;
    this.completed = target >= this.totalDurationSec;
    this.voiceTriggered = target >= 0.8;

    this.firedCueIds.clear();
    for (const cue of PROLOGUE_CUES) {
      if (cue.atSec <= target) {
        this.firedCueIds.add(cue.id);
      }
    }

    this._snapshot = evaluatePrologueAt(target);
    this._syncBeatFromSnapshot();
    return this._snapshot;
  }

  skip() {
    this.skipped = true;
    this.completed = true;
    this.elapsedSec = this.totalDurationSec;
    this.voiceTriggered = true;
    for (const cue of PROLOGUE_CUES) {
      this.firedCueIds.add(cue.id);
    }
    this._snapshot = evaluatePrologueAt(this.totalDurationSec);
    this.beat = 3;
    return this._snapshot;
  }

  getSnapshot() {
    return this._snapshot;
  }
}
