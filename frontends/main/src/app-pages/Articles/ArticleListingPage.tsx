"use client"

import React, { useRef, useState } from "react"
import {
  Container,
  styled,
  theme,
  Typography,
  Grid2,
  Breadcrumbs,
  BannerBackground,
  Pagination,
  PaginationItem,
  css,
  LoadingSpinner,
} from "ol-components"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import {
  useNewsEventsList,
  NewsEventsListFeedTypeEnum,
} from "api/hooks/newsEvents"
import type { NewsFeedItem } from "api/v0"
import { Story } from "../HomePage/NewsEventsSection"
import { LocalDate } from "ol-utilities"

const DEFAULT_BACKGROUND_IMAGE_URL = "/images/backgrounds/background_steps.jpg"
const PAGE_SIZE = 20
const MAX_PAGE = 50

const getLastPage = (count: number): number => {
  const pages = Math.ceil(count / PAGE_SIZE)
  return pages > MAX_PAGE ? MAX_PAGE : pages
}

const BannerSection = styled(BannerBackground)`
  padding: 48px 0;
  ${theme.breakpoints.down("sm")} {
    padding: 32px 0;
  }
`

const BannerTitle = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
` as typeof Typography

const BannerDescription = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
`

const Section = styled.section`
  background: ${theme.custom.colors.white};
  padding: 80px 0;
  ${theme.breakpoints.down("md")} {
    padding: 40px 0;
  }
`

const FeaturedSection = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 80px;

  ${theme.breakpoints.down("md")} {
    flex-direction: column;
    margin-bottom: 40px;
  }
`

const FeaturedMain = styled.div`
  flex: 1;
  min-width: 0;
`

const FeaturedSidebar = styled.div`
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  ${theme.breakpoints.down("lg")} {
    width: 320px;
  }

  ${theme.breakpoints.down("md")} {
    width: 100%;
  }
`

// Featured Main Story Card with image and black overlay
const FeaturedMainCard = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  border: 1px solid ${theme.custom.colors.lightGray2};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
`

const FeaturedMainImage = styled.div<{ imageUrl?: string }>`
  width: 100%;
  height: 100%;
  min-height: 500px;
  background-image: ${(props) =>
    props.imageUrl ? `url(${props.imageUrl})` : "none"};
  background-size: cover;
  background-position: center;
  background-color: ${theme.custom.colors.lightGray1};
  position: relative;

  ${theme.breakpoints.down("md")} {
    min-height: 400px;
  }
`

const FeaturedMainOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${theme.custom.colors.darkGray2};
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 5px solid #a31f34;
`

const FeaturedMainTitle = styled.div`
  color: ${theme.custom.colors.white};
  ${{ ...theme.typography.h5 }}
  text-decoration: none;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
`

const FeaturedMainDate = styled(Typography)`
  color: ${theme.custom.colors.white};
  ${{ ...theme.typography.body3 }}
  margin: 0;
`

// Sidebar Story Card with horizontal layout (text left, image right)
const SidebarStoryCard = styled.div`
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 0;
  height: 96px;
  overflow: hidden;
  border: 1px solid ${theme.custom.colors.lightGray2};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  background: ${theme.custom.colors.white};
`

const SidebarStoryContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 12px 16px;
  min-width: 0;
`

const SidebarStoryImage = styled.div<{ imageUrl?: string }>`
  width: 120px;
  height: 96px;
  flex-shrink: 0;
  background-image: ${(props) =>
    props.imageUrl ? `url(${props.imageUrl})` : "none"};
  background-size: cover;
  background-position: center;
  background-color: ${theme.custom.colors.lightGray1};
`

const SidebarStoryTitle = styled.div`
  color: ${theme.custom.colors.darkGray2};
  ${{ ...theme.typography.subtitle2 }}
  text-decoration: none;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
`

const SidebarStoryDate = styled(Typography)`
  color: ${theme.custom.colors.silverGrayDark};
  ${{ ...theme.typography.body3 }}
  margin: 0;
`

const Content = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 40px;
`

const MobileContent = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 40px;
  margin: 40px 0;
`

const StoriesContainer = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  flex: 1 0 0;
`

const MobileContainer = styled.section`
  width: 100%;
  margin: 0 -16px;

  h3 {
    margin: 0 16px 12px;
  }
`

const StoriesSlider = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  overflow-x: scroll;
  padding: 0 16px 24px;
`

const AboveMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const BelowMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
}))

const PaginationContainer = styled.div`
  display: flex;
  justify-content: end;
  margin-top: 24px;
  margin-bottom: 80px;

  ${({ theme }) => theme.breakpoints.down("md")} {
    margin-top: 16px;
    margin-bottom: 24px;
  }

  ul li button.Mui-selected {
    ${({ theme }) => css({ ...theme.typography.subtitle1 })}
    background-color: inherit;
  }

  ul li button svg {
    background-color: ${({ theme }) => theme.custom.colors.lightGray2};
    border-radius: 4px;
    width: 1.5em;
    height: 1.5em;
    padding: 0.25em;
  }
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  width: 100%;
`

// Featured Main Story Component
const FeaturedMainStory: React.FC<{ item: NewsFeedItem }> = ({ item }) => {
  return (
    <FeaturedMainCard>
      <a
        href={item.url}
        style={{ textDecoration: "none", display: "block", height: "100%" }}
        aria-label={item.title}
      >
        <FeaturedMainImage imageUrl={item.image?.url}>
          <FeaturedMainOverlay>
            <FeaturedMainDate variant="body3">
              <LocalDate date={item.news_details?.publish_date} />
            </FeaturedMainDate>
            <FeaturedMainTitle as="div">{item.title}</FeaturedMainTitle>
          </FeaturedMainOverlay>
        </FeaturedMainImage>
      </a>
    </FeaturedMainCard>
  )
}

