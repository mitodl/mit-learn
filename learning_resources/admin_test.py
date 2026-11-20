"""Tests for learning_resources admin"""

import pytest
from django.contrib.admin.sites import site
from django.contrib.admin.widgets import AdminTextareaWidget
from django.contrib.auth.models import Permission
from django.test import RequestFactory
from django.urls import reverse

from learning_resources.admin import (
    CredentialMetadataAdmin,
    ETLShadowRunAdmin,
    LearningResourceAdmin,
    TutorProblemFileAdmin,
    UnitAdmin,
    UnitContentFileInline,
)
from learning_resources.factories import (
    CredentialMetadataFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    TutorProblemFileFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import (
    CredentialMetadata,
    ETLShadowRun,
    LearningResource,
    TutorProblemFile,
    Unit,
)


@pytest.mark.django_db
def test_tutor_problem_file_changelist_query_count(
    admin_user, django_assert_num_queries
):
    """Changelist query count should not grow with the number of rows"""
    for _ in range(5):
        TutorProblemFileFactory.create(run=LearningResourceRunFactory.create())
    request = RequestFactory().get(
        reverse("admin:learning_resources_tutorproblemfile_changelist")
    )
    request.user = admin_user
    model_admin = TutorProblemFileAdmin(TutorProblemFile, site)
    with django_assert_num_queries(3):
        model_admin.changelist_view(request).render()


@pytest.fixture
def criteria_field():
    """Return the `criteria` form field as the admin change form builds it"""
    model_admin = CredentialMetadataAdmin(CredentialMetadata, site)
    return model_admin.get_form(None)().fields["criteria"]


@pytest.mark.django_db
def test_credential_metadata_criteria_is_a_textarea(criteria_field):
    """
    `criteria` gets a textarea, like `description` beside it.

    An ArrayField otherwise renders through SimpleArrayField, a CharField
    subclass, so it lands in a one-line TextInput too small to read the
    criteria it holds.
    """
    assert isinstance(criteria_field.widget, AdminTextareaWidget)


@pytest.mark.django_db
def test_credential_metadata_criteria_is_one_per_line(criteria_field):
    """The stored list is shown a criterion per line, and read back the same"""
    stored = ["Applied conservation laws", "Modelled fluid flow"]

    shown = criteria_field.prepare_value(stored)

    assert shown == "Applied conservation laws\nModelled fluid flow"
    assert criteria_field.clean(shown) == stored


@pytest.mark.django_db
def test_credential_metadata_criteria_keeps_a_comma(criteria_field):
    """
    A criterion containing a comma survives a round trip.

    Comma-separated, `SimpleArrayField` would cut this one in two on save,
    with no way to escape it -- and criteria are prose, so commas are
    ordinary.
    """
    stored = ["Applied conservation laws, including mass and momentum"]

    assert criteria_field.clean(criteria_field.prepare_value(stored)) == stored


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("submitted", "expected"),
    [
        # Browsers submit CRLF from a textarea.
        ("One\r\nTwo", ["One", "Two"]),
        # A trailing newline or a gap between entries is not an empty
        # criterion.
        ("One\n\n\nTwo\n", ["One", "Two"]),
        ("   \n", []),
        ("", []),
    ],
)
def test_credential_metadata_criteria_cleans_whitespace(
    criteria_field, submitted, expected
):
    """Line endings and blank lines do not become criteria"""
    assert criteria_field.clean(submitted) == expected


@pytest.mark.django_db
def test_credential_metadata_change_view_renders(admin_user):
    """The change form itself still renders with the overridden field"""
    stored = CredentialMetadataFactory.create(criteria=["Did a thing"])
    request = RequestFactory().get(
        reverse("admin:learning_resources_credentialmetadata_change", args=(stored.id,))
    )
    request.user = admin_user

    response = CredentialMetadataAdmin(CredentialMetadata, site).change_view(
        request, str(stored.id)
    )

    assert response.status_code == 200
    assert b"Did a thing" in response.render().content


