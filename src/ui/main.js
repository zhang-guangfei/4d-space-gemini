/**
 * Beyond 3D — Multi-Level Application Bootstrap & Campaign Router
 * Supports:
 * - Phase 2.1 Act I 《回廊》 (Zone A Soft-Mist White Research Station):
 *     ?level=0  序章 · 迷航
 *     ?level=1  第 1 关 · 前方的人
 *     ?level=2  第 2 关 · 没有门通向对面
 *     ?level=3  第 3 关 · 哪边是上 (with D9 HOLONOMY_SIMPLE_FALLBACK dual mode)
 *     ?level=4  第 4 关 · 一笔走完
 * - Phase 1 Vertical Slice (Zone C Geometric Sanctuary):
 *     ?level=14 第 14 关 · 发丝裂缝
 */

import { angularDistanceMod180Deg } from '../core/math4d.js';
import { Level14HairlineSlitState } from '../core/sanctuary-4d.js';
import {
  ANTIPODAL_CELL,
  CELL_COLORS,
  getEgocentricCompass,
  LEVEL1_STATUE_DIRECTIONS,
  Level1CorridorState,
  Level2AntipodalState,
  Level3HolonomyState,
  Level4HamiltonianState,
  PrologueVoyagerState,
} from '../core/tesseract-boundary.js';
import { TieredHintController } from '../core/tiered-hints.js';
import { CharacterVoiceEngine } from '../engine/character-voice.js';
import { GrabStageController } from '../engine/grab-stage.js';
import { InputController } from '../engine/input-controller.js';
import { PALETTE } from '../engine/phase-materials.js';
import { TesseractTopologyMap } from '../engine/portal-optics.js';
import { SoundFxEngine } from '../engine/sound-fx.js';
import { TacticalConsole } from '../engine/tactical-console.js';
import {
  Level1CorridorScene,
  Level2AntipodalScene,
  Level3HolonomyScene,
  Level4HamiltonianScene,
  PrologueScene,
} from '../levels/chapter1-levels.js';
import { Level14SanctuaryScene } from '../levels/chapter2-sanctuary.js';
import { HudController, PLAYABLE_LEVEL_IDS } from './hud.js';
import { PrincipleGuideController } from './principle-guide.js';

const L1_HYPOTHESIS_NOTES = Object.freeze({
  hyp_ring: {
    title: '林夏猜想 A · 环形弯曲大厅',
    desc: '如果这是一条圆形弯曲走廊，只要走廊半径够大，往前走确实能回到起点。但仔细看眼前这条 24 米玻璃回廊——<strong>天花板与地面导轨完全笔直，没有任何左右弯曲</strong>。光线并不是在三维里弯了一圈，而是整个三维空间本身闭合了。',
  },
  hyp_belt: {
    title: '林夏猜想 B · 跑步机传送带',
    desc: '如果我们在原地踏步，脚下的红丝带就不应该离开视线；更重要的是，每跨过一扇门，<strong>左右舷窗外的雕像确实刚性转动了 90°</strong>，连走 4 间才回到最初的朝向。我们确实在真实前进。',
  },
  hyp_sphere: {
    title: '林夏猜想 C · 闭合三维边界（正八胞体外壳）',
    desc: '就像地球表面是有限无界的二维球面，正八胞体（四维超立方体）的三维外壳由 <strong>8 个立方体房间</strong>首尾相接而成。沿直线跨过 4 个房间（<code>W+ → X+ → W− → X− → W+</code>）就会精确绕回起点，周期为 <strong>4</strong>。',
  },
});

function parseInitialLevel() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('level');
  if (raw === null) return 0; // Default campaign entry: Prologue -> Levels 1–4
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && PLAYABLE_LEVEL_IDS.includes(parsed)) {
    return parsed;
  }
  return 0;
}

function parseInitialD9Fallback() {
  const params = new URLSearchParams(window.location.search);
  return params.get('d9fallback') === '1';
}

