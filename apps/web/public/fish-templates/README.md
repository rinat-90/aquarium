# Finny fish template reference assets

Six PNG references and matching filled silhouette masks, all 487×487 pixels.

- `references/`: thin-dashed drawings from the approved printable template design.
- `masks/`: white fish silhouette on black background (white=keep, black=transparent).

These are **reference-space** assets, not ready-made photo segmentation. A scanned photo must be registered/aligned to the reference before applying a mask. In particular, cropping alone does not correct rotation, perspective, or scale. The masks are automatically derived from the original solid drawings; inspect difficult fins before production use.

Copy `references/` and `masks/` to `apps/web/public/fish-templates/` in the `feat/fish-templates` branch.
