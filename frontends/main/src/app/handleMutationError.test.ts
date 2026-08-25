import { handleMutationError, GENERIC_ERROR_MESSAGE } from "./getQueryClient"
import { showErrorToast } from "@/page-components/Toaster/toastStore"
import type { Mutation } from "@tanstack/react-query"
import type { MutationErrorMeta } from "api/mutation-meta"

jest.mock("@/page-components/Toaster/toastStore", () => ({
  showErrorToast: jest.fn(),
}))
const mockShowErrorToast = showErrorToast as jest.Mock

/** The handler only reads `mutation.meta`; fake the rest. */
const fakeMutation = (meta: MutationErrorMeta | undefined) =>
  ({ meta }) as unknown as Mutation<unknown, unknown, unknown, unknown>

/** Invoke the handler with just the `meta` that the real code reads. */
const fireError = (
  meta: MutationErrorMeta | undefined,
  error: unknown = new Error("boom"),
  variables: unknown = { id: 1 },
) => handleMutationError(error, variables, undefined, fakeMutation(meta))

beforeEach(() => {
  mockShowErrorToast.mockClear()
})

// The no-meta default and the showErrorToast opt-out are covered end-to-end in
// mutationErrorToast.test.tsx; this file pins the copy-resolution edge cases.

test("uses meta.errorMessage when provided", () => {
  fireError({ errorMessage: "Could not save your changes." })
  expect(mockShowErrorToast).toHaveBeenCalledWith(
    "Could not save your changes.",
  )
})

test("meta.getErrorMessage wins over errorMessage and receives error + variables", () => {
  const getErrorMessage = jest.fn().mockReturnValue("Derived message")
  const error = new Error("nope")
  const variables = { id: 7 }

  handleMutationError(
    error,
    variables,
    undefined,
    fakeMutation({ errorMessage: "static", getErrorMessage }),
  )

  expect(getErrorMessage).toHaveBeenCalledWith(error, variables)
  expect(mockShowErrorToast).toHaveBeenCalledWith("Derived message")
})

test("falls back to generic copy when getErrorMessage throws", () => {
  fireError({
    getErrorMessage: () => {
      throw new Error("bad derivation")
    },
  })
  // The throw must not escape onError (which would leave the failure silent).
  expect(mockShowErrorToast).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE)
})

test("falls back to generic copy when the resolved message is empty", () => {
  fireError({ errorMessage: "   " })
  expect(mockShowErrorToast).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE)
})
