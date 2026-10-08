# Data Model: Reaction-Map SVG Label Legibility

All entities are transient render-time values inside one `_buildSVGImpl` call on
the reaction-map path. Nothing persists, and no file format changes.

## TextItem
| Field | Type | Notes |
|---|---|---|
| atomId | int | owning atom |
| kind | `symbol` \| `hlabel` \| `charge` \| `isotope` \| `map` | FR-001 enumeration |
| text | string | |
| x, y | number | anchor (SVG px) as drawn |
| box | {x, y, w, h} | width from `measureText` (D6); h = font size |
| colour | `#rrggbb` | original CPK / map colour |
| fill | `#rrggbb` | effective fill, lowest contrast (D3) |
| contrast | number | WCAG ratio of colour vs fill |
| drawColour | `#rrggbb` | colour after the remedy (= colour if it passes) |
| patch | null \| {x, y, w, h} | set only when recolouring fails (D4) |

Validation: `contrast(drawColour, fill) ≥ minContrast`, or `patch ≠ null`.
`hue(drawColour) = hue(colour)` and `sat(drawColour) = sat(colour)`, up to rounding
to an integer RGB value.

## Obstacle
| Field | Type | Notes |
|---|---|---|
| kind | `text` \| `bond` \| `halo` \| `rcring` | weight class (D5) |
| ownerAtomId | int \| null | own-atom halos are not obstacles to that atom's map number |
| geom | box \| segment {x1, y1, x2, y2, halfWidth} \| disc {cx, cy, r} | |

## PlacementCandidate
| Field | Type | Notes |
|---|---|---|
| ring | 0..5 | offsets d0, 1.4·d0 and 1.8·d0 at 100%, then 90% and 75% font |
| dirIndex | 0..7 | in preference order (D5) |
| box | {x, y, w, h} | |
| score | number | weighted overlap, where a hard overlap ≥ 1000 |

State: candidates are evaluated in order. The first with score < 1000 (no hard
overlap) whose score is minimal within its ring is chosen. Otherwise the global
minimum is taken, flagged `forced` (it counts against SC-002, FR-010). A placed map
number becomes a `text` Obstacle for the atoms that follow.

## Molecule (existing), with a new operation
`removeExplicitHydrogens() → int`: mutates the molecule. Invariants are in
[contracts/api.md](contracts/api.md).
