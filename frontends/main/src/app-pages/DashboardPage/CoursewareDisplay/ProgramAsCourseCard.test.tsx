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
import invariant from "tiny-invariant"
import moment from "moment"
import NiceModal from "@ebay/nice-modal-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { UnenrollProgramDialog } from "./DashboardDialogs"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("ProgramAsCourseCard", () => {
  setupLocationMock()

  /**
   * Creates a ProgramAsCourseCard data set with:
   * - A program with two module courses linked via req_tree
   * - An enrollment in the first module (no grades, no certificate)
   * - Optionally, a program enrollment for the courselike program
   * - Mock response for the user endpoint
   */
  const setupCardData = ({
    includeProgramEnrollment = false,
    startDate,
    endDate,
  }: {
    includeProgramEnrollment?: boolean
    startDate?: string | null
    endDate?: string | null
  } = {}) => {
    const moduleOne = mitxonline.factories.courses.course({
      courseruns: [mitxonline.factories.courses.courseRun()],
    })
    const moduleTwo = mitxonline.factories.courses.course({
      courseruns: [mitxonline.factories.courses.courseRun()],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const modules = reqTree.addOperator({
      operator: "all_of",
      title: "Modules",
    })
    modules.addCourse({ course: moduleOne.id })
    modules.addCourse({ course: moduleTwo.id })

    const program = mitxonline.factories.programs.program({
      courses: [moduleOne.id, moduleTwo.id],
      req_tree: reqTree.serialize(),
      start_date: startDate ?? null,
      end_date: endDate ?? null,
    })

    const moduleEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: {
        ...moduleOne.courseruns[0],
        course: moduleOne,
      },
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
    const cardData = setupCardData({ includeProgramEnrollment: true })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    expect(screen.getByText("2 Modules (0 of 2 complete)")).toBeInTheDocument()
    expect(
      screen.getAllByText(cardData.moduleCourses[0].title).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(cardData.moduleCourses[1].title).length,
    ).toBeGreaterThan(0)
  })

  test("renders when user is not enrolled in the ProgramAsCourse", async () => {
    const cardData = setupCardData()

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    expect(screen.getByText("Not Started")).toBeInTheDocument()
  })

  test("shows date popover content when date summary is clicked", async () => {
    const cardData = setupCardData({
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

  test("displays module rows in req_tree order, irrespective of moduleCourses order", async () => {
    const cardData = setupCardData()
    const [moduleOne, moduleTwo] = cardData.moduleCourses

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleTwo, moduleOne]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const rows = await screen.findAllByTestId("enrollment-card-desktop")
    // req_tree has moduleOne first, moduleTwo second (from setupCardData)
    expect(rows[0]).toHaveTextContent(moduleOne.title)
    expect(rows[1]).toHaveTextContent(moduleTwo.title)
  })

  test("clicking 'Start Course' on an unenrolled module uses verified enrollment when ancestor has verified mode", async () => {
    const cardData = setupCardData()
    const [moduleOne] = cardData.moduleCourses

    // Create a run we control for the first module
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      courseware_url: "https://courses.example.com/run1",
    })
    const moduleWithRun = mitxonline.factories.courses.course({
      id: moduleOne.id,
      courseruns: [run],
      next_run_id: run.id,
    })

    const enrollmentEndpoint =
      mitxonline.urls.verifiedProgramEnrollments.create(run.courseware_id)
    setMockResponse.post(enrollmentEndpoint, {})

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleWithRun, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
        ancestorProgramEnrollment={{
          readable_id: "grandparent-program",
          enrollment_mode: "verified",
        }}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleWithRun.title))
    invariant(
      card,
      `Expected to find a card containing "${moduleWithRun.title}"`,
    )
    const startButton = within(card).getByTestId("courseware-button")
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
    const cardData = setupCardData()
    const [moduleOne] = cardData.moduleCourses

    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      enrollment_modes: [
        mitxonline.factories.courses.enrollmentMode({
          requires_payment: false,
        }),
        mitxonline.factories.courses.enrollmentMode({
          requires_payment: true,
        }),
      ],
    })
    const moduleWithRun = mitxonline.factories.courses.course({
      id: moduleOne.id,
      courseruns: [run],
      next_run_id: run.id,
    })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleWithRun, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleWithRun.title))
    invariant(
      card,
      `Expected to find a card containing "${moduleWithRun.title}"`,
    )
    const startButton = within(card).getByTestId("courseware-button")
    await user.click(startButton)

    await screen.findByRole("dialog", { name: moduleWithRun.title })
  })

  test("clicking 'Start Course' on an unenrolled module bypasses dialog for free-only single-run enrollment", async () => {
    const cardData = setupCardData()
    const [moduleOne] = cardData.moduleCourses

    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      enrollment_modes: [
        mitxonline.factories.courses.enrollmentMode({
          requires_payment: false,
        }),
      ],
    })
    const moduleWithRun = mitxonline.factories.courses.course({
      id: moduleOne.id,
      courseruns: [run],
      next_run_id: run.id,
    })

    const enrollmentUrl = mitxonline.urls.enrollment.enrollmentsListV1()
    setMockResponse.post(enrollmentUrl, {})

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleWithRun, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleWithRun.title))
    invariant(
      card,
      `Expected to find a card containing "${moduleWithRun.title}"`,
    )
    const startButton = within(card).getByTestId("courseware-button")
    await user.click(startButton)

    await waitFor(() => {
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST", url: enrollmentUrl }),
      )
    })
    expect(
      screen.queryByRole("dialog", { name: moduleWithRun.title }),
    ).not.toBeInTheDocument()
  })

  test("clicking 'Start Course' on an unenrolled module bypasses dialog for paid-only single-run enrollment", async () => {
    const cardData = setupCardData()
    const [moduleOne] = cardData.moduleCourses

    const product = mitxonline.factories.courses.product({ price: "500" })
    const run = mitxonline.factories.courses.courseRun({
      is_enrollable: true,
      enrollment_modes: [
        mitxonline.factories.courses.enrollmentMode({
          requires_payment: true,
        }),
      ],
      products: [product],
    })
    const moduleWithRun = mitxonline.factories.courses.course({
      id: moduleOne.id,
      courseruns: [run],
      next_run_id: run.id,
    })

    const clearUrl = mitxonline.urls.baskets.clear()
    setMockResponse.delete(clearUrl, undefined)
    const basketUrl = mitxonline.urls.baskets.createFromProduct(product.id)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={[moduleWithRun, cardData.moduleCourses[1]]}
        moduleEnrollmentsByCourseId={{}}
      />,
    )

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText(moduleWithRun.title))
    invariant(
      card,
      `Expected to find a card containing "${moduleWithRun.title}"`,
    )
    const startButton = within(card).getByTestId("courseware-button")
    await user.click(startButton)

    await waitFor(() => {
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST", url: basketUrl }),
      )
    })
    expect(
      screen.queryByRole("dialog", { name: moduleWithRun.title }),
    ).not.toBeInTheDocument()
  })

  test("displays certificate button when program enrollment has a certificate", async () => {
    const cardData = setupCardData({ includeProgramEnrollment: true })
    invariant(cardData.courseProgramEnrollment)
    const certUuid = "test-certificate-uuid-123"
    const programEnrollmentWithCert = {
      ...cardData.courseProgramEnrollment,
      certificate: {
        uuid: certUuid,
        link: `/certificate/program/${certUuid}/`,
      },
    }

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={programEnrollmentWithCert}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const certButton = screen.getByRole("link", { name: "Certificate" })
    expect(certButton).toBeInTheDocument()
    expect(certButton).toHaveAttribute(
      "href",
      `/certificate/program/${certUuid}`,
    )
    expect(certButton).toHaveAttribute("target", "_blank")
    expect(certButton).toHaveAttribute("rel", "noopener noreferrer")
  })

  test("does not display certificate button when program enrollment has no certificate", async () => {
    const cardData = setupCardData({ includeProgramEnrollment: true })
    invariant(cardData.courseProgramEnrollment)
    const programEnrollmentNoCert = {
      ...cardData.courseProgramEnrollment,
      certificate: null,
    }

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={programEnrollmentNoCert}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const certButton = screen.queryByRole("link", { name: "Certificate" })
    expect(certButton).not.toBeInTheDocument()
  })

  test("shows legacy details link in context menu when product pages flag is disabled", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    const cardData = setupCardData({ includeProgramEnrollment: true })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const programCard = screen.getByTestId("program-as-course-card")
    await user.click(within(programCard).getAllByLabelText("More options")[0])

    const detailsLink = await screen.findByRole("menuitem", {
      name: "View Course Details",
    })
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        `/programs/${cardData.courseProgram.readable_id}`,
      ),
    )
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining("ecom-service=true"),
    )
  })

  test("shows product-page details link in context menu when product pages flag is enabled", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    const cardData = setupCardData({ includeProgramEnrollment: true })

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const programCard = screen.getByTestId("program-as-course-card")
    await user.click(within(programCard).getAllByLabelText("More options")[0])

    const detailsLink = await screen.findByRole("menuitem", {
      name: "View Course Details",
    })
    expect(detailsLink).toHaveAttribute(
      "href",
      `/courses/p/${cardData.courseProgram.readable_id}`,
    )
  })

  test("clicking Unenroll menu item opens UnenrollProgramDialog with readable_id", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    const cardData = setupCardData({ includeProgramEnrollment: true })
    const modalShowSpy = jest.spyOn(NiceModal, "show")

    renderWithProviders(
      <ProgramAsCourseCard
        courseProgram={cardData.courseProgram}
        moduleCourses={cardData.moduleCourses}
        moduleEnrollmentsByCourseId={cardData.moduleEnrollmentsByCourseId}
        courseProgramEnrollment={cardData.courseProgramEnrollment}
      />,
    )

    await screen.findByText(cardData.courseProgram.title)
    const programCard = screen.getByTestId("program-as-course-card")
    await user.click(within(programCard).getAllByLabelText("More options")[0])
    await user.click(await screen.findByRole("menuitem", { name: "Unenroll" }))

    expect(modalShowSpy).toHaveBeenCalledWith(UnenrollProgramDialog, {
      title: cardData.courseProgram.title,
      enrollment: cardData.courseProgram.readable_id,
    })
    modalShowSpy.mockRestore()
  })
})
