"""Warehouse-pull ETL for profiles.ProgramCertificate.

Replaces Hightouch as the writer of external.programcertificate
(mitodl/hq#12954). Unlike learning_resources/etl/catalog_sources.py's
transform_* functions, this doesn't feed learning_resources.etl.loaders —
ProgramCertificate is a distinct fact model, not a LearningResource, so it
gets its own transform + upsert here rather than being forced into the
catalog contract shape.
"""

from profiles.models import ProgramCertificate


def transform_program_certificate(row: dict) -> dict:
    """Map an integrations__learn__program_certificates row to
    ProgramCertificate field kwargs (everything but record_hash, which the
    caller uses as the upsert key).
    """
    return {
        "program_title": row.get("program_title") or "",
        "user_full_name": row.get("user_full_name") or "",
        "user_email": row.get("user_email") or "",
        "user_edxorg_id": row.get("user_edxorg_id"),
        "user_edxorg_username": row.get("user_edxorg_username"),
        "user_mitxonline_username": row.get("user_mitxonline_username"),
        "micromasters_program_id": row.get("micromasters_program_id"),
        "mitxonline_program_id": row.get("mitxonline_program_id"),
        "user_first_name": row.get("user_first_name"),
        "user_last_name": row.get("user_last_name"),
        "user_gender": row.get("user_gender"),
        "user_year_of_birth": row.get("user_year_of_birth"),
        "user_country": row.get("user_country"),
        "user_address_state_or_territory": row.get("user_address_state_or_territory"),
        "user_address_city": row.get("user_address_city"),
        "user_address_postal_code": row.get("user_address_postal_code"),
        "user_street_address": row.get("user_street_address"),
        "program_completion_timestamp": row.get("program_completion_timestamp"),
    }


def upsert_program_certificate(row: dict) -> ProgramCertificate:
    """Upsert one ProgramCertificate row, keyed on record_hash.

    No pruning: a certificate is a durable record of something a learner
    achieved, so unlike catalog resources (which self-heal via full-refresh
    pruning per BaseWarehouseETLTask), a certificate missing from one pull
    — a transient join gap upstream, for instance — must never be
    interpreted as "no longer earned" and deleted. Certificates are
    upserted and otherwise left alone; nothing in this pipeline deletes a
    ProgramCertificate row.
    """
    record_hash = row["record_hash"]
    certificate, _ = ProgramCertificate.objects.update_or_create(
        record_hash=record_hash,
        defaults=transform_program_certificate(row),
    )
    return certificate
