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
  setSearchParams: (fn: (prev: URLSearchParams) => URLSearchParams) => void
  onTabChange?: () => void
  className?: string
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
        const tab = tabs.find((t) => t.name === value)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          if (prev.get("resource_type_group") === "learning_material") {
            next.delete("resource_type")
          }
          if (tab?.resource_type_group) {
            next.set("resource_type_group", tab.resource_type_group)
          } else {
            next.delete("resource_type_group")
          }
          return next
        })
        onTabChange?.()
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
}

export { ResourceTypeGroupTabs }
export type { TabConfig }
