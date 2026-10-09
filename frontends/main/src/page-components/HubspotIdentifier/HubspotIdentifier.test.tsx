import React from "react"
import { waitFor } from "@testing-library/react"
import { HubspotIdentifier } from "./HubspotIdentifier"
import { renderWithProviders } from "@/test-utils"
import { setMockResponse, urls, factories } from "api/test-utils"

describe("HubspotIdentifier", () => {
  let hsq: unknown[][]

  beforeEach(() => {
    hsq = []
    window._hsq = hsq
    process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID = "12345"
  })

  afterEach(() => {
    delete window._hsq
    delete process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID
  })

  const setup = (userOverrides = {}) => {
    const userData = factories.user.user(userOverrides)
    setMockResponse.get(urls.userMe.get(), userData)
    const { queryClient } = renderWithProviders(<HubspotIdentifier />)
    return { userData, queryClient }
  }

  test("calls identify with the user's email when authenticated", async () => {
    const { userData: user } = setup({ is_authenticated: true })
    await waitFor(() => {
      expect(hsq).toContainEqual(["identify", { email: user.email }])
    })
  })

  test("does not call identify when user is not authenticated", async () => {
    const { queryClient } = setup({ is_authenticated: false })
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(hsq).not.toContainEqual(expect.arrayContaining(["identify"]))
  })

  test("does not call identify when NEXT_PUBLIC_HUBSPOT_PORTAL_ID is not set", async () => {
    delete process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID
    const { queryClient } = setup({ is_authenticated: true })
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(hsq).not.toContainEqual(expect.arrayContaining(["identify"]))
  })
})
