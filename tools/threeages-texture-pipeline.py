#!/usr/bin/env python3
"""Deterministic BC/N/ORM processor for the ThreeAges texture pilot.

The generator is deliberately local and non-destructive: Imagen (or another
art source) supplies only an albedo candidate, while this tool makes the
tile-safe derivative maps, a repeat preview, and a machine-readable seam
report. It writes only beneath the repository and never overwrites an existing
artifact unless ``--overwrite`` is explicitly supplied.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def project_path(value: str, *, label: str) -> Path:
    path = Path(value).resolve()
    try:
        path.relative_to(PROJECT_ROOT)
    except ValueError as error:
        raise ValueError(f"{label} must stay inside the project: {path}") from error
    return path


def positive_power_of_two(value: str) -> int:
    size = int(value)
    if size < 64 or size > 4096 or size & (size - 1):
        raise argparse.ArgumentTypeError("size must be a power of two between 64 and 4096")
    return size


def clamp01(values: np.ndarray) -> np.ndarray:
    return np.clip(values, 0.0, 1.0)


def seamless_rgb(rgb: np.ndarray, edge_band: int) -> np.ndarray:
    """Softly reconcile opposite edge bands, leaving the image centre intact."""
    height, width, _ = rgb.shape
    band = min(edge_band, max(1, min(width, height) // 8))
    result = rgb.copy()
    for offset in range(band):
        strength = 1.0 - offset / band
        left = rgb[:, offset, :]
        right = rgb[:, width - 1 - offset, :]
        shared = (left + right) * 0.5
        result[:, offset, :] = left * (1.0 - strength) + shared * strength
        result[:, width - 1 - offset, :] = right * (1.0 - strength) + shared * strength
        top = result[offset, :, :]
        bottom = result[height - 1 - offset, :, :]
        shared = (top + bottom) * 0.5
        result[offset, :, :] = top * (1.0 - strength) + shared * strength
        result[height - 1 - offset, :, :] = bottom * (1.0 - strength) + shared * strength
    return result


def seam_error(rgb: np.ndarray) -> dict[str, float]:
    vertical = float(np.mean(np.abs(rgb[:, 0, :] - rgb[:, -1, :])))
    horizontal = float(np.mean(np.abs(rgb[0, :, :] - rgb[-1, :, :])))
    return {"vertical": vertical, "horizontal": horizontal, "max": max(vertical, horizontal)}


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722


def normal_from_height(height: np.ndarray, strength: float) -> np.ndarray:
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    normal = np.stack((-dx * strength, -dy * strength, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return clamp01(normal * 0.5 + 0.5)


def orm_from_height(height: np.ndarray, metalness_value: float) -> np.ndarray:
    height_image = Image.fromarray(np.rint(height * 255).astype(np.uint8), "L")
    blurred = np.asarray(height_image.filter(ImageFilter.GaussianBlur(radius=3)), dtype=np.float32) / 255.0
    cavity = clamp01(blurred - height)
    ao = 1.0 - cavity * 0.35
    roughness = clamp01(0.68 + (1.0 - height) * 0.18)
    metalness = np.full_like(height, metalness_value)
    return np.stack((ao, roughness, metalness), axis=-1)


def repeat_preview(image: Image.Image, cell_size: int = 192) -> Image.Image:
    preview = Image.new("RGB", (cell_size * 3, cell_size * 3))
    tile = image.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
    for y in range(3):
        for x in range(3):
            preview.paste(tile, (x * cell_size, y * cell_size))
    return preview


def write_png(image: Image.Image, path: Path, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"Refusing to overwrite {path}; pass --overwrite after review.")
    image.save(path, "PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Project-relative albedo candidate PNG.")
    parser.add_argument("--out-dir", required=True, help="Project-relative destination directory.")
    parser.add_argument("--name", required=True, help="Output basename, for example T_TA_Wood_Dark_Candidate_A.")
    parser.add_argument("--size", type=positive_power_of_two, default=1024)
    parser.add_argument("--normal-strength", type=float, default=3.0)
    parser.add_argument(
        "--orm-metalness",
        type=float,
        default=0.0,
        help="Constant metalness value packed into the ORM B channel (0..1).",
    )
    parser.add_argument("--edge-band", type=int, default=24)
    parser.add_argument("--seam-threshold", type=float, default=0.015)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not 0.1 <= args.normal_strength <= 12:
        parser.error("--normal-strength must be between 0.1 and 12")
    if not 0.0 <= args.orm_metalness <= 1.0:
        parser.error("--orm-metalness must be between 0 and 1")
    if not 1 <= args.edge_band <= 256:
        parser.error("--edge-band must be between 1 and 256")
    if not 0 < args.seam_threshold <= 0.25:
        parser.error("--seam-threshold must be between 0 and 0.25")
    if not args.name.replace("_", "").replace("-", "").isalnum():
        parser.error("--name may contain only letters, digits, _ and -")

    source_path = project_path(args.input, label="input")
    output_dir = project_path(args.out_dir, label="out-dir")
    if source_path.suffix.lower() != ".png":
        parser.error("--input must be a PNG candidate")
    if not source_path.is_file():
        parser.error(f"input does not exist: {source_path}")

    source = Image.open(source_path).convert("RGB")
    source = source.resize((args.size, args.size), Image.Resampling.LANCZOS)
    rgb = np.asarray(source, dtype=np.float32) / 255.0
    rgb = seamless_rgb(rgb, args.edge_band)
    seam = seam_error(rgb)
    if seam["max"] > args.seam_threshold:
        raise RuntimeError(f"seam error {seam['max']:.5f} exceeds threshold {args.seam_threshold:.5f}")

    albedo = Image.fromarray(np.rint(rgb * 255).astype(np.uint8), "RGB")
    height = luminance(rgb)
    normal = Image.fromarray(np.rint(normal_from_height(height, args.normal_strength) * 255).astype(np.uint8), "RGB")
    orm = Image.fromarray(np.rint(orm_from_height(height, args.orm_metalness) * 255).astype(np.uint8), "RGB")
    outputs = {
        "baseColor": output_dir / f"{args.name}_BC.png",
        "normal": output_dir / f"{args.name}_N.png",
        "orm": output_dir / f"{args.name}_ORM.png",
        "preview": output_dir / f"{args.name}_3x3.png",
    }
    report = {
        "schema": 1,
        "input": source_path.relative_to(PROJECT_ROOT).as_posix(),
        "size": args.size,
        "normalStrength": args.normal_strength,
        "ormMetalness": args.orm_metalness,
        "edgeBand": args.edge_band,
        "seamError": seam,
        "outputs": {key: path.relative_to(PROJECT_ROOT).as_posix() for key, path in outputs.items()},
    }
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
        write_png(albedo, outputs["baseColor"], args.overwrite)
        write_png(normal, outputs["normal"], args.overwrite)
        write_png(orm, outputs["orm"], args.overwrite)
        write_png(repeat_preview(albedo), outputs["preview"], args.overwrite)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileExistsError, RuntimeError, ValueError) as error:
        print(f"[threeages-texture-pipeline] FAIL: {error}", file=sys.stderr)
        raise SystemExit(1) from error
