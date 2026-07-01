import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import LearnForFreeCard from "./LearnForFreeCard"

describe("LearnForFreeCard", () => {
  test("renders the Learn for Free heading", () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(
      screen.getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()
  })

  test("renders the audit subtext using productNoun", () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(screen.getByText("Audit this course")).toBeInTheDocument()
  })

  test("renders the audit subtext for program noun", () => {
    renderWithProviders(<LearnForFreeCard productNoun="program" />)
    expect(screen.getByText("Audit this program")).toBeInTheDocument()
  })

  test('renders "Free"', () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(screen.getByText("Free")).toBeInTheDocument()
  })

  test("renders the access bullet with course noun", () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(
      screen.getByText("Access to this course & course materials"),
    ).toBeInTheDocument()
  })

  test("renders the access bullet with program noun", () => {
    renderWithProviders(<LearnForFreeCard productNoun="program" />)
    expect(
      screen.getByText("Access to this program & course materials"),
    ).toBeInTheDocument()
  })

  test("shows certificate deadline note when certificateDeadlineNote is true", () => {
    renderWithProviders(
      <LearnForFreeCard productNoun="course" certificateDeadlineNote={true} />,
    )
    expect(screen.getByText("Certificate deadline passed")).toBeInTheDocument()
  })

  test("does not show certificate deadline note when certificateDeadlineNote is falsy", () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(screen.queryByText("Certificate deadline passed")).toBeNull()
  })

  test("renders free-path content and the embedded action", () => {
    renderWithProviders(
      <LearnForFreeCard
        productNoun="course"
        action={<button>Start Learning</button>}
      />,
    )
    expect(
      screen.getByRole("heading", { name: "Learn for Free" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Start Learning" }),
    ).toBeInTheDocument()
  })

  test("does not render an action when not provided", () => {
    renderWithProviders(<LearnForFreeCard productNoun="course" />)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
