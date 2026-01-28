import React from "react"
import { render, screen } from "@testing-library/react"
import { BaseLearningResourceCard } from "./BaseLearningResourceCard"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"

const renderCard = (
  props: React.ComponentProps<typeof BaseLearningResourceCard>,
) => {
  return render(
    <ThemeProvider>
      <BaseLearningResourceCard {...props} />
    </ThemeProvider>,
  )
}

describe("BaseLearningResourceCard", () => {
  it("renders loading skeleton when isLoading is true", () => {
    renderCard({ isLoading: true })
    // Just verify it renders without throwing
    expect(document.querySelector(".MitCard-root")).toBeInTheDocument()
  })

  it("renders with all display data", () => {
    renderCard({
      imageSrc: "https://example.com/image.jpg",
      imageAlt: "Course image",
      title: "Introduction to Programming",
      resourceType: "Course",
      coursePrice: "$100",
      hasCertificate: true,
      certificatePrice: "$50",
      startLabel: "Starts: ",
      startDate: "Jan 15, 2026",
      href: "/courses/intro-programming",
      ariaLabel: "Course: Introduction to Programming",
    })

    expect(screen.getByText("Introduction to Programming")).toBeInTheDocument()
    expect(screen.getByText("Course")).toBeInTheDocument()
    expect(screen.getByText("$100")).toBeInTheDocument()
    expect(screen.getByText("Starts:")).toBeInTheDocument()
    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument()
  })

  it("renders without optional fields", () => {
    renderCard({
      title: "Basic Course",
      href: "/courses/basic",
    })

    expect(screen.getByText("Basic Course")).toBeInTheDocument()
  })

  it("renders action buttons when provided", () => {
    const handleClick = jest.fn()
    renderCard({
      title: "Course with Actions",
      actions: [
        {
          onClick: handleClick,
          "aria-label": "Add to list",
          icon: <span>+</span>,
          filled: false,
        },
      ],
    })

    const button = screen.getByRole("button", { name: "Add to list" })
    expect(button).toBeInTheDocument()
  })
})
