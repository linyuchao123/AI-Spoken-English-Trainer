<#
.SYNOPSIS
    AI英语口语陪练 - 一键启动脚本
.DESCRIPTION
    自动检测端口冲突、同时启动前后端服务，所有服务就绪后自动打开浏览器。
    后端: FastAPI (uvicorn) → 端口 8000
    前端: Next.js (Turbopack) → 端口 3000
.PARAMETER None
    直接运行脚本即可，无需参数。
.EXAMPLE
    .\AI英语口语陪练.ps1
    或在文件资源管理器中右键 → "使用 PowerShell 运行"
.NOTES
    作者: AI英语口语陪练项目组
    版本: 1.0
    要求: Python 3.10+, Node.js 18+, .env 已配置
#>

# ============================================================
# 1. 自动定位项目根目录
# ============================================================
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ScriptPath)) {
    # 如果通过右键运行等方式，回退到当前工作目录
    $ScriptPath = Get-Location
}
Set-Location $ScriptPath
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   AI英语口语陪练 - 一键启动" -ForegroundColor Cyan
Write-Host "   项目路径: $ScriptPath" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 2. 配置区（可按需修改端口号）
# ============================================================
$BackendPort  = 8000
$FrontendPort = 3000
$BackendUrl   = "http://127.0.0.1:$BackendPort"
$FrontendUrl  = "http://localhost:$FrontendPort"
$MaxWaitSeconds = 90   # 最长等待时间（秒）

# ============================================================
# 3. 环境检查
# ============================================================
Write-Host "[环境检查]" -ForegroundColor Yellow

# --- 检查 .env ---
if (-not (Test-Path ".env")) {
    Write-Host "  ✗ 错误: 未找到 .env 文件！" -ForegroundColor Red
    Write-Host "    请先复制 .env.example → .env 并填入 API 密钥。" -ForegroundColor Red
    Pause
    exit 1
}
Write-Host "  ✓ .env 配置文件已就绪" -ForegroundColor Green

# --- 检查 Python ---
try {
    $pyVer = python --version 2>&1
    Write-Host "  ✓ $pyVer" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python 未安装或不在 PATH 中" -ForegroundColor Red
    Pause
    exit 1
}

# --- 检查 Node.js ---
try {
    $nodeVer = node --version 2>&1
    Write-Host "  ✓ Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js 未安装或不在 PATH 中" -ForegroundColor Red
    Pause
    exit 1
}

# --- 检查前端依赖 ---
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "  ! 前端依赖未安装，正在自动安装..." -ForegroundColor Yellow
    Push-Location frontend
    npm install 2>&1 | Out-Null
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ npm install 失败，请手动执行" -ForegroundColor Red
        Pause
        exit 1
    }
}
Write-Host "  ✓ 前端依赖已就绪" -ForegroundColor Green

Write-Host ""

# ============================================================
# 4. 端口冲突检测与处理
# ============================================================
Write-Host "[端口检测]" -ForegroundColor Yellow

function Test-PortInUse {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn -and $conn.Count -gt 0)
}

function Clear-Port {
    param([int]$Port, [string]$ServiceName)
    
    # 先检查是否有进程在监听
    $activeConn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($activeConn) {
        $pidList = $activeConn.OwningProcess | Select-Object -Unique
        foreach ($owningPid in $pidList) {
            if ($owningPid -eq 0) { continue }
            try {
                $proc = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  ! 端口 $Port 被 [$($proc.ProcessName)] (PID: $owningPid) 占用，正在释放..." -ForegroundColor Yellow
                    Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 1
                }
            } catch {}
        }
    }
    
    # 等待端口彻底释放（处理 TIME_WAIT 状态）
    $waitCount = 0
    while ((Test-PortInUse $Port) -and $waitCount -lt 10) {
        Start-Sleep -Seconds 1
        $waitCount++
    }
    
    if (Test-PortInUse $Port) {
        Write-Host "  ✗ 端口 $Port 无法释放，请手动关闭占用程序" -ForegroundColor Red
        return $false
    }
    Write-Host "  ✓ 端口 $Port ($ServiceName) 可用" -ForegroundColor Green
    return $true
}

$backendOk = Clear-Port $BackendPort "后端"
$frontendOk = Clear-Port $FrontendPort "前端"

