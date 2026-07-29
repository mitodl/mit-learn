"""Opt-in django-aqueduct settings shim.

Select this module via ``DJANGO_SETTINGS_MODULE=main.settings_aqueduct`` to
use the typed, Vault/AWS-SSM-capable settings model in
``main/aqueduct_settings.py`` instead of ``main/settings.py``. This is
non-disruptive: ``main.settings`` remains untouched and is still the default
everywhere it is already configured (Docker Compose, CI, Heroku, etc.).

Sentry is initialised from the validated model via the ``pre_configure``
hook, mirroring the legacy behaviour of calling ``init_sentry()`` before the
rest of the settings are evaluated.

See docs/how-to/aqueduct.md for more details.
"""

from django_aqueduct import configure_django_settings

from main.aqueduct_settings import AqueductSettings, init_sentry_from_model

configure_django_settings(AqueductSettings, pre_configure=init_sentry_from_model)
