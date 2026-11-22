# 构建安卓测试包（release，只编 arm64）。日志写到 <ZF_BUILD_DIR>\build.log，最后一行是 "EXIT <退出码>"。
# 第一次要下载依赖，可能超过 10 分钟；需要后台跑时用 build-detached.ps1。
. "$PSScriptRoot\common.ps1"
$log = Join-Path $BuildDir 'build.log'
"START $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Encoding utf8
$src = Join-Path $RepoRoot 'app'; $dst = Join-Path $BuildDir 'app'
# 在副本里构建：源码不受 prebuild 和下面的测试专用改动影响
# .cxx：各原生库的 C++ 编译缓存只在副本里有，/MIR 会把它删掉、下次从头编译（又慢又吃内存），所以排除
robocopy $src $dst /MIR /XD "$src\android" "$dst\android" "$src\ios" "$dst\ios" "$src\.expo" "$src\dist" ".cxx" /NFL /NDL /NJH /NJS /NP /MT:16 | Out-Null
"COPIED $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = if ($env:ZF_JAVA_HOME) { $env:ZF_JAVA_HOME } elseif ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'D:\environment\jdk-17.0.11' }
$env:EXPO_PUBLIC_API_URL = 'http://localhost:3000'
$env:EXPO_PUBLIC_MOCK_PAY = 'true'
$cmake = Join-Path $sdk 'cmake\3.31.6'
if (-not (Test-Path $cmake)) {
  "MISSING $cmake : run  sdkmanager 'cmake;3.31.6'  first" | Out-File $log -Append -Encoding utf8
  "EXIT 1 $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8
  exit 1
}
Set-Location $dst
npx expo prebuild --platform android --no-install 2>&1 | Out-File $log -Append -Encoding utf8
# 以下只改构建副本：
# 1) 测试包允许连 http://localhost（adb reverse 转到电脑上的后端）
$mf = "$dst\android\app\src\main\AndroidManifest.xml"
$m = Get-Content $mf -Raw
if ($m -notmatch 'usesCleartextTraffic="true"') { ($m -replace '<application ', '<application android:usesCleartextTraffic="true" ') | Set-Content $mf -Encoding utf8 }
# 2) Gradle 本体从腾讯云镜像下载（services.gradle.org 在国内很慢，会读超时）
$wp = "$dst\android\gradle\wrapper\gradle-wrapper.properties"
(Get-Content $wp) -replace '^distributionUrl=https\\://services\.gradle\.org/distributions/', 'distributionUrl=https\://mirrors.cloud.tencent.com/gradle/' -replace '^networkTimeout=.*', 'networkTimeout=120000' | Set-Content $wp -Encoding ascii
# 3) 用 CMake 3.31.6（自带 ninja 1.12，支持 Windows 长路径；默认 3.22.1 的 ninja 1.10 会因路径超 260 字符失败）
$lp = "$dst\android\local.properties"
$cmakeDir = ($cmake -replace '\\', '\\' -replace ':', '\:')
$keep = @(Get-Content $lp -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '^cmake\.dir=' })
Set-Content $lp ($keep + "cmake.dir=$cmakeDir") -Encoding ascii
# 4) 省内存：Kotlin 在 Gradle 进程里编译（不另起 3 个各占 1.7G 的编译守护进程），限制并行数；构建完停掉守护进程
$gp = "$dst\android\gradle.properties"
$lean = @{ 'kotlin.compiler.execution.strategy' = 'in-process'; 'org.gradle.workers.max' = '2'; 'org.gradle.jvmargs' = '-Xmx3g -XX:MaxMetaspaceSize=768m'
  # 网慢时大文件下到一半会读超时（Gradle 默认 30 秒），放宽
  'systemProp.org.gradle.internal.http.socketTimeout' = '300000'; 'systemProp.org.gradle.internal.http.connectionTimeout' = '120000' }
$keep = @(Get-Content $gp | Where-Object { $k = ($_ -split '=', 2)[0].Trim(); -not $lean.ContainsKey($k) })
Set-Content $gp ($keep + ($lean.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })) -Encoding ascii
# 5) Maven 依赖先走阿里云镜像：react-android 一个 aar 就 170MB，从 repo.maven.apache.org 下载会读超时、构建失败
$bg = "$dst\android\build.gradle"
$g = Get-Content $bg -Raw
if ($g -notmatch 'maven\.aliyun\.com') {
  $mirror = "maven { url 'https://maven.aliyun.com/repository/google' }`n    maven { url 'https://maven.aliyun.com/repository/public' }`n    google()"
  [IO.File]::WriteAllText($bg, ($g -replace 'google\(\)', $mirror), (New-Object Text.UTF8Encoding $false))
}
"PREBUILT $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8
Set-Location android
& .\gradlew.bat assembleRelease --console=plain "-PreactNativeArchitectures=arm64-v8a" 2>&1 | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE
& .\gradlew.bat --stop 2>&1 | Out-Null
"EXIT $code $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8