if (-not $backendOk -or -not $frontendOk) {
    Pause
    exit 1
}

Write-Host ""

# ============================================================
# 5. 同时启动前后端服务
# ============================================================
Write-Host "[启动服务]" -ForegroundColor Yellow

# --- 启动后端 ---
Write-Host "  正在启动后端 (FastAPI)..." -ForegroundColor DarkGray
$backendProcess = Start-Process -FilePath "python" `
    -ArgumentList "-m","uvicorn","backend.main:app","--reload","--port","$BackendPort" `
    -WorkingDirectory $ScriptPath `
    -WindowStyle Minimized `
    -PassThru
Write-Host "  ✓ 后端进程已启动 (PID: $($backendProcess.Id))" -ForegroundColor Green

# --- 启动前端 ---
Write-Host "  正在启动前端 (Next.js)..." -ForegroundColor DarkGray
$frontendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c","npm","run","dev" `
    -WorkingDirectory "$ScriptPath\frontend" `
    -WindowStyle Minimized `
    -PassThru
Write-Host "  ✓ 前端进程已启动 (PID: $($frontendProcess.Id))" -ForegroundColor Green

Write-Host ""

# ============================================================
# 6. 等待所有服务就绪
# ============================================================
Write-Host "[等待服务就绪]" -ForegroundColor Yellow
Write-Host ("  最长等待 " + $MaxWaitSeconds + "s，请稍候...") -ForegroundColor DarkGray

$backendReady  = $false
$frontendReady = $false
$elapsed       = 0

while ((-not $backendReady -or -not $frontendReady) -and $elapsed -lt $MaxWaitSeconds) {
    Start-Sleep -Seconds 2
    $elapsed += 2

    # 检查后端健康端点
    if (-not $backendReady) {
        try {
            $res = Invoke-WebRequest -Uri "$BackendUrl/api/health" `
                                     -TimeoutSec 2 `
                                     -UseBasicParsing `
                                     -ErrorAction Stop
            if ($res.StatusCode -eq 200) {
                $backendReady = $true
                Write-Host ("  ✓ 后端已就绪 → $BackendUrl  (" + $elapsed + "s)") -ForegroundColor Green
            }
        } catch {
            # 后端进程是否意外退出
            if ($backendProcess.HasExited -and $backendProcess.ExitCode -ne 0) {
                Write-Host "  ✗ 后端进程异常退出 (ExitCode: $($backendProcess.ExitCode))" -ForegroundColor Red
                Pause
                exit 1
            }
        }
    }

    # 检查前端是否就绪
    if (-not $frontendReady) {
        try {
            $res = Invoke-WebRequest -Uri $FrontendUrl `
                                     -TimeoutSec 2 `
                                     -UseBasicParsing `
                                     -ErrorAction Stop
            if ($res.StatusCode -eq 200) {
                $frontendReady = $true
                Write-Host ("  ✓ 前端已就绪 → $FrontendUrl  (" + $elapsed + "s)") -ForegroundColor Green
            }
        } catch {
            if ($frontendProcess.HasExited -and $frontendProcess.ExitCode -ne 0) {
                Write-Host "  ✗ 前端进程异常退出 (ExitCode: $($frontendProcess.ExitCode))" -ForegroundColor Red
                Pause
                exit 1
            }
        }
    }
}

Write-Host ""

# ============================================================
# 7. 打开浏览器
# ============================================================
if ($backendReady -and $frontendReady) {
    Write-Host "[启动完成]" -ForegroundColor Yellow
    Write-Host "  后端: $BackendUrl  (API文档: $BackendUrl/docs)" -ForegroundColor White
    Write-Host "  前端: $FrontendUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "  正在打开默认浏览器..." -ForegroundColor Cyan
    Start-Process $FrontendUrl
    Write-Host "  ✓ 浏览器已打开，祝学习愉快！" -ForegroundColor Green
} elseif (-not $backendReady) {
    Write-Host "  ✗ 后端启动超时，请检查控制台输出" -ForegroundColor Red
} elseif (-not $frontendReady) {
    Write-Host "  ✗ 前端启动超时，请检查控制台输出" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  后台运行中，关闭此窗口不影响服务" -ForegroundColor DarkGray
Write-Host "  按任意键退出本脚本（服务将继续运行）" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Cyan
Pause
