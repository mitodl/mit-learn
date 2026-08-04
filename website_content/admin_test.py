"""Tests for website_content admin"""

import pytest
from django.contrib.admin.sites import AdminSite
from django.urls import reverse

from website_content.admin import WebsiteContentAdmin
from website_content.constants import WebsiteContentType
from website_content.factories import WebsiteContentFactory
from website_content.models import WebsiteContent

pytestmark = pytest.mark.django_db


@pytest.fixture
def content_admin():
    """Return a WebsiteContentAdmin bound to a bare AdminSite"""
    return WebsiteContentAdmin(WebsiteContent, AdminSite())


@pytest.fixture
def admin_request(rf, admin_user):
    """Return a GET request authenticated as a superuser"""
    request = rf.get("/admin/")
    request.user = admin_user
    return request


@pytest.fixture
def _no_apisix(settings):
    """
    Let session-authenticated admin requests through.

    ApisixUserMiddleware logs out any authenticated user when the X-Userinfo
    header is absent, which the plain test client never sends.
    """
    settings.DISABLE_APISIX_USER_MIDDLEWARE = True


def change_url(content):
    """Return the admin change-form URL for a content item"""
    return reverse("admin:website_content_websitecontent_change", args=(content.pk,))


def change_form_post_data(**overrides):
    """Return a minimally valid admin change-form payload"""
    return {
        "title": "Edited Title",
        "content": '{"type": "doc", "content": []}',
        "content_type": WebsiteContentType.news.name,
        "author_name": "",
        "publish_date": "",
        "user": "",
        **overrides,
    }


def test_highlight_deleted_field_column_metadata(content_admin):
    """The highlighted column is labelled 'Title' and sorts on the annotation"""
    column = content_admin.highlight_deleted_field
    assert column.short_description == "Title"
    assert column.admin_order_field == "_highlighted_field"
    assert content_admin.field_to_highlight == "title"
    assert "highlight_deleted_field" in content_admin.list_display


def test_highlight_deleted_field_renders_title(content_admin):
    """A live row renders its title as-is, not the default __str__"""
    content = WebsiteContentFactory.create(title="A Live Title")

    assert content_admin.highlight_deleted_field(content) == "A Live Title"


def test_highlight_deleted_field_strikes_through_deleted(content_admin):
    """A soft-deleted row renders its title wrapped in the .deleted span"""
    content = WebsiteContentFactory.create(title="A Deleted Title")
    content.delete()

    assert (
        content_admin.highlight_deleted_field(content)
        == '<span class="deleted">A Deleted Title</span>'
    )


def test_highlight_deleted_field_escapes_title(content_admin):
    """Titles are escaped rather than rendered as HTML"""
    content = WebsiteContentFactory.create(title="<script>alert(1)</script>")

    assert (
        content_admin.highlight_deleted_field(content)
        == "&lt;script&gt;alert(1)&lt;/script&gt;"
    )


def test_admin_queryset_is_orderable_by_title(content_admin, rf):
    """The column's admin_order_field resolves, so the column is sortable"""
    WebsiteContentFactory.create(title="Beta")
    WebsiteContentFactory.create(title="Alpha")

    queryset = content_admin.get_queryset(rf.get("/admin/"))

    assert list(
        queryset.order_by("_highlighted_field").values_list("title", flat=True)
    ) == ["Alpha", "Beta"]


def test_admin_queryset_includes_soft_deleted(content_admin, rf):
    """The base queryset reaches soft-deleted rows so staff can undelete them"""
    live = WebsiteContentFactory.create(title="Live")
    deleted = WebsiteContentFactory.create(title="Gone")
    deleted.delete()

    titles = set(
        content_admin.get_queryset(rf.get("/admin/")).values_list("title", flat=True)
    )

    assert titles == {live.title, deleted.title}


@pytest.mark.usefixtures("_no_apisix")
@pytest.mark.parametrize(
    ("query", "expect_live", "expect_deleted"),
    [
        ("", True, True),  # unfiltered "All" lists deleted rows too
        ("?deleted=no", True, False),
        ("?deleted=yes", False, True),
    ],
)
def test_changelist_lists_deleted_by_default(
    admin_client, query, *, expect_live, expect_deleted
):
    """
    Soft-deleted rows show up without touching the filter.

    safedelete's own SafeDeleteAdminFilter excluded them until its parameter was
    set, which hid the rows staff need to select for "Undelete selected".
    """
    WebsiteContentFactory.create(title="StillHereTitle")
    deleted = WebsiteContentFactory.create(title="LongGoneTitle")
    deleted.delete()

    url = reverse("admin:website_content_websitecontent_changelist")
    body = admin_client.get(f"{url}{query}").content.decode()

    assert ("StillHereTitle" in body) is expect_live
    assert ("LongGoneTitle" in body) is expect_deleted


@pytest.mark.usefixtures("_no_apisix")
def test_changelist_has_one_deleted_filter(admin_client):
    """
    Only our filter is offered, not safedelete's raw date filter too.

    Spreading SafeDeleteAdmin.list_filter in rendered a second, near-identically
    titled "deleted" filter beside this one.
    """
    WebsiteContentFactory.create()

    body = admin_client.get(
        reverse("admin:website_content_websitecontent_changelist")
    ).content.decode()

    assert body.count("By deleted") == 1
    assert "Deleted only" in body
    assert "All (Including Deleted)" not in body


