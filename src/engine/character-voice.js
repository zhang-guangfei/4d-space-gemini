/**
 * Beyond 3D — Enhanced Dual-Character Voice Engine (D12)
 *
 * Improvements:
 * - Async `voiceschanged` preloading with priority ranking for Natural/Neural/Online zh-CN voices
 *   (Microsoft Xiaoxiao/Yunxi/Yunjian Natural in Edge, Google 普通话 in Chrome).
 * - First-gesture speech queue: Chrome/Edge block audio/TTS before first user gesture, so the
 *   opening line is queued and fires cleanly on the player's very first click/key/wheel!
 * - Richer acoustic signatures:
 *   * Tomb (遗迹 AI「墓地」): 196Hz -> 147Hz dual-triangle metallic resonance + 98Hz sub-bass swell
 *     + cathedral convolver reverb tail + 0.84x lowered pitch.
 *   * Lin Xia (07 号): warm crystalline 3-note comm-link chime.
 */

export const SPEAKERS = Object.freeze({
  linxia: {
    id: 'linxia',
    displayName: '林夏 · 07 号',
    roleTag: '先遣领航员',
    color: '#4DE6D3',
    pitch: 1.06,
    rate: 1.0,
  },
  tomb: {
    id: 'tomb',
    displayName: '遗迹 AI ·「墓地」',
    roleTag: '高维方舟意识',
    color: '#F7C346',
    pitch: 0.84, // D12 exact 0.84x lowered pitch
    rate: 0.88,
  },
  narrator: {
    id: 'narrator',
    displayName: '旁白',
    roleTag: '文明纪实',
    color: '#E8EFF8',
    pitch: 0.94,
    rate: 0.9,
  },
  broadcast: {
    id: 'broadcast',
    displayName: '舰桥广播',
    roleTag: '舰队广播',
    color: '#A5FCF2',
    pitch: 1.02,
    rate: 1.0,
  },
  ship_ai: {
    id: 'ship_ai',
    displayName: '远航者号 · 舰载系统',
    roleTag: '曲率监测阵列',
    color: '#F7C346',
    pitch: 1.0,
    rate: 1.02,
  },
  tomb_signal: {
    id: 'tomb_signal',
    displayName: '舰载量子频谱仪',
    roleTag: '高维引力波频谱',
    color: '#4DE6D3',
    pitch: 0.84,
    rate: 0.88,
    skipSpeechSynthesis: true,
  },
});

export class CharacterVoiceEngine {
  constructor(options = {}) {
    this.enabled = true;
    this.onSubtitle = options.onSubtitle ?? (() => {});
    this.audioCtx = null;
    this.reverbBuffer = null;
    this.subtitleTimer = null;
    this.currentCue = null;
    this.userUnlocked = false;
    this.pendingSpeech = null;
    this.cachedVoices = [];

    this._initVoices();
  }

