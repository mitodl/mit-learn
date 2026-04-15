"""Management command to sync HubSpot contact property choices."""

from __future__ import annotations

import json
from argparse import BooleanOptionalAction, RawTextHelpFormatter

from django.core.management.base import BaseCommand, CommandError
from hubspot.crm.properties.exceptions import ApiException as CrmPropertiesApiException

from learning_resources.constants import LearningResourceType
from learning_resources.models import LearningResource
from ol_hubspot.api import (
    create_contact_property,
    get_contact_property,
    update_contact_property_choices,
)

HUBSPOT_NOT_FOUND_STATUS = 404


def _parse_lookup_value(raw_value: str):
    """Parse lookup values using JSON semantics when possible."""
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        return raw_value


def _parse_lookup_expression(expression: str) -> tuple[str, object]:
    """Parse a lookup expression in the form lookup=value."""
    if "=" not in expression:
        msg = f"Invalid lookup expression '{expression}'. Expected lookup=value."
        raise CommandError(msg)

    lookup, raw_value = expression.split("=", 1)
    lookup = lookup.strip()
    if not lookup:
        msg = f"Invalid lookup expression '{expression}'. Empty lookup."
        raise CommandError(msg)

    return lookup, _parse_lookup_value(raw_value)


class Command(BaseCommand):
    """Sync choices into a HubSpot contact property."""

    help = "Create or update a HubSpot contact property from LearningResource data."

    def add_arguments(self, parser):
        """Configure arguments for this command."""
        parser.formatter_class = RawTextHelpFormatter
        parser.epilog = (
            "Examples:\n"
            "  python manage.py update_hubspot_contact_property_choices "
            "learner_interest_choices \\\n"
            "    --learning-resource-field title \\\n"
            "    --resource-order-by title \\\n"
            "    --property-field-type checkbox\n\n"
            "  python manage.py update_hubspot_contact_property_choices "
            "learner_interest_choices \\\n"
            "    --learning-resource-field offered_by__name \\\n"
            "    --resource-filter professional=true \\\n"
            "    --resource-type course --resource-type program \\\n"
            "    --resource-distinct\n\n"
            "Filter syntax:\n"
            "  --resource-filter <lookup>=<value>\n"
            "  --resource-exclude <lookup>=<value>\n"
            "Values are JSON-decoded when possible, so use true/false/null, "
            "numbers, or quoted strings."
        )

        parser.add_argument(
            "property_name",
            help="HubSpot contact property internal name to create/update",
        )

        parser.add_argument(
            "--learning-resource-field",
            dest="learning_resource_field",
            required=True,
            help=(
                "LearningResource field/annotation to use for option values. "
                "Supports Django double-underscore traversal."
            ),
        )

        parser.add_argument(
            "--resource-filter",
            dest="resource_filters",
            action="append",
            default=[],
            help="Filter expression lookup=value (JSON value parsing supported)",
        )
        parser.add_argument(
            "--resource-exclude",
            dest="resource_excludes",
            action="append",
            default=[],
            help="Exclude expression lookup=value (JSON value parsing supported)",
        )
        parser.add_argument(
            "--resource-order-by",
            dest="resource_order_by",
            action="append",
            default=[],
            help="Order by a field. Pass multiple times for compound ordering.",
        )
        parser.add_argument(
            "--resource-distinct",
            dest="resource_distinct",
            action="store_true",
            help="Apply distinct() before extracting values",
        )
        parser.add_argument(
            "--resource-type",
            dest="resource_types",
            action="append",
            choices=LearningResourceType.names(),
            default=[
                LearningResourceType.course.name,
                LearningResourceType.program.name,
            ],
            help=(
                "LearningResource resource_type to include. "
                "Defaults to course and program."
            ),
        )
        parser.add_argument(
            "--include-unpublished",
            dest="include_unpublished",
            action="store_true",
            help="Include unpublished resources (default is published only)",
        )
        parser.add_argument(
            "--property-label",
            dest="property_label",
            help="Human-readable HubSpot property label (defaults from name)",
        )
        parser.add_argument(
            "--property-description",
            dest="property_description",
            default="",
            help="Description/help text for the HubSpot property",
        )
        parser.add_argument(
            "--property-group-name",
            dest="property_group_name",
            default="contactinformation",
            help="HubSpot contact property group name",
        )
        parser.add_argument(
            "--property-field-type",
            dest="property_field_type",
            choices=["checkbox", "select", "radio"],
            default="checkbox",
            help="HubSpot fieldType for enumeration properties",
        )
        parser.add_argument(
            "--form-field",
            dest="form_field",
            action=BooleanOptionalAction,
            default=True,
            help="Whether the property should be available on HubSpot forms",
        )

        parser.add_argument(
            "--allow-empty",
            dest="allow_empty",
            action="store_true",
            help="Allow updating with an empty option list",
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help="Show computed options without writing to HubSpot",
        )

    def _resolve_choice_values_from_learning_resources(
        self, options: dict
    ) -> list[str]:
        """Build option values from LearningResource records."""
        value_field = options["learning_resource_field"]
        queryset = LearningResource.objects.all()

        if not options["include_unpublished"]:
            queryset = queryset.filter(published=True)

        resource_types = options.get("resource_types", [])
        if resource_types:
            queryset = queryset.filter(resource_type__in=resource_types)

        for expression in options.get("resource_filters", []):
            lookup, value = _parse_lookup_expression(expression)
            queryset = queryset.filter(**{lookup: value})

        for expression in options.get("resource_excludes", []):
            lookup, value = _parse_lookup_expression(expression)
            queryset = queryset.exclude(**{lookup: value})

        order_by = options.get("resource_order_by", [])
        if order_by:
            queryset = queryset.order_by(*order_by)

        values_qs = queryset.values_list(value_field, flat=True)
        if options.get("resource_distinct"):
            values_qs = values_qs.distinct()

        return [str(value) for value in values_qs if value is not None]

    def _resolve_choice_values(self, options: dict) -> list[str]:
        """Resolve option values from LearningResource data."""
        resource_values = self._resolve_choice_values_from_learning_resources(options)

        values = [value.strip() for value in resource_values if value and value.strip()]

        # Keep first occurrence order while de-duplicating.
        return list(dict.fromkeys(values))

    def handle(self, *args, **options):  # noqa: ARG002
        """Create or update one HubSpot contact property."""
        property_name = options["property_name"]

        option_values = self._resolve_choice_values(options)
        if not option_values and not options["allow_empty"]:
            msg = (
                "No choices were resolved from LearningResource data. "
                "Adjust --learning-resource-field and filters, or pass "
                "--allow-empty to intentionally clear options."
            )
            raise CommandError(msg)

        self.stdout.write(
            f"Resolved {len(option_values)} choices for property '{property_name}'."
        )

        if options["dry_run"]:
            self.stdout.write("Dry run enabled, no changes sent to HubSpot.")
            self.stdout.write(
                f"Would create or update property '{property_name}' with these options."
            )
            self.stdout.write(
                json.dumps(
                    [
                        {
                            "displayOrder": index,
                            "label": value,
                            "value": value,
                            "hidden": False,
                        }
                        for index, value in enumerate(option_values)
                    ],
                    indent=2,
                )
            )
            return

        try:
            existing_property = get_contact_property(property_name=property_name)
        except CrmPropertiesApiException as exc:
            if exc.status == HUBSPOT_NOT_FOUND_STATUS:
                existing_property = None
            else:
                msg = (
                    "Unable to read HubSpot contact property "
                    f"'{property_name}': {exc.reason}"
                )
                raise CommandError(msg) from exc

        existing_type = getattr(existing_property, "type", None)
        if existing_property is not None and existing_type != "enumeration":
            msg = (
                f"Existing contact property '{property_name}' has unsupported "
                f"type '{existing_type}'. Expected 'enumeration'."
            )
            raise CommandError(msg)

        if existing_property is None:
            property_label = (
                options["property_label"] or property_name.replace("_", " ").title()
            )

        try:
            if existing_property is None:
                create_contact_property(
                    property_name=property_name,
                    label=property_label,
                    option_values=option_values,
                    group_name=options["property_group_name"],
                    field_type=options["property_field_type"],
                    description=options["property_description"],
                    form_field=options["form_field"],
                )
                result_message = (
                    f"Created contact property '{property_name}' with "
                    f"{len(option_values)} choices."
                )
            else:
                update_contact_property_choices(
                    property_name=property_name,
                    option_values=option_values,
                )
                result_message = (
                    f"Updated contact property '{property_name}' with "
                    f"{len(option_values)} choices."
                )
        except CrmPropertiesApiException as exc:
            msg = (
                "Unable to sync HubSpot contact property "
                f"'{property_name}': {exc.reason}"
            )
            raise CommandError(msg) from exc

        self.stdout.write(self.style.SUCCESS(result_message))
