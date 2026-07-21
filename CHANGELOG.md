# Changelog

All notable changes to VectorEditGym are recorded here. The project follows
[Semantic Versioning](https://semver.org/) for evaluator and tooling releases.
Corpus changes also require a new corpus hash and explicit benchmark release.

## [Unreleased]

## [0.2.0] - 2026-07-21

- Froze a 40-task, 202-edit SVG repair corpus with naturalistic instructions.
- Replaced canonical-target equality with a tolerance-aware binary specification reward.
- Added semantic and strict-source preservation gates, structural SVG validation, UCR,
  repair progress, near-pass diagnostics, and per-check evidence.
- Published results for 34 model endpoints across all 40 tasks.
- Added complete retained final-record traces and an interactive trace browser.
- Added resumable OpenRouter benchmarking, immutable rescore history, budget controls,
  result merging, analysis generation, and Harbor task export.
- Published the shared paper artifact and reproducibility materials.

[Unreleased]: https://github.com/yug-space/vector-edit-gym/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yug-space/vector-edit-gym/releases/tag/v0.2.0
