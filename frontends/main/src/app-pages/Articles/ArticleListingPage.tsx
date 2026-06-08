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
  Breadcrumbs,
} from "ol-components"
import Link from "next/link"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import type { WebsiteContent } from "api/v1"
import { LocalDate } from "ol-utilities"
import { useWebsiteContentList } from "api/hooks/website_content"
import { extractArticleContent } from "@/common/websiteContentUtils"
import { articleView, websiteContentCreateView } from "@/common/urls"
import { Permission, useUserHasPermission } from "api/hooks/user"
import { ButtonLink } from "@mitodl/smoot-design"

const PAGE_SIZE = 10
const MAX_PAGE = 50

const getLastPage = (count: number): number => {
  const pages = Math.ceil(count / PAGE_SIZE)
  return pages > MAX_PAGE ? MAX_PAGE : pages
}

const Section = styled.section`
  background: ${theme.custom.colors.white};
  padding: 64px 0;
  ${theme.breakpoints.down("sm")} {
    padding: 0;
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

// Regular story card for grid
const StoryCard = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
  background: white;
  border-radius: 8px;
  padding: 16px 16px 16px 24px;
  overflow: hidden;
  border: 1px solid transparent;

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
  margin-top: 16px;

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
  max-width: 842px;
  margin: 0 auto;

  ${theme.breakpoints.down("sm")} {
    max-width: 100%;
  }
`

const BannerGridContainer = styled.div`
  max-width: 842px;
  margin: 0 auto;
  padding: 64px 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  ${theme.breakpoints.down("sm")} {
    max-width: 100%;
    padding: 32px 0;
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

const BannerSection = styled.div`
  background: ${theme.custom.colors.white};
  border-bottom: 1px solid ${theme.custom.colors.lightGray2};
`
const NewArticleLink = styled(ButtonLink)`
  display: flex;
  justify-content: end;
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

const BannerTitle = styled(Typography)`
  color: ${theme.custom.colors.black};
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.h2 }}
  }
  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.h3 }}
    margin-top: 0;
  }
` as typeof Typography

const BreadcrumbBar = styled.div(({ theme }) => ({
  width: "100%",
  padding: "18px 0 2px 0",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  textDecoration: "none",
  "&& .breadcrum span span a": {
    textDecoration: "none !important",
  },
  "&& .breadcrum span span a span": {
    textDecoration: "none !important",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))
const BreadcrumContainer = styled(Container)(({ theme }) => ({
  maxWidth: "1080px !important",
  padding: "0 !important",
  [theme.breakpoints.down("lg")]: {
    padding: "0 16px !important",
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px !important",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px !important",
  },
})) as typeof Container

const RegularStory: React.FC<{ item: WebsiteContent }> = ({ item }) => {
  const articleContent = extractArticleContent(item)
  const [imageError, setImageError] = React.useState(false)
  return (
    <StoryCard>
      <StoryContent>
        <RegularStoryTitleWrapper>
          <StoryTitle>
            <Link href={articleView(item.slug ?? String(item.id))}>
              {item.title}
            </Link>
          </StoryTitle>
          {articleContent.paragraph && (
            <StorySummary
              dangerouslySetInnerHTML={{
                __html: articleContent.paragraph,
              }}
            />
          )}
        </RegularStoryTitleWrapper>
        <StoryDate variant="body3">
          <LocalDate date={item?.publish_date || item?.updated_on} />
        </StoryDate>
      </StoryContent>
      {articleContent?.image?.src && !imageError && (
        <Link
          href={articleView(item.slug ?? String(item.id))}
          style={{ textDecoration: "none", order: 2 }}
        >
          <StoryImage>
            <Image
              src={articleContent.image.src}
              alt={articleContent.image.alt || item?.title}
              fill
              style={{ objectFit: "cover" }}
              onError={() => setImageError(true)}
            />
          </StoryImage>
        </Link>
      )}
    </StoryCard>
  )
}

const ArticleListingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)

  const { data: articles, isLoading } = useWebsiteContentList({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    content_type: "article",
  })

  const gridStories = articles?.results ?? []
  const totalPages = articles?.count ? getLastPage(articles.count) : 0

  React.useEffect(() => {
    if (!isLoading && totalPages > 0 && page > totalPages) {
      setSearchParams((current) => {
        const copy = new URLSearchParams(current)
        copy.delete("page")
        return copy
      })
    }
  }, [isLoading, page, totalPages, setSearchParams])

  return (
    <>
      <BannerSection>
        <BreadcrumbBar>
          <BreadcrumContainer className="breadcrum">
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: "/", label: "Home" }]}
              current="Articles"
            />
          </BreadcrumContainer>
        </BreadcrumbBar>
        <Container>
          <BannerGridContainer>
            <BannerTitle component="h1" variant="h1">
              Articles
            </BannerTitle>
            {isArticleEditor && (
              <NewArticleLink
                variant="primary"
                href={websiteContentCreateView("article")}
              >
                <Typography variant="body1" color="white">
                  New Article
                </Typography>
              </NewArticleLink>
            )}
          </BannerGridContainer>
        </Container>
      </BannerSection>
      <StyledSection>
        <Container>
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner loading={isLoading} />
            </LoadingContainer>
          ) : gridStories.length === 0 ? (
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
                    <PlainList>
                      {gridStories.map((item) => (
                        <li key={item.id}>
                          <RegularStory item={item} />
                        </li>
                      ))}
                    </PlainList>
                  </MobileContainer>
                </MobileContent>
              </BelowMdOnly>

              <AboveMdOnly>
                {/* Grid Section: Other news */}
                {gridStories.length > 0 ? (
                  <GridContainer>
                    <Grid2 container rowSpacing="16px" component={PlainList}>
                      {gridStories.map((item) => (
                        <Grid2 key={item.id} size={12} component="li">
                          <RegularStory item={item} />
                        </Grid2>
                      ))}
                    </Grid2>
                  </GridContainer>
                ) : null}
              </AboveMdOnly>
            </>
          )}
        </Container>

        {!isLoading && gridStories.length > 0 && totalPages > 1 && (
          <Container>
            <PaginationContainer>
              <Pagination
                count={totalPages}
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
