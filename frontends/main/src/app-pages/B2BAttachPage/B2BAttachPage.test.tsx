import React from "react"
import { renderWithProviders, setMockResponse, waitFor } from "@/test-utils"
import { urls } from "api/test-utils"
import {
  urls as b2bUrls,
  factories as mitxOnlineFactories,
  urls as mitxOnlineUrls,
} from "api/mitxonline-test-utils"
import * as commonUrls from "@/common/urls"
import { Permission } from "api/hooks/user"
import B2BAttachPage from "./B2BAttachPage"

// Mock next-nprogress-bar for App Router
const mockPush = jest.fn()
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe("B2BAttachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
  })

  test("Redirects to login when not authenticated", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: false,
    })

    setMockResponse.get(mitxOnlineUrls.currentUser.get(), null)
    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<B2BAttachPage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringMatching(/login.*next=.*skip_onboarding=1/),
      )
    })
  })

  test("Renders when logged in", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    setMockResponse.get(
      mitxOnlineUrls.currentUser.get(),
      mitxOnlineFactories.user.user(),
    )

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<B2BAttachPage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })
  })

  test("Redirects to dashboard on successful attachment", async () => {
    const orgSlug = "test-org"
    const mitxOnlineUser = mitxOnlineFactories.user.user({
      b2b_organizations: [
        {
          id: 1,
          name: "Test Organization",
          description: "A test organization",
          logo: "https://example.com/logo.png",
          slug: `org-${orgSlug}`,
          contracts: [],
        },
      ],
    })

    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    setMockResponse.get(mitxOnlineUrls.currentUser.get(), mitxOnlineUser)

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<B2BAttachPage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        commonUrls.organizationView(orgSlug),
      )
    })
  })
})
