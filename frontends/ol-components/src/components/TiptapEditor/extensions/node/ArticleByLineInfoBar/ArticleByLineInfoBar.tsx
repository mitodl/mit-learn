import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import Container from "@mui/material/Container"
import { RiShareFill } from "@remixicon/react"
import Avatar from "@mui/material/Avatar"
import { ActionButton } from "@mitodl/smoot-design"
import { useUserMe } from "api/hooks/user"
import { useArticle } from "../../../ArticleContext"

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

const ArticleByLineInfoBar = ({ node }: ReactNodeViewProps) => {
  const {
    user: _author,
    avatarUrl,
    readTime,
    publishedDate,
    editable,
  } = node.attrs

  const article = useArticle()

  const { data: user } = useUserMe()

  let authorName = null
  if (editable && !article?.user) {
    authorName = `${user?.first_name || ""} ${user?.last_name || ""}`
  } else {
    authorName = article?.user
      ? `${article.user.first_name || ""} ${article.user.last_name || ""}`
      : null
  }

  return (
    <NodeViewWrapper>
      <StyledWrapper>
        <InnerContainer noAuthor={!authorName}>
          {authorName && (
            <InfoContainer>
              <Avatar src={avatarUrl}>
                {user?.first_name?.charAt(0) || ""}
                {user?.last_name?.charAt(0) || ""}
              </Avatar>

              <NameText>By {authorName}</NameText>
              {readTime && <InfoText>{readTime}</InfoText>}
              <InfoText>-</InfoText>
              <InfoText>
                {publishedDate
                  ? publishedDate
                  : new Date().toLocaleDateString()}
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
