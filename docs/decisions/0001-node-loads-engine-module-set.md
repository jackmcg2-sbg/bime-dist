# ADR-0001: One module list; Node loads the engine set

- **Status**: Accepted (Gate 2A of Feature 002, 2026-10-08, maintainer)
- **Feature**: [specs/002-reaction-layout-overlaps](../../specs/002-reaction-layout-overlaps/)
- **Constitution trigger**: Principle V-A, "introduces a shared data representation"

## Context

BIME runs in two environments. The browser loads the modules listed in
`tools/editor-files.js` (`FILES`, which the bundle and the HTML pages follow).
Node (the CLI, `tools/bime-cli.js`, and every test via `tests/shim.js`) loaded
its own hand-written list. The two lists drifted. Node never loaded
`Templates.js`, `SMSDLayout.js`, `SDGLayout.js` or `editor/sdg/*`, so the CLI
skipped whole layout steps: ring templates, crossing reduction, SDG rescue, and
E/Z correction. As a result it drew every cis double bond as trans, and the
tests checked a layout that no browser user ever saw (Feature 002 exploration,
E6 and E11).

## Decision

1. `tools/editor-files.js` is the **only** list of `editor/` modules.
2. It classifies every file as either an **engine** module or a **UI** module:
   - `UI_FILES` names the UI-only modules (DOM, canvas, editor interaction).
   - `ENGINE_FILES` is `FILES` minus `UI_FILES`, in bundle order.
3. Every Node consumer loads `ENGINE_FILES` through `tests/shim.js` `loadAll()`:
   the test suite, the CLI and maintainer tools. No Node consumer keeps its own
   module list.
4. A new `editor/` module is added to `FILES`. It is engine by default; if it is
   UI-only, it must also be added to `UI_FILES`. No other loader changes.
5. A statically pre-built binary must bundle at least `ENGINE_FILES`. The CLI
   warns on stderr when the layout globals are missing.

## Consequences

- Node and browser get the same layout, so CLI figures and test expectations
  match the browser.
- Engine modules must load under Node with the shim. Today all 49 bundle modules
  do. A future engine module that needs a DOM has to guard its DOM use, or be
  classified UI.
- Tests load about 25 ms more modules and run the same layout passes as the
  browser. Suite time is measured per feature, not assumed.
- `tests/shim.js` depends on `tools/editor-files.js`, a data-only module with no
  requires. Library code (`editor/*`) still never depends on `tools/` or `tests/`.

## Alternatives rejected

- **Separate hand-written lists for Node and browser.** This is how the drift
  happened.
- **Node loads every bundle file, UI included.** UI modules have no role in
  Node, and loading them relies on DOM stubs that nothing guarantees.
- **Parity in the CLI only.** Tests would keep exercising a layout users never get.
