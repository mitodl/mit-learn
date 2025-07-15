import React from "react"
import {
  renderWithProviders,
  screen,
  TestingErrorBoundary,
  waitFor,
} from "../../test-utils"
import RestrictedRoute from "./RestrictedRoute"
import { Permission } from "api/hooks/user"
import { allowConsoleErrors } from "ol-test-utilities"
import { setMockResponse, urls, factories } from "api/test-utils"
import { ForbiddenError } from "@/common/errors"

const makeUser = factories.user.user

test("Renders children if permission check satisfied", async () => {
  const errors: unknown[] = []
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))

  renderWithProviders(
    <RestrictedRoute requires={Permission.Authenticated}>
      Hello, world!
    </RestrictedRoute>,
  )

  await screen.findByText("Hello, world!")
  expect(!errors.length).toBe(true)
})

test.each(
  Object.values(Permission).filter((p) => p !== Permission.Authenticated),
)(
  "Throws error if and only if lacking required permission",
  async (permission) => {
    allowConsoleErrors()
    setMockResponse.get(urls.userMe.get(), makeUser({ [permission]: false }))

    const onError = jest.fn()
    renderWithProviders(
      <TestingErrorBoundary onError={onError}>
        <RestrictedRoute requires={permission}>Hello, world!</RestrictedRoute>
      </TestingErrorBoundary>,
    )

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    const error = onError.mock.calls[0][0]
    expect(error).toEqual(new ForbiddenError("Not allowed."))
  },
)
