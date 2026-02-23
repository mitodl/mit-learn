"use client"

import React from "react"
import { learningResourceQueries } from "api/hooks/learningResources"
import {
  TabPanel,
  TabContext,
  styled,
  Typography,
  TypographyProps,
} from "ol-components"
import { CarouselV2 } from "ol-components/CarouselV2"
import { TabButton, TabButtonList } from "@mitodl/smoot-design"
import type { TabConfig } from "./types"
import { LearningResource, PaginatedLearningResourceList } from "api"
import { ResourceCard } from "../ResourceCard/ResourceCard"
import {
  useQueries,
  UseQueryResult,
  UseQueryOptions,
} from "@tanstack/react-query"

const StyledCarouselV2 = styled(CarouselV2)({
  margin: "24px 0",
  ".MitCarousel-track": {
    paddingBottom: "4px",
  },
})

/* Leaving for reference while we determine wether to swap out for CarouselV2
const StyledCarousel = styled(Carousel)({
  /**
   * Our cards have a hover shadow that gets clipped by the carousel container.
   * To compensate for this, we add a 4px padding to the left of each slide, and
   * remove 4px from the gap.
   *
  width: "calc(100% + 4px)",
  transform: "translateX(-4px)",
  ".slick-track": {
    display: "flex",
    gap: "20px",
    marginBottom: "4px",
  },
  ".slick-slide": {
    paddingLeft: "4px",
  },
})
*/

const HeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
    marginBottom: "0px",
  },
}))

const HeaderText = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    paddingRight: "16px",
    [theme.breakpoints.down("sm")]: {
      paddingBottom: "16px",
      ...theme.typography.h5,
    },
  }),
)

const ControlsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flex: 1,
  minWidth: "0px",
  maxWidth: "100%",
  justifyContent: "space-between",
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "16px",
  },
}))

const StyledTabPanel = styled(TabPanel)({
  paddingTop: "0px",
  paddingLeft: "0px",
  paddingRight: "0px",
})

const ButtonsContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const TabsList = styled(TabButtonList)({
  ".MuiTabScrollButton-root.Mui-disabled": {
    display: "none",
  },
})

type ContentProps = {
  resources: LearningResource[]
  childrenLoading?: boolean
  tabConfig: TabConfig
}

type PanelChildrenProps = {
  config: TabConfig[]
  queries: UseQueryResult<
    PaginatedLearningResourceList | LearningResource[],
    unknown
  >[]
  children: (props: ContentProps) => React.ReactNode
}
const PanelChildren: React.FC<PanelChildrenProps> = ({
  config,
  queries,
  children,
}) => {
  const getResults = (
    data: PaginatedLearningResourceList | LearningResource[] | undefined,
  ): LearningResource[] => {
    if (!data) {
      return []
    }
    if ("results" in data) {
      return data.results
    }
    return data
  }

  if (config.length === 1) {
    const { data, isLoading } = queries[0]
    const resources = getResults(data)

    return children({
      resources,
      childrenLoading: isLoading,
      tabConfig: config[0],
    })
  }
  return (
    <>
      {config.map((tabConfig, index) => {
        const { data, isLoading } = queries[index]
        const resources = getResults(data)

        return (
          <StyledTabPanel key={index} value={index.toString()}>
            {children({
              resources,
              childrenLoading: isLoading,
              tabConfig,
            })}
          </StyledTabPanel>
        )
      })}
    </>
  )
}

type ResourceCarouselProps = {
  config: TabConfig[]
  title: string
  className?: string
  isLoading?: boolean
  "data-testid"?: string
  /**
   * Element type for the carousel title
   */
  titleComponent?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  titleVariant?: TypographyProps["variant"]
  excludeResourceId?: number
}

type CarouselQuery = UseQueryOptions<
  LearningResource[] | PaginatedLearningResourceList
>

