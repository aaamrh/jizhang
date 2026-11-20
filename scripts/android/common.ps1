# 真机测试脚本的共用配置。都可以用环境变量覆盖：
#   ZF_BUILD_DIR   构建副本和截图放哪（默认 D:\zfbuild，路径越短越好，Windows 有 260 字符限制）
#   ZF_ADB_SERIAL  手机序列号（默认取第一台 USB 连接的设备，忽略 ip:port 形式的无线设备）
#   ZF_JAVA_HOME   JDK 17 目录（默认用 JAVA_HOME，再退回 D:\environment\jdk-17.0.11）
$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$BuildDir = if ($env:ZF_BUILD_DIR) { $env:ZF_BUILD_DIR } else { 'D:\zfbuild' }
$ShotDir = Join-Path $BuildDir 'shots'
New-Item -ItemType Directory -Force $BuildDir, $ShotDir | Out-Null
$Serial = $env:ZF_ADB_SERIAL
if (-not $Serial) {
  $line = adb devices | Select-String '^\S+\s+device$' | Where-Object { $_.Line -notmatch ':' } | Select-Object -First 1
  if ($line) { $Serial = ($line.Line -split '\s+')[0] }
}
$Adb = @('-s', $Serial)
$AppId = 'com.zhangfang.app'
