import React from "react"
import { TabContext, TabPanel, styled } from "ol-components"
import { TabButton, TabButtonList } from "@mitodl/smoot-design"
import { ResourceTypeGroupEnum, LearningResourcesSearchResponse } from "api"
import type { TabConfig } from "./tabConfigs"

const TabsList = styled(TabButtonList)(({ theme }) => ({
  ".MuiTabScrollButton-root.Mui-disabled": {
    display: "none",
  },
  [theme.breakpoints.down("md")]: {
    "div div button": {
      minWidth: "0 !important",
    },
  },
}))

const CountSpan = styled.span(({ theme }) => ({
  ...theme.typography.body3,
}))

type Aggregations = LearningResourcesSearchResponse["metadata"]["aggregations"]
const resourceTypeGroupCounts = (aggregations?: Aggregations) => {
  if (!aggregations) return null
  const buckets = aggregations?.resource_type_group ?? []
  const counts = buckets.reduce(
    (acc, bucket) => {
      acc[bucket.key as ResourceTypeGroupEnum] = bucket.doc_count
      return acc
    },
    {} as Record<ResourceTypeGroupEnum, number>,
  )
  return counts
}
/** How many results fall in any of a tab's groups, e.g. courses plus programs. */
const tabCount = (
  tab: TabConfig,
  counts: Record<ResourceTypeGroupEnum, number> | null,
) =>
  counts
    ? tab.resource_type_groups.reduce(
        (total, group) => total + (counts[group] ?? 0),
        0,
      )
    : undefined

/**
 * The tab's name with how many results fall under it.
 *
 * `bare` drops the brackets, which is how the redesigned channel pages draw
 * it: the count sits beside the name as a figure rather than an aside. The
 * search page and the other channels keep the bracketed form.
 */
const appendCount = (
  label: string,
  count?: number | null,
  bare: boolean = false,
) => {
  if (Number.isFinite(count)) {
    return (
      <>
        {label}&nbsp;<CountSpan>{bare ? count : `(${count})`}</CountSpan>
      </>
    )
  }
  return label
}

/**
 *
 */
const ResourceTypeGroupTabContext: React.FC<{
  activeTabName: string
  children: React.ReactNode
}> = ({ activeTabName, children }) => {
  return <TabContext value={activeTabName}>{children}</TabContext>
}

type ResourceTypeGroupTabsProps = {
  aggregations?: Aggregations
  tabs: TabConfig[]
  setSearchParams: (
    name: string,
    fn: (prev: URLSearchParams) => URLSearchParams,
  ) => void
  onTabChange?: () => void
  className?: string
  /** Draws each tab's count without brackets -- see `appendCount`. */
  bareCounts?: boolean
}

/**
 * Move to `tab`, or to the default one when there is none.
 *
 * Shared by the tab row and the drawer's list, which are the same choice
 * drawn two ways -- so switching has to do the same housekeeping either way:
 * drop the resource category that only the learning materials tab offers, and
 * drop a sort this tab cannot apply rather than leave it ordering by nothing.
 */
const selectTab = (
  tab: TabConfig | undefined,
  setSearchParams: ResourceTypeGroupTabsProps["setSearchParams"],
  onTabChange?: () => void,
) => {
  setSearchParams("resource_type_group", (prev) => {
    const next = new URLSearchParams(prev)
    if (prev.getAll("resource_type_group").includes("learning_material")) {
      next.delete("resource_category")
    }
    // The default tab is what a bare URL shows, so it needs no param of its
    // own. Otherwise `set` the first group so the param keeps its place in the
    // URL, and append the rest beside it.
    const [first, ...rest] = tab?.defaultTab
      ? []
      : (tab?.resource_type_groups ?? [])
    if (first) {
      next.set("resource_type_group", first)
      rest.forEach((group) => next.append("resource_type_group", group))
    } else {
      next.delete("resource_type_group")
    }
    if (tab?.unsupportedSortby?.includes(next.get("sortby") ?? "")) {
      next.delete("sortby")
    }
    return next
  })
  onTabChange?.()
}
const ResourceTypeGroupTabList: React.FC<ResourceTypeGroupTabsProps> = ({
  tabs,
  aggregations,
  setSearchParams,
  onTabChange,
  className,
  bareCounts = false,
}) => {
  const counts = resourceTypeGroupCounts(aggregations)
  const allCount = aggregations?.resource_type_group
    ? (aggregations.resource_type_group || []).reduce((count, bucket) => {
        count = count + bucket.doc_count
        return count
      }, 0)
    : undefined

  return (
    <TabsList
      className={className}
      onChange={(_e, value) => {
        selectTab(
          tabs.find((t) => t.name === value),
          setSearchParams,
          onTabChange,
        )
      }}
    >
      {tabs.map((t) => {
        const count = t.name === "all" ? allCount : tabCount(t, counts)
        return (
          <TabButton
            style={{ minWidth: t.minWidth }}
            key={t.name}
            value={t.name}
            label={appendCount(t.label, count, bareCounts)}
          />
        )
      })}
    </TabsList>
  )
}

