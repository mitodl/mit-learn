"""
Django settings for main.


For more information on this file, see
https://docs.djangoproject.com/en/1.10/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.10/ref/settings/

"""

# pylint:disable=wildcard-import,unused-wildcard-import)
import datetime
import logging
import os
import platform
from urllib.parse import urljoin

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from mitol.scim.settings.scim import *  # noqa: F403

from main.envs import (
    get_bool,
    get_float,
    get_int,
    get_list_of_str,
    get_string,
)
from main.sentry import init_sentry
from main.settings_celery import *  # noqa: F403
from main.settings_course_etl import *  # noqa: F403
from main.settings_pluggy import *  # noqa: F403
from openapi.settings_spectacular import open_spectacular_settings

VERSION = "0.55.8"

log = logging.getLogger()

ENVIRONMENT = get_string("MITOL_ENVIRONMENT", "dev")
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# initialize Sentry before doing anything else so we capture any config errors
SENTRY_DSN = get_string("SENTRY_DSN", "")
SENTRY_LOG_LEVEL = get_string("SENTRY_LOG_LEVEL", "ERROR")
SENTRY_TRACES_SAMPLE_RATE = get_float("SENTRY_TRACES_SAMPLE_RATE", 0)
SENTRY_PROFILES_SAMPLE_RATE = get_float("SENTRY_PROFILES_SAMPLE_RATE", 0)
init_sentry(
    dsn=SENTRY_DSN,
    environment=ENVIRONMENT,
    version=VERSION,
    log_level=SENTRY_LOG_LEVEL,
    traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
    profiles_sample_rate=SENTRY_PROFILES_SAMPLE_RATE,
)

BASE_DIR = os.path.dirname(  # noqa: PTH120
    os.path.dirname(os.path.abspath(__file__))  # noqa: PTH100, PTH120
)

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.8/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = get_string("SECRET_KEY", "terribly_unsafe_default_secret_key")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = get_bool("DEBUG", False)  # noqa: FBT003

ALLOWED_HOSTS = ["*"]
ALLOWED_REDIRECT_HOSTS = get_list_of_str(
    "ALLOWED_REDIRECT_HOSTS",
    [
        "open.odl.local:8062",
        "ocw.mit.edu",
    ],
)

AUTH_USER_MODEL = "users.User"

SECURE_SSL_REDIRECT = get_bool("MITOL_SECURE_SSL_REDIRECT", True)  # noqa: FBT003
SECURE_REDIRECT_EXEMPT = [
    "^health/startup/$",
    "^health/liveness/$",
    "^health/readiness/$",
    "^health/full/$",
]

SITE_ID = 1
APP_BASE_URL = get_string("MITOL_APP_BASE_URL", None)
if not APP_BASE_URL:
    msg = "MITOL_APP_BASE_URL is not set"
    raise ImproperlyConfigured(msg)
MITOL_TITLE = get_string("MITOL_TITLE", "MIT Learn")


# Application definition

INSTALLED_APPS = (
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "django.contrib.sites",
    "django_removals",
    "django_scim",
    "social_django",
    "server_status",
    "rest_framework",
    "corsheaders",
    "anymail",
    "guardian",
    "imagekit",
    "django_json_widget",
    "django_filters",
    "drf_spectacular",
    # Put our apps after this point
    "main",
    "users.apps.UsersConfig",
    "authentication",
    "channels",
    "profiles",
    "webhooks",
    "widgets",
    "learning_resources",
    "learning_resources_search",
    "openapi",
    "articles",
    "oauth2_provider",
    "news_events",
    "testimonials",
    "data_fixtures",
    "vector_search",
    "video_shorts",
    "mitol.scim.apps.ScimApp",
    "health_check",
    "health_check.cache",
    "health_check.contrib.migrations",
    "health_check.contrib.celery_ping",
    "health_check.contrib.redis",
    "health_check.contrib.db_heartbeat",
)

WEBHOOK_SECRET = get_string("WEBHOOK_SECRET", "please-change-this")

HEALTH_CHECK = {
    "SUBSETS": {
        # The 'startup' subset includes checks that must pass before the application can
        # start.
        "startup": [
            "MigrationsHealthCheck",  # Ensures database migrations are applied.
            "CacheBackend",  # Verifies the cache backend is operational.
            "RedisHealthCheck",  # Confirms Redis is reachable and functional.
            "DatabaseHeartBeatCheck",  # Checks the database connection is alive.
        ],
        # The 'liveness' subset includes checks to determine if the application is
        # running.
        "liveness": ["DatabaseHeartBeatCheck"],  # Minimal check to ensure the app is
        # alive.
        # The 'readiness' subset includes checks to determine if the application is
        # ready to serve requests.
        "readiness": [
            "CacheBackend",  # Ensures the cache is ready for use.
            "RedisHealthCheck",  # Confirms Redis is ready for use.
            "DatabaseHeartBeatCheck",  # Verifies the database is ready for queries.
        ],
        # The 'full' subset includes all available health checks for a comprehensive
        # status report.
        "full": [
            "MigrationsHealthCheck",  # Ensures database migrations are applied.
            "CacheBackend",  # Verifies the cache backend is operational.
            "RedisHealthCheck",  # Confirms Redis is reachable and functional.
            "DatabaseHeartBeatCheck",  # Checks the database connection is alive.
            "CeleryPingHealthCheck",  # Verifies Celery workers are responsive.
        ],
    }
}

