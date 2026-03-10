import React from "react"
import { urls, factories } from "api/mitxonline-test-utils"
import {
  setMockResponse,
  urls as learnUrls,
  factories as learnFactories,
} from "api/test-utils"
import type {
  V2Program,
  ProgramPageItem,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import ProgramAsCoursePage from "./ProgramAsCoursePage"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import invariant from "tiny-invariant"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgram = factories.programs.program
const makePage = factories.pages.programPageItem

const setupApis = ({
  program,
  page,
}: {
  program: V2Program
  page: ProgramPageItem
}) => {
  setMockResponse.get(
    urls.programs.programsList({ readable_id: program.readable_id }),
    { results: [program] },
  )
  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })
  setMockResponse.get(
    learnUrls.userMe.get(),
    learnFactories.user.user({ is_authenticated: false }),
  )
  setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
}

describe("ProgramAsCoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  test("Uses 'Course' breadcrumb label, not 'Program'", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const banner = await screen.findByTestId("banner-container")
    expect(within(banner).getByText("Course")).toBeInTheDocument()
    expect(within(banner).queryByText("Program")).not.toBeInTheDocument()
  })

  test("Uses 'About this Course' heading, not 'About this Program'", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    invariant(page.about)
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const section = await screen.findByRole("region", {
      name: "About this Course",
    })
    expect(section).toBeInTheDocument()
  })

  test("Uses 'Who can take this Course?' heading", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    await screen.findByRole("heading", { name: "Who can take this Course?" })
  })

  test("Does not show program_type tag", async () => {
    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      program_type: "Series",
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const banner = await screen.findByTestId("banner-container")
    expect(within(banner).getByText("MITx")).toBeVisible()
    expect(within(banner).queryByText("Series")).not.toBeInTheDocument()
  })

  test("Renders an enrollment button", async () => {
    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      enrollment_modes: [
        factories.courses.enrollmentMode({ requires_payment: false }),
      ],
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const button = await screen.findByRole("button", { name: /enroll/i })
    expect(button).toBeInTheDocument()
  })

  test("Renders Course Information in info box, not Program Information", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Course Information")).toBeInTheDocument()
    })
    expect(screen.queryByText("Program Information")).not.toBeInTheDocument()
  })

  test("Returns 404 if no program found", async () => {
    setMockResponse.get(
      urls.programs.programsList({ readable_id: "readable_id" }),
      { results: [] },
    )
    setMockResponse.get(urls.pages.programPages("readable_id"), {
      items: [],
    })
    renderWithProviders(<ProgramAsCoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })
})
