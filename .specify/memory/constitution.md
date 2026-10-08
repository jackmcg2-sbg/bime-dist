<!--
Sync Impact Report
Version change: template -> 1.0.0 (initial ratification)
Source: governance ported and generalised from the varkin repository's
constitution (Principles VI, VI-A, VI-B, XI, XIII-C/D, XV and Governance);
project principles I, III and IV drafted from this repository's README,
CHANGELOG and tools/. The maintainer should confirm I, III and IV via
/speckit-constitution before relying on them.
Templates updated:
- ✅ .specify/templates/spec-template.md (Exploration field, Principle VI)
- ✅ .specify/templates/plan-template.md (Constitution Check, Architecture Impact)
- ✅ .specify/templates/tasks-template.md (approved delta prerequisite, tests, closeout)
- ✅ .specify/templates/exploration-template.md (added)
- ✅ .specify/extensions/human-loop/workflow.md (gates reference this file)
Follow-up TODOs:
- Confirm project principles I, III, IV with the maintainer
-->

# BIME Constitution

## Core Principles

### I. Zero Dependencies, Pure JavaScript

BIME is a browser-based molecule editor and headless Node CLI written in plain
JavaScript with zero runtime dependencies. A feature MUST NOT add an npm
dependency, a network fetch at runtime, a build-time toolchain beyond Node, or a
framework. Embedding MUST continue to work as a script tag, a container and an
init call — no build step, no server.

Any proposal to relax this is a constitutional amendment, not a plan decision.

Rationale: zero dependencies is the product's core promise and what makes the
signed bundle auditable.

### II. Strict Spec-Driven Development Gate

Implementation work MUST NOT begin from an ordinary natural-language request.
All code development — source, tests, build and release scripts, temporary or
inline scripts, and delegated work — MUST follow the Spec Kit workflow unless the
user gives an explicit `SPECKIT OVERRIDE`. Calling work a one-off, a small fix, or
research does not exempt it.

Reading files, editing prose documentation, updating Spec Kit artifacts, and
running existing tools without developing code are not code development.

Ordinary requests such as "fix this", "implement this", "apply the above" or
"try again" MUST NOT by themselves authorise implementation edits. They are
requests to enter or continue the Spec Kit workflow.

The required phase order for every implementation change is:

```text
constitution
specify
clarify, if requirements are ambiguous
plan
architecture review (Principle V)
tasks
analyze
implement
```

Implementation files may be modified only when the user explicitly invokes the
implementation phase (`/speckit-implement`, or the direct instruction `Run the
Spec Kit implementation phase for the active feature`) after the active feature
has a current `spec.md`, `plan.md`, `tasks.md` and no unresolved blockers.
Planning-only prompts MUST stop before code edits. Brownfield and bug-fix work is
not exempt. If the user asks for direct code changes before prerequisites exist,
the agent MUST refuse briefly and name the next required Spec Kit command.

`SPECKIT OVERRIDE` is the single override mechanism. Only the user's use of that
exact token authorises it; an agent MUST NOT infer it from urgency or a broad
request to proceed. The override covers only the work the user identifies; the
agent MUST state its scope, the gates bypassed, and the verification performed.

These rules are agent-neutral: they bind every agent and model equally.

Rationale: an unreviewed edit can silently change chemistry behaviour (parsing,
aromaticity, mapping, layout) that users rely on. The gate makes every change
traceable to a requirement, plan, task and receipt.

#### II-A. Human-Loop Gates Are Binding Where The Extension Is Installed

Where `.specify/extensions/human-loop/workflow.md` is present, its Gates E, 1,
2A, 2 and 3 are MANDATORY for every agent. A gate MUST NOT be skipped silently: a
deferred or unrun gate is recorded in the feature's `human-loop.md` with its
reason and surfaced at the next gate. An agent without an interactive
multiple-choice mechanism runs the gate as an explicit question and records the
answer.

Rationale: a control that depends on an agent's goodwill is not a control. The
gates are where a person, not a machine, decides scope, architecture and approval.

#### II-B. A Checklist Reaching A Gate Is Resolved Or Explicitly Routed

Every item of every checklist under `specs/<feature>/checklists/` MUST, when
presented at a gate, be either **resolved** (ticked, with the closing artifact
identifiable — ticking asserts it was verified) or **explicitly routed** (left
open with its destination named: a later gate, a task ID, or a recorded human
decision to accept it open, with rationale). A checklist carrying unmarked items
has not passed, and a gate MUST NOT be recorded as passed on it. Accepting an item
open is a human decision; an agent MUST NOT close an item by declaring it
unimportant.

### III. Every Behaviour Change Is Tested Against Source And Bundle

Any behavioural change MUST add or update a test under `tests/`, written before or
with the behaviour it verifies. The narrowest relevant test is run first; then
`node tools/run-tests.js` MUST pass. Any change that reaches `dist/` MUST also
pass the full release gate `node tools/release-check.js` (source, bundle,
minified-bundle, manifest, SRI, version and build-drift checks).

After implementation, the contributor MUST report files edited, checks run, what
passed, what failed, and what remains unverified. A test that was not run MUST
NOT be reported as passing.

### IV. Signed, Reproducible Releases

Files under `dist/` (`bime.js`, `bime.min.js`, `MANIFEST.sha256`, `SRI.txt`) are
generated artifacts. They MUST be produced only by `node tools/build.js` and the
release scripts (`tools/release-check.js`, `tools/sign-release.sh`), never edited
by hand. A release bumps the version consistently (`package.json`,
`versions.json`, bundle) and adds a CHANGELOG entry following Keep a Changelog and
Semantic Versioning. Source files carry the project's Apache-2.0 licence header.

