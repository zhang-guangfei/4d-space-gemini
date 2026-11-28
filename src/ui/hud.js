/**
 * Beyond 3D — Multi-Level Minimalist HUD Controller (03-interaction-and-ui.md)
 * Supports:
 * - Zone A Chapter 1 (Prologue + Levels 1–4): optical telescope bezel, 6-direction compass,
 *   8-cell holographic topology map toggle, interactive terminal modal (L1 lock, L1 hypotheses, L2 lock),
 *   D9 fallback mode toggle, clickable 18-level roadmap
 * - Zone C Level 14 ("发丝裂缝"): full Phase 1 honest dual-view HUD, floating cues, & teleporter modal
 */

import { LEVEL_HINTS } from '../core/tiered-hints.js';
import { PALETTE } from '../engine/phase-materials.js';

export const PLAYABLE_LEVEL_IDS = Object.freeze([0, 1, 2, 3, 4, 14]);

export const LEVEL_META = Object.freeze({
  0: { zone: 'A', zoneLabel: 'A 区 · 远航者号', heading: '序章 · 迷航', title: '序章：迷航' },
  1: { zone: 'A', zoneLabel: 'A 区 · 回廊科研站', heading: '第 1 关 · 前方的人', title: '第 1 关：前方的人' },
  2: { zone: 'A', zoneLabel: 'A 区 · 回廊科研站', heading: '第 2 关 · 没有门通向对面', title: '第 2 关：没有门通向对面' },
  3: { zone: 'A', zoneLabel: 'A 区 · 回廊科研站', heading: '第 3 关 · 哪边是上', title: '第 3 关：哪边是上' },
  4: { zone: 'A', zoneLabel: 'A 区 · 回廊科研站', heading: '第 4 关 · 一笔走完', title: '第 4 关：一笔走完' },
  14: { zone: 'C', zoneLabel: 'C 区 · 几何圣殿', heading: '第 14 关 · 发丝裂缝', title: '第 14 关：发丝裂缝' },
});

export class HudController {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.activeLevelId = 0;
    this.shimmerTimer = null;
    this.toastTimer = null;
    this.victoryBannerDismissed = false;
    this.wheelCueVisible = false;
    this.wheelCueTimer = null;
    this.sliceTagVisible = false;
    this.sliceTagTimer = null;
    this.tabAttention = false;
    this.ch1ModalOpen = false;
    this.teleporterJumpHandler = null;
    this.prologueOverlay = null;

