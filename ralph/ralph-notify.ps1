<#
.SYNOPSIS
    Unified notification helper for ralph-loop — console + Windows toast + phone push.

.DESCRIPTION
    Dot-source this file to get Send-RalphNotification in scope:
        . $PSScriptRoot\ralph-notify.ps1

    Three channels, used together:
      - Console:      always (colour-coded by level)
      - Windows toast: if BurntToast module is installed
      - Phone push:   if ntfy topic is configured in ~/.ralph/config.json

    Config is auto-generated on first call to Initialize-RalphConfig.

.EXAMPLE
    Send-RalphNotification -Level success -Title "Story 2 complete" -Message "Batch capture mode"
    Send-RalphNotification -Level error   -Title "Loop died"         -Message "tmux session ended without completion"
    Send-RalphNotification -Level info    -Title "Now working on"    -Message "Story 3: Custom CSS theming"
#>

function Get-RalphConfigPath {
    $dir = Join-Path $env:USERPROFILE ".ralph"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return (Join-Path $dir "config.json")
}

function Initialize-RalphConfig {
    # Loads or creates the per-user config file. Generates an ntfy topic the first time.
    $path = Get-RalphConfigPath
    if (Test-Path $path) {
        try { return (Get-Content $path -Raw | ConvertFrom-Json) } catch { }
    }

    # Generate a unique-ish topic — `ralph-<username>-<8 random chars>`
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    $rand = -join (1..8 | ForEach-Object { $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)] })
    $safeUser = ($env:USERNAME -replace '[^a-zA-Z0-9]', '').ToLower()
    if (-not $safeUser) { $safeUser = 'user' }

    $cfg = [PSCustomObject]@{
        ntfy_topic  = "ralph-$safeUser-$rand"
        ntfy_server = "https://ntfy.sh"
        toasts      = $true
        created_at  = (Get-Date).ToString('o')
    }
    $cfg | ConvertTo-Json -Depth 3 | Set-Content -Path $path -Encoding UTF8

    Write-Host ""
    Write-Host "==> Ralph notifications configured." -ForegroundColor Cyan
    Write-Host "    Config:      $path"
    Write-Host "    ntfy topic:  $($cfg.ntfy_topic)"
    Write-Host "    Subscribe URL: $($cfg.ntfy_server)/$($cfg.ntfy_topic)"
    Write-Host ""
    Write-Host "    To receive push notifications on your phone:" -ForegroundColor Yellow
    Write-Host "      1. Install 'ntfy' (free) from the App Store / Play Store"
    Write-Host "      2. Open the app, tap '+' to subscribe to a topic"
    Write-Host "      3. Enter topic:  $($cfg.ntfy_topic)"
    Write-Host "         (leave server as ntfy.sh default)"
    Write-Host ""
    Write-Host "    To enable Windows toast notifications:" -ForegroundColor Yellow
    Write-Host "      Install-Module BurntToast -Scope CurrentUser -Force"
    Write-Host ""
    Write-Host "    To disable either channel, edit $path"
    Write-Host ""

    return $cfg
}

function Send-RalphNotification {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [ValidateSet('info','success','error','start','done')] [string]$Level,
        [Parameter(Mandatory)] [string]$Title,
        [string]$Message = ""
    )

    $cfg = Initialize-RalphConfig

    # ---- Console ----
    $colour = switch ($Level) {
        'info'    { 'Cyan' }
        'success' { 'Green' }
        'error'   { 'Magenta' }
        'start'   { 'Yellow' }
        'done'    { 'Green' }
    }
    $icon = switch ($Level) {
        'info'    { '[i]' }
        'success' { '[OK]' }
        'error'   { '[!!]' }
        'start'   { '[>]' }
        'done'    { '[**]' }
    }
    $timestamp = Get-Date -Format 'HH:mm:ss'
    Write-Host "$icon [$timestamp] $Title" -ForegroundColor $colour -NoNewline
    if ($Message) { Write-Host " - $Message" -ForegroundColor Gray } else { Write-Host "" }

    # ---- Windows toast (if BurntToast installed and enabled) ----
    if ($cfg.toasts -and (Get-Module -ListAvailable -Name BurntToast)) {
        try {
            # Import once per session
            if (-not (Get-Module -Name BurntToast)) { Import-Module BurntToast -ErrorAction Stop }
            $toastArgs = @{ Text = @($Title, $Message) }
            # Sound hint varies by level
            if ($Level -eq 'error') { $toastArgs['Sound'] = 'Alarm2' }
            elseif ($Level -eq 'done') { $toastArgs['Sound'] = 'Mail' }
            New-BurntToastNotification @toastArgs -ErrorAction Stop
        } catch {
            # Fail silently — toasts are best-effort, never block the loop
        }
    }

    # ---- Phone push via ntfy.sh ----
    if ($cfg.ntfy_topic -and $cfg.ntfy_server) {
        try {
            $priority = switch ($Level) {
                'error' { '4' }      # urgent: loud sound, bypass dnd
                'done'  { '4' }      # urgent: user specifically wanted to know
                'success' { '3' }    # default
                default { '2' }      # low priority for routine start/info
            }
            $tags = switch ($Level) {
                'info'    { 'hourglass_flowing_sand' }
                'success' { 'white_check_mark' }
                'error'   { 'warning' }
                'start'   { 'rocket' }
                'done'    { 'tada' }
            }
            $headers = @{
                'Title'    = $Title
                'Priority' = $priority
                'Tags'     = $tags
            }
            $url = "$($cfg.ntfy_server)/$($cfg.ntfy_topic)"
            $body = if ($Message) { $Message } else { ' ' }
            # Async fire-and-forget; timeout aggressively so a network hiccup can't stall polling
            Invoke-RestMethod -Uri $url -Method Post -Body $body -Headers $headers -TimeoutSec 5 -ErrorAction Stop | Out-Null
        } catch {
            # Fail silently — if phone can't be reached, loop continues
        }
    }
}
