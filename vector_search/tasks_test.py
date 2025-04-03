import datetime

import pytest
from django.conf import settings

from learning_resources.etl.constants import (
    MARKETING_PAGE_FILE_TYPE,
    RESOURCE_FILE_ETL_SOURCES,
    ETLSource,
)
from learning_resources.factories import (
    ContentFileFactory,
    CourseFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    ProgramFactory,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources_search.constants import (
    COURSE_TYPE,
)
from main.utils import now_in_utc
from vector_search.tasks import (
    embed_learning_resources_by_id,
    embed_new_content_files,
    embed_new_learning_resources,
    marketing_page_for_resources,
    scrape_marketing_pages,
    start_embed_resources,
)
from vector_search.utils import _fetch_page

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "index",
    ["course", "program"],
)
def test_start_embed_resources(mocker, mocked_celery, index):
    """
    start_embed_resources should generate embeddings for each resource type
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    if index == COURSE_TYPE:
        ocw_courses = sorted(
            CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
            key=lambda course: course.learning_resource_id,
        )

        for course in ocw_courses:
            ContentFileFactory.create_batch(
                3, run=course.learning_resource.runs.first()
            )

        oll_courses = CourseFactory.create_batch(2, etl_source=ETLSource.ocw.value)

        courses = sorted(
            list(oll_courses) + list(ocw_courses),
            key=lambda course: course.learning_resource_id,
        )
        resource_ids = [c.pk for c in courses]
    else:
        programs = sorted(
            ProgramFactory.create_batch(4),
            key=lambda program: program.learning_resource_id,
        )
        resource_ids = [p.pk for p in programs]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay([index], skip_content_files=True, overwrite=True)

    generate_embeddings_mock.si.assert_called_once_with(
        resource_ids,
        index,
        True,  # noqa: FBT003
    )
    assert mocked_celery.replace.call_count == 1
    assert mocked_celery.replace.call_args[0][1] == mocked_celery.chain.return_value


@pytest.mark.parametrize(
    "index",
    ["course", "program"],
)
def test_start_embed_resources_without_settings(mocker, mocked_celery, index):
    """
    start_embed_resources should not run unless qdrant settings are specified
    """
    settings.QDRANT_HOST = ""
    settings.QDRANT_BASE_COLLECTION_NAME = ""
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    if index == COURSE_TYPE:
        ocw_courses = sorted(
            CourseFactory.create_batch(4, etl_source=ETLSource.ocw.value),
            key=lambda course: course.learning_resource_id,
        )
        for course in ocw_courses:
            ContentFileFactory.create_batch(
                3, run=course.learning_resource.runs.first()
            )
        CourseFactory.create_batch(2, etl_source=ETLSource.ocw.value)
    else:
        ProgramFactory.create_batch(4)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    start_embed_resources.delay([index], skip_content_files=True, overwrite=True)

    generate_embeddings_mock.si.assert_not_called()


def test_embed_new_learning_resources(mocker, mocked_celery):
    """
    embed_new_learning_resources should generate embeddings for new resources
    based on the period
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    daily_since = now_in_utc() - datetime.timedelta(hours=5)

    LearningResourceFactory.create_batch(
        4, created_on=daily_since, resource_type=COURSE_TYPE, published=True
    )
    # create resources older than a day
    LearningResourceFactory.create_batch(
        4,
        created_on=now_in_utc() - datetime.timedelta(days=5),
        resource_type=COURSE_TYPE,
        published=True,
    )

    daily_resource_ids = [
        resource.id
        for resource in LearningResource.objects.filter(
            created_on__gt=now_in_utc() - datetime.timedelta(days=1)
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_learning_resources.delay()
    list(mocked_celery.group.call_args[0][0])

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(daily_resource_ids) == sorted(embedded_ids)


def test_embed_new_content_files(mocker, mocked_celery):
    """
    embed_new_content_files should generate embeddings for new content files
    created within the last day
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    daily_since = now_in_utc() - datetime.timedelta(hours=5)

    ContentFileFactory.create_batch(4, created_on=daily_since, published=True)
    # create resources older than a day
    ContentFileFactory.create_batch(
        4,
        created_on=now_in_utc() - datetime.timedelta(days=5),
        published=True,
    )

    daily_content_file_ids = [
        resource.id
        for resource in ContentFile.objects.filter(
            created_on__gt=now_in_utc() - datetime.timedelta(days=1)
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()
    list(mocked_celery.group.call_args[0][0])

    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(daily_content_file_ids) == sorted(embedded_ids)


def test_embed_learning_resources_by_id(mocker, mocked_celery):
    """
    embed_learning_resources_by_id should generate embeddings for resources
    based the ids passed as well as associated contentfiles
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    resources = LearningResourceFactory.create_batch(
        4,
        resource_type=COURSE_TYPE,
        etl_source=RESOURCE_FILE_ETL_SOURCES[0],
        published=True,
    )

    resource_ids = [resource.id for resource in resources]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )
    content_ids = []
    for resource in resources:
        cf = ContentFileFactory.create(
            run=LearningResourceRunFactory.create(learning_resource=resource)
        )
        content_ids.append(cf.id)

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_learning_resources_by_id.delay(
            resource_ids, skip_content_files=False, overwrite=True
        )
    for mock_call in generate_embeddings_mock.si.mock_calls[1:]:
        assert mock_call.args[0][0] in content_ids
        assert mock_call.args[1] == "content_file"
    embedded_resource_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    assert sorted(resource_ids) == sorted(embedded_resource_ids)


def test_embedded_content_from_next_run(mocker, mocked_celery):
    """
    Content files to embed should come from next course run
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    other_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=2),
    )
    LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) + datetime.timedelta(days=2),
    )

    next_run_contentfiles = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            3, run=course.learning_resource.next_run
        )
    ]
    # create contentfiles using the other run
    ContentFileFactory.create_batch(3, run=other_run)

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )

    generate_embeddings_mock.si.assert_called_with(
        next_run_contentfiles,
        "content_file",
        True,  # noqa: FBT003
    )


def test_embedded_content_from_latest_run_if_next_missing(mocker, mocked_celery):
    """
    Content files to embed should come from latest run if the next run is missing
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    latest_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1),
    )
    latest_run_contentfiles = [
        cf.id for cf in ContentFileFactory.create_batch(3, run=latest_run)
    ]
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )

    generate_embeddings_mock.si.assert_called_with(
        latest_run_contentfiles,
        "content_file",
        True,  # noqa: FBT003
    )


