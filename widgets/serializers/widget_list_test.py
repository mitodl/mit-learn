"""Tests for widget list serializer"""

import pytest
from rest_framework.exceptions import ValidationError

from widgets.factories import WidgetInstanceFactory, WidgetListFactory
from widgets.serializers.widget_list import WidgetListSerializer
from widgets.views_test import EXPECTED_AVAILABLE_WIDGETS

pytestmark = [pytest.mark.django_db]


def test_missing_widget_type():
    """If a widget type is in the database but not in the serializer map, it should be ignored"""
    widget_list = WidgetListFactory.create()
    WidgetInstanceFactory.create(widget_list=widget_list, widget_type="not_A_real_type")
    assert WidgetListSerializer(widget_list).data == {
        "available_widgets": EXPECTED_AVAILABLE_WIDGETS,
        "widgets": [],
        "id": widget_list.id,
    }


@pytest.mark.parametrize("widget_type", ["not_A_real_type", "RSS Feed", None])
def test_update_with_unsupported_widget_type(widget_type):
    """
    An unsupported widget_type on update() should raise a validation error,
    not crash with TypeError trying to call a None serializer class.
    """
    widget_list = WidgetListFactory.create()
    data = {"widget_type": widget_type, "title": "x", "configuration": {}}
    if widget_type is None:
        del data["widget_type"]
    serializer = WidgetListSerializer(widget_list, data={"widgets": [data]})
    assert serializer.is_valid(), serializer.errors
    with pytest.raises(ValidationError):
        serializer.save()
