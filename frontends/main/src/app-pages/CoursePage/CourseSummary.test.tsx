import React from "react"
import { factories } from "api/mitxonline-test-utils"

import { renderWithProviders, screen, within } from "@/test-utils"
import { CourseSummary } from "./CourseSummary"

const makeCourse = factories.courses.course

describe("CourseSummary", () => {
  test("renders course summary", async () => {
    const course = makeCourse()
    renderWithProviders(<CourseSummary course={course} />)

    const summary = screen.getByRole("region", { name: "Course summary" })
    within(summary).getByRole("heading", { name: "Course summary" })
  })
})
