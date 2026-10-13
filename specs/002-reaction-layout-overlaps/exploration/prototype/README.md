# Planning prototypes (not repository source)

Scratch scripts behind research.md R1–R5. They monkey-patch or post-process
BIME at run time and never edit `editor/` or `tools/`.

| File | research | What |
|---|---|---|
| `proto.js` | R3 | v1 greedy repair (reflect / stretch / rotate ±30°, ±60°), full re-scoring |
| `proto2.js` | R3 | v2: incremental scoring, rotations up to 180°, final LayoutQuality guard |
| `proto3.js` | R3 | v2 + escape (top-K sideways move + best follow-up); args `… repair R,S,T,W 80 8` |
| `parity-preload.js` | R1 | `node -r` preload that emulates module parity for `tools/run-tests.js` (needs `BIME_ROOT`) |
| `wedge_dump.js` | R5 | lays out chiral molecules with the parity set and writes MOL blocks with BIME's wedges |
| `pilot_render.js` | R3 | renders a pilot reaction figure with or without the v3 repair (`REPAIR=1`) |
| `summ2.py` | R3 | size-binned summary of a prototype run |
| `proto*.jsonl` | R3 | corpus results: v1 all moves, v1 reflect-only, v2 |
