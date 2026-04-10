import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  waitFor,
} from "@/test-utils"
import EnrollmentRedirectAlert from "./EnrollmentRedirectAlert"
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

  test("shows free success alert from enrollment_title URL param", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=Data+Science",
    })

    expect(
      await screen.findByText(
        /You have successfully enrolled in Data Science\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("shows contract success alert with org name when enrollment_org_id matches MITxOnline user data", async () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        b2b_organizations: [
          mitxonline.factories.organizations.organization({
            id: 77,
            name: "MIT xPRO",
            contracts: [],
          }),
        ],
      }),
    )

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=Professional+Certificate&enrollment_org_id=77",
    })

    expect(
      await screen.findByText(
        /You have successfully enrolled in Professional Certificate from MIT xPRO\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
  })

  test("waits for org data before showing contract success copy", async () => {
    const mitxUser = mitxonline.factories.user.user({
      b2b_organizations: [
        mitxonline.factories.organizations.organization({
          id: 77,
          name: "MIT xPRO",
          contracts: [],
        }),
      ],
    })
    let resolveMitxUser!: (value: typeof mitxUser) => void
    const pendingMitxUser = new Promise<typeof mitxUser>((resolve) => {
      resolveMitxUser = resolve
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), pendingMitxUser)

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=Professional+Certificate&enrollment_org_id=77",
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
    expect(
      screen.queryByText(
        /You have successfully enrolled in Professional Certificate\. It has been added to My Learning\./i,
      ),
    ).not.toBeInTheDocument()

    resolveMitxUser(mitxUser)

    expect(
      await screen.findByText(
        /You have successfully enrolled in Professional Certificate from MIT xPRO\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
  })

  test("shows generic free success when enrollment_title param is empty", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?enrollment_title=",
    })

    expect(
      await screen.findByText(
        /Your enrollment is confirmed\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("shows paid success alert from order receipt data", async () => {
    setMockResponse.get(
      mitxonline.urls.orders.receipt(17),
      mitxonline.factories.orders.receipt({
        lines: [
          mitxonline.factories.orders.receiptLine({
            item_description: "Machine Learning with Python",
          }),
        ],
      }),
    )

    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=17",
    })

    expect(
      await screen.findByText(
        /You have successfully enrolled in Machine Learning with Python\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
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
        /Your enrollment is confirmed\. It has been added to My Learning\./i,
      ),
    ).toBeInTheDocument()
  })

  test("clears malformed paid redirect params without showing an alert", async () => {
    renderWithProviders(<EnrollmentRedirectAlert />, {
      url: "/dashboard?order_status=fulfilled&order_id=not-a-number",
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
    expect(
      screen.queryByText(/Your enrollment is confirmed\./i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/You have successfully enrolled in /i),
    ).not.toBeInTheDocument()
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