const getTabQuery = (tab: TabConfig): CarouselQuery => {
  switch (tab.data.type) {
    case "resources":
      return learningResourceQueries.list(tab.data.params) as CarouselQuery
    case "resource_items":
      return learningResourceQueries.items(
        tab.data.params.learning_resource_id,
        tab.data.params,
      ) as CarouselQuery
    case "lr_search":
      return learningResourceQueries.search(tab.data.params) as CarouselQuery
    case "lr_featured":
      return learningResourceQueries.featured(tab.data.params) as CarouselQuery
    case "lr_similar":
      return learningResourceQueries.similar(
        tab.data.params.id,
      ) as CarouselQuery
    case "lr_vector_similar":
      return learningResourceQueries.vectorSimilar(
        tab.data.params.id,
      ) as CarouselQuery
  }
}

/**
 * A tabbed carousel that fetches resources based on the configuration provided.
 *  - each TabConfig generates a tab + tabpanel that pulls data from an API based
 *    on the config
 *  - data is lazily when the tabpanel first becomes visible
 *
 * For now, this is a carousel of learning resource cards, to be moved out if/when it is needed for other items.
 *
 * If there is only one tab, the carousel will not have tabs, and will just show
 * the content.
 */
const ResourceCarousel: React.FC<ResourceCarouselProps> = ({
  config,
  title,
  className,
  isLoading,
  titleComponent = "h4",
  titleVariant = "h4",
  excludeResourceId,
}) => {
  const [tab, setTab] = React.useState("0")
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null)
  const queries = useQueries({
    queries: config.map((tab) => {
      return { ...getTabQuery(tab), enabled: !isLoading }
    }),
  })

  const getCount = (
    data: PaginatedLearningResourceList | LearningResource[] | undefined,
  ) => {
    if (!data) {
      return 0
    }
    if ("count" in data) {
      return data.count
    }
    return data.length
  }

  const allChildrenLoaded = queries.every(({ isLoading }) => !isLoading)
  const allChildrenEmpty = queries.every(({ data }) => !getCount(data))
  if (!isLoading && allChildrenLoaded && allChildrenEmpty) {
    return null
  }
  const buttonsContainerElement = (
    <ButtonsContainer role="group" aria-label="Slide navigation" ref={setRef} />
  )

  return (
    <div className={className} data-testid="resource-carousel">
      <TabContext value={tab}>
        <HeaderRow>
          <HeaderText component={titleComponent} variant={titleVariant}>
            {title}
          </HeaderText>
          {config.length === 1 ? buttonsContainerElement : null}
          {config.length > 1 ? (
            <ControlsContainer>
              <TabsList
                aria-label="Carousel Filters"
                onChange={(e, newValue) => setTab(newValue)}
              >
                {config
                  .map((tabConfig, index) => ({
                    tabConfig,
                    index,
                    shouldShow:
                      isLoading ||
                      queries[index].isLoading ||
                      getCount(queries[index].data) > 0,
                  }))
                  .filter(({ shouldShow }) => shouldShow)
                  .map(({ tabConfig, index }) => (
                    <TabButton
                      key={index}
                      label={tabConfig.label}
                      value={index.toString()}
                    />
                  ))}
              </TabsList>
              {buttonsContainerElement}
            </ControlsContainer>
          ) : null}
        </HeaderRow>
        <PanelChildren
          config={config}
          queries={
            queries as UseQueryResult<
              PaginatedLearningResourceList | LearningResource[]
            >[]
          }
        >
          {({ resources, childrenLoading, tabConfig }) => {
            return (
              <StyledCarouselV2
                arrowsContainer={ref}
                mobileBleed="symmetric"
                mobileGutter={16}
              >
                {isLoading || childrenLoading
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <ResourceCard
                        isLoading
                        key={index}
                        resource={null}
                        parentHeadingEl={titleComponent}
                        {...tabConfig.cardProps}
                      />
                    ))
                  : resources
                      .filter((resource) => resource.id !== excludeResourceId)
                      .map((resource) => (
                        <ResourceCard
                          key={resource.id}
                          resource={resource}
                          parentHeadingEl={titleComponent}
                          {...tabConfig.cardProps}
                        />
                      ))}
              </StyledCarouselV2>
            )
          }}
        </PanelChildren>
      </TabContext>
    </div>
  )
}

export default ResourceCarousel
export type { ResourceCarouselProps }
export type { TabConfig }
