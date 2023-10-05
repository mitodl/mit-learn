import { faker } from "@faker-js/faker/locale/en"
import type { Factory } from "ol-util/factories"
import { makePaginatedFactory } from "ol-util/factories"
import type { PaginatedResult } from "ol-util"
import type {
  LearningResource,
  LearningResourceImage,
  LearningResourceDepartment,
  LearningResourceRun,
  LearningResourceInstructor,
  LearningResourceTopic,
  LearningPathRelationship,
  LearningPath,
  LearningPathResource,
  MicroLearningPathRelationship,
} from "api"
import { ResourceTypeEnum } from "api"
import invariant from "tiny-invariant"

const maybe = faker.helpers.maybe
type RepeatOptins = { min?: number; max?: number }
/**
 * Repeat a callback a random number of times
 */
const repeat = <T>(cb: () => T, { min = 2, max = 4 }: RepeatOptins = {}) => {
  const count = faker.datatype.number({ min, max })
  return Array.from({ length: count }, cb)
}

const language = () =>
  faker.helpers.arrayElement(["en", "es", "ar", "zh", "fr", "pt"])

const learningResourceImage: Factory<LearningResourceImage> = (
  overrides = {},
) => ({
  id: faker.unique(faker.datatype.number),
  url: new URL(faker.internet.url()).toString(),
  description: faker.lorem.words(),
  alt: faker.lorem.words(),
  ...overrides,
})

const learningResourceInstructor: Factory<LearningResourceInstructor> = (
  overrides = {},
) => {
  const instructor: LearningResourceInstructor = {
    id: faker.unique(faker.datatype.number),
    first_name: maybe(faker.name.firstName),
    last_name: maybe(faker.name.lastName),
    full_name: maybe(faker.name.findName),
    ...overrides,
  }
  return instructor
}

const learningResourceDepartment: Factory<LearningResourceDepartment> = (
  overrides = {},
) => {
  return {
    department_id: faker.unique(faker.lorem.words),
    name: faker.lorem.word(),
    ...overrides,
  }
}

const learningResourceRun: Factory<LearningResourceRun> = (overrides = {}) => {
  const start = overrides.start_date
    ? new Date(overrides.start_date)
    : faker.helpers.arrayElement([faker.date.past(), faker.date.future()])
  const end = faker.date.future(1, start)

  const run: LearningResourceRun = {
    id: faker.unique(faker.datatype.number),
    instructors: maybe(() => repeat(learningResourceInstructor)) ?? null,
    image: maybe(learningResourceImage) ?? null,
    run_id: faker.unique(faker.lorem.words),
    title: faker.lorem.words(),
    languages: maybe(() => repeat(language, { min: 0, max: 3 })),
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    ...overrides,
  }
  return run
}

const learningResourceTopic: Factory<LearningResourceTopic> = (
  overrides = {},
) => {
  const topic: LearningResourceTopic = {
    id: faker.unique(faker.datatype.number),
    name: faker.unique(faker.lorem.words),
    ...overrides,
  }
  return topic
}

const learningResourceTopics = makePaginatedFactory(learningResourceTopic)

const learningResourceType = () =>
  faker.helpers.arrayElement(Object.values(ResourceTypeEnum))

const learningResource: Factory<LearningResource> = (
  overrides = {},
): LearningResource => {
  const resourceType = overrides.resource_type ?? learningResourceType()
  const resource: LearningResource = {
    id: faker.unique(faker.datatype.number),
    professional: faker.datatype.boolean(),
    certification: null,
    course: null,
    department: learningResourceDepartment(),
    description: faker.lorem.paragraph(),
    image: learningResourceImage(),
    offered_by: null,
    platform: null,
    prices: null,
    program: null,
    podcast: null,
    podcast_episode: null,
    learning_path: null,
    readable_id: faker.lorem.slug(),
    resource_content_tags: repeat(faker.lorem.word),
    resource_type: resourceType,
    runs: [],
    published: faker.datatype.boolean(),
    title: faker.lorem.words(),
    topics: repeat(learningResourceTopic),
    learning_path_parents: [],
    user_list_parents: [],
    ...typeSpecificOverrides(resourceType),
    ...overrides,
  }

  function typeSpecificOverrides(type: string): Partial<LearningResource> {
    if (type === ResourceTypeEnum.Course) {
      return {
        platform: faker.lorem.word(),
        runs: repeat(learningResourceRun, { min: 1, max: 5 }),
        certification: faker.lorem.word(),
        offered_by: faker.lorem.word(),
        course: {
          extra_course_numbers: maybe(() => repeat(faker.lorem.word)) ?? null,
        },
      }
    } else if (type === ResourceTypeEnum.Program) {
      return {
        platform: faker.lorem.word(),
        certification: faker.lorem.word(),
        offered_by: faker.lorem.word(),
      }
    } else if (type === ResourceTypeEnum.LearningPath) {
      return {
        learning_path: {
          id: faker.unique(faker.datatype.number),
          item_count: faker.datatype.number({ min: 1, max: 30 }),
          author: faker.datatype.number(),
        },
        learning_path_parents: [],
      }
    }
    return {}
  }

  return resource
}

const learningResources = makePaginatedFactory(learningResource)

const learningPath: Factory<LearningPathResource, Partial<LearningPath>> = (
  overrides = {},
  pathOverrides,
) => {
  const resource = learningResource({
    resource_type: ResourceTypeEnum.LearningPath,
    ...overrides,
  })
  invariant(resource.learning_path)
  resource.learning_path = { ...resource.learning_path, ...pathOverrides }
  return { ...resource, resources: [] }
}
const learningPaths = makePaginatedFactory(learningPath)

const microRelationship: Factory<MicroLearningPathRelationship> = (
  overrides = {},
) => {
  return {
    id: faker.unique(faker.datatype.number),
    child: faker.unique(faker.datatype.number),
    parent: faker.unique(faker.datatype.number),
    ...overrides,
  }
}

const learningPathRelationship: Factory<LearningPathRelationship> = (
  overrides = {},
) => {
  const micro = microRelationship()
  const resource = learningResource({
    id: micro.child,
    learning_path_parents: [micro],
  })
  return {
    ...micro,
    position: faker.datatype.number(),
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
}): PaginatedResult<LearningPathRelationship> => {
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
  }
}

export {
  learningResource as resource,
  learningResources as resources,
  learningResourceRun as run,
  learningResourceImage as image,
  learningResourceDepartment as department,
  learningResourceTopics as topics,
  learningPath,
  learningPaths,
  microRelationship,
  learningPathRelationship,
  learningPathRelationships,
}
