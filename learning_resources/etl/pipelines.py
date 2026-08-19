"""ETL pipelines"""

import logging
from datetime import datetime

import boto3
from django.conf import settings
from toolz import compose, curry

from learning_resources.etl import (
    loaders,
    mit_edx,
    mit_edx_programs,
    mitpe,
    mitxonline,
    ocw,
    oll,
    ovs,
    podcast,
    posthog,
    sloan,
    xpro,
)
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.exceptions import ExtractException
from learning_resources.models import LearningResource

log = logging.getLogger(__name__)

load_programs = curry(loaders.load_programs)
load_courses = curry(loaders.load_courses)

mit_edx_courses_etl = compose(
    load_courses(
        ETLSource.mit_edx.name,
        config=CourseLoaderConfig(prune=True),
    ),
    mit_edx.transform,
    mit_edx.extract,
)

mit_edx_programs_etl = compose(
    load_programs(
        ETLSource.mit_edx.name,
        config=ProgramLoaderConfig(
            courses=CourseLoaderConfig(fetch_only=True), prune=True
        ),
    ),
    mit_edx_programs.transform,
    mit_edx_programs.extract,
)

# The MITx Online pipelines run one chunk of the catalog at a time so that a
# culled pod only costs that chunk. Neither prunes: the catalog-wide sweep is
# driven off the extracted listing before the chunks are queued (see
# learning_resources.tasks.get_mitxonline_data), since a chunk cannot tell
# which of the other chunks' resources are still live.
MITXONLINE_COURSE_LOADER_CONFIG = CourseLoaderConfig(prune=True)
MITXONLINE_PROGRAM_LOADER_CONFIG = ProgramLoaderConfig(
    courses=CourseLoaderConfig(fetch_only=True), prune=True
)


def mitxonline_courses_etl(readable_ids: list[str]) -> list[LearningResource]:
    """
    Run the MITx Online course ETL for one chunk of the catalog.

    Failures are isolated per course: these chunks run as a celery group that
    the program group chains off, and one failed task poisons the chord header
    so the programs would never run.

    Args:
        readable_ids (list of str): readable ids of the courses to load

    Returns:
        list of LearningResource: the loaded courses
    """
    if not readable_ids:
        return []
    blocklist = loaders.load_course_blocklist()

    courses = []
    for course_data in mitxonline.transform_courses(
        mitxonline.extract_courses_by_readable_ids(readable_ids)
    ):
        readable_id = course_data.get("readable_id")
        try:
            course = loaders.load_course(
                course_data,
                blocklist,
                config=MITXONLINE_COURSE_LOADER_CONFIG,
            )
        except Exception:
            log.exception("Failed to load MITx Online course %s", readable_id)
            continue
        if course is not None:
            courses.append(course)
    return courses


def mitxonline_programs_etl(readable_ids: list[str]) -> list[LearningResource]:
    """
    Run the MITx Online program ETL for one chunk of the catalog.

    Child-program relationships and search indexing are deferred to
    mitxonline_program_children_etl, which runs once every program exists.
    Failures are isolated per program for the same reason as in
    mitxonline_courses_etl.

    Args:
        readable_ids (list of str): readable ids of the programs to load

    Returns:
        list of LearningResource: the loaded programs
    """
    if not readable_ids:
        return []
    blocklist = loaders.load_course_blocklist()

    programs = []
    for program_data in mitxonline.transform_programs(
        mitxonline.extract_programs(), readable_ids
    ):
        readable_id = program_data.get("readable_id")
        try:
            result = loaders.load_program(
                program_data,
                blocklist,
                config=MITXONLINE_PROGRAM_LOADER_CONFIG,
            )
        except Exception:
            log.exception("Failed to load MITx Online program %s", readable_id)
            continue
        if result.resource is not None:
            programs.append(result.resource)
    return programs


