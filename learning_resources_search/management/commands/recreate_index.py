"""Management command to index content"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from learning_resources_search.constants import (
    ALL_INDEX_TYPES,
    HYBRID_COMBINED_INDEX,
    REINDEX_TASK_NAME,
)
from learning_resources_search.indexing_api import get_existing_reindexing_indexes
from learning_resources_search.tasks import start_recreate_index
from main.models import TaskJob


class Command(BaseCommand):
    """Indexes content"""

    help = "Recreate opensearch index"

    def add_arguments(self, parser):
        parser.add_argument(
            "--restart",
            dest="restart",
            action="store_true",
            help=(
                "Discard any in-progress reindex (existing reindexing indexes and"
                " active jobs) and start over"
            ),
        )

        parser.add_argument(
            "--all", dest="all", action="store_true", help="Recreate all indexes"
        )

        parser.add_argument(
            "--combined_hybrid",
            dest=HYBRID_COMBINED_INDEX,
            action="store_true",
            help="Recreate combined index for hybrid search",
        )

        parser.add_argument(
            "--status",
            dest="status",
            nargs="?",
            type=int,
            const=0,
            default=None,
            help=(
                "Print the status of a reindex job instead of starting one "
                "(defaults to the most recent job)"
            ),
        )

        for object_type in sorted(ALL_INDEX_TYPES):
            if object_type != HYBRID_COMBINED_INDEX:
                parser.add_argument(
                    f"--{object_type}s",
                    dest=object_type,
                    action="store_true",
                    help=f"Recreate the {object_type} index",
                )
        super().add_arguments(parser)

    def print_job_status(self, job_id):
        """Print the status of a reindex job"""
        jobs = TaskJob.objects.filter(task_name=REINDEX_TASK_NAME)
        job = jobs.filter(id=job_id).first() if job_id else jobs.order_by("-id").first()
        if not job:
            self.stdout.write("No reindex job found")
            return
        self.stdout.write(f"Reindex job {job.id}: {job.status}")
        self.stdout.write(f"  indexes: {job.params.get('indexes')}")
        self.stdout.write(f"  backing indexes: {job.params.get('backing_indexes')}")
        self.stdout.write("  batches:")
        batch_counts = job.batches.values("kind", "status").annotate(count=Count("id"))
        kind_counts = {}
        for row in batch_counts:
            kind_counts.setdefault(row["kind"], {})[row["status"]] = row["count"]
        for kind, counts in sorted(kind_counts.items()):
            self.stdout.write(f"    {kind}: {counts}")
        if job.error:
            self.stdout.write(f"  error: {job.error}")

    def handle(self, *args, **options):  # noqa: ARG002
        """Index all LEARNING_RESOURCE_TYPES"""
        if options["status"] is not None:
            self.print_job_status(options["status"])
            return

        restart = options["restart"]
        if options["all"]:
            # the combined hybrid index is still experimental and expensive to
            # build; keep it out of --all and require the explicit
            # --combined_hybrid flag to reindex it
            indexes_to_update = [
                index for index in ALL_INDEX_TYPES if index != HYBRID_COMBINED_INDEX
            ]
        else:
            indexes_to_update = list(
                filter(
                    lambda object_type: options[object_type],
                    ALL_INDEX_TYPES,
                )
            )
            if not indexes_to_update:
                self.stdout.write("Must select at least one index to update")
                self.stdout.write("The following are valid index options:")
                self.stdout.write("  --all")
                for object_type in sorted(ALL_INDEX_TYPES):
                    self.stdout.write(f"  --{object_type}s")
                return

        active_jobs = [
            job
            for job in TaskJob.objects.filter(
                task_name=REINDEX_TASK_NAME, status__in=TaskJob.ACTIVE_STATUSES
            )
            if set(job.params.get("indexes", [])) & set(indexes_to_update)
        ]
        if not restart:
            existing_reindexing_indexes = get_existing_reindexing_indexes(
                indexes_to_update
            )
            if existing_reindexing_indexes:
                self.stdout.write(
                    f"Reindexing in progress. Reindexing indexes already exist:"
                    f" {', '.join(existing_reindexing_indexes)}"
                    f"\nUse --restart if you want to continue"
                )
                return
            if active_jobs:
                self.stdout.write(
                    f"Reindexing in progress. Active reindex jobs already exist:"
                    f" {', '.join(str(job.id) for job in active_jobs)}"
                    f"\nUse --restart if you want to continue"
                )
                return

        job = TaskJob.objects.create(
            task_name=REINDEX_TASK_NAME,
            params={
                "indexes": indexes_to_update,
                "restart": restart,
            },
        )

        if restart:
            for active_job in active_jobs:
                TaskJob.objects.filter(
                    id=active_job.id, status__in=TaskJob.ACTIVE_STATUSES
                ).update(
                    status=TaskJob.Status.FAILED,
                    error=f"superseded by reindex job {job.id}",
                )

        start_recreate_index.delay(job.id)
        self.stdout.write(
            f"Started reindex job {job.id} for the following indexes:"
            f" {indexes_to_update}"
        )
        self.stdout.write(
            f"Check progress with: ./manage.py recreate_index --status {job.id}"
        )
