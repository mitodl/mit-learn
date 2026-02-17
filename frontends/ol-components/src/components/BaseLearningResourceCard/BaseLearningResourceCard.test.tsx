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

  describe("List mode", () => {
    it("renders in list mode", () => {
      renderCard({
        list: true,
        title: "List Course",
        resourceType: "Course",
        coursePrice: "$100",
        hasCertificate: true,
        certificatePrice: "$50",
        certificateTypeName: "Professional Certificate",
      })

      expect(screen.getByText("List Course")).toBeInTheDocument()
      expect(screen.getByText("Course")).toBeInTheDocument()
    })

    it("renders in condensed list mode", () => {
      renderCard({
        list: true,
        condensed: true,
        title: "Condensed Course",
        resourceType: "Course",
        coursePrice: "$100",
      })

      expect(screen.getByText("Condensed Course")).toBeInTheDocument()
      expect(screen.getByText("Course")).toBeInTheDocument()
    })

    it("displays certificate with type name in list mode", () => {
      renderCard({
        list: true,
        title: "Certified Course",
        hasCertificate: true,
        certificatePrice: "$50",
        certificateTypeName: "MicroMasters Credential",
      })

      expect(screen.getByText("MicroMasters Credential:")).toBeInTheDocument()
    })

    it("displays certificate price in list mode", () => {
      renderCard({
        list: true,
        title: "Priced Course",
        hasCertificate: true,
        certificatePrice: "$99",
        coursePrice: "$99",
      })

      const prices = screen.getAllByText("$99")
      expect(prices.length).toBeGreaterThan(0)
    })

    it("displays generic certificate label when no type name provided", () => {
      renderCard({
        list: true,
        title: "Generic Cert Course",
        hasCertificate: true,
        certificatePrice: "$50",
      })

      // Appears twice due to responsive display (mobile + desktop variants)
      const certificates = screen.getAllByText("Certificate:")
      expect(certificates.length).toBeGreaterThan(0)
    })

    it("renders footerContent when provided in list mode", () => {
      renderCard({
        list: true,
        title: "Course with Footer",
        footerContent: <div data-testid="custom-footer">Custom Footer</div>,
      })

      expect(screen.getByTestId("custom-footer")).toBeInTheDocument()
      expect(screen.getByText("Custom Footer")).toBeInTheDocument()
    })

    it("renders loading state in list mode", () => {
      renderCard({
        list: true,
        isLoading: true,
      })

      const skeletons = screen.getAllByRole("generic").filter((el) => {
        return el.tagName === "SPAN" && el.className.includes("MuiSkeleton")
      })
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it("renders loading state in condensed list mode", () => {
      renderCard({
        list: true,
        condensed: true,
        isLoading: true,
      })

      const skeletons = screen.getAllByRole("generic").filter((el) => {
        return el.tagName === "SPAN" && el.className.includes("MuiSkeleton")
      })
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it("does not display certificate when hasCertificate is false", () => {
      renderCard({
        list: true,
        title: "No Certificate Course",
        hasCertificate: false,
        coursePrice: "$100",
      })

      expect(screen.queryByText("Certificate")).not.toBeInTheDocument()
    })
  })
})
