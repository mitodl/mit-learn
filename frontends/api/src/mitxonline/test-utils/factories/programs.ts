import { mergeOverrides, makePaginatedFactory } from "ol-test-utilities"
import type { Factory, PartialFactory } from "ol-test-utilities"
import type {
  BaseProgram,
  V2Program,
  V2ProgramCollection,
  V3SimpleProgram,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"
import { enrollmentMode } from "./courses"

const uniqueProgramId = new UniqueEnforcer()

const baseProgram: Factory<BaseProgram> = (overrides = {}) => {
  const defaults: BaseProgram = {
    enrollment_modes: [enrollmentMode()],
    title: faker.lorem.words(3),
    id: uniqueProgramId.enforce(() => faker.number.int()),
    readable_id: faker.lorem.slug(),
    type: faker.lorem.words(),
  }
  return {
    ...defaults,
    ...overrides,
  }
}

const program: PartialFactory<V2Program> = (overrides = {}) => {
  const defaults: V2Program = {
    id: uniqueProgramId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    page: {
      feature_image_src: faker.image.url(),
      page_url: faker.internet.url(),
      // financial aid is somewhat unusual; default to no financial aid unless overridden
      financial_assistance_form_url: "",
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
        required: [{ id: faker.number.int(), readable_id: faker.lorem.slug() }],
        electives: [
          { id: faker.number.int(), readable_id: faker.lorem.slug() },
        ],
      },
      programs: {
        required: [{ id: faker.number.int(), readable_id: faker.lorem.slug() }],
        electives: [
          { id: faker.number.int(), readable_id: faker.lorem.slug() },
        ],
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
    max_price: faker.number.int({ min: 50, max: 5000 }),
    min_price: faker.number.int({ min: 50, max: 5000 }),
    enrollment_start: faker.helpers.maybe(() =>
      faker.date.past().toISOString(),
    ),
    enrollment_end: faker.helpers.maybe(() =>
      faker.date.future().toISOString(),
    ),
    end_date: faker.helpers.maybe(() => faker.date.future().toISOString()),
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
    programs: programs({ count: 2 }).results.map((p, i) => {
      return {
        id: p.id,
        title: p.title,
        order: i + 1,
      }
    }),
    title: faker.lorem.words(3),
    created_on: faker.date.past().toISOString(),
    updated_on: faker.date.recent().toISOString(),
  }

  return mergeOverrides<V2ProgramCollection>(defaults, overrides)
}

const simpleProgram: PartialFactory<V3SimpleProgram> = (overrides = {}) => {
  const defaults: V3SimpleProgram = {
    id: uniqueProgramId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    program_type: faker.helpers.arrayElement([
      "certificate",
      "degree",
      "diploma",
    ]),
    live: faker.datatype.boolean(),
  }

  return mergeOverrides<V3SimpleProgram>(defaults, overrides)
}

export { baseProgram, program, programs, programCollection, simpleProgram }
