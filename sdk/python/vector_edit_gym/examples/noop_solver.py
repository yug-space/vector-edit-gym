"""Baseline solver that returns the corrupted SVG unchanged.

Useful as a floor: any real solver must beat this on exact-match.
"""

def solve(task) -> str:
    return task.initial_svg
