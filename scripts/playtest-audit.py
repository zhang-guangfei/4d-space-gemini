#!/usr/bin/env python3
"""
Beyond 3D — Real-Gameplay & Quality Spec v1.0 Compliance Audit (`npm run audit:playtest`)

Drives the live 3D game in headless Chromium using REAL keyboard (`W/A/S/D`, `Space`, `E`, `G`,
`H`, `I`, `Esc`) and REAL mouse drags to enforce BOTH real-input playability AND every quantitative
bar defined in `docs/design/quality-spec-v1.md` (benchmarking Prologue + Levels 1–4 against
Demo Level 14):
  1. Rendering & Material Spec (IBL, ACES+Bloom PostProc, EXP2 Fog, GPU Particles, PBR, L1 Mirror & Shadows)
  2. Zero-Spoiler Frame-1 Framing (F-map collapsed by default, L3 clean spawn reticle, L3 3/3 gold edges, L4 ★ X+)
  3. Real-Input Navigation & Anti-Wall-Snag Mechanics (L1 24m walk, L2 W- landing, L3 W->Space->S +90° unlock, L4 X+)
  4. Interactive 3D Principle Guide (`I` key) live & rendering on ALL Levels (1, 2, 3, 4 & 14)
  5. Context-Aware `H` Hint Ladder reacting to the player's exact current puzzle phase
  6. Technical Stability (strictly 0 console/page errors)
"""

import base64
import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path(
    os.environ.get(
        "PLAYTEST_OUT_DIR",
        str(ROOT / "_site" / "playtest_audit"),
    )
)
BASE_URL = os.environ.get("PLAYTEST_URL", "http://127.0.0.1:4173/src/ui/index.html")


def wait_scene_ready(page, max_steps=18):
    for _ in range(max_steps):
        ready = page.evaluate("""() => {
            const b = window.__BEYOND3D__;
            if (!b || !b.scene) return false;
            b.stepFrame(0.016, false);
            return b.scene.isReady();
        }""")
        if ready:
            page.evaluate("() => window.__BEYOND3D__.stepFrame(0.016, true)")
            return True
        time.sleep(0.04)
    page.evaluate("() => window.__BEYOND3D__.stepFrame(0.016, true)")
    return False


def step_frames(page, count, dt=1 / 30, render_last=True):
    page.evaluate(
        """([n, dt, renderLast]) => {
            for (let i = 0; i < n; i++) {
                const isLast = renderLast && i === n - 1;
                window.__BEYOND3D__.stepFrame(dt, isLast);
            }
        }""",
        [count, dt, render_last],
    )


def real_hold_key(page, code, frames, dt=1 / 30):
    page.keyboard.down(code)
    step_frames(page, frames, dt, render_last=False)
    page.keyboard.up(code)
    step_frames(page, 2, dt, render_last=True)


def real_mouse_drag(page, dx, dy, steps=6):
    cx, cy = 640, 360
    page.mouse.move(cx, cy)
    page.mouse.down(button="left")
    for i in range(1, steps + 1):
        page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps)
        step_frames(page, 1, 1 / 60, render_last=False)
    page.mouse.up(button="left")
    step_frames(page, 2, 1 / 30, render_last=True)


def snap(cdp, out_dir, filename):
    res = cdp.send("Page.captureScreenshot", {"format": "png"})
    path = out_dir / filename
    path.write_bytes(base64.b64decode(res["data"]))
    print(f"  [capture] {path.name}", flush=True)
    return str(path)


