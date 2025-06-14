"""
Django settings for celery.
"""

from celery.schedules import crontab
from redbeat import RedBeatScheduler

from main.envs import get_bool, get_int, get_string

"""
the schedule (in minutes) for the embeddings task
the lookback window for getting items to embed
will be a constant 60 minutes greater more than the schedule frequency
"""
EMBEDDING_SCHEDULE_MINUTES = get_int(name="EMBEDDING_SCHEDULE_MINUTES", default=60)
QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW = EMBEDDING_SCHEDULE_MINUTES + 60

DEV_ENV = get_bool("DEV_ENV", False)  # noqa: FBT003
USE_CELERY = True
REDIS_URL = get_string("REDIS_URL", get_string("REDISCLOUD_URL", None))
CELERY_BROKER_URL = get_string("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = get_string("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_BEAT_SCHEDULER = RedBeatScheduler
redbeat_redis_url = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = get_bool("CELERY_TASK_ALWAYS_EAGER", False)  # noqa: FBT003
CELERY_TASK_EAGER_PROPAGATES = get_bool(
    "CELERY_TASK_EAGER_PROPAGATES",
    True,  # noqa: FBT003
)
CELERY_WORKER_MAX_MEMORY_PER_CHILD = get_int(
    "CELERY_WORKER_MAX_MEMORY_PER_CHILD", 250_000
)

CELERY_BEAT_SCHEDULE = {
    "update_next-start-date-every-1-days": {
        "task": "learning_resources.tasks.update_next_start_date_and_prices",
        "schedule": crontab(minute=0, hour=7),  # 3:00am EST
    },
    "update_edx-courses-every-1-days": {
        "task": "learning_resources.tasks.get_mit_edx_data",
        "schedule": crontab(minute=0, hour=5),  # 1:00am EST
    },
    "update-edx-files-every-1-weeks": {
        "task": "learning_resources.tasks.import_all_mit_edx_files",
        "schedule": crontab(minute=0, hour=5, day_of_week=1),  # 12:00 PM EST on Mondays
    },
    "update-micromasters-programs-every-1-days": {
        "task": "learning_resources.tasks.get_micromasters_data",
        "schedule": crontab(minute=0, hour=5),  # 1:00am EST
    },
    "update-mitxonline-courses-every-1-days": {
        "task": "learning_resources.tasks.get_mitxonline_data",
        "schedule": crontab(minute=0, hour=5),  # 1:00am EST
    },
    "update-mitxonline-files-every-1-weeks": {
        "task": "learning_resources.tasks.import_all_mitxonline_files",
        "schedule": crontab(
            minute=0, hour=5, day_of_week=3
        ),  # 12:00 PM EST on Wednesdays
    },
    "update-podcasts": {
        "task": "learning_resources.tasks.get_podcast_data",
        "schedule": get_int(
            "PODCAST_FETCH_SCHEDULE_SECONDS", 60 * 60 * 2
        ),  # default is every 2 hours
    },
    "update-professional-ed-resources-every-1-days": {
        "task": "learning_resources.tasks.get_mitpe_data",
        "schedule": crontab(minute=0, hour=21),  # 5:00pm EST
    },
    "update-xpro-courses-every-1-days": {
        "task": "learning_resources.tasks.get_xpro_data",
        "schedule": crontab(minute=0, hour=5),  # 1:00am EST
    },
    "update-xpro-files-every-1-weeks": {
        "task": "learning_resources.tasks.import_all_xpro_files",
        "schedule": crontab(
            minute=0, hour=5, day_of_week=2
        ),  # 12:00 PM EST on Tuesdays
    },
    "update-youtube-videos": {
        "task": "learning_resources.tasks.get_youtube_data",
        "schedule": get_int(
            "YOUTUBE_FETCH_SCHEDULE_SECONDS", 60 * 30
        ),  # default is every 30 minutes
    },
    "update-youtube-transcripts": {
        "task": "learning_resources.tasks.get_youtube_transcripts",
        "schedule": get_int(
            "YOUTUBE_FETCH_TRANSCRIPT_SCHEDULE_SECONDS", 60 * 60 * 12
        ),  # default is 12 hours
    },
    "update_medium_mit_news": {
        "task": "news_events.tasks.get_medium_mit_news",
        "schedule": get_int(
            "NEWS_EVENTS_MEDIUM_NEWS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "update_mitpe_events": {
        "task": "news_events.tasks.get_mitpe_events",
        "schedule": get_int(
            "NEWS_EVENTS_MITPE_EVENTS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "update_mitpe_news": {
        "task": "news_events.tasks.get_mitpe_news",
        "schedule": get_int(
            "NEWS_EVENTS_MITPE_NEWS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "update_sloan_news": {
        "task": "news_events.tasks.get_sloan_exec_news",
        "schedule": get_int(
            "NEWS_EVENTS_SLOAN_EXEC_NEWS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "update_sloan_webinars": {
        "task": "news_events.tasks.get_sloan_exec_webinars",
        "schedule": get_int(
            "NEWS_EVENTS_SLOAN_EXEC_WEBINAR_SCHEDULE_SECONDS", 60 * 60 * 12
        ),  # default is every 12 hours
    },
    "update_sloan_courses": {
        "task": "learning_resources.tasks.get_sloan_data",
        "schedule": crontab(minute=30, hour=4),  # 12:30am EST
    },
    "update_ol_events": {
        "task": "news_events.tasks.get_ol_events",
        "schedule": get_int(
            "NEWS_EVENTS_OL_EVENTS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "update_posthog_events": {
        "task": "learning_resources.tasks.get_learning_resource_views",
        "schedule": get_int(
            "NEWS_EVENTS_OL_EVENTS_SCHEDULE_SECONDS", 60 * 60 * 3
        ),  # default is every 3 hours
    },
    "send-subscription-emails-every-1-days": {
        "task": "learning_resources_search.tasks.send_subscription_emails",
        "schedule": crontab(minute=30, hour=18),  # 2:30pm EST
        "kwargs": {"period": "daily", "subscription_type": "channel_subscription_type"},
    },
    "send-search-subscription-emails-every-1-days": {
        "task": "learning_resources_search.tasks.send_subscription_emails",
        "schedule": crontab(minute=0, hour=19),  # 3:00pm EST
        "kwargs": {"period": "daily", "subscription_type": "search_subscription_type"},
    },
    "update-search-featured-ranks-1-days": {
        "task": "learning_resources_search.tasks.update_featured_rank",
        "schedule": crontab(minute=30, hour=7),  # 3:30am EST
    },
    "scrape-marketing-pages-every-1-days": {
        "task": "learning_resources.tasks.scrape_marketing_pages",
        "schedule": get_int(
            "SCRAPE_MARKETING_PAGES_SCHEDULE_SECONDS", 60 * 60 * 12
        ),  # default is every 12 hours
    },
}


if not DEV_ENV:
    CELERY_BEAT_SCHEDULE["daily_embed_new_learning_resources"] = {
        "task": "vector_search.tasks.embed_new_learning_resources",
        "schedule": get_int(
            "EMBED_NEW_RESOURCES_SCHEDULE_SECONDS", 60 * EMBEDDING_SCHEDULE_MINUTES
        ),  # default is every 30 minutes
    }
    CELERY_BEAT_SCHEDULE["daily_embed_new_content_files"] = {
        "task": "vector_search.tasks.embed_new_content_files",
        "schedule": get_int(
            "EMBED_NEW_CONTENT_FILES_SCHEDULE_SECONDS", 60 * EMBEDDING_SCHEDULE_MINUTES
        ),  # default is every 30 minutes
    }


CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TASK_TRACK_STARTED = True
CELERY_TASK_SEND_SENT_EVENT = True
