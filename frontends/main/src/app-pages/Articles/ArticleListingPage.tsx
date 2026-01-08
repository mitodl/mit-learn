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

const ArticleListingPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const scrollHook = useRef<HTMLDivElement>(null)

  const {
    data: news,
    isLoading,
    isFetching,
  } = useNewsEventsList({
    feed_type: [NewsEventsListFeedTypeEnum.News],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sortby: "-news_date",
  })

  const stories = news?.results || []
  const showLoading = isLoading || isFetching
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
        {showLoading ? (
          <Container>
            <LoadingContainer>
              <LoadingSpinner loading={showLoading} />
            </LoadingContainer>
          </Container>
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
              <Container>
                <Content>
                  <StoriesContainer>
                    <Grid2 container columnSpacing="24px" rowSpacing="28px">
                      {stories.map((item) => (
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
              </Container>
            </AboveMdOnly>

            {!showLoading && (
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
          </>
        )}
      </Section>
    </>
  )
}

export { ArticleListingPage }
