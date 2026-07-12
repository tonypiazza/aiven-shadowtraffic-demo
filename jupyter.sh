#!/usr/bin/env bash
# Launch the CLI-wiring demo notebook in GUI JupyterLab (browser).
# GUI alternative to ./demo-notebook.sh (which uses the euporie terminal UI).
#
# Prereqs: `uv sync` (installs jupyterlab + bash_kernel), and the `avn` CLI
# installed + authenticated (`avn user login`).
#
# JUPYTER_PATH points at the repo-local bash kernelspec (.jupyter/kernels/bash).
# We (re)generate its kernel.json here with the absolute path to this repo's
# .venv/bin/python: jupyter resolves a bare "python" to uv's *base* interpreter
# (no bash_kernel there), which silently kills the kernel. The generated file is
# gitignored, so it stays correct on any machine after `uv sync`.
set -euo pipefail
cd "$(dirname "$0")"
export JUPYTER_PATH="$(pwd)/.jupyter"
uv sync --quiet
mkdir -p .jupyter/kernels/bash
cat > .jupyter/kernels/bash/kernel.json <<EOF
{"argv": ["$(pwd)/.venv/bin/python", "-m", "bash_kernel", "-f", "{connection_file}"], "codemirror_mode": "shell", "display_name": "Bash", "language": "bash", "env": {"PS1": "\$"}}
EOF
exec uv run jupyter lab "${1:-wire-demo.ipynb}"
