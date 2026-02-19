import { faker } from "@faker-js/faker/locale/en"
import { startCase } from "lodash"
import type { Factory, PartialFactory } from "ol-test-utilities"
import { UniqueEnforcer } from "enforce-unique"
import { makePaginatedFactory, mergeOverrides } from "ol-test-utilities"
import type {
  CourseNumber,
  CourseResource,
  LearningPathRelationship,
  LearningPathResource,
  LearningResource,
  LearningResourceBaseDepartment,
  LearningResourceBaseSchool,
  LearningResourceDepartment,
  LearningResourceImage,
  LearningResourceInstructor,
  LearningResourceOfferorDetail,
  LearningResourcePlatform,
  LearningResourcePrice,
  LearningResourceRun,
  LearningResourceSchool,
  LearningResourceTopic,
  MicroLearningPathRelationship,
  PaginatedLearningPathRelationshipList,
  PodcastResource,
  ArticleResource,
  PodcastEpisodeResource,
  ProgramResource,
  VideoPlaylistResource,
  VideoResource,
  LearningResourceRelationship,
  LearningResourceSummary,
} from "api"
import {
  AvailabilityEnum,
  DeliveryEnum,
  CourseResourcePaceInnerCodeEnum,
  CourseResourceFormatInnerCodeEnum,
  ResourceTypeEnum,
  LearningResourceRunLevelInnerCodeEnum,
  PlatformEnum,
  CourseResourceCertificationTypeCodeEnum,
} from "api"

const uniqueEnforcerId = new UniqueEnforcer()
const uniqueEnforcerWords = new UniqueEnforcer()
const maybe = faker.helpers.maybe
type RepeatOptins = { min?: number; max?: number }
type LearningResourceFactory<T> = PartialFactory<Omit<T, "resource_type">, T>
/**
 * Repeat a callback a random number of times
 */
const repeat = <T>(cb: () => T, { min = 2, max = 4 }: RepeatOptins = {}) => {
  const count = faker.number.int({ min, max })
  return Array.from({ length: count }, cb)
}

const language = () =>
  faker.helpers.arrayElement([
    "en-us",
    "es-es",
    "ar-ar",
    "zh-cn",
    "fr-fr",
    "pt-pt",
  ])

const learningResourceImage: Factory<LearningResourceImage> = (
  overrides = {},
) => ({
  id: uniqueEnforcerId.enforce(() => faker.number.int()),
  url: new URL(faker.internet.url()).toString(),
  description: faker.lorem.words(),
  alt: faker.lorem.words(),
  ...overrides,
})

const learningResourceInstructor: Factory<LearningResourceInstructor> = (
  overrides = {},
) => {
  const instructor: LearningResourceInstructor = {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    first_name: maybe(faker.person.firstName),
    last_name: maybe(faker.person.lastName),
    full_name: maybe(faker.person.fullName),
    ...overrides,
  }
  return instructor
}

const learningResourcePrice: Factory<LearningResourcePrice> = (
  overrides = {},
) => {
  const resourcePrice: LearningResourcePrice = {
    amount: faker.finance.amount({ min: 0, max: 200 }),
    currency: "USD",
    ...overrides,
  }
  return resourcePrice
}

const learningResourceBaseSchool: Factory<LearningResourceBaseSchool> = (
  overrides = {},
) => {
  return {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    name: faker.lorem.words(3),
    url: faker.internet.url(),
    ...overrides,
  }
}

const learningResourceBaseDepartment: Factory<
  LearningResourceBaseDepartment
> = (overrides = {}) => {
  return {
    department_id: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    channel_url: `${faker.internet.url({ appendSlash: false })}${faker.system.directoryPath()}`,
    ...overrides,
  }
}

const learningResourceDepartment: Factory<LearningResourceDepartment> = (
  overrides = {},
) => {
  return {
    ...learningResourceBaseDepartment(),
    school: maybe(learningResourceBaseSchool) ?? null,
    ...overrides,
  }
}
const departments = makePaginatedFactory(learningResourceDepartment)

const learnigResourceSchool: Factory<LearningResourceSchool> = (
  overrides = {},
) => {
  return {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    name: faker.lorem.words(3),
    url: faker.internet.url(),
    departments: repeat(learningResourceBaseDepartment),
    ...overrides,
  }
}
const schools = makePaginatedFactory(learnigResourceSchool)

