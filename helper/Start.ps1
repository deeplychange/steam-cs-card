$ErrorActionPreference = 'Stop'
$runtime = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($runtime) { $runtime.Source } else { $null }
if (-not $nodePath) {
    $bundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundled) { $nodePath = $bundled }
}
if (-not $nodePath) { Write-Host '没有找到 Node.js。请安装 Node.js 18 或更新版本后重试。'; exit 1 }
& $nodePath (Join-Path $PSScriptRoot 'bridge.cjs')
