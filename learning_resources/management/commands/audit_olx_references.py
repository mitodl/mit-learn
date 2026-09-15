"""Report what excluded_olx_paths would drop from an extracted OLX course tree"""

from collections import Counter
from pathlib import Path

from django.core.management import BaseCommand

from learning_resources.constants import VALID_TEXT_FILE_TYPES
from learning_resources.etl.utils import staff_only_olx_paths, static_olx_references

TRANSCRIPT_EXTENSIONS = (".srt", ".sjson", ".vtt")


class Command(BaseCommand):
    """
    Check the ingestion filter against a real archive before pointing
    unpublish_excluded_files at production. Takes extracted OLX trees, e.g.

        docker compose run --rm -v /path/to/extracted:/archives web \\
            ./manage.py audit_olx_references /archives/<course>
    """

    help = "Report the static files an OLX course tree does not reference"

    def add_arguments(self, parser):
        parser.add_argument(
            "olx_paths", nargs="+", help="Paths to extracted OLX course directories"
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Print per-archive drop counts split by file class"""
        for olx_path in options["olx_paths"]:
            root = Path(olx_path)
            references = {
                path: referrer
                for path, referrer in static_olx_references(
                    root, staff_only_olx_paths(root)
                ).items()
                if path.suffix.lower() in VALID_TEXT_FILE_TYPES
            }
            dropped = [
                path for path, referrer in references.items() if referrer is None
            ]
            transcripts = [
                path for path in dropped if path.suffix.lower() in TRANSCRIPT_EXTENSIONS
            ]
            documents = [path for path in dropped if path not in set(transcripts)]
            percent = 100 * len(dropped) / len(references) if references else 0
            types = ", ".join(
                f"{extension}:{count}"
                for extension, count in Counter(
                    path.suffix.lower() for path in documents
                ).most_common(4)
            )
            self.stdout.write(f"\n=== {root}")
            self.stdout.write(f"  ingestable static files : {len(references)}")
            self.stdout.write(
                f"  dropped                 : {len(dropped)} ({percent:.0f}%)"
            )
            self.stdout.write(f"    transcripts           : {len(transcripts)}")
            self.stdout.write(f"    documents             : {len(documents)}  {types}")
