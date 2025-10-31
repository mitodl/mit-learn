"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import "ckeditor5/ckeditor5.css"
import "./styles.css"

export const ArticleDetail = ({ articleId }: { articleId: number }) => {
  const id = Number(articleId)
  const { data, isLoading } = useArticleDetail(id)

  if (isLoading) {
    return (
      <div className="article-detail-container">
        <div className="loader">Loading article...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="article-detail-container">
        <p className="empty">Article not found.</p>
      </div>
    )
  }

  return (
    <div className="article-detail-container">
      <h1 className="article-title">{data.title}</h1>

      {/* Render article HTML */}
      <div
        className="ck-content"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  )
}
