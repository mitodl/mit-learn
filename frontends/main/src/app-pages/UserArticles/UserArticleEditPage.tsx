"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { notFound } from "next/navigation"
import { Permission } from "api/hooks/user"
import { useArticleDetailRetrieve } from "api/hooks/articles"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { styled, LoadingSpinner } from "ol-components"
import { ArticleEditor } from "@/page-components/TiptapEditor/contentTypes/article/ArticleEditor"
import { userArticlesDraftView, userArticlesView } from "@/common/urls"
import invariant from "tiny-invariant"

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

const UserArticleEditPage = ({ articleId }: { articleId: string }) => {
  const {
    data: article,
    isLoading,
    isFetching,
  } = useArticleDetailRetrieve(articleId)
  const router = useRouter()

  if (isLoading || isFetching) {
    return <Spinner color="inherit" loading={isLoading} size={32} />
  }
  if (!article) {
    return notFound()
  }

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor
          article={article}
          onSave={(saved) => {
            if (saved.is_published) {
              invariant(saved.slug, "Published article must have a slug")
              return router.push(userArticlesView(saved.slug))
            } else {
              router.push(userArticlesDraftView(String(saved.id)))
            }
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { UserArticleEditPage }
