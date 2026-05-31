$audioDir = Join-Path $PSScriptRoot "audio"
if (-not (Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir -Force
}

for ($i = 1; $i -le 37; $i++) {
    $url = "https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/html_ch/audio/F$i.WAV"
    $outputPath = Join-Path $audioDir "F$i.WAV"
    Write-Host "Downloading $url to $outputPath ..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath -TimeoutSec 15
    } catch {
        Write-Error "Failed to download F$i.WAV: $_"
    }
}
Write-Host "Audio files download complete!"
