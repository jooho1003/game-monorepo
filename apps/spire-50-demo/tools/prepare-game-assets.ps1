$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$sourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\references images")
$assetRoot = Join-Path $PSScriptRoot "..\public\assets\game"

New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "dialogue") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "world\player") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "world\npc") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "world\maps") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "world\weapons") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot "hud") | Out-Null

$helperSource = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class GameAssetPrep
{
    private static Bitmap RemoveFlatBackground(Bitmap source, Rectangle crop, int tolerance)
    {
        var output = new Bitmap(crop.Width, crop.Height, PixelFormat.Format32bppArgb);
        var background = source.GetPixel(crop.X + 2, crop.Y + 2);
        var toleranceSquared = tolerance * tolerance;

        for (var y = 0; y < crop.Height; y++)
        {
            for (var x = 0; x < crop.Width; x++)
            {
                var color = source.GetPixel(crop.X + x, crop.Y + y);
                var dr = color.R - background.R;
                var dg = color.G - background.G;
                var db = color.B - background.B;
                var distance = dr * dr + dg * dg + db * db;
                var alpha = distance <= toleranceSquared ? 0 : color.A;
                output.SetPixel(x, y, Color.FromArgb(alpha, color.R, color.G, color.B));
            }
        }

        return output;
    }

    private static Bitmap RemoveConnectedNeutralBackground(Bitmap source, Rectangle crop)
    {
        var output = new Bitmap(crop.Width, crop.Height, PixelFormat.Format32bppArgb);
        using (var graphics = Graphics.FromImage(output))
        {
            graphics.DrawImage(
                source,
                new Rectangle(0, 0, crop.Width, crop.Height),
                crop,
                GraphicsUnit.Pixel
            );
        }

        var queued = new bool[crop.Width * crop.Height];
        var queue = new int[crop.Width * crop.Height];
        var head = 0;
        var tail = 0;
        for (var x = 0; x < crop.Width; x++)
        {
            var topIndex = x;
            var bottomIndex = (crop.Height - 1) * crop.Width + x;
            if (!queued[topIndex]) { queued[topIndex] = true; queue[tail++] = topIndex; }
            if (!queued[bottomIndex]) { queued[bottomIndex] = true; queue[tail++] = bottomIndex; }
        }
        for (var y = 0; y < crop.Height; y++)
        {
            var leftIndex = y * crop.Width;
            var rightIndex = y * crop.Width + crop.Width - 1;
            if (!queued[leftIndex]) { queued[leftIndex] = true; queue[tail++] = leftIndex; }
            if (!queued[rightIndex]) { queued[rightIndex] = true; queue[tail++] = rightIndex; }
        }

        var directions = new[]
        {
            new Point(1, 0),
            new Point(-1, 0),
            new Point(0, 1),
            new Point(0, -1),
        };

        while (head < tail)
        {
            var index = queue[head++];
            var point = new Point(index % crop.Width, index / crop.Width);

            var color = output.GetPixel(point.X, point.Y);
            var max = Math.Max(color.R, Math.Max(color.G, color.B));
            var min = Math.Min(color.R, Math.Min(color.G, color.B));
            if (max - min > 28) continue;

            output.SetPixel(point.X, point.Y, Color.Transparent);
            foreach (var direction in directions)
            {
                var nextX = point.X + direction.X;
                var nextY = point.Y + direction.Y;
                if (nextX < 0 || nextX >= crop.Width || nextY < 0 || nextY >= crop.Height)
                    continue;
                var nextIndex = nextY * crop.Width + nextX;
                if (queued[nextIndex]) continue;
                var next = output.GetPixel(nextX, nextY);
                var dr = color.R - next.R;
                var dg = color.G - next.G;
                var db = color.B - next.B;
                if (dr * dr + dg * dg + db * db <= 100)
                {
                    queued[nextIndex] = true;
                    queue[tail++] = nextIndex;
                }
            }
        }

        return output;
    }

    private static Bitmap RemoveEdgeMatchedBackground(Bitmap source, Rectangle crop, int tolerance)
    {
        var output = new Bitmap(crop.Width, crop.Height, PixelFormat.Format32bppArgb);
        var toleranceSquared = tolerance * tolerance;

        for (var y = 0; y < crop.Height; y++)
        {
            var left = source.GetPixel(crop.X + 2, crop.Y + y);
            var right = source.GetPixel(crop.Right - 3, crop.Y + y);
            var backgroundR = (left.R + right.R) / 2;
            var backgroundG = (left.G + right.G) / 2;
            var backgroundB = (left.B + right.B) / 2;

            for (var x = 0; x < crop.Width; x++)
            {
                var color = source.GetPixel(crop.X + x, crop.Y + y);
                var dr = color.R - backgroundR;
                var dg = color.G - backgroundG;
                var db = color.B - backgroundB;
                var distance = dr * dr + dg * dg + db * db;
                var alpha = distance <= toleranceSquared ? 0 : color.A;
                output.SetPixel(x, y, Color.FromArgb(alpha, color.R, color.G, color.B));
            }
        }

        return output;
    }

    private static Rectangle AlphaBounds(Bitmap bitmap)
    {
        var left = bitmap.Width;
        var top = bitmap.Height;
        var right = -1;
        var bottom = -1;

        for (var y = 0; y < bitmap.Height; y++)
        {
            for (var x = 0; x < bitmap.Width; x++)
            {
                if (bitmap.GetPixel(x, y).A == 0) continue;
                left = Math.Min(left, x);
                top = Math.Min(top, y);
                right = Math.Max(right, x);
                bottom = Math.Max(bottom, y);
            }
        }

        return right < left
            ? new Rectangle(0, 0, bitmap.Width, bitmap.Height)
            : Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
    }

    public static void Cutout(string input, string output, int tolerance)
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveFlatBackground(
            source,
            new Rectangle(0, 0, source.Width, source.Height),
            tolerance
        );
        cutout.Save(output, ImageFormat.Png);
    }

    public static void FloodCutout(string input, string output)
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveConnectedNeutralBackground(
            source,
            new Rectangle(0, 0, source.Width, source.Height)
        );
        cutout.Save(output, ImageFormat.Png);
    }

    public static void EdgeCutout(string input, string output, int tolerance)
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveEdgeMatchedBackground(
            source,
            new Rectangle(0, 0, source.Width, source.Height),
            tolerance
        );
        cutout.Save(output, ImageFormat.Png);
    }

    public static void CutoutFit(
        string input,
        string output,
        int cropX,
        int cropY,
        int cropWidth,
        int cropHeight,
        int canvasWidth,
        int canvasHeight,
        int tolerance,
        bool pixelated
    )
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveFlatBackground(
            source,
            new Rectangle(cropX, cropY, cropWidth, cropHeight),
            tolerance
        );
        var bounds = AlphaBounds(cutout);
        using var outputBitmap = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb);
        using var graphics = Graphics.FromImage(outputBitmap);
        graphics.Clear(Color.Transparent);
        graphics.InterpolationMode = pixelated
            ? InterpolationMode.NearestNeighbor
            : InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = pixelated
            ? PixelOffsetMode.Half
            : PixelOffsetMode.HighQuality;

        var scale = Math.Min(
            (canvasWidth - 4f) / bounds.Width,
            (canvasHeight - 4f) / bounds.Height
        );
        var drawWidth = Math.Max(1, (int)Math.Round(bounds.Width * scale));
        var drawHeight = Math.Max(1, (int)Math.Round(bounds.Height * scale));
        var drawX = (canvasWidth - drawWidth) / 2;
        var drawY = canvasHeight - drawHeight - 2;

        graphics.DrawImage(
            cutout,
            new Rectangle(drawX, drawY, drawWidth, drawHeight),
            bounds,
            GraphicsUnit.Pixel
        );
        outputBitmap.Save(output, ImageFormat.Png);
    }

    public static void FloodCutoutFit(
        string input,
        string output,
        int canvasWidth,
        int canvasHeight
    )
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveConnectedNeutralBackground(
            source,
            new Rectangle(0, 0, source.Width, source.Height)
        );
        var bounds = AlphaBounds(cutout);
        using var outputBitmap = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb);
        using var graphics = Graphics.FromImage(outputBitmap);
        graphics.Clear(Color.Transparent);
        graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
        graphics.PixelOffsetMode = PixelOffsetMode.Half;
        var scale = Math.Min(
            (canvasWidth - 4f) / bounds.Width,
            (canvasHeight - 4f) / bounds.Height
        );
        var drawWidth = Math.Max(1, (int)Math.Round(bounds.Width * scale));
        var drawHeight = Math.Max(1, (int)Math.Round(bounds.Height * scale));
        var drawX = (canvasWidth - drawWidth) / 2;
        var drawY = canvasHeight - drawHeight - 2;
        graphics.DrawImage(
            cutout,
            new Rectangle(drawX, drawY, drawWidth, drawHeight),
            bounds,
            GraphicsUnit.Pixel
        );
        outputBitmap.Save(output, ImageFormat.Png);
    }

    public static void EdgeCutoutFit(
        string input,
        string output,
        int canvasWidth,
        int canvasHeight,
        int tolerance
    )
    {
        using var source = new Bitmap(input);
        using var cutout = RemoveEdgeMatchedBackground(
            source,
            new Rectangle(0, 0, source.Width, source.Height),
            tolerance
        );
        var bounds = AlphaBounds(cutout);
        using var outputBitmap = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb);
        using var graphics = Graphics.FromImage(outputBitmap);
        graphics.Clear(Color.Transparent);
        graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
        graphics.PixelOffsetMode = PixelOffsetMode.Half;
        var scale = Math.Min(
            (canvasWidth - 4f) / bounds.Width,
            (canvasHeight - 4f) / bounds.Height
        );
        var drawWidth = Math.Max(1, (int)Math.Round(bounds.Width * scale));
        var drawHeight = Math.Max(1, (int)Math.Round(bounds.Height * scale));
        var drawX = (canvasWidth - drawWidth) / 2;
        var drawY = canvasHeight - drawHeight - 2;
        graphics.DrawImage(
            cutout,
            new Rectangle(drawX, drawY, drawWidth, drawHeight),
            bounds,
            GraphicsUnit.Pixel
        );
        outputBitmap.Save(output, ImageFormat.Png);
    }

    public static void FitTransparent(
        string input,
        string output,
        int canvasWidth,
        int canvasHeight
    )
    {
        using var source = new Bitmap(input);
        var bounds = AlphaBounds(source);
        using var outputBitmap = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb);
        using var graphics = Graphics.FromImage(outputBitmap);
        graphics.Clear(Color.Transparent);
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        var scale = Math.Min(
            (canvasWidth - 4f) / bounds.Width,
            (canvasHeight - 4f) / bounds.Height
        );
        var drawWidth = Math.Max(1, (int)Math.Round(bounds.Width * scale));
        var drawHeight = Math.Max(1, (int)Math.Round(bounds.Height * scale));
        var drawX = (canvasWidth - drawWidth) / 2;
        var drawY = (canvasHeight - drawHeight) / 2;
        graphics.DrawImage(
            source,
            new Rectangle(drawX, drawY, drawWidth, drawHeight),
            bounds,
            GraphicsUnit.Pixel
        );
        outputBitmap.Save(output, ImageFormat.Png);
    }

    public static void Crop(string input, string output, int x, int y, int width, int height)
    {
        using var source = new Bitmap(input);
        using var outputBitmap = new Bitmap(width, height, PixelFormat.Format24bppRgb);
        using var graphics = Graphics.FromImage(outputBitmap);
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.DrawImage(
            source,
            new Rectangle(0, 0, width, height),
            new Rectangle(x, y, width, height),
            GraphicsUnit.Pixel
        );
        outputBitmap.Save(output, ImageFormat.Png);
    }
}
"@

