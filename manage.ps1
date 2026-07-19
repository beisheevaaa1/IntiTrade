[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "restart", "status", "logs")]
  [string]$Action = "start",

  [ValidateSet("auto", "docker", "external")]
  [string]$Database = "auto",

  [switch]$OpenBrowser,
  [switch]$Follow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$StateRoot = Join-Path $ProjectRoot ".manage"
$BackendEnv = Join-Path $BackendRoot ".env"
$RootEnv = Join-Path $ProjectRoot ".env"

$BackendPidFile = Join-Path $StateRoot "backend.pid"
$FrontendPidFile = Join-Path $StateRoot "frontend.pid"
$BackendLog = Join-Path $StateRoot "backend.log"
$BackendErrorLog = Join-Path $StateRoot "backend-error.log"
$FrontendLog = Join-Path $StateRoot "frontend.log"
$FrontendErrorLog = Join-Path $StateRoot "frontend-error.log"
$DatabaseModeFile = Join-Path $StateRoot "database-mode"

function Write-Step([string]$Message) {
  Write-Host "[IntiTrade] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Get-RequiredCommand([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command '$Name' was not found in PATH."
  }
  return $command.Source
}

function Get-EnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $escapedName = [Regex]::Escape($Name)
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^\s*$escapedName\s*=\s*(.*)\s*$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $escapedName = [Regex]::Escape($Name)
  $replacement = "$Name=`"$Value`""
  $updated = $false

  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match "^\s*$escapedName\s*=") {
      $updated = $true
      $lines[$index] = $replacement
    }
  }

  if (-not $updated) {
    $lines += $replacement
  }
  [IO.File]::WriteAllLines($Path, $lines, [Text.UTF8Encoding]::new($false))
}

function New-LocalSecret([int]$Bytes = 32) {
  $buffer = [byte[]]::new($Bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToHexString($buffer).ToLowerInvariant()
}

function Test-TcpPort([string]$HostName, [int]$Port, [int]$TimeoutMs = 700) {
  # Docker Desktop publishes PostgreSQL on IPv4. On some Windows machines
  # "localhost" resolves to ::1 first, which made a healthy container look offline.
  $connectHost = if ($HostName -eq "localhost") { "127.0.0.1" } else { $HostName }
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($connectHost, $Port)
    if (-not $task.Wait($TimeoutMs)) {
      return $false
    }
    $task.GetAwaiter().GetResult()
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-DatabaseEndpoint {
  $databaseUrl = Get-EnvValue $BackendEnv "DATABASE_URL"
  if (-not $databaseUrl) {
    throw "DATABASE_URL is missing from backend/.env."
  }

  try {
    $uri = [Uri]$databaseUrl
    $port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    return @{ Host = $uri.Host; Port = $port }
  } catch {
    throw "DATABASE_URL in backend/.env is not a valid PostgreSQL URL."
  }
}

function Test-DockerAvailable {
  if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    return $false
  }
  & docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Test-DockerPostgresRunning {
  if (-not (Test-DockerAvailable)) {
    return $false
  }
  $containerId = & docker compose --project-directory $ProjectRoot ps -q postgres 2>$null | Select-Object -First 1
  return -not [string]::IsNullOrWhiteSpace($containerId)
}

function Sync-DockerDatabaseCredentials {
  if (-not (Test-Path -LiteralPath $RootEnv)) {
    return
  }

  $password = Get-EnvValue $RootEnv "POSTGRES_PASSWORD"
  if (-not $password) {
    throw "POSTGRES_PASSWORD is missing from the root .env file."
  }

  # A named Docker volume keeps the password from its first initialization.
  # Synchronize it without deleting local data when .env has been regenerated.
  $escapedPassword = $password.Replace("'", "''")
  $sql = "ALTER ROLE marketplace WITH LOGIN PASSWORD '$escapedPassword';"
  $sql | & docker compose --project-directory $ProjectRoot exec -T postgres `
    psql -U marketplace -d university_marketplace -v ON_ERROR_STOP=1 *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not synchronize credentials for the managed Docker PostgreSQL database."
  }
}

