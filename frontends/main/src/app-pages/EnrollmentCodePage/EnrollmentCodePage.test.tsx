import React from "react"
import { renderWithProviders, setMockResponse, waitFor } from "@/test-utils"
import { makeRequest, urls } from "api/test-utils"
import { urls as b2bUrls } from "api/mitxonline-test-utils"
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
