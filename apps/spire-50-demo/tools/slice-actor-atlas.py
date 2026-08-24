"""Slice the generated 4x8 actor atlas into transparent directional frames."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ACTORS = ("rat", "beetle", "wraith", "wanderer")
DIRECTION_COLUMNS = {
    "south": (0, 1),
    "west": (2, 3),
    "east": (4, 5),
    "north": (6, 7),
}


def crop_cell(sheet: Image.Image, column: int, row: int) -> Image.Image:
    left = round(sheet.width * column / 8)
    top = round(sheet.height * row / 4)
    right = round(sheet.width * (column + 1) / 8)
    bottom = round(sheet.height * (row + 1) / 4)
    return sheet.crop((left, top, right, bottom))


def clean_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: 0 if value < 18 else value)
    rgba.putalpha(alpha)
    return rgba


def remove_chroma_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    cleaned = []
    pixel_data = getattr(rgba, "get_flattened_data", rgba.getdata)()
    for red, green, blue, alpha in pixel_data:
        dominance = green - max(red, blue)
        if green > 105 and dominance > 28:
            edge_alpha = max(0, min(alpha, int((72 - dominance) * 6.2)))
            green = min(green, max(red, blue) + 16)
            cleaned.append((red, green, blue, edge_alpha))
        else:
            cleaned.append((red, green, blue, alpha))
    rgba.putdata(cleaned)
    return rgba


def fit_sprite(cell: Image.Image) -> Image.Image:
    bounds = cell.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Atlas cell contains no visible sprite pixels")
    subject = cell.crop(bounds)
    subject.thumbnail((104, 106), Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (112, 112), (0, 0, 0, 0))
    x = (frame.width - subject.width) // 2
    y = frame.height - subject.height - 3
    frame.alpha_composite(subject, (x, y))
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("atlas", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--chroma-green", action="store_true")
    parser.add_argument("--attack", action="store_true")
    args = parser.parse_args()

    sheet = Image.open(args.atlas)
    sheet = remove_chroma_green(sheet) if args.chroma_green else clean_alpha(sheet)
    for row, actor in enumerate(ACTORS):
        actor_output = args.output / actor / "attack" if args.attack else args.output / actor
        actor_output.mkdir(parents=True, exist_ok=True)
        for direction, columns in DIRECTION_COLUMNS.items():
            for frame_index, column in enumerate(columns):
                frame = fit_sprite(crop_cell(sheet, column, row))
                frame.save(
                    actor_output / f"{direction}-{frame_index}.png",
                    optimize=True,
                )


if __name__ == "__main__":
    main()
