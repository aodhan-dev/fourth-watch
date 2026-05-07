#!/usr/bin/env bash
# Ralph Loop launcher with tmux + hard timeout + log capture.
#
# Usage:
#   ./run-ralph.sh "your prompt here"
#   ./run-ralph.sh --prompt-file prompt.txt
#   ./run-ralph.sh --timeout 4h "your prompt"
#   ./run-ralph.sh --session mysession "your prompt"
#   ./run-ralph.sh --model opus "your prompt"
#
# Defaults:
#   session name:  ralph-<timestamp>
#   timeout:       8h
#   model:         sonnet    (override with --model opus|haiku|<full-id>, or $RALPH_MODEL)
#   log:           .ralph-logs/<session>.log

set -euo pipefail

# npm-global bin is where `npm install -g` puts claude for user `ralph`, but
# .bashrc's PATH export sits below the interactive-shell guard, so tmux's
# non-interactive subshell never sees it. Prepend here so the loop always finds claude.
export PATH="$HOME/.npm-global/bin:$PATH"

TIMEOUT="${RALPH_TIMEOUT:-8h}"
MODEL="${RALPH_MODEL:-sonnet}"
SESSION="ralph-$(date +%Y%m%d-%H%M%S)"
PROMPT=""
PROMPT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout)   TIMEOUT="$2"; shift 2 ;;
    --session)   SESSION="$2"; shift 2 ;;
    --model)     MODEL="$2"; shift 2 ;;
    --prompt-file) PROMPT_FILE="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,14p' "$0"
      exit 0
      ;;
    *) PROMPT="$1"; shift ;;
  esac
done

if [[ -n "$PROMPT_FILE" ]]; then
  [[ -f "$PROMPT_FILE" ]] || { echo "Prompt file not found: $PROMPT_FILE" >&2; exit 1; }
  PROMPT="$(cat "$PROMPT_FILE")"
fi

if [[ -z "$PROMPT" ]]; then
  echo "Error: no prompt provided. Use:  ./run-ralph.sh \"your prompt\"" >&2
  exit 1
fi

mkdir -p .ralph-logs
LOG=".ralph-logs/${SESSION}.log"

# The actual command: timeout wraps claude so a stuck loop dies at the cap,
# regardless of whether the Completion Promise fires.
#
# `script -q -c` keeps claude's TTY-style output intact when captured to a log.
CMD=$(cat <<EOF
set -o pipefail
echo "== ralph-loop starting =="
echo "   session: $SESSION"
echo "   timeout: $TIMEOUT"
echo "   model:   $MODEL"
echo "   log:     $LOG"
echo "   prompt:  $(printf '%q' "$PROMPT" | head -c 200)..."
echo ""
timeout --foreground "$TIMEOUT" claude --print --verbose --dangerously-skip-permissions --model $(printf '%q' "$MODEL") --output-format stream-json --include-partial-messages $(printf '%q' "$PROMPT") 2>&1 | tee -a "$LOG"
status=\$?
echo ""
if [[ \$status -eq 124 ]]; then
  echo "== HIT HARD TIMEOUT ($TIMEOUT) — loop killed =="
elif [[ \$status -eq 0 ]]; then
  echo "== Loop exited cleanly =="
else
  echo "== Loop exited with status \$status =="
fi
EOF
)

echo "Starting tmux session: $SESSION"
echo "  attach with:  tmux attach -t $SESSION"
echo "  log tail:     tail -f $LOG"

tmux new-session -d -s "$SESSION" "$CMD"
echo ""
echo "Loop is running. Detach-safe. This terminal can close."