if not get_bool("RUN_DATA_MIGRATIONS", default=False):
    MIGRATION_MODULES = {"data_fixtures": None}

SCIM_SERVICE_PROVIDER["USER_ADAPTER"] = "users.adapters.LearnUserAdapter"  # noqa: F405

# OAuth2TokenMiddleware must be before SCIMAuthCheckMiddleware
# in order to insert request.user into the request.
MIDDLEWARE = (
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "main.middleware.apisix_user.ApisixUserMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "authentication.middleware.BlockedIPMiddleware",
    "oauth2_provider.middleware.OAuth2TokenMiddleware",
    "django_scim.middleware.SCIMAuthCheckMiddleware",
)

ZEAL_ENABLE = get_bool("ZEAL_ENABLE", False)  # noqa: FBT003

# enable the zeal nplusone profiler only in debug mode or under pytest
if ZEAL_ENABLE or ENVIRONMENT == "pytest":
    INSTALLED_APPS += ("zeal",)
    # this should be the first middleware so we catch any issues in our own middleware
    MIDDLEWARE += ("zeal.middleware.zeal_middleware",)

ZEAL_RAISE = False
ZEAL_ALLOWLIST = []

# CORS
CORS_ALLOWED_ORIGINS = get_list_of_str("CORS_ALLOWED_ORIGINS", [])
CORS_ALLOWED_ORIGIN_REGEXES = get_list_of_str("CORS_ALLOWED_ORIGIN_REGEXES", [])

CORS_ALLOW_CREDENTIALS = get_bool("CORS_ALLOW_CREDENTIALS", True)  # noqa: FBT003
CORS_ALLOW_HEADERS = (
    # defaults
    "accept",
    "authorization",
    "content-type",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    # sentry tracing
    "baggage",
    "sentry-trace",
)

SECURE_CROSS_ORIGIN_OPENER_POLICY = get_string(
    "SECURE_CROSS_ORIGIN_OPENER_POLICY",
    "same-origin",
)

CSRF_COOKIE_SECURE = get_bool("CSRF_COOKIE_SECURE", True)  # noqa: FBT003
CSRF_COOKIE_DOMAIN = get_string("CSRF_COOKIE_DOMAIN", None)
CSRF_COOKIE_NAME = get_string("CSRF_COOKIE_NAME", "csrftoken")

CSRF_HEADER_NAME = get_string("CSRF_HEADER_NAME", "HTTP_X_CSRFTOKEN")

CSRF_TRUSTED_ORIGINS = get_list_of_str("CSRF_TRUSTED_ORIGINS", [])

SESSION_COOKIE_DOMAIN = get_string("SESSION_COOKIE_DOMAIN", None)
SESSION_COOKIE_NAME = get_string("SESSION_COOKIE_NAME", "sessionid")

# enable the nplusone profiler only in debug mode
if DEBUG:
    INSTALLED_APPS += ("nplusone.ext.django",)
    MIDDLEWARE += ("nplusone.ext.django.NPlusOneMiddleware",)

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
MITOL_NEW_USER_LOGIN_URL = get_string(
    "MITOL_NEW_USER_LOGIN_URL", "http://open.odl.local:8062/onboarding"
)
LOGIN_REDIRECT_URL = "/app"
LOGIN_URL = "/login"
LOGIN_ERROR_URL = "/login"
LOGOUT_REDIRECT_URL = "/app"
MITOL_API_BASE_URL = get_string("MITOL_API_BASE_URL", "")
OIDC_LOGOUT_URL = get_string(
    # urljoin might lead to wrong outputs with url rewrites like
    # https://api.learn.mit.edu/learn/, so using rstrip('/') instead.
    "OIDC_LOGOUT_URL",
    f"{MITOL_API_BASE_URL.rstrip('/')}/logout/oidc",
)

MITOL_TOS_URL = get_string(
    "MITOL_TOS_URL", urljoin(APP_BASE_URL, "/terms-and-conditions/")
)

ROOT_URLCONF = "main.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR + "/templates/",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "social_django.context_processors.backends",
                "social_django.context_processors.login_redirect",
            ]
        },
    }
]

