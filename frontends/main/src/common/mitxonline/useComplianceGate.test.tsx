import React from "react"
import { act, renderHook, screen, user, waitFor, within } from "@/test-utils"
import { render } from "@testing-library/react"
import { QueryClientProvider, useMutation } from "@tanstack/react-query"
import type { MutateOptions } from "@tanstack/react-query"
import { ThemeProvider } from "ol-components"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { makeRequest, setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import NiceModal from "@ebay/nice-modal-react"
import { useComplianceGate, ComplianceGateProvider } from "./useComplianceGate"

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NiceModal.Provider>
          <ComplianceGateProvider>{children}</ComplianceGateProvider>
        </NiceModal.Provider>
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

  test("two separate call sites sharing a ComplianceGateProvider collapse onto one check", async () => {
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

    // Unlike the tests above, which call ensureCompliance() twice on the same
    // hook instance, this calls it from two independent useComplianceGate()
    // invocations -- e.g. two dashboard cards -- each with its own local ref.
    // Only the shared ComplianceGateProvider ties them together.
    const { result } = renderHook(
      () => ({ cardA: useComplianceGate(), cardB: useComplianceGate() }),
      { wrapper },
    )

    const first = result.current.cardA.ensureCompliance()
    const second = result.current.cardB.ensureCompliance()

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    // The second card's click must collapse onto the first's in-flight
    // check rather than opening its own dialog.
    expect(screen.getAllByRole("dialog")).toHaveLength(1)

    await user.click(
      within(dialog).getByRole("combobox", { name: "Year of Birth" }),
    )
    await user.click(await screen.findByRole("option", { name: "1988" }))
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    // Only the initiating card resumes as compliant; the collapsed second
    // card must not also fire its own enroll/basket mutation.
    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(false)
  })
})

