/**
 * Beyond 3D — Deterministic Unit Tests for Prologue Zero-Hum Audio Director & Voice Cast
 *
 * Verifies Contract E & Hard Redlines FORBID-01, FORBID-04, FORBID-05:
 * - Zero low-frequency ship cruise hum (`shipHumActive === false`, zero continuous < 160 Hz drone,
 *   zero calls to station/sanctuary ambience methods, zero looping ventilation buffers)
 * - Zero human speechSynthesis / TTS for Tomb (`tombTtsCount === 0`, `tomb_signal.skipSpeechSynthesis === true`)
 * - Zero dialogue cues emitted in S6 (71-75s)
 * - 3-layer Tomb non-human Web Audio synthesis (pulsar + reversed crystal lattice + whale formants)
 * - Deterministic 48-bar analytical spectrometer fallback in suspended/headless mode + live AnalyserNode blend
 * - VO -6 dB ducking, Esc pause/resume, and zero-leak stopAll()/dispose() cleanup
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluatePrologueAt,
  PROLOGUE_CUES,
  PrologueDirectorState,
} from '../src/core/prologue-timeline.js';
import { CharacterVoiceEngine, SPEAKERS } from '../src/engine/character-voice.js';
import { PrologueAudioDirector } from '../src/engine/prologue-audio.js';

function createMockAudioParam(initial = 0) {
  const events = [];
  return {
    value: initial,
    events,
    setValueAtTime(v, t) {
      this.value = v;
      events.push({ op: 'set', v, t });
    },
    linearRampToValueAtTime(v, t) {
      this.value = v;
      events.push({ op: 'linear', v, t });
    },
    exponentialRampToValueAtTime(v, t) {
      this.value = v;
      events.push({ op: 'exp', v, t });
    },
    setTargetAtTime(v, t, tc) {
      this.value = v;
      events.push({ op: 'target', v, t, tc });
    },
  };
}

function createMockAudioContext({ initialState = 'running', liveAnalyserFill = 0 } = {}) {
  const oscillators = [];
  const bufferSources = [];
  const gains = [];
  const filters = [];
  let suspendedCount = 0;
  let resumedCount = 0;
  let closed = false;

  const ctx = {
    state: initialState,
    sampleRate: 44100,
    currentTime: 0,
    destination: { kind: 'destination' },
    oscillators,
    bufferSources,
    gains,
    filters,
    get suspendedCount() {
      return suspendedCount;
    },
    get resumedCount() {
      return resumedCount;
    },
    get closed() {
      return closed;
    },
    createGain() {
      const node = {
        kind: 'gain',
        gain: createMockAudioParam(1),
        connectedTo: [],
        disconnected: false,
        connect(target) {
          this.connectedTo.push(target);
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      gains.push(node);
      return node;
    },
    createBiquadFilter() {
      const node = {
        kind: 'filter',
        type: 'lowpass',
        frequency: createMockAudioParam(350),
        Q: createMockAudioParam(1),
        connectedTo: [],
        disconnected: false,
        connect(target) {
          this.connectedTo.push(target);
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      filters.push(node);
      return node;
    },
    createOscillator() {
      const osc = {
        kind: 'oscillator',
        type: 'sine',
        frequency: createMockAudioParam(440),
        startTime: null,
        stopTime: null,
        stopped: false,
        disconnected: false,
        onended: null,
        connectedTo: [],
        connect(target) {
          this.connectedTo.push(target);
        },
        disconnect() {
          this.disconnected = true;
        },
        start(t = 0) {
          this.startTime = t;
        },
        stop(t = 0) {
          this.stopTime = t;
          this.stopped = true;
        },
      };
      oscillators.push(osc);
      return osc;
    },
    createBuffer(channels, length, rate) {
      const channelData = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate: rate,
        getChannelData(ch) {
          return channelData[ch];
        },
      };
    },
    createBufferSource() {
      const src = {
        kind: 'bufferSource',
        buffer: null,
        loop: false,
        startTime: null,
        stopTime: null,
        stopped: false,
        disconnected: false,
        onended: null,
        connectedTo: [],
        connect(target) {
          this.connectedTo.push(target);
        },
        disconnect() {
          this.disconnected = true;
        },
        start(t = 0) {
          this.startTime = t;
        },
        stop(t = 0) {
          this.stopTime = t;
          this.stopped = true;
        },
      };
      bufferSources.push(src);
      return src;
    },
    createConvolver() {
      return {
        kind: 'convolver',
        buffer: null,
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
      };
    },
    createDynamicsCompressor() {
      return {
        kind: 'compressor',
        threshold: createMockAudioParam(-24),
        ratio: createMockAudioParam(4),
        attack: createMockAudioParam(0.003),
        release: createMockAudioParam(0.25),
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
      };
    },
    createAnalyser() {
      return {
        kind: 'analyser',
        fftSize: 128,
        frequencyBinCount: 64,
        smoothingTimeConstant: 0.8,
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        getByteFrequencyData(arr) {
          for (let i = 0; i < arr.length; i += 1) {
            arr[i] = liveAnalyserFill > 0 ? Math.min(255, Math.round(liveAnalyserFill * (0.4 + 0.6 * ((i * 7) % 11) / 10))) : 0;
          }
        },
      };
    },
    suspend() {
      suspendedCount += 1;
      this.state = 'suspended';
      return Promise.resolve();
    },
    resume() {
      resumedCount += 1;
      this.state = 'running';
      return Promise.resolve();
    },
    close() {
      closed = true;
      this.state = 'closed';
      return Promise.resolve();
    },
  };

  return ctx;
}

function createMockSfxAndVoice() {
  const sfxCalls = { stopAmbience: 0, startStation: 0, startSanctuary: 0 };
  const sfxEngine = {
    ambienceNodes: null,
    stopAmbience() {
      sfxCalls.stopAmbience += 1;
      this.ambienceNodes = null;
    },
    startStationAmbience() {
      sfxCalls.startStation += 1;
      this.ambienceNodes = { hum: true };
    },
    startSanctuaryAmbience() {
      sfxCalls.startSanctuary += 1;
      this.ambienceNodes = { drone: true };
    },
  };

  const spoken = [];
  let cancelCount = 0;
  const voiceEngine = {
    spoken,
    get cancelCount() {
      return cancelCount;
    },
    speak(speakerId, text, options = {}) {
      spoken.push({ speakerId, text, options });
    },
    cancel() {
      cancelCount += 1;
    },
  };

  return { sfxEngine, sfxCalls, voiceEngine };
}

test('FORBID-04: Zero ship cruise hum, zero station ambience, zero continuous <160Hz drone across full 75s', () => {
  const mockCtx = createMockAudioContext({ initialState: 'running' });
  const { sfxEngine, sfxCalls, voiceEngine } = createMockSfxAndVoice();

  const director = new PrologueAudioDirector(sfxEngine, voiceEngine, {
    audioContextFactory: () => mockCtx,
  });
  assert.equal(director.unlock(), true);

  const state = new PrologueDirectorState();
  for (let step = 0; step < 755; step += 1) {
    mockCtx.currentTime = state.elapsedSec;
    const res = state.update(0.1);
    if (res.firedCues.length > 0) {
      director.handleFiredCues(res.firedCues, res.snapshot);
    }
    director.update(res.snapshot, 0.1);
  }

  const telemetry = director.getTelemetry();
  assert.equal(telemetry.audioMode, 'prologue_cinema');
  assert.equal(telemetry.shipHumActive, false);
  assert.equal(telemetry.stationAmbienceActive, false);
  assert.equal(sfxCalls.startStation, 0);
  assert.equal(sfxCalls.startSanctuary, 0);
  assert.ok(sfxCalls.stopAmbience >= 1);

  // Zero looping ventilation/engine noise buffers anywhere
  assert.ok(mockCtx.bufferSources.length > 0, 'Expected finite burst & reversed-lattice buffers');
  for (const src of mockCtx.bufferSources) {
    assert.equal(src.loop, false, 'Prologue audio must never create looping noise buffers');
  }

  // Zero continuous < 160 Hz mechanical drone (> 2.5s) anywhere in the score
  assert.ok(mockCtx.oscillators.length >= 25, 'Expected rich procedural cinema score oscillators');
  for (const osc of mockCtx.oscillators) {
    const startFreq = osc.frequency.events[0]?.v ?? osc.frequency.value;
    const duration = (osc.stopTime ?? 999) - (osc.startTime ?? 0);
    if (startFreq < 160) {
      assert.ok(
        duration <= 2.5,
        `Found low-frequency oscillator (${startFreq} Hz) running ${duration.toFixed(2)}s > 2.5s`
      );
    }
  }

  director.dispose();
});

test('FORBID-05 & FORBID-01: Zero Tomb human TTS even when firing all PROLOGUE_CUES + adversarial cue; zero S6 voice', () => {
  const mockCtx = createMockAudioContext({ initialState: 'running' });
  const { sfxEngine, voiceEngine } = createMockSfxAndVoice();

  const director = new PrologueAudioDirector(sfxEngine, voiceEngine, {
    audioContextFactory: () => mockCtx,
  });
  director.unlock();

  // Fire EVERY authoritative cue in PROLOGUE_CUES
  const snapS3 = evaluatePrologueAt(52.0);
  director.handleFiredCues(PROLOGUE_CUES, snapS3);

  // Also test adversarial injection of a tomb_signal voice cue & S6 voice cue
  director.handleFiredCues(
    [
      {
        id: 'adv_tomb_voice',
        atSec: 50.0,
        endSec: 54.0,
        shotId: 'S3',
        segmentId: 'P2',
        kind: 'voice',
        speaker: 'tomb_signal',
        text: 'forbidden tomb speech test',
      },
      {
        id: 'adv_s6_voice',
        atSec: 72.0,
        endSec: 74.0,
        shotId: 'S6',
        segmentId: 'P3',
        kind: 'voice',
        speaker: 'linxia',
        text: 'forbidden s6 dialogue test',
      },
    ],
    evaluatePrologueAt(72.5)
  );

  const telemetry = director.getTelemetry();
  assert.equal(telemetry.tombTtsCount, 0);

  const tombSpoken = voiceEngine.spoken.filter(
    (s) => s.speakerId === 'tomb_signal' || s.speakerId === 'tomb'
  );
  assert.equal(tombSpoken.length, 0, 'Tomb must NEVER invoke human voiceEngine.speak()');

  const s6Spoken = voiceEngine.spoken.filter((s) => s.options?.cue === 'adv_s6_voice');
  assert.equal(s6Spoken.length, 0, 'S6 must NEVER emit any voice dialogue');

  // Verify Tomb non-human Web Audio synthesis actually produced pulsar + whale + reversed crystal nodes
  const hasPulsar1420 = mockCtx.oscillators.some(
    (o) => Math.abs((o.frequency.events[0]?.v ?? 0) - 1420) < 20
  );
  const hasWhaleFormant = mockCtx.filters.some((f) => f.type === 'bandpass' && f.Q.value >= 6.0);
  const hasReversedLatticeBuf = mockCtx.bufferSources.some((s) => s.buffer && s.buffer.length > 44100);
  assert.equal(hasPulsar1420, true, 'Expected 1420 Hz pulsar pings for Tomb non-human acoustics');
  assert.equal(hasWhaleFormant, true, 'Expected Q>=6 resonant whale formant filters for Tomb');
  assert.equal(hasReversedLatticeBuf, true, 'Expected reversed crystal lattice buffer for Tomb');

  director.dispose();
});

test('CharacterVoiceEngine exposes narrator/broadcast/ship_ai/tomb_signal and hard-blocks speechSynthesis for tomb_signal', () => {
  assert.equal(SPEAKERS.narrator.displayName, '旁白');
  assert.equal(SPEAKERS.broadcast.displayName, '舰桥广播');
  assert.equal(SPEAKERS.ship_ai.displayName, '远航者号 · 舰载系统');
  assert.equal(SPEAKERS.tomb_signal.displayName, '舰载量子频谱仪');
  assert.equal(SPEAKERS.tomb_signal.color, '#4DE6D3');
  assert.equal(SPEAKERS.tomb_signal.skipSpeechSynthesis, true);

  const prevSynth = globalThis.speechSynthesis;
  const prevUtter = globalThis.SpeechSynthesisUtterance;
  let speakCalls = 0;
  let lastSpokenText = '';

  try {
    globalThis.SpeechSynthesisUtterance = class MockUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.pitch = 1;
        this.rate = 1;
        this.volume = 1;
      }
    };
    globalThis.speechSynthesis = {
      getVoices: () => [],
      cancel() {},
      speak(u) {
        speakCalls += 1;
        lastSpokenText = u.text;
      },
    };

    const voice = new CharacterVoiceEngine({ onSubtitle: () => {} });
    voice.userUnlocked = true;

    // Tomb signal MUST NEVER call speechSynthesis.speak
    voice.speak('tomb_signal', '[未知高维引力波频谱 · 语义解析率 14%]：……干涸……海……新的访客……');
    assert.equal(speakCalls, 0, 'tomb_signal must NEVER trigger speechSynthesis.speak()');

    // Narrator SHOULD work normally
    voice.speak('narrator', '告别太阳系的那一天。', { skipChirp: true });
    assert.equal(speakCalls, 1);
    assert.equal(lastSpokenText, '告别太阳系的那一天。');

    voice.cancel();
  } finally {
    globalThis.speechSynthesis = prevSynth;
    globalThis.SpeechSynthesisUtterance = prevUtter;
  }
});

test('Spectrometer returns deterministic 48-bar floats in [0, 1] for suspended/headless and blends live AnalyserNode', () => {
  const suspendedCtx = createMockAudioContext({ initialState: 'suspended' });
  const { sfxEngine, voiceEngine } = createMockSfxAndVoice();
  const director = new PrologueAudioDirector(sfxEngine, voiceEngine, {
    audioContextFactory: () => suspendedCtx,
  });

  // Outside S3 -> 48 zeros
  const barsS0A = director.getSpectrometerBars(48, evaluatePrologueAt(5.0));
  assert.equal(barsS0A.length, 48);
  assert.ok(barsS0A.every((v) => v === 0));

  // Inside S3 (KF-12) without unlocking AudioContext -> deterministic analytical fallback
  const snap52 = evaluatePrologueAt(52.0);
  const barsA = director.getSpectrometerBars(48, snap52);
  const barsB = director.getSpectrometerBars(48, snap52);
  assert.equal(barsA.length, 48);
  assert.deepEqual(barsA, barsB, 'Analytical fallback must be 100% deterministic');
  assert.ok(barsA.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  const spread = Math.max(...barsA) - Math.min(...barsA);
  assert.ok(spread > 0.15, `Expected non-flat spectrum spread > 0.15, got ${spread.toFixed(3)}`);

  director.dispose();

  // With running AudioContext & live AnalyserNode data -> smoothly blended valid [0, 1] output
  const liveCtx = createMockAudioContext({ initialState: 'running', liveAnalyserFill: 200 });
  const liveDirector = new PrologueAudioDirector(sfxEngine, voiceEngine, {
    audioContextFactory: () => liveCtx,
  });
  liveDirector.unlock();
  const blended = liveDirector.getSpectrometerBars(48, evaluatePrologueAt(53.2));
  assert.equal(blended.length, 48);
  assert.ok(blended.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.ok(Math.max(...blended) > 0.25);

  liveDirector.dispose();
});

test('VO -6 dB ducking, pause/resume, stopAll(), and dispose() cleanly release all oscillators', () => {
  const mockCtx = createMockAudioContext({ initialState: 'running' });
  const { sfxEngine, voiceEngine } = createMockSfxAndVoice();

  const director = new PrologueAudioDirector(sfxEngine, voiceEngine, {
    audioContextFactory: () => mockCtx,
  });
  director.unlock();

  // Trigger S0A music + narrator voice -> verify -6 dB ducking on musicDuckGain
  const s0aMusic = PROLOGUE_CUES.find((c) => c.id === 'cue_music_s0a_piano_cello');
  const s0aVoice = PROLOGUE_CUES.find((c) => c.id === 'cue_vo_s0a_narrator');
  director.handleFiredCues([s0aMusic, s0aVoice], evaluatePrologueAt(1.0));
  assert.equal(director.musicDuckGain.gain.value, 0.5, 'Expected -6 dB (0.5) ducking during narration');

  // After narration ends -> ducking restores to 1.0
  director.update(evaluatePrologueAt(24.0), 0.1);
  assert.equal(director.musicDuckGain.gain.value, 1.0, 'Expected ducking restoration after narration');

  // Pause & resume suspend/resume AudioContext
  director.setPaused(true);
  assert.equal(mockCtx.state, 'suspended');
  assert.equal(mockCtx.suspendedCount, 1);

  director.setPaused(false);
  assert.equal(mockCtx.state, 'running');
  assert.ok(mockCtx.resumedCount >= 1);

  // Active sources tracked before stopAll()
  assert.ok(director.getTelemetry().activeOscillators > 0);
  director.stopAll();
  assert.equal(director.getTelemetry().activeOscillators, 0);
  assert.ok(mockCtx.oscillators.every((o) => o.stopped && o.disconnected));

  // Dispose closes context cleanly and is idempotent
  director.dispose();
  assert.equal(mockCtx.closed, true);
  assert.doesNotThrow(() => director.dispose());
});