WSGI_APPLICATION = "main.wsgi.application"

# Database
# https://docs.djangoproject.com/en/1.8/ref/settings/#databases
# Uses DATABASE_URL to configure with sqlite default:
# For URL structure:
# https://github.com/kennethreitz/dj-database-url
DEFAULT_DATABASE_CONFIG = dj_database_url.parse(
    get_string(
        "DATABASE_URL",
        "sqlite:///{}".format(os.path.join(BASE_DIR, "db.sqlite3")),  # noqa: PTH118
    )
)
DEFAULT_DATABASE_CONFIG["DISABLE_SERVER_SIDE_CURSORS"] = get_bool(
    "MITOL_DB_DISABLE_SS_CURSORS",
    True,  # noqa: FBT003
)
DEFAULT_DATABASE_CONFIG["CONN_MAX_AGE"] = get_int("MITOL_DB_CONN_MAX_AGE", 0)

if get_bool("MITOL_DB_DISABLE_SSL", False):  # noqa: FBT003
    DEFAULT_DATABASE_CONFIG["OPTIONS"] = {}
else:
    DEFAULT_DATABASE_CONFIG["OPTIONS"] = {"sslmode": "require"}

DATABASES = {"default": DEFAULT_DATABASE_CONFIG}

DATABASE_ROUTERS = ["main.routers.ExternalSchemaRouter"]

EXTERNAL_MODELS = ["programcertificate"]

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_L10N = True

USE_TZ = True

AUTHENTICATION_BACKENDS = (
    "oauth2_provider.backends.OAuth2Backend",
    # the following needs to stay here to allow login of local users
    "django.contrib.auth.backends.ModelBackend",
    "guardian.backends.ObjectPermissionBackend",
)


USERINFO_URL = get_string(
    name="USERINFO_URL",
    default=None,
)

ACCESS_TOKEN_URL = get_string(
    name="ACCESS_TOKEN_URL",
    default=None,
)

AUTHORIZATION_URL = get_string(
    name="AUTHORIZATION_URL",
    default=None,
)

APISIX_USERDATA_MAP = {
    "users.User": {
        "email": "email",
        "global_id": "sub",
        "username": "preferred_username",
        "first_name": "given_name",
        "last_name": "family_name",
        "name": "name",
        "organizations": "organization",
    },
    "profiles.Profile": {
        "name": "name",
        "email_optin": "emailOptIn",
    },
}
DISABLE_APISIX_USER_MIDDLEWARE = get_bool(
    name="DISABLE_APISIX_USER_MIDDLEWARE",
    default=False,
)

# Social Auth configurations - [END]

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.8/howto/static-files/

# Serve static files with dj-static
STATIC_URL = "/static/"

STATIC_ROOT = "staticfiles"

# Important to define this so DEBUG works properly
INTERNAL_IPS = (get_string("HOST_IP", "127.0.0.1"),)

NOTIFICATION_ATTEMPT_RATE_LIMIT = "600/m"

NOTIFICATION_ATTEMPT_CHUNK_SIZE = 100