  _initVoices() {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return;
    const refresh = () => {
      try {
        const list = synth.getVoices() || [];
        if (list.length > 0) this.cachedVoices = list;
      } catch {
        // ignore
      }
    };
    refresh();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refresh);
    }
  }

  /**
   * Call on the player's first mouse/key/wheel gesture to unlock Web Audio & flush queued opening voice.
   */
  unlockOnGesture() {
    this.userUnlocked = true;
    this._ensureAudio();
    if (this.pendingSpeech && this.enabled) {
      const { speakerId, text, options } = this.pendingSpeech;
      this.pendingSpeech = null;
      this._playAudioAndSpeech(speakerId, text, options);
    }
  }

  _ensureAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return true;
    }
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      this.audioCtx = new AudioCtx();
      this.reverbBuffer = this._createCathedralImpulse(this.audioCtx, 2.4, 2.3);
      return true;
    } catch {
      return false;
    }
  }

  _createCathedralImpulse(ctx, durationSec, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return impulse;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.pendingSpeech = null;
      if (globalThis.speechSynthesis) {
        try {
          globalThis.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Tomb's cathedral metallic resonance: 196Hz -> 147Hz dual triangle + 98Hz sub-harmonic + reverb tail.
   */
  _playTombMetallicResonance() {
    if (!this.enabled || !this._ensureAudio()) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const metalOsc = ctx.createOscillator();

      oscA.type = 'triangle';
      oscB.type = 'triangle';
      subOsc.type = 'sine';
      metalOsc.type = 'sine';

      // G3 (196 Hz) -> D3 (147 Hz) dual-triangle resonance with slight metallic detune
      oscA.frequency.setValueAtTime(196.0, now);
      oscA.frequency.exponentialRampToValueAtTime(147.0, now + 0.65);

      oscB.frequency.setValueAtTime(196.0 * 1.008, now);
      oscB.frequency.exponentialRampToValueAtTime(147.0 * 0.992, now + 0.65);

      // Deep sub-octave cathedral foundation (98Hz -> 73.4Hz)
      subOsc.frequency.setValueAtTime(98.0, now);
      subOsc.frequency.exponentialRampToValueAtTime(73.42, now + 0.85);

      // Ancient bronze harmonic ring
      metalOsc.frequency.setValueAtTime(588.0, now);
      metalOsc.frequency.exponentialRampToValueAtTime(441.0, now + 0.55);

      const subGain = ctx.createGain();
      subGain.gain.value = 0.45;
      const metalGain = ctx.createGain();
      metalGain.gain.value = 0.1;

      const dryGain = ctx.createGain();
      dryGain.gain.setValueAtTime(0.001, now);
      dryGain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
      dryGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.58;

      const convolver = ctx.createConvolver();
      convolver.buffer = this.reverbBuffer;

      oscA.connect(dryGain);
      oscB.connect(dryGain);
      subOsc.connect(subGain);
      subGain.connect(dryGain);
      metalOsc.connect(metalGain);
      metalGain.connect(dryGain);

      dryGain.connect(ctx.destination);
      dryGain.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(ctx.destination);

      oscA.start(now);
      oscB.start(now);
      subOsc.start(now);
      metalOsc.start(now);
      oscA.stop(now + 1.25);
      oscB.stop(now + 1.25);
      subOsc.stop(now + 1.25);
      metalOsc.stop(now + 1.25);
    } catch {
      // Ignore audio errors
    }
  }

  _playLinXiaChirp() {
    if (!this.enabled || !this._ensureAudio()) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        const t0 = now + i * 0.055;
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.2);
      });
    } catch {
      // Ignore audio errors
    }
  }

  _selectBestZhVoice(speakerId) {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return null;
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : synth.getVoices() || [];
    const zhVoices = voices.filter((v) => /zh|cmn|chinese/i.test(v.lang));
    if (zhVoices.length === 0) return null;

    const scoreVoice = (v) => {
      let score = 0;
      const name = (v.name || '').toLowerCase();
      if (/zh[-_]?cn/i.test(v.lang)) score += 20;
      if (/natural|neural|online/i.test(name)) score += 40; // Edge Microsoft Neural voices!
      if (/google/i.test(name)) score += 25; // Chrome Google 普通话!
      if (speakerId === 'linxia' || speakerId === 'broadcast') {
        if (/xiaoxiao|xiaoyi|ting|huihui|yaoyao|female|mei/i.test(name)) score += 30;
      } else {
        if (/yunjian|yunxi|yunyang|kangkang|male|li/i.test(name)) score += 30;
      }
      return score;
    };

    const ranked = [...zhVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return ranked[0] || null;
  }

  _playAudioAndSpeech(speakerId, text, options = {}) {
    const profile = SPEAKERS[speakerId] || SPEAKERS.tomb;
    // Hard FORBID-05 guard: NEVER invoke human speechSynthesis for tomb_signal or skipSpeechSynthesis profiles
    if (profile.skipSpeechSynthesis || speakerId === 'tomb_signal' || options.skipSpeechSynthesis) {
      return;
    }

    if (!options.skipChirp) {
      if (speakerId === 'tomb') {
        this._playTombMetallicResonance();
      } else if (speakerId === 'linxia' || speakerId === 'broadcast') {
        this._playLinXiaChirp();
      }
    }

    const synth = globalThis.speechSynthesis;
    if (synth && typeof globalThis.SpeechSynthesisUtterance === 'function') {
      try {
        synth.cancel();
        const utter = new globalThis.SpeechSynthesisUtterance(text);
        utter.lang = 'zh-CN';
        utter.pitch = profile.pitch;
        utter.rate = profile.rate;
        utter.volume = 0.94;
        const voice = this._selectBestZhVoice(speakerId);
        if (voice) utter.voice = voice;
        synth.speak(utter);
      } catch {
        // Gracefully rely on signature cue + subtitle
      }
    }
  }

  cancel() {
    this.currentCue = null;
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = null;
    this.pendingSpeech = null;
    this.onSubtitle({ visible: false });
    try {
      globalThis.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }

  dismissCue(cue) {
    if (this.currentCue !== cue) return;
    this.cancel();
  }

  /**
   * Speak a character line with acoustic signature + Neural/Web Speech synthesis + HUD subtitle.
   */
  speak(speakerId, text, options = {}) {
    const profile = SPEAKERS[speakerId] || SPEAKERS.tomb;
    const skipTts = Boolean(
      profile.skipSpeechSynthesis || speakerId === 'tomb_signal' || options.skipSpeechSynthesis
    );
    const durationMs = options.durationMs ?? Math.max(4600, Math.min(7600, text.length * 175));
    this.currentCue = options.cue ?? null;

    this.onSubtitle({
      visible: true,
      speaker: profile,
      text,
      tierLabel: options.tierLabel ?? null,
    });

    if (this.subtitleTimer) {
      clearTimeout(this.subtitleTimer);
    }
    this.subtitleTimer = setTimeout(() => {
      this.onSubtitle({ visible: false, speaker: profile, text: '' });
    }, durationMs);

    if (!this.enabled || skipTts) return;

    if (!this.userUnlocked) {
      // Queue for instant playback on the player's first gesture so Chrome/Edge never drops it!
      this.pendingSpeech = { speakerId, text, options };
      return;
    }

    this._playAudioAndSpeech(speakerId, text, options);
  }
}