// Sidebar Story Component
const SidebarStory: React.FC<{ item: NewsFeedItem }> = ({ item }) => {
  return (
    <SidebarStoryCard>
      <a
        href={item.url}
        style={{
          textDecoration: "none",
          display: "flex",
          width: "100%",
          height: "100%",
        }}
        aria-label={item.title}
      >
        <SidebarStoryImage imageUrl={item.image?.url} />
        <SidebarStoryContent>
          <SidebarStoryDate variant="body3">
            <LocalDate date={item.news_details?.publish_date} />
          </SidebarStoryDate>
          <SidebarStoryTitle>{item.title}</SidebarStoryTitle>
        </SidebarStoryContent>
      </a>
    </SidebarStoryCard>
  )
}

const ArticleListingPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const scrollHook = useRef<HTMLDivElement>(null)
  const [initialFeaturedStories, setInitialFeaturedStories] = useState<
    NewsFeedItem[]
  >([])

  // First page fetches 26 records (6 featured + 20 grid), rest fetch 20
  const currentLimit = page === 1 ? 26 : PAGE_SIZE
  const currentOffset = page === 1 ? 0 : 26 + (page - 2) * PAGE_SIZE

  const {
    data: news,
    isLoading,
    isFetching,
  } = useNewsEventsList({
    feed_type: [NewsEventsListFeedTypeEnum.News],
    limit: currentLimit,
    offset: currentOffset,
    sortby: "-news_date",
  })

  const stories = news?.results || []

  // Store the first 6 stories on initial load
  React.useEffect(() => {
    if (
      page === 1 &&
      news?.results &&
      news.results.length > 0 &&
      initialFeaturedStories.length === 0
    ) {
      setInitialFeaturedStories(news.results.slice(0, 6) as NewsFeedItem[])
    }
  }, [page, news?.results, initialFeaturedStories.length])

  // Use stored featured stories, or current stories for grid
  const featuredStories =
    initialFeaturedStories.length > 0
      ? initialFeaturedStories
      : stories.slice(0, 6)
  const gridStories = page === 1 ? stories.slice(6) : stories
  const featuredMain = featuredStories[0]
  const featuredSide = featuredStories.slice(1, 6)

  return (
    <>
      <BannerSection
        backgroundUrl={DEFAULT_BACKGROUND_IMAGE_URL}
        backgroundSize="cover"
        backgroundDim={0.4}
      >
        <Container>
          <Breadcrumbs
            variant="dark"
            ancestors={[{ href: "/", label: "Home" }]}
            current="MIT Stories"
          />
          <BannerTitle component="h1" variant="h1">
            MIT Stories
          </BannerTitle>
          <BannerDescription variant="body1">
            See what's happening in the world of learning with the latest news,
            insights, and upcoming events at MIT.
          </BannerDescription>
        </Container>
      </BannerSection>

      <Section>
        <div ref={scrollHook} />
        <Container>
          {isLoading && page === 1 ? (
            <LoadingContainer>
              <LoadingSpinner loading={isLoading} />
            </LoadingContainer>
          ) : (
            <>
              <BelowMdOnly>
                <MobileContent>
                  <MobileContainer>
                    <StoriesSlider>
                      {stories.map((item) => (
                        <Story
                          key={item.id}
                          mobile={true}
                          item={item as NewsFeedItem}
                        />
                      ))}
                    </StoriesSlider>
                  </MobileContainer>
                </MobileContent>
              </BelowMdOnly>

              <AboveMdOnly>
                {/* Featured Section: 1 large + 5 small */}
                {featuredMain ? (
                  <FeaturedSection>
                    <FeaturedMain>
                      <FeaturedMainStory item={featuredMain as NewsFeedItem} />
                    </FeaturedMain>
                    <FeaturedSidebar>
                      {featuredSide.map((item) => (
                        <SidebarStory
                          key={item.id}
                          item={item as NewsFeedItem}
                        />
                      ))}
                    </FeaturedSidebar>
                  </FeaturedSection>
                ) : (
                  <div>No featured stories available</div>
                )}

                {/* Grid Section: Rest of the articles */}
                {isFetching && page > 1 ? (
                  <LoadingContainer>
                    <LoadingSpinner loading={isFetching} />
                  </LoadingContainer>
                ) : gridStories.length > 0 ? (
                  <Content>
                    <StoriesContainer>
                      <Grid2 container columnSpacing="24px" rowSpacing="28px">
                        {gridStories.map((item) => (
                          <Grid2
                            key={item.id}
                            size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}
                          >
                            <Story item={item as NewsFeedItem} mobile={false} />
                          </Grid2>
                        ))}
                      </Grid2>
                    </StoriesContainer>
                  </Content>
                ) : null}
              </AboveMdOnly>
            </>
          )}
        </Container>

        {!isLoading && (
          <Container>
            <PaginationContainer>
              <Pagination
                count={getLastPage(news?.count ?? 0)}
                page={page}
                onChange={(_, newPage) => {
                  setPage(newPage)
                  setTimeout(() => {
                    scrollHook.current?.scrollIntoView({
                      block: "center",
                      behavior: "smooth",
                    })
                  }, 0)
                }}
                renderItem={(item) => (
                  <PaginationItem
                    slots={{
                      previous: RiArrowLeftLine,
                      next: RiArrowRightLine,
                    }}
                    {...item}
                  />
                )}
              />
            </PaginationContainer>
          </Container>
        )}
      </Section>
    </>
  )
}

export { ArticleListingPage }
