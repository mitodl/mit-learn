"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  Container,
  styled,
  theme,
  Grid2,
  Card,
  Pagination,
  PaginationItem,
  LoadingSpinner,
  Typography,
} from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { useWebsiteContentList } from "api/hooks/website_content"
import { useUserHasPermission, Permission } from "api/hooks/user"
import type { WebsiteContent } from "api/v1"
import { LocalDate } from "ol-utilities"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import { extractFirstImage } from "@/common/websiteContentUtils"
import {
  articleView,
  ARTICLES_LISTING,
  websiteContentCreateView,
} from "@/common/urls"

const PAGE_SIZE = 20
const MAX_PAGE = 50
const ARTICLE_CREATE_URL = websiteContentCreateView("article")

export const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/banner_background.webp"

const getLastPage = (count: number): number => {
  const pages = Math.ceil(count / PAGE_SIZE)
  return pages > MAX_PAGE ? MAX_PAGE : pages
}

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
`

const Section = styled.section`
  background: ${theme.custom.colors.white};
  padding: 80px 0;
  ${theme.breakpoints.down("sm")} {
    padding: 40px 0;
  }
`

const ArticleCardWrapper = styled(Card)`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
`

const ArticleCard: React.FC<{ article: WebsiteContent }> = ({ article }) => {
  const articleUrl = article.is_published
    ? articleView(article.slug || String(article.id))
    : `${ARTICLES_LISTING}${article.id}/draft`

  const imageUrl = extractFirstImage(article.content)

  return (
    <ArticleCardWrapper forwardClicksToLink>
      <Card.Image
        src={imageUrl || DEFAULT_BACKGROUND_IMAGE_URL}
        alt={article.title}
      />
      <Card.Title href={articleUrl} lines={2}>
        {article.title}
      </Card.Title>
      <Card.Footer>
        <LocalDate date={article.created_on} />
      </Card.Footer>
    </ArticleCardWrapper>
  )
}

const ArticleListingPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const canCreateArticle = useUserHasPermission(Permission.ArticleEditor)

  const { data: articles, isLoading } = useWebsiteContentList({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    content_type: "article",
  })

  useEffect(() => {
    if (page > 1 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [page])

  const results = articles?.results
  const totalPages = articles?.count ? getLastPage(articles.count) : 0

  return (
    <Section ref={scrollRef}>
      <Container>
        <PageHeader>
          <Typography variant="h3">Articles</Typography>
          {canCreateArticle ? (
            <ButtonLink variant="primary" href={ARTICLE_CREATE_URL}>
              New Article
            </ButtonLink>
          ) : null}
        </PageHeader>

        {isLoading ? (
          <LoadingSpinner loading size={48} />
        ) : results && results.length > 0 ? (
          <>
            <Grid2 container columnSpacing="24px" rowSpacing="28px">
              {results.map((article) => (
                <Grid2
                  key={article.id}
                  size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}
                >
                  <ArticleCard article={article} />
                </Grid2>
              ))}
            </Grid2>

            {totalPages > 1 && (
              <PaginationContainer>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
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
            )}
          </>
        ) : (
          <EmptyState>
            <Typography variant="h4">No Articles Yet</Typography>
            <Typography variant="body1" color="textSecondary">
              Get started by creating your first article.
            </Typography>
            {canCreateArticle ? (
              <ButtonLink variant="primary" href={ARTICLE_CREATE_URL}>
                New Article
              </ButtonLink>
            ) : null}
          </EmptyState>
        )}
      </Container>
    </Section>
  )
}

export { ArticleListingPage }
