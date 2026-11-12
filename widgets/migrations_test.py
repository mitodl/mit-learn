"""Tests for widgets data migrations"""

import importlib

import pytest
from django.apps import apps

from widgets.factories import WidgetInstanceFactory
from widgets.models import WidgetInstance

pytestmark = pytest.mark.django_db


def test_remove_people_widgets():
    """0004 deletes People widgets and leaves other types alone"""
    people = WidgetInstanceFactory.create(
        widget_type="People", configuration={"people": ["someone@example.com"]}
    )
    markdown = WidgetInstanceFactory.create(type_markdown=True)
    module = importlib.import_module("widgets.migrations.0004_remove_people")

    module.remove_people_widgets(apps, None)

    assert not WidgetInstance.objects.filter(id=people.id).exists()
    assert WidgetInstance.objects.filter(id=markdown.id).exists()
