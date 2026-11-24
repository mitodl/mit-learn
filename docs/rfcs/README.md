# RFCs — closed

This directory is closed. Nothing new goes here.

Its documents were mixing four different kinds of record under one numbering
scheme — architecture decisions, shipped feature designs, a component-structure
design doc, and an in-flight spec. Each moved to the tier that matches what it
actually is.

## Where everything went

| Was                                     | Is now                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `0001-caching-system.md`                | [`../adr/0001-caching-system.md`](../adr/0001-caching-system.md)                                                  |
| `0002-indexing-embedly-link-preview.md` | deleted in `885cdd764`, along with the discussions backend it was about                                           |
| `0003-search-ui.md`                     | [`../adr/0002-search-ui.md`](../adr/0002-search-ui.md)                                                            |
| `0004-enhanced-facets.md`               | [`../specs/enhanced-search-facets.md`](../specs/enhanced-search-facets.md)                                        |
| `0005-video-resources.md`               | [`../specs/ocw-video-resources.md`](../specs/ocw-video-resources.md)                                              |
| `0006-front-end-component-structure.md` | [`../specs/front-end-component-structure.md`](../specs/front-end-component-structure.md)                          |
| `_0000-template.md`                     | [`../adr/template.md`](../adr/template.md), and the shape described in [`../specs/README.md`](../specs/README.md) |

The ADRs were renumbered when `docs/adr/` was established, because a new
sequence starting at 0001 with a gap at 0002 would be unexplainable from
inside the directory holding it. This table is what carries the old number.

## Where new work goes

| You have                                        | It goes in                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| One decision that will outlive the code         | [`../adr/`](../adr/README.md)                                              |
| One body of work spanning several pull requests | [`../specs/`](../specs/README.md)                                          |
| A question the team cannot answer alone         | an RFC discussion in [mitodl/hq](https://github.com/mitodl/hq/discussions) |
| A description of how the system works today     | [`../architecture/`](../architecture/README.md)                            |
| A procedure someone needs to follow             | [`../how-to/`](../how-to/README.md)                                        |

The last distinction is the one this directory got wrong. An RFC is a
**question** — something that needs input from outside the team before anyone
can choose. It produces an ADR once it is answered. A document that already
records an answer is an ADR whatever it is called, and keeping both in the
same tree meant the questions and the answers were indistinguishable.
