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
npm run viewer:lint
npm run viewer:build
```

## Change Rules

- Keep model prompts limited to `instruction` and `initial_svg` during scored runs.
- Treat task targets and annotations as evaluator-only data.
- Add regression tests for any scoring behavior change.
- Regenerate published results, paper tables, and figures from recorded JSONL rather than entering values by hand.
- Do not commit credentials, `.env` files, API responses containing secrets, or ignored run directories.
- Document the provenance and license of every new dataset or visual asset.

Corpus changes require a new release identifier and corpus hash. Do not silently alter the frozen benchmark.