    this.els = {
      zonePill: document.getElementById('zone-pill'),
      levelHeading: document.getElementById('level-heading'),
      edgeShimmer: document.getElementById('edge-shimmer'),
      telescopeOverlay: document.getElementById('telescope-overlay'),
      prologueCinemaLayer: document.getElementById('prologue-cinema-layer'),
      honestBadge: document.getElementById('honest-view-badge'),
      honestDot: document.getElementById('honest-badge-dot'),
      honestTitle: document.getElementById('honest-badge-title'),
      honestDetail: document.getElementById('honest-badge-detail'),
      telemetryCoord: document.getElementById('telemetry-coord'),
      telemetryOrb: document.getElementById('telemetry-orb'),
      beatChips: Array.from(document.querySelectorAll('.beat-chip')),
      subtitleBar: document.getElementById('subtitle-bar'),
      subtitleSpeaker: document.getElementById('subtitle-speaker'),
      subtitleTier: document.getElementById('subtitle-tier'),
      subtitleText: document.getElementById('subtitle-text'),
      btnGuide: document.getElementById('btn-guide'),
      btnHint: document.getElementById('btn-hint'),
      btnHintLabel: document.getElementById('btn-hint-label'),
      btnVoice: document.getElementById('btn-voice'),
      btnVoiceLabel: document.getElementById('btn-voice-label'),
      btnConsole: document.getElementById('btn-console'),
      btnConsoleLabel: document.getElementById('btn-console-label'),
      btnPause: document.getElementById('btn-pause'),
      btnTabView: document.getElementById('btn-tab-view'),
      btnTabLabel: document.getElementById('btn-tab-label'),
      btnWMinus: document.getElementById('btn-w-minus'),
      btnWPlus: document.getElementById('btn-w-plus'),
      btnWOrigin: document.getElementById('btn-w-origin'),
      observeW: document.getElementById('observe-w'),
      goalMarker: document.getElementById('goal-marker'),
      tabEntryPill: document.getElementById('tab-entry-pill'),
      tabEntryLabel: document.getElementById('tab-entry-label'),
      wheelHandoffCue: document.getElementById('wheel-handoff-cue'),
      sliceCalloutTag: document.getElementById('slice-callout-tag'),
      wRulerBox: document.getElementById('w-ruler-box'),
      tacticalPanelTitle: document.getElementById('tactical-panel-title'),
      tacticalPanelSub: document.getElementById('tactical-panel-sub'),
      ch1Compass: document.getElementById('ch1-compass'),
      compassTitle: document.getElementById('compass-title'),
      compassAntipode: document.getElementById('compass-antipode'),
      compassGrid: document.getElementById('compass-grid'),
      reticle: document.getElementById('reticle'),
      reticlePrompt: document.getElementById('reticle-prompt'),
      controlStripText: document.getElementById('control-strip-text'),
      blockToast: document.getElementById('block-toast'),
      victoryBanner: document.getElementById('victory-banner'),
      victoryBadge: document.getElementById('victory-badge'),
      victoryCopy: document.getElementById('victory-copy'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnReleaseVictory: document.getElementById('btn-release-victory'),
      btnReplayVictory: document.getElementById('btn-replay-victory'),
      ch1Modal: document.getElementById('ch1-modal'),
      ch1ModalEyebrow: document.getElementById('ch1-modal-eyebrow'),
      ch1ModalTitle: document.getElementById('ch1-modal-title'),
      ch1ModalDesc: document.getElementById('ch1-modal-desc'),
      ch1ModalOptions: document.getElementById('ch1-modal-options'),
      ch1ModalFeedback: document.getElementById('ch1-modal-feedback'),
      btnCloseCh1Modal: document.getElementById('btn-close-ch1-modal'),
      teleporterModal: document.getElementById('teleporter-modal'),
      teleporterBadge: document.getElementById('teleporter-badge'),
      teleporterTitle: document.getElementById('teleporter-title'),
      teleporterCopy: document.getElementById('teleporter-copy'),
      btnTeleporterJump: document.getElementById('btn-teleporter-jump'),
      btnTeleporterReplay: document.getElementById('btn-teleporter-replay'),
      btnTeleporterRoadmap: document.getElementById('btn-teleporter-roadmap'),
      btnTeleporterStay: document.getElementById('btn-teleporter-stay'),
      pauseModal: document.getElementById('pause-modal'),
      btnClosePause: document.getElementById('btn-close-pause'),
      btnResumeLevel: document.getElementById('btn-resume-level'),
      btnResetLevel: document.getElementById('btn-reset-level'),
      inputMouseSens: document.getElementById('input-mouse-sens'),
      valMouseSens: document.getElementById('val-mouse-sens'),
      inputWheelSens: document.getElementById('input-wheel-sens'),
      valWheelSens: document.getElementById('val-wheel-sens'),
      inputD9Fallback: document.getElementById('input-d9-fallback'),
      roadmapGrid: document.getElementById('roadmap-grid'),
    };

    this._bindButtons();
    this._populateRoadmap();
  }

  setPrologueOverlay(controller) {
    this.prologueOverlay = controller || null;
  }

