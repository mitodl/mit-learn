import { factories, factories as mitx } from "api/mitxonline-test-utils"
import { DashboardResourceType, EnrollmentStatus } from "./types"
import type { DashboardResource } from "./types"
import {
  organizationCoursesWithContracts,
  mitxonlineProgram,
  sortDashboardCourses,
  userEnrollmentsToDashboardCourses,
  createOrgUnenrolledCourse,
} from "./transform"
import {
  createCoursesWithContractRuns,
  createTestContracts,
  setupProgramsAndCourses,
  createEnrollmentsForContractRuns,
} from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"

describe("Certificate handling", () => {
  describe("userEnrollmentsToDashboardCourses", () => {
    test("includes certificate with transformed link", () => {
      const enrollmentWithCert = mitx.enrollment.courseEnrollment({
        certificate: {
          uuid: "test-uuid-123",
          link: "/certificate/abc123/",
        },
      })

      const transformed = userEnrollmentsToDashboardCourses([
        enrollmentWithCert,
      ])

      expect(transformed[0].run.certificate).toEqual({
        uuid: "test-uuid-123",
        link: "/certificate/course/abc123/",
      })
      expect(transformed[0].enrollment?.certificate).toBeUndefined() // Certificate should only be in run
    })

    test("handles missing certificate gracefully", () => {
      const enrollmentWithoutCert = mitx.enrollment.courseEnrollment({
        certificate: null,
      })

      const transformed = userEnrollmentsToDashboardCourses([
        enrollmentWithoutCert,
      ])

      expect(transformed[0].run.certificate).toEqual({
        uuid: "",
        link: "",
      })
    })

    test("transforms certificate link format correctly", () => {
      const testCases = [
        {
          input: "/certificate/abc123/",
          expected: "/certificate/course/abc123/",
        },
        {
          input: "/certificate/xyz789/",
          expected: "/certificate/course/xyz789/",
        },
        {
          input: "https://example.com/certificate/def456/",
          expected: "https://example.com/certificate/course/def456/",
        },
        {
          input: "/some/other/path",
          expected: "/some/other/path", // No change if pattern doesn't match
        },
      ]

      testCases.forEach(({ input, expected }) => {
        const apiData = mitx.enrollment.courseEnrollment({
          certificate: {
            uuid: "test-uuid",
            link: input,
          },
        })

        const transformed = userEnrollmentsToDashboardCourses([apiData])

        expect(transformed[0].run.certificate?.link).toBe(expected)
      })
    })

    test("certificate link transformation handles various URL formats", () => {
      const testCases = [
        {
          input: "/certificate/abc123/",
          expected: "/certificate/course/abc123/",
          description: "standard format",
        },
        {
          input: "/certificate/xyz789/",
          expected: "/certificate/course/xyz789/",
          description: "different certificate ID",
        },
        {
          input: "/some/other/path",
          expected: "/some/other/path",
          description: "non-matching format should remain unchanged",
        },
        {
          input: "",
          expected: "",
          description: "empty string",
        },
      ]

      testCases.forEach(({ input, expected }) => {
        const enrollment = mitx.enrollment.courseEnrollment({
          certificate: {
            uuid: "test-uuid",
            link: input,
          },
        })

        const transformed = userEnrollmentsToDashboardCourses([enrollment])
        expect(transformed[0].run.certificate?.link).toBe(expected)
      })
    })
  })

  describe("organizationCoursesWithContracts", () => {
    test("includes certificate data from org enrollment", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)

      // Create enrollments manually with certificate data
      const enrollments = courses.flatMap((course) =>
        course.courseruns
          .filter(
            (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
          )
          .map((run) =>
            factories.enrollment.courseEnrollment({
              run: {
                id: run.id,
                course: {
                  id: course.id,
                  title: course.title,
                },
                title: run.title,
              },
              certificate: {
                uuid: "org-cert-uuid",
                link: "/certificate/org123/",
              },
            }),
          ),
      )

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments,
      })

      const courseWithEnrollment = transformedCourses.find(
        (course) => course.enrollment,
      )
      expect(courseWithEnrollment?.enrollment?.certificate).toEqual({
        uuid: "org-cert-uuid",
        link: "/certificate/course/org123/",
      })
      expect(courseWithEnrollment?.run.certificate).toEqual({
        uuid: "org-cert-uuid",
        link: "/certificate/course/org123/",
      })
    })

    test("organizationCoursesWithContracts handles enrollment without certificate", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)

      // Create enrollments manually without certificate data
      const enrollments = courses.flatMap((course) =>
        course.courseruns
          .filter(
            (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
          )
          .map((run) =>
            factories.enrollment.courseEnrollment({
              run: {
                id: run.id,
                course: {
                  id: course.id,
                  title: course.title,
                },
                title: run.title,
              },
              certificate: null,
            }),
          ),
      )

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments,
      })

      const courseWithEnrollment = transformedCourses.find(
        (course) => course.enrollment,
      )
      expect(courseWithEnrollment?.enrollment?.certificate).toEqual({
        uuid: "",
        link: "",
      })
      expect(courseWithEnrollment?.run.certificate).toEqual({
        uuid: "",
        link: "",
      })
    })
  })

  describe("Transforming mitxonline enrollment data to DashboardResource - Original Tests", () => {
    test.each([
      {
        grades: [mitx.enrollment.grade({ passed: true })],
        enrollmentStatus: EnrollmentStatus.Completed,
      },
      {
        grades: [mitx.enrollment.grade({ passed: false })],
        enrollmentStatus: EnrollmentStatus.Enrolled,
      },
      { grades: [], enrollmentStatus: EnrollmentStatus.Enrolled },
    ])(
      "Property renames and EnrollmentStatus",
      ({ grades, enrollmentStatus }) => {
        const apiData = mitx.enrollment.courseEnrollment({
          grades,
        })
        const transformed = userEnrollmentsToDashboardCourses([apiData])
        expect(transformed).toHaveLength(1)
        expect(transformed[0]).toEqual({
          key: `mitxonline-course-${apiData.run.course.id}-${apiData.run.id}`,
          coursewareId: apiData.run.courseware_id ?? null,
          type: DashboardResourceType.Course,
          title: apiData.run.title,
          marketingUrl: apiData.run.course.page?.page_url,
          run: {
            startDate: apiData.run.start_date,
            endDate: apiData.run.end_date,
            coursewareUrl: apiData.run.courseware_url,
            certificateUpgradeDeadline: apiData.run.upgrade_deadline,
            certificateUpgradePrice: apiData.run.products[0]?.price,
            canUpgrade: expect.any(Boolean), // check this in a moment
            certificate: {
              uuid: apiData.certificate?.uuid ?? "",
              link: apiData.certificate?.link ?? "",
            },
          },
          enrollment: {
            id: apiData.id,
            status: enrollmentStatus,
            mode: apiData.enrollment_mode,
            receiveEmails: apiData.edx_emails_subscription,
          },
        } satisfies DashboardResource)
      },
    )

    test("CertificateUpgradePrice is first price in prices array", () => {
      // Unclear why the mitxonline API has this as an array.
      const apiData = mitx.enrollment.courseEnrollment({
        // @ts-expect-error not fully implementing product objects
        run: { products: [{ price: "10" }, { price: "20" }] },
      })
      const transformed = userEnrollmentsToDashboardCourses([apiData])
      expect(transformed).toHaveLength(1)
      expect(transformed[0].run.certificateUpgradePrice).toEqual("10")
    })

    test("sortDashboardCourses sorts courses by enrollment status and program order", () => {
      const { programA, coursesA } = setupProgramsAndCourses()

      const enrollments = [
        mitx.enrollment.courseEnrollment({
          run: {
            id: coursesA[0].courseruns[0].id,
            course: { id: coursesA[0].id },
          },
          grades: [mitx.enrollment.grade({ passed: true })],
          enrollment_mode: "audit",
        }),
        mitx.enrollment.courseEnrollment({
          run: {
            id: coursesA[1].courseruns[0].id,
            course: { id: coursesA[1].id },
          },
          grades: [],
          enrollment_mode: "verified",
        }),
      ]

      const transformedCourses = organizationCoursesWithContracts({
        courses: coursesA,
        enrollments,
      })
      const sortedCourses = sortDashboardCourses(
        mitxonlineProgram(programA),
        transformedCourses,
      )

      const enrolledCourse = sortedCourses.find(
        (course) => course.enrollment?.status === EnrollmentStatus.Enrolled,
      )
      const completedCourse = sortedCourses.find(
        (course) => course.enrollment?.status === EnrollmentStatus.Completed,
      )
      const notEnrolledCourses = sortedCourses.filter(
        (course) =>
          !course.enrollment ||
          course.enrollment.status === EnrollmentStatus.NotEnrolled,
      )

      // Verify we found all expected courses
      expect(enrolledCourse).toBeDefined()
      expect(completedCourse).toBeDefined()
      expect(notEnrolledCourses).toHaveLength(2)

      // Verify sorting: enrolled first, then completed, then not enrolled
      expect(sortedCourses[0]).toEqual(enrolledCourse) // Enrolled course should be first
      expect(sortedCourses[1]).toEqual(completedCourse) // Completed course should be second
      expect(sortedCourses[2]).toEqual(notEnrolledCourses[0]) // First not enrolled course
      expect(sortedCourses[3]).toEqual(notEnrolledCourses[1]) // Second not enrolled course
    })

    test("selects course runs associated with organization's contract", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 2)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments: [],
      })

      // Should have transformed all courses
      expect(transformedCourses).toHaveLength(3)

      transformedCourses.forEach((transformedCourse, index) => {
        const originalCourse = courses[index]

        // Should use the course run with matching contract
        const expectedRun = originalCourse.courseruns.find(
          (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
        )

        expect(transformedCourse.run.startDate).toBe(expectedRun?.start_date)
        expect(transformedCourse.run.endDate).toBe(expectedRun?.end_date)
        expect(transformedCourse.coursewareId).toBe(
          expectedRun?.courseware_id ?? null,
        )
      })
    })

    test("falls back to unenrolled course when no contract-matching runs exist", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)

      // Create courses where runs don't match the contract
      const courses = factories.courses
        .courses({ count: 2 })
        .results.map((course) => ({
          ...course,
          courseruns: course.courseruns.map((run) => ({
            ...run,
            b2b_contract: faker.number.int(), // Different contract ID
          })),
        }))

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments: [],
      })

      transformedCourses.forEach((transformedCourse) => {
        // Should not have enrollment since no matching contract runs
        expect(transformedCourse.enrollment).toBeUndefined()

        // Should still have course data but with contract-scoped run or null
        expect(transformedCourse.title).toBeDefined()
        expect(transformedCourse.type).toBe("course")
      })
    })

    test("includes enrollments only for contract-scoped runs", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)
      const enrollments = createEnrollmentsForContractRuns(courses, contractIds)

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments,
      })

      // Should have enrollments for courses with contract-matching runs
      const enrolledCourses = transformedCourses.filter(
        (course) => course.enrollment,
      )
      expect(enrolledCourses.length).toBeGreaterThan(0)

      enrolledCourses.forEach((course) => {
        expect(course.enrollment).toBeDefined()
        expect(course.enrollment?.status).toMatch(/enrolled|completed/)
      })
    })

    test("filters out enrollments for non-contract runs", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)

      // Create enrollments for both contract and non-contract runs
      const contractEnrollments = createEnrollmentsForContractRuns(
        courses,
        contractIds,
      )
      const nonContractEnrollments = courses.flatMap((course) =>
        course.courseruns
          .filter(
            (run) =>
              !run.b2b_contract || !contractIds.includes(run.b2b_contract),
          )
          .map((run) =>
            factories.enrollment.courseEnrollment({
              run: {
                id: run.id,
                course: { id: course.id, title: course.title },
                title: run.title,
              },
            }),
          ),
      )

      const allEnrollments = [...contractEnrollments, ...nonContractEnrollments]

      const transformedCourses = organizationCoursesWithContracts({
        courses,
        contracts,
        enrollments: allEnrollments,
      })

      // Should only include enrollments for contract runs
      const enrolledCourses = transformedCourses.filter(
        (course) => course.enrollment,
      )

      enrolledCourses.forEach((course) => {
        // Verify the enrollment corresponds to a contract run
        const originalCourse = courses.find(
          (c) => c.id.toString() === course.key.split("-")[2],
        )
        const contractRun = originalCourse?.courseruns.find(
          (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
        )
        expect(contractRun).toBeDefined()
      })
    })

    test("selects run associated with contract for unenrolled courses", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)
      const contractIds = contracts.map((c) => c.id)
      const courses = createCoursesWithContractRuns(contracts)

      courses.forEach((course) => {
        const transformedCourse = createOrgUnenrolledCourse(course, contracts)

        // Should select the run with matching contract
        const expectedRun = course.courseruns.find(
          (run) => run.b2b_contract && contractIds.includes(run.b2b_contract),
        )

        expect(transformedCourse.run.startDate).toBe(expectedRun?.start_date)
        expect(transformedCourse.coursewareId).toBe(
          expectedRun?.courseware_id ?? null,
        )
      })
    })

    test("handles courses with no contract-matching runs gracefully", () => {
      const orgId = faker.number.int()
      const contracts = createTestContracts(orgId, 1)

      const course = factories.courses.course({
        courseruns: [
          {
            ...factories.courses.course().courseruns[0],
            b2b_contract: faker.number.int(), // Different contract
          },
        ],
      })

      const transformedCourse = createOrgUnenrolledCourse(course, contracts)

      // Should still return a valid course object
      expect(transformedCourse.title).toBe(course.title)
      expect(transformedCourse.type).toBe("course")

      // Run data should be null/empty since no matching contract run found
      expect(transformedCourse.run.startDate).toBeUndefined()
      expect(transformedCourse.run.endDate).toBeUndefined()
      expect(transformedCourse.run.coursewareUrl).toBeUndefined()
      expect(transformedCourse.coursewareId).toBeNull()
      expect(transformedCourse.run.canUpgrade).toBe(false) // !!undefined is false
    })
  })
})
