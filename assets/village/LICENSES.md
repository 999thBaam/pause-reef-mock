# Village theme: asset licences (checked 2026-09-23)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `village.glb` (KayKit part) | **KayKit Medieval Hexagon Pack 1.0**, 51 models from the official glTF folder. Buildings: home_A (red/blue/green), home_B (yellow/red), tavern, church, blacksmith, market, windmill, watermill, well, tower_A/B, lumbermill, castle, grain, stages A–C, dirt, bridge, wood/stone fences. Nature: trees, rocks, water lilies and plants, hill. Props: barrel, crates, sack, wheelbarrow, bucket, flags, tent, lumber, pallet, stone | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 (Kay Lousberg's official repo; the same pack is at https://kaylousberg.itch.io/kaykit-medieval-hexagon) | CC0: the repo's `LICENSE.txt` says "License: (Creative Commons Zero, CC0)". A copy is at `KayKit-MedievalHexagon-License.txt` |
| `village.glb` (Kenney part) | **Kenney Fantasy Town Kit 2.0**, 16 models: lantern, cart, cart-high, stall-red, stall-green, stall-bench, fountain-round, fountain-round-detail, fountain-center, hedge, fence, fence-gate, tree-high-round, tree, wheel, planks | https://kenney.nl/assets/fantasy-town-kit (`kenney_fantasy-town-kit_2.0.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". A copy is at `Kenney-FantasyTownKit-License.txt` |
| `album.jpg` | A crop of this page's own render of the village at 40/40 | own render | CC0 (derivative) |
| (reused, not copied) | Vegetable-bed crops = Quaternius Ultimate Crops (`assets/farm/farm.glb`). Meadow grass and flowers, and the fountain's flower tubs = Quaternius Stylized Nature MegaKit (`assets/kit-a`). Residents = Quaternius Ultimate Animated Animals (Horse, Horse_White, Donkey, ShibaInu in `assets/animals`) plus the Quaternius sheep (`assets/farm/Sheep.glb`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Cobbled lanes, the tavern yard, the plank garden beds, the hay meadows and haystacks, the pond rims and water, the watermill race, and the fountain plaza, spire, bowls and water drops | written in `themes/village.js` | own work |

## Processing
- Blender 5 (`-b --python`): each source file was imported, its meshes joined into one top-level node named after the file (with `-` turned into `_`), then exported as one GLB.
- glTF-Transform 4.5: `dedup` + `meshopt`, 3.0 MB → 857 KB. The two tiny gradient atlases (KayKit 1024² and Kenney 512²) were kept as PNG, because lossy WebP would bleed the colour swatches.
- The colours are the packs' own atlases. Nothing was recoloured.

## Not used
- The Quaternius Medieval Village MegaKit is modular (walls and roofs you assemble), and its free tier sits behind the itch download flow. The KayKit pack ships whole buildings and is CC0 on GitHub, so it was used instead.
- No villagers: people were out of scope.
