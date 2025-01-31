"use client"

import React from "react"
import { learningResources } from "api/hooks/learningResources"
import {
  Carousel,
  TabButton,
  TabPanel,
  TabContext,
  TabButtonList,
  styled,
  Typography,
  TypographyProps,
} from "ol-components"
import type { TabConfig } from "./types"
import { LearningResource, PaginatedLearningResourceList } from "api"
import { ResourceCard } from "../ResourceCard/ResourceCard"
import {
  useQueries,
  UseQueryResult,
  UseQueryOptions,
} from "@tanstack/react-query"

const StyledCarousel = styled(Carousel)({
  /**
   * Our cards have a hover shadow that gets clipped by the carousel container.
   * To compensate for this, we add a 4px padding to the left of each slide, and
   * remove 4px from the gap.
   */
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

const MobileOverflow = styled.div(({ theme }) => ({
  /**
   * On mobile screens, the carousel is supposed to overflow the main content
   * so its right edge is flush with screen.
   *
   * The mobile content margin is 16px, so we add that to its width.
   */
  [theme.breakpoints.down("sm")]: {
    width: "calc(100% + 16px)",
  },
}))

type ResourceCarouselProps = {
  config: TabConfig[]
  title: string
  className?: string
  isLoading?: boolean
  "data-testid"?: string
  /**
   * Element type for the carousel title
   */
  titleComponent?: React.ElementType
  titleVariant?: TypographyProps["variant"]
  excludeResourceId?: number
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
  "data-testid": dataTestId,
  titleComponent = "h4",
  titleVariant = "h4",
  excludeResourceId,
}) => {
  const [tab, setTab] = React.useState("0")
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null)

  const queries = useQueries({
    queries: config.map(
      (
        tab,
      ): UseQueryOptions<
        PaginatedLearningResourceList | LearningResource[],
        unknown,
        unknown,
        // The factory-generated types for queryKeys are very specific (tuples not arrays)
        // and assignable to the loose QueryKey (readonly unknown[]) on the UseQueryOptions generic.
        // But! as a queryFn arg the more specific QueryKey cannot be assigned to the looser QueryKey.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      > => {
        switch (tab.data.type) {
          case "resources":
            return learningResources.list(tab.data.params)
          case "resource_items":
            return learningResources
              .detail(tab.data.params.learning_resource_id)
              ._ctx.items(tab.data.params)
          case "lr_search":
            return learningResources.search(tab.data.params)
          case "lr_featured":
            return learningResources.featured(tab.data.params)
          case "lr_similar":
            return learningResources.similar(tab.data.params.id)
          case "lr_vector_similar":
            return learningResources.vectorSimilar(tab.data.params.id)
        }
      },
    ),
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
    <MobileOverflow className={className} data-testid={dataTestId}>
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
                {config.map((tabConfig, index) => {
                  if (
                    !isLoading &&
                    !queries[index].isLoading &&
                    !getCount(queries[index].data)
                  ) {
                    return null
                  }
                  return (
                    <TabButton
                      key={index}
                      label={tabConfig.label}
                      value={index.toString()}
                    />
                  )
                })}
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
          {({ resources, childrenLoading, tabConfig }) => (
            <StyledCarousel arrowsContainer={ref}>
              {isLoading || childrenLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <ResourceCard
                      isLoading
                      key={index}
                      resource={null}
                      {...tabConfig.cardProps}
                    />
                  ))
                : resources.map((resource) =>
                    resource.id !== excludeResourceId ? (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        {...tabConfig.cardProps}
                      />
                    ) : null,
                  )}
            </StyledCarousel>
          )}
        </PanelChildren>
      </TabContext>
    </MobileOverflow>
  )
}

export default ResourceCarousel
export type { ResourceCarouselProps }
export type { TabConfig }
