import React, { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ControlBar } from "./ControlBar"

/**
 * A bar whose controls never change, with one non-focusable child that comes
 * and goes. Not the editor's control bar, which has twenty-odd controls, but
 * what its observer sees when the autosave indicator swaps "Saving..." for
 * "Saved": a childList change that leaves every control where it was.
 */
const WithStatusText = () => {
  const [saving, setSaving] = useState(false)
  return (
    <ControlBar>
      <button onClick={() => setSaving((wasSaving) => !wasSaving)}>
        Toggle
      </button>
      {saving ? <span>Saving...</span> : null}
    </ControlBar>
  )
}

/** A bar that gains a control after it has mounted. */
const WithLateControl = () => {
  const [added, setAdded] = useState(false)
  return (
    <>
      {/* Outside the bar, so the press itself is not one of the controls. */}
      <button onClick={() => setAdded(true)}>Add</button>
      <ControlBar>
        <button>One</button>
        {added ? <button>Two</button> : null}
      </ControlBar>
    </>
  )
}

/**
 * The bar watches its own subtree so keyboard navigation keeps up with the
 * controls, and a change to text sitting between them is not a change to the
 * controls. Left unchecked -- as in the vendor component this one is adapted
 * from -- it re-rendered the bar and re-bound its key handler for nothing, and
 * in tests the observer's callback runs in a microtask after the `act` scope
 * that caused the mutation has closed, so the update failed whichever suite
 * happened to type while a status message came or went.
 *
 * `fireEvent` rather than `userEvent` on purpose: the press has to close its
 * `act` scope before the observer runs, which is the arrangement that failed.
 */
test("text appearing between the controls updates nothing", () => {
  render(<WithStatusText />)
  const toggle = screen.getByRole("button", { name: "Toggle" })

  fireEvent.click(toggle)
  screen.getByText("Saving...")

  fireEvent.click(toggle)
  expect(screen.queryByText("Saving...")).toBe(null)
})

test("a control added after mount is still reached by the arrow keys", async () => {
  render(<WithLateControl />)

  await userEvent.click(screen.getByRole("button", { name: "Add" }))

  const bar = screen.getByRole("toolbar")
  fireEvent.keyDown(bar, { key: "ArrowRight" })
  expect(screen.getByRole("button", { name: "One" })).toHaveFocus()

  fireEvent.keyDown(bar, { key: "ArrowRight" })
  expect(screen.getByRole("button", { name: "Two" })).toHaveFocus()
})
