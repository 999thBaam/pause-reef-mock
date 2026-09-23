# Pet park (`?theme=pets`): asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional; given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `pet-dog.glb`, `pet-cat.glb`, `pet-bunny.glb`, `pet-pig.glb`, `pet-chick.glb`, `pet-parrot.glb` | **Kenney Cube Pets 2.0** (6 of the pack's 24 animals), node-animated: static, idle, walk, run, eat, dance, gesture-positive/negative. Used for the residents, the ambient pets and the carousel riders. A `Hop` clip (walk legs + a bounce) is added at runtime | https://kenney.nl/assets/cube-pets (`kenney_cube-pets_1.0.zip`, GLB format + `Textures/colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-CubePets-License.txt` |
| (reused, not copied) | Round/parasol trees, pastel bushes, grass tufts = KayKit Forest Nature Pack (`assets/kit-b/kit-b.glb`), re-tinted at runtime with `assets/kit-b/forest_texture_tints.webp` (pink / lavender / gold / mint columns) | see the shared `assets/LICENSES.md` | CC0 |
| `album.jpg` | album card art | rendered by `bash album-thumbs.sh pets` | own render |
| (procedural) | Pet café, dog house, cat tower, bunny hutch, vet cottage, bird houses, sprinkler fountain, splash pool, splash pond, duck pond + rubber ducks, carrot patch / flower maze / agility course (5 growth stages), cream paths, food bowls, beach balls, toy pile, benches, swing, picket fences, rainbow carousel, kite, bubbles, ground tile texture | `themes/pets.js` | own work |

## Processing
- Cube Pets GLBs: glTF-Transform 4.5 `dedup` + `meshopt` (the external colormap is embedded as PNG) → 51–66 KB each, 342 KB total. Theme total ≈ 0.42 MB with album.jpg.

## Not used
- Kenney Cube Pets: the other 18 animals (zoo/wild ones: lion, tiger, giraffe, elephant, panda, koala, penguin, polar bear, monkey, fox, deer, cow, beaver, hog, crab, fish, bee, caterpillar). Only pet-like animals were packed.
- Kenney Mini Market / Furniture Kit / Nature Kit and KayKit Block Bits / Furniture Bits: checked (Kenney pages say CC0) but not downloaded. None of them has pet houses, and one procedural toy style for every prop read more consistent with the blocky Cube Pets inside the time box.
