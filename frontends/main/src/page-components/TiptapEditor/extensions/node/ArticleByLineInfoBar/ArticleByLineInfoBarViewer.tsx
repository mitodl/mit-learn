import React from "react"
import { useWebsiteContent } from "../../../ArticleContext"
import { ByLineInfoBarContent } from "./ArticleByLineInfoBar"
import { ArticleByLineInBanner } from "./ArticleByLineInfoBarInBanner"

const ByLineInfoBarViewer = () => {
  const article = useWebsiteContent()

  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content
  const authorName = article?.author_name ?? null

  return (
    <ByLineInfoBarContent
      publishedDate={publishedDate}
      content={content}
      isEditable={false}
      authorName={authorName}
    />
  )
}

export { ByLineInfoBarViewer }

/** @deprecated Use ByLineInfoBarViewer */
export { ByLineInfoBarViewer as ArticleByLineInfoBarViewer }

const ArticleByLineInBannerViewer = () => {
  const article = useWebsiteContent()

  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content
  const authorName = article?.author_name ?? null

  return (
    <ArticleByLineInBanner
      publishedDate={publishedDate}
      content={content}
      authorName={authorName}
    />
  )
}

export { ArticleByLineInBannerViewer }
