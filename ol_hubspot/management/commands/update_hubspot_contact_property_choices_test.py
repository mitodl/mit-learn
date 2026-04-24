"""Tests for syncing HubSpot contact property choices via management command."""

from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from hubspot.crm.properties.exceptions import ApiException as CrmPropertiesApiException

from learning_resources.factories import LearningResourceFactory


@pytest.mark.django_db
def test_command_creates_contact_property_when_missing(mocker, faker):
    """Command creates contact property when get-by-name returns 404."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="Algorithms",
        readable_id="algorithms",
        etl_source="mitxonline",
    )
    LearningResourceFactory(
        is_program=True,
        title="Data Science Program",
        readable_id="data-science-program",
        etl_source="mitxonline",
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
        "--option-label-field",
        "title",
        "--option-value-field",
        "readable_id",
        "--etl-source",
        "mitxonline",
        "--resource-order-by",
        "title",
        stdout=stdout,
    )

    create_mock.assert_called_once()
    update_mock.assert_not_called()
    kwargs = create_mock.call_args.kwargs
    assert kwargs["property_name"] == property_name
    assert kwargs["label"] == property_name.replace("_", " ").title()
    assert kwargs["options"] == [
        {"label": "Algorithms", "value": "algorithms"},
        {"label": "Data Science Program", "value": "data-science-program"},
    ]


@pytest.mark.django_db
def test_command_updates_existing_contact_property(mocker, faker):
    """Command updates options when the target contact property already exists."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="AI Foundations",
        readable_id="ai-foundations",
        etl_source="mitxonline",
    )
    LearningResourceFactory(
        is_program=True,
        title="AI Program",
        readable_id="ai-program",
        etl_source="mitxonline",
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
        "--option-label-field",
        "title",
        "--option-value-field",
        "readable_id",
        "--etl-source",
        "mitxonline",
        "--resource-filter",
        "title__icontains=AI",
        "--resource-order-by",
        "title",
        "--resource-distinct",
    )

    create_mock.assert_not_called()
    update_mock.assert_called_once_with(
        property_name=property_name,
        options=[
            {"label": "AI Foundations", "value": "ai-foundations"},
            {"label": "AI Program", "value": "ai-program"},
        ],
    )


@pytest.mark.django_db
def test_command_disambiguates_duplicate_labels_with_value_suffix(mocker, faker):
    """Command makes duplicate labels unique for HubSpot while preserving values."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="Generative AI Playbook",
        readable_id="gai-playbook-a",
        etl_source="mitxonline",
    )
    LearningResourceFactory(
        is_program=True,
        title="Generative AI Playbook",
        readable_id="gai-playbook-b",
        etl_source="mitxonline",
    )

    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        side_effect=CrmPropertiesApiException(status=404, reason="Not Found"),
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )

    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--option-label-field",
        "title",
        "--option-value-field",
        "readable_id",
        "--etl-source",
        "mitxonline",
        "--resource-order-by",
        "title",
    )

    create_mock.assert_called_once_with(
        property_name=property_name,
        label=property_name.replace("_", " ").title(),
        options=[
            {
                "label": "Generative AI Playbook (gai-playbook-a)",
                "value": "gai-playbook-a",
            },
            {
                "label": "Generative AI Playbook (gai-playbook-b)",
                "value": "gai-playbook-b",
            },
        ],
        group_name="contactinformation",
        field_type="checkbox",
        description="",
        form_field=True,
    )


@pytest.mark.django_db
def test_command_avoids_collisions_with_existing_original_labels(mocker, faker):
    """Disambiguated labels should not collide with any pre-existing label."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="Test",
        readable_id="a",
        etl_source="mitxonline",
    )
    LearningResourceFactory(
        is_program=True,
        title="Test",
        readable_id="b",
        etl_source="mitxonline",
    )
    LearningResourceFactory(
        is_program=True,
        title="Test (b)",
        readable_id="c",
        etl_source="mitxonline",
    )

    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        side_effect=CrmPropertiesApiException(status=404, reason="Not Found"),
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )

    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--option-label-field",
        "title",
        "--option-value-field",
        "readable_id",
        "--etl-source",
        "mitxonline",
        "--resource-order-by",
        "title",
    )

    create_mock.assert_called_once()
    labels = [option["label"] for option in create_mock.call_args.kwargs["options"]]
    assert len(labels) == len(set(labels))
    assert "Test (a)" in labels
    assert "Test (b)" in labels
    assert "Test (b) [2]" in labels


@pytest.mark.django_db
def test_command_uses_label_field_as_value_field_by_default(mocker, faker):
    """Command preserves the current label=value behavior unless overridden."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(
        is_course=True,
        title="Algorithms",
        etl_source="mitxonline",
    )

    mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.get_contact_property",
        side_effect=CrmPropertiesApiException(status=404, reason="Not Found"),
    )
    create_mock = mocker.patch(
        "ol_hubspot.management.commands.update_hubspot_contact_property_choices.create_contact_property"
    )

    call_command(
        "update_hubspot_contact_property_choices",
        property_name,
        "--option-label-field",
        "title",
        "--etl-source",
        "mitxonline",
    )

    create_mock.assert_called_once_with(
        property_name=property_name,
        label=property_name.replace("_", " ").title(),
        options=[{"label": "Algorithms", "value": "Algorithms"}],
        group_name="contactinformation",
        field_type="checkbox",
        description="",
        form_field=True,
    )


@pytest.mark.django_db
def test_command_rejects_non_enumeration_existing_property(mocker, faker):
    """Command errors if an existing property is not an enumeration."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(is_course=True, title="Algorithms", etl_source="mitxonline")

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
            "--option-label-field",
            "title",
            "--etl-source",
            "mitxonline",
        )

    assert "unsupported type" in str(exc_info.value)


@pytest.mark.django_db
def test_command_dry_run_skips_hubspot_lookup(mocker, faker):
    """Dry-run should not read HubSpot, even if lookup would fail."""
    property_name = faker.slug().replace("-", "_")
    LearningResourceFactory(is_course=True, title="Algorithms", etl_source="mitxonline")

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
        "--option-label-field",
        "title",
        "--etl-source",
        "mitxonline",
        "--dry-run",
    )

    get_property_mock.assert_not_called()
    create_mock.assert_not_called()
    update_mock.assert_not_called()
