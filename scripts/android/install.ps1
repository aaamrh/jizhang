# 把最近一次构建的测试包装到手机上，转发 3000 端口到电脑上的后端，并启动 App
. "$PSScriptRoot\common.ps1"
if (-not $Serial) { 'NO USB DEVICE'; exit 1 }
$apk = Join-Path $BuildDir 'app\android\app\build\outputs\apk\release\app-release.apk'
adb @Adb install -r $apk
adb @Adb reverse tcp:3000 tcp:3000 | Out-Null
adb @Adb shell am force-stop $AppId
adb @Adb shell am start -n "$AppId/.MainActivity" | Out-Null
"installed on $Serial"
