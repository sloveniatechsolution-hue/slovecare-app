# =============================================================================
#  start-emulator.ps1 — SloveCare ke Android emulator ko SAHI DNS ke saath
#                       chalata hai (app ke backend se connect ho sake).
# ----------------------------------------------------------------------------
#  PROBLEM
#  -------
#  Is machine ke Ethernet adapter (metric 25) ke DNS servers —
#  172.20.1.15 / 172.20.1.5 — DEAD hain (unreachable, har query par 11s
#  timeout). Wi-Fi adapter (metric 50) ka DNS 10.21.37.29 theek chalta hai.
#
#  Android emulator ka apna DNS proxy (10.0.2.3 / 10.0.2.4) host ki ye dead
#  DNS list use karta hai → guest me koi bhi hostname resolve hi nahi hota.
#  Result: app ka har API call 20s tak latka rehta hai aur user ko
#  "Request timed out. Please check your connection." dikhta hai
#  (server toh bilkul healthy tha).
#
#  FIX
#  ---
#  Emulator ko `-dns-server` ke saath chala rahe hain (8.8.8.8 / 1.1.1.1) →
#  proxy seedhe working resolvers par forward karta hai. Isse koi admin
#  privilege ki zaroorat nahi aur host ki settings bhi nahi badalti.
#
#  PERMANENT FIX (optional, admin chahiye)
#  --------------------------------------
#  Host par dead DNS hata do — emulator phir default flag se bhi chalega:
#
#      # PowerShell (ADMIN)
#      Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses
#      Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 10.21.37.29
#
#  Usage  : powershell -ExecutionPolicy Bypass -File scripts\start-emulator.ps1
# =============================================================================

param(
  # AVD ka naam (Android Studio → Device Manager se dekhein)
  [string]$Avd = 'Medium_Phone_API_37.0',

  # Emulator ko in DNS servers par point karenge
  [string]$DnsServers = '8.8.8.8,1.1.1.1'
)

$ErrorActionPreference = 'Stop'

$emulator = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'

if (-not (Test-Path $emulator)) {
  # SDK yahan nahi hai — ANDROID_HOME / ANDROID_SDK_ROOT se dhoondo
  foreach ($root in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)) {
    if ($root -and (Test-Path (Join-Path $root 'emulator\emulator.exe'))) {
      $emulator = Join-Path $root 'emulator\emulator.exe'
      break
    }
  }
}

if (-not (Test-Path $emulator)) {
  throw "emulator.exe nahi mila — Android SDK path check karo (expected: $emulator)"
}

Write-Host "Emulator start ho raha hai..." -ForegroundColor Cyan
Write-Host "  AVD         : $Avd"
Write-Host "  DNS servers : $DnsServers"
Write-Host ""

$process = Start-Process -FilePath $emulator -ArgumentList @(
  '-avd', $Avd,
  '-dns-server', $DnsServers,
  '-no-boot-anim'
) -PassThru

Write-Host "PID: $($process.Id)  — boot hone me 1-2 minute lagenge." -ForegroundColor Yellow
Write-Host "Boot complete hone ke baad:" -ForegroundColor Yellow
Write-Host "  npx react-native run-android"
