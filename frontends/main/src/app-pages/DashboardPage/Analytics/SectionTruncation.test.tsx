import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "ol-components"
import SectionTruncation from "./SectionTruncation"

/**
 * Branch-level cover for the truncation footer. The page test covers the wiring
 * (that the real query's placeholder state reaches this component); driving the
 * props directly here is what makes the completion branch cheap to test — via
 * the page it would mean rendering a full result set into jsdom.
 */

const renderTruncation = (
  props: Partial<React.ComponentProps<typeof SectionTruncation>> = {},
) =>
  render(
    <ThemeProvider>
      <SectionTruncation
        shown={2}
        total={340}
        canShowAll
        isExpanding={false}
        onShowAll={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  )

test("says nothing at all when the section holds every row", () => {
  renderTruncation({ shown: 340, total: 340 })

  expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

test("marks the control busy while the expanded page is in flight", () => {
  renderTruncation({ isExpanding: true })

  const button = screen.getByRole("button", { name: "Loading…" })
  expect(button).toHaveAttribute("aria-busy", "true")
  // aria-disabled rather than disabled, so a keyboard user keeps focus.
  expect(button).toHaveAttribute("aria-disabled", "true")
  expect(button).not.toBeDisabled()
})

test("ignores a second click while already expanding", async () => {
  const onShowAll = jest.fn()
  renderTruncation({ isExpanding: true, onShowAll })

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Loading…" }))

  expect(onShowAll).not.toHaveBeenCalled()
})

test("announces nothing before the reader has asked for anything", () => {
  renderTruncation()

  expect(screen.getByRole("status")).toHaveTextContent("")
})

/**
 * The completion case is the one that needs the live region to outlive the
 * control: once every row is shown, the message and button both unmount, so a
 * region rendered inside that branch would announce into a node that no longer
 * exists.
 */
test("announces completion even though the control has gone", async () => {
  const onShowAll = jest.fn()
  const { rerender } = renderTruncation({ onShowAll })

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show all 340" }))
  expect(onShowAll).toHaveBeenCalled()

  rerender(
    <ThemeProvider>
      <SectionTruncation
        shown={340}
        total={340}
        canShowAll={false}
        isExpanding={false}
        onShowAll={onShowAll}
      />
    </ThemeProvider>,
  )

  expect(screen.getByRole("status")).toHaveTextContent(
    "Now showing all 340 rows.",
  )
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

test("announces the new count when the section is still partial", async () => {
  const onShowAll = jest.fn()
  const { rerender } = renderTruncation({ onShowAll })

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show all 340" }))

  rerender(
    <ThemeProvider>
      <SectionTruncation
        shown={3}
        total={340}
        canShowAll={false}
        isExpanding={false}
        onShowAll={onShowAll}
      />
    </ThemeProvider>,
  )

  expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 340 rows.")
})
