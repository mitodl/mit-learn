"""
Read and write the credential metadata currently in force for a resource.

Kept apart from `credentials`, which imports litellm and langchain: the
endpoint's GET handler and `tasks` both need the stored values, and neither
can afford to pull the generation stack onto the boot path -- see
`main/boot_imports_test.py`.
"""

import logging

from learning_resources.models import CredentialMetadata, LearningResource

logger = logging.getLogger(__name__)


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
    # A filter rather than `resource.credential_metadata`: the reverse
    # one-to-one descriptor raises RelatedObjectDoesNotExist when absent, and
    # "nothing generated yet" is an ordinary answer here, not an error.
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
    storable = {field.name for field in CredentialMetadata._meta.concrete_fields}  # noqa: SLF001
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