const learningResourcePlatform: Factory<LearningResourcePlatform> = (
  overrides = {},
) => {
  return {
    code: faker.helpers.arrayElement(
      Object.values([
        PlatformEnum.Edx,
        PlatformEnum.Mitxonline,
        PlatformEnum.Xpro,
      ]),
    ),
    name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    ...overrides,
  }
}

const learningResourceOfferor: Factory<LearningResourceOfferorDetail> = (
  overrides = {},
) => {
  return {
    code: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    channel_url: faker.internet.url(),
    offerings: repeat(faker.lorem.word),
    audience: repeat(faker.lorem.word),
    formats: repeat(faker.lorem.word),
    fee: repeat(faker.lorem.word),
    certifications: repeat(faker.lorem.word),
    content_types: repeat(faker.lorem.word),
    more_information: faker.internet.url(),
    ...overrides,
  }
}
const learningResourceOfferors = makePaginatedFactory(learningResourceOfferor)
const learningResourcePlatforms = makePaginatedFactory(learningResourcePlatform)

const learningResourceRun: Factory<LearningResourceRun> = (overrides = {}) => {
  const start = overrides.start_date
    ? new Date(overrides.start_date)
    : faker.helpers.arrayElement([faker.date.past(), faker.date.future()])
  const end = faker.date.future({ years: 1, refDate: start })

  const run: LearningResourceRun = {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    instructors: maybe(() => repeat(learningResourceInstructor)) ?? null,
    image: maybe(learningResourceImage) ?? null,
    run_id: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    title: faker.lorem.words(),
    languages: maybe(() => repeat(language, { min: 0, max: 3 })),
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    availability: faker.helpers.arrayElement(Object.values(AvailabilityEnum)),
    delivery: [
      {
        code: faker.helpers.arrayElement(Object.values(DeliveryEnum)),
        name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
      },
    ],
    pace: [
      {
        code: faker.helpers.arrayElement(
          Object.values(CourseResourcePaceInnerCodeEnum),
        ),
        name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
      },
    ],
    format: [
      {
        code: faker.helpers.arrayElement(
          Object.values(CourseResourceFormatInnerCodeEnum),
        ),
        name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
      },
    ],
    level: [
      {
        code: faker.helpers.arrayElement(
          Object.values(LearningResourceRunLevelInnerCodeEnum),
        ),
        name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
      },
    ],
    resource_prices: repeat(learningResourcePrice, { min: 0, max: 5 }),
    ...overrides,
  }
  return run
}

const learningResourceTopic: Factory<LearningResourceTopic> = (
  overrides = {},
) => {
  const topic: LearningResourceTopic = {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    name: uniqueEnforcerWords.enforce(() => faker.lorem.words()),
    channel_url: `${faker.internet.url({ appendSlash: false })}${faker.system.directoryPath()}`,
    parent: null,
    ...overrides,
  }
  return topic
}

const learningResourceTopics = makePaginatedFactory(learningResourceTopic)

const learningResourceType = () =>
  faker.helpers.arrayElement(Object.values(ResourceTypeEnum))

const learningResourceCourseNumber: Factory<CourseNumber> = (
  overrides = {},
) => {
  return {
    department: learningResourceDepartment(),
    value: faker.lorem.word(),
    listing_type: "primary",
    primary: faker.datatype.boolean(),
    sort_coursenum: faker.lorem.word(),
    ...overrides,
  }
}

const _learningResourceShared = (): Partial<
  Omit<LearningResource, "resource_type">
> => {
  const free = Math.random() < 0.5
  return {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    professional: faker.datatype.boolean(),
    certification: false,
    departments: [learningResourceDepartment()],
    description: faker.lorem.paragraph(),
    position: faker.number.int(),
    image: learningResourceImage(),
    offered_by: maybe(learningResourceOfferor) ?? null,
    platform: maybe(learningResourcePlatform) ?? null,
    free,
    prices: free ? ["0"] : [faker.finance.amount({ min: 0, max: 100 })],
    resource_prices: free
      ? [{ amount: "0", currency: "USD" }]
      : [
          {
            amount: faker.finance.amount({ min: 0, max: 100 }).toString(),
            currency: "USD",
          },
        ],
    readable_id: faker.lorem.slug(),
    course_feature: repeat(faker.lorem.word),
    runs: [],
    published: faker.datatype.boolean(),
    title: startCase(faker.lorem.words()),
    topics: repeat(learningResourceTopic),
    url: faker.internet.url(),
  }
}

