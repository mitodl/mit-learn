"""Report what excluded_olx_paths would drop from an extracted OLX course tree"""

from pathlib import Path

from django.core.management import BaseCommand

from learning_resources.constants import VALID_TEXT_FILE_TYPES
from learning_resources.etl.utils import excluded_olx_paths
from learning_resources.management.commands.unpublish_excluded_files import (
    EDX_SOURCES,
)

TRANSCRIPT_EXTENSIONS = (".srt", ".sjson", ".vtt")


class Command(BaseCommand):
    """
    Check the ingestion filter against a real archive before pointing
    unpublish_excluded_files at production. Takes extracted OLX trees, e.g.

        docker compose run --rm -v /path/to/extracted:/archives web \\
            ./manage.py audit_olx_references --source oll /archives/<course>

    The excluded total counts archive paths, so it is an upper bound on what
    unpublish_excluded_files would unpublish rather than a row count: several
    paths can collapse onto one ContentFile key.
    """

    help = "Report the files an OLX course tree contains but does not use"

    def add_arguments(self, parser):
        parser.add_argument(
            "olx_paths", nargs="+", help="Paths to extracted OLX course directories"
        )
        parser.add_argument(
            "--source",
            choices=EDX_SOURCES,
            help="Platform the archives are from (default: one that hides the "
            "about page, i.e. not oll)",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Print per-archive exclusion counts split by location and file class"""
        for olx_path in options["olx_paths"]:
            root = Path(olx_path)
            ingestable = {
                path
                for path in root.rglob("*")
                if path.is_file()
                and path.suffix.lower() in VALID_TEXT_FILE_TYPES
                and not any(
                    "draft" in part for part in path.relative_to(root).parts[:-1]
                )
            }
            excluded = excluded_olx_paths(root, options["source"]) & ingestable
            static = {
                path for path in excluded if path.relative_to(root).parts[0] == "static"
            }
            transcripts = {
                path for path in static if path.suffix.lower() in TRANSCRIPT_EXTENSIONS
            }
            percent = 100 * len(excluded) / len(ingestable) if ingestable else 0
            self.stdout.write(f"\n=== {root}")
            self.stdout.write(f"  ingestable files      : {len(ingestable)}")
            self.stdout.write(
                f"  excluded              : {len(excluded)} ({percent:.0f}%)"
            )
            self.stdout.write(f"    under static/       : {len(static)}")
            self.stdout.write(f"      transcripts       : {len(transcripts)}")
            self.stdout.write(f"      documents         : {len(static - transcripts)}")
            elsewhere = excluded - static
            self.stdout.write(f"    elsewhere           : {len(elsewhere)}")
            for directory in ("tabs", "about", "policies"):
                under = {
                    path
                    for path in elsewhere
                    if path.relative_to(root).parts[0] == directory
                }
                self.stdout.write(f"      {directory + '/':<18}: {len(under)}")
                elsewhere -= under
            self.stdout.write(
                f"      other             : {len(elsewhere)}"
                "  (staff-only blocks, manifests, announcements)"
            )
