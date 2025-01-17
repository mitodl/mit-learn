import React from "react"
import { screen, waitForElementToBeRemoved } from "@testing-library/react"
import user from "@testing-library/user-event"
import { Popover } from "./Popover"
import type { PopoverProps } from "./Popover"
import { renderWithTheme } from "../../test-utils"

const PopoverTest = (props: Omit<PopoverProps, "anchorEl">) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)
  return (
    <div>
      <button ref={setAnchorEl}>Anchor</button>
      {anchorEl && (
        <Popover data-testid="popover" {...props} anchorEl={anchorEl}>
          <h2>Popover content</h2>
          <button>Button 1</button>
          <button>Button 2</button>
        </Popover>
      )}

      <button>Other Button</button>
    </div>
  )
}

test.each([{ modal: true }, {}, {}])(
  "Traps focus if modal = $modal",
  async ({ modal }) => {
    renderWithTheme(<PopoverTest open onClose={jest.fn()} modal={modal} />)

    const popover = screen.getByTestId("popover")
    expect(popover.contains(document.activeElement)).toBe(true)

    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Button 1" }),
    )

    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Button 2" }),
    )

    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Button 1" }),
    )
  },
)

test("Popover does not trap focus if modal=false", async () => {
  renderWithTheme(<PopoverTest open onClose={jest.fn()} modal={false} />)

  expect(document.activeElement).toBe(document.body)
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Anchor" }),
  )

  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Other Button" }),
  )

  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Button 1" }),
  )
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Button 2" }),
  )
})

test.each([
  { role: "dialog", modal: true },
  { role: "dialog" },
  { role: "tooltip", modal: false },
])("popover role is $role if $modal", ({ modal, role }) => {
  renderWithTheme(<PopoverTest open onClose={jest.fn()} modal={modal} />)
  const popover = screen.getByTestId("popover")
  const el = screen.getByRole(role)
  expect(popover).toBe(el)
})

test("Calls onClose when escape is pressed", async () => {
  const onClose = jest.fn()
  renderWithTheme(<PopoverTest open onClose={onClose} />)

  await user.type(document.body, "{esc}")
  expect(onClose).toHaveBeenCalled()
})

test("Calls onClose when clicking outside popover", async () => {
  const onClose = jest.fn()
  renderWithTheme(<PopoverTest open onClose={onClose} />)

  const popover = screen.getByTestId("popover")
  expect(popover).toBeVisible()

  await user.click(document.body)
  expect(onClose).toHaveBeenCalled()
})

test("Popover is open/closed based on 'open'", async () => {
  const onClose = jest.fn()
  const { rerender } = renderWithTheme(<PopoverTest open onClose={onClose} />)

  const popover = screen.getByTestId("popover")
  expect(popover).toBeVisible()

  rerender(<PopoverTest open={false} onClose={onClose} />)

  await waitForElementToBeRemoved(popover)
})
