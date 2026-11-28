/**
 * Beyond 3D — Prologue Zero-Hum Cinematic Procedural Web Audio Director
 *
 * Implements Contract E of PROJECT.md & docs/design/prologue-spec-v1.md §7:
 * - Zero low-frequency ship cruise hum (`shipHumActive: false` ALWAYS; zero continuous < 160 Hz drone)
 * - D Dorian / Dmaj9 procedural cinema score:
 *     * Minimalist crystal solo piano (additive micro-detuned harmonics + soft hammer transient)
 *     * Warm lyrical bowed cello phrases (>= 110 Hz, <= 2.3s bowed arcs with vibrato, never static drone)
 *     * Ethereal harp harmonics & radiant ascending Dmaj9 glissando
 *     * Crisp cryo-pod pneumatic latches & gentle mist whispers (S0B-1, S4-2)
 *     * Crystalline FTL warp harmonic glissando (S0B-2)
 *     * Restrained scientific predictive two-tone chime 880 Hz -> 1174.66 Hz (S2 +2s alert)
 *     * Tomb Non-Human 3-Layer High-Dimensional Acoustics (S3: prime pulsar pings +
 *       reversed irrational-ratio crystal lattice buffer + deep-sea whale formant glides;
 *       STRICTLY ZERO speechSynthesis / human TTS calls)
 *     * 4D phase-slip chime, weightless crystal glass-shard chimes (zero decompression blast),
 *       monumental 90° origami interlock chords, and polar-day profound silence (S6)
 * - Smooth -6 dB VO ducking on music bus during human narration/dialogue
 * - Live AnalyserNode + deterministic analytical 48-bar spectrometer fallback for headless audits
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function resampleBars(src, targetCount) {
  const out = new Array(targetCount).fill(0);
  if (!Array.isArray(src) || src.length === 0) return out;
  if (src.length === targetCount) {
    for (let i = 0; i < targetCount; i += 1) {
      const v = Number(src[i]);
      out[i] = Number.isFinite(v) ? clamp(v, 0, 1) : 0;
    }
    return out;
  }
  const denom = Math.max(1, targetCount - 1);
  const srcMax = src.length - 1;
  for (let i = 0; i < targetCount; i += 1) {
    const pos = (i / denom) * srcMax;
    const lo = Math.floor(pos);
    const hi = Math.min(srcMax, lo + 1);
    const frac = pos - lo;
    const a = Number(src[lo]) || 0;
    const b = Number(src[hi]) || 0;
    out[i] = clamp(a + (b - a) * frac, 0, 1);
  }
  return out;
}

export class PrologueAudioDirector {
  constructor(sfxEngine = null, voiceEngine = null, options = {}) {
    this.sfxEngine = sfxEngine;
    this.voiceEngine = voiceEngine;
    this.audioContextFactory = typeof options.audioContextFactory === 'function' ? options.audioContextFactory : null;

    this.ctx = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.musicBus = null;
    this.musicDuckGain = null;
    this.sfxBus = null;
    this.tombBus = null;
    this.tombAnalyser = null;
    this.hallReverb = null;
    this.cosmicReverb = null;
    this._analyserBins = null;

    this.muted = false;
    this.paused = false;
    this.disposed = false;

    // Strict Contract E telemetry invariants
    this.shipHumActive = false;
    this.tombTtsCount = 0;
    this.firedAudioCues = [];
    this._activeSources = new Set();
    this._scheduledTimers = new Set();
    this._duckUntilSec = -1;
    this._isDucked = false;
    this._s3Silenced = false;

    // Ensure no legacy ambient hum runs during Prologue
    try {
      this.sfxEngine?.stopAmbience?.();
    } catch {
      // Ignore if sfx engine is mock or uninitialized
    }
  }

  unlock() {
    if (this.disposed) return false;
    try {
      this.sfxEngine?.stopAmbience?.();
    } catch {
      // Ignore
    }

    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused && typeof this.ctx.resume === 'function') {
        Promise.resolve(this.ctx.resume()).catch(() => {});
      }
      return true;
    }

    let ctx = null;
    try {
      if (this.audioContextFactory) {
        ctx = this.audioContextFactory();
      } else {
        const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioCtx) return false;
        ctx = new AudioCtx();
      }
    } catch {
      return false;
    }
    if (!ctx) return false;

    this.ctx = ctx;
    this._buildAudioGraph();

    if (this.ctx.state === 'suspended' && !this.paused && typeof this.ctx.resume === 'function') {
      Promise.resolve(this.ctx.resume()).catch(() => {});
    }
    return true;
  }

  _buildAudioGraph() {
    const ctx = this.ctx;
    if (!ctx) return;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.82;

    let masterIn = this.masterGain;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        const comp = ctx.createDynamicsCompressor();
        if (comp.threshold) comp.threshold.value = -14;
        if (comp.ratio) comp.ratio.value = 3.5;
        if (comp.attack) comp.attack.value = 0.015;
        if (comp.release) comp.release.value = 0.25;
        comp.connect(this.masterGain);
        this.masterCompressor = comp;
        masterIn = comp;
      } catch {
        masterIn = this.masterGain;
      }
    }
    this.masterGain.connect(ctx.destination);

    // Music bus -> VO duck gain -> dry + concert hall reverb
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1.0;
    this.musicDuckGain = ctx.createGain();
    this.musicDuckGain.gain.value = 1.0;
    this.musicBus.connect(this.musicDuckGain);
    this.musicDuckGain.connect(masterIn);

    // SFX bus -> master
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.92;
    this.sfxBus.connect(masterIn);

    // Tomb non-human bus -> AnalyserNode (fftSize=128) + cosmic cavern reverb -> master
    this.tombBus = ctx.createGain();
    this.tombBus.gain.value = 0.95;

    if (typeof ctx.createAnalyser === 'function') {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.72;
        this.tombBus.connect(analyser);
        analyser.connect(masterIn);
        this.tombAnalyser = analyser;
        const binCount = analyser.frequencyBinCount || 64;
        this._analyserBins = new Uint8Array(binCount);
      } catch {
        this.tombBus.connect(masterIn);
      }
    } else {
      this.tombBus.connect(masterIn);
    }

    // Procedural offline impulse-response reverbs (3.0s hall for piano/cello/harp, 4.2s cosmic for Tomb)
    if (typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function') {
      try {
        const hallConv = ctx.createConvolver();
        hallConv.buffer = this._createImpulseBuffer(ctx, 2.8, 2.4);
        const hallWet = ctx.createGain();
        hallWet.gain.value = 0.34;
        this.musicDuckGain.connect(hallConv);
        this.sfxBus.connect(hallConv);
        hallConv.connect(hallWet);
        hallWet.connect(masterIn);
        this.hallReverb = { convolver: hallConv, wet: hallWet };

        const cosmicConv = ctx.createConvolver();
        cosmicConv.buffer = this._createImpulseBuffer(ctx, 4.0, 1.9);
        const cosmicWet = ctx.createGain();
        cosmicWet.gain.value = 0.56;
        this.tombBus.connect(cosmicConv);
        cosmicConv.connect(cosmicWet);
        cosmicWet.connect(masterIn);
        this.cosmicReverb = { convolver: cosmicConv, wet: cosmicWet };
      } catch {
        // Optional reverb gracefully bypassed on minimal mocks
      }
    }
  }

  _createImpulseBuffer(ctx, durationSec, decay) {
    const rate = ctx.sampleRate || 44100;
    const length = Math.max(128, Math.min(rate * 5, Math.floor(rate * durationSec)));
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buf.getChannelData(ch);
      let seed = ch === 0 ? 1337 : 7919;
      for (let i = 0; i < length; i += 1) {
        // Deterministic LCG noise (reproducible & fast)
        seed = (seed * 16807) % 2147483647;
        const white = (seed / 2147483647) * 2 - 1;
        const env = Math.pow(1 - i / length, decay);
        data[i] = white * env * 0.55;
      }
    }
    return buf;
  }

  _trackSource(source) {
    if (!source) return source;
    this._activeSources.add(source);
    const cleanup = () => {
      this._activeSources.delete(source);
    };
    try {
      source.onended = cleanup;
    } catch {
      // ignore read-only onended in simple mocks
    }
    return source;
  }

  _scheduleGainValue(param, value, atTime, rampSec = 0) {
    if (!param) return;
    if (rampSec > 0 && typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(value, atTime + rampSec);
    } else if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(value, atTime);
    } else {
      param.value = value;
    }
  }

  _applyDucking(ducked) {
    if (!this.musicDuckGain || !this.ctx) return;
    if (this._isDucked === ducked) return;
    this._isDucked = ducked;
    const now = this.ctx.currentTime || 0;
    const target = ducked ? 0.5 : 1.0; // -6 dB during narration/dialogue
    const tc = ducked ? 0.08 : 0.14;
    if (typeof this.musicDuckGain.gain.setTargetAtTime === 'function') {
      this.musicDuckGain.gain.setTargetAtTime(target, now, tc);
    } else {
      this.musicDuckGain.gain.value = target;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime || 0;
      const target = this.muted ? 0 : 0.82;
      if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
        this.masterGain.gain.setTargetAtTime(target, now, 0.04);
      } else {
        this.masterGain.gain.value = target;
      }
    }
  }

  setPaused(paused) {
    const next = Boolean(paused);
    if (this.paused === next) return;
    this.paused = next;
    if (!this.ctx) return;
    try {
      if (this.paused && typeof this.ctx.suspend === 'function') {
        Promise.resolve(this.ctx.suspend()).catch(() => {});
      } else if (!this.paused && typeof this.ctx.resume === 'function') {
        Promise.resolve(this.ctx.resume()).catch(() => {});
      }
    } catch {
      // ignore
    }
    if (this.paused) {
      this.voiceEngine?.cancel?.();
    }
  }

  // -------------------------------------------------------------------------
  // Instrument Synthesizers (D Dorian / Dmaj9 — Zero Low-Frequency Hum)
  // -------------------------------------------------------------------------

  _playPianoNote(freqHz, offsetSec = 0, peakGain = 0.14, decaySec = 2.8, bus = null) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const t0 = (ctx.currentTime || 0) + Math.max(0, offsetSec);
    const targetBus = bus || this.musicBus;

    const partials = [
      { ratio: 1.0, amp: 1.0, type: 'sine', dec: decaySec },
      { ratio: 2.002, amp: 0.34, type: 'triangle', dec: decaySec * 0.78 },
      { ratio: 3.006, amp: 0.14, type: 'sine', dec: decaySec * 0.52 },
      { ratio: 4.012, amp: 0.06, type: 'sine', dec: decaySec * 0.35 },
    ];

    for (const p of partials) {
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freqHz * p.ratio, t0);

      const amp = Math.max(0.0005, peakGain * p.amp);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(amp, t0 + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + p.dec);

      osc.connect(gain);
      gain.connect(targetBus);
      osc.start(t0);
      osc.stop(t0 + p.dec + 0.05);
    }
  }

  /**
   * Warm lyrical bowed cello note (>= 110 Hz, finite <= 2.3s bowed phrasing — NEVER static hum).
   */
  _playBowedCelloPhrase(freqHz, offsetSec = 0, durationSec = 2.2, peakGain = 0.095) {
    if (!this.ctx || !this.musicBus) return;
    const safeFreq = Math.max(110.0, freqHz);
    const safeDur = Math.min(2.3, Math.max(0.6, durationSec));
    const ctx = this.ctx;
    const t0 = (ctx.currentTime || 0) + Math.max(0, offsetSec);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580, t0);
    filter.frequency.linearRampToValueAtTime(940, t0 + safeDur * 0.55);
    filter.frequency.linearRampToValueAtTime(620, t0 + safeDur);
    filter.Q.value = 1.2;

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, t0);
    envGain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.85, safeDur * 0.42));
    envGain.gain.linearRampToValueAtTime(peakGain * 0.85, t0 + safeDur * 0.76);
    envGain.gain.exponentialRampToValueAtTime(0.0004, t0 + safeDur);

    filter.connect(envGain);
    envGain.connect(this.musicBus);

    // Subtle bowed vibrato LFO (5.2 Hz)
    let vibratoGain = null;
    try {
      const lfo = this._trackSource(ctx.createOscillator());
      vibratoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.2, t0);
      vibratoGain.gain.value = safeFreq * 0.0055;
      lfo.connect(vibratoGain);
      lfo.start(t0);
      lfo.stop(t0 + safeDur + 0.04);
    } catch {
      vibratoGain = null;
    }

    // 2 warm chorused bowed strings (+/- 4 cents)
    const detunes = [0.9977, 1.0023];
    for (let i = 0; i < detunes.length; i += 1) {
      const osc = this._trackSource(ctx.createOscillator());
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(safeFreq * detunes[i], t0);
      if (vibratoGain) {
        try {
          vibratoGain.connect(osc.frequency);
        } catch {
          // ignore if mock frequency is not an AudioParam target
        }
      }
      osc.connect(filter);
      osc.start(t0);
      osc.stop(t0 + safeDur + 0.04);
    }
  }

  _playHarpPluck(freqHz, offsetSec = 0, peakGain = 0.11, decaySec = 2.0, bus = null) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const t0 = (ctx.currentTime || 0) + Math.max(0, offsetSec);
    const targetBus = bus || this.musicBus;

    const osc = this._trackSource(ctx.createOscillator());
    const overtone = this._trackSource(ctx.createOscillator());
    const gain = ctx.createGain();
    const ovGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqHz, t0);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freqHz * 2.0, t0);
    ovGain.gain.value = 0.28;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0004, t0 + decaySec);

    osc.connect(gain);
    overtone.connect(ovGain);
    ovGain.connect(gain);
    gain.connect(targetBus);

    osc.start(t0);
    overtone.start(t0);
    osc.stop(t0 + decaySec + 0.05);
    overtone.stop(t0 + decaySec + 0.05);
  }

  _playFilteredNoiseBurst(offsetSec, durationSec, centerHz, qVal, peakGain, bus = null) {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function' || typeof this.ctx.createBufferSource !== 'function') {
      return;
    }
    const ctx = this.ctx;
    const t0 = (ctx.currentTime || 0) + Math.max(0, offsetSec);
    const rate = ctx.sampleRate || 44100;
    const len = Math.max(64, Math.floor(rate * durationSec));
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let seed = 4242 + Math.floor(centerHz);
    for (let i = 0; i < len; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }

    const src = this._trackSource(ctx.createBufferSource());
    src.buffer = buf;
    src.loop = false;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerHz, t0);
    filter.Q.value = qVal;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, durationSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0004, t0 + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus || this.sfxBus);

    src.start(t0);
    src.stop(t0 + durationSec + 0.02);
  }

  // -------------------------------------------------------------------------
  // Scene-Specific Musical & SFX Recipes
  // -------------------------------------------------------------------------

  _playS0APianoCello() {
    // Restore music bus cleanly
    if (this.musicBus && this.ctx) {
      this._scheduleGainValue(this.musicBus.gain, 1.0, this.ctx.currentTime || 0, 0.08);
    }
    this._s3Silenced = false;

    // D Dorian minimalist crystal solo piano notes
    this._playPianoNote(293.66, 0.2, 0.14, 3.4); // D4
    this._playPianoNote(440.0, 2.4, 0.13, 3.2); // A4
    this._playPianoNote(659.25, 4.6, 0.125, 3.4); // E5
    this._playPianoNote(739.99, 7.2, 0.13, 3.6); // F#5
    this._playPianoNote(587.33, 9.2, 0.10, 2.4); // D5

    // Warm lyrical bowed cello phrases (each <= 2.3s, >= 110 Hz, never continuous drone)
    this._playBowedCelloPhrase(146.83, 0.5, 2.2, 0.09); // D3
    this._playBowedCelloPhrase(185.0, 3.0, 2.2, 0.085); // F#3
    this._playBowedCelloPhrase(110.0, 5.5, 2.1, 0.085); // A2
    this._playBowedCelloPhrase(164.81, 7.9, 2.2, 0.09); // E3
  }

  _playCryoLatches() {
    const offsets = [0.25, 1.25, 2.45];
    for (const off of offsets) {
      // Pressurized crisp mist whisper (45ms bandpass 1800 Hz)
      this._playFilteredNoiseBurst(off, 0.055, 1850, 1.8, 0.09);
      // Precision metallic latch impulse (1180 Hz + 2360 Hz)
      const ctx = this.ctx;
      if (!ctx || !this.sfxBus) continue;
      const t0 = (ctx.currentTime || 0) + off + 0.025;
      for (const [f, amp] of [
        [1180, 0.12],
        [2360, 0.05],
      ]) {
        const osc = this._trackSource(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0);
        osc.frequency.exponentialRampToValueAtTime(f * 0.88, t0 + 0.06);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(amp, t0 + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.07);
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.08);
      }
    }
  }

  _playS0B2StringsSwell() {
    // Radiant Dmaj9 strings & harp build toward 7th FTL warp
    this._playBowedCelloPhrase(146.83, 0.1, 2.2, 0.1); // D3
    this._playBowedCelloPhrase(220.0, 0.6, 2.2, 0.095); // A3
    this._playBowedCelloPhrase(293.66, 2.4, 2.2, 0.1); // D4
    this._playBowedCelloPhrase(369.99, 3.0, 2.2, 0.095); // F#4
    this._playHarpPluck(587.33, 1.2, 0.11, 2.2); // D5
    this._playHarpPluck(659.25, 1.8, 0.1, 2.2); // E5
    this._playHarpPluck(880.0, 2.5, 0.11, 2.4); // A5
    this._playHarpPluck(1174.66, 3.2, 0.11, 2.6); // D6
  }

  _playCrystalWarpGlissando() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    const glides = [
      [587.33, 1174.66, 0.11], // D5 -> D6
      [880.0, 1479.98, 0.095], // A5 -> F#6
      [1174.66, 1760.0, 0.08], // D6 -> A6
      [1479.98, 2349.32, 0.055], // F#6 -> D7
      [1760.0, 2637.02, 0.04], // A6 -> E7
    ];

    for (let i = 0; i < glides.length; i += 1) {
      const [fStart, fEnd, amp] = glides[i];
      const t0 = now + i * 0.08;
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(fStart, t0);
      osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + 1.85);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(amp, t0 + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 2.85);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 2.95);
    }

    // Sparkling high-frequency starlight rush (strictly high bandpass 3200 Hz, zero low roar)
    this._playFilteredNoiseBurst(0.12, 1.45, 3400, 2.4, 0.065, this.sfxBus);
  }

  _playS0CSolitaryHarp() {
    this._playHarpPluck(587.33, 0.85, 0.105, 2.9); // D5
    this._playHarpPluck(880.0, 1.45, 0.065, 2.6); // A5 harmonic echo
  }

  _playS1PianoHarp() {
    if (this.musicBus && this.ctx) {
      this._scheduleGainValue(this.musicBus.gain, 1.0, this.ctx.currentTime || 0, 0.12);
    }
    this._s3Silenced = false;

    const melody = [
      [293.66, 0.3, 0.12, 3.0], // D4
      [369.99, 1.9, 0.11, 2.9], // F#4
      [440.0, 3.6, 0.115, 3.0], // A4
      [493.88, 5.4, 0.105, 3.1], // B4
      [659.25, 7.2, 0.11, 3.2], // E5
      [587.33, 9.1, 0.1, 2.8], // D5
    ];
    for (const [f, off, amp, dec] of melody) {
      this._playPianoNote(f, off, amp, dec);
    }
    this._playHarpPluck(587.33, 1.4, 0.075, 2.2);
    this._playHarpPluck(880.0, 4.4, 0.07, 2.3);
    this._playHarpPluck(1318.51, 7.8, 0.06, 2.4);
  }

  _playS2VeilCrystalSustain() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    for (const [f, amp] of [
      [880.0, 0.085], // A5
      [1318.51, 0.065], // E6
      [1975.53, 0.035], // B6 shimmer
    ]) {
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.008, now + 2.4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + 2.6);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 2.7);
    }
  }

  _playS2ScientificAlert() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    // Restrained scientific predictive two-tone chime: 880 Hz -> 1174.66 Hz (x2)
    const pattern = [
      [880.0, 0.0],
      [1174.66, 0.16],
      [880.0, 1.35],
      [1174.66, 1.51],
    ];
    for (const [f, off] of pattern) {
      const t0 = now + off;
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.11, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    }
  }

  _playS3StarExtinctionSilence() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime || 0;
    this._s3Silenced = true;
    // Evacuate all human music into cosmic silence
    if (this.musicBus) {
      if (typeof this.musicBus.gain.setTargetAtTime === 'function') {
        this.musicBus.gain.setTargetAtTime(0.0001, now, 0.16);
      } else {
        this.musicBus.gain.value = 0.0001;
      }
    }
    // Delicate high-frequency glass-droplet pings as stars blink out
    const starDrops = [
      [3520, 0.3],
      [3135.96, 0.9],
      [2793.83, 1.55],
      [2637.02, 2.2],
      [2349.32, 2.85],
    ];
    for (const [f, off] of starDrops) {
      const t0 = now + off;
      const osc = this._trackSource(this.ctx.createOscillator());
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.028, t0 + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0003, t0 + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.09);
    }
  }

  /**
   * Tomb Non-Human 3-Layer High-Dimensional Acoustic Synthesis (S3: 48.2-54.9s).
   * STRICTLY ZERO speechSynthesis / human TTS calls (`tombTtsCount === 0`).
   */
  _playTombNonHumanResonance() {
    if (!this.ctx || !this.tombBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;

    // Layer 1: Prime-interval rhythmic pulsar pings (1420 Hz hydrogen line + 2840 Hz harmonic)
    const primeOffsets = [0.08, 0.42, 0.88, 1.54, 2.38, 3.04, 3.88, 4.72, 5.42];
    for (let i = 0; i < primeOffsets.length; i += 1) {
      const t0 = now + primeOffsets[i];
      for (const [f, amp] of [
        [1420.0, 0.11],
        [2840.0, 0.055],
      ]) {
        const osc = this._trackSource(ctx.createOscillator());
        const bp = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * (1 + (i % 3) * 0.004), t0);
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(f, t0);
        bp.Q.value = 5.5;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(amp, t0 + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.045);
        osc.connect(bp);
        bp.connect(gain);
        gain.connect(this.tombBus);
        osc.start(t0);
        osc.stop(t0 + 0.06);
      }
    }

    // Layer 2: Reversed crystalline lattice buffer (irrational harmonic ratios 1 : sqrt(2) : sqrt(5) : sqrt(10))
    if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
      const rate = ctx.sampleRate || 44100;
      const dur = 1.6;
      const len = Math.max(128, Math.floor(rate * dur));
      const revBuf = ctx.createBuffer(1, len, rate);
      const data = revBuf.getChannelData(0);
      const baseF = 528.0;
      const ratios = [1.0, 1.4142, 2.2361, 3.1623];
      for (let i = 0; i < len; i += 1) {
        const u = i / len; // 0 -> 1 reversed swell!
        const revEnv = Math.pow(u, 2.6) * (u > 0.985 ? (1 - u) / 0.015 : 1.0);
        const t = i / rate;
        let sample = 0;
        for (let r = 0; r < ratios.length; r += 1) {
          sample += Math.sin(2 * Math.PI * baseF * ratios[r] * t) * (0.45 / (r + 1));
        }
        data[i] = sample * revEnv * 0.24;
      }

      for (const offset of [0.35, 2.55, 4.55]) {
        const src = this._trackSource(ctx.createBufferSource());
        src.buffer = revBuf;
        src.loop = false;
        const gain = ctx.createGain();
        gain.gain.value = 0.72;
        src.connect(gain);
        gain.connect(this.tombBus);
        src.start(now + offset);
        src.stop(now + offset + dur + 0.02);
      }
    }

    // Layer 3: Deep-sea cosmic whale formant glide (dual resonant bandpass, strictly >= 165 Hz)
    const whaleNotes = [
      { off: 0.15, f0: 218, f1: 172, f2: 244, dur: 2.35, formA: 420, formB: 790 },
      { off: 2.65, f0: 232, f1: 184, f2: 168, dur: 2.35, formA: 380, formB: 720 },
    ];
    for (const w of whaleNotes) {
      const t0 = now + w.off;
      const osc = this._trackSource(ctx.createOscillator());
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(w.f0, t0);
      osc.frequency.linearRampToValueAtTime(w.f1, t0 + w.dur * 0.48);
      osc.frequency.linearRampToValueAtTime(w.f2, t0 + w.dur);

      const bpA = ctx.createBiquadFilter();
      bpA.type = 'bandpass';
      bpA.frequency.setValueAtTime(w.formA, t0);
      bpA.frequency.linearRampToValueAtTime(w.formA * 0.82, t0 + w.dur);
      bpA.Q.value = 6.5;

      const bpB = ctx.createBiquadFilter();
      bpB.type = 'bandpass';
      bpB.frequency.setValueAtTime(w.formB, t0);
      bpB.frequency.linearRampToValueAtTime(w.formB * 1.15, t0 + w.dur);
      bpB.Q.value = 6.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.55);
      gain.gain.linearRampToValueAtTime(0.14, t0 + w.dur * 0.78);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + w.dur);

      osc.connect(bpA);
      osc.connect(bpB);
      bpA.connect(gain);
      bpB.connect(gain);
      gain.connect(this.tombBus);
      osc.start(t0);
      osc.stop(t0 + w.dur + 0.05);
    }
  }

  _playS4OrbPhaseSlip() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;

    // Airy meteor dive harmonic sweep (high-bandpass, no rumble)
    this._playFilteredNoiseBurst(0.0, 0.75, 1650, 2.2, 0.08, this.sfxBus);

    // 4D phase-slip crystal chime (987.77 Hz -> 1318.51 Hz)
    const osc = this._trackSource(ctx.createOscillator());
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now + 0.45);
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 1.35);
    gain.gain.setValueAtTime(0.0001, now + 0.45);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + 1.9);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now + 0.45);
    osc.stop(now + 1.95);

    // X-ray crystalline lattice scan sweep
    const scanOsc = this._trackSource(ctx.createOscillator());
    const scanGain = ctx.createGain();
    scanOsc.type = 'triangle';
    scanOsc.frequency.setValueAtTime(1760, now + 1.9);
    scanOsc.frequency.exponentialRampToValueAtTime(3520, now + 2.85);
    scanGain.gain.setValueAtTime(0.0001, now + 1.9);
    scanGain.gain.linearRampToValueAtTime(0.06, now + 2.05);
    scanGain.gain.exponentialRampToValueAtTime(0.0004, now + 3.0);
    scanOsc.connect(scanGain);
    scanGain.connect(this.sfxBus);
    scanOsc.start(now + 1.9);
    scanOsc.stop(now + 3.05);
  }

  _playS4GlassShardChimes() {
    // 12 weightless high-frequency luminous crystal glass chimes (ZERO decompression blast!)
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    const freqs = [2112, 2349, 2637, 2960, 3136, 3520, 3951, 4186, 2489, 2794, 3322, 4435];
    for (let i = 0; i < freqs.length; i += 1) {
      const t0 = now + i * 0.085;
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.048, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.65);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.68);
    }
  }

  _playS4CryoEmergencyOpen() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    // Emerald emergency wake-up chime
    const notes = [659.25, 880.0, 1318.51];
    for (let i = 0; i < notes.length; i += 1) {
      const t0 = now + i * 0.11;
      const osc = this._trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.1, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    }
    // Gentle sliding canopy latch + pressurized cryo-mist release whisper
    this._playFilteredNoiseBurst(0.55, 0.42, 2100, 1.5, 0.075, this.sfxBus);
  }

  _playS5OrigamiInterlock() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime || 0;
    // Restore music bus smoothly for monumental finale
    if (this.musicBus) {
      this._scheduleGainValue(this.musicBus.gain, 1.0, now, 0.18);
    }
    this._s3Silenced = false;

    // 4 staggered geometric ±90° architectural interlock fifth-chords
    const chords = [
      { off: 0.15, notes: [293.66, 440.0, 587.33] }, // D4 A4 D5
      { off: 1.25, notes: [329.63, 493.88, 659.25] }, // E4 B4 E5
      { off: 2.55, notes: [369.99, 554.37, 739.99] }, // F#4 C#5 F#5
      { off: 3.85, notes: [440.0, 659.25, 880.0] }, // A4 E5 A5
    ];
    for (const c of chords) {
      for (const f of c.notes) {
        const t0 = now + c.off;
        const osc = this._trackSource(ctx.createOscillator());
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.085, t0 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0004, t0 + 1.45);
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 1.5);
      }
      // Crisp geometric latch click
      this._playFilteredNoiseBurst(c.off, 0.04, 2400, 2.5, 0.06, this.sfxBus);
    }
  }

  _playS5AscendingHarpGlissando() {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime || 0;
    this._scheduleGainValue(this.musicBus.gain, 1.0, now, 0.12);
    // Radiant ascending Dmaj9 harp arpeggio into polar-day light
    const notes = [
      293.66, // D4
      329.63, // E4
      369.99, // F#4
      440.0, // A4
      493.88, // B4
      554.37, // C#5
      587.33, // D5
      659.25, // E5
      739.99, // F#5
      880.0, // A5
      987.77, // B5
      1174.66, // D6
      1318.51, // E6
      1479.98, // F#6
    ];
    notes.forEach((f, idx) => {
      this._playHarpPluck(f, 1.8 + idx * 0.14, 0.095, 2.6, this.musicBus);
    });
  }

  _playS6PolarSilence() {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime || 0;
    // Dissolve gracefully into profound polar-day silence
    if (typeof this.musicBus.gain.setTargetAtTime === 'function') {
      this.musicBus.gain.setTargetAtTime(0.0001, now + 0.8, 0.65);
    } else {
      this.musicBus.gain.value = 0.0001;
    }
  }

  // -------------------------------------------------------------------------
  // Public Contract E API
  // -------------------------------------------------------------------------

  handleFiredCues(firedCues, snapshot) {
    if (this.disposed || !Array.isArray(firedCues) || firedCues.length === 0) return;

    for (const cue of firedCues) {
      if (!cue || !cue.id) continue;
      this.firedAudioCues.push(cue.id);

      // Hard FORBID-05 & FORBID-01 guard: NEVER invoke human speechSynthesis for Tomb or S6!
      const isTombCue =
        cue.speaker === 'tomb_signal' ||
        cue.speaker === 'tomb' ||
        Boolean(cue.meta?.skipSpeechSynthesis) ||
        Boolean(cue.meta?.nonHuman);

      if (cue.kind === 'voice') {
        if (isTombCue || cue.shotId === 'S6') {
          continue;
        }
        const durSec = Math.max(1.5, (cue.endSec ?? cue.atSec + 4) - cue.atSec);
        this._duckUntilSec = Math.max(this._duckUntilSec, cue.endSec ?? (snapshot?.elapsedSec ?? 0) + durSec);
        this._applyDucking(true);
        if (this.voiceEngine && typeof this.voiceEngine.speak === 'function') {
          this.voiceEngine.speak(cue.speaker, cue.text, {
            durationMs: Math.round(durSec * 1000),
            cue: cue.id,
            skipChirp: cue.speaker === 'narrator' || cue.speaker === 'linxia',
          });
        }
        continue;
      }

      if (cue.kind === 'spectrometer') {
        // Pure visual/telemetry cue — strictly zero TTS!
        continue;
      }

      // Ensure Web Audio graph exists (best-effort; safe if suspended/unavailable)
      if (!this.ctx && !this.unlock()) {
        continue;
      }

      if (cue.kind === 'music') {
        const theme = cue.meta?.theme;
        if (theme === 'd_dorian_piano_cello') this._playS0APianoCello();
        else if (theme === 'dmaj9_strings_swell') this._playS0B2StringsSwell();
        else if (theme === 'minimalist_piano_harp') this._playS1PianoHarp();
        else if (theme === 'ascending_harp_glissando') this._playS5AscendingHarpGlissando();
        else if (theme === 'polar_day_silence') this._playS6PolarSilence();
      } else if (cue.kind === 'sfx') {
        const sfxType = cue.meta?.sfxType;
        if (sfxType === 'cryo_latches') this._playCryoLatches();
        else if (sfxType === 'crystal_warp_glissando') this._playCrystalWarpGlissando();
        else if (sfxType === 'crystal_veil_sustain') this._playS2VeilCrystalSustain();
        else if (sfxType === 'scientific_chime_alert') this._playS2ScientificAlert();
        else if (sfxType === 'star_extinction_silence') this._playS3StarExtinctionSilence();
        else if (sfxType === 'tomb_nonhuman_resonance') this._playTombNonHumanResonance();
        else if (sfxType === 'orb_4d_phase_slip') this._playS4OrbPhaseSlip();
        else if (sfxType === 'crystal_shard_chimes') this._playS4GlassShardChimes();
        else if (sfxType === 'cryo_emergency_open') this._playS4CryoEmergencyOpen();
        else if (sfxType === 'origami_interlock_harp') this._playS5OrigamiInterlock();
      } else if (cue.kind === 'card' && cue.meta?.cardType === 'coord_card') {
        this._playS0CSolitaryHarp();
      }
    }
  }

  update(snapshot, dtSec = 0) {
    if (this.disposed || !snapshot) return;
    void dtSec;

    // Guarantee zero legacy ship hum
    this.shipHumActive = false;

    // Modulate VO ducking cleanly against snapshot timeline
    const hasHumanSubtitle =
      Boolean(snapshot.activeSubtitle) &&
      snapshot.activeSubtitle.speakerId !== 'tomb_signal' &&
      snapshot.shotId !== 'S6';
    const shouldDuck = hasHumanSubtitle || snapshot.elapsedSec < this._duckUntilSec;
    this._applyDucking(shouldDuck);
  }

  /**
   * Return 48 (or custom `barCount`) normalized floats in [0, 1] for the S3 quantum spectrometer.
   * Blends live Web Audio AnalyserNode when unlocked & active, and falls back deterministically
   * to `snapshot.spectrometer.bars` when headless/suspended.
   */
  getSpectrometerBars(barCount = 48, snapshot = null) {
    const count = Math.max(1, Math.floor(barCount));
    const spec = snapshot?.spectrometer;
    if (!spec || !spec.active) {
      return new Array(count).fill(0);
    }

    const analytical = resampleBars(spec.bars, count);
    const alpha = clamp(Number(spec.alpha) || 0, 0, 1);

    if (
      this.tombAnalyser &&
      this._analyserBins &&
      this.ctx &&
      this.ctx.state === 'running' &&
      typeof this.tombAnalyser.getByteFrequencyData === 'function'
    ) {
      try {
        this.tombAnalyser.getByteFrequencyData(this._analyserBins);
        let maxBin = 0;
        for (let i = 0; i < this._analyserBins.length; i += 1) {
          if (this._analyserBins[i] > maxBin) maxBin = this._analyserBins[i];
        }
        if (maxBin > 4) {
          const live = new Array(count);
          const binLen = this._analyserBins.length;
          for (let i = 0; i < count; i += 1) {
            const idx = Math.min(binLen - 1, Math.floor((i / count) * binLen));
            const liveNorm = (this._analyserBins[idx] / 255) * alpha;
            live[i] = Number(clamp(liveNorm * 0.55 + analytical[i] * 0.45, 0, 1).toFixed(4));
          }
          return live;
        }
      } catch {
        // Fall through cleanly to analytical spectrum
      }
    }

    return analytical;
  }

  getTelemetry() {
    return {
      audioMode: 'prologue_cinema',
      shipHumActive: false,
      stationAmbienceActive: Boolean(this.sfxEngine?.ambienceNodes),
      tombTtsCount: this.tombTtsCount,
      activeOscillators: this._activeSources.size,
      firedAudioCues: [...this.firedAudioCues],
    };
  }

  stopAll() {
    for (const timer of this._scheduledTimers) {
      clearTimeout(timer);
    }
    this._scheduledTimers.clear();

    for (const src of Array.from(this._activeSources)) {
      try {
        if (typeof src.stop === 'function') src.stop();
      } catch {
        // ignore already stopped
      }
      try {
        if (typeof src.disconnect === 'function') src.disconnect();
      } catch {
        // ignore
      }
      this._activeSources.delete(src);
    }

    this._duckUntilSec = -1;
    this._applyDucking(false);
    this.voiceEngine?.cancel?.();
  }

  dispose() {
    if (this.disposed) return;
    this.stopAll();
    this.disposed = true;

    const nodes = [
      this.musicBus,
      this.musicDuckGain,
      this.sfxBus,
      this.tombBus,
      this.tombAnalyser,
      this.masterCompressor,
      this.masterGain,
      this.hallReverb?.convolver,
      this.hallReverb?.wet,
      this.cosmicReverb?.convolver,
      this.cosmicReverb?.wet,
    ];
    for (const node of nodes) {
      try {
        node?.disconnect?.();
      } catch {
        // ignore
      }
    }

    if (this.ctx && typeof this.ctx.close === 'function') {
      try {
        Promise.resolve(this.ctx.close()).catch(() => {});
      } catch {
        // ignore
      }
    }
    this.ctx = null;
    this.tombAnalyser = null;
    this._analyserBins = null;
  }
}