  setActiveLevel(levelId) {
    this.activeLevelId = levelId;
    const meta = LEVEL_META[levelId] || LEVEL_META[1];
    const isZoneA = meta.zone === 'A';
    const isPrologue = levelId === 0;

    document.body.classList.toggle('zone-a', isZoneA);
    document.body.classList.toggle('zone-c', !isZoneA);
    document.body.classList.toggle('mode-ch1', isZoneA);
    document.body.classList.toggle('is-prologue', isPrologue);
    document.title = `维度之外 · Beyond 3D — ${meta.title}`;

    if (this.els.zonePill) this.els.zonePill.textContent = meta.zoneLabel;
    if (this.els.levelHeading) this.els.levelHeading.textContent = meta.heading;
    if (this.els.btnConsoleLabel) {
      this.els.btnConsoleLabel.textContent = isZoneA ? '拓扑图' : '高维台';
    }
    if (this.els.tacticalPanelTitle) {
      this.els.tacticalPanelTitle.textContent = isZoneA ? '八胞体全息拓扑图' : '高维全息台 · 三层俯视';
    }
    if (this.els.tacticalPanelSub) {
      this.els.tacticalPanelSub.textContent = isZoneA ? '8 胞 · 24 面' : '沿第四维度 w';
    }
    if (this.prologueOverlay) {
      this.prologueOverlay.setVisible(isPrologue);
    } else if (this.els.prologueCinemaLayer) {
      this.els.prologueCinemaLayer.hidden = !isPrologue;
    }
    if (this.els.telescopeOverlay) {
      this.els.telescopeOverlay.hidden = true;
    }
    if (this.els.ch1Compass) {
      this.els.ch1Compass.hidden = !(levelId >= 2 && levelId <= 4);
    }
    if (this.els.goalMarker) {
      this.els.goalMarker.hidden = true;
    }

    this.closeCh1Modal(true);
    this.resetBanner();
    this._populateRoadmap();
  }

  setD9FallbackChecked(checked) {
    if (this.els.inputD9Fallback) {
      this.els.inputD9Fallback.checked = Boolean(checked);
    }
  }

  _populateRoadmap() {
    if (!this.els.roadmapGrid) return;
    this.els.roadmapGrid.innerHTML = '';

    // Prologue tile first
    const proItem = document.createElement('button');
    proItem.type = 'button';
    proItem.className = `roadmap-item is-live${this.activeLevelId === 0 ? ' is-current' : ''}`;
    proItem.innerHTML = `<span>#0 序章 · 迷航</span><span class="roadmap-status">${
      this.activeLevelId === 0 ? '当前' : 'LIVE'
    }</span>`;
    proItem.addEventListener('click', () => this.cb.onSelectLevel?.(0));
    this.els.roadmapGrid.appendChild(proItem);

    for (let id = 1; id <= 18; id += 1) {
      const info = LEVEL_HINTS[id];
      const isLive = PLAYABLE_LEVEL_IDS.includes(id);
      const isCurr = this.activeLevelId === id;
      const el = document.createElement(isLive ? 'button' : 'div');
      if (isLive) el.type = 'button';
      el.className = `roadmap-item${isLive ? ' is-live' : ''}${isCurr ? ' is-current' : ''}`;
      el.innerHTML = `<span>#${id} ${info.name}</span><span class="roadmap-status">${
        isCurr ? '当前' : isLive ? 'LIVE' : id <= 12 ? 'Phase 2.2' : 'Phase 2.3'
      }</span>`;
      if (isLive) {
        el.addEventListener('click', () => this.cb.onSelectLevel?.(id));
      }
      this.els.roadmapGrid.appendChild(el);
    }
  }

