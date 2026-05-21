"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled } from "ol-components"
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

const PUBLISHED_VIEW_URL: Record<string, (slug: string) => string> = {
  article: (slug) => articleView(slug),
  news: (slug) => `/news/${slug}`,
}

const EDITORS: Record<
  string,
  React.ComponentType<{
    onSave?: (savedContent: WebsiteContent) => void
    readOnly?: boolean
    contentItem?: WebsiteContent
  }>
> = {
  article: ({ contentItem, ...props }) => (
    <ArticleEditor article={contentItem} {...props} />
  ),
  news: ({ contentItem: _contentItem, ...props }) => <NewsEditor {...props} />,
}

interface WebsiteContentNewPageProps {
  type: string
}

const WebsiteContentNewPage: React.FC<WebsiteContentNewPageProps> = ({
  type,
}) => {
  const router = useRouter()
  const Editor = EDITORS[type]
  const viewUrl = PUBLISHED_VIEW_URL[type]

  if (!Editor || !viewUrl) {
    notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <Editor
          onSave={(article) => {
            if (article.is_published) {
              invariant(article.slug, "Published content must have a slug")
              return router.push(viewUrl(article.slug))
            } else {
              router.push(websiteContentEditView(type, article.id))
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { WebsiteContentNewPage }