# Configure e-mail settings
EMAIL_BACKEND = get_string(
    "MITOL_EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = get_string("MITOL_EMAIL_HOST", "localhost")
EMAIL_PORT = get_int("MITOL_EMAIL_PORT", 25)
EMAIL_HOST_USER = get_string("MITOL_EMAIL_USER", "")
EMAIL_HOST_PASSWORD = get_string("MITOL_EMAIL_PASSWORD", "")
EMAIL_USE_TLS = get_bool("MITOL_EMAIL_TLS", False)  # noqa: FBT003
EMAIL_SUPPORT = get_string("MITOL_SUPPORT_EMAIL", "support@example.com")
DEFAULT_FROM_EMAIL = get_string("MITOL_FROM_EMAIL", "webmaster@localhost")

MAILGUN_SENDER_DOMAIN = get_string("MAILGUN_SENDER_DOMAIN", None)
if not MAILGUN_SENDER_DOMAIN:
    msg = "MAILGUN_SENDER_DOMAIN not set"
    raise ImproperlyConfigured(msg)
MAILGUN_KEY = get_string("MAILGUN_KEY", None)
if not MAILGUN_KEY:
    msg = "MAILGUN_KEY not set"
    raise ImproperlyConfigured(msg)
MAILGUN_RECIPIENT_OVERRIDE = get_string("MAILGUN_RECIPIENT_OVERRIDE", None)
MAILGUN_FROM_EMAIL = get_string("MAILGUN_FROM_EMAIL", "no-reply@example.com")
MAILGUN_BCC_TO_EMAIL = get_string("MAILGUN_BCC_TO_EMAIL", None)

ANYMAIL = {
    "MAILGUN_API_KEY": MAILGUN_KEY,
    "MAILGUN_SENDER_DOMAIN": MAILGUN_SENDER_DOMAIN,
}

NOTIFICATION_EMAIL_BACKEND = get_string(
    "MITOL_NOTIFICATION_EMAIL_BACKEND", "anymail.backends.test.EmailBackend"
)
# e-mail configurable admins
ADMIN_EMAIL = get_string("MITOL_ADMIN_EMAIL", "")
ADMINS = (("Admins", ADMIN_EMAIL),) if ADMIN_EMAIL != "" else ()

# embed.ly configuration
EMBEDLY_KEY = get_string("EMBEDLY_KEY", None)
EMBEDLY_EMBED_URL = get_string("EMBEDLY_EMBED_URL", "https://api.embed.ly/1/oembed")
EMBEDLY_EXTRACT_URL = get_string("EMBEDLY_EMBED_URL", "https://api.embed.ly/1/extract")

# configuration for CKEditor token endpoint
CKEDITOR_ENVIRONMENT_ID = get_string("CKEDITOR_ENVIRONMENT_ID", None)
CKEDITOR_SECRET_KEY = get_string("CKEDITOR_SECRET_KEY", None)
CKEDITOR_UPLOAD_URL = get_string("CKEDITOR_UPLOAD_URL", None)

# Logging configuration
LOG_LEVEL = get_string("MITOL_LOG_LEVEL", "INFO")
DJANGO_LOG_LEVEL = get_string("DJANGO_LOG_LEVEL", "INFO")
OS_LOG_LEVEL = get_string("OS_LOG_LEVEL", "INFO")

HOSTNAME = platform.node().split(".")[0]

# nplusone profiler logger configuration
NPLUSONE_LOGGER = logging.getLogger("nplusone")
NPLUSONE_LOG_LEVEL = logging.ERROR

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"require_debug_false": {"()": "django.utils.log.RequireDebugFalse"}},
    "formatters": {
        "verbose": {
            "format": (
                "[%(asctime)s] %(levelname)s %(process)d [%(name)s] "
                "%(filename)s:%(lineno)d - "
                f"[{HOSTNAME}] - %(message)s"
            ),
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "level": LOG_LEVEL,
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "mail_admins": {
            "level": "ERROR",
            "filters": ["require_debug_false"],
            "class": "django.utils.log.AdminEmailHandler",
        },
    },
    "loggers": {
        "django": {
            "propagate": True,
            "level": DJANGO_LOG_LEVEL,
            "handlers": ["console"],
        },
        "django.request": {
            "handlers": ["mail_admins"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": True,
        },
        "opensearch": {"level": OS_LOG_LEVEL},
        "nplusone": {"handlers": ["console"], "level": "ERROR"},
        "boto3": {"handlers": ["console"], "level": "ERROR"},
        "zeal": {"handlers": ["console"], "level": "ERROR"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}

STATUS_TOKEN = get_string("STATUS_TOKEN", "")

GA_TRACKING_ID = get_string("GA_TRACKING_ID", "")
GA_G_TRACKING_ID = get_string("GA_G_TRACKING_ID", "")

REACT_GA_DEBUG = get_bool("REACT_GA_DEBUG", False)  # noqa: FBT003

RECAPTCHA_SITE_KEY = get_string("RECAPTCHA_SITE_KEY", "")
RECAPTCHA_SECRET_KEY = get_string("RECAPTCHA_SECRET_KEY", "")

# Fastly CDN settings
FASTLY_API_KEY = get_string("FASTLY_API_KEY", "")
FASTLY_URL = get_string("FASTLY_URL", "https://api.fastly.com")

MEDIA_ROOT = get_string("MEDIA_ROOT", "/var/media/")
MEDIA_URL = "/media/"
MITOL_USE_S3 = get_bool("MITOL_USE_S3", False)  # noqa: FBT003
AWS_S3_CUSTOM_DOMAIN = get_string("AWS_S3_CUSTOM_DOMAIN", None)
AWS_S3_PREFIX = get_string("AWS_S3_PREFIX", None)

if MITOL_USE_S3:
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    OPTIONS = {}
    if AWS_S3_CUSTOM_DOMAIN:
        OPTIONS["custom_domain"] = AWS_S3_CUSTOM_DOMAIN
    if AWS_S3_PREFIX:
        OPTIONS["location"] = AWS_S3_PREFIX
    if OPTIONS:
        STORAGES["default"]["OPTIONS"] = OPTIONS

AWS_ACCESS_KEY_ID = get_string("AWS_ACCESS_KEY_ID", False)  # noqa: FBT003
AWS_SECRET_ACCESS_KEY = get_string("AWS_SECRET_ACCESS_KEY", False)  # noqa: FBT003
AWS_STORAGE_BUCKET_NAME = get_string("AWS_STORAGE_BUCKET_NAME", False)  # noqa: FBT003
AWS_QUERYSTRING_AUTH = get_string("AWS_QUERYSTRING_AUTH", False)  # noqa: FBT003
# Provide nice validation of the configuration
if MITOL_USE_S3 and (
    not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY or not AWS_STORAGE_BUCKET_NAME
):
    msg = "You have enabled S3 support, but are missing one of AWS_ACCESS_KEY_ID, \
    AWS_SECRET_ACCESS_KEY, or AWS_STORAGE_BUCKET_NAME"
    raise ImproperlyConfigured(msg)


IMAGEKIT_SPEC_CACHEFILE_NAMER = "imagekit.cachefiles.namers.source_name_dot_hash"
IMAGEKIT_CACHEFILE_DIR = get_string("IMAGEKIT_CACHEFILE_DIR", "")
IMAGEKIT_CACHE_BACKEND = "imagekit"


# django cache back-ends
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "local-in-memory-cache",
    },
    # cache specific to widgets
    "external_assets": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "external_asset_cache",
    },
    # general durable cache (redis should be considered ephemeral)
    "durable": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "durable_cache",
    },
    "redis": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": CELERY_BROKER_URL,  # noqa: F405
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    },
    # imagekit caching
    "imagekit": {
        "BACKEND": "main.cache.backends.FallbackCache",
        "LOCATION": [
            "imagekit_redis",
            "imagekit_db",
        ],
    },
    # This uses FallbackCache but it's basically a proxy to the redis cache
    # so that we can reuse the client and not create another pile of connections.
    # The main purpose of this is to set TIMEOUT without specifying it on
    # the global redis cache.
    "imagekit_redis": {
        "BACKEND": "main.cache.backends.FallbackCache",
        "LOCATION": [
            "redis",
        ],
        "TIMEOUT": 60 * 60,
    },
    "imagekit_db": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "imagekit_cache",
        "TIMEOUT": None,
    },
}

