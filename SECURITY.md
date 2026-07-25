# Security Policy

## Reporting a vulnerability

If you find a security issue in RedFlag CI, please don't open a public issue. Email the maintainer directly (see the GitHub profile linked from this repository) with a description of the issue and, if possible, steps to reproduce it. A response should follow within a few days.

## Scope

RedFlag CI itself reads pull request diffs and a small set of configuration files; it does not execute any code from the repositories it scans. The detectors are pure functions with no `eval`, no dynamic imports, and no shell execution against untrusted input. If you believe you've found a way around that boundary, that's exactly the kind of report this policy is for.

## A note on dogfooding

This repository's own `CLAUDE.md`, `AGENTS.md`, and any future `.cursor/rules` are the same category of file RedFlag CI is built to watch. Once the app is far enough along to install on its own repository, it will be, deliberately. A tool built to catch this class of risk should be able to catch it in its own codebase.
