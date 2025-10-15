import React from "react"
import { renderWithProviders, waitFor } from "@/test-utils"
import OrganizationRedirect from "./OrganizationRedirect"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { setupOrgAndUser } from "./CoursewareDisplay/test-utils"

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const mockReplace = jest.fn()

const { useRouter } = jest.requireMock("next-nprogress-bar")
useRouter.mockReturnValue({
  replace: mockReplace,
})

const mockLocalStorage = {
  getItem: jest.fn(),
}
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
})

describe("OrganizationRedirect", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockLocalStorage.getItem.mockClear()
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
    mockLocalStorage.getItem.mockReturnValue("last-visited-org")
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
