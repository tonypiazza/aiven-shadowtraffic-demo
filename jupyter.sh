#!/usr/bin/env bash
# Launch the CLI-wiring demo notebook in GUI JupyterLab (browser).
# GUI alternative to ./demo-notebook.sh (which uses the euporie terminal UI).
#
# Prereqs: `uv sync` (installs jupyterlab + bash_kernel), and the `avn` CLI
# installed + authenticated (`avn user login`).
#
# JUPYTER_PATH points at the repo-local, committed bash kernelspec
# (.jupyter/kernels/bash) so JupyterLab finds the "Bash" kernel without any
# machine-specific registration.
set -euo pipefail
cd "$(dirname "$0")"
export JUPYTER_PATH="$(pwd)/.jupyter"
exec uv run jupyter lab "${1:-deploy/wire-demo.ipynb}"
