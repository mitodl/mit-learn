import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { makeRequest, setMockResponse, urls } from "api/test-utils"
import { programCertificates as programCertificateFactory } from "api/test-utils/factories"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { receiptView } from "@/common/urls"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { ProgramEnrollmentCard } from "./ProgramEnrollmentCard"
import { setupOrderHistory } from "./test-utils"

jest.mock("posthog-js/react")

const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

// Verified cards look up their order; default to none, tests override.
beforeEach(() => {
  setupOrderHistory()
})

describe.each([
  { display: "desktop", testId: "enrollment-card-desktop" },
  { display: "mobile", testId: "enrollment-card-mobile" },
])("ProgramEnrollmentCard $display", ({ testId }) => {
  const getCard = () => screen.getByTestId(testId)

  test("renders program title", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: mitxonline.factories.programs.simpleProgram({
          title: "Test Program Title",
        }),
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getCard()).getByText("Test Program Title"),
    ).toBeInTheDocument()
  })

  test("title links to program dashboard", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: mitxonline.factories.programs.simpleProgram({
          title: "Test Program Title",
          id: 123,
        }),
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    const titleLink = within(getCard()).getByRole("link", {
      name: "Test Program Title",
    })
    expect(titleLink).toHaveAttribute("href", "/dashboard/program/123")
  })

  test("does not show course-specific elements", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3()
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    const card = getCard()
    expect(
      within(card).queryByTestId("courseware-button"),
    ).not.toBeInTheDocument()
    expect(within(card).queryByTestId("upgrade-root")).not.toBeInTheDocument()
  })

  test("shows View Certificate link when certificate is present", () => {
    const certLink = "https://courses.example.com/certificate/abc/"
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        certificate: { uuid: "abc", link: certLink },
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    const link = within(getCard()).getByRole("link", {
      name: /View Certificate/,
    })
    expect(link).toHaveAttribute(
      "href",
      "https://courses.example.com/certificate/program/abc/",
    )
  })

  test("does not show View Certificate when certificate is absent", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        certificate: null,
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getCard()).queryByRole("link", { name: /View Certificate/ }),
    ).not.toBeInTheDocument()
  })

  test("shows 'Certificate track' for verified enrollment without a certificate", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
        certificate: null,
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(within(getCard()).getByTestId("upgraded-banner")).toHaveTextContent(
      "Certificate track",
    )
  })

  test("shows 'View Certificate' in place of 'Certificate track' when verified enrollment has a certificate", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
        certificate: { uuid: "abc", link: "https://example.com/cert/" },
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getCard()).queryByTestId("upgraded-banner"),
    ).not.toBeInTheDocument()
    expect(
      within(getCard()).getAllByRole("link", { name: /View Certificate/ }),
    ).toHaveLength(1)
  })

  test("does not show 'Certificate track' for audit enrollment", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "audit",
        certificate: null,
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getCard()).queryByTestId("upgraded-banner"),
    ).not.toBeInTheDocument()
  })

  test("context menu includes View Program Details with product page URL", async () => {
    const program = mitxonline.factories.programs.simpleProgram()
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({ program })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.getByRole("menuitem", { name: "View Program Details" }),
    ).toHaveAttribute("href", `/programs/${program.readable_id}`)
  })

  test("context menu includes Program Record linking to mitxonline", async () => {
    const program = mitxonline.factories.programs.simpleProgram({ id: 99 })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({ program })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.getByRole("menuitem", { name: "Program Record" }),
    ).toHaveAttribute("href", mitxonlineLegacyUrl("/records/99/"))
  })

  test("context menu includes Unenroll for non-Course display mode with audit enrollment", async () => {
    const program = mitxonline.factories.programs.simpleProgram({
      display_mode: null,
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program,
        enrollment_mode: "audit",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.getByRole("menuitem", { name: "Unenroll" }),
    ).toBeInTheDocument()
  })

  test("context menu hides Unenroll when display_mode is Course", async () => {
    const program = mitxonline.factories.programs.simpleProgram({
      display_mode: DisplayModeEnum.Course,
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program,
        enrollment_mode: "audit",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.queryByRole("menuitem", { name: "Unenroll" }),
    ).not.toBeInTheDocument()
  })

  test("context menu hides Unenroll for verified enrollment", async () => {
    const program = mitxonline.factories.programs.simpleProgram({
      display_mode: null,
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program,
        enrollment_mode: "verified",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.queryByRole("menuitem", { name: "Unenroll" }),
    ).not.toBeInTheDocument()
  })

  test("Receipt appears for verified program enrollment", async () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "verified",
      })
    setupOrderHistory({ programId: programEnrollment.program.id })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      await screen.findByRole("menuitem", { name: "Receipt" }),
    ).toBeInTheDocument()
  })

  test("Receipt does not appear for audit program enrollment", async () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: "audit",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      screen.queryByRole("menuitem", { name: "Receipt" }),
    ).not.toBeInTheDocument()
  })

  test("Receipt links to the receipt for the order that paid for the program", async () => {
    const program = mitxonline.factories.programs.simpleProgram({ id: 99 })
    setupOrderHistory({ programId: 99, orderId: 23 })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program,
        enrollment_mode: "verified",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    expect(
      await screen.findByRole("menuitem", { name: "Receipt" }),
    ).toHaveAttribute("href", receiptView(23))
  })

  test("Receipt is hidden for a verified program enrollment with no order", async () => {
    const program = mitxonline.factories.programs.simpleProgram({ id: 99 })
    // An order exists, but for a different program.
    setupOrderHistory({ programId: 100, orderId: 23 })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program,
        enrollment_mode: "verified",
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    await user.click(
      within(getCard()).getByRole("button", { name: "More options" }),
    )
    await screen.findByRole("menuitem", { name: "Program Record" })

    expect(
      screen.queryByRole("menuitem", { name: "Receipt" }),
    ).not.toBeInTheDocument()
  })
})

