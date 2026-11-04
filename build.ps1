# Builds the single-file app: inlines css/ and js/ into index.html so it works when opened from anywhere.
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText((Join-Path $root 'src\index.template.html'), $utf8)

$html = [regex]::Replace($html, '<link rel="stylesheet" href="([^"]+)">', {
  param($m)
  $css = [IO.File]::ReadAllText((Join-Path $root $m.Groups[1].Value), $utf8)
  "<style>`n$css`n</style>"
})
$html = [regex]::Replace($html, '<script src="([^"]+)"></script>', {
  param($m)
  $js = [IO.File]::ReadAllText((Join-Path $root $m.Groups[1].Value), $utf8)
  "<script>`n$js`n</script>"
})

[IO.File]::WriteAllText((Join-Path $root 'index.html'), $html, $utf8)
Write-Host ("Built index.html ({0:N0} KB)" -f ((Get-Item (Join-Path $root 'index.html')).Length / 1KB))
