import React from "react"
import { useMutation } from "@tanstack/react-query"
import { renderWithProviders, screen, user } from "@/test-utils"
import { GENERIC_ERROR_MESSAGE } from "@/app/getQueryClient"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import type { MutationErrorMeta } from "api/mutation-meta"

/**
 * End-to-end coverage of the wiring the whole feature rests on:
 * `MutationCache.onError` (getQueryClient) -> toast store -> <Toaster>. The
 * unit tests exercise those pieces in isolation; these prove they are actually
 * connected, so deleting the `mutationCache` wiring can't pass silently.
 *
 * `renderWithProviders` builds the real browser query client and mounts the
 * real <Toaster> (see test-utils/index.tsx).
 */

const MutatingButton = ({
  meta,
  withInlineError = false,
}: {
  meta?: MutationErrorMeta
  withInlineError?: boolean
}) => {
  const mutation = useMutation({
    mutationFn: () => Promise.reject(new Error("network boom")),
    meta,
  })
  return (
    <div>
      <button onClick={() => mutation.mutate()}>Submit</button>
      {withInlineError && mutation.isError ? (
        <div role="alert">Inline failure</div>
      ) : null}
    </div>
  )
}

test("a mutation failure with no meta shows the global error toast", async () => {
  renderWithProviders(<MutatingButton />)

  await user.click(screen.getByRole("button", { name: "Submit" }))

  expect(await screen.findByRole("alert")).toHaveTextContent(
    GENERIC_ERROR_MESSAGE,
  )
})

test("a mutation with SILENCE_ERROR_TOAST shows only its inline error, no toast", async () => {
  renderWithProviders(
    <MutatingButton meta={SILENCE_ERROR_TOAST} withInlineError />,
  )

  await user.click(screen.getByRole("button", { name: "Submit" }))

  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent("Inline failure")
  // Exactly one alert — the inline one — i.e. the global toast was suppressed.
  expect(screen.getAllByRole("alert")).toHaveLength(1)
})
