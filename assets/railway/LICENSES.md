# Railway valley theme (`themes.html?theme=railway`): asset licences (checked 2026-09-24)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `railway.glb` | Kenney **Train Kit 1.1**: steam locomotives a/b/c, passenger coaches (`locomotive-passenger-a/b`), coal, wood and lumber wagons (8 models) | https://kenney.nl/assets/train-kit | CC0: the page says "CC0 licensed!" / "Creative Commons CC0"; `License.txt` in the zip says "License: (Creative Commons Zero, CC0)" (copied here as `Kenney-TrainKit-License.txt`) |
| `album.jpg` | album card art | a screenshot of this theme at 40/40 (`bash album-thumbs.sh railway`) | original work |

Processing: no Blender needed (source is GLB). The 8 GLBs were merged with glTF-Transform 4.5 (`mergeDocuments`, one top-level node per model named after its file without `train-`), then `unpartition + dedup + prune + weld + meshopt`: 146 KB. The shared 64 px colormap stays PNG.

Reused shared assets (already in `assets/LICENSES.md`, not copied): MegaKit (kit `a`) oaks, pines, bushes, grass and flowers; the farm kit (Quaternius Farm Buildings + Ultimate Crops) water tower and apple trees `Apple_1/2/4` + `Apple_Crop`; the village kit (Kenney Fantasy Town / KayKit) cottages `building_home_A_red/_A_green/_B_yellow`, crates and sack; `assets/farm/Sheep.glb` and `assets/animals/Cow.glb` + `assets/thumbs/Cow.png` (residents).

Procedural (original, in `themes/railway.js`): the track (straight / curve / level crossing), the station, signal box, engine shed, goods shed, semaphore signals, lamp & bench, river / waterfall pool / stone bridge / lake, wheat fields (5 stages), hedgerow, the mountain tunnel with viaduct and waterfall, and the steam puffs.

Not used: the Kenney Train Kit's `railroad-*` and `track*` pieces (their curve radii don't match the 1-tile grid; the track is procedural in the same lavender-rail look), trams, diesel/electric sets. Quaternius Modular Train Pack was not needed (Kenney covers the trains; stations are procedural).
