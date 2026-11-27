"""Export Aurevane's authored-character briefs and check portrait and sprite delivery."""

from argparse import ArgumentParser
from collections import Counter
from hashlib import sha256
from itertools import product
import json
from pathlib import Path

from PIL import Image

EXPRESSION_NAMES = ("neutral", "happy", "angry", "sad", "surprised")
PORTRAIT_SIZE = (448, 448)
VARIANTS = ("variant-1", "variant-2")
SPRITE_POSES = ("field", "idle", "walk", "attack", "cast", "hit", "down")
SPRITE_FACINGS = ("south", "east", "north", "west")
SPRITE_ATLAS_SIZE = (3072, 768)
ART_ROOT = Path(__file__).resolve().parents[2] / "apps/web/public/media/art/character-catalogue"
ART_DIRECTION = (
    "Original Aurevane supernatural fantasy anime illustration. Confident tapered ink lines, "
    "angular facial planes, crisp two or three-tone cel shadows, strong directional rim light, "
    "and a painted anime landscape with deliberate silhouettes and atmospheric depth. Paint "
    "the face, neck, clothing and setting together with one light direction. Each square is a "
    "chest-up portrait. Keep the subject's identity, costume and location across expressions."
)

RACES = {
    "human": (
        "human",
        ("warm olive skin", "deep brown skin", "tan skin", "pale freckled skin", "brown skin"),
        ("round human ears", "a chipped tooth", "an eyebrow scar"),
    ),
    "elf": (
        "elf with long pointed ears",
        ("dark brown skin", "cool pale skin", "warm umber skin", "bronze skin", "ruddy skin"),
        ("silver ear cuffs", "a faint temple freckle pattern", "copper hair pins"),
    ),
    "fae": (
        "fae with slender antennae and petal-shaped ears",
        ("reddish brown skin", "deep brown skin", "twilight-rose skin", "warm tan skin", "plum skin"),
        ("iridescent ear edges", "short luminous freckles", "faintly luminescent irises"),
    ),
    "mountain-orc": (
        "large, broadly built mountain orc with two lower tusks",
        ("gray-green skin", "smoky jade skin", "blue gray-green skin", "olive skin", "slate skin"),
        ("a healed cheek scar", "a brass tusk ring", "one chipped tusk"),
    ),
}

FEATURED_SUBJECTS = {
    "human-m-0001": "Warm olive-skinned human highland traveler, loosely swept dark brown hair, beard stubble, brown travel cloak with fur and a bronze brooch, winter mountain pass.",
    "human-f-0001": "Human knight with dark chestnut jaw-length side-parted hair, warm medium brown skin and narrow amber eyes, gray light armor and olive cape, mountain citadel at twilight.",
    "elf-m-0001": "Dark-skinned elf scout with long pointed ears and indigo-black hair tied high, silver cloak over an ochre coat, fog-shrouded forest aqueduct.",
    "elf-f-0001": "Cool pale elf archer with pointed ears, narrow jade eyes and an asymmetrical slate-silver braid, green cloak, painted cedar forest in sunlight.",
    "fae-m-0001": "Fae cartographer with angular features, reddish brown skin, swept dark violet hair, slim antennae and petal ears, slate coat trimmed in violet, harbor lights at night.",
    "fae-f-0001": "Deep brown fae lanternkeeper with luminescent lavender irises, short ash-violet hair, tall petal ears and mothlike antennae, slate and violet mantle, garden at blue hour.",
    "mountain-orc-m-0001": "Broad-jawed mountain orc pathfinder with two lower tusks and blue gray-green skin, knotted dark hair and slate climbing coat, icy basalt heights.",
    "mountain-orc-f-0001": "Strong gray-green mountain orc vanguard with two ivory tusks and a black braided topknot, ochre and cliff-brown armor, basalt town among red cliffs at dusk.",
}

HAIR = (
    "dark short swept hair",
    "an ash-brown braid",
    "dense deep-black curls",
    "dark copper wavy hair",
    "chestnut hair tied back high",
)
FACE = (
    "a long face and a narrow jaw",
    "a square jaw and heavy brows",
    "a round face and high brows",
    "pronounced cheekbones and close-set eyes",
    "a wide nose and open-set eyes",
)
OCCUPATIONS = (
    ("sentinel", "weathered plate with an indigo cloak", "a moonlit gatehouse"),
    ("wayfinder", "a rust cloak and a leather satchel", "a rocky wind-swept coast"),
    ("healer", "a moss-green mantle and silver clasp", "a misty orchard shrine"),
    ("artisan", "a saffron sash over a slate apron", "a lamplit canal workshop"),
    ("rider", "a dark teal riding coat and bronze fasteners", "terraced wheat fields at dusk"),
)


POSES = (
    "body at a three-quarter angle with one shoulder forward, gaze toward the horizon",
    "profile with the head turned back over the near shoulder",
    "torso square to camera, head tilted to one side and eyes just off camera",
    "slight low-angle view with the chin lifted and shoulders turned",
    "subtle high-angle view with chin lowered and eyes looking up",
    "side-on bust looking past the camera, near arm brushing the cloak",
    "uneven shoulder line, one gloved hand resting naturally on the collar",
    "head and chest turned through opposite angles as if reacting to a sound",
)
ALTERNATE_DESIGNS = (
    "crimson and ivory costume with ice-blue eyes and a healed brow scar",
    "pale teal and night violet costume with amber eyes and a copper streak in the hair",
    "warm ochre and onyx costume with jade eyes and faint freckles",
    "midnight blue and burnt coral costume with lilac eyes and a small healed cheek scar",
    "wine and pale gold costume with moss-green eyes and a silver temple streak",
    "dark evergreen and cloud-gray costume with copper eyes and a subtle birthmark",
)

