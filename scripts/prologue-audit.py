#!/usr/bin/env python3
"""
Beyond 3D — Deterministic 18-Keyframe Headless WebGL Visual Audit & Automated Redline Scanner
for Prologue《迷航》 (`scripts/prologue-audit.py`).

Enforces PROJECT.md (Contract F & Redlines FORBID-01..06), docs/design/prologue-spec-v1.md,
and docs/design/prologue-agent-cluster-execution-spec.md across three automated layers:

  Layer 1 — Static Redline & Render-Invariant Scanner (Prologue-scoped files only; never
            false-fails legacy Level 1 or PROLOGUE_FORBIDDEN_PATTERNS declarations).
  Layer 2 — Single-Page Headless Playwright Chromium (SwiftShader WebGL 2.0) 1280x720
            execution with deterministic `seekPrologue(tSec, { warmupTicks })`,
            Contract F telemetry verification, DOM 2.35:1 letterbox & safe-area
            zero-overlap checks, live DOM redline scan, S6 letterbox retraction probe,
            and interactive `Space` skip test (when `--segment all`).
  Layer 3 — Pillow pixel assertions on every captured 1280x720 PNG (dimensions,
            non-solid-color check, 2.35:1 letterbox black bar mean luma, active cinema
            band luminance bounds, KF-18 polar-day whiteout >= 215 luma, inter-frame MAD).

Usage:
  python3 scripts/prologue-audit.py --segment P1 --out-dir _site/prologue_audit/p1
  python3 scripts/prologue-audit.py --segment P2 --out-dir _site/prologue_audit/p2
  python3 scripts/prologue-audit.py --segment P3 --out-dir _site/prologue_audit/p3
  python3 scripts/prologue-audit.py --segment all --built-site --out-dir _site/prologue_audit/final
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import functools
import http.server
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720
DEFAULT_OUT_DIR = os.environ.get("PROLOGUE_AUDIT_OUT_DIR", "/tmp/prologue_audit")

# Safe interior pixel bands for 1280x720 2.35:1 letterbox (theoretical bar height = 87.66px)
TOP_BAR_BOX = (0, 0, VIEWPORT_WIDTH, 76)
BOTTOM_BAR_BOX = (0, 644, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
ACTIVE_CINEMA_BOX = (0, 92, VIEWPORT_WIDTH, 628)
CENTER_TEXT_ROI = (160, 180, 1120, 540)


@dataclass(frozen=True)
class KeyframeSpec:
    kf_id: str
    segment_id: str
    t_sec: float
    shot_id: str
    sub_beat_id: str
    slug: str
    description: str

    @property
    def filename(self) -> str:
        return f"{self.kf_id}_{self.slug}.png"


# Authoritative 18-keyframe shot list (docs/design/prologue-agent-cluster-execution-spec.md §6)
KEYFRAMES: tuple[KeyframeSpec, ...] = (
    # Segment P1 — 文明远航 (0.0 - 26.0s)
    KeyframeSpec("KF-01", "P1", 2.0, "S0A", "S0A", "p1_s0a_line1", "S0A cosmic dust + opening line 1"),
    KeyframeSpec("KF-02", "P1", 8.5, "S0A", "S0A", "p1_s0a_lines3", "S0A all 3 opening lines + narrator VO"),
    KeyframeSpec("KF-03", "P1", 13.2, "S0B", "S0B-1", "p1_s0b1_cryo08", "S0B-1 cryo corridor + 08 号 hero pod"),
    KeyframeSpec("KF-04", "P1", 17.5, "S0B", "S0B-2", "p1_s0b2_warp_ignite", "S0B-2 flagship + escort fleet warp ignite"),
    KeyframeSpec("KF-05", "P1", 20.8, "S0B", "S0B-2", "p1_s0b2_warp_peak", "S0B-2 wide-FOV FTL warp peak"),
    KeyframeSpec("KF-06", "P1", 24.0, "S0C", "S0C", "p1_s0c_coord47y", "S0C 47-years-later monospace coord card"),
    # Segment P2 — 无声入海 (26.0 - 55.0s)
    KeyframeSpec("KF-07", "P2", 30.5, "S1", "S1", "p2_s1_linxia_cabin", "S1 curved science cabin + 07 号 Lin Xia"),
    KeyframeSpec("KF-08", "P2", 37.8, "S2", "S2", "p2_s2_mercury_veil", "S2 unaware liquid-mercury 4D veil crossing"),
    KeyframeSpec("KF-09", "P2", 41.5, "S2", "S2", "p2_s2_alert_2s", "S2 +2.0s predictive curvature amber alert"),
    KeyframeSpec("KF-10", "P2", 46.5, "S3", "S3", "p2_s3_stars_zero", "S3 warp freeze + sequential star extinction"),
    KeyframeSpec("KF-11", "P2", 50.5, "S3", "S3", "p2_s3_megastructure", "S3 cosmic recursive 8-cell megastructure"),
    KeyframeSpec("KF-12", "P2", 53.2, "S3", "S3", "p2_s3_spectrometer", "S3 48-bar quantum spectrometer + 14% decode"),
    # Segment P3 — 空间折纸 (55.0 - 75.0s)
    KeyframeSpec("KF-13", "P3", 56.2, "S4", "S4-1", "p3_s41_sealed_box", "S4-1 meteor dive + intact sealed glass box"),
    KeyframeSpec("KF-14", "P3", 58.0, "S4", "S4-1", "p3_s41_xray_wave", "S4-1 4D orb excursion & cyan X-Ray wave"),
    KeyframeSpec("KF-15", "P3", 59.8, "S4", "S4-1", "p3_s41_glass_shards", "S4-1 orthogonal 4D cracks + floating shards"),
    KeyframeSpec("KF-16", "P3", 62.8, "S4", "S4-2", "p3_s42_pod08_wake", "S4-2 08 号 cryo-pod green emergency wake"),
    KeyframeSpec("KF-17", "P3", 67.8, "S5", "S5", "p3_s5_origami90", "S5 08 号 POV 90-deg bridge origami unfold"),
    KeyframeSpec("KF-18", "P3", 73.5, "S6", "S6", "p3_s6_polar_white", "S6 polar-day pure-white wave & bar retract"),
)

# Redline regex definitions (FORBID-01..06)
REDLINE_PATTERNS: tuple[tuple[str, str, re.Pattern[str]], ...] = (
    (
        "FORBID-01",
        "Deleted legacy closing line / legacy EVA copy",
        re.compile(
            r"08\s*号，空间把我隔到前面去了|隔到前面去了|别跟丢了|我先出舱看看|EVA\s*·\s*07|林夏已出舱"
        ),
    ),
    (
        "FORBID-02",
        "Prohibited red-ribbon motif in Prologue",
        re.compile(r"红丝带|redRibbon|red_ribbon", re.IGNORECASE),
    ),
    (
        "FORBID-03",
        "Prohibited delayed/lagging reflection gimmick in Prologue",
        re.compile(r"倒影慢半拍|delayedReflection|lagReflection", re.IGNORECASE),
    ),
    (
        "FORBID-06",
        "Prohibited migration/chapter1-4d-space or legacy Chapter 1 coupling in Prologue",
        re.compile(r"migration/chapter1-4d-space|进入第\s*1\s*关|回廊|Level1CorridorScene"),
    ),
)

DEPTH_PREPASS_TRUE_RE = re.compile(r"needDepthPrePass\s*(?::|=)(?!=)\s*true")
PURE_CORE_FORBIDDEN_RE = re.compile(r"\b(document|window|BABYLON)\b")
STATION_AMBIENCE_CALL_RE = re.compile(r"\b(?:startStationAmbience|startSanctuaryAmbience)\s*\(")
MIGRATION_IMPORT_RE = re.compile(r"""(?:import\s+[^;\n]*from\s+|import\s*\(|from\s+)['"][^'"]*migration/chapter1-4d-space""")


# ---------------------------------------------------------------------------
# Layer 1 — Static Redline & Render-Invariant Scanner
# ---------------------------------------------------------------------------


def strip_forbidden_pattern_declarations(source: str) -> str:
    """
    Replace any `PROLOGUE_FORBIDDEN_PATTERNS = ...;` declaration block with
    same-line-count whitespace so redline constant tables never false-fail,
    while preserving exact line numbers for all real code/copy.
    """
    marker = re.compile(r"\bPROLOGUE_FORBIDDEN_PATTERNS\s*=")
    out = source
    search_pos = 0
    while True:
        match = marker.search(out, search_pos)
        if not match:
            break
        start = match.start()
        # Walk forward tracking [], (), {} and string literals until top-level `;`
        i = match.end()
        n = len(out)
        depth_bracket = 0
        depth_paren = 0
        depth_brace = 0
        in_str: str | None = None
        escaped = False
        end = n
        while i < n:
            ch = out[i]
            if in_str is not None:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == in_str:
                    in_str = None
                i += 1
                continue
            if ch in ("'", '"', "`"):
                in_str = ch
            elif ch == "[":
                depth_bracket += 1
            elif ch == "]":
                depth_bracket = max(0, depth_bracket - 1)
            elif ch == "(":
                depth_paren += 1
            elif ch == ")":
                depth_paren = max(0, depth_paren - 1)
            elif ch == "{":
                depth_brace += 1
            elif ch == "}":
                depth_brace = max(0, depth_brace - 1)
            elif ch == ";" and depth_bracket == 0 and depth_paren == 0 and depth_brace == 0:
                end = i + 1
                break
            i += 1
        # Preserve newlines so subsequent line numbers stay exact
        blanked = re.sub(r"[^\n]", " ", out[start:end])
        out = out[:start] + blanked + out[end:]
        search_pos = start + len(blanked)
    return out


def strip_js_comments_preserve_lines(source: str) -> str:
    """Remove // and /* */ comments while preserving newline line numbers."""
    result: list[str] = []
    i = 0
    n = len(source)
    in_str: str | None = None
    escaped = False
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if in_str is not None:
            result.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            result.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "/":
            while i < n and source[i] != "\n":
                result.append(" ")
                i += 1
            continue
        if ch == "/" and nxt == "*":
            result.append("  ")
            i += 2
            while i < n:
                if source[i] == "*" and i + 1 < n and source[i + 1] == "/":
                    result.append("  ")
                    i += 2
                    break
                result.append("\n" if source[i] == "\n" else " ")
                i += 1
            continue
        result.append(ch)
        i += 1
    return "".join(result)


def collect_prologue_scoped_files(repo_root: Path) -> list[Path]:
    """Collect Prologue-scoped source files (never touching legacy Level 1 modules)."""
    candidates: list[Path] = [
        repo_root / "src" / "core" / "prologue-timeline.js",
        repo_root / "src" / "engine" / "prologue-materials.js",
        repo_root / "src" / "engine" / "prologue-audio.js",
        repo_root / "src" / "levels" / "prologue-scene.js",
        repo_root / "src" / "ui" / "prologue-overlay.js",
    ]
    prologue_dir = repo_root / "src" / "levels" / "prologue"
    if prologue_dir.is_dir():
        candidates.extend(sorted(prologue_dir.glob("*.js")))
    return [p for p in candidates if p.is_file()]


def run_layer1_static_redline_scan(repo_root: Path) -> dict[str, Any]:
    """Run Layer 1 static redline and rendering invariant checks before browser launch."""
    scanned_files = collect_prologue_scoped_files(repo_root)
    violations: list[dict[str, Any]] = []

    for path in scanned_files:
        rel = str(path.relative_to(repo_root))
        raw_text = path.read_text(encoding="utf-8")
        cleaned_text = strip_forbidden_pattern_declarations(raw_text)
        code_only = strip_js_comments_preserve_lines(cleaned_text)
        lines = raw_text.splitlines()

        # 1. FORBID-01, FORBID-02, FORBID-03, FORBID-06 across Prologue code/copy
        for rule_id, rule_desc, pattern in REDLINE_PATTERNS:
            for match in pattern.finditer(cleaned_text):
                line_no = cleaned_text[: match.start()].count("\n") + 1
                snippet = lines[line_no - 1].strip() if 0 <= line_no - 1 < len(lines) else match.group(0)
                violations.append(
                    {
                        "ruleId": rule_id,
                        "file": rel,
                        "line": line_no,
                        "match": match.group(0),
                        "message": f"{rule_id} ({rule_desc}): matched '{match.group(0)}' at {rel}:{line_no}",
                        "snippet": snippet[:160],
                    }
                )

        # 2. FORBID-04: no startStationAmbience() / startSanctuaryAmbience() call in Prologue modules
        for match in STATION_AMBIENCE_CALL_RE.finditer(code_only):
            line_no = code_only[: match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if 0 <= line_no - 1 < len(lines) else match.group(0)
            violations.append(
                {
                    "ruleId": "FORBID-04",
                    "file": rel,
                    "line": line_no,
                    "match": match.group(0),
                    "message": f"FORBID-04: prohibited ambience call '{match.group(0)}' at {rel}:{line_no}",
                    "snippet": snippet[:160],
                }
            )

        # 3. Render invariant: never assign needDepthPrePass to true in Prologue files (raw text, matching check.mjs)
        for match in DEPTH_PREPASS_TRUE_RE.finditer(raw_text):
            line_no = raw_text[: match.start()].count("\n") + 1
            snippet = lines[line_no - 1].strip() if 0 <= line_no - 1 < len(lines) else match.group(0)
            violations.append(
                {
                    "ruleId": "RENDER-DEPTH-PREPASS",
                    "file": rel,
                    "line": line_no,
                    "match": match.group(0),
                    "message": f"Render invariant violation: needDepthPrePass set true at {rel}:{line_no}",
                    "snippet": snippet[:160],
                }
            )

        # 4. Pure-core isolation check on src/core/prologue-timeline.js (raw text, matching check.mjs)
        if rel == "src/core/prologue-timeline.js":
            for match in PURE_CORE_FORBIDDEN_RE.finditer(raw_text):
                line_no = raw_text[: match.start()].count("\n") + 1
                snippet = lines[line_no - 1].strip() if 0 <= line_no - 1 < len(lines) else match.group(0)
                violations.append(
                    {
                        "ruleId": "PURE-CORE",
                        "file": rel,
                        "line": line_no,
                        "match": match.group(0),
                        "message": f"Pure-core violation in {rel}:{line_no}: forbidden token '{match.group(0)}'",
                        "snippet": snippet[:160],
                    }
                )

    # 5. Global FORBID-06 import scan across all JS/MJS under src/, scripts/, tests/
    for folder_name in ("src", "scripts", "tests"):
        folder = repo_root / folder_name
        if not folder.is_dir():
            continue
        for js_file in sorted(folder.rglob("*")):
            if not js_file.is_file() or js_file.suffix not in (".js", ".mjs"):
                continue
            rel = str(js_file.relative_to(repo_root))
            raw_text = js_file.read_text(encoding="utf-8")
            code_only = strip_js_comments_preserve_lines(strip_forbidden_pattern_declarations(raw_text))
            for match in MIGRATION_IMPORT_RE.finditer(code_only):
                line_no = code_only[: match.start()].count("\n") + 1
                violations.append(
                    {
                        "ruleId": "FORBID-06",
                        "file": rel,
                        "line": line_no,
                        "match": match.group(0),
                        "message": f"FORBID-06: prohibited migration/chapter1-4d-space import at {rel}:{line_no}",
                        "snippet": match.group(0)[:160],
                    }
                )

    return {
        "passed": len(violations) == 0,
        "scannedFiles": [str(p.relative_to(repo_root)) for p in scanned_files],
        "violations": violations,
    }


# ---------------------------------------------------------------------------
# Ephemeral Local Server Lifecycle (Zero Port Conflict, Guaranteed Teardown)
# ---------------------------------------------------------------------------


def find_free_port(host: str = "127.0.0.1") -> int:
    """Bind to port 0 on localhost to select a guaranteed unused ephemeral port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return int(sock.getsockname()[1])


class _QuietStaticHandler(http.server.SimpleHTTPRequestHandler):
    """Static HTTP handler for `_site/` with guaranteed ES module MIME types and no-cache headers."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".ico": "image/x-icon",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return


class EphemeralServer:
    """Manages an ephemeral `scripts/serve.mjs` subprocess or `_site/` static HTTP server."""

    def __init__(self, repo_root: Path, built_site: bool = False) -> None:
        self.repo_root = repo_root
        self.built_site = built_site
        self.host = "127.0.0.1"
        self.port: int | None = None
        self._proc: subprocess.Popen[bytes] | None = None
        self._log_file: Any = None
        self._httpd: http.server.ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def entry_url(self) -> str:
        assert self.port is not None
        return f"http://{self.host}:{self.port}/src/ui/index.html"

    def start(self) -> str:
        if self.built_site:
            site_dir = self.repo_root / "_site"
            index_html = site_dir / "src" / "ui" / "index.html"
            if not index_html.is_file():
                raise RuntimeError(
                    f"--built-site requested, but {index_html} does not exist. Run `npm run build:site` first."
                )
            handler_cls = functools.partial(_QuietStaticHandler, directory=str(site_dir))
            # Port 0 directly lets OS bind atomically without TOCTOU race
            self._httpd = http.server.ThreadingHTTPServer((self.host, 0), handler_cls)
            self.port = int(self._httpd.server_address[1])
            self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
            self._thread.start()
            self._wait_http_ready(self.entry_url, timeout_sec=10.0)
            return self.entry_url

        # Repo root mode: pick free non-zero port first (serve.mjs treats PORT=0 as falsy -> 4173!)
        self.port = find_free_port(self.host)
        serve_script = self.repo_root / "scripts" / "serve.mjs"
        if not serve_script.is_file():
            raise RuntimeError(f"Missing dev server script: {serve_script}")

        env = os.environ.copy()
        env["HOST"] = self.host
        env["PORT"] = str(self.port)

        self._log_file = tempfile.TemporaryFile(mode="w+b")
        self._proc = subprocess.Popen(
            ["node", str(serve_script)],
            cwd=str(self.repo_root),
            env=env,
            stdout=self._log_file,
            stderr=self._log_file,
        )
        try:
            self._wait_http_ready(self.entry_url, timeout_sec=12.0)
        except Exception:
            self.stop()
            raise
        return self.entry_url

    def _wait_http_ready(self, url: str, timeout_sec: float = 10.0) -> None:
        deadline = time.monotonic() + timeout_sec
        last_err: Exception | None = None
        while time.monotonic() < deadline:
            if self._proc is not None and self._proc.poll() is not None:
                log_out = self._read_proc_log()
                raise RuntimeError(
                    f"Ephemeral serve.mjs exited prematurely with code {self._proc.returncode}:\n{log_out}"
                )
            try:
                with urllib.request.urlopen(url, timeout=1.5) as resp:
                    if 200 <= resp.status < 400:
                        return
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_err = exc
            time.sleep(0.1)
        log_out = self._read_proc_log()
        raise RuntimeError(f"Timed out waiting for ephemeral server at {url}: {last_err}\n{log_out}")

    def _read_proc_log(self) -> str:
        if self._log_file is None:
            return ""
        try:
            self._log_file.flush()
            self._log_file.seek(0)
            return self._log_file.read().decode("utf-8", errors="replace").strip()
        except Exception:
            return ""

    def stop(self) -> None:
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
                self._httpd.server_close()
            except Exception:
                pass
            self._httpd = None
        if self._thread is not None:
            self._thread.join(timeout=3.0)
            self._thread = None
        if self._proc is not None:
            if self._proc.poll() is None:
                self._proc.terminate()
                try:
                    self._proc.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    self._proc.kill()
                    self._proc.wait(timeout=3.0)
            self._proc = None
        if self._log_file is not None:
            try:
                self._log_file.close()
            except Exception:
                pass
            self._log_file = None


def build_audit_url(base_url: str) -> str:
    """Ensure the URL targets `/src/ui/index.html` and carries `level=0&audit=1&holdEnd=1`."""
    parsed = urllib.parse.urlsplit(base_url.strip())
    path = parsed.path or "/"
    if path in ("/", ""):
        path = "/src/ui/index.html"
    elif not path.endswith(".html"):
        path = path.rstrip("/") + "/src/ui/index.html"
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query["level"] = ["0"]
    query["audit"] = ["1"]
    query["holdEnd"] = ["1"]
    encoded_query = urllib.parse.urlencode(query, doseq=True)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, encoded_query, parsed.fragment))


