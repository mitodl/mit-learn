"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { Container, LoadingSpinner, styled, Typography } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { notFound } from "next/navigation"

const Page = styled(Container)({
  marginTop: "40px",
  marginBottom: "40px",
})

const EditButton = styled.div({
  textAlign: "right",
  margin: "10px",
})
const WrapperContainer = styled.div({
  borderBottom: "1px solid rgb(222, 208, 208)",
  paddingBottom: "10px",
})

const PreTag = styled.pre({
  background: "#f6f6f6",
  padding: "16px",
  borderRadius: "8px",
  fontSize: "14px",
  overflowX: "auto",
})

export const ArticleDetailPage = ({ articleId }: { articleId: number }) => {
  const id = Number(articleId)
  const { data, isLoading } = useArticleDetail(id)

  if (isLoading) {
    return <LoadingSpinner color="inherit" loading={isLoading} size={32} />
  }
  if (!data) {
    return notFound()
  }
  return (
    <Page>
      <WrapperContainer>
        <Typography variant="h3" component="h1">
          {data?.title}
        </Typography>

        <EditButton>
          <ButtonLink href={`/articles/${data.id}/edit`} variant="primary">
            Edit
          </ButtonLink>
        </EditButton>
      </WrapperContainer>
      <PreTag>{JSON.stringify(data.content, null, 2)}</PreTag>
    </Page>
  )
}
