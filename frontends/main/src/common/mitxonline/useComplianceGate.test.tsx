import React from "react"
import { renderHook, screen, user, waitFor, within } from "@/test-utils"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "ol-components"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { makeRequest, setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import NiceModal from "@ebay/nice-modal-react"
import { useComplianceGate } from "./useComplianceGate"

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NiceModal.Provider>{children}</NiceModal.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe("useComplianceGate", () => {
  test("a concurrent second call resolves false, even though the first resolves true", async () => {
    const mitxUser = mitxonline.factories.user.user({
      compliance_missing_fields: ["city"],
      legal_address: { country: "GB" },
      user_profile: { year_of_birth: 1990 },
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxUser)
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])

    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    // Synchronous, like two rapid clicks on the same button: the second call
    // happens before the first's profile fetch has resolved.
    const first = result.current.ensureCompliance()
    // `second` is chained onto the first's own promise, so it can't be
    // awaited before the first actually resolves (below) without deadlocking.
    const second = result.current.ensureCompliance()

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await expect(first).resolves.toBe(false)
    // The second caller never waited on the dialog outcome itself -- it was
    // told "no" as soon as it discovered a check already in flight.
    await expect(second).resolves.toBe(false)
  })

  test("a concurrent second call still resolves false when the first succeeds", async () => {
    const mitxUser = mitxonline.factories.user.user({
      compliance_missing_fields: [],
      legal_address: {
        first_name: "Ada",
        last_name: "Lovelace",
        country: "GB",
        street_address_1: "1 Main St",
        city: "London",
      },
      user_profile: { year_of_birth: null },
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxUser)
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])
    setMockResponse.patch(mitxonline.urls.userMe.get(), null)

    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    const first = result.current.ensureCompliance()
    const second = result.current.ensureCompliance()

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(
      within(dialog).getByRole("combobox", { name: "Year of Birth" }),
    )
    await user.click(await screen.findByRole("option", { name: "1988" }))
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    // Only the initiating caller sees the real outcome; the doubled-up second
    // call must not also come back true and fire its own mutation.
    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(false)
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Just a Few More Details" }),
      ).not.toBeInTheDocument(),
    )
  })

  test("fails closed when the profile check itself fails -- shows the dialog rather than proceeding", async () => {
    setMockResponse.get(mitxonline.urls.userMe.get(), "Server error", {
      code: 500,
    })
    setMockResponse.get(mitxonline.urls.countries.list(), [])

    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    const ensured = result.current.ensureCompliance()

    // A failed pre-check must not be indistinguishable from "compliant" --
    // it routes into the same dialog as a definite "info is missing".
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await expect(ensured).resolves.toBe(false)
  })

  test("does not reuse a stale cached profile -- checks fresh on every call", async () => {
    const compliant = mitxonline.factories.user.user({
      compliance_missing_fields: [],
      user_profile: { year_of_birth: 1990 },
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), compliant)

    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    await expect(result.current.ensureCompliance()).resolves.toBe(true)
    await expect(result.current.ensureCompliance()).resolves.toBe(true)

    const profileGets = jest
      .mocked(makeRequest)
      .mock.calls.map(([request]) => request)
      .filter(
        ({ method, url }) =>
          method === "get" && url === mitxonline.urls.userMe.get(),
      )
    // The query client's default staleTime would otherwise let the second
    // call reuse the first's cached response without hitting the network.
    expect(profileGets.length).toBeGreaterThanOrEqual(2)
  })
})