function boot() {
  const B = globalThis.BABYLON;
  const canvas = document.getElementById('render-canvas');
  if (!B || !canvas) {
    throw new Error('Babylon.js or #render-canvas failed to initialize.');
  }

  const engine = new B.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  // Persistent shared audio, voice, HUD, console panels, and input
  const sfx = new SoundFxEngine();
  let hud = null;
  const voice = new CharacterVoiceEngine({
    onSubtitle: (payload) => hud?.showSubtitle(payload),
  });

  const grabStage = new GrabStageController(
    document.getElementById('side-view-canvas'),
    document.getElementById('side-view-panel')
  );
  const consolePanel = new TacticalConsole({
    wrapperEl: document.getElementById('tactical-wrapper'),
    bodyEl: document.getElementById('tactical-body'),
    canvas: document.getElementById('tactical-canvas'),
    rulerCursorEl: document.getElementById('w-ruler-cursor'),
    rulerReadoutEl: document.getElementById('w-ruler-readout'),
  });
  const topologyMap = new TesseractTopologyMap({
    wrapperEl: document.getElementById('tactical-wrapper'),
    bodyEl: document.getElementById('tactical-body'),
    canvas: document.getElementById('tactical-canvas'),
    titleEl: document.getElementById('tactical-panel-title'),
    subEl: document.getElementById('tactical-panel-sub'),
  });

  let activeLevelId = parseInitialLevel();
  let d9FallbackEnabled = parseInitialD9Fallback();
  let paused = false;
  let guideOpen = false;
  let ch1ModalOpen = false;
  let teleporterOpen = false;
  let audioUnlocked = false;
  let activeRuntime = null;

  const syncPauseState = () => {
    input.setPaused(paused || guideOpen || ch1ModalOpen || teleporterOpen);
  };

  const unlockAudioOnce = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    sfx.unlock();
    if (activeLevelId === 14) {
      sfx.startSanctuaryAmbience();
    } else {
      sfx.startStationAmbience();
    }
    voice.unlockOnGesture();
  };

  const principleGuide = new PrincipleGuideController({
    onVisibilityChange: (isOpen) => {
      guideOpen = isOpen;
      if (isOpen) unlockAudioOnce();
      syncPauseState();
    },
    onDismissed: () => unlockAudioOnce(),
  });

  const handleTogglePause = () => {
    if (guideOpen) {
      principleGuide.hide();
      return;
    }
    if (ch1ModalOpen) {
      hud?.closeCh1Modal();
      return;
    }
    if (teleporterOpen) {
      teleporterOpen = false;
      hud?.setTeleporterVisible(false);
      syncPauseState();
      return;
    }
    paused = !paused;
    syncPauseState();
    hud?.setPaused(paused);
  };

  // Switch seamlessly between any playable level (0, 1, 2, 3, 4, 14) with zero leaked resources
  const loadLevel = (targetId) => {
    if (!PLAYABLE_LEVEL_IDS.includes(targetId)) return;

    // Close modals cleanly
    paused = false;
    guideOpen = false;
    ch1ModalOpen = false;
    teleporterOpen = false;
    principleGuide.hide();
    hud?.setPaused(false);
    hud?.closeCh1Modal(true);
    hud?.setTeleporterVisible(false);
    hud?.showSubtitle({ visible: false, speaker: { displayName: '', color: '' }, text: '' });

    // Cleanly dispose previous Babylon scene & level timers
    if (activeRuntime) {
      activeRuntime.dispose();
      activeRuntime = null;
    }

    activeLevelId = targetId;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('level', String(targetId));
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Ignore in restricted iframe/file contexts
    }

    hud.setActiveLevel(targetId);
    hud.setD9FallbackChecked(d9FallbackEnabled);
    if (targetId !== 0) {
      principleGuide.setLevel(targetId);
    }
    if (targetId === 14) {
      consolePanel.setExpanded(true);
      hud.setConsoleExpanded(true);
    } else {
      topologyMap.setExpanded(false);
      hud.setConsoleExpanded(false);
    }

    if (audioUnlocked) {
      sfx.stopAmbience();
      if (targetId === 14) sfx.startSanctuaryAmbience();
      else sfx.startStationAmbience();
    }

    if (targetId === 14) {
      activeRuntime = createLevel14Runtime();
    } else {
      activeRuntime = createChapter1Runtime(targetId);
    }

    syncPauseState();
    exposeDiagnostics();
  };

  hud = new HudController({
    onSkipPrologue: () => {
      unlockAudioOnce();
      if (activeLevelId === 0) {
        activeRuntime?.skip?.();
      }
    },
    onToggleGuide: () => {
      unlockAudioOnce();
      if (activeLevelId !== 0) {
        principleGuide.toggle();
      }
    },
    onRequestHint: () => {
      unlockAudioOnce();
      activeRuntime?.requestHint?.();
    },
    onToggleVoice: () => {
      unlockAudioOnce();
      voice.setEnabled(!voice.enabled);
      sfx.setMuted(!voice.enabled);
      hud.setVoiceEnabled(voice.enabled);
    },
    onToggleConsole: () => {
      unlockAudioOnce();
      const expanded = activeLevelId === 14 ? consolePanel.toggle() : topologyMap.toggle();
      hud.setConsoleExpanded(expanded);
    },
    onTogglePause: handleTogglePause,
    onToggleHonestView: () => {
      unlockAudioOnce();
      activeRuntime?.toggleTab?.();
    },
    onReleaseAfterVictory: () => activeRuntime?.releaseAfterVictory?.(),
    onNextLevel: () => {
      unlockAudioOnce();
      if (activeLevelId >= 0 && activeLevelId < 4) {
        loadLevel(activeLevelId + 1);
      } else if (activeLevelId === 4) {
        loadLevel(14);
      }
    },
    onSelectLevel: (id) => {
      unlockAudioOnce();
      loadLevel(id);
    },
    onCh1ModalVisibility: (isOpen) => {
      ch1ModalOpen = isOpen;
      syncPauseState();
    },
    onCloseTeleporterModal: () => {
      teleporterOpen = false;
      syncPauseState();
    },
    onReset: () => {
      unlockAudioOnce();
      activeRuntime?.reset?.();
    },
    onSensitivityChange: ({ mouseScale, wheelScale }) => {
      if (typeof mouseScale === 'number') {
        input.mouseSensitivity = 0.0028 * mouseScale;
      }
      if (typeof wheelScale === 'number') {
        input.wheelSensitivity = wheelScale;
      }
    },
    onToggleD9Fallback: (enabled) => {
      d9FallbackEnabled = enabled;
      if (activeLevelId === 3 && activeRuntime?.state?.setFallbackMode) {
        activeRuntime.state.setFallbackMode(enabled);
        hud.showBlockToast(
          enabled
            ? '已切换至 D9 降级方案：沿荧光箭头飞完三间房即可解锁'
            : '已切换至主方案：利用三间房和乐曲率将陀螺转过 +90°'
        );
      }
    },
  });

  const input = new InputController(canvas, {
    onUserGesture: unlockAudioOnce,
    onTogglePause: handleTogglePause,
    onSkipPrologue: () => {
      if (activeLevelId === 0) activeRuntime?.skip?.();
    },
    onToggleGuide: () => {
      if (activeLevelId !== 0) principleGuide.toggle();
    },
    onToggleHonestView: () => activeRuntime?.toggleTab?.(),
    onToggleConsole: () => {
      const expanded = activeLevelId === 14 ? consolePanel.toggle() : topologyMap.toggle();
      hud.setConsoleExpanded(expanded);
    },
    onRequestHint: () => activeRuntime?.requestHint?.(),
    onReset: () => activeRuntime?.reset?.(),
    onInteract: () => activeRuntime?.interact?.(),
    onPrimaryTap: () => activeRuntime?.primaryTap?.(),
    onZeroGLook: (yawDelta, pitchDelta) => activeRuntime?.zeroGLook?.(yawDelta, pitchDelta),
    onGrabDrag3D: (deltaYaw, deltaPitch) => activeRuntime?.grabDrag3D?.(deltaYaw, deltaPitch),
    onWheel4D: (wheelUnits) => activeRuntime?.wheel4D?.(wheelUnits),
  });

  // -------------------------------------------------------------------------
  // Chapter 1 Runtime Factory (Levels 0, 1, 2, 3, 4 — Zone A)
  // -------------------------------------------------------------------------
  function createChapter1Runtime(levelId) {
    const scene = new B.Scene(engine);
    scene.skipPointerMovePicking = true;

    const camera = new B.FreeCamera(`ch1_cam_${levelId}`, new B.Vector3(0, 1.72, 0), scene);
    camera.minZ = 0.14;
    camera.maxZ = 140;
    camera.fov = 0.92;

    const hints = new TieredHintController(levelId === 0 ? 1 : levelId);
    let lastBeat = 0;
    let victoryAnnounced = false;
    let openingTimer = null;
    let stepAccum = 0;
    let firstWaveCoached = false;
    let firstNeighborCoached = false;
    let riftAwakeAnnounced = false;
    let activeCalloutAnchorKind = null;

    let state = null;
    let scene3D = null;

    if (levelId === 0) {
      input.setMode('prologue');
      input.setLookAngles(0, 0);
      state = new PrologueVoyagerState();
      scene3D = new PrologueScene(scene, camera);
    } else if (levelId === 1) {
      input.setMode('walk');
      input.setGrabbed(false);
      input.setLookAngles(0, 0.02);
      state = new Level1CorridorState();
      scene3D = new Level1CorridorScene(scene, camera);
    } else if (levelId === 2) {
      input.setMode('zero_g');
      input.setGrabbed(false);
      state = new Level2AntipodalState();
      scene3D = new Level2AntipodalScene(scene, camera);
    } else if (levelId === 3) {
      input.setMode('zero_g');
      input.setGrabbed(false);
      state = new Level3HolonomyState({ holonomyFallback: d9FallbackEnabled });
      scene3D = new Level3HolonomyScene(scene, camera);
    } else if (levelId === 4) {
      input.setMode('zero_g');
      input.setGrabbed(false);
      state = new Level4HamiltonianState();
      scene3D = new Level4HamiltonianScene(scene, camera);
    }

    const playOpening = () => {
      if (openingTimer) clearTimeout(openingTimer);
      if (levelId === 0) return;
      const op = hints.getOpeningLine();
      openingTimer = setTimeout(() => {
        if (activeLevelId === levelId) {
          voice.speak(op.speaker, op.text, { durationMs: 6200 });
        }
      }, 360);
    };
    playOpening();

    const announceBeat = () => {
      if (state.beat > lastBeat) {
        lastBeat = state.beat;
        if (state.beat < 3) sfx.playBeatUnlock(state.beat);
      }
      if (state.completed && !victoryAnnounced) {
        victoryAnnounced = true;
        sfx.playVictory();
        hud.flashEdge(PALETTE.accent.emerald);
        if (levelId === 1) {
          voice.speak('linxia', '密码锁解开了！六向圆形舱门正在开启，准备进入下一阶段。', { durationMs: 6000 });
        } else if (levelId === 2) {
          voice.speak('linxia', '答对了！6 个邻居各有一步直通 W−，全部 24 条拓扑连线已点亮。', { durationMs: 6200 });
        } else if (levelId === 3) {
          voice.speak('linxia', '空间本身的曲率替我们把指针转过了 90°！共振锁已解锁。', { durationMs: 6200 });
        } else if (levelId === 4) {
          voice.speak('linxia', '我们冲出八胞体三维外壳了！前方就是真正的四维内部空间！', { durationMs: 6400 });
          teleporterOpen = true;
          hud.configureTeleporterModal({
            badge: '第一章《回廊》通关 · 已冲破三维边界外壳',
            title: '跃入四维内部空间',
            copy:
              '你已完整穿越正八胞体外壳的全部 4 道试炼：<strong>24 米直线闭环同侧自像</strong> → <strong>六邻接与对跖盲区</strong> → <strong>共棱三胞 90° 空间和乐</strong> → <strong>八胞哈密顿回路</strong>。<br /><br />第二幕《折页之间》（第 5–12 关）将在 <strong>Phase 2.2</strong> 陆续展开；你现在也可以直接前往试玩已开放的 <strong>第 14 关 · 发丝裂缝</strong>！',
            jumpLabel: '前往第 14 关 · 发丝裂缝 →',
            onJump: () => loadLevel(14),
          });
          hud.setTeleporterVisible(true);
          syncPauseState();
        }
      }
    };

    const openLevel1LockModal = () => {
      hud.openCh1Modal({
        eyebrow: '第 1 关 · W+ 主控密码锁',
        title: '一直往前走到第 9 个房间时，左窗外铜色雕像面朝哪边？',
        desc: '观察你走过的闭合回廊周期，以及每跨过一扇门时窗外雕像旋转的角度，推导出第 9 间房的左窗铜色雕像朝向：',
        options: LEVEL1_STATUE_DIRECTIONS.map((d) => ({
          value: d.id,
          title: `${d.label}（${d.arrow}）`,
          sub: `对应周期相位 #${d.id + 1}`,
        })),
        onSelect: (dirId) => {
          sfx.playLockClick();
          const res = state.submitLockAnswer(dirId);
          if (res.correct) {
            announceBeat();
            return {
              ok: true,
              feedback: '✓ 校验通过！回廊周期为 4，第 9 间 = 第 1 间（W+），六向气闸门已解锁！',
              closeAfterMs: 900,
            };
          }
          sfx.playBlocked();
          return {
            ok: false,
            feedback: '朝向不匹配。提示：直线走满几间房会回到脚下的红丝带？',
          };
        },
      });
    };

    const openLevel2LockModal = () => {
      hud.openCh1Modal({
        eyebrow: '第 2 关 · 八胞体拓扑校验锁',
        title: '从 W+ 出发，只跨 2 扇门到达正对面 W− 的不同走法共有几条？',
        desc: '林夏的定位器已连接全息台！回想一下：<code>W+</code> 一共有几扇门（几个相邻房间），其中有几个房间能一步直通对跖室 <code>W−</code>？',
        options: [
          { value: 2, title: '2 条路径', sub: '仅沿单轴两侧绕行' },
          { value: 4, title: '4 条路径', sub: '仅沿水平四面绕行' },
          { value: 6, title: '6 条路径', sub: '全部 6 个面邻接邻居皆可中转' },
          { value: 8, title: '8 条路径', sub: '对应 8 个总房间数' },
        ],
        onSelect: (count) => {
          sfx.playLockClick();
          const res = state.submitPathCountAnswer(count);
          if (res.correct) {
            announceBeat();
            return {
              ok: true,
              feedback: '✓ 校验通过！W+ 的 6 个邻居各自都有一扇门直通 W−，共 6 条最短两步路径！',
              closeAfterMs: 950,
            };
          }
          sfx.playBlocked();
          return {
            ok: false,
            feedback: '数量不对。数一数 W+ 的上下左右前后一共有几扇邻居门？',
          };
        },
      });
    };

    const handleTransitSideEffects = (res) => {
      if (!res?.transited) return;
      sfx.playDoorTransit();
      hud.flashEdge(CELL_COLORS[res.to] || PALETTE.accent.cyanW0);

      if (levelId === 2) {
        if (!firstNeighborCoached && res.to !== 'W+' && res.to !== 'W-') {
          firstNeighborCoached = true;
          activeCalloutAnchorKind = 'wMinusDoor';
          hud.showSliceCallout(5800, '发现对跖室 W− 入口');
          voice.speak('linxia', '看！隔壁房间的六扇门里，出现了标着 W− 的门！', { durationMs: 5600 });
        } else if (res.to === 'W-' && !state.hasPickedLocator) {
          activeCalloutAnchorKind = 'locator';
          hud.showSliceCallout(5800, '林夏定位器 · 按 E 拾取');
          voice.speak('linxia', '你飞进对跖室 W− 了！靠近中央的发光定位器按 E 拾取它。', { durationMs: 5600 });
        }
      } else if (levelId === 3) {
        if (res.to === 'W+') {
          if (state.isGyroAlignedForLock()) {
            sfx.playGyroChime(true);
            activeCalloutAnchorKind = 'gyro';
            hud.showSliceCallout(6200, '空间曲率偏转 +90° · 按 E 嵌入');
            voice.speak('linxia', '看你手里的陀螺！它自己转过了 90° 指向上方！靠近底座按 E 嵌入共振锁吧！', { durationMs: 6500 });
          } else if (state.isGyroReversedInWPlus()) {
            sfx.playGyroChime(false);
            activeCalloutAnchorKind = 'gyro';
            hud.showSliceCallout(5800, '偏转 −90° · 反向绕行即可指天');
            voice.speak('linxia', '指针转了负 90°，方向刚好反了！按 W+ → X+ → Y+ → W+ 反方向绕三间房一圈就会指天。', { durationMs: 6600 });
          }
        }
      } else if (levelId === 4 && res.event) {
        if (res.event.type === 'beacon_lit') {
          sfx.playBeaconLight(res.event.litCount);
        } else if (res.event.type === 'antipode_trap') {
          sfx.playBeaconReset();
          hud.showBlockToast('W− 与 W+ 是对跖盲区，无法一步回 W+！请按 R 重置并中途先走 W−');
          voice.speak('linxia', '哎呀，你把对跖室 W− 留到最后一间了！从 W− 没有门能一步回 W+，按 R 重置并在中途先把 W− 走掉吧！', { durationMs: 7400 });
        } else if (res.event.type === 'trail_reset') {
          sfx.playBeaconReset();
          hud.showBlockToast(`重复进入了已访问的 ${res.event.revisited}，信标已柔和重置回起点 W+`);
        } else if (res.event.type === 'cycle_complete' && !riftAwakeAnnounced) {
          riftAwakeAnnounced = true;
          sfx.playVictory();
          hud.flashEdge(PALETTE.accent.platinum);
          activeCalloutAnchorKind = 'riftSphere';
          hud.showSliceCallout(6800, '8/8 回路闭环 · 飞入水银裂隙');
          voice.speak('linxia', '八盏星环全部点亮！中央的水银裂隙镜面球苏醒了——飞进去，冲破三维外壳！', { durationMs: 7000 });
        }
      }
      announceBeat();
    };

    const runtime = {
      levelId,
      scene,
      camera,
      state,
      scene3D,
      hints,
      skip: () => {
        if (levelId === 0) {
          state.skip();
          loadLevel(1);
        }
      },
      toggleTab: () => {
        if (levelId === 0) return;
        state.telescopeActive = !state.telescopeActive;
        sfx.playTabViewSwitch(state.telescopeActive);
      },
      requestHint: () => {
        if (levelId === 0) return;
        const phase = state.getCurrentPuzzlePhase ? state.getCurrentPuzzlePhase() : null;
        const res = phase ? hints.requestContextHint(phase) : hints.requestNextHint();
        const tierNames = ['思路启发', '观察方向', '明确解法'];
        voice.speak(res.speaker, res.text, {
          tierLabel: `${res.tier}级·${tierNames[Math.min(res.tier - 1, 2)]}`,
          durationMs: 8400,
        });
      },
      primaryTap: () => {
        if (levelId !== 1) return;
        state.triggerLeftHandWave();
        sfx.playWaveChime();
        if (!firstWaveCoached) {
          firstWaveCoached = true;
          activeCalloutAnchorKind = 'silhouette';
          hud.showSliceCallout(6200, '同侧同步挥手 · 你的后背');
          voice.speak('linxia', '看见了吗？远处 24 米外的背影也在左侧同步举起了左手——那不是镜子，那是你自己的后背！', { durationMs: 7200 });
        }
        announceBeat();
      },
      zeroGLook: (yawDelta, pitchDelta) => {
        if (state.nav) {
          state.nav.rotateLook(yawDelta, pitchDelta, 0);
        }
      },
      interact: () => {
        if (levelId === 1) {
          if (state.completed) {
            hud.dismissVictoryBanner();
            return;
          }
          const near = state.getNearestInteractable();
          if (!near) {
            hud.showBlockToast('走近 W+ 舱室内的录音台、猜想仪或右侧密码锁再按 E');
            return;
          }
          sfx.playLockClick();
          if (near.id === 'recorder') {
            state.listenedRecorder = true;
            voice.speak('linxia', '别追前面那个人了。我追了她整整半个小时……每走过四间，脚下的红丝带就会重新出现。', { durationMs: 7200 });
          } else if (near.id === 'lock') {
            openLevel1LockModal();
          } else if (L1_HYPOTHESIS_NOTES[near.id]) {
            state.viewedHypotheses.add(near.id);
            const note = L1_HYPOTHESIS_NOTES[near.id];
            hud.openCh1Modal({
              eyebrow: '林夏的全息猜想笔记（可选探索）',
              title: note.title,
              desc: note.desc,
              options: [{ value: 'ok', title: '收起笔记继续探索', sub: '按 Esc 也可关闭' }],
              onSelect: () => ({ closeNow: true }),
            });
          }
        } else if (levelId === 2) {
          if (state.completed) {
            hud.dismissVictoryBanner();
            return;
          }
          if (state.canPickupLocator()) {
            state.pickupLocator();
            sfx.playBeatUnlock(2);
            hud.hideSliceCallout();
            hud.flashEdge(PALETTE.accent.goldWPos);
            voice.speak('linxia', '拿到定位器了！快在拓扑校验锁上回答两步走法总数吧！', { durationMs: 5600 });
            announceBeat();
            setTimeout(() => {
              if (activeLevelId === 2 && !state.completed) openLevel2LockModal();
            }, 420);
          } else if (state.canOpenTopologyLock()) {
            openLevel2LockModal();
          } else {
            hud.showBlockToast('飞进任意邻居房间，再跨第 2 扇门进入 W− 拾取定位器');
          }
        } else if (levelId === 3) {
          if (state.completed) {
            hud.dismissVictoryBanner();
            return;
          }
          if (!state.canInteractLock()) {
            hud.showBlockToast('回到 W+ 舱室并靠近共振锁底座按 E 嵌入陀螺');
            return;
          }
          const res = state.tryEmbedGyroInLock();
          if (res.unlocked) {
            hud.hideSliceCallout();
            announceBeat();
          } else if (res.reason === 'reversed_90') {
            sfx.playBlocked();
            hud.showBlockToast('陀螺指向 −90°（朝下），需反向绕 W+ → X+ → Y+ → W+ 校准至 +90°！');
          } else {
            sfx.playBlocked();
            hud.showBlockToast('指针尚未对准上方 +90°：携陀螺绕共棱三房 W+ → X+ → Y+ → W+ 飞一圈！');
          }
        } else if (levelId === 4) {
          if (state.completed) {
            hud.dismissVictoryBanner();
            return;
          }
          if (state.riftSphereAwakened && state.cellId === 'W+') {
            state.enterRiftSphere();
            hud.hideSliceCallout();
            announceBeat();
          } else {
            hud.showBlockToast(`当前已点亮 ${state.litBeaconCount}/8 盏星环信标，全部点亮并回到 W+ 即可激活裂隙球`);
          }
        }
      },
      releaseAfterVictory: () => hud.dismissVictoryBanner(),
      reset: () => {
        state.reset();
        hints.setLevel(levelId === 0 ? 1 : levelId);
        lastBeat = 0;
        victoryAnnounced = false;
        firstWaveCoached = false;
        firstNeighborCoached = false;
        riftAwakeAnnounced = false;
        activeCalloutAnchorKind = null;
        teleporterOpen = false;
        hud.resetBanner();
        hud.closeCh1Modal(true);
        if (levelId === 1) input.setLookAngles(0, 0.02);
        syncPauseState();
        playOpening();
      },
      stepFrame: (dtSec, shouldRender = true) => {
        if (!paused && !guideOpen && !ch1ModalOpen && !teleporterOpen) {
          const curPhase = state.getCurrentPuzzlePhase ? state.getCurrentPuzzlePhase() : null;
          if (levelId === 0) {
            const p = state.update(dtSec);
            if (p.triggerVoice) {
              voice.speak('linxia', '08 号，外面的空间曲率不对劲，我先出舱看看……别跟丢了。', { durationMs: 6500 });
            }
            if (p.justCompleted) {
              loadLevel(1);
              return;
            }
          } else if (levelId === 1) {
            state.stepWave(dtSec);
            const mv = input.sampleMoveVector(dtSec);
            if (mv.forward !== 0 || mv.right !== 0) {
              const speed = mv.sprint ? 7.6 : 4.8;
              const sinY = Math.sin(input.yaw);
              const cosY = Math.cos(input.yaw);
              const rawDx = mv.forward * sinY + mv.right * cosY;
              const rawDz = mv.forward * cosY - mv.right * sinY;
              const len = Math.hypot(rawDx, rawDz) || 1;
              const res = state.moveXZ((rawDx / len) * speed * dtSec, (rawDz / len) * speed * dtSec);
              stepAccum += speed * dtSec;
              if (stepAccum >= 2.15) {
                stepAccum = 0;
                sfx.playFootstep();
              }
              if (res.roomChanged) {
                sfx.playDoorTransit();
              }
              if (res.justLooped) {
                sfx.playBeatUnlock(2);
                activeCalloutAnchorKind = 'leftStatue';
                hud.showSliceCallout(5800, '每跨 1 室刚性转 90° · 4 室回原点');
                voice.speak('linxia', '脚下的红丝带又出现了！笔直走满四间房就会绕回起点 W+！', { durationMs: 6200 });
              }
              if (res.enteredPortal) {
                sfx.playVictory();
                loadLevel(2);
                return;
              }
              announceBeat();
            }
            hints.update(dtSec, state.beat, state.completed, curPhase);
          } else if (levelId >= 2 && levelId <= 4) {
            const mv = input.sampleMoveVector(dtSec);
            if (mv.roll !== 0) {
              state.nav.rotateLook(0, 0, mv.roll * 1.65 * dtSec);
            }
            const speed = mv.sprint ? 4.8 : 3.15;
            const res = state.stepMove(mv.forward, mv.right, mv.up, dtSec, speed);
            if (res.transited) {
              handleTransitSideEffects(res);
            }
            if (levelId === 4 && res.enteredRift) {
              announceBeat();
            }
            hints.update(dtSec, state.beat, state.completed, curPhase);
          }
        }

        // Update 3D scene & render
        if (levelId === 0 || levelId === 1) {
          scene3D.syncFromState(state, input, dtSec);
        } else {
          scene3D.syncFromState(state, dtSec);
        }

        const worldCalloutAnchor =
          activeCalloutAnchorKind && scene3D.getAnchorScreenPos
            ? scene3D.getAnchorScreenPos(activeCalloutAnchorKind, camera)
            : null;

        // Render F-key 8-Cell Holographic Topology Map & Sync HUD
        if (levelId === 0) {
          const t = state.elapsedSec;
          const cap =
            t < 3.5
              ? '深空勘测船「远航者号」跃迁曲率失控，警报响彻驾驶舱……'
              : t < 8.5
                ? '舷窗外的星辰正在一颗接一颗熄灭，群星被纯白吞噬。'
                : t < 14.5
                  ? '07 号林夏：「08 号，外面的空间曲率不对劲，我先出舱看看……别跟丢了。」'
                  : '无边无际的纯白几何空间正在凝实——正在淡入「回廊」W+ 起始舱室……';
          hud.syncChapter1({ levelId: 0, prologueCaption: cap });
        } else if (levelId === 1) {
          const currCell = state.getCellId();
          const near = state.getNearestInteractable();
          topologyMap.render(
            {
              levelId: 1,
              currentCell: currCell,
              visitedSet: new Set(['W+', 'X+', 'W-', 'X-'].slice(0, state.visitedRoomIndices.size)),
              trail: ['W+', 'X+', 'W-', 'X-', 'W+'],
              subLabel: `直线闭合回廊 · 当前 ${currCell}`,
            },
            dtSec
          );
          hud.syncChapter1({
            levelId: 1,
            badgeTitle: `正八胞体三维边界 · 舱室 ${currCell}`,
            badgeDetail: state.completed
              ? '前方翡翠气闸传送门已敞开 · 穿门直达第 2 关'
              : '观察前方 24m 宇航员背影与左右窗外雕像朝向',
            dotColor: state.completed ? PALETTE.accent.emerald : CELL_COLORS[currCell],
            telemetryA: `CELL ${currCell} · 累计直线前行 ${state.unwrappedZ.toFixed(1)}m`,
            telemetryB: `已观测区段 ${state.visitedRoomIndices.size}/4 · ${state.hasWaved ? '已验证同侧自像' : '按 G/左键 挥左手试探'}`,
            telemetryAccent: state.completed ? PALETTE.accent.emerald : '',
            beat: state.beat,
            hintSnapshot: hints.getSnapshot(),
            telescopeActive: state.telescopeActive,
            reticlePrompt: near ? near.label : '',
            worldCalloutAnchor,
            controlHtml:
              'WASD 行走 · 拖拽环视 · <strong>左键/G 挥左手</strong> · <strong>E</strong> 交互 · <strong>Tab</strong> 望远镜 · <strong>F</strong> 拓扑图 · <strong>H</strong> 提示 · <strong>I</strong> 原理',
            completed: state.completed,
            victory: {
              badge: '第 1 关通关 · 直线闭环规律已掌握',
              copy: '四间房构成周长 24 米的闭合大圆环路（周期为 4），第 9 间与第 1 间完全一致。前方<strong>翡翠气闸传送门</strong>已为你敞开，直接走进去即可进入第 2 关！',
              nextLabel: '进入第 2 关 · 没有门通向对面 →',
            },
          });
        } else if (levelId === 2) {
          const currCell = state.cellId;
          const slots = getEgocentricCompass(currCell, state.nav.frame).map((s) => ({
            ...s,
            status: s.cellId === 'W-' ? 'target' : '',
            prefix: s.cellId === 'W-' ? '◎ ' : '',
          }));
          topologyMap.render(
            {
              levelId: 2,
              currentCell: currCell,
              visitedSet: state.visitedCells,
              targetCell: state.hasPickedLocator ? null : 'W-',
              highlightAll24Edges: state.completed,
              subLabel: state.hasPickedLocator ? '定位器已取得 · 校验 24 面' : '定位信号源: W−',
            },
            dtSec
          );
          const prompt = state.canPickupLocator()
            ? '[E] 拾取林夏定位器'
            : state.canOpenTopologyLock()
              ? '[E] 打开拓扑校验锁'
              : '';
          hud.syncChapter1({
            levelId: 2,
            badgeTitle: `失重六向气闸舱 · 舱室 ${currCell}`,
            badgeDetail: state.completed
              ? '全部 24 条房间邻接连线已点亮'
              : state.hasPickedLocator
                ? '按 E 回答“两步到达 W− 的走法总数”'
                : currCell === 'W-'
                  ? '已抵达对跖室 W− · 靠近中央拾取林夏定位器'
                  : '在六扇圆形气闸舱中寻找 W− 定位信号',
            dotColor: state.completed ? PALETTE.accent.emerald : CELL_COLORS[currCell],
            telemetryA: `CELL ${currCell} · 过门次数 ${state.nav.transitCount} · 已探索 ${state.visitedCells.size}/8 室`,
            telemetryB: `对跖盲区 ${ANTIPODAL_CELL[currCell]} · 定位器: ${state.hasPickedLocator ? '已拾取' : '位于 W−'}`,
            telemetryAccent: state.completed || state.hasPickedLocator ? PALETTE.accent.emerald : '',
            beat: state.beat,
            hintSnapshot: hints.getSnapshot(),
            telescopeActive: state.telescopeActive,
            reticlePrompt: prompt,
            worldCalloutAnchor,
            compass: {
              title: '六向失重罗盘',
              antipodeText: `◎ 对跖盲区: ${ANTIPODAL_CELL[currCell]}`,
              slots,
            },
            controlHtml:
              'WASD 推进 · <strong>Space/Ctrl</strong> 升降 · <strong>Q/长按E</strong> 滚转 · <strong>短按E</strong> 交互 · <strong>F</strong> 拓扑图 · <strong>H</strong> 提示 · <strong>I</strong> 原理',
            completed: state.completed,
            victory: {
              badge: '第 2 关通关 · 24 条面邻接已点亮',
              copy: '每个三维立方体房间最多开 6 扇门，因此总有 1 个对跖盲区无法一步直达；但借道任意 6 个邻居都只需 2 步抵达！',
              nextLabel: '进入第 3 关 · 哪边是上 →',
            },
          });
        } else if (levelId === 3) {
          const currCell = state.cellId;
          const angleDeg = state.getGyroAngleInWPlusDeg();
          const aligned = state.isGyroAlignedForLock();
          const slots = getEgocentricCompass(currCell, state.nav.frame).map((s) => ({
            ...s,
            status: ['W+', 'X+', 'Y+'].includes(s.cellId) ? 'unvisited' : '',
          }));
          topologyMap.render(
            {
              levelId: 3,
              currentCell: currCell,
              visitedSet: new Set(state.loopTrail),
              highlightHolonomyTriangle: true,
              subLabel: state.holonomyFallback ? 'D9 荧光箭头引导模式' : '共棱三胞角亏 90°',
            },
            dtSec
          );
          const prompt = state.canInteractLock()
            ? aligned
              ? '[E] 嵌入已校准陀螺 (+90°)'
              : '[E] 检查 W+ 共振锁（目标 +90° 指天）'
            : '';
          hud.syncChapter1({
            levelId: 3,
            badgeTitle: `陀螺棱角舱 · 舱室 ${currCell}${state.holonomyFallback ? '（D9 箭头模式）' : ''}`,
            badgeDetail: state.completed
              ? '陀螺已嵌入共振锁 · 共振光束贯通金棱'
              : aligned
                ? '陀螺指针已转过 +90° 指天！靠近 W+ 底座按 E 嵌入'
                : '观察头顶发光金棱与手持锁死陀螺在跨室后的朝向变化',
            dotColor: aligned || state.completed ? PALETTE.accent.emerald : PALETTE.accent.goldWPos,
            telemetryA: `CELL ${currCell} · 路径: ${state.loopTrail.slice(-4).join(' → ')}`,
            telemetryB:
              currCell === 'W+'
                ? `陀螺相对 W+ 偏角: ${angleDeg >= 0 ? '+' : ''}${angleDeg}° / 目标 +90°`
                : '携锁死陀螺飞行中 · 返回 W+ 比对偏角',
            telemetryAccent: aligned || state.completed ? PALETTE.accent.emerald : '',
            beat: state.beat,
            hintSnapshot: hints.getSnapshot(),
            telescopeActive: state.telescopeActive,
            reticlePrompt: prompt,
            worldCalloutAnchor,
            compass: {
              title: '共棱三胞导航',
              antipodeText: `◎ 对跖盲区: ${ANTIPODAL_CELL[currCell]}`,
              slots,
            },
            controlHtml:
              'WASD 推进 · <strong>Space/Ctrl</strong> 升降 · <strong>Q/长按E</strong> 滚转 · <strong>短按E</strong> 嵌入锁槽 · <strong>H</strong> 提示 · <strong>I</strong> 原理',
            completed: state.completed,
            victory: {
              badge: '第 3 关通关 · 四维边界 90° 空间和乐',
              copy: '正八胞体每条棱只相交 3 个立方体房间（3 × 90° = 270°，角亏 90°）。绕共棱三房飞一圈，空间曲率本身就让锁死的陀螺精确偏转了 90°！',
              nextLabel: '进入第 4 关 · 一笔走完 →',
            },
          });
        } else if (levelId === 4) {
          const currCell = state.cellId;
          const slots = getEgocentricCompass(currCell, state.nav.frame).map((s) => {
            const st = state.getDoorwayStatus(s.cellId);
            return {
              ...s,
              status: st,
              prefix: st === 'finish' ? '◈ ' : st === 'unvisited' ? '★ ' : st === 'visited' ? '✗ ' : '',
            };
          });
          topologyMap.render(
            {
              levelId: 4,
              currentCell: currCell,
              visitedSet: state.visited,
              trail: state.trail,
              subLabel: `星环信标 ${state.litBeaconCount}/8 · 勿留 W− 到最后`,
            },
            dtSec
          );
          const prompt =
            state.riftSphereAwakened && currCell === 'W+' && !state.completed
              ? '[E] 或直接飞入中央水银裂隙球'
              : '';
          hud.syncChapter1({
            levelId: 4,
            badgeTitle: `八胞星环终端 · 舱室 ${currCell}`,
            badgeDetail: state.completed
              ? '已冲破八胞体外壳 · 跃入四维内部空间'
              : state.riftSphereAwakened
                ? '8/8 哈密顿回路完成！飞入 W+ 中央发光水银裂隙球！'
                : state.isAntipodeTrapState()
                  ? '提示：W− 无法一步回到 W+，请按 R 重置并中途先走 W−'
                  : `不重复走遍 8 间房并回到 W+（当前 ${state.litBeaconCount}/8 盏信标点亮）`,
            dotColor: state.riftSphereAwakened ? PALETTE.accent.platinum : PALETTE.accent.goldWPos,
            telemetryA: `CELL ${currCell} · 星环信标 ${state.litBeaconCount}/8`,
            telemetryB: `一笔画轨迹: ${state.trail.join(' → ')}`,
            telemetryAccent: state.riftSphereAwakened ? PALETTE.accent.emerald : '',
            beat: state.beat,
            hintSnapshot: hints.getSnapshot(),
            telescopeActive: state.telescopeActive,
            reticlePrompt: prompt,
            worldCalloutAnchor,
            compass: {
              title: `哈密顿罗盘 (${state.litBeaconCount}/8)`,
              antipodeText: `◎ 对跖盲区: ${ANTIPODAL_CELL[currCell]}`,
              slots,
            },
            controlHtml:
              'WASD 推进 · <strong>Space/Ctrl</strong> 升降 · <strong>★ 未访问 / ✗ 已访问 / ◈ 闭环回 W+</strong> · <strong>R</strong> 重置 · <strong>H</strong> 提示 · <strong>I</strong> 原理',
            completed: state.completed,
            hideVictoryBanner: teleporterOpen,
          });
        }

        if (shouldRender) {
          scene.render();
        }
      },
      actions: {
        skip: () => runtime.skip(),
        wave: () => runtime.primaryTap(),
        interact: () => runtime.interact(),
        toggleTab: () => runtime.toggleTab(),
        requestHint: () => runtime.requestHint(),
        reset: () => runtime.reset(),
        showGuide: () => principleGuide.show(),
        dismissGuide: () => principleGuide.hide(),
        forceTransitTo: (cellId) => {
          if (state.forceTransitTo) {
            const res = state.forceTransitTo(cellId);
            handleTransitSideEffects(res);
            return res;
          }
          return null;
        },
        openLock: () => {
          if (levelId === 1) openLevel1LockModal();
          if (levelId === 2) openLevel2LockModal();
        },
        loadLevel,
      },
      dispose: () => {
        if (openingTimer) clearTimeout(openingTimer);
        scene3D?.dispose?.();
        scene.dispose();
      },
    };

    return runtime;
  }

  // -------------------------------------------------------------------------
  // Level 14 Runtime Factory (Phase 1 Vertical Slice — Zone C Sanctuary)
  // -------------------------------------------------------------------------
  function createLevel14Runtime() {
    const scene = new B.Scene(engine);
    scene.skipPointerMovePicking = true;

    const camera = new B.FreeCamera('sanctuary_cam', new B.Vector3(2.6, 1.85, -10.8), scene);
    camera.minZ = 0.20;
    camera.maxZ = 160;
    camera.fov = 0.92;

    input.setMode('walk');
    input.setGrabbed(false);
    input.setLookAngles(-0.22, 0.04);

    const state = new Level14HairlineSlitState();
    const hints = new TieredHintController(14);
    const sanctuary3D = new Level14SanctuaryScene(scene, camera);

    let lastBeat = 0;
    let victoryAnnounced = false;
    let autoReleaseTimer = null;
    let openingTimer = null;
    let northStuckTimer = 0;
    let northPushAttempts = 0;

    const coached = {
      firstGrabWheel: false,
      wScrollAllW: false,
      wScrollSphereSlices: false,
      drag3DInvariant: false,
      slightTiltDisc: false,
      tiltedBlocked: false,
      wallEvidenceNamed: false,
      northArrived: false,
      northRestoreNudge: false,
    };
    const resetCoaching = () => {
      for (const k of Object.keys(coached)) coached[k] = false;
      northStuckTimer = 0;
      northPushAttempts = 0;
    };

    const releaseGrabCleanly = ({ keepVictoryBanner = false } = {}) => {
      if (autoReleaseTimer) {
        clearTimeout(autoReleaseTimer);
        autoReleaseTimer = null;
      }
      if (!state.grabbed) return;
      const releasingAtNorthUnrestored = !state.completed && state.isOnNorthPedestal();
      state.setGrabbed(false);
      input.setGrabbed(false);
      hud.hideWheelHandoffCue();
      hud.hideSliceCallout();
      hud.setTabAttention(false);
      input.setLookAngles(0, 0.03);
      sfx.playGrabLock(false);
      if (state.completed && !keepVictoryBanner) {
        hud.dismissVictoryBanner();
      } else if (releasingAtNorthUnrestored && !coached.northRestoreNudge) {
        coached.northRestoreNudge = true;
        voice.speak('tomb', '还记得它刚才是怎么立起来的吗？', { durationMs: 5600 });
      }
    };

    const announceBeatAdvance = () => {
      if (state.beat > lastBeat) {
        lastBeat = state.beat;
        if (state.beat < 3) sfx.playBeatUnlock(state.beat);
      }
      if (state.completed && !victoryAnnounced) {
        victoryAnnounced = true;
        sanctuary3D.setHintHighlight(false);
        hud.hideSliceCallout();
        hud.hideWheelHandoffCue();
        hud.setTabAttention(false);
        sfx.playVictory();
        voice.speak(
          'tomb',
          '钥匙归位，巨墙打开了。穿过前方通道，踏上传送台前往下一关。',
          { durationMs: 7400 }
        );
        if (autoReleaseTimer) clearTimeout(autoReleaseTimer);
        autoReleaseTimer = setTimeout(() => {
          autoReleaseTimer = null;
          if (state.completed && state.grabbed) {
            releaseGrabCleanly({ keepVictoryBanner: true });
          }
        }, 1150);
      }
    };

    sanctuary3D.triggerOpeningPedestalSpotlight();
    const opening = hints.getOpeningLine();
    openingTimer = setTimeout(() => {
      if (activeLevelId === 14) {
        voice.speak(opening.speaker, opening.text, { durationMs: 5200 });
      }
    }, 350);

    const runtime = {
      levelId: 14,
      scene,
      camera,
      state,
      sanctuary3D,
      hints,
      requestHint: () => {
        const phase = state.getCurrentPuzzlePhase();
        const res = hints.requestContextHint(phase, {
          sideViewOpen: state.viewMode === 'side_xzw',
        });
        const tierNames = ['思路启发', '操作方向', '完整解法'];
        voice.speak(res.speaker, res.text, {
          tierLabel: `${res.tier}级·${tierNames[Math.min(res.tier - 1, 2)]}`,
          durationMs: 8200,
        });
        if (res.shouldHighlightTarget) sanctuary3D.setHintHighlight(true);
      },
      toggleTab: () => {
        const mode = state.toggleViewMode();
        sfx.playTabViewSwitch(mode === 'side_xzw');
        hud.setTabAttention(false);
        hud.hideSliceCallout();
        if (
          mode === 'side_xzw' &&
          state.grabbed &&
          state.hasBumpedWhileTilted &&
          !state.isBladeThinEnough() &&
          !coached.wallEvidenceNamed
        ) {
          state.startCollisionInspect();
        }
        announceBeatAdvance();
      },
      interact: () => {
        if (state.grabbed) {
          releaseGrabCleanly({ keepVictoryBanner: false });
          return;
        }
        if (state.completed) {
          hud.dismissVictoryBanner();
          return;
        }
        const res = state.setGrabbed(true);
        if (res.grabbed) {
          input.setGrabbed(true);
          sfx.playGrabLock(true);
          hud.showWheelHandoffCue(4800);
          if (!coached.firstGrabWheel) {
            coached.firstGrabWheel = true;
            voice.speak('tomb', '现在，滚轮转动的是你手里的球。', { durationMs: 5000 });
          }
          announceBeatAdvance();
        } else {
          hud.showBlockToast('再走近圆球一些，按 E 抓住它');
        }
      },
      grabDrag3D: (deltaYaw, deltaPitch) => {
        if (state.viewMode === 'side_xzw') return;
        state.rotateOrb3D(deltaYaw, deltaPitch);
        if (!coached.drag3DInvariant && state.hasRotated3DWhileGrabbed && !state.hasRotated4DWhileGrabbed) {
          coached.drag3DInvariant = true;
          voice.speak('tomb', '这样转动，球的宽度一点也没变。试试拨动鼠标滚轮。', { durationMs: 5600 });
        }
      },
      wheel4D: (wheelUnits) => {
        if (state.grabbed) {
          const deltaDeg = wheelUnits * 5.0;
          const wasBlade = state.isBladeThinEnough();
          const res = state.rotateOrb4D(deltaDeg);
          hud.hideWheelHandoffCue();

          if (res.blocked) {
            sfx.playBlocked();
            sanctuary3D.triggerBarrierFlash();
            grabStage.triggerBlockFlash();
            hud.flashEdge(PALETTE.accent.amberCoral);
            hud.showBlockToast(state.lastBlockEvent?.message || '狭缝内空间不足，请先将球推到对面底座');
          } else if (res.applied) {
            const isBladeNow = res.isBlade;
            sfx.playRotate4D(res.thetaDeg, !wasBlade && isBladeNow);

            const distFrom0 = angularDistanceMod180Deg(res.thetaDeg, 0);
            if (!coached.slightTiltDisc && !isBladeNow && distFrom0 >= 4 && distFrom0 < 85) {
              coached.slightTiltDisc = true;
              hud.showSliceCallout(5800);
              voice.speak(
                'tomb',
                '你把球的一部分转出了我们这一层。青色的，是还留在这里的那一片。',
                { durationMs: 6800 }
              );
            }
            if (distFrom0 < 3) hud.hideSliceCallout();
            if (!wasBlade && isBladeNow) {
              hud.flashEdge(PALETTE.accent.emerald);
              hud.hideSliceCallout();
              hud.setTabAttention(false);
            }
            announceBeatAdvance();
          }
        } else {
          const res = state.shiftPlayerW(wheelUnits * 0.28);
          sfx.playWShift(res.w);
          const wColor =
            res.w > 0.6
              ? PALETTE.accent.goldWPos
              : res.w < -0.6
                ? PALETTE.accent.blueWNeg
                : PALETTE.accent.cyanW0;
          hud.flashEdge(wColor);

          const orbRotatedIntoW = Math.abs(Math.sin(state.thetaRad)) > 0.08;
          const orbSliceNow = state.getSliceAtPlayerW();
          if (
            !coached.wScrollSphereSlices &&
            orbRotatedIntoW &&
            Math.abs(res.w) >= 0.08 &&
            (orbSliceNow.intersects || Math.abs(res.w) <= state.getExtents().wMax + 0.35)
          ) {
            coached.wScrollSphereSlices = true;
            voice.speak(
              'tomb',
              '现在你看到的是在第四维度不同位置的球切面，所有切面拼接起来就是球的整体三维结构。换句话说，球被切成了不同的圆被分散放在了w轴上。',
              { tierLabel: '维度洞察', durationMs: 10200 }
            );
          } else if (!coached.wScrollAllW && !orbRotatedIntoW && Math.abs(res.w) >= 0.85 && !state.completed) {
            coached.wScrollAllW = true;
            voice.speak('tomb', '换到这一层，两旁的折页变了——但前方的墙依然在原位。', { durationMs: 5800 });
          }
          announceBeatAdvance();
        }
      },
      releaseAfterVictory: () => releaseGrabCleanly({ keepVictoryBanner: false }),
      reset: () => {
        if (autoReleaseTimer) {
          clearTimeout(autoReleaseTimer);
          autoReleaseTimer = null;
        }
        state.reset();
        hints.setLevel(14);
        resetCoaching();
        teleporterOpen = false;
        hud.resetBanner();
        input.setGrabbed(false);
        input.setLookAngles(-0.22, 0.04);
        sanctuary3D.setHintHighlight(false);
        sanctuary3D.triggerOpeningPedestalSpotlight();
        lastBeat = 0;
        victoryAnnounced = false;
        syncPauseState();
        const op = hints.getOpeningLine();
        voice.speak(op.speaker, op.text, { durationMs: 5200 });
      },
      stepFrame: (dtSec) => {
        if (!paused && !guideOpen && !teleporterOpen) {
          const inspectStatus = state.stepInspectW(dtSec);
          if (inspectStatus.arrivedAtEvidence && !coached.wallEvidenceNamed) {
            coached.wallEvidenceNamed = true;
            voice.speak('tomb', '原来，换到这一层，墙还在。它沿第四维也一直延伸。', { durationMs: 6800 });
          }

          if (state.grabbed && !state.completed && state.isOnNorthPedestal()) {
            northStuckTimer += dtSec;
            if (northStuckTimer >= 12.0 && !coached.northRestoreNudge) {
              coached.northRestoreNudge = true;
              voice.speak('tomb', '还记得它刚才是怎么立起来的吗？', { durationMs: 5800 });
            }
          } else {
            northStuckTimer = 0;
          }

          const move = input.sampleMoveVector(dtSec);
          if (state.grabbed) {
            if (move.forward !== 0) {
              const speed = move.sprint ? 3.4 : 2.15;
              const res = state.pushOrbZ(move.forward * speed * dtSec);
              if (res.blocked) {
                sfx.playBlocked();
                grabStage.triggerBlockFlash();
                const distFrom0 = angularDistanceMod180Deg(state.thetaDeg, 0);
                if (distFrom0 >= 4 && distFrom0 < 85) {
                  const xContact = Math.max(0.24, state.getExtents().xMax * 0.68);
                  sanctuary3D.triggerTiltedBump(xContact);
                  hud.hideSliceCallout();
                  if (state.viewMode !== 'side_xzw') hud.setTabAttention(true);
                  if (!coached.tiltedBlocked) {
                    coached.tiltedBlocked = true;
                    voice.speak(
                      'tomb',
                      state.viewMode === 'side_xzw'
                        ? '看看刚才碰到墙的是哪一部分。'
                        : '眼前这片够薄了。刚才是哪里碰到了墙？',
                      { durationMs: 6400 }
                    );
                  }
                } else {
                  sanctuary3D.triggerBarrierFlash();
                  hud.flashEdge(PALETTE.accent.amberCoral);
                }
                hud.showBlockToast(state.lastBlockEvent?.message || '被墙挡住了');
              } else if (res.onNorthPedestal && !state.completed) {
                if (!coached.northArrived) {
                  coached.northArrived = true;
                  voice.speak('tomb', '球送到了。看看底座的形状。', { durationMs: 5800 });
                } else if (Math.abs(state.orbZ - state.config.orbMaxZ) < 0.05 && move.forward > 0) {
                  northPushAttempts += dtSec;
                  if (northPushAttempts > 1.2 && !coached.northRestoreNudge) {
                    coached.northRestoreNudge = true;
                    voice.speak('tomb', '还记得它刚才是怎么立起来的吗？', { durationMs: 5800 });
                  }
                }
              }
              announceBeatAdvance();
            }
          } else if (move.forward !== 0 || move.right !== 0) {
            if (state.completed) hud.dismissVictoryBanner();
            const speed = move.sprint ? 8.5 : 5.2;
            const sinY = Math.sin(input.yaw);
            const cosY = Math.cos(input.yaw);
            const rawDx = move.forward * sinY + move.right * cosY;
            const rawDz = move.forward * cosY - move.right * sinY;
            const len = Math.hypot(rawDx, rawDz) || 1;
            const res = state.movePlayerXZ((rawDx / len) * speed * dtSec, (rawDz / len) * speed * dtSec);
            if (res.blockedByWall) {
              sfx.playBlocked();
              sanctuary3D.triggerBarrierFlash();
              hud.flashEdge(PALETTE.accent.amberCoral);
              hud.showBlockToast(state.lastBlockEvent?.message || '缝隙太窄，人穿不过去');
              announceBeatAdvance();
            }
            if (res.justEnteredTeleporter) {
              sfx.playVictory();
              hud.flashEdge(PALETTE.accent.emerald);
              voice.speak('tomb', '传送台已启动，准备前往下一关。', { durationMs: 5600 });
              teleporterOpen = true;
              hud.configureTeleporterModal({
                badge: '已抵达传送台 · 第 14 关完成',
                title: '传送坐标锁定：第 15 关 · 圆环桥',
                copy:
                  '圆球从未被压扁——只是把伸出缝外的两端沿 <strong>第四维度 w</strong> 旋转收进亮缝，抵达对面底座后再重新放平。<br /><br />你也可以返回第一章《回廊》体验第 1–4 关八胞体边界试炼！',
                jumpLabel: '返回第 1 关 · 前方的人 →',
                onJump: () => loadLevel(1),
              });
              hud.setTeleporterVisible(true);
              syncPauseState();
            }
          }

          hints.update(dtSec, state.beat, state.completed, state.getCurrentPuzzlePhase());
        }

        sanctuary3D.syncFromState(state, dtSec);
        grabStage.updateCamera(camera, state, input, dtSec);
        grabStage.renderSideView(state);
        consolePanel.render(state);
        const orbAnchor = sanctuary3D.getOrbScreenAnchor(camera);
        hud.sync(state, hints.getSnapshot(), orbAnchor);
        scene.render();
      },
      actions: {
        grab: () => {
          const r = state.setGrabbed(true);
          if (r.grabbed) {
            input.setGrabbed(true);
            hud.showWheelHandoffCue(4800);
            if (!coached.firstGrabWheel) {
              coached.firstGrabWheel = true;
              voice.speak('tomb', '现在，滚轮转动的是你手里的球。', { durationMs: 5000 });
            }
          }
          return r;
        },
        release: () => releaseGrabCleanly({ keepVictoryBanner: false }),
        toggleTab: () => runtime.toggleTab(),
        requestHint: () => runtime.requestHint(),
        reset: () => runtime.reset(),
        dismissGuide: () => principleGuide.hide(),
        showGuide: () => principleGuide.show(),
        loadLevel,
      },
      dispose: () => {
        if (autoReleaseTimer) clearTimeout(autoReleaseTimer);
        if (openingTimer) clearTimeout(openingTimer);
        scene.dispose();
      },
    };

    return runtime;
  }

  function exposeDiagnostics() {
    globalThis.__BEYOND3D__ = {
      engine,
      levelId: activeLevelId,
      state: activeRuntime?.state,
      hints: activeRuntime?.hints,
      input,
      scene: activeRuntime?.scene,
      sanctuary3D: activeRuntime?.sanctuary3D,
      scene3D: activeRuntime?.scene3D,
      principleGuide,
      grabStage,
      topologyMap,
      hud,
      voice,
      stepFrame: (dtSec = 1 / 24, shouldRender = true) => activeRuntime?.stepFrame(dtSec, shouldRender),
      loadLevel,
      actions: activeRuntime?.actions || {},
    };
  }

  // Boot initial level cleanly
  loadLevel(activeLevelId);

  // Main 60 FPS Render & Simulation Loop
  let lastTime = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    activeRuntime?.stepFrame(dtSec);
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });
}

boot();
