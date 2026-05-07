<#
.SYNOPSIS
    Runs a Ralph Loop against this repo's PRD, then archives artefacts when all
    user stories are complete. Supports sub-PRD decomposition.

.DESCRIPTION
    Workflow:
      1. Detects structure:
         - If `sub-prds/` directory exists at repo root, picks the first numerically-
           ordered subdirectory whose prd.json has NOT flipped completion_promise_hit
           to true. That subdirectory becomes the active work directory.
         - If no `sub-prds/` directory, falls back to `PRD_*.md` in the repo root.
      2. Ensures the ralph-loop container is up for this repo.
      3. Kicks off an unattended Ralph Loop in a detached tmux session, scoped to
         the active PRD.
      4. Polls every 60s for completion (prd.json in the active directory with
         completion_promise_hit=true).
      5. On completion, archives the PRD's artefacts to a `prd-archive/` folder
         INSIDE the active directory.
      6. Exits cleanly. Does NOT auto-pick the next sub-PRD -- re-run the script
         to start work on the next one.

    Safe to Ctrl-C the polling loop -- the container-side Ralph Loop keeps running.
    Re-run the script any time to resume polling.

.PARAMETER PrdFile
    Path to a specific PRD file. Overrides sub-PRD auto-detection. Useful for
    testing or re-running a specific sub-PRD out of order.

.PARAMETER Timeout
    Hard timeout wrapper around the Ralph Loop. Default: 12h.

.PARAMETER Model
    Claude model alias or full ID passed to `claude --model`. Default: sonnet.
    Common values: sonnet, opus, haiku, or a full ID like claude-sonnet-4-6.

.PARAMETER PollIntervalSec
    How often to check for completion. Default: 60.

.PARAMETER RalphScript
    Path to ralph.ps1. Default: this repo's ralph.ps1, or the template dir.

.PARAMETER SkipLoopStart
    Only poll for completion + archive. Useful if the loop is already running and
    you just want the archival step to fire when it finishes.

.EXAMPLE
    # From repo root -- picks the first incomplete sub-PRD automatically
    .\run-prd-loop.ps1

.EXAMPLE
    # Force a specific sub-PRD (e.g., re-running an already-completed one)
    .\run-prd-loop.ps1 -PrdFile .\sub-prds\02-aggregator-logic\PRD_EbayHelper_AggregatorLogic_v1.md

.EXAMPLE
    # Loop is already running; just wait and archive
    .\run-prd-loop.ps1 -SkipLoopStart

.NOTES
    Prerequisites:
      - Docker Desktop running
      - @devcontainers/cli installed: npm install -g @devcontainers/cli
      - .devcontainer/ at repo root (project-specific — not provided by this script)
      - This script and its siblings (ralph.ps1, run-ralph.sh, ralph-notify.ps1)
        co-located — typically as a git subtree under <repo>/ralph/ or similar.
        Paths are resolved relative to $PSScriptRoot, so the subtree prefix is flexible.
#>

[CmdletBinding()]
param(
    [string]$PrdFile,
    [string]$Timeout = '12h',
    [string]$Model = 'sonnet',
    [int]$PollIntervalSec = 60,
    [string]$RalphScript,
    [switch]$SkipLoopStart
)

$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
$repoName = Split-Path $repo -Leaf

