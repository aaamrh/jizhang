# 手机截图到 <ZF_BUILD_DIR>\shots\<name>.png。
# 不要用 "adb exec-out screencap -p > 文件"：Windows PowerShell 会把二进制当文本重新编码，图片会坏
param([string]$name = 'shot')
. "$PSScriptRoot\common.ps1"
adb @Adb shell screencap -p /sdcard/zf_shot.png
adb @Adb pull /sdcard/zf_shot.png (Join-Path $ShotDir "$name.png") | Out-Null
adb @Adb shell rm /sdcard/zf_shot.png
Join-Path $ShotDir "$name.png"
