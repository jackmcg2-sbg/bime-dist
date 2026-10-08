---
name: "speckit-human-loop"
description: "Orchestrate GitHub Spec Kit's core commands as bundled, human-gated phases: requirements preparation, implementation preparation, an architecture gate, an explicit approval gate before any source-code change, scoped implementation, then verification and closeout. This workflow embeds and invokes the installed core Spec Kit skills (constitution, specify, clarify, checklist, plan, tasks, analyze, implement) rather than replacing them."
argument-hint: "<explore <question> | feature request | continue | prepare | implement approved | closeout> [--scope all|slice:<phase>|tests-only]"
compatibility: "Requires a Spec Kit project initialized with .specify/ and the core speckit skills installed for the active agent. Honors the project constitution at .specify/memory/constitution.md, including its implementation gate and implementation-receipt ledger."
metadata:
  author: "local"
  source: "custom:speckit-human-loop"
---

<!--
AUTHORITATIVE, AGENT-NEUTRAL DEFINITION.

This file is the single definition of the human-loop workflow. Per-agent skill
files (.claude/skills/speckit-human-loop/SKILL.md and the equivalent for any future
agent) are THIN POINTERS to this file and MUST NOT restate or extend it.
Constitution: "Agent Instruction Files Delegate To Spec Kit" (Governance).

Agent-native affordances named below (AskUserQuestion, the task list, MCP
servers, subagents) are Claude's names for generic capabilities. Under another
agent, substitute that agent's equivalent for each: an interactive multiple-choice
prompt for a gate, its progress/task mechanism, its tool integrations, and its
delegated-review mechanism. Where no equivalent exists, run the gate as an
explicit question to the human and record the answer in human-loop.md — the gate
itself is never optional.
-->


## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

# Spec Kit Human Loop (Claude-tailored)

Run the ordinary GitHub Spec Kit workflow as a small number of human-gated
bundles, so the user does not chain eight commands by hand. This skill is an
**orchestrator**: it must not replace, summarize away, or silently skip the core
Spec Kit commands. At each phase it invokes the installed core skill and follows
its instructions.

This version is adapted for Claude/Cowork and for projects whose constitution
already enforces a strict implementation gate and an implementation-receipt
ledger. Where this skill and the project constitution overlap, **the
constitution wins** and this skill defers to it (see "Constitution reconciliation").

## Non-negotiable rules

1. **No source edits before approval.** Do not modify source code, tests, build
   files, or other implementation artifacts before the human explicitly approves
   implementation at Gate 2 **and** the approval is expressed as a real
   implementation invocation (see Constitution reconciliation). Spec Kit
   artifacts under `specs/<feature>/` and the orchestration state file are not
   "source code" and may be written during preparation.
2. **Embed, never emulate, core commands.** Each bundle invokes the corresponding
   installed core skill via the Skill tool (e.g. `speckit-specify`). Do not
   hand-write `spec.md`, `plan.md`, or `tasks.md` unless the core skill is
   unavailable and the user explicitly asks for a temporary fallback.
3. **Sparse gates only.** Stop for a human decision only at the three gates, or on
   a real blocker (ambiguity, failed quality gate, excessive scope, an attempted
   source edit). Do not ask between routine phases.
4. **Record every human decision** in the orchestration state file.
5. **`spec.md` is the authority for requirements.** When it changes, re-derive the
   downstream artifacts (`plan.md`, `tasks.md`, analysis) rather than editing them
   in isolation.
6. **Stop and report** if the repository is not a Spec Kit project, a required core
   command is missing, the active feature cannot be determined, or the approved
   scope cannot be enforced. Do not invent replacements for missing core commands.

## Constitution reconciliation (read first)

Before Bundle 0, read `.specify/memory/constitution.md` if present and obey it.
This skill is explicitly subordinate to it. In particular:

- **Implementation gate.** If the constitution restricts implementation to an
  explicit invocation (for example, only `/speckit-implement`, `$speckit-implement`,
  or a stated exact phrase authorizes edits), then **a Gate 2 menu choice is not
  sufficient by itself**. Gate 2 records the human's intent and approved scope;
  the skill then proceeds to implementation **only via the constitution's required
  invocation**. If the user picked "approve" in the gate but the constitution
  needs an explicit implement invocation, ask the user to confirm with that exact
  invocation before any edit.
- **Run record / receipt.** If the constitution mandates an implementation-receipt
  ledger at a specific path (for example
  `<FEATURE_DIR>/agent-runs/<UTC-timestamp>-<short-name>/implementation-receipt.md`),
  that receipt is the **canonical** record of an implementation run. Do not invent
  a competing record. This skill's `human-loop.md` is a lightweight orchestration
  index only, and must cross-reference (not duplicate) the constitutional receipt.
  Follow the receipt's required sections and concision rules exactly.
- **Project standards.** Surface the constitution's project principles as
  checks in the implementation and verification bundles — for BIME: zero
  dependencies (I), tests against source and bundle (III), `dist/` produced only
  by the build and release scripts (IV).
- **Run-directory naming.** If the mandated receipt directory name does not match the
  active agent, **do not silently rename it** — the path is fixed by the
  constitution. Follow it; renaming is a `speckit-constitution` change, not an
  ad-hoc edit. The directory is the agent-neutral `agent-runs/`.

## Claude-native affordances (how to run each step)

- **Invoke core skills with the Skill tool**, not shell aliases. Use
  `speckit-constitution`, `speckit-specify`, `speckit-clarify`, `speckit-checklist`,
  `speckit-plan`, `speckit-tasks`, `speckit-analyze`, `speckit-implement`.
- **Track bundles and tasks with the task list.** At the start of a run, create a
  task per bundle with `TaskCreate`; mark each `in_progress`/`completed` with
  `TaskUpdate`. During implementation, mirror `tasks.md` entries as tasks so the
  user sees live progress.
- **Run human gates with `AskUserQuestion`,** not a plain-text lettered menu.
  Present the gate's options as structured choices (the tool always adds an
  "Other" escape). Record the selected option verbatim in `human-loop.md`.
- **Verify with the project's own test harness**: the narrowest relevant
  `node tests/<file>.js` first, then `node tools/run-tests.js`; add
  `node tools/release-check.js` whenever `dist/` is affected. Redirect long
  output to a log file and grep it rather than flooding the context. For UI
  changes, check the page in the browser (e.g. `workbench.html`).
- **Use a subagent for independent review** (Gate 2 option "independent review")
  via the Task tool, so the review does not share the implementing context.
- **Surface review artifacts** to the user by linking the files
  (`implementation-review.md`, comparison reports, diffs).

## Hook awareness

If `.specify/extensions.yml` exists with `auto_execute_hooks: true`, each embedded
core command may trigger `before_*`/`after_*` hooks (for example git auto-commit
and agent-context refresh). Because a bundle runs several phases in sequence, this
can produce several commit prompts. At the start of a bundle, tell the user that
per-phase hooks will fire, and offer to (a) let each hook prompt as configured, or
(b) defer commits and make one commit at the end of the bundle. Never disable
hooks silently.

## Orchestration state file

Maintain `specs/<feature>/human-loop.md` once the feature directory exists (create
it immediately after `speckit-specify` creates the directory). Keep it lightweight;
it indexes the run and points at the constitutional receipt rather than copying it.

```markdown
# Human Loop State

## Current State
- Status:
- Active feature directory:
- Last completed bundle:
- Source code modified by this workflow: yes/no

## Core Command Ledger
- constitution:   (checked | invoked | n/a)
- specify:
- clarify:
- checklist:
- plan:
- tasks:
- analyze:
- implement:

## Human Decisions
| Date (UTC) | Gate | Option chosen | Consequence |
|---|---|---|---|

## Approved Implementation Scope
- Approved: no
- Scope: (all | slice:<phase/task ids>)
- Tasks approved:
- Tasks deferred:
- Files allowed:
- Files not allowed:

## Pointers
- Exploration: specs/<feature>/exploration.md (+ exploration/ supporting material), or "none"
- Implementation receipt(s): <path(s) under the constitution's receipt ledger>
- Implementation review: specs/<feature>/implementation-review.md

## Open Risks and Ambiguities
```

