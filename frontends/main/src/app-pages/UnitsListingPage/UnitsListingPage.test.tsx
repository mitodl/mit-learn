import React from "react"
import { renderWithProviders, screen, waitFor, within } from "@/test-utils"
import type { LearningResourcesSearchResponse } from "api"
import UnitsListingPage from "./UnitsListingPage"
import { factories, setMockResponse, urls } from "api/test-utils"
import { assertHeadings } from "ol-test-utilities"

const makeSearchResponse = (
  aggregations: Record<string, number>,
): LearningResourcesSearchResponse => {
  return {
    metadata: {
      suggestions: [],
      aggregations: {
        topic: Object.entries(aggregations).map(([key, docCount]) => ({
          key,
          doc_count: docCount,
        })),
      },
    },
    count: 0,
    results: [],
    next: null,
    previous: null,
  }
}

describe("DepartmentListingPage", () => {
  const setupApis = () => {
    const make = factories.learningResources
    const academicUnit1 = make.offeror({
      code: "academicUnit1",
      name: "Academic Unit 1",
      value_prop: "Academic Unit 1 value prop",
      professional: false,
    })
    const academicUnit2 = make.offeror({
      code: "academicUnit2",
      name: "Academic Unit 2",
      value_prop: "Academic Unit 2 value prop",
      professional: false,
    })
    const academicUnit3 = make.offeror({
      code: "academicUnit3",
      name: "Academic Unit 3",
      value_prop: "Academic Unit 3 value prop",
      professional: false,
    })

    const professionalUnit1 = make.offeror({
      code: "professionalUnit1",
      name: "Professional Unit 1",
      value_prop: "Professional Unit 1 value prop",
      professional: true,
    })
    const professionalUnit2 = make.offeror({
      code: "professionalUnit2",
      name: "Professional Unit 2",
      value_prop: "Professional Unit 2 value prop",
      professional: true,
    })
    const professionalUnit3 = make.offeror({
      code: "professionalUnit3",
      name: "Professional Unit 3",
      value_prop: "Professional Unit 3 value prop",
      professional: true,
    })

    const units = [
      academicUnit1,
      academicUnit2,
      academicUnit3,
      professionalUnit1,
      professionalUnit2,
      professionalUnit3,
    ]
    const courseCounts = {
      academicUnit1: 10,
      academicUnit2: 20,
      academicUnit3: 1,
      professionalUnit1: 40,
      professionalUnit2: 50,
      professionalUnit3: 0,
    }
    const programCounts = {
      academicUnit1: 1,
      academicUnit2: 2,
      academicUnit3: 0,
      professionalUnit1: 4,
      professionalUnit2: 5,
      professionalUnit3: 6,
    }

    setMockResponse.get(urls.channels.counts("unit"), [
      {
        name: academicUnit1,
        counts: {
          programs: 7,
          courses: 10,
        },
      },
    ])
    setMockResponse.get(urls.offerors.list(), units)

    setMockResponse.get(
      urls.search.resources({
        resource_type: ["course"],
        aggregations: ["offered_by"],
      }),
      makeSearchResponse(courseCounts),
    )
    setMockResponse.get(
      urls.search.resources({
        resource_type: ["program"],
        aggregations: ["offered_by"],
      }),
      makeSearchResponse(programCounts),
    )

    units.forEach((unit) => {
      setMockResponse.get(urls.channels.details("unit", unit.code), {
        channel_url: `/units/${unit.code}`,
      })
    })

    return {
      units,
      courseCounts,
      programCounts,
    }
  }

  it("Has a page title", async () => {
    setupApis()
    renderWithProviders(<UnitsListingPage />)
    screen.getByRole("heading", { name: "Academic & Professional Learning" })
  })

  it("Shows unit properties within the proper section", async () => {
    const { units, courseCounts, programCounts } = setupApis()
    renderWithProviders(<UnitsListingPage />)
    await waitFor(() => {
      const academicSection = screen.getByTestId("UnitSection-academic")
      const professionalSection = screen.getByTestId("UnitSection-professional")
      units.forEach(async (unit) => {
        const section = unit.professional
          ? professionalSection
          : academicSection
        const channelLink = await within(section).findByRole("link", {
          name: unit.name,
        })
        const logoImage = await within(section).findByAltText(unit.name)
        const valuePropText = await within(section).findByText(
          unit.value_prop ? unit.value_prop : "",
        )
        expect(channelLink).toHaveAttribute("href", `/units/${unit.code}`)
        expect(logoImage).toHaveAttribute(
          "src",
          `/images/units/${unit.code}.svg`,
        )
        expect(valuePropText).toBeInTheDocument()
        const courseCount = courseCounts[unit.code as keyof typeof courseCounts]
        const programCount =
          programCounts[unit.code as keyof typeof programCounts]
        const courseCountText = await within(section).findByTestId(
          `course-count-${unit.code}`,
        )
        const programCountText = await within(section).findByTestId(
          `program-count-${unit.code}`,
        )
        if (courseCount > 0) {
          expect(courseCountText).toHaveTextContent(`Courses: ${courseCount}`)
        } else {
          expect(courseCountText).toHaveTextContent("")
        }
        if (programCount > 0) {
          expect(programCountText).toHaveTextContent(
            `Programs: ${programCount}`,
          )
        } else {
          expect(programCountText).toHaveTextContent("")
        }
      })
    })
  })

  test("headings", async () => {
    setupApis()
    renderWithProviders(<UnitsListingPage />)

    assertHeadings([
      { level: 1, name: "Academic & Professional Learning" },
      { level: 2, name: "Academic Units" },
      { level: 2, name: "Professional Units" },
    ])
  })
})