const learningResource: PartialFactory<LearningResource> = (overrides = {}) => {
  overrides = mergeOverrides(
    {
      resource_type: learningResourceType(),
    },
    overrides,
  )
  switch (overrides.resource_type) {
    case ResourceTypeEnum.Program:
      return program(overrides)
    case ResourceTypeEnum.Course:
      return course(overrides)
    case ResourceTypeEnum.LearningPath:
      return learningPath(overrides)
    case ResourceTypeEnum.Podcast:
      return podcast(overrides)
    case ResourceTypeEnum.PodcastEpisode:
      return podcastEpisode(overrides)
    case ResourceTypeEnum.VideoPlaylist:
      return videoPlaylist(overrides)
    case ResourceTypeEnum.Video:
      return video(overrides)
    case ResourceTypeEnum.Article:
      return article(overrides)
    case ResourceTypeEnum.LearningMaterial:
      return learningMaterial(overrides)

    default:
      throw Error(`Invalid resource type: ${overrides.resource_type}`)
  }
}

const learningResources = makePaginatedFactory(learningResource)

const learningResourceSummary: LearningResourceFactory<
  LearningResourceSummary
> = (overrides = {}) => {
  return {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    last_modified: faker.date.recent().toISOString(),
    ...overrides,
  }
}
const learningResourceSummaries = makePaginatedFactory(learningResourceSummary)

const program: PartialFactory<ProgramResource> = (overrides = {}) => {
  const certificationCode = faker.helpers.enumValue(
    CourseResourceCertificationTypeCodeEnum,
  )
  return mergeOverrides<ProgramResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.Program },
    {
      offered_by: learningResourceOfferor(),
      platform: learningResourcePlatform(),
      certification: faker.datatype.boolean(),
      program: {
        course_count: faker.number.int({ min: 0, max: 8 }),
      },
      certification_type: {
        code: certificationCode,
        name: {
          [CourseResourceCertificationTypeCodeEnum.Professional]:
            "Professional Certificate",
          [CourseResourceCertificationTypeCodeEnum.Micromasters]:
            "MicroMasters Credential",
          [CourseResourceCertificationTypeCodeEnum.Completion]:
            "Certificate of Completion",
          [CourseResourceCertificationTypeCodeEnum.None]: "No Certificate",
        }[certificationCode],
      },
    },
    overrides,
  )
}
const programs = makePaginatedFactory(program)

const course: LearningResourceFactory<CourseResource> = (overrides = {}) => {
  const certificationCode = faker.helpers.enumValue(
    CourseResourceCertificationTypeCodeEnum,
  )
  return mergeOverrides<CourseResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.Course },
    {
      offered_by: learningResourceOfferor(),
      platform: learningResourcePlatform(),
      runs: repeat(learningResourceRun, { min: 1, max: 5 }),
      certification: faker.datatype.boolean(),
      certification_type: {
        code: certificationCode,
        name: {
          [CourseResourceCertificationTypeCodeEnum.Professional]:
            "Professional Certificate",
          [CourseResourceCertificationTypeCodeEnum.Micromasters]:
            "MicroMasters Credential",
          [CourseResourceCertificationTypeCodeEnum.Completion]:
            "Certificate of Completion",
          [CourseResourceCertificationTypeCodeEnum.None]: "No Certificate",
        }[certificationCode],
      },
      course: {
        course_numbers:
          maybe(() => repeat(learningResourceCourseNumber)) ?? null,
      },
    },
    overrides,
  )
}
const courses = makePaginatedFactory(course)

const learningPath: LearningResourceFactory<LearningPathResource> = (
  overrides = {},
) => {
  return mergeOverrides<LearningPathResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.LearningPath },
    {
      learning_path: {
        id: uniqueEnforcerId.enforce(() => faker.number.int()),
        item_count: faker.number.int({ min: 1, max: 30 }),
      },
    },
    overrides,
  )
}
const learningPaths = makePaginatedFactory(learningPath)

const microLearningPathRelationship: Factory<MicroLearningPathRelationship> = (
  overrides = {},
) => {
  return {
    id: uniqueEnforcerId.enforce(() => faker.number.int()),
    child: uniqueEnforcerId.enforce(() => faker.number.int()),
    parent: uniqueEnforcerId.enforce(() => faker.number.int()),
    ...overrides,
  }
}

