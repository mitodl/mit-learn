import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import CertificateTrackCard from "./CertificateTrackCard"

describe("CertificateTrackCard", () => {
  test("renders the Certificate Track heading and subtext", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="course" />,
    )
    expect(
      screen.getByRole("heading", { name: "Certificate Track", level: 3 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Earn a verified certificate of completion"),
    ).toBeInTheDocument()
  })

  test("renders the price node", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="course" />,
    )
    expect(screen.getByText("$250")).toBeInTheDocument()
  })

  test("renders the three feature bullets with course noun", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="course" />,
    )
    expect(
      screen.getByText("Access to this course & course materials"),
    ).toBeInTheDocument()
    expect(screen.getByText("Graded assignments & exams")).toBeInTheDocument()
    expect(
      screen.getByText("MIT certificate on completion"),
    ).toBeInTheDocument()
  })

  test("renders the three feature bullets with program noun", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="program" />,
    )
    expect(
      screen.getByText("Access to this program & course materials"),
    ).toBeInTheDocument()
  })

  test("renders financial aid link with 'available' text when not applied", () => {
    const href = "https://example.com/financial-aid"
    renderWithProviders(
      <CertificateTrackCard
        price={<span>$250</span>}
        productNoun="course"
        financialAid={{ href, applied: false }}
      />,
    )
    const link = screen.getByRole("link", {
      name: "Financial assistance available",
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", href)
  })

  test("renders financial aid link with 'approved' text when applied", () => {
    const href = "https://example.com/financial-aid"
    renderWithProviders(
      <CertificateTrackCard
        price={<span>$250</span>}
        productNoun="course"
        financialAid={{ href, applied: true }}
      />,
    )
    const link = screen.getByRole("link", {
      name: "Financial assistance approved (applied at checkout)",
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", href)
  })

  test("does not render a financial aid link when financialAid is not provided", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="course" />,
    )
    expect(
      screen.queryByRole("link", { name: /Financial assistance/ }),
    ).toBeNull()
  })

  test("renders the action node when provided", () => {
    renderWithProviders(
      <CertificateTrackCard
        price={<span>$250</span>}
        productNoun="course"
        action={<button>Enroll Now</button>}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Enroll Now" }),
    ).toBeInTheDocument()
  })

  test("does not render an action when not provided", () => {
    renderWithProviders(
      <CertificateTrackCard price={<span>$250</span>} productNoun="course" />,
    )
    expect(screen.queryByRole("button")).toBeNull()
  })
})
