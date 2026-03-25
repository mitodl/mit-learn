import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import { mockAxiosInstance } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import { waitFor } from "@testing-library/react"
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
    expect(screen.getByText("Not Started")).toBeInTheDocument()
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

  test("renders module rows in req_tree order, not API result order", async () => {
    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const modules = reqTree.addOperator({
      operator: "all_of",
      title: "Modules",
    })
    modules.addCourse({ course: 2 })
    modules.addCourse({ course: 1 })

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

    const courseProgram = mitxonline.factories.programs.program({
      id: 304,
      title: "Micro Program",
      courses: [1, 2],
      req_tree: reqTree.serialize(),
    })

    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={courseProgram}
        moduleCourses={[moduleOne, moduleTwo]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    await screen.findByText("Micro Program")
    const rows = await screen.findAllByTestId("enrollment-card-desktop")
    expect(rows[0]).toHaveTextContent("Module Two")
    expect(rows[1]).toHaveTextContent("Module One")
  })

  test("clicking 'Start Course' on an unenrolled module uses verified enrollment when ancestor has verified mode", async () => {
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      courseware_url: "https://courses.example.com/run1",
    })

    const cardData = setupCardData({
      programId: 305,
      includeProgramEnrollment: false,
    })
    const moduleOne = mitxonline.factories.courses.course({
      id: 1,
      courseruns: [run],
      next_run_id: run.id,
    })

    const enrollmentEndpoint =
      mitxonline.urls.verifiedProgramEnrollments.create(run.courseware_id)
    setMockResponse.post(enrollmentEndpoint, {})

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleOne, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
        ancestorProgramEnrollment={{
          readable_id: "grandparent-program",
          enrollment_mode: "verified",
        }}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleOne.title))
    const startButton = within(card!).getByTestId("courseware-button")
    await user.click(startButton)

    await waitFor(() => {
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: enrollmentEndpoint,
          data: JSON.stringify([
            cardData.courseProgram.readable_id,
            "grandparent-program",
          ]),
        }),
      )
    })
  })

  test("clicking 'Start Course' on an unenrolled module opens enrollment dialog when no ancestor is verified", async () => {
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
    })

    const cardData = setupCardData({
      programId: 306,
      includeProgramEnrollment: false,
    })
    const moduleOne = mitxonline.factories.courses.course({
      id: 1,
      courseruns: [run],
      next_run_id: run.id,
    })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleOne, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleOne.title))
    const startButton = within(card!).getByTestId("courseware-button")
    await user.click(startButton)

    await screen.findByRole("dialog", { name: moduleOne.title })
  })
})
