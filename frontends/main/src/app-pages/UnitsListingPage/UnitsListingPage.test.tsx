import React from "react"
import { renderWithProviders, screen, waitFor, within } from "@/test-utils"
import UnitsListingPage from "./UnitsListingPage"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ChannelTypeEnum } from "api/v0"
import type { UnitChannel } from "api/v0"
import { assertHeadings } from "ol-test-utilities"

describe("UnitListingPage", () => {
  const setupApis = () => {
    const make = factories.channels
    const academicUnit1 = make.channel({
      channel_type: ChannelTypeEnum.Unit,
      name: "academicUnit1",
      title: "Academic Unit 1",
      unit_detail: {
        unit: {
          value_prop: "Academic Unit 1 value prop",
          professional: false,
        },
      },
    })
    const academicUnit2 = make.channel({
      channel_type: ChannelTypeEnum.Unit,
      name: "academicUnit2",
      title: "Academic Unit 2",
      unit_detail: {
        unit: {
          value_prop: "Academic Unit 2 value prop",
          professional: false,
        },
      },
    })
    const academicUnit3 = make.channel({
      channel_type: ChannelTypeEnum.Unit,
      name: "academicUnit3",
      title: "Academic Unit 3",
      unit_detail: {
        unit: {
          value_prop: "Academic Unit 3 value prop",
          professional: false,
        },
      },
    })

    const professionalUnit1 = make.channel({
      channel_type: ChannelTypeEnum.Unit,
      name: "professionalUnit1",
      title: "Professional Unit 1",
      unit_detail: {
        unit: {
          value_prop: "Professional Unit 1 value prop",
          professional: true,
        },
      },
    })
    const professionalUnit2 = make.channel({
      channel_type: ChannelTypeEnum.Unit,
      name: "professionalUnit2",
      title: "Professional Unit 2",
      unit_detail: {
        unit: {
          value_prop: "Professional Unit 2 value prop",
          professional: true,
        },
      },
    })

    const unitChannels = [
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
      unitChannels.map((channel) => {
        return {
          name: channel.name,
          counts: {
            courses: courseCounts[channel.name],
            programs: programCounts[channel.name],
          },
        }
      }),
    )
    setMockResponse.get(urls.channels.list({ channel_type: "unit" }), {
      count: unitChannels.length,
      results: unitChannels,
    })

    // units.forEach((unit) => {
    //   setMockResponse.get(urls.channels.details("unit", unit.code), {
    //     channel_url: `${window.location.origin}/units/${unit.code}`,
    //   })
    // })

    return {
      unitChannels,
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
    const { unitChannels, courseCounts, programCounts } = setupApis()

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

    unitChannels.forEach((channel) => {
      const { unit } = (channel as UnitChannel).unit_detail
      const section = unit.professional ? professionalSection : academicSection
      const card = within(section).getByTestId(`unit-card-${unit.code}`)
      const link = within(card).getByRole("link")
      expect(link).toHaveAttribute(
        "href",
        new URL(channel.channel_url!).pathname,
      )

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
