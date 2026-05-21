"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import { useWebsiteContentDetailRetrieve } from "api/hooks/website_content"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled, LoadingSpinner } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/contentTypes/article/ArticleEditor"
import { NewsEditor } from "@/page-components/TiptapEditor/contentTypes/news/NewsEditor"
import { articleView, websiteContentEditView } from "@/common/urls"
import invariant from "tiny-invariant"
import type { WebsiteContent } from "api/v1"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
}))

const Spinner = styled(LoadingSpinner)({
  margin: "auto",
  position: "absolute",
  top: "40%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

const PUBLISHED_VIEW_URL: Record<string, (slug: string) => string> = {
  article: (slug) => articleView(slug),
  news: (slug) => `/news/${slug}`,
}

const EDITORS: Record<
  string,
  React.ComponentType<{
    onSave?: (article: WebsiteContent) => void
    readOnly?: boolean
    article?: WebsiteContent
  }>
> = {
  article: ArticleEditor,
  news: NewsEditor,
}

interface WebsiteContentEditPageProps {
  type: string
  idOrSlug: string
}

const WebsiteContentEditPage = ({
  type,
  idOrSlug,
}: WebsiteContentEditPageProps) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useWebsiteContentDetailRetrieve(idOrSlug)
  const router = useRouter()

  const Editor = EDITORS[type]
  const viewUrl = PUBLISHED_VIEW_URL[type]

  if (!Editor || !viewUrl) {
    notFound()
  }

  if (isLoading || isFetching) {
    return <Spinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <Editor
          article={article}
          onSave={(saved) => {
            if (saved.is_published) {
              invariant(saved.slug, "Published content must have a slug")
              return router.push(viewUrl(saved.slug))
            } else {
              router.push(websiteContentEditView(type, saved.id))
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { WebsiteContentEditPage }
