"""
Read and write the credential metadata currently in force for a resource.
"""

import logging

from django.db.models import Q

from learning_resources.models import (
    CredentialMetadata,
    CredentialMetadataConfiguration,
    LearningResource,
)

logger = logging.getLogger(__name__)


def storable_credential_metadata_fields() -> set[str]:
    """
    Return the CredentialMetadata columns a generated field can be written to.

    Returns:
        set of str: the model's own field names
    """
    return {field.name for field in CredentialMetadata._meta.concrete_fields}  # noqa: SLF001


def active_credential_metadata_fields() -> list[str]:
    """
    Return the stored fields a generation would currently produce.

    Generation runs only is_active configurations, and a field with none is
    left out of both the generated fields and the errors -- nothing was asked
    of it, so there is nothing to explain. Its column therefore keeps its
    default however many times the resource is generated for. Anything
    deciding whether a resource still needs generating has to ask what is
    configured, not what the model has columns for: a predicate that always
    demanded every column would requeue every affected course on every sweep,
    paying to regenerate the fields that are still active each time.

    Returns:
        list of str: the active configurations' fields that have a column to
            store them in, sorted. Empty means a generation would produce
            nothing at all.
    """
    configured = (
        CredentialMetadataConfiguration.objects.filter(is_active=True)
        .values_list("field", flat=True)
        .distinct()
    )
    storable = storable_credential_metadata_fields()
    return sorted(field for field in configured if field in storable)


def _empty_value(field: str):
    """Return the stored field's own default, which is what "missing" means."""
    return CredentialMetadata._meta.get_field(field).get_default()  # noqa: SLF001


def incomplete_credential_metadata_query(fields: list[str]) -> Q:
    """
    Return a LearningResource filter for metadata missing any of `fields`.

    "Missing" is per field and taken from the column's own default, so adding
    a field needs no case here.

    Args:
        fields (list of str): the stored fields that must be present, from
            active_credential_metadata_fields()

    Returns:
        Q: matches a resource with no metadata row at all, or one whose row
            still holds the default for one of `fields`
    """
    query = Q(credential_metadata__isnull=True)
    for field in fields:
        query |= Q(**{f"credential_metadata__{field}": _empty_value(field)})
    return query


def missing_credential_metadata_fields(
    resource: LearningResource, fields: list[str]
) -> list[str]:
    """
    Return which of `fields` the resource has no stored value for.


    Args:
        resource (LearningResource): the resource to look up
        fields (list of str): the stored fields to check, from
            active_credential_metadata_fields()

    Returns:
        list of str: the subset of `fields` still holding the column default,
            in the order given. Every field when the resource has no metadata
            row at all.
    """
    stored = stored_credential_metadata(resource)
    if not stored:
        return list(fields)
    return [field for field in fields if getattr(stored, field) == _empty_value(field)]


def stored_credential_metadata(
    resource: LearningResource,
) -> CredentialMetadata | None:
    """
    Return the resource's stored credential metadata, or None if it has none.

    Args:
        resource (LearningResource): the resource to look up

    Returns:
        CredentialMetadata | None: the stored row, or None when nothing has
            been generated for the resource yet
    """
    return CredentialMetadata.objects.filter(learning_resource=resource).first()


def save_credential_metadata(
    resource: LearningResource, fields: dict
) -> CredentialMetadata | None:
    """
    Store the generated credential metadata fields for a resource.

    Only the fields actually generated are written. A field that failed is
    left alone rather than blanked, so a partial generation cannot destroy a
    good value from an earlier run -- the same omit-empties rule
    `generate_credential_metadata` applies to its own return value.

    Args:
        resource (LearningResource): the resource the metadata belongs to
        fields (dict): the generated fields, keyed by CredentialMetadataField
            name. Unknown keys are ignored.

    Returns:
        CredentialMetadata | None: the stored row, or None when there was
            nothing to store. Nothing is written for empty `fields`: an empty
            row would read as "generated nothing" and be skipped by every
            later sweep, so one provider outage would permanently poison the
            resources it hit.
    """
    storable = storable_credential_metadata_fields()
    unknown = set(fields) - storable
    if unknown:
        logger.warning(
            "Ignoring credential metadata field(s) %s for %s: not stored fields",
            ", ".join(sorted(unknown)),
            resource.readable_id,
        )
    # Whitelisted, not passed through: `fields` keys come from
    # CredentialMetadataField, and adding a member there without a column
    # would otherwise raise FieldError on every resource in the sweep.
    defaults = {
        key: value for key, value in fields.items() if key in storable and value
    }
    if not defaults:
        return None
    stored, _ = CredentialMetadata.objects.update_or_create(
        learning_resource=resource, defaults=defaults
    )
    return stored
