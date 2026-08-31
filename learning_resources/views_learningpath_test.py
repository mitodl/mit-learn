"""Tests for learning_resources LearningPath views"""

from types import SimpleNamespace

import pytest
from django.db.models import Max
from django.urls import reverse
from requests.exceptions import RequestException

from channels.factories import ChannelFactory
from learning_resources import factories, models, views
from learning_resources.constants import (
    LearningResourceRelationTypes,
)
from learning_resources.utils import update_editor_group
from main.factories import UserFactory

# pylint:disable=redefined-outer-name,unused-argument


@pytest.fixture(autouse=True)
def mock_opensearch(mocker):
    """Mock opensearch tasks"""
    mock_upsert = mocker.patch(
        "learning_resources_search.tasks.upsert_learning_resource"
    )
    mock_upsert_immutable_signature = mocker.patch(
        "learning_resources_search.tasks.upsert_learning_resource.si"
    )
    mock_deindex = mocker.patch("learning_resources_search.tasks.deindex_document")
    return SimpleNamespace(
        upsert=mock_upsert,
        deindex=mock_deindex,
        upsert_si=mock_upsert_immutable_signature,
    )


@pytest.mark.parametrize("is_public", [True, False])
@pytest.mark.parametrize("is_editor", [True, False])
@pytest.mark.parametrize("has_image", [True, False])
def test_learning_path_endpoint_get(client, user, is_public, is_editor, has_image):
    """Test learning path endpoint"""
    update_editor_group(user, is_editor)

    learning_path_res = factories.LearningResourceFactory.create(
        is_learning_path=True, published=is_public, no_image=not has_image
    )
    assert learning_path_res.published == is_public

    another_learning_path_res = factories.LearningResourceFactory.create(
        is_learning_path=True,
        published=is_public,
    )

    for idx, child in enumerate(learning_path_res.children.all()):
        models.LearningResourceRelationship.objects.filter(id=child.id).update(
            position=idx
        )

    if has_image:
        image_url = learning_path_res.image.url
    else:
        assert learning_path_res.image is None
        first_resource_child = (
            learning_path_res.children.order_by("position").first().child
        )
        image_url = first_resource_child.image.url

    # Anonymous users should get public results
    resp = client.get(reverse("lr:v1:learningpaths_api-list"))
    assert resp.data.get("count") == (2 if is_public else 0)

    # Logged in user should get public lists or all lists if editor
    client.force_login(user)
    resp = client.get(reverse("lr:v1:learningpaths_api-list"))
    assert resp.data["count"] == (2 if is_public or is_editor else 0)

    resp = client.get(
        reverse("lr:v1:learningpaths_api-detail", args=[learning_path_res.id])
    )
    assert resp.status_code == (404 if not (is_public or is_editor) else 200)
    if resp.status_code == 200:
        assert resp.data["title"] == learning_path_res.title
        assert (
            resp.data["learning_path"]["item_count"]
            == learning_path_res.children.count()
        )
        if has_image:
            assert resp.data["image"]["url"] == image_url
        else:
            assert resp.data["image"] is None

    # Logged in user should see other person's public list
    resp = client.get(
        reverse(
            "lr:v1:learningpaths_api-detail",
            args=[another_learning_path_res.id],
        )
    )
    assert resp.status_code == (404 if not is_public and not is_editor else 200)
    if resp.status_code == 200:
        assert resp.data.get("title") == another_learning_path_res.title


@pytest.mark.parametrize("is_published", [True, False])
@pytest.mark.parametrize("is_staff", [True, False])
@pytest.mark.parametrize("is_super", [True, False])
@pytest.mark.parametrize("is_editor", [True, False])
@pytest.mark.parametrize("is_anonymous", [True, False])
def test_learning_path_endpoint_create(  # pylint: disable=too-many-arguments  # noqa: PLR0913
    client,
    is_anonymous,
    is_published,
    is_staff,
    is_super,
    is_editor,
):
    """Test learningpath endpoint for creating a LearningPath"""
    user = UserFactory.create(is_staff=is_staff, is_superuser=is_super)
    update_editor_group(user, is_editor)

    if not is_anonymous:
        client.force_login(user)

    data = {
        "title": "My List",
        "description": "My Description",
        "published": is_published,
    }

    has_permission = not is_anonymous and (is_staff or is_super or is_editor)
    resp = client.post(
        reverse("lr:v1:learningpaths_api-list"), data=data, format="json"
    )
    assert resp.status_code == (201 if has_permission else 403)
    if resp.status_code == 201:
        assert resp.data.get("title") == resp.data.get("title")
        assert resp.data.get("description") == resp.data.get("description")


