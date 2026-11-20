# 列出当前界面上的文字和坐标（-list），或按文字点击（-tap '文字'，-nth 选第几个匹配）。
# 只在账房 App 位于前台时才动作；界面抓取失败时直接退出，不用旧数据
param([string]$tap = '', [int]$nth = 0, [switch]$list)
. "$PSScriptRoot\common.ps1"
$xml = Join-Path $BuildDir 'ui.xml'
Remove-Item $xml -ErrorAction SilentlyContinue
$focus = adb @Adb shell "dumpsys window | grep -m1 mCurrentFocus" 2>$null
if ($focus -notmatch [regex]::Escape($AppId)) { "NOT OUR APP: $focus"; exit 2 }
$dump = adb @Adb shell uiautomator dump /sdcard/zf_ui.xml 2>&1
if ("$dump" -notmatch 'dumped') { "DUMP FAILED: $dump"; exit 3 }
adb @Adb pull /sdcard/zf_ui.xml $xml | Out-Null
[xml]$x = Get-Content $xml -Encoding utf8
$nodes = $x.SelectNodes('//node') | Where-Object { $_.text -or $_.'content-desc' }
if ($list) { $nodes | ForEach-Object { "{0} | {1} | {2}" -f $_.text, $_.'content-desc', $_.bounds } | Select-Object -First 80 }
if ($tap) {
  $hit = @($nodes | Where-Object { $_.text -eq $tap -or $_.'content-desc' -eq $tap })
  if (-not $hit) { $hit = @($nodes | Where-Object { $_.text -like "*$tap*" -or $_.'content-desc' -like "*$tap*" }) }
  if ($hit.Count -le $nth) { "NOT FOUND: $tap"; exit 1 }
  $b = [regex]::Matches($hit[$nth].bounds, '\d+') | ForEach-Object { [int]$_.Value }
  $cx = [int](($b[0] + $b[2]) / 2); $cy = [int](($b[1] + $b[3]) / 2)
  adb @Adb shell input tap $cx $cy
  "tapped '$tap' at $cx,$cy"
}
