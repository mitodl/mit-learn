"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound, usePathname } from "next/navigation"
import { Permission } from "api/hooks/user"
import { useWebsiteContentDetailRetrieve } from "api/hooks/website_content"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled, LoadingSpinner } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/contentTypes/article/ArticleEditor"
import { NewsEditor } from "@/page-components/TiptapEditor/contentTypes/news/NewsEditor"
import { articleView, newsView, websiteContentEditView } from "@/common/urls"
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
  news: (slug) => newsView(slug),
}

const EDITORS: Record<
  string,
  React.ComponentType<{
    onSave?: (savedContent: WebsiteContent) => void
    readOnly?: boolean
    contentItem?: WebsiteContent
    autosaveDelayMs?: number
  }>
> = {
  article: ({ contentItem, ...props }) => (
    <ArticleEditor article={contentItem} {...props} />
  ),
  news: ({ contentItem, ...props }) => (
    <NewsEditor newsItem={contentItem} {...props} />
  ),
}

interface WebsiteContentEditPageProps {
  type: string
  idOrSlug: string
  /**
   * Passed straight to the editor; only tests set it, to keep a background
   * draft save from landing in the middle of their interactions. See
   * `WebsiteContentEditor`.
   */
  autosaveDelayMs?: number
}

const WebsiteContentEditPage = ({
  type,
  idOrSlug,
  autosaveDelayMs,
}: WebsiteContentEditPageProps) => {
  const { data: article, isLoading } = useWebsiteContentDetailRetrieve(idOrSlug)
  const pathname = usePathname()
  const router = useRouter()

  const Editor = EDITORS[type]
  const viewUrl = PUBLISHED_VIEW_URL[type]

  if (!Editor || !viewUrl) {
    notFound()
  }

  if (isLoading) {
    return <Spinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        {/*
          Keyed by id so a genuinely different item gets a fresh editor, while
          a refetch of the *same* item leaves unsaved edits alone. The editor
          does not sync `contentItem` into its own state, so this is what
          resets it -- including fields like `topics`.

          Id rather than slug: a draft has no slug.
        */}
        <Editor
          key={article.id}
          contentItem={article}
          autosaveDelayMs={autosaveDelayMs}
          onSave={(saved) => {
            if (saved.is_published) {
              invariant(saved.slug, "Published content must have a slug")
              return router.push(viewUrl(saved.slug))
            }
            /**
             * Where a draft lives, which is usually where we already are --
             * the exception being a URL that names the item by slug, which
             * this canonicalises to the id once.
             *
             * Guarded because a draft saves itself every couple of seconds:
             * pushing the route we are on buys nothing (this page reads its
             * item through React Query, which the mutation already
             * invalidates) and costs a soft navigation and a run of the
             * progress bar each time.
             */
            const draftUrl = websiteContentEditView(type, saved.id)
            if (draftUrl !== pathname) {
              router.push(draftUrl)
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { WebsiteContentEditPage }
