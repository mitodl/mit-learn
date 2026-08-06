"""Tests for the provision_scim_client command"""

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from oauth2_provider.models import get_access_token_model, get_application_model

User = get_user_model()
Application = get_application_model()
AccessToken = get_access_token_model()

pytestmark = pytest.mark.django_db


def test_provisions_a_staff_user_and_bound_token():
    """
    The token must belong to an active staff user.

    mitol.scim.utils.is_authenticated_predicate requires exactly that, so a token
    without a user — which is what the client_credentials grant issues — gets a
    401 from the SCIM endpoints.
    """
    call_command("provision_scim_client")

    user = User.objects.get(username="scim-keycloak")
    assert user.is_staff
    assert user.is_active
    assert not user.has_usable_password()

    token = AccessToken.objects.get(user=user)
    assert token.user == user
    assert "read" in token.scope
    assert "write" in token.scope


def test_is_idempotent():
    """Re-running must not duplicate the user, application or token"""
    call_command("provision_scim_client")
    first = AccessToken.objects.get(user__username="scim-keycloak").token

    call_command("provision_scim_client")

    assert User.objects.filter(username="scim-keycloak").count() == 1
    assert Application.objects.filter(name="keycloak-scim").count() == 1
    assert AccessToken.objects.filter(user__username="scim-keycloak").count() == 1
    # An existing token is left alone — it can't be displayed again, so replacing
    # it silently would break whatever is already configured with it.
    assert AccessToken.objects.get(user__username="scim-keycloak").token == first


def test_rotate_token_replaces_it():
    """--rotate-token issues a new token and drops the old one"""
    call_command("provision_scim_client")
    original = AccessToken.objects.get(user__username="scim-keycloak").token

    call_command("provision_scim_client", "--rotate-token")

    tokens = AccessToken.objects.filter(user__username="scim-keycloak")
    assert tokens.count() == 1
    assert tokens.first().token != original


def test_repairs_a_downgraded_service_user():
    """A service user that lost staff or active is corrected rather than skipped"""
    User.objects.create(username="scim-keycloak", is_staff=False, is_active=False)

    call_command("provision_scim_client")

    user = User.objects.get(username="scim-keycloak")
    assert user.is_staff
    assert user.is_active


def test_accepts_an_explicit_token():
    """An explicit token lets an environment reuse a value it already holds"""
    known = "a-known-value"
    call_command("provision_scim_client", "--token", known)

    assert AccessToken.objects.get(user__username="scim-keycloak").token == known
