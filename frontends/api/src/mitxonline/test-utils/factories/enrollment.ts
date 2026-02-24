import { faker } from "@faker-js/faker/locale/en"
import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  CourseRunEnrollment,
  CourseRunEnrollmentRequestV2,
  CourseRunGrade,
  UserProgramEnrollmentDetail,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { UniqueEnforcer } from "enforce-unique"
import { factories } from ".."

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

const courseEnrollment: PartialFactory<CourseRunEnrollmentRequestV2> = (
  overrides = {},
) => {
  const title =
    overrides.run?.title ?? overrides.run?.course?.title ?? faker.word.words(3)

  const defaults: CourseRunEnrollmentRequestV2 = {
    id: uniqueEnrollmentId.enforce(() => faker.number.int()),
    b2b_contract_id: null, // Default to personal enrollment (not B2B)
    b2b_organization_id: null, // Default to personal enrollment (not B2B)
    certificate: {
      uuid: faker.string.uuid(),
      link: faker.internet.url(),
    },
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
        topics: faker.helpers.multiple(
          () => ({ name: faker.lorem.word(), id: faker.number.int() }),
          { count: { min: 0, max: 5 } },
        ),
        certificate_type: faker.helpers.arrayElement([
          "completion",
          "verified",
          "professional",
          "micromasters",
        ]),
        required_prerequisites: faker.datatype.boolean(),
        duration: `${faker.number.int({ min: 4, max: 16 })} weeks`,
        min_weeks: faker.number.int({ min: 4, max: 8 }),
        max_weeks: faker.number.int({ min: 12, max: 20 }),
        min_price: faker.number.int({ min: 0, max: 500 }),
        max_price: faker.number.int({ min: 500, max: 2000 }),
        time_commitment: `${faker.number.int({ min: 2, max: 15 })} hours per week`,
        availability: faker.helpers.arrayElement([
          "current",
          "starting_soon",
          "upcoming",
          "archived",
        ]),
        min_weekly_hours: faker.number.int({ min: 2, max: 5 }).toString(),
        max_weekly_hours: faker.number.int({ min: 8, max: 15 }).toString(),
        include_in_learn_catalog: faker.datatype.boolean({ probability: 0.8 }),
        ingest_content_files_for_ai: faker.datatype.boolean({
          probability: 0.3,
        }),
      },
    },
  }
  return mergeOverrides<CourseRunEnrollmentRequestV2>(defaults, overrides)
}

// Type-safe conversion from V2 to V1 enrollment for compatibility
const convertV2ToV1Enrollment = (
  v2Enrollment: CourseRunEnrollmentRequestV2,
): CourseRunEnrollment => {
  // Remove V2-specific fields and return V1 compatible object
  const {
    b2b_contract_id: b2bContractId,
    b2b_organization_id: b2bOrganizationId,
    ...v1Compatible
  } = v2Enrollment
  return v1Compatible as CourseRunEnrollment
}

const programEnrollment: PartialFactory<UserProgramEnrollmentDetail> = (
  overrides = {},
): UserProgramEnrollmentDetail => {
  const defaults: UserProgramEnrollmentDetail = {
    certificate: faker.datatype.boolean()
      ? {
          uuid: faker.string.uuid(),
          link: faker.internet.url(),
        }
      : null,
    program: {
      id: faker.number.int(),
      title: faker.lorem.words(3),
      readable_id: faker.lorem.slug(),
      courses: factories.courses.v1Course(),
      requirements: {
        required: [faker.number.int()],
        electives: [faker.number.int()],
      },
      req_tree: [],
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
    },
    enrollments: [convertV2ToV1Enrollment(courseEnrollment())],
  }
  return mergeOverrides<UserProgramEnrollmentDetail>(defaults, overrides)
}

const programEnrollmentV3: PartialFactory<V3UserProgramEnrollment> = (
  overrides = {},
): V3UserProgramEnrollment => {
  const program = factories.programs.simpleProgram()
  const hasCertificate = faker.datatype.boolean()
  const defaults: V3UserProgramEnrollment = {
    certificate: hasCertificate
      ? {
          uuid: faker.string.uuid(),
          link: `/certificate/program/${faker.string.uuid()}/`,
        }
      : null,
    enrollment_mode: faker.helpers.arrayElement(["audit", "verified", null]),
    program: program,
  }
  return mergeOverrides<V3UserProgramEnrollment>(defaults, overrides)
}

// Not paginated
const courseEnrollments = (count: number): CourseRunEnrollmentRequestV2[] => {
  return new Array(count).fill(null).map(() => courseEnrollment())
}

export {
  courseEnrollment,
  courseEnrollments,
  grade,
  programEnrollment,
  programEnrollmentV3,
}
