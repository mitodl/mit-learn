import React from "react"
import { renderWithProviders, screen } from "../../test-utils"
import RestrictedRoute from "./RestrictedRoute"
import { Permission } from "api/hooks/user"
import { allowConsoleErrors } from "ol-test-utilities"

test("Renders children if permission check satisfied", () => {
  const errors: unknown[] = []

  renderWithProviders(
    <RestrictedRoute requires={Permission.Authenticated}>
      Hello, world!
    </RestrictedRoute>,

    {
      user: { [Permission.Authenticated]: true },
    },
  )

  screen.getByText("Hello, world!")
  expect(!errors.length).toBe(true)
})

test.each(Object.values(Permission))(
  "Throws error if and only if lacking required permission",
  async (permission) => {
    // if a user is not authenticated they are redirected to login before an error is thrown
    if (permission === Permission.Authenticated) {
      return
    }
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <RestrictedRoute requires={permission}>Hello, world!</RestrictedRoute>,
        {
          user: { [permission]: false },
        },
      ),
    ).toThrow("Not allowed.")
  },
)
