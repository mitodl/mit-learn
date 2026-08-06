import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import React from "react"
import { LinkAdapter } from "./LinkAdapter"
import { renderWithTheme } from "../../test-utils"

/**
 * These use a hash href deliberately. jsdom follows a hash href cleanly, so
 * `window.location.hash` is the evidence that the browser's default ran; a
 * cross-document href would instead emit "Not implemented: navigation" on
 * console.error, which the shared setup turns into a failure.
 */
test("A plain click pushes pushUrl instead of following href", async () => {
  renderWithTheme(
    <LinkAdapter href="#canonical" pushUrl="?sortby=new&resource=1">
      Go
    </LinkAdapter>,
  )

  await user.click(screen.getByRole("link"))

  expect(window.location.search).toBe("?sortby=new&resource=1")
  expect(window.location.hash).toBe("")
})

/**
 * One row per modifier, because this is the test that pins the modifier list
 * itself and each key is a separate operand of the guard — dropping one is the
 * plausible mis-implementation, and Ctrl is the Windows/Linux new-tab gesture.
 *
 * `user.setup()` matters: the re-exported `user` mints fresh keyboard state per
 * call, so a preceding `user.keyboard("{Meta>}")` would not modify the click.
 */
test.each([
  { modifier: "Meta" },
  { modifier: "Control" },
  { modifier: "Shift" },
  { modifier: "Alt" },
])(
  "$modifier-click is left to the browser, so it follows href",
  async ({ modifier }) => {
    renderWithTheme(
      <LinkAdapter href="#canonical" pushUrl="?sortby=new&resource=1">
        Go
      </LinkAdapter>,
    )
    const u = user.setup()
    await u.keyboard(`{${modifier}>}`)

    await u.click(screen.getByRole("link"))

    expect(window.location.hash).toBe("#canonical")
  },
)

test("A click already prevented by a caller's onClick is left alone", async () => {
  renderWithTheme(
    <LinkAdapter
      href="#canonical"
      pushUrl="?sortby=new&resource=1"
      onClick={(e) => e.preventDefault()}
    >
      Go
    </LinkAdapter>,
  )

  await user.click(screen.getByRole("link"))

  expect(window.location.search).not.toContain("sortby=new")
})

test("A link with a target is left alone", async () => {
  renderWithTheme(
    <LinkAdapter
      href="#canonical"
      pushUrl="?sortby=new&resource=1"
      target="_blank"
    >
      Go
    </LinkAdapter>,
  )

  await user.click(screen.getByRole("link"))

  expect(window.location.search).not.toContain("sortby=new")
})
