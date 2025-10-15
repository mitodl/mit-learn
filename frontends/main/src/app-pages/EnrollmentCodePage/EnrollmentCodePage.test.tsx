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
import EnrollmentCodePage from "./EnrollmentCodePage"
import invariant from "tiny-invariant"

// Mock next-nprogress-bar for App Router
const mockPush = jest.fn<void, [string]>()
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe("EnrollmentCodePage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
  })

  test("Redirects to login when not authenticated", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: false,
    })

    setMockResponse.get(mitxOnlineUrls.userMe.get(), null)
    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledOnce()
    })

    const url = new URL(mockPush.mock.calls[0][0])
    expect(url.searchParams.get("skip_onboarding")).toBe("1")
    const nextUrl = url.searchParams.get("next")
    const signupNextUrl = url.searchParams.get("signup_next")
    invariant(nextUrl)
    invariant(signupNextUrl)
    const attachView = commonUrls.b2bAttachView("test-code")
    expect(new URL(nextUrl).pathname).toBe(attachView)
    expect(new URL(signupNextUrl).pathname).toBe(attachView)
  })

  test("Renders when logged in", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    setMockResponse.get(
      mitxOnlineUrls.userMe.get(),
      mitxOnlineFactories.user.user(),
    )

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
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

    setMockResponse.get(mitxOnlineUrls.userMe.get(), mitxOnlineUser)

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [
      {
        id: 1,
        organization: 1,
        active: true,
        contract_end: "2024-12-31T23:59:59Z",
      },
    ])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        commonUrls.organizationView(orgSlug),
      )
    })
  })
})