FEATURED_ALTERNATES = {
    "human-m-0001": (0, 1, 0),
    "human-f-0001": (0, 6, 3),
    "elf-m-0001": (0, 4, 5),
    "elf-f-0001": (0, 5, 4),
    "fae-m-0001": (0, 1, 2),
    "fae-f-0001": (0, 3, 2),
    "mountain-orc-m-0001": (0, 7, 1),
    "mountain-orc-f-0001": (0, 1, 3),
}


def catalogue():
    """The key identifies one new individual across all five expressions."""
    for index, (skin, hair, facial_structure, mark) in enumerate(
        product(range(5), HAIR, FACE, range(3)), start=1
    ):
        for presentation, letter in (("masculine", "m"), ("feminine", "f")):
            for race, (form, complexions, marks) in RACES.items():
                key = f"{race}-{letter}-{index:04d}"
                role, clothes, setting = OCCUPATIONS[(index + skin + mark) % len(OCCUPATIONS)]
                subject = FEATURED_SUBJECTS.get(
                    key,
                    f"Adult {form} {role} with {complexions[skin]}, {hair}, {facial_structure}, "
                    f"and {marks[mark]}. Wears {clothes}, set at {setting}.",
                )
                pose = (index + skin + mark + len(race)) % len(POSES)
                pose_2 = (pose + 1 + index % (len(POSES) - 1)) % len(POSES)
                palette = index % len(ALTERNATE_DESIGNS)
                pose, pose_2, palette = FEATURED_ALTERNATES.get(key, (pose, pose_2, palette))
                yield {
                    "key": key,
                    "race": race,
                    "presentation": presentation,
                    "subject": subject,
                    "art_direction": ART_DIRECTION,
                    "expressions": EXPRESSION_NAMES,
                    "variants": [
                        {
                            "key": VARIANTS[0],
                            "label": "Variant 1",
                            "portrait_pose": POSES[pose],
                            "design": "Original character palette and features.",
                        },
                        {
                            "key": VARIANTS[1],
                            "label": "Variant 2",
                            "portrait_pose": POSES[pose_2],
                            "design": (
                                "Keep the same identity and anatomy. "
                                f"Repaint with {ALTERNATE_DESIGNS[palette]}."
                            ),
                        },
                    ],
                    "sprite_poses": SPRITE_POSES,
                    "sprite_facings": SPRITE_FACINGS,
                    "sprite_atlas": f"{key}/<variant>/sprites.webp",
                    "delivery": f"{key}/<variant>/<expression>.webp",
                }


def verify_art(characters, root):
    counts = Counter()
    seen = {}
    problems = []
    for character in characters:
        key = character["key"]
        portraits_ready = 0
        for variant in VARIANTS:
            atlas = root / key / variant / "sprites.webp"
            if not atlas.is_file():
                counts["missing_atlases"] += 1
            else:
                try:
                    with Image.open(atlas) as image:
                        if image.format != "WEBP" or image.size != SPRITE_ATLAS_SIZE or image.mode != "RGBA":
                            raise ValueError("expected a transparent 3072 × 768 motion atlas")
                        alpha_low, alpha_high = image.getchannel("A").getextrema()
                        if alpha_low != 0 or alpha_high == 0:
                            raise ValueError("the motion atlas needs artwork and transparent space")
                except (OSError, ValueError) as exc:
                    problems.append(f"{atlas.relative_to(root)}: {exc}")
                    counts["invalid_atlases"] += 1
                else:
                    counts["ready_atlases"] += 1
            for expression in EXPRESSION_NAMES:
                file = root / key / variant / f"{expression}.webp"
                if not file.is_file():
                    counts["missing"] += 1
                    continue
                try:
                    with Image.open(file) as image:
                        if image.format != "WEBP" or image.size != PORTRAIT_SIZE:
                            raise ValueError(f"expected a {PORTRAIT_SIZE[0]}px square WebP")
                        fingerprint = sha256(image.convert("RGB").tobytes()).digest()
                    if fingerprint in seen:
                        raise ValueError(f"uses the same pixels as {seen[fingerprint]}")
                    seen[fingerprint] = file.relative_to(root)
                except (OSError, ValueError) as exc:
                    problems.append(f"{file.relative_to(root)}: {exc}")
                    counts["invalid"] += 1
                else:
                    counts["ready"] += 1
                    portraits_ready += 1
        if portraits_ready == len(VARIANTS) * len(EXPRESSION_NAMES):
            counts["complete_portraits"] += 1
    return counts, problems


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("briefs", "status", "check"))
    parser.add_argument("--art-root", type=Path, default=ART_ROOT)
    args = parser.parse_args()
    characters = list(catalogue())

    if args.command == "briefs":
        for character in characters:
            print(json.dumps(character, ensure_ascii=False))
        return 0

    counts, problems = verify_art(characters, args.art_root)
    for problem in problems:
        print(problem)
    print(
        f'{len(characters):,} character briefs. {counts["ready"]:,} portraits decoded, '
        f'{counts["missing"]:,} missing, {counts["invalid"]:,} invalid.'
    )
    print(f'{counts["complete_portraits"]:,} characters have both portrait variants.')
    print(
        f'{counts["ready_atlases"]:,} gameplay sprite atlases decoded, '
        f'{counts["missing_atlases"]:,} missing, {counts["invalid_atlases"]:,} invalid.'
    )
    unfinished = any(counts[key] for key in ("missing", "invalid", "missing_atlases", "invalid_atlases"))
    return int(args.command == "check" and unfinished)


if __name__ == "__main__":
    raise SystemExit(main())
