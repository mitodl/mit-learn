# Documentation

These are plain Markdown files, read on GitHub. There is no site build — the
GitHub Pages deployment at
[mitodl.github.io/mit-learn](https://mitodl.github.io/mit-learn/) publishes
Storybook (`.github/workflows/publish-pages.yml`), not this directory.

## What goes where

Four directories, four jobs. The distinction is what the document is _for_,
not what it is about.

| Directory                                 | Holds                                                                                                                              | Lifetime                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [`adr/`](adr/README.md)                   | One architecture decision per file, scoped to the code it governs. Answers _why is it like this?_                                  | As long as the code                |
| [`specs/`](specs/README.md)               | The design of one body of work: interlocking decisions, sequencing, open questions. Answers _what are we building, in what order?_ | Until the work ships, then history |
| [`architecture/`](architecture/README.md) | How the system works **now**                                                                                                       | Kept current                       |
| [`how-to/`](how-to/README.md)             | Procedures someone needs to follow                                                                                                 | Kept current                       |

A question the team cannot answer alone is an **RFC**, and it goes to a
discussion in [mitodl/hq](https://github.com/mitodl/hq/discussions), not to a
file here. It produces an ADR once it is answered.

[`rfcs/`](rfcs/README.md) is closed. It holds a map from the old paths to the new ones.

## Contents

**Architecture**

- [Overview](architecture/overview.md)
- [Front End Component Structure](architecture/front-end-component-structure.md)
- [Google Tag Manager (GTM)](architecture/gtm.md)

**How-to**

- [Generating Embeddings](how-to/embeddings.md)
- [Creating News from Articles](how-to/articles-to-news.md)
- [Cutting an ETL source over to the data platform](how-to/etl-source-cutover.md)

**Records**

- [Architecture Decision Records](adr/README.md)
- [Specs](specs/README.md)

**Other**

- [Articles CDN Purge](articles-cdn-purge.md)
