"""Tasks for profiles."""

import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

from main.celery import app
from profiles.utils import send_template_email

log = logging.getLogger(__name__)
User = get_user_model()


@app.task
def send_welcome_email(user_id):
    """
    Send a welcome email to a user by id.
    """
    user = User.objects.filter(id=user_id).first()
    if not user:
        log.warning("User %s not found for welcome email", user_id)
        return
    if not user.email:
        log.warning("User %s has blank email, skipping welcome email", user_id)
        return

    try:
        profile_name = user.profile.name
    except ObjectDoesNotExist:
        profile_name = None
    full_name = " ".join(
        part for part in [user.first_name, user.last_name] if part
    ).strip()
    display_name = profile_name or full_name or user.username or "there"
    send_template_email(
        [user.email],
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": display_name},
    )
