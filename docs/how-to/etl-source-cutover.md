---
parent: How-To
nav_order: 2
---

# Cutting an ETL source over to the data platform

MIT Learn's catalog can be loaded by three pipelines: the legacy Celery ETL, the warehouse pull (`BaseWarehouseETLTask`, reading OL Data Platform views in StarRocks) and the data platform's webhook push (`POST /api/v1/webhooks/learning_resources/`). The batch loaders all three share do a full sync, so a resource missing from a batch is unpublished. Only one pipeline may write a given `(etl_source, resource_type)`, and `ETLSourceOwnership` records which one.

This is the procedure for moving a source from one owner to another, checking it, and moving it back.

## How ownership works

- One `ETLSourceOwnership` row per `(etl_source, resource_type)`, with `owner` set to `legacy`, `warehouse` or `webhook`.
- A row can also name a `shadow` pipeline (`warehouse` or `webhook`), which extracts and transforms without loading and reports what a load would have changed. See [Shadow run](#shadow-run).
- No row means `legacy`. Nothing is seeded, so every source stays on the legacy ETL until someone creates a row.
- Every pipeline stays scheduled. Each run checks ownership before it extracts anything and returns if it doesn't own the pair:
  - the legacy pipelines in `learning_resources/etl/pipelines.py` (and `get_youtube_data`, `sync_canvas_courses` and `get_ocw_data`, which have no pipeline function) log `Skipping legacy write for <source>: owned by <type>=<owner>` and make no call to the source;
  - a warehouse task declares what it writes (`writes` on its `BaseWarehouseETLTask` subclass, required), and `run` returns 0 without connecting to StarRocks when the warehouse doesn't own it;
  - the webhook rejects the whole batch with `409` and writes nothing.
- `load_courses`, `load_programs`, `load_podcasts`, `load_documents` and `load_ovs_playlists` check again as a backstop and return `[]` for a pair the caller doesn't own. Code that calls them directly (a shell session, a new pipeline) is the legacy pipeline unless it is inside `writing_as(...)`.
- `ocw_courses_etl` is checked too. It loads a course and that course's content files together, so once `ocw`/`course` is not `legacy`, the ocw-studio webhook stops loading OCW content files as well.
- Not checked: the OVS video webhook, Canvas content-file ingestion, the `import_all_*_files` content-file tasks, and the transcript jobs.

Rows are edited in Django admin at `/admin/learning_resources/etlsourceownership/`. In production that takes a staff account with the `learning_resources.change_etlsourceownership` permission. Treat a production edit like a deploy: announce it, and be ready to roll it back.

## Cut a source over as a unit

Flip every resource type the source's legacy task writes, in one sitting, unless the split is the plan. A split works at the loader (`load_programs` links a program to the courses their owner loaded and writes none when the current pipeline doesn't own the source's courses), but the two halves are then validated and rolled back separately.

| Source        | Rows to flip                 | Legacy beat entry                               | New path                         |
| ------------- | ---------------------------- | ----------------------------------------------- | -------------------------------- |
| `mitxonline`  | `course`, `program`          | `update-mitxonline-courses-every-6-hours`       | warehouse                        |
| `xpro`        | `course`, `program`          | `update-xpro-courses-every-1-days`              | warehouse                        |
| `mit_edx`     | `course`, `program`          | `update_edx-courses-every-1-days`               | undecided                        |
| `ocw`         | `course`                     | none (ocw-studio webhook)                       | warehouse                        |
| `mitpe`       | `course`, `program`          | `update-professional-ed-resources-every-1-days` | webhook (`mitpe_schedule`)       |
| `mit_climate` | `document`                   | `update-mit-climate-articles-every-1-days`      | webhook (`mit_climate_schedule`) |
| `oll`         | `course`                     | none                                            | webhook (`oll_schedule`)         |
| `podcast`     | `podcast`, `podcast_episode` | `update-podcasts`                               | webhook (`podcast_schedule`)     |
| `youtube`     | `video_playlist`, `video`    | `update-youtube-videos`                         | webhook (not built)              |
| `ovs`         | `video_playlist`, `video`    | `update-ovs-videos`                             | webhook (already pushing)        |
| `see`         | `course`                     | `update_sloan_courses`                          | not built                        |
| `canvas`      | `course`                     | `sync_canvas_courses-every-1-weeks`             | webhook (already pushing)        |

The webhook schedules live in the data platform's `delivery` code location. They are registered in production only, stopped by default.

OVS and Canvas already push per record, through their own webhooks, which ownership doesn't gate. For them the flip only stops the legacy batch task (`get_ovs_data`, `sync_canvas_courses`) and its prune. Check first that the push alone keeps the full published set, because nothing will unpublish a resource the push never deletes.

## Before the flip

1. The new path works end to end in QA first (see [QA rehearsal](#qa-rehearsal)).
2. The platform's `integrations__learn__*` model for the source was rebuilt today. Check the asset's last materialization in Dagster. The delivery schedules currently fire at or before the staging rebuild (tracked in the data platform), so don't rely on the schedule's own timing yet.
3. Shadow the source as its new owner and read the report (see [Shadow run](#shadow-run)). The first run of the new owner is a full sync, and anything published in Learn but missing from its batch will be unpublished. Explain every `unpublished`, `republished` and `created` id and every entry of `field_counts` before going further. Leave the shadow on for a few scheduled runs if the source changes daily, so the report covers more than one day's data.

4. Record the published counts per resource type for the source. They're the baseline for checking the flip.

## Shadow run

A shadow run is the new pipeline's extract and transform, with the owner unchanged and nothing loaded. Where a cutover would load the batch, `load_courses`, `load_programs`, `load_documents` and `load_podcasts` compare each item with the stored resource of the same `readable_id` instead, and work out what the prune would unpublish. It only reads the catalog, a few queries per 500 items, so it takes no row locks and holds no transaction open. Nothing reaches the search index.

The comparison is a second copy of the loaders' rules (`learning_resources/etl/shadow.py`), not the loaders themselves. It tells you whether the new pipeline's data matches what is stored. It does not prove the load runs, so the first write after a flip is still the first time the loaders see that batch.

1. In Django admin, create or edit the row for each resource type from the table above, leave `owner` as it is and set `shadow` to the new pipeline. All of a source's rows that one load writes together (`podcast` and `podcast_episode`, `video_playlist` and `video`) need it.
2. Run the new pipeline as you would for the flip, or wait for its schedule:
   - warehouse: `<SyncTask>.delay()`. A shadow run is always a full refresh and leaves the incremental watermark alone. The task logs 0 rows, because the loaders return nothing in a shadow run.
   - webhook: not wired to the shadow yet. Until it is, the webhook answers `409` for a pair it doesn't own, shadow or not.
3. Read the report at `/admin/learning_resources/etlshadowrun/`. There is one per `(etl_source, resource_type)` per run, and the last 20 per pipeline are kept.

Each report has:

- `counts`: resources `created`, `unpublished`, `republished`, `updated` and `unchanged`, with the stored totals (`before`, `before_published`);
- `details.created`, `unpublished`, `republished` and `updated`: the `readable_id`s behind each count. `unpublished` is the resources the batch leaves out or marks unpublished, `republished` the stored unpublished ones it publishes, and `updated` every resource with a field change, including ones that are also in the other two lists;
- `details.field_counts`: how many updated resources changed each field (`title`, `runs[].prices`), the quickest way to see a systematic difference;
- `details.changed`: `[stored, incoming]` per field for the first 200 updated resources;
- `error`: set when the load raised (an empty view, the mass-unpublish guard), in which case the task fails too, as it would as the owner. It is also set when the load never reached one of the four loaders above for the pair, so that an uncompared pair doesn't read as a clean one.

What is compared: every key of an item that is a column of the resource, `published` as the loader would set it, topics, `offered_by`, image, departments, content tags, the course, podcast or episode detail row, each run by `run_id` (its columns, prices, instructors and image, and the runs a prune would unpublish), and a program's children.

What is not: fields the loaders derive from a course's or program's runs (`availability`, `prices`, `next_start_date`, the duration and commitment fields), topics found by similarity for a document that has none, the courses a program load writes, content files, and anything a pipeline writes without going through those four loaders (playlists and videos).

Things a shadow run costs while it is on:

- Every run of the task is a shadow run and a full refresh for as long as `shadow` is set.
- If one task loads several types together and the pipeline already owns some of them, setting `shadow` on the rest makes the whole run a shadow run, so the types it owns stop being written until `shadow` is cleared.
- The stored side is read while the owner may be writing, so a resource the owner changes during the run is compared in whichever state the read found it.

When the report is clean, clear `shadow` and set `owner` (below). Clear `shadow` on its own to stop shadowing.

## Flip

For a webhook source:

1. In Django admin, create a row per resource type from the table above with `owner` set to `webhook`.
2. In Dagster, materialize the source's delivery asset by hand (e.g. `mit_learn_delivery/mitpe_webhook`). That's the first write, so it happens while you're watching.
3. Once it checks out (below), start the schedule.

For a warehouse source:

1. Create the rows with `owner` set to `warehouse`.
2. Run the source's `BaseWarehouseETLTask` in full from `./manage.py shell` rather than waiting for its beat entry: `<SyncTask>.delay(full_refresh=True)`. Only a full refresh prunes. (No catalog source has a warehouse task yet. `profiles.tasks.SyncProgramCertificatesTask` is the one that exists, and it writes certificates, not catalog resources, so ownership doesn't apply to it.)

Between the flip and the new owner's first run, the legacy task only skips. The source's data goes stale but nothing is unpublished.

## After the flip

- The new owner's run succeeded: for the webhook, a successful Dagster run and a Learn log line `learning_resources webhook processed: {...}` with each group `loaded`; for the warehouse, the task's logged row count.
- Published counts per resource type match the baseline, adjusted for the differences you explained before the flip.
- The next legacy beat run logs `Skipping legacy write for <source>` and nothing else writes the source.
- The source's resources still look right on the site and in search.

## Roll back

1. Delete the source's rows, or set them to `legacy`.
2. Stop the webhook schedule, or leave the warehouse beat entry alone (it skips from now on). A webhook schedule left running fails with `409` every run.
3. Run the legacy task by hand, e.g. `get_mitpe_data.delay()`. Legacy is a full sync: it republishes every resource in its batch, including any the new owner unpublished, and unpublishes anything the new owner created that legacy doesn't know.
4. Check the published counts against the pre-flip baseline.

Fields only the new owner writes (e.g. `podcast_episode.rss` from the platform) stay as they are until legacy overwrites them. That's harmless.

## QA rehearsal

Do the whole procedure on RC first, with the QA data platform.

- Webhook sources: QA Dagster delivers to `api.rc.learn.mit.edu`. The delivery schedules aren't registered in QA, so materialize the asset by hand.
- Warehouse sources: the warehouse tasks currently read views pinned to the production catalog, so a QA rehearsal isn't possible until that is fixed.