## Bundle 0: project and phase detection

1. Confirm the current directory is inside a Git repository and `.specify/` exists.
   If not, stop and ask the user to run `specify init` or give the correct root.
2. Read `.specify/memory/constitution.md` and apply "Constitution reconciliation".
3. Check `git status`; warn if uncommitted source changes already exist.
4. Determine the active feature from the current branch and `specs/`.
5. Confirm the core skills are installed under `.claude/skills/speckit-*` (fall
   back to `.agents/skills/` or `.specify/templates/commands/` only if needed).
6. Decide the requested mode: `explore`, `start`, `prepare`, `implement`,
   `continue`, or `closeout`. If unclear, ask with `AskUserQuestion`:
   - Explore a candidate feature before specifying (Bundle E — problem-space
     research only, no spec yet).
   - Start a new human-gated workflow from this request.
   - Continue the active feature workflow.
   - Prepare the implementation review for the active feature.
   - Implement the approved task scope.
   - Verify and close out the active feature.

## Bundle E: problem-space exploration (pre-feature)

Runs BEFORE any feature directory exists. Purpose: record the rationale and
conceptualisation that decides whether a feature should be specified at all —
upstream of, and distinct from, `/speckit-plan`'s Phase 0 solution-space
`research.md`. Entered via `explore <question>`, or from Gate 3's "open an
exploration" option at close-out of the previous feature.

State-externalization rule (adapted from the community Research Harness /
Harness-1 design): the exploration file, not this conversation, is the working
memory. Any LLM — and several different LLMs concurrently — may contribute;
every finding is written to the file at the moment it is learned, so a session
is disposable and any agent can resume from the file alone.

1. **Locate or create the artifact.** An exploration is the FIRST artifact in
   a feature directory, created before any spec exists, instantiated from
   `.specify/templates/exploration-template.md`. At exploration start the
   directory is provisional: `specs/<YYYYMMDD-HHMMSS>-<slug>/exploration.md`
   with a full UTC timestamp — exactly that form, because
   `create-new-feature.sh` excludes `^[0-9]{8}-[0-9]{6}-` from its
   sequential-number scan (a bare date prefix would be parsed as a feature
   number and corrupt the sequence). The directory receives its mature
   `<###-slug>` name only at the "go" decision (Gate E). Never overwrite an
   existing exploration: scan `specs/*/exploration.md` for an open one
   matching the question first, and resume it (append a new mission `M#` if
   the question is genuinely new). Multi-file supporting material goes in an
   `exploration/` subdirectory beside it.
2. **Obey the template's multi-agent rules**: append-only ledgers (Evidence,
   Claims & verdicts, Observations, Dead ends) with agent identity + UTC on
   every entry; unique sequential IDs (re-read the file on collision); dedup
   against the Observations log before searching; refuted entries are marked,
   never deleted.
3. **Explore loop** (decide -> act -> bookkeep): each iteration choose one of
   SEARCH (repo; prior `specs/*/exploration.md` and `specs/*/exploration/`
   material; `tests/` and `tools/` output; CHANGELOG; issues; external
   literature),
   INSPECT (a known candidate source), CURATE (promote a finding into the
   Evidence ledger with an importance tag and source pointer), or STOP. After
   every action append one Observations row (<=3 lines).
4. **Verify before believing.** Load-bearing claims get an adversarial check
   against the primary source (run the narrowest existing test or CLI check
   where relevant — read-only) and a verdict row: verified / refuted / unverifiable,
   with confidence. Refuted directions go to Dead ends.
5. **Stop rule**: mission answered, or 3 consecutive actions yielding no new
   live evidence, or human interrupt.