describe("mutateWithCompliance", () => {
  const rejection = (missingFields: string[]) => ({
    response: {
      status: 400,
      data: {
        detail: "Unable to complete enrollment. Error code: CS_701.",
        missing_fields: missingFields,
      },
    },
  })

  /** A complete profile, so the up-front gate passes without the dialog. */
  const setupCompleteUser = () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        compliance_missing_fields: [],
        legal_address: {
          first_name: "David",
          last_name: ".",
          country: "GB",
          street_address_1: "1 Main St",
          city: "London",
        },
        user_profile: { year_of_birth: 1990 },
      }),
    )
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])
    setMockResponse.patch(mitxonline.urls.userMe.get(), null)
  }

  type Options = MutateOptions<string, unknown, { id: number }, unknown>

  /**
   * A stand-in for a `useMutation` result whose attempts settle as scripted:
   * each entry is the error that attempt fails with, or `null` to succeed.
   */
  const fakeMutation = (outcomes: (unknown | null)[]) => {
    const mutateAsync = jest.fn(
      async (variables: { id: number }, options?: Options) => {
        const error = outcomes[mutateAsync.mock.calls.length - 1]
        if (error) {
          options?.onError?.(error, variables, undefined)
          options?.onSettled?.(undefined, error, variables, undefined)
          throw error
        }
        options?.onSuccess?.("ok", variables, undefined)
        options?.onSettled?.("ok", null, variables, undefined)
        return "ok"
      },
    )
    return { mutateAsync, reset: jest.fn() }
  }

  const callbacks = () => ({
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onSettled: jest.fn(),
  })

  test("reopens the dialog on the rejected fields, then retries once saved", async () => {
    setupCompleteUser()
    const mutation = fakeMutation([rejection(["last_name"]), null])
    const options = callbacks()
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = result.current.mutateWithCompliance(
        mutation,
        { id: 1 },
        options,
      )
    })

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    expect(
      within(dialog).getByText(/We couldn't verify some of your details/),
    ).toBeInTheDocument()
    // The failed attempt is cleared so an inline alert doesn't show behind the
    // dialog, and its error never reaches the caller.
    expect(mutation.reset).toHaveBeenCalled()
    expect(options.onError).not.toHaveBeenCalled()

    const lastName = within(dialog).getByRole("textbox", { name: "Last Name" })
    await user.clear(lastName)
    await user.type(lastName, "Cohen")
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(options.onSuccess).toHaveBeenCalled())
    expect(mutation.mutateAsync).toHaveBeenCalledTimes(2)
    expect(mutation.mutateAsync.mock.calls[1][0]).toEqual({ id: 1 })
    expect(options.onError).not.toHaveBeenCalled()
    await act(() => pending)
  })

  test("a further rejection keeps the same dialog open on the new fields", async () => {
    setupCompleteUser()
    const mutation = fakeMutation([
      rejection(["last_name"]),
      rejection(["postal_code"]),
      null,
    ])
    const options = callbacks()
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = result.current.mutateWithCompliance(
        mutation,
        { id: 1 },
        options,
      )
    })
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    const lastName = within(dialog).getByRole("textbox", { name: "Last Name" })
    await user.clear(lastName)
    await user.type(lastName, "-Cohen")
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledTimes(2))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(dialog).toBeInTheDocument()
    expect(options.onError).not.toHaveBeenCalled()
    expect(options.onSuccess).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(options.onSuccess).toHaveBeenCalled())
    expect(mutation.mutateAsync).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await act(() => pending)
  })

  test("dismissing the dialog skips onError but still runs onSettled", async () => {
    setupCompleteUser()
    const error = rejection(["last_name"])
    const mutation = fakeMutation([error])
    const options = callbacks()
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = result.current.mutateWithCompliance(
        mutation,
        { id: 1 },
        options,
      )
    })
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await waitFor(() =>
      expect(options.onSettled).toHaveBeenCalledWith(
        undefined,
        error,
        { id: 1 },
        undefined,
      ),
    )
    expect(options.onError).not.toHaveBeenCalled()
    expect(mutation.mutateAsync).toHaveBeenCalledTimes(1)
    await act(() => pending)
  })

  test.each([
    {
      desc: "an unrelated failure",
      error: {
        response: {
          status: 500,
          data: {},
        },
      },
    },
    {
      desc: "a rejection naming only fields the dialog can't fix",
      error: rejection(["email"]),
    },
  ])("passes $desc straight to the caller", async ({ error }) => {
    setupCompleteUser()
    const mutation = fakeMutation([error])
    const options = callbacks()
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = result.current.mutateWithCompliance(
        mutation,
        { id: 1 },
        options,
      )
    })

    expect(options.onError).toHaveBeenCalledWith(error, { id: 1 }, undefined)
    expect(options.onSettled).toHaveBeenCalled()
    expect(mutation.reset).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await act(() => pending)
  })

  test("doesn't attempt the mutation when the up-front gate is dismissed", async () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        compliance_missing_fields: ["city"],
        legal_address: { country: "GB" },
        user_profile: { year_of_birth: 1990 },
      }),
    )
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])
    const mutation = fakeMutation([null])
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    const pending = result.current.mutateWithCompliance(
      mutation,
      { id: 1 },
      callbacks(),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await pending

    expect(mutation.mutateAsync).not.toHaveBeenCalled()
  })

  /** A real mutation function: rejected on the last name once, then succeeds. */
  const rejectOnce = () =>
    jest
      .fn()
      .mockRejectedValueOnce(rejection(["last_name"]))
      .mockResolvedValue("ok")

  const fixLastNameAndSubmit = async (dialog: HTMLElement) => {
    const lastName = within(dialog).getByRole("textbox", { name: "Last Name" })
    await user.clear(lastName)
    await user.type(lastName, "Cohen")
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))
  }

  test("a retry still finishes after the caller unmounts", async () => {
    setupCompleteUser()
    const mutationFn = rejectOnce()
    let pending: Promise<void> | null = null
    let leave = () => {}
    // The dialog lives at the root, so it outlasts the component that started
    // the enrollment (e.g. after browser Back).
    const Owner = () => {
      const mutation = useMutation({ mutationFn })
      const { mutateWithCompliance } = useComplianceGate()
      React.useEffect(() => {
        pending = mutateWithCompliance(mutation, { id: 1 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    }
    const Page = () => {
      const [shown, setShown] = React.useState(true)
      leave = () => setShown(false)
      return shown ? <Owner /> : null
    }
    render(<Page />, { wrapper })

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    act(() => leave())
    await fixLastNameAndSubmit(dialog)

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(mutationFn).toHaveBeenCalledTimes(2)
    await act(() => pending!)
  })

  test("an action started while another's dialog is open doesn't take it over", async () => {
    setupCompleteUser()
    const first = rejectOnce()
    const second = jest.fn().mockRejectedValue(rejection(["last_name"]))
    const { result } = renderHook(
      () => ({
        cardA: useComplianceGate(),
        cardB: useComplianceGate(),
        first: useMutation({ mutationFn: first }),
        second: useMutation({ mutationFn: second }),
      }),
      { wrapper },
    )

    let pendingA: Promise<void> = Promise.resolve()
    await act(async () => {
      pendingA = result.current.cardA.mutateWithCompliance(
        result.current.first,
        {
          id: 1,
        },
      )
    })
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })

    // Card A's recovery dialog is open (in the browser its backdrop blocks the
    // click anyway), so card B's action stops at the compliance check rather
    // than swapping its own retry into the shared dialog.
    await act(() =>
      result.current.cardB.mutateWithCompliance(result.current.second, {
        id: 2,
      }),
    )
    expect(second).not.toHaveBeenCalled()

    await fixLastNameAndSubmit(dialog)
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(first).toHaveBeenCalledTimes(2)
    await act(() => pendingA)
  })

  test.each([
    { secondRetry: "succeeds", opensOwnDialog: false },
    { secondRetry: "is rejected again", opensOwnDialog: true },
  ])(
    "a rejection while another dialog is open waits, then retries ($secondRetry)",
    async ({ opensOwnDialog }) => {
      setupCompleteUser()
      let rejectFirst: (error: unknown) => void = () => {}
      let rejectSecond: (error: unknown) => void = () => {}
      const first = jest
        .fn()
        .mockImplementationOnce(
          () => new Promise((_, reject) => (rejectFirst = reject)),
        )
        .mockResolvedValue("ok")
      const second = jest
        .fn()
        .mockImplementationOnce(
          () => new Promise((_, reject) => (rejectSecond = reject)),
        )
      if (opensOwnDialog) {
        second
          .mockRejectedValueOnce(rejection(["last_name"]))
          .mockResolvedValue("ok")
      } else {
        second.mockResolvedValue("ok")
      }
      const { result } = renderHook(
        () => ({
          cardA: useComplianceGate(),
          cardB: useComplianceGate(),
          first: useMutation({ mutationFn: first }),
          second: useMutation({ mutationFn: second }),
        }),
        { wrapper },
      )

      // Both enrollments are in flight before either is rejected.
      let pendingA: Promise<void> = Promise.resolve()
      let pendingB: Promise<void> = Promise.resolve()
      const onSuccessB = jest.fn()
      const onErrorB = jest.fn()
      await act(async () => {
        pendingA = result.current.cardA.mutateWithCompliance(
          result.current.first,
          { id: 1 },
        )
      })
      await waitFor(() => expect(first).toHaveBeenCalledTimes(1))
      await act(async () => {
        pendingB = result.current.cardB.mutateWithCompliance(
          result.current.second,
          { id: 2 },
          { onSuccess: onSuccessB, onError: onErrorB },
        )
      })
      await waitFor(() => expect(second).toHaveBeenCalledTimes(1))

      await act(async () => rejectFirst(rejection(["last_name"])))
      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })
      await act(async () => rejectSecond(rejection(["last_name"])))

      // B's rejection doesn't take over A's dialog; B waits for it.
      expect(screen.getAllByRole("dialog")).toHaveLength(1)
      expect(second).toHaveBeenCalledTimes(1)
      await fixLastNameAndSubmit(dialog)
      await act(() => pendingA)
      expect(first).toHaveBeenCalledTimes(2)

      // Then B retries with the fixed profile.
      await waitFor(() => expect(second).toHaveBeenCalledTimes(2))
      if (opensOwnDialog) {
        const own = await screen.findByRole("dialog", {
          name: "Just a Few More Details",
        })
        await fixLastNameAndSubmit(own)
        await waitFor(() => expect(second).toHaveBeenCalledTimes(3))
      }
      await act(() => pendingB)
      expect(onSuccessB).toHaveBeenCalledTimes(1)
      expect(onErrorB).not.toHaveBeenCalled()
    },
  )

  test("another action isn't held up while an enrollment request is in flight", async () => {
    setupCompleteUser()
    let finishFirst: (value: string) => void = () => {}
    const first = jest.fn(
      (_vars: { id: number }) =>
        new Promise<string>((resolve) => (finishFirst = resolve)),
    )
    const second = jest.fn().mockResolvedValue("ok")
    const { result } = renderHook(
      () => ({
        cardA: useComplianceGate(),
        cardB: useComplianceGate(),
        first: useMutation({ mutationFn: first }),
        second: useMutation({ mutationFn: second }),
      }),
      { wrapper },
    )

    let pendingA: Promise<void> = Promise.resolve()
    await act(async () => {
      pendingA = result.current.cardA.mutateWithCompliance(
        result.current.first,
        { id: 1 },
      )
    })
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1))

    const onSuccessB = jest.fn()
    await act(() =>
      result.current.cardB.mutateWithCompliance(
        result.current.second,
        { id: 2 },
        { onSuccess: onSuccessB },
      ),
    )
    expect(second).toHaveBeenCalledTimes(1)
    expect(onSuccessB).toHaveBeenCalled()

    await act(async () => finishFirst("ok"))
    await act(() => pendingA)
  })
})

