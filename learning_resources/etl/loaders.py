"""learning_resources data loaders"""

import logging

from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.db import transaction
from django.db.models import Q

from learning_resources.constants import (
    OCW_COURSE_CONTENT_CATEGORY_MAPPING,
    LearningResourceDelivery,
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import (
    CONTENT_TAG_CATEGORIES,
    READABLE_ID_FIELD,
    ContentTagCategory,
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
    ResourceNextRunConfig,
)
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.utils import most_common_topics
from learning_resources.models import (
    Article,
    ContentFile,
    Course,
    LearningResource,
    LearningResourceContentTag,
    LearningResourceDepartment,
    LearningResourceImage,
    LearningResourceInstructor,
    LearningResourceOfferor,
    LearningResourcePlatform,
    LearningResourcePrice,
    LearningResourceRelationship,
    LearningResourceRun,
    LearningResourceTopic,
    Podcast,
    PodcastEpisode,
    Program,
    RunInstructorRelationship,
    TutorProblemFile,
    Video,
    VideoChannel,
    VideoPlaylist,
)
from learning_resources.utils import (
    add_parent_topics_to_learning_resource,
    bulk_resources_unpublished_actions,
    content_files_loaded_actions,
    load_course_blocklist,
    load_course_duplicates,
    resource_delete_actions,
    resource_run_unpublished_actions,
    resource_unpublished_actions,
    resource_upserted_actions,
    similar_topics_action,
)

log = logging.getLogger()

User = get_user_model()

CONTENT_TASKS_CACHE_TIMEOUT = 300


def update_index(learning_resource, newly_created):
    """
    Upsert or remove the learning resource from the search index

    Args:
        learning resource (LearningResource): a learning resource
        newly_created (bool): whether the learning resource has just been created
    """
    if (
        not newly_created
        and not learning_resource.published
        and not learning_resource.test_mode
    ):
        resource_unpublished_actions(learning_resource)
    elif learning_resource.published:
        resource_upserted_actions(
            learning_resource, percolate=False, generate_embeddings=True
        )


def load_topics(resource, topics_data):
    """
    Load the topics for a resource into the database.

    Topics must exist; if they don't, then we skip them.
    """

    if topics_data is not None:
        topics = []

        for topic_data in topics_data:
            topic = LearningResourceTopic.objects.filter(
                name=topic_data["name"]
            ).first()
            topics.append(topic) if topic else log.warning(
                "Skipped adding topic %s to resource %s", topic_data["name"], resource
            )

        resource.topics.set(topics)
        resource.save()
        add_parent_topics_to_learning_resource(resource)

    return resource.topics.all()


def load_departments(
    resource: LearningResource, department_data: list[str]
) -> list[LearningResourceDepartment]:
    """Load the departments for a resource into the database"""
    departments = []

    if department_data:
        for department_id in department_data:
            department = LearningResourceDepartment.objects.get(
                department_id=department_id
            )
            departments.append(department)

    resource.departments.set(departments)

    return resource.departments.all()


def load_run_dependent_values(
    resource: LearningResource,
) -> ResourceNextRunConfig:
    """
    Assign prices, availability, and next_start_date to a resource based on its runs

    Args:
        resource (LearningResource): the resource to update

    Returns:
        tuple[datetime.time | None, list[Decimal], str]: date, prices, and availability
    """
    best_run = resource.best_run
    if resource.published and best_run:
        resource.availability = best_run.availability
        resource.prices = (
            best_run.prices
            if resource.certification and best_run and best_run.prices
            else []
        )
        resource.resource_prices.set(
            best_run.resource_prices.all()
            if resource.certification and best_run and best_run.resource_prices
            else []
        )
        resource.location = best_run.location
        resource.duration = best_run.duration
        resource.min_weeks = best_run.min_weeks
        resource.max_weeks = best_run.max_weeks
        resource.time_commitment = best_run.time_commitment
        resource.min_weekly_hours = best_run.min_weekly_hours
        resource.max_weekly_hours = best_run.max_weekly_hours
    next_run = resource.next_run
    if resource.published and next_run:
        resource.next_start_date = (
            max(filter(None, [next_run.start_date, next_run.enrollment_start]))
            if next_run.start_date or next_run.enrollment_start
            else None
        )
    else:
        resource.next_start_date = None
    resource.save()
    return ResourceNextRunConfig(
        next_start_date=resource.next_start_date,
        prices=resource.prices,
        resource_prices=resource.resource_prices.all(),
        availability=resource.availability,
        location=resource.location,
        duration=resource.duration,
        min_weeks=resource.min_weeks,
        max_weeks=resource.max_weeks,
        time_commitment=resource.time_commitment,
        min_weekly_hours=resource.min_weekly_hours,
        max_weekly_hours=resource.max_weekly_hours,
    )


def load_instructors(
    run: LearningResourceRun, instructors_data: list[dict]
) -> list[LearningResourceInstructor]:
    """Load the instructors for a resource run into the database"""
    instructors = []
    valid_attributes = ["first_name", "last_name"]
    relations = []
    for idx, prof in enumerate(instructors_data):
        full_name = (
            prof.get("full_name", "")
            or f"{prof.get('first_name') or ''} {prof.get('last_name') or ''}"
        ).strip()
        if full_name:
            instructor, _ = LearningResourceInstructor.objects.update_or_create(
                full_name=full_name,
                defaults={
                    key: value
                    for key, value in prof.items()
                    if value and key in valid_attributes
                },
            )
            relation, _ = RunInstructorRelationship.objects.update_or_create(
                run=run,
                instructor=instructor,
                defaults={
                    "position": idx,
                },
            )
            relations.append(relation.id)
    RunInstructorRelationship.objects.filter(run=run).exclude(id__in=relations).delete()
    run.save()
    return instructors


def load_prices(
    run: LearningResourceRun, prices_data: list[dict]
) -> list[LearningResourcePrice]:
    """Load the prices for a resource run into the database"""
    prices = []
    for price in prices_data:
        lr_price, _ = LearningResourcePrice.objects.get_or_create(
            amount=price["amount"],
            currency=price["currency"],
        )
        prices.append(lr_price)

    run.resource_prices.set(prices)
    run.save()
    return prices


def load_image(resource: LearningResource, image_data: dict) -> LearningResourceImage:
    """Load the image for a resource into the database"""
    if image_data:
        image, _ = LearningResourceImage.objects.get_or_create(
            url=image_data.get("url"),
            description=image_data.get("description"),
            alt=image_data.get("alt"),
        )
        resource.image = image
    else:
        resource.image = None
        image = None
    resource.save()
    return image


def load_offered_by(
    resource: LearningResource, offered_by_data: dict
) -> LearningResourceOfferor:
    """# noqa: D401
    Saves an offered_by to the resource.

    Args:
        resource (LearningResource): learning resource
        offered_by_data (dict): the offered by data for the resource

    Returns:
        offered_by (LearningResourceOfferor): Created or updated offered_by
    """
    if offered_by_data is None:
        resource.offered_by = None
    else:
        offered_by = LearningResourceOfferor.objects.filter(**offered_by_data).first()
        resource.offered_by = offered_by
    resource.save()
    return resource.offered_by


def load_content_tags(
    learning_resources_obj: LearningResource or ContentFile,
    content_tags_data: list[str],
    *,
    is_content_file: bool,
) -> list[LearningResourceContentTag]:
    """Load the content tags for a resource into the database"""
    if content_tags_data is not None:
        tags = []
        for content_tag in content_tags_data:
            tag, _ = LearningResourceContentTag.objects.get_or_create(name=content_tag)
            tags.append(tag)
        if is_content_file:
            learning_resources_obj.content_tags.set(tags)
        else:
            learning_resources_obj.resource_tags.set(tags)
        learning_resources_obj.save()
    return (
        learning_resources_obj.content_tags.all()
        if is_content_file
        else learning_resources_obj.resource_tags.all()
    )


def load_run(
    learning_resource: LearningResource, run_data: dict
) -> LearningResourceRun:
    """
    Load the resource run into the database

    Args:
        learning_resource (LearningResource): the concrete parent learning resource
        run_data (dict): dictionary of data to create/update the run with

    Returns:
        LearningResourceRun: the created/updated resource run
    """
    run_id = run_data.pop("run_id")

    image_data = run_data.pop("image", None)
    status = run_data.pop("status", None)
    instructors_data = run_data.pop("instructors", [])

    resource_prices = run_data.get("prices", [])
    run_data["prices"] = sorted({price["amount"] for price in resource_prices})

    if status == RunStatus.archived.value or learning_resource.certification is False:
        # Archived runs or runs of resources w/out certificates should not have prices
        run_data["prices"] = []
        resource_prices = []

    if learning_resource.test_mode:
        run_data["published"] = True

    with transaction.atomic():
        (
            learning_resource_run,
            _,
        ) = LearningResourceRun.objects.select_for_update().update_or_create(
            learning_resource=learning_resource,
            run_id=run_id,
            defaults={**run_data},
        )
        load_instructors(learning_resource_run, instructors_data)
        load_prices(learning_resource_run, resource_prices)
        load_image(learning_resource_run, image_data)

        # Remove cached best run if present
        if hasattr(learning_resource, "best_run"):
            del learning_resource.best_run

        if (
            (
                learning_resource_run == learning_resource.best_run
                or learning_resource.test_mode
            )
            and learning_resource.etl_source
            in (
                ETLSource.mit_edx.value,
                ETLSource.mitxonline.value,
                ETLSource.xpro.value,
            )
            and learning_resource_run.content_files.count() == 0
        ):
            # webhook may have been sent before run was created or was best run,
            # so trigger a contentfile ingestion for the course. If already
            # ingested & checksums match, no new content files will be created
            from learning_resources.tasks import import_content_files

            etl_source = learning_resource.etl_source
            resource_id = learning_resource.id
            cache_key = f"content_tasks_triggered_{etl_source}_{resource_id}"

            def enqueue_content_tasks():
                redis_cache = caches["redis"]
                if not redis_cache.add(
                    cache_key,
                    True,  # noqa: FBT003
                    timeout=CONTENT_TASKS_CACHE_TIMEOUT,
                ):
                    return
                import_content_files.delay(
                    etl_source,
                    learning_resource_ids=[resource_id],
                )

            transaction.on_commit(enqueue_content_tasks)
    return learning_resource_run


def upsert_course_or_program(  # noqa: C901, PLR0912
    resource_data: dict,
    blocklist: list[str],
    duplicates: list[dict],
    resource_type: str,
    *,
    config: CourseLoaderConfig = None,
) -> tuple[LearningResource, bool]:
    """
    Return a resource object and whether it was created or not

    Args:
        resource_data (dict):
            a dict of course/program data values
        blocklist (list of str):
            list of course/program ids not to load
        duplicates (list of dict):
            list of duplicate course/program data
        resource_type (str):
            the type of resource to load (course or program)
        config (CourseLoaderConfig):
            configuration on how to load a course

    Returns:
        tuple(LearningResource, bool):
            the created/updated course and whether it was created or not

    """
    platform_name = resource_data.pop("platform")
    unique_field_name = resource_data.pop("unique_field", READABLE_ID_FIELD)
    unique_field_value = resource_data.get(unique_field_name)
    readable_id = resource_data.pop("readable_id")
    runs = resource_data.pop("runs", [])

    if readable_id in blocklist or not runs:
        resource_data["published"] = False

    if resource_type == LearningResourceType.course.name:
        resource_category = LearningResourceType.course.value
    else:
        resource_category = LearningResourceType.program.value
    deduplicated_course_id = next(
        (
            record["course_id"]
            for record in duplicates
            if readable_id in record["duplicate_course_ids"]
        ),
        None,
    )
    platform = LearningResourcePlatform.objects.filter(code=platform_name).first()
    if not platform:
        log.exception(
            "Platform %s is null or not in database: %s",
            platform_name,
            readable_id,
        )
        return None, None

    if deduplicated_course_id and readable_id != deduplicated_course_id:
        duplicate_resource = LearningResource.objects.filter(
            platform=platform, readable_id=readable_id
        ).first()
        if duplicate_resource:
            duplicate_resource.published = False
            duplicate_resource.save()
            resource_unpublished_actions(duplicate_resource)

    resource_id = deduplicated_course_id or readable_id

    if config and config.fetch_only:
        # Do not upsert the course, it should already exist.
        # Just find it and return it.
        resource = LearningResource.objects.filter(
            readable_id=resource_id,
            platform=platform,
            resource_type=resource_type,
            published=True,
        ).first()
        if not resource:
            log.warning("No published resource found for %s", resource_id)
        return resource, False

    if unique_field_name != READABLE_ID_FIELD:
        resource_data[READABLE_ID_FIELD] = resource_id
        # Some dupes may result, so we should delete all but the
        # most recently updated resource w/matching unique value
        existing_courses = LearningResource.objects.filter(
            **{unique_field_name: unique_field_value},
            platform=platform,
            resource_type=LearningResourceType.course.name,
        ).order_by("-updated_on")
        if existing_courses.count() > 0:
            for course in existing_courses[1:]:
                resource_delete_actions(course)
        # does a resource with the same readable id already exist?
        # if so, update it with the new unique field value
        elif LearningResource.objects.filter(
            readable_id=resource_data["readable_id"],
            platform=platform,
            resource_type=LearningResourceType.course.name,
        ).exists():
            resource_data[unique_field_name] = unique_field_value
            unique_field_name = READABLE_ID_FIELD
            unique_field_value = resource_data.pop(READABLE_ID_FIELD)
        return LearningResource.objects.select_for_update().update_or_create(
            **{unique_field_name: unique_field_value},
            platform=platform,
            resource_type=resource_type,
            resource_category=resource_category,
            defaults=resource_data,
        )
    else:
        unique_field_value = resource_id
    return LearningResource.objects.select_for_update().update_or_create(
        **{unique_field_name: unique_field_value},
        platform=platform,
        resource_type=resource_type,
        resource_category=resource_category,
        defaults=resource_data,
    )


def load_course(
    resource_data: dict,
    blocklist: list[str],
    duplicates: list[dict],
    *,
    config=CourseLoaderConfig(),
) -> LearningResource:
    """
    Load the course into the database

    Args:
        resource_data (dict):
            a dict of course data values
        blocklist (list of str):
            list of course ids not to load
        duplicates (list of dict):
            list of duplicate course data
        config (CourseLoaderConfig):
            configuration on how to load this program

    Returns:
        Course:
            the created/updated course
    """

    topics_data = resource_data.pop("topics", None)
    offered_bys_data = resource_data.pop("offered_by", None)
    image_data = resource_data.pop("image", None)
    course_data = resource_data.pop("course", None)
    department_data = resource_data.pop("departments", [])
    content_tags_data = resource_data.pop("content_tags", [])
    resource_data.setdefault("delivery", [LearningResourceDelivery.online.name])
    runs_data = resource_data.get("runs", [])
    force_ingest = resource_data.pop("force_ingest", False)

    with transaction.atomic():
        learning_resource, created = upsert_course_or_program(
            resource_data,
            blocklist,
            duplicates,
            LearningResourceType.course.name,
            config=config,
        )
        if config.fetch_only or not learning_resource:
            return learning_resource

        Course.objects.get_or_create(
            learning_resource=learning_resource, defaults=course_data
        )

        run_ids_to_update_or_create = [run["run_id"] for run in runs_data]
        if force_ingest:
            """
            for the case where we are force ingesting the content and published=False
            we set the course to "test_mode" in learn
            """
            learning_resource.require_summaries = True
            if learning_resource.published is False:
                learning_resource.test_mode = True
            learning_resource.save()
        for course_run_data in runs_data:
            load_run(learning_resource, course_run_data)

        if config.prune:
            # mark runs no longer included here as unpublished
            # This generally should not be done when loading courses
            # from a program (config.prune=False).
            # The course ETL should be the ultimate source of truth for
            # courses and their runs.
            for run in learning_resource.runs.exclude(
                Q(run_id__in=run_ids_to_update_or_create)
                | Q(learning_resource__test_mode=True)
            ).filter(published=True):
                run.published = False
                run.save()
                resource_run_unpublished_actions(run)

        load_run_dependent_values(learning_resource)
        load_topics(learning_resource, topics_data)
        load_offered_by(learning_resource, offered_bys_data)
        load_image(learning_resource, image_data)
        load_departments(learning_resource, department_data)
        load_content_tags(learning_resource, content_tags_data, is_content_file=False)

    update_index(learning_resource, created)
    return learning_resource


def load_courses(
    etl_source: str, courses_data: list[dict], *, config=CourseLoaderConfig()
) -> list[LearningResource]:
    """
    Load a list of courses

    Args:
        etl_source (str): The ETL source of the course data
        courses_data (list of dict):
            a list of course data values
        config (CourseLoaderConfig):
            configuration on how to load this program

    Returns:
        A list of course LearningResources
    """
    blocklist = load_course_blocklist()
    duplicates = load_course_duplicates(etl_source)

    courses_list = list(courses_data or [])

    courses = [
        course
        for course in [
            load_course(course, blocklist, duplicates, config=config)
            for course in courses_list
        ]
        if course is not None
    ]

    if courses and config.prune:
        for learning_resource in LearningResource.objects.filter(
            etl_source=etl_source, resource_type=LearningResourceType.course.name
        ).exclude(
            Q(id__in=[learning_resource.id for learning_resource in courses])
            | Q(test_mode=True)
        ):
            learning_resource.published = False
            learning_resource.save()
            resource_unpublished_actions(learning_resource)

    return courses


def load_program(
    program_data: dict,
    blocklist: list[str],
    duplicates: list[dict],
    *,
    config=ProgramLoaderConfig(),
) -> LearningResource:
    """
    Load the program into the database

    Args:
        program_data (dict):
            a dict of program data values
        blocklist (list of str):
            list of course ids not to load
        duplicates (list of dict):
            list of duplicate course data
        config (ProgramLoaderConfig):
            configuration on how to load this program

    Returns:
        Program:
            the created/updated program
    """
    # pylint: disable=too-many-locals

    courses_data = program_data.pop("courses")
    topics_data = program_data.pop("topics", [])
    offered_by_data = program_data.pop("offered_by", None)
    departments_data = program_data.pop("departments", None)
    image_data = program_data.pop("image", None)
    program_data.setdefault("delivery", [LearningResourceDelivery.online.name])
    runs_data = program_data.get("runs", [])

    course_resources = []
    with transaction.atomic():
        learning_resource, created = upsert_course_or_program(
            program_data, [], [], LearningResourceType.program.name
        )
        if not learning_resource:
            return None

        load_topics(learning_resource, topics_data)
        load_image(learning_resource, image_data)
        load_offered_by(learning_resource, offered_by_data)
        load_departments(learning_resource, departments_data)

        program, _ = Program.objects.get_or_create(learning_resource=learning_resource)

        run_ids_to_update_or_create = [run["run_id"] for run in runs_data]

        for run_data in runs_data:
            load_run(learning_resource, run_data)

        if config.prune:
            # mark runs no longer included here as unpublished
            for run in learning_resource.runs.exclude(
                Q(run_id__in=run_ids_to_update_or_create)
                | Q(learning_resource__test_mode=True)
            ).filter(published=True):
                run.published = False
                run.save()

        load_run_dependent_values(learning_resource)

        for course_data in courses_data:
            # skip courses that don't define a readable_id
            if not course_data.get("readable_id", None):
                continue

            course_resource = load_course(
                course_data, blocklist, duplicates, config=config.courses
            )
            if course_resource:
                course_resources.append(course_resource)
        program.learning_resource.resources.set(
            course_resources,
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PROGRAM_COURSES
            },
        )

    update_index(learning_resource, created)

    return learning_resource


