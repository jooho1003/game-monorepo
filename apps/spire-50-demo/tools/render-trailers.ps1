param(
  [string]$RawDirectory = ".trailer-capture/raw",
  [string]$OutputDirectory = "deliverables/trailers"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$rawRoot = Join-Path $repositoryRoot $RawDirectory
$outputRoot = Join-Path $repositoryRoot $OutputDirectory

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$music = Join-Path $repositoryRoot "apps/spire-50-demo/public/assets/audio/music/tower-labyrinth.ogg"
$sfxRoot = Join-Path $repositoryRoot "apps/spire-50-demo/public/assets/audio/sfx"
$thumbnail = Join-Path $repositoryRoot "apps/spire-50-demo/public/assets/marketing/종말의탑1920x1080-v5.png"

function Invoke-TrailerRender {
  param(
    [Parameter(Mandatory)]
    [string[]]$VideoFiles,
    [Parameter(Mandatory)]
    [string[]]$SoundFiles,
    [Parameter(Mandatory)]
    [string]$FilterScript,
    [Parameter(Mandatory)]
    [string]$OutputFile
  )

  $arguments = @("-y")
  foreach ($videoFile in $VideoFiles) {
    $arguments += @("-i", (Join-Path $rawRoot $videoFile))
  }
  $arguments += @("-i", $music)
  foreach ($soundFile in $SoundFiles) {
    $arguments += @("-i", (Join-Path $sfxRoot $soundFile))
  }
  $filterGraph = Get-Content -Raw (Join-Path $PSScriptRoot $FilterScript)
  $arguments += @(
    "-filter_complex", $filterGraph,
    "-map", "[vout]",
    "-map", "[aout]",
    "-map_metadata", "-1",
    "-map_chapters", "-1",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "16",
    "-profile:v", "high",
    "-level:v", "4.2",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "256k",
    "-ar", "48000",
    "-movflags", "+faststart",
    (Join-Path $outputRoot $OutputFile)
  )

  Push-Location $repositoryRoot
  try {
    & ffmpeg @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "ffmpeg failed while rendering $OutputFile"
    }
  } finally {
    Pop-Location
  }
}

Invoke-TrailerRender `
  -VideoFiles @(
    "01-title.webm",
    "08-boss-strategy.webm",
    "02-loadout.webm",
    "03-dialogue.webm",
    "06-battle-ally.webm",
    "07-battle-enemy-staff.webm",
    "04-shop.webm",
    "05-rest.webm",
    "08-boss-strategy.webm",
    "09-boss-stealth.webm",
    "01-title.webm"
  ) `
  -SoundFiles @(
    "ui-confirm.wav",
    "weapon-swing-1.wav",
    "magic-cast.wav",
    "pickup-coin.wav",
    "giant-alert.wav",
    "giant-attack.wav",
    "stone-door.wav"
  ) `
  -FilterScript "trailer-main.ffscript" `
  -OutputFile "tower-of-the-end-main-trailer-ko.mp4"

Invoke-TrailerRender `
  -VideoFiles @(
    "08-boss-strategy.webm",
    "01-title.webm",
    "02-loadout.webm",
    "06-battle-ally.webm",
    "07-battle-enemy-staff.webm",
    "08-boss-strategy.webm",
    "09-boss-stealth.webm",
    "01-title.webm"
  ) `
  -SoundFiles @(
    "giant-alert.wav",
    "ui-confirm.wav",
    "weapon-swing-2.wav",
    "magic-cast.wav",
    "giant-attack.wav",
    "stone-door.wav"
  ) `
  -FilterScript "trailer-sns.ffscript" `
  -OutputFile "tower-of-the-end-sns-30s-ko.mp4"

# Replace the captured title-screen outro with the approved thumbnail. The SNS
# render is also reframed for a 9:16 feed while keeping the complete 16:9 HUD.
$mainOutput = Join-Path $outputRoot "tower-of-the-end-main-trailer-ko.mp4"
$mainTemp = Join-Path $outputRoot "tower-of-the-end-main-trailer-ko.finalizing.mp4"
$mainFilter = @"
[0:v]trim=start=0:end=50.033,setpts=PTS-STARTPTS,fps=30[v0];
[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setpts=PTS-STARTPTS[v1];
[v0][v1]xfade=transition=fade:duration=0.6:offset=49.433,format=yuv420p[vout]
"@

$snsOutput = Join-Path $outputRoot "tower-of-the-end-sns-30s-ko.mp4"
$snsTemp = Join-Path $outputRoot "tower-of-the-end-sns-30s-ko.finalizing.mp4"
$snsFilter = @"
[0:v]trim=start=0:end=25.6,setpts=PTS-STARTPTS,fps=30[v0];
[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setpts=PTS-STARTPTS[v1];
[v0][v1]xfade=transition=fade:duration=0.6:offset=25.0,format=yuv420p[wide];
[wide]split=2[bgsrc][fgsrc];
[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.22:saturation=0.75[bg];
[fgsrc]scale=1080:608:force_original_aspect_ratio=decrease,pad=1080:620:0:6:color=0x080b0d[fg];
[bg][fg]overlay=0:(H-h)/2,
drawbox=x=90:y=230:w=900:h=205:color=black@0.38:t=fill:enable='lt(t,25)',
drawtext=fontfile=apps/spire-50-demo/public/assets/fonts/song-myung/SongMyung-Regular.ttf:text='종말의 탑':fontcolor=0xEACB8A:fontsize=74:x=(w-text_w)/2:y=265:enable='lt(t,25)',
drawtext=fontfile=apps/spire-50-demo/public/assets/fonts/song-myung/SongMyung-Regular.ttf:text='50층을 향한 마지막 등반':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=365:enable='lt(t,25)',
drawbox=x=100:y=1475:w=880:h=95:color=black@0.42:t=fill:enable='lt(t,25)',
drawtext=fontfile=apps/spire-50-demo/public/assets/fonts/song-myung/SongMyung-Regular.ttf:text='전략을 선택하고, 살아남아라':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=1500:enable='lt(t,25)',
format=yuv420p[vout]
"@

Push-Location $repositoryRoot
try {
  & ffmpeg -y -i $mainOutput -loop 1 -framerate 30 -t 6.567 -i $thumbnail `
    -filter_complex $mainFilter -map "[vout]" -map "0:a:0" -t 56 `
    -c:v libx264 -preset slow -crf 16 -profile:v high -level:v 4.2 -pix_fmt yuv420p `
    -c:a copy -movflags +faststart $mainTemp
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while finalizing the main trailer"
  }
  Move-Item -LiteralPath $mainTemp -Destination $mainOutput -Force

  & ffmpeg -y -i $snsOutput -loop 1 -framerate 30 -t 4.3 -i $thumbnail `
    -filter_complex $snsFilter -map "[vout]" -map "0:a:0" -t 29.3 `
    -c:v libx264 -preset slow -crf 16 -profile:v high -level:v 4.2 -pix_fmt yuv420p `
    -c:a copy -movflags +faststart $snsTemp
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while finalizing the SNS trailer"
  }
  Move-Item -LiteralPath $snsTemp -Destination $snsOutput -Force
} finally {
  Pop-Location
}

Get-ChildItem $outputRoot -Filter "*.mp4" |
  Select-Object FullName, Length, LastWriteTime