$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
$drawingPrimitivesAssembly = [System.Drawing.Rectangle].Assembly.Location
$gdiPlusAssembly = [AppDomain]::CurrentDomain.GetAssemblies() |
    Where-Object { $_.GetName().Name -eq "System.Private.Windows.GdiPlus" } |
    Select-Object -ExpandProperty Location
$drawingFacadeAssembly = [AppDomain]::CurrentDomain.GetAssemblies() |
    Where-Object { $_.GetName().Name -eq "System.Drawing" } |
    Select-Object -ExpandProperty Location
$windowsCoreAssembly = [AppDomain]::CurrentDomain.GetAssemblies() |
    Where-Object { $_.GetName().Name -eq "System.Private.Windows.Core" } |
    Select-Object -ExpandProperty Location
Add-Type -TypeDefinition $helperSource -ReferencedAssemblies @(
    $drawingAssembly,
    $drawingPrimitivesAssembly,
    $gdiPlusAssembly,
    $drawingFacadeAssembly,
    $windowsCoreAssembly
)

Copy-Item -LiteralPath (Join-Path $sourceRoot "아이콘.png") -Destination (Join-Path $assetRoot "hud\ern-icon.png") -Force

[GameAssetPrep]::EdgeCutout(
    (Join-Path $sourceRoot "2026-08-21 01 58 22.png"),
    (Join-Path $assetRoot "dialogue\ern.png"),
    22
)
[GameAssetPrep]::EdgeCutout(
    (Join-Path $sourceRoot "npc.png"),
    (Join-Path $assetRoot "dialogue\orban.png"),
    22
)
[GameAssetPrep]::Crop(
    (Join-Path $sourceRoot "맵1.png"),
    (Join-Path $assetRoot "world\maps\first-floor-center.png"),
    320,
    250,
    808,
    455
)
# `world\npc\orban.png` is an OpenAI-generated project asset. It is kept
# outside this user-reference preparation pass so rerunning the script does
# not replace the approved readable sprite with the former 32x32 conversion.

