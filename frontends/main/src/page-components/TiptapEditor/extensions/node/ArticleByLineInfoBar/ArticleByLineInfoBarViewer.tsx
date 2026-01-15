import React from "react"
import { useArticle } from "../../../ArticleContext"
import { ArticleByLineInfoBarContent } from "./ArticleByLineInfoBar"

const ArticleByLineInfoBarViewer = () => {
  const article = useArticle()

  const author = article?.user ?? null
  const publishedDate = article?.is_published ? article?.created_on : null
  const content = article?.content

  return (
    <ArticleByLineInfoBarContent
      author={author}
      publishedDate={publishedDate}
      content={content}
      isEditable={false}
    />
  )
}

export { ArticleByLineInfoBarViewer }
