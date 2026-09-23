# Mountain camp theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `camp.glb` | **Quaternius Survival Pack**, 10 of its 32 models: Tent, Bonfire, Wood Log, Axe, Backpack, Raft (packed, unused), Raft Paddle, Wooden Torch, Pot, Shovel | https://poly.pizza/bundle/Survival-Pack-XzvQPP0yWB (GLBs from each model page, e.g. https://poly.pizza/m/5Q7qIrfDxA Tent, https://poly.pizza/m/k1e0cOzi8A Bonfire) | CC0: the bundle page lists every one of the 32 models as "CC0 1.0", and each model page says "CC0 1.0". Quaternius' own licence page https://quaternius.com/license.html covers all packs (CC0). Poly Pizza downloads carry no License.txt, so none is copied here |
| `album.jpg` | A crop of this page's own render of the camp at 40/40 (`bash album-thumbs.sh camp`) | own render | CC0 (derivative) |
| (reused, not copied) | Pines (Pine_1/3/5), aspens (CommonTree_1/2), grass, flowers, rocks and pebbles = Quaternius Stylized Nature MegaKit (`assets/kit-a`); residents Stag / Deer / Fox / Wolf = Quaternius Ultimate Animated Animals (`assets/animals`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Log cabin, woodshed, ranger lookout tower, boathouse, orange A-frame tent, waterfall, creek, mountain spring, lake + canoe with paddler, bonfire stages, firewood stacks, berry + veg patches, trails, signposts, benches, lanterns, fishing dock, split-rail fence, summit cairn with prayer flags + butter lamps, the snowy peak backdrop, meadow tile texture, smoke, hawks | written in `themes/camp.js` | own work |

## Processing
- Blender 5 (`-b --python`): each Poly Pizza GLB imported, its meshes joined into one top-level node named after the model, exported as one GLB (366 KB). Colours are the pack's own material colours; nothing recoloured.
- glTF-Transform 4.5 `dedup` + `meshopt` → 120 KB. Total `assets/camp/` ≈ 0.18 MB.

## Not used
- KayKit Forest Nature (`assets/kit-b`): its trees rendered as flat green blobs next to the MegaKit pines, so every conifer here is from the MegaKit instead.
- No CC0 animated bear was found within the time budget (the Quaternius Ultimate Animated Animals set has none), so the fourth resident is the Wolf.