# OpenSearch
OPENSEARCH_DEFAULT_PAGE_SIZE = get_int("OPENSEARCH_DEFAULT_PAGE_SIZE", 10)
OPENSEARCH_URL = get_string("OPENSEARCH_URL", None)
if not OPENSEARCH_URL:
    msg = "Missing OPENSEARCH_URL"
    raise ImproperlyConfigured(msg)
if get_string("HEROKU_PARENT_APP_NAME", None) is not None:
    OPENSEARCH_INDEX = get_string("HEROKU_APP_NAME", None)
else:
    OPENSEARCH_INDEX = get_string("OPENSEARCH_INDEX", None)
if not OPENSEARCH_INDEX:
    msg = "Missing OPENSEARCH_INDEX"
    raise ImproperlyConfigured(msg)
OPENSEARCH_HTTP_AUTH = get_string("OPENSEARCH_HTTP_AUTH", None)
OPENSEARCH_CONNECTIONS_PER_NODE = get_int("OPENSEARCH_CONNECTIONS_PER_NODE", 10)
OPENSEARCH_DEFAULT_TIMEOUT = get_int("OPENSEARCH_DEFAULT_TIMEOUT", 10)
OPENSEARCH_INDEXING_CHUNK_SIZE = get_int("OPENSEARCH_INDEXING_CHUNK_SIZE", 100)
OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE = get_int(
    "OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE",
    get_int("OPENSEARCH_INDEXING_CHUNK_SIZE", 100),
)
OPENSEARCH_MIN_QUERY_SIZE = get_int("OPENSEARCH_MIN_QUERY_SIZE", 2)
OPENSEARCH_MAX_SUGGEST_HITS = get_int("OPENSEARCH_MAX_SUGGEST_HITS", 1)
OPENSEARCH_MAX_SUGGEST_RESULTS = get_int("OPENSEARCH_MAX_SUGGEST_RESULTS", 1)
OPENSEARCH_SHARD_COUNT = get_int("OPENSEARCH_SHARD_COUNT", 2)
OPENSEARCH_REPLICA_COUNT = get_int("OPENSEARCH_REPLICA_COUNT", 2)
OPENSEARCH_MAX_REQUEST_SIZE = get_int("OPENSEARCH_MAX_REQUEST_SIZE", 10485760)
INDEXING_ERROR_RETRIES = get_int("INDEXING_ERROR_RETRIES", 1)

# JWT authentication settings
MITOL_JWT_SECRET = get_string(
    "MITOL_JWT_SECRET", "terribly_unsafe_default_jwt_secret_key"
)

MITOL_COOKIE_NAME = get_string("MITOL_COOKIE_NAME", None)
if not MITOL_COOKIE_NAME:
    msg = "MITOL_COOKIE_NAME is not set"
    raise ImproperlyConfigured(msg)
