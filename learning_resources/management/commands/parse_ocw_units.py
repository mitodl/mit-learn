"""Build the unit SourceManifest for a public OCW course site"""

import tempfile
from pathlib import Path

from django.core.management import BaseCommand

from learning_resources.etl.ocw_unit_parsing import Ingestor


class Command(BaseCommand):
    """
    Run the OCW unit Ingestor against a public course url and print the
    resulting SourceManifest as JSON, e.g.

        docker compose run --rm web ./manage.py parse_ocw_units \\
            https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/ \\
            --data-dir ./ocw_units > manifest.json

    Raw downloads and extracted text land under <data-dir>/<course id>/, and
    the raw cache is reused on later runs unless --refresh is passed.
    """

    help = "Print the unit SourceManifest for a public OCW course url"

    def add_arguments(self, parser):
        """Configure command args"""
        parser.add_argument("course_url", help="Public OCW course url")
        parser.add_argument(
            "--data-dir",
            type=Path,
            default=Path(tempfile.gettempdir()) / "ocw_unit_parsing",
            help="Directory for the raw cache and extracted text "
            "(default: %(default)s)",
        )
        parser.add_argument(
            "--include-readings",
            action="store_true",
            help="Download and extract online textbook chapters",
        )
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Re-download urls that are already in the raw cache",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Run the Ingestor and write the manifest to stdout"""
        manifest = Ingestor(
            options["course_url"],
            options["data_dir"],
            include_readings=options["include_readings"],
            refresh=options["refresh"],
        ).run()
        self.stdout.write(manifest.model_dump_json(indent=2))
