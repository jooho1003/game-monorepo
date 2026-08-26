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


def actor_baseline(cell: Image.Image, bounds: tuple[int, int, int, int]) -> int:
    """Estimate the feet baseline without letting a long weapon move the actor."""
    alpha = cell.getchannel("A")
    center = cell.width // 2
    half_body_width = max(1, cell.width // 5)
    body_band = alpha.crop(
        (center - half_body_width, 0, center + half_body_width, cell.height)
    )
    body_bounds = body_band.point(lambda value: 255 if value > 8 else 0).getbbox()
    return body_bounds[3] if body_bounds is not None else bounds[3]


def anchored_action_geometry(
    cells: list[Image.Image],
    canvas_width: int,
    canvas_height: int,
) -> tuple[float, int]:
    """Return one scale/baseline that keeps every actor on the same world point."""
    max_horizontal_extent = 1
    max_above = 1
    max_below = 0
    for cell in cells:
        left, top, right, bottom = alpha_bounds(cell)
        center = cell.width // 2
        baseline = actor_baseline(cell, (left, top, right, bottom))
        max_horizontal_extent = max(
            max_horizontal_extent,
            center - left,
            right - center,
        )
        max_above = max(max_above, baseline - top)
        max_below = max(max_below, bottom - baseline)

    scale = min(
        (canvas_width - 6) / (max_horizontal_extent * 2),
        (canvas_height - 4) / (max_above + max_below),
    )
    target_baseline = round(canvas_height - 2 - max_below * scale)
    return scale, target_baseline


def fit_sprite_on_actor_anchor(
    cell: Image.Image,
    canvas_width: int,
    canvas_height: int,
    scale: float,
    target_baseline: int,
) -> Image.Image:
    """Map the authored cell center and feet to one stable runtime anchor."""
    bounds = alpha_bounds(cell)
    baseline = actor_baseline(cell, bounds)
    resized = cell.resize(
        (
            max(1, round(cell.width * scale)),
            max(1, round(cell.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    x = round(canvas_width / 2 - (cell.width / 2) * scale)
    y = round(target_baseline - baseline * scale)
    frame.alpha_composite(resized, (x, y))
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


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    """Drop weapon/effect fragments that leaked in from a neighboring grid cell."""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    visible = {
        (x, y)
        for y in range(rgba.height)
        for x in range(rgba.width)
        if alpha.getpixel((x, y)) > 8
    }
    components: list[set[tuple[int, int]]] = []
    while visible:
        start = visible.pop()
        component = {start}
        frontier = [start]
        while frontier:
            x, y = frontier.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor not in visible:
                    continue
                visible.remove(neighbor)
                component.add(neighbor)
                frontier.append(neighbor)
        components.append(component)
    if not components:
        return rgba
    largest = max(components, key=len)
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if (x, y) not in largest:
                red, green, blue, _ = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)
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
    parser.add_argument(
        "--preserve-cell-anchor",
        action="store_true",
        help=(
            "anchor action frames by the authored cell center and actor feet so "
            "long weapons cannot shift the character left/right"
        ),
    )
    parser.add_argument(
        "--largest-component",
        action="store_true",
        help="remove disconnected fragments leaking in from adjacent grid cells",
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
    if args.largest_component:
        action_cells = {
            direction: tuple(keep_largest_alpha_component(cell) for cell in cells)
            for direction, cells in action_cells.items()
        }
    scale = None
    target_baseline = None
    all_action_cells = [
        cell for cells in action_cells.values() for cell in cells
    ]
    if args.preserve_cell_anchor:
        scale, target_baseline = anchored_action_geometry(
            all_action_cells,
            args.canvas_width,
            args.canvas_height,
        )
    if args.consistent_scale and not args.preserve_cell_anchor:
        bounds = [
            alpha_bounds(cell)
            for cell in all_action_cells
        ]
        widest = max(right - left for left, _, right, _ in bounds)
        tallest = max(bottom - top for _, top, _, bottom in bounds)
        scale = min(
            (args.canvas_width - 6) / widest,
            (args.canvas_height - 4) / tallest,
        )

    for direction, cells in action_cells.items():
        for frame_index, cell in enumerate(cells):
            fitted = (
                fit_sprite_on_actor_anchor(
                    cell,
                    args.canvas_width,
                    args.canvas_height,
                    scale,
                    target_baseline,
                )
                if args.preserve_cell_anchor
                and scale is not None
                and target_baseline is not None
                else fit_sprite(
                    cell,
                    args.canvas_width,
                    args.canvas_height,
                    scale,
                )
            )
            fitted.save(
                args.output / f"{direction}-{frame_index}.png", optimize=True
            )


if __name__ == "__main__":
    main()
