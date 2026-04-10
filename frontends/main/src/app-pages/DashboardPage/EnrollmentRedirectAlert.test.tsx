import React from "react"
import { act } from "@testing-library/react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  waitFor,
} from "@/test-utils"
import EnrollmentRedirectAlert from "./EnrollmentRedirectAlert"
import { DASHBOARD_MY_LEARNING } from "@/common/urls"
import * as mitxonline from "api/mitxonline-test-utils"

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

describe("EnrollmentRedirectAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("shows invalid-enrollment-code error alert and clears params", async () => {
    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=error&error_type=invalid-enrollment-code",
    })

    expect(
      await screen.findByText(
        /The Enrollment Code is incorrect or no longer available\./i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Contact Support")).toBeInTheDocument()
    await waitFor(() => {
      expect(location.current.search).toBe("")
    })
  })

  test("shows generic error alert when error_type is unknown", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=error",
    })

    expect(
      await screen.findByText(
        /Something went wrong processing your enrollment\./i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Contact Support")).toBeInTheDocument()
  })

  test("shows free success alert with bold title and My Learning link", async () => {
    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=success&enrollment_title=Data+Science",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      /You've been enrolled in "Data Science"\. It has been added to My Learning\./,
    )

    const bold = alert.querySelector("strong")
    expect(bold).toHaveTextContent("Data Science")

    expect(screen.getByRole("link", { name: "My Learning" })).toHaveAttribute(
      "href",
      DASHBOARD_MY_LEARNING,
    )
    await waitFor(() => {
      expect(location.current.search).toBe("")
    })
  })

  test("shows B2B success alert with org name when enrollment_org_id matches MITxOnline user data", async () => {
    const org = mitxonline.factories.organizations.organization({})

    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        b2b_organizations: [org],
      }),
    )

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: `/dashboard?enrollment_status=success&enrollment_title=Professional+Certificate&enrollment_org_id=${org.id}`,
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      new RegExp(
        `As a member of ${escapeRegExp(org.name)}, you have been enrolled in "Professional Certificate"`,
      ),
    )
    expect(alert).not.toHaveTextContent("My Learning")

    const bolds = alert.querySelectorAll("strong")
    expect(bolds[0]).toHaveTextContent(org.name)
    expect(bolds[1]).toHaveTextContent("Professional Certificate")
  })

  test("waits for org data before showing B2B success copy", async () => {
    const org = mitxonline.factories.organizations.organization({})
    const mitxUser = mitxonline.factories.user.user({
      b2b_organizations: [org],
    })
    let resolveMitxUser!: (value: typeof mitxUser) => void
    const pendingMitxUser = new Promise<typeof mitxUser>((resolve) => {
      resolveMitxUser = resolve
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), pendingMitxUser)

    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: `/dashboard?enrollment_status=success&enrollment_title=Professional+Certificate&enrollment_org_id=${org.id}`,
    })

    await waitFor(() => {
      expect(location.current.search).toBe("")
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    resolveMitxUser(mitxUser)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      new RegExp(
        `As a member of ${escapeRegExp(org.name)}, you have been enrolled in "Professional Certificate"`,
      ),
    )
  })

  test("shows error alert when B2B org ID is not found in user data", async () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        b2b_organizations: [],
      }),
    )

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=success&enrollment_title=Some+Course&enrollment_org_id=999",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      /Something went wrong processing your enrollment/,
    )
    expect(screen.getByText("Contact Support")).toBeInTheDocument()
  })

  test("shows error alert when enrollment_org_id is malformed", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation()

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=success&enrollment_title=Some+Course&enrollment_org_id=not-a-number",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      /Something went wrong processing your enrollment/,
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Malformed enrollment_org_id"),
      "not-a-number",
    )

    warnSpy.mockRestore()
  })

  test("shows no alert and warns when enrollment_status=success but title is missing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation()

    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_status=success",
    })

    await waitFor(() => {
      expect(location.current.search).toBe("")
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("without enrollment_title"),
    )

    warnSpy.mockRestore()
  })

  test("preserves enrollment_title without enrollment_status signal", async () => {
    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=Data+Science",
    })

    await waitFor(() => {
      expect(location.current.search).toBe("?enrollment_title=Data+Science")
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("preserves error_type without enrollment_status signal", async () => {
    const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?error_type=invalid-enrollment-code",
    })

    await waitFor(() => {
      expect(location.current.search).toBe(
        "?error_type=invalid-enrollment-code",
      )
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("shows paid success alert from order receipt data", async () => {
    const receipt = mitxonline.factories.orders.order({
      lines: [mitxonline.factories.orders.transactionLine()],
    })

    setMockResponse.get(mitxonline.urls.orders.receipt(17), receipt)

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=17",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      new RegExp(
        `You've enrolled in the certificate track for "${escapeRegExp(receipt.lines[0].content_title)}"`,
      ),
    )

    const bold = alert.querySelector("strong")
    expect(bold).toHaveTextContent(receipt.lines[0].content_title)
  })

  test("falls back to generic paid success copy when receipt loading fails", async () => {
    setMockResponse.get(mitxonline.urls.orders.receipt(18), "Server error", {
      code: 500,
    })

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=18",
    })

    expect(
      await screen.findByText(
        /Your certificate track enrollment is confirmed/i,
      ),
    ).toBeInTheDocument()
  })

  test.each([
    {
      label: "non-numeric",
      url: "order_status=fulfilled&order_id=not-a-number",
    },
    { label: "missing", url: "order_status=fulfilled" },
  ])(
    "clears params without showing an alert when order_id is $label",
    async ({ url }) => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation()

      const { location } = renderWithProviders(<EnrollmentRedirectAlert />, {
        url: `/dashboard?${url}`,
      })

      await waitFor(() => {
        expect(location.current.search).toBe("")
      })
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()

      warnSpy.mockRestore()
    },
  )

  test("renders nothing and does not trigger side effects when no alert params are present", async () => {
    const { queryClient } = renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard",
    })

    // Flush any pending effects/state transitions before asserting absence.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {})

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(queryClient.isFetching()).toBe(0)
  })
})
