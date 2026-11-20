# 在后台独立进程里跑 build.ps1（不受调用方会话超时影响），立即返回。看进度：Get-Content <ZF_BUILD_DIR>\build.log -Tail 5
$cmd = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\build.ps1`""
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
"launched pid=$($r.ProcessId) rc=$($r.ReturnValue)"
