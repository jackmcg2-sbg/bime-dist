---
description: "Evaluate whether implementation is finished; resume it if not, or hand to Gate 3 if it is"
---

# Continue Implementation While Approved Work Remains

Decide whether an authorised implementation run is finished, and act on the
answer. This command is invoked as an `after_implement` hook.

**The rule: continue until every approved task is done, unless Spec Kit decides
otherwise.** The exceptions are enumerated below and are the only ones — a
stop-and-report condition, an iteration that made no progress, or the iteration
cap. Absent one of those, unchecked tasks mean the work continues.

## Why this lives in Spec Kit

"Is the implementation finished?" is a question about `tasks.md`, the approved
scope in `human-loop.md`, and the feature's stop-and-report conditions. Spec Kit
owns all three. An agent harness owns none of them, and a harness-level rule that
inspects `tasks.md` duplicates Spec Kit's knowledge one layer up — which the
Governance clause "Agent Instruction Files Delegate To Spec Kit" prohibits for
exactly this reason.

The distinction that makes this necessary: an agent ending its turn is not the
same event as an implementation being complete. The two coincided only by
accident, and a control that depends on that accident is not a control
(Principle II-A's rationale). This command separates them, and puts the decision
where the evidence is.

## The predicate

Implementation is **finished** when all of the following hold:

1. Every task in the feature's `tasks.md` is marked `[X]`.
2. No stop-and-report condition recorded in `human-loop.md` has fired.
3. The tests the completed tasks introduced pass.

If all three hold, implementation is finished. Otherwise it is not, whatever the
agent's last message said.

## Procedure

1. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks
   --include-tasks` from the repository root to resolve `FEATURE_DIR`.

2. Count unchecked tasks — lines matching `^- \[ \]` in `FEATURE_DIR/tasks.md`.
   Count only real task lines; a task ID appearing inside another task's prose is
   not a task.

3. Read `FEATURE_DIR/human-loop.md`, section "Stop-and-report conditions inside
   the approved scope". Determine whether any has fired. **If one has, stop
   here** — record which, and surface it. A stop-and-report condition exists
   because a human must see it; continuing past one defeats its whole purpose.

4. Read the most recent implementation receipt under `FEATURE_DIR/agent-runs/`
   and compare its unchecked count with the current one.

   - **If the count did not decrease**, stop. The previous iteration made no
     progress, and another will not either. Record the stall in `human-loop.md`
     with the last task attempted and the reason it did not complete.
   - If `max_iterations` continuations have already run for this authorised run,
     stop and say so.

5. Act on the predicate:

   - **Not finished, and progress is being made** — resume by emitting
     `EXECUTE_COMMAND: speckit.implement` and continue with the next task in
     dependency order. Do not ask the human whether to continue: the run was
     already authorised at Gate 2 and by the explicit `/speckit-implement`
     invocation, and re-asking converts an approval already given into a prompt
     that must be answered again.
   - **Finished** — do not resume. Report completion and run **Gate 3**, the
     closeout decision, with the human. Gate 3 is where this stops.

6. Record the iteration in `FEATURE_DIR/human-loop.md`: the count before, the
   count after, and the decision taken. This is the audit trail for work done
   while no human was watching, and it is not optional.

## The in-flight marker

An authorised implementation run is marked in flight by the presence of
`.specify/.implement-in-flight`. Spec Kit owns this marker's whole lifecycle:

- **Created** by the `before_implement` hook, recording the feature directory and
  the UTC timestamp of the authorising invocation.
- **Removed** by this command whenever it decides implementation is over — the
  predicate is satisfied, a stop-and-report condition fired, an iteration made no
  progress, or `max_iterations` was reached. Every one of those is a decision to
  stop, and all of them clear the marker.

The marker exists so that a trigger outside Spec Kit can ask "is a run in
flight?" without knowing anything about tasks, scope or gates. It is a state
flag, not a policy: reading it tells you a run was authorised and has not yet
been declared finished, and nothing else. Anything that needs to know *why*, or
what to do about it, must invoke this command and read its answer.

A stale marker is safe to delete by hand. Its absence only means continuation
will not be attempted.

## What this does not change

**No gate is crossed.** Gates E, 1, 2A and 2 all precede implementation and are
already passed by the time this command can run. Gate 3 follows it and is where
this command deliberately terminates. This extension changes how long an
*already approved* run proceeds; it does not approve anything, and it MUST NOT
be used to reach a phase the human has not authorised (Principle II, II-A).

**Scope is unchanged.** Continuation implements the tasks already approved in
`human-loop.md` under "Approved Implementation Scope". A task not on that list is
not implemented merely because continuing was convenient.

**The strict implementation gate is unchanged.** Principle II still requires an
explicit implementation invocation. This command does not supply one; it observes
that a run already invoked has not yet finished.

## Scope: this command is one of three layers

This command runs only when the agent reaches its post-execution hooks. An agent
that ends its turn before reaching them never runs this command at all, because
ending a turn is a property of the agent's execution loop and not of Spec Kit.
A partially complete run that stops and reports is therefore invisible here.

Keeping an authorised run going therefore takes three layers, and they must stay
separated:

| Layer | Owner | Responsibility |
|---|---|---|
| Decision | Spec Kit — this command | Is implementation finished? If not, resume; if so, hand to Gate 3 |
| State | Spec Kit — the in-flight marker | Is a run authorised and not yet declared finished? |
| Trigger | The agent harness | Notice that a turn is ending, and ask the Decision layer |

The trigger layer is the only part Spec Kit cannot supply, and it is deliberately
the dumbest of the three: it tests for the marker and, if present, tells the agent
to invoke this command. It MUST NOT count tasks, read `human-loop.md`, consult the
approved scope, or decide anything. Any trigger that does so has reimplemented
policy outside Spec Kit, which is the failure the Governance clause "Agent
Instruction Files Delegate To Spec Kit" exists to prevent.

An instruction is not a substitute for the trigger layer. Text in an authorising
invocation — asking the agent to keep working, or not to interrupt, or not to ask
questions — constrains what the agent *says*. It does not constrain when the
agent's turn *ends*. An agent can honour such an instruction to the letter and
stop anyway, having asked nothing. Principle II-A's rationale states the general
case: a control that depends on goodwill is not a control. Prompt text is
goodwill; the trigger is the control.

No layer covers a killed process. If the agent is terminated rather than idle,
resumption requires a supervisor outside it.
