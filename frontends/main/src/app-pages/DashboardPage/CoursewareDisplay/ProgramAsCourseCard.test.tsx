import React from "react"
import moment from "moment"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import { V2ProgramRequirement } from "@mitodl/mitxonline-api-axios/v2"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
type DashboardCourse = ReturnType<typeof mitxonline.factories.courses.course>
type CourseEnrollment = ReturnType<
  typeof mitxonline.factories.enrollment.courseEnrollment
>

describe("ProgramAsCourseCard", () => {
  setupLocationMock()

  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
  })

  const renderCard = async ({
    programId = 101,
    startDate,
    endDate,
    programCourses = [],
    reqTree = [],
    courseResults = [],
    rawEnrollments = [],
  }: {
    programId?: number
    startDate?: string | null
    endDate?: string | null
    programCourses?: number[]
    reqTree?: V2ProgramRequirement[]
    courseResults?: DashboardCourse[]
    rawEnrollments?: CourseEnrollment[]
  }) => {
    const program = mitxonline.factories.programs.program({
      id: programId,
      title: "Date Logic Program",
      courses: programCourses,
      req_tree: reqTree,
      start_date: startDate ?? null,
      end_date: endDate ?? null,
    })

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        certificate: null,
        program: {
          id: program.id,
          title: program.title,
          live: program.live,
          program_type: program.program_type,
          readable_id: program.readable_id,
        },
      })

    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    if (rawEnrollments.length > 0) {
      setMockResponse.get(
        mitxonline.urls.enrollment.enrollmentsListV3(),
        rawEnrollments,
      )
    }
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programDetail(programId),
      program,
    )
    if (programCourses.length > 0) {
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({ id: programCourses }),
        {
          count: courseResults.length,
          next: null,
          previous: null,
          results: courseResults,
        },
      )
    }

    renderWithProviders(<ProgramAsCourseCard programId={programId} />)

    await screen.findByText("Date Logic Program")
  }

  describe("core UI", () => {
    test("renders title, progress, module count, and only modules from first requirement section", async () => {
      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const coreCourses = reqTree.addOperator({
        operator: "all_of",
        title: "Core Courses",
      })
      coreCourses.addCourse({ course: 1 })
      coreCourses.addCourse({ course: 2 })
      const electiveCourses = reqTree.addOperator({
        operator: "all_of",
        title: "Electives",
      })
      electiveCourses.addCourse({ course: 3 })

      const courseOne = mitxonline.factories.courses.course({
        id: 1,
        title: "Module One",
        courseruns: [mitxonline.factories.courses.courseRun()],
      })
      const courseTwo = mitxonline.factories.courses.course({
        id: 2,
        title: "Module Two",
        courseruns: [mitxonline.factories.courses.courseRun()],
      })
      const courseThree = mitxonline.factories.courses.course({
        id: 3,
        title: "Module Three",
        courseruns: [mitxonline.factories.courses.courseRun()],
      })

      const enrolledRun = mitxonline.factories.courses.courseRun({
        id: 111,
        start_date: moment().subtract(5, "days").toISOString(),
        end_date: moment().add(5, "days").toISOString(),
      })
      const enrolledCourseOne = {
        ...courseOne,
        courseruns: [enrolledRun],
      }
      const rawEnrollment = mitxonline.factories.enrollment.courseEnrollment({
        grades: [],
        certificate: null,
        run: {
          ...enrolledRun,
          course: enrolledCourseOne,
        },
      })

      await renderCard({
        startDate: moment().subtract(10, "days").toISOString(),
        endDate: moment().add(20, "days").toISOString(),
        programCourses: [1, 2, 3],
        reqTree: reqTree.serialize(),
        courseResults: [enrolledCourseOne, courseTwo, courseThree],
        rawEnrollments: [rawEnrollment],
      })

      expect(screen.getByText("Date Logic Program")).toBeInTheDocument()
      expect(screen.getByText("In Progress")).toBeInTheDocument()
      expect(
        screen.getByText("2 Modules (0 of 2 complete)"),
      ).toBeInTheDocument()
      expect(screen.getAllByText("Module One").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Module Two").length).toBeGreaterThan(0)
      expect(screen.queryByText("Module Three")).not.toBeInTheDocument()
    })

    test("shows zero-module summary when no modules are available", async () => {
      await renderCard({
        startDate: null,
        endDate: null,
        programCourses: [],
        reqTree: [],
      })

      expect(
        screen.getByText("0 Modules (0 of 0 complete)"),
      ).toBeInTheDocument()
      expect(screen.getByText("Not Started")).toBeInTheDocument()
    })
  })

  describe("date popover", () => {
    test("does not render date link when there are no dates", async () => {
      await renderCard({ startDate: null, endDate: null })

      expect(
        screen.queryByText(
          /until this course starts\.|until this course ends\.|this course started|this course ended/i,
        ),
      ).not.toBeInTheDocument()
    })

    test("does not render date link when there is an end date but no start date", async () => {
      await renderCard({
        startDate: null,
        endDate: moment().add(10, "days").toISOString(),
      })

      expect(
        screen.queryByText(
          /until this course starts\.|until this course ends\.|this course started|this course ended/i,
        ),
      ).not.toBeInTheDocument()
    })

    test("shows 'until this course starts' and hides end section when only start date exists in the future", async () => {
      await renderCard({
        startDate: moment().add(7, "days").toISOString(),
        endDate: null,
      })

      const linkLabel = await screen.findByText(
        /\d+ days? until this course starts\./i,
      )
      await user.click(linkLabel)

      expect(screen.getByText(/in \d+ days on/i)).toBeInTheDocument()
      expect(screen.queryByText(/This course ends/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/This course ended/i)).not.toBeInTheDocument()
    })

    test("shows 'until this course ends' when course is in progress", async () => {
      await renderCard({
        startDate: moment().subtract(5, "days").toISOString(),
        endDate: moment().add(5, "days").toISOString(),
      })

      expect(
        await screen.findByText(/\d+ days? until this course ends\./i),
      ).toBeInTheDocument()
    })

    test("shows 'this course ended x days ago' when course has ended", async () => {
      await renderCard({
        startDate: moment().subtract(20, "days").toISOString(),
        endDate: moment().subtract(3, "days").toISOString(),
      })

      expect(
        await screen.findByText(/this course ended \d+ days? ago\./i),
      ).toBeInTheDocument()
    })
  })
})
