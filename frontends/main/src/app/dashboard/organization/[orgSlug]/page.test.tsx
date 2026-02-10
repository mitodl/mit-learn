import React from "react"
import { renderWithProviders, waitFor } from "@/test-utils"
import Page from "./page"
import { setMockResponse } from "api/test-utils"
import { urls, factories } from "api/mitxonline-test-utils"
import { setupOrgAndUser } from "@/app-pages/DashboardPage/CoursewareDisplay/test-utils"
import { act } from "@testing-library/react"
import { contractView, DASHBOARD_HOME } from "@/common/urls"

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const mockReplace = jest.fn()

const { useRouter } = jest.requireMock("next-nprogress-bar")
useRouter.mockReturnValue({
  replace: mockReplace,
})

describe("Organization Page", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    setMockResponse.get(urls.contracts.contractsList(), [])
  })

  test("redirects to contract view with first contract when organization and contract exist", async () => {
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

    const orgSlug = userWithContract.b2b_organizations[0].slug.replace(
      "org-",
      "",
    )

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(<Page params={Promise.resolve({ orgSlug })} />)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        contractView(orgSlug, contract.slug),
      )
    })
  })

  test("redirects to dashboard when organization has no contracts", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const userWithNoContracts = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithNoContracts)

    const orgSlug = userWithNoContracts.b2b_organizations[0].slug.replace(
      "org-",
      "",
    )

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(<Page params={Promise.resolve({ orgSlug })} />)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_HOME)
    })
  })

  test("redirects to dashboard when organization is not found", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()
    setMockResponse.get(urls.userMe.get(), mitxOnlineUser)

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(
        <Page params={Promise.resolve({ orgSlug: "non-existent-org" })} />,
      )
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_HOME)
    })
  })

  test("redirects to first contract when organization has multiple contracts", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const contract1 = factories.contracts.contract({ slug: "first-contract" })
    const contract2 = factories.contracts.contract({ slug: "second-contract" })

    const userWithMultipleContracts = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [contract1, contract2],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithMultipleContracts)

    const orgSlug = userWithMultipleContracts.b2b_organizations[0].slug.replace(
      "org-",
      "",
    )

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(<Page params={Promise.resolve({ orgSlug })} />)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        contractView(orgSlug, contract1.slug),
      )
    })
  })

  test("redirects correctly when matching organization slug with org- prefix", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const contract = factories.contracts.contract({})
    const userWithContract = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          slug: "org-test-organization",
          contracts: [contract],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithContract)

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(
        <Page params={Promise.resolve({ orgSlug: "test-organization" })} />,
      )
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        contractView("test-organization", contract.slug),
      )
    })
  })

  test("redirects to dashboard when no contract available", async () => {
    const { mitxOnlineUser } = setupOrgAndUser()

    const userWithNoContracts = {
      ...mitxOnlineUser,
      b2b_organizations: [
        {
          ...mitxOnlineUser.b2b_organizations[0],
          contracts: [],
        },
      ],
    }

    setMockResponse.get(urls.userMe.get(), userWithNoContracts)

    const orgSlug = userWithNoContracts.b2b_organizations[0].slug.replace(
      "org-",
      "",
    )

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      renderWithProviders(<Page params={Promise.resolve({ orgSlug })} />)
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DASHBOARD_HOME)
    })
  })
})