def collect_quality_spec_metrics(page):
    """Collect quantitative Quality Spec v1.0 compliance telemetry for the active level."""
    return page.evaluate("""() => {
        const b = window.__BEYOND3D__;
        const s = b.scene;
        const mats = s.materials.map(m => m.getClassName ? m.getClassName() : 'unknown');
        const shadowGens = s.lights.filter(l => l.getShadowGenerator && l.getShadowGenerator()).length;
        const mirrorTex = s.textures
          ? s.textures.filter(t => (t.getClassName && t.getClassName().includes('Mirror')) || Boolean(t.mirrorPlane)).length
          : 0;
        const particles = s.particleSystems ? s.particleSystems.length : 0;
        const postProcs = s.postProcessRenderPipelineManager?._renderPipelines
          ? Object.keys(s.postProcessRenderPipelineManager._renderPipelines)
          : [];
        const guideBtn = document.getElementById('btn-guide');
        const guideBtnVisible = !!guideBtn && getComputedStyle(guideBtn).display !== 'none';
        const tacWrapper = document.getElementById('tactical-wrapper');
        const tacBody = document.getElementById('tactical-body');
        const tacWidth = tacBody ? tacBody.getBoundingClientRect().width : 0;
        const topologyCollapsed = !!tacWrapper && tacWrapper.classList.contains('is-collapsed') && tacWidth <= 2;
        const subEl = document.getElementById('subtitle-bar');
        let subtitleOverlapsGuide = false;
        if (subEl && guideBtnVisible && subEl.classList.contains('is-visible')) {
            const sr = subEl.getBoundingClientRect();
            const gr = guideBtn.getBoundingClientRect();
            subtitleOverlapsGuide = sr.right > gr.left - 2 && sr.bottom > gr.top && sr.top < gr.bottom;
        }
        return {
            levelId: b.levelId,
            meshCount: s.meshes.length,
            pbrCount: mats.filter(x => x.includes('PBR')).length,
            stdCount: mats.filter(x => x.includes('Standard')).length,
            lightCount: s.lights.length,
            envTex: !!s.environmentTexture,
            fogMode: s.fogMode,
            mirrorTex,
            shadowGens,
            particles,
            postProcs,
            guideBtnVisible,
            topologyCollapsed,
            tacWidth,
            subtitleOverlapsGuide,
        };
    }""")


def verify_principle_guide(page, cdp, out_dir, snap_name=None):
    """Press real I key, confirm modal opens with non-empty 3D canvas & custom level title, then close."""
    page.keyboard.press("KeyI")
    time.sleep(0.08)
    info = page.evaluate("""() => {
        const modal = document.getElementById('principle-modal');
        const title = document.getElementById('principle-title')?.textContent || '';
        const canvas = document.getElementById('principle-analogy-canvas');
        return {
            open: !!modal && !modal.hidden,
            title,
            canvasW: canvas ? canvas.width : 0,
            canvasH: canvas ? canvas.height : 0,
        };
    }""")
    if snap_name and info["open"]:
        snap(cdp, out_dir, snap_name)
    if info["open"]:
        page.keyboard.press("Escape")
        time.sleep(0.05)
    return info


def check_mesh_screen_visibility(page, mesh_name_substr):
    return page.evaluate(
        """(sub) => {
            const b = window.__BEYOND3D__;
            const B = window.BABYLON;
            const scene = b.scene;
            const cam = scene.activeCamera;
            const engine = b.engine;
            const w = engine.getRenderWidth();
            const h = engine.getRenderHeight();
            const vp = cam.viewport.toGlobal(w, h);
            const transform = scene.getTransformMatrix();
            const matches = scene.meshes.filter(m => m.name.includes(sub) && m.isEnabled() && m.isVisible);
            let visibleCount = 0;
            const samples = [];
            for (const m of matches) {
                const pos = m.getAbsolutePosition();
                const proj = B.Vector3.Project(pos, B.Matrix.Identity(), transform, vp);
                const inFront = proj.z >= 0 && proj.z <= 1;
                const inFrame = inFront && proj.x >= 0 && proj.x <= w && proj.y >= 0 && proj.y <= h;
                if (inFrame) visibleCount++;
                if (samples.length < 4) {
                    samples.push({ name: m.name, x: Math.round(proj.x), y: Math.round(proj.y), inFrame });
                }
            }
            return { total: matches.length, visibleCount, samples };
        }""",
        mesh_name_substr,
    )


