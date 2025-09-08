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
import { redirect } from "next/navigation"

// Mock Next.js redirect function
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

const mockRedirect = jest.mocked(redirect)

describe("B2BAttachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

    // Wait for the mutation to complete and verify redirect was called
    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith(
        commonUrls.organizationView(orgSlug),
      )
    })
  })
})
