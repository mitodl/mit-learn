import { buildNavData } from "./navData"
import { ORGANIZATIONAL_LEARNING } from "@/common/urls"

const sectionTitles = (showOrgLearning: boolean) =>
  buildNavData(showOrgLearning).sections.map((section) => section.title)

const sections = (showOrgLearning: boolean) =>
  buildNavData(showOrgLearning).sections

const allHrefs = (showOrgLearning: boolean) =>
  buildNavData(showOrgLearning).sections.flatMap((section) =>
    section.items.map((item) => item.href),
  )

describe("buildNavData", () => {
  test("adds the For Organizations link when the flag is on", () => {
    expect(allHrefs(true)).toContain(ORGANIZATIONAL_LEARNING)
  })

  test("omits it entirely when the flag is off", () => {
    expect(allHrefs(false)).not.toContain(ORGANIZATIONAL_LEARNING)
    expect(sections(false)).toHaveLength(3)
  })

  test("appends it last, headerless and behind a divider", () => {
    expect(sectionTitles(false)).toEqual([
      "LEARN",
      "BROWSE",
      "DISCOVER LEARNING RESOURCES",
    ])

    const withFlag = sections(true)
    expect(sectionTitles(true).slice(0, 3)).toEqual(sectionTitles(false))

    const last = withFlag[withFlag.length - 1]
    expect(last.title).toBeUndefined()
    expect(last.divider).toBe(true)
    expect(last.items.map((item) => item.href)).toEqual([
      ORGANIZATIONAL_LEARNING,
    ])
  })

  test("every item has an href and a posthog event", () => {
    buildNavData(true).sections.forEach((section) => {
      section.items.forEach((item) => {
        expect(item.href).toBeTruthy()
        expect(item.posthogEvent).toBeTruthy()
      })
    })
  })
})