def test_save_model_does_not_undelete(content_admin, rf):
    """
    Saving the change form keeps a soft-deleted row deleted.

    SafeDeleteModel.save() undeletes by default, so a bare Save would resurrect
    the row with nothing on the form saying so.
    """
    content = WebsiteContentFactory.create(title="Deleted Draft")
    content.delete()

    content.title = "Deleted Draft, Edited"
    content_admin.save_model(rf.post("/admin/"), content, None, change=True)

    content.refresh_from_db()
    assert content.deleted is not None
    assert content.title == "Deleted Draft, Edited"


def test_save_model_still_saves_live_rows(content_admin, rf):
    """keep_deleted=True is a no-op for rows that were never deleted"""
    content = WebsiteContentFactory.create(title="Live Draft")

    content.title = "Live Draft, Edited"
    content_admin.save_model(rf.post("/admin/"), content, None, change=True)

    content.refresh_from_db()
    assert content.deleted is None
    assert content.title == "Live Draft, Edited"


@pytest.mark.parametrize(
    ("deleted", "is_published", "expected"),
    [
        (True, True, False),  # restoring republishes it: undelete action only
        (True, False, True),  # deleted draft stays editable
        (False, True, True),  # live published content is normal
        (False, False, True),
    ],
)
def test_has_change_permission(
    content_admin, admin_request, *, deleted, is_published, expected
):
    """Only soft-deleted published content is locked out of the change form"""
    content = WebsiteContentFactory.create(is_published=is_published)
    if deleted:
        content.delete()

    assert content_admin.has_change_permission(admin_request, content) is expected


def test_has_change_permission_without_object(content_admin, admin_request):
    """The changelist check (obj=None) falls through to the default"""
    assert content_admin.has_change_permission(admin_request) is True


@pytest.mark.usefixtures("_no_apisix")
def test_change_form_save_of_deleted_draft_succeeds_and_keeps_deleted(admin_client):
    """
    Saving a soft-deleted draft returns a redirect, not a 500.

    This is the regression: save() looked the previous row up through
    `objects`, so the lookup raised DoesNotExist for soft-deleted rows.
    """
    content = WebsiteContentFactory.create(title="Deleted Draft", is_published=False)
    content.delete()

    response = admin_client.post(change_url(content), change_form_post_data())

    assert response.status_code == 302
    content.refresh_from_db()
    assert content.title == "Edited Title"
    assert content.deleted is not None


@pytest.mark.usefixtures("_no_apisix")
def test_change_form_save_of_deleted_published_is_forbidden(admin_client):
    """A soft-deleted published item cannot be edited, even by hand-crafted POST"""
    content = WebsiteContentFactory.create(title="Deleted Published", is_published=True)
    content.delete()

    response = admin_client.post(change_url(content), change_form_post_data())

    # Django raises PermissionDenied, but main.urls points handler403 at
    # main.views.handle_error, which renders every client error as a 404.
    assert response.status_code == 404
    content.refresh_from_db()
    assert content.title == "Deleted Published"


@pytest.mark.usefixtures("_no_apisix")
def test_change_form_of_deleted_published_is_readonly(admin_client):
    """The deleted-published form still opens, but with nothing to edit"""
    content = WebsiteContentFactory.create(title="Deleted Published", is_published=True)
    content.delete()

    response = admin_client.get(change_url(content))
    body = response.content.decode()

    assert response.status_code == 200
    assert 'name="title"' not in body
    assert "read-only here" in body


@pytest.mark.usefixtures("_no_apisix")
def test_change_form_warns_that_saving_will_not_undelete(admin_client):
    """The deleted-draft form carries a warning above Save"""
    content = WebsiteContentFactory.create(title="Deleted Draft", is_published=False)
    content.delete()

    body = admin_client.get(change_url(content)).content.decode()

    assert "Saving keeps it deleted" in body
    assert "Undelete selected" in body


@pytest.mark.usefixtures("_no_apisix")
def test_change_form_has_no_warning_for_live_rows(admin_client):
    """A row that isn't deleted gets no warning"""
    content = WebsiteContentFactory.create(title="Live Draft")

    body = admin_client.get(change_url(content)).content.decode()

    assert "Saving keeps it deleted" not in body


@pytest.mark.usefixtures("_no_apisix")
@pytest.mark.parametrize("is_published", [True, False])
def test_undelete_selected_action_restores(admin_client, *, is_published):
    """
    "Undelete selected" is the supported way back, for drafts and published
    alike.
    """
    content = WebsiteContentFactory.create(is_published=is_published)
    content.delete()
    assert not WebsiteContent.objects.filter(pk=content.pk).exists()

    # No filter in the URL: the action runs against the changelist queryset, so
    # this also covers deleted rows being in scope from the default view.
    admin_client.post(
        reverse("admin:website_content_websitecontent_changelist"),
        {
            "action": "undelete_selected",
            "_selected_action": [str(content.pk)],
            "post": "yes",
        },
    )

    content.refresh_from_db()
    assert content.deleted is None
    assert WebsiteContent.objects.filter(pk=content.pk).exists()
