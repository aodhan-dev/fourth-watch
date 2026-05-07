#!/usr/bin/env bash
# postCreate.sh - one-time container provisioning for Fourth Watch.
# Idempotent: safe to re-run via `ralph.ps1 retry-install` if a step fails.

set -euo pipefail

cd /workspace

echo "==> postCreate.sh starting"

# Named volumes can land as root on first mount; fix ownership to vscode.
sudo chown -R vscode:vscode \
    /home/vscode/.claude \
    /home/vscode/.config \
    /home/vscode/.npm \
    /workspace/node_modules 2>/dev/null || true
mkdir -p /home/vscode/.config

# Git identity for any commits the loop makes inside the container.
git config --global user.name  "${RALPH_GIT_USER:-aodhan.dev}"
git config --global user.email "${RALPH_GIT_EMAIL:-aidengleave@gmail.com}"

# Fallback install of Claude Code in case the image is old; the Dockerfile bakes it in.
if ! command -v claude >/dev/null 2>&1; then
    echo "==> Claude Code missing from image, installing on demand"
    sudo npm install -g @anthropic-ai/claude-code
fi

# Project deps. node_modules is a named volume so this only refills on first
# create or after a manual rebuild; subsequent restarts are instant.
if [ ! -d node_modules/.bin ] || [ ! -f node_modules/.bin/vite ]; then
    echo "==> Installing project dependencies (npm ci)"
    npm ci
fi

# Playwright browsers. Lives outside node_modules so the volume doesn't bloat;
# Playwright's default cache is /home/vscode/.cache/ms-playwright which sits on
# the regular filesystem and gets recreated per image build.
if [ -f node_modules/.bin/playwright ]; then
    echo "==> Ensuring Playwright Chromium is installed"
    npx --no-install playwright install chromium --with-deps || true
fi

cat <<'EOF'

==> postCreate complete

Workspace:        /workspace (host repo bind-mount)
Claude auth vol:  /home/vscode/.claude
node_modules:     /workspace/node_modules (named volume, container-only)

Next: run `claude /login` once if .credentials.json is missing.
EOF
