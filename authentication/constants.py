"""Authentication constants"""

from enum import StrEnum

# Query params appended to the frontend URL the user lands back on after a
# Keycloak account action completes. The frontend consumes these once to show a
# success/error alert and then strips them from the URL.
ACCOUNT_ACTION_PARAM = "account_action"
ACCOUNT_ACTION_STATUS_PARAM = "account_action_status"


class AccountAction(StrEnum):
    """Account actions a user can start from the settings page"""

    UPDATE_EMAIL = "update-email"
    UPDATE_PASSWORD = "update-password"  # noqa: S105


def parse_account_action(value: str | None) -> "AccountAction | None":
    """
    Return the AccountAction matching a raw query-string value, or None.

    Prefer this over `value in AccountAction`: membership tests against an enum
    only accept plain values from Python 3.12 onwards, and raise TypeError
    before that, so the explicit lookup keeps the intent obvious and pins the
    behaviour regardless of interpreter version.
    """
    try:
        return AccountAction(value)
    except ValueError:
        return None


class AccountActionStatus(StrEnum):
    """Outcome of an account action, as reported back to the frontend"""

    SUCCESS = "success"
    CANCELLED = "cancelled"
    ERROR = "error"
    # Keycloak accepted the request but hasn't applied it yet. Realms with
    # verify_email enabled — which is all deployed environments — email a
    # confirmation link on an email change and only apply it once that link is
    # clicked, so "success" from Keycloak means "email sent", not "changed".
    PENDING = "pending"
    # The user authenticates through an external identity provider, so the
    # action isn't theirs to perform.
    UNAVAILABLE = "unavailable"


# Maps our URL slugs onto Keycloak's `kc_action` values.
KEYCLOAK_ACTIONS = {
    AccountAction.UPDATE_EMAIL: "UPDATE_EMAIL",
    AccountAction.UPDATE_PASSWORD: "UPDATE_PASSWORD",
}

# Keycloak appends `kc_action_status` to the redirect URI when an application
# initiated action finishes.
KEYCLOAK_ACTION_STATUSES = {
    "success": AccountActionStatus.SUCCESS,
    "cancelled": AccountActionStatus.CANCELLED,
    "error": AccountActionStatus.ERROR,
}
