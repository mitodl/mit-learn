"""
Django settings for celery.
"""
from celery.schedules import crontab

from open_discussions.envs import get_bool, get_int, get_string

USE_CELERY = True
CELERY_BROKER_URL = get_string("CELERY_BROKER_URL", get_string("REDISCLOUD_URL", None))
CELERY_RESULT_BACKEND = get_string(
    "CELERY_RESULT_BACKEND", get_string("REDISCLOUD_URL", None)
)
CELERY_TASK_ALWAYS_EAGER = get_bool("CELERY_TASK_ALWAYS_EAGER", False)  # noqa: FBT003
CELERY_TASK_EAGER_PROPAGATES = get_bool(
    "CELERY_TASK_EAGER_PROPAGATES", True  # noqa: FBT003
)  # noqa: FBT003, RUF100
CELERY_WORKER_MAX_MEMORY_PER_CHILD = get_int(
    "CELERY_WORKER_MAX_MEMORY_PER_CHILD", 250_000
)

CELERY_BEAT_SCHEDULE = {
    # "update_edx-courses-every-1-days": {
    #     "task": "course_catalog.tasks.get_mitx_data",
    #     "schedule": crontab(minute=30, hour=15),  # 11:30am EST
    # },
    # "update-edx-files-every-1-weeks": {
    #     "task": "course_catalog.tasks.import_all_mitx_files",
    #     "schedule": crontab(
    #         minute=0, hour=16, day_of_week=1
    #     ),  # 12:00 PM EST on Mondays
    # },
    # "update-micromasters-courses-every-1-days": {
    #     "task": "course_catalog.tasks.get_micromasters_data",
    #     "schedule": crontab(minute=00, hour=15),  # 11:00am EST
    # },
    # "update-podcasts": {
    #     "task": "course_catalog.tasks.get_podcast_data",
    #     "schedule": get_int(
    #         "PODCAST_FETCH_SCHEDULE_SECONDS", 60 * 60 * 2
    #     ),  # default is every 2 hours
    # },
    "update-xpro-courses-every-1-days": {
        "task": "learning_resources.tasks.get_xpro_data",
        "schedule": crontab(minute=30, hour=17),  # 1:30pm EST
    },
    "update-xpro-files-every-1-weeks": {
        "task": "learning_resources.tasks.import_all_xpro_files",
        "schedule": crontab(
            minute=0, hour=16, day_of_week=2
        ),  # 12:00 PM EST on Tuesdays
    },
    # "update-mitxonline-courses-every-1-days": {
    #     "task": "course_catalog.tasks.get_mitxonline_data",
    #     "schedule": crontab(minute=30, hour=19),  # 3:30pm EST
    # },
    # "update-mitxonline-files-every-1-weeks": {
    #     "task": "course_catalog.tasks.import_all_mitxonline_files",
    #     "schedule": crontab(
    #         minute=0, hour=16, day_of_week=3
    #     ),  # 12:00 PM EST on Wednesdays
    # },
    # "update-oll-courses-every-1-days": {
    #     "task": "course_catalog.tasks.get_oll_data",
    #     "schedule": crontab(minute=30, hour=18),  # 2:30pm EST
    # },
    # "update-prolearn-courses-every-1-days": {
    #     "task": "course_catalog.tasks.get_prolearn_data",
    #     "schedule": crontab(minute=30, hour=21),  # 5:30pm EST
    # },
    # "update-youtube-videos": {
    #     "task": "course_catalog.tasks.get_youtube_data",
    #     "schedule": get_int(
    #         "YOUTUBE_FETCH_SCHEDULE_SECONDS", 60 * 30
    #     ),  # default is every 30 minutes
    # },
    # "update-youtube-transcripts": {
    #     "task": "course_catalog.tasks.get_youtube_transcripts",
    #     "schedule": get_int(
    #         "YOUTUBE_FETCH_TRANSCRIPT_SCHEDULE_SECONDS", 60 * 60 * 12
    #     ),  # default is 12 hours
    # },
}

CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = "UTC"