def load_programs(
    etl_source: str, programs_data: list[dict], *, config=ProgramLoaderConfig()
) -> list[LearningResource]:
    """Load a list of programs"""
    blocklist = load_course_blocklist()
    duplicates = load_course_duplicates(etl_source)

    programs = [
        load_program(program_data, blocklist, duplicates, config=config)
        for program_data in programs_data
    ]
    if programs and config.prune:
        for learning_resource in LearningResource.objects.filter(
            etl_source=etl_source, resource_type=LearningResourceType.program.name
        ).exclude(
            id__in=[
                learning_resource.id
                for learning_resource in programs
                if learning_resource is not None
            ]
        ):
            learning_resource.published = False
            learning_resource.save()
            resource_unpublished_actions(learning_resource)
    return [program for program in programs if program is not None]


def load_content_file(
    course_run: LearningResourceRun, content_file_data: dict
) -> ContentFile:
    """
    Sync a course run file/page to the database

    Args:
        course_run (LearningResourceRun): a LearningResourceRun for a Course
        content_file_data (dict): File metadata as JSON

    Returns:
        Int: the id of the object that was created or updated
    """
    try:
        content_file_tags = content_file_data.pop("content_tags", [])
        content_file, _ = ContentFile.objects.update_or_create(
            run=course_run, key=content_file_data.get("key"), defaults=content_file_data
        )
        load_content_tags(content_file, content_file_tags, is_content_file=True)
        return content_file.id  # noqa: TRY300
    except:  # noqa: E722
        log.exception(
            "ERROR syncing course file %s for run %d",
            content_file_data.get("uid", ""),
            course_run.id,
        )


