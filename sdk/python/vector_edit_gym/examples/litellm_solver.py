"""Reference solver for OpenAI-compatible LiteLLM gateways.

Install:
    pip install 'vector-edit-gym[litellm]'
    export LITELLM_API_KEY=...
    export LITELLM_BASE_URL=https://your-litellm-proxy.example.com
    export VEG_LITELLM_MODEL=gpt-5-mini

Run:
    vec-edit-gym evaluate vector_edit_gym.examples.litellm_solver:solve --limit 10
"""

from __future__ import annotations

import os
import re

try:
    from openai import OpenAI
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "openai SDK not installed. Install with: pip install 'vector-edit-gym[litellm]'"
    ) from e

MODEL = os.environ.get("VEG_LITELLM_MODEL") or os.environ.get("VEG_MODEL", "gpt-5-mini")
MAX_TOKENS = int(os.environ.get("VEG_LITELLM_MAX_TOKENS", "12000"))
TIMEOUT = float(os.environ.get("VEG_LITELLM_TIMEOUT", "120"))

SYSTEM = (
    "You are a precise SVG editor. The user will give you a CORRUPTED SVG and a "
    "natural-language instruction describing what to fix. Return ONLY the corrected "
    "SVG as a complete, valid <svg>...</svg> document. No markdown fences, no "
    "commentary, no explanation."
)


_client: OpenAI | None = None


def _normalise_base_url(url: str) -> str:
    url = url.rstrip("/")
    return url if url.endswith("/v1") else f"{url}/v1"


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("LITELLM_API_KEY")
        base_url = os.environ.get("LITELLM_BASE_URL")
        if not api_key:
            raise RuntimeError("missing LITELLM_API_KEY")
        if not base_url:
            raise RuntimeError("missing LITELLM_BASE_URL")
        _client = OpenAI(
            api_key=api_key,
            base_url=_normalise_base_url(base_url),
            timeout=TIMEOUT,
        )
    return _client


def _extract_svg(text: str) -> str:
    m = re.search(r"```(?:svg|xml)?\s*(<svg[\s\S]*?</svg>)\s*```", text)
    if m:
        return m.group(1)
    m = re.search(r"(<svg[\s\S]*?</svg>)", text)
    return m.group(1) if m else text.strip()


def solve(task) -> str:
    client = _get_client()
    max_tokens = min(MAX_TOKENS, max(4096, int(len(task.initial_svg) / 2.5) + 1536))
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
        max_tokens=max_tokens,
    )
    text = resp.choices[0].message.content or ""
    return _extract_svg(text)
