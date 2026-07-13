import React from "react"
import { screen } from "@testing-library/react"
import user from "@testing-library/user-event"
import { renderWithTheme } from "../../test-utils"
import { SkipLink } from "./SkipLink"

const renderBlock = (label = "Featured Courses") =>
  renderWithTheme(
    <div>
      <SkipLink.Container label={label}>
        <SkipLink.Trigger />
        <a href="#one">Card one</a>
        <a href="#two">Card two</a>
        <SkipLink.Target />
      </SkipLink.Container>
      <a href="#after">After the block</a>
    </div>,
  )

describe("SkipLink", () => {
  it("renders a 'Skip {label}' trigger pointing at a focusable 'Return to {label}' target", () => {
    renderBlock()
    const trigger = screen.getByRole("link", { name: "Skip Featured Courses" })
    const target = screen.getByRole("link", {
      name: "Return to Featured Courses",
    })
    // The trigger points at the target the Container owns...
    expect(trigger).toHaveAttribute("href", `#${target.id}`)
    // ...and the target is a real, named, focusable element that stays out of
    // the normal tab order (tabindex=-1), so it's only a focus stop for users
    // who activate the skip.
    expect(target).toHaveAttribute("tabindex", "-1")
  })

  it("lands focus on the named 'Return to {label}' target, skipping the block", async () => {
    renderBlock()
    const trigger = screen.getByRole("link", { name: "Skip Featured Courses" })

    // Activating the skip link lands focus on the Container's own "Return to
    // {label}" link at the end of the block — a deterministic, named
    // destination — rather than the repeated card links inside it.
    await user.click(trigger)
    expect(
      screen.getByRole("link", { name: "Return to Featured Courses" }),
    ).toHaveFocus()
    expect(screen.getByRole("link", { name: "Card one" })).not.toHaveFocus()
  })

  it("sends focus back to the trigger when the 'Return to {label}' link is activated", async () => {
    renderBlock()
    const trigger = screen.getByRole("link", { name: "Skip Featured Courses" })
    const returnLink = screen.getByRole("link", {
      name: "Return to Featured Courses",
    })

    await user.click(returnLink)
    expect(trigger).toHaveFocus()
  })

  it("allows custom trigger text", () => {
    renderWithTheme(
      <SkipLink.Container label="Featured Courses">
        <SkipLink.Trigger>Skip to results</SkipLink.Trigger>
        <SkipLink.Target />
      </SkipLink.Container>,
    )
    expect(
      screen.getByRole("link", { name: "Skip to results" }),
    ).toBeInTheDocument()
  })

  it("generates a unique target id per Container so multiple instances don't collide", () => {
    renderWithTheme(
      <div>
        <SkipLink.Container label="Featured Courses">
          <SkipLink.Trigger />
          <SkipLink.Target />
        </SkipLink.Container>
        <SkipLink.Container label="Popular Courses">
          <SkipLink.Trigger />
          <SkipLink.Target />
        </SkipLink.Container>
      </div>,
    )
    const first = screen
      .getByRole("link", { name: "Skip Featured Courses" })
      .getAttribute("href")
    const second = screen
      .getByRole("link", { name: "Skip Popular Courses" })
      .getAttribute("href")
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toEqual(second)
  })

  describe("standalone (skip-to-landmark) mode", () => {
    it("links a standalone Trigger to an existing element by id and focuses it", async () => {
      renderWithTheme(
        <div>
          <nav aria-label="Skip links">
            <SkipLink.Trigger targetId="main-content">
              Skip to main content
            </SkipLink.Trigger>
          </nav>
          <main id="main-content" tabIndex={-1}>
            <a href="#somewhere">Inside main</a>
          </main>
        </div>,
      )
      const trigger = screen.getByRole("link", {
        name: "Skip to main content",
      })
      expect(trigger).toHaveAttribute("href", "#main-content")

      await user.click(trigger)
      expect(document.getElementById("main-content")).toHaveFocus()
    })

    it("renders a standalone Target with an explicit id", () => {
      renderWithTheme(<SkipLink.Target id="my-target" />)
      const target = document.getElementById("my-target")
      expect(target).toBeInTheDocument()
      expect(target).toHaveAttribute("tabindex", "-1")
    })

    it("throws if a Trigger has neither a targetId nor a Container", () => {
      // Rendering throws in the component; silence the expected React logging.
      const spy = jest.spyOn(console, "error").mockImplementation(() => {})
      expect(() =>
        renderWithTheme(<SkipLink.Trigger>Skip</SkipLink.Trigger>),
      ).toThrow(/targetId/)
      spy.mockRestore()
    })

    it("throws if a standalone Trigger has no children (would be a nameless link)", () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {})
      expect(() =>
        renderWithTheme(<SkipLink.Trigger targetId="somewhere" />),
      ).toThrow(/children/)
      spy.mockRestore()
    })
  })
})
