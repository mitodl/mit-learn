"""Opt-in django-aqueduct settings shim for local development.

Select this module via ``DJANGO_SETTINGS_MODULE=main.settings_aqueduct_dev``
to use the typed settings model in ``main/aqueduct_settings.py`` with missing
values filled in from Vault via OIDC login, instead of requiring a local
``.env`` file. This is non-disruptive: ``main.settings`` remains untouched
and is still the default everywhere it is already configured.

See docs/how-to/aqueduct.md for more details.
"""

from django_aqueduct import configure_django_settings

from main.aqueduct_settings import DevAqueductSettings

configure_django_settings(DevAqueductSettings)
