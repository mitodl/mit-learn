import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import moment from "moment"

describe("ProgramAsCourseCard", () => {
  setupLocationMock()

  const setupCardData = ({
    programId,
    includeProgramEnrollment,
    startDate,
    endDate,
  }: {
    programId: number
    includeProgramEnrollment: boolean
    startDate?: string | null
    endDate?: string | null
  }) => {
    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const modules = reqTree.addOperator({
      operator: "all_of",
      title: "Modules",
    })
    modules.addCourse({ course: 1 })
    modules.addCourse({ course: 2 })

    const program = mitxonline.factories.programs.program({
      id: programId,
      title: "Micro Program",
      courses: [1, 2],
      req_tree: reqTree.serialize(),
      start_date: startDate ?? null,
      end_date: endDate ?? null,
    })

    const moduleOne = mitxonline.factories.courses.course({
      id: 1,
      title: "Module One",
      courseruns: [mitxonline.factories.courses.courseRun()],
    })
    const moduleTwo = mitxonline.factories.courses.course({
      id: 2,
      title: "Module Two",
      courseruns: [mitxonline.factories.courses.courseRun()],
    })

    const moduleEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: {
        ...moduleOne.courseruns[0],
        course: moduleOne,
      },
      grades: [],
      certificate: null,
    })

    const programEnrollment = includeProgramEnrollment
      ? mitxonline.factories.enrollment.programEnrollmentV3({
          program: {
            id: program.id,
            title: program.title,
            live: program.live,
            program_type: program.program_type,
            readable_id: program.readable_id,
          },
        })
      : undefined

    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )

    return {
      courseProgram: program,
      moduleCourses: [moduleOne, moduleTwo],
      moduleEnrollmentsByCourseId: {
        [moduleOne.id]: [moduleEnrollment],
      },
      courseProgramEnrollment: programEnrollment,
    }
  }

  test("renders modules and progress summary", async () => {
    const cardData = setupCardData({
      programId: 301,
      includeProgramEnrollment: true,
    })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText("Micro Program")
    expect(screen.getByText("2 Modules (0 of 2 complete)")).toBeInTheDocument()
    expect(screen.getAllByText("Module One").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Module Two").length).toBeGreaterThan(0)
  })

  test("renders when user is not enrolled in the ProgramAsCourse", async () => {
    const cardData = setupCardData({
      programId: 302,
      includeProgramEnrollment: false,
    })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText("Micro Program")
    expect(
      screen.getByRole("status", { name: "Not Started" }),
    ).toBeInTheDocument()
  })

  test("shows date popover content when date summary is clicked", async () => {
    const cardData = setupCardData({
      programId: 303,
      includeProgramEnrollment: true,
      startDate: moment().subtract(5, "days").toISOString(),
      endDate: moment().add(5, "days").toISOString(),
    })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    const dateSummary = await screen.findByText(/until this course ends\./i)
    await user.click(dateSummary)

    expect(await screen.findByText("Important Dates:")).toBeInTheDocument()
  })
})
