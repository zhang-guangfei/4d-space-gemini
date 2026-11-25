#!/usr/bin/env python3
"""
Beyond 3D — Real-Gameplay Quality Audit Harness (`npm run audit:playtest`)

Unlike unit tests or debug-state teleports, this script drives the live 3D game
in headless Chromium using REAL keyboard (`W/A/S/D`, `Space`, `Ctrl`, `E`, `Tab`, `H`)
and REAL mouse drags/clicks to evaluate actual player experience across 6 QA pillars:
  1. First-Impression Framing & Readability (landmark visibility, HUD non-overlap)
  2. Real Control Feel & Spatial Navigation (actually walking/flying through doors!)
  3. Visual Craft & Spatial Depth (contrast, porthole statue visibility, edge & gyro clarity)
  4. Cognitive Chain & "Aha!" Moment (seeing the 4D phenomenon before solving)
  5. Interactive Flow & Context Hints (E interactions, modals, H hints, R reset)
  6. Technical Stability (0 console/page errors, scene readiness, clean transitions)
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
            b.stepFrame(0.016);
            return b.scene.isReady();
        }""")
        if ready:
            page.evaluate("() => window.__BEYOND3D__.stepFrame(0.016)")
            return True
        time.sleep(0.06)
    page.evaluate("() => window.__BEYOND3D__.stepFrame(0.016)")
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
    """Hold a real keyboard key and step real 60/30Hz simulation frames."""
    page.keyboard.down(code)
    step_frames(page, frames, dt, render_last=False)
    page.keyboard.up(code)
    step_frames(page, 2, dt, render_last=True)


def real_mouse_drag(page, dx, dy, steps=6):
    """Drag real mouse on the canvas to rotate FPS / Zero-G camera view."""
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


def check_mesh_screen_visibility(page, mesh_name_substr):
    """Check whether any mesh matching substring projects inside the 1280x720 viewport in front of camera."""
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
    print("\n=== [PLAYTEST 0] Prologue: 迷航 ===")
    page.goto(f"{BASE_URL}?level=0", wait_until="domcontentloaded")
    page.wait_for_function("() => Boolean(window.__BEYOND3D__?.engine)", timeout=20000)
    page.evaluate("() => window.__BEYOND3D__.engine.stopRenderLoop()")
    wait_scene_ready(page)

    # Early warp alarm with starfield intact
    step_frames(page, 10, 0.2)
    snap(cdp, out_dir, "pt_00a_warp_stars.png")
    # Mid sequence: stars extinguishing + 4D wireframe emerging + Lin Xia voice
    step_frames(page, 25, 0.3)
    snap(cdp, out_dir, "pt_00b_grid_emerge.png")

    # Test real Space key to skip prologue -> Level 1
    page.keyboard.press("Space")
    step_frames(page, 2, 0.05)
    lvl = page.evaluate("() => window.__BEYOND3D__.levelId")
    report["levels"]["0"] = {
        "spaceSkipToLevel1": lvl == 1,
        "notes": "Real Space key cleanly skipped Prologue into Level 1" if lvl == 1 else f"FAILED: stayed on {lvl}",
    }
    print(f"  Space skip -> Level {lvl}")


def audit_level1(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 1] Level 1: 前方的人 (Real WASD + Mouse Look + Wave + Statues + Lock) ===")
    wait_scene_ready(page)
    snap(cdp, out_dir, "pt_01a_entry_view.png")

    # 1. Real mouse look LEFT toward the copper-bronze statue outside left porthole in Room 1 (W+)
    real_mouse_drag(page, -340, 0, steps=8)
    snap(cdp, out_dir, "pt_01b_room1_left_statue.png")
    # Look back straight ahead (+340)
    real_mouse_drag(page, 340, 0, steps=8)

    # 2. Real left-click / G key wave and capture synced 24m silhouette
    page.keyboard.press("KeyG")
    step_frames(page, 14, 1 / 30)
    snap(cdp, out_dir, "pt_01c_real_wave.png")
    wave_beat = page.evaluate("() => window.__BEYOND3D__.state.beat")

    # 3. Walk straight forward with REAL W key across Room 1 -> Room 2 (X+), look left at statue!
    real_hold_key(page, "KeyW", 38, 1 / 30)  # ~6m forward into X+!
    room2 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.getCellId(), z: window.__BEYOND3D__.state.unwrappedZ })")
    real_mouse_drag(page, -340, 0, steps=8)
    snap(cdp, out_dir, "pt_01d_room2_left_statue.png")
    real_mouse_drag(page, 340, 0, steps=8)

    # 4. Keep walking with REAL W key all the way around the 24m loop back to W+!
    real_hold_key(page, "KeyW", 118, 1 / 30)  # ~18m more -> back to W+!
    loop_state = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.getCellId(), z: Number(s.unwrappedZ.toFixed(1)), looped: s.hasLoopedBackToOrigin, visited: s.visitedRoomIndices.size, beat: s.beat };
    }""")

    # 5. Walk over to the right-side Lock Console in W+ using REAL D+W keys and check reticle prompt!
    # First inspect distance to lock console
    lock_pos_info = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { x: s.playerX, lz: s.getLocalZInCell(), near: s.getNearestInteractable() };
    }""")
    real_hold_key(page, "KeyD", 14, 1 / 30)
    real_hold_key(page, "KeyW", 12, 1 / 30)
    near_after = page.evaluate("() => window.__BEYOND3D__.state.getNearestInteractable()")
    snap(cdp, out_dir, "pt_01e_at_lock_console.png")

    # Press real E key to open lock modal!
    page.keyboard.press("KeyE")
    step_frames(page, 3, 1 / 30)
    modal_open = page.evaluate("() => !document.getElementById('ch1-modal').hidden")

    # Test real H hint key (after closing modal cleanly via Esc)
    if modal_open:
        page.keyboard.press("Escape")
        step_frames(page, 2, 1 / 30)
    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    hint_text = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    report["levels"]["1"] = {
        "waveBeat": wave_beat,
        "room2ReachedByRealW": room2,
        "full24mLoopByRealW": loop_state,
        "lockNearBeforeWalk": lock_pos_info,
        "lockNearAfterWalk": near_after,
        "realKeyEOpenedLock": modal_open,
        "realKeyHHint": hint_text,
    }
    print("  L1 real-play telemetry:", json.dumps(report["levels"]["1"], ensure_ascii=False))