def calculate_completeness(
    run: LearningResourceRun, content_tags: list[list[str]] | None = None
):
    """Calculate the completeness score of an OCW course"""
    ocw_resource = run.learning_resource
    if any(
        coursenum["value"]
        for coursenum in ocw_resource.course.course_numbers
        if coursenum["value"].endswith("SC")
    ):
        # SC courses get an automatic 1.0 score
        new_score = 1.0
    else:
        if content_tags is None:
            content_tags = [
                [tag.name for tag in content_file.content_tags.all()]
                for content_file in run.content_files.only("content_tags")
            ]
        content_keys = CONTENT_TAG_CATEGORIES.values()
        content_tags_dict = dict(zip(content_keys, [0] * len(content_keys)))
        for content_file_tags in content_tags:
            if content_file_tags is None:
                continue
            for content_tag in content_file_tags:
                category = CONTENT_TAG_CATEGORIES.get(content_tag)
                if category:
                    content_tags_dict[category] = content_tags_dict.get(category, 0) + 1
        lecture_video_rating = min(
            content_tags_dict.get(ContentTagCategory.videos.value, 0) / 24, 1.0
        )
        lecture_notes_rating = min(
            content_tags_dict.get(ContentTagCategory.notes.value, 0) / 24, 1.0
        )
        exams_rating = min(
            content_tags_dict.get(ContentTagCategory.exams.value, 0), 1.0
        )
        problem_set_rating = min(
            content_tags_dict.get(ContentTagCategory.problem_sets.value, 0) / 10, 1.0
        )
        log.info(
            "Videos: %.2f, Notes: %.2f, Exams: %.2f Problems/Assignments: %.2f",
            lecture_video_rating,
            lecture_notes_rating,
            exams_rating,
            problem_set_rating,
        )
        new_score = (
            0.4 * lecture_video_rating
            + 0.2 * lecture_notes_rating
            + 0.2 * exams_rating
            + 0.2 * problem_set_rating
        )
    if ocw_resource.completeness != new_score:
        ocw_resource.completeness = new_score
        ocw_resource.save()
        update_index(ocw_resource, newly_created=False)
    return new_score


