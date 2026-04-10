import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  waitFor,
} from "@/test-utils"
import EnrollmentRedirectAlert from "./EnrollmentRedirectAlert"
import { DASHBOARD_MY_LEARNING } from "@/common/urls"
import * as mitxonline from "api/mitxonline-test-utils"

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const mockReplace = jest.fn()

const { useRouter } = jest.requireMock("next-nprogress-bar")

describe("EnrollmentRedirectAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({
      replace: mockReplace,
    })
  })

  test("shows enrollment error alert and clears query params", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_error=1",
    })

    expect(
      await screen.findByText(
        /The Enrollment Code is incorrect or no longer available\./i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Contact Support")).toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("shows free success alert with bold title and My Learning link", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=Data+Science",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "You have successfully enrolled in Data Science. It has been added to My Learning.",
    )

    const bold = alert.querySelector("strong")
    expect(bold).toHaveTextContent("Data Science")

    expect(screen.getByRole("link", { name: "My Learning" })).toHaveAttribute(
      "href",
      DASHBOARD_MY_LEARNING,
    )
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("shows contract success alert with org name when enrollment_org_id matches MITxOnline user data", async () => {
    const org = mitxonline.factories.organizations.organization({
      id: 77,
      contracts: [],
    })

    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        b2b_organizations: [org],
      }),
    )

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: `/dashboard?enrollment_title=Professional+Certificate&enrollment_org_id=${org.id}`,
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      `You have successfully enrolled in Professional Certificate from ${org.name}`,
    )

    const bold = alert.querySelector("strong")
    expect(bold).toHaveTextContent(`Professional Certificate from ${org.name}`)
  })

  test("waits for org data before showing contract success copy", async () => {
    const org = mitxonline.factories.organizations.organization({
      id: 77,
      contracts: [],
    })
    const mitxUser = mitxonline.factories.user.user({
      b2b_organizations: [org],
    })
    let resolveMitxUser!: (value: typeof mitxUser) => void
    const pendingMitxUser = new Promise<typeof mitxUser>((resolve) => {
      resolveMitxUser = resolve
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), pendingMitxUser)

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: `/dashboard?enrollment_title=Professional+Certificate&enrollment_org_id=${org.id}`,
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    resolveMitxUser(mitxUser)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      `You have successfully enrolled in Professional Certificate from ${org.name}`,
    )
  })

  test("shows generic free success when enrollment_title param is empty", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Your enrollment is confirmed. It has been added to My Learning.",
    )
    expect(screen.getByRole("link", { name: "My Learning" })).toHaveAttribute(
      "href",
      DASHBOARD_MY_LEARNING,
    )
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("shows paid success alert from order receipt data", async () => {
    const receipt = mitxonline.factories.orders.receipt({
      lines: [mitxonline.factories.orders.receiptLine()],
    })

    setMockResponse.get(mitxonline.urls.orders.receipt(17), receipt)

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=17",
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      `You have successfully enrolled in ${receipt.lines[0].item_description}`,
    )

    const bold = alert.querySelector("strong")
    expect(bold).toHaveTextContent(receipt.lines[0].item_description)
  })

  test("falls back to generic paid success copy when receipt loading fails", async () => {
    setMockResponse.get(mitxonline.urls.orders.receipt(18), "Server error", {
      code: 500,
    })

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=18",
    })

    expect(
      await screen.findByText(/Your enrollment is confirmed/i),
    ).toBeInTheDocument()
  })

  test("clears malformed paid redirect params without showing an alert", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=not-a-number",
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("renders nothing and does not call replace when no alert params are present", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard",
    })

    // Give it a tick to process
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
