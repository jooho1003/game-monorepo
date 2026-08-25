param(
  [string]$SourceDirectory = "C:\Users\이주호\Videos\NVIDIA\Desktop\플레이 영상",
  [string]$OutputDirectory = "deliverables/trailers"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$outputRoot = Join-Path $repositoryRoot $OutputDirectory
$sourceOne = Join-Path $SourceDirectory "Desktop 2026.08.26 - 02.31.26.01.mp4"
$sourceTwo = Join-Path $SourceDirectory "Desktop 2026.08.26 - 02.41.46.02.mp4"
$thumbnail = Join-Path $repositoryRoot "apps/spire-50-demo/public/assets/marketing/종말의탑1920x1080-v5.png"
$music = Join-Path $repositoryRoot "apps/spire-50-demo/public/assets/audio/music/tower-labyrinth.ogg"

foreach ($requiredFile in @($sourceOne, $sourceTwo, $thumbnail, $music)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required media file not found: $requiredFile"
  }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

function Invoke-ProvidedTrailerRender {
  param(
    [Parameter(Mandatory)]
    [string]$FilterScript,
    [Parameter(Mandatory)]
    [string]$OutputFile,
    [Parameter(Mandatory)]
    [double]$Duration
  )

  $filterGraph = Get-Content -Raw (Join-Path $PSScriptRoot $FilterScript)
  $outputPath = Join-Path $outputRoot $OutputFile

  & ffmpeg -y `
    -i $sourceOne `
    -i $sourceTwo `
    -loop 1 -framerate 60 -i $thumbnail `
    -stream_loop -1 -i $music `
    -filter_complex $filterGraph `
    -map "[vout]" -map "[aout]" -t $Duration `
    -map_metadata -1 -map_chapters -1 `
    -c:v libx264 -preset slow -crf 17 -profile:v high -level:v 4.2 -pix_fmt yuv420p `
    -c:a aac -b:a 256k -ar 48000 `
    -movflags +faststart $outputPath

  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while rendering $OutputFile"
  }
}

Push-Location $repositoryRoot
try {
  Invoke-ProvidedTrailerRender `
    -FilterScript "trailer-provided-main.ffscript" `
    -OutputFile "tower-of-the-end-main-trailer-ko.mp4" `
    -Duration 55.7

  Invoke-ProvidedTrailerRender `
    -FilterScript "trailer-provided-sns.ffscript" `
    -OutputFile "tower-of-the-end-sns-30s-ko.mp4" `
    -Duration 30.05
} finally {
  Pop-Location
}

Get-ChildItem $outputRoot -Filter "tower-of-the-end-*-ko.mp4" |
  Select-Object FullName, Length, LastWriteTime
