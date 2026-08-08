"""Provision the credentials Keycloak uses to push user changes into Learn"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_application_model
from oauthlib.common import generate_token

User = get_user_model()
Application = get_application_model()
AccessToken = get_access_token_model()

DEFAULT_USERNAME = "scim-keycloak"
APPLICATION_NAME = "keycloak-scim"
DEFAULT_EXPIRY_DAYS = 3650


class Command(BaseCommand):
    """
    Create the service user and OAuth2 application for inbound SCIM.

    Learn's SCIM endpoints are guarded by Learn's own OAuth2 provider, not by
    Keycloak: `OAuth2TokenMiddleware` resolves the bearer token to a user, and
    `mitol.scim.utils.is_authenticated_predicate` then requires that user to be
    active and staff. So Keycloak needs a token belonging to a staff account here
    before it can push anything.

    That rules out the client_credentials grant: those tokens are issued to the
    application rather than a person, so `AccessToken.user` is null and the
    predicate rejects them with a 401. What works is a bearer token bound to the
    service user, which is what this issues — configure the Keycloak provider with
    auth type BEARER.

    Idempotent. Run once per environment, then give the printed token to whoever
    configures the Keycloak SCIM provider — it is the only thing that uses it.

    Unlike Application.client_secret, AccessToken.token is stored unhashed, so an
    existing token can be read back rather than rotated:

        AccessToken.objects.get(user__username="scim-keycloak").token
    """

    help = "Provision the service user and OAuth2 client Keycloak uses for SCIM"

    def add_arguments(self, parser):
        """Add command arguments"""
        parser.add_argument(
            "--username",
            default=DEFAULT_USERNAME,
            help=f"Username for the service account (default: {DEFAULT_USERNAME})",
        )
        parser.add_argument(
            "--client-id",
            help="Use a specific client id instead of a generated one",
        )
        parser.add_argument(
            "--token",
            help="Use a specific token value instead of a generated one",
        )
        parser.add_argument(
            "--rotate-token",
            action="store_true",
            help=(
                "Replace the existing token with a new one. Access tokens are "
                "stored unhashed, so an existing one can be read back instead of "
                "rotated if it is merely mislaid."
            ),
        )
        parser.add_argument(
            "--expires-days",
            type=int,
            default=DEFAULT_EXPIRY_DAYS,
            help=(
                f"How long the token is valid for (default: {DEFAULT_EXPIRY_DAYS} days)"
            ),
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Provision the service user, application and bearer token"""
        username = options["username"]

        with transaction.atomic():
            user, user_created = User.objects.get_or_create(
                username=username,
                defaults={
                    # Never receives mail; it exists to own an access token.
                    "email": f"{username}@localhost",
                    "is_staff": True,
                    "is_active": True,
                },
            )
            if user_created:
                # No one signs in as this account; it exists to own a token.
                user.set_unusable_password()
                user.save(update_fields=["password"])
            elif not (user.is_staff and user.is_active):
                # is_authenticated_predicate rejects the push otherwise.
                user.is_staff = True
                user.is_active = True
                user.save(update_fields=["is_staff", "is_active"])
                self.stdout.write(
                    self.style.WARNING(
                        f"Existing user {username} was not active staff; corrected."
                    )
                )

            # The application is only a container the token can hang off; the
            # grant type is irrelevant because Keycloak never runs a grant flow.
            application, _ = Application.objects.get_or_create(
                name=APPLICATION_NAME,
                defaults={
                    "user": user,
                    "client_type": Application.CLIENT_CONFIDENTIAL,
                    "authorization_grant_type": Application.GRANT_CLIENT_CREDENTIALS,
                },
            )

            existing = AccessToken.objects.filter(
                application=application, user=user
            ).order_by("-expires")
            token = None

            if options["rotate_token"] or not existing.exists():
                existing.delete()
                token = options["token"] or generate_token()
                AccessToken.objects.create(
                    user=user,
                    application=application,
                    token=token,
                    expires=timezone.now() + timedelta(days=options["expires_days"]),
                    scope="read write",
                )

        self.stdout.write(self.style.SUCCESS(f"\nSCIM client '{APPLICATION_NAME}'"))
        self.stdout.write(f"  service user : {username} (staff)")
        if token:
            self.stdout.write(f"  bearer token : {token}")
            self.stdout.write(
                self.style.WARNING(
                    "  ^ paste into Keycloak's SCIM provider config (auth: BEARER)."
                )
            )
        else:
            current = existing.first()
            self.stdout.write(
                f"  bearer token : unchanged (expires {current.expires:%Y-%m-%d})"
            )

        base_url = (settings.MITOL_API_BASE_URL or "").removesuffix("/")
        self.stdout.write("\nGive Keycloak's SCIM provider config:")
        self.stdout.write(f"  base URL      : {base_url}/scim/v2/")
        self.stdout.write("  auth type     : BEARER")
        self.stdout.write("")