def load_content_files(
    course_run: LearningResourceRun,
    content_files_data: list[dict],
    *,
    calc_completeness: bool = False,
) -> list[int]:
    """
    Sync all content files for a course run to database and S3 if not present in DB

    Args:
        course_run (LearningResourceRun): a course run
        content_files_data (list or generator): Details about the content files
        calc_completeness: bool: Whether to calculate the completeness score

    Returns:
        list of int: Ids of the ContentFile objects that were created/updated

    """
    if course_run.learning_resource.resource_type == LearningResourceType.course.name:
        content_files_ids = []
        content_tags = []
        for content_file in content_files_data:
            content_tags.append(content_file.get("content_tags") or [])
            content_files_ids.append(load_content_file(course_run, content_file))
        for file in (
            ContentFile.objects.filter(run=course_run)
            .exclude(id__in=content_files_ids)
            .all()
        ):
            file.published = False
            file.save()

            if file.learning_material_resource:
                resource = file.learning_material_resource
                resource.published = False
                resource.save()

        if calc_completeness:
            calculate_completeness(course_run, content_tags=content_tags)
        content_files_loaded_actions(run=course_run)

        return content_files_ids
    return None


def load_learning_materials(
    course_run: LearningResourceRun,
    content_file_ids: list[int],
):
    """
    Create learning material objects from ocw content files
    """
    material_ids = []

    for content_file_id in content_file_ids:
        content_file = ContentFile.objects.get(id=content_file_id)
        learning_material_tags = set(
            content_file.content_tags.values_list("name", flat=True)
        ) & set(OCW_COURSE_CONTENT_CATEGORY_MAPPING.keys())
        if learning_material_tags:
            material_ids.append(
                load_learning_material(course_run, content_file, learning_material_tags)
            )

    course_run.learning_resource.resources.set(
        LearningResource.objects.filter(id__in=material_ids).only("id"),
        through_defaults={
            "relation_type": LearningResourceRelationTypes.COURSE_LEARNING_MATERIALS
        },
    )


