import React from "react"
import styled from "@emotion/styled"
import type { JSONContent } from "@tiptap/core"
import { calculateReadTime } from "../../utils"

const Wrapper = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginTop: "24px",
})

const NameText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const InfoText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  opacity: 0.7,
}))

interface ArticleByLineInBannerProps {
  authorName?: string | null
  publishedDate?: string | null
  content?: JSONContent | null
}

const ArticleByLineInBanner = ({
  authorName,
  publishedDate,
  content,
}: ArticleByLineInBannerProps) => {
  const readTime = calculateReadTime(content)
  const displayAuthorName = authorName || ""

  if (!displayAuthorName && !readTime && !publishedDate) {
    return null
  }

  return (
    <Wrapper>
      {displayAuthorName && <NameText>By {displayAuthorName}</NameText>}
      {readTime ? <InfoText>{readTime} min read</InfoText> : null}
      {readTime && publishedDate ? <InfoText>·</InfoText> : null}
      <InfoText>
        {publishedDate
          ? new Date(publishedDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Draft"}
      </InfoText>
    </Wrapper>
  )
}

export { ArticleByLineInBanner }
