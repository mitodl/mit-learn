"use client"

import React from "react"
import Image from "next/image"
import { useSearchParams } from "@mitodl/course-search-utils/next"
import {
  Container,
  styled,
  theme,
  Typography,
  Grid2,
  Pagination,
  PaginationItem,
  css,
  LoadingSpinner,
  PlainList,
} from "ol-components"
import Link from "next/link"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useNewsEventsList,
  NewsEventsListFeedTypeEnum,
  newsEventsKeys,
} from "api/hooks/newsEvents"
import type { NewsFeedItem } from "api/v0"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { LocalDate } from "ol-utilities"
import { linkifyText } from "@/common/utils"
import { ArticleBanner } from "./ArticleBanner"

const PAGE_SIZE = 20
const MAX_PAGE = 50

export const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/banner_background.webp"

const getLastPage = (count: number): number => {
  const pages = Math.ceil(count / PAGE_SIZE)
  return pages > MAX_PAGE ? MAX_PAGE : pages
}

const Section = styled.section`
  background: ${theme.custom.colors.white};
  padding: 80px 0;
  ${theme.breakpoints.down("sm")} {
    padding: 0;
  }
`

const FeaturedStorySection = styled.div`
  max-width: 1000px;
  margin: -290px auto 40px;
  position: relative;
  z-index: 10;

  ${theme.breakpoints.down("md")} {
    margin: -250px auto 24px;
  }
  ${theme.breakpoints.down("sm")} {
    margin: 24px auto;
    max-width: 100%;
  }
`

const MainStoryCard = styled.div`
  display: flex;
  border-bottom: 1px solid ${theme.custom.colors.lightGray2};
  background: ${theme.custom.colors.darkGray2};
  border-top: 4px solid #a31f34;
  border-radius: 10px;

  &:hover {
    h2 {
      text-decoration: underline;
    }
  }

  ${theme.breakpoints.down("sm")} {
    flex-direction: column;
    gap: 0;
  }
`

const MainStoryImage = styled.div`
  width: 50%;
  min-height: 400px;
  background-color: ${theme.custom.colors.darkGray1};
  border-radius: 10px 0 0 10px;
  overflow: hidden;
  position: relative;

  ${theme.breakpoints.down("md")} {
    min-height: 300px;
  }

  ${theme.breakpoints.down("sm")} {
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: auto;
    border-radius: 10px 10px 0 0;
  }
`

const MainStoryContent = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 40px;
  color: white;
  justify-content: space-between;

  ${theme.breakpoints.down("md")} {
    padding: 24px;
  }

  ${theme.breakpoints.down("sm")} {
    width: 100%;
    padding: 24px;
  }
`
const RegularStoryTitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  ${theme.breakpoints.down("sm")} {
    gap: 8px;
  }
`

const MainStoryContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  ${theme.breakpoints.down("md")} {
    gap: 16px;
  }
`

const MainStoryTitle = styled.h2`
  color: ${theme.custom.colors.white};
  ${{ ...theme.typography.h3 }}
  margin: 0;

  a {
    color: ${theme.custom.colors.white};
    text-decoration: none;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &:hover {
      color: ${theme.custom.colors.white};
    }
  }

  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.h5 }}
  }
  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.h5 }}
  }
`

const MainStorySummary = styled.p`
  color: ${theme.custom.colors.white};
  ${{ ...theme.typography.body1 }}
  margin: 0;
  line-height: 22px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: break-word;

  a {
    color: ${theme.custom.colors.white};
    text-decoration: underline;

    &:hover {
      opacity: 0.8;
    }
  }

  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.body1 }}
  }
  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.body2 }}
  }
`

const MainStoryDate = styled(Typography)`
  color: ${theme.custom.colors.white};
  ${{ ...theme.typography.body3 }}
  margin: 0;
`

// Regular story card for grid
const StoryCard = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
  background: white;
  border-radius: 8px;
  padding: 16px 16px 16px 24px;
  overflow: hidden;

  &:hover {
    border-radius: 8px;
    border: 1px solid ${theme.custom.colors.lightGray2};
    background: ${theme.custom.colors.white};
    box-shadow: 0 8px 20px 0 rgb(120 147 172 / 10%);

    h2 {
      color: ${theme.custom.colors.red};
    }
  }

  ${theme.breakpoints.down("sm")} {
    flex-direction: row;
    gap: 12px;
    padding: 16px 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid ${theme.custom.colors.lightGray2};
    border-radius: 0;

    &:hover {
      border: none;
      border-bottom: 1px solid ${theme.custom.colors.lightGray2};
      box-shadow: none;
    }
  }
`

