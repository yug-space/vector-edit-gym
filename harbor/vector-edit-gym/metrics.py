def mean(rewards: list[dict]) -> dict:
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "edit_completion", "preservation", "unintended_change_rate", "valid"}
    return {key: sum(row.get(key, 0.0) for row in rewards) / len(rewards) for key in keys}
