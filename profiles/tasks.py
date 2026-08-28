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

        A row that fails to upsert is logged and skipped rather than aborting
        the batch — one malformed certificate shouldn't cost every other
        learner their sync. Skipped rows aren't lost: the daily beat schedule
        runs full_refresh, which re-reads the whole view, so a row that fails
        today is retried tomorrow.

        The one case that still raises is *every* row failing, which is not a
        bad-row problem — it's the database or the model being broken. Letting
        that return normally would advance an incremental run's watermark past
        a window nothing was written for, permanently skipping it (see
        BaseWarehouseETLTask.run).
        """
        count = 0
        failed = 0
        for row in iter_rows(conn, self.view_name, since=since):
            try:
                upsert_program_certificate(row)
            except Exception:
                failed += 1
                log.exception(
                    "Failed to upsert program certificate record_hash=%s",
                    row.get("record_hash"),
                )
            else:
                count += 1

        if failed:
            if count == 0:
                msg = (
                    f"{self.__class__.__name__}: all {failed} rows failed to "
                    f"upsert; refusing to report success"
                )
                raise RuntimeError(msg)
            log.error(
                "%s: skipped %d of %d rows that failed to upsert",
                self.__class__.__name__,
                failed,
                count + failed,
            )
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