MITOL_COOKIE_DOMAIN = get_string("MITOL_COOKIE_DOMAIN", None)
if not MITOL_COOKIE_DOMAIN:
    msg = "MITOL_COOKIE_DOMAIN is not set"
    raise ImproperlyConfigured(msg)

MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = get_int(
    "MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS",
    60 * 60 * 24 * 7,  # 7 days
)

JWT_AUTH = {
    "JWT_SECRET_KEY": MITOL_JWT_SECRET,
    "JWT_VERIFY": True,
    "JWT_VERIFY_EXPIRATION": True,
    "JWT_EXPIRATION_DELTA": datetime.timedelta(seconds=60 * 60),
    "JWT_ALLOW_REFRESH": True,
    "JWT_REFRESH_EXPIRATION_DELTA": datetime.timedelta(days=7),
    "JWT_AUTH_COOKIE": MITOL_COOKIE_NAME,
    "JWT_AUTH_HEADER_PREFIX": "Bearer",
}

# Similar resources settings
MITOL_SIMILAR_RESOURCES_COUNT = get_int("MITOL_SIMILAR_RESOURCES_COUNT", 3)
OPEN_RESOURCES_MIN_DOC_FREQ = get_int("OPEN_RESOURCES_MIN_DOC_FREQ", 1)
OPEN_RESOURCES_MIN_TERM_FREQ = get_int("OPEN_RESOURCES_MIN_TERM_FREQ", 1)


# features flags
def get_all_config_keys():
    """
    Returns all the configuration keys from both
    environment and configuration files
    """  # noqa: D401
    return list(os.environ.keys())


MITOL_FEATURES_PREFIX = get_string("MITOL_FEATURES_PREFIX", "FEATURE_")
MITOL_FEATURES_DEFAULT = get_bool("MITOL_FEATURES_DEFAULT", False)  # noqa: FBT003
FEATURES = {
    key[len(MITOL_FEATURES_PREFIX) :]: get_bool(key, False)  # noqa: FBT003
    for key in get_all_config_keys()
    if key.startswith(MITOL_FEATURES_PREFIX)
}

MIDDLEWARE_FEATURE_FLAG_QS_PREFIX = get_string(
    "MIDDLEWARE_FEATURE_FLAG_QS_PREFIX", None
)
MIDDLEWARE_FEATURE_FLAG_COOKIE_NAME = get_string(
    "MIDDLEWARE_FEATURE_FLAG_COOKIE_NAME", "MITOL_FEATURE_FLAGS"
)
MIDDLEWARE_FEATURE_FLAG_COOKIE_MAX_AGE_SECONDS = get_int(
    "MIDDLEWARE_FEATURE_FLAG_COOKIE_MAX_AGE_SECONDS", 60 * 60
)
REDIS_VIEW_CACHE_DURATION = get_int("REDIS_VIEW_CACHE_DURATION", 60 * 60 * 24)


if MIDDLEWARE_FEATURE_FLAG_QS_PREFIX:
    MIDDLEWARE = (
        *MIDDLEWARE,
        "main.middleware.feature_flags.QueryStringFeatureFlagMiddleware",
        "main.middleware.feature_flags.CookieFeatureFlagMiddleware",
    )

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
    ),
    "EXCEPTION_HANDLER": "main.exceptions.api_exception_handler",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "TEST_REQUEST_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.MultiPartRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_VERSIONING_CLASS": "rest_framework.versioning.NamespaceVersioning",
    "ALLOWED_VERSIONS": ["v0", "v1"],
    "ORDERING_PARAM": "sortby",
}

USE_X_FORWARDED_PORT = get_bool("USE_X_FORWARDED_PORT", False)  # noqa: FBT003
USE_X_FORWARDED_HOST = get_bool("USE_X_FORWARDED_HOST", False)  # noqa: FBT003


# Guardian
# disable the anonymous user creation
ANONYMOUS_USER_NAME = None

# Widgets
WIDGETS_RSS_CACHE_TTL = get_int("WIDGETS_RSS_CACHE_TTL", 15 * 60)

# x509 filenames
MIT_WS_CERTIFICATE_FILE = os.path.join(STATIC_ROOT, "mit_x509.cert")  # noqa: PTH118
MIT_WS_PRIVATE_KEY_FILE = os.path.join(STATIC_ROOT, "mit_x509.key")  # noqa: PTH118

RSS_FEED_EPISODE_LIMIT = get_int("RSS_FEED_EPISODE_LIMIT", 100)
RSS_FEED_CACHE_MINUTES = get_int("RSS_FEED_CACHE_MINUTES", 15)

REQUESTS_TIMEOUT = get_int("REQUESTS_TIMEOUT", 30)


