#!/usr/bin/env bash
# Launch the CLI-wiring demo notebook in the terminal (euporie TUI + bash kernel).
#
# Prereqs: `uv sync` (installs euporie + bash_kernel from pyproject), and the `avn`
# CLI installed + authenticated (`avn user login`).
#
# JUPYTER_PATH points at the repo-local bash kernelspec (.jupyter/kernels/bash).
# We (re)generate its kernel.json here with the absolute path to this repo's
# .venv/bin/python: euporie/jupyter resolve a bare "python" to uv's *base*
# interpreter (no bash_kernel there), which silently kills the kernel. The
# generated file is gitignored, so it stays correct on any machine after `uv sync`.
set -euo pipefail
cd "$(dirname "$0")"
export JUPYTER_PATH="$(pwd)/.jupyter"
uv sync --quiet
mkdir -p .jupyter/kernels/bash
cat > .jupyter/kernels/bash/kernel.json <<EOF
{"argv": ["$(pwd)/.venv/bin/python", "-m", "bash_kernel", "-f", "{connection_file}"], "codemirror_mode": "shell", "display_name": "Bash", "language": "bash", "env": {"PS1": "\$"}}
EOF
exec uv run euporie notebook "${1:-deploy/wire-demo.ipynb}"