describe("ProgramEnrollmentCard program letter", () => {
  const PROGRAM_ID = 77
  const SHARE_URL = "https://learn.mit.edu/program_letter/some-uuid/view"

  const setup = ({
    flagEnabled,
    mitxonlineProgramId,
  }: {
    flagEnabled: boolean
    mitxonlineProgramId: number | null
  }) => {
    mockedUseFeatureFlagEnabled.mockReturnValue(flagEnabled)
    setMockResponse.get(urls.programCertificates.list(), [
      programCertificateFactory.programCertificate({
        mitxonline_program_id: mitxonlineProgramId,
        program_letter_share_url: SHARE_URL,
      }),
    ])
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: mitxonline.factories.programs.simpleProgram({
          id: PROGRAM_ID,
        }),
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
  }

  const openMenu = async () => {
    await user.click(
      within(screen.getByTestId("enrollment-card-desktop")).getByRole(
        "button",
        {
          name: "More options",
        },
      ),
    )
    // Program Record is unconditional, so its presence means the menu is open
    // and a missing Program Letter is a real absence rather than a slow render.
    await screen.findByRole("menuitem", { name: "Program Record" })
  }

  test("links to the letter's share url when the learner has a matching certificate", async () => {
    setup({ flagEnabled: true, mitxonlineProgramId: PROGRAM_ID })
    await openMenu()

    expect(
      await screen.findByRole("menuitem", { name: "Program Letter" }),
    ).toHaveAttribute("href", SHARE_URL)
  })

  test("is hidden when no certificate matches this program", async () => {
    setup({ flagEnabled: true, mitxonlineProgramId: PROGRAM_ID + 1 })
    await openMenu()

    expect(
      screen.queryByRole("menuitem", { name: "Program Letter" }),
    ).not.toBeInTheDocument()
  })

  test("is hidden, and no certificates are requested, when the flag is off", async () => {
    // Requesting the list mints a shareable uuid for every letter the learner
    // does not have yet, so it must not happen behind a disabled flag.
    setup({ flagEnabled: false, mitxonlineProgramId: PROGRAM_ID })
    await openMenu()

    expect(
      screen.queryByRole("menuitem", { name: "Program Letter" }),
    ).not.toBeInTheDocument()
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: urls.programCertificates.list() }),
    )
  })
})

// The progress badge only renders on the desktop card.
describe("ProgramEnrollmentCard progress badge", () => {
  const getDesktopCard = () => screen.getByTestId("enrollment-card-desktop")

  test("shows 'In Progress' next to the 'Program' type label when no certificate is present", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        certificate: null,
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getDesktopCard()).getByTestId("progress-badge"),
    ).toHaveTextContent("In Progress")
  })

  test("shows 'Completed' next to the 'Program' type label when a certificate is present", () => {
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        certificate: { uuid: "test-uuid", link: "/certificate/test-uuid/" },
      })
    renderWithProviders(
      <ProgramEnrollmentCard programEnrollment={programEnrollment} />,
    )
    expect(
      within(getDesktopCard()).getByTestId("progress-badge"),
    ).toHaveTextContent("Completed")
  })
})
