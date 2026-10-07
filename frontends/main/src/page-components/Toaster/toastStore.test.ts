import {
  showErrorToast,
  dismissErrorToast,
  subscribeToToast,
  getToastSnapshot,
} from "./toastStore"

// The store's other behaviors (show, replace, dismiss) are covered at the
// render level in Toaster.test.tsx; only unsubscription has no render-level
// coverage, since <Toaster> never unmounts there.
test("an unsubscribed listener is not notified", () => {
  const listener = jest.fn()
  const unsubscribe = subscribeToToast(listener)
  unsubscribe()

  showErrorToast("ignored")

  expect(listener).not.toHaveBeenCalled()
  dismissErrorToast()
})

test("the support flag rides along with the message and is cleared on dismiss", () => {
  showErrorToast("Enrollment failed", { contactSupport: true })
  expect(getToastSnapshot()).toEqual({
    message: "Enrollment failed",
    contactSupport: true,
  })

  dismissErrorToast()
  expect(getToastSnapshot()).toBeNull()

  // A plain call must not inherit the previous toast's flag.
  showErrorToast("Something went wrong")
  expect(getToastSnapshot()?.contactSupport).toBeUndefined()
  dismissErrorToast()
})