function Initialize-DockerConfiguration([bool]$ReplaceBackendDatabaseUrl) {
  if (-not (Test-Path -LiteralPath $StateRoot)) {
    New-Item -ItemType Directory -Path $StateRoot | Out-Null
  }

  if (-not (Test-Path -LiteralPath $RootEnv)) {
    $password = New-LocalSecret 24
    $rootEnvLines = @(
      "POSTGRES_PASSWORD=$password",
      "POSTGRES_PORT=5432"
    )
    [IO.File]::WriteAllLines($RootEnv, $rootEnvLines, [Text.UTF8Encoding]::new($false))
  }

  if (-not (Test-Path -LiteralPath $BackendEnv)) {
    Copy-Item -LiteralPath (Join-Path $BackendRoot ".env.example") -Destination $BackendEnv
    $ReplaceBackendDatabaseUrl = $true
  }

  if ($ReplaceBackendDatabaseUrl) {
    $password = Get-EnvValue $RootEnv "POSTGRES_PASSWORD"
    $port = Get-EnvValue $RootEnv "POSTGRES_PORT"
    if (-not $password) {
      throw "POSTGRES_PASSWORD is missing from the root .env file."
    }
    if (-not $port) { $port = "5432" }

    $encodedPassword = [Uri]::EscapeDataString($password)
    Set-EnvValue $BackendEnv "DATABASE_URL" "postgresql://marketplace:$encodedPassword@localhost:$port/university_marketplace?schema=public"

    $jwtSecret = Get-EnvValue $BackendEnv "JWT_SECRET"
    if (-not $jwtSecret -or $jwtSecret -eq "replace-with-a-long-random-secret-for-production") {
      Set-EnvValue $BackendEnv "JWT_SECRET" (New-LocalSecret 32)
    }
  }
}

function Wait-ForDatabase([int]$Attempts = 30) {
  $endpoint = Get-DatabaseEndpoint
  Write-Step "Waiting for PostgreSQL at $($endpoint.Host):$($endpoint.Port)"
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (Test-TcpPort $endpoint.Host $endpoint.Port) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "PostgreSQL did not become reachable at $($endpoint.Host):$($endpoint.Port)."
}

function Start-Database {
  if (-not (Test-Path -LiteralPath $BackendEnv)) {
    if ($Database -eq "external") {
      Copy-Item -LiteralPath (Join-Path $BackendRoot ".env.example") -Destination $BackendEnv
      throw "backend/.env was created. Configure DATABASE_URL and run manage.ps1 again."
    }
    if (-not (Test-DockerAvailable)) {
      throw "Docker is unavailable and backend/.env does not exist. Install/start Docker or configure a local PostgreSQL and run with -Database external."
    }
    Write-Step "Creating local Docker/PostgreSQL configuration"
    Initialize-DockerConfiguration $true
  }

  $endpoint = Get-DatabaseEndpoint
  if (Test-TcpPort $endpoint.Host $endpoint.Port) {
    $activeMode = if (Test-DockerPostgresRunning) { "docker" } else { "external" }
    if ($activeMode -eq "docker") {
      Sync-DockerDatabaseCredentials
    }
    [IO.File]::WriteAllText($DatabaseModeFile, $activeMode)
    Write-Ok "PostgreSQL is reachable at $($endpoint.Host):$($endpoint.Port)"
    return
  }

  if ($Database -eq "external") {
    throw "PostgreSQL is not reachable at $($endpoint.Host):$($endpoint.Port). Start it and try again."
  }

  if (-not (Test-DockerAvailable)) {
    throw "PostgreSQL is not reachable and Docker Desktop is not running. Start either one and try again."
  }

  $isLocalDatabase = $endpoint.Host -in @("localhost", "127.0.0.1", "::1")
  $autoSwitchToDocker = $Database -eq "auto" -and -not (Test-Path -LiteralPath $RootEnv) -and $isLocalDatabase
  $replaceBackendUrl = $Database -eq "docker" -or $autoSwitchToDocker
  if (-not (Test-Path -LiteralPath $RootEnv) -and $Database -eq "auto" -and -not $autoSwitchToDocker) {
    throw "The configured remote PostgreSQL is offline. Start it or use a local database."
  }

  if ($replaceBackendUrl -and (Test-Path -LiteralPath $BackendEnv)) {
    $backup = Join-Path $StateRoot ("backend-env-before-docker-{0}.backup" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    Copy-Item -LiteralPath $BackendEnv -Destination $backup
    Write-Warn "The previous backend/.env was backed up to $backup"
  }

  Initialize-DockerConfiguration $replaceBackendUrl
  Write-Step "Starting PostgreSQL with Docker Compose"
  & docker compose --project-directory $ProjectRoot up -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose could not start PostgreSQL."
  }
  [IO.File]::WriteAllText($DatabaseModeFile, "docker")
  Wait-ForDatabase
  Sync-DockerDatabaseCredentials
  Write-Ok "Docker PostgreSQL is ready"
}

