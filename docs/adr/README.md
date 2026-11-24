# Architecture Decision Records

One decision per file, scoped to the code it governs, immutable once accepted.

An ADR answers **"why is it like this?"** for someone reading the code two
years from now who was not in the room. If future you would ask that question,
there should be an ADR.

## Index

<!-- Maintained by hand. Add a row when you add an ADR; the columns come straight out of the file. -->

| ADR                            | Title                               | Status   | Date       |
| ------------------------------ | ----------------------------------- | -------- | ---------- |
| [0001](0001-caching-system.md) | Caching System for Third-Party Data | Accepted | 2019-02-08 |
| [0002](0002-search-ui.md)      | Search UI Framework                 | Accepted | 2019-03-05 |

## When to write one

Write an ADR when all three hold:

- It is architecturally significant — it affects structure, an external
  interface, a quality attribute, or is expensive to reverse.
- Someone who was not in the room will need to understand _why_.
- There was a real trade-off. If one option was obviously right, there was no
  decision to record.

Skip it when the choice is settled by a linter, a style guide, or an existing
ADR; when it is local to one function; or when it is a temporary workaround
with no architectural consequence. **Zero ADRs is a normal outcome** for a
piece of work. Writing one anyway teaches the next reader that ADRs here are
ceremonial.

Several decisions in one piece of work get several ADRs, each standing alone.

## Writing one

1. Copy [`template.md`](template.md).
2. Take the next number from the filesystem, not from this index. Numbers are
   permanent — never renumber to close a gap. (0001 and 0002 were renumbered
   once, when they were migrated out of `docs/rfcs/` and this sequence was
   created. That was allocating numbers in a new sequence, not renumbering an
   existing one, and it does not happen again.)
3. Fill in `applies_to` (see below) and set the Status row to `Proposed`. A human
   flips it to `Accepted` when the implementation pull request merges with an
   approving review.
4. Record the alternatives **with the condition that would have flipped each**.
   "Rejected because X" is a verdict; "would have won if Y" is reviewable, and
   it is what makes the record useful when the situation changes.
5. Add a row to the index above, and commit the ADR with the first
   implementation pull request — not as a separate gating one.

## `applies_to`

Frontmatter carries the file globs the decision governs. This is how anyone —
or any agent — finds the decisions relevant to a change without reading all of
them.

```yaml
---
applies_to:
  - "frontends/main/src/page-components/SearchDisplay/**"
---
```

Two rules:

- **Write a subtree with a double star.** These globs are matched with git
  `:(glob)` pathspec semantics, under which a single star stops at a slash and
  a double star crosses it. The single-star form silently matches one directory
  level and nothing below it, which is almost never what the decision means:

  ```
  frontends/main/src/page-components/SearchDisplay/*     that one level only
  frontends/main/src/page-components/SearchDisplay/**    the whole subtree
  ```

- **Check every glob matches something before you commit it.** A glob that
  matches nothing fails silently and in the dangerous direction: the ADR never
  surfaces and the next change proceeds as though no decision governed it.

  ```bash
  git ls-files -- ":(glob)$entry" | grep -q . || echo "matches nothing: $entry"
  ```

  A decision about where _new_ code goes legitimately names a path that does
  not exist yet. Say so in the file, directly under the frontmatter, so a
  later reader knows the empty match was deliberate:

  ```markdown
  <!-- applies_to: src/notifications/** is created by this work -->
  ```

## Changing a decision

**An accepted ADR is immutable.** A decision that changed is recorded as a new
ADR that supersedes the old one; the old one gets
a Status of `Superseded by ADR-XXXX` and keeps its content. Editing an accepted
record destroys the thing it exists for — what we believed at the time.

While work is in flight and the decision is still moving, it belongs in a spec
in [`../specs/`](../specs/README.md), not here.

## Related

- [`../specs/`](../specs/README.md) — the design of one body of work: several
  interlocking decisions, a sequence across pull requests, and what is still
  open. Dies when the work ships; ADRs extracted from it live on.
- [`../architecture/`](../architecture/README.md) — how the system works **now**. An ADR
  says why; architecture docs say what.
- [`../rfcs/`](../rfcs/README.md) — **closed.** The predecessor of this directory, kept
  as a path map. Nothing new goes there.
- A question the team cannot answer alone goes to an RFC discussion in
  [mitodl/hq](https://github.com/mitodl/hq/discussions), not to a file in this
  repo. An RFC is a question; it produces an ADR once it is answered.
