---
parent: How-To
nav_order: 2
---

# Cutting an ETL source over to the data platform

MIT Learn's catalog can be loaded by three pipelines: the legacy Celery ETL, the warehouse pull (`BaseWarehouseETLTask`, reading OL Data Platform views in StarRocks) and the data platform's webhook push (`POST /api/v1/webhooks/learning_resources/`). The batch loaders all three share do a full sync, so a resource missing from a batch is unpublished. Only one pipeline may write a given `(etl_source, resource_type)`, and `ETLSourceOwnership` records which one.

This is the procedure for moving a source from one owner to another, checking it, and moving it back.

## How ownership works

- One `ETLSourceOwnership` row per `(etl_source, resource_type)`, with `owner` set to `legacy`, `warehouse` or `webhook`.
- No row means `legacy`. Nothing is seeded, so every source stays on the legacy ETL until someone creates a row.
- Every pipeline stays scheduled. Each run checks ownership and skips a pair it doesn't own:
  - the legacy tasks log `Skipping legacy write for <source>: owned by <type>=<owner>` and write nothing;
  - warehouse tasks skip the same way, inside `fetch_and_upsert`;
  - the webhook rejects the whole batch with `409` and writes nothing.
- The guarded loaders are `load_courses`, `load_programs`, `load_podcasts`, `load_documents`, `load_ovs_playlists`, plus `get_youtube_data` and `sync_canvas_courses`. Per-record paths are not guarded: `ocw_courses_etl` (called per course from the ocw-studio webhook), the OVS video webhook, Canvas content-file ingestion, and the transcript jobs.

Rows are edited in Django admin at `/admin/learning_resources/etlsourceownership/`. In production that takes a staff account with the `learning_resources.change_etlsourceownership` permission. Treat a production edit like a deploy: announce it, and be ready to roll it back.

## Cut a source over as a unit

Flip every resource type the source's legacy task writes, in one sitting. The legacy program loaders upsert the programs' child courses as well, so a source whose courses belong to the webhook while its programs stay legacy would still have its courses written by the legacy ETL.

| Source        | Rows to flip                 | Legacy beat entry                               | New path                         |
| ------------- | ---------------------------- | ----------------------------------------------- | -------------------------------- |
| `mitxonline`  | `course`, `program`          | `update-mitxonline-courses-every-6-hours`       | warehouse                        |
| `xpro`        | `course`, `program`          | `update-xpro-courses-every-1-days`              | warehouse                        |
| `mit_edx`     | `course`, `program`          | `update_edx-courses-every-1-days`               | undecided                        |
| `ocw`         | `course`                     | none (ocw-studio webhook)                       | warehouse                        |
| `mitpe`       | `course`, `program`          | `update-professional-ed-resources-every-1-days` | webhook (`mitpe_schedule`)       |
| `mit_climate` | `document`                   | `update-mit-climate-articles-every-1-days`      | webhook (`mit_climate_schedule`) |
| `oll`         | `course`                     | none                                            | webhook (`oll_schedule`)         |
| `podcast`     | `podcast`, `podcast_episode` | `update-podcasts`                               | warehouse (`SyncPodcastsTask`)   |
| `youtube`     | `video_playlist`, `video`    | `update-youtube-videos`                         | warehouse (`SyncYouTubeTask`)    |
| `ovs`         | `video_playlist`, `video`    | `update-ovs-videos`                             | webhook (already pushing)        |
| `see`         | `course`                     | `update_sloan_courses`                          | not built                        |
| `canvas`      | `course`                     | `sync_canvas_courses-every-1-weeks`             | webhook (already pushing)        |

The webhook schedules live in the data platform's `delivery` code location. They are registered in production only, stopped by default.

OVS and Canvas already push per record, through their own webhooks, which ownership doesn't gate. For them the flip only stops the legacy batch task (`get_ovs_data`, `sync_canvas_courses`) and its prune. Check first that the push alone keeps the full published set, because nothing will unpublish a resource the push never deletes.

## Before the flip

1. The new path works end to end in QA first (see [QA rehearsal](#qa-rehearsal)).
2. The platform's `integrations__learn__*` model for the source was rebuilt today. Check the asset's last materialization in Dagster. The delivery schedules currently fire at or before the staging rebuild (tracked in the data platform), so don't rely on the schedule's own timing yet.
3. Compare what the new owner would write with what Learn has now. The first run of the new owner is a full sync, and anything published in Learn but missing from its batch will be unpublished.

   In Learn (`./manage.py shell`):

   ```python
   from learning_resources.models import LearningResource

   learn_ids = set(
       LearningResource.objects.filter(
           etl_source="mitpe", resource_type="course", published=True
       ).values_list("readable_id", flat=True)
   )
   ```

   On the platform, the same set from the model the new path reads, e.g. `select readable_id from ol_warehouse_production_integrations.integrations__learn__mitpe_courses`.

   Every id in `learn_ids - platform_ids` will be unpublished. Every id in `platform_ids - learn_ids` will be created. Explain each one before going further, and spot-check a few shared ids field by field (title, URL, price, run dates).

4. Record the published counts per resource type for the source. They're the baseline for checking the flip.

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