def load_learning_material(
    course_run: LearningResourceRun,
    content_file: ContentFile,
    learning_material_tags: set[str],
):
    """
    Create learning material object from ocw content file
    """

    resource_categories = {
        OCW_COURSE_CONTENT_CATEGORY_MAPPING[tag] for tag in learning_material_tags
    }
    resource_categories = sorted(resource_categories)
    resource_category = resource_categories[0]

    with transaction.atomic():
        if resource_category == "Video":
            resource_type = LearningResourceType.video.name
        else:
            resource_type = LearningResourceType.document.name
        learning_resource, _ = LearningResource.objects.update_or_create(
            readable_id=f"{course_run.run_id}-{content_file.key}",
            platform=course_run.learning_resource.platform,
            defaults={
                "resource_type": resource_type,
                "title": content_file.title,
                "url": content_file.url,
                "etl_source": course_run.learning_resource.etl_source,
                "offered_by": course_run.learning_resource.offered_by,
                "published": True,
                "resource_category": resource_category,
            },
        )

        content_file.learning_material_resource = learning_resource
        content_file.save()
        return learning_resource.id


def load_problem_file(
    course_run: LearningResourceRun, problem_file_data: dict
) -> ContentFile:
    """
    Sync a tutorbot problem to the database

    Args:
        course_run (LearningResourceRun): a LearningResourceRun for a Course
        problem_file_data (dict): File metadata as JSON

    Returns:
        Int: the id of the object that was created or updated
    """
    try:
        problem_file, _ = TutorProblemFile.objects.update_or_create(
            run=course_run,
            source_path=problem_file_data.get("source_path"),
            defaults=problem_file_data,
        )
        return problem_file.id  # noqa: TRY300
    except:  # noqa: E722
        log.exception(
            "ERROR syncing problem file  %s for run %d",
            problem_file_data.get("source_path", ""),
            course_run.id,
        )


