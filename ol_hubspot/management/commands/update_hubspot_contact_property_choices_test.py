"""Tests for syncing HubSpot contact property choices via management command."""

from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from hubspot.crm.properties.exceptions import ApiException as CrmPropertiesApiException

from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourceOfferorFactory,
)


@pytest.mark.django_db
def test_command_creates_contact_property_when_missing(mocker, faker):
    """Command creates contact property when get-by-name returns 404."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="Algorithms",
        etl_source="hubspot_test",
    )
    LearningResourceFactory(
        is_program=True,
        title="Data Science Program",
        etl_source="hubspot_test",
    )

    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        side_effect=CrmPropertiesApiException(status=404, reason="Not Found"),
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )
    update_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.update_contact_property_choices"
    )

    stdout = StringIO()
    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--learning-resource-field",
        "title",
        "--resource-filter",
        "etl_source=hubspot_test",
        "--resource-order-by",
        "title",
        stdout=stdout,
    )

    create_mock.assert_called_once()
    update_mock.assert_not_called()
    kwargs = create_mock.call_args.kwargs
    assert kwargs["property_name"] == property_name
    assert kwargs["label"] == property_name.replace("_", " ").title()
    assert kwargs["option_values"] == ["Algorithms", "Data Science Program"]


@pytest.mark.django_db
def test_command_updates_existing_contact_property(mocker, faker):
    """Command updates options when the target contact property already exists."""
    property_name = faker.slug().replace("-", "_")
    xpro = LearningResourceOfferorFactory(is_xpro=True)
    ocw = LearningResourceOfferorFactory(is_ocw=True)
    LearningResourceFactory(
        is_course=True,
        title="AI Foundations",
        offered_by=xpro,
        etl_source="hubspot_test",
    )
    LearningResourceFactory(
        is_program=True,
        title="AI Program",
        offered_by=xpro,
        etl_source="hubspot_test",
    )
    LearningResourceFactory(
        is_course=True,
        title="AI for Everyone",
        offered_by=ocw,
        etl_source="hubspot_test",
    )

    existing_property = mocker.Mock()
    existing_property.type = "enumeration"
    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        return_value=existing_property,
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )
    update_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.update_contact_property_choices"
    )

    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--learning-resource-field",
        "offered_by__name",
        "--resource-filter",
        "title__icontains=AI",
        "--resource-filter",
        "professional=true",
        "--resource-filter",
        "etl_source=hubspot_test",
        "--resource-order-by",
        "offered_by__name",
        "--resource-distinct",
    )

    create_mock.assert_not_called()
    update_mock.assert_called_once_with(
        property_name=property_name,
        option_values=[xpro.name],
    )


@pytest.mark.django_db
def test_command_rejects_non_enumeration_existing_property(mocker, faker):
    """Command errors if an existing property is not an enumeration."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(is_course=True, title="Algorithms")

    existing_property = mocker.Mock()
    existing_property.type = "string"
    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        return_value=existing_property,
    )

    with pytest.raises(CommandError) as exc_info:
        call_command(
            "update_hubspot_contact_property_choices",
            property_name,
            "--learning-resource-field",
            "title",
        )

    assert "unsupported type" in str(exc_info.value)


@pytest.mark.django_db
def test_command_dry_run_skips_hubspot_lookup(mocker, faker):
    """Dry-run should not read HubSpot, even if lookup would fail."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True, title="Algorithms", etl_source="hubspot_test"
    )

    get_property_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        side_effect=CrmPropertiesApiException(
            status=500, reason="Internal Server Error"
        ),
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )
    update_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.update_contact_property_choices"
    )

    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--learning-resource-field",
        "title",
        "--resource-filter",
        "etl_source=hubspot_test",
        "--dry-run",
    )

    get_property_mock.assert_not_called()
    create_mock.assert_not_called()
    update_mock.assert_not_called()
