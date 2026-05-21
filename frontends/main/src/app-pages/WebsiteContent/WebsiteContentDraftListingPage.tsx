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
import { useWebsiteContentList } from "api/hooks/website_content"
import type {
  WebsiteContent,
  WebsiteContentApiWebsiteContentListRequest as WebsiteContentListRequest,
} from "api/v1"
import { LocalDate } from "ol-utilities"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import { extractFirstImage } from "@/common/websiteContentUtils"
import { websiteContentEditView, websiteContentCreateView } from "@/common/urls"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { ButtonLink } from "@mitodl/smoot-design"

const PAGE_SIZE = 20

export const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/banner_background.webp"

const PageWrapper = styled.div`
  background: ${theme.custom.colors.white};
  min-height: calc(100vh - 200px);
  padding: 80px 0;
  ${theme.breakpoints.down("md")} {
    padding: 40px 0;
  }
`

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
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

const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  news: "News",
}

const DraftItem: React.FC<{ article: WebsiteContent; type: string }> = ({
  article,
  type,
}) => {
  const itemUrl = article.is_published
    ? `/${type === "article" ? "articles" : type}/${article.slug || article.id}`
    : websiteContentEditView(type, article.id)

  const imageUrl = extractFirstImage(article.content)

  return (
    <DraftArticleCard forwardClicksToLink>
      <Card.Image
        src={imageUrl || DEFAULT_BACKGROUND_IMAGE_URL}
        alt={article.title}
      />
      <Card.Title href={itemUrl} lines={2} style={{ marginBottom: "-13px" }}>
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

interface WebsiteContentDraftListingPageProps {
  /**
   * Content type to show drafts for (e.g. 'article', 'news').
   */
  contentType?: string
}

const WebsiteContentDraftListingPage: React.FC<
  WebsiteContentDraftListingPageProps
> = ({ contentType }) => {
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const type = contentType || "article"
  const label = CONTENT_TYPE_LABELS[type] ?? type

  const listParams: WebsiteContentListRequest = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    draft: true,
    ...(contentType
      ? {
          content_type:
            contentType as WebsiteContentListRequest["content_type"],
        }
      : {}),
  }

  const { data: articles, isLoading: isLoadingArticles } =
    useWebsiteContentList(listParams)

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
      <PageWrapper ref={scrollRef}>
        <Container>
          <PageHeader>
            <Typography variant="h3">{label} Drafts</Typography>
            <ButtonLink
              variant="primary"
              href={websiteContentCreateView(type)}
              size="small"
            >
              New {label}
            </ButtonLink>
          </PageHeader>

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
                    <DraftItem article={article} type={type} />
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
              <Typography variant="h4">No Draft {label}s</Typography>
              <Typography variant="body1" color="textSecondary">
                You don&apos;t have any draft {label.toLowerCase()}s yet.
              </Typography>
            </EmptyState>
          )}
        </Container>
      </PageWrapper>
    </RestrictedRoute>
  )
}

export { WebsiteContentDraftListingPage }