def load_problem_files(
    course_run: LearningResourceRun,
    problem_files_data: list[dict],
) -> list[int]:
    """
    Sync all problem files for canvas course

    Args:
        course_run (LearningResourceRun): a course run
        problem_files_data (list or generator): Details about the problem files

    Returns:
        list of int: Ids of the TutorProblemFile objects that were created/updated

    """
    problem_files_ids = [
        load_problem_file(course_run, problem_file)
        for problem_file in problem_files_data
    ]
    for file in (
        TutorProblemFile.objects.filter(run=course_run)
        .exclude(id__in=problem_files_ids)
        .all()
    ):
        file.delete()

    return problem_files_ids


def load_podcast_episode(episode_data: dict) -> LearningResource:
    """
    Load a podcast_episode into the database
    Args:
        episode_data (dict): data for the episode
        config (PodcastLoaderConfig):
            configuration for this loader

    Returns:
        LearningResource: Podcast episode resource object that was created/updated
    """
    readable_id = episode_data.pop("readable_id")
    topics_data = episode_data.pop("topics", [])
    offered_bys_data = episode_data.pop("offered_by", {})
    image_data = episode_data.pop("image", {})
    departments_data = episode_data.pop("departments", [])

    episode_model_data = episode_data.pop("podcast_episode", {})
    with transaction.atomic():
        learning_resource, created = LearningResource.objects.update_or_create(
            readable_id=readable_id,
            platform=LearningResourcePlatform.objects.get(
                code=PlatformType.podcast.name
            ),
            resource_category=LearningResourceType.podcast_episode.value,
            defaults=episode_data,
        )

        PodcastEpisode.objects.update_or_create(
            learning_resource=learning_resource, defaults=episode_model_data
        )
    load_image(learning_resource, image_data)
    load_topics(learning_resource, topics_data)
    load_offered_by(learning_resource, offered_bys_data)
    load_departments(learning_resource, departments_data)

    update_index(learning_resource, created)

    return learning_resource


def load_podcast(podcast_data: dict) -> LearningResource:
    """
    Load a single podcast

    Arg:
        podcast_data (dict):
            the normalized podcast data
        config (PodcastLoaderConfig):
            configuration for this loader
    Returns:
        LearningResource:
            the updated or created podcast resource
    """
    readable_id = podcast_data.pop("readable_id")
    episodes_data = podcast_data.pop("episodes", [])
    topics_data = podcast_data.pop("topics", [])
    offered_by_data = podcast_data.pop("offered_by", None)
    image_data = podcast_data.pop("image", {})
    podcast_model_data = podcast_data.pop("podcast", {})
    departments_data = podcast_data.pop("departments", [])

    with transaction.atomic():
        learning_resource, created = LearningResource.objects.update_or_create(
            readable_id=readable_id,
            platform=LearningResourcePlatform.objects.get(
                code=PlatformType.podcast.name
            ),
            resource_category=LearningResourceType.podcast.value,
            defaults=podcast_data,
        )
        Podcast.objects.update_or_create(
            learning_resource=learning_resource, defaults=podcast_model_data
        )
        load_image(learning_resource, image_data)
        load_topics(learning_resource, topics_data)
        load_offered_by(learning_resource, offered_by_data)
        load_departments(learning_resource, departments_data)

    episode_ids = []
    if learning_resource.published:
        for episode_data in episodes_data:
            episode = load_podcast_episode(episode_data)
            episode_ids.append(episode.id)

        unpublished_episode_ids = (
            learning_resource.children.filter(
                relation_type=LearningResourceRelationTypes.PODCAST_EPISODES.value,
            )
            .exclude(child__id__in=episode_ids)
            .values_list("child__id", flat=True)
        )
        LearningResource.objects.filter(id__in=unpublished_episode_ids).update(
            published=False
        )
        bulk_resources_unpublished_actions(
            unpublished_episode_ids,
            LearningResourceType.podcast_episode.name,
        )
        episode_ids.extend(unpublished_episode_ids)
        learning_resource.resources.set(
            episode_ids,
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PODCAST_EPISODES,
            },
        )

    update_index(learning_resource, created)

    return learning_resource


