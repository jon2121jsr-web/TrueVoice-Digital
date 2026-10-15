# Web assets only. Reuse the approved header vector; never read Hero artwork or
# write assets/icon.png, ios/, or android/. Run from the repository root.
Add-Type -AssemblyName System.Drawing
$repoRoot = (Get-Location).Path
$appSource = [IO.File]::ReadAllText((Join-Path $repoRoot 'src/App.jsx'))
$match = [regex]::Match($appSource, '<svg className="tv-brand-wave"[\s\S]*?</svg>')
if (!$match.Success) { throw 'Approved header waveform not found' }
$svg = $match.Value.Replace('className="tv-brand-wave"', 'xmlns="http://www.w3.org/2000/svg"').Replace('viewBox="0 0 56 56"', 'viewBox="-7 -7 70 70"').Replace('stopColor=', 'stop-color=')
[IO.File]::WriteAllText((Join-Path $repoRoot 'public/truevoice-waveform-v1.svg'), $svg + "`n")
$rects = [regex]::Matches($svg, '<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="([\d.]+)"')
if ($rects.Count -ne 5) { throw 'Unexpected waveform geometry' }
$outputs = @{
    'truevoice-favicon.png' = 512
    'icon-192.png' = 192
    'icon-512.png' = 512
    'icon-1024.png' = 1024
    'apple-touch-icon.png' = 180
    'apple-touch-icon-167.png' = 167
    'apple-touch-icon-152.png' = 152
}
foreach ($entry in $outputs.GetEnumerator()) {
    $size = $entry.Value
    $bitmap = New-Object Drawing.Bitmap ($size * 4), ($size * 4)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#050816'))
    # All mark pixels fit inside the central maskable safe circle.
    $scale = ($size * 4 * 0.60) / 56
    $inset = $size * 4 * 0.20
    $graphics.TranslateTransform($inset, $inset)
    $graphics.ScaleTransform($scale, $scale)
    $brush = New-Object Drawing.Drawing2D.LinearGradientBrush ([Drawing.PointF]::new(0, 0)), ([Drawing.PointF]::new(0, 56)), ([Drawing.ColorTranslator]::FromHtml('#00d9eb')), ([Drawing.ColorTranslator]::FromHtml('#0086ff'))
    foreach ($rect in $rects) {
        $x = [float]$rect.Groups[1].Value; $y = [float]$rect.Groups[2].Value
        $w = [float]$rect.Groups[3].Value; $h = [float]$rect.Groups[4].Value
        $d = [float]$rect.Groups[5].Value * 2
        $shape = New-Object Drawing.Drawing2D.GraphicsPath
        $shape.AddArc($x, $y, $d, $d, 180, 90)
        $shape.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
        $shape.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
        $shape.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
        $shape.CloseFigure()
        $graphics.FillPath($brush, $shape)
        $shape.Dispose()
    }
    $small = New-Object Drawing.Bitmap $size, $size
    $downsample = [Drawing.Graphics]::FromImage($small)
    $downsample.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $downsample.DrawImage($bitmap, 0, 0, $size, $size)
    $path = Join-Path $repoRoot ('public/' + $entry.Key)
    $small.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    # New URLs invalidate browser/installed-app icon caches. Old URLs are kept
    # with identical new artwork for existing fallback and cached clients.
    if ($entry.Key -match '^(icon-(192|512)|apple-touch-icon(-167|-152)?)\.png$') {
        $versioned = $path.Replace('.png', '-waveform-v1.png')
        $small.Save($versioned, [Drawing.Imaging.ImageFormat]::Png)
    }
    $downsample.Dispose(); $small.Dispose(); $brush.Dispose()
    $graphics.Dispose(); $bitmap.Dispose()
}