  _bindButtons() {
    this.els.btnGuide?.addEventListener('click', () => this.cb.onToggleGuide?.());
    this.els.btnHint?.addEventListener('click', () => this.cb.onRequestHint?.());
    this.els.btnVoice?.addEventListener('click', () => this.cb.onToggleVoice?.());
    this.els.btnConsole?.addEventListener('click', () => this.cb.onToggleConsole?.());
    this.els.btnPause?.addEventListener('click', () => this.cb.onTogglePause?.());
    this.els.btnTabView?.addEventListener('click', () => this.cb.onToggleHonestView?.());
    this.els.btnWMinus?.addEventListener('click', () => this.cb.onStepW?.(-1));
    this.els.btnWPlus?.addEventListener('click', () => this.cb.onStepW?.(1));
    this.els.btnWOrigin?.addEventListener('click', () => this.cb.onReturnToOriginLayer?.());
    this.els.tabEntryPill?.addEventListener('click', () => this.cb.onToggleHonestView?.());
    this.els.btnClosePause?.addEventListener('click', () => this.cb.onTogglePause?.());
    this.els.btnResumeLevel?.addEventListener('click', () => this.cb.onTogglePause?.());
    this.els.btnCloseCh1Modal?.addEventListener('click', () => this.closeCh1Modal());
    this.els.btnResetLevel?.addEventListener('click', () => {
      this.cb.onReset?.();
      this.cb.onTogglePause?.();
    });
    this.els.btnNextLevel?.addEventListener('click', () => this.cb.onNextLevel?.());
    this.els.btnReleaseVictory?.addEventListener('click', () => {
      this.victoryBannerDismissed = true;
      this.cb.onReleaseAfterVictory?.();
    });
    this.els.btnReplayVictory?.addEventListener('click', () => this.cb.onReset?.());

    this.els.btnTeleporterJump?.addEventListener('click', () => {
      this.setTeleporterVisible(false);
      this.cb.onCloseTeleporterModal?.();
      this.teleporterJumpHandler?.();
    });
    this.els.btnTeleporterReplay?.addEventListener('click', () => {
      this.setTeleporterVisible(false);
      this.cb.onReset?.();
    });
    this.els.btnTeleporterRoadmap?.addEventListener('click', () => {
      this.setTeleporterVisible(false);
      this.cb.onCloseTeleporterModal?.();
      this.cb.onTogglePause?.();
    });
    this.els.btnTeleporterStay?.addEventListener('click', () => {
      this.setTeleporterVisible(false);
      this.cb.onCloseTeleporterModal?.();
    });

    this.els.inputMouseSens?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.els.valMouseSens.textContent = `${val.toFixed(1)}×`;
      this.cb.onSensitivityChange?.({ mouseScale: val });
    });
    this.els.inputWheelSens?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.els.valWheelSens.textContent = `${val.toFixed(1)}×`;
      this.cb.onSensitivityChange?.({ wheelScale: val });
    });
    this.els.inputD9Fallback?.addEventListener('change', (e) => {
      this.cb.onToggleD9Fallback?.(Boolean(e.target.checked));
    });
  }

  openCh1Modal({ eyebrow, title, desc, options = [], onSelect = null }) {
    if (!this.els.ch1Modal) return;
    this.ch1ModalOpen = true;
    this.els.ch1ModalEyebrow.textContent = eyebrow || 'A 区 · 回廊科研站终端';
    this.els.ch1ModalTitle.textContent = title || '终端';
    this.els.ch1ModalDesc.innerHTML = desc || '';
    this.els.ch1ModalFeedback.textContent = '';
    this.els.ch1ModalFeedback.classList.remove('is-ok');
    this.els.ch1ModalOptions.innerHTML = '';

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ch1-option-btn';
      btn.innerHTML = `<span class="opt-title">${opt.title}</span>${
        opt.sub ? `<span class="opt-sub">${opt.sub}</span>` : ''
      }`;
      btn.addEventListener('click', () => {
        const result = onSelect?.(opt.value);
        if (result && result.feedback) {
          this.els.ch1ModalFeedback.textContent = result.feedback;
          this.els.ch1ModalFeedback.classList.toggle('is-ok', Boolean(result.ok));
        }
        if (result?.closeAfterMs) {
          setTimeout(() => this.closeCh1Modal(), result.closeAfterMs);
        } else if (result?.closeNow) {
          this.closeCh1Modal();
        }
      });
      this.els.ch1ModalOptions.appendChild(btn);
    }

    this.els.ch1Modal.hidden = false;
    this.cb.onCh1ModalVisibility?.(true);
  }

  closeCh1Modal(silent = false) {
    if (!this.ch1ModalOpen && this.els.ch1Modal?.hidden) return;
    this.ch1ModalOpen = false;
    if (this.els.ch1Modal) this.els.ch1Modal.hidden = true;
    if (!silent) {
      this.cb.onCh1ModalVisibility?.(false);
    }
  }

  configureTeleporterModal({ badge, title, copy, jumpLabel = null, onJump = null }) {
    if (this.els.teleporterBadge && badge) this.els.teleporterBadge.textContent = badge;
    if (this.els.teleporterTitle && title) this.els.teleporterTitle.textContent = title;
    if (this.els.teleporterCopy && copy) this.els.teleporterCopy.innerHTML = copy;
    this.teleporterJumpHandler = onJump;
    if (this.els.btnTeleporterJump) {
      this.els.btnTeleporterJump.hidden = !jumpLabel;
      if (jumpLabel) this.els.btnTeleporterJump.textContent = jumpLabel;
    }
  }

  resetBanner() {
    this.victoryBannerDismissed = false;
    this.tabAttention = false;
    this.hideWheelHandoffCue();
    this.hideSliceCallout();
    this.setTeleporterVisible(false);
    if (this.els.victoryBanner) this.els.victoryBanner.hidden = true;
  }

  dismissVictoryBanner() {
    this.victoryBannerDismissed = true;
    if (this.els.victoryBanner) this.els.victoryBanner.hidden = true;
  }

  showWheelHandoffCue(durationMs = 4600) {
    if (!this.els.wheelHandoffCue) return;
    this.wheelCueVisible = true;
    this.els.wheelHandoffCue.classList.add('is-visible');
    if (this.wheelCueTimer) clearTimeout(this.wheelCueTimer);
    this.wheelCueTimer = setTimeout(() => this.hideWheelHandoffCue(), durationMs);
  }

  hideWheelHandoffCue() {
    this.wheelCueVisible = false;
    if (this.wheelCueTimer) {
      clearTimeout(this.wheelCueTimer);
      this.wheelCueTimer = null;
    }
    this.els.wheelHandoffCue?.classList.remove('is-visible');
  }

  showSliceCallout(durationMs = 5400, customText = '本层截面 · 圆面斜看像椭圆') {
    if (!this.els.sliceCalloutTag) return;
    const textSpan = this.els.sliceCalloutTag.querySelector('span:last-child');
    if (textSpan) textSpan.textContent = customText;
    this.sliceTagVisible = true;
    this.els.sliceCalloutTag.classList.add('is-visible');
    if (this.sliceTagTimer) clearTimeout(this.sliceTagTimer);
    this.sliceTagTimer = setTimeout(() => this.hideSliceCallout(), durationMs);
  }

  hideSliceCallout() {
    this.sliceTagVisible = false;
    if (this.sliceTagTimer) {
      clearTimeout(this.sliceTagTimer);
      this.sliceTagTimer = null;
    }
    this.els.sliceCalloutTag?.classList.remove('is-visible');
  }

  setTabAttention(active) {
    this.tabAttention = Boolean(active);
  }

  setTeleporterVisible(visible) {
    if (this.els.teleporterModal) {
      this.els.teleporterModal.hidden = !visible;
    }
  }

  showSubtitle({ visible, speaker, text, tierLabel }) {
    if (!this.els.subtitleBar) return;
    if (this.activeLevelId === 0) {
      this.els.subtitleBar.classList.remove('is-visible');
      return;
    }
    if (!visible) {
      this.els.subtitleBar.classList.remove('is-visible');
      return;
    }
    this.els.subtitleSpeaker.textContent = speaker.displayName;
    this.els.subtitleSpeaker.style.color = speaker.color;
    this.els.subtitleTier.textContent = tierLabel ? `[${tierLabel}]` : '';
    this.els.subtitleText.textContent = text;
    this.els.subtitleBar.classList.add('is-visible');
  }

  flashEdge(hexColor) {
    if (!this.els.edgeShimmer) return;
    this.els.edgeShimmer.style.setProperty('--shimmer-color', `${hexColor}66`);
    this.els.edgeShimmer.classList.add('is-active');
    if (this.shimmerTimer) clearTimeout(this.shimmerTimer);
    this.shimmerTimer = setTimeout(() => {
      this.els.edgeShimmer.classList.remove('is-active');
    }, 240);
  }

  showBlockToast(message) {
    if (!this.els.blockToast) return;
    this.els.blockToast.textContent = message;
    this.els.blockToast.classList.add('is-visible');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.els.blockToast.classList.remove('is-visible');
    }, 3200);
  }

  setVoiceEnabled(enabled) {
    this.els.btnVoice?.classList.toggle('is-active', enabled);
    if (this.els.btnVoiceLabel) {
      this.els.btnVoiceLabel.textContent = enabled ? '配音 开' : '配音 关';
    }
  }

  setConsoleExpanded(expanded) {
    this.els.btnConsole?.classList.toggle('is-active', expanded);
  }

  setPaused(paused) {
    if (this.els.pauseModal) {
      this.els.pauseModal.hidden = !paused;
    }
  }

  /**
   * Synchronize HUD for Chapter 1 (Prologue + Levels 1–4).
   */
  syncChapter1(vm) {
    if (vm.levelId === 0) {
      if (this.prologueOverlay && vm.snapshot) {
        this.prologueOverlay.sync(vm.snapshot, vm.spectrometerBars || null);
      }
      return;
    }

    // 1. Honest View / Cell Badge
    this.els.honestTitle.textContent = vm.badgeTitle;
    this.els.honestDetail.textContent = vm.badgeDetail;
    this.els.honestBadge.classList.remove('is-side-view');
    const dotColor = vm.dotColor || PALETTE.accent.cyanW0;
    this.els.honestDot.style.background = dotColor;
    this.els.honestDot.style.boxShadow = `0 0 8px ${dotColor}`;

    // 2. Precision telemetry
    this.els.telemetryCoord.textContent = vm.telemetryA;
    this.els.telemetryOrb.textContent = vm.telemetryB;
    this.els.telemetryOrb.style.color = vm.telemetryAccent || '';

    // 3. Three-beat discovery strip
    for (const chip of this.els.beatChips) {
      const b = Number(chip.dataset.beat);
      chip.classList.toggle('is-lit', vm.beat >= b);
    }

    // 4. Hint button
    if (vm.hintSnapshot) {
      this.els.btnHintLabel.textContent = `提示 ${vm.hintSnapshot.tier}/${vm.hintSnapshot.maxTier}`;
      this.els.btnHint.classList.toggle('is-hint-pulse', vm.hintSnapshot.pulseSuggested);
    }

    // 5. Optical telescope bezel
    if (this.els.telescopeOverlay) {
      this.els.telescopeOverlay.hidden = !vm.telescopeActive;
    }

    // 6. Dynamic Reticle
    this.els.reticle.classList.remove('is-hidden');
    this.els.reticle.classList.toggle('is-interactable', Boolean(vm.reticlePrompt));
    this.els.reticlePrompt.textContent = vm.reticlePrompt || '';

    // 6b. 3D World-Space Anchored Diegetic Callout (matches Level 14 floating discovery cues!)
    if (this.sliceTagVisible && vm.worldCalloutAnchor && vm.worldCalloutAnchor.inFront && this.els.sliceCalloutTag) {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;
      const cx = Math.max(120, Math.min(vw - 220, vm.worldCalloutAnchor.x + 22));
      const cy = Math.max(120, Math.min(vh - 110, vm.worldCalloutAnchor.y - 26));
      this.els.sliceCalloutTag.style.left = `${cx}px`;
      this.els.sliceCalloutTag.style.top = `${cy}px`;
    }

    // 7. Six-Way Navigation Compass (Levels 2–4)
    if (this.els.ch1Compass && vm.compass) {
      this.els.ch1Compass.hidden = false;
      this.els.compassTitle.textContent = vm.compass.title;
      this.els.compassAntipode.textContent = vm.compass.antipodeText;
      this.els.compassGrid.innerHTML = vm.compass.slots
        .map((s) => {
          const cls = s.status ? ` is-${s.status}` : '';
          return `<div class="compass-cell${cls}"><span class="dir-tag">${s.label}</span><span class="mono">${s.prefix || ''}${s.cellId}</span></div>`;
        })
        .join('');
    } else if (this.els.ch1Compass) {
      this.els.ch1Compass.hidden = true;
    }

    // 8. Control micro-strip
    if (vm.controlHtml) {
      this.els.controlStripText.innerHTML = vm.controlHtml;
    }

    // 9. Victory banner
    if (this.els.victoryBanner) {
      const showVictory = Boolean(vm.completed) && !this.victoryBannerDismissed && !vm.hideVictoryBanner;
      this.els.victoryBanner.hidden = !showVictory;
      if (showVictory && vm.victory) {
        this.els.victoryBadge.textContent = vm.victory.badge;
        this.els.victoryCopy.innerHTML = vm.victory.copy;
        this.els.btnNextLevel.hidden = !vm.victory.nextLabel;
        if (vm.victory.nextLabel) this.els.btnNextLevel.textContent = vm.victory.nextLabel;
        this.els.btnReleaseVictory.textContent = '继续留在舱室 (E)';
      }
    }
  }

  /**
   * Synchronize all HUD indicators for Level 14 (Zone C Sanctuary vertical slice).
   */
  sync(state, hintSnapshot, orbAnchor = null, goalAnchor = null) {
    const badge = state.getHonestViewBadge();
    const ext = state.getExtents();
    const slice = state.getSliceAtPlayerW();
    const isBlade = state.isBladeThinEnough();

    this.els.honestTitle.textContent = badge.title;
    this.els.honestDetail.textContent = badge.detail;
    this.els.honestBadge.classList.toggle('is-side-view', badge.mode === 'side_xzw');

    let dotColor = PALETTE.accent.cyanW0;
    if (badge.mode === 'side_xzw') dotColor = PALETTE.accent.goldWPos;
    else if (state.completed) dotColor = PALETTE.accent.emerald;
    else if (state.playerPos[3] > 0.6) dotColor = PALETTE.accent.goldWPos;
    else if (state.playerPos[3] < -0.6) dotColor = PALETTE.accent.blueWNeg;
    this.els.honestDot.style.background = dotColor;
    this.els.honestDot.style.boxShadow = `0 0 8px ${dotColor}`;

    const [px, py, pz, pw] = state.playerPos;
    const wSign = pw >= 0 ? '+' : '';
    this.els.telemetryCoord.textContent = `XYZ (${px.toFixed(1)}, ${py.toFixed(1)}, ${pz.toFixed(1)}) · w ${wSign}${pw.toFixed(2)}`;
    const sliceWidth = slice.intersects ? `本层宽 ${(2 * slice.semiX).toFixed(3)} m` : '本层没有球身';
    this.els.telemetryOrb.textContent = `θ ${state.thetaDeg.toFixed(1)}° · 观察层 w ${pw.toFixed(2)} · ${sliceWidth} · 整球宽 ${(2 * ext.xMax).toFixed(3)} m · 缝宽 ${(2 * state.config.slitHalfWidth).toFixed(3)} m`;
    this.els.telemetryOrb.style.color = isBlade || state.completed ? PALETTE.accent.emerald : '';

    for (const chip of this.els.beatChips) {
      const b = Number(chip.dataset.beat);
      chip.classList.toggle('is-lit', state.beat >= b);
    }

    this.els.btnHintLabel.textContent = `提示 ${hintSnapshot.tier}/${hintSnapshot.maxTier}`;
    this.els.btnHint.classList.toggle('is-hint-pulse', hintSnapshot.pulseSuggested);

    if (this.els.tabEntryPill) {
      const showPill = state.grabbed && state.viewMode !== 'side_xzw' && !state.keyInserted && !state.completed;
      this.els.tabEntryPill.hidden = !showPill;
      this.els.tabEntryPill.classList.toggle('is-attention', this.tabAttention);
      if (this.els.tabEntryLabel) {
        this.els.tabEntryLabel.textContent = this.tabAttention ? '看看哪里碰到了墙' : '第四维侧视';
      }
    }
    if (this.els.btnTabLabel) {
      this.els.btnTabLabel.textContent = state.viewMode === 'side_xzw' ? '收起侧视' : '展开侧视';
    }
    const wText = `W ${wSign}${pw.toFixed(2)}`;
    if (this.els.observeW && this.els.observeW.textContent !== wText) {
      this.els.observeW.textContent = wText;
    }
    if (this.els.btnWOrigin) this.els.btnWOrigin.disabled = pw === 0;
    if (this.els.btnWMinus) this.els.btnWMinus.disabled = pw <= state.config.playerWMin;
    if (this.els.btnWPlus) this.els.btnWPlus.disabled = pw >= state.config.playerWMax;

    if (this.els.goalMarker) {
      const marker = this.els.goalMarker;
      marker.hidden = !goalAnchor?.inFront || goalAnchor.x < 0 || goalAnchor.x > window.innerWidth ||
        goalAnchor.y < 0 || goalAnchor.y > window.innerHeight;
      if (!marker.hidden) {
        marker.style.left = `${goalAnchor.x}px`;
        marker.style.top = `${goalAnchor.y}px`;
        marker.classList.toggle('opens-left', goalAnchor.x > window.innerWidth - 180);
      }
    }

    if (orbAnchor && orbAnchor.inFront) {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;
      if (this.wheelCueVisible && this.els.wheelHandoffCue) {
        const cx = Math.max(120, Math.min(vw - 140, orbAnchor.x + 132));
        const cy = Math.max(130, Math.min(vh - 110, orbAnchor.y - 36));
        this.els.wheelHandoffCue.style.left = `${cx}px`;
        this.els.wheelHandoffCue.style.top = `${cy}px`;
      }
      if (this.sliceTagVisible && this.els.sliceCalloutTag) {
        const cx = Math.max(90, Math.min(vw - 180, orbAnchor.x + 28));
        const cy = Math.max(130, Math.min(vh - 110, orbAnchor.y - 24));
        this.els.sliceCalloutTag.style.left = `${cx}px`;
        this.els.sliceCalloutTag.style.top = `${cy}px`;
      }
    }

    if (state.grabbed) {
      this.els.reticle.classList.add('is-hidden');
      this.els.reticle.classList.remove('is-interactable');
    } else {
      this.els.reticle.classList.remove('is-hidden');
      const canGrab = state.canGrabOrb() && !state.keyInserted && !state.completed;
      this.els.reticle.classList.toggle('is-interactable', canGrab);
      this.els.reticlePrompt.textContent = state.canReconnectAtPedestal
        ? '[E] 重新操控底座上的球'
        : canGrab
          ? '[E] 抓住圆球'
          : '';
    }

    if (state.unlockStage === 'awaiting_release') {
      this.els.controlStripText.innerHTML =
        '钥匙已正确插入锁孔 · 请按 <strong>E</strong> 释放对球的控制，回到自由视角';
    } else if (state.unlockStage === 'unlocking') {
      this.els.controlStripText.innerHTML =
        '钥匙与锁孔正在共振解锁，请注视前方巨墙……';
    } else if (state.unlockStage === 'opening_door') {
      this.els.controlStripText.innerHTML =
        '封印已解开，四维巨墙正在缓缓开启……';
    } else if (state.completed) {
      this.els.controlStripText.innerHTML =
        '巨墙已打开 · 按 <strong>WASD</strong> 穿过通道踏上前方<strong>北侧传送台</strong> · 按 <strong>R</strong> 重玩';
    } else if (state.grabbed) {
      this.els.controlStripText.innerHTML =
        '<strong>滚轮</strong> 沿 W 轴移动 · <strong>Shift + 滚轮</strong> 转球 · <strong>W/S</strong> 推拉 · <strong>Tab</strong> 侧视 · <strong>E</strong> 松开';
    } else {
      this.els.controlStripText.innerHTML =
        'WASD 移动 · 拖拽/点击环视 · <strong>滚轮沿 w 轴移动</strong> · 靠近圆球按 <strong>E</strong> 抓取 · <strong>H</strong> 提示 · <strong>I</strong> 原理';
    }

    if (this.els.victoryBanner) {
      const showVictory = state.completed && !this.victoryBannerDismissed && !state.enteredTeleporter;
      this.els.victoryBanner.hidden = !showVictory;
      if (showVictory) {
        this.els.victoryBadge.textContent = '巨墙已打开 · 通往下一关的通道已开启';
        this.els.victoryCopy.innerHTML =
          '圆球从未被压扁，只是像立起的硬币一样把宽度转进了第四维度 w。现在请<strong>穿过打开的四维巨墙</strong>，踏上前方发光的<strong>北侧传送台</strong>前往下一关！';
        this.els.btnNextLevel.hidden = true;
        this.els.btnReleaseVictory.textContent = '好的 · 前往传送台 (E)';
      }
    }
  }
}
