import { mergeOverrides, makePaginatedFactory } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  V2Program,
  V2ProgramCollection,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"

const uniqueProgramId = new UniqueEnforcer()

const program: PartialFactory<V2Program> = (overrides = {}) => {
  const defaults: V2Program = {
    id: uniqueProgramId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    page: {
      feature_image_src: faker.image.url(),
      page_url: faker.internet.url(),
      financial_assistance_form_url: faker.internet.url(),
      description: faker.lorem.paragraph(),
      live: faker.datatype.boolean(),
      length: `${faker.number.int({ min: 1, max: 12 })} weeks`,
      effort: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
      price: faker.commerce.price(),
    },
    program_type: faker.helpers.arrayElement([
      "certificate",
      "degree",
      "diploma",
    ]),
    departments: [
      {
        name: faker.company.name(),
      },
    ],
    live: faker.datatype.boolean(),
    courses: [],
    collections: [],
    req_tree: [],
    requirements: {
      courses: {
        required: [faker.number.int()],
        electives: [faker.number.int()],
      },
      programs: {
        required: [faker.number.int()],
        electives: [faker.number.int()],
      },
    },
    certificate_type: faker.lorem.word(),
    topics: [
      {
        name: faker.lorem.word(),
      },
    ],
    required_prerequisites: faker.datatype.boolean(),
    duration: `${faker.number.int({ min: 1, max: 12 })} weeks`,
    min_weeks: faker.number.int({ min: 1, max: 4 }),
    max_weeks: faker.number.int({ min: 5, max: 12 }),
    time_commitment: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
    availability: faker.helpers.arrayElement(["anytime", "dated"]),
    min_weekly_hours: `${faker.number.int({ min: 1, max: 5 })} hours`,
    max_weekly_hours: `${faker.number.int({ min: 6, max: 10 })} hours`,
    start_date: faker.date.past().toISOString(),
  }

  return mergeOverrides<V2Program>(defaults, overrides)
}

const programs = makePaginatedFactory(program)

const programCollection: PartialFactory<V2ProgramCollection> = (
  overrides = {},
) => {
  const defaults: V2ProgramCollection = {
    id: uniqueProgramId.enforce(() => faker.number.int()),
    description: faker.lorem.paragraph(),
    programs: programs({ count: 2 }).results.map((p) => p.id),
    title: faker.lorem.words(3),
    created_on: faker.date.past().toISOString(),
    updated_on: faker.date.recent().toISOString(),
  }

  return mergeOverrides<V2ProgramCollection>(defaults, overrides)
}

export { program, programs, programCollection }