function Test-ProcessId([string]$PidFile) {
  if (-not (Test-Path -LiteralPath $PidFile)) {
    return $false
  }
  $storedPid = (Get-Content -LiteralPath $PidFile -Raw).Trim()
  if ($storedPid -notmatch "^\d+$") {
    Remove-Item -LiteralPath $PidFile -Force
    return $false
  }
  return $null -ne (Get-Process -Id ([int]$storedPid) -ErrorAction SilentlyContinue)
}

function Start-ManagedProcess(
  [string]$Name,
  [string]$WorkingDirectory,
  [string]$PidFile,
  [string]$OutputLog,
  [string]$ErrorLog
) {
  if (Test-ProcessId $PidFile) {
    Write-Ok "$Name is already running"
    return
  }

  foreach ($log in @($OutputLog, $ErrorLog)) {
    if (Test-Path -LiteralPath $log) {
      Clear-Content -LiteralPath $log
    }
  }

  $npm = Get-RequiredCommand "npm.cmd"
  $process = Start-Process `
    -FilePath $npm `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $OutputLog `
    -RedirectStandardError $ErrorLog `
    -WindowStyle Hidden `
    -PassThru

  [IO.File]::WriteAllText($PidFile, [string]$process.Id)
  Write-Step "$Name started with PID $($process.Id)"
}

function Stop-ManagedProcess([string]$Name, [string]$PidFile) {
  if (-not (Test-ProcessId $PidFile)) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Warn "$Name is not managed by this script"
    return
  }

  $storedPid = [int](Get-Content -LiteralPath $PidFile -Raw).Trim()
  & taskkill.exe /PID $storedPid /T /F *> $null
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  Write-Ok "$Name stopped"
}

function Wait-ForHttp([string]$Name, [string]$Url, [int]$Attempts = 40) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name is ready: $Url"
        return
      }
    } catch {
      # The development server may still be compiling.
    }
    Start-Sleep -Milliseconds 500
  }
  throw "$Name did not become ready at $Url. Run '.\manage.ps1 logs' for details."
}

function Ensure-NodeDependencies([string]$Directory, [string]$Name) {
  if (Test-Path -LiteralPath (Join-Path $Directory "node_modules")) {
    return
  }
  Write-Step "Installing $Name dependencies"
  Push-Location $Directory
  try {
    & (Get-RequiredCommand "npm.cmd") ci
    if ($LASTEXITCODE -ne 0) {
      throw "npm ci failed for $Name."
    }
  } finally {
    Pop-Location
  }
}

function Show-ProjectReady {
  Write-Host ""
  Write-Ok "IntiTrade is running"
  Write-Host "Frontend: http://localhost:5173"
  Write-Host "Backend:  http://localhost:4000"
  Write-Host "API docs: http://localhost:4000/api/docs"
  Write-Host "Stop:     .\manage.ps1 stop"
  Write-Host "Logs:     .\manage.ps1 logs -Follow"

  if ($OpenBrowser) {
    Start-Process "http://localhost:5173"
  }
}

function Start-Project {
  New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null
  $node = Get-RequiredCommand "node.exe"
  [int]$nodeMajor = ((& $node --version).TrimStart("v").Split(".")[0])
  if ($nodeMajor -lt 20) {
    throw "Node.js 20 or newer is required. Current major version: $nodeMajor."
  }

  Start-Database

  $backendAlreadyRunning = Test-ProcessId $BackendPidFile
  $frontendAlreadyRunning = Test-ProcessId $FrontendPidFile
  if ($backendAlreadyRunning -and $frontendAlreadyRunning) {
    Wait-ForHttp "Backend" "http://127.0.0.1:4000/api/health/ready"
    Wait-ForHttp "Frontend" "http://localhost:5173"
    Show-ProjectReady
    return
  }
  if ($backendAlreadyRunning -or $frontendAlreadyRunning) {
    Write-Warn "Only part of the project is running; restarting both application processes"
    Stop-ManagedProcess "Frontend" $FrontendPidFile
    Stop-ManagedProcess "Backend" $BackendPidFile
  }

  Ensure-NodeDependencies $BackendRoot "backend"
  Ensure-NodeDependencies $FrontendRoot "frontend"

  Write-Step "Generating Prisma client and applying local migrations"
  Push-Location $BackendRoot
  try {
    & (Get-RequiredCommand "npx.cmd") prisma generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma client generation failed." }
    & (Get-RequiredCommand "npx.cmd") prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "Prisma migrations failed." }
  } finally {
    Pop-Location
  }

  Start-ManagedProcess "Backend" $BackendRoot $BackendPidFile $BackendLog $BackendErrorLog
  try {
    Wait-ForHttp "Backend" "http://127.0.0.1:4000/api/health/ready"
    Start-ManagedProcess "Frontend" $FrontendRoot $FrontendPidFile $FrontendLog $FrontendErrorLog
    # Vite binds localhost to ::1 on Windows by default.
    Wait-ForHttp "Frontend" "http://localhost:5173"
  } catch {
    Stop-ManagedProcess "Frontend" $FrontendPidFile
    Stop-ManagedProcess "Backend" $BackendPidFile
    throw
  }

  Show-ProjectReady
}

function Stop-Project {
  Stop-ManagedProcess "Frontend" $FrontendPidFile
  Stop-ManagedProcess "Backend" $BackendPidFile

  $managedDatabaseMode = if (Test-Path -LiteralPath $DatabaseModeFile) {
    (Get-Content -LiteralPath $DatabaseModeFile -Raw).Trim()
  } else {
    ""
  }
  if ($managedDatabaseMode -eq "docker" -and (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Step "Stopping managed Docker PostgreSQL"
    & docker compose --project-directory $ProjectRoot stop postgres
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Docker PostgreSQL stopped; its data volume was preserved"
    }
  }
}

function Show-Status {
  $backendProcess = Test-ProcessId $BackendPidFile
  $frontendProcess = Test-ProcessId $FrontendPidFile
  Write-Host ("Backend process:  " + $(if ($backendProcess) { "running" } else { "stopped" }))
  Write-Host ("Frontend process: " + $(if ($frontendProcess) { "running" } else { "stopped" }))

  if (Test-Path -LiteralPath $BackendEnv) {
    try {
      $endpoint = Get-DatabaseEndpoint
      $databaseReady = Test-TcpPort $endpoint.Host $endpoint.Port
      Write-Host ("PostgreSQL:       " + $(if ($databaseReady) { "reachable" } else { "unreachable" }) + " ($($endpoint.Host):$($endpoint.Port))")
    } catch {
      Write-Warn $_.Exception.Message
    }
  } else {
    Write-Host "PostgreSQL:       not configured"
  }

  foreach ($service in @(
    @{ Name = "Backend HTTP"; Url = "http://127.0.0.1:4000/api/health/ready" },
    @{ Name = "Frontend HTTP"; Url = "http://localhost:5173" }
  )) {
    try {
      $response = Invoke-WebRequest -Uri $service.Url -UseBasicParsing -TimeoutSec 1
      Write-Host "$($service.Name):      HTTP $($response.StatusCode)"
    } catch {
      Write-Host "$($service.Name):      unavailable"
    }
  }
}

function Show-Logs {
  $logs = @(@($BackendLog, $BackendErrorLog, $FrontendLog, $FrontendErrorLog) | Where-Object { Test-Path -LiteralPath $_ })
  if ($logs.Count -eq 0) {
    Write-Warn "No managed logs exist yet. Start the project first."
    return
  }

  if ($Follow) {
    Write-Step "Following logs. Press Ctrl+C to stop."
    Get-Content -LiteralPath $logs -Tail 40 -Wait
  } else {
    foreach ($log in $logs) {
      Write-Host ""
      Write-Host "--- $([IO.Path]::GetFileName($log)) ---" -ForegroundColor DarkCyan
      Get-Content -LiteralPath $log -Tail 40
    }
  }
}

try {
  switch ($Action) {
    "start" { Start-Project }
    "stop" { Stop-Project }
    "restart" { Stop-Project; Start-Project }
    "status" { Show-Status }
    "logs" { Show-Logs }
  }
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
