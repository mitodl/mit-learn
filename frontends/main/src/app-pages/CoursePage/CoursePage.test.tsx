import React from "react"
import { urls, factories } from "api/mitxonline-test-utils"
import type {
  CoursePageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { setMockResponse } from "api/test-utils"
import { renderWithProviders, waitFor } from "@/test-utils"
import CoursePage from "./CoursePage"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"

import { useFeatureFlagEnabled } from "posthog-js/react"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const makeCourse = factories.courses.course
const makePage = factories.pages.coursePageItem

const setupApis = ({
  course,
  page,
}: {
  course: CourseWithCourseRunsSerializerV2
  page: CoursePageItem
}) => {
  setMockResponse.get(
    urls.courses.coursesList({ readable_id: course.readable_id }),
    { results: [course] },
  )
  setMockResponse.get(urls.pages.courseDetail(course.readable_id), {
    items: [page],
  })
}

describe("CoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

  test.each([true, false])(
    "Calls noFound if and only the feature flag is disabled",
    async (isEnabled) => {
      mockedUseFeatureFlagEnabled.mockReturnValue(isEnabled)
      const course = makeCourse()
      const page = makePage({
        course_details: course,
      })

      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />, {
        url: `/courses/${course.readable_id}/`,
      })

      if (isEnabled) {
        expect(notFound).not.toHaveBeenCalled()
      } else {
        expect(notFound).toHaveBeenCalled()
      }
    },
  )

  test("Renders expected sections", async () => {
    const course = makeCourse()
    const page = makePage({
      course_details: course,
    })

    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />, {
      url: `/courses/${course.readable_id}/`,
    })

    await waitFor(() => {
      assertHeadings([
        { level: 1, name: page.title },
        { level: 2, name: "Course summary" },
        { level: 2, name: "About this course" },
        { level: 2, name: "What you'll learn" },
        { level: 2, name: "Prerequisites" },
        { level: 2, name: "Meet your instructors" },
        { level: 2, name: "Who can take this course?" },
      ])
    })
  })
})