def load_podcasts(podcasts_data: list[dict]) -> list[LearningResource]:
    """
    Load a list of podcasts

    Args:
        podcasts_data (iter of dict): iterable of podcast data

    Returns:
        list of LearningResources:
            list of the loaded podcast resources
    """
    podcast_resources = []

    for podcast_data in podcasts_data:
        readable_id = podcast_data["readable_id"]
        try:
            podcast_resource = load_podcast(podcast_data)
        except ExtractException:
            log.exception("Error with extracted podcast: podcast_id=%s", readable_id)
        else:
            podcast_resources.append(podcast_resource)

    # unpublish the podcasts and episodes we're no longer tracking
    ids = [podcast.id for podcast in podcast_resources]
    unpublished_podcasts = LearningResource.objects.filter(
        resource_type=LearningResourceType.podcast.name
    ).exclude(id__in=ids)
    unpublished_podcasts.update(published=False)
    bulk_resources_unpublished_actions(
        unpublished_podcasts.values_list("id", flat=True),
        LearningResourceType.podcast.name,
    )
    unpublished_episodes = LearningResource.objects.filter(
        resource_type=LearningResourceType.podcast_episode.name
    ).exclude(parents__parent__in=ids)
    unpublished_episodes.update(published=False)
    bulk_resources_unpublished_actions(
        unpublished_episodes.values_list("id", flat=True),
        LearningResourceType.podcast_episode.name,
    )
    return podcast_resources


def load_video(video_data: dict) -> LearningResource:
    """
    Load a video into the database

    Args:
        video_data (dict): the video data

    Returns:
        LearningResource: the created or updated video resource

    """
    readable_id = video_data.pop("readable_id")
    platform = video_data.pop("platform")
    topics_data = video_data.pop("topics", None)
    offered_by_data = video_data.pop("offered_by", None)
    video_fields = video_data.pop("video", {})
    image_data = video_data.pop("image", None)
    with transaction.atomic():
        (
            learning_resource,
            created,
        ) = LearningResource.objects.update_or_create(
            platform=LearningResourcePlatform.objects.get(code=platform),
            readable_id=readable_id,
            resource_type=LearningResourceType.video.name,
            resource_category=LearningResourceType.video.value,
            defaults=video_data,
        )
        Video.objects.update_or_create(
            learning_resource=learning_resource, defaults=video_fields
        )
        load_image(learning_resource, image_data)
        if not topics_data:
            topics_data = similar_topics_action(learning_resource)
        load_topics(learning_resource, topics_data)
        load_offered_by(learning_resource, offered_by_data)

    update_index(learning_resource, created)

    return learning_resource


def load_videos(videos_data: iter) -> list[LearningResource]:
    """
    Load a list of videos into the database

    Args:
        videos_data (iter of dict): iterable of the video data

    Returns:
        list of Video:
            the list of loaded videos
    """

    return [load_video(video_data) for video_data in videos_data]


def load_article(article_data: dict) -> LearningResource:
    """
    Load a single article into the database

    Args:
        article_data (dict): the article data

    Returns:
        LearningResource: the created or updated article resource
    """
    readable_id = article_data.get("readable_id")
    topics_data = article_data.pop("topics")
    offered_by_data = article_data.pop("offered_by", None)
    image_url = article_data.pop("image")

    with transaction.atomic():
        (
            learning_resource,
            created,
        ) = LearningResource.objects.update_or_create(
            platform=LearningResourcePlatform.objects.get(
                code=PlatformType.climate.name
            ),
            readable_id=readable_id,
            resource_type=LearningResourceType.article.name,
            resource_category=LearningResourceType.article.value,
            defaults=article_data,
        )
        Article.objects.update_or_create(
            learning_resource=learning_resource,
        )
        load_image(learning_resource, image_url)
        if not topics_data:
            topics_data = similar_topics_action(learning_resource)
        load_topics(learning_resource, topics_data)
        load_offered_by(learning_resource, offered_by_data)
    update_index(learning_resource, created)
    return learning_resource


def load_articles(articles_data: iter) -> list[LearningResource]:
    """
    Load a list of articles into the database

    Args:
        articles_data (iter of dict): iterable of the article data

    Returns:
        list of LearningResource:
            the list of loaded articles
    """

    article_resources = []
    for article_data in articles_data:
        try:
            article_resource = load_article(article_data)
        except ExtractException:
            log.exception(
                "Error with extracted article: article_id=%s",
                article_data.get("readable_id"),
            )
        else:
            article_resources.append(article_resource)
    unpublished_articles = Article.objects.exclude(
        learning_resource__id__in=[resource.id for resource in article_resources]
    )
    # remove articles that no longer exist
    bulk_resources_unpublished_actions(
        unpublished_articles.values_list("learning_resource__id", flat=True),
        LearningResourceType.article.name,
    )
    return article_resources