def mitxonline_program_children_etl() -> int:
    """
    Link MITx Online child programs and index programs, after all are loaded.

    Returns:
        int: the number of parent programs whose children were linked
    """
    programs = mitxonline.extract_programs()
    return loaders.load_program_children(
        ETLSource.mitxonline.name,
        mitxonline.transform_child_programs(programs),
        [program["readable_id"] for program in programs],
    )


oll_etl = compose(
    load_courses(ETLSource.oll.name, config=CourseLoaderConfig(prune=True)),
    oll.transform,
    oll.extract,
)


sloan_courses_etl = compose(
    load_courses(ETLSource.see.name, config=CourseLoaderConfig(prune=True)),
    sloan.transform_courses,
    sloan.extract,
)


xpro_programs_etl = compose(
    load_programs(
        ETLSource.xpro.name,
        config=ProgramLoaderConfig(
            courses=CourseLoaderConfig(fetch_only=True), prune=True
        ),
    ),
    xpro.transform_programs,
    xpro.extract_programs,
)
xpro_courses_etl = compose(
    load_courses(ETLSource.xpro.name, config=CourseLoaderConfig(prune=True)),
    xpro.transform_courses,
    xpro.extract_courses,
)

podcast_etl = compose(loaders.load_podcasts, podcast.transform, podcast.extract)


def ocw_courses_etl(
    *,
    url_paths: list[str],
    force_overwrite: bool,
    start_timestamp: datetime | None = None,
    skip_content_files: bool = settings.OCW_SKIP_CONTENT_FILES,
):
    """
    Sync OCW courses to the database

    Args:
        url_paths (list of str): The course url paths to process
        force_overwrite (bool): force incoming course data to overwrite existing data
        start_timestamp (datetime or None): backpopulate start time
        skip_content_files (bool): skip loading content files
    """
    s3_resource = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    exceptions = []
    for url_path in url_paths:
        try:
            data = ocw.extract_course(
                url_path=url_path,
                s3_resource=s3_resource,
                force_overwrite=force_overwrite,
                start_timestamp=start_timestamp,
            )
            if data:
                ocw_course_data = ocw.transform_course(data)
                course_resource = loaders.load_course(ocw_course_data, [])
                course_run = course_resource.runs.filter(published=True).first()

                if course_resource and not skip_content_files:
                    content_file_ids = loaders.load_content_files(
                        course_run,
                        ocw.transform_content_files(
                            s3_resource, url_path, force_overwrite
                        ),
                        calc_completeness=True,
                    )

                    if content_file_ids:
                        loaders.load_learning_materials(course_run, content_file_ids)
            else:
                log.info("No course data found for %s", url_path)
        except:  # noqa: E722
            log.exception("Error encountered parsing OCW json for %s", url_path)
            exceptions.append(url_path)
    if exceptions:
        message = "Some OCW urls raised errors: {exception}".format(
            exception=",".join(exceptions)
        )
        raise ExtractException(message)


ovs_etl = compose(loaders.load_ovs_playlists, ovs.transform, ovs.extract)

posthog_etl = compose(
    posthog.load_posthog_lrd_view_events,
    posthog.posthog_transform_lrd_view_events,
    posthog.posthog_extract_lrd_view_events,
)


def mitpe_etl() -> tuple[list[LearningResource], list[LearningResource]]:
    """
    ETL for professional education courses and programs.

    This pipeline is structured a bit differently than others because the source API
    and the transform/extract functions return both courses and programs.
    """
    courses_data, programs_data = mitpe.transform(mitpe.extract())
    return (
        loaders.load_courses(
            ETLSource.mitpe.name, courses_data, config=CourseLoaderConfig(prune=True)
        ),
        loaders.load_programs(
            ETLSource.mitpe.name,
            programs_data,
            config=ProgramLoaderConfig(prune=True, courses=CourseLoaderConfig()),
        ),
    )


def mit_climate_etl() -> list[dict]:
    """
    ETL for MIT Climate articles.
    """
    from learning_resources.etl.mit_climate import extract_articles

    articles_data = extract_articles()
    return loaders.load_documents(ETLSource.mit_climate.name, articles_data)