def test_embedded_content_file_without_runs(mocker, mocked_celery):
    """
    Ensure that contentfiles without runs are also embedded for a resource
    """

    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])

    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    course.runs.all().delete()
    latest_run = LearningResourceRunFactory.create(
        learning_resource=course.learning_resource,
        start_date=datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1),
    )
    ContentFileFactory.create_batch(3, run=latest_run)
    # create contentfiles without runs
    contentfiles_with_no_run = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            3, learning_resource=course.learning_resource
        )
    ]
    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        start_embed_resources.delay(
            ["course"], skip_content_files=False, overwrite=True
        )
    embedded_ids = generate_embeddings_mock.mock_calls[-1].args[0]

    for contentfile_id in contentfiles_with_no_run:
        assert contentfile_id in embedded_ids


def test_embed_new_content_files_without_runs(mocker, mocked_celery):
    """
    embed_new_content_files should generate embeddings for new content files
    created within the last day
    """
    mocker.patch("vector_search.tasks.load_course_blocklist", return_value=[])
    course = CourseFactory.create(etl_source=ETLSource.ocw.value)
    daily_since = now_in_utc() - datetime.timedelta(hours=5)
    ContentFileFactory.create_batch(4, created_on=daily_since, published=True)
    content_files_without_run = [
        cf.id
        for cf in ContentFileFactory.create_batch(
            4,
            learning_resource=course.learning_resource,
            created_on=daily_since,
            published=True,
        )
    ]

    generate_embeddings_mock = mocker.patch(
        "vector_search.tasks.generate_embeddings", autospec=True
    )

    with pytest.raises(mocked_celery.replace_exception_class):
        embed_new_content_files.delay()
    list(mocked_celery.group.call_args[0][0])
    embedded_ids = generate_embeddings_mock.si.mock_calls[0].args[0]
    for contentfile_id in content_files_without_run:
        assert contentfile_id in embedded_ids


