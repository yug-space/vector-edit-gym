def mean(rewards: list[dict]) -> dict:
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "specification_pass", "repair_pass", "preservation_pass", "validity_pass", "target_match", "edit_completion", "preservation", "unintended_change_rate"}
    return {key: sum(row.get(key, 0.0) for row in rewards) / len(rewards) for key in keys}
