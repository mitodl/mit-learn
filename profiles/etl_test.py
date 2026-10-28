"""Tests for profiles.etl."""

from datetime import UTC, datetime

import pytest

from profiles.etl import transform_program_certificate, upsert_program_certificate
from profiles.factories import ProgramCertificateFactory, ProgramLetterFactory
from profiles.models import ProgramCertificate, ProgramLetter

pytestmark = pytest.mark.django_db


def _row(**overrides):
    row = {
        "record_hash": "abc123",
        "program_title": "Data, Economics, and Development Policy",
        "user_full_name": "Ada Lovelace",
        "user_email": "ada@example.com",
        "user_edxorg_id": 42,
        "user_edxorg_username": "ada",
        "user_mitxonline_username": "ada.lovelace",
        "micromasters_program_id": 7,
        "mitxonline_program_id": None,
        "user_first_name": "Ada",
        "user_last_name": "Lovelace",
        "user_gender": "f",
        "user_year_of_birth": "1815",
        "user_country": "GB",
        "user_address_state_or_territory": "Greater London",
        "user_address_city": "London",
        "user_address_postal_code": "NW1 2DB",
        "user_street_address": "12 Marylebone Road",
        "program_completion_timestamp": datetime(2026, 1, 1, tzinfo=UTC),
        "is_revoked": False,
    }
    row.update(overrides)
    return row


def test_transform_program_certificate_maps_all_fields():
    """transform_program_certificate maps every warehouse column to its
    ProgramCertificate field, excluding record_hash (the caller's upsert key).
    """
    fields = transform_program_certificate(_row())

    assert fields["program_title"] == "Data, Economics, and Development Policy"
    assert fields["user_full_name"] == "Ada Lovelace"
    assert fields["user_email"] == "ada@example.com"
    assert fields["user_edxorg_id"] == 42
    assert fields["user_edxorg_username"] == "ada"
    assert fields["user_mitxonline_username"] == "ada.lovelace"
    assert fields["micromasters_program_id"] == 7
    assert fields["mitxonline_program_id"] is None
    assert fields["user_first_name"] == "Ada"
    assert fields["user_last_name"] == "Lovelace"
    assert fields["user_gender"] == "f"
    assert fields["user_year_of_birth"] == "1815"
    assert fields["user_country"] == "GB"
    assert fields["user_address_state_or_territory"] == "Greater London"
    assert fields["user_address_city"] == "London"
    assert fields["user_address_postal_code"] == "NW1 2DB"
    assert fields["user_street_address"] == "12 Marylebone Road"
    assert fields["program_completion_timestamp"] == datetime(2026, 1, 1, tzinfo=UTC)
    assert fields["is_revoked"] is False
    assert "record_hash" not in fields


def test_transform_program_certificate_defaults_missing_name_fields_to_empty_string():
    """program_title/user_full_name/user_email are non-nullable CharFields on
    ProgramCertificate — a missing warehouse value must become '', not None.
    """
    fields = transform_program_certificate(
        _row(program_title=None, user_full_name=None, user_email=None)
    )

    assert fields["program_title"] == ""
    assert fields["user_full_name"] == ""
    assert fields["user_email"] == ""


@pytest.mark.parametrize(
    ("revoked", "expected"),
    [(True, True), (False, False), (None, False)],
)
def test_transform_program_certificate_revoked(revoked, expected):
    """Coerce revoked to a bool, so a NULL reads as not revoked"""
    assert (
        transform_program_certificate(_row(is_revoked=revoked))["is_revoked"]
        is expected
    )


def test_transform_program_certificate_revoked_column_missing():
    """A row from a view that doesn't expose revoked yet leaves it unset, so
    the upsert doesn't overwrite it.
    """
    row = _row()
    del row["is_revoked"]
    assert "revoked" not in transform_program_certificate(row)


def test_upsert_program_certificate_without_revoked_column_keeps_revocation():
    """A sync from a view without the revoked column doesn't reset a
    certificate already revoked in Learn.
    """
    ProgramCertificateFactory(record_hash="abc123", is_revoked=True)
    row = _row()
    del row["is_revoked"]

    upsert_program_certificate(row)

    assert ProgramCertificate.objects.get(record_hash="abc123").is_revoked is True


def test_upsert_program_certificate_without_revoked_column_creates_unrevoked():
    """A new certificate from a view without the revoked column isn't revoked"""
    row = _row()
    del row["is_revoked"]

    upsert_program_certificate(row)

    assert ProgramCertificate.objects.get(record_hash="abc123").is_revoked is False


def test_upsert_program_certificate_creates_new_row():
    """upsert_program_certificate creates a new ProgramCertificate when
    record_hash hasn't been seen before.
    """
    upsert_program_certificate(_row())

    certificate = ProgramCertificate.objects.get(record_hash="abc123")
    assert certificate.user_full_name == "Ada Lovelace"
    assert certificate.micromasters_program_id == 7


def test_upsert_program_certificate_updates_existing_row():
    """upsert_program_certificate updates in place when record_hash matches
    an existing certificate, rather than creating a duplicate.
    """
    ProgramCertificateFactory(record_hash="abc123", user_full_name="Old Name")

    upsert_program_certificate(_row(user_full_name="Ada Lovelace"))

    assert ProgramCertificate.objects.filter(record_hash="abc123").count() == 1
    certificate = ProgramCertificate.objects.get(record_hash="abc123")
    assert certificate.user_full_name == "Ada Lovelace"


def test_upsert_program_certificate_never_deletes():
    """upsert_program_certificate only ever touches the row it's given —
    a certificate is a durable achievement record, not something this
    pipeline prunes on a full refresh (see profiles.etl module docstring).
    """
    ProgramCertificateFactory(record_hash="untouched")

    upsert_program_certificate(_row(record_hash="abc123"))

    assert ProgramCertificate.objects.filter(record_hash="untouched").exists()
    assert ProgramCertificate.objects.count() == 2


def test_upsert_program_certificate_revokes_in_place(user):
    """A revocation updates the existing row and keeps its letter, so
    reversing it later restores the same letter link.
    """
    letter = ProgramLetterFactory(user=user, certificate__record_hash="abc123")

    upsert_program_certificate(_row(is_revoked=True))

    certificate = ProgramCertificate.objects.get(record_hash="abc123")
    assert certificate.is_revoked is True
    assert ProgramLetter.objects.filter(pk=letter.pk).exists()