@pytest.mark.parametrize("use_webdriver", [True], ids=["with_webdriver"])
def test_fetch_page_with_webdriver(mocker, use_webdriver, settings):
    """Test that _fetch_page uses WebDriver when settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER is True"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = use_webdriver

    mock_driver = mocker.MagicMock()
    mock_driver.execute_script.return_value = "<html><body>Page content</body></html>"
    mock_get_web_driver = mocker.patch(
        "vector_search.utils._get_web_driver", return_value=mock_driver
    )
    mock_webdriver_fetch_extra = mocker.patch(
        "vector_search.utils._webdriver_fetch_extra_elements"
    )

    url = "https://example.com/course"
    result = _fetch_page(url, use_webdriver=use_webdriver)

    assert result == "<html><body>Page content</body></html>"
    mock_get_web_driver.assert_called_once()
    mock_driver.get.assert_called_once_with(url)
    mock_webdriver_fetch_extra.assert_called_once_with(mock_driver)
    mock_driver.execute_script.assert_called_once_with("return document.body.innerHTML")


@pytest.mark.django_db
def test_marketing_page_for_resources_with_webdriver(mocker, settings):
    """Test that marketing_page_for_resources uses WebDriver to fetch content"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True

    course = LearningResource.objects.create(
        title="Test Course",
        url="https://example.com/course",
        resource_type="course",
        published=True,
    )

    html_content = "<html><body><h1>Test Course</h1><p>Course content</p></body></html>"
    mock_fetch_page = mocker.patch(
        "vector_search.tasks._fetch_page", return_value=html_content
    )

    markdown_content = "# Test Course\n\nCourse content"
    mock_html_to_markdown = mocker.patch(
        "vector_search.tasks.html_to_markdown", return_value=markdown_content
    )

    marketing_page_for_resources([course.id])

    mock_fetch_page.assert_called_once_with(course.url)
    mock_html_to_markdown.assert_called_once_with(html_content)

    # Verify that a content file was created
    content_file = ContentFile.objects.get(
        learning_resource=course, file_type=MARKETING_PAGE_FILE_TYPE
    )
    assert content_file.key == course.url
    assert content_file.content == markdown_content
    assert content_file.file_extension == ".md"


@pytest.mark.django_db
def test_scrape_marketing_pages(mocker, settings, mocked_celery):
    """Test that scrape_marketing_pages correctly identifies resources without marketing pages"""

    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True
    settings.QDRANT_CHUNK_SIZE = 2

    course1 = LearningResource.objects.create(
        title="Course 1",
        url="https://example.com/course1",
        resource_type="course",
        published=True,
    )
    course2 = LearningResource.objects.create(
        title="Course 2",
        url="https://example.com/course2",
        resource_type="course",
        published=True,
    )

    course3 = LearningResource.objects.create(
        title="Course 3",
        url="https://example.com/course3",
        resource_type="course",
        published=True,
    )
    ContentFile.objects.create(
        learning_resource=course3,
        file_type=MARKETING_PAGE_FILE_TYPE,
        key=course3.url,
        content="Existing content",
        file_extension=".md",
    )

    LearningResource.objects.create(
        title="Unpublished Course",
        url="https://example.com/unpublished",
        resource_type="course",
        published=False,
    )

    mock_group = mocker.patch("vector_search.tasks.celery.group")
    mock_marketing_page_task = mocker.patch(
        "vector_search.tasks.marketing_page_for_resources.si"
    )
    with pytest.raises(mocked_celery.replace_exception_class):
        scrape_marketing_pages.delay()

    # Verify that only resources without marketing pages are included
    expected_ids = [course1.id, course2.id]
    mock_marketing_page_task.assert_called_once_with(expected_ids)
    mock_group.assert_called_once()
