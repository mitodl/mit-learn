---
parent: How-To
nav_order: 1
---

# Generating Embeddings

Embeddings are used for features that rely on vector similarity such as the vector search endpoint and the similar resources carousel. They are generated and stored in our vector database - [Qdrant](https://qdrant.tech/). There are celery tasks that auto-generate embeddings for new content in addition to management commands to generate and store embeddings.

## Generating Embeddings for New Content

When new content is added to the database, embeddings are automatically generated for the content. This is done by a celery task that listens for new content events. The task then generates embeddings for the new content and stores them in Qdrant. The task is defined in the `tasks.py` file in the `vector_search` app.

## Management Commands and re-embedding existing content

The following management command is available from the vector_search app to generate and store embeddings:

```bash

python manage.py generate_embeddings --help

```

The command generates embeddings for all content in the database and stores them in Qdrant. The embeddings are generated in batches to prevent memory issues. The command also supports the `--recreate-collections` flag which will delete all existing embeddings and collections before re-generating new embeddings. There is also a flag for skipping contentfiles in case we only need to regenerate learning resources.
