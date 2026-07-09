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
  it("renders a link labelled 'Skip {label}' targeting the sentinel", () => {
    renderBlock()
    const trigger = screen.getByRole("link", { name: "Skip Featured Courses" })
    const targetId = trigger.getAttribute("href")?.slice(1)
    expect(targetId).toBeTruthy()
    const target = document.getElementById(targetId as string)
    expect(target).toBeInTheDocument()
    expect(target).toHaveAttribute("tabindex", "-1")
  })

  it("moves focus to the target when activated, so the next Tab exits the block", async () => {
    renderBlock()
    const trigger = screen.getByRole("link", { name: "Skip Featured Courses" })
    const targetId = trigger.getAttribute("href")?.slice(1)
    const target = document.getElementById(targetId as string)

    await user.click(trigger)
    expect(target).toHaveFocus()

    // From the target, the next focusable element is after the block — the
    // repeated cards have been skipped entirely.
    await user.tab()
    expect(screen.getByRole("link", { name: "After the block" })).toHaveFocus()
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
  })
})
