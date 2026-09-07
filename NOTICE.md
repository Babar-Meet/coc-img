# NOTICE — coc-img provenance and contents

Date: 2026-09-07. Sole curator: Babar Meet.

This file records where every image in `Babar-Meet/coc-img` came from and what was
changed. Ultimate art rights holder is Supercell; data/PNG intermediate is the MIT
package `chiefpansancolt/clash-of-clans-data`
(`https://github.com/chiefpansancolt/clash-of-clans-data`, sourced from the upstream package's stated sources (see its README)). No LICENSE file is
created here by design: this repo cannot license Supercell artwork; the upstream MIT
credit (Copyright (c) 2026 Christopher Pezza,
`https://raw.githubusercontent.com/chiefpansancolt/clash-of-clans-data/main/LICENSE`)
is kept in `README.md`.

Transform for every row below (unless noted as scaffold/logo): `png -> webp` conversion
plus quality/compression change ONLY — no crop, no resize, no recolor, no remix
(`RIFF WEBP` magic; e.g. `709KB -> 63KB`). Slugs are identical to upstream
(`baby-dragon`, `x-bow`, `wall-wrecker`); layout is flattened to
`{kebab-slug}_level_{N}[_variant].webp` (plus `_icon` files) derived from upstream
`images/home/.../level-N.png`.

## Per-folder provenance table

| Folder | Count (webp) | Upstream analogue | Transform |
|---|---|---|---|
| `army/` | 813 | `images/home/army/<slug>/.../level-N.png` | png -> webp + quality change only |
| `defenses/` | 572 | `images/home/defenses/<slug>/.../level-N.png` | png -> webp + quality change only |
| `other/` | 161 | `images/home/other/.../level-N.png` + misc singletons | png -> webp + quality change only |
| `traps/` | 126 | `images/home/traps/<slug>/.../level-N.png` | png -> webp + quality change only |
| `resources/` | 111 | `images/home/resources/<slug>/.../level-N.png` | png -> webp + quality change only |
| `walls/` | 19 | `images/home/walls/.../level-N.png` | png -> webp + quality change only |
| `spells/` | 18 | `images/home/spells/<slug>/.../level-N.png` | png -> webp + quality change only |
| `All_TH_images/` | 18 | Town Hall images `images/home/.../town-hall.../level-N.png` (TH1–TH18 set) | png -> webp + quality change only |
| `currency_resources/` | 8 | Currency/resource icons (`Gold`, `Elixir`, `Dark_Elixir`, `Gem`, `Raid_Medal`, `Shiny_Ore`, `Glowy_Ore`, `Starry_Ore`) from upstream resources/currency art | png -> webp + quality change only |

Example mapping: `defenses/cannon_level_1.webp` <- `images/home/defenses/cannon/normal/level-1.png`.

## Stray root files

4 singleton `.webp` files live at the repo root (not per-level sets, kept for
backward-compatible URLs — do not move into folders without the safe-rename
dual-host process in `README.md`):

- `Builders_Hut8.webp`
- `Dark_Barracks13.webp`
- `Dark_Spell_Factory8.webp`
- `ruin_witch.webp`

Plus `push.bat` helper script at root (not artwork).

## Scaffold / non-per-level folders

These hold UI/logo scaffolds and placeholders, not the per-level artwork sets above.
They are part of the working tree and must not be mistaken for missing per-level data:

- `army_img/` — army UI image scaffold
- `army_main_screen/` — army screen logos (`HomeVillage_army_logo.webp`, `Capital_Hall_army_logo.webp`, `Builder_Hall_army_logo.webp`)
- `Bases_img/` — bases UI image scaffold
- `Bases_main_screen/` — bases screen logos (`HomeVillage_logo.webp`, `Capital_Hall_logo.webp`, `Builder_Hall_logo.webp`)
- `Bases_creator/` — bases creator scaffold
- `.gitkeep` placeholders keep empty scaffold dirs tracked

Scaffold/logo files are original `.webp` exports for app UI use (not flattened
upstream conversions); they carry no upstream `level-N.png` analogue.

## Totals

- Total: 1859 `.webp` files across the repo (1846 in the 9 per-level folders above +
  4 stray-root + 9 scaffold/logo webp), 2071 files total, ~204MB working tree.
- Filenames frozen: the Dr.Clash app builds raw URLs against
  `https://raw.githubusercontent.com/Babar-Meet/coc-img/main/` — never rename/move/
  delete any `.webp`/`.png`/`.gitkeep`/`push.bat` without the safe-rename rule
  (`README.md`: same-release app map update + dual-host old+new >= 1 release).
