import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import { Container, Avatar } from "ol-components"
import { RiShareFill } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { useUserMe } from "api/hooks/user"
import { useArticle } from "../../../ArticleContext"
import { calculateReadTime } from "../../utils"

const StyledWrapper = styled.div(({ theme }) => ({
  width: "100vw",
  maxWidth: "100vw",
  position: "relative",
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  marginBottom: "56px",
  background: theme.custom.colors.white,
  padding: "12px 0",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "0 0 5px 0 rgb(0 0 0 / 15%)",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const InnerContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== "noAuthor",
})<{ noAuthor?: boolean }>(({ noAuthor }) => ({
  display: "flex",
  justifyContent: noAuthor ? "flex-end" : "space-between",
  alignItems: "center",
  "&&": {
    maxWidth: "890px",
  },
}))

const InfoContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})

const NameText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.black,
}))

const InfoText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
}))

const ArticleByLineInfoBar = ({ editor }: ReactNodeViewProps) => {
  const article = useArticle()

  const { data: user } = useUserMe()

  let author = null
  if (editor?.isEditable && !article?.user) {
    author = user
  } else {
    author = article?.user
  }

  const publishedDate = article?.is_published ? article?.created_on : null

  const content = editor?.isEditable ? editor?.getJSON() : article?.content
  const readTime = calculateReadTime(content)

  return (
    <NodeViewWrapper>
      <StyledWrapper>
        <InnerContainer noAuthor={!author}>
          {author && (
            <InfoContainer>
              <Avatar>
                {author.first_name?.charAt(0) || ""}
                {author.last_name?.charAt(0) || ""}
              </Avatar>
              <NameText>
                By {author.first_name} {author.last_name}
              </NameText>
              {readTime ? <InfoText>{readTime} min read</InfoText> : null}
              {readTime && publishedDate ? <InfoText>-</InfoText> : null}
              <InfoText>
                {publishedDate
                  ? new Date(publishedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : editor?.isEditable
                    ? null
                    : "Draft"}
              </InfoText>
            </InfoContainer>
          )}
          <ActionButton
            size="small"
            variant="bordered"
            edge="circular"
            aria-label="Share this article"
          >
            <RiShareFill />
          </ActionButton>
        </InnerContainer>
      </StyledWrapper>
    </NodeViewWrapper>
  )
}

export default ArticleByLineInfoBar
