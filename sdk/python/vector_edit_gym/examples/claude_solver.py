"""Reference solver that asks Claude to fix the corrupted SVG.

Install:
    pip install 'vector-edit-gym[anthropic]'
    export ANTHROPIC_API_KEY=...

Run:
    vec-edit-gym evaluate vector_edit_gym.examples.claude_solver:solve \
        --difficulty very_easy --limit 10
"""

from __future__ import annotations

import os
import re

try:
    from anthropic import Anthropic
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "anthropic SDK not installed. Install with: pip install 'vector-edit-gym[anthropic]'"
    ) from e

# Use the latest Sonnet by default; override via env var.
MODEL = os.environ.get("VEG_CLAUDE_MODEL", "claude-sonnet-4-6")

SYSTEM = (
    "You are a precise SVG editor. The user will give you a CORRUPTED SVG and a "
    "natural-language instruction describing what to fix. Return ONLY the corrected "
    "SVG as a complete, valid <svg>...</svg> document. No markdown, no commentary."
)


_client: Anthropic | None = None
def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic()
    return _client


def _extract_svg(text: str) -> str:
    # Tolerate models that wrap with ```svg ... ``` despite our instructions.
    m = re.search(r"```(?:svg|xml)?\s*(<svg[\s\S]*?</svg>)\s*```", text)
    if m:
        return m.group(1)
    m = re.search(r"(<svg[\s\S]*?</svg>)", text)
    return m.group(1) if m else text.strip()


def solve(task) -> str:
    client = _get_client()
    msg = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Instruction:\n{task.instruction}\n\n"
                    f"Corrupted SVG:\n{task.initial_svg}\n\n"
                    "Return the corrected SVG."
                ),
            }
        ],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    return _extract_svg(text)