# ---------------------------------------------------------------------------
# Layer 2 — Browser DOM Geometry & Telemetry Inspection Helpers
# ---------------------------------------------------------------------------

DOM_INSPECTION_JS = r"""() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const op = parseFloat(style.opacity || '1');
    if (!Number.isFinite(op) || op <= 0.04) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  function rectInfo(el) {
    if (!el) return null;
    const style = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const op = parseFloat(style.opacity || '1');
    const vis = !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && op > 0.04 && r.width > 1 && r.height > 1;
    return {
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      visible: vis,
      opacity: Number.isFinite(op) ? Number(op.toFixed(3)) : 1,
      left: Number(r.left.toFixed(2)),
      top: Number(r.top.toFixed(2)),
      right: Number(r.right.toFixed(2)),
      bottom: Number(r.bottom.toFixed(2)),
      width: Number(r.width.toFixed(2)),
      height: Number(r.height.toFixed(2)),
      text: (el.innerText || el.textContent || '').trim(),
    };
  }

  function findFirst(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function findVisibleByText(root, regex) {
    if (!root) return null;
    const nodes = root.querySelectorAll('div, section, aside, p, button, span');
    let best = null;
    for (const n of nodes) {
      if (!isVisible(n)) continue;
      const t = (n.innerText || '').trim();
      if (!t || !regex.test(t)) continue;
      // Prefer tighter leaf/widget containers over the entire cinema layer
      if (n.id === 'prologue-cinema-layer') continue;
      const r = n.getBoundingClientRect();
      if (r.width >= vw * 0.98 && r.height >= vh * 0.98) continue;
      if (!best || (r.width * r.height < best.getBoundingClientRect().width * best.getBoundingClientRect().height)) {
        best = n;
      }
    }
    return best;
  }

  const cinemaLayer = document.getElementById('prologue-cinema-layer') || document.querySelector('.prologue-cinema-layer');
  const scope = cinemaLayer || document;

  const topBar = findFirst([
    '#prologue-letterbox-top',
    '[data-prologue-role="letterbox-top"]',
    '.prologue-letterbox-top',
    '.prologue-letterbox--top',
    '.letterbox-top',
  ], scope);

  const bottomBar = findFirst([
    '#prologue-letterbox-bottom',
    '[data-prologue-role="letterbox-bottom"]',
    '.prologue-letterbox-bottom',
    '.prologue-letterbox--bottom',
    '.letterbox-bottom',
  ], scope);

  const whiteout = findFirst([
    '#prologue-whiteout',
    '[data-prologue-role="whiteout"]',
    '.prologue-whiteout',
  ], scope);

  const openingTitles = findFirst([
    '#prologue-opening-titles',
    '#prologue-titles',
    '#prologue-s0a-titles',
    '[data-prologue-role="opening-titles"]',
    '.prologue-opening-titles',
    '.prologue-titles',
  ], scope) || findVisibleByText(cinemaLayer, /离开太阳系后/);

  const coordCard = findFirst([
    '#prologue-coord-card',
    '#prologue-s0c-card',
    '[data-prologue-role="coord-card"]',
    '.prologue-coord-card',
  ], scope) || findVisibleByText(cinemaLayer, /星舰纪元\s*47\s*年/);

  const spectrometer = findFirst([
    '#prologue-spectrometer',
    '#prologue-s3-spectrometer',
    '[data-prologue-role="spectrometer"]',
    '.prologue-spectrometer',
  ], scope) || findVisibleByText(cinemaLayer, /量子引力|引力波频谱|语义解析率|14%/);

  const spectrometerCanvas = spectrometer
    ? spectrometer.querySelector('canvas')
    : findFirst(['#prologue-spectrometer-canvas', '.prologue-spectrometer canvas', 'canvas'], cinemaLayer || document.createElement('div'));

  let subtitle = findFirst([
    '#prologue-subtitle',
    '#prologue-subtitle-bar',
    '#prologue-cinema-subtitle',
    '[data-prologue-role="subtitle"]',
    '.prologue-subtitle',
    '.prologue-subtitle-bar',
  ], scope);
  if (!subtitle || !isVisible(subtitle)) {
    const fallbackSub = document.getElementById('subtitle-bar');
    if (fallbackSub && isVisible(fallbackSub)) {
      subtitle = fallbackSub;
    }
  }

  let skipBtn = findFirst([
    '#prologue-skip-btn',
    '#btn-prologue-skip',
    '#btn-skip-prologue',
    '#prologue-skip-pill',
    '[data-prologue-role="skip-btn"]',
    '.prologue-skip-btn',
    '.prologue-skip-pill',
    '.prologue-skip',
  ], scope);
  if (!skipBtn) {
    const btns = (cinemaLayer || document).querySelectorAll('button, [role="button"], .prologue-skip');
    for (const b of btns) {
      if (isVisible(b) && /Space|跳过/.test(b.innerText || b.textContent || '')) {
        skipBtn = b;
        break;
      }
    }
  }

  // Standard gameplay HUD elements MUST be hidden during Prologue
  const forbiddenHudSelectors = [
    '.hud-top-left',
    '.hud-top-right',
    '#reticle',
    '#tactical-wrapper',
    '#control-strip',
    '#ch1-compass',
  ];
  const visibleStandardHud = [];
  for (const sel of forbiddenHudSelectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) {
      visibleStandardHud.push(sel);
    }
  }

  return {
    viewport: { width: vw, height: vh },
    bodyIsPrologue: document.body.classList.contains('is-prologue'),
    cinemaLayerPresent: Boolean(cinemaLayer),
    cinemaLayerVisible: isVisible(cinemaLayer),
    letterboxTop: rectInfo(topBar),
    letterboxBottom: rectInfo(bottomBar),
    whiteout: rectInfo(whiteout),
    openingTitles: rectInfo(openingTitles),
    coordCard: rectInfo(coordCard),
    spectrometer: rectInfo(spectrometer),
    spectrometerCanvas: rectInfo(spectrometerCanvas),
    subtitle: rectInfo(subtitle),
    skipBtn: rectInfo(skipBtn),
    visibleStandardHud,
    visibleBodyText: (document.body.innerText || '').trim(),
    cinemaLayerText: cinemaLayer ? (cinemaLayer.innerText || '').trim() : '',
  };
}"""


