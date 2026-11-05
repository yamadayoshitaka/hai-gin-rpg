"""Convert a photographed/generated creature surface into tiny tileable PBR maps.

Usage: python3 scripts/prepare-creature-texture.py source.png assets/creatures/horse-coat
Requires Pillow and NumPy only at asset-build time (not in the browser).
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def make_periodic(values, margin):
    """Cross-fade opposite edges so repeated UVs have no hard seams."""
    result = values.copy()
    for axis in (1, 0):
        n = result.shape[axis]
        indices = np.arange(n)
        edge_distance = np.minimum(indices, n - 1 - indices)
        blend = np.where(
            edge_distance < margin,
            .25 * (1 + np.cos(np.pi * np.minimum(edge_distance, margin) / margin)),
            0.,
        )
        shape = [1, 1]
        shape[axis] = n
        weight = blend.reshape(shape)
        original = result.copy()
        result = original * (1 - weight) + np.flip(original, axis=axis) * weight
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output_prefix', type=Path)
    parser.add_argument('--size', type=int, default=512)
    args = parser.parse_args()

    source = Image.open(args.source).convert('L').resize(
        (args.size, args.size), Image.Resampling.LANCZOS,
    )
    luminance = np.asarray(source, dtype=np.float32) / 255.
    low, high = np.percentile(luminance, [1, 99])
    normalized = np.clip((luminance - low) / max(high - low, .001), 0, 1)
    periodic = make_periodic(normalized, max(12, args.size // 10))

    # Light neutral albedo modulates the animal's existing vertex colors.
    # This preserves horse chestnut, wolf grey and species-specific dragon hues.
    albedo = np.uint8(np.clip((.64 + .34 * periodic) * 255, 0, 255))
    Image.fromarray(albedo, 'L').convert('RGB').save(
        str(args.output_prefix) + '-albedo-v1.webp', 'WEBP', quality=86,
    )

    # Tangent-space normal map follows the SAME fibers/scales as the albedo.
    blur = Image.fromarray(np.uint8(periodic * 255), 'L').filter(
        ImageFilter.GaussianBlur(.65),
    )
    height = np.asarray(blur, dtype=np.float32) / 255.
    dx = (np.roll(height, 1, axis=1) - np.roll(height, -1, axis=1)) * 3.7
    dy = (np.roll(height, 1, axis=0) - np.roll(height, -1, axis=0)) * 3.7
    vectors = np.stack((dx, dy, np.ones_like(height)), axis=2)
    vectors /= np.linalg.norm(vectors, axis=2, keepdims=True)
    normals = np.uint8(np.clip(vectors * 127.5 + 127.5, 0, 255))
    Image.fromarray(normals, 'RGB').save(
        str(args.output_prefix) + '-normal-v1.webp', 'WEBP', quality=93,
    )


if __name__ == '__main__':
    main()
