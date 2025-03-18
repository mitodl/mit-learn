import React from "react"
import { renderWithProviders, screen, setMockResponse } from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import * as mitxonline from "api/mitxonline-test-utils"

describe("EnrollmentDisplay", () => {
  const setupApis = () => {
    const mitxonlineCourseEnrollments =
      mitxonline.factories.enrollment.courseEnrollments(3)

    setMockResponse.get(
      mitxonline.urls.enrollment.courseEnrollment,
      mitxonlineCourseEnrollments,
    )

    return { mitxonlineCourseEnrollments }
  }

  test("Renders the expected cards", async () => {
    const { mitxonlineCourseEnrollments } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    screen.getByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card")
    expect(cards).toHaveLength(3)

    const titles = mitxonlineCourseEnrollments.map((e) => e.run.title)
    expect(cards[0]).toHaveTextContent(titles[0])
    expect(cards[1]).toHaveTextContent(titles[1])
    expect(cards[2]).toHaveTextContent(titles[2])
  })
})