6. **Regenerate Synthesis** at every session end (and before Gate E): rewrite
   the Synthesis section whole — identity, UTC, highest entry ID incorporated,
   contradictions carried forward — so the evolving summary of the exploration
   is itself the artifact, whichever agent wrote last.
7. **No source edits, ever, in this bundle.** Exploration is read-only research;
   Principle II is untouched because nothing but Spec Kit artifacts (the
   exploration file and its `exploration/` supporting material) is written.

Then **Gate E**.

### Gate E — exploration decision (`AskUserQuestion`)

Options:
- Go: mature the directory name, then seed specify (proceed to Bundle 1).
  Allocate the next sequential feature number (max over `specs/` dirs and
  feature branches, + 1), `git mv specs/<timestamp>-<slug>
  specs/<###-slug>`, then invoke `create-new-feature.sh` with
  `--number <###> --short-name <slug> --allow-existing-branch` so `spec.md`
  lands beside `exploration.md`; seed `speckit-specify` from the Decision
  section's distilled request and fill the spec's **Exploration** field.
- Continue exploring (name the open mission or add a new one).
- Park: record Status `parked` with rationale; resumable later.
- No-go: record Status `no-go` with rationale; the timestamped directory
  remains, holding the exploration, as the recorded dead end (no feature
  number is consumed).

The Decision section is human-only: the agent drafts nothing there beyond the
proposed specify seed; the human signs the outcome. Record the choice in the
exploration file (there is no `human-loop.md` yet — it begins at specify).

## Bundle 1: requirements preparation

Embedded core skills, in order:

1. `speckit-constitution` — **check, do not regenerate**. If the constitution is
   missing, stop and ask for governing principles (or invoke it if the user
   supplied enough detail). If present, read it and record `constitution: checked`.
   Only invoke it to create/revise principles when the user explicitly asks.
2. `speckit-specify` with the feature request.
3. `speckit-clarify`. If it raises blocking questions, stop at Gate 1.
4. `speckit-checklist`. If failures are blocking, stop at Gate 1.

Ensure `human-loop.md` exists and records completed commands. Then **Gate 1**.

### Gate 1 — requirements decision (`AskUserQuestion`)

Options:
- Continue to implementation-preparation bundle.
- Revise the specification, then re-run clarify and checklist.
- Answer remaining clarification questions.
- Split this into smaller features.

No source code has been modified. Record the choice.

## Bundle 2: implementation preparation

Bundle 2 is split by an architecture gate. Steps 1-2 run, the workflow **stops at
Gate 2A**, and steps 3-5 run only on an approving verdict.

1. `speckit-plan` (use the user's technical constraints; ask only for missing
   required constraints). Every Constitution Check bullet in the plan MUST be
   answered here, not deferred.
2. Write `specs/<feature>/architecture-delta.yaml` and the plan's **Architecture
   Impact** section (Principle V-A). Declare added / modified / removed
   modules, every new and removed dependency edge with its reason, changed
   public interfaces (embed API, CLI, file formats) and persistent data
   structures, and any edge the feature declares forbidden. Check conformance
   against the constitution, the existing module structure (`editor/`, `tools/`,
   `js/`, `bin/`) and any accepted ADRs under `docs/decisions/`, and report: components affected, responsibilities
   added or moved, new dependency edges, any cycle or boundary violation,
   whether the same behaviour is achievable with less coupling, and the smallest
   conforming alternative. No source edits.

Show the delta to the user, then **always** stop at Gate 2A.

### Gate 2A — architecture delta review (`AskUserQuestion`)

Exactly the four verdicts the constitution defines (Principle V-A):

- `APPROVE` — the delta conforms; continue to task generation.
- `APPROVE_WITH_ADR` — conforms, but records a durable decision: write the ADR
  under `docs/decisions/` first, then continue.
