import React from "react"
import { renderWithProviders, setupLocationMock, waitFor } from "@/test-utils"
import { setMockResponse, urls, factories } from "api/test-utils"
import { trackAccountCreated } from "@/common/analytics/gtm"
import { TrackAccountCreated } from "./TrackAccountCreated"

jest.mock("@/common/analytics/gtm", () => ({
  trackAccountCreated: jest.fn(),
}))

const makeUser = factories.user.user

const setLocation = (pathAndQuery: string) => {
  const url = new URL(pathAndQuery, "http://localhost")
  Object.assign(window.location, {
    href: url.href,
    pathname: url.pathname,
    search: url.search,
  })
}

// renderWithProviders also calls replaceState with a path string; the
// component passes a URL.
const ownReplaceCalls = (spy: jest.SpyInstance) =>
  spy.mock.calls.filter(([, , url]) => url instanceof URL)

describe("TrackAccountCreated", () => {
  setupLocationMock()
  const replaceState = jest.spyOn(window.history, "replaceState")

  beforeEach(() => {
    replaceState.mockImplementation(() => {})
    sessionStorage.clear()
  })
  afterAll(() => replaceState.mockRestore())

  it("tracks a new user once and removes the param", async () => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setLocation("/courses/c?is_new_user=1&utm_source=email")

    renderWithProviders(<TrackAccountCreated />)

    await waitFor(() => expect(trackAccountCreated).toHaveBeenCalledTimes(1))
    const calls = ownReplaceCalls(replaceState)
    expect(calls).toHaveLength(1)
    const cleaned = calls[0][2] as URL
    expect(cleaned.search).toBe("?utm_source=email")
  })

  it("does nothing without the param", async () => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setLocation("/onboarding")

    const { queryClient } = renderWithProviders(<TrackAccountCreated />)

    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(trackAccountCreated).not.toHaveBeenCalled()
    expect(ownReplaceCalls(replaceState)).toHaveLength(0)
  })

  it("waits for an authenticated user", async () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    setLocation("/onboarding?is_new_user=1")

    const { queryClient } = renderWithProviders(<TrackAccountCreated />)

    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(trackAccountCreated).not.toHaveBeenCalled()
    expect(ownReplaceCalls(replaceState)).toHaveLength(0)
  })

  it("does not track again within the same session", async () => {
    sessionStorage.setItem("gtm_account_created_tracked", "1")
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setLocation("/onboarding?is_new_user=1")

    renderWithProviders(<TrackAccountCreated />)

    await waitFor(() => expect(ownReplaceCalls(replaceState)).toHaveLength(1))
    expect(trackAccountCreated).not.toHaveBeenCalled()
  })
})
