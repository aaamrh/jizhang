# 按坐标点击。只在账房 App 位于前台时才点，防止误点到手机上的其他 App
param([int]$x, [int]$y)
. "$PSScriptRoot\common.ps1"
$focus = adb @Adb shell "dumpsys window | grep -m1 mCurrentFocus" 2>$null
if ($focus -notmatch [regex]::Escape($AppId)) { "NOT OUR APP, refusing tap: $focus"; exit 2 }
adb @Adb shell "input tap $x $y"
