import { TABS, TOPIC_TABS, findActiveTab } from "./tabConfigs"

describe("findActiveTab", () => {
  test.each([
    { tabs: TABS, url: [], expected: "all" },
    { tabs: TABS, url: ["course"], expected: "courses" },
    { tabs: TABS, url: ["learning_material"], expected: "learning-materials" },
    // No tab holds both, so the first value picks, as when tabs took one.
    { tabs: TABS, url: ["course", "program"], expected: "courses" },
    { tabs: TABS, url: ["program", "course"], expected: "programs" },
    { tabs: TABS, url: ["nonsense"], expected: "all" },
    { tabs: TOPIC_TABS, url: [], expected: "courses-and-programs" },
    {
      tabs: TOPIC_TABS,
      url: ["program", "course"],
      expected: "courses-and-programs",
    },
    // A link to just one of them lands on the tab holding both.
    { tabs: TOPIC_TABS, url: ["course"], expected: "courses-and-programs" },
    { tabs: TOPIC_TABS, url: ["program"], expected: "courses-and-programs" },
    {
      tabs: TOPIC_TABS,
      url: ["learning_material"],
      expected: "learning-materials",
    },
  ])("$url among $tabs.length tabs is $expected", ({ tabs, url, expected }) => {
    expect(findActiveTab(tabs, url).name).toBe(expected)
  })
})
