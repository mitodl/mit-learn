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

describe("OrganizationRedirect", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    localStorage.clear()
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
    setMockResponse.get(urls.contracts.contractsList(), [])
  })

  test("navigates to user's first organization's first contract", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const contract = factories.contracts.contract({})
    const userWithTwoOrgs = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [contract],
        },
        factories.organizations.organization({}),
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithTwoOrgs)

    renderWithProviders(<OrganizationRedirect />)

    await waitFor(() => {
      const orgSlug = userWithTwoOrgs.b2b_organizations[0].slug.replace(
        "org-",
        "",
      )
      const contractSlug = contract.slug
      expect(mockReplace).toHaveBeenCalledWith(
        `/dashboard/organization/${orgSlug}/contract/${contractSlug}`,
      )
    })
  })

  test("navigates to user's last visited organization and contract", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()
    setMockResponse.get(urls.userMe.get(), mitxOnlineUser)
    localStorage.setItem("last-dashboard-org", "last-visited-org")
    localStorage.setItem("last-dashboard-contract", "last-visited-contract")
    renderWithProviders(<OrganizationRedirect />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/organization/last-visited-org/contract/last-visited-contract",
      )
    })
  })

  test("navigates to first contract if only org in localStorage", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const contract = factories.contracts.contract({})
    const userWithContract = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [contract],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithContract)
    localStorage.setItem("last-dashboard-org", "last-visited-org")
    renderWithProviders(<OrganizationRedirect />)
    await waitFor(() => {
      const orgSlug = userWithContract.b2b_organizations[0].slug.replace(
        "org-",
        "",
      )
      const contractSlug = contract.slug
      expect(mockReplace).toHaveBeenCalledWith(
        `/dashboard/organization/${orgSlug}/contract/${contractSlug}`,
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

  test("navigates to dashboard home if organization has no contracts", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const userWithOrgButNoContract = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithOrgButNoContract)

    renderWithProviders(<OrganizationRedirect />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
  })

  test("navigates to dashboard home if user is not authenticated", async () => {
    setMockResponse.get(urls.userMe.get(), null)

    renderWithProviders(<OrganizationRedirect />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    })
  })
})
