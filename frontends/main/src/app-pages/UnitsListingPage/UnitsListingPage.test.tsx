import React from "react"
import { renderWithProviders, screen, waitFor, within } from "@/test-utils"
import UnitsListingPage from "./UnitsListingPage"
import { factories, setMockResponse, urls } from "api/test-utils"
import { assertHeadings } from "ol-test-utilities"

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

    const units = [
      academicUnit1,
      academicUnit2,
      academicUnit3,
      professionalUnit1,
      professionalUnit2,
    ]
    const courseCounts: Record<string, number> = {
      academicUnit1: 10,
      academicUnit2: 20,
      academicUnit3: 1,
      professionalUnit1: 40,
      professionalUnit2: 0,
    }
    const programCounts: Record<string, number> = {
      academicUnit1: 1,
      academicUnit2: 2,
      academicUnit3: 0,
      professionalUnit1: 4,
      professionalUnit2: 5,
    }

    setMockResponse.get(
      urls.channels.counts("unit"),
      units.map((unit) => {
        return {
          name: unit.code,
          counts: {
            courses: courseCounts[unit.code],
            programs: programCounts[unit.code],
          },
        }
      }),
    )
    setMockResponse.get(urls.offerors.list(), {
      count: units.length,
      results: units,
    })

    units.forEach((unit) => {
      setMockResponse.get(urls.channels.details("unit", unit.code), {
        channel_url: `${window.location.origin}/units/${unit.code}`,
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

    const academicSection = screen.getByTestId("UnitSection-academic")
    const professionalSection = screen.getByTestId("UnitSection-professional")

    await waitFor(() => {
      const links = within(academicSection).getAllByRole("link")
      expect(links).toHaveLength(3)
      return links
    })
    await waitFor(() => {
      const links = within(professionalSection).getAllByRole("link")
      expect(links).toHaveLength(2)
      return links
    })

    units.forEach((unit) => {
      const section = unit.professional ? professionalSection : academicSection
      const card = within(section).getByTestId(`unit-card-${unit.code}`)
      const link = within(card).getByRole("link")
      expect(link).toHaveAttribute("href", `/units/${unit.code}`)

      const courseCount = courseCounts[unit.code]
      const programCount = programCounts[unit.code]
      const courseCountEl = within(card).getByTestId(
        `course-count-${unit.code}`,
      )
      const programCountEl = within(card).getByTestId(
        `program-count-${unit.code}`,
      )
      expect(courseCountEl).toHaveTextContent(
        courseCount > 0 ? `Courses: ${courseCount}` : "",
      )
      expect(programCountEl).toHaveTextContent(
        programCount > 0 ? `Programs: ${programCount}` : "",
      )
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
