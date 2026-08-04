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
import {
  WebsiteContentContentTypeEnum,
  type WebsiteContent,
  type WebsiteContentApiWebsiteContentListRequest as WebsiteContentListRequest,
} from "api/v1"
import { LocalDate } from "ol-utilities"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiDeleteBinLine,
} from "@remixicon/react"
import { extractFirstImage } from "@/common/websiteContentUtils"
import { CONTENT_TYPE_LABELS } from "@/common/website_content"
import { websiteContentEditView, websiteContentCreateView } from "@/common/urls"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { ActionButton, ButtonLink } from "@mitodl/smoot-design"
import { showDeleteWebsiteContentDialog } from "@/page-components/WebsiteContentDialogs/DeleteWebsiteContentDialog"

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
const DraftContentCard = styled(Card)({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  // Card's internal wrapper around the footer and actions has no className of
  // its own, so target it via the footer it always renders. Anchoring on the
  // footer rather than the actions matters: Card omits the actions element
  // entirely when it has no children, which is the case for published items.
  // Keep the descendant form -- jsdom's selector engine rejects a leading
  // combinator inside :has(), so `:has(> .MitCard-footer)` breaks the tests.
  "> div:has(.MitCard-footer)": {
    alignItems: "center",
    paddingTop: "16px",
  },
})

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

const DraftItem: React.FC<{
  contentItem: WebsiteContent
  type: WebsiteContentContentTypeEnum
}> = ({ contentItem, type }) => {
  const itemUrl = contentItem.is_published
    ? `/${type === "article" ? "articles" : type}/${contentItem.slug || contentItem.id}`
    : websiteContentEditView(type, contentItem.id)

  const imageUrl = extractFirstImage(contentItem.content)

  return (
    <DraftContentCard forwardClicksToLink>
      <Card.Image
        src={imageUrl || DEFAULT_BACKGROUND_IMAGE_URL}
        alt={contentItem.title}
      />
      <Card.Title href={itemUrl} lines={2} style={{ marginBottom: "-13px" }}>
        {contentItem.title}
      </Card.Title>
      <Card.Footer>
        <LocalDate date={contentItem.created_on} />
        {!contentItem.is_published && (
          <>
            {" • "}
            <DraftBadge>Draft</DraftBadge>
          </>
        )}
      </Card.Footer>
      {/*
        Only drafts are deletable — the API rejects deleting published content
        with a 400. This page filters to drafts, so the guard is belt-and-braces:
        it keeps the UI honest about the backend rule if a published item ever
        reaches this list.
      */}
      {!contentItem.is_published && (
        <Card.Actions>
          <ActionButton
            variant="secondary"
            edge="circular"
            size="small"
            aria-label={`Delete ${contentItem.title}`}
            onClick={() => showDeleteWebsiteContentDialog(contentItem)}
          >
            <RiDeleteBinLine size={16} />
          </ActionButton>
        </Card.Actions>
      )}
    </DraftContentCard>
  )
}

interface WebsiteContentDraftListingPageProps {
  /**
   * Content type to show drafts for. Defaults to news.
   */
  contentType?: WebsiteContentContentTypeEnum
}

const WebsiteContentDraftListingPage: React.FC<
  WebsiteContentDraftListingPageProps
> = ({ contentType }) => {
  const [page, setPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const type = contentType ?? WebsiteContentContentTypeEnum.News
  const label = CONTENT_TYPE_LABELS[type]

  const listParams: WebsiteContentListRequest = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    draft: true,
    content_type: type,
  }

  const { data: contentItems, isLoading: isLoadingContentItems } =
    useWebsiteContentList(listParams)

  useEffect(() => {
    if (page > 1 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [page])

  const draftItems = contentItems?.results
  const totalPages = contentItems?.count
    ? Math.ceil(contentItems.count / PAGE_SIZE)
    : 0

  if (isLoadingContentItems) {
    return <LoadingSpinner loading={isLoadingContentItems} />
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

          {isLoadingContentItems ? (
            <LoadingContainer>
              <LoadingSpinner loading size={48} />
            </LoadingContainer>
          ) : draftItems && draftItems.length > 0 ? (
            <>
              <Grid2 container columnSpacing="24px" rowSpacing="28px">
                {draftItems.map((contentItem) => (
                  <Grid2
                    key={contentItem.id}
                    size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}
                  >
                    <DraftItem contentItem={contentItem} type={type} />
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
