"""Tests for channels admin"""

import pytest
from django.contrib.admin.sites import site
from django.test import RequestFactory

from channels.admin import ChannelAdmin
from channels.factories import ChannelFactory
from channels.models import Channel
from learning_resources.factories import LearningResourceFactory
from main.utils import path_surrogate_key


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


@pytest.mark.django_db
def test_name_and_type_are_locked_once_the_channel_exists(admin_user):
    """A new channel sets its name and type; an existing one can't change them"""
    request = RequestFactory().get("/")
    request.user = admin_user
    channel_admin = ChannelAdmin(Channel, site)

    new_readonly = channel_admin.get_readonly_fields(request)
    existing_readonly = channel_admin.get_readonly_fields(
        request, ChannelFactory.create()
    )

    assert {"name", "channel_type"}.isdisjoint(new_readonly)
    assert {"name", "channel_type"} <= set(existing_readonly)


@pytest.fixture
def mock_views_clear(mocker):
    """Mock the Redis view-cache clear, in both modules that call it"""
    mock = mocker.patch("channels.admin.clear_views_cache")
    mocker.patch("channels.api.clear_views_cache", new=mock)
    return mock


@pytest.fixture
def mock_purge(mocker):
    """Mock the Fastly surrogate-key purge"""
    return mocker.patch("channels.api.call_fastly_purge_surrogate_keys")


def cleared_prefixes(mock_views_clear):
    """Return the sorted Redis key prefixes cleared"""
    return sorted(c.kwargs["key_prefix"] for c in mock_views_clear.call_args_list)


def purged_keys(mock_purge):
    """Return the sorted surrogate keys purged"""
    return sorted(key for c in mock_purge.call_args_list for key in c.args[0])


def keys_for(*urls):
    """Return the sorted path keys for the given page URLs and the homepage"""
    return sorted(path_surrogate_key(url) for url in (*urls, "/"))


@pytest.fixture
def save_channel(admin_user, django_capture_on_commit_callbacks):
    """Save a channel through the admin and run its on-commit callbacks"""
    request = RequestFactory().post("/")
    request.user = admin_user

    def _save(channel):
        with django_capture_on_commit_callbacks(execute=True):
            ChannelAdmin(Channel, site).save_model(
                request, channel, form=None, change=True
            )

    return _save


@pytest.mark.django_db
def test_save_clears_channel_and_featured_caches(
    save_channel, mock_views_clear, mock_purge
):
    """
    Saving a channel clears the cached channel and featured responses, and
    purges the channel's page and the homepage
    """
    channel = ChannelFactory.create()

    save_channel(channel)

    assert cleared_prefixes(mock_views_clear) == ["channels", "featured_resources"]
    assert purged_keys(mock_purge) == keys_for(channel.channel_url)


@pytest.mark.django_db
def test_unpublish_purges_the_old_page(save_channel, mock_views_clear, mock_purge):
    """
    An unpublished channel has no channel_url, so the page purged is the one
    at the URL it had before the save
    """
    channel = ChannelFactory.create()
    old_url = Channel.objects.get(pk=channel.pk).channel_url
    channel.published = False

    save_channel(channel)

    assert purged_keys(mock_purge) == keys_for(old_url)


@pytest.mark.django_db
def test_delete_clears_channel_caches(
    admin_user, mock_views_clear, mock_purge, django_capture_on_commit_callbacks
):
    """Deleting a channel clears its cached responses and purges its page"""
    channel = ChannelFactory.create()
    url = channel.channel_url
    request = RequestFactory().post("/")
    request.user = admin_user

    with django_capture_on_commit_callbacks(execute=True):
        ChannelAdmin(Channel, site).delete_model(request, channel)

    assert cleared_prefixes(mock_views_clear) == ["channels", "featured_resources"]
    assert purged_keys(mock_purge) == keys_for(url)


@pytest.mark.django_db
def test_bulk_delete_clears_channel_caches(
    admin_user, mock_views_clear, mock_purge, django_capture_on_commit_callbacks
):
    """
    Bulk-deleting channels clears their cached responses and purges every
    deleted channel's page
    """
    urls = [channel.channel_url for channel in ChannelFactory.create_batch(2)]
    request = RequestFactory().post("/")
    request.user = admin_user

    with django_capture_on_commit_callbacks(execute=True):
        ChannelAdmin(Channel, site).delete_queryset(request, Channel.objects.all())

    assert cleared_prefixes(mock_views_clear) == ["channels", "featured_resources"]
    assert purged_keys(mock_purge) == keys_for(*urls)


@pytest.mark.django_db
def test_failed_view_clear_still_purges_pages(
    save_channel, mock_views_clear, mock_purge
):
    """A failing Redis clear doesn't break the admin save or skip the purge"""
    mock_views_clear.side_effect = Exception("redis down")
    channel = ChannelFactory.create()

    save_channel(channel)

    assert purged_keys(mock_purge) == keys_for(channel.channel_url)
