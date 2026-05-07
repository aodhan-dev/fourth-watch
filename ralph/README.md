# ralph (Fourth Watch overnight runner)

PowerShell + bash scripts that drive an unattended Claude Code "Ralph Loop"
inside a devcontainer, scoped to one PRD's user stories. Lifted and adapted
from `HH3RulesRepository/ralph/`.

## What's here

- **`ralph.ps1`** — Windows host entry point. Manages the devcontainer and tmux
  loops inside it. Subcommands: `up`, `shell`, `run`, `tail`, `list`, `attach`,
  `kill`, `down`, `rebuild`, `logs`, `status`, `doctor`.
- **`run-prd-loop.ps1`** — Per-PRD driver. Picks the active PRD (auto-detected
  for `sub-prds/` mode, or pass `-PrdFile` for our case), starts the inner
  loop in tmux, polls every 60s for `completion_promise_hit` in `prd.json`,
  archives artefacts on completion. The iteration prompt is hardcoded for our
  branch-per-story stacking policy and our four pipeline gates (`npm run check`,
  `npm run lint`, `npm run validate:data`, `npm test`).
- **`run-ralph.sh`** — In-container launcher. Wraps `claude --print --verbose
  --output-format stream-json` in `timeout` + `tmux`.
- **`ralph-notify.ps1`** — Console + Windows toast + ntfy phone push helper,
  dot-sourced by `run-prd-loop.ps1`. First call generates a per-user ntfy
  topic and prints the subscribe URL.

## Prerequisites (one-time)

1. Docker Desktop running.
2. `npm install -g @devcontainers/cli` on PATH.
3. (optional) `Install-Module BurntToast -Scope CurrentUser -Force` for
   Windows toast notifications.
4. (optional) ntfy app on phone, subscribed to the topic the helper prints
   on first run.

## First-time setup for this repo

From repo root:

```powershell
.\ralph\ralph.ps1 doctor    # confirm environment
.\ralph\ralph.ps1 up        # build and start container (5-10 min first time)
.\ralph\ralph.ps1 shell     # then inside the container: claude /login
```

`claude /login` only needs to run once — credentials persist in a named volume.

## Starting the overnight run

```powershell
.\ralph\run-prd-loop.ps1 -PrdFile docs\superpowers\plans\review-panel-prd\PRD_Fourth_Watch_Review_Panel_Implementation_v1.md
```

The script will:

1. Verify the container is up.
2. Spawn a tmux session named `prd-review-panel-prd-<timestamp>` running
   `claude --print` with the iteration prompt against the PRD.
3. Poll every 60 seconds for `completion_promise_hit: true`.
4. Fire phone notifications on each story completion and on terminal events.
5. Archive `prd.json`, `progress.txt`, the PRD file, and the run log to
   `docs/superpowers/plans/review-panel-prd/prd-archive/<prd-name>-<timestamp>/`
   when the loop terminates.

Safe to Ctrl-C the polling loop. The container-side ralph keeps running.
Re-attach with:

```powershell
.\ralph\run-prd-loop.ps1 -PrdFile <same-path> -SkipLoopStart
```

## Branch model

Each story creates its own git branch named by the `branchName` field in
`prd.json`. Branches stack linearly: story `02.1` branches off `01.1`'s tip,
`03.1` off `02.1`'s, and so on. The user reviews and merges them in order
after the loop finishes. The loop never pushes and never touches main.

## Troubleshooting

- `ralph.ps1 doctor` — environment health check (Docker, devcontainer CLI,
  container state, claude install).
- `ralph.ps1 list` — list active tmux sessions in the container.
- `ralph.ps1 attach <session>` — attach interactively (Ctrl-B then D to
  detach without killing).
- `ralph.ps1 tail <session>` — tail the run log.
- `ralph.ps1 build-log` — last 200 lines of the most recent container build.
- `ralph.ps1 retry-install` — re-run `postCreate.sh` if Claude Code installation
  failed mid-build.

## Notes

- Build logs land under `.ralph-build-logs/` (gitignored).
- Run logs land under `.ralph-logs/` (gitignored).
- Prompt files land under `.ralph-prompt-<session>.txt` (gitignored).
- `node_modules` is a named volume, separate from the host's `node_modules`,
  so container installs don't mess with host dev.
