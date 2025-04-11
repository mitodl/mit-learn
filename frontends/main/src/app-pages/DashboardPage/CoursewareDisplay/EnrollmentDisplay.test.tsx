import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  user,
} from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import moment from "moment"
import { faker } from "@faker-js/faker/locale/en"

const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment
const grade = mitxonline.factories.enrollment.grade
describe("EnrollmentDisplay", () => {
  const setupApis = () => {
    const completed = [
      courseEnrollment({
        run: { title: "C Course Ended" },
        grades: [grade({ passed: true })],
      }),
    ]
    const expired = [
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
      ...expired,
      ...completed,
      ...started,
      ...notStarted,
    ])

    setMockResponse.get(
      mitxonline.urls.enrollment.courseEnrollment(),
      mitxonlineCourseEnrollments,
    )

    return {
      mitxonlineCourseEnrollments,
      mitxonlineCourses: { completed, expired, started, notStarted },
    }
  }

  test("Renders the expected cards", async () => {
    const { mitxonlineCourses } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    screen.getByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const expectedTitles = [
      ...mitxonlineCourses.started,
      ...mitxonlineCourses.notStarted,
      ...mitxonlineCourses.completed,
    ].map((e) => e.run.title)

    expectedTitles.forEach((title, i) => {
      expect(cards[i]).toHaveTextContent(title)
    })
  })

  test("Clicking show all reveals ended courses", async () => {
    const { mitxonlineCourses } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    await user.click(screen.getByText("Show all"))

    screen.getByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const expectedTitles = [
      ...mitxonlineCourses.started,
      ...mitxonlineCourses.notStarted,
      ...mitxonlineCourses.completed,
      ...mitxonlineCourses.expired,
    ].map((e) => e.run.title)

    expectedTitles.forEach((title, i) => {
      expect(cards[i]).toHaveTextContent(title)
    })
  })
})