/**
 * The same choice as the tab row, drawn as a facet group for the drawer.
 *
 * A tab row does not survive a phone -- four labels with counts, and the
 * longest of them "Learning Materials" -- so the design moves the choice into
 * the filter drawer and draws it as the facets around it are drawn. It is
 * still the tabs: one at a time, writing the same `resource_type_group`, and
 * the tab row reflects it at any width the row is drawn at.
 *
 * Deliberately the facets' own markup and class names rather than a styled
 * component, so the surrounding `FacetStyles` reaches it and the rows match
 * the Free group above them exactly.
 *
 * There is no "All" row because the design has none: unchecking whichever row
 * is checked goes back to the default tab -- All where there is one, and on
 * the topic page, which has none, Courses & Programs.
 */
/** See the effect in `ResourceTypeGroupChecklist` for why this is not a ref. */
let pendingFocusId: string | null = null

const ResourceTypeGroupChecklist: React.FC<
  ResourceTypeGroupTabsProps & { activeTabName: string }
> = ({ tabs, aggregations, setSearchParams, onTabChange, activeTabName }) => {
  const counts = resourceTypeGroupCounts(aggregations)
  const choices = tabs.filter((tab) => tab.resource_type_groups.length > 0)

  /**
   * Put focus back on the box that was just ticked.
   *
   * These live in the filter drawer, which the results render inside the tab
   * panel for the active tab -- so choosing one switches the panel out from
   * under the box, and the box is unmounted along with it. Focus would land
   * back on the drawer itself, leaving a keyboard or screen reader user at
   * the top of the list again after every choice.
   *
   * The id is held outside the component because the component is what goes:
   * a ref would be torn down with it, and the one that mounts in its place
   * would have nothing to read.
   */
  React.useEffect(() => {
    if (!pendingFocusId) {
      return
    }
    const id = pendingFocusId
    pendingFocusId = null
    document.getElementById(id)?.focus()
  })

  if (choices.length === 0) {
    return null
  }
  return (
    <div
      className="facets multi-facet-group"
      role="group"
      aria-label="Resource type"
    >
      {choices.map((tab) => {
        const checked = tab.name === activeTabName
        const id = `resource-type-group-${tab.name}`
        return (
          <div
            key={tab.name}
            className={checked ? "facet-visible checked" : "facet-visible"}
          >
            <input
              type="checkbox"
              id={id}
              name="resource_type_group"
              value={tab.resource_type_groups.join(",")}
              /* The label beside it reads as the count run onto the end of
                 the words -- "Courses12" -- so the control names itself. */
              aria-label={tab.label}
              checked={checked}
              onChange={() => {
                pendingFocusId = id
                selectTab(
                  checked ? tabs.find((t) => t.defaultTab) : tab,
                  setSearchParams,
                  onTabChange,
                )
              }}
            />
            <label htmlFor={id} className="facet-label">
              <span className="facet-text">{tab.label}</span>
              <span className="facet-count">{tabCount(tab, counts) ?? 0}</span>
            </label>
          </div>
        )
      })}
    </div>
  )
}

const ResourceTypeGroupTabPanels: React.FC<{
  tabs: TabConfig[]
  children?: React.ReactNode
}> = ({ tabs, children }) => {
  return (
    <>
      {tabs.map((t) => (
        <TabPanel key={t.name} value={t.name}>
          {children}
        </TabPanel>
      ))}
    </>
  )
}

/**
 * Components for a tabbed search UI with tabs controlling resource_type_group facet.
 *
 * Intended usage is:
 * ```jsx
 * <ResourceTypeGroupTabs.Context>
 *    <ResourceTypeGroupTabs.TabList />
 *    <ResourceTypeGroupTabPanels>
 *      Panel Content
 *    </ResourceTypeGroupTabPanels>
 * <ResourceTypeGroupTabs.Context>
 * ```
 *
 * These are exported as three separate components (Context, TabList, TabPanels)
 * to facilitate placement within a grid layout.
 */
const ResourceTypeGroupTabs = {
  Context: ResourceTypeGroupTabContext,
  TabList: ResourceTypeGroupTabList,
  TabPanels: ResourceTypeGroupTabPanels,
  Checklist: ResourceTypeGroupChecklist,
}

export { ResourceTypeGroupTabs }
