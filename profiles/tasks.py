"""Tasks for profiles."""

import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

from learning_resources.lib.warehouse import BaseWarehouseETLTask, iter_rows
from main.celery import app
from profiles.etl import upsert_program_certificate
from profiles.utils import send_template_email

log = logging.getLogger(__name__)
User = get_user_model()


class SyncProgramCertificatesTask(BaseWarehouseETLTask):
    """Warehouse-pull sync of profiles.ProgramCertificate, replacing the
    Hightouch sync into external.programcertificate (mitodl/hq#12954).
    """

    name = "profiles.tasks.SyncProgramCertificatesTask"
    view_name = (
        "ol_data_lake_production.ol_warehouse_production_integrations"
        ".integrations__learn__program_certificates"
    )

    def fetch_and_upsert(self, conn, *, since=None) -> int:
        """Upsert every row iter_rows yields; see profiles.etl for why this
        never prunes, even on a full_refresh run.
        """
        count = 0
        for row in iter_rows(conn, self.view_name, since=since):
            upsert_program_certificate(row)
            count += 1
        return count


SyncProgramCertificatesTask = app.register_task(SyncProgramCertificatesTask())


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
        user,
        "MIT Learn - Welcome to MIT Learn",
        "email/welcome_email.html",
        context={"display_name": display_name},
        is_transactional=True,
    )
