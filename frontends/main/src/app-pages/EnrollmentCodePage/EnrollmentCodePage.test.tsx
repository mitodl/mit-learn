import React from "react"
import { renderWithProviders, setMockResponse, waitFor } from "@/test-utils"
import { makeRequest, urls } from "api/test-utils"
import { urls as b2bUrls } from "api/mitxonline-test-utils"
import * as commonUrls from "@/common/urls"
import { Permission } from "api/hooks/user"
import EnrollmentCodePage from "./EnrollmentCodePage"

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

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [], {
      code: 403,
    })

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledOnce()
    })

    const url = new URL(mockPush.mock.calls[0][0])
    url.searchParams.sort()
    const expectedParams = new URLSearchParams({
      skip_onboarding: "1",
      next: `http://test.learn.odl.local:8062${commonUrls.b2bAttachView("test-code")}`,
    })
    expectedParams.sort()
    expect([...url.searchParams.entries()]).toEqual([
      ...expectedParams.entries(),
    ])
  })

  test("Renders when logged in", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })
  })

  test("Redirects to dashboard on successful attachment", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    const attachUrl = b2bUrls.b2bAttach.b2bAttachView("test-code")
    setMockResponse.post(attachUrl, [])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith("post", attachUrl, undefined)
    })

    expect(mockPush).toHaveBeenCalledWith(commonUrls.DASHBOARD_HOME)
  })
})
