"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { ArticleEditor, styled } from "ol-components"
import { articlesView } from "@/common/urls"

const PageContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "flex",
  height: "100%",
}))

const ArticleNewPage: React.FC = () => {
  const router = useRouter()

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <PageContainer>
        <ArticleEditor
          onSave={(article) => {
            router.push(articlesView(article.id))
          }}
        />
      </PageContainer>
    </RestrictedRoute>
  )
}

export { ArticleNewPage }
