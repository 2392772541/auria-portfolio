$ErrorActionPreference = 'SilentlyContinue'

$port = 3101
$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($conn in $conns) {
        $pidVal = $conn.OwningProcess
        if ($pidVal -gt 4) {
            & taskkill.exe /F /T /PID $pidVal 2>$null
            Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
        }
    }
}

$procs = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -like "*auria-website*" -and $_.CommandLine -like "*index.mjs*"
}
foreach ($p in $procs) {
    & taskkill.exe /F /T /PID $p.ProcessId 2>$null
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Auria portfolio stopped."
exit 0
