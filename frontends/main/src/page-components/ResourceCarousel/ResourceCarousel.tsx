"use client"

import { env } from "@/env"
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
import { TabButton, TabButtonList, VisuallyHidden } from "@mitodl/smoot-design"
import type { TabConfig } from "./types"
import { LearningResource, PaginatedLearningResourceList } from "api"
import { ResourceCard } from "../ResourceCard/ResourceCard"
import {
  useQueries,
  UseQueryResult,
  UseQueryOptions,
} from "@tanstack/react-query"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

const StyledCarouselV2 = styled(CarouselV2)({
  margin: "24px 0",
  ".MitCarousel-track": {
    paddingBottom: "4px",
  },
})

const CarouselSlide = styled.div(({ theme }) => ({
  flexShrink: 0,
  borderRadius: "8px",
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.darkGray2}`,
    outlineOffset: "2px",
  },
}))

/* Leaving for reference while we determine whether to swap out for CarouselV2
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

type CarouselCardsProps = {
  resources: LearningResource[]
  childrenLoading?: boolean
  tabConfig: TabConfig
  isLoading?: boolean
  titleComponent: ResourceCarouselProps["titleComponent"]
  arrowsContainer: HTMLDivElement | null
  onCardClick: (resource: LearningResource, index: number) => void
}

/**
 * Renders the cards for a single carousel tab panel, implementing the ARIA
 * carousel composite widget pattern: each card is a single tab stop (roving
 * tabindex), with its internal focusable elements (title link, bookmark
 * button) only reachable by tabbing further into the focused card. Arrow/
 * Home/End keys move focus between cards; Tab exits the carousel as a unit.
 * https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
 */
const CarouselCards: React.FC<CarouselCardsProps> = ({
  resources,
  childrenLoading,
  tabConfig,
  isLoading,
  titleComponent,
  arrowsContainer,
  onCardClick,
}) => {
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [announcement, setAnnouncement] = React.useState("")

  // `resources` is a freshly-filtered array on every render, so hold the latest
  // in a ref and keep `handleSettle` referentially stable — otherwise passing a
  // new `onSettle` each render would make CarouselV2 tear down and re-subscribe
  // its Embla listeners on every keystroke.
  const resourcesRef = React.useRef(resources)
  resourcesRef.current = resources

  // The same CarouselCards instance is reused across resource navigations
  // (e.g. clicking a "similar resources" card within the drawer), which can
  // swap in a shorter `resources` list. Clamp so a stale index doesn't leave
  // every slide at tabIndex=-1 and the carousel permanently untabbable.
  React.useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(resources.length - 1, 0)),
    )
  }, [resources.length])

  const moveFocus = (index: number) => {
    setActiveIndex(index)
    // Embla's `activeIndex` prop (passed to StyledCarouselV2 below) already
    // handles scrolling the target slide into view, so avoid letting the
    // browser's native focus-scroll fight with it.
    cardRefs.current[index]?.focus({ preventScroll: true })
  }

  // The Prev/Next buttons page by a full viewport (fast mouse browsing), which
  // leaves DOM focus on the button rather than moving it into a card. When the
  // scroll settles, move the single roving tab stop onto the first now-visible
  // card so the next Tab into the carousel lands on a card the user can see,
  // and announce the position for screen reader users (whose focus stays on the
  // button). Don't override when the active card is already in view (e.g. arrow-
  // key navigation), so we never yank the tab stop off a card the user just
  // moved to.
  const handleSettle = React.useCallback((slidesInView: number[]) => {
    if (slidesInView.length === 0) {
      return
    }
    const firstInView = slidesInView[0]
    const list = resourcesRef.current
    setActiveIndex((current) =>
      slidesInView.includes(current) ? current : firstInView,
    )
    setAnnouncement(
      `${firstInView + 1} of ${list.length}: ${list[firstInView]?.title ?? ""}`,
    )
  }, [])

  // Setting tabIndex=-1 on a slide wrapper only removes the wrapper itself
  // from the tab order — native descendants (the title link, bookmark
  // button) keep their own implicit tabIndex=0 and remain reachable by Tab.
  // Card/BaseLearningResourceCard are shared far beyond this carousel, so
  // rather than threading a tabIndex override prop through every layer, sync
  // each slide's focusable descendants imperatively. A MutationObserver (not
  // just an effect keyed on activeIndex/resources) is required because
  // action buttons like "Bookmark" mount asynchronously once the current
  // user's data loads, which can happen well after this effect's first run.
  React.useEffect(() => {
    const syncTabIndex = (slide: HTMLDivElement, index: number) => {
      slide
        .querySelectorAll<HTMLElement>("a[href], button, [tabindex]")
        .forEach((el) => {
          el.tabIndex = index === activeIndex ? 0 : -1
        })
    }

    const observers = cardRefs.current.map((slide, index) => {
      if (!slide) {
        return null
      }
      syncTabIndex(slide, index)
      const observer = new MutationObserver(() => syncTabIndex(slide, index))
      observer.observe(slide, { childList: true, subtree: true })
      return observer
    })

    return () => {
      observers.forEach((observer) => observer?.disconnect())
    }
  }, [activeIndex, resources])

  const handleSlideKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    // Only steal these keys when the slide itself is focused, not when focus
    // is on a nested element like the title link or bookmark button.
    if (event.target !== event.currentTarget) {
      return
    }
    switch (event.key) {
      case "ArrowLeft":
        if (index > 0) {
          event.preventDefault()
          moveFocus(index - 1)
        }
        break
      case "ArrowRight":
        if (index < resources.length - 1) {
          event.preventDefault()
          moveFocus(index + 1)
        }
        break
      case "Home":
        event.preventDefault()
        moveFocus(0)
        break
      case "End":
        event.preventDefault()
        moveFocus(resources.length - 1)
        break
      case "Enter":
        // Mirrors the mouse behavior (forwardClicksToLink): open the card's
        // resource without requiring an extra Tab into the title link.
        event.currentTarget
          .querySelector<HTMLAnchorElement>('a[data-card-link="true"]')
          ?.click()
        break
    }
  }

  if (isLoading || childrenLoading) {
    return (
      <StyledCarouselV2
        arrowsContainer={arrowsContainer}
        mobileBleed="symmetric"
        mobileGutter={16}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <ResourceCard
            isLoading
            key={index}
            resource={null}
            parentHeadingEl={titleComponent}
            {...tabConfig.cardProps}
          />
        ))}
      </StyledCarouselV2>
    )
  }

  return (
    <>
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {announcement}
      </VisuallyHidden>
      <StyledCarouselV2
        arrowsContainer={arrowsContainer}
        mobileBleed="symmetric"
        mobileGutter={16}
        activeIndex={activeIndex}
        onSettle={handleSettle}
      >
        {resources.map((resource, index) => (
          <CarouselSlide
            key={resource.id}
            ref={(el: HTMLDivElement | null) => {
              cardRefs.current[index] = el
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${resources.length}: ${resource.title}`}
            tabIndex={index === activeIndex ? 0 : -1}
            onKeyDown={(event) => handleSlideKeyDown(event, index)}
          >
            <ResourceCard
              resource={resource}
              parentHeadingEl={titleComponent}
              {...tabConfig.cardProps}
              onCardClick={() => onCardClick(resource, index)}
            />
          </CarouselSlide>
        ))}
      </StyledCarouselV2>
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
      return learningResourceQueries.vectorSimilar({
        id: tab.data.params.id,
      }) as CarouselQuery
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
  const posthog = usePostHog()
  const [tab, setTab] = React.useState("0")
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null)
  const queries = useQueries({
    queries: config.map((tab) => {
      return { ...getTabQuery(tab), enabled: !isLoading }
    }),
  })

  const getVisibleCount = (
    data: PaginatedLearningResourceList | LearningResource[] | undefined,
  ) => {
    if (!data) {
      return 0
    }
    const resources = "results" in data ? data.results : data
    if (excludeResourceId !== undefined) {
      return resources.filter((resource) => resource.id !== excludeResourceId)
        .length
    }
    return resources.length
  }

  const allChildrenLoaded = queries.every(({ isLoading }) => !isLoading)
  const allChildrenEmpty = queries.every(({ data }) => !getVisibleCount(data))
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
                      getVisibleCount(queries[index].data) > 0,
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
          {({ resources, childrenLoading, tabConfig }) => (
            <CarouselCards
              resources={resources.filter(
                (resource) => resource.id !== excludeResourceId,
              )}
              childrenLoading={childrenLoading}
              tabConfig={tabConfig}
              isLoading={isLoading}
              titleComponent={titleComponent}
              arrowsContainer={ref}
              onCardClick={(resource, index) => {
                if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
                  posthog.capture(PostHogEvents.CourseCardClicked, {
                    label: title,
                    resourceId: resource.id,
                    readableId: resource.readable_id,
                    resourceType: resource.resource_type,
                    platformCode: resource.platform?.code,
                    position: index,
                  })
                }
              }}
            />
          )}
        </PanelChildren>
      </TabContext>
    </div>
  )
}

export default ResourceCarousel
export type { ResourceCarouselProps }
export type { TabConfig }