@pytest.mark.parametrize("is_public", [True, False])
@pytest.mark.parametrize("is_editor", [True, False])
@pytest.mark.parametrize("update_topics", [True, False])
def test_learning_path_endpoint_patch(client, update_topics, is_public, is_editor):
    """Test learningpath endpoint for updating a LearningPath"""
    [original_topic, new_topic] = factories.LearningResourceTopicFactory.create_batch(2)
    user = UserFactory.create()
    update_editor_group(user, is_editor)
    learning_resource = factories.LearningResourceFactory.create(
        title="Title 1",
        topics=[original_topic],
        is_learning_path=True,
        learning_path__author=user,
        published=True,
    )
    factories.LearningPathRelationshipFactory.create(parent=learning_resource)

    client.force_login(user)

    data = {
        "title": "Title 2",
        "published": is_public,
    }

    if update_topics:
        data["topics"] = [new_topic.id]

    resp = client.patch(
        reverse("lr:v1:learningpaths_api-detail", args=[learning_resource.id]),
        data=data,
        format="json",
    )
    assert resp.status_code == (200 if is_editor else 403)
    if resp.status_code == 200:
        assert resp.data["title"] == "Title 2"
        assert resp.data["topics"][0]["id"] == (
            new_topic.id if update_topics else original_topic.id
        )


@pytest.mark.parametrize("is_editor", [True, False])
def test_learning_path_items_endpoint_create_item(client, user, is_editor):
    """Test lr_learningpathitems_api endpoint for creating a LearningPath item"""
    learning_path = factories.LearningPathFactory.create()
    course = factories.CourseFactory.create()

    existing_items = models.LearningResourceRelationship.objects.filter(
        parent=learning_path.learning_resource,
        relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
    )
    max_position = existing_items.aggregate(max_position=Max("position"))[
        "max_position"
    ]
    expected_position = (
        existing_items.count() if max_position is None else max_position
    ) + 1

    update_editor_group(user, is_editor)
    client.force_login(user)

    data = {"child": course.learning_resource.id}

    resp = client.post(
        reverse(
            "lr:v1:learningpathitems_api-list",
            args=[learning_path.learning_resource.id],
        ),
        data=data,
        format="json",
    )
    assert resp.status_code == (201 if is_editor else 403)
    if resp.status_code == 201:
        assert resp.json().get("child") == course.learning_resource.id
        assert resp.json().get("position") == expected_position

        item = models.LearningResourceRelationship.objects.get(id=resp.json().get("id"))
        assert (
            item.relation_type
            == LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value
        )