# Compute the script's location relative to the repo root. The scripts live as a
# git subtree (default: <repo>/ralph/) but the prefix is flexible — this lets both
# the PowerShell driver and the in-container bash launcher agree on paths.
function Get-RalphDirRelativeToRepo {
    param([string]$ScriptDir, [string]$Repo)
    $norm = $ScriptDir.TrimEnd('\', '/')
    $repoNorm = $Repo.TrimEnd('\', '/')
    if ($norm -ieq $repoNorm) { return '' }
    if (-not $norm.StartsWith($repoNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Error "ralph scripts at $ScriptDir are outside the repo ($Repo). Run from the repo root."
        exit 1
    }
    return $norm.Substring($repoNorm.Length).TrimStart('\', '/').Replace('\', '/')
}
$ralphDirRel = Get-RalphDirRelativeToRepo -ScriptDir $PSScriptRoot -Repo $repo
$runRalphContainerPath = if ($ralphDirRel) { "/workspace/$ralphDirRel/run-ralph.sh" } else { "/workspace/run-ralph.sh" }

# Dot-source the notification helper sibling, if present.
$notifyScript = Join-Path $PSScriptRoot "ralph-notify.ps1"
if (Test-Path $notifyScript) {
    . $notifyScript
} else {
    # Fallback stub: notifications become console-only (Send-RalphNotification still callable)
    function Send-RalphNotification { param($Level, $Title, $Message)
        $ts = Get-Date -Format 'HH:mm:ss'
        Write-Host "[$ts] $Title $(if($Message){'- '+$Message})"
    }
}

function Ensure-DockerRunning {
    # Fast path: daemon already responsive
    $null = docker info --format '{{.ServerVersion}}' 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    Docker daemon: already running" -ForegroundColor Gray
        return
    }

    Write-Host "==> Docker daemon not responsive. Launching Docker Desktop..." -ForegroundColor Yellow

    $dockerExe = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerExe) {
        Write-Error "Docker Desktop.exe not found in standard locations. Install Docker Desktop or start it manually."
        exit 1
    }

    # Fire-and-forget; Docker Desktop handles its own singleton
    Start-Process -FilePath $dockerExe -WindowStyle Hidden

    $maxWaitSec = 120
    $waited = 0
    $interval = 3
    Write-Host -NoNewline "    Waiting for Docker daemon"
    while ($waited -lt $maxWaitSec) {
        Start-Sleep -Seconds $interval
        $waited += $interval
        $null = docker info --format '{{.ServerVersion}}' 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ready (${waited}s)" -ForegroundColor Green
            return
        }
        Write-Host -NoNewline "."
    }
    Write-Host ""
    Write-Error "Docker daemon did not become ready within ${maxWaitSec}s. Check the Docker Desktop UI for errors."
    exit 1
}

Write-Host "==> run-prd-loop for $repoName" -ForegroundColor Cyan

# ---- 1. Pick the active PRD (sub-PRD aware) ----
# $workDir = directory the loop operates in (progress.txt, prd.json, archive all live here)
# $workDirContainer = same path inside the container (relative to /workspace)

$workDir = $repo
$workDirContainer = "/workspace"
$subPrdMode = $false

function Test-PrdComplete {
    param([string] $Dir)
    $j = Join-Path $Dir "prd.json"
    if (-not (Test-Path $j)) { return $false }
    try {
        $json = Get-Content $j -Raw | ConvertFrom-Json
        return ($json.completion_promise_hit -eq $true)
    } catch {
        return $false
    }
}

if (-not $PrdFile) {
    $subPrdsDir = Join-Path $repo "sub-prds"
    if (Test-Path $subPrdsDir -PathType Container) {
        $subPrdMode = $true
        # Alphabetical sort gives us "01-", "02-", "03-" ordering naturally
        $subDirs = Get-ChildItem -Path $subPrdsDir -Directory | Sort-Object Name
        if ($subDirs.Count -eq 0) {
            Write-Error "sub-prds/ directory exists but has no subdirectories. Add a sub-PRD directory or remove sub-prds/."
            exit 1
        }

        $active = $null
        $completed = @()
        foreach ($sd in $subDirs) {
            if (Test-PrdComplete -Dir $sd.FullName) {
                $completed += $sd.Name
                continue
            }
            $active = $sd
            break
        }

        if ($completed.Count -gt 0) {
            Write-Host "    Already completed: $($completed -join ', ')" -ForegroundColor Gray
        }

        if (-not $active) {
            Write-Host ""
            Write-Host "==> All sub-PRDs completed." -ForegroundColor Green
            Write-Host "    $($subDirs.Count) sub-PRDs found, all have completion_promise_hit: true."
            Write-Host "    To re-run one, pass -PrdFile <path-to-sub-prd.md> explicitly."
            exit 0
        }

        $workDir = $active.FullName
        # Container path is relative to /workspace
        $workDirRelative = [System.IO.Path]::GetRelativePath($repo, $workDir).Replace('\','/')
        $workDirContainer = "/workspace/$workDirRelative"
        Write-Host "    Active sub-PRD: $($active.Name)" -ForegroundColor Green
        Write-Host "    Workdir:        $workDir" -ForegroundColor Gray

        # Find the PRD inside the active sub-PRD directory
        $prdCandidates = Get-ChildItem -Path $workDir -Filter "PRD_*.md" -File -ErrorAction SilentlyContinue
        if (-not $prdCandidates) {
            Write-Error "No PRD_*.md found in $workDir. Each sub-PRD directory needs one."
            exit 1
        }
        $PrdFile = $prdCandidates[0].FullName
        if ($prdCandidates.Count -gt 1) {
            Write-Host "    Multiple PRDs in sub-PRD dir; using: $(Split-Path $PrdFile -Leaf)" -ForegroundColor Yellow
        }
    } else {
        # Legacy: single PRD at repo root
        $candidates = Get-ChildItem -Path $repo -Filter "PRD_*.md" -File -ErrorAction SilentlyContinue
        if (-not $candidates) {
            Write-Error "No PRD_*.md found in $repo and no sub-prds/ directory. Create one first."
            exit 1
        }
        $PrdFile = $candidates[0].FullName
        if ($candidates.Count -gt 1) {
            Write-Host "    Multiple PRDs at repo root; using: $(Split-Path $PrdFile -Leaf)" -ForegroundColor Yellow
        }
    }
} else {
    # Explicit PRD file -- derive workDir from its location
    if (-not (Test-Path $PrdFile)) { Write-Error "PRD not found: $PrdFile"; exit 1 }
    $workDir = (Resolve-Path (Split-Path $PrdFile -Parent)).Path
    if ($workDir -ne $repo) {
        $subPrdMode = $true
        $workDirRelative = [System.IO.Path]::GetRelativePath($repo, $workDir).Replace('\','/')
        $workDirContainer = "/workspace/$workDirRelative"
    }
    Write-Host "    Explicit PRD: $PrdFile" -ForegroundColor Gray
}

$prdBase = [System.IO.Path]::GetFileNameWithoutExtension($PrdFile)
$prdFileName = Split-Path $PrdFile -Leaf
Write-Host "    PRD:      $prdFileName" -ForegroundColor Gray

# ---- 2. Locate ralph.ps1 (sibling of this script) ----
if (-not $RalphScript) {
    $RalphScript = Join-Path $PSScriptRoot "ralph.ps1"
}
if (-not (Test-Path $RalphScript)) {
    Write-Error "ralph.ps1 not found at $RalphScript. Expected alongside run-prd-loop.ps1 (ralph subtree)."
    exit 1
}
if (-not (Test-Path (Join-Path $repo ".devcontainer"))) {
    Write-Error "Missing .devcontainer/ at repo root. Add one before running the loop."
    exit 1
}

# ---- 3. Ensure Docker + container is up ----
if (-not $SkipLoopStart) {
    Ensure-DockerRunning
    Write-Host "==> Ensuring container is up..." -ForegroundColor Cyan
    & $RalphScript up
    if ($LASTEXITCODE -ne 0) {
        Write-Error "ralph up failed. Check Docker Desktop + devcontainer CLI."
        exit 1
    }
}

# ---- 4. Kick off the loop ----
$sessionTag = if ($subPrdMode) { (Split-Path $workDir -Leaf) } else { $repoName }
$sessionName = "prd-$sessionTag-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# ---- 4a. Container + existing-session detection (anti-duplicate guard) ----
# Probe for an in-flight tmux session matching this sub-PRD's name BEFORE
# spawning a new one. Without this, two near-simultaneous invocations of
# run-prd-loop produce two distinct sessions (different timestamps in the
# session name) that race on the same sidecars, double the token cost, and
# produce unpredictable commits. The fix is "first writer wins, second
# adopts": newcomer detects the existing session and falls through to
# polling-only mode against it, equivalent to having been invoked with
# -SkipLoopStart.
$cid = $null
foreach ($id in @(docker ps -q --filter "label=devcontainer.local_folder" 2>&1) | Select-Object -Unique) {
    if (-not $id -or $id -match '^\s*$') { continue }
    $json = (docker inspect --format '{{json .Config.Labels}}' $id 2>&1) -join ''
    try {
        $labels = $json | ConvertFrom-Json
        if ($labels.'devcontainer.local_folder' -ieq $repo) { $cid = $id; break }
    } catch { }
}

$adoptedExisting = $false
if ($cid -and -not $SkipLoopStart) {
    $tmuxOut = @(docker exec $cid tmux ls 2>&1)
    if ($LASTEXITCODE -eq 0) {
        foreach ($line in $tmuxOut) {
            if ($line -match "^(prd-${sessionTag}-\d{8}-\d{6}):") {
                $existingName = $Matches[1]
                Write-Host "==> Existing tmux session found: $existingName" -ForegroundColor Yellow
                Write-Host "    Adopting and skipping spawn (avoids duplicate-session race)." -ForegroundColor Yellow
                Write-Host "    To force a fresh session, kill the existing one first:" -ForegroundColor Gray
                Write-Host "      docker exec $cid tmux kill-session -t $existingName" -ForegroundColor Gray
                $sessionName = $existingName
                $adoptedExisting = $true
                break
            }
        }
    }
}

if (-not $SkipLoopStart -and -not $adoptedExisting) {
    # Prompt file lives in the active workdir so run-ralph.sh finds it when cd'd there
    $promptLocal = Join-Path $workDir ".ralph-prompt-$sessionName.txt"

    $scopeNote = if ($subPrdMode) {
        "This is a SUB-PRD. Work inside $workDirContainer. Treat that directory as your root for this loop -- progress.txt and prd.json live there, the PRD file is in that directory, and any code/artefacts you produce should be organised under that directory OR in the parent repo where appropriate (e.g., backend code at the repo root, mobile code at android/, etc., per the sub-PRD's Technical Considerations section)."
    } else {
        "Work inside /workspace (this repo)."
    }

    $prompt = @"
Run the PRD implementation workflow for $prdFileName.

The sidecar files progress.txt and prd.json already exist in $workDirContainer --
they were generated from the PRD ahead of time. DO NOT regenerate them. DO NOT
invoke the prd-generator skill. Work with the sidecars directly.

STORY ID CONVENTION:
  Story ids are <slot-number>.<sequence>, e.g. '01.1', '02.1'. Read the id field
  from prd.json verbatim and write it back verbatim to progress.txt.

BRANCH POLICY -- BRANCH PER STORY, STACKED:
  Each story lands on its own git branch named EXACTLY by the story's branchName
  field. Branches stack linearly: story N+1 branches off story N's tip, NOT off
  main. The user reviews and merges them in order after the loop finishes.
  NEVER push. NEVER merge to main. NEVER touch main directly.

Per-story workflow (read this whole block before doing anything):
  1. Read prd.json. Top-level array 'stories'; each entry has fields: id, title,
     passes (bool), priority (int; 1 = highest), branchName, user_role,
     capability, outcome, acceptance_criteria (array), status, completed_at.
  2. Pick the highest-priority story where passes == false. If every story is
     passes == true, jump to the Completion block below.
  3. From whichever branch you're currently on (the previous story's tip on
     iterations 2..N; whatever the user started you on for iteration 1), create
     a new branch named EXACTLY the value of the story's branchName field:
        git checkout -b <branchName>
     Do NOT switch back to main. Do NOT push. The new branch inherits the
     previous story's commits, building a linear stack of N branches.
  4. Implement the story so every item in acceptance_criteria is demonstrably
     met. Run the four pipeline gates and verify they pass before marking the
     story passed:
        npm run check
        npm run lint
        npm run validate:data
        npm test
     If any gate fails, FIX THE FAILURE. Do NOT mark the story passed with a
     red gate. Commit implementation work with conventional messages like
     'feat: [<id>] <title>' or 'fix: [<id>] <title>' (use the exact id from
     prd.json, e.g. 'feat: [01.1] ...'). For UI-touching stories, run
     `npm run dev` in a sibling tmux window or one-shot exercise the feature in
     headless Playwright if a Playwright test exists.
  5. TIMESTAMP RULE (read twice). Every completed_at, every progress.txt
     completion comment, every audit line MUST come from a FRESH
     `date -u +%Y-%m-%dT%H:%M:%SZ` call made IMMEDIATELY before that write.
     Do NOT call `date -u` once at the start and reuse it. Do NOT use the same
     timestamp for two stories. A whole batch sharing one timestamp is the
     canonical "I batched the updates" fingerprint and the host poll flags it
     as suspicious.
  6. PROGRESSIVE-COMMITMENT RULE. When acceptance criteria are met and gates
     are green for THIS ONE story, update BOTH sidecars IMMEDIATELY -- before
     reading the next story's acceptance criteria, before doing anything else:
       a. Run `date -u +%Y-%m-%dT%H:%M:%SZ`; capture as TS.
       b. In progress.txt: change '[ ] Story <id>: <title>' to
          '[x] Story <id>: <title>    # completed: <TS>'. Refresh the
          UPDATED_AT header line to TS.
       c. In prd.json: set the story's passes=true, status="passed",
          completed_at=<TS>. Preserve every other field.
       d. Commit the sidecar update on the story's branch with message
          'chore: [<id>] mark story passed'.
     Do NOT batch sidecar updates across multiple stories. Per-story progressive
     marking is what fires per-story phone notifications.
  7. After step 6, you remain on the story's branch. Loop back to step 1 to
     pick the next pending story; step 3 will branch off this story's tip.

Completion (only when every story has passes == true AND every gate verified):
  1. Run `date -u +%Y-%m-%dT%H:%M:%SZ`; capture as TS.
  2. In prd.json, set top-level completion_promise_hit=true and completed_at=TS.
  3. Commit on the final story's branch with message 'chore: meta complete'.
  4. Emit this exact sentinel string on its own line as your final output:
     COMPLETION_PROMISE_MET: all user stories passed, terminating loop
  5. Stop. Do not start new work. Do not push. Do not merge to main.

Constraints:
  - $scopeNote
  - If you get stuck on a story for more than ~45 minutes of iteration, leave
    its passes=false (DO NOT mark it passed-but-flaky) and move on. Partial
    progress beats a stuck loop; lying about progress is worse than no progress.
  - Preserve progress.txt's header block and COMPLETION_PROMISE footer verbatim.
  - Never emit the sentinel while any story has passes=false.
  - Never flip completion_promise_hit=true if any pipeline gate is red.
  - Do NOT modify branches outside this stack. Do NOT touch main directly.
  - Do NOT start work on any other PRD. This loop is scoped to ONE PRD: $prdFileName.
"@

    Write-Host "==> Starting Ralph Loop session: $sessionName (model: $Model)" -ForegroundColor Cyan

    Set-Content -Path $promptLocal -Value $prompt -Encoding UTF8

    # Case-insensitive match: Docker normalises the Windows drive letter to lowercase
    # in the label value (e.g. `d:\Dev\...`), but Get-Location returns `D:\Dev\...`.
    # Two-step lookup avoids quoting issues with Go's {{.Label "..."}} in PowerShell.
    $cid = $null
    foreach ($id in @(docker ps -q --filter "label=devcontainer.local_folder" 2>&1) | Select-Object -Unique) {
        if (-not $id -or $id -match '^\s*$') { continue }
        # JSON output avoids PowerShell's native-command quote-mangling.
        $json = (docker inspect --format '{{json .Config.Labels}}' $id 2>&1) -join ''
        try {
            $labels = $json | ConvertFrom-Json
            $labelPath = $labels.'devcontainer.local_folder'
        } catch { $labelPath = $null }
        if ($labelPath -and ($labelPath -ieq $repo)) { $cid = $id; break }
    }
    if (-not $cid) {
        Write-Error "Container not found after 'ralph up'. Something is wrong."
        exit 1
    }

    # run-ralph.sh expects paths relative to its cwd
    $promptFileRelative = ".ralph-prompt-$sessionName.txt"
    docker exec -w $workDirContainer $cid bash -lc "$runRalphContainerPath --session '$sessionName' --timeout '$Timeout' --model '$Model' --prompt-file '$promptFileRelative'"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "run-ralph.sh returned non-zero. Check: $RalphScript list"
    }
}

# ---- 5. Poll for completion ----
Write-Host ""
Write-Host "==> Polling for completion every $PollIntervalSec sec." -ForegroundColor Cyan
Write-Host "    Watching:  $workDir"
Write-Host "    Safe to Ctrl-C; the loop keeps running in the container."
Write-Host "    Re-run with -SkipLoopStart to resume polling."
Write-Host ""

# Announce that the loop has started (fires toast + phone notification if configured)
Send-RalphNotification -Level start `
    -Title "Ralph Loop started: $sessionTag" `
    -Message "$prdFileName - polling every ${PollIntervalSec}s"

$prdJsonPath  = Join-Path $workDir "prd.json"
$progressPath = Join-Path $workDir "progress.txt"

# State tracked across polls for transition detection
$lastCompletedNames = @()       # names of stories that were [x] at previous poll
$announcedStart     = $false    # true once we've announced "working on story N"
$lastActiveStory    = $null     # name of the currently-in-progress story
$tmuxDeadCount      = 0         # consecutive polls where tmux session is missing (tolerant of races)

# Regex: capture "Story N: <name>" lines, optionally tagged [x]
# Story-id pattern accepts both legacy `5.N` and the post-2026-04-26
# slot-prefixed `NN.M` shape (e.g. `09.7`). The leading integer is the slot
# number for newly-scaffolded sub-PRDs; the dotted suffix is the within-PRD
# sequence. The `[\d.]+` form matches either.
$checkedPattern   = '(?m)^\[x\]\s+Story\s+[\d.]+:\s+(.+?)(?:\s+#.*)?\s*$'
$unchecked = '(?m)^\[ \]\s+Story\s+[\d.]+:\s+(.+?)\s*$'

function Get-StoryNames {
    param([string] $Path, [string] $Pattern)
    if (-not (Test-Path $Path)) { return @() }
    $content = Get-Content $Path -Raw
    $matches = [regex]::Matches($content, $Pattern)
    $names = @()
    foreach ($m in $matches) { $names += $m.Groups[1].Value.Trim() }
    return $names
}

while ($true) {
    # ---- Completion check ----
    if (Test-Path $prdJsonPath) {
        try {
            $json = Get-Content $prdJsonPath -Raw | ConvertFrom-Json
            if ($json.completion_promise_hit -eq $true) {
                Write-Host ""
                Write-Host "==> Completion promise hit!" -ForegroundColor Green
                $total = if ($json.stories) { $json.stories.Count } else { 'all' }
                Send-RalphNotification -Level done `
                    -Title "Ralph Loop COMPLETE: $sessionTag" `
                    -Message "$total stories passed for $prdFileName"
                break
            }
        } catch { }
    }

    # ---- Progress-change detection ----
    $currentCompleted = Get-StoryNames -Path $progressPath -Pattern $checkedPattern
    $currentPending   = Get-StoryNames -Path $progressPath -Pattern $unchecked
    $total = $currentCompleted.Count + $currentPending.Count

    # New completions: names present now but not at last poll
    $newlyCompleted = $currentCompleted | Where-Object { $lastCompletedNames -notcontains $_ }
    foreach ($story in $newlyCompleted) {
        Send-RalphNotification -Level success `
            -Title "Story complete ($($currentCompleted.Count)/$total)" `
            -Message "$story"
    }

    # Active story (first pending)
    $nowActive = if ($currentPending.Count -gt 0) { $currentPending[0] } else { $null }
    if ($nowActive -and $nowActive -ne $lastActiveStory) {
        # First one (after bootstrap) or advanced to next
        if (-not $announcedStart -or $newlyCompleted) {
            Send-RalphNotification -Level info `
                -Title "Now working on" `
                -Message "$nowActive"
        }
        $lastActiveStory = $nowActive
        $announcedStart = $true
    }

    $lastCompletedNames = $currentCompleted

    # Periodic progress tick (console only, not a notification)
    if (Test-Path $progressPath) {
        Write-Host "    [$(Get-Date -Format 'HH:mm:ss')] $($currentCompleted.Count) / $total stories passed$(if($nowActive){" - active: $nowActive"})" -ForegroundColor Gray
    } else {
        Write-Host "    [$(Get-Date -Format 'HH:mm:ss')] waiting for progress.txt..." -ForegroundColor Gray
    }

    # ---- Critical-error detection: tmux session death without completion ----
    # Only check if we started the loop (not -SkipLoopStart mode) and have a session name
    if (-not $SkipLoopStart -and $cid -and $sessionName) {
        $null = docker exec $cid tmux has-session -t $sessionName 2>&1
        if ($LASTEXITCODE -ne 0) {
            # Tolerate transient races: require 2 consecutive misses before declaring death
            $tmuxDeadCount++
            if ($tmuxDeadCount -ge 2) {
                Send-RalphNotification -Level error `
                    -Title "Ralph Loop TERMINATED without completion" `
                    -Message "Session '$sessionName' died. prd.json not flipped to true. Check: .\ralph.ps1 build-log  or  tail the run log in .ralph-logs/"
                Write-Host ""
                Write-Host "==> Loop terminated without completion. See notification." -ForegroundColor Magenta
                break
            }
        } else {
            $tmuxDeadCount = 0
        }
    }

    Start-Sleep -Seconds $PollIntervalSec
}

# ---- 6. Archive ----
$archiveRoot = Join-Path $workDir "prd-archive"
$archiveDir = Join-Path $archiveRoot "$prdBase-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

Write-Host ""
Write-Host "==> Archiving artefacts to $archiveDir" -ForegroundColor Cyan

$toArchive = @()
if (Test-Path $PrdFile)      { $toArchive += $PrdFile }
if (Test-Path $prdJsonPath)  { $toArchive += $prdJsonPath }
if (Test-Path $progressPath) { $toArchive += $progressPath }

# Run logs live at repo root's .ralph-logs/ (run-ralph.sh writes there)
$logDir = Join-Path $repo ".ralph-logs"
if (Test-Path $logDir) {
    $matchingLogs = Get-ChildItem $logDir -Filter "$sessionName*.log" -ErrorAction SilentlyContinue
    foreach ($log in $matchingLogs) { $toArchive += $log.FullName }
}

foreach ($f in $toArchive) {
    Copy-Item $f -Destination $archiveDir
    Write-Host "    archived: $(Split-Path $f -Leaf)" -ForegroundColor Gray
}

$manifest = [PSCustomObject]@{
    archived_at            = (Get-Date).ToString('o')
    repo                   = $repoName
    sub_prd_mode           = $subPrdMode
    sub_prd_dir            = if ($subPrdMode) { Split-Path $workDir -Leaf } else { $null }
    prd                    = $prdFileName
    session_name           = $sessionName
    files                  = $toArchive | ForEach-Object { Split-Path $_ -Leaf }
    completion_promise_hit = $true
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $archiveDir "manifest.json") -Encoding UTF8

# Clean up the prompt file (no need to leave it around)
$promptLocal = Join-Path $workDir ".ralph-prompt-$sessionName.txt"
if (Test-Path $promptLocal) { Remove-Item $promptLocal -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "==> Done. Archive: $archiveDir" -ForegroundColor Green

if ($subPrdMode) {
    # Look ahead at what's left without auto-starting it
    $remaining = Get-ChildItem -Path (Join-Path $repo "sub-prds") -Directory | Sort-Object Name |
        Where-Object { -not (Test-PrdComplete -Dir $_.FullName) }
    if ($remaining.Count -gt 0) {
        Write-Host ""
        Write-Host "==> Next sub-PRD queued: $($remaining[0].Name)" -ForegroundColor Cyan
        Write-Host "    Re-run .\run-prd-loop.ps1 to start it. (This script does NOT auto-chain.)"
    } else {
        Write-Host ""
        Write-Host "==> All sub-PRDs now complete." -ForegroundColor Green
    }
}