const learningResourceRelationship: Factory<LearningResourceRelationship> = (
  overrides = {},
) => {
  const micro = microLearningPathRelationship()
  const resource = learningResource({
    id: micro.child,
  })
  return {
    ...micro,
    position: faker.number.int(),
    resource,
    ...overrides,
  }
}
const learningResourceRelationships = ({
  count,
  parent,
  pageSize,
  next = null,
  previous = null,
}: {
  count: number
  parent: number
  pageSize?: number
  next?: string | null
  previous?: string | null
}) => {
  const results: LearningPathRelationship[] = Array(pageSize ?? count)
    .fill(null)
    .map((_val, index) => {
      return learningResourceRelationship({
        position: index + 1,
        parent,
      })
    })
  return {
    count,
    next,
    previous,
    results,
  } satisfies PaginatedLearningPathRelationshipList
}

const learningPathRelationship: Factory<LearningPathRelationship> = (
  overrides = {},
) => {
  const micro = microLearningPathRelationship()
  const resource = learningResource({
    id: micro.child,
  })
  return {
    ...micro,
    position: faker.number.int(),
    resource,
    ...overrides,
  }
}

const learningPathRelationships = ({
  count,
  parent,
  pageSize,
  next = null,
  previous = null,
}: {
  count: number
  parent: number
  pageSize?: number
  next?: string | null
  previous?: string | null
}) => {
  const results: LearningPathRelationship[] = Array(pageSize ?? count)
    .fill(null)
    .map((_val, index) => {
      return learningPathRelationship({
        position: index + 1,
        parent,
      })
    })
  return {
    count,
    next,
    previous,
    results,
  } satisfies PaginatedLearningPathRelationshipList
}

const podcast: LearningResourceFactory<PodcastResource> = (overrides = {}) => {
  return mergeOverrides<PodcastResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.Podcast },
    {
      podcast: {
        id: uniqueEnforcerId.enforce(() => faker.number.int()),
        episode_count: faker.number.int({ min: 1, max: 70 }),
      },
    },
    overrides,
  )
}
const podcasts = makePaginatedFactory(podcast)

const article: LearningResourceFactory<ArticleResource> = (overrides = {}) => {
  return mergeOverrides<ArticleResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.Article },
    {},
    overrides,
  )
}

const articles = makePaginatedFactory(article)

const podcastEpisode: LearningResourceFactory<PodcastEpisodeResource> = (
  overrides = {},
): PodcastEpisodeResource => {
  return mergeOverrides<PodcastEpisodeResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.PodcastEpisode },
    {
      podcast_episode: {
        id: uniqueEnforcerId.enforce(() => faker.number.int()),
        duration: faker.helpers.arrayElement(["PT1H13M44S", "PT2H30M", "PT1M"]),
        audio_url: faker.internet.url(),
        episode_link: faker.internet.url(),
      },
    },
    overrides,
  )
}

const podcastEpisodes = makePaginatedFactory(podcastEpisode)

const video: LearningResourceFactory<VideoResource> = (overrides = {}) => {
  return mergeOverrides<VideoResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.Video },
    {
      video: {
        duration: faker.number.int({ min: 1, max: 70 }).toString(),
        transcript: faker.lorem.paragraph(),
      },
    },
    overrides,
  )
}
const videos = makePaginatedFactory(video)

const videoPlaylist: LearningResourceFactory<VideoPlaylistResource> = (
  overrides = {},
): VideoPlaylistResource => {
  return mergeOverrides<VideoPlaylistResource>(
    _learningResourceShared(),
    { resource_type: ResourceTypeEnum.VideoPlaylist },
    {
      video_playlist: {
        video_count: faker.number.int({ min: 1, max: 100 }),
        channel: {
          channel_id: uniqueEnforcerId
            .enforce(() => faker.number.int())
            .toString(),
          title: faker.lorem.words(),
        },
      },
    },
    overrides,
  )
}

const videoPlaylists = makePaginatedFactory(videoPlaylist)

export {
  learningResource as resource,
  learningResources as resources,
  learningResourceSummaries as resourceSummaries,
  learningResourceSummary as resourceSummary,
  learningResourceRun as run,
  learningResourceImage as image,
  learningResourceDepartment as department,
  departments,
  learningResourceTopic as topic,
  learningResourceTopics as topics,
  learningResourceOfferor as offeror,
  learningResourceOfferors as offerors,
  learningResourcePlatforms as platforms,
  learningPath,
  learningPaths,
  microLearningPathRelationship,
  learningPathRelationship,
  learningPathRelationships,
  learningResourceRelationship,
  learningResourceRelationships,
  program,
  programs,
  course,
  courses,
  article,
  articles,
  podcast,
  podcasts,
  podcastEpisode,
  podcastEpisodes,
  video,
  videos,
  videoPlaylist,
  videoPlaylists,
  learnigResourceSchool as school,
  schools,
}
