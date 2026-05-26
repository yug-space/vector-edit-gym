def mean(rewards: list[dict]) -> dict:
    """Aggregate per-task rewards.

    Returns mean of each metric key across all tasks.
    """
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "exact", "structural", "preservation"}
    return {k: sum(r.get(k, 0.0) for r in rewards) / len(rewards) for k in keys}
