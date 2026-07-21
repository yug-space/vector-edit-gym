# Security Policy

## Reporting a Vulnerability

Report security issues privately to `yug@thetalab.tech`. Include affected files or routes, reproduction steps, and potential impact. Do not open a public issue for an unpatched credential exposure or exploitable vulnerability.

The maintainers will acknowledge a report when practical, validate the issue, and coordinate disclosure after a fix is available.

## Secrets

Benchmark credentials must be supplied through environment variables. Never commit API keys, `.env` files, or raw logs containing authorization headers. If a key is exposed, revoke and rotate it immediately; deleting it from the latest commit is not sufficient because Git history and external logs may retain it.
