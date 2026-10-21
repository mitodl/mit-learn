---
parent: How-To
nav_order: 1
---

# Generating Embeddings

Embeddings are used for features that rely on vector similarity such as the vector search endpoint and the similar resources carousel. They are generated and stored in our vector database - [Qdrant](https://qdrant.tech/). There are celery tasks that auto-generate embeddings for new content in addition to management commands to manually generate and store embeddings.

## Settings

The following embeddings related settings are available in the `settings.py` file:

| Setting                     | Desription                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| QDRANT_API_KEY              | Description                                                                                                        |
| QDRANT_HOST                 | Qdrant Host address                                                                                                |
| QDRANT_BASE_COLLECTION_NAME | Collection name prefix to use                                                                                      |
| QDRANT_DENSE_MODEL          | Main embedding model to use                                                                                        |
| QDRANT_SPARSE_MODEL         | Sparse model to use for embeddings                                                                                 |
| QDRANT_CHUNK_SIZE           | Chunk size to use when batching embedding tasks                                                                    |
| QDRANT_ENCODER              | Encoding class to use for embeddings in `vector_search/encoders`                                                   |
| LITELLM_TOKEN_ENCODING_NAME | token encoder to use when chunking or calculating token sizes. Defaults to model returned by tiktoken If undefined |
| LITELLM_CUSTOM_PROVIDER     | Set to 'ollama' by default. Only takes effect when LITELLM_API_BASE is also defined                                |
| LITELLM_API_BASE            | Required to enable ollama as the litellm provider                                                                  |
| OPENAI_API_KEY              | Required if using "LiteLLMEncoder" with openai as a provider (default)                                             |

## Tracing

`LiteLLMEncoder` traces every embedding request it sends to the provider to Opik through [ol-llm](https://github.com/mitodl/ol-llm)'s `traced_embedding`. Each request is one trace in the `mit-learn` Opik project, tagged with the app, use case, and environment, with a span that names the model and the input tokens billed. There are two use cases:

- `search-query` (request profile): `embed_query`, for search and retrieval queries.
- `document-embedding` (batch profile): `embed_documents`, for resources and content files. The trace carries the Celery task id as `run_id`.

The model is the ol-llm catalog id of `QDRANT_DENSE_MODEL` as litellm resolves it, e.g. `openai:text-embedding-3-large`.

Hedged query requests are each traced, since each one is billed. A query served from the Redis cache reports 0 input tokens. Requests with more than one text skip the cache: litellm caches each text separately and reports a partial hit's usage as the sum of cached and billed tokens.

Tracing is off unless `OPIK_URL_OVERRIDE` is set, so local development, CI, and tests need no Opik. The variables, read by ol-llm and the Opik SDK:

| Variable                                                                      | Description                                                                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| OL_LLM_ENVIRONMENT                                                            | Environment on every trace, e.g. `ci`, `qa`, `production`. Defaults to `MITOL_ENVIRONMENT`                      |
| OPIK_URL_OVERRIDE                                                             | The Opik API, e.g. `https://opik-qa.ol.mit.edu/api/`. Unset turns tracing off                                   |
| OPIK_WORKSPACE                                                                | `default` on our instances                                                                                      |
| OPIK_KEYCLOAK_TOKEN_URL, OPIK_KEYCLOAK_CLIENT_ID, OPIK_KEYCLOAK_CLIENT_SECRET | The Keycloak client that authenticates to Opik (Vault `secret-operations/sso/opik`). Leave `OPIK_API_KEY` unset |
| OPIK_TRACK_DISABLE                                                            | `true` turns tracing off even with `OPIK_URL_OVERRIDE` set                                                      |
| OL_LLM_TRACE_CONTENT                                                          | `false` keeps the embedded texts (search queries, document chunks) out of traces. Defaults to `true`            |

## Embeddings for New Content

Embeddings are automatically generated for new content by a periodic celery task. The tasks are defined `vector_search/tasks.py`.

## Embeddings for Existing Content

The following management command is available from the vector_search app to generate and store embeddings:

```bash
python manage.py generate_embeddings --help
```

The command above generates embeddings for all content files and learning resources in the database and stores them in Qdrant. The embeddings are generated in batches to prevent memory issues. The command also supports the `--recreate-collections` flag which will delete all existing embeddings and collections before re-generating new embeddings. There is also a flag for skipping contentfiles in case we only need to regenerate learning resources.

## Ollama for (Hardware Accelerated) Embedding

[Ollama](https://ollama.com/) is an easy way to run LLMs and embedding models locally while also taking advantage of any available hardware acceleration.

To get setup:

1. Install [ollama](https://ollama.com/)
2. Open up a terminal and pull down the embedding model you would like to use via ollama pull <model name>. [Supported models](https://ollama.com/blog/embedding-models)
3. Bring down your celery and web container docker compose down celery web
4. Configure litellm to use ollama with the following settings in your .env file:

```
QDRANT_ENCODER=vector_search.encoders.litellm.LiteLLMEncoder
LITELLM_API_BASE=http://docker.for.mac.host.internal:11434/v1/
QDRANT_DENSE_MODEL=<ollama model name>
```

_Note_ - "LITELLM_API_BASE=http://docker.for.mac.host.internal:11434/v1/" is Mac specific - if you are using another OS you will need to figure out what your host machine's docker address is.

Sample .env file configuration on Mac:

```
QDRANT_ENCODER=vector_search.encoders.litellm.LiteLLMEncoder
LITELLM_API_BASE=http://docker.for.mac.host.internal:11434/v1/
QDRANT_DENSE_MODEL=all-minilm
```

5. Bring the web and celery containers back up via docker compose up -d
6. Run embeddings via:

```bash
python manage.py generate_embeddings --all --recreate-collections --skip-contentfiles
```
