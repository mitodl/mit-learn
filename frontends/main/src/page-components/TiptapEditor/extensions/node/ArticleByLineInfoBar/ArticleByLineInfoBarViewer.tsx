import React from "react"
import { useArticle } from "../../../ArticleContext"
import { ArticleByLineInfoBarContent } from "./ArticleByLineInfoBar"

const ArticleByLineInfoBarViewer = () => {
  const article = useArticle()

  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content
  const authorName = article?.author_name ?? null

  return (
    <ArticleByLineInfoBarContent
      publishedDate={publishedDate}
      content={content}
      isEditable={false}
      authorName={authorName}
    />
  )
}

export { ArticleByLineInfoBarViewer }
