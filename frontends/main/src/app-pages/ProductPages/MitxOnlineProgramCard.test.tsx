import React from "react"
import { render, screen } from "@testing-library/react"
import MitxOnlineProgramCard from "./MitxOnlineProgramCard"
import { factories } from "api/mitxonline-test-utils"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { ThemeProvider } from "ol-components"

const renderCard = (
  props: React.ComponentProps<typeof MitxOnlineProgramCard>,
) =>
  render(
    <ThemeProvider>
      <MitxOnlineProgramCard {...props} />
    </ThemeProvider>,
  )

const freeMode = factories.courses.enrollmentMode({ requires_payment: false })
const paidMode = factories.courses.enrollmentMode({ requires_payment: true })

describe("MitxOnlineProgramCard", () => {
  test("renders loading state when isLoading", () => {
    renderCard({ href: "/test", isLoading: true })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  test("returns null when no program and not loading", () => {
    renderCard({ href: "/test" })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  test("renders program title and link", () => {
    const program = factories.programs.program()
    renderCard({ program, href: `/programs/${program.readable_id}` })
    const link = screen.getByRole("link", { name: new RegExp(program.title) })
    expect(link).toHaveAttribute("href", `/programs/${program.readable_id}`)
  })

  test("shows 'Course' resource type for display_mode=course", () => {
    const program = factories.programs.program({
      display_mode: DisplayModeEnum.Course,
    })
    renderCard({ program, href: "/test" })
    expect(screen.getByText("Course")).toBeInTheDocument()
  })

  test("shows 'Program' resource type for default display_mode", () => {
    const program = factories.programs.program()
    renderCard({ program, href: "/test" })
    expect(screen.getByText("Program")).toBeInTheDocument()
  })

  test("shows 'Free' when enrollment is free-only", () => {
    const program = factories.programs.program({
      enrollment_modes: [freeMode],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).toContain("Free")
    expect(container.textContent).not.toContain("$")
  })

  test("shows product price as course price when paid-only", () => {
    const program = factories.programs.program({
      enrollment_modes: [paidMode],
      products: [factories.courses.product({ price: "500.00" })],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).toContain("$500.00")
  })

  test("shows 'Free' and certificate price when both free and paid", () => {
    const program = factories.programs.program({
      enrollment_modes: [freeMode, paidMode],
      products: [factories.courses.product({ price: "500.00" })],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).toContain("Free")
    expect(container.textContent).toContain("$500.00")
  })

  test("shows no price when no enrollment modes", () => {
    const program = factories.programs.program({
      enrollment_modes: [],
      products: [factories.courses.product({ price: "500.00" })],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).not.toContain("$")
    expect(container.textContent).not.toContain("Free")
  })
})
