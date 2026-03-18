import React from "react"
import { screen } from "@testing-library/react"
import MitxOnlineResourceCard from "./MitxOnlineResourceCard"
import { factories } from "api/mitxonline-test-utils"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders } from "@/test-utils"
import type { MitxOnlineResourceCardProps } from "./MitxOnlineResourceCard"

const renderCard = (props: MitxOnlineResourceCardProps) =>
  renderWithProviders(<MitxOnlineResourceCard {...props} />)

const freeMode = factories.courses.enrollmentMode({ requires_payment: false })
const paidMode = factories.courses.enrollmentMode({ requires_payment: true })

describe("MitxOnlineResourceCard", () => {
  describe("loading and empty states", () => {
    test("renders loading state when isLoading", () => {
      renderCard({
        href: "/test",
        isLoading: true,
        resourceType: "course",
      })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    test("returns null when no resource and not loading (course)", () => {
      renderCard({ href: "/test", resourceType: "course" })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    test("returns null when no resource and not loading (program)", () => {
      renderCard({ href: "/test", resourceType: "program" })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })
  })

  describe("course cards", () => {
    test("renders course title and link", () => {
      const course = factories.courses.course()
      renderCard({
        resource: course,
        resourceType: "course",
        href: `/courses/${course.readable_id}`,
      })
      const link = screen.getByRole("link", {
        name: new RegExp(course.title),
      })
      expect(link).toHaveAttribute("href", `/courses/${course.readable_id}`)
    })

    test("shows 'Course' resource type", () => {
      const course = factories.courses.course()
      renderCard({ resource: course, resourceType: "course", href: "/test" })
      expect(screen.getByText("Course")).toBeInTheDocument()
    })
  })

  describe("program cards", () => {
    test("renders program title and link", () => {
      const program = factories.programs.program()
      renderCard({
        resource: program,
        resourceType: "program",
        href: `/programs/${program.readable_id}`,
      })
      const link = screen.getByRole("link", {
        name: new RegExp(program.title),
      })
      expect(link).toHaveAttribute("href", `/programs/${program.readable_id}`)
    })

    test("shows 'Course' resource type for display_mode=course", () => {
      const program = factories.programs.program({
        display_mode: DisplayModeEnum.Course,
      })
      renderCard({ resource: program, resourceType: "program", href: "/test" })
      expect(screen.getByText("Course")).toBeInTheDocument()
    })

    test("shows 'Program' resource type for default display_mode", () => {
      const program = factories.programs.program()
      renderCard({ resource: program, resourceType: "program", href: "/test" })
      expect(screen.getByText("Program")).toBeInTheDocument()
    })
  })

  describe("enrollment-based pricing", () => {
    test("shows product price when paid-only (course)", () => {
      const course = factories.courses.course({
        min_price: 200,
        max_price: 200,
        courseruns: [
          factories.courses.courseRun({
            enrollment_modes: [paidMode],
            products: [factories.courses.product({ price: "200.00" })],
          }),
        ],
      })
      const {
        view: { container },
      } = renderCard({
        resource: course,
        resourceType: "course",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$200.00")
    })

    test("shows 'Free' when enrollment is free-only", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("Free")
      expect(container.textContent).not.toContain("$")
    })

    test("shows product price when paid-only (program)", () => {
      const program = factories.programs.program({
        enrollment_modes: [paidMode],
        min_price: 500,
        max_price: 500,
        products: [factories.courses.product({ price: "500.00" })],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$500.00")
    })

    test("shows price range when min and max differ", () => {
      const program = factories.programs.program({
        enrollment_modes: [paidMode],
        min_price: 100,
        max_price: 500,
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$100.00 - $500.00")
    })

    test("shows 'Free' and certificate price when both free and paid", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode, paidMode],
        min_price: 500,
        max_price: 500,
        products: [factories.courses.product({ price: "500.00" })],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("Free")
      expect(container.textContent).toContain("$500.00")
    })

    test("shows no price when no enrollment modes", () => {
      const program = factories.programs.program({
        enrollment_modes: [],
        min_price: 500,
        max_price: 500,
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).not.toContain("$")
      expect(container.textContent).not.toContain("Free")
    })
  })
})
