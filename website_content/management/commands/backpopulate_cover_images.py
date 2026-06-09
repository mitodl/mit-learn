"""Management command to backpopulate cover_image on existing WebsiteContent records."""

from django.core.management.base import BaseCommand

from website_content.models import WebsiteContent
from website_content.utils import extract_image_from_content


class Command(BaseCommand):
    """Derive and store cover_image for all WebsiteContent records that lack one."""

    help = "Backpopulate cover_image from content JSON for all WebsiteContent records"

    def add_arguments(self, parser):
        """Add --all flag to process records that already have a cover_image."""
        parser.add_argument(
            "--all",
            action="store_true",
            dest="process_all",
            help="Re-derive cover_image even for records that already have one set",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Iterate over WebsiteContent records and write derived cover_image values."""
        qs = WebsiteContent.objects.all()
        if not options["process_all"]:
            qs = qs.filter(cover_image="")

        total = qs.count()
        if total == 0:
            self.stdout.write("No records to update.")
            return

        self.stdout.write(f"Backpopulating cover_image for {total} record(s)...")

        updated = 0
        skipped = 0

        for obj in qs.only("pk", "content").iterator():
            image_data = extract_image_from_content(obj.content)
            url = image_data.get("url", "") if image_data else ""

            WebsiteContent.objects.filter(pk=obj.pk).update(cover_image=url)

            if url:
                updated += 1
            else:
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {updated} record(s) updated with an image URL, "
                f"{skipped} record(s) had no extractable image."
            )
        )
