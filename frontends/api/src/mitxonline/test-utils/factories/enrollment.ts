import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  CourseRunEnrollment,
  CourseRunGrade,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"

const uniqueEnrollmentId = new UniqueEnforcer()
const uniqueRunId = new UniqueEnforcer()
const uniqueCourseId = new UniqueEnforcer()

const grade: PartialFactory<CourseRunGrade> = (overrides = {}) => {
  const defaults: CourseRunGrade = {
    grade: faker.number.float({ min: 0, max: 1 }),
    // should be correlated with grade, but probably no harm for test data
    grade_percent: faker.number.int({ min: 0, max: 100 }),
    letter_grade: faker.helpers.arrayElement([
      null,
      faker.string.alpha({ length: 1, casing: "upper" }),
    ]),
    passed: faker.datatype.boolean(),
    set_by_admin: faker.datatype.boolean(),
  }
  return mergeOverrides<CourseRunGrade>(defaults, overrides)
}

const courseEnrollment: PartialFactory<CourseRunEnrollment> = (
  overrides = {},
) => {
  const title =
    overrides.run?.title ?? overrides.run?.course?.title ?? faker.word.words(3)

  const defaults: CourseRunEnrollment = {
    id: uniqueEnrollmentId.enforce(() => faker.number.int()),
    certificate: null,
    approved_flexible_price_exists: faker.datatype.boolean(),
    grades: [],
    enrollment_mode: faker.helpers.arrayElement(["audit", "verified"]),
    edx_emails_subscription: faker.datatype.boolean(),
    run: {
      id: uniqueRunId.enforce(() => faker.number.int()),
      title,
      start_date: faker.date.past().toISOString(),
      end_date: faker.date.future().toISOString(),
      upgrade_deadline: faker.date.future().toISOString(),
      is_upgradable: faker.datatype.boolean(),
      is_enrollable: faker.datatype.boolean(),
      is_archived: faker.datatype.boolean(),
      courseware_url: faker.internet.url(),
      courseware_id: faker.string.uuid(),
      run_tag: faker.lorem.word(),
      live: faker.datatype.boolean(),
      course_number: faker.lorem.word(),
      approved_flexible_price_exists: faker.datatype.boolean(),
      products: [
        {
          id: faker.number.int(),
          price: faker.commerce.price(),
          description: faker.lorem.sentence(),
          is_active: faker.datatype.boolean(),
          product_flexible_price: null,
        },
      ],
      course: {
        id: uniqueCourseId.enforce(() => faker.number.int()),
        title,
        readable_id: faker.lorem.slug(),
        next_run_id: faker.number.int(),
        departments: [
          {
            name: faker.company.name(),
          },
        ],
        page: {
          page_url: faker.internet.url(),
          feature_image_src: faker.image.url(),
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
      },
    },
  }
  return mergeOverrides<CourseRunEnrollment>(defaults, overrides)
}

// Not paginated
const courseEnrollments = (count: number): CourseRunEnrollment[] => {
  return new Array(count).fill(null).map(() => courseEnrollment())
}

export { courseEnrollment, courseEnrollments, grade }
