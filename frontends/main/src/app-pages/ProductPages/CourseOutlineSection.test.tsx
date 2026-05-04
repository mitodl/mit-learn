import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
import type { CourseOutlineModule } from "api/mitxonline-hooks/courses"
import CourseOutlineSection from "./CourseOutlineSection"

const makeModule = (
  module: Partial<CourseOutlineModule> &
    Pick<CourseOutlineModule, "id" | "title">,
): CourseOutlineModule => ({
  effort_time: 0,
  effort_activities: 0,
  counts: {
    videos: 0,
    readings: 0,
    problems: 0,
    assignments: 0,
    app_items: 0,
  },
  ...module,
})

describe("CourseOutlineSection", () => {
  test("renders static course content cards with metadata line", async () => {
    const modules: CourseOutlineModule[] = [
      makeModule({ id: "m1", title: "No effort" }),
      makeModule({ id: "m2", title: "Under one hour", effort_time: 3599 }),
      makeModule({ id: "m3", title: "Exactly one hour", effort_time: 3600 }),
      makeModule({ id: "m4", title: "Plural hours", effort_time: 7200 }),
    ]

    renderWithProviders(<CourseOutlineSection modules={modules} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })

    expect(
      within(section).getByText("There are 4 lectures in this course"),
    ).toBeInTheDocument()
    expect(
      within(section).getByText("0 Videos . 0 Readings . 0 Assignments"),
    ).toBeInTheDocument()
    expect(
      within(section).getByText(
        "Less than 1 hour to complete . 0 Videos . 0 Readings . 0 Assignments",
      ),
    ).toBeInTheDocument()
    expect(
      within(section).getByText(
        "1 hour to complete . 0 Videos . 0 Readings . 0 Assignments",
      ),
    ).toBeInTheDocument()
    expect(
      within(section).getByText(
        "2 hours to complete . 0 Videos . 0 Readings . 0 Assignments",
      ),
    ).toBeInTheDocument()
  })

  test("shows counts inline without requiring expansion", async () => {
    const modules: CourseOutlineModule[] = [
      {
        ...makeModule({ id: "m1", title: "Intro" }),
        counts: {
          videos: 1,
          readings: 2,
          problems: 0,
          assignments: 3,
          app_items: 0,
        },
      },
      {
        ...makeModule({ id: "m2", title: "Deep dive" }),
        counts: {
          videos: 4,
          readings: 5,
          problems: 0,
          assignments: 6,
          app_items: 0,
        },
      },
    ]

    renderWithProviders(<CourseOutlineSection modules={modules} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })
    expect(
      within(section).getByText("1 Video . 2 Readings . 3 Assignments"),
    ).toBeInTheDocument()
    expect(
      within(section).getByText("4 Videos . 5 Readings . 6 Assignments"),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Intro/i }),
    ).not.toBeInTheDocument()
  })

  test("falls back to Module N title when title is missing", async () => {
    const modules: CourseOutlineModule[] = [
      makeModule({ id: "m1", title: "   " }),
      makeModule({ id: "m2", title: "" }),
    ]

    renderWithProviders(<CourseOutlineSection modules={modules} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })
    expect(within(section).getByText("Module 1")).toBeInTheDocument()
    expect(within(section).getByText("Module 2")).toBeInTheDocument()
  })

  test("defaults included counts to zero when module counts are missing", async () => {
    const modules: CourseOutlineModule[] = [
      makeModule({ id: "m1", title: "Intro" }),
    ]

    renderWithProviders(<CourseOutlineSection modules={modules} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })

    expect(
      within(section).getByText("0 Videos . 0 Readings . 0 Assignments"),
    ).toBeInTheDocument()
  })
})