def test_learning_path_items_endpoint_create_item_bad_data(client, user):
    """Test lr_learningpathitems_api endpoint for creating a LearningPath item w/bad data"""
    learning_path = factories.LearningPathFactory.create()

    update_editor_group(user, True)  # noqa: FBT003
    client.force_login(user)

    data = {"child": 999}

    resp = client.post(
        reverse(
            "lr:v1:learningpathitems_api-list",
            args=[learning_path.learning_resource.id],
        ),
        data=data,
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json() == {
        "child": ['Invalid pk "999" - object does not exist.'],
        "error_type": "ValidationError",
    }


@pytest.mark.parametrize(
    ("is_editor", "position"),
    [[True, 0], [True, 2], [False, 1]],  # noqa: PT007
)
def test_learning_path_items_endpoint_update_item_position(
    client, user, is_editor, position
):
    """Test lr_learningpathitems_api endpoint for updating LearningResourceRelationship positions"""
    learning_path = factories.LearningPathFactory.create()
    list_item_1 = factories.LearningPathRelationshipFactory.create(
        parent=learning_path.learning_resource, position=0
    )
    list_item_2 = factories.LearningPathRelationshipFactory.create(
        parent=learning_path.learning_resource, position=1
    )
    list_item_3 = factories.LearningPathRelationshipFactory.create(
        parent=learning_path.learning_resource, position=2
    )

    update_editor_group(user, is_editor)
    client.force_login(user)

    data = {"position": position}

    resp = client.patch(
        reverse(
            "lr:v1:learningpathitems_api-detail",
            args=[learning_path.learning_resource.id, list_item_2.id],
        ),
        data=data,
        format="json",
    )
    assert resp.status_code == (200 if is_editor else 403)
    if resp.status_code == 200:
        assert resp.json()["position"] == position
        for item, expected_pos in (
            [list_item_3, 1 if position == 2 else 2],
            [list_item_1, 0 if position == 2 else 1],
            [list_item_2, position],
        ):
            item.refresh_from_db()
            assert item.position == expected_pos
            assert (
                item.relation_type
                == LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value
            )


def test_learning_path_items_endpoint_update_items_wrong_list(client, user):
    """Verify that trying an update in wrong list fails"""
    learning_path = factories.LearningPathFactory.create()
    list_item_incorrect = factories.LearningPathRelationshipFactory.create()

    update_editor_group(user, True)  # noqa: FBT003
    client.force_login(user)

    data = {"position": 44}

    resp = client.patch(
        reverse(
            "lr:v1:learningpathitems_api-detail",
            args=[learning_path.learning_resource.id, list_item_incorrect.id],
        ),
        data=data,
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.parametrize("num_items", [2, 3])
@pytest.mark.parametrize("is_editor", [True, False])
def test_learning_path_items_endpoint_delete_items(client, user, is_editor, num_items):
    """Test learningpathitems endpoint for deleting LearningPathItems"""
    learning_path = factories.LearningPathFactory.create()
    # Get rid of autogenerated children and recreate new ones
    learning_path.learning_resource.children.all().delete()
    list_items = sorted(
        factories.LearningPathRelationshipFactory.create_batch(
            num_items, parent=learning_path.learning_resource
        ),
        key=lambda item: item.position,
    )
    assert len(list_items) == num_items

    update_editor_group(user, is_editor)
    client.force_login(user)

    resp = client.delete(
        reverse(
            "lr:v1:learningpathitems_api-detail",
            args=[learning_path.learning_resource.id, list_items[0].id],
        ),
        format="json",
    )

    assert resp.status_code == (204 if is_editor else 403)
    for item in list_items[1:]:
        old_position = item.position
        item.refresh_from_db()
        assert item.position == (old_position - 1 if is_editor else old_position)


def test_learning_path_endpoint_item_count_excludes_unpublished(client, user):
    """LearningPath item_count should only include published children"""
    update_editor_group(user, True)  # noqa: FBT003
    learning_path_res = factories.LearningResourceFactory.create(
        is_learning_path=True, published=True
    )
    learning_path_res.children.all().delete()
    factories.LearningPathRelationshipFactory.create(
        parent=learning_path_res, position=1
    )
    factories.LearningPathRelationshipFactory.create(
        parent=learning_path_res, position=2, child__published=False
    )

    client.force_login(user)
    resp = client.get(
        reverse("lr:v1:learningpaths_api-detail", args=[learning_path_res.id])
    )
    assert resp.status_code == 200
    assert resp.data["learning_path"]["item_count"] == 1


def test_learning_path_items_endpoint_excludes_unpublished(client):
    """Items list endpoint should only return relationships with published children"""
    learning_path = factories.LearningPathFactory.create()
    learning_path.learning_resource.children.all().delete()
    published_rel = factories.LearningPathRelationshipFactory.create(
        parent=learning_path.learning_resource, position=1
    )
    factories.LearningPathRelationshipFactory.create(
        parent=learning_path.learning_resource,
        position=2,
        child__published=False,
    )

    resp = client.get(
        reverse(
            "lr:v1:learningpathitems_api-list",
            args=[learning_path.learning_resource.id],
        )
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert [item["child"] for item in results] == [published_rel.child_id]


@pytest.mark.parametrize("is_editor", [True, False])
def test_learning_path_endpoint_delete(client, user, is_editor):
    """Test learningpath endpoint for deleting a LearningPath"""
    learning_path = factories.LearningPathFactory.create()

    update_editor_group(user, is_editor)
    client.force_login(user)

    resp = client.delete(
        reverse(
            "lr:v1:learningpaths_api-detail", args=[learning_path.learning_resource.id]
        )
    )
    assert resp.status_code == (204 if is_editor else 403)
    assert (
        models.LearningPath.objects.filter(id=learning_path.id).exists()
        is not is_editor
    )
    assert (
        models.LearningResource.objects.filter(
            id=learning_path.learning_resource.id
        ).exists()
        is not is_editor
    )


@pytest.mark.parametrize("is_editor", [True, False])
def test_learning_path_endpoint_membership_get(client, user, is_editor):
    """Test learning path membership endpoint"""
    update_editor_group(user, is_editor)
    learning_paths = factories.LearningResourceFactory.create_batch(
        3, is_learning_path=True
    )
    relationships = models.LearningResourceRelationship.objects.filter(
        parent__in=learning_paths
    ).order_by("child", "parent")

    client.force_login(user)
    resp = client.get(reverse("lr:v1:learningpaths_api-membership"))
    if is_editor:
        assert len(resp.data) == relationships.count()
        for idx, relationship in enumerate(relationships):
            assert resp.data[idx]["parent"] == relationship.parent_id
            assert resp.data[idx]["child"] == relationship.child_id
    else:
        assert resp.status_code == 403


def test_set_learning_path_relationships(client, staff_user):
    """Test the learning_paths endpoint for setting multiple userlist relationships"""
    course = factories.CourseFactory.create()
    learning_paths = factories.LearningPathFactory.create_batch(3, author=staff_user)
    previous_learning_path = factories.LearningPathFactory.create(author=staff_user)
    factories.LearningPathRelationshipFactory.create(
        parent=previous_learning_path.learning_resource, child=course.learning_resource
    )
    url = reverse(
        "lr:v1:learning_resource_relationships_api-learning-paths",
        args=[course.learning_resource.id],
    )
    client.force_login(staff_user)
    resp = client.patch(
        f"{url}?{''.join([f'learning_path_id={learning_path.learning_resource.id}&' for learning_path in learning_paths])}"
    )
    assert resp.status_code == 200
    for learning_path in learning_paths:
        assert course.learning_resource.parents.filter(
            parent__id=learning_path.learning_resource.id
        ).exists()
    assert not course.learning_resource.parents.filter(
        parent__id=previous_learning_path.learning_resource.id
    ).exists()


def test_set_learning_path_relationships_omits_unpublished_child_in_response(
    client, staff_user
):
    """PATCH response should not serialize unpublished child resources."""
    course = factories.CourseFactory.create(is_unpublished=True)
    learning_path = factories.LearningPathFactory.create(author=staff_user)

    url = reverse(
        "lr:v1:learning_resource_relationships_api-learning-paths",
        args=[course.learning_resource.id],
    )
    client.force_login(staff_user)
    resp = client.patch(f"{url}?learning_path_id={learning_path.learning_resource.id}")

    assert resp.status_code == 200
    assert models.LearningResourceRelationship.objects.filter(
        parent_id=learning_path.learning_resource.id,
        child_id=course.learning_resource.id,
        relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
    ).exists()
    assert resp.json() == []


def test_set_learning_path_relationships_scopes_to_learning_path_items(
    client, staff_user
):
    """Bulk set should only affect learning-path memberships."""
    course = factories.CourseFactory.create()
    existing_learning_path = factories.LearningPathFactory.create(author=staff_user)
    new_learning_path = factories.LearningPathFactory.create(author=staff_user)
    program = factories.ProgramFactory.create()

    factories.LearningPathRelationshipFactory.create(
        parent=existing_learning_path.learning_resource,
        child=course.learning_resource,
    )
    models.LearningResourceRelationship.objects.create(
        parent=program.learning_resource,
        child=course.learning_resource,
        relation_type=LearningResourceRelationTypes.PROGRAM_COURSES.value,
    )

    url = reverse(
        "lr:v1:learning_resource_relationships_api-learning-paths",
        args=[course.learning_resource.id],
    )
    client.force_login(staff_user)
    resp = client.patch(
        f"{url}?learning_path_id={new_learning_path.learning_resource.id}"
    )

    assert resp.status_code == 200
    assert course.learning_resource.parents.filter(
        parent__id=new_learning_path.learning_resource.id,
        relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
    ).exists()
    assert not course.learning_resource.parents.filter(
        parent__id=existing_learning_path.learning_resource.id,
        relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
    ).exists()
    assert course.learning_resource.parents.filter(
        parent__id=program.learning_resource.id,
        relation_type=LearningResourceRelationTypes.PROGRAM_COURSES.value,
    ).exists()


def test_adding_to_learning_path_not_effect_existing_membership(client, staff_user):
    """
    Given L1 (existing parent), L2 (new parent), and R (resource),
    test that adding R to L2 does not affect L1.
    """
    course = factories.CourseFactory.create()

    existing_parent = factories.LearningPathFactory.create(author=staff_user)
    factories.LearningPathRelationshipFactory.create(
        parent=existing_parent.learning_resource, child=course.learning_resource
    )
    new_additional_parent = factories.LearningPathFactory.create(author=staff_user)

    prev_parent_count = existing_parent.learning_resource.resources.count()
    new_additional_parent_count = (
        new_additional_parent.learning_resource.resources.count()
    )

    url = reverse(
        "lr:v1:learning_resource_relationships_api-learning-paths",
        args=[course.learning_resource.id],
    )
    client.force_login(staff_user)
    lps = [existing_parent, new_additional_parent]
    resp = client.patch(
        f"{url}?{''.join([f'learning_path_id={lp.learning_resource.id}&' for lp in lps])}"
    )

    assert resp.status_code == 200
    assert prev_parent_count == existing_parent.learning_resource.resources.count()
    assert (
        new_additional_parent_count + 1
        == new_additional_parent.learning_resource.resources.count()
    )


@pytest.fixture
def mock_featured_clear(mocker):
    """Mock the synchronous clear_featured_caches function"""
    return mocker.patch("learning_resources.views.clear_featured_caches")


@pytest.fixture
def featured_path(client, user):
    """Create a learning path featured by a unit channel and log in an editor"""
    update_editor_group(user, True)  # noqa: FBT003
    path = factories.LearningPathFactory.create(author=user)
    channel = ChannelFactory.create(is_unit=True, featured_list=path.learning_resource)
    client.force_login(user)
    return path, channel


@pytest.mark.parametrize(
    ("method", "data", "expected_status"),
    [("patch", {"title": "New title"}, 200), ("delete", None, 204)],
)
def test_learning_path_write_clears_featured_caches(  # noqa: PLR0913
    client,
    featured_path,
    mock_featured_clear,
    django_capture_on_commit_callbacks,
    method,
    data,
    expected_status,
):
    """
    Updating or deleting a featured learning path clears the featured caches
    on commit (delete resolves channel names before the row is gone)
    """
    path, channel = featured_path

    with django_capture_on_commit_callbacks(execute=True):
        resp = getattr(client, method)(
            reverse("lr:v1:learningpaths_api-detail", args=[path.learning_resource.id]),
            data=data,
            format="json",
        )

    assert resp.status_code == expected_status
    mock_featured_clear.assert_called_once_with([channel.name])


def test_learning_path_update_not_featured_no_clear(
    client, user, mock_featured_clear, django_capture_on_commit_callbacks
):
    """PATCHing a learning path that is no channel's featured list clears nothing"""
    update_editor_group(user, True)  # noqa: FBT003
    path = factories.LearningPathFactory.create(author=user)
    client.force_login(user)

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.patch(
            reverse("lr:v1:learningpaths_api-detail", args=[path.learning_resource.id]),
            data={"title": "New title"},
            format="json",
        )

    assert resp.status_code == 200
    mock_featured_clear.assert_not_called()


def test_featured_cache_clear_failure_does_not_break_save(
    client, featured_path, mock_featured_clear, django_capture_on_commit_callbacks
):
    """A failing cache clear (Redis/Fastly down) must not break the API response"""
    mock_featured_clear.side_effect = Exception("broker down")
    path, _ = featured_path

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.patch(
            reverse("lr:v1:learningpaths_api-detail", args=[path.learning_resource.id]),
            data={"title": "New title"},
            format="json",
        )

    assert resp.status_code == 200


def test_learning_path_item_create_clears_featured_caches(
    client, featured_path, mock_featured_clear, django_capture_on_commit_callbacks
):
    """Adding an item to a featured path clears the featured caches"""
    path, channel = featured_path
    course = factories.CourseFactory.create()

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            reverse(
                "lr:v1:learningpathitems_api-list", args=[path.learning_resource.id]
            ),
            data={"child": course.learning_resource.id},
            format="json",
        )

    assert resp.status_code == 201
    mock_featured_clear.assert_called_once_with([channel.name])


def test_learning_path_item_update_clears_featured_caches(
    client, featured_path, mock_featured_clear, django_capture_on_commit_callbacks
):
    """Reordering an item in a featured path clears the featured caches"""
    path, channel = featured_path
    path.learning_resource.children.all().delete()
    items = sorted(
        factories.LearningPathRelationshipFactory.create_batch(
            2, parent=path.learning_resource
        ),
        key=lambda item: item.position,
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.patch(
            reverse(
                "lr:v1:learningpathitems_api-detail",
                args=[path.learning_resource.id, items[0].id],
            ),
            data={"position": items[1].position},
            format="json",
        )

    assert resp.status_code == 200
    mock_featured_clear.assert_called_once_with([channel.name])


def test_learning_path_item_delete_clears_featured_caches(
    client, featured_path, mock_featured_clear, django_capture_on_commit_callbacks
):
    """Removing an item from a featured path clears the featured caches"""
    path, channel = featured_path
    path.learning_resource.children.all().delete()
    items = factories.LearningPathRelationshipFactory.create_batch(
        2, parent=path.learning_resource
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.delete(
            reverse(
                "lr:v1:learningpathitems_api-detail",
                args=[path.learning_resource.id, items[0].id],
            )
        )

    assert resp.status_code == 204
    mock_featured_clear.assert_called_once_with([channel.name])


def test_set_learning_path_relationships_clears_featured_caches(
    client, staff_user, mock_featured_clear, django_capture_on_commit_callbacks
):
    """Bulk membership set clears caches for both added and removed featured paths"""
    course = factories.CourseFactory.create()
    added_path = factories.LearningPathFactory.create(author=staff_user)
    removed_path = factories.LearningPathFactory.create(author=staff_user)
    factories.LearningPathRelationshipFactory.create(
        parent=removed_path.learning_resource, child=course.learning_resource
    )
    added_channel = ChannelFactory.create(
        is_unit=True, featured_list=added_path.learning_resource
    )
    removed_channel = ChannelFactory.create(
        is_unit=True, featured_list=removed_path.learning_resource
    )
    url = reverse(
        "lr:v1:learning_resource_relationships_api-learning-paths",
        args=[course.learning_resource.id],
    )
    client.force_login(staff_user)

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.patch(f"{url}?learning_path_id={added_path.learning_resource.id}")

    assert resp.status_code == 200
    mock_featured_clear.assert_called_once()
    (names,) = mock_featured_clear.call_args.args
    assert sorted(names) == sorted([added_channel.name, removed_channel.name])


def test_clear_featured_caches(mocker):
    """Clears the Redis prefix first, then purges channel pages hard and homepage soft"""
    manager = mocker.Mock()
    manager.attach_mock(
        mocker.patch("learning_resources.views.clear_views_cache"),
        "clear_views_cache",
    )
    manager.attach_mock(
        mocker.patch("learning_resources.views.call_fastly_purge_api"), "purge"
    )

    views.clear_featured_caches(["mitx", "ocw"])

    assert manager.mock_calls == [
        mocker.call.clear_views_cache(key_prefix="featured_resources"),
        mocker.call.purge("/c/unit/mitx", timeout=5, soft=False),
        mocker.call.purge("/c/unit/ocw", timeout=5, soft=False),
        mocker.call.purge("/", timeout=5, soft=True),
    ]


def test_clear_featured_caches_continues_after_purge_failure(mocker):
    """A failed channel purge must not skip the remaining Fastly purges"""
    mocker.patch("learning_resources.views.clear_views_cache")
    mock_purge = mocker.patch(
        "learning_resources.views.call_fastly_purge_api",
        side_effect=[RequestException("fastly down"), None, None],
    )

    views.clear_featured_caches(["mitx", "ocw"])

    assert mock_purge.call_count == 3
