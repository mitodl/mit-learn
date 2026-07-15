"""Management command for sending a test welcome or digest email to a user"""  # noqa: INP001

import sys

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError
from requests.models import PreparedRequest

from learning_resources.constants import LearningResourceType
from learning_resources.models import LearningResource
from learning_resources_search.tasks import (
    _generate_subscription_digest_subject,
    attempt_send_digest_email_batch,
)
from main.utils import frontend_absolute_url
from profiles.tasks import send_welcome_email

User = get_user_model()


def _add_user_arguments(parser):
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--user-id", type=int, help="the id of the user")
    group.add_argument("--email", help="the email of the user")


def _resolve_user(options):
    if options["user_id"]:
        return User.objects.get(id=options["user_id"])
    return User.objects.get(email=options["email"])


class Command(BaseCommand):
    """Send a test welcome or digest email to a user"""

    help = "Send a test welcome or digest email to a user"

    def add_arguments(self, parser):
        """Add the welcome and digest subcommands"""
        subparsers = parser.add_subparsers(dest="email_type", required=True)

        welcome_parser = subparsers.add_parser(
            "welcome", help="Send a test welcome email"
        )
        _add_user_arguments(welcome_parser)

        digest_parser = subparsers.add_parser("digest", help="Send a test digest email")
        _add_user_arguments(digest_parser)
        digest_parser.add_argument(
            "--resource-id",
            type=int,
            action="append",
            dest="resource_ids",
            help="a learning resource id to include (may be repeated)",
        )
        digest_parser.add_argument(
            "--count",
            type=int,
            default=3,
            help="number of recent published resources to include if --resource-id "
            "is not given",
        )
        digest_parser.add_argument(
            "--group",
            default="Test Digest",
            help="subscription group/source label shown in the email",
        )
        digest_parser.add_argument(
            "--source-channel-type",
            default="saved_search",
            help="controls subject line wording, e.g. saved_search or topic",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Send the requested test email"""
        try:
            user = _resolve_user(options)
        except User.DoesNotExist as exc:
            msg = "No matching user found"
            raise CommandError(msg) from exc

        if options["email_type"] == "welcome":
            self._handle_welcome(user)
        else:
            self._handle_digest(user, options)

    def _handle_welcome(self, user):
        if not user.email:
            self.stdout.write(
                self.style.WARNING(
                    f"User {user.id} has a blank email, send_welcome_email will skip it"
                )
            )
            sys.exit(1)
        send_welcome_email(user.id)
        self.stdout.write(f"Sent welcome email to {user}")

    def _handle_digest(self, user, options):
        if options["resource_ids"]:
            resources = list(
                LearningResource.objects.filter(id__in=options["resource_ids"])
            )
            found_ids = {resource.id for resource in resources}
            missing_ids = set(options["resource_ids"]) - found_ids
            if missing_ids:
                msg = f"No learning resources found for ids: {sorted(missing_ids)}"
                raise CommandError(msg)
        else:
            resources = list(
                LearningResource.objects.filter(published=True).order_by("-created_on")[
                    : options["count"]
                ]
            )
            if not resources:
                msg = "No published learning resources found"
                raise CommandError(msg)

        if user.profile.email_optin is False:
            self.stdout.write(
                self.style.WARNING(
                    f"User {user.id} has opted out of email; the digest email is "
                    "non-transactional and will be silently skipped"
                )
            )

        group = options["group"]
        source_channel_type = options["source_channel_type"]
        rows = [
            self._build_row(resource, user, group, source_channel_type)
            for resource in resources
        ]
        template_data = {group: rows}

        unique_resource_types = {row["resource_type"] for row in rows}
        subject = _generate_subscription_digest_subject(
            rows[0], group, list(unique_resource_types), len(rows), shortform=False
        )

        attempt_send_digest_email_batch([(user.id, template_data)])
        self.stdout.write(f'Sent digest email to {user} with subject "{subject}"')

    @staticmethod
    def _build_row(resource, user, group, source_channel_type):
        search_url = frontend_absolute_url("/search")
        req = PreparedRequest()
        req.prepare_url(search_url, {"resource": resource.id})
        return {
            "resource_url": req.url,
            "resource_title": resource.title,
            "resource_image_url": resource.image.url
            if resource.image
            else frontend_absolute_url("/images/default_resource.jpg"),
            "resource_type": LearningResourceType[resource.resource_type].value,
            "user_id": user.id,
            "source_label": group,
            "source_channel_type": source_channel_type,
            "group": group,
            "search_url": search_url,
        }
