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

describe("MitxOnlineProgramCard", () => {
  test("renders loading state when isLoading", () => {
    renderCard({ href: "/test", isLoading: true })
    // Should not render a link when loading
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

  test("shows certificate price in list mode when certificate_type is set", () => {
    const program = factories.programs.program({
      certificate_type: "program_certificate",
      products: [factories.courses.product({ price: 500 })],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).toContain("$500.00")
    expect(container.textContent).toContain("Certificate")
  })

  test("shows price when no certificate_type", () => {
    const program = factories.programs.program({
      certificate_type: "",
      products: [factories.courses.product({ price: 100 })],
    })
    const { container } = renderCard({ program, href: "/test", list: true })
    expect(container.textContent).toContain("$100.00")
  })
})
