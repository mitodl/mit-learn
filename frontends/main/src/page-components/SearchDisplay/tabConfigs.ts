/**
 * The resource type tabs, kept free of React so the server route can derive
 * the same default filter the client will search with.
 */
import { ResourceTypeGroupEnum } from "api"

type TabConfig = {
  label: string
  name: string
  defaultTab?: boolean
  /**
   * The groups this tab filters to, written to the URL as one
   * `resource_type_group` param each. Empty for an "All" tab, which filters
   * nothing.
   */
  resource_type_groups: ResourceTypeGroupEnum[]
  minWidth: number
  /**
   * sortby values that cannot order this tab's results, e.g. "upcoming" for
   * learning materials, which have no runs and so no start dates. Offered
   * disabled in the sort dropdown, and cleared from the URL on switching here.
   */
  unsupportedSortby?: string[]
  /**
   * What this tab's results are called in the empty state -- "no learning
   * materials match these filters". Lower case, and plural, because it is
   * read mid-sentence.
   *
   * Not the label, which is title case and joins "Courses" to "Programs" with
   * an ampersand that does not read as prose.
   */
  emptyNoun?: string
}

/**
 * Sorts by the next start date of a resource's upcoming runs. Nothing without
 * runs -- no learning material -- has one, hence the tabs that declare it
 * unsupported.
 */
const UPCOMING_SORT = "upcoming"

const ALL_TAB: TabConfig = {
  name: "all",
  label: "All",
  defaultTab: true,
  resource_type_groups: [],
  minWidth: 85,
}

const LEARNING_MATERIALS_TAB: TabConfig = {
  name: "learning-materials",
  label: "Learning Materials",
  resource_type_groups: [ResourceTypeGroupEnum.LearningMaterial],
  minWidth: 172,
  unsupportedSortby: [UPCOMING_SORT],
  emptyNoun: "learning materials",
}

const TABS: TabConfig[] = [
  ALL_TAB,
  {
    name: "courses",
    label: "Courses",
    resource_type_groups: [ResourceTypeGroupEnum.Course],
    minWidth: 112,
  },
  {
    name: "programs",
    label: "Programs",
    resource_type_groups: [ResourceTypeGroupEnum.Program],
    minWidth: 118,
  },
  LEARNING_MATERIALS_TAB,
]

/**
 * The topic page's tabs: courses and programs together, and learning
 * materials. There is no All -- the topic page opens on courses and programs.
 */
const TOPIC_TABS: TabConfig[] = [
  {
    name: "courses-and-programs",
    label: "Courses & Programs",
    defaultTab: true,
    resource_type_groups: [
      ResourceTypeGroupEnum.Course,
      ResourceTypeGroupEnum.Program,
    ],
    minWidth: 175,
    emptyNoun: "courses or programs",
  },
  /* Narrower here than on the search page, where the same tab is a filled
     button with a bracketed count rather than an underlined heading with a
     bare one. */
  { ...LEARNING_MATERIALS_TAB, minWidth: 145 },
]

/**
 * The tab the URL's `resource_type_group` values pick out, or the default.
 *
 * An exact match first, then a tab that covers every value the URL names --
 * so where courses and programs share a tab, a link to just the courses lands
 * on it rather than falling back to All while still saying "course". Failing
 * both, the tab for the first value, as when tabs took only one: courses and
 * programs together in the URL open Courses where they have separate tabs.
 */
const findActiveTab = (tabs: TabConfig[], urlGroups: string[]): TabConfig => {
  const wanted = new Set(urlGroups)
  const fallback = tabs.find((t) => t.defaultTab) ?? tabs[0]
  if (wanted.size === 0) {
    return fallback
  }
  const groupsOf = (t: TabConfig) => new Set<string>(t.resource_type_groups)
  return (
    tabs.find((t) => {
      const groups = groupsOf(t)
      return (
        groups.size === wanted.size && [...wanted].every((g) => groups.has(g))
      )
    }) ??
    tabs.find((t) => {
      const groups = groupsOf(t)
      return groups.size > 0 && [...wanted].every((g) => groups.has(g))
    }) ??
    tabs.find((t) => groupsOf(t).has(urlGroups[0])) ??
    fallback
  )
}

export { TABS, TOPIC_TABS, UPCOMING_SORT, findActiveTab }
export type { TabConfig }
