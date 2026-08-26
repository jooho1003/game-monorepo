"""Generate skill-2 HUD icons.

Reuses the ornate border frame of the matching skill-1 icon so the HUD stays
visually consistent, replaces the interior with a fresh emblem for each
weapon's second skill, and finishes with a pixelation pass to match the
pixel-art style. A small "II" tier badge marks these as second skills.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path("/home/user/game-monorepo/apps/spire-50-demo/public/assets")
SKILLS = ASSETS / "game/hud/skills"

ACCENTS = {
    "longsword": (140, 230, 208),
    "dagger": (223, 157, 243),
    "shield": (240, 201, 123),
    "bow": (169, 219, 126),
    "staff": (135, 185, 255),
}

BIG = 512  # supersampled draw size
PIX = 128  # pixelation grid
OUT = 512  # final output size


def lighten(c, f):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c)


def darken(c, f):
    return tuple(int(v * (1 - f)) for v in c)


def interior_base(accent):
    im = Image.new("RGB", (BIG, BIG), (10, 14, 20))
    draw = ImageDraw.Draw(im)
    cx = cy = BIG / 2
    for r in range(int(BIG * 0.72), 0, -4):
        t = r / (BIG * 0.72)
        col = tuple(
            int(a * (1 - t) * 0.20 + b * t)
            for a, b in zip(accent, (12, 16, 24))
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    return im


def emblem_longsword(draw, accent):
    """회전 폭풍: a spinning storm of blades — swirl arcs + orbiting slashes."""
    cx = cy = BIG / 2
    for i, (r, w) in enumerate([(170, 26), (128, 18), (86, 12)]):
        start = i * 100
        draw.arc(
            [cx - r, cy - r, cx + r, cy + r],
            start=start,
            end=start + 250,
            fill=lighten(accent, 0.15 * i),
            width=w,
        )
    for k in range(3):
        ang = math.radians(k * 120 - 20)
        x = cx + math.cos(ang) * 150
        y = cy + math.sin(ang) * 150
        blade = [
            (x + math.cos(ang + 1.9) * 58, y + math.sin(ang + 1.9) * 58),
            (x + math.cos(ang - 1.2) * 26, y + math.sin(ang - 1.2) * 26),
            (x + math.cos(ang + 0.35) * 66, y + math.sin(ang + 0.35) * 66),
        ]
        draw.polygon(blade, fill=lighten(accent, 0.55))
    draw.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=lighten(accent, 0.75))


def emblem_dagger(draw, accent):
    """환영 표창: a fan of phantom blades thrown forward."""
    ox, oy = BIG * 0.30, BIG * 0.74
    for i, off in enumerate([-0.42, -0.21, 0.0, 0.21, 0.42]):
        ang = -math.pi / 4 + off
        length = 300 - abs(i - 2) * 40
        tipx = ox + math.cos(ang) * length
        tipy = oy + math.sin(ang) * length
        perp = ang + math.pi / 2
        wdt = 26 - abs(i - 2) * 5
        pts = [
            (tipx, tipy),
            (ox + math.cos(perp) * wdt, oy + math.sin(perp) * wdt),
            (ox - math.cos(perp) * wdt, oy - math.sin(perp) * wdt),
        ]
        f = 0.62 - abs(i - 2) * 0.16
        draw.polygon(pts, fill=lighten(accent, max(0.0, f)))
        draw.line([(ox, oy), (tipx, tipy)], fill=lighten(accent, 0.8), width=6)
    draw.ellipse([ox - 22, oy - 22, ox + 22, oy + 22], fill=lighten(accent, 0.85))


def emblem_shield(draw, accent):
    """대지 격동: a slamming shield with shockwave rings and ground cracks."""
    cx, cy = BIG / 2, BIG * 0.42
    for r, w in [(215, 20), (168, 14)]:
        draw.arc(
            [cx - r, cy - r + 60, cx + r, cy + r * 0.7 + 130],
            start=200,
            end=340,
            fill=lighten(accent, 0.25),
            width=w,
        )
    pts = [
        (cx, cy - 120),
        (cx + 95, cy - 88),
        (cx + 95, cy + 30),
        (cx, cy + 110),
        (cx - 95, cy + 30),
        (cx - 95, cy - 88),
    ]
    draw.polygon(pts, fill=lighten(accent, 0.45), outline=lighten(accent, 0.85))
    draw.polygon(
        [(p[0] * 0.68 + cx * 0.32, p[1] * 0.68 + cy * 0.32) for p in pts],
        fill=darken(accent, 0.25),
    )
    gy = BIG * 0.80
    for dx1, dx2 in [(-190, -80), (-60, 40), (90, 200)]:
        draw.line(
            [(cx + dx1, gy + 40), (cx + (dx1 + dx2) / 2, gy - 5), (cx + dx2, gy + 46)],
            fill=lighten(accent, 0.7),
            width=10,
            joint="curve",
        )


def emblem_bow(draw, accent):
    """폭발 화살: an arrow tipped with a bursting star."""
    ox, oy = BIG * 0.26, BIG * 0.76
    tipx, tipy = BIG * 0.66, BIG * 0.36
    ang = math.atan2(tipy - oy, tipx - ox)
    draw.line([(ox, oy), (tipx, tipy)], fill=lighten(accent, 0.5), width=14)
    perp = ang + math.pi / 2
    for s in (-1, 1):
        draw.line(
            [
                (ox, oy),
                (
                    ox - math.cos(ang) * 46 + math.cos(perp) * 26 * s,
                    oy - math.sin(ang) * 46 + math.sin(perp) * 26 * s,
                ),
            ],
            fill=lighten(accent, 0.35),
            width=10,
        )
    # explosion star at the tip
    for i in range(10):
        a = i / 10 * math.tau
        r = 120 if i % 2 == 0 else 54
        draw.line(
            [
                (tipx, tipy),
                (tipx + math.cos(a) * r, tipy + math.sin(a) * r),
            ],
            fill=lighten(accent, 0.65 if i % 2 else 0.35),
            width=16 if i % 2 == 0 else 10,
        )
    draw.ellipse([tipx - 40, tipy - 40, tipx + 40, tipy + 40], fill=lighten(accent, 0.8))
    draw.ellipse([tipx - 18, tipy - 18, tipx + 18, tipy + 18], fill=(255, 255, 240))


def emblem_staff(draw, accent):
    """비전 광선: a focused arcane beam from a glyph circle."""
    cx, cy = BIG * 0.30, BIG * 0.70
    for r, w in [(96, 10), (66, 6)]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=lighten(accent, 0.4), width=w)
    ang = -math.pi / 4
    perp = ang + math.pi / 2
    for wdt, f in [(46, 0.25), (26, 0.55), (10, 0.9)]:
        pts = [
            (cx + math.cos(perp) * wdt, cy + math.sin(perp) * wdt),
            (cx - math.cos(perp) * wdt, cy - math.sin(perp) * wdt),
            (cx + math.cos(ang) * 330 - math.cos(perp) * wdt * 1.6,
             cy + math.sin(ang) * 330 - math.sin(perp) * wdt * 1.6),
            (cx + math.cos(ang) * 330 + math.cos(perp) * wdt * 1.6,
             cy + math.sin(ang) * 330 + math.sin(perp) * wdt * 1.6),
        ]
        draw.polygon(pts, fill=lighten(accent, f))
    for i in range(6):
        a = i / 6 * math.tau
        px = cx + math.cos(a) * 96
        py = cy + math.sin(a) * 96
        draw.ellipse([px - 10, py - 10, px + 10, py + 10], fill=lighten(accent, 0.7))


EMBLEMS = {
    "longsword": emblem_longsword,
    "dagger": emblem_dagger,
    "shield": emblem_shield,
    "bow": emblem_bow,
    "staff": emblem_staff,
}


def badge(draw, accent):
    x, y = BIG * 0.80, BIG * 0.82
    draw.rounded_rectangle(
        [x - 52, y - 40, x + 52, y + 40],
        radius=12,
        fill=(14, 18, 24),
        outline=lighten(accent, 0.5),
        width=6,
    )
    for dx in (-16, 16):
        draw.rectangle([x + dx - 8, y - 24, x + dx + 8, y + 24], fill=lighten(accent, 0.8))


def build(weapon: str) -> None:
    accent = ACCENTS[weapon]
    art = interior_base(accent)
    glow = Image.new("RGB", (BIG, BIG), (0, 0, 0))
    EMBLEMS[weapon](ImageDraw.Draw(glow), accent)
    art = Image.composite(
        art, art, Image.new("L", (BIG, BIG), 0)
    )
    blurred = glow.filter(ImageFilter.GaussianBlur(18))
    from PIL import ImageChops

    art = ImageChops.screen(art, blurred)
    sharp = Image.new("RGB", (BIG, BIG), (0, 0, 0))
    EMBLEMS[weapon](ImageDraw.Draw(sharp), accent)
    art = ImageChops.screen(art, sharp)
    badge(ImageDraw.Draw(art), accent)

    # pixelate the interior to match the house style
    art = art.resize((PIX, PIX), Image.LANCZOS).resize((OUT, OUT), Image.NEAREST)

    # borrow the ornate frame from the matching v1 icon
    frame_src = Image.open(SKILLS / f"{weapon}-v1.png").convert("RGB").resize(
        (OUT, OUT), Image.LANCZOS
    )
    border = int(OUT * 0.075)
    framed = frame_src.copy()
    framed.paste(art.crop((border, border, OUT - border, OUT - border)), (border, border))
    framed.save(SKILLS / f"{weapon}-skill2-v1.png")


def main() -> None:
    for weapon in ACCENTS:
        build(weapon)
    print("generated", len(ACCENTS), "icons")


if __name__ == "__main__":
    main()
