import React from "react"
import { renderWithProviders, screen, setMockResponse } from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import moment from "moment"
import { faker } from "@faker-js/faker/locale/en"

const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment
const grade = mitxonline.factories.enrollment.grade
describe("EnrollmentDisplay", () => {
  const setupApis = () => {
    const ended = [
      courseEnrollment({
        run: {
          title: "A Course Ended",
          end_date: faker.date.past().toISOString(),
        },
      }),
      courseEnrollment({
        run: {
          title: "B Course Ended",
          end_date: faker.date.past().toISOString(),
        },
      }),
      courseEnrollment({
        run: { title: "C Course Ended" },
        grades: [grade({ passed: true })],
      }),
    ]
    const started = [
      courseEnrollment({
        run: {
          title: "A Course Started",
          start_date: faker.date.past().toISOString(),
        },
      }),
      courseEnrollment({
        run: {
          title: "B Course Started",
          start_date: faker.date.past().toISOString(),
        },
      }),
    ]
    const notStarted = [
      courseEnrollment({
        run: {
          start_date: moment().add(1, "day").toISOString(), // Sooner first
        },
      }),
      courseEnrollment({
        run: {
          start_date: moment().add(5, "day").toISOString(), // Later second
        },
      }),
    ]
    const mitxonlineCourseEnrollments = faker.helpers.shuffle([
      ...ended,
      ...started,
      ...notStarted,
    ])

    setMockResponse.get(
      mitxonline.urls.enrollment.courseEnrollment(),
      mitxonlineCourseEnrollments,
    )

    return {
      mitxonlineCourseEnrollments,
      mitxonlineCourses: { started, ended, notStarted },
    }
  }

  test("Renders the expected cards", async () => {
    const { mitxonlineCourses } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    screen.getByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card")
    expect(cards.length).toBe(7)

    const expectedTitled = [
      ...mitxonlineCourses.started,
      ...mitxonlineCourses.notStarted,
      ...mitxonlineCourses.ended,
    ].map((e) => e.run.title)

    expect(cards[0]).toHaveTextContent(expectedTitled[0])
    expect(cards[1]).toHaveTextContent(expectedTitled[1])
    expect(cards[2]).toHaveTextContent(expectedTitled[2])
    expect(cards[3]).toHaveTextContent(expectedTitled[3])
    expect(cards[4]).toHaveTextContent(expectedTitled[4])
    expect(cards[5]).toHaveTextContent(expectedTitled[5])
    expect(cards[6]).toHaveTextContent(expectedTitled[6])
  })
})
