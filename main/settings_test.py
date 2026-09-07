"""
Validate that our settings functions work
"""

import importlib
import re
import sys
import tomllib
from unittest import mock

import pytest
from django.conf import settings
from django.core import mail
from django.core.exceptions import ImproperlyConfigured
from django.test import RequestFactory, TestCase

REQUIRED_SETTINGS = {
    "OPENSEARCH_URL": "http://localhost:9300/",
    "OPENSEARCH_INDEX": "some_index",
    "MAILGUN_SENDER_DOMAIN": "mailgun.fake.domain",
    "MAILGUN_KEY": "fake_mailgun_key",
    "MITOL_COOKIE_NAME": "cookie_monster",
    "MITOL_COOKIE_DOMAIN": "od.fake.domain",
    "MITOL_APP_BASE_URL": "http:localhost:8063/",
    "UNSUBSCRIBE_SECRET_KEY": "fake_unsubscribe_secret_key",  # pragma: allowlist-secret
}


S3_MEDIA_SETTINGS = {
    "MITOL_USE_S3": "True",
    "AWS_ACCESS_KEY_ID": "test123",
    "AWS_SECRET_ACCESS_KEY": "test456",
    "AWS_STORAGE_BUCKET_NAME": "test_bucket",
    "MEDIA_URL": "/media/",
}


