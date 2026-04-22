"""Management command to sync HubSpot contact property choices."""

from __future__ import annotations

import json
from argparse import BooleanOptionalAction, RawTextHelpFormatter
from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from hubspot.crm.properties.exceptions import ApiException as CrmPropertiesApiException

from learning_resources.constants import LearningResourceType
from learning_resources.models import LearningResource
from ol_hubspot.api import (
    ContactPropertyOption,
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
    raw_value = raw_value.strip()
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
                "LearningResource field/annotation to use for option labels. "
                "Supports Django double-underscore traversal."
            ),
        )
        parser.add_argument(
            "--option-value-field",
            dest="option_value_field",
            help=(
                "LearningResource field/annotation to use for option values. "
                "Defaults to --learning-resource-field."
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
            default=None,
            help=(
                "LearningResource resource_type to include. "
                "Defaults to course and program when not specified."
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
    ) -> list[tuple[object, object]]:
        """Build option labels and values from LearningResource records."""
        label_field = options["learning_resource_field"]
        value_field = options.get("option_value_field") or label_field
        queryset = LearningResource.objects.all()

        if not options["include_unpublished"]:
            queryset = queryset.filter(published=True)

        resource_types = options.get("resource_types") or [
            LearningResourceType.course.name,
            LearningResourceType.program.name,
        ]
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

        values_qs = queryset.values_list(label_field, value_field)
        if options.get("resource_distinct"):
            values_qs = values_qs.order_by().distinct()

        return [
            (label, value)
            for label, value in values_qs
            if label is not None and value is not None
        ]

    def _resolve_choice_options(self, options: dict) -> list[ContactPropertyOption]:
        """Resolve HubSpot options from LearningResource data."""
        resource_values = self._resolve_choice_values_from_learning_resources(options)

        deduped_options: dict[str, str] = {}
        for raw_label, raw_value in resource_values:
            label = str(raw_label).strip()
            value = str(raw_value).strip()
            if not label or not value:
                continue
            deduped_options.setdefault(value, label)

        sorted_options = [
            {"label": label, "value": value}
            for value, label in sorted(
                deduped_options.items(), key=lambda item: item[1]
            )
        ]

        return self._uniquify_option_labels(sorted_options)

    def _uniquify_option_labels(
        self, options: list[ContactPropertyOption]
    ) -> list[ContactPropertyOption]:
        """Ensure labels are unique for HubSpot enumeration properties."""
        label_counts = Counter(option["label"] for option in options)
        original_labels = {option["label"] for option in options}
        used_labels: set[str] = set()
        unique_options: list[ContactPropertyOption] = []

        for option in options:
            label = option["label"]
            if label_counts[label] == 1:
                unique_options.append(option)
                used_labels.add(label)
                continue

            candidate_label = f"{label} ({option['value']})"
            suffix = 2
            while candidate_label in used_labels or candidate_label in original_labels:
                candidate_label = f"{label} ({option['value']}) [{suffix}]"
                suffix += 1

            unique_options.append({**option, "label": candidate_label})
            used_labels.add(candidate_label)

        return unique_options

    def handle(self, *args, **options):  # noqa: ARG002
        """Create or update one HubSpot contact property."""
        property_name = options["property_name"]

        property_options = self._resolve_choice_options(options)
        if not property_options and not options["allow_empty"]:
            msg = (
                "No choices were resolved from LearningResource data. "
                "Adjust --learning-resource-field, --option-value-field, and "
                "filters, or pass "
                "--allow-empty to intentionally clear options."
            )
            raise CommandError(msg)

        self.stdout.write(
            f"Resolved {len(property_options)} choices for property '{property_name}'."
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
                            "label": option["label"],
                            "value": option["value"],
                            "hidden": False,
                        }
                        for index, option in enumerate(property_options)
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
                    f"'{property_name}': {exc.reason} - {exc.body}"
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
                    options=property_options,
                    group_name=options["property_group_name"],
                    field_type=options["property_field_type"],
                    description=options["property_description"],
                    form_field=options["form_field"],
                )
                result_message = (
                    f"Created contact property '{property_name}' with "
                    f"{len(property_options)} choices."
                )
            else:
                update_contact_property_choices(
                    property_name=property_name,
                    options=property_options,
                )
                result_message = (
                    f"Updated contact property '{property_name}' with "
                    f"{len(property_options)} choices."
                )
        except CrmPropertiesApiException as exc:
            msg = (
                "Unable to sync HubSpot contact property "
                f"'{property_name}': {exc.reason} - {exc.body}"
            )
            raise CommandError(msg) from exc

        self.stdout.write(self.style.SUCCESS(result_message))
