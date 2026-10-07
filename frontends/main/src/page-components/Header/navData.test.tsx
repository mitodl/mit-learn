import { navData } from "./navData"
import { ORGANIZATIONAL_LEARNING } from "@/common/urls"

const sectionTitles = navData.sections.map((section) => section.title)

describe("navData", () => {
  test("includes the For Organizations link", () => {
    const hrefs = navData.sections.flatMap((section) =>
      section.items.map((item) => item.href),
    )
    expect(hrefs).toContain(ORGANIZATIONAL_LEARNING)
  })

  test("appends it last, headerless and behind a divider", () => {
    expect(sectionTitles).toEqual([
      "LEARN",
      "BROWSE",
      "DISCOVER LEARNING RESOURCES",
      undefined,
    ])

    const last = navData.sections[navData.sections.length - 1]
    expect(last.divider).toBe(true)
    expect(last.items.map((item) => item.href)).toEqual([
      ORGANIZATIONAL_LEARNING,
    ])
  })

  test("every item has an href and a posthog event", () => {
    navData.sections.forEach((section) => {
      section.items.forEach((item) => {
        expect(item.href).toBeTruthy()
        expect(item.posthogEvent).toBeTruthy()
      })
    })
  })
})
