# =============================================================================
#  generateAppIcons.ps1 — builds launcher icons from assets/icon.png
# ----------------------------------------------------------------------------
#  Source : assets/icon.png  (single source of truth — sirf isi asset se banta hai)
#  Output : android/app/src/main/res/mipmap-*/ic_launcher*.png
#           ios/slovecare/Images.xcassets/AppIcon.appiconset/*.png
#
#  Usage  : powershell -ExecutionPolicy Bypass -File scripts\generateAppIcons.ps1
# =============================================================================

param(
  [string]$SourcePath = (Join-Path $PSScriptRoot '..\assets\icon.png'),
  [string]$AndroidRes = (Join-Path $PSScriptRoot '..\android\app\src\main\res'),
  [string]$IosIconSet = (Join-Path $PSScriptRoot '..\ios\slovecare\Images.xcassets\AppIcon.appiconset'),
  # Square canvas ke andar logo kitna occupy kare (percent)
  [int]$PaddingPercent = 86
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = (Resolve-Path $SourcePath).Path
$baseSize = 1024

<# -------------------------------------------------------------------------- #
   1. Source ko square 1024x1024 canvas par fit karo
   --------------------------------------------------------------------------- #>

$srcImg = [System.Drawing.Image]::FromFile($source)
try {
  $probe = [System.Drawing.Bitmap]::new($srcImg)
  $bg = $probe.GetPixel(0, 0)          # logo ka background colour (white)
  $probe.Dispose()

  $base = [System.Drawing.Bitmap]::new($baseSize, $baseSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($base)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $fit = $baseSize * ($PaddingPercent / 100.0)
  $scale = [Math]::Min($fit / $srcImg.Width, $fit / $srcImg.Height)
  $nw = [int][Math]::Round($srcImg.Width * $scale)
  $nh = [int][Math]::Round($srcImg.Height * $scale)
  $nx = [int](($baseSize - $nw) / 2)
  $ny = [int](($baseSize - $nh) / 2)
  $g.DrawImage($srcImg, $nx, $ny, $nw, $nh)
  $g.Dispose()
}
finally {
  $srcImg.Dispose()
}

Write-Host "Source : $source  ->  square canvas ${baseSize}x${baseSize} (bg $($bg.R),$($bg.G),$($bg.B))"

<# -------------------------------------------------------------------------- #
   2. Export helper
   --------------------------------------------------------------------------- #>

function Export-Icon {
  param(
    [int]$Size,
    [string]$Path,
    # iOS App Store icons me alpha channel nahi hona chahiye
    [switch]$NoAlpha
  )

  $pf = if ($NoAlpha) { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb }
        else { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb }

  $bmp = [System.Drawing.Bitmap]::new($Size, $Size, $pf)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($script:bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($script:base, 0, 0, $Size, $Size)
  $g.Dispose()

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  wrote $(Split-Path $Path -Leaf)  (${Size}x${Size})"
}

<# -------------------------------------------------------------------------- #
   3. ANDROID — mipmap densities (Manifest: @mipmap/ic_launcher)
   --------------------------------------------------------------------------- #>

$android = @(
  @{ dpi = 'mdpi'; size = 48 },
  @{ dpi = 'hdpi'; size = 72 },
  @{ dpi = 'xhdpi'; size = 96 },
  @{ dpi = 'xxhdpi'; size = 144 },
  @{ dpi = 'xxxhdpi'; size = 192 }
)

Write-Host "`nANDROID icons:"
foreach ($entry in $android) {
  $dir = Join-Path $AndroidRes ("mipmap-" + $entry.dpi)
  if (-not (Test-Path $dir)) { throw "Missing res folder: $dir" }
  Export-Icon -Size $entry.size -Path (Join-Path $dir 'ic_launcher.png')
  Export-Icon -Size $entry.size -Path (Join-Path $dir 'ic_launcher_round.png')
}

<# -------------------------------------------------------------------------- #
   4. iOS — AppIcon.appiconset (Contents.json ke sabhi slots)
   --------------------------------------------------------------------------- #>

$ios = @(
  @{ name = 'Icon-App-20x20@2x.png'; size = 40 },
  @{ name = 'Icon-App-20x20@3x.png'; size = 60 },
  @{ name = 'Icon-App-29x29@2x.png'; size = 58 },
  @{ name = 'Icon-App-29x29@3x.png'; size = 87 },
  @{ name = 'Icon-App-40x40@2x.png'; size = 80 },
  @{ name = 'Icon-App-40x40@3x.png'; size = 120 },
  @{ name = 'Icon-App-60x60@2x.png'; size = 120 },
  @{ name = 'Icon-App-60x60@3x.png'; size = 180 },
  @{ name = 'Icon-App-1024x1024.png'; size = 1024 }
)

Write-Host "`nIOS icons:"
if (-not (Test-Path $IosIconSet)) { throw "Missing iOS icon set: $IosIconSet" }
foreach ($entry in $ios) {
  Export-Icon -Size $entry.size -Path (Join-Path $IosIconSet $entry.name) -NoAlpha
}

$base.Dispose()
Write-Host "`nDone."
