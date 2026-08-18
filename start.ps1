# ============================================
# AI 协作工坊 - 一键启动脚本（Windows）
# 同时启动后端(3001)与前端(5173)
# 用法: powershell -ExecutionPolicy Bypass -File start.ps1
# ============================================

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $Root "server"
$ClientDir = Join-Path $Root "client"
$PidFile = Join-Path $Root ".service-pids.json"

# 获取占用指定端口的进程 PID
function Get-PidOnPort($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        if ($conn) { return $conn.OwningProcess }
    } catch {}
    return $null
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  AI 协作工坊 - 多 Agent 智能开发平台" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$pidMap = @{}

# --- 1. 后端 ---
$backendPid = Get-PidOnPort 3001
if ($backendPid) {
    Write-Host "[后端] 已在运行 (PID: $backendPid, http://localhost:3001)" -ForegroundColor Green
    $pidMap.backend = $backendPid
} else {
    Write-Host "[后端] 启动中..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory $ServerDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $backendPid = Get-PidOnPort 3001
    if ($backendPid) {
        Write-Host "[后端] 启动成功 (PID: $backendPid, http://localhost:3001)" -ForegroundColor Green
        $pidMap.backend = $backendPid
    } else {
        Write-Host "[后端] 启动失败，请手动检查: cd server; node src/index.js" -ForegroundColor Red
    }
}

# --- 2. 前端 ---
$frontendPid = Get-PidOnPort 5173
if ($frontendPid) {
    Write-Host "[前端] 已在运行 (PID: $frontendPid, http://localhost:5173)" -ForegroundColor Green
    $pidMap.frontend = $frontendPid
} else {
    Write-Host "[前端] 启动中..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev" -WorkingDirectory $ClientDir -WindowStyle Hidden
    Start-Sleep -Seconds 4
    $frontendPid = Get-PidOnPort 5173
    if ($frontendPid) {
        Write-Host "[前端] 启动成功 (PID: $frontendPid, http://localhost:5173)" -ForegroundColor Green
        $pidMap.frontend = $frontendPid
    } else {
        Write-Host "[前端] 启动失败，请手动检查: cd client; npm run dev" -ForegroundColor Red
    }
}

# 保存 PID 信息供 stop.ps1 使用
$pidMap | ConvertTo-Json | Set-Content $PidFile -Encoding UTF8

Write-Host ""
Write-Host "  访问地址: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  首次使用：点击左下角 [DeepSeek 密钥与模型配置]" -ForegroundColor Yellow
Write-Host "  添加 DeepSeek API Token 后即可开始对话" -ForegroundColor Yellow
Write-Host ""
Write-Host "  停止服务: powershell -ExecutionPolicy Bypass -File stop.ps1" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:5173"
