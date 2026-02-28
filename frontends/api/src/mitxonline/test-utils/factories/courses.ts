import { mergeOverrides, makePaginatedFactory } from "ol-test-utilities"
import type { Factory, PartialFactory } from "ol-test-utilities"
import type {
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V1CourseWithCourseRuns,
  ProductFlexibilePrice,
  EnrollmentMode,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"
import { has } from "lodash"

const uniqueCourseId = new UniqueEnforcer()
const uniqueCourseRunId = new UniqueEnforcer()

const enrollmentMode: Factory<EnrollmentMode> = (overrides = {}) => {
  return {
    mode_slug: faker.lorem.slug(),
    mode_display_name: faker.lorem.words(2),
    requires_payment: faker.datatype.boolean(),
    ...overrides,
  }
}

const v1Course: PartialFactory<V1CourseWithCourseRuns> = (overrides = {}) => {
  const defaults: V1CourseWithCourseRuns = {
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
      feature_image_src: faker.image.url(),
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
    courseruns: [
      {
        id: uniqueCourseRunId.enforce(() => faker.number.int()),
        title: faker.lorem.words(3),
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        enrollment_start: faker.date.past().toISOString(),
        enrollment_end: faker.date.future().toISOString(),
        expiration_date: faker.date.future().toISOString(),
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
        enrollment_modes: Array.from({
          length: faker.number.int({ min: 1, max: 3 }),
        }).map(() => enrollmentMode()),
        approved_flexible_price_exists: faker.datatype.boolean(),
      },
    ],
  }

  return mergeOverrides<V1CourseWithCourseRuns>(defaults, overrides)
}

const product: Factory<ProductFlexibilePrice> = (overrides = {}) => {
  const defaults: ProductFlexibilePrice = {
    id: faker.number.int(),
    price: faker.commerce.price(),
    description: faker.lorem.sentence(),
    is_active: faker.datatype.boolean(),
    product_flexible_price: null,
  }
  return { ...defaults, ...overrides }
}

const courseRun: PartialFactory<CourseRunV2> = (overrides = {}) => {
  const defaults: CourseRunV2 = {
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
    products: [product()],
    approved_flexible_price_exists: faker.datatype.boolean(),
    enrollment_modes: Array.from({
      length: faker.number.int({ min: 1, max: 3 }),
    }).map(() => enrollmentMode()),
  }

  return mergeOverrides<CourseRunV2>(defaults, overrides)
}

const course: PartialFactory<CourseWithCourseRunsSerializerV2> = (
  overrides = {},
) => {
  const runs =
    overrides.courseruns ??
    Array.from({ length: faker.number.int({ min: 1, max: 3 }) }).map(() =>
      courseRun(),
    )
  const nextRunId = has(overrides, "next_run_id")
    ? (overrides.next_run_id ?? null)
    : runs.length > 0
      ? faker.helpers.arrayElement(runs).id
      : null
  const defaults: CourseWithCourseRunsSerializerV2 = {
    id: uniqueCourseId.enforce(() => faker.number.int()),
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    next_run_id: nextRunId,
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
      // financial aid is somewhat unusual; default to no financial aid unless overridden
      financial_assistance_form_url: "",
      current_price: faker.number.int({ min: 0, max: 1000 }),
      instructors: Array.from({
        length: faker.number.int({ min: 1, max: 3 }),
      }).map(() => ({
        name: faker.person.fullName(),
        bio: faker.lorem.paragraph(),
      })),
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
    courseruns: runs,
    min_price: faker.number.int({ min: 0, max: 1000 }),
    max_price: faker.number.int({ min: 1000, max: 2000 }),
    include_in_learn_catalog: faker.datatype.boolean(),
    ingest_content_files_for_ai: faker.datatype.boolean(),
  }

  return mergeOverrides<CourseWithCourseRunsSerializerV2>(defaults, overrides)
}

const v1Courses = makePaginatedFactory(v1Course)
const courses = makePaginatedFactory(course)

export {
  v1Course,
  v1Courses,
  course,
  courses,
  courseRun,
  product,
  enrollmentMode,
}