def rects_overlap(a: dict[str, Any] | None, b: dict[str, Any] | None, tol: float = 2.0) -> bool:
    """Return True if two visible DOM rects intersect by more than `tol` pixels."""
    if not a or not b or not a.get("visible") or not b.get("visible"):
        return False
    return (
        a["left"] < b["right"] - tol
        and a["right"] > b["left"] + tol
        and a["top"] < b["bottom"] - tol
        and a["bottom"] > b["top"] + tol
    )


def rect_within_viewport(r: dict[str, Any] | None, tol: float = 2.0) -> bool:
    if not r or not r.get("visible"):
        return True
    return (
        r["left"] >= -tol
        and r["top"] >= -tol
        and r["right"] <= VIEWPORT_WIDTH + tol
        and r["bottom"] <= VIEWPORT_HEIGHT + tol
    )


def normalize_count(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    return -1


def check_live_dom_redlines(text: str, kf_id: str) -> list[str]:
    failures: list[str] = []
    if not text:
        return failures
    for rule_id, rule_desc, pattern in REDLINE_PATTERNS:
        m = pattern.search(text)
        if m:
            failures.append(f"{kf_id}: Live DOM redline {rule_id} ({rule_desc}) matched '{m.group(0)}'")
    return failures


# ---------------------------------------------------------------------------
# Layer 3 — Pillow Pixel Assertions
# ---------------------------------------------------------------------------


def analyze_keyframe_pixels(
    png_path: Path,
    kf: KeyframeSpec,
    prev_active_rgb: Image.Image | None,
) -> tuple[dict[str, Any], list[str], Image.Image]:
    """Compute Pillow image statistics and enforce Layer 3 pixel assertions."""
    failures: list[str] = []
    with Image.open(png_path) as raw_img:
        width, height = raw_img.size
        rgb = raw_img.convert("RGB")
        luma = raw_img.convert("L")

    if (width, height) != (VIEWPORT_WIDTH, VIEWPORT_HEIGHT):
        failures.append(
            f"{kf.kf_id}: Expected PNG dimensions {VIEWPORT_WIDTH}x{VIEWPORT_HEIGHT}, got {width}x{height}"
        )

    full_stat = ImageStat.Stat(luma)
    top_stat = ImageStat.Stat(luma.crop(TOP_BAR_BOX))
    bot_stat = ImageStat.Stat(luma.crop(BOTTOM_BAR_BOX))

    active_luma = luma.crop(ACTIVE_CINEMA_BOX)
    active_rgb = rgb.crop(ACTIVE_CINEMA_BOX)
    active_luma_stat = ImageStat.Stat(active_luma)
    active_rgb_stat = ImageStat.Stat(active_rgb)

    min_luma, max_luma = active_luma.getextrema()
    _, center_max_luma = luma.crop(CENTER_TEXT_ROI).getextrema()

    mean_luma = float(full_stat.mean[0])
    std_luma = float(full_stat.stddev[0])
    active_mean_luma = float(active_luma_stat.mean[0])
    active_std_luma = float(active_luma_stat.stddev[0])
    active_rgb_mean = [round(float(v), 2) for v in active_rgb_stat.mean]
    active_rgb_max_std = float(max(active_rgb_stat.stddev))
    top_bar_luma = float(top_stat.mean[0])
    bot_bar_luma = float(bot_stat.mean[0])

    mad_from_prev: float | None = None
    if prev_active_rgb is not None and prev_active_rgb.size == active_rgb.size:
        diff = ImageChops.difference(active_rgb, prev_active_rgb)
        diff_stat = ImageStat.Stat(diff)
        mad_from_prev = float(sum(diff_stat.mean) / 3.0)

    kf_num = int(kf.kf_id.split("-")[1])

    if kf.kf_id == "KF-18":
        # Pure polar-day whiteout check
        if mean_luma < 215.0:
            failures.append(
                f"{kf.kf_id}: Polar-day whiteout full-frame meanLuma={mean_luma:.2f} < 215.0"
            )
        if active_mean_luma < 215.0:
            failures.append(
                f"{kf.kf_id}: Polar-day whiteout activeMeanLuma={active_mean_luma:.2f} < 215.0"
            )
    else:
        # Non-solid-color check (prevents blank / solid-fill / crashed WebGL buffer)
        if active_std_luma <= 1.0 or (max_luma - min_luma) < 15:
            failures.append(
                f"{kf.kf_id}: Active cinema band appears solid/flat (activeStdLuma={active_std_luma:.2f}, range={min_luma}..{max_luma})"
            )

        # 2.35:1 top & bottom letterbox black bar luma check (< 18)
        if top_bar_luma >= 18.0:
            failures.append(
                f"{kf.kf_id}: Top letterbox bar mean luma={top_bar_luma:.2f} >= 18.0 (expected black bar)"
            )
        if bot_bar_luma >= 18.0:
            failures.append(
                f"{kf.kf_id}: Bottom letterbox bar mean luma={bot_bar_luma:.2f} >= 18.0 (expected black bar)"
            )

        # Active 2.35:1 cinema band luminance bounds
        if kf_num <= 2:
            # S0A dark cosmic dust + crisp centered Chinese titles
            if center_max_luma < 120:
                failures.append(
                    f"{kf.kf_id}: S0A center title ROI max luma={center_max_luma} < 120 (titles too dim/missing)"
                )
            if active_mean_luma >= 140.0:
                failures.append(
                    f"{kf.kf_id}: S0A active band unexpectedly bright (activeMeanLuma={active_mean_luma:.2f})"
                )
        else:
            # KF-03..KF-17: neither pure black (> 6) nor blown-out solid white (< 245)
            if active_mean_luma <= 6.0:
                failures.append(
                    f"{kf.kf_id}: Active cinema band is near-black (activeMeanLuma={active_mean_luma:.2f} <= 6.0)"
                )
            if active_mean_luma >= 245.0:
                failures.append(
                    f"{kf.kf_id}: Active cinema band is blown-out white (activeMeanLuma={active_mean_luma:.2f} >= 245.0)"
                )
            if kf.kf_id == "KF-06" and center_max_luma < 120:
                failures.append(
                    f"{kf.kf_id}: S0C coordinate card center ROI max luma={center_max_luma} < 120"
                )

    # Inter-frame delta sanity check (catches frozen WebGL framebuffer)
    if mad_from_prev is not None and mad_from_prev < 0.25:
        failures.append(
            f"{kf.kf_id}: Frame appears frozen/identical to previous keyframe (MAD={mad_from_prev:.3f} < 0.25)"
        )

    stats = {
        "width": width,
        "height": height,
        "meanLuma": round(mean_luma, 2),
        "stdLuma": round(std_luma, 2),
        "activeMeanLuma": round(active_mean_luma, 2),
        "activeStdLuma": round(active_std_luma, 2),
        "activeRgbMean": active_rgb_mean,
        "activeRgbMaxStd": round(active_rgb_max_std, 2),
        "letterboxTopLuma": round(top_bar_luma, 2),
        "letterboxBottomLuma": round(bot_bar_luma, 2),
        "minLuma": int(min_luma),
        "maxLuma": int(max_luma),
        "centerMaxLuma": int(center_max_luma),
        "madFromPrev": round(mad_from_prev, 2) if mad_from_prev is not None else None,
    }
    return stats, failures, active_rgb


# ---------------------------------------------------------------------------
# Per-Keyframe Telemetry & DOM Assertions
# ---------------------------------------------------------------------------


def evaluate_keyframe_assertions(
    kf: KeyframeSpec,
    telemetry: dict[str, Any],
    dom: dict[str, Any],
) -> list[str]:
    """Validate Contract F telemetry, Quality Spec v1.0 metrics, DOM geometry, and redlines."""
    failures: list[str] = []

    if not isinstance(telemetry, dict):
        return [f"{kf.kf_id}: getPrologueTelemetry() returned non-object: {telemetry!r}"]

    # 1. Exact timestamp & shot alignment
    elapsed = telemetry.get("elapsedSec")
    if not isinstance(elapsed, (int, float)) or abs(float(elapsed) - kf.t_sec) > 0.08:
        failures.append(f"{kf.kf_id}: elapsedSec={elapsed!r}, expected {kf.t_sec:.2f} (±0.08)")
    if telemetry.get("segmentId") != kf.segment_id:
        failures.append(f"{kf.kf_id}: segmentId={telemetry.get('segmentId')!r}, expected {kf.segment_id!r}")
    if telemetry.get("shotId") != kf.shot_id:
        failures.append(f"{kf.kf_id}: shotId={telemetry.get('shotId')!r}, expected {kf.shot_id!r}")
    if telemetry.get("subBeatId") is not None and telemetry.get("subBeatId") != kf.sub_beat_id:
        failures.append(f"{kf.kf_id}: subBeatId={telemetry.get('subBeatId')!r}, expected {kf.sub_beat_id!r}")

    # 2. Universal audio / redline telemetry (FORBID-04, FORBID-05)
    if telemetry.get("shipHumActive") is not False:
        failures.append(f"{kf.kf_id}: FORBID-04 shipHumActive={telemetry.get('shipHumActive')!r} (must be False)")
    if telemetry.get("stationAmbienceActive") is not False:
        failures.append(
            f"{kf.kf_id}: FORBID-04 stationAmbienceActive={telemetry.get('stationAmbienceActive')!r} (must be False)"
        )
    if telemetry.get("tombTtsCount") != 0:
        failures.append(f"{kf.kf_id}: FORBID-05 tombTtsCount={telemetry.get('tombTtsCount')!r} (must be 0)")

    # 3. Universal Quality Spec v1.0 rendering metrics
    ghost_count = normalize_count(telemetry.get("ghostViolations"))
    if ghost_count != 0:
        failures.append(
            f"{kf.kf_id}: Ghost material invariant failed: ghostViolations={telemetry.get('ghostViolations')!r}"
        )
    if telemetry.get("envTex") is not True:
        failures.append(f"{kf.kf_id}: envTex={telemetry.get('envTex')!r} (expected True)")
    if telemetry.get("fogMode") != 2:
        failures.append(f"{kf.kf_id}: fogMode={telemetry.get('fogMode')!r} (expected 2 / FOGMODE_EXP2)")
    post_proc_count = normalize_count(telemetry.get("postProcs"))
    if post_proc_count < 1:
        failures.append(f"{kf.kf_id}: postProcs={telemetry.get('postProcs')!r} (expected >= 1)")
    particle_count = normalize_count(telemetry.get("particles"))
    if particle_count < 1:
        failures.append(f"{kf.kf_id}: particles={telemetry.get('particles')!r} (expected >= 1)")
    pbr_count = telemetry.get("pbrCount")
    if not isinstance(pbr_count, (int, float)) or pbr_count < 4:
        failures.append(f"{kf.kf_id}: pbrCount={pbr_count!r} (expected >= 4)")

    # 4. Standard gameplay HUD must remain hidden during Prologue
    visible_std_hud = dom.get("visibleStandardHud") or []
    if visible_std_hud:
        failures.append(f"{kf.kf_id}: Standard gameplay HUD leaked during Prologue: {visible_std_hud}")

    # 5. Live DOM redline scan (FORBID-01, FORBID-02, FORBID-03, FORBID-06)
    failures.extend(check_live_dom_redlines(dom.get("visibleBodyText", ""), kf.kf_id))
    failures.extend(check_live_dom_redlines(dom.get("cinemaLayerText", ""), kf.kf_id))

    # 6. 2.35:1 Letterbox geometry & skip pill checks
    lb_ratio = telemetry.get("letterboxRatio")
    top_bar = dom.get("letterboxTop")
    bot_bar = dom.get("letterboxBottom")

    if kf.kf_id != "KF-18":
        if not isinstance(lb_ratio, (int, float)) or float(lb_ratio) < 0.98:
            failures.append(f"{kf.kf_id}: letterboxRatio={lb_ratio!r} (expected ~1.0 across [0, 71.0])")
        if not top_bar or not top_bar.get("visible"):
            failures.append(f"{kf.kf_id}: Top 2.35:1 letterbox bar is missing or hidden")
        elif not (80.0 <= top_bar["height"] <= 96.0):
            failures.append(
                f"{kf.kf_id}: Top letterbox bar height={top_bar['height']}px outside expected [80, 96]px"
            )
        if not bot_bar or not bot_bar.get("visible"):
            failures.append(f"{kf.kf_id}: Bottom 2.35:1 letterbox bar is missing or hidden")
        elif not (80.0 <= bot_bar["height"] <= 96.0):
            failures.append(
                f"{kf.kf_id}: Bottom letterbox bar height={bot_bar['height']}px outside expected [80, 96]px"
            )
        if telemetry.get("skipBtnVisible") is not True:
            failures.append(f"{kf.kf_id}: skipBtnVisible={telemetry.get('skipBtnVisible')!r} (expected True before S6)")
    else:
        # KF-18 (S6, t=73.5s): letterbox smoothly retracting toward 0, strictly ZERO subtitle!
        if not isinstance(lb_ratio, (int, float)) or float(lb_ratio) >= 0.6:
            failures.append(f"{kf.kf_id}: S6 letterboxRatio={lb_ratio!r} (expected < 0.6 retracting toward 0)")
        if top_bar and top_bar.get("visible") and top_bar["height"] >= 60.0:
            failures.append(
                f"{kf.kf_id}: S6 top letterbox bar height={top_bar['height']}px has not retracted (< 60px)"
            )
        if bot_bar and bot_bar.get("visible") and bot_bar["height"] >= 60.0:
            failures.append(
                f"{kf.kf_id}: S6 bottom letterbox bar height={bot_bar['height']}px has not retracted (< 60px)"
            )
        if telemetry.get("activeSubtitle") is not None:
            failures.append(
                f"{kf.kf_id}: FORBID-01 S6 activeSubtitle={telemetry.get('activeSubtitle')!r} (must be null)"
            )
        sub_dom = dom.get("subtitle")
        if sub_dom and sub_dom.get("visible") and sub_dom.get("text"):
            failures.append(f"{kf.kf_id}: FORBID-01 S6 subtitle DOM visible with text '{sub_dom['text']}'")

    # 7. Safe-area zero-overlap & viewport bounds checks
    sub_dom = dom.get("subtitle")
    skip_dom = dom.get("skipBtn")
    spec_dom = dom.get("spectrometer")
    titles_dom = dom.get("openingTitles")
    coord_dom = dom.get("coordCard")

    for widget_name, widget_rect in (
        ("subtitle", sub_dom),
        ("skipBtn", skip_dom),
        ("spectrometer", spec_dom),
        ("openingTitles", titles_dom),
        ("coordCard", coord_dom),
    ):
        if widget_rect and widget_rect.get("visible") and not rect_within_viewport(widget_rect):
            failures.append(f"{kf.kf_id}: DOM widget '{widget_name}' clipped outside 1280x720 viewport: {widget_rect}")

    if sub_dom and sub_dom.get("visible") and sub_dom.get("text"):
        if rects_overlap(sub_dom, skip_dom):
            failures.append(f"{kf.kf_id}: Subtitle overlaps skip pill ({sub_dom} vs {skip_dom})")
        if rects_overlap(sub_dom, spec_dom):
            failures.append(f"{kf.kf_id}: Subtitle overlaps spectrometer ({sub_dom} vs {spec_dom})")
        if rects_overlap(sub_dom, titles_dom):
            failures.append(f"{kf.kf_id}: Subtitle overlaps S0A opening titles ({sub_dom} vs {titles_dom})")
        if rects_overlap(sub_dom, coord_dom):
            failures.append(f"{kf.kf_id}: Subtitle overlaps S0C coord card ({sub_dom} vs {coord_dom})")
        if top_bar and top_bar.get("visible") and sub_dom["top"] < top_bar["bottom"] - 2.0:
            failures.append(
                f"{kf.kf_id}: Subtitle overlaps top letterbox bar (sub.top={sub_dom['top']} < topBar.bottom={top_bar['bottom']})"
            )
        # Subtitle may cleanly sit either wholly inside the bottom letterbox bar OR wholly above it,
        # but MUST NEVER awkwardly straddle the bottom letterbox border.
        if (
            bot_bar
            and bot_bar.get("visible")
            and sub_dom["top"] < bot_bar["top"] - 4.0
            and sub_dom["bottom"] > bot_bar["top"] + 4.0
        ):
            failures.append(
                f"{kf.kf_id}: Subtitle straddles bottom letterbox border "
                f"(sub=[{sub_dom['top']}, {sub_dom['bottom']}], botBar.top={bot_bar['top']})"
            )

    if spec_dom and spec_dom.get("visible"):
        if rects_overlap(spec_dom, skip_dom):
            failures.append(f"{kf.kf_id}: Spectrometer overlaps skip pill ({spec_dom} vs {skip_dom})")
        if top_bar and top_bar.get("visible") and spec_dom["top"] < top_bar["bottom"] - 2.0:
            failures.append(f"{kf.kf_id}: Spectrometer overlaps top letterbox bar")
        if bot_bar and bot_bar.get("visible") and spec_dom["bottom"] > bot_bar["top"] + 4.0:
            failures.append(
                f"{kf.kf_id}: Spectrometer overlaps bottom letterbox bar "
                f"(spec.bottom={spec_dom['bottom']} > botBar.top={bot_bar['top']})"
            )

    # 8. Shot-specific assertions
    if kf.kf_id == "KF-01":
        alphas = telemetry.get("openingLinesAlpha")
        if not isinstance(alphas, list) or len(alphas) < 1 or float(alphas[0]) < 0.9:
            failures.append(f"{kf.kf_id}: openingLinesAlpha={alphas!r} (expected [0] >= 0.9)")
        if not titles_dom or not titles_dom.get("visible"):
            failures.append(f"{kf.kf_id}: S0A opening titles DOM element not visible")
        elif "离开太阳系后" not in titles_dom.get("text", ""):
            failures.append(f"{kf.kf_id}: S0A opening titles missing line 1 text")

    elif kf.kf_id == "KF-02":
        alphas = telemetry.get("openingLinesAlpha")
        if not isinstance(alphas, list) or len(alphas) < 3 or any(float(a) < 0.9 for a in alphas[:3]):
            failures.append(f"{kf.kf_id}: openingLinesAlpha={alphas!r} (expected all 3 >= 0.9)")
        if not titles_dom or not titles_dom.get("visible"):
            failures.append(f"{kf.kf_id}: S0A 3-line opening titles DOM element not visible")
        if telemetry.get("activeSubtitle") is None:
            failures.append(f"{kf.kf_id}: Expected narrator activeSubtitle at 8.5s, got None")

    elif kf.kf_id == "KF-03":
        if normalize_count(telemetry.get("shadowGens")) < 1:
            failures.append(f"{kf.kf_id}: S0B-1 expected PCF shadowGens >= 1, got {telemetry.get('shadowGens')!r}")

    elif kf.kf_id == "KF-06":
        cc_alpha = telemetry.get("coordCardAlpha")
        if not isinstance(cc_alpha, (int, float)) or float(cc_alpha) < 0.9:
            failures.append(f"{kf.kf_id}: S0C coordCardAlpha={cc_alpha!r} (expected >= 0.9)")
        if not coord_dom or not coord_dom.get("visible"):
            failures.append(f"{kf.kf_id}: S0C coordinate card DOM element not visible")
        else:
            coord_txt = coord_dom.get("text", "")
            if "47" not in coord_txt or "412" not in coord_txt:
                failures.append(f"{kf.kf_id}: S0C coord card text missing '47'/'412': {coord_txt!r}")

    elif kf.kf_id == "KF-07":
        if normalize_count(telemetry.get("mirrorTex")) < 1:
            failures.append(f"{kf.kf_id}: S1 expected cabin mirrorTex >= 1, got {telemetry.get('mirrorTex')!r}")
        if normalize_count(telemetry.get("shadowGens")) < 1:
            failures.append(f"{kf.kf_id}: S1 expected shadowGens >= 1, got {telemetry.get('shadowGens')!r}")
        sub = telemetry.get("activeSubtitle")
        if not isinstance(sub, dict) or sub.get("speakerId") != "linxia":
            failures.append(f"{kf.kf_id}: S1 expected linxia activeSubtitle, got {sub!r}")

    elif kf.kf_id == "KF-08":
        if "alertLevel" in telemetry and float(telemetry["alertLevel"]) > 0.01:
            failures.append(
                f"{kf.kf_id}: S2 unaware crossing must have alertLevel===0, got {telemetry['alertLevel']!r}"
            )

    elif kf.kf_id == "KF-09":
        if "alertLevel" in telemetry and float(telemetry["alertLevel"]) <= 0.5:
            failures.append(
                f"{kf.kf_id}: S2 +2.0s predictive alert expected alertLevel > 0.5, got {telemetry['alertLevel']!r}"
            )
        sub = telemetry.get("activeSubtitle")
        if not isinstance(sub, dict) or sub.get("speakerId") != "ship_ai":
            failures.append(f"{kf.kf_id}: S2 +2.0s alert expected ship_ai activeSubtitle, got {sub!r}")

    elif kf.kf_id == "KF-12":
        if telemetry.get("spectrometerVisible") is not True:
            failures.append(
                f"{kf.kf_id}: S3 spectrometerVisible={telemetry.get('spectrometerVisible')!r} (expected True)"
            )
        bars = telemetry.get("spectrometerBars")
        if not isinstance(bars, list) or len(bars) != 48:
            failures.append(
                f"{kf.kf_id}: S3 spectrometerBars length={len(bars) if isinstance(bars, list) else type(bars).__name__} (expected 48)"
            )
        else:
            bar_vals = [float(b) for b in bars]
            bar_spread = max(bar_vals) - min(bar_vals)
            if bar_spread <= 0.15:
                failures.append(
                    f"{kf.kf_id}: S3 spectrometer bars too flat (max-min={bar_spread:.3f} <= 0.15)"
                )
        spec_text = str(telemetry.get("spectrometerText") or "")
        dom_text = (spec_dom.get("text", "") if spec_dom else "") + " " + dom.get("cinemaLayerText", "")
        combined_spec_text = f"{spec_text} {dom_text}"
        for token in ("14%", "干涸", "海"):
            if token not in combined_spec_text:
                failures.append(
                    f"{kf.kf_id}: S3 spectrometer readout missing required token '{token}' (telemetry={spec_text!r})"
                )
        if not spec_dom or not spec_dom.get("visible"):
            failures.append(f"{kf.kf_id}: S3 spectrometer DOM overlay not visible")

    elif kf.kf_id == "KF-15":
        sub = telemetry.get("activeSubtitle")
        if not isinstance(sub, dict) or sub.get("speakerId") != "linxia":
            failures.append(f"{kf.kf_id}: S4-1 expected linxia activeSubtitle at 59.8s, got {sub!r}")

    elif kf.kf_id == "KF-17":
        if telemetry.get("activeSubtitle") is not None:
            failures.append(f"{kf.kf_id}: S5 expected null activeSubtitle, got {telemetry.get('activeSubtitle')!r}")

    return failures


# ---------------------------------------------------------------------------
# Layer 2/3 Runner (Single-Page Headless Playwright Chromium + SwiftShader)
# ---------------------------------------------------------------------------


def wait_for_prologue_ready(page: Any, timeout_sec: float = 25.0) -> None:
    """Wait for window.__BEYOND3D__ + seekPrologue/getPrologueTelemetry + Babylon scene readiness."""
    page.wait_for_function(
        """() => {
            const b = window.__BEYOND3D__;
            return Boolean(
                b &&
                b.engine &&
                b.scene &&
                b.actions &&
                typeof b.actions.seekPrologue === 'function' &&
                typeof b.actions.getPrologueTelemetry === 'function'
            );
        }""",
        timeout=int(timeout_sec * 1000),
    )
    # Defensively guarantee render loop is paused under audit mode
    page.evaluate("() => { if (window.__BEYOND3D__?.engine) window.__BEYOND3D__.engine.stopRenderLoop(); }")

    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        ready = page.evaluate("() => Boolean(window.__BEYOND3D__?.scene?.isReady())")
        if ready:
            return
        time.sleep(0.05)


def seek_prologue_frame(page: Any, t_sec: float, warmup_ticks: int) -> None:
    """Deterministically seek Prologue to `t_sec` and wait 1 animation frame for DOM paint."""
    page.evaluate(
        """async ([tSec, warmupTicks]) => {
            const actions = window.__BEYOND3D__.actions;
            const res = actions.seekPrologue(tSec, { warmupTicks });
            if (res && typeof res.then === 'function') {
                await res;
            }
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }""",
        [t_sec, warmup_ticks],
    )


def capture_cdp_png(cdp: Any, png_path: Path) -> None:
    res = cdp.send("Page.captureScreenshot", {"format": "png"})
    png_path.write_bytes(base64.b64decode(res["data"]))


def run_s6_retraction_probe(page: Any, warmup_ticks: int) -> tuple[dict[str, Any], list[str]]:
    """Verify at t=74.6s that S6 letterbox bars have retracted toward 0 and subtitle stays null."""
    failures: list[str] = []
    seek_prologue_frame(page, 74.6, min(warmup_ticks, 6))
    telemetry = page.evaluate("() => window.__BEYOND3D__.actions.getPrologueTelemetry()")
    dom = page.evaluate(DOM_INSPECTION_JS)

    lb_ratio = telemetry.get("letterboxRatio") if isinstance(telemetry, dict) else None
    if not isinstance(lb_ratio, (int, float)) or float(lb_ratio) >= 0.12:
        failures.append(f"S6-PROBE (74.6s): letterboxRatio={lb_ratio!r} (expected < 0.12)")
    if isinstance(telemetry, dict) and telemetry.get("activeSubtitle") is not None:
        failures.append(f"S6-PROBE (74.6s): FORBID-01 activeSubtitle must be null, got {telemetry.get('activeSubtitle')!r}")

    top_bar = dom.get("letterboxTop")
    bot_bar = dom.get("letterboxBottom")
    if top_bar and top_bar.get("visible") and top_bar["height"] > 14.0:
        failures.append(f"S6-PROBE (74.6s): Top letterbox bar height={top_bar['height']}px (expected <= 14px)")
    if bot_bar and bot_bar.get("visible") and bot_bar["height"] > 14.0:
        failures.append(f"S6-PROBE (74.6s): Bottom letterbox bar height={bot_bar['height']}px (expected <= 14px)")

    return {
        "tSec": 74.6,
        "passed": len(failures) == 0,
        "failures": failures,
        "letterboxRatio": lb_ratio,
        "topBarHeight": top_bar["height"] if top_bar else 0,
        "bottomBarHeight": bot_bar["height"] if bot_bar else 0,
        "activeSubtitle": telemetry.get("activeSubtitle") if isinstance(telemetry, dict) else None,
    }, failures


def run_interactive_space_skip_test(page: Any) -> tuple[dict[str, Any], list[str]]:
    """Test interactive Space key skip from mid-prologue and verify clean transition off levelId=0."""
    failures: list[str] = []

    # Seek back to active mid-prologue moment (S0B-2, 18.0s) before pressing Space
    seek_prologue_frame(page, 18.0, 4)
    before = page.evaluate(
        """() => {
            const b = window.__BEYOND3D__;
            const tel = b?.actions?.getPrologueTelemetry ? b.actions.getPrologueTelemetry() : null;
            return {
                levelId: b?.levelId,
                shipHumActive: tel?.shipHumActive,
                stationAmbienceActive: tel?.stationAmbienceActive,
                tombTtsCount: tel?.tombTtsCount,
            };
        }"""
    )

    if before.get("levelId") != 0:
        failures.append(f"SPACE-SKIP: Expected levelId===0 before Space press, got {before.get('levelId')!r}")

    page.keyboard.press("Space")
    page.evaluate(
        """async () => {
            const b = window.__BEYOND3D__;
            if (b && b.levelId === 0 && typeof b.stepFrame === 'function') {
                b.stepFrame(0.05, false);
                b.stepFrame(0.05, true);
            }
            await new Promise((resolve) => setTimeout(resolve, 120));
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }"""
    )

    after = page.evaluate(
        """() => {
            const b = window.__BEYOND3D__;
            let tel = null;
            try {
                if (b?.actions?.getPrologueTelemetry) {
                    tel = b.actions.getPrologueTelemetry();
                }
            } catch (_) {
                tel = null;
            }
            return {
                levelId: b?.levelId,
                bodyIsPrologue: document.body.classList.contains('is-prologue'),
                shipHumActive: tel?.shipHumActive ?? false,
                tombTtsCount: tel?.tombTtsCount ?? 0,
            };
        }"""
    )

    if after.get("levelId") == 0 or after.get("levelId") is None:
        failures.append(f"SPACE-SKIP: Pressing Space did not transition away from levelId=0 (after={after!r})")
    if after.get("bodyIsPrologue"):
        failures.append("SPACE-SKIP: body.is-prologue remained active after skipping Prologue")
    if after.get("shipHumActive") is True:
        failures.append("SPACE-SKIP: FORBID-04 shipHumActive became True during/after Space skip")
    if after.get("tombTtsCount", 0) != 0:
        failures.append(f"SPACE-SKIP: FORBID-05 tombTtsCount={after.get('tombTtsCount')!r} after Space skip")

    return {
        "passed": len(failures) == 0,
        "before": before,
        "after": after,
        "failures": failures,
    }, failures


def select_keyframes(segment: str) -> list[KeyframeSpec]:
    if segment == "all":
        return list(KEYFRAMES)
    return [kf for kf in KEYFRAMES if kf.segment_id == segment]


def print_summary_table(report: dict[str, Any]) -> None:
    print("\n" + "=" * 116, flush=True)
    print(
        f"PROLOGUE VISUAL AUDIT SUMMARY  |  segment={report['segment']}  |  "
        f"builtSite={report['builtSite']}  |  static={('PASS' if report['layer1StaticRedlines']['passed'] else 'FAIL')}",
        flush=True,
    )
    print("=" * 116, flush=True)
    header = (
        f"{'KF':<6} {'Seg':<4} {'tSec':>5} {'Shot':<6} {'Status':<6} "
        f"{'MeanL':>6} {'ActL':>6} {'StdL':>6} {'TopB':>5} {'BotB':>5} {'MAD':>6} "
        f"{'PBR':>3} {'Part':>4}  Notes"
    )
    print(header, flush=True)
    print("-" * 116, flush=True)

    for entry in report["keyframes"]:
        px = entry.get("pixels") or {}
        tel = entry.get("telemetry") or {}
        status = "PASS" if entry["passed"] else "FAIL"
        mad_str = f"{px['madFromPrev']:.1f}" if px.get("madFromPrev") is not None else "—"
        note = entry["failures"][0][:42] if entry["failures"] else "OK"
        print(
            f"{entry['id']:<6} {entry['segmentId']:<4} {entry['tSec']:>5.1f} {entry['subBeatId']:<6} "
            f"{status:<6} {px.get('meanLuma', 0):>6.1f} {px.get('activeMeanLuma', 0):>6.1f} "
            f"{px.get('activeStdLuma', 0):>6.1f} {px.get('letterboxTopLuma', 0):>5.1f} "
            f"{px.get('letterboxBottomLuma', 0):>5.1f} {mad_str:>6} "
            f"{str(tel.get('pbrCount', '-')):>3} {str(normalize_count(tel.get('particles'))):>4}  {note}",
            flush=True,
        )

    print("-" * 116, flush=True)
    rt = report["runtimeErrors"]
    print(
        f"Runtime errors: console={len(rt['consoleErrors'])}, page={len(rt['pageErrors'])}, "
        f"http>=400={len(rt['httpErrors'])}, requestFailed={len(rt['requestFailures'])}",
        flush=True,
    )
    if "s6_retraction_74_6s" in report.get("probes", {}):
        pr = report["probes"]["s6_retraction_74_6s"]
        print(
            f"S6 Retraction Probe (74.6s): {'PASS' if pr['passed'] else 'FAIL'} "
            f"(letterboxRatio={pr.get('letterboxRatio')}, bars={pr.get('topBarHeight')}/{pr.get('bottomBarHeight')}px)",
            flush=True,
        )
    if "spaceSkip" in report.get("interactiveChecks", {}):
        sk = report["interactiveChecks"]["spaceSkip"]
        print(
            f"Interactive Space Skip:      {'PASS' if sk['passed'] else 'FAIL'} "
            f"(levelId {sk['before'].get('levelId')} -> {sk['after'].get('levelId')})",
            flush=True,
        )
    print("=" * 116, flush=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Beyond 3D Prologue 18-Keyframe Headless WebGL Visual Audit & Redline Scanner"
    )
    parser.add_argument(
        "--segment",
        choices=("P1", "P2", "P3", "all"),
        default="all",
        help="Prologue segment to audit (default: all)",
    )
    parser.add_argument(
        "--out-dir",
        default=DEFAULT_OUT_DIR,
        help=f"Output directory for PNGs and JSON report (default: {DEFAULT_OUT_DIR})",
    )
    parser.add_argument(
        "--built-site",
        action="store_true",
        help="Serve built production bundle under `_site/` instead of repo root",
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Optional existing URL to audit instead of auto-spawning an ephemeral local server",
    )
    parser.add_argument(
        "--warmup-ticks",
        type=int,
        default=18,
        help="Particle pre-warm ticks passed to seekPrologue() (default: 18)",
    )
    parser.add_argument(
        "--static-only",
        action="store_true",
        help="Run Layer 1 static redline scan only (skip headless browser launch)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    target_keyframes = select_keyframes(args.segment)
    all_failures: list[str] = []

    print(
        f"[prologue-audit] Starting audit: segment={args.segment} ({len(target_keyframes)} keyframes), "
        f"builtSite={args.built_site}, outDir={out_dir}",
        flush=True,
    )

    # ------------------------------------------------------------------
    # Layer 1 — Static Redline & Render-Invariant Scan
    # ------------------------------------------------------------------
    print("\n[Layer 1] Running Prologue-scoped static redline & invariant scan...", flush=True)
    layer1 = run_layer1_static_redline_scan(ROOT)
    l1_status = (
        "PASS (0 violations)"
        if layer1["passed"]
        else f"FAIL ({len(layer1['violations'])} violations)"
    )
    print(
        f"  Scanned {len(layer1['scannedFiles'])} Prologue files -> {l1_status}",
        flush=True,
    )
    for viol in layer1["violations"]:
        print(f"  [REDLINE FAIL] {viol['message']}", flush=True)
        all_failures.append(viol["message"])

    report: dict[str, Any] = {
        "tool": "prologue-audit.py",
        "version": "1.0",
        "timestampUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "segment": args.segment,
        "builtSite": bool(args.built_site),
        "url": args.url or "",
        "outDir": str(out_dir),
        "viewport": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
        "layer1StaticRedlines": layer1,
        "keyframes": [],
        "probes": {},
        "interactiveChecks": {},
        "runtimeErrors": {
            "consoleErrors": [],
            "consoleWarnings": [],
            "pageErrors": [],
            "httpErrors": [],
            "requestFailures": [],
        },
        "summary": {},
        "failures": [],
        "gatesPassed": False,
    }

    if args.static_only:
        report["failures"] = all_failures
        report["gatesPassed"] = len(all_failures) == 0
        report["summary"] = {
            "totalKeyframes": 0,
            "passedKeyframes": 0,
            "failedKeyframes": 0,
            "staticViolations": len(layer1["violations"]),
            "runtimeErrorCount": 0,
            "totalFailures": len(all_failures),
        }
        report_path = out_dir / "prologue_audit_report.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[prologue-audit] Static-only report saved to {report_path}", flush=True)
        return 0 if report["gatesPassed"] else 1

    # ------------------------------------------------------------------
    # Layer 2 & 3 — Single-Page Headless Chromium + Pillow Pixel Audit
    # ------------------------------------------------------------------
    from playwright.sync_api import sync_playwright

    server: EphemeralServer | None = None
    console_errors: list[str] = []
    console_warnings: list[str] = []
    page_errors: list[str] = []
    http_errors: list[dict[str, Any]] = []
    request_failures: list[dict[str, Any]] = []

    try:
        if args.url:
            audit_url = build_audit_url(args.url)
        else:
            server = EphemeralServer(ROOT, built_site=args.built_site)
            base_url = server.start()
            audit_url = build_audit_url(base_url)
            print(f"[Layer 2] Ephemeral server ready at {base_url}", flush=True)

        report["url"] = audit_url
        print(f"[Layer 2] Launching headless Chromium (SwiftShader WebGL 2.0) -> {audit_url}", flush=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--enable-unsafe-swiftshader",
                    "--ignore-gpu-blocklist",
                ],
            )
            try:
                context = browser.new_context(
                    viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                    device_scale_factor=1,
                )
                page = context.new_page()

                page.on(
                    "console",
                    lambda msg: (
                        console_errors.append(msg.text)
                        if msg.type == "error"
                        else (console_warnings.append(msg.text) if msg.type == "warning" else None)
                    ),
                )
                page.on("pageerror", lambda err: page_errors.append(str(err)))
                page.on(
                    "response",
                    lambda resp: (
                        http_errors.append({"status": resp.status, "url": resp.url})
                        if resp.status >= 400
                        else None
                    ),
                )
                page.on(
                    "requestfailed",
                    lambda req: request_failures.append({"url": req.url, "failure": req.failure}),
                )

                cdp = context.new_cdp_session(page)

                t_nav_start = time.monotonic()
                page.goto(audit_url, wait_until="domcontentloaded", timeout=30000)
                wait_for_prologue_ready(page, timeout_sec=30.0)
                print(
                    f"[Layer 2] Single page booted & scene ready in {time.monotonic() - t_nav_start:.2f}s",
                    flush=True,
                )

                prev_active_rgb: Image.Image | None = None

                for kf in target_keyframes:
                    t0 = time.monotonic()
                    seek_prologue_frame(page, kf.t_sec, args.warmup_ticks)

                    png_path = out_dir / kf.filename
                    capture_cdp_png(cdp, png_path)

                    telemetry = page.evaluate("() => window.__BEYOND3D__.actions.getPrologueTelemetry()")
                    dom = page.evaluate(DOM_INSPECTION_JS)

                    kf_failures = evaluate_keyframe_assertions(kf, telemetry, dom)
                    pixel_stats, pixel_failures, active_rgb = analyze_keyframe_pixels(
                        png_path, kf, prev_active_rgb
                    )
                    kf_failures.extend(pixel_failures)
                    prev_active_rgb = active_rgb

                    elapsed_ms = int((time.monotonic() - t0) * 1000)
                    passed = len(kf_failures) == 0
                    if not passed:
                        all_failures.extend(kf_failures)

                    print(
                        f"  [{kf.kf_id}] t={kf.t_sec:>4.1f}s {kf.sub_beat_id:<5} "
                        f"-> {'PASS' if passed else 'FAIL'} | "
                        f"luma={pixel_stats['activeMeanLuma']:>5.1f} std={pixel_stats['activeStdLuma']:>5.1f} "
                        f"bars={pixel_stats['letterboxTopLuma']:.1f}/{pixel_stats['letterboxBottomLuma']:.1f} "
                        f"({elapsed_ms}ms) [{kf.filename}]",
                        flush=True,
                    )
                    for fail_msg in kf_failures:
                        print(f"      ! {fail_msg}", flush=True)

                    # Store slim DOM summary (avoid duplicating full body innerText 18x in JSON)
                    dom_record = {
                        k: v for k, v in dom.items() if k not in ("visibleBodyText", "cinemaLayerText")
                    }
                    report["keyframes"].append(
                        {
                            "id": kf.kf_id,
                            "segmentId": kf.segment_id,
                            "shotId": kf.shot_id,
                            "subBeatId": kf.sub_beat_id,
                            "tSec": kf.t_sec,
                            "slug": kf.slug,
                            "description": kf.description,
                            "pngPath": str(png_path),
                            "passed": passed,
                            "failures": kf_failures,
                            "telemetry": telemetry,
                            "dom": dom_record,
                            "pixels": pixel_stats,
                            "captureMs": elapsed_ms,
                        }
                    )

                # S6 letterbox retraction endpoint probe (t=74.6s) whenever P3 is included
                if args.segment in ("P3", "all"):
                    probe_res, probe_failures = run_s6_retraction_probe(page, args.warmup_ticks)
                    report["probes"]["s6_retraction_74_6s"] = probe_res
                    all_failures.extend(probe_failures)

                # Interactive Space skip check when running full audit (`--segment all`)
                if args.segment == "all":
                    print("\n[Layer 2] Running interactive Space skip control verification...", flush=True)
                    skip_res, skip_failures = run_interactive_space_skip_test(page)
                    report["interactiveChecks"]["spaceSkip"] = skip_res
                    all_failures.extend(skip_failures)
            finally:
                browser.close()
    except Exception as exc:
        err_msg = f"Fatal audit execution error: {exc}"
        print(f"\n[FATAL] {err_msg}", flush=True)
        all_failures.append(err_msg)
    finally:
        if server is not None:
            server.stop()

    # Runtime error gates (strictly 0 console.error, 0 pageerror, 0 HTTP >= 400)
    report["runtimeErrors"] = {
        "consoleErrors": console_errors,
        "consoleWarnings": console_warnings,
        "pageErrors": page_errors,
        "httpErrors": http_errors,
        "requestFailures": request_failures,
    }
    if console_errors:
        all_failures.append(f"Console errors ({len(console_errors)}): {console_errors[:5]}")
    if page_errors:
        all_failures.append(f"Uncaught page errors ({len(page_errors)}): {page_errors[:5]}")
    if http_errors:
        all_failures.append(f"HTTP >= 400 errors ({len(http_errors)}): {http_errors[:5]}")
    if request_failures:
        all_failures.append(f"Network request failures ({len(request_failures)}): {request_failures[:5]}")

    passed_kfs = sum(1 for k in report["keyframes"] if k["passed"])
    failed_kfs = len(report["keyframes"]) - passed_kfs
    runtime_err_count = (
        len(console_errors) + len(page_errors) + len(http_errors) + len(request_failures)
    )

    report["failures"] = all_failures
    report["gatesPassed"] = (
        len(all_failures) == 0 and len(report["keyframes"]) == len(target_keyframes)
    )
    report["summary"] = {
        "totalKeyframes": len(report["keyframes"]),
        "expectedKeyframes": len(target_keyframes),
        "passedKeyframes": passed_kfs,
        "failedKeyframes": failed_kfs,
        "staticViolations": len(layer1["violations"]),
        "runtimeErrorCount": runtime_err_count,
        "totalFailures": len(all_failures),
    }

    report_path = out_dir / "prologue_audit_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print_summary_table(report)
    print(f"Report saved to: {report_path}", flush=True)

    if report["gatesPassed"]:
        print("\n✓ ALL PROLOGUE AUDIT GATES PASSED (0 REDLINE VIOLATIONS, 0 ERRORS)!", flush=True)
        return 0

    print(f"\n✗ PROLOGUE AUDIT FAILED ({len(all_failures)} failure(s)):", flush=True)
    for item in all_failures:
        print(f"  - {item}", flush=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