class TestSettings(TestCase):
    """Validate that settings work as expected."""

    def tearDown(self):
        """Clean up after each test by reloading settings with base environment."""
        if hasattr(sys.modules["main.settings"], "STORAGES"):
            delattr(sys.modules["main.settings"], "STORAGES")
        clean_env = {**REQUIRED_SETTINGS, "MITOL_USE_S3": "False"}
        with mock.patch.dict("os.environ", clean_env, clear=True):
            importlib.reload(sys.modules["main.settings"])

    def reload_settings(self, module: str = "main.settings"):
        """
        Reload settings module with cleanup to restore it.

        Returns:
            dict: dictionary of the newly reloaded settings ``vars``
        """
        importlib.reload(sys.modules[module])
        # Restore settings to original settings after test
        self.addCleanup(importlib.reload, sys.modules[module])
        return vars(sys.modules[module])

    def test_s3_settings(self):
        """Verify that we enable and configure S3 with a variable"""
        # Unset, we don't do S3
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_USE_S3": "False"},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            storages = settings_vars.get("STORAGES", {})
            assert (
                storages.get("default", {}).get("BACKEND")
                != "storages.backends.s3boto3.S3Boto3Storage"
            )

        with pytest.raises(ImproperlyConfigured):  # noqa: SIM117
            with mock.patch.dict("os.environ", {"MITOL_USE_S3": "True"}, clear=True):
                self.reload_settings()

        # Verify it all works with it enabled and configured 'properly'
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "MITOL_USE_S3": "True",
                "AWS_ACCESS_KEY_ID": "1",
                "AWS_SECRET_ACCESS_KEY": "2",
                "AWS_STORAGE_BUCKET_NAME": "3",
            },
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert (
                settings_vars["STORAGES"]["default"]["BACKEND"]
                == "storages.backends.s3boto3.S3Boto3Storage"
            )

    def test_admin_settings(self):
        """Verify that we configure email with environment variable"""

        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_ADMIN_EMAIL": ""},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert not settings_vars.get("ADMINS", False)

        test_admin_email = "cuddle_bunnies@example.com"
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_ADMIN_EMAIL": test_admin_email},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert (("Admins", test_admin_email),) == settings_vars["ADMINS"]
        # Manually set ADMIN to our test setting and verify e-mail
        # goes where we expect
        settings.ADMINS = (("Admins", test_admin_email),)
        mail.mail_admins("Test", "message")
        assert test_admin_email in mail.outbox[0].to

    def test_db_ssl_enable(self):
        """Verify that we can enable/disable database SSL with a var"""

        # Check default state is SSL on
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings()
            assert settings_vars["DATABASES"]["default"]["OPTIONS"] == {
                "sslmode": "require"
            }

        # Check enabling the setting explicitly
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_DB_DISABLE_SSL": "True"},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert settings_vars["DATABASES"]["default"]["OPTIONS"] == {}

        # Disable it
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_DB_DISABLE_SSL": "False"},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert settings_vars["DATABASES"]["default"]["OPTIONS"] == {
                "sslmode": "require"
            }

    def test_secure_proxy_ssl_header(self):
        """SECURE_PROXY_SSL_HEADER is set by default and removable with the env var"""

        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings()
            assert settings_vars["SECURE_PROXY_SSL_HEADER"] == (
                "HTTP_X_FORWARDED_PROTO",
                "https",
            )

        # reload() doesn't remove attributes the gated-off module no longer sets
        delattr(sys.modules["main.settings"], "SECURE_PROXY_SSL_HEADER")
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_SECURE_PROXY_SSL_HEADER": "False"},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert "SECURE_PROXY_SSL_HEADER" not in settings_vars

    def test_x_forwarded_proto_makes_request_secure(self):
        """Only X-Forwarded-Proto: https marks a request as secure"""
        factory = RequestFactory()
        assert factory.get("/", HTTP_X_FORWARDED_PROTO="https").is_secure() is True
        assert factory.get("/", HTTP_X_FORWARDED_PROTO="http").is_secure() is False
        assert factory.get("/").is_secure() is False

    def test_opensearch_index_pr_build(self):
        """For PR builds we will use the heroku app name instead of the given OPENSEARCH_INDEX"""
        index_name = "heroku_app_name_as_index"
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "HEROKU_APP_NAME": index_name,
                "HEROKU_PARENT_APP_NAME": "some_name",
            },
        ):
            settings_vars = self.reload_settings()
            assert settings_vars["OPENSEARCH_INDEX"] == index_name

    @pytest.mark.skip(
        reason="The version format does not yet match until the Concourse pipeline takes over from Doof"
    )
    def test_bump_my_version_format(self):
        """Verify VERSION is in sync with pyproject.toml and matches a version format."""
        with open("pyproject.toml", "rb") as f:  # noqa: PTH123
            pyproject = tomllib.load(f)
        version_pattern = pyproject["tool"]["bumpversion"]["parse"]
        package_version = pyproject["project"]["version"]
        assert package_version == settings.VERSION
        semver_pattern = r"[0-9]+\.[0-9]+\.[0-9]+"
        assert re.fullmatch(version_pattern, settings.VERSION) or re.fullmatch(
            semver_pattern, settings.VERSION
        ), f'VERSION "{settings.VERSION}" does not match calver or semver format'

    def test_required_settings(self):
        """
        Assert that an exception is raised if any of the required settings are missing
        """
        for key in REQUIRED_SETTINGS:
            required_settings = {**REQUIRED_SETTINGS}
            del required_settings[key]
            with (
                mock.patch.dict("os.environ", required_settings, clear=True),
                pytest.raises(ImproperlyConfigured),
            ):
                self.reload_settings()

    def test_server_side_cursors_disabled(self):
        """DISABLE_SERVER_SIDE_CURSORS should be true by default"""
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS):
            settings_vars = self.reload_settings()
            assert (
                settings_vars["DEFAULT_DATABASE_CONFIG"]["DISABLE_SERVER_SIDE_CURSORS"]
                is True
            )

    def test_server_side_cursors_enabled(self):
        """DISABLE_SERVER_SIDE_CURSORS should be false if MITOL_DB_DISABLE_SS_CURSORS is false"""
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_DB_DISABLE_SS_CURSORS": "False"},
        ):
            settings_vars = self.reload_settings()
            assert (
                settings_vars["DEFAULT_DATABASE_CONFIG"]["DISABLE_SERVER_SIDE_CURSORS"]
                is False
            )

    def test_cookie_tombstone_middleware_enabled(self):
        """Cookie tombstone middleware should be enabled when tombstones are configured."""
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "COOKIE_TOMBSTONES": (
                    '[{"name":"csrftoken","domain":".learn.mit.edu","path":"/"}]'
                ),
            },
            clear=True,
        ):
            settings_vars = self.reload_settings()
            assert (
                "main.middleware.cookie_tombstones.CookieTombstoneMiddleware"
                in (settings_vars["MIDDLEWARE"])
            )

    def test_cookie_tombstone_middleware_disabled(self):
        """Cookie tombstone middleware should be disabled when tombstones are unset."""
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings()
            assert (
                "main.middleware.cookie_tombstones.CookieTombstoneMiddleware"
                not in (settings_vars["MIDDLEWARE"])
            )

    def test_cookie_tombstone_middleware_ordering(self):
        """Cookie tombstone middleware should be first in the middleware stack."""
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "COOKIE_TOMBSTONES": (
                    '[{"name":"csrftoken","domain":".learn.mit.edu","path":"/"}]'
                ),
            },
            clear=True,
        ):
            settings_vars = self.reload_settings()
            middleware = settings_vars["MIDDLEWARE"]
            assert (
                middleware[0]
                == "main.middleware.cookie_tombstones.CookieTombstoneMiddleware"
            )

    def test_celery_beat_disabled(self):
        """Test that we can disable celery beat with an env var"""
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "CELERY_BEAT_DISABLED": "True",
            },
            clear=True,
        ):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert settings_vars["CELERY_BEAT_DISABLED"] is True
            assert settings_vars["CELERY_BEAT_SCHEDULE"] == {}

    def test_celery_beat_enabled(self):
        """Test celery beat is enabled by default"""
        with mock.patch.dict(
            "os.environ",
            REQUIRED_SETTINGS,  # Don't set CELERY_DISABLE_BEAT - test default
            clear=True,
        ):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert settings_vars["CELERY_BEAT_DISABLED"] is False
            assert (
                "update_next-start-date-every-1-days"
                in settings_vars["CELERY_BEAT_SCHEDULE"]
            )

    def test_celery_result_expires_default(self):
        """Celery result expiry defaults to 1 hour"""
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert settings_vars["CELERY_RESULT_EXPIRES"] == 60 * 60

    def test_celery_result_expires_override(self):
        """Celery result expiry is configurable via an env var"""
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "CELERY_RESULT_EXPIRES": "120",
            },
            clear=True,
        ):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert settings_vars["CELERY_RESULT_EXPIRES"] == 120

    def test_warehouse_etl_cutover_sources_empty_by_default(self):
        """No warehouse-pull sources are cut over by default."""
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert settings_vars["WAREHOUSE_ETL_CUTOVER_SOURCES"] == []

    def test_warehouse_etl_cutover_sources_rejects_unknown_source(self):
        """A typo'd source name fails loudly rather than silently no-op'ing —
        _API_ETL_BEAT_ENTRIES_BY_SOURCE starts empty (no source has landed a
        warehouse-pull task yet), so any non-empty value is "unknown" today.
        """
        with (
            mock.patch.dict(
                "os.environ",
                {
                    **REQUIRED_SETTINGS,
                    "WAREHOUSE_ETL_CUTOVER_SOURCES": "mitxonline",
                },
                clear=True,
            ),
            pytest.raises(ImproperlyConfigured, match="mitxonline"),
        ):
            self.reload_settings(module="main.settings_celery")

    def test_program_certificates_beat_entry_absent_without_starrocks_host(self):
        """The certificate-sync beat entry isn't registered when StarRocks
        isn't configured, so it can't fail on every tick in an environment
        without warehouse connectivity.
        """
        with mock.patch.dict("os.environ", REQUIRED_SETTINGS, clear=True):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert (
                "warehouse-sync-program-certificates-every-1-days"
                not in settings_vars["CELERY_BEAT_SCHEDULE"]
            )

    def test_program_certificates_beat_entry_absent_with_only_starrocks_host(self):
        """STARROCKS_HOST alone isn't enough — _connect_starrocks also
        requires STARROCKS_USER, so gating on host alone would schedule a
        task that fails every run with ImproperlyConfigured.
        """
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "STARROCKS_HOST": "starrocks.example.com"},
            clear=True,
        ):
            settings_vars = self.reload_settings(module="main.settings_celery")
            assert (
                "warehouse-sync-program-certificates-every-1-days"
                not in settings_vars["CELERY_BEAT_SCHEDULE"]
            )

    def test_program_certificates_beat_entry_present_with_starrocks_configured(self):
        """The certificate-sync beat entry is registered once StarRocks is
        fully configured (host and user), pointing at
        profiles.tasks.SyncProgramCertificatesTask.
        """
        with mock.patch.dict(
            "os.environ",
            {
                **REQUIRED_SETTINGS,
                "STARROCKS_HOST": "starrocks.example.com",
                "STARROCKS_USER": "testuser",
            },
            clear=True,
        ):
            settings_vars = self.reload_settings(module="main.settings_celery")
            entry = settings_vars["CELERY_BEAT_SCHEDULE"][
                "warehouse-sync-program-certificates-every-1-days"
            ]
            assert entry["task"] == "profiles.tasks.SyncProgramCertificatesTask"
            assert entry["kwargs"] == {"full_refresh": True}

    def _assert_s3_storage_config(
        self,
        storages_dict,
        use_s3,
        custom_domain=None,
        s3_prefix=None,
    ):
        """
        Validate STORAGES configuration.

        Args:
            storages_dict: The STORAGES dict from settings (None if MITOL_USE_S3 is False)
            use_s3: Whether S3 is enabled
            custom_domain: Expected custom domain value
            s3_prefix: Expected S3 prefix value
        """
        if not use_s3:
            # When S3 is disabled, STORAGES may not be defined or should not use S3 backend
            if storages_dict:
                assert storages_dict.get("default", {}).get("BACKEND") != (
                    "storages.backends.s3boto3.S3Boto3Storage"
                )
        else:
            # When S3 is enabled, verify the backend
            assert storages_dict["default"]["BACKEND"] == (
                "storages.backends.s3boto3.S3Boto3Storage"
            )
            assert storages_dict["staticfiles"]["BACKEND"] == (
                "django.contrib.staticfiles.storage.StaticFilesStorage"
            )

            # Verify OPTIONS are set correctly based on custom_domain and s3_prefix
            options = storages_dict["default"].get("OPTIONS", {})

            if custom_domain:
                assert options.get("custom_domain") == custom_domain
            else:
                assert "custom_domain" not in options

            if s3_prefix:
                assert options.get("location") == s3_prefix
            else:
                assert "location" not in options

            # If neither custom_domain nor s3_prefix, OPTIONS should be empty or absent
            if not custom_domain and not s3_prefix:
                assert not options

    def test_storages_configuration_with_s3_disabled(self):
        """Verify STORAGES is not configured for S3 when MITOL_USE_S3 is False"""
        with mock.patch.dict(
            "os.environ",
            {**REQUIRED_SETTINGS, "MITOL_USE_S3": "False"},
            clear=True,
        ):
            settings_vars = self.reload_settings()
            self._assert_s3_storage_config(
                storages_dict=settings_vars.get("STORAGES", {}),
                use_s3=False,
            )

    def test_storages_configuration_combinations(self):
        """Test STORAGES configuration with all combinations of AWS_S3_CUSTOM_DOMAIN and AWS_S3_PREFIX"""
        test_cases = [
            {
                "name": "S3 enabled, no custom domain, no prefix",
                "custom_domain": None,
                "s3_prefix": None,
            },
            {
                "name": "S3 enabled, custom domain set, no prefix",
                "custom_domain": "cdn.example.com",
                "s3_prefix": None,
            },
            {
                "name": "S3 enabled, no custom domain, prefix set",
                "custom_domain": None,
                "s3_prefix": "media/uploads",
            },
            {
                "name": "S3 enabled, custom domain and prefix both set",
                "custom_domain": "cdn.example.com",
                "s3_prefix": "media/uploads",
            },
        ]

        for test_case in test_cases:
            with self.subTest(test_case["name"]):
                env_vars = {**REQUIRED_SETTINGS, **S3_MEDIA_SETTINGS}

                # Only add env vars if they have values (simulating None/unset)
                if test_case["custom_domain"]:
                    env_vars["AWS_S3_CUSTOM_DOMAIN"] = test_case["custom_domain"]

                if test_case["s3_prefix"]:
                    env_vars["AWS_S3_PREFIX"] = test_case["s3_prefix"]

                with mock.patch.dict("os.environ", env_vars, clear=True):
                    settings_vars = self.reload_settings()
                    self._assert_s3_storage_config(
                        storages_dict=settings_vars["STORAGES"],
                        use_s3=True,
                        custom_domain=test_case["custom_domain"],
                        s3_prefix=test_case["s3_prefix"],
                    )