- `REVISE_ARCHITECTURE` — the requirements stand and the delta must change. Name
  the binding constraint (for example: extend the existing parser module rather
  than adding a parallel one). Re-run step 2; the specification is untouched.
- `REJECT` — do not proceed on this architecture.

Only `APPROVE` and `APPROVE_WITH_ADR` permit `speckit-tasks` to run — a task
list generated without an approving verdict is not a valid implementation
prerequisite (Principle II phase order, Principle V-A). Record the verdict,
its rationale, and the UTC date in both `human-loop.md` and the plan's
Architecture Impact section.

On an approving verdict, continue:

3. `speckit-tasks`.
4. `speckit-analyze` — classify findings as blocking / should-fix / acceptable /
   deferred.
5. Write `specs/<feature>/implementation-review.md` (no source edits):

```markdown
# Implementation Review

## Summary
## Embedded Core Commands Completed
- constitution / specify / clarify / checklist / plan / architecture review / tasks / analyze:
## Architecture Verdict (Gate 2A)
- Verdict (APPROVE | APPROVE_WITH_ADR | REVISE_ARCHITECTURE | REJECT):
- ADR required / written:
- Date (UTC):
## Cross-Artifact Analysis Summary
## Proposed Implementation Scope
- Tasks proposed:
- First independently testable slice:
- Files likely to change:
- Files that should NOT change:
## Tests and Validation Expected (name the narrowest relevant test first)
## Blocking Issues
## Acceptable Risks
## Human Approval
- Approved: no
- Approved option:
- Approved tasks/scope:
- Required implementation invocation per constitution:
- Date (UTC):
```

Show the review to the user, then **always** stop at Gate 2.

### Gate 2 — implementation approval (`AskUserQuestion`)

Options (four; "revise the plan" is routed through Gate 2A's
`REVISE_ARCHITECTURE` verdict instead):
- Approve implementation of all proposed tasks.
- Approve only the first independently testable slice (name it, e.g. a single plan phase).
- Revise the task list, then re-run analyze.
- Run an independent review (subagent) before deciding.

Only "approve all" or "approve a slice" can authorize edits — **and only then via
the constitution's required implementation invocation** (see reconciliation).
Record the approved scope in both `human-loop.md` and `implementation-review.md`.

## Bundle 3: approved implementation

Preconditions: `implementation-review.md` exists; `human-loop.md` records explicit
approval; the approved scope is "all" or a named slice; and the user has supplied
the constitution's required implementation invocation if one is mandated.

1. Mirror the approved `tasks.md` entries into the task list.
2. Invoke `speckit-implement`, constrained to the approved scope. Do not edit
   source directly and do not bypass `speckit-implement`.
3. Follow task order/dependencies from `tasks.md`. Stay inside the approved files;
   if a change outside scope is genuinely required to keep tests meaningful, record
   it as a deviation rather than silently expanding scope.
4. Apply the constitution's project principles as you go (no new dependencies,
   licence headers, never hand-edit `dist/`).
5. Run the narrowest relevant test (`node tests/<file>.js`), then
   `node tools/run-tests.js`, after the change.
6. Write the constitutional **implementation receipt** at its mandated path with the
   required sections (Prompt, Final response, Diff summary, Tests, Unresolved
   issues). The `Final response` must be the actual final user-facing completion
   text, not a paraphrase. Point `human-loop.md` at the receipt.

## Bundle 4: verification and closeout

1. Inspect `git diff --stat` and `git diff`.
2. Compare the work against `tasks.md` and `implementation-review.md`.
3. **Architecture reconciliation** (Principle V-B). Re-run the conformance
   check and compare the OBSERVED architecture change against the delta approved
   at Gate 2A, reporting four categories explicitly:
   - approved and implemented;
   - approved but not implemented;
   - implemented but not approved;
   - existing violations worsened.
   Any implemented-but-not-approved component or dependency edge is drift and
   MUST be reported, never silently accepted. Record the result in
   `human-loop.md`.
