"""Ceiling solver: always returns the ground-truth target SVG.

Sanity-check that scoring works end-to-end (exact-match should be 100%).
"""

def solve(task) -> str:
    return task.target_svg
