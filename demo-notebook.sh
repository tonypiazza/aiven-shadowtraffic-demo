#!/usr/bin/env bash
# Launch the CLI-wiring demo notebook in the terminal (euporie TUI + bash kernel).
#
# Prereqs: `uv sync` (installs euporie + bash_kernel from pyproject), and the `avn`
# CLI installed + authenticated (`avn user login`).
#
# JUPYTER_PATH points at the repo-local, committed bash kernelspec
# (.jupyter/kernels/bash) whose argv uses `python` — resolved to uv's venv python,
# so nothing is machine-specific and no kernel registration step is needed.
set -euo pipefail
cd "$(dirname "$0")"
export JUPYTER_PATH="$(pwd)/.jupyter"
exec uv run euporie notebook "${1:-deploy/wire-demo.ipynb}"
