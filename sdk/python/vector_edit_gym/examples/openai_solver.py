"""Reference solver that asks an OpenAI model to fix the corrupted SVG.

Install:
    pip install 'vector-edit-gym[openai]'
    export OPENAI_API_KEY=...
    # optional: override the model
    export VEG_OPENAI_MODEL=gpt-5-mini

Run:
    vec-edit-gym evaluate vector_edit_gym.examples.openai_solver:solve \
        --difficulty hard --limit 10
"""

from __future__ import annotations

import os
import re

try:
    from openai import OpenAI
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "openai SDK not installed. Install with: pip install 'vector-edit-gym[openai]'"
    ) from e

MODEL = os.environ.get("VEG_OPENAI_MODEL", "gpt-5-mini")

SYSTEM = (
    "You are a precise SVG editor. The user will give you a CORRUPTED SVG and a "
    "natural-language instruction describing what to fix. Return ONLY the corrected "
    "SVG as a complete, valid <svg>...</svg> document. No markdown fences, no commentary, "
    "no explanation, only the SVG itself."
)


_client: OpenAI | None = None
def _get_client() -> OpenAI:
    global _client
    if _client is None:
        # Reads OPENAI_API_KEY from the environment.
        _client = OpenAI()
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
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Instruction:\n{task.instruction}\n\n"
                    f"Corrupted SVG:\n{task.initial_svg}\n\n"
                    "Return the corrected SVG."
                ),
            },
        ],
    )
    text = resp.choices[0].message.content or ""
    return _extract_svg(text)
