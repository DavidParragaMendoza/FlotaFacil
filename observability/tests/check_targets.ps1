$ErrorActionPreference = 'Stop'

$promUrl = "http://localhost:9090/api/v1/targets"
$expectedJobs = @(
    @{ Job = "core-service";         MetricsUrl = "http://localhost:3333/metrics" },
    @{ Job = "tracking-service";     MetricsUrl = "http://localhost:8080/metrics" },
    @{ Job = "notification-service"; MetricsUrl = "http://localhost:3331/metrics" }
)

Write-Output "============================================================"
Write-Output "TC-OBS-001 - Verificacion de Targets Prometheus y /metrics"
Write-Output "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Write-Output "============================================================"

$failed = $false

# 1. Consultar GET :9090/api/v1/targets
Write-Output ""
Write-Output "[1/2] Consultando API de Targets en Prometheus: $promUrl"
try {
    $resp = Invoke-RestMethod -Uri $promUrl -Method Get -TimeoutSec 10
} catch {
    Write-Output "ERROR: No se pudo consultar Prometheus en $promUrl -> $_"
    exit 1
}

if ($resp.status -ne "success") {
    Write-Output "ERROR: Respuesta de Prometheus con status != success ($($resp.status))"
    exit 1
}

$activeTargets = @($resp.data.activeTargets)
$upTargets = @($activeTargets | Where-Object { $_.health -eq "up" })

Write-Output "Targets activos encontrados: $($activeTargets.Count) | En estado UP: $($upTargets.Count)"
foreach ($t in $activeTargets) {
    $jobName = $t.labels.job
    $instance = $t.labels.instance
    $health = $t.health
    $lastError = if ($t.lastError) { $t.lastError } else { "(none)" }
    Write-Output ("  - job={0,-22} instance={1,-28} health={2,-6} lastError={3}" -f $jobName, $instance, $health, $lastError)
}

if ($activeTargets.Count -ne 3 -or $upTargets.Count -ne 3) {
    Write-Output "FALLO: Se esperaban exactamente 3 jobs instrumentados en 'up', pero se encontraron $($upTargets.Count) de $($activeTargets.Count)."
    $failed = $true
}

foreach ($exp in $expectedJobs) {
    $match = $upTargets | Where-Object { $_.labels.job -eq $exp.Job }
    if (-not $match) {
        Write-Output "FALLO: El job '$($exp.Job)' no se encuentra en estado 'up' en Prometheus."
        $failed = $true
    }
}

# 2. Consultar /metrics de cada servicio directamente
Write-Output ""
Write-Output "[2/2] Verificando endpoints /metrics individuales (HTTP 200 + payload de metricas)"
foreach ($exp in $expectedJobs) {
    try {
        $mResp = Invoke-WebRequest -Uri $exp.MetricsUrl -Method Get -UseBasicParsing -TimeoutSec 10
        $statusCode = [int]$mResp.StatusCode
        $contentLen = $mResp.Content.Length
        $sampleLine = ($mResp.Content -split "`n" | Where-Object { $_ -and $_ -notmatch '^#' } | Select-Object -First 1).Trim()
        Write-Output ("  - {0,-22} GET {1,-32} -> HTTP {2} ({3} bytes) | muestra: {4}" -f $exp.Job, $exp.MetricsUrl, $statusCode, $contentLen, $sampleLine)
        if ($statusCode -ne 200 -or $contentLen -le 0) {
            Write-Output "FALLO: $($exp.Job) devolvio HTTP $statusCode o contenido vacio."
            $failed = $true
        }
    } catch {
        Write-Output "FALLO: Error al consultar $($exp.MetricsUrl) ($($exp.Job)): $_"
        $failed = $true
    }
}

Write-Output ""
Write-Output "============================================================"
if ($failed) {
    Write-Output "RESULTADO TC-OBS-001: FALHOU"
    Write-Output "============================================================"
    exit 1
} else {
    Write-Output "RESULTADO TC-OBS-001: EXECUTADO COM SUCESSO (3/3 jobs UP, 3/3 /metrics HTTP 200)"
    Write-Output "============================================================"
    exit 0
}
