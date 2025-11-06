"use client"

import React from "react"
import { useArticleDetail } from "api/hooks/articles"
import { Container, LoadingSpinner, styled } from "ol-components"
import { notFound } from "next/navigation"
import Link from "next/link"

import "ckeditor5/ckeditor5.css"

const ArticleTitle = styled.h1({
  fontSize: "24px",
  marginBottom: "12px",
})
const EditButton = styled.div({
  textAlign: "right",
  margin: "10px",
})
const WrapperContainer = styled.div({
  borderBottom: "1px solid rgb(222, 208, 208)",
  paddingBottom: "10px",
})

const EditButtonLink = styled(Link)({
  cursor: "pointer",
  minWidth: "100px",
  boxSizing: "border-box",
  borderWidth: "1px",
  padding: "11px 16px",
  fontFamily: "neue-haas-grotesk-text, sans-serif",
  fontStyle: "normal",
  fontSize: "0.875rem",
  lineHeight: "1.125rem",
  textTransform: "none",
  backgroundColor: "#750014",
  color: "#FFFFFF",
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
    <Container>
      <WrapperContainer>
        <ArticleTitle className="article-title">{data?.title}</ArticleTitle>

        <EditButton>
          <EditButtonLink
            href={`/articles/${data.id}/edit`}
            className="btn btn-edit"
            color="red"
          >
            Edit
          </EditButtonLink>
        </EditButton>
      </WrapperContainer>
      <div
        className="ck-content"
        dangerouslySetInnerHTML={{ __html: data?.html }}
      />
    </Container>
  )
}
