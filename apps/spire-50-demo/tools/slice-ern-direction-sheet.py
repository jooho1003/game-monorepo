"""Slice approved Ern direction/action sheets into Phaser-ready sprites."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DIRECTION_CELLS = {
    "south": (0, 0),
    "south-west": (1, 0),
    "west": (2, 0),
    "north-west": (3, 0),
    "north": (0, 1),
    "north-east": (1, 1),
    "east": (2, 1),
    "south-east": (3, 1),
}

ACTION_CELLS = {
    "south": ((0, 0), (1, 0)),
    "south-west": ((2, 0), (3, 0)),
    "west": ((0, 1), (1, 1)),
    "north-west": ((2, 1), (3, 1)),
    "north": ((0, 2), (1, 2)),
    "north-east": ((2, 2), (3, 2)),
    "east": ((0, 3), (1, 3)),
    "south-east": ((2, 3), (3, 3)),
}


def alpha_bounds(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Direction cell contains no visible character pixels")
    return bounds


def fit_sprite(
    cell: Image.Image,
    canvas_width: int = 64,
    canvas_height: int = 96,
    scale: float | None = None,
) -> Image.Image:
    subject = cell.crop(alpha_bounds(cell))
    if scale is None:
        subject.thumbnail(
            (canvas_width - 6, canvas_height - 4), Image.Resampling.LANCZOS
        )
    else:
        subject = subject.resize(
            (
                max(1, round(subject.width * scale)),
                max(1, round(subject.height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )
    frame = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    x = (frame.width - subject.width) // 2
    y = frame.height - subject.height - 2
    frame.alpha_composite(subject, (x, y))
    return frame


def remove_chroma_green(image: Image.Image) -> Image.Image:
    """Remove the generated sheet's green screen with a soft antialias edge."""
    rgba = image.convert("RGBA")
    pixels = []
    pixel_data = getattr(rgba, "get_flattened_data", rgba.getdata)()
    for red, green, blue, alpha in pixel_data:
        dominance = green - max(red, blue)
        if green > 72 and dominance > 8:
            edge_alpha = max(0, min(alpha, int((58 - dominance) * 5.1)))
            green = min(green, max(red, blue) + 8)
            pixels.append((red, green, blue, edge_alpha))
        else:
            pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def crop_grid_cell(
    sheet: Image.Image, column: int, row: int, columns: int, rows: int
) -> Image.Image:
    left = round(sheet.width * column / columns)
    top = round(sheet.height * row / rows)
    right = round(sheet.width * (column + 1) / columns)
    bottom = round(sheet.height * (row + 1) / rows)
    return sheet.crop((left, top, right, bottom))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sheet", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--layout",
        choices=("directions", "action"),
        default="directions",
        help="directions: legacy 4x2 idle sheet; action: 4x4, two frames per direction",
    )
    parser.add_argument(
        "--chroma-green",
        action="store_true",
        help="remove a generated green-screen background before fitting frames",
    )
    parser.add_argument("--canvas-width", type=int, default=64)
    parser.add_argument("--canvas-height", type=int, default=96)
    parser.add_argument(
        "--consistent-scale",
        action="store_true",
        help=(
            "use one scale for every action cell so crouching and weapon reach do "
            "not make the character grow or shrink between frames"
        ),
    )
    args = parser.parse_args()

    sheet = Image.open(args.sheet).convert("RGBA")
    args.output.mkdir(parents=True, exist_ok=True)
    if args.chroma_green:
        sheet = remove_chroma_green(sheet)

    if args.layout == "directions":
        for direction, (column, row) in DIRECTION_CELLS.items():
            cell = crop_grid_cell(sheet, column, row, 4, 2)
            fit_sprite(cell, args.canvas_width, args.canvas_height).save(
                args.output / f"{direction}.png", optimize=True
            )
        return

    action_cells = {
        direction: tuple(
            crop_grid_cell(sheet, column, row, 4, 4) for column, row in cells
        )
        for direction, cells in ACTION_CELLS.items()
    }
    scale = None
    if args.consistent_scale:
        bounds = [
            alpha_bounds(cell)
            for cells in action_cells.values()
            for cell in cells
        ]
        widest = max(right - left for left, _, right, _ in bounds)
        tallest = max(bottom - top for _, top, _, bottom in bounds)
        scale = min(
            (args.canvas_width - 6) / widest,
            (args.canvas_height - 4) / tallest,
        )

    for direction, cells in action_cells.items():
        for frame_index, cell in enumerate(cells):
            fit_sprite(
                cell,
                args.canvas_width,
                args.canvas_height,
                scale,
            ).save(
                args.output / f"{direction}-{frame_index}.png", optimize=True
            )


if __name__ == "__main__":
    main()
