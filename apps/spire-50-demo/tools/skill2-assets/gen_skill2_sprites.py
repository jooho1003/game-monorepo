"""Generate skill-2 motion sprites by deriving from the skill-1 poses.

Keeps the character pixels intact (same silhouette, same direction, same
112x112 canvas) and layers a weapon-accent energy treatment on top so the
second skill reads differently in game:
  - a radial aura ring behind the character (direction neutral)
  - an accent-colored rim glow hugging the silhouette
  - a subtle accent tint on the brightest (blade/weapon) pixels
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path("/home/user/game-monorepo/apps/spire-50-demo/public/assets")
SRC = ASSETS / "game/world/player-v2/skill"
DST = ASSETS / "game/world/player-v2/skill2"

WEAPON_ACCENTS = {
    "longsword": (140, 230, 208),
    "dagger": (223, 157, 243),
    "shield": (240, 201, 123),
    "bow": (169, 219, 126),
    "staff": (135, 185, 255),
}

DIRECTIONS = [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
]

SIZE = 112


def aura_layer(accent: tuple[int, int, int], frame: int) -> Image.Image:
    """Radial double ring aura, symmetric so it never skews direction."""
    scale = 4
    big = Image.new("RGBA", (SIZE * scale, SIZE * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    cx = cy = SIZE * scale / 2
    base = (SIZE * scale) * (0.40 if frame == 0 else 0.46)
    for radius, width, alpha in [
        (base, 14, 205),
        (base * 0.82, 8, 160),
    ]:
        draw.ellipse(
            [cx - radius, cy - radius * 0.62, cx + radius, cy + radius * 0.62],
            outline=(*accent, alpha),
            width=width,
        )
    # rune ticks around the ring, evenly spaced -> still symmetric
    ticks = 8
    for i in range(ticks):
        ang = (i / ticks) * math.tau + (0.18 if frame else 0.0)
        tx = cx + math.cos(ang) * base
        ty = cy + math.sin(ang) * base * 0.62
        r = 7
        draw.ellipse([tx - r, ty - r, tx + r, ty + r], fill=(*accent, 235))
    big = big.filter(ImageFilter.GaussianBlur(scale * 0.8))
    return big.resize((SIZE, SIZE), Image.LANCZOS)


def rim_glow(sprite: Image.Image, accent: tuple[int, int, int]) -> Image.Image:
    alpha = sprite.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(5))
    halo = Image.new("RGBA", sprite.size, (*accent, 0))
    halo.putalpha(grown)
    halo = halo.filter(ImageFilter.GaussianBlur(1.6))
    # keep the halo soft
    r, g, b, a = halo.split()
    a = a.point(lambda v: int(v * 0.85))
    return Image.merge("RGBA", (r, g, b, a))


def tint_highlights(
    sprite: Image.Image, accent: tuple[int, int, int]
) -> Image.Image:
    out = sprite.copy()
    px = out.load()
    ar, ag, ab = accent
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum > 168:  # bright metal / cloth highlights
                t = 0.5
                px[x, y] = (
                    int(r * (1 - t) + ar * t),
                    int(g * (1 - t) + ag * t),
                    int(b * (1 - t) + ab * t),
                    a,
                )
    return out


def build(weapon: str, direction: str, frame: int) -> None:
    accent = WEAPON_ACCENTS[weapon]
    src = Image.open(SRC / weapon / f"{direction}-{frame}.png").convert("RGBA")
    assert src.size == (SIZE, SIZE), src.size

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(aura_layer(accent, frame))
    canvas.alpha_composite(rim_glow(src, accent))
    canvas.alpha_composite(tint_highlights(src, accent))

    out_dir = DST / weapon
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas.save(out_dir / f"{direction}-{frame}.png")


def main() -> None:
    for weapon in WEAPON_ACCENTS:
        for direction in DIRECTIONS:
            for frame in (0, 1):
                build(weapon, direction, frame)
    print("generated", len(WEAPON_ACCENTS) * len(DIRECTIONS) * 2, "sprites")


if __name__ == "__main__":
    main()