def load_playlist(video_channel: VideoChannel, playlist_data: dict) -> LearningResource:
    """
    Load a video playlist into the database

    Args:
        video_channel (VideoChannel): the video channel instance this playlist is under
        playlist_data (dict): the video playlist

    Returns:
        LearningResource: the created or updated playlist resource
    """

    playlist_id = playlist_data.pop("playlist_id")
    thumbnail_data = playlist_data.pop("image", None)
    videos_data = playlist_data.pop("videos", [])
    offered_bys_data = playlist_data.pop("offered_by", None)

    with transaction.atomic():
        image, _ = LearningResourceImage.objects.update_or_create(
            url=thumbnail_data.get("url"),
            alt=thumbnail_data.get("alt"),
        )
        playlist_data["image"] = image
        playlist_resource, created = LearningResource.objects.update_or_create(
            readable_id=playlist_id,
            resource_type=LearningResourceType.video_playlist.name,
            resource_category=LearningResourceType.video_playlist.value,
            platform=LearningResourcePlatform.objects.get(
                code=playlist_data.pop("platform", PlatformType.youtube.name),
            ),
            defaults=playlist_data,
        )
        VideoPlaylist.objects.update_or_create(
            learning_resource=playlist_resource,
            defaults={"channel": video_channel},
        )
        load_offered_by(playlist_resource, offered_bys_data)

    video_resources = load_videos(videos_data)
    load_topics(playlist_resource, most_common_topics(video_resources))
    unpublished_videos = playlist_resource.resources.filter(
        resource_type=LearningResourceType.video.name,
        published=True,
    ).exclude(id__in=[video.id for video in video_resources])
    unpublished_videos.update(published=False)
    bulk_resources_unpublished_actions(
        unpublished_videos.values_list("id", flat=True),
        LearningResourceType.video.name,
    )

    playlist_resource.resources.clear()
    for idx, video in enumerate(video_resources):
        playlist_resource.resources.add(
            video,
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PLAYLIST_VIDEOS,
                "position": idx,
            },
        )
    update_index(playlist_resource, created)

    return playlist_resource


def load_playlists(
    video_channel: VideoChannel, playlists_data: iter
) -> list[LearningResource]:
    """
    Load a list of video playlists into the database

    Args:
        video_channel (VideoChannel): the video channel instance this playlist is under
        playlists_data (iter of dict): iterable of the video playlists

    Returns:
        list of LearningResource:
            the created or updated LearningResources for the playlists
    """
    playlists = [
        load_playlist(video_channel, playlist_data) for playlist_data in playlists_data
    ]
    playlist_ids = [playlist.id for playlist in playlists]

    # remove playlists that no longer exist
    playlists_to_unpublish = LearningResource.objects.filter(
        video_playlist__channel=video_channel
    ).exclude(id__in=playlist_ids)

    playlists_to_unpublish.update(published=False)
    bulk_resources_unpublished_actions(
        playlists_to_unpublish.values_list("id", flat=True),
        LearningResourceType.video_playlist.name,
    )

    return playlists


def load_video_channel(video_channel_data: dict) -> VideoChannel:
    """
    Load a single video channel into the database

    Arg:
        video_channel_data (dict):
            the normalized video channel data
    Returns:
        VideoChannel: the updated or created video channel
    """
    channel_id = video_channel_data.pop("channel_id")
    playlists_data = video_channel_data.pop("playlists", [])

    video_channel, _ = VideoChannel.objects.select_for_update().update_or_create(
        channel_id=channel_id, defaults=video_channel_data
    )
    load_playlists(video_channel, playlists_data)

    return video_channel


def load_video_channels(video_channels_data: iter) -> list[VideoChannel]:
    """
    Load a list of video channels

    Args:
        video_channels_data (iter of dict): iterable of the video channels data

    Returns:
        list of VideoChannel: the loaded video channels
    """
    video_channels = []
    channel_ids = []
    for video_channel_data in video_channels_data:
        channel_id = video_channel_data["channel_id"]
        channel_ids.append(channel_id)
        try:
            video_channel = load_video_channel(video_channel_data)
        except ExtractException:
            # video_channel_data has lazily evaluated generators,
            # one of them could raise an extraction error
            # this is a small pollution of separation of concerns
            # but this allows us to stream the extracted data w/ generators
            # as opposed to having to load everything into memory,
            # which will eventually fail
            log.exception(
                "Error with extracted video channel: channel_id=%s", channel_id
            )
        else:
            video_channels.append(video_channel)

    VideoChannel.objects.exclude(channel_id__in=channel_ids).update(published=False)

    # Unpublish any video playlists not included in published channels
    orphaned_playlist_ids = VideoPlaylist.objects.exclude(
        channel__channel_id__in=channel_ids
    ).values_list("learning_resource__id", flat=True)
    if orphaned_playlist_ids:
        LearningResource.objects.filter(id__in=orphaned_playlist_ids).update(
            published=False
        )
        bulk_resources_unpublished_actions(
            orphaned_playlist_ids, LearningResourceType.video_playlist.name
        )

    # Unpublish any published videos that aren't in at least one published playlist
    orphaned_video_ids = (
        LearningResourceRelationship.objects.filter(
            relation_type=LearningResourceRelationTypes.PLAYLIST_VIDEOS.value
        )
        .exclude(parent__published=True)
        .values_list("child", flat=True)
    )
    if orphaned_video_ids:
        LearningResource.objects.filter(id__in=orphaned_video_ids).update(
            published=False
        )
        bulk_resources_unpublished_actions(
            orphaned_video_ids, LearningResourceType.video.name
        )

    return video_channels
