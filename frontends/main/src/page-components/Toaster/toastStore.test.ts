import {
  showErrorToast,
  dismissErrorToast,
  subscribeToToast,
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
