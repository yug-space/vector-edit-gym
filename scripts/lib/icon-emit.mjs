// Thin wrapper around emit.mjs that handles real-icon-grounded scenes:
// renders the spec to SVG via renderScene before pushing the task record.

import { taskBuilder } from "./emit.mjs";
import { renderScene, sceneIds } from "./icon-render.mjs";

export const iconTaskBuilder = (prefix, difficulty) => {
  const { pushRaw, write, tasks } = taskBuilder(prefix, difficulty);

  const make = ({ category, initialSpec, edit, instruction, targetIds }) => {
    const { spec: targetSpec, diff } = edit(initialSpec);
    const initialIds = sceneIds(initialSpec);
    const targetSpecIds = sceneIds(targetSpec);
    // Parts list is the UNION of initial and target ids, so add-tasks still
    // expose the part that didn't exist initially.
    const allIds = [...new Set([...initialIds, ...targetSpecIds])];
    const targets = new Set(
      targetIds ?? diff.map((d) => d.part).filter((p) => p !== "__svg"),
    );
    return pushRaw({
      category,
      instruction,
      initial_svg: renderScene(initialSpec),
      target_svg: renderScene(targetSpec),
      initial_spec: initialSpec,
      target_spec: targetSpec,
      parts: allIds,
      target_parts: [...targets],
      expected_diff: diff,
      should_preserve: allIds.filter((id) => !targets.has(id)),
    });
  };

  return { make, pushRaw, write, tasks };
};