@pytest.fixture
def searchable_resources():
    """
    Two resources, and only two.

    Both parts matter to a search for a bare primary key. The factory's
    `readable_id` carries a random number, which such a search matches as a
    substring whenever those digits land inside it, so these name their own and
    neither those nor the titles hold a digit. And a resource of a fuzzily
    chosen type brings related resources along -- a podcast its episodes, a
    playlist its videos -- each with a random readable id of its own, so the
    type is pinned to one that brings nothing.
    """
    return (
        LearningResourceFactory.create(
            is_course=True,
            create_course=False,
            title="Fluid Mechanics",
            readable_id="course-v1:fluid-mechanics",
        ),
        LearningResourceFactory.create(
            is_course=True,
            create_course=False,
            title="Thermodynamics",
            readable_id="course-v1:thermodynamics",
        ),
    )


@pytest.fixture
def resource_search():
    """Search the LearningResource admin the way its autocomplete does.

    Over the resources handed in rather than the whole table, which is what the
    admin does too: it passes `get_queryset(request)`. A test that searched
    everything would answer for whatever else the database happened to hold.
    """
    model_admin = LearningResourceAdmin(LearningResource, site)

    def search(term, among):
        request = RequestFactory().get("/admin/autocomplete/")
        results, _ = model_admin.get_search_results(
            request,
            LearningResource.objects.filter(pk__in=[r.pk for r in among]),
            term,
        )
        return list(results)

    return search


@pytest.mark.django_db
def test_resource_search_finds_a_bare_id(resource_search, searchable_resources):
    """
    A resource is found by its primary key, which is how one is identified in
    an admin URL or a bug report.
    """
    wanted, _other = searchable_resources

    assert resource_search(str(wanted.id), searchable_resources) == [wanted]


@pytest.mark.django_db
def test_resource_search_still_finds_a_title(resource_search, searchable_resources):
    """Searching by title keeps working alongside the id lookup"""
    wanted, _other = searchable_resources

    assert resource_search("Fluid", searchable_resources) == [wanted]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "term",
    [
        "nothing matches this",
        # `int` reads none of these either, though `isdigit` answers for them.
        "²",
        "₁",
        "①",
    ],
)
def test_resource_search_takes_a_term_that_is_not_a_number(
    resource_search, searchable_resources, term
):
    """A term `int` cannot read is searched for by the `search_fields` alone"""
    assert resource_search(term, searchable_resources) == []


@pytest.mark.django_db
def test_resource_is_named_by_its_title():
    """
    A resource names itself by title, so the autocomplete lists titles.

    Django renders a dropdown entry with `str()`, which without this is
    "LearningResource object (123)" -- unrecognisable, and the point of
    searching is to recognise what comes back.
    """
    resource = LearningResourceFactory.create(
        is_course=True,
        create_course=False,
        title="Fluid Mechanics",
        readable_id="course-v1:MITx+2.006",
    )

    assert str(resource) == "Fluid Mechanics (Course: course-v1:MITx+2.006)"


@pytest.mark.django_db
def test_etl_shadow_run_admin_is_read_only(admin_client, admin_user):
    """A superuser can read a shadow run's report and cannot add, change or delete it."""
    run = ETLShadowRun.objects.create(
        etl_source="ocw",
        resource_type="course",
        pipeline="warehouse",
        counts={"created": 1, "unpublished": 2, "updated": 3, "unchanged": 4},
        details={"created": ["a-new-course"]},
    )
    request = RequestFactory().get("/")
    request.user = admin_user
    model_admin = ETLShadowRunAdmin(ETLShadowRun, site)

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request, run) is False
    assert model_admin.has_delete_permission(request, run) is False

    changelist = admin_client.get(
        reverse("admin:learning_resources_etlshadowrun_changelist")
    )
    assert changelist.status_code == 200
    detail = admin_client.get(
        reverse("admin:learning_resources_etlshadowrun_change", args=(run.id,))
    )
    assert detail.status_code == 200
    assert b"a-new-course" in detail.content
    delete = admin_client.post(
        reverse("admin:learning_resources_etlshadowrun_delete", args=(run.id,)),
        {"post": "yes"},
    )
    assert delete.status_code == 403
    assert ETLShadowRun.objects.filter(id=run.id).exists()


