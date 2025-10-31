"use client"

import React from "react"
import Link from "next/link"
import { useArticleList, useArticleDestroy } from "api/hooks/articles"

interface Article {
  id: number
  title: string
}

const CkeditorArticlesList: React.FC = () => {
  const { data, isLoading } = useArticleList()
  const { mutate: destroyArticle, isPending } = useArticleDestroy()

  if (isLoading) return <div className="loading">Loading...</div>

  const articles = data?.results || []

  const handleDelete = (id: number) => {
    if (!confirm("Delete this article?")) return

    destroyArticle(id, {
      onSuccess: () => {
        // ✅ Refresh the list
        window.location.reload()
      },
    })
  }

  return (
    <div className="article-container">
      <div className="header">
        <h1>Articles</h1>
        <Link href="/articles" className="btn btn-primary">
          + New Article
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="empty">No articles found.</p>
      ) : (
        <ul className="article-list">
          {articles.map((article: Article) => (
            <li key={article.id} className="article-item">
              <Link href={`/articles/${article.id}/detail`} className="title">
                {article.title}
              </Link>

              <div className="actions">
                <Link
                  href={`/articles/${article.id}/edit`}
                  className="btn btn-edit"
                >
                  Edit
                </Link>

                <button
                  onClick={() => handleDelete(article.id)}
                  className="btn btn-delete"
                  disabled={isPending}
                >
                  {isPending ? "..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { CkeditorArticlesList }