$sheet = Join-Path $sourceRoot "2026-08-21 01 16 22.png"
$frames = @(
    @{ Name = "north-west"; X = 10; Y = 10; Width = 208; Height = 200 },
    @{ Name = "north"; X = 238; Y = 10; Width = 207; Height = 200 },
    @{ Name = "north-east"; X = 464; Y = 10; Width = 208; Height = 200 },
    @{ Name = "west"; X = 10; Y = 238; Width = 208; Height = 200 },
    @{ Name = "east"; X = 464; Y = 238; Width = 208; Height = 200 },
    @{ Name = "south-west"; X = 10; Y = 465; Width = 208; Height = 200 },
    @{ Name = "south"; X = 238; Y = 465; Width = 207; Height = 200 },
    @{ Name = "south-east"; X = 464; Y = 465; Width = 208; Height = 200 }
)

foreach ($frame in $frames) {
    [GameAssetPrep]::CutoutFit(
        $sheet,
        (Join-Path $assetRoot "world\player\$($frame.Name).png"),
        $frame.X,
        $frame.Y,
        $frame.Width,
        $frame.Height,
        96,
        96,
        20,
        $true
    )
}

$weapons = @(
    @{ Name = "longsword"; Source = "장검누끼.png" },
    @{ Name = "dagger"; Source = "단검 누끼.png" },
    @{ Name = "shield"; Source = "방패누끼.png" },
    @{ Name = "bow"; Source = "활누끼.png" },
    @{ Name = "staff"; Source = "지팡이 누끼.png" }
)

foreach ($weapon in $weapons) {
    [GameAssetPrep]::FitTransparent(
        (Join-Path $sourceRoot $weapon.Source),
        (Join-Path $assetRoot "world\weapons\$($weapon.Name).png"),
        64,
        64
    )
}

Write-Output "Prepared game assets in $assetRoot"
