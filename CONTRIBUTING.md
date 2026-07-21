# Contributing

Contributions to the evaluator, documentation, viewer, and reproducibility tooling are welcome. Do not add data or visual assets without a documented source and license.

## Development Setup

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'sdk/python[test,analysis,litellm]'
npm ci
npm --prefix viewer ci
```

Before opening a pull request, run:

```sh
npm run corpus:verify
npm run test:sdk
npm run traces:verify
npm run viewer:lint
npm run viewer:build
```

Use the bug or feature template for proposed work. Keep pull requests focused, explain
their benchmark impact, and include the commands used for validation. A scoring change
must include evaluator regression tests and regenerated diagnostics; a corpus change
must be released under a new corpus hash.

## Change Rules

- Keep model prompts limited to `instruction` and `initial_svg` during scored runs.
- Treat task targets and annotations as evaluator-only data.
- Add regression tests for any scoring behavior change.
- Regenerate published results, paper tables, and figures from recorded JSONL rather than entering values by hand.
- Do not commit credentials, `.env` files, API responses containing secrets, or ignored run directories.
- Document the provenance and license of every new dataset or visual asset.
- Do not commit generated archives that duplicate source already tracked in the repository.

Corpus changes require a new release identifier and corpus hash. Do not silently alter the frozen benchmark.