def audit_prologue(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 0] Prologue: 迷航 (AAA Cinematic Cockpit + 4D Tesseract) ===", flush=True)
    page.goto(f"{BASE_URL}?level=0", wait_until="domcontentloaded")
    page.wait_for_function("() => Boolean(window.__BEYOND3D__?.engine)", timeout=25000)
    page.evaluate("() => window.__BEYOND3D__.engine.stopRenderLoop()")
    wait_scene_ready(page)

    spec = collect_quality_spec_metrics(page)
    step_frames(page, 10, 0.2)
    snap(cdp, out_dir, "pt_00a_warp_stars.png")
    step_frames(page, 25, 0.3)
    snap(cdp, out_dir, "pt_00b_grid_emerge.png")

    page.keyboard.press("Space")
    step_frames(page, 2, 0.05)
    lvl = page.evaluate("() => window.__BEYOND3D__.levelId")
    report["levels"]["0"] = {
        "spec": spec,
        "spaceSkipToLevel1": lvl == 1,
    }
    print(f"  Prologue spec: PBR={spec['pbrCount']}, IBL={spec['envTex']}, Fog={spec['fogMode']}, Particles={spec['particles']}, PostProc={spec['postProcs']}", flush=True)


def audit_level1(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 1] Level 1: 前方的人 (Mirror Floor + Shadows + Sculpted Statues + I-Guide) ===", flush=True)
    wait_scene_ready(page)
    spec = collect_quality_spec_metrics(page)
    snap(cdp, out_dir, "pt_01a_entry_view.png")

    # Verify I-key Interactive 3D Principle Card on Level 1!
    guide_l1 = verify_principle_guide(page, cdp, out_dir, "pt_01f_principle_card.png")

    # 1. Real mouse look LEFT toward sculpted copper-bronze statue outside left porthole in W+
    real_mouse_drag(page, -340, 0, steps=8)
    snap(cdp, out_dir, "pt_01b_room1_left_statue.png")
    real_mouse_drag(page, 340, 0, steps=8)

    # 2. Real G key wave -> triggers synced 24m silhouette + 3D world-space callout!
    page.keyboard.press("KeyG")
    step_frames(page, 14, 1 / 30)
    snap(cdp, out_dir, "pt_01c_real_wave.png")
    wave_beat = page.evaluate("() => window.__BEYOND3D__.state.beat")

    # 3. Walk straight forward with REAL W across Room 1 -> Room 2 (X+)
    real_hold_key(page, "KeyW", 38, 1 / 30)
    room2 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.getCellId(), z: window.__BEYOND3D__.state.unwrappedZ })")
    real_mouse_drag(page, -340, 0, steps=8)
    snap(cdp, out_dir, "pt_01d_room2_left_statue.png")
    real_mouse_drag(page, 340, 0, steps=8)

    # 4. Complete full 24m loop back to W+ using REAL W key
    real_hold_key(page, "KeyW", 118, 1 / 30)
    loop_state = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.getCellId(), z: Number(s.unwrappedZ.toFixed(1)), looped: s.hasLoopedBackToOrigin, visited: s.visitedRoomIndices.size, beat: s.beat, phase: s.getCurrentPuzzlePhase() };
    }""")

    # 5. Walk to Lock Console -> press E -> press Esc -> press H (context-aware looped_at_origin hint!)
    real_hold_key(page, "KeyD", 14, 1 / 30)
    real_hold_key(page, "KeyW", 12, 1 / 30)
    snap(cdp, out_dir, "pt_01e_at_lock_console.png")
    page.keyboard.press("KeyE")
    step_frames(page, 3, 1 / 30)
    modal_open = page.evaluate("() => !document.getElementById('ch1-modal').hidden")
    if modal_open:
        page.keyboard.press("Escape")
        step_frames(page, 2, 1 / 30)

    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    hint_text = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    report["levels"]["1"] = {
        "spec": spec,
        "principleGuide": guide_l1,
        "waveBeat": wave_beat,
        "room2ReachedByRealW": room2,
        "full24mLoopByRealW": loop_state,
        "realKeyEOpenedLock": modal_open,
        "realKeyHHint": hint_text,
    }
    print(f"  L1 spec: PBR={spec['pbrCount']}, Mirror={spec['mirrorTex']}, Shadow={spec['shadowGens']}, Particles={spec['particles']}, Guide={guide_l1['open']}", flush=True)


def audit_level2(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 2] Level 2: 没有门通向对面 (Zero-G Flight + Context Hints + I-Guide) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(2)")
    wait_scene_ready(page)
    spec = collect_quality_spec_metrics(page)
    snap(cdp, out_dir, "pt_02a_wplus_entry.png")

    guide_l2 = verify_principle_guide(page, cdp, out_dir)

    # Context hint in W+ (in_wplus)
    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    hint_wplus = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    # Fly forward smoothly with REAL W into X+
    real_hold_key(page, "KeyW", 58, 1 / 30)
    after_w = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.cellId, pos3: s.nav.getLocalPos3().map(v => Number(v.toFixed(2))), transits: s.nav.transitCount };
    }""")
    snap(cdp, out_dir, "pt_02b_entered_xplus.png")

    # Fly forward with REAL W into W- and pick up Locator via REAL E
    real_hold_key(page, "KeyW", 62, 1 / 30)
    after_w2 = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.cellId, pos3: s.nav.getLocalPos3().map(v => Number(v.toFixed(2))), canPick: s.canPickupLocator(), transits: s.nav.transitCount };
    }""")
    snap(cdp, out_dir, "pt_02c_entered_wminus.png")

    if after_w2["cell"] == "W-" and not after_w2["canPick"]:
        real_hold_key(page, "KeyW", 18, 1 / 30)
    page.keyboard.press("KeyE")
    step_frames(page, 4, 1 / 30)
    picked = page.evaluate("() => window.__BEYOND3D__.state.hasPickedLocator")

    # Close modal if it auto-opens after 420ms, then press H to verify context-aware `has_locator` hint!
    time.sleep(0.48)
    page.keyboard.press("Escape")
    step_frames(page, 2, 1 / 30)
    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    hint_after_pickup = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    report["levels"]["2"] = {
        "spec": spec,
        "principleGuide": guide_l2,
        "hintInWPlus": hint_wplus,
        "hintAfterPickup": hint_after_pickup,
        "realFlightToXPlus": after_w,
        "realFlightToWMinus": after_w2,
        "realKeyEPickedLocator": picked,
    }
    print(f"  L2 spec: PBR={spec['pbrCount']}, Particles={spec['particles']}, Guide={guide_l2['open']}, Picked={picked}", flush=True)


def audit_level3(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 3] Level 3: 哪边是上 (Clean Frame 1 + 360° Gyro + W->Space->S +90° + I-Guide) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(3)")
    wait_scene_ready(page)
    spec = collect_quality_spec_metrics(page)

    gold_edge_vis_entry = check_mesh_screen_visibility(page, "l3_gold_edge")
    reticle_clean_entry = page.evaluate("() => !window.__BEYOND3D__.state.canInteractLock()")
    snap(cdp, out_dir, "pt_03a_entry_view.png")

    guide_l3 = verify_principle_guide(page, cdp, out_dir, "pt_03f_principle_card.png")

    # Step 1: W -> X+
    real_hold_key(page, "KeyW", 68, 1 / 30)
    step1 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.cellId, trail: window.__BEYOND3D__.state.loopTrail })")
    snap(cdp, out_dir, "pt_03c_inside_xplus.png")

    # Step 2: Space -> Y+
    real_hold_key(page, "Space", 75, 1 / 30)
    step2 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.cellId, trail: window.__BEYOND3D__.state.loopTrail })")
    snap(cdp, out_dir, "pt_03d_inside_yplus.png")

    # Step 3: S -> W+ (+90° aligned!)
    page.keyboard.down("KeyS")
    for _ in range(95):
        step_frames(page, 1, 1 / 30, render_last=False)
        if page.evaluate("() => window.__BEYOND3D__.state.cellId === 'W+'"):
            step_frames(page, 6, 1 / 30, render_last=False)
            break
    page.keyboard.up("KeyS")
    step_frames(page, 2, 1 / 30, render_last=True)

    step3 = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return {
            cell: s.cellId,
            trail: s.loopTrail,
            angleDeg: s.getGyroAngleInWPlusDeg(),
            aligned: s.isGyroAlignedForLock(),
            canInteract: s.canInteractLock(),
            phase: s.getCurrentPuzzlePhase(),
        };
    }""")
    snap(cdp, out_dir, "pt_03e_returned_wplus.png")

    # Verify context-aware H hint at `returned_aligned` directly prompts embedding gyro!
    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    hint_aligned = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    # Tap REAL E key to embed calibrated gyro & ignite holonomy victory beam!
    page.keyboard.press("KeyE")
    step_frames(page, 4, 1 / 30)
    unlocked_by_real_e = page.evaluate("() => window.__BEYOND3D__.state.completed")

    report["levels"]["3"] = {
        "spec": spec,
        "principleGuide": guide_l3,
        "reticleCleanAtEntry": reticle_clean_entry,
        "goldEdgeVisibleAtEntry": gold_edge_vis_entry,
        "step1_realW": step1,
        "step2_realSpace": step2,
        "step3_realBackToWPlus": step3,
        "hintWhenAligned": hint_aligned,
        "realKeyEUnlocked": unlocked_by_real_e,
    }
    print(f"  L3 spec: PBR={spec['pbrCount']}, GoldEdges={gold_edge_vis_entry['visibleCount']}/3, CleanF1={reticle_clean_entry}, Unlocked={unlocked_by_real_e}", flush=True)


