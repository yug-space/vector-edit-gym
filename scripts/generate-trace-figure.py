#!/usr/bin/env python3
"""Generate the appendix worked-trace flow diagram (task sv_001, Claude Sonnet 5).

Builds an HTML page embedding the actual task SVGs plus a three-gate flow row,
screenshots it with headless Chrome, and autocrops the result to
paper/figures/trace-sv001.png.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "paper" / "figures" / "trace-sv001.png"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TASK_ID = "sv_001"
MODEL = "anthropic/claude-sonnet-5"

TEAL = "#0f766e"
RED = "#c2413b"
GRAY = "#6b7280"
INK = "#171717"

PAGE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #ffffff;
    color: {ink};
    width: 1180px;
    padding: 28px 30px 34px;
  }}
  .panels {{ display: flex; align-items: center; gap: 0; }}
  .panel {{ flex: 1 1 0; min-width: 0; }}
  .panel-label {{ text-align: center; font-size: 17px; margin-bottom: 12px; }}
  .panel-label i {{ font-family: Georgia, serif; }}
  .panel svg {{ display: block; width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; }}
  .flow-arrow {{
    flex: 0 0 44px; text-align: center;
    font-size: 26px; color: {gray}; padding-top: 30px;
  }}
  .gates {{ display: flex; align-items: stretch; gap: 0; margin-top: 34px; }}
  .gate {{
    border: 2px solid; border-radius: 10px; background: #fff;
    padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 10px;
    justify-content: flex-start;
  }}
  .gate .title {{ font-weight: 700; font-size: 15px; text-align: center; white-space: nowrap; }}
  .gate .body {{ font-size: 13px; line-height: 1.75; text-align: center; color: {ink}; }}
  .gate.pass {{ border-color: {teal}; }} .gate.pass .title {{ color: {teal}; }}
  .gate.fail {{ border-color: {red}; }} .gate.fail .title {{ color: {red}; }}
  .gate-arrow {{
    flex: 0 0 36px; align-self: center; text-align: center;
    font-size: 24px; color: {ink};
  }}
  .ok {{ color: {teal}; font-weight: 700; }}
  .bad {{ color: {red}; font-weight: 700; }}
  .serif-math {{ font-family: Georgia, serif; font-style: italic; }}
</style>
</head>
<body>
  <div class="panels">
    <div class="panel">
      <div class="panel-label">Corrupted input <i>S</i><sub>0</sub></div>
      {initial_svg}
    </div>
    <div class="flow-arrow">&#10230;</div>
    <div class="panel">
      <div class="panel-label">Claude Sonnet 5 output <i>S</i></div>
      {produced_svg}
    </div>
    <div class="flow-arrow">&#10230;</div>
    <div class="panel">
      <div class="panel-label">Hidden target <i>S</i><sup>*</sup></div>
      {target_svg}
    </div>
  </div>

  <div class="gates">
    <div class="gate pass" style="flex: 0 0 218px;">
      <div class="title">Gate 1 &middot; valid SVG: PASS</div>
      <div class="body">well-formed XML<br>unique IDs, references resolve</div>
    </div>
    <div class="gate-arrow">&#8594;</div>
    <div class="gate fail" style="flex: 1 1 auto;">
      <div class="title">Gate 2 &middot; requested repairs 1/3: FAIL</div>
      <div class="body">
        signal fill&nbsp;&nbsp;<span class="serif-math">&Delta;E</span> 0.0 &le; 18.0&nbsp;&nbsp;<span class="ok">&#10003;</span><br>
        door x&nbsp;&nbsp;off by 24.0 &gt; 5.5&nbsp;&nbsp;<span class="bad">&#10007;</span><br>
        wire d&nbsp;&nbsp;distance 9.0 &gt; 4.2&nbsp;&nbsp;<span class="bad">&#10007;</span>
      </div>
    </div>
    <div class="gate-arrow">&#8594;</div>
    <div class="gate fail" style="flex: 0 0 250px;">
      <div class="title">Gate 3 &middot; preservation: FAIL</div>
      <div class="body">door-handle moved with the door<br>(61/62 protected objects kept)</div>
    </div>
    <div class="gate-arrow">&#8594;</div>
    <div class="gate fail" style="flex: 0 0 170px;">
      <div class="title">Reward: FAIL</div>
      <div class="body"><span class="serif-math">R</span><sub>spec</sub> = 0<br>valid, incomplete</div>
    </div>
  </div>
</body>
</html>
"""


def main() -> None:
    task = json.loads((ROOT / "data" / "tasks" / f"{TASK_ID}.json").read_text())
    results = json.loads((ROOT / "data" / "model-results" / f"{TASK_ID}.json").read_text())
    result = next(entry for entry in results if entry["model"] == MODEL)

    html = PAGE.format(
        ink=INK,
        gray=GRAY,
        teal=TEAL,
        red=RED,
        initial_svg=task["initial_svg"],
        produced_svg=result["produced_svg"],
        target_svg=task["target_svg"],
    )

    with tempfile.TemporaryDirectory() as directory:
        page = Path(directory) / "trace.html"
        shot = Path(directory) / "shot.png"
        page.write_text(html)
        subprocess.run(
            [
                CHROME,
                "--headless=new",
                "--disable-gpu",
                "--force-device-scale-factor=2",
                "--window-size=1180,760",
                f"--screenshot={shot}",
                f"file://{page}",
            ],
            check=True,
            capture_output=True,
        )
        image = Image.open(shot).convert("RGB")
        background = Image.new("RGB", image.size, "white")
        bbox = ImageChops.difference(image, background).getbbox()
        if bbox:
            pad = 8
            bbox = (
                max(bbox[0] - pad, 0),
                max(bbox[1] - pad, 0),
                min(bbox[2] + pad, image.width),
                min(bbox[3] + pad, image.height),
            )
            image = image.crop(bbox)
        image.save(OUTPUT)
    print("wrote", OUTPUT)


if __name__ == "__main__":
    main()