const StoryImage = styled.div`
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  height: 180px;
  flex-shrink: 0;
  background-color: ${theme.custom.colors.lightGray1};
  border-radius: 8px;
  order: 2;
  align-self: flex-end;
  overflow: hidden;
  position: relative;

  ${theme.breakpoints.down("sm")} {
    width: 100px;
    min-width: 100px;
    max-width: 100px;
    height: 80px;
    order: 2;
    align-self: flex-start;
    border-radius: 4px;
  }
`

const StoryContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  order: 1;
  min-height: 180px;
  min-width: 0;
  overflow: hidden;

  ${theme.breakpoints.down("sm")} {
    order: 1;
    min-height: auto;
    min-width: 0;
    justify-content: space-between;
    gap: 8px;
  }
`

const StoryTitle = styled.h2`
  color: ${theme.custom.colors.darkGray2};
  ${{ ...theme.typography.h5 }}
  margin: 0;
  margin-top: 16px;

  a {
    color: ${theme.custom.colors.darkGray2};
    text-decoration: none;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &:hover {
      color: ${theme.custom.colors.red};
    }
  }

  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.subtitle1 }}
  }

  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.subtitle2 }}
    margin-top: 0;
    -webkit-line-clamp: 3;
  }
`

const StorySummary = styled.p`
  color: ${theme.custom.colors.darkGray2};
  ${{ ...theme.typography.body2 }}
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  overflow-wrap: break-word;

  a {
    color: ${theme.custom.colors.red};
    text-decoration: underline;

    &:hover {
      opacity: 0.8;
    }
  }

  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.body3 }}
    -webkit-line-clamp: 2;
    margin-top: 0;
    color: ${theme.custom.colors.black};
  }
`

const StoryDate = styled(Typography)`
  color: ${theme.custom.colors.silverGrayDark};
  ${{ ...theme.typography.body3 }}
  margin-bottom: 16px;

  ${theme.breakpoints.down("sm")} {
    margin-bottom: 0;
    margin-top: 0;
  }
`

const StyledSection = styled(Section)`
  background: ${theme.custom.colors.lightGray1};

  ul {
    list-style: none;
  }
`

const GridContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;

  ${theme.breakpoints.down("sm")} {
    max-width: 100%;
  }
`

const MobileContent = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 40px;
  margin: 40px 0;

  ${theme.breakpoints.down("sm")} {
    margin: 0;
  }
`

const MobileContainer = styled.section`
  width: 100%;
  margin: 0 -16px;

  h3 {
    margin: 0 16px 12px;
  }
`

const AboveMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const BelowMdOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    display: "none",
  },
}))

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 24px;

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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  width: 100%;
  gap: 16px;
  text-align: center;
  padding: 40px 20px;

  ${theme.breakpoints.down("sm")} {
    min-height: 300px;
    padding: 24px 16px;
  }
`
const ArticleBannerStyled = styled(ArticleBanner)<{ page: number }>(
  ({ page, theme }) => ({
    padding: "48px 0",
    paddingBottom: page === 1 ? "250px" : undefined,
    position: "relative",
    backgroundSize: "150% !important",
    backgroundPosition: "center !important",

    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      background: "rgb(0 0 0 / 85%)",
      zIndex: 1,
    },

    "& > *": {
      position: "relative",
      zIndex: 2,
    },

    [theme.breakpoints.down("md")]: {
      paddingBottom: page === 1 ? "198px" : undefined,
    },

    [theme.breakpoints.down("sm")]: {
      padding: "32px 0",
      marginBottom: 0,
    },
  }),
)

const MainStory: React.FC<{ item: NewsFeedItem }> = ({ item }) => {
  const [imageError, setImageError] = React.useState(false)

  return (
    <MainStoryCard>
      <MainStoryImage>
        {item.image?.url && !imageError && (
          <Link href={item.url}>
            <Image
              src={item.image.url}
              alt={item.image.alt || item.title}
              fill
              style={{ objectFit: "cover" }}
              onError={() => setImageError(true)}
            />
          </Link>
        )}
      </MainStoryImage>

      <MainStoryContent>
        <MainStoryContentContainer>
          <MainStoryTitle>
            <Link href={item.url}>{item.title}</Link>
          </MainStoryTitle>
          {item.summary && (
            <MainStorySummary
              dangerouslySetInnerHTML={{ __html: linkifyText(item.summary) }}
            />
          )}
        </MainStoryContentContainer>
        <MainStoryDate variant="body3">
          <LocalDate date={item.news_details?.publish_date} />
        </MainStoryDate>
      </MainStoryContent>
    </MainStoryCard>
  )
}

