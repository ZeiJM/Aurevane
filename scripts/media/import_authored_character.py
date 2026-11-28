"""Pack paired portrait and sprite sheets into the Aurevane character catalogue."""

from argparse import ArgumentParser
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import distance_transform_edt, label

from authored_character_catalogue import ART_ROOT, EXPRESSION_NAMES, PORTRAIT_SIZE, VARIANTS, catalogue

FRAME_WIDTH = 96
FRAME_HEIGHT = 128
GRID_COLUMNS = 5
GRID_ROWS = 6


def portrait_cells(image):
    width, height = image.size
    if abs(width / GRID_COLUMNS - height / 2) > width / GRID_COLUMNS * 0.04:
        raise ValueError(f"Expected ten square portraits in a 5×2 grid, got {image.size}")
    return [
        [
            image.crop((
                round(column * width / GRID_COLUMNS) + 3,
                round(row * height / 2) + 3,
                round((column + 1) * width / GRID_COLUMNS) - 3,
                round((row + 1) * height / 2) - 3,
            )).convert("RGB")
            for column in range(GRID_COLUMNS)
        ]
        for row in range(2)
    ]


def clean_canvas(image):
    pixels = np.array(image.convert("RGBA"))
    colors = pixels[:, :, :3]
    alpha = pixels[:, :, 3].astype(np.float32)
    pale_matte = (colors.min(axis=2) > 180) & (np.ptp(colors, axis=2) < 22) & (alpha < 245)
    if pale_matte.mean() > 0.4:
        alpha[pale_matte] = 0
    pixels[:, :, 3] = np.clip((alpha - 102) * 1.76, 0, 255).astype(np.uint8)
    return pixels


def separators(density, divisions):
    stride = len(density) / divisions
    half_window = max(2, round(stride * 0.13))
    cuts = [0]
    for index in range(1, divisions):
        midpoint = round(index * stride)
        region = np.arange(midpoint - half_window, midpoint + half_window + 1)
        score = density[region] + abs(region - midpoint) * (0.035 / half_window)
        cuts.append(int(region[score.argmin()]))
    return [*cuts, len(density)]


def isolate_figure(pixels, row, column):
    alpha = pixels[:, :, 3]
    opaque = alpha >= 145
    coverage = opaque.mean()
    if coverage < 0.06 or coverage > 0.68:
        raise ValueError(f"Unexpected sprite coverage {coverage:.2f} in row {row + 1}, column {column + 1}")
    components, _ = label(opaque, structure=np.ones((3, 3), dtype=int))
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    if sizes.max() < opaque.sum() * 0.73:
        raise ValueError(f"Sprite is split across figures in row {row + 1}, column {column + 1}")
    main = components == sizes.argmax()
    margin = max(4, round(min(alpha.shape) * 0.024))
    alpha[distance_transform_edt(~main) > margin] = 0
    figure = Image.fromarray(pixels)
    return figure.crop(Image.fromarray(alpha).getbbox())


def sprite_cells(image):
    width, height = image.size
    if abs(width / GRID_COLUMNS - height / GRID_ROWS) > width / GRID_COLUMNS * 0.085:
        raise ValueError(f"Expected a 5×6 sprite grid, got {image.size}")
    pixels = clean_canvas(image)
    foreground = pixels[:, :, 3] >= 145
    columns = separators(foreground.mean(axis=0), GRID_COLUMNS)
    rows = separators(foreground.mean(axis=1), GRID_ROWS)
    return [
        [
            isolate_figure(
                pixels[rows[row]:rows[row + 1], columns[column]:columns[column + 1]].copy(),
                row, column,
            )
            for column in range(GRID_COLUMNS)
        ]
        for row in range(GRID_ROWS)
    ]


def frame(figure, width=92, height=111, footline=113, shift=0):
    art = figure.copy()
    art.thumbnail((width - 4, height - 4), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
    output.alpha_composite(art, ((FRAME_WIDTH - art.width) // 2 + shift, footline - art.height))
    return output


def motion_atlas(views):
    atlas = Image.new("RGBA", (FRAME_WIDTH * 32, FRAME_HEIGHT * 6))
    for facing, figures in enumerate([*views, [ImageOps.mirror(figure) for figure in views[1]]]):
        idle, walk, attack, cast, hit = figures
        direction = -1 if facing == 3 else 1
        stand = frame(idle)
        lying = idle.rotate(90 * direction, expand=True, resample=Image.Resampling.BICUBIC)
        falling = idle.rotate(39 * direction, expand=True, resample=Image.Resampling.BICUBIC)
        down = frame(lying, width=96, height=45, footline=111)
        poses = [
            [stand] * 8,
            [stand, frame(walk, shift=-2 * direction), frame(walk), frame(walk, shift=2 * direction)] * 2,
            [stand, frame(attack, width=94, shift=-2 * direction),
             frame(attack, width=96, shift=2 * direction), *([stand] * 5)],
            [stand, frame(cast, width=94), frame(cast, width=96, height=114), *([stand] * 5)],
            [stand, frame(hit, width=94), frame(hit, width=94, shift=-2 * direction), *([stand] * 5)],
            [stand, frame(falling, width=94, height=101), *([down] * 6)],
        ]
        for row, sequence in enumerate(poses):
            for index, art in enumerate(sequence):
                atlas.alpha_composite(art, ((facing * 8 + index) * FRAME_WIDTH, row * FRAME_HEIGHT))
    return atlas


def write_character(output, portraits, figures):
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Character already exists at {output}")
    with TemporaryDirectory(dir=output.parent) as temporary:
        directory = Path(temporary) / output.name
        for index, variant in enumerate(VARIANTS):
            target = directory / variant
            target.mkdir(parents=True)
            for expression, portrait in zip(EXPRESSION_NAMES, portraits[index], strict=True):
                crop = ImageOps.fit(portrait, PORTRAIT_SIZE, Image.Resampling.LANCZOS)
                crop.save(target / f"{expression}.webp", quality=90, method=6)
                if expression == "neutral":
                    crop.crop((57, 27, 391, 361)).resize((128, 128), Image.Resampling.LANCZOS).save(
                        target / "icon.webp", quality=90, method=5,
                    )
            motion_atlas(figures[index * 3:index * 3 + 3]).save(
                target / "sprites.webp", quality=89, method=5,
            )
        directory.rename(output)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("character")
    parser.add_argument("portraits", type=Path)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--references", type=Path, help="Write neutral PNGs for sprite generation")
    action.add_argument("--sprites", type=Path, help="Pack the corresponding paired sprite sheet")
    parser.add_argument("--art-root", type=Path, default=ART_ROOT)
    args = parser.parse_args()
    if args.character not in {record["key"] for record in catalogue()}:
        parser.error(f"Unknown catalogue key {args.character}")
    with Image.open(args.portraits) as sheet:
        portraits = portrait_cells(sheet)
    if args.references:
        args.references.mkdir(parents=True, exist_ok=True)
        for variant, row in zip(VARIANTS, portraits, strict=True):
            row[0].save(args.references / f"{args.character}--{variant}.png")
    else:
        with Image.open(args.sprites) as sheet:
            figures = sprite_cells(sheet)
        write_character(args.art_root / args.character, portraits, figures)


if __name__ == "__main__":
    main()
