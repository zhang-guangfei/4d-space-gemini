/**
 * Beyond 3D — Prologue 2.35:1 Cinema Overlay Controller (Contract F)
 *
 * Exclusively manages `#prologue-cinema-layer` (visible ONLY when `body.is-prologue`).
 * 100% driven by deterministic `snapshot` + `spectrometerBars` (zero wall-clock drift under `?audit=1`):
 * - 2.35:1 pure-black anamorphic letterbox bars (~88px at 1280x720, smoothly retracting in S6)
 * - S0A centered 3-line minimalist cinema opening titles
 * - S0C crisp aerospace monospace spacetime coordinate card
 * - S3 frameless transparent 48-bar quantum spectrometer <canvas> + 14% partial decode readout
 * - Clean non-overlapping cinema dialogue subtitle (strictly hidden in S6)
 * - Discreet `按 Space 跳过` pill seated above bottom letterbox (strictly hidden in S6)
 * - S6 polar-day pure-white curtain + 450ms post-handoff white cross-dissolve veil
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export class PrologueOverlayController {
  constructor(options = {}) {
    this.onSkip = typeof options.onSkip === 'function' ? options.onSkip : () => {};
    this.auditMode = Boolean(options.auditMode);
    this.audioUnlocked = false;
    this._dissolveTimer = null;

    this.els = {
      layer: document.getElementById('prologue-cinema-layer'),
      whiteout: document.getElementById('prologue-whiteout'),
      topBar: document.getElementById('prologue-letterbox-top'),
      bottomBar: document.getElementById('prologue-letterbox-bottom'),
      openingTitles: document.getElementById('prologue-opening-titles'),
      openingLines: Array.from(document.querySelectorAll('#prologue-opening-titles .prologue-opening-line')),
      coordCard: document.getElementById('prologue-coord-card'),
      coordPrimary: document.getElementById('prologue-coord-primary'),
      coordSecondary: document.getElementById('prologue-coord-secondary'),
      spectrometer: document.getElementById('prologue-spectrometer'),
      spectrometerCanvas: document.getElementById('prologue-spectrometer-canvas'),
      spectrometerText: document.getElementById('prologue-spectrometer-text'),
      subtitle: document.getElementById('prologue-subtitle'),
      subtitleSpeaker: document.getElementById('prologue-subtitle-speaker'),
      subtitleText: document.getElementById('prologue-subtitle-text'),
      skipBtn: document.getElementById('btn-skip-prologue'),
      audioHint: document.getElementById('prologue-audio-hint'),
      transitionVeil: document.getElementById('prologue-transition-veil'),
    };

    // Cached deterministic telemetry state
    this._lastLetterboxRatio = 1.0;
    this._lastBarHeightPx = 88;
    this._lastOpeningLinesAlpha = [0, 0, 0];
    this._lastCoordCardAlpha = 0;
    this._spectrometerVisible = false;
    this._lastSpectrometerBars = new Array(48).fill(0);
    this._lastSpectrometerText = '';
    this._skipBtnVisible = false;
    this._lastSubtitle = null;

    this._onSkipClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onSkip();
    };
    this.els.skipBtn?.addEventListener('click', this._onSkipClick);
  }

  setAuditMode(isAudit) {
    this.auditMode = Boolean(isAudit);
    this._syncAudioHint();
  }

  setAudioUnlocked(unlocked) {
    this.audioUnlocked = Boolean(unlocked);
    this._syncAudioHint();
  }

  _syncAudioHint() {
    if (!this.els.audioHint) return;
    const isVisible =
      !this.auditMode &&
      !this.audioUnlocked &&
      Boolean(this.els.layer && !this.els.layer.hidden) &&
      this._skipBtnVisible;
    this.els.audioHint.hidden = !isVisible;
  }

  setVisible(visible) {
    if (this.els.layer) {
      this.els.layer.hidden = !visible;
    }
    if (!visible) {
      this._spectrometerVisible = false;
      this._skipBtnVisible = false;
      this._lastSubtitle = null;
    }
    this._syncAudioHint();
  }

  _computeBarHeightPx(letterboxRatio) {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const ratio = clamp(Number.isFinite(letterboxRatio) ? letterboxRatio : 1, 0, 1);
    const fullAnamorphicBar = vw / Math.max(1, vh) < 2.35 ? Math.max(0, (vh - vw / 2.35) * 0.5) : 0;
    return Math.round(fullAnamorphicBar * ratio);
  }

  _drawSpectrometer(bars, alpha, elapsedSec) {
    const canvas = this.els.spectrometerCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!Array.isArray(bars) || bars.length === 0 || alpha <= 0.005) return;

    const count = bars.length;
    const baseY = Math.round(h * 0.78);
    const maxBarH = Math.round(h * 0.68);
    const padX = 12;
    const usableW = w - padX * 2;
    const slotW = usableW / count;
    const barW = Math.max(2, Math.floor(slotW * 0.64));

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // Subtle transparent quantum gridline & baseline
    ctx.strokeStyle = 'rgba(77, 230, 211, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, baseY + 0.5);
    ctx.lineTo(w - padX, baseY + 0.5);
    ctx.stroke();

    // Subtle upper harmonic reference guide
    ctx.strokeStyle = 'rgba(77, 230, 211, 0.10)';
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(padX, Math.round(baseY - maxBarH * 0.5) + 0.5);
    ctx.lineTo(w - padX, Math.round(baseY - maxBarH * 0.5) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // 48 luminous cyan-to-gold quantum spectrum bars + subtle mirrored under-reflection
    for (let i = 0; i < count; i += 1) {
      const val = clamp(Number(bars[i]) || 0, 0, 1);
      const bh = Math.max(2, Math.round(val * maxBarH));
      const x = Math.round(padX + i * slotW + (slotW - barW) * 0.5);
      const y = baseY - bh;

      const grad = ctx.createLinearGradient(0, baseY, 0, y);
      grad.addColorStop(0, 'rgba(77, 230, 211, 0.55)');
      grad.addColorStop(0.65, '#4DE6D3');
      grad.addColorStop(1, val > 0.66 ? '#F7C346' : '#A5FCF2');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, bh);

      // Crisp bright cap pixel on high-energy bars
      if (val > 0.35) {
        ctx.fillStyle = val > 0.72 ? '#FFF6D6' : '#DDFBF7';
        ctx.fillRect(x, y, barW, 2);
      }

      // Delicate translucent lower mirror reflection
      const reflH = Math.max(1, Math.round(bh * 0.22));
      ctx.fillStyle = 'rgba(77, 230, 211, 0.22)';
      ctx.fillRect(x, baseY + 2, barW, reflH);
    }

    // Traveling faint quantum phase marker driven strictly by elapsedSec
    const phaseX = padX + (((elapsedSec * 0.32) % 1) * usableW);
    ctx.fillStyle = 'rgba(165, 252, 242, 0.28)';
    ctx.fillRect(Math.round(phaseX), baseY - maxBarH, 1, maxBarH);

    ctx.restore();
  }

  /**
   * Synchronize every cinema HUD element purely from `snapshot` + `spectrometerBars`.
   */
  sync(snapshot, spectrometerBars = null) {
    if (!snapshot) return;
    if (this.els.layer && this.els.layer.hidden) {
      this.els.layer.hidden = false;
    }

    // 1. 2.35:1 Anamorphic Letterbox Bars (pure black #000000; smoothly retracts in S6)
    const letterboxRatio = clamp(snapshot.letterboxRatio ?? 1, 0, 1);
    const barPx = this._computeBarHeightPx(letterboxRatio);
    this._lastLetterboxRatio = letterboxRatio;
    this._lastBarHeightPx = barPx;

    if (this.els.layer) {
      this.els.layer.style.setProperty('--prologue-bar-h', `${barPx}px`);
    }
    if (this.els.topBar) {
      this.els.topBar.style.height = `${barPx}px`;
      this.els.topBar.hidden = barPx <= 0;
    }
    if (this.els.bottomBar) {
      this.els.bottomBar.style.height = `${barPx}px`;
      this.els.bottomBar.hidden = barPx <= 0;
    }

    // 2. S0A Centered 3-Line Minimalist Opening Titles
    const alphas = Array.isArray(snapshot.openingLinesAlpha) ? snapshot.openingLinesAlpha : [0, 0, 0];
    const texts = Array.isArray(snapshot.openingLinesText) ? snapshot.openingLinesText : ['', '', ''];
    this._lastOpeningLinesAlpha = [
      clamp(Number(alphas[0]) || 0, 0, 1),
      clamp(Number(alphas[1]) || 0, 0, 1),
      clamp(Number(alphas[2]) || 0, 0, 1),
    ];
    const anyOpening = this._lastOpeningLinesAlpha.some((a) => a > 0.005);
    if (this.els.openingTitles) {
      this.els.openingTitles.hidden = !anyOpening;
      if (anyOpening) {
        for (let i = 0; i < 3; i += 1) {
          const el = this.els.openingLines[i];
          if (!el) continue;
          const a = this._lastOpeningLinesAlpha[i];
          el.textContent = texts[i] || '';
          el.style.opacity = a.toFixed(4);
          el.style.transform = `translateY(${((1 - a) * 8).toFixed(2)}px)`;
        }
      }
    }

    // 3. S0C Monospace Aerospace Coordinate Card
    const coordAlpha = clamp(Number(snapshot.coordCardAlpha) || 0, 0, 1);
    this._lastCoordCardAlpha = coordAlpha;
    const coordVisible = coordAlpha > 0.005;
    if (this.els.coordCard) {
      this.els.coordCard.hidden = !coordVisible;
      if (coordVisible) {
        const lines = Array.isArray(snapshot.coordCardLines) ? snapshot.coordCardLines : ['', ''];
        if (this.els.coordPrimary) this.els.coordPrimary.textContent = lines[0] || '';
        if (this.els.coordSecondary) this.els.coordSecondary.textContent = lines[1] || '';
        this.els.coordCard.style.opacity = coordAlpha.toFixed(4);
      }
    }

    // 4. S3 Frameless Transparent 48-Bar Quantum Spectrometer + Partial Decode
    const spec = snapshot.spectrometer;
    const bars =
      Array.isArray(spectrometerBars) && spectrometerBars.length > 0
        ? spectrometerBars
        : Array.isArray(spec?.bars)
          ? spec.bars
          : new Array(48).fill(0);
    const specAlpha = spec?.active ? clamp(Number(spec.alpha) || 0, 0, 1) : 0;
    const specVisible = Boolean(spec?.active && specAlpha > 0.01);
    this._spectrometerVisible = specVisible;
    this._lastSpectrometerBars = bars.slice(0, 48).map((v) => clamp(Number(v) || 0, 0, 1));

    const baseDecodeText = spec?.text || '';
    const parsePct = typeof spec?.parsePct === 'number' ? spec.parsePct : 14;
    const displayDecodeText =
      specVisible && baseDecodeText
        ? parsePct < 14
          ? baseDecodeText.replace('14%', `${parsePct}%`)
          : baseDecodeText
        : '';
    this._lastSpectrometerText = displayDecodeText;

    if (this.els.spectrometer) {
      this.els.spectrometer.hidden = !specVisible;
      if (specVisible) {
        this.els.spectrometer.style.opacity = specAlpha.toFixed(4);
        this._drawSpectrometer(this._lastSpectrometerBars, specAlpha, snapshot.elapsedSec || 0);
        if (this.els.spectrometerText) {
          this.els.spectrometerText.textContent = displayDecodeText;
        }
      }
    }

    // 5. Cinema Dialogue Subtitle (strictly hidden when null or in S6!)
    const sub = snapshot.shotId === 'S6' ? null : snapshot.activeSubtitle;
    const subAlpha = sub ? clamp(Number(sub.alpha) || 0, 0, 1) : 0;
    const subVisible = Boolean(sub && sub.text && subAlpha > 0.005);
    this._lastSubtitle = subVisible ? { ...sub } : null;

    if (this.els.subtitle) {
      this.els.subtitle.hidden = !subVisible;
      if (subVisible) {
        this.els.subtitle.style.opacity = subAlpha.toFixed(4);
        if (this.els.subtitleSpeaker) {
          const showLabel = Boolean(sub.speakerLabel && sub.speakerId !== 'narrator');
          this.els.subtitleSpeaker.textContent = showLabel ? `${sub.speakerLabel}：` : '';
          this.els.subtitleSpeaker.style.color = sub.color || '#E8EFF8';
          this.els.subtitleSpeaker.hidden = !showLabel;
        }
        if (this.els.subtitleText) {
          this.els.subtitleText.textContent = sub.text;
        }
      } else {
        if (this.els.subtitleSpeaker) this.els.subtitleSpeaker.textContent = '';
        if (this.els.subtitleText) this.els.subtitleText.textContent = '';
      }
    }

    // 6. Discreet Space Skip Pill (hidden in S6 polar-day pure white!)
    const skipVisible = snapshot.shotId !== 'S6' && (snapshot.elapsedSec ?? 0) < 71.0;
    this._skipBtnVisible = skipVisible;
    if (this.els.skipBtn) {
      this.els.skipBtn.hidden = !skipVisible;
    }

    // 7. S6 Polar-Day Pure-White Curtain
    const whiteoutAlpha = clamp(Number(snapshot.post?.whiteoutAlpha) || 0, 0, 1);
    if (this.els.whiteout) {
      this.els.whiteout.style.opacity = whiteoutAlpha.toFixed(4);
      this.els.whiteout.hidden = whiteoutAlpha <= 0.002;
    }

    this._syncAudioHint();
  }

  /**
   * Trigger a smooth post-skip / post-completion pure-white cross-dissolve veil
   * so switching out of Prologue never produces a harsh black cut.
   */
  triggerTransitionDissolve({ exitColor = '#FFFFFF', transitionMs = 450 } = {}) {
    const veil = this.els.transitionVeil;
    if (!veil) return;
    if (this._dissolveTimer) {
      clearTimeout(this._dissolveTimer);
      this._dissolveTimer = null;
    }

    veil.style.transition = 'none';
    veil.style.background = exitColor;
    veil.style.opacity = '1';
    veil.style.display = 'block';

    // Force layout flush so the fade-out transition animates smoothly on the next frame
    void veil.offsetWidth;

    const ms = Math.max(50, Math.round(transitionMs));
    veil.style.transition = `opacity ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    veil.style.opacity = '0';

    this._dissolveTimer = setTimeout(() => {
      veil.style.display = 'none';
      veil.style.transition = 'none';
      this._dissolveTimer = null;
    }, ms + 40);
  }

  getOverlayTelemetry() {
    return {
      letterboxRatio: this._lastLetterboxRatio,
      letterboxBarPx: this._lastBarHeightPx,
      openingLinesAlpha: [...this._lastOpeningLinesAlpha],
      coordCardAlpha: this._lastCoordCardAlpha,
      spectrometerVisible: this._spectrometerVisible,
      spectrometerBars: [...this._lastSpectrometerBars],
      spectrometerText: this._spectrometerVisible ? this._lastSpectrometerText : '',
      skipBtnVisible: this._skipBtnVisible,
      activeSubtitle: this._lastSubtitle ? { ...this._lastSubtitle } : null,
    };
  }

  reset() {
    this._lastLetterboxRatio = 1.0;
    this._lastBarHeightPx = this._computeBarHeightPx(1.0);
    this._lastOpeningLinesAlpha = [0, 0, 0];
    this._lastCoordCardAlpha = 0;
    this._spectrometerVisible = false;
    this._lastSpectrometerBars = new Array(48).fill(0);
    this._lastSpectrometerText = '';
    this._skipBtnVisible = false;
    this._lastSubtitle = null;

    if (this.els.openingTitles) this.els.openingTitles.hidden = true;
    if (this.els.coordCard) this.els.coordCard.hidden = true;
    if (this.els.spectrometer) this.els.spectrometer.hidden = true;
    if (this.els.subtitle) this.els.subtitle.hidden = true;
    if (this.els.subtitleText) this.els.subtitleText.textContent = '';
    if (this.els.subtitleSpeaker) this.els.subtitleSpeaker.textContent = '';
    if (this.els.whiteout) {
      this.els.whiteout.style.opacity = '0';
      this.els.whiteout.hidden = true;
    }
    if (this.els.audioHint) this.els.audioHint.hidden = true;
  }

  dispose() {
    this.els.skipBtn?.removeEventListener('click', this._onSkipClick);
    if (this._dissolveTimer) {
      clearTimeout(this._dissolveTimer);
      this._dissolveTimer = null;
    }
    this.reset();
  }
}
