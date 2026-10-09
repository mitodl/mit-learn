import React from "react"
import { TabContext, TabPanel, styled } from "ol-components"
import { TabButton, TabButtonList } from "@mitodl/smoot-design"
import { ResourceTypeGroupEnum, LearningResourcesSearchResponse } from "api"

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

type TabConfig = {
  label: string
  name: string
  defaultTab?: boolean
  resource_type_group: ResourceTypeGroupEnum | null
  minWidth: number
  /**
   * sortby values that cannot order this tab's results, e.g. "upcoming" for
   * learning materials, which have no runs and so no start dates. Offered
   * disabled in the sort dropdown, and cleared from the URL on switching here.
   */
  unsupportedSortby?: string[]
}

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
const appendCount = (label: string, count?: number | null) => {
  if (Number.isFinite(count)) {
    return (
      <>
        {label}&nbsp;<CountSpan>({count})</CountSpan>
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
    if (prev.get("resource_type_group") === "learning_material") {
      next.delete("resource_category")
    }
    if (tab?.resource_type_group) {
      next.set("resource_type_group", tab.resource_type_group)
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
        let count: number | undefined
        if (t.name === "all") {
          count = allCount
        } else {
          count =
            counts && t.resource_type_group
              ? (counts[t.resource_type_group] ?? 0)
              : undefined
        }
        return (
          <TabButton
            style={{ minWidth: t.minWidth }}
            key={t.name}
            value={t.name}
            label={appendCount(t.label, count)}
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
 * is checked is what All is, and a row that undid itself and three others
 * would be the odd one out among checkboxes.
 */
const ResourceTypeGroupChecklist: React.FC<
  ResourceTypeGroupTabsProps & { activeTabName: string }
> = ({ tabs, aggregations, setSearchParams, onTabChange, activeTabName }) => {
  const counts = resourceTypeGroupCounts(aggregations)
  const choices = tabs.filter((tab) => tab.resource_type_group)
  if (choices.length === 0) {
    return null
  }
  return (
    <div className="facets multi-facet-group">
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
              value={tab.resource_type_group ?? ""}
              /* The label beside it reads as the count run onto the end of
                 the words -- "Courses12" -- so the control names itself. */
              aria-label={tab.label}
              checked={checked}
              onChange={() =>
                selectTab(
                  checked ? tabs.find((t) => t.defaultTab) : tab,
                  setSearchParams,
                  onTabChange,
                )
              }
            />
            <label htmlFor={id} className="facet-label">
              <span className="facet-text">{tab.label}</span>
              <span className="facet-count">
                {tab.resource_type_group
                  ? (counts?.[tab.resource_type_group] ?? 0)
                  : null}
              </span>
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
export type { TabConfig }