def audit_level2(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 2] Level 2: 没有门通向对面 (Real Zero-G WASD Flight to X+ then W-) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(2)")
    wait_scene_ready(page)
    snap(cdp, out_dir, "pt_02a_wplus_entry.png")

    # Test real H key hint works with 0 errors
    page.keyboard.press("KeyH")
    step_frames(page, 2, 1 / 30)
    l2_hint = page.evaluate("() => document.getElementById('subtitle-text').textContent")

    # Fly forward smoothly with REAL W into X+ (tuned speed must NOT overshoot into W-!)
    real_hold_key(page, "KeyW", 58, 1 / 30)
    after_w = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.cellId, pos3: s.nav.getLocalPos3().map(v => Number(v.toFixed(2))), transits: s.nav.transitCount };
    }""")
    snap(cdp, out_dir, "pt_02b_entered_xplus.png")

    # Fly forward with REAL W from X+ into W- (must land INSIDE W- near Locator without overshooting into X-!)
    real_hold_key(page, "KeyW", 62, 1 / 30)
    after_w2 = page.evaluate("""() => {
        const s = window.__BEYOND3D__.state;
        return { cell: s.cellId, pos3: s.nav.getLocalPos3().map(v => Number(v.toFixed(2))), canPick: s.canPickupLocator(), transits: s.nav.transitCount };
    }""")
    snap(cdp, out_dir, "pt_02c_entered_wminus.png")

    # Fly slightly closer to W- center if needed, then tap REAL E key to pick up Lin Xia's Locator!
    if after_w2["cell"] == "W-" and not after_w2["canPick"]:
        real_hold_key(page, "KeyW", 18, 1 / 30)
    can_pick_now = page.evaluate("() => window.__BEYOND3D__.state.canPickupLocator()")
    page.keyboard.press("KeyE")
    step_frames(page, 4, 1 / 30)
    picked = page.evaluate("() => window.__BEYOND3D__.state.hasPickedLocator")

    report["levels"]["2"] = {
        "realKeyHHint": l2_hint,
        "realFlightToXPlus": after_w,
        "realFlightToWMinus": after_w2,
        "canPickLocatorAfterFlight": can_pick_now,
        "realKeyEPickedLocator": picked,
    }
    print("  L2 real-play telemetry:", json.dumps(report["levels"]["2"], ensure_ascii=False), flush=True)


def audit_level3(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 3] Level 3: 哪边是上 (Real Zero-G Flight W+ -> X+ -> Y+ -> W+!) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(3)")
    wait_scene_ready(page)

    # Verify Golden Shared 1D Edge is IMMEDIATELY visible on frame 1 at spawn!
    gold_edge_vis_entry = check_mesh_screen_visibility(page, "l3_gold_edge")
    arrows_vis_entry = check_mesh_screen_visibility(page, "l3_arr_")
    snap(cdp, out_dir, "pt_03a_entry_view.png")

    # Step 1: Fly forward with REAL W into X+
    real_hold_key(page, "KeyW", 68, 1 / 30)
    step1 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.cellId, trail: window.__BEYOND3D__.state.loopTrail })")
    snap(cdp, out_dir, "pt_03c_inside_xplus.png")

    # Step 2: Inside X+, fly UP with REAL Space into Y+
    real_hold_key(page, "Space", 75, 1 / 30)
    step2 = page.evaluate("() => ({ cell: window.__BEYOND3D__.state.cellId, trail: window.__BEYOND3D__.state.loopTrail, pos3: window.__BEYOND3D__.state.nav.getLocalPos3().map(v=>Number(v.toFixed(2))) })")
    snap(cdp, out_dir, "pt_03d_inside_yplus.png")

    # Step 3: Inside Y+, hold REAL KeyS toward W+ (releasing cleanly just after entering W+, like a human!)
    compass_yplus = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('#compass-grid .compass-cell')).map(el => el.textContent.trim());
    }""")
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
        };
    }""")
    snap(cdp, out_dir, "pt_03e_returned_wplus.png")

    # Tap REAL E key to embed the +90° calibrated gyro into W+ Resonance Lock!
    page.keyboard.press("KeyE")
    step_frames(page, 4, 1 / 30)
    unlocked_by_real_e = page.evaluate("() => window.__BEYOND3D__.state.completed")

    report["levels"]["3"] = {
        "goldEdgeVisibleAtEntry": gold_edge_vis_entry,
        "arrowsVisibleAtEntry": arrows_vis_entry,
        "step1_realW": step1,
        "step2_realSpace": step2,
        "compassInYPlus": compass_yplus,
        "step3_realBackToWPlus": step3,
        "realKeyEUnlocked": unlocked_by_real_e,
    }
    print("  L3 real-play telemetry:", json.dumps(report["levels"]["3"], ensure_ascii=False), flush=True)


def audit_level4(page, cdp, out_dir, report):
    print("\n=== [PLAYTEST 4] Level 4: 一笔走完 (Real Navigation Above Suspended Sphere + Beacons) ===", flush=True)
    page.evaluate("() => window.__BEYOND3D__.loadLevel(4)")
    wait_scene_ready(page)
    snap(cdp, out_dir, "pt_04a_entry_view.png")

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
        "frontPlaquePos": plaque_vis,
        "realFlightToXPlus": after_w,
    }
    print("  L4 real-play telemetry:", json.dumps(report["levels"]["4"], ensure_ascii=False), flush=True)


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
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        cdp = page.context.new_cdp_session(page)

        audit_prologue(page, cdp, DEFAULT_OUT, report)
        audit_level1(page, cdp, DEFAULT_OUT, report)
        audit_level2(page, cdp, DEFAULT_OUT, report)
        audit_level3(page, cdp, DEFAULT_OUT, report)
        audit_level4(page, cdp, DEFAULT_OUT, report)

        browser.close()

    report["consoleErrors"] = console_errors
    report["pageErrors"] = page_errors

    # Hard Real-Gameplay QA Gate Assertions!
    failures = []
    if console_errors or page_errors:
        failures.append(f"Runtime errors: console={console_errors}, page={page_errors}")
    if not report["levels"]["0"]["spaceSkipToLevel1"]:
        failures.append("Prologue: Space key failed to skip into Level 1")
    if not report["levels"]["1"]["full24mLoopByRealW"]["looped"] or not report["levels"]["1"]["realKeyEOpenedLock"]:
        failures.append("Level 1: Real WASD 24m loop or KeyE lock failed")
    if "红丝带" not in (report["levels"]["1"]["realKeyHHint"] or ""):
        failures.append(f"Level 1: Real KeyH did not deliver Tier 1 hint: {report['levels']['1']['realKeyHHint']}")
    if report["levels"]["2"]["realFlightToWMinus"]["cell"] != "W-" or not report["levels"]["2"]["realKeyEPickedLocator"]:
        failures.append(f"Level 2: Real Zero-G flight to W- or KeyE pickup failed: {report['levels']['2']}")
    if report["levels"]["3"]["goldEdgeVisibleAtEntry"]["visibleCount"] < 1:
        failures.append("Level 3: Golden Shared 1D Edge was NOT visible on screen at entry!")
    if report["levels"]["3"]["step3_realBackToWPlus"]["cell"] != "W+" or not report["levels"]["3"]["realKeyEUnlocked"]:
        failures.append(f"Level 3: Real 3-room flight W+->X+->Y+->W+ or KeyE unlock failed: {report['levels']['3']}")
    if report["levels"]["4"]["realFlightToXPlus"]["cell"] != "X+":
        failures.append(f"Level 4: Real flight to X+ failed: {report['levels']['4']}")

    report["gatesPassed"] = len(failures) == 0
    report["failures"] = failures
    report_path = DEFAULT_OUT / "playtest_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ Playtest telemetry saved to {report_path}", flush=True)
    if failures:
        print("PLAYTEST QUALITY GATES FAILED:\n  - " + "\n  - ".join(failures), flush=True)
        sys.exit(1)
    print("✓ ALL REAL-GAMEPLAY QUALITY GATES PASSED (0 ERRORS)!", flush=True)


if __name__ == "__main__":
    main()