const RegularStory: React.FC<{ item: NewsFeedItem }> = ({ item }) => {
  const [imageError, setImageError] = React.useState(false)

  return (
    <StoryCard>
      <StoryContent>
        <RegularStoryTitleWrapper>
          <StoryTitle>
            <Link href={item.url}>{item.title}</Link>
          </StoryTitle>
          {item.summary && (
            <StorySummary
              dangerouslySetInnerHTML={{ __html: linkifyText(item.summary) }}
            />
          )}
        </RegularStoryTitleWrapper>
        <StoryDate variant="body3">
          <LocalDate date={item.news_details?.publish_date} />
        </StoryDate>
      </StoryContent>
      <Link href={item.url} style={{ textDecoration: "none", order: 2 }}>
        <StoryImage>
          {item.image?.url && !imageError && (
            <Image
              src={item.image.url}
              alt={item.image.alt || item.title}
              fill
              style={{ objectFit: "cover" }}
              onError={() => setImageError(true)}
            />
          )}
        </StoryImage>
      </Link>
    </StoryCard>
  )
}

const ArticleListingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get("page") ?? "1", 10)

  const showArticleList = useFeatureFlagEnabled(FeatureFlags.ArticleView)
  const queryClient = useQueryClient()

  const flagsLoaded = useFeatureFlagsLoaded()

  // Invalidate cache when feature flag changes
  React.useEffect(() => {
    if (showArticleList) {
      queryClient.invalidateQueries({ queryKey: newsEventsKeys.listRoot() })
    }
  }, [showArticleList, queryClient])

  const { data: news, isLoading } = useNewsEventsList({
    feed_type: [NewsEventsListFeedTypeEnum.News],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sortby: "-news_date",
  })

  const stories = news?.results ?? []

  // On page 1, first story is featured, rest are grid stories
  // On other pages, all stories are grid stories
  const mainStory =
    page === 1 && stories.length > 0 ? (stories[0] as NewsFeedItem) : null
  const gridStories = page === 1 ? stories.slice(1) : stories

  if (!flagsLoaded && showArticleList === undefined) {
    return <LoadingSpinner loading={!flagsLoaded} />
  }
  if (!showArticleList) {
    return notFound()
  }

  return (
    <>
      <ArticleBannerStyled
        page={page}
        title="News"
        description="Insights, ideas, and stories from the world of learning at MIT."
        currentBreadcrumb="News"
        backgroundUrl={DEFAULT_BACKGROUND_IMAGE_URL}
      />

      <StyledSection>
        <Container>
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner loading={isLoading} />
            </LoadingContainer>
          ) : stories.length === 0 ? (
            <EmptyState>
              <Typography variant="h4">No News Available</Typography>
              <Typography variant="body1" color="textSecondary">
                There are no news to display at this time. Please check back
                later.
              </Typography>
            </EmptyState>
          ) : (
            <>
              <BelowMdOnly>
                <MobileContent>
                  <MobileContainer>
                    {page === 1 && mainStory && (
                      <FeaturedStorySection>
                        <MainStory item={mainStory} />
                      </FeaturedStorySection>
                    )}
                    <PlainList>
                      {gridStories.map((item) => (
                        <li key={item.id}>
                          <RegularStory item={item as NewsFeedItem} />
                        </li>
                      ))}
                    </PlainList>
                  </MobileContainer>
                </MobileContent>
              </BelowMdOnly>

              <AboveMdOnly>
                {/* Main Story Section: Only visible on page 1 */}
                {page === 1 && mainStory && (
                  <FeaturedStorySection>
                    <MainStory item={mainStory} />
                  </FeaturedStorySection>
                )}

                {/* Grid Section: Other articles */}
                {gridStories.length > 0 ? (
                  <GridContainer>
                    <Grid2 container rowSpacing="16px" component={PlainList}>
                      {gridStories.map((item) => (
                        <Grid2 key={item.id} size={12} component="li">
                          <RegularStory item={item as NewsFeedItem} />
                        </Grid2>
                      ))}
                    </Grid2>
                  </GridContainer>
                ) : null}
              </AboveMdOnly>
            </>
          )}
        </Container>

        {!isLoading && gridStories.length > 0 && (
          <Container>
            <PaginationContainer>
              <Pagination
                count={getLastPage(news?.count ?? 0)}
                page={page}
                onChange={(_, newPage) => {
                  setSearchParams((current) => {
                    const copy = new URLSearchParams(current)
                    if (newPage === 1) {
                      copy.delete("page")
                    } else {
                      copy.set("page", newPage.toString())
                    }
                    return copy
                  })
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
      </StyledSection>
    </>
  )
}

export { ArticleListingPage }