Rationale: users pin the bundle by its SHA-384 SRI hash; a hand-edited or drifted
bundle breaks that trust.

### V. Architecture Delta Before Tasks

#### V-A. Every Feature Declares An Architecture Delta, Approved Before Tasks

Every feature MUST carry `specs/<feature>/architecture-delta.yaml` declaring the
modules and dependency edges it adds, modifies or removes, the public interfaces
(embed API, CLI, file formats) and persistent data structures it changes, and any
edge it declares forbidden. NO TASKS ARE GENERATED UNTIL THE DELTA IS APPROVED.
The review compares the delta against this constitution and any accepted ADRs
under `docs/decisions/`, and ends in exactly one verdict: `APPROVE`,
`APPROVE_WITH_ADR`, `REVISE_ARCHITECTURE` or `REJECT`. Only the first two permit
task generation; `APPROVE_WITH_ADR` requires the ADR before implementation.

An ADR is required when a feature introduces a new module family or layer,
changes a dependency direction, introduces a shared data representation or file
format, or deliberately accepts architectural debt. Routine features need none.

#### V-B. Observed Architecture Is Reconciled Against The Approved Delta

At closeout the observed change MUST be compared against the approved delta and
reported as: approved and implemented; approved but not implemented; implemented
but not approved; existing violations worsened. Implemented-but-not-approved
change is drift and MUST be reported, never silently accepted.

### VI. Problem-Space Exploration Before Specification

When the next feature is not yet decided, its deciding research MUST be recorded
in `specs/<YYYYMMDD-HHMMSS>-<slug>/exploration.md` from
`.specify/templates/exploration-template.md`, following that template's
append-only, multi-agent rules. On a human "go" decision the directory is renamed
to the next sequential `specs/<###-slug>/` and specify reuses it. Only the human
sets go / no-go / parked. Exploration is read-only with respect to source. Every
`spec.md` carries an **Exploration** field naming its exploration, or "none —
direct request" with the reason.

### VII. Agent Working Discipline And Result Reporting

- **Read the path before describing it.** Before a value or behaviour is
  described, attributed or built upon, the code path that produces it MUST be
  read, guard clauses first. A name is not a contract.
- **Scope every claim.** A claim names what it was measured on (which molecules,
  test file, bundle vs source) in the same sentence.
- **A guard is tested against the failure it guards**, not only against success.
- **A prior decision is not reversed as a side effect.** Before widening a
  repository-wide rule (ignore pattern, default, naming convention), search for
  the rule being contradicted and raise the conflict rather than executing it.
- **Overriding a control is never silent**: record the grounds.

## Development Workflow And Quality Gates

Before implementation, the plan MUST pass its Constitution Check. Any violation
MUST be listed in Complexity Tracking with a reason and a rejected simpler
alternative. Tasks MUST be ordered so tests come before or with the behaviour they
verify, and each user story MUST be independently testable.

Code review MUST confirm public interfaces (embed API, CLI flags and output, file
formats) remain compatible or the break is explicitly approved, and that no
dependency was added.

### Implementation Receipt Ledger

Every Spec Kit implementation run MUST write a receipt at:

`<FEATURE_DIR>/agent-runs/<UTC-timestamp>-<short-run-name>/implementation-receipt.md`

Implementation is not complete until it exists. It records only: Prompt, Final
response, Diff summary, Tests, Unresolved issues (plus an optional brief Other
information). `Final response` MUST be the actual final user-facing completion
text, not a paraphrase. Receipts MUST NOT contain interim progress chatter, raw
transcripts, credentials, personal data or large logs; any redaction is marked.

## Governance

This constitution supersedes conflicting local habits, templates and ad hoc
preferences. The Strict Spec-Driven Development Gate has precedence over
convenience, speed and agent initiative. Amendments require an update to this file
through `/speckit-constitution`, a Sync Impact Report, and review of dependent
templates and agent instructions. Versioning follows semantic versioning (MAJOR:
incompatible governance change or principle removal; MINOR: new principle or
materially expanded requirement; PATCH: clarification).

### Commits Carry In-Flight Manual Work

A commit MUST NOT strand the maintainer's manual edits. Tracked modifications in
the working tree are committed alongside the agent's work, and the message MUST
distinguish the two, listing the manual paths with a one-line description and
their verification status. Untracked files are never swept in wholesale: each is
named deliberately. Never stage gitignored artifacts, credentials or secrets. A
change that looks like a partial refactor or debugging scaffold is surfaced and
asked about, not committed unexamined. Spec Kit git auto-commit hooks stay
disabled in `.specify/extensions/git/git-config.yml` because a bare `git add .`
cannot meet this rule.

### Agent Instruction Files Delegate To Spec Kit

Control over agent behaviour resides in Spec Kit — this constitution, the
installed skills and templates — not in per-agent instruction files. `CLAUDE.md`,
`AGENTS.md` and per-agent skill files under `.claude/skills/` are thin pointers:
they MAY contain only a delegation statement and stable pointers to Spec Kit
workflows and skills. They MUST NOT define behavioural rules, gates, or
feature-specific context. Behaviour changes through `/speckit-constitution` or by
editing a skill, never by growing an agent file.

### Project Knowledge Lives In The Repository

Rules, workflow, environment facts and hard-won findings MUST be recorded in this
repository, not in an agent-private memory store: a rule about how work is done →
this constitution; operational how-to → a skill under `.specify/skills/`; an
observed fact about the code or toolchain → `docs/`; a feature's state or pending
decision → `specs/<feature>/human-loop.md`. A lesson left only in one feature's
directory binds that feature alone; if it generalises, it MUST be promoted.
Feature closeout asks explicitly whether anything learned needs promoting.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30