describe("ensureEligibility", () => {
  const target = { type: "program" as const, id: 9 }
  const eligibilityUrl = mitxonline.urls.enrollmentEligibility.program(9)

  const setupCompleteUser = () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user({
        compliance_missing_fields: [],
        legal_address: {
          first_name: "David",
          last_name: ".",
          country: "GB",
          street_address_1: "1 Main St",
          city: "London",
        },
        user_profile: { year_of_birth: 1990 },
      }),
    )
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])
    setMockResponse.patch(mitxonline.urls.userMe.get(), null)
  }

  const eligibility = (reasonCode: string | null, missingFields: string[]) => ({
    enrollable: reasonCode === null,
    reason_code: reasonCode,
    missing_fields: missingFields,
  })

  const eligibilityCalls = () =>
    jest
      .mocked(makeRequest)
      .mock.calls.filter(
        ([request]) =>
          request.method === "post" && request.url === eligibilityUrl,
      )

  test("continues without a dialog when the learner may enroll", async () => {
    setupCompleteUser()
    setMockResponse.post(eligibilityUrl, eligibility(null, []), { code: 200 })
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    await expect(result.current.ensureEligibility(target)).resolves.toBe(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("leaves a CS_700 rejection to checkout rather than the dialog", async () => {
    setupCompleteUser()
    setMockResponse.post(eligibilityUrl, eligibility("CS_700", []), {
      code: 200,
    })
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    await expect(result.current.ensureEligibility(target)).resolves.toBe(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("opens the dialog on the rejected fields and re-checks on submit", async () => {
    setupCompleteUser()
    setMockResponse.post(eligibilityUrl, eligibility("CS_701", ["last_name"]), {
      code: 200,
    })
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      pending = result.current.ensureEligibility(target)
    })
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    const lastName = within(dialog).getByRole("textbox", { name: "Last Name" })
    await waitFor(() =>
      expect(lastName).toHaveAccessibleDescription(
        "Please enter a valid last name.",
      ),
    )

    setMockResponse.post(eligibilityUrl, eligibility(null, []), { code: 200 })
    await user.clear(lastName)
    await user.type(lastName, "Cohen")
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await expect(pending).resolves.toBe(true)
    expect(eligibilityCalls()).toHaveLength(2)
  })

  test("resolves false when the learner dismisses the dialog", async () => {
    setupCompleteUser()
    setMockResponse.post(eligibilityUrl, eligibility("CS_701", ["last_name"]), {
      code: 200,
    })
    const { result } = renderHook(() => useComplianceGate(), { wrapper })

    let pending: Promise<boolean> = Promise.resolve(true)
    await act(async () => {
      pending = result.current.ensureEligibility(target)
    })
    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await expect(pending).resolves.toBe(false)
  })
})
