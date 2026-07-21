# VectorEditGym Dataset Card

## Summary

VectorEditGym is a frozen benchmark for localized SVG repair. It contains 40 tasks, 202 requested object-attribute repairs, author-written naturalistic instructions, corrupted SVG inputs, hidden canonical targets, and preservation annotations.

The published release uses evaluator `semantic-perceptual-binary-2026-07-21`.

The public benchmark input for each task is `instruction` plus `initial_svg`. `target_svg`, `expected_diff`, and `should_preserve` are evaluator data and must not be exposed to a solver during a scored run.

## Evaluation

The primary score is binary. A task passes only when:

1. every requested repair is within its deterministic attribute-aware tolerance;
2. the rendering- and application-relevant SVG is unchanged outside the requested fields; consistent ID aliases and equivalent style storage are tolerated; and
3. the output is a structurally valid SVG with unique nonempty IDs, valid path, point-list, transform, and viewBox syntax, and resolvable local URL/href references.

Canonical equality with the complete hidden target is diagnostic only. Per-check distance, tolerance, baseline distance, validity-gated repair progress, near-complete status, semantic preservation, strict source preservation, named-object preservation, valid-output UCR, validity, and provider failures are also reported. UCR is undefined when a model produces no valid SVG.

## Composition

- 40 tasks: 10 `hard`, 30 `very_hard`
- 202 annotated repairs: 3 to 8 per task
- compact authored scenes in `sv_001` through `sv_020`
- larger scenic repair scenes in `sv_021` through `sv_040`
- frozen non-instruction content SHA-256: `2a62410b5de7383030c1a8b77d5d4d416e6be8efd11dc7322393a04f54e464d1`

## Intended Use

Use the benchmark to evaluate source-aware SVG editors, preservation-aware program editing, and failure modes hidden by raster-only metrics. Report the corpus hash, evaluator version, model endpoint, task count, decoding settings, errors, and whether any task metadata was available to the solver.

Do not use the public hidden targets as training data and then report the resulting model as zero-shot on this release. Do not treat the score as a general measure of artistic quality, accessibility, browser interoperability, or open-ended SVG generation.

The instructions and acceptable repairs were authored and checked by the benchmark authors. No independent annotator-agreement or human-performance study has been completed; tolerance sensitivity is reported in the paper but is not a substitute for human calibration.

## Provenance and License

Project-authored code and metadata are MIT licensed. Twenty scenic source illustrations in `data/scenic_svgs/`, their task-embedded copies, and direct visual derivatives lack recoverable per-file provenance metadata. The project does not claim original authorship of those illustrations, does not relicense them, and marks the complete scenic subset as research-only pending provenance resolution.

This limitation materially prevents representing the complete corpus as cleanly open licensed. Users who require fully traceable assets should use the evaluator with replacement scenes or restrict use to content whose provenance they have independently verified. See [NOTICE.md](NOTICE.md).

## Authors

Yug Aditi Gupta and Prannay Hebbar contributed equally. The paper and accompanying material are shared work.

Questions and result submissions: `yug@thetalab.tech` or `prannay@warping.co`.
