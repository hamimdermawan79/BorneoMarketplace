param(
    [string]$GradlePath,
    [string]$SdkPath = "$env:LOCALAPPDATA/Android/Sdk",
    [string]$SigningDirectory = "$env:LOCALAPPDATA/BorneoMarketplace/android-signing"
)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$androidPath = Join-Path $repoPath 'apps/android'
if (!(Test-Path -LiteralPath $SdkPath)) { throw 'Android SDK tidak ditemukan. Tentukan -SdkPath.' }
if (!$GradlePath) { $GradlePath = Join-Path $androidPath 'gradlew.bat' }
if (!(Test-Path -LiteralPath $GradlePath)) { throw 'Gradle tidak ditemukan. Tentukan -GradlePath pada build pertama.' }

# Persistent private release key, outside the repository. Never replace this key for updates.
New-Item -ItemType Directory -Path $SigningDirectory -Force | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $SigningDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Gagal mengamankan direktori signing.' }
$keyPath = Join-Path $SigningDirectory 'borneo-release.jks'
$credentialsPath = Join-Path $SigningDirectory 'signing.properties'
if (!(Test-Path -LiteralPath $keyPath)) {
    if (Test-Path -LiteralPath $credentialsPath) { throw 'Signing key hilang. Pulihkan backup; jangan membuat identitas baru.' }
    $random = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($random)
    $secret = [Convert]::ToHexString($random)
    $env:BORNEO_KEYGEN_SECRET = $secret
    try {
        & keytool -genkeypair -noprompt -keystore $keyPath -storetype PKCS12 -alias borneo-release `
            -keyalg RSA -keysize 3072 -validity 10000 `
            -storepass:env BORNEO_KEYGEN_SECRET -keypass:env BORNEO_KEYGEN_SECRET `
            -dname 'CN=Borneo Marketplace, O=Borneo Marketplace, C=ID'
        if ($LASTEXITCODE -ne 0) { throw 'Pembuatan signing key gagal.' }
        $properties = "storeFile=$($keyPath.Replace('\','/'))`nstorePassword=$secret`nkeyAlias=borneo-release`nkeyPassword=$secret`n"
        [IO.File]::WriteAllText($credentialsPath,$properties,[Text.UTF8Encoding]::new($false))
    } finally { Remove-Item Env:BORNEO_KEYGEN_SECRET -ErrorAction SilentlyContinue; $secret = $null }
}
if (!(Test-Path -LiteralPath $credentialsPath)) { throw 'Signing credentials hilang. Pulihkan backup.' }
$previousSdk = $env:ANDROID_HOME
$previousSigning = $env:BORNEO_ANDROID_SIGNING_PROPERTIES
try {
    $env:ANDROID_HOME = $SdkPath
    $env:BORNEO_ANDROID_SIGNING_PROPERTIES = $credentialsPath
    & node (Join-Path $PSScriptRoot 'android-icons.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Pembuatan ikon gagal.' }
    & $GradlePath -p $androidPath --no-daemon wrapper --gradle-version 9.2.0 --distribution-type bin `
        --gradle-distribution-sha256-sum df67a32e86e3276d011735facb1535f64d0d88df84fa87521e90becc2d735444
    if ($LASTEXITCODE -ne 0) { throw 'Persiapan Gradle gagal.' }
    & (Join-Path $androidPath 'gradlew.bat') -p $androidPath --no-daemon :app:assembleRelease :app:lintRelease
    if ($LASTEXITCODE -ne 0) { throw 'Build/lint Android gagal. APK lama tidak diganti.' }
    $apkPath = Join-Path $androidPath 'app/build/outputs/apk/release/app-release.apk'
    $verifier = Join-Path $SdkPath 'build-tools/36.1.0/apksigner.bat'
    & $verifier verify --verbose $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'Verifikasi signature APK gagal.' }
    $downloadDirectory = Join-Path $repoPath 'apps/web/public/downloads'
    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    $publicApk = Join-Path $downloadDirectory 'borneo-marketplace.apk'
    Copy-Item -LiteralPath $apkPath -Destination $publicApk
    Write-Host "APK release siap: $publicApk"
    Write-Host "Backup direktori signing secara privat: $SigningDirectory"
} finally {
    $env:ANDROID_HOME = $previousSdk
    $env:BORNEO_ANDROID_SIGNING_PROPERTIES = $previousSigning
}
