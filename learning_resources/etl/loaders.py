"""Course catalog data loaders"""  # noqa: INP001
import logging

from django.contrib.auth import get_user_model
from django.db import transaction

from learning_resources.constants import (
    LearningResourceRelationTypes,
    LearningResourceType,
)
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    OfferedByLoaderConfig,
    ProgramLoaderConfig,
)
from learning_resources.etl.deduplication import get_most_relevant_run
from learning_resources.models import (
    Course,
    LearningResource,
    LearningResourceImage,
    LearningResourceInstructor,
    LearningResourceOfferor,
    LearningResourcePlatform,
    LearningResourceRun,
    LearningResourceTopic,
    Program,
)
from learning_resources.utils import load_course_blocklist, load_course_duplicates

log = logging.getLogger()

User = get_user_model()


def load_topics(resource, topics_data):
    """Load the topics for a resource into the database"""
    if topics_data is not None:
        topics = []

        for topic_data in topics_data:
            topic, _ = LearningResourceTopic.objects.get_or_create(
                name=topic_data["name"]
            )
            topics.append(topic)

        resource.topics.set(topics)
        resource.save()
    return resource.topics.all()


def load_instructors(resource, instructors_data):
    """Load the instructors for a resource into the database"""
    instructors = []

    for instructor_data in instructors_data:
        if "full_name" not in instructor_data:
            instructor_data["full_name"] = instructor_data.get("title", None)

        instructor, _ = LearningResourceInstructor.objects.get_or_create(
            **instructor_data
        )
        instructors.append(instructor)

    resource.instructors.set(instructors)
    resource.save()
    return instructors


def load_image(resource, image_data):
    """Load the image for a resource into the database"""
    if image_data:
        image, _ = LearningResourceImage.objects.get_or_create(**image_data)

        resource.image = image
    else:
        resource.image = None
        image = None
    resource.save()
    return image


def load_offered_bys(resource, offered_bys_data, *, config=OfferedByLoaderConfig()):
    """
    Loads a list of offered_by into the resource.

    Args:
        resource (LearningResource): learning resource
        offered_bys_data (list of dict): the offered by data for the resource
        config (OfferedByLoaderConfig): loader configuration

    Returns:
        offered_bys (list of LearningResourceOfferor): list of created or updated offered_bys
    """  # noqa: D401, E501
    if offered_bys_data is None:
        return resource.offered_by.all()

    offered_bys = []

    for offered_by_data in offered_bys_data:
        offered_by, _ = LearningResourceOfferor.objects.get_or_create(
            name=offered_by_data["name"]
        )
        if config.additive:
            resource.offered_by.add(offered_by)
        offered_bys.append(offered_by)

    if not config.additive:
        resource.offered_by.set(offered_bys)

    resource.save()
    return offered_bys


def load_run(learning_resource, run_data):
    """
    Load the resource run into the database

    Args:
        learning_resource (LearningResource): the concrete parent learning resource
        run_data (dict): dictionary of data to create/update the run with

    Returns:
        LearningResourceRun: the created/updated resource run
    """
    run_id = run_data.pop("run_id")
    instructors_data = run_data.pop("instructors", [])

    with transaction.atomic():
        (
            learning_resource_run,
            _,
        ) = LearningResourceRun.objects.select_for_update().update_or_create(
            run_id=run_id,
            defaults={
                **run_data,
                "learning_resource": learning_resource,
            },
        )

        load_instructors(learning_resource_run, instructors_data)

    return learning_resource_run


