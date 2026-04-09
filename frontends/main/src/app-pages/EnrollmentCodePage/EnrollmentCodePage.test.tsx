import React from "react"
import { dashboardEnrollmentSuccessUrl } from "@/common/mitxonline"
import { renderWithProviders, setMockResponse, waitFor } from "@/test-utils"
import { makeRequest, urls } from "api/test-utils"
import { urls as b2bUrls, factories } from "api/mitxonline-test-utils"
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
    sessionStorage.clear()
  })

  test("Redirects to login when not authenticated", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: false,
    })

    const mitxUser = factories.user.user()
    setMockResponse.get(b2bUrls.userMe.get(), mitxUser)

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

    const mitxUser = factories.user.user()
    setMockResponse.get(b2bUrls.userMe.get(), mitxUser)

    setMockResponse.post(b2bUrls.b2bAttach.b2bAttachView("test-code"), [])

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })
  })

  test("Stores contract info and redirects to dashboard success on successful attachment", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    const contract = factories.contracts.contract({
      name: "Professional Certificate in AI",
      organization: 77,
    })

    const attachUrl = b2bUrls.b2bAttach.b2bAttachView("test-code")
    setMockResponse.post(attachUrl, [contract], { code: 201 })

    renderWithProviders(<EnrollmentCodePage code="test-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith("post", attachUrl, undefined)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(dashboardEnrollmentSuccessUrl())
    })
    expect(sessionStorage.getItem("dashboard_enrollment_title")).toBe(
      "Professional Certificate in AI",
    )
    expect(sessionStorage.getItem("dashboard_enrollment_org_id")).toBe("77")
  })

  test("Redirects to dashboard when user already attached to all contracts (200 status)", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    const attachUrl = b2bUrls.b2bAttach.b2bAttachView("already-used-code")
    sessionStorage.setItem("dashboard_enrollment_title", "Stale Title")
    sessionStorage.setItem("dashboard_enrollment_org_id", "99")

    // 200 status indicates user already attached to all contracts - redirect home without success state
    setMockResponse.post(attachUrl, [], { code: 200 })

    renderWithProviders(<EnrollmentCodePage code="already-used-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith("post", attachUrl, undefined)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(commonUrls.DASHBOARD_HOME)
    })
    expect(sessionStorage.getItem("dashboard_enrollment_title")).toBeNull()
    expect(sessionStorage.getItem("dashboard_enrollment_org_id")).toBeNull()
  })

  test("Redirects to dashboard with error for invalid code (404 status)", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    const attachUrl = b2bUrls.b2bAttach.b2bAttachView("invalid-code")
    // 404 status indicates invalid or expired enrollment code
    setMockResponse.post(attachUrl, {}, { code: 404 })

    renderWithProviders(<EnrollmentCodePage code="invalid-code" />, {
      url: commonUrls.B2B_ATTACH_VIEW,
    })

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith("post", attachUrl, undefined)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        commonUrls.DASHBOARD_HOME_ENROLLMENT_ERROR,
      )
    })
  })
})
