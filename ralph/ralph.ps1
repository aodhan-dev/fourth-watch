<#
.SYNOPSIS
    PowerShell wrapper for ralph-loop containers. Replaces VS Code's "Reopen in Container"
    with equivalent CLI commands -- works from any PowerShell session.

.DESCRIPTION
    Subcommands:
        ralph up              Build + start the container for the current project
        ralph shell           Open an interactive shell inside the container
        ralph run "<prompt>"  Start an unattended loop (tmux-backed) with hard timeout
        ralph tail <session>  Tail the log of a running loop
        ralph list            List active tmux loop sessions in the container
        ralph attach <sess>   Attach to a running tmux loop session
        ralph kill <session>  Kill one loop session (or "all" to kill every loop)
        ralph down            Stop + remove the container (auth volume persists)
        ralph rebuild         Rebuild the image (after Dockerfile changes)
        ralph logs            Show container-level logs (stdout/stderr of the container)
        ralph status          Show container state + active sessions

.EXAMPLE
    # From the project root, first time:
    .\ralph.ps1 up
    .\ralph.ps1 shell           # then: claude /login

    # Kick off an unattended loop and walk away:
    .\ralph.ps1 run "run the prd-generator skill against PRD.md"

    # Come back hours later:
    .\ralph.ps1 list
    .\ralph.ps1 tail ralph-20260418-143000

.NOTES
    Prerequisites:
        - Docker Desktop running
        - Node.js on PATH: `npm install -g @devcontainers/cli`
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)] [string] $Command,
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)] [string[]] $Rest
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Get-Location).Path

# The ralph scripts live as a git subtree in the consuming repo. Compute the
# subtree's prefix relative to the repo root so in-container paths line up.
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
$ralphDirRel = Get-RalphDirRelativeToRepo -ScriptDir $PSScriptRoot -Repo $projectRoot
$runRalphContainerPath = if ($ralphDirRel) { "/workspace/$ralphDirRel/run-ralph.sh" } else { "/workspace/run-ralph.sh" }

function Require-Cli {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "$Name is not on PATH. Install it first."
        exit 1
    }
}

function Get-ContainerId {
    # devcontainer tags containers with devcontainer.local_folder=<path>, but Docker on
    # Windows normalises the drive letter to lowercase (e.g. `d:\Dev\...`), while
    # Get-Location returns `D:\Dev\...`. Docker's label filter is case-sensitive so a
    # direct filter-value match misses. Fix: list IDs of all containers that carry the
    # label at all, then inspect each for the label's value, matching case-insensitively.
    # (Two-step because embedding Go's `{{.Label "..."}}` in PowerShell tangles quoting.)
    $ids  = @(docker ps    -q --filter "label=devcontainer.local_folder" 2>&1)
    $ids += @(docker ps -a -q --filter "label=devcontainer.local_folder" 2>&1)
    foreach ($id in $ids | Select-Object -Unique) {
        if (-not $id -or $id -match '^\s*$') { continue }
        # Use JSON output + ConvertFrom-Json to avoid PowerShell native-command quote-mangling
        # when trying to embed {{index .Config.Labels "..."}} with inner quotes.
        $json = (docker inspect --format '{{json .Config.Labels}}' $id 2>&1) -join ''
        try {
            $labels = $json | ConvertFrom-Json
            $labelPath = $labels.'devcontainer.local_folder'
        } catch { $labelPath = $null }
        if ($labelPath -and ($labelPath -ieq $projectRoot)) { return $id }
    }
    return $null
}

function Invoke-DevcontainerExec {
    param([string[]] $InnerArgs, [switch] $Interactive)
    Require-Cli devcontainer
    $base = @('exec', '--workspace-folder', $projectRoot)
    if ($Interactive) {
        # devcontainer CLI doesn't have a `-it` flag -- it passes through when stdin is a TTY.
        # In pwsh interactive sessions this works; for scripted use fall back to docker exec.
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running. Run: .\ralph.ps1 up"; exit 1 }
        docker exec -it $cid @InnerArgs
    } else {
        devcontainer @base @InnerArgs
    }
}

