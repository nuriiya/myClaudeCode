# ============================================
# AI 协作工坊 - 一键停止脚本（Windows）
# 停止后端(3001)与前端(5173)服务
# 用法: powershell -ExecutionPolicy Bypass -File stop.ps1
# ============================================

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $Root ".service-pids.json"

# 按端口查找并终止进程（含子进程）
function Stop-Port($port, $name) {
    $stopped = $false
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        foreach ($conn in $conns) {
            $procId = $conn.OwningProcess
            try {
                # taskkill /T /F 终止进程树（包括子进程如 esbuild 等）
                $null = & taskkill /T /F /PID $procId 2>&1
                Write-Host "[$name] 已停止 (PID: $procId)" -ForegroundColor Green
                $stopped = $true
            } catch {
                Write-Host "[$name] 进程 $procId 无法停止" -ForegroundColor Yellow
            }
        }
    } catch {}
    if (-not $stopped) {
        Write-Host "[$name] 未在运行" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  停止 AI 协作工坊 服务" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Stop-Port 3001 "后端"
Stop-Port 5173 "前端"

# 清理 PID 文件
if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force
}

Write-Host ""
Write-Host "  所有服务已停止。" -ForegroundColor Green
Write-Host ""