4. Run or report tests (narrowest relevant first, then `node tools/run-tests.js`;
   `node tools/release-check.js` if `dist/` changed). Report exact pass/fail
   counts; never report an unrun test as passing.
5. Optionally re-run `speckit-analyze` post-implementation (does not replace the
   pre-implementation analyze).
6. Update `human-loop.md`: diff summary, tests, unresolved issues, deviations,
   next recommended choice. Confirm the constitutional receipt is complete.
7. **Knowledge promotion** (Governance, "Project Knowledge Lives In The
   Repository"). Ask explicitly whether anything learned in this feature
   generalises beyond it, and route each item to its durable home: a rule about
   how work is conducted → the constitution via `/speckit-constitution`;
   operational how-to → a skill under `.specify/skills/`; an observed fact about
   the code, toolchain, or environment → `docs/`; a known unfixed defect → a
   GitHub issue or `docs/known-defects.md`. A lesson left only in this feature's directory binds
   this feature and nothing else — no later feature is required to read it — so
   "recorded in `lessons.md`" does NOT discharge the obligation for anything
   general. Record the promotion decision per item in `human-loop.md`, including
   a deliberate decision that an item is feature-specific and needs no promotion.
   Nothing learned may be left in an agent-private memory store.
8. **Gate 3** with `AskUserQuestion`.

### Gate 3 — closeout decision

Options:
- Accept and close the feature.
- Continue with the next approved slice.
- Fix failing tests.
- Reconcile implementation drift by updating spec/plan/tasks.
- Revert selected changes.
- Open an exploration for the next candidate feature (Bundle E): begin
  `specs/<YYYYMMDD-HHMMSS>-<slug>/exploration.md` from the template (mature
  `<###-slug>` name assigned only at a later "go" decision), recording the
  rationale before any decision to specify. **Suggest
  this proactively at close-out** when the finished feature surfaced follow-up
  questions (deferred gaps, unexplained traces, "future work" notes). If the
  evidence for the next feature is already decisive, a direct follow-up
  specification remains acceptable — note in its spec's **Exploration** field
  why no exploration was needed.

## Gate discipline

**Binding under Principle II-A.** Where this extension is installed, Gates E, 1,
2A, 2 and 3 are MANDATORY for every agent. A gate MUST NOT be skipped silently: a
deferred or unrun gate is recorded in the feature's `human-loop.md` with its
reason and surfaced at the next gate. An agent with no interactive
multiple-choice mechanism runs the gate as an explicit question to the human and
records the answer — substituting the agent's own equivalent is expected,
omitting the gate is not.

- Use `AskUserQuestion` with at most four primary options (the tool adds "Other").
- State the safe default when there is one.
- Record the exact option chosen and its consequence in `human-loop.md`.
- Continue automatically only after a choice that permits continuation.

**Checklists at a gate — binding under Principle II-B.** Before recording any gate
as passed, every item of every checklist under `specs/<feature>/checklists/` MUST
be either resolved (ticked, with the closing artifact identifiable — ticking
asserts verification) or explicitly routed (left open with its destination named:
a later gate, a task ID, or a recorded human decision to accept it open with
rationale). An unmarked item is neither, and a checklist carrying unmarked items
has not passed. Record the routing per item in `human-loop.md` with the item
identifier, its question, and its destination. Do not tick items to clear a gate,
and do not assume unmarked items were considered — a zeroed checklist is as
likely to be unexamined as it is to be stale bookkeeping, and the two are
distinguished only by checking.

## Stop conditions

Stop rather than auto-continuing if: a core skill is missing; the active feature
is undeterminable; the constitution is missing and the user has not supplied
principles; clarify/checklist/analyze report blocking issues; source code would be
modified before Gate 2 approval (or before the constitution's required implement
invocation); the approved scope cannot be enforced; or tests fail when the mode
was not test repair.

## Concise progress report (after each bundle)

```text
Completed:
- Core skills run:
- Files created/updated:
- Source code modified: yes/no
- Receipt path (if implemented):
- Next human gate:
```