switch ($Command) {
    'up' {
        Require-Cli docker
        Require-Cli devcontainer

        # Preflight: the devcontainer CLI surfaces opaque "Command failed:
        # docker ps" errors when the daemon is down. Check directly first so the
        # user knows to start Docker Desktop.
        $verOut = (docker info --format '{{.ServerVersion}}' 2>&1) -join ' '
        if ($LASTEXITCODE -ne 0 -or $verOut -notmatch '^\s*\d+\.\d+') {
            Write-Host ""
            Write-Error "Docker daemon is not reachable. Start Docker Desktop and wait for the whale icon to stop animating, then retry.`n  Daemon probe said: $($verOut.Trim())"
            exit 1
        }

        Write-Host "==> Building and starting container for $projectRoot" -ForegroundColor Cyan

        # --log-format=json gives us a streaming newline-separated JSON log we can parse;
        # --log-level=info surfaces each build step. Fallback to plain when dev-container CLI
        # doesn't support the flags (older versions).
        $logsDir = Join-Path $projectRoot ".ralph-build-logs"
        if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
        $logFile = Join-Path $logsDir "build-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

        # BUILDKIT_PROGRESS=plain makes the underlying docker build stream each step's stdout
        # line-by-line (default is "auto" which redraws a TTY summary -- hard to debug).
        $env:BUILDKIT_PROGRESS = 'plain'
        try {
            devcontainer up --workspace-folder $projectRoot --log-level info 2>&1 | Tee-Object -FilePath $logFile
        } finally {
            Remove-Item Env:\BUILDKIT_PROGRESS -ErrorAction SilentlyContinue
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Warning "devcontainer up failed. Full log: $logFile"
            Write-Host "Run '.\ralph.ps1 build-log' to view last 200 lines, or 'ralph.ps1 doctor' to diagnose."
            exit $LASTEXITCODE
        }

        Write-Host ""
        Write-Host "==> Container is up. Log: $logFile" -ForegroundColor Green
        Write-Host "    .\ralph.ps1 shell         # then: claude /login (once)"
        Write-Host "    .\ralph.ps1 run `"<prompt>`"  # start an unattended loop"
    }

    'shell' {
        Invoke-DevcontainerExec -InnerArgs @('bash', '-l') -Interactive
    }

    'run' {
        if (-not $Rest -or $Rest.Count -eq 0) {
            Write-Error "Usage: .\ralph.ps1 run `"<prompt>`" [--timeout 12h] [--session name]"
            exit 1
        }
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running. Run: .\ralph.ps1 up"; exit 1 }

        # Forward all remaining args to run-ralph.sh verbatim. Docker's exec handles the quoting.
        Write-Host "==> Starting unattended loop..." -ForegroundColor Cyan
        docker exec -w /workspace $cid bash -lc "$runRalphContainerPath $($Rest -join ' ')"
    }

    'list' {
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running."; exit 1 }
        docker exec $cid tmux ls 2>&1
    }

    'attach' {
        if (-not $Rest -or -not $Rest[0]) { Write-Error "Usage: .\ralph.ps1 attach <session-name>"; exit 1 }
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running."; exit 1 }
        Write-Host "Attaching. Ctrl-B then D to detach without killing." -ForegroundColor Yellow
        docker exec -it $cid tmux attach -t $Rest[0]
    }

    'tail' {
        if (-not $Rest -or -not $Rest[0]) { Write-Error "Usage: .\ralph.ps1 tail <session-name>"; exit 1 }
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running."; exit 1 }
        docker exec -it $cid tail -f "/workspace/.ralph-logs/$($Rest[0]).log"
    }

    'kill' {
        if (-not $Rest -or -not $Rest[0]) { Write-Error "Usage: .\ralph.ps1 kill <session-name|all>"; exit 1 }
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running."; exit 1 }
        if ($Rest[0] -eq 'all') {
            docker exec $cid tmux kill-server 2>&1
            Write-Host "All tmux sessions killed." -ForegroundColor Yellow
        } else {
            docker exec $cid tmux kill-session -t $Rest[0]
            Write-Host "Killed $($Rest[0])." -ForegroundColor Yellow
        }
    }

    'down' {
        $cid = Get-ContainerId
        if (-not $cid) { Write-Host "No container found for this project." -ForegroundColor Yellow; exit 0 }
        Write-Host "==> Stopping + removing container $cid" -ForegroundColor Cyan
        docker stop $cid | Out-Null
        docker rm $cid | Out-Null
        Write-Host "Done. Named volumes (auth) preserved." -ForegroundColor Green
    }

    'rebuild' {
        Require-Cli devcontainer
        Write-Host "==> Rebuilding image (auth volume survives)" -ForegroundColor Cyan
        $logsDir = Join-Path $projectRoot ".ralph-build-logs"
        if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
        $logFile = Join-Path $logsDir "rebuild-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
        $env:BUILDKIT_PROGRESS = 'plain'
        try {
            devcontainer up --workspace-folder $projectRoot --remove-existing-container --build-no-cache --log-level info 2>&1 | Tee-Object -FilePath $logFile
        } finally {
            Remove-Item Env:\BUILDKIT_PROGRESS -ErrorAction SilentlyContinue
        }
        Write-Host ""
        Write-Host "==> Rebuild log: $logFile" -ForegroundColor Gray
    }

    'build-log' {
        $logsDir = Join-Path $projectRoot ".ralph-build-logs"
        if (-not (Test-Path $logsDir)) { Write-Host "No build logs found for this project." -ForegroundColor Yellow; exit 0 }
        $latest = Get-ChildItem $logsDir -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) { Write-Host "No build logs found." -ForegroundColor Yellow; exit 0 }
        Write-Host "==> Latest build log: $($latest.FullName)" -ForegroundColor Cyan
        Write-Host "    (full log is above path; printing tail of 200 lines)"
        Write-Host ""
        Get-Content $latest.FullName -Tail 200
    }

    'listen' {
        # Start the Azure Service Bus command listener in this window.
        # Ctrl-C to stop. Survives tmux / loops running in containers.
        $listenerScript = Join-Path $PSScriptRoot "ralph-listener.ps1"
        if (-not (Test-Path $listenerScript)) { $listenerScript = $null }
        if (-not $listenerScript) {
            Write-Error "ralph-listener.ps1 not found in project or template dir."
            exit 1
        }
        Write-Host "==> Starting ralph-listener ($listenerScript)" -ForegroundColor Cyan
        Write-Host "    Ctrl-C to stop. Phone commands will fire until then."
        & $listenerScript
    }

    'listen-bg' {
        # Detached: launches listener in a hidden pwsh window, survives console close.
        # Check for existing instance first.
        $existing = Get-CimInstance Win32_Process -Filter "Name='pwsh.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match 'ralph-listener\.ps1' }
        if ($existing) {
            Write-Host "ralph-listener already running (PID $($existing.ProcessId))." -ForegroundColor Yellow
            exit 0
        }
        $listenerScript = Join-Path $PSScriptRoot "ralph-listener.ps1"
        if (-not (Test-Path $listenerScript)) { $listenerScript = $null }
        if (-not $listenerScript) { Write-Error "ralph-listener.ps1 not found."; exit 1 }
        $logPath = Join-Path $env:USERPROFILE ".ralph\listener.log"
        Start-Process -FilePath 'pwsh.exe' -ArgumentList @(
            '-NoProfile','-WindowStyle','Hidden','-File',$listenerScript
        ) -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err" -WindowStyle Hidden
        Write-Host "==> ralph-listener running detached." -ForegroundColor Green
        Write-Host "    log:  $logPath"
        Write-Host "    stop: .\ralph.ps1 listen-stop"
    }

    'listen-stop' {
        $procs = Get-CimInstance Win32_Process -Filter "Name='pwsh.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match 'ralph-listener\.ps1' }
        if (-not $procs) { Write-Host "No ralph-listener running." -ForegroundColor Yellow; exit 0 }
        foreach ($p in $procs) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped ralph-listener (PID $($p.ProcessId))." -ForegroundColor Green
        }
    }

    'phone-setup' {
        $f = Join-Path $env:USERPROFILE ".ralph\phone-setup.txt"
        if (Test-Path $f) {
            Get-Content $f
        } else {
            Write-Error "phone-setup.txt not found. Re-run Azure provisioning."
        }
    }

    'retry-install' {
        # Re-run postCreate.sh inside a running container. Useful when the Claude Code
        # install during first-creation failed (e.g. transient npm registry issue).
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running. Run: .\ralph.ps1 up"; exit 1 }
        Write-Host "==> Re-running postCreate.sh inside container" -ForegroundColor Cyan
        docker exec -it $cid bash /workspace/.devcontainer/postCreate.sh
    }

    'doctor' {
        Write-Host "==> ralph-loop doctor" -ForegroundColor Cyan
        Write-Host ""

        # 1. Docker
        $dockerOk = $false
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            # $LASTEXITCODE alone isn't reliable: `docker info` can exit 0 while returning
            # a 500/pipe-not-found error on stdout when Docker Desktop is half-up. Require
            # a plausible server version string.
            $verOut = (docker info --format '{{.ServerVersion}}' 2>&1) -join ' '
            if ($LASTEXITCODE -eq 0 -and $verOut -match '^\s*\d+\.\d+') {
                Write-Host "  [OK]   docker daemon         ($($verOut.Trim()))" -ForegroundColor Green
                $dockerOk = $true
            } else {
                $hint = if ($verOut -match 'dockerDesktopLinuxEngine|cannot find the file') {
                    "Docker Desktop's Linux engine pipe is missing -- start or restart Docker Desktop"
                } else {
                    "Docker daemon unreachable ($($verOut.Trim()))"
                }
                Write-Host "  [FAIL] docker daemon         ($hint)" -ForegroundColor Magenta
            }
        } else {
            Write-Host "  [FAIL] docker CLI            (not on PATH -- install Docker Desktop)" -ForegroundColor Magenta
        }

        # 2. devcontainer CLI
        if (Get-Command devcontainer -ErrorAction SilentlyContinue) {
            $dcVer = (devcontainer --version 2>&1)
            Write-Host "  [OK]   devcontainer CLI      ($dcVer)" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] devcontainer CLI      (run: npm install -g @devcontainers/cli)" -ForegroundColor Magenta
        }

        # 3. WSL2 .wslconfig
        $wslConfig = "$env:USERPROFILE\.wslconfig"
        if (Test-Path $wslConfig) {
            Write-Host "  [OK]   WSL2 .wslconfig       ($wslConfig)" -ForegroundColor Green
        } else {
            Write-Host "  [warn] WSL2 .wslconfig       (missing -- using default limits)" -ForegroundColor Yellow
        }

        # 4. Disk -- current project + docker
        if ($dockerOk) {
            $df = docker system df --format "{{.Type}}: {{.Size}} (reclaimable {{.Reclaimable}})" 2>&1
            Write-Host "  [info] docker disk usage:"
            $df -split "`n" | ForEach-Object { Write-Host "         $_" -ForegroundColor Gray }
        }

        # 5. Container state for this project
        if ($dockerOk) {
            $cid = Get-ContainerId
            if ($cid) {
                $state = docker ps -a --filter "id=$cid" --format "{{.Status}}" 2>&1
                Write-Host "  [OK]   project container    ($cid -- $state)" -ForegroundColor Green
            } else {
                Write-Host "  [warn] project container    (not created yet -- run '.\ralph.ps1 up')" -ForegroundColor Yellow
            }
        }

        # 6. Claude Code inside container
        if ($dockerOk -and $cid) {
            $claudeCheck = docker exec $cid bash -c 'command -v claude && claude --version 2>&1 || echo NOT_INSTALLED' 2>&1
            if ($claudeCheck -match 'NOT_INSTALLED') {
                Write-Host "  [FAIL] claude in container   (run: .\ralph.ps1 retry-install)" -ForegroundColor Magenta
            } else {
                Write-Host "  [OK]   claude in container   ($($claudeCheck -join '; '))" -ForegroundColor Green
            }
        }

        # 7. Build logs
        $logsDir = Join-Path $projectRoot ".ralph-build-logs"
        if (Test-Path $logsDir) {
            $count = (Get-ChildItem $logsDir -Filter "*.log").Count
            Write-Host "  [info] build logs            ($count in $logsDir)"
        }

        # 8. Project files
        $projectNeeded = @{ ".devcontainer" = $projectRoot }
        $siblingNeeded = @{ "ralph.ps1" = $PSScriptRoot; "run-ralph.sh" = $PSScriptRoot }
        $needed = $projectNeeded + $siblingNeeded
        foreach ($f in $needed.Keys) {
            $displayPath = if ($needed[$f] -ieq $projectRoot) { $f } else { "$ralphDirRel/$f" }
            if (Test-Path (Join-Path $needed[$f] $f)) {
                Write-Host "  [OK]   $displayPath" -ForegroundColor Green
            } else {
                Write-Host "  [warn] $displayPath   (missing)" -ForegroundColor Yellow
            }
        }

        Write-Host ""
    }

    'logs' {
        $cid = Get-ContainerId
        if (-not $cid) { Write-Error "Container not running."; exit 1 }
        docker logs -f $cid
    }

    'status' {
        $cid = Get-ContainerId
        if (-not $cid) {
            Write-Host "Container: not running" -ForegroundColor Yellow
            return
        }
        Write-Host "Container: $cid" -ForegroundColor Green
        docker ps --filter "id=$cid" --format "  state: {{.Status}}`n  image: {{.Image}}`n  ports: {{.Ports}}"
        Write-Host ""
        Write-Host "Active loops (tmux sessions):" -ForegroundColor Cyan
        docker exec $cid tmux ls 2>&1
    }

    default {
        Write-Host "ralph -- PowerShell wrapper for ralph-loop containers" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Lifecycle:"
        Write-Host "  up                 Build + start container (streams build output to .ralph-build-logs/)"
        Write-Host "  down               Stop + remove container (auth volume persists)"
        Write-Host "  rebuild            Rebuild image no-cache (streaming build log)"
        Write-Host ""
        Write-Host "Interact:"
        Write-Host "  shell              Interactive shell in container"
        Write-Host "  run `"<prompt>`"     Start an unattended loop (tmux + timeout)"
        Write-Host "  list               List active loop sessions"
        Write-Host "  attach <sess>      Attach to a running loop (Ctrl-B D to detach)"
        Write-Host "  tail <sess>        Tail a loop's log file"
        Write-Host "  kill <sess|all>    Kill loop session(s)"
        Write-Host ""
        Write-Host "Debug:"
        Write-Host "  doctor             Comprehensive health check (Docker, CLI, container, claude)"
        Write-Host "  build-log          Tail last build log (last 200 lines)"
        Write-Host "  retry-install      Re-run postCreate.sh (fixes partial Claude Code install)"
        Write-Host "  logs               Container stdout/stderr"
        Write-Host "  status             Container + session state"
        Write-Host ""
        Write-Host "Phone control (Azure Service Bus):"
        Write-Host "  listen             Run the command listener in this window (Ctrl-C to stop)"
        Write-Host "  listen-bg          Run the listener detached (hidden window, survives console close)"
        Write-Host "  listen-stop        Stop any detached listener"
        Write-Host "  phone-setup        Print iOS Shortcuts / Android setup instructions for your phone"
        Write-Host ""
        Write-Host "First-time setup: npm install -g @devcontainers/cli" -ForegroundColor Yellow
    }
}
