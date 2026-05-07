FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG NODE_MAJOR=20

# Core toolchain plus Playwright runtime deps. Playwright pulls a Chromium
# install at npm-install time; the system libs below cover what its headless
# Chromium needs to start. Kept narrow so the image stays small.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ripgrep \
        tmux \
        jq \
        less \
        ca-certificates \
        curl \
        gnupg \
        # Playwright Chromium runtime
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libxkbcommon0 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@latest \
    && npm install -g @anthropic-ai/claude-code

USER vscode
ENV SHELL=/bin/bash

# safe.directory + a credential helper that reads a per-session PAT from
# /home/vscode/.config/git-pat (chmod 600, never baked into the image; the host
# syncs it in if pushes are needed). The "x-access-token" username is GitHub's
# convention for fine-grained PATs.
RUN git config --global safe.directory /workspace \
    && git config --global init.defaultBranch main \
    && git config --global credential.helper '!f() { test -r "$HOME/.config/git-pat" && printf "username=x-access-token\npassword=%s\n" "$(cat "$HOME/.config/git-pat")"; }; f'

WORKDIR /workspace
