import React from "react"
import { vi } from "vitest"
import { renderWithProviders, waitFor } from "@/test-utils"
import OrganizationRedirect from "./OrganizationRedirect"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { setupOrgAndUser } from "./CoursewareDisplay/test-utils"

const mockReplace = vi.fn()
const mockUseRouter = vi.fn().mockReturnValue({
  replace: mockReplace,
})

vi.mock("next-nprogress-bar", () => ({
  useRouter: () => mockUseRouter(),
}))

describe("OrganizationRedirect", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockUseRouter.mockClear()
    localStorage.clear()
    setMockResponse.get(urls.enrollment.enrollmentsList(), [])
    setMockResponse.get(urls.programEnrollments.enrollmentsList(), [])
    setMockResponse.get(urls.contracts.contractsList(), [])
  })

  test("navigates to user's first organization", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const userWithTwoOrgs = {
      ...mitxOnlineUser,
      b2b_organizations: [
        mitxOnlineUser.b2b_organizations[0],
        factories.organizations.organization({}),
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithTwoOrgs)

    renderWithProviders(<OrganizationRedirect />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        `/dashboard/organization/${mitxOnlineUser.b2b_organizations[0].slug.replace("org-", "")}`,
      )
    })
  })

  test("navigates to user's last visited organization", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()
    setMockResponse.get(urls.userMe.get(), mitxOnlineUser)
    localStorage.setItem("last-dashboard-org", "last-visited-org")
    renderWithProviders(<OrganizationRedirect />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/organization/last-visited-org",
      )
    })
  })

  test("navigates to dashboard home if user has no organization", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const userWithNoOrgs = {
      ...mitxOnlineUser,
      b2b_organizations: [],
    }

    setMockResponse.get(urls.userMe.get(), userWithNoOrgs)

    renderWithProviders(<OrganizationRedirect />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
  })
})
