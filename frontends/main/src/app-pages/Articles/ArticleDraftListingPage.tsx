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
import { Permission } from "api/hooks/user"
import { useArticleList } from "api/hooks/articles"
import type { RichTextArticle } from "api/v1"
import { LocalDate } from "ol-utilities"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import { ArticleBanner, DEFAULT_BACKGROUND_IMAGE_URL } from "./ArticleBanner"
import { extractFirstImageFromArticle } from "@/common/articleUtils"
import { articlesDraftView, articlesView } from "@/common/urls"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

const PAGE_SIZE = 20

const PageWrapper = styled.div`
  background: ${theme.custom.colors.white};
  min-height: calc(100vh - 200px);
  padding: 80px 0;
  ${theme.breakpoints.down("md")} {
    padding: 40px 0;
  }
`

const DraftArticleCard = styled(Card)`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
`

const DraftBadge = styled.span`
  color: ${theme.custom.colors.silverGrayDark};
  font-weight: ${theme.typography.fontWeightMedium};
`

export const DraftArticle: React.FC<{ article: RichTextArticle }> = ({
  article,
}) => {
  const articleUrl = article.is_published
    ? articlesView(article.slug || String(article.id))
    : articlesDraftView(String(article.id))

  const imageUrl = extractFirstImageFromArticle(article.content)

  return (
    <DraftArticleCard forwardClicksToLink>
      {
        <Card.Image
          src={imageUrl || DEFAULT_BACKGROUND_IMAGE_URL}
          alt={article.title}
        />
      }
      <Card.Title href={articleUrl} lines={2} style={{ marginBottom: "-13px" }}>
        {article.title}
      </Card.Title>
      <Card.Footer>
        <LocalDate date={article.created_on} />
        {!article.is_published && (
          <>
            {" • "}
            <DraftBadge>Draft</DraftBadge>
          </>
        )}
      </Card.Footer>
    </DraftArticleCard>
  )
}

const ArticleDraftPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: articles, isLoading: isLoadingArticles } = useArticleList({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    draft: true, // Filter for drafts only on the backend
  })

  useEffect(() => {
    if (page > 1 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [page])

  const draftArticles = articles?.results
  const totalPages = articles?.count ? Math.ceil(articles.count / PAGE_SIZE) : 0

  if (isLoadingArticles) {
    return <LoadingSpinner loading={isLoadingArticles} />
  }
  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <ArticleBanner
        title="Draft Articles"
        description="Manage your unpublished articles that are currently in draft status."
        currentBreadcrumb="Draft Articles"
      />
      <PageWrapper ref={scrollRef}>
        <Container>
          {isLoadingArticles ? (
            <LoadingContainer>
              <LoadingSpinner loading size={48} />
            </LoadingContainer>
          ) : draftArticles && draftArticles.length > 0 ? (
            <>
              <Grid2 container columnSpacing="24px" rowSpacing="28px">
                {draftArticles.map((article) => (
                  <Grid2
                    key={article.id}
                    size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}
                  >
                    <DraftArticle article={article} />
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
              <Typography variant="h4">No Draft Articles</Typography>
              <Typography variant="body1" color="textSecondary">
                You don't have any draft articles yet. Create a new article to
                get started.
              </Typography>
            </EmptyState>
          )}
        </Container>
      </PageWrapper>
    </RestrictedRoute>
  )
}

export { ArticleDraftPage }