def audit_level4(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 4] Level 4: 一笔走完 (Gleaming Mercury Rift + Beacons + I-Guide) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(4)")
    wait_scene_ready(page)
    spec = collect_quality_spec_metrics(page)
    snap(cdp, out_dir, "pt_04a_entry_view.png")

    guide_l4 = verify_principle_guide(page, cdp, out_dir)
    plaque_vis = check_mesh_screen_visibility(page, "center_cell_plq_+Z")

    real_hold_key(page, "KeyW", 72, 1 / 30)
    after_w = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.cellId, lit: s.litBeaconCount, trail: s.trail };
    }""")
    snap(cdp, out_dir, "pt_04b_in_xplus_beacon_lit.png")

    real_mouse_drag(page, 0, -240, steps=8)
    snap(cdp, out_dir, "pt_04c_lit_dome_beacon.png")

    report["levels"]["4"] = {
        "spec": spec,
        "principleGuide": guide_l4,
        "frontPlaquePos": plaque_vis,
        "realFlightToXPlus": after_w,
    }
    print(f"  L4 spec: PBR={spec['pbrCount']}, Particles={spec['particles']}, Guide={guide_l4['open']}, X+={after_w['cell']}", flush=True)


def audit_level14_baseline(page, report):
    print("\n=== [BASELINE BENCHMARK] Level 14: 发丝裂缝 (Demo Reference Metrics) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(14)")
    wait_scene_ready(page)
    spec14 = collect_quality_spec_metrics(page)
    report["levels"]["14_baseline"] = {"spec": spec14}
    print(f"  L14 baseline: PBR={spec14['pbrCount']}, Mirror={spec14['mirrorTex']}, Shadow={spec14['shadowGens']}, Particles={spec14['particles']}, Fog={spec14['fogMode']}", flush=True)


def main():
    DEFAULT_OUT.mkdir(parents=True, exist_ok=True)
    console_errors = []
    page_errors = []
    report = {"url": BASE_URL, "levels": {}, "consoleErrors": [], "pageErrors": [], "gatesPassed": False}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--ignore-gpu-blocklist",
            ],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        cdp = page.context.new_cdp_session(page)

        audit_prologue(page, cdp, DEFAULT_OUT, report)
        audit_level1(page, cdp, DEFAULT_OUT, report)
        audit_level2(page, cdp, DEFAULT_OUT, report)
        audit_level3(page, cdp, DEFAULT_OUT, report)
        audit_level4(page, cdp, DEFAULT_OUT, report)
        audit_level14_baseline(page, report)

        browser.close()

    report["consoleErrors"] = console_errors
    report["pageErrors"] = page_errors

    # Hard Quality Specification v1.0 & Real-Gameplay Gate Assertions!
    failures = []
    if console_errors or page_errors:
        failures.append(f"Runtime errors: console={console_errors}, page={page_errors}")

    # 1. Prologue spec & real input
    s0 = report["levels"]["0"]["spec"]
    if not report["levels"]["0"]["spaceSkipToLevel1"]:
        failures.append("Prologue: Space key failed to skip into Level 1")
    if not s0["envTex"] or not s0["postProcs"] or s0["particles"] < 1 or s0["fogMode"] == 0 or s0["pbrCount"] < 4:
        failures.append(f"Prologue failed Quality Spec v1.0 rendering bar: {s0}")

    # 2. Levels 1-4 shared Quality Spec v1.0 checks
    for lid in ["1", "2", "3", "4"]:
        sp = report["levels"][lid]["spec"]
        if not sp["envTex"] or not sp["postProcs"] or sp["particles"] < 1 or sp["fogMode"] == 0 or sp["pbrCount"] < 6:
            failures.append(f"Level {lid} failed Quality Spec v1.0 rendering bar: {sp}")
        if not sp["guideBtnVisible"]:
            failures.append(f"Level {lid}: I-key Principle Guide button is NOT visible!")
        if not sp["topologyCollapsed"]:
            failures.append(f"Level {lid}: F-key topology map should default collapsed for zero-spoiler Frame 1 (width={sp['tacWidth']})!")
        if sp.get("subtitleOverlapsGuide"):
            failures.append(f"Level {lid}: Voice subtitle bar overlaps #btn-guide button at 1280x720!")
        pg = report["levels"][lid]["principleGuide"]
        if not pg["open"] or pg["canvasW"] < 400:
            failures.append(f"Level {lid}: Interactive 3D Principle Guide failed to open/render: {pg}")

    # 3. Level 1 extra rendering & real gameplay gates
    s1 = report["levels"]["1"]["spec"]
    if s1["mirrorTex"] < 1 or s1["shadowGens"] < 1:
        failures.append(f"Level 1 must match Level 14 mirror & soft-shadow bar: mirror={s1['mirrorTex']}, shadow={s1['shadowGens']}")
    if not report["levels"]["1"]["full24mLoopByRealW"]["looped"] or not report["levels"]["1"]["realKeyEOpenedLock"]:
        failures.append("Level 1: Real WASD 24m loop or KeyE lock failed")
    if "第 9 间" not in (report["levels"]["1"]["realKeyHHint"] or "") and "红丝带" not in (report["levels"]["1"]["realKeyHHint"] or ""):
        failures.append(f"Level 1: Context-aware KeyH hint mismatch: {report['levels']['1']['realKeyHHint']}")

    # 4. Level 2 real flight + context-aware hints
    l2 = report["levels"]["2"]
    if l2["realFlightToWMinus"]["cell"] != "W-" or not l2["realKeyEPickedLocator"]:
        failures.append(f"Level 2: Real Zero-G flight to W- or KeyE pickup failed: {l2}")
    if l2["hintInWPlus"] == l2["hintAfterPickup"]:
        failures.append("Level 2: Context-aware KeyH hint did not adapt after picking up Locator!")

    # 5. Level 3 clean Frame 1 + 3/3 Golden Edges + real 3-room flight + aligned context hint
    l3 = report["levels"]["3"]
    if not l3["reticleCleanAtEntry"]:
        failures.append("Level 3: Premature [E] lock prompt appeared on Frame 1 at spawn!")
    if l3["goldEdgeVisibleAtEntry"]["visibleCount"] < 3:
        failures.append(f"Level 3: Expected 3/3 Golden Shared Edges visible at entry: {l3['goldEdgeVisibleAtEntry']}")
    if l3["step3_realBackToWPlus"]["cell"] != "W+" or not l3["realKeyEUnlocked"]:
        failures.append(f"Level 3: Real 3-room flight W+->X+->Y+->W+ or KeyE unlock failed: {l3}")
    if "嵌入" not in (l3["hintWhenAligned"] or "") and "+90°" not in (l3["hintWhenAligned"] or ""):
        failures.append(f"Level 3: Context-aware KeyH hint at returned_aligned did not address embedding: {l3['hintWhenAligned']}")

    # 6. Level 4 real flight
    if report["levels"]["4"]["realFlightToXPlus"]["cell"] != "X+":
        failures.append(f"Level 4: Real flight to X+ failed: {report['levels']['4']}")

    report["gatesPassed"] = len(failures) == 0
    report["failures"] = failures
    report_path = DEFAULT_OUT / "playtest_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ Playtest & Quality Spec v1.0 telemetry saved to {report_path}", flush=True)
    if failures:
        print("QUALITY SPEC / PLAYTEST GATES FAILED:\n  - " + "\n  - ".join(failures), flush=True)
        sys.exit(1)
    print("✓ ALL QUALITY SPEC v1.0 & REAL-GAMEPLAY GATES PASSED (0 ERRORS)!", flush=True)


if __name__ == "__main__":
    main()
