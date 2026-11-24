# Specs

The design document for **one body of work**: several interlocking decisions,
a sequence across pull requests, and the questions still blocking the design.
A spec changes while the work is in flight and becomes history when it ships.

## Current

| Spec                                                                   | Status         |
| ---------------------------------------------------------------------- | -------------- |
| [`enhanced-search-facets.md`](enhanced-search-facets.md)               | shipped (2019) |
| [`ocw-video-resources.md`](ocw-video-resources.md)                     | shipped (2020) |
| [`front-end-component-structure.md`](front-end-component-structure.md) | shipped (2023) |

## A spec is not a long ADR

The difference is lifetime, and it decides which one you are writing:

|         | Spec                                                           | ADR                                                     |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Records | One body of work                                               | One decision                                            |
| Lives   | Until the work ships, then as history                          | As long as the code it governs                          |
| Changes | Continuously, while in flight                                  | Never — a changed decision is a new, superseding record |
| Answers | "What are we building, in what order, and what is still open?" | "Why is it like this?"                                  |
| Read by | The person building it, now                                    | Someone two years from now                              |

That `Changes` row is the one with teeth. A spec changing mid-flight is
correct; the same edit to an accepted ADR is not.

**Work on this route produces both.** The spec first; then an ADR in
[`../adr/`](../adr/README.md) for each decision that settles _and will outlive the
project_. Most will not — a chunk boundary, a phase order, a migration
sequence all stop mattering once the work ships. Writing the ADRs up front
gets it backwards: a decision still moving is a spec section, and an ADR over
it would be superseded before the work shipped.

**Not every piece of work needs one.** One decision over one or two pull
requests is a plan comment plus an ADR. A spec earns its place when the work
spans several pull requests _and_ more than one session or repo, or carries
open questions blocking the design.

## Writing one

Name the file for its subject — `security-headers.md`, not a number. Open with
a short header block before the first section:

```markdown
# <subject> — Spec

Status: **draft** — D1–D4 decided, D5 open. Nothing here is implemented yet.
Project: `wp-<slug>`
Deviations: `<slug>-deviations.md` (deleted at close-out; see the superseding ADR for the anchor)
Basis: <the issue it came from, and any discovery or spike document>

All source anchors below are against `origin/main` @ `<short sha>`.
```

Four things that header gets right:

- **Pin a commit.** A spec quotes paths and line numbers; without a sha they
  rot silently, and an implementer six weeks later cannot tell whether the
  spec is wrong or the code moved.
- **`Status:` says whether this is still being argued with.** A spec read as
  settled when it is not gets built. Use `draft`, `ready`, `shipped`,
  `abandoned` — states, not tiers. **Never write `Status: spec`**: that puts
  the name of the record type in the status field, where it later reads back
  as a classification and licenses edits the tier does not allow.
- **`Project:`** is the witan `wp-` slug, which is what connects the document
  to the tasks and sessions doing the work.
- **`Deviations:`** names the sibling log, created empty alongside the spec. It
  records how the plan moved once implementation started — what was assumed,
  what contradicted it, what was agreed instead, and on whose say-so. It is
  transient: it is deleted at close-out, in the same pull request as the
  superseding record it fed, which cites its commit.

### Number the decisions

Each decision gets its own number and heading — `D1`, `D2`, … — with its state
in the heading:

```markdown
## D4. Deploy-time apply: entrypoint direct apply only (decided)
```

This is the convention that earns the most. It makes a decision
**addressable**: a reviewer disagrees with D4, not with "the spec"; a task can
be "decide D1–D7"; an ADR extracted later says which D it came from. Mark
state explicitly — `(decided)`, `(open)`, `(deferred)`. An undecided decision
written in the same voice as a settled one is how a spec ships a guess.

Record the condition that would flip each rejected alternative. On a spec,
that condition often does arrive mid-flight.

### Also carry

- **Sequencing** — the phases, their done-conditions, and the task for each.
  A spec that does not say what order the work happens in is a design
  document, not a plan.
- **Verification** — how anyone knows it worked, per phase. Checkable
  conditions, not "tests pass".
- **Non-goals** — what a reader will otherwise assume is coming. This section
  prevents more scope creep than any other.
- **Open questions** — each with who can answer it. An open question with no
  owner is a wish.
- **Risks** — where the work can fail in a way the sequencing cannot absorb.

## Reviewing and retiring

A spec is a **reviewed file in a pull request**, landing ahead of the
implementation, with the chunk pull requests referencing it. Say in the
description which decisions are still open, so a reviewer knows which parts
they are being asked to settle rather than check.

When the work ships, the spec stays where it is and becomes history. Do not
delete it and do not move it: the extracted ADRs carry the decisions, but only
the spec carries the sequence and the things that were considered and dropped.

## Related

- [`../adr/`](../adr/README.md) — one decision, immutable, scoped by `applies_to`
- [`../architecture/`](../architecture/README.md) — how the system works now
- [`../rfcs/`](../rfcs/README.md) — **closed.** The predecessor of this directory, kept
  as a path map. Nothing new goes there.