def load_course(  # noqa: C901
    course_data, blocklist, duplicates, *, config=CourseLoaderConfig()
):  # noqa: C901, RUF100
    """
    Load the course into the database

    Args:
        course_data (dict):
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
    # pylint: disable=too-many-branches,too-many-locals
    platform_name = course_data.pop("platform")
    readable_id = course_data.pop("readable_id")
    runs_data = course_data.pop("runs", [])
    topics_data = course_data.pop("topics", None)
    offered_bys_data = course_data.pop("offered_by", [])
    image_data = course_data.pop("image", None)

    if readable_id in blocklist or not runs_data:
        course_data["published"] = False

    deduplicated_course_id = next(
        (
            record["course_id"]
            for record in duplicates
            if readable_id in record["duplicate_course_ids"]
        ),
        None,
    )

    with transaction.atomic():
        platform = LearningResourcePlatform.objects.get(platform=platform_name)

        if deduplicated_course_id:
            # intentionally not updating if the course doesn't exist
            (
                learning_resource,
                created,
            ) = LearningResource.objects.select_for_update().get_or_create(
                platform=platform,
                readable_id=deduplicated_course_id,
                resource_type=LearningResourceType.course.value,
                defaults=course_data,
            )

            if readable_id != deduplicated_course_id:
                duplicate_resource = LearningResource.objects.filter(
                    platform=platform, readable_id=readable_id
                ).first()
                if duplicate_resource:
                    duplicate_resource.published = False
                    duplicate_resource.save()
        else:
            (
                learning_resource,
                created,
            ) = LearningResource.objects.select_for_update().update_or_create(
                platform=platform, readable_id=readable_id, defaults=course_data
            )

        Course.objects.get_or_create(learning_resource=learning_resource)

        run_ids_to_update_or_create = [run["run_id"] for run in runs_data]

        for course_run_data in runs_data:
            load_run(learning_resource, course_run_data)

        if deduplicated_course_id and not created:
            most_relevent_run = get_most_relevant_run(learning_resource.runs.all())

            if most_relevent_run.run_id in run_ids_to_update_or_create:
                for attr, val in course_data.items():
                    setattr(learning_resource, attr, val)
                learning_resource.save()

        unpublished_runs = []
        if config.prune:
            # mark runs no longer included here as unpublished
            for run in learning_resource.runs.exclude(
                run_id__in=run_ids_to_update_or_create
            ).filter(published=True):
                run.published = False
                run.save()
                unpublished_runs.append(run.id)

        load_topics(learning_resource, topics_data)
        load_offered_bys(learning_resource, offered_bys_data, config=config.offered_by)
        load_image(learning_resource, image_data)

    # if not created and not course.published:
    #    for run_id in unpublished_runs:

    return learning_resource


def load_courses(platform, courses_data, *, config=CourseLoaderConfig()):
    """
    Load a list of courses

    Args:
        courses_data (list of dict):
            a list of course data values
        config (CourseLoaderConfig):
            configuration on how to load this program
    """
    blocklist = load_course_blocklist()
    duplicates = load_course_duplicates(platform)

    courses_list = list(courses_data or [])

    courses = [
        load_course(course, blocklist, duplicates, config=config)
        for course in courses_list
    ]

    if courses and config.prune:
        for course in LearningResource.objects.filter(
            platform__platform=platform, resource_type=LearningResourceType.course.value
        ).exclude(id__in=[course.id for course in courses]):
            course.published = False
            course.save()

    return courses


def load_program(program_data, blocklist, duplicates, *, config=ProgramLoaderConfig()):
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

    readable_id = program_data.pop("readable_id")
    courses_data = program_data.pop("courses")
    topics_data = program_data.pop("topics", [])
    runs_data = program_data.pop("runs", [])
    offered_bys_data = program_data.pop("offered_by", [])
    image_data = program_data.pop("image", None)
    platform_name = program_data.pop("platform")

    course_resources = []
    with transaction.atomic():
        # lock on the program record
        platform = LearningResourcePlatform.objects.get(platform=platform_name)

        (
            learning_resource,
            created,  # pylint: disable=unused-variable
        ) = LearningResource.objects.select_for_update().update_or_create(
            readable_id=readable_id,
            platform=platform,
            resource_type=LearningResourceType.program.value,
            defaults=program_data,
        )

        load_topics(learning_resource, topics_data)
        load_image(learning_resource, image_data)
        load_offered_bys(learning_resource, offered_bys_data, config=config.offered_by)

        program, _ = Program.objects.get_or_create(learning_resource=learning_resource)

        run_ids_to_update_or_create = [run["run_id"] for run in runs_data]

        for run_data in runs_data:
            load_run(learning_resource, run_data)

        unpublished_runs = []
        if config.prune:
            # mark runs no longer included here as unpublished
            for run in learning_resource.runs.exclude(
                run_id__in=run_ids_to_update_or_create
            ).filter(published=True):
                run.published = False
                run.save()
                unpublished_runs.append(run.id)

        for course_data in courses_data:
            # skip courses that don't define a readable_id
            if not course_data.get("readable_id", None):
                continue

            course_resource = load_course(
                course_data, blocklist, duplicates, config=config.courses
            )
            course_resources.append(course_resource)
        program.learning_resource.resources.set(
            course_resources,
            through_defaults={
                "relation_type": LearningResourceRelationTypes.PROGRAM_COURSES
            },
        )

    # if not created and not program.published:

    return learning_resource


def load_programs(platform, programs_data, *, config=ProgramLoaderConfig()):
    """Load a list of programs"""
    blocklist = load_course_blocklist()
    duplicates = load_course_duplicates(platform)

    return [
        load_program(program_data, blocklist, duplicates, config=config)
        for program_data in programs_data
    ]
