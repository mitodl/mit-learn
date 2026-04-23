import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  CourseRunEnrollmentV3,
  CourseRunGrade,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"
import * as courses from "../factories/courses"
import * as programs from "../factories/programs"

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

const courseEnrollment: PartialFactory<CourseRunEnrollmentV3> = (
  overrides = {},
) => {
  const title =
    overrides.run?.title ?? overrides.run?.course?.title ?? faker.word.words(3)

  const defaults: CourseRunEnrollmentV3 = {
    id: uniqueEnrollmentId.enforce(() => faker.number.int()),
    b2b_contract_id: null, // Default to personal enrollment (not B2B)
    b2b_organization_id: null, // Default to personal enrollment (not B2B)
    certificate: {
      uuid: faker.string.uuid(),
      link: faker.internet.url(),
    },
    grades: [],
    enrollment_mode: faker.helpers.arrayElement(["audit", "verified"]),
    edx_emails_subscription: faker.datatype.boolean(),
    run: {
      enrollment_modes: [courses.enrollmentMode()],
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
      upgrade_product_id: faker.number.int(),
      upgrade_product_price: faker.commerce.price(),
      upgrade_product_is_active: faker.datatype.boolean(),
      course: {
        id: uniqueCourseId.enforce(() => faker.number.int()),
        title,
        readable_id: faker.lorem.slug(),
        type: "course",
        include_in_learn_catalog: faker.datatype.boolean(),
      },
    },
  }
  return mergeOverrides<CourseRunEnrollmentV3>(defaults, overrides)
}

const programEnrollmentV3: PartialFactory<V3UserProgramEnrollment> = (
  overrides = {},
): V3UserProgramEnrollment => {
  const program = programs.simpleProgram()
  const hasCertificate = faker.datatype.boolean()
  const defaults: V3UserProgramEnrollment = {
    certificate: hasCertificate
      ? {
          uuid: faker.string.uuid(),
          link: `/certificate/program/${faker.string.uuid()}/`,
        }
      : null,
    enrollment_mode: faker.helpers.arrayElement([
      "audit",
      "verified",
      undefined,
    ]),
    program: program,
  }
  return mergeOverrides<V3UserProgramEnrollment>(defaults, overrides)
}

// Not paginated
const courseEnrollments = (count: number): CourseRunEnrollmentV3[] => {
  return new Array(count).fill(null).map(() => courseEnrollment())
}

export { courseEnrollment, courseEnrollments, grade, programEnrollmentV3 }
