"""Tests for channels admin"""

import pytest
from django.contrib.admin.sites import site
from django.test import RequestFactory

from channels.admin import ChannelAdmin
from channels.models import Channel
from learning_resources.factories import LearningResourceFactory


@pytest.mark.django_db
def test_featured_list_offers_learning_paths_only(admin_user):
    """
    Only a learning path can be a channel's featured list.

    The frontend reads the field as a list of its own members, which only a
    learning path is. `limit_choices_to` is what the admin's autocomplete
    filters by -- `AutocompleteJsonView` applies it to the queryset it
    searches, so the constraint reaches the dropdown rather than only a plain
    select.
    """
    path = LearningResourceFactory.create(is_learning_path=True)
    course = LearningResourceFactory.create(is_course=True, create_course=False)

    request = RequestFactory().get("/admin/channels/channel/add/")
    request.user = admin_user
    offered = (
        ChannelAdmin(Channel, site).get_form(request)().fields["featured_list"].queryset
    )

    assert path in offered
    assert course not in offered
