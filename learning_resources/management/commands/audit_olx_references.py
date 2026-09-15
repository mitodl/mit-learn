"""Report what excluded_olx_paths would drop from an extracted OLX course tree"""

from pathlib import Path

from django.core.management import BaseCommand

from learning_resources.constants import VALID_TEXT_FILE_TYPES
from learning_resources.etl.utils import excluded_olx_paths

TRANSCRIPT_EXTENSIONS = (".srt", ".sjson", ".vtt")


class Command(BaseCommand):
    """
    Check the ingestion filter against a real archive before pointing
    unpublish_excluded_files at production. Takes extracted OLX trees, e.g.

        docker compose run --rm -v /path/to/extracted:/archives web \\
            ./manage.py audit_olx_references /archives/<course>

    The excluded total is what unpublish_excluded_files would unpublish for a
    run whose content files are fully ingested.
    """

    help = "Report the files an OLX course tree contains but does not use"

    def add_arguments(self, parser):
        parser.add_argument(
            "olx_paths", nargs="+", help="Paths to extracted OLX course directories"
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
            excluded = excluded_olx_paths(root) & ingestable
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
            self.stdout.write(
                f"    elsewhere           : {len(excluded - static)}"
                "  (staff-only blocks, manifests, announcements)"
            )