if DEBUG:
    # allow for all IPs to be routable, including localhost, for testing
    IPWARE_PRIVATE_IP_PREFIX = ()

SPECTACULAR_SETTINGS = open_spectacular_settings

# drf extension settings
DRF_NESTED_PARENT_LOOKUP_PREFIX = get_string("DRF_NESTED_PARENT_LOOKUP_PREFIX", "")
REST_FRAMEWORK_EXTENSIONS = {
    "DEFAULT_PARENT_LOOKUP_KWARG_NAME_PREFIX": DRF_NESTED_PARENT_LOOKUP_PREFIX
}

# Keycloak API settings
KEYCLOAK_BASE_URL = get_string(
    name="KEYCLOAK_BASE_URL",
    default="http://mit-keycloak-base-url.edu",
)
KEYCLOAK_REALM_NAME = get_string(
    name="KEYCLOAK_REALM_NAME",
    default="olapps",
)

MICROMASTERS_CMS_API_URL = get_string("MICROMASTERS_CMS_API_URL", None)

OPENSEARCH_VECTOR_MODEL_BASE_NAME = get_string(
    name="OPENSEARCH_VECTOR_MODEL_BASE_NAME",
    default="hybrid_search_model",
)
POSTHOG_PROJECT_API_KEY = get_string(
    name="POSTHOG_PROJECT_API_KEY",
    default="",
)
POSTHOG_PERSONAL_API_KEY = get_string(
    name="POSTHOG_PERSONAL_API_KEY",
    default=None,
)
POSTHOG_API_HOST = get_string(
    name="POSTHOG_API_HOST",
    default="https://us.posthog.com",
)
POSTHOG_TIMEOUT_MS = get_int(
    name="POSTHOG_TIMEOUT_MS",
    default=3000,
)
POSTHOG_PROJECT_ID = get_int(
    name="POSTHOG_PROJECT_ID",
    default=None,
)
POSTHOG_EVENT_S3_BUCKET = get_string(name="POSTHOG_EVENT_S3_BUCKET", default="None")
POSTHOG_EVENT_S3_PREFIX = get_string(name="POSTHOG_EVENT_S3_PREFIX", default="None")

# Search defaults settings - adjustable throught the admin ui
DEFAULT_SEARCH_MODE = get_string(name="DEFAULT_SEARCH_MODE", default="phrase")
DEFAULT_SEARCH_SLOP = get_int(name="DEFAULT_SEARCH_SLOP", default=6)
DEFAULT_SEARCH_STALENESS_PENALTY = get_float(
    name="DEFAULT_SEARCH_STALENESS_PENALTY", default=2.5
)
DEFAULT_SEARCH_MINIMUM_SCORE_CUTOFF = get_float(
    name="DEFAULT_SEARCH_MINIMUM_SCORE_CUTOFF", default=5
)
DEFAULT_SEARCH_MAX_INCOMPLETENESS_PENALTY = get_float(
    name="DEFAULT_SEARCH_MAX_INCOMPLETENESS_PENALTY", default=90
)
DEFAULT_SEARCH_CONTENT_FILE_SCORE_WEIGHT = get_float(
    name="DEFAULT_SEARCH_CONTENT_FILE_SCORE_WEIGHT", default=1
)
"""
the schedule (in minutes) for the embeddings task
the lookback window for getting items to embed
will be a constant 60 minutes greater more than the schedule frequency
"""
EMBEDDING_SCHEDULE_MINUTES = get_int(name="EMBEDDING_SCHEDULE_MINUTES", default=60)
OPEN_AI_EMBEDDING_MODELS = get_list_of_str(
    "OPEN_AI_EMBEDDING_MODELS",
    [
        "text-embedding-3-small",
        "text-embedding-3-large",
    ],
)
QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW = EMBEDDING_SCHEDULE_MINUTES + 60

QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = get_bool(
    name="QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS", default=False
)

QDRANT_API_KEY = get_string(name="QDRANT_API_KEY", default="")
QDRANT_HOST = get_string(name="QDRANT_HOST", default="http://qdrant:6333")
QDRANT_BASE_COLLECTION_NAME = get_string(
    name="QDRANT_COLLECTION_NAME", default="resource_embeddings"
)
QDRANT_DENSE_MODEL = get_string(name="QDRANT_DENSE_MODEL", default=None)
QDRANT_SPARSE_MODEL = get_string(
    name="QDRANT_SPARSE_MODEL", default="prithivida/Splade_PP_en_v1"
)

QDRANT_CHUNK_SIZE = get_int(
    name="QDRANT_CHUNK_SIZE",
    default=10,
)

QDRANT_ENCODER = get_string(
    name="QDRANT_ENCODER", default="vector_search.encoders.fastembed.FastEmbedEncoder"
)