@pytest.mark.django_db
def test_unit_changelist_shows_content_file_counts(admin_client):
    """The unit list renders with each unit's number of content files"""
    unit = UnitFactory.create(title="Week 1: Vectors")
    UnitContentFileFactory.create_batch(3, unit=unit)
    UnitFactory.create()

    resp = admin_client.get(reverse("admin:learning_resources_unit_changelist"))

    assert resp.status_code == 200
    assert b"Week 1: Vectors" in resp.content
    counts = {row.id: row.content_file_count for row in resp.context["cl"].result_list}
    assert counts[unit.id] == 3


@pytest.mark.django_db
def test_unit_change_view_lists_content_files(admin_client):
    """A unit's page lists its content files in unit order, linked to each"""
    unit = UnitFactory.create()
    later = UnitContentFileFactory.create(
        unit=unit, position=2, content_file__key="later-file"
    )
    earlier = UnitContentFileFactory.create(
        unit=unit, position=1, content_file__key="earlier-file"
    )
    UnitContentFileFactory.create(content_file__key="another-units-file")

    resp = admin_client.get(
        reverse("admin:learning_resources_unit_change", args=(unit.id,))
    )

    assert resp.status_code == 200
    content = resp.content.decode()
    assert content.index("earlier-file") < content.index("later-file")
    assert "another-units-file" not in content
    for membership in (earlier, later):
        assert (
            reverse(
                "admin:learning_resources_contentfile_change",
                args=(membership.content_file_id,),
            )
            in content
        )


@pytest.mark.django_db
def test_unit_content_files_are_read_only(admin_user):
    """The content file inline only lists a unit's files"""
    request = RequestFactory().get("/")
    request.user = admin_user
    inline = UnitContentFileInline(Unit, site)
    unit = UnitFactory.create()

    assert inline.has_add_permission(request, unit) is False
    assert inline.has_change_permission(request, unit) is False
    assert inline.has_delete_permission(request, unit) is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("permission", "can_view"),
    [("view_unit", True), ("change_unit", True), (None, False)],
)
def test_unit_content_files_follow_unit_permissions(
    django_user_model, permission, can_view
):
    """Staff who can see a unit see its content files, with no inline permission"""
    user = django_user_model.objects.create(username="staff", is_staff=True)
    if permission:
        user.user_permissions.add(Permission.objects.get(codename=permission))
    request = RequestFactory().get("/")
    request.user = django_user_model.objects.get(id=user.id)
    inline = UnitContentFileInline(Unit, site)

    assert inline.has_view_permission(request, UnitFactory.create()) is can_view


@pytest.mark.django_db
def test_unit_admin_is_read_only(admin_user):
    """The ETL owns units, so no one adds, changes or deletes them in the admin"""
    request = RequestFactory().get("/")
    request.user = admin_user
    unit_admin = UnitAdmin(Unit, site)
    unit = UnitFactory.create()

    assert unit_admin.has_view_permission(request, unit) is True
    assert unit_admin.has_add_permission(request) is False
    assert unit_admin.has_change_permission(request, unit) is False
    assert unit_admin.has_delete_permission(request, unit) is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("permission", "linked"),
    [("view_contentfile", True), ("change_contentfile", True), (None, False)],
)
def test_unit_content_files_link_only_when_viewable(
    django_user_model, permission, linked
):
    """Content files link to their admin page only for staff who can open it"""
    user = django_user_model.objects.create(username="staff", is_staff=True)
    user.user_permissions.add(Permission.objects.get(codename="view_unit"))
    if permission:
        user.user_permissions.add(Permission.objects.get(codename=permission))
    request = RequestFactory().get("/")
    request.user = django_user_model.objects.get(id=user.id)
    inline = UnitContentFileInline(Unit, site)

    fields = inline.get_fields(request, UnitFactory.create())

    assert ("content_file_link" in fields) is linked
    assert ("content_file_key" in fields) is not linked
