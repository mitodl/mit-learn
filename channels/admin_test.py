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


def purged(mock_purge):
    """
    Return the sorted channel-page keys purged, and whether the homepage was
    purged
    """
    keys = {key for c in mock_purge.call_args_list for key in c.args[0]}
    return sorted(keys - {"path:/"}), "path:/" in keys


def keys_for(*urls):
    """Return the sorted path keys for the given page URLs"""
    return sorted(path_surrogate_key(url) for url in urls)


@pytest.fixture
def save_channel(admin_user, django_capture_on_commit_callbacks):
    """Save a channel through the admin and run its on-commit callbacks"""
    request = RequestFactory().post("/")
    request.user = admin_user

    def _save(channel, *, change=True):
        with django_capture_on_commit_callbacks(execute=True):
            ChannelAdmin(Channel, site).save_model(
                request, channel, form=None, change=change
            )

    return _save


@pytest.mark.django_db
def test_add_clears_all_views_and_purges_page(
    save_channel, mock_views_clear, mock_purge
):
    """Adding a channel gives it a channel_url, so every cached view is cleared"""
    channel = ChannelFactory.build()

    save_channel(channel, change=False)

    assert Channel.objects.filter(pk=channel.pk).exists()
    mock_views_clear.assert_called_once_with(key_prefix=None)
    assert purged(mock_purge) == (keys_for(channel.channel_url), True)


@pytest.mark.django_db
def test_content_edit_clears_channel_caches(save_channel, mock_views_clear, mock_purge):
    """
    An edit that leaves the channel's URL alone clears only the cached channel
    responses, and purges the page at its channel_url
    """
    channel = ChannelFactory.create()
    channel.title = f"{channel.title} edited"

    save_channel(channel)

    mock_views_clear.assert_called_once_with(key_prefix="channels")
    assert purged(mock_purge) == (keys_for(channel.channel_url), False)


@pytest.mark.django_db
def test_featured_list_edit_clears_featured_caches(
    save_channel, mock_views_clear, mock_purge
):
    """
    Changing the featured list also clears the featured rows and purges the
    homepage, which shows them
    """
    channel = ChannelFactory.create()
    channel.featured_list = LearningResourceFactory.create()

    save_channel(channel)

    assert [c.kwargs for c in mock_views_clear.call_args_list] == [
        {"key_prefix": "channels"},
        {"key_prefix": "featured_resources"},
    ]
    assert purged(mock_purge) == (keys_for(channel.channel_url), True)


@pytest.mark.django_db
def test_rename_clears_all_views_and_both_pages(
    save_channel, mock_views_clear, mock_purge
):
    """
    A rename moves the channel_url other responses embed, so every cached view
    is cleared, and the pages at the old and new URLs are both purged
    """
    channel = ChannelFactory.create()
    old_url = Channel.objects.get(pk=channel.pk).channel_url
    channel.name = f"{channel.name}-renamed"

    save_channel(channel)

    mock_views_clear.assert_called_once_with(key_prefix=None)
    assert purged(mock_purge) == (keys_for(old_url, channel.channel_url), True)


@pytest.mark.django_db
def test_unpublish_clears_all_views_and_purges_old_page(
    save_channel, mock_views_clear, mock_purge
):
    """
    An unpublished channel has no channel_url, so the page purged is the one
    at the URL it had before the save
    """
    channel = ChannelFactory.create()
    old_url = Channel.objects.get(pk=channel.pk).channel_url
    channel.published = False

    save_channel(channel)

    mock_views_clear.assert_called_once_with(key_prefix=None)
    assert purged(mock_purge) == (keys_for(old_url), True)


@pytest.mark.django_db
def test_delete_clears_channel_caches(
    admin_user, mock_views_clear, mock_purge, django_capture_on_commit_callbacks
):
    """Deleting a channel clears every cached view and purges its page"""
    channel = ChannelFactory.create()
    url = channel.channel_url
    request = RequestFactory().post("/")
    request.user = admin_user

    with django_capture_on_commit_callbacks(execute=True):
        ChannelAdmin(Channel, site).delete_model(request, channel)

    assert not Channel.objects.exists()
    mock_views_clear.assert_called_once_with(key_prefix=None)
    assert purged(mock_purge) == (keys_for(url), True)


@pytest.mark.django_db
def test_bulk_delete_clears_channel_caches(
    admin_user, mock_views_clear, mock_purge, django_capture_on_commit_callbacks
):
    """
    Bulk-deleting channels clears every cached view and purges every deleted
    channel's page
    """
    urls = [channel.channel_url for channel in ChannelFactory.create_batch(2)]
    request = RequestFactory().post("/")
    request.user = admin_user

    with django_capture_on_commit_callbacks(execute=True):
        ChannelAdmin(Channel, site).delete_queryset(request, Channel.objects.all())

    assert not Channel.objects.exists()
    mock_views_clear.assert_called_once_with(key_prefix=None)
    assert purged(mock_purge) == (keys_for(*urls), True)


@pytest.mark.django_db
def test_failed_view_clear_still_purges_pages(
    save_channel, mock_views_clear, mock_purge
):
    """A failing Redis clear doesn't break the admin save or skip the page purges"""
    mock_views_clear.side_effect = Exception("redis down")
    channel = ChannelFactory.create()
    old_url = Channel.objects.get(pk=channel.pk).channel_url
    channel.name = f"{channel.name}-renamed"

    save_channel(channel)

    assert purged(mock_purge) == (keys_for(old_url, channel.channel_url), True)