QDRANT_POINT_UPLOAD_BATCH_SIZE = get_int(
    name="QDRANT_POINT_UPLOAD_BATCH_SIZE", default=1000
)

QDRANT_BATCH_SIZE_BYTES = get_int(
    name="QDRANT_BATCH_SIZE_BYTES", default=10 * 1024 * 1024
)  # default 10 MB limit for batch processing

QDRANT_CLIENT_TIMEOUT = get_int(name="QDRANT_CLIENT_TIMEOUT", default=10)

# toggle to use requests (default for local) or webdriver which renders js elements
EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = get_bool(
    "EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER", default=False
)
LITELLM_TOKEN_ENCODING_NAME = get_string(
    name="LITELLM_TOKEN_ENCODING_NAME", default=None
)
LITELLM_CUSTOM_PROVIDER = get_string(name="LITELLM_CUSTOM_PROVIDER", default="openai")
LITELLM_API_BASE = get_string(name="LITELLM_API_BASE", default=None)

OPENAI_API_KEY = get_string(
    name="OPENAI_API_KEY",
    default=None,
)

CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = get_int(
    name="CONTENT_FILE_EMBEDDING_CHUNK_SIZE", default=512
)
CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = get_int(
    name="CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP",
    default=0,  # default that the tokenizer uses
)
CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED = get_bool(
    name="CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED", default=False
)

SEMANTIC_CHUNKING_CONFIG = {
    "buffer_size": get_int(
        # Number of sentences to combine.
        name="SEMANTIC_CHUNKING_BUFFER_SIZE",
        default=1,
    ),
    "breakpoint_threshold_type": get_string(
        # 'percentile', 'standard_deviation', 'interquartile', or 'gradient'
        name="SEMANTIC_CHUNKING_BREAKPOINT_THRESHOLD_TYPE",
        default="percentile",
    ),
    "breakpoint_threshold_amount": get_float(
        # value we use for breakpoint_threshold_type to filter outliers
        name="SEMANTIC_CHUNKING_BREAKPOINT_THRESHOLD_AMOUNT",
        default=None,
    ),
    "number_of_chunks": get_int(
        # number of chunks to consider for merging
        name="SEMANTIC_CHUNKING_NUMBER_OF_CHUNKS",
        default=None,
    ),
}

CONTENT_FILE_SUMMARIZER_BATCH_SIZE = get_int("CONTENT_FILE_SUMMARIZER_BATCH_SIZE", 20)
# number of flashcards to generate
CONTENT_SUMMARIZER_FLASHCARD_QUANTITY = get_int(
    "CONTENT_SUMMARIZER_FLASHCARD_QUANTITY", 10
)


CONTENT_SUMMARIZER_FLASHCARD_PROMPT = get_string(
    "CONTENT_SUMMARIZER_FLASHCARD_PROMPT",
    (
        f"""
        You are an expert instructor creating study flashcards.
        Generate exactly {CONTENT_SUMMARIZER_FLASHCARD_QUANTITY}
        high-quality flashcards from the transcript below.
        """
        """
        Rules:
        - Focus ONLY on core concepts, methods, definitions,
          reasoning, and cause-effect relationships.
        - Questions must test understanding or application,
          not recall of names, timestamps, or anecdotes.
        - Avoid trivia, meta information
        - avoid details about the speaker or course logistics.
        - Prefer "why", "how", "compare", "explain", or "apply" style questions.
        - Each answer should be concise but complete (1-3 sentences).

        Transcript:
        {content}
        """
    ),
)
# OpenTelemetry configuration
OPENTELEMETRY_ENABLED = get_bool("OPENTELEMETRY_ENABLED", False)  # noqa: FBT003
OPENTELEMETRY_SERVICE_NAME = get_string("OPENTELEMETRY_SERVICE_NAME", "learn")
OPENTELEMETRY_INSECURE = get_bool("OPENTELEMETRY_INSECURE", default=True)
OPENTELEMETRY_ENDPOINT = get_string("OPENTELEMETRY_ENDPOINT", None)
OPENTELEMETRY_TRACES_BATCH_SIZE = get_int("OPENTELEMETRY_TRACES_BATCH_SIZE", 512)
OPENTELEMETRY_EXPORT_TIMEOUT_MS = get_int("OPENTELEMETRY_EXPORT_TIMEOUT_MS", 5000)
CANVAS_TUTORBOT_FOLDER = get_string("CANVAS_TUTORBOT_FOLDER", "web_resources/ai/tutor/")


# Video Shorts settings
VIDEO_SHORTS_S3_PREFIX = get_string("VIDEO_SHORTS_S3_PREFIX", "shorts/")
VIDEO_SHORTS_COUNT = get_int("VIDEO_SHORTS_COUNT", 12)
