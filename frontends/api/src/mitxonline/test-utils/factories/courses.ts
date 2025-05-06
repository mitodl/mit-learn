import { mergeOverrides, makePaginatedFactory } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type { CourseWithCourseRuns } from "@mitodl/mitxonline-api-axios/v0"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"

const uniqueCourseId = new UniqueEnforcer()
const uniqueCourseRunId = new UniqueEnforcer()

const course: PartialFactory<CourseWithCourseRuns> = (overrides = {}) => {
  const defaults: CourseWithCourseRuns = {
    id: uniqueCourseId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    next_run_id: faker.number.int(),
    departments: [
      {
        name: faker.company.name(),
      },
    ],
    page: {
      feature_image_src: faker.image.avatar(),
      page_url: faker.internet.url(),
      description: faker.lorem.paragraph(),
      live: faker.datatype.boolean(),
      length: `${faker.number.int({ min: 1, max: 12 })} weeks`,
      effort: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
      financial_assistance_form_url: faker.internet.url(),
      current_price: faker.number.int({ min: 0, max: 1000 }),
      instructors: [
        {
          name: faker.person.fullName(),
          bio: faker.lorem.paragraph(),
        },
      ],
    },
    programs: null,
    topics: [
      {
        name: faker.lorem.word(),
      },
    ],
    certificate_type: faker.lorem.word(),
    required_prerequisites: faker.datatype.boolean(),
    duration: `${faker.number.int({ min: 1, max: 12 })} weeks`,
    min_weeks: faker.number.int({ min: 1, max: 4 }),
    max_weeks: faker.number.int({ min: 5, max: 12 }),
    time_commitment: `${faker.number.int({ min: 1, max: 10 })} hours/week`,
    availability: faker.helpers.arrayElement(["anytime", "dated"]),
    min_weekly_hours: `${faker.number.int({ min: 1, max: 5 })} hours`,
    max_weekly_hours: `${faker.number.int({ min: 6, max: 10 })} hours`,
    courseruns: [
      {
        id: uniqueCourseRunId.enforce(() => faker.number.int()),
        title: faker.lorem.words(3),
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        enrollment_start: faker.date.past().toISOString(),
        enrollment_end: faker.date.future().toISOString(),
        courseware_url: faker.internet.url(),
        courseware_id: faker.string.uuid(),
        certificate_available_date: faker.date.future().toISOString(),
        upgrade_deadline: faker.date.future().toISOString(),
        is_upgradable: faker.datatype.boolean(),
        is_enrollable: faker.datatype.boolean(),
        is_archived: faker.datatype.boolean(),
        is_self_paced: faker.datatype.boolean(),
        run_tag: faker.lorem.word(),
        live: faker.datatype.boolean(),
        course_number: faker.lorem.word(),
        products: [
          {
            id: faker.number.int(),
            price: faker.commerce.price(),
            description: faker.lorem.sentence(),
            is_active: faker.datatype.boolean(),
            product_flexible_price: null,
          },
        ],
        approved_flexible_price_exists: faker.datatype.boolean(),
      },
    ],
  }

  return mergeOverrides<CourseWithCourseRuns>(defaults, overrides)
}

const courses = makePaginatedFactory(course)

export { course, courses }
